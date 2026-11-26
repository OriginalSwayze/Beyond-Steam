# Making a redesign

A redesign is an add-on that runs inside Steam's interface. It can draw its own interface over Steam's, as
[Playbox](https://github.com/OriginalSwayze/Playbox) does, or add features to Steam's. This page shows how to make
one for Beyond Steam.

## The folder

```
%APPDATA%\Beyond Steam\plugins\my.redesign.id\
    plugin.json
    main.js
```

`plugin.json`:

```json
{
  "id": "my.redesign.id",
  "name": "My redesign",
  "version": "1.0.0",
  "author": "You",
  "description": "One or two sentences for the Redesigns tab.",
  "main": "main.js",
  "theme": "OptionalCompanionTheme"
}
```

- `id`: unique; reverse-domain style works well. Use the folder name too.
- `main`: an ES module whose **default export** Beyond Steam calls once each time Steam's interface starts.
- `theme`: optional. A theme folder name the Redesigns tab offers to switch on alongside the redesign.

## What your code gets

```js
export default async function start({ beyondSteam, storage }) {
	// runs inside Steam's interface page (SharedJSContext)
}
```

- **Steam's React**
  - `window.SP_REACT`, `window.SP_REACTDOM` and `window.SP_JSX_FACTORY`, the copy Steam uses itself, under the names
    Millennium used.
  - When bundling, map `react` to `SP_REACT` and `react/jsx-runtime` to `SP_JSX_FACTORY`. Playbox's
    [beyond/build.mjs](https://github.com/OriginalSwayze/Playbox/blob/main/beyond/build.mjs) shows one way with Bun.
- **Steam's own objects**
  - `SteamClient`, `appStore`, `appDetailsStore`, `collectionStore`, `downloadsStore`, `friendStore`, `SteamUIStore` and
    `g_PopupManager`.
  - The main window's document is `g_PopupManager.GetExistingPopup('SP Desktop_uid0').m_popup.document`.
- **`storage`:** settings that persist, kept by Beyond Steam. Use `storage.get(key)` and `storage.set(key, value)`;
  values must be JSON-compatible.
- **`beyondSteam`:** Beyond Steam's own API.
  - `state`: the active theme, installed themes and redesigns.
  - `open(tab)`: opens the Beyond Steam window.
  - `restartUI()`: reloads Steam's interface.

## Rules of thumb

- **Feature-detect everything from Steam.** Steam changes without notice; when something is missing, step aside and
  leave Steam's own interface usable.
- **Offer an off switch.** Playbox uses Ctrl+Shift+K to swap back to Steam's interface. If things go badly wrong, users
  have Beyond Steam's safe mode (Ctrl+Shift+Alt+B).
- **Attach listeners to the main window.** Put keyboard listeners on the main window in the capture phase, and stop
  the ones you handle. Otherwise Steam's hidden library type-ahead also receives them.

## Getting it listed

Publish the redesign as a zip with `plugin.json` at its top level, attached to a GitHub release. Then follow
[catalog/README.md](../catalog/README.md).
