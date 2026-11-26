# Beyond Steam

Themes and full redesigns for the Steam desktop client, with no setup beyond running one program.

> Early work in progress (0.1). Not released yet.

## What it does

- **Themes.** Applies a theme to Steam's main window, menus, dialogs, friends list, notifications, and the Store and Community pages.
  - Themes use the common `skin.json` format: patches, options and colour files. Themes made for Millennium work as they are.
- **Your settings carry over.** On first run it imports the theme and theme options you chose in Millennium, if you used it.
- **Theme switching.** Switch themes from the tray icon. If the previous theme ran scripts, Steam reloads its interface so nothing is left behind.
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

## License

MIT
