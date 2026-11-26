// Beyond Steam 0.5 features on the app side: self-updates, safe mode, personal settings (prefs), the light/dark
// schedule, backup and restore, live reload for theme makers, and the new-theme wizard.
#include "app.h"
#include <commdlg.h>
#include <fstream>
#include <shellapi.h>
#include <sstream>

static const char* kReleasesApi = "https://api.github.com/repos/OriginalSwayze/Beyond-Steam/releases/latest";
static const char* kReleaseDownloads = "https://github.com/OriginalSwayze/Beyond-Steam/releases/download/";

static std::vector<int> ParseVersion(const std::string& v) {
	std::vector<int> out;
	std::stringstream ss(v[0] == 'v' ? v.substr(1) : v);
	std::string part;
	while (std::getline(ss, part, '.')) out.push_back(atoi(part.c_str()));
	while (out.size() < 3) out.push_back(0);
	return out;
}

// ---------- self-update ----------

void App::CheckForUpdate() {
	std::string body, err;
	if (!HttpsGet(kReleasesApi, body, err, 1u << 20)) { Log("update check failed: " + err); return; }
	json r = json::parse(body, nullptr, false);
	if (!r.is_object() || !r.contains("tag_name")) return;
	std::string tag = r.value("tag_name", "");
	if (ParseVersion(tag) <= ParseVersion(kVersion)) {
		std::lock_guard<std::mutex> lock(updMu_);
		update_ = nullptr;
		return;
	}
	for (auto& a : r.value("assets", json::array())) {
		if (a.value("name", "") != "BeyondSteam.exe") continue;
		std::string url = a.value("browser_download_url", "");
		if (url.rfind(kReleaseDownloads, 0) != 0) continue; // only ever from this project's own releases
		std::lock_guard<std::mutex> lock(updMu_);
		update_ = {{"version", tag[0] == 'v' ? tag.substr(1) : tag}, {"url", url}, {"notes", r.value("body", "")}, {"page", r.value("html_url", "")}};
		Log("update available: " + tag);
	}
}

json App::UpdateInfo() {
	std::lock_guard<std::mutex> lock(updMu_);
	return update_;
}

std::string App::InstallUpdate() {
	if (DevBuild()) return "This is a developer build; update it with build.cmd.";
	json u = UpdateInfo();
	if (!u.is_object()) return "No update is available.";
	std::string url = u.value("url", ""), exe, err;
	if (url.rfind(kReleaseDownloads, 0) != 0) return "That update doesn't come from Beyond Steam's releases.";
	if (!HttpsGet(url, exe, err, 64u << 20)) return "Couldn't download the update: " + err + ".";
	if (exe.size() < 2 || exe[0] != 'M' || exe[1] != 'Z') return "The download isn't a Windows program.";
	wchar_t tmp[MAX_PATH];
	GetTempPathW(MAX_PATH, tmp);
	fs::path file = fs::path(tmp) / L"BeyondSteam-update.exe";
	{
		std::ofstream f(file, std::ios::binary);
		f.write(exe.data(), (std::streamsize)exe.size());
	}
	Log("installing update " + u.value("version", ""));
	ShellExecuteW(nullptr, L"open", file.c_str(), L"--update", nullptr, SW_SHOWNORMAL); // closes this copy, replaces it, starts the new one
	return "";
}

// ---------- safe mode ----------

// Called by the in-Steam script each time Steam's interface starts. Four starts within a minute while a theme or
// redesign is on means something keeps crashing it: switch everything off until the user says otherwise.
// Called by the in-Steam script as Steam's interface starts, and again ("ready") once it has run for a while.
// Three starts in a row that never got to "ready" means the interface keeps crashing while a theme or redesign is on:
// switch them off (safe mode) until the user says otherwise. Reloads Beyond Steam asks for itself all reach "ready".
void App::NoteBoot(bool ready) {
	std::lock_guard<std::mutex> lock(cfgMu_);
	if (ready) { boots_.clear(); return; }
	auto now = GetTickCount64();
	boots_.push_back(now);
	while (!boots_.empty() && now - boots_.front() > 180000) boots_.erase(boots_.begin());
	json cfg = LoadConfig();
	bool somethingOn = !cfg.value("activeTheme", "").empty() || !cfg.value("plugins", json::array()).empty();
	if (boots_.size() >= 4 && somethingOn && !cfg.value("safe", false)) { // the 4th start after three that never got ready
		cfg["safe"] = true;
		cfg["safeReason"] = "Steam's interface kept crashing while it started, so Beyond Steam switched your theme and redesigns off.";
		SaveConfig(cfg);
		boots_.clear();
		Log("safe mode: interface kept crashing during start-up");
	}
}

void App::SetSafe(bool on, const std::string& reason) {
	{
		std::lock_guard<std::mutex> lock(cfgMu_);
		json cfg = LoadConfig();
		cfg["safe"] = on;
		cfg["safeReason"] = on ? reason : "";
		SaveConfig(cfg);
	}
	Log(on ? "safe mode on: " + reason : "safe mode off");
	RestartInterface();
}

void App::RestartInterface() {
	auto cdp = Client();
	std::string session;
	{
		std::lock_guard<std::mutex> lock(sjcMu_);
		session = sjcSession_;
	}
	if (cdp && !session.empty()) cdp->Post("Runtime.evaluate", {{"expression", "SteamClient.Browser.RestartJSContext()"}}, session);
}

// ---------- prefs ----------

json App::Prefs() {
	std::lock_guard<std::mutex> lock(cfgMu_);
	json p = LoadConfig().value("prefs", json::object());
	return p.is_object() ? p : json::object();
}

json App::SetPrefs(const json& patch) {
	std::lock_guard<std::mutex> lock(cfgMu_);
	json cfg = LoadConfig();
	if (!cfg["prefs"].is_object()) cfg["prefs"] = json::object();
	cfg["prefs"].merge_patch(patch); // null removes a key
	SaveConfig(cfg);
	return cfg["prefs"];
}

// Follows Windows' light/dark setting when the schedule says so.
void App::ScheduleTick() {
	json p = Prefs();
	json s = p.value("schedule", json::object());
	if (s.value("mode", "off") != "windows") { lastLight_ = -1; return; }
	DWORD light = 0, size = sizeof light;
	if (RegGetValueW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize", L"AppsUseLightTheme", RRF_RT_REG_DWORD, nullptr, &light, &size) != ERROR_SUCCESS) return;
	if ((int)light == lastLight_) return;
	lastLight_ = (int)light;
	std::string want = s.value(light ? "light" : "dark", "");
	if (want.empty() || _stricmp(want.c_str(), ActiveTheme().c_str()) == 0) return;
	Log(std::string("Windows switched to ") + (light ? "light" : "dark") + " mode; theme " + want);
	SetActiveTheme(want);
}

// ---------- live reload ----------

// While "live reload" is on, a change to any file of the active theme re-applies its styles straight away.
void App::LiveReloadTick() {
	json p = Prefs();
	if (!p.value("liveReload", false)) { liveStamp_ = 0; return; }
	auto all = ListThemes();
	const ThemeInfo* t = FindTheme(all, ActiveTheme());
	if (!t) return;
	unsigned long long newest = 0;
	std::error_code ec;
	int n = 0;
	for (auto it = fs::recursive_directory_iterator(t->dir, ec); !ec && it != fs::recursive_directory_iterator() && n < 3000; it.increment(ec), n++) {
		if (it->path().filename() == L".git") { it.disable_recursion_pending(); continue; }
		if (!it->is_regular_file(ec)) continue;
		auto w = fs::last_write_time(it->path(), ec).time_since_epoch().count();
		if ((unsigned long long)w > newest) newest = (unsigned long long)w;
	}
	if (liveStamp_ && newest != liveStamp_) {
		auto cdp = Client();
		std::string session;
		{
			std::lock_guard<std::mutex> lock(sjcMu_);
			session = sjcSession_;
		}
		if (cdp && !session.empty()) cdp->Post("Runtime.evaluate", {{"expression", "window.__BS && window.__BS.reloadStyles()"}}, session);
	}
	liveStamp_ = newest;
}

// ---------- backup ----------

static std::wstring FileDialog(bool save) {
	wchar_t path[MAX_PATH] = L"Beyond Steam backup.json";
	OPENFILENAMEW o{sizeof o};
	o.lpstrFilter = L"Beyond Steam backup (*.json)\0*.json\0";
	o.lpstrFile = path;
	o.nMaxFile = MAX_PATH;
	o.lpstrDefExt = L"json";
	o.Flags = OFN_NOCHANGEDIR | (save ? OFN_OVERWRITEPROMPT : OFN_FILEMUSTEXIST);
	BOOL ok = save ? GetSaveFileNameW(&o) : GetOpenFileNameW(&o);
	return ok ? path : L"";
}

json App::Backup(bool exporting) {
	std::wstring path = FileDialog(exporting);
	if (path.empty()) return {{"ok", false}, {"cancelled", true}};
	if (exporting) {
		json cfg;
		{
			std::lock_guard<std::mutex> lock(cfgMu_);
			cfg = LoadConfig();
		}
		std::ofstream(fs::path(path), std::ios::binary) << json({{"format", "beyond-steam-backup"}, {"version", kVersion}, {"config", cfg}}).dump(2, ' ', false, json::error_handler_t::replace);
		Log("backup saved");
		return {{"ok", true}, {"path", Narrow(path)}};
	}
	std::ifstream f{fs::path(path), std::ios::binary};
	std::stringstream ss;
	ss << f.rdbuf();
	json b = json::parse(ss.str(), nullptr, false);
	if (!b.is_object() || b.value("format", "") != "beyond-steam-backup" || !b["config"].is_object()) return {{"ok", false}, {"error", "That file isn't a Beyond Steam backup."}};
	{
		std::lock_guard<std::mutex> lock(cfgMu_);
		SaveConfig(b["config"]);
	}
	Log("backup restored");
	RestartInterface();
	return {{"ok", true}};
}

// ---------- new theme ----------

std::string App::NewTheme(const json& req, std::string& folderOut) {
	std::string name = req.value("name", "");
	std::string folder;
	for (char c : name) if (isalnum((unsigned char)c)) folder += c; else if (c == ' ' || c == '-' || c == '_') folder += '-';
	while (!folder.empty() && folder.back() == '-') folder.pop_back();
	if (folder.empty()) return "Give the theme a name (letters or numbers).";
	fs::path dir = themesDir / Widen(folder);
	std::error_code ec;
	if (fs::exists(dir, ec)) return "There's already a theme folder called " + folder + ".";
	auto color = [&](const char* k, const char* d) { std::string v = req.value(k, d); return (v.size() == 7 && v[0] == '#') ? v : std::string(d); };
	std::string bg = color("background", "#12141A"), panel = color("panel", "#1B1F28"), text = color("text", "#E8ECF4"), accent = color("accent", "#6FE3D2");
	std::string font = req.value("font", "Segoe UI");
	for (char& c : font) if (c == '"' || c == ';' || c == '{' || c == '}') c = ' ';
	fs::create_directories(dir, ec);
	json skin = {
		{"name", name}, {"author", req.value("author", "")}, {"description", "Made with Beyond Steam's theme wizard."}, {"version", "1.0.0"},
		{"UseDefaultPatches", true}, {"RootColors", "colors.css"},
		{"Patches", json::array({{{"MatchRegexString", "^Steam$"}, {"TargetCss", "main.css"}}, {{"MatchRegexString", "Menu$"}, {"TargetCss", "main.css"}},
			{{"MatchRegexString", ".ModalDialogPopup"}, {"TargetCss", "main.css"}}, {{"MatchRegexString", ".friendsui-container"}, {"TargetCss", "main.css"}}})},
		{"Steam-WebKit", "webkit.css"}};
	std::ofstream(dir / L"skin.json") << skin.dump(4);
	std::ofstream(dir / L"colors.css") << ":root {\n\t--theme-bg: " << bg << ";\n\t--theme-panel: " << panel << ";\n\t--theme-text: " << text << ";\n\t--theme-accent: " << accent << ";\n\t--theme-font: \"" << font << "\";\n}\n";
	std::ofstream(dir / L"main.css") <<
		"/* Your theme. Beyond Steam re-applies it as you save while Live reload is on (Settings > For theme makers).\n"
		"   Colours live in colors.css. Use the Inspector to find the class names of anything in Steam. */\n\n"
		"body, button, input, select, textarea { font-family: var(--theme-font), \"Segoe UI\", sans-serif !important; }\n"
		"body { background: var(--theme-bg) !important; color: var(--theme-text) !important; }\n"
		".SuperNav .MenuButton { color: var(--theme-text) !important; }\n"
		".LibraryHome, .ModalDialogPopup, .friendsui-container { background: var(--theme-bg) !important; }\n"
		".DialogButton.Primary, button.Primary { background: var(--theme-accent) !important; color: var(--theme-bg) !important; }\n"
		"::selection { background: var(--theme-accent); color: var(--theme-bg); }\n";
	std::ofstream(dir / L"webkit.css") << "/* Styles for Store and Community pages. */\n";
	std::ofstream(dir / L"README.md") << "# " << name << "\n\nA Steam theme made with Beyond Steam's theme wizard.\n";
	Log("created theme " + folder);
	folderOut = folder;
	return "";
}

// ---------- background jobs ----------

void App::Housekeeping() {
	unsigned long long lastUpdate = 0;
	for (int tick = 0;; tick++) {
		if (tick == 20 || (GetTickCount64() - lastUpdate > 6ull * 3600 * 1000 && tick > 20)) {
			lastUpdate = GetTickCount64();
			if (!DevBuild()) CheckForUpdate();
		}
		if (tick % 10 == 0) ScheduleTick();
		LiveReloadTick();
		Sleep(1000);
	}
}

bool App::DevBuild() const {
	return !webDir.empty();
}
