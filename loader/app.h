// Beyond Steam's core. A local web server (127.0.0.1 only) serves theme files and the in-Steam script; a connection
// to Steam's debug port puts that script into Steam's UI page and adds theme styles to Store and Community pages.
#pragma once
#include <filesystem>
#include <set>
#include <string>
#include <vector>
#include "cdp.h"
#include "http.h"

namespace fs = std::filesystem;

constexpr int kDebugPort = 8080;
constexpr int kServerPort = 37421;
constexpr const char* kVersion = "0.5.0";

struct ThemeInfo {
	std::string folder, name, author, description, version, preview;
	bool own = false; // in Beyond Steam's own themes folder (so it can be updated or removed)
	json tags = json::array();
	bool options = false;
	fs::path dir;
};

enum class Status { NoSteam, NeedsRestart, Connected, MillenniumActive };

class App {
public:
	App();
	void ConnectionLoop(); // runs forever on its own thread
	Status GetStatus() const { return status_; }

	std::vector<ThemeInfo> ListThemes() const;
	std::string ActiveTheme();
	void SetActiveTheme(const std::string& folder); // "" = Steam's own look
	void Refresh(); // tell the in-Steam script to re-read settings
	void OpenManager(); // show Steam and open the Beyond Steam window in it
	// 0.5 (features.cpp)
	void Housekeeping(); // runs forever: update checks, light/dark schedule, live reload
	json UpdateInfo();
	std::string InstallUpdate();
	void SetSafe(bool on, const std::string& reason);
	bool Safe() { std::lock_guard<std::mutex> lock(cfgMu_); return LoadConfig().value("safe", false); }
	void RestartInterface();
	bool DevBuild() const;
	bool Capture(); // snapshot of Steam's main window as the active theme's preview

	fs::path dataDir, themesDir, pluginsDir, webDir, steamDir;
	int port = 0;

private:
	HttpResponse Handle(const HttpRequest& req);
	void OnEvent(const json& ev);
	void OnTarget(const json& info);
	void PatchIndex(const json& p, const std::string& session);
	void EnsureBoot();
	std::string Base() const { return "http://127.0.0.1:" + std::to_string(port); }
	json State();
	json ListPlugins() const;
	void CheckForUpdate();
	void NoteBoot(bool ready);
	json Prefs();
	json SetPrefs(const json& patch);
	void ScheduleTick();
	void LiveReloadTick();
	json Backup(bool exporting);
	std::string NewTheme(const json& req, std::string& folderOut);
	std::mutex updMu_;
	json update_;
	std::vector<unsigned long long> boots_;
	int lastLight_ = -1;
	unsigned long long liveStamp_ = 0;
	json Catalog(); // {base, items, offline}
	std::string Install(const std::string& id); // "" on success, else why not
	void Remove(const std::string& kind, const std::string& id);
	std::mutex catMu_;
	json catalog_;
	std::string catalogBase_;
	unsigned long long catalogAt_ = 0;
	json LoadConfig();
	void SaveConfig(const json& cfg);
	std::string Preview(const json& j, const fs::path& dir, const std::string& folder) const;
	const ThemeInfo* FindTheme(const std::vector<ThemeInfo>& all, const std::string& folder) const;

	std::shared_ptr<Cdp> Client();
	std::shared_ptr<Cdp> cdp_;
	HttpServer server_;
	std::mutex cdpMu_, cfgMu_, sjcMu_;
	std::string sjcSession_, sjcTarget_;
	std::set<std::string> pages_; // Store/Community targets already given the theme script
	std::atomic<Status> status_{Status::NoSteam};
};

void Log(const std::string& line);
std::string Resource(int id); // files built into the .exe (see loader/res.rc)
bool AutostartOn();
void ShowSteamWindow();
void SetAutostart(bool on);
