// Beyond Steam: a tray app that themes and redesigns the Steam client. See README.md.
#include "app.h"
#include <shellapi.h>
#include <tlhelp32.h>

static App* g_app;
static HWND g_wnd;
static NOTIFYICONDATAW g_nid{};
static std::vector<ThemeInfo> g_menuThemes;
static bool g_toldRestart = false;
static std::atomic<bool> g_busy{false};

constexpr UINT WM_TRAY = WM_APP + 1;
enum : UINT { ID_OPEN = 50, ID_STATUS = 1, ID_RESTART, ID_FOLDER, ID_LOG, ID_AUTOSTART, ID_MILL_OFF, ID_MILL_ON, ID_QUIT, ID_NONE = 100, ID_THEME = 101 };

static bool ProcessRunning(const wchar_t* name) {
	HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
	PROCESSENTRY32W e{sizeof e};
	bool found = false;
	for (BOOL ok = Process32FirstW(snap, &e); ok; ok = Process32NextW(snap, &e))
		if (_wcsicmp(e.szExeFile, name) == 0) { found = true; break; }
	CloseHandle(snap);
	return found;
}

// Steam turns on its debug port at start-up when this file is in its folder; Beyond Steam talks to Steam through it.
static void EnableDebugPort() {
	if (g_app->steamDir.empty()) return;
	fs::path flag = g_app->steamDir / L".cef-enable-remote-debugging";
	std::error_code ec;
	if (!fs::exists(flag, ec)) {
		HANDLE h = CreateFileW(flag.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr);
		if (h != INVALID_HANDLE_VALUE) CloseHandle(h);
		Log(fs::exists(flag, ec) ? "turned on Steam's debug port (takes effect when Steam starts)" : "could not write the debug-port file to the Steam folder");
	}
}

static fs::path MillenniumDll(bool off) { return g_app->steamDir / (off ? L"wsock32.dll.beyondsteam-off" : L"wsock32.dll"); }
static bool MillenniumOn() { std::error_code ec; return fs::exists(g_app->steamDir / L"millennium", ec) && fs::exists(MillenniumDll(false), ec); }
static bool MillenniumOff() { std::error_code ec; return fs::exists(MillenniumDll(true), ec); }

// Closes Steam, optionally runs a step while it is closed, then starts it again. Runs on its own thread.
static void RestartSteam(std::function<void()> whileClosed = nullptr) {
	if (g_busy.exchange(true)) return;
	std::thread([whileClosed] {
		fs::path steam = g_app->steamDir / L"steam.exe";
		if (ProcessRunning(L"steam.exe")) {
			ShellExecuteW(nullptr, L"open", steam.c_str(), L"-shutdown", nullptr, SW_HIDE);
			for (int i = 0; i < 300 && (ProcessRunning(L"steam.exe") || ProcessRunning(L"steamwebhelper.exe")); i++) Sleep(100);
		}
		if (whileClosed) whileClosed();
		ShellExecuteW(nullptr, L"open", steam.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
		g_busy = false;
	}).detach();
}

static void Balloon(const wchar_t* title, const wchar_t* text) {
	NOTIFYICONDATAW n = g_nid;
	n.uFlags = NIF_INFO;
	wcsncpy_s(n.szInfoTitle, title, _TRUNCATE);
	wcsncpy_s(n.szInfo, text, _TRUNCATE);
	Shell_NotifyIconW(NIM_MODIFY, &n);
}

static const wchar_t* StatusText() {
	if (g_busy) return L"Restarting Steam…";
	switch (g_app->GetStatus()) {
	case Status::Connected: return L"Connected to Steam";
	case Status::NeedsRestart: return L"Restart Steam to finish setting up";
	default: return L"Waiting for Steam";
	}
}

static void ShowMenu() {
	HMENU menu = CreatePopupMenu(), themes = CreatePopupMenu();
	std::wstring head = std::wstring(L"Beyond Steam ") + Widen(kVersion) + L" — " + StatusText();
	AppendMenuW(menu, MF_STRING | MF_GRAYED, ID_STATUS, head.c_str());
	AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
	AppendMenuW(menu, MF_STRING | (g_app->GetStatus() == Status::Connected ? 0 : MF_GRAYED), ID_OPEN, L"Open Beyond Steam in Steam");
	SetMenuDefaultItem(menu, ID_OPEN, FALSE);

	g_menuThemes = g_app->ListThemes();
	std::string active = g_app->ActiveTheme();
	bool found = false;
	for (size_t i = 0; i < g_menuThemes.size() && i < 400; i++) {
		bool on = _stricmp(g_menuThemes[i].folder.c_str(), active.c_str()) == 0;
		found |= on;
		AppendMenuW(themes, MF_STRING | (on ? MF_CHECKED : 0), ID_THEME + (UINT)i, Widen(g_menuThemes[i].name).c_str());
	}
	InsertMenuW(themes, 0, MF_BYPOSITION | MF_STRING | (found ? 0 : MF_CHECKED), ID_NONE, L"Steam's own look");
	InsertMenuW(themes, 1, MF_BYPOSITION | MF_SEPARATOR, 0, nullptr);
	AppendMenuW(menu, MF_POPUP, (UINT_PTR)themes, L"Theme");
	AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
	AppendMenuW(menu, MF_STRING | (g_busy ? MF_GRAYED : 0), ID_RESTART, L"Restart Steam");
	AppendMenuW(menu, MF_STRING, ID_FOLDER, L"Open themes folder");
	AppendMenuW(menu, MF_STRING, ID_LOG, L"Open log");
	if (MillenniumOn()) AppendMenuW(menu, MF_STRING | (g_busy ? MF_GRAYED : 0), ID_MILL_OFF, L"Turn off Millennium (restarts Steam)");
	else if (MillenniumOff()) AppendMenuW(menu, MF_STRING | (g_busy ? MF_GRAYED : 0), ID_MILL_ON, L"Turn Millennium back on (restarts Steam)");
	AppendMenuW(menu, MF_STRING | (AutostartOn() ? MF_CHECKED : 0), ID_AUTOSTART, L"Start with Windows");
	AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
	AppendMenuW(menu, MF_STRING, ID_QUIT, L"Quit");

	POINT pt;
	GetCursorPos(&pt);
	SetForegroundWindow(g_wnd);
	UINT cmd = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON, pt.x, pt.y, 0, g_wnd, nullptr);
	DestroyMenu(menu);

	if (cmd == ID_OPEN) g_app->OpenManager();
	else if (cmd == ID_NONE) g_app->SetActiveTheme("");
	else if (cmd >= ID_THEME && cmd < ID_THEME + g_menuThemes.size()) g_app->SetActiveTheme(g_menuThemes[cmd - ID_THEME].folder);
	else if (cmd == ID_RESTART) RestartSteam();
	else if (cmd == ID_FOLDER) ShellExecuteW(nullptr, L"open", g_app->themesDir.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
	else if (cmd == ID_LOG) ShellExecuteW(nullptr, L"open", (g_app->dataDir / L"log.txt").c_str(), nullptr, nullptr, SW_SHOWNORMAL);
	else if (cmd == ID_AUTOSTART) SetAutostart(!AutostartOn());
	else if (cmd == ID_MILL_OFF) RestartSteam([] { std::error_code ec; fs::rename(MillenniumDll(false), MillenniumDll(true), ec); Log(ec ? "could not turn off Millennium" : "turned off Millennium"); });
	else if (cmd == ID_MILL_ON) RestartSteam([] { std::error_code ec; fs::rename(MillenniumDll(true), MillenniumDll(false), ec); Log(ec ? "could not turn Millennium on" : "turned Millennium back on"); });
	else if (cmd == ID_QUIT) DestroyWindow(g_wnd);
}

static LRESULT CALLBACK WndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
	if (m == WM_TRAY && LOWORD(l) == WM_RBUTTONUP) { ShowMenu(); return 0; }
	if (m == WM_TRAY && LOWORD(l) == WM_LBUTTONUP) { // left click: open the manager in Steam, or the menu if Steam isn't ready
		if (g_app->GetStatus() == Status::Connected) g_app->OpenManager(); else ShowMenu();
		return 0;
	}
	if (m == WM_TIMER) {
		std::wstring tip = std::wstring(L"Beyond Steam — ") + StatusText();
		wcsncpy_s(g_nid.szTip, tip.c_str(), _TRUNCATE);
		g_nid.uFlags = NIF_TIP;
		Shell_NotifyIconW(NIM_MODIFY, &g_nid);
		if (g_app->GetStatus() == Status::NeedsRestart && !g_toldRestart && !g_busy) {
			g_toldRestart = true;
			Balloon(L"Beyond Steam", L"Restart Steam once to turn Beyond Steam on. Right-click this icon and pick Restart Steam.");
		}
		return 0;
	}
	if (m == WM_DESTROY) {
		Shell_NotifyIconW(NIM_DELETE, &g_nid);
		PostQuitMessage(0);
		return 0;
	}
	return DefWindowProcW(h, m, w, l);
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR cmdLine, int) {
	HANDLE one = CreateMutexW(nullptr, TRUE, L"BeyondSteam.SingleInstance");
	if (GetLastError() == ERROR_ALREADY_EXISTS) return 0;

	static App app;
	g_app = &app;
	EnableDebugPort();

	WNDCLASSW wc{};
	wc.lpfnWndProc = WndProc;
	wc.hInstance = inst;
	wc.lpszClassName = L"BeyondSteamTray";
	RegisterClassW(&wc);
	g_wnd = CreateWindowW(wc.lpszClassName, L"Beyond Steam", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, inst, nullptr);

	g_nid.cbSize = sizeof g_nid;
	g_nid.hWnd = g_wnd;
	g_nid.uID = 1;
	g_nid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
	g_nid.uCallbackMessage = WM_TRAY;
	g_nid.hIcon = LoadIconW(inst, MAKEINTRESOURCEW(1));
	if (!g_nid.hIcon) g_nid.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
	wcscpy_s(g_nid.szTip, L"Beyond Steam");
	Shell_NotifyIconW(NIM_ADD, &g_nid);
	SetTimer(g_wnd, 1, 1000, nullptr);

	std::thread([] { g_app->ConnectionLoop(); }).detach();

	MSG msg;
	while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
		TranslateMessage(&msg);
		DispatchMessageW(&msg);
	}
	ReleaseMutex(one);
	ExitProcess(0); // the connection thread never returns
}
