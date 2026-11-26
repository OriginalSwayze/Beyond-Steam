// Setup and uninstall. Running the downloaded BeyondSteam.exe installs it for the current Windows user (no admin):
// %LOCALAPPDATA%\Programs\Beyond Steam, a Start menu entry, an Apps & Features entry with an uninstaller, start with
// Windows, Steam's debug-port switch, optionally Millennium turned off, and one Steam restart.
#include "app.h"
#include <shellapi.h>
#include <shlobj.h>
#include <tlhelp32.h>
#include <shobjidl.h>
#include <objbase.h>
#include <fstream>

static const wchar_t* kTitle = L"Beyond Steam";
static const wchar_t* kUninstallKey = L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\BeyondSteam";

static fs::path KnownFolder(REFKNOWNFOLDERID id) {
	PWSTR p = nullptr;
	SHGetKnownFolderPath(id, 0, nullptr, &p);
	fs::path r = p ? p : L"";
	CoTaskMemFree(p);
	return r;
}

fs::path InstallDir() { return KnownFolder(FOLDERID_LocalAppData) / L"Programs" / L"Beyond Steam"; }
static fs::path InstalledExe() { return InstallDir() / L"BeyondSteam.exe"; }
static fs::path Shortcut() { return KnownFolder(FOLDERID_Programs) / L"Beyond Steam.lnk"; }

static fs::path ThisExe() {
	wchar_t p[MAX_PATH];
	GetModuleFileNameW(nullptr, p, MAX_PATH);
	return p;
}

static fs::path SteamDir() {
	wchar_t steam[MAX_PATH];
	DWORD size = sizeof steam;
	if (RegGetValueW(HKEY_CURRENT_USER, L"Software\\Valve\\Steam", L"SteamPath", RRF_RT_REG_SZ, nullptr, steam, &size) != ERROR_SUCCESS) return {};
	return fs::path(steam).make_preferred();
}

static bool Running(const wchar_t* name) {
	HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
	PROCESSENTRY32W e{sizeof e};
	bool found = false;
	for (BOOL ok = Process32FirstW(snap, &e); ok; ok = Process32NextW(snap, &e))
		if (_wcsicmp(e.szExeFile, name) == 0) { found = true; break; }
	CloseHandle(snap);
	return found;
}

// A developer build runs from its repo, next to the web folder; it never installs itself.
static bool DevBuild() {
	fs::path here = ThisExe().parent_path();
	std::error_code ec;
	for (fs::path p : {here, here.parent_path(), here.parent_path().parent_path()})
		if (fs::exists(p / L"web" / L"boot.js", ec)) return true;
	return false;
}

bool ShouldRunSetup() {
	if (DevBuild()) return false;
	std::error_code ec;
	return !fs::equivalent(ThisExe(), InstalledExe(), ec);
}

// Asks a running Beyond Steam to quit and waits for it.
static void CloseRunning() {
	if (HWND w = FindWindowExW(HWND_MESSAGE, nullptr, L"BeyondSteamTray", nullptr)) {
		PostMessageW(w, WM_CLOSE, 0, 0);
		for (int i = 0; i < 50 && FindWindowExW(HWND_MESSAGE, nullptr, L"BeyondSteamTray", nullptr); i++) Sleep(100);
		Sleep(300);
	}
}

static void StopSteam(const fs::path& steam) {
	if (!Running(L"steam.exe")) return;
	ShellExecuteW(nullptr, L"open", (steam / L"steam.exe").c_str(), L"-shutdown", nullptr, SW_HIDE);
	for (int i = 0; i < 300 && (Running(L"steam.exe") || Running(L"steamwebhelper.exe")); i++) Sleep(100);
}

static void SetRunKey(const fs::path& exe, bool on) {
	HKEY k;
	if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Run", 0, KEY_SET_VALUE, &k) != ERROR_SUCCESS) return;
	if (on) {
		std::wstring cmd = L"\"" + exe.wstring() + L"\" --background";
		RegSetValueExW(k, L"Beyond Steam", 0, REG_SZ, (const BYTE*)cmd.c_str(), DWORD((cmd.size() + 1) * sizeof(wchar_t)));
	} else {
		RegDeleteValueW(k, L"Beyond Steam");
	}
	RegCloseKey(k);
}

static void SetString(HKEY k, const wchar_t* name, const std::wstring& v) {
	RegSetValueExW(k, name, 0, REG_SZ, (const BYTE*)v.c_str(), DWORD((v.size() + 1) * sizeof(wchar_t)));
}

static void MakeShortcut(const fs::path& exe) {
	CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
	IShellLinkW* link = nullptr;
	if (SUCCEEDED(CoCreateInstance(CLSID_ShellLink, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&link)))) {
		link->SetPath(exe.c_str());
		link->SetDescription(L"Themes and redesigns for Steam");
		link->SetIconLocation(exe.c_str(), 0);
		IPersistFile* file = nullptr;
		if (SUCCEEDED(link->QueryInterface(IID_PPV_ARGS(&file)))) {
			file->Save(Shortcut().c_str(), TRUE);
			file->Release();
		}
		link->Release();
	}
	CoUninitialize();
}

int RunSetup() {
	const fs::path steam = SteamDir();
	std::error_code ec;
	const bool update = fs::exists(InstalledExe(), ec);
	std::wstring intro = update
		? L"Update Beyond Steam to version " + Widen(kVersion) + L"?\n\nYour themes, redesigns and settings are kept."
		: L"Install Beyond Steam?\n\nBeyond Steam adds themes and complete redesigns to Steam. It installs for your Windows account only (no administrator rights), "
		  L"starts with Windows and waits in the tray.\n\nYou can remove it any time from Settings > Apps.";
	if (steam.empty()) intro += L"\n\nSteam doesn't seem to be installed for this account; Beyond Steam will wait for it.";
	if (MessageBoxW(nullptr, intro.c_str(), kTitle, MB_OKCANCEL | MB_ICONINFORMATION) != IDOK) return 0;

	CloseRunning();
	fs::create_directories(InstallDir(), ec);
	if (!CopyFileW(ThisExe().c_str(), InstalledExe().c_str(), FALSE)) {
		MessageBoxW(nullptr, L"Beyond Steam couldn't copy itself into place. Is it still running? Quit it from its tray icon and try again.", kTitle, MB_OK | MB_ICONERROR);
		return 1;
	}
	MakeShortcut(InstalledExe());
	HKEY k;
	if (RegCreateKeyExW(HKEY_CURRENT_USER, kUninstallKey, 0, nullptr, 0, KEY_SET_VALUE, nullptr, &k, nullptr) == ERROR_SUCCESS) {
		SetString(k, L"DisplayName", L"Beyond Steam");
		SetString(k, L"DisplayVersion", Widen(kVersion));
		SetString(k, L"Publisher", L"OriginalSwayze");
		SetString(k, L"DisplayIcon", InstalledExe().wstring());
		SetString(k, L"InstallLocation", InstallDir().wstring());
		SetString(k, L"UninstallString", L"\"" + InstalledExe().wstring() + L"\" --uninstall");
		DWORD one = 1, kb = DWORD(fs::file_size(InstalledExe(), ec) / 1024);
		RegSetValueExW(k, L"NoModify", 0, REG_DWORD, (const BYTE*)&one, sizeof one);
		RegSetValueExW(k, L"NoRepair", 0, REG_DWORD, (const BYTE*)&one, sizeof one);
		RegSetValueExW(k, L"EstimatedSize", 0, REG_DWORD, (const BYTE*)&kb, sizeof kb);
		RegCloseKey(k);
	}
	SetRunKey(InstalledExe(), true);

	bool millenniumOff = false, restart = false;
	if (!steam.empty()) {
		std::ofstream(steam / L".cef-enable-remote-debugging").flush(); // Steam opens its debug port when it next starts
		if (fs::exists(steam / L"millennium", ec) && fs::exists(steam / L"wsock32.dll", ec)) {
			millenniumOff = MessageBoxW(nullptr,
				L"Millennium is also installed, and the two can't run at the same time.\n\nTurn Millennium off? Its themes show up in Beyond Steam, "
				L"your theme choice and options carry over, and you can turn Millennium back on from Beyond Steam's tray menu.",
				kTitle, MB_YESNO | MB_ICONQUESTION) == IDYES;
		}
		if (Running(L"steam.exe") && !update)
			restart = MessageBoxW(nullptr, L"Steam needs to restart once to turn Beyond Steam on. Restart Steam now?", kTitle, MB_YESNO | MB_ICONQUESTION) == IDYES;
		if (millenniumOff && Running(L"steam.exe") && !restart) restart = true; // Millennium can only be switched while Steam is closed
		if (restart) StopSteam(steam);
		if (millenniumOff && !Running(L"steam.exe")) fs::rename(steam / L"wsock32.dll", steam / L"wsock32.dll.beyondsteam-off", ec);
	}
	ShellExecuteW(nullptr, L"open", InstalledExe().c_str(), update ? nullptr : L"--welcome", nullptr, SW_SHOWNORMAL);
	if (restart) {
		Sleep(1500);
		ShellExecuteW(nullptr, L"open", (steam / L"steam.exe").c_str(), nullptr, nullptr, SW_SHOWNORMAL);
	}
	if (update) MessageBoxW(nullptr, (L"Beyond Steam is updated to " + Widen(kVersion) + L".").c_str(), kTitle, MB_OK | MB_ICONINFORMATION);
	return 0;
}

int RunUninstall() {
	if (MessageBoxW(nullptr, L"Remove Beyond Steam from this PC?", kTitle, MB_OKCANCEL | MB_ICONQUESTION) != IDOK) return 0;
	CloseRunning();
	const fs::path steam = SteamDir();
	std::error_code ec;
	SetRunKey(InstalledExe(), false);
	fs::remove(Shortcut(), ec);
	RegDeleteTreeW(HKEY_CURRENT_USER, kUninstallKey);
	if (!steam.empty()) {
		if (fs::exists(steam / L"wsock32.dll.beyondsteam-off", ec) &&
			MessageBoxW(nullptr, L"Beyond Steam turned Millennium off. Turn Millennium back on? (Steam restarts if it's running.)", kTitle, MB_YESNO | MB_ICONQUESTION) == IDYES) {
			bool was = Running(L"steam.exe");
			StopSteam(steam);
			fs::rename(steam / L"wsock32.dll.beyondsteam-off", steam / L"wsock32.dll", ec);
			if (was) ShellExecuteW(nullptr, L"open", (steam / L"steam.exe").c_str(), nullptr, nullptr, SW_SHOWNORMAL);
		}
		if (!fs::exists(steam / L"wsock32.dll", ec)) fs::remove(steam / L".cef-enable-remote-debugging", ec); // Millennium opens the port itself
	}
	fs::path data = KnownFolder(FOLDERID_RoamingAppData) / L"Beyond Steam";
	if (fs::exists(data, ec) &&
		MessageBoxW(nullptr, L"Also delete your Beyond Steam themes, redesigns and settings?", kTitle, MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2) == IDYES)
		fs::remove_all(data, ec);
	// This program is running from the folder it removes, so a short-lived helper deletes it after it exits.
	std::wstring cmd = L"cmd.exe /c ping 127.0.0.1 -n 3 > nul & rmdir /s /q \"" + InstallDir().wstring() + L"\"";
	STARTUPINFOW si{sizeof si};
	PROCESS_INFORMATION pi{};
	wchar_t tmp[MAX_PATH];
	GetTempPathW(MAX_PATH, tmp);
	if (CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, tmp, &si, &pi)) { CloseHandle(pi.hThread); CloseHandle(pi.hProcess); }
	MessageBoxW(nullptr, L"Beyond Steam is removed.", kTitle, MB_OK | MB_ICONINFORMATION);
	return 0;
}
