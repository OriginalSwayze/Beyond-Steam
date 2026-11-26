#include "app.h"
#include <fstream>
#include <map>
#include <sstream>
#include <shellapi.h>
#include <shlobj.h>
#include <tlhelp32.h>

// ---------- small helpers ----------

static fs::path g_logPath;

void Log(const std::string& line) {
	if (g_logPath.empty()) return;
	static std::mutex mu;
	std::lock_guard<std::mutex> lock(mu);
	std::error_code ec;
	if (fs::exists(g_logPath, ec) && fs::file_size(g_logPath, ec) > (1 << 20)) fs::rename(g_logPath, fs::path(g_logPath).replace_extension(".old.txt"), ec);
	SYSTEMTIME t;
	GetLocalTime(&t);
	char stamp[32];
	snprintf(stamp, sizeof stamp, "%04d-%02d-%02d %02d:%02d:%02d ", t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute, t.wSecond);
	std::ofstream(g_logPath, std::ios::app) << stamp << line << "\n";
}

static bool ReadFile(const fs::path& p, std::string& out) {
	std::ifstream f(p, std::ios::binary);
	if (!f) return false;
	std::ostringstream ss;
	ss << f.rdbuf();
	out = ss.str();
	return true;
}

static const char* B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static std::string Base64(const std::string& in) {
	std::string out;
	out.reserve((in.size() + 2) / 3 * 4);
	size_t i = 0;
	for (; i + 2 < in.size(); i += 3) {
		unsigned v = (unsigned char)in[i] << 16 | (unsigned char)in[i + 1] << 8 | (unsigned char)in[i + 2];
		out += B64[v >> 18 & 63]; out += B64[v >> 12 & 63]; out += B64[v >> 6 & 63]; out += B64[v & 63];
	}
	if (i < in.size()) {
		unsigned v = (unsigned char)in[i] << 16 | (i + 1 < in.size() ? (unsigned char)in[i + 1] << 8 : 0);
		out += B64[v >> 18 & 63]; out += B64[v >> 12 & 63];
		out += i + 1 < in.size() ? B64[v >> 6 & 63] : '=';
		out += '=';
	}
	return out;
}

static std::string Unbase64(const std::string& in) {
	int map[256];
	std::fill(std::begin(map), std::end(map), -1);
	for (int i = 0; i < 64; i++) map[(unsigned char)B64[i]] = i;
	std::string out;
	unsigned v = 0;
	int bits = 0;
	for (unsigned char c : in) {
		if (map[c] < 0) continue;
		v = v << 6 | map[c];
		bits += 6;
		if (bits >= 8) { bits -= 8; out += char(v >> bits & 255); }
	}
	return out;
}

static std::string UrlDecode(const std::string& s) {
	std::string out;
	for (size_t i = 0; i < s.size(); i++) {
		if (s[i] == '%' && i + 2 < s.size() && isxdigit((unsigned char)s[i + 1]) && isxdigit((unsigned char)s[i + 2])) {
			out += (char)std::stoi(s.substr(i + 1, 2), nullptr, 16);
			i += 2;
		} else out += s[i];
	}
	return out;
}

static std::string UrlEncodePath(const std::string& s) {
	std::string out;
	char hex[4];
	for (unsigned char c : s) {
		if (isalnum(c) || strchr("-_.~/", c)) out += (char)c;
		else { snprintf(hex, sizeof hex, "%%%02X", c); out += hex; }
	}
	return out;
}

static std::string Lower(std::string s) {
	for (auto& c : s) c = (char)tolower((unsigned char)c);
	return s;
}

static std::string Mime(const fs::path& p) {
	static const std::map<std::string, std::string> m = {
		{".css", "text/css"}, {".js", "text/javascript"}, {".mjs", "text/javascript"}, {".json", "application/json"},
		{".html", "text/html"}, {".svg", "image/svg+xml"}, {".png", "image/png"}, {".jpg", "image/jpeg"}, {".jpeg", "image/jpeg"},
		{".gif", "image/gif"}, {".webp", "image/webp"}, {".avif", "image/avif"}, {".ico", "image/x-icon"}, {".woff", "font/woff"},
		{".woff2", "font/woff2"}, {".ttf", "font/ttf"}, {".otf", "font/otf"}, {".mp3", "audio/mpeg"}, {".ogg", "audio/ogg"},
		{".wav", "audio/wav"}, {".mp4", "video/mp4"}, {".webm", "video/webm"}, {".txt", "text/plain"}};
	auto it = m.find(Lower(p.extension().string()));
	return it == m.end() ? "application/octet-stream" : it->second;
}

// Joins a relative URL path under root, refusing anything that climbs out of it.
static bool SafeJoin(const fs::path& root, const std::string& rel, fs::path& out) {
	fs::path p = root;
	std::stringstream ss(rel);
	std::string part;
	while (std::getline(ss, part, '/')) {
		if (part.empty() || part == ".") continue;
		if (part == ".." || part.find('\\') != std::string::npos || part.find(':') != std::string::npos) return false;
		p /= Widen(part);
	}
	out = p;
	return true;
}

static std::string HostOf(const std::string& url) {
	size_t at = url.find("://");
	if (at == std::string::npos) return "";
	std::string rest = url.substr(at + 3);
	return Lower(rest.substr(0, rest.find_first_of("/?#:")));
}

static bool IsSteamHost(const std::string& host) {
	for (const char* d : {"steampowered.com", "steamcommunity.com"}) {
		std::string dom = d;
		if (host == dom || (host.size() > dom.size() && host.compare(host.size() - dom.size(), dom.size(), dom) == 0 && host[host.size() - dom.size() - 1] == '.')) return true;
	}
	return false;
}

static std::string AccentHex() {
	DWORD v = 0, size = sizeof v;
	if (RegGetValueW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\DWM", L"AccentColor", RRF_RT_REG_DWORD, nullptr, &v, &size) != ERROR_SUCCESS) return "#1A9FFF";
	char hex[8];
	snprintf(hex, sizeof hex, "#%02X%02X%02X", v & 255, v >> 8 & 255, v >> 16 & 255); // stored as ABGR
	return hex;
}

static bool SteamRunning() {
	HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
	if (snap == INVALID_HANDLE_VALUE) return false;
	PROCESSENTRY32W e{sizeof e};
	bool found = false;
	for (BOOL ok = Process32FirstW(snap, &e); ok; ok = Process32NextW(snap, &e))
		if (_wcsicmp(e.szExeFile, L"steam.exe") == 0) { found = true; break; }
	CloseHandle(snap);
	return found;
}

// ---------- App ----------

App::App() {
	PWSTR appdata = nullptr;
	SHGetKnownFolderPath(FOLDERID_RoamingAppData, 0, nullptr, &appdata);
	dataDir = fs::path(appdata) / L"Beyond Steam";
	CoTaskMemFree(appdata);
	themesDir = dataDir / L"themes";
	pluginsDir = dataDir / L"plugins";
	std::error_code ec;
	fs::create_directories(themesDir, ec);
	fs::create_directories(pluginsDir, ec);
	g_logPath = dataDir / L"log.txt";

	wchar_t exe[MAX_PATH];
	GetModuleFileNameW(nullptr, exe, MAX_PATH);
	fs::path here = fs::path(exe).parent_path();
	for (fs::path p : {here / L"web", here.parent_path() / L"web", here.parent_path().parent_path() / L"web"})
		if (fs::exists(p / L"boot.js", ec)) { webDir = p; break; }

	wchar_t steam[MAX_PATH];
	DWORD size = sizeof steam;
	if (RegGetValueW(HKEY_CURRENT_USER, L"Software\\Valve\\Steam", L"SteamPath", RRF_RT_REG_SZ, nullptr, steam, &size) == ERROR_SUCCESS)
		steamDir = fs::path(steam).make_preferred();

	port = server_.Start(kServerPort, [this](const HttpRequest& r) { return Handle(r); });
	Log(std::string("Beyond Steam ") + kVersion + " started; server port " + std::to_string(port) + ", web " + webDir.string() + ", Steam " + steamDir.string());
}

std::shared_ptr<Cdp> App::Client() {
	std::lock_guard<std::mutex> lock(cdpMu_);
	return cdp_;
}

json App::LoadConfig() {
	std::string text;
	json millennium;
	if (ReadFile(steamDir / L"millennium" / L"config" / L"config.json", text)) millennium = json::parse(text, nullptr, false);
	auto importPlugins = [&](json& cfg) { // redesigns that were on in Millennium start out on here too
		cfg["plugins"] = json::array();
		if (millennium.is_object() && millennium.contains("plugins") && millennium["plugins"].contains("enabledPlugins") && millennium["plugins"]["enabledPlugins"].is_array())
			cfg["plugins"] = millennium["plugins"]["enabledPlugins"];
	};
	if (ReadFile(dataDir / L"config.json", text)) {
		json j = json::parse(text, nullptr, false);
		if (j.is_object()) {
			if (!j.contains("plugins")) { importPlugins(j); SaveConfig(j); }
			return j;
		}
	}
	// First run: carry over the theme and options chosen in Millennium, if it was used.
	json cfg = {{"activeTheme", ""}, {"conditions", json::object()}};
	importPlugins(cfg);
	{
		json& m = millennium;
		if (m.is_object() && m.contains("themes")) {
			auto& t = m["themes"];
			if (t.value("activeTheme", "") != "default") cfg["activeTheme"] = t.value("activeTheme", "");
			if (t.contains("conditions") && t["conditions"].is_object()) cfg["conditions"] = t["conditions"];
			Log("imported settings from Millennium: theme " + cfg["activeTheme"].get<std::string>());
		}
	}
	SaveConfig(cfg);
	return cfg;
}

void App::SaveConfig(const json& cfg) {
	fs::path tmp = dataDir / L"config.json.tmp";
	{
		std::ofstream f(tmp, std::ios::binary);
		f << cfg.dump(2, ' ', false, json::error_handler_t::replace);
	}
	std::error_code ec;
	fs::rename(tmp, dataDir / L"config.json", ec);
}

// A picture for the theme browser: the theme's own copy of its header image if it has one, else the web address.
std::string App::Preview(const json& j, const fs::path& dir, const std::string& folder) const {
	std::string img = j.value("header_image", "");
	if (img.empty()) img = j.value("splash_image", "");
	const std::string raw = "https://raw.githubusercontent.com/";
	std::string rel;
	if (img.rfind(raw, 0) == 0) { // owner/repo/branch/path
		size_t a = img.find('/', raw.size());
		if (a != std::string::npos) a = img.find('/', a + 1);
		if (a != std::string::npos) a = img.find('/', a + 1);
		if (a != std::string::npos) rel = UrlDecode(img.substr(a + 1));
	}
	std::error_code ec;
	for (std::string cand : {rel, std::string("preview.png"), std::string("preview.jpg"), std::string("preview.gif"), std::string("media/header.png")}) {
		fs::path p;
		if (!cand.empty() && SafeJoin(dir, cand, p) && fs::exists(p, ec)) return Base() + "/themes/" + UrlEncodePath(folder) + "/" + UrlEncodePath(cand);
	}
	if (img.rfind("https://", 0) == 0) return img;
	if (fs::exists(dataDir / L"previews" / (Widen(folder) + L".jpg"), ec)) return Base() + "/previews/" + UrlEncodePath(folder) + ".jpg";
	return "";
}

// Takes a snapshot of Steam's main window wearing the active theme, as that theme's preview picture.
bool App::Capture() {
	auto cdp = Client();
	std::string active = ActiveTheme();
	if (!cdp || active.empty()) return false;
	json r = cdp->Call("Target.getTargets", json::object(), "", 3000);
	if (!r.contains("result")) return false;
	// After interface reloads Steam can list old main windows too; try the newest first.
	auto& all = r["result"]["targetInfos"];
	for (auto it = all.rbegin(); it != all.rend(); ++it) {
		const json& t = *it;
		if (t.value("title", "") != "Steam" || t.value("type", "") != "page") continue;
		json a = cdp->Call("Target.attachToTarget", {{"targetId", t["targetId"]}, {"flatten", true}}, "", 3000);
		if (!a.contains("result")) continue;
		std::string sid = a["result"].value("sessionId", "");
		json m = cdp->Call("Page.getLayoutMetrics", json::object(), sid, 2000);
		if (!m.contains("result")) { cdp->Post("Target.detachFromTarget", {{"sessionId", sid}}); continue; }
		double w = m["result"]["cssVisualViewport"].value("clientWidth", 1280.0);
		double h = m["result"]["cssVisualViewport"].value("clientHeight", 800.0);
		json shot = cdp->Call("Page.captureScreenshot", {{"format", "jpeg"}, {"quality", 82}, {"clip", {{"x", 0}, {"y", 0}, {"width", w}, {"height", h}, {"scale", 640.0 / w}}}}, sid, 4000);
		cdp->Post("Target.detachFromTarget", {{"sessionId", sid}});
		if (!shot.contains("result")) continue;
		std::error_code ec;
		fs::create_directories(dataDir / L"previews", ec);
		std::ofstream(dataDir / L"previews" / (Widen(active) + L".jpg"), std::ios::binary) << Unbase64(shot["result"].value("data", ""));
		Log("saved a preview snapshot of " + active);
		return true;
	}
	Log("snapshot failed (is Steam's window minimised?)");
	return false;
}

std::vector<ThemeInfo> App::ListThemes() const {
	std::vector<ThemeInfo> out;
	std::vector<fs::path> roots = {themesDir};
	if (!steamDir.empty()) roots.push_back(steamDir / L"millennium" / L"themes");
	std::error_code ec;
	for (auto& root : roots) {
		for (auto it = fs::directory_iterator(root, ec); !ec && it != fs::directory_iterator(); it.increment(ec)) {
			fs::path dir = it->path();
			std::string text;
			if (!ReadFile(dir / L"skin.json", text)) continue;
			json j = json::parse(text, nullptr, false, true);
			if (!j.is_object()) continue;
			ThemeInfo t;
			t.folder = Narrow(dir.filename().wstring());
			if (FindTheme(out, t.folder)) continue; // the user's own copy wins over an imported one
			t.dir = dir;
			t.name = j.value("name", t.folder);
			t.author = j.value("author", "");
			t.description = j.value("description", "");
			t.version = j.value("version", "");
			if (j.contains("tags") && j["tags"].is_array()) t.tags = j["tags"];
			t.options = j.contains("Conditions") && j["Conditions"].is_object() && !j["Conditions"].empty();
			t.preview = Preview(j, dir, t.folder);
			out.push_back(std::move(t));
		}
		ec.clear();
	}
	std::sort(out.begin(), out.end(), [](const ThemeInfo& a, const ThemeInfo& b) { return Lower(a.name) < Lower(b.name); });
	return out;
}

json App::ListPlugins() const {
	json out = json::array();
	std::error_code ec;
	for (auto it = fs::directory_iterator(pluginsDir, ec); !ec && it != fs::directory_iterator(); it.increment(ec)) {
		std::string text;
		if (!ReadFile(it->path() / L"plugin.json", text)) continue;
		json j = json::parse(text, nullptr, false, true);
		if (!j.is_object() || !j.contains("main") || !j["main"].is_string()) continue;
		std::string folder = Narrow(it->path().filename().wstring());
		out.push_back({{"folder", folder}, {"id", j.value("id", folder)}, {"name", j.value("name", folder)}, {"version", j.value("version", "")},
			{"author", j.value("author", "")}, {"description", j.value("description", "")}, {"main", j["main"]}, {"theme", j.value("theme", "")},
			{"home", j.value("home", "")}});
	}
	return out;
}

const ThemeInfo* App::FindTheme(const std::vector<ThemeInfo>& all, const std::string& folder) const {
	for (auto& t : all)
		if (_stricmp(t.folder.c_str(), folder.c_str()) == 0) return &t;
	return nullptr;
}

std::string App::ActiveTheme() {
	std::lock_guard<std::mutex> lock(cfgMu_);
	return LoadConfig().value("activeTheme", "");
}

void App::SetActiveTheme(const std::string& folder) {
	{
		std::lock_guard<std::mutex> lock(cfgMu_);
		json cfg = LoadConfig();
		cfg["activeTheme"] = folder;
		SaveConfig(cfg);
	}
	Log("theme set to '" + folder + "'");
	Refresh();
}

void App::Refresh() {
	auto cdp = Client();
	std::string session;
	{
		std::lock_guard<std::mutex> lock(sjcMu_);
		session = sjcSession_;
	}
	// Settings changed outside Steam (the tray menu): reload the interface if the old theme ran scripts, else re-style.
	static const char* js =
		"window.__BS && (Array.from(g_PopupManager.GetPopups()).some((p) => (p.m_popup?.window || p.window)?.document?.querySelector("
		"'script[data-bs-theme]')) ? SteamClient.Browser.RestartJSContext() : window.__BS.refresh())";
	if (cdp && !session.empty()) cdp->Post("Runtime.evaluate", {{"expression", js}}, session);
}

void App::OpenManager() {
	ShowSteamWindow();
	std::thread([this] {
		Sleep(700);
		auto cdp = Client();
		std::string session;
		{
			std::lock_guard<std::mutex> lock(sjcMu_);
			session = sjcSession_;
		}
		if (cdp && !session.empty()) cdp->Post("Runtime.evaluate", {{"expression", "window.__BS && window.__BS.open()"}}, session);
	}).detach();
}

static const wchar_t* kRunKey = L"Software\\Microsoft\\Windows\\CurrentVersion\\Run";

// Brings Steam's main window back after an interface reload: un-minimises it, or asks Steam to show it.
void ShowSteamWindow() {
	struct Ctx { std::vector<DWORD> pids; bool restored = false; } ctx;
	HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
	PROCESSENTRY32W e{sizeof e};
	for (BOOL ok = Process32FirstW(snap, &e); ok; ok = Process32NextW(snap, &e))
		if (_wcsicmp(e.szExeFile, L"steamwebhelper.exe") == 0) ctx.pids.push_back(e.th32ProcessID);
	CloseHandle(snap);
	EnumWindows([](HWND h, LPARAM l) -> BOOL {
		auto* c = (Ctx*)l;
		DWORD pid = 0;
		GetWindowThreadProcessId(h, &pid);
		wchar_t title[64] = {};
		GetWindowTextW(h, title, 64);
		if (std::find(c->pids.begin(), c->pids.end(), pid) != c->pids.end() && wcscmp(title, L"Steam") == 0 && IsWindowVisible(h) && IsIconic(h)) {
			ShowWindow(h, SW_RESTORE);
			c->restored = true;
		}
		return TRUE;
	}, (LPARAM)&ctx);
	if (!ctx.restored) ShellExecuteW(nullptr, L"open", L"steam://open/main", nullptr, nullptr, SW_SHOWNORMAL);
}

bool AutostartOn() {
	return RegGetValueW(HKEY_CURRENT_USER, kRunKey, L"Beyond Steam", RRF_RT_REG_SZ, nullptr, nullptr, nullptr) == ERROR_SUCCESS;
}

void SetAutostart(bool on) {
	HKEY k;
	if (RegOpenKeyExW(HKEY_CURRENT_USER, kRunKey, 0, KEY_SET_VALUE, &k) != ERROR_SUCCESS) return;
	if (on) {
		wchar_t exe[MAX_PATH];
		GetModuleFileNameW(nullptr, exe, MAX_PATH);
		std::wstring cmd = L"\"" + std::wstring(exe) + L"\" --background";
		RegSetValueExW(k, L"Beyond Steam", 0, REG_SZ, (const BYTE*)cmd.c_str(), DWORD((cmd.size() + 1) * sizeof(wchar_t)));
	} else {
		RegDeleteValueW(k, L"Beyond Steam");
	}
	RegCloseKey(k);
}

json App::State() {
	json cfg;
	{
		std::lock_guard<std::mutex> lock(cfgMu_);
		cfg = LoadConfig();
	}
	auto all = ListThemes();
	json list = json::array();
	for (auto& t : all)
		list.push_back({{"folder", t.folder}, {"name", t.name}, {"author", t.author}, {"description", t.description}, {"version", t.version},
			{"preview", t.preview}, {"tags", t.tags}, {"options", t.options}});
	json plugins = ListPlugins();
	for (auto& p : plugins) {
		p["enabled"] = false;
		if (cfg.contains("plugins") && cfg["plugins"].is_array())
			for (auto& e : cfg["plugins"]) if (e.is_string() && e.get<std::string>() == p["id"].get<std::string>()) p["enabled"] = true;
	}
	json st = {{"version", kVersion}, {"accent", AccentHex()}, {"themesDir", Narrow(themesDir.wstring())}, {"pluginsDir", Narrow(pluginsDir.wstring())}, {"plugins", plugins}, {"themes", list}, {"active", ""}, {"theme", nullptr}, {"conditions", json::object()}, {"rootColors", ""}};

	const ThemeInfo* t = FindTheme(all, cfg.value("activeTheme", ""));
	if (!t) return st;
	std::string text;
	ReadFile(t->dir / L"skin.json", text);
	json data = json::parse(text, nullptr, false, true);
	if (!data.is_object()) return st;
	st["active"] = t->folder;
	st["theme"] = {{"folder", t->folder}, {"data", data}};

	json saved = cfg["conditions"].is_object() && cfg["conditions"].contains(t->folder) ? cfg["conditions"][t->folder] : json::object();
	json values = json::object();
	if (data.contains("Conditions") && data["Conditions"].is_object()) {
		for (auto& [name, def] : data["Conditions"].items()) {
			if (saved.is_object() && saved.contains(name)) values[name] = saved[name];
			else if (def.is_object() && def.contains("default")) values[name] = def["default"];
			else if (def.is_object() && def.contains("slider") && def["slider"].contains("default")) values[name] = def["slider"]["default"];
		}
	}
	st["conditions"] = values;
	if (data.contains("RootColors") && data["RootColors"].is_string()) {
		fs::path p;
		std::string css;
		if (SafeJoin(t->dir, data["RootColors"].get<std::string>(), p) && ReadFile(p, css)) st["rootColors"] = css;
	}
	return st;
}

// ---------- local web server ----------

HttpResponse App::Handle(const HttpRequest& req) {
	HttpResponse res;
	const std::string path = UrlDecode(req.path);
	if (path == "/api/state") {
		res.mime = "application/json";
		res.body = Dump(State());
		return res;
	}
	if (path == "/api/set") {
		// Only Steam's own pages (or local tools with no origin) may change settings, not websites in a browser.
		if (!req.origin.empty() && req.origin != "https://steamloopback.host") return {403, "text/plain", "forbidden"};
		json body = json::parse(req.body, nullptr, false);
		if (body.is_object()) {
			std::lock_guard<std::mutex> lock(cfgMu_);
			json cfg = LoadConfig();
			if (body.contains("active") && body["active"].is_string()) cfg["activeTheme"] = body["active"];
			if (body.contains("plugin") && body["plugin"].is_object() && body["plugin"].contains("id")) {
				json list = json::array();
				std::string id = body["plugin"].value("id", "");
				for (auto& e : cfg.value("plugins", json::array())) if (e != id) list.push_back(e);
				if (body["plugin"].value("enabled", false)) list.push_back(id);
				cfg["plugins"] = list;
				Log((body["plugin"].value("enabled", false) ? "turned on redesign " : "turned off redesign ") + id);
			}
			if (body.contains("conditions") && body["conditions"].is_object()) {
				std::string theme = cfg.value("activeTheme", "");
				if (!cfg["conditions"].is_object()) cfg["conditions"] = json::object();
				for (auto& [k, v] : body["conditions"].items()) cfg["conditions"][theme][k] = v;
			}
			SaveConfig(cfg);
		}
		res.mime = "application/json";
		res.body = Dump(State());
		return res;
	}
	if (path == "/api/capture" && req.method == "POST") {
		if (!req.origin.empty() && req.origin != "https://steamloopback.host") return {403, "text/plain", "forbidden"};
		res.mime = "application/json";
		res.body = Dump({{"ok", Capture()}});
		return res;
	}
	if (path == "/api/app") {
		if (req.method == "POST") {
			if (!req.origin.empty() && req.origin != "https://steamloopback.host") return {403, "text/plain", "forbidden"};
			json body = json::parse(req.body, nullptr, false);
			if (body.is_object() && body.contains("autostart") && body["autostart"].is_boolean()) SetAutostart(body["autostart"].get<bool>());
			if (body.is_object() && body.value("open", "") == "plugins") ShellExecuteW(nullptr, L"open", pluginsDir.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
			if (body.is_object() && body.value("open", "") == "themes") ShellExecuteW(nullptr, L"open", themesDir.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
			if (body.is_object() && body.value("open", "") == "steam") ShowSteamWindow();
			if (body.is_object() && body.value("open", "") == "log") ShellExecuteW(nullptr, L"open", (dataDir / L"log.txt").c_str(), nullptr, nullptr, SW_SHOWNORMAL);
		}
		res.mime = "application/json";
		res.body = Dump({{"version", kVersion}, {"autostart", AutostartOn()}, {"themesDir", Narrow(themesDir.wstring())}});
		return res;
	}
	if (path == "/webkit.css") {
		// Store and Community pages always link this one address; it points at the current theme's Steam-WebKit file.
		res.mime = "text/css";
		json st = State();
		if (!st["theme"].is_null()) {
			const json& data = st["theme"]["data"];
			if (data.contains("Steam-WebKit") && data["Steam-WebKit"].is_string())
				res.body = "@import url(\"/themes/" + UrlEncodePath(st["active"].get<std::string>()) + "/" + UrlEncodePath(data["Steam-WebKit"].get<std::string>()) + "\");\n" +
					st["rootColors"].get<std::string>();
		}
		return res;
	}

	fs::path file;
	bool ok = false;
	if (path == "/boot.js") ok = SafeJoin(webDir, "boot.js", file);
	else if (path.rfind("/plugins/", 0) == 0) ok = SafeJoin(pluginsDir, path.substr(9), file);
	else if (path.rfind("/previews/", 0) == 0) ok = SafeJoin(dataDir / L"previews", path.substr(10), file);
	else if (path.rfind("/web/", 0) == 0) ok = SafeJoin(webDir, path.substr(5), file);
	else if (path.rfind("/themes/", 0) == 0) {
		std::string rest = path.substr(8);
		size_t slash = rest.find('/');
		auto all = ListThemes();
		if (const ThemeInfo* t = FindTheme(all, rest.substr(0, slash)); t && slash != std::string::npos) ok = SafeJoin(t->dir, rest.substr(slash + 1), file);
	}
	if (ok && ReadFile(file, res.body)) {
		res.mime = Mime(file);
		return res;
	}
	return {404, "text/plain", "Beyond Steam: not found: " + path};
}

// ---------- connection to Steam ----------

void App::ConnectionLoop() {
	for (;;) {
		auto cdp = std::make_shared<Cdp>();
		if (!cdp->Connect(kDebugPort)) {
			// Steam opens its debug port at start-up only while this file is in its folder; something may remove it.
			std::error_code ec;
			fs::path flag = steamDir / L".cef-enable-remote-debugging";
			if (!steamDir.empty() && !fs::exists(flag, ec)) std::ofstream(flag).flush();
			status_ = SteamRunning() ? Status::NeedsRestart : Status::NoSteam;
			Sleep(1500);
			continue;
		}
		cdp->onEvent = [this](const json& ev) { OnEvent(ev); };
		{
			std::lock_guard<std::mutex> lock(cdpMu_);
			cdp_ = cdp;
		}
		std::thread reader([cdp] { cdp->Run(); });
		cdp->Call("Target.setDiscoverTargets", {{"discover", true}});
		json r = cdp->Call("Target.getTargets");
		if (r.contains("result"))
			for (auto& t : r["result"]["targetInfos"]) OnTarget(t);
		status_ = Status::Connected;
		Log("connected to Steam");

		std::atomic<bool> running{true};
		std::thread watch([&] {
			while (running) {
				EnsureBoot();
				for (int i = 0; i < 20 && running; i++) Sleep(100);
			}
		});
		reader.join();
		running = false;
		watch.join();
		{
			std::lock_guard<std::mutex> lock(cdpMu_);
			cdp_.reset();
		}
		{
			std::lock_guard<std::mutex> lock(sjcMu_);
			sjcSession_.clear();
			sjcTarget_.clear();
			pages_.clear();
		}
		status_ = Status::NoSteam;
		Log("disconnected from Steam");
		Sleep(1000);
	}
}

// A window appeared or changed. Steam's UI page (SharedJSContext) gets the in-Steam script; Store and Community pages
// get a small script that links the theme's web styles on every page they load.
void App::OnTarget(const json& info) {
	auto cdp = Client();
	if (!cdp) return;
	const std::string id = info.value("targetId", ""), title = info.value("title", ""), url = info.value("url", "");
	const std::string type = info.value("type", "");
	if (type == "service_worker" || type == "shared_worker" || type == "worker" || type == "browser") return;

	if (title == "SharedJSContext") {
		{
			std::lock_guard<std::mutex> lock(sjcMu_);
			if (sjcTarget_ == id) return; // attached, or being attached by another thread
			sjcTarget_ = id;
			sjcSession_.clear();
		}
		json a = cdp->Call("Target.attachToTarget", {{"targetId", id}, {"flatten", true}}, "", 3000);
		std::string sid = a.contains("result") ? a["result"].value("sessionId", "") : "";
		{
			std::lock_guard<std::mutex> lock(sjcMu_);
			if (sid.empty()) { sjcTarget_.clear(); return; }
			sjcSession_ = sid;
		}
		// Catch the page as it reloads (Steam restarting its interface) so the script is in place from the start.
		json pat = json::array({{{"urlPattern", "https://steamloopback.host/index.html*"}, {"resourceType", "Document"}, {"requestStage", "Response"}}});
		cdp->Call("Fetch.enable", {{"patterns", pat}}, sid, 3000);
		Log("attached to Steam's UI page");
		EnsureBoot();
		return;
	}

	if (!IsSteamHost(HostOf(url))) return;
	{
		std::lock_guard<std::mutex> lock(sjcMu_);
		if (!pages_.insert(id).second) return;
	}
	json a = cdp->Call("Target.attachToTarget", {{"targetId", id}, {"flatten", true}}, "", 3000);
	if (!a.contains("result")) {
		std::lock_guard<std::mutex> lock(sjcMu_);
		pages_.erase(id);
		return;
	}
	std::string sid = a["result"].value("sessionId", "");
	std::string src = "(() => { const add = () => { if (document.getElementById('beyondsteam-webkit')) return; const l = document.createElement('link');"
		" l.id = 'beyondsteam-webkit'; l.rel = 'stylesheet'; l.href = '" + Base() + "/webkit.css';"
		" (document.head || document.documentElement).appendChild(l); };"
		" if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add(); })()";
	cdp->Call("Page.addScriptToEvaluateOnNewDocument", {{"source", src}}, sid, 3000);
	cdp->Post("Runtime.evaluate", {{"expression", src}}, sid);
	Log("styled a Store/Community page: " + url.substr(0, 80));
}

// Makes sure the in-Steam script runs in Steam's UI page, including when Steam started before Beyond Steam.
void App::EnsureBoot() {
	auto cdp = Client();
	if (!cdp) return;
	std::string session;
	{
		std::lock_guard<std::mutex> lock(sjcMu_);
		session = sjcSession_;
	}
	if (session.empty()) {
		{
			std::lock_guard<std::mutex> lock(sjcMu_);
			if (!sjcTarget_.empty()) return; // still attaching
		}
		json r = cdp->Call("Target.getTargets", json::object(), "", 3000);
		if (r.contains("result"))
			for (auto& t : r["result"]["targetInfos"])
				if (t.value("title", "") == "SharedJSContext") return OnTarget(t);
		return;
	}
	std::string ensure = "(() => { if (window.__BS || Date.now() - (window.__BS_loading || 0) < 10000) return 'ok'; window.__BS_loading = Date.now();"
		" const s = document.createElement('script'); s.src = '" + Base() + "/boot.js'; document.head.appendChild(s); return 'injected'; })()";
	json r = cdp->Call("Runtime.evaluate", {{"expression", ensure}, {"returnByValue", true}}, session, 3000);
	if (r.contains("error")) {
		std::lock_guard<std::mutex> lock(sjcMu_);
		if (sjcSession_ == session) sjcSession_.clear();
	} else if (r["result"]["result"].value("value", "") == "injected") {
		Log("started the in-Steam script");
	}
}

void App::OnEvent(const json& ev) {
	const std::string method = ev.value("method", "");
	if (method == "Fetch.requestPaused") {
		PatchIndex(ev["params"], ev.value("sessionId", ""));
	} else if (method == "Target.targetCreated" || method == "Target.targetInfoChanged") {
		OnTarget(ev["params"]["targetInfo"]);
	} else if (method == "Target.detachedFromTarget" || method == "Target.targetDestroyed") {
		std::lock_guard<std::mutex> lock(sjcMu_);
		const std::string sid = ev["params"].value("sessionId", ""), tid = ev["params"].value("targetId", "");
		if ((!sid.empty() && sid == sjcSession_) || (!tid.empty() && tid == sjcTarget_)) {
			sjcSession_.clear();
			sjcTarget_.clear();
		}
		if (method == "Target.targetDestroyed") pages_.erase(tid);
	}
}

// Steam's UI page is loading: add the in-Steam script to its HTML. Always lets the page continue, whatever happens.
void App::PatchIndex(const json& p, const std::string& session) {
	auto cdp = Client();
	if (!cdp) return;
	const json id = {{"requestId", p["requestId"]}};
	try {
		int status = p.value("responseStatusCode", 0);
		if (status >= 200 && status < 300) {
			json r = cdp->Call("Fetch.getResponseBody", id, session, 4000);
			if (r.contains("result")) {
				std::string body = r["result"].value("body", "");
				if (r["result"].value("base64Encoded", false)) body = Unbase64(body);
				size_t at = body.find("</head>");
				if (at != std::string::npos && body.find("<title>SharedJSContext</title>") != std::string::npos && body.find("/boot.js") == std::string::npos) {
					body.insert(at, "<script src=\"" + Base() + "/boot.js\"></script>");
					json headers = json::array();
					for (auto& h : p.value("responseHeaders", json::array())) {
						std::string name = Lower(h.value("name", ""));
						if (name != "content-length" && name != "content-encoding") headers.push_back(h);
					}
					cdp->Post("Fetch.fulfillRequest", {{"requestId", p["requestId"]}, {"responseCode", status}, {"responseHeaders", headers}, {"body", Base64(body)}}, session);
					Log("added the in-Steam script to Steam's UI page as it loaded");
					return;
				}
			}
		}
	} catch (const std::exception& e) {
		Log(std::string("UI page patch failed: ") + e.what());
	}
	cdp->Post("Fetch.continueResponse", id, session);
}
