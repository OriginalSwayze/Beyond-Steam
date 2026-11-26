# Beyond Steam

Themes and full redesigns for the Steam desktop client, with no setup beyond running one program.

> Early release (0.4).

## Install

Download `BeyondSteam.exe` from the [latest release](https://github.com/OriginalSwayze/Beyond-Steam/releases/latest) and run it.

- Windows may say it protected your PC, because the program isn't code-signed. Click **More info**, then **Run anyway**.

- It installs for your Windows account only (no administrator rights) and starts with Windows.
- If Millennium is installed it offers to turn it off. Your Millennium themes and settings carry over.
- It restarts Steam once.
- To remove it, use Settings > Apps > Beyond Steam. Removing it offers to turn Millennium back on.

## What it does

- **Themes.** Applies a theme to Steam's main window, menus, dialogs, friends list, notifications, and the Store and Community pages.
  - Themes use the common `skin.json` format: patches, options and colour files. Themes made for Millennium work as they are.
- **Your settings carry over.** On first run it imports the theme and theme options you chose in Millennium, if you used it.
- **A window inside Steam.** Open it from the Beyond Steam button in Steam's title bar, with Ctrl+Shift+B, or by clicking the tray icon.
  - **Themes:** browse all themes with previews and search, and switch with one click.
  - **Theme options:** the active theme's options, grouped the way the theme groups them, applied instantly.
  - **Settings:** start with Windows, the themes folder, the log.
- **Redesigns.** Add-ons that replace Steam's interface with a new one, such as [Playbox](https://github.com/OriginalSwayze/Playbox). Turn them on and off under Redesigns.
  - A redesign is a folder with a `plugin.json` (`id`, `name`, `main`, and optionally `theme`, its companion theme) in `%APPDATA%Beyond Steamplugins`.
  - Its `main` script's default export runs inside Steam's interface. Steam's React is available as `window.SP_REACT`, `SP_REACTDOM` and `SP_JSX_FACTORY`, as under Millennium.
  - Redesigns that were on in Millennium start out on.
- **Get more.** A catalog of themes and redesigns, installed and updated with one click. The list lives in [catalog/catalog.json](catalog/catalog.json); `tools/make-catalog.ps1` rebuilds it.
- **Stands aside for Millennium.** If Millennium is running in Steam, Beyond Steam pauses instead of theming Steam twice.
- **Previews fill themselves in.** A theme without a preview picture gets a snapshot of Steam wearing it the first time you use it.
- **Theme switching.** If the previous theme ran scripts, Steam reloads its interface so nothing is left behind.
- **No changes to Steam's files.** It doesn't touch Steam's program files.
  - It only adds Steam's own `.cef-enable-remote-debugging` switch file, which tells Steam to open its built-in debug port.
  - Beyond Steam talks to Steam through that port.

## How it works

`BeyondSteam.exe` is a small tray app with no dependencies, written in C++ on WinHTTP and Winsock. It has three parts:

1. **A local web server.** It runs on `127.0.0.1:37421`, is reachable only from your own PC, and serves theme files and the in-Steam script.
2. **The in-Steam script.** The app connects to Steam's debug port (`127.0.0.1:8080`) and loads [web/boot.js](web/boot.js) into Steam's interface page. The script adds the theme's styles and scripts to every Steam window as it opens.
3. **Store and Community pages.** These get a link to the theme's web styles (`Steam-WebKit`).

Themes are read from `%APPDATA%\Beyond Steam\themes` and, if present, `Steam\millennium\themes`.

## Building

You need Visual Studio 2026 with the C++ workload, which includes CMake and Ninja. Run `build.cmd`; it produces `build\BeyondSteam.exe`.

## About the code

This project is written with AI assistance (Claude), directed and tested by OriginalSwayze.

## Changes

### 0.4.0

First public release.

- **Themes:** applies any `skin.json` theme, including themes made for Millennium, with its options, to Steam's windows, menus and the Store and Community pages.
- **A window inside Steam:** Themes, Theme options, Redesigns, Get more and Settings. Open it with Ctrl+Shift+B, the title-bar button or the tray icon.
- **Redesigns:** add-ons that replace Steam's interface, such as Playbox. Steam's React is made available to them.
- **Get more:** a catalog of themes and redesigns, installed and updated with one click.
- **One-file installer:** installs for your Windows account without administrator rights, carries your Millennium settings over, and uninstalls from Settings > Apps.

## License

MIT
