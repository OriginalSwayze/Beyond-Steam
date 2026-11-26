// Beyond Steam — runs inside Steam's UI process (SharedJSContext). It reads the chosen theme from the Beyond Steam
// app and adds its styles and scripts to every Steam window as it opens, plus your own tweaks and settings on top.
// Theme files use the skin.json format, so themes made for Millennium work unchanged.
(() => {
	if (window.__BS) return;
	// Served by the Beyond Steam app's local server; everything else comes from the same place.
	const HOST = document.currentScript ? new URL(document.currentScript.src).origin : 'http://127.0.0.1:37421';
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const api = async (path, body) => {
		const r = await fetch(HOST + '/api/' + path, body === undefined ? { cache: 'no-store' } : { method: 'POST', body: JSON.stringify(body) });
		return r.json();
	};
	const MAIN = 'SP Desktop_uid0';
	const mainPopup = () => window.g_PopupManager?.GetExistingPopup(MAIN)?.m_popup;

	// Steam windows that themes made for Millennium expect to be styled even when they list no patch for them.
	const DEFAULT_PATCHES = [
		['^Steam$', 'libraryroot'], ['^OverlayBrowser_Browser$', 'libraryroot'], ['^SP Overlay:', 'libraryroot'], ['Menu$', 'libraryroot'],
		['Supernav$', 'libraryroot'], ['^notificationtoasts_', 'libraryroot'], ['^SteamBrowser_Find$', 'libraryroot'], ['^OverlayTab\\d+_Find$', 'libraryroot'],
		['^Steam Big Picture Mode$', 'bigpicture'], ['^QuickAccess_', 'bigpicture'], ['^MainMenu_', 'bigpicture'], ['.friendsui-container', 'friends'],
		['.ModalDialogPopup', 'libraryroot'], ['.FullModalOverlay', 'libraryroot'],
	].map(([m, f]) => ({ MatchRegexString: m, TargetCss: f + '.custom.css', TargetJs: f + '.custom.js' }));

	// Tweaks: small switches that work with any theme. `where` picks the windows (by title) they apply to.
	const TWEAKS = [
		{ id: 'hide-store', name: 'Hide the Store tab', description: "Removes Store from Steam's top bar.", where: /^Steam$/, css: '.SuperNav > :nth-child(1) { display: none !important; }' },
		{ id: 'hide-community', name: 'Hide the Community tab', description: "Removes Community from Steam's top bar.", where: /^Steam$/, css: '.SuperNav > :nth-child(3) { display: none !important; }' },
		{ id: 'clean-home', name: 'Clean library home', description: 'Hides the recent games row and the shelves on the library home page.', where: /^Steam$/,
			css: '.LibraryHome .RecentGames, .LibraryHome .ShowcaseOuter, .LibraryHome .AddShowcaseRow { display: none !important; }' },
		{ id: 'hide-bottom-bar', name: 'Hide the bottom bar', description: 'Hides the strip at the bottom with Add a Game, downloads and friends.', where: /^Steam$/,
			css: '.BottomBarContainer { display: none !important; }' },
		{ id: 'grey-covers', name: 'Grey covers until you point at one', description: 'A calmer library: game art turns to colour on hover.', where: /^Steam$/,
			css: '.LibraryItemBox img, .RecentGame img { filter: grayscale(1) brightness(.85); transition: filter .25s; } .LibraryItemBox:hover img, .RecentGame:hover img { filter: none; }' },
		{ id: 'no-toasts', name: 'Hide pop-up notifications', description: "Stops Steam's corner pop-ups (friends online, downloads done). They still appear in the bell menu.", where: /^notificationtoasts_/,
			css: 'body { display: none !important; }' },
		{ id: 'no-motion', name: 'No animations', description: 'Switches off transitions and animations everywhere, including in themes.', where: /./,
			css: '*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }' },
	];

	const BS = (window.__BS = {
		version: '0.5.0', host: HOST, state: null, api, refresh, setTheme, setCondition, setPlugin, setPrefs, open, restartUI, reloadStyles, inspect, safe,
		popups: () => popups(), loaded: {}, tweaks: TWEAKS.map(({ id, name, description }) => ({ id, name, description })),
	});
	const prefs = () => BS.state?.prefs || {};

	// ---------- redesigns ----------

	// Steam bundles React inside its own code without exposing it. Redesigns expect it at window.SP_REACT,
	// SP_REACTDOM and SP_JSX_FACTORY (the names Millennium used), so find it among Steam's webpack modules.
	function exposeReact() {
		if (window.SP_REACT && window.SP_REACTDOM && window.SP_JSX_FACTORY) return true;
		if (!window.webpackChunksteamui) return false;
		let req;
		window.webpackChunksteamui.push([[Symbol('beyondsteam')], {}, (r) => { req = r; }]);
		if (!req?.m) return false;
		const mods = [];
		for (const id of Object.keys(req.m)) { try { const m = req(id); if (m) mods.push(m); } catch {} }
		const find = (f) => {
			for (const m of mods) {
				try { if (m.default && f(m.default)) return m.default; if (f(m)) return m; } catch {}
			}
		};
		const React = find((m) => m.Component && m.PureComponent && m.useLayoutEffect);
		if (!React) return false;
		const dom = find((m) => m.createPortal && m.createRoot) ||
			{ ...find((m) => m.createPortal && m.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE), ...find((m) => m.createRoot) };
		const newJsx = find((m) => m?.jsx && m?.Fragment && m?.jsxs);
		const oldJsx = find((m) => m.jsx && Object.keys(m).length === 1)?.jsx;
		const jsx = newJsx || (oldJsx && { Fragment: React.Fragment, jsx: oldJsx, jsxs: oldJsx });
		if (!dom?.createRoot || !jsx) return false;
		window.SP_REACT ??= React;
		window.SP_REACTDOM ??= dom;
		window.SP_JSX_FACTORY ??= jsx;
		console.log('[Beyond Steam] found the React built into Steam', React.version);
		return true;
	}

	// A redesign gets its own settings store, kept by Beyond Steam: BS.storage(id).get(key) / .set(key, value).
	BS.storage = (id) => ({
		get: (key) => prefs().plugins?.[id]?.[key],
		set: (key, value) => setPrefs({ plugins: { [id]: { [key]: value } } }),
	});

	async function startPlugins() {
		if (!(BS.state?.plugins || []).some((p) => p.enabled)) return;
		// Steam finishes loading its code a little after its interface page starts; keep looking for up to two minutes.
		for (let i = 0; i < 240 && !exposeReact(); i++) await sleep(500);
		for (const p of BS.state?.plugins || []) {
			if (!p.enabled) continue;
			try {
				const mod = await import(HOST + '/plugins/' + encodeURIComponent(p.folder) + '/' + String(p.main).split('/').map(encodeURIComponent).join('/'));
				if (typeof mod.default === 'function') await mod.default({ beyondSteam: BS, storage: BS.storage(p.id) });
				BS.loaded[p.id] = 'running';
				console.log('[Beyond Steam] started redesign', p.name);
			} catch (e) {
				BS.loaded[p.id] = 'failed: ' + (e?.message || e);
				console.error('[Beyond Steam] redesign failed to start:', p.name, e);
			}
		}
	}

	async function setPlugin(id, enabled) {
		BS.state = await api('set', { plugin: { id, enabled } });
		restartUI(manager?.isOpen() ? 'redesigns' : null, (enabled ? 'turned on ' : 'turned off ') + id);
	}

	// ---------- the Beyond Steam window, reloading, safe mode ----------

	// The Beyond Steam window (web/manager.js), loaded the first time it is opened.
	let manager = null;
	async function open(tab) {
		manager ??= await import(HOST + '/web/manager.js');
		return manager.open(BS, tab);
	}

	// Reloads Steam's interface (needed to drop a theme's scripts) and reopens the Beyond Steam window afterwards.
	const note = (text) => api('log', { text }).catch(() => {});
	function restartUI(reopenTab, why) {
		note('reloading the interface' + (why ? ': ' + why : ''));
		try { if (reopenTab) localStorage.setItem('beyondsteam.reopen', reopenTab); } catch {}
		SteamClient.Browser.RestartJSContext();
	}

	// Safe mode: theme and redesigns off (your choices are kept), for when something has broken Steam's interface.
	async function safe(on, reason) {
		BS.state = await api('safe', { on, reason });
		restartUI(manager?.isOpen() || !on ? 'themes' : null, on ? 'safe mode on' : 'safe mode off');
	}

	async function setPrefs(patch) {
		BS.state.prefs = await api('prefs', patch);
		popups().forEach(patchSoon);
		window.dispatchEvent(new CustomEvent('beyondsteam-state', { detail: BS.state }));
	}

	// Live reload for theme makers: re-fetch the theme's files (scripts excepted) without reloading Steam.
	let bust = 0;
	async function reloadStyles() {
		bust = Date.now();
		await refresh();
	}

	// Next favourite theme (Ctrl+Shift+T).
	async function nextFavourite() {
		const favs = (prefs().favorites || []).filter((f) => BS.state.themes.some((t) => t.folder === f));
		if (!favs.length) return;
		const at = favs.indexOf(BS.state.active);
		note('next favourite (Ctrl+Shift+T)');
		await setTheme(favs[(at + 1) % favs.length]);
	}

	const BUTTON_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path transform="rotate(-28 12 12)" d="M1.8 12A10.2 3.5 0 0 1 22.2 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity=".55"/><circle cx="12" cy="12" r="3.6" fill="currentColor"/><path transform="rotate(-28 12 12)" d="M22.2 12A10.2 3.5 0 0 1 1.8 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

	// The title-bar button and keyboard shortcuts in Steam's main window:
	// Ctrl+Shift+B opens Beyond Steam, Ctrl+Shift+T switches to the next favourite theme,
	// Ctrl+Shift+Alt+B is the panic key: safe mode at once.
	function decorateMain(win) {
		const doc = win.document;
		// Steam's windows can outlive an interface reload, so the marker names this run of the script, not just "done".
		if (win.__bsKeysOwner !== BS) {
			win.__bsKeysOwner = BS;
			win.addEventListener('keydown', (e) => {
				if (window.__BS !== BS) return; // a listener left from before a reload
				if (!e.ctrlKey || !e.shiftKey) return;
				if (e.code === 'KeyB' && e.altKey) { e.preventDefault(); e.stopPropagation(); safe(true, 'You pressed the panic key (Ctrl+Shift+Alt+B).'); }
				else if (e.code === 'KeyB' && !e.altKey) { e.preventDefault(); e.stopPropagation(); open(); }
				else if (e.code === 'KeyT' && !e.altKey) { e.preventDefault(); e.stopPropagation(); nextFavourite(); }
			}, true);
		}
		const bar = doc.querySelector('.TitleBarControls');
		if (!bar || bar.querySelector('.beyondsteam-button')) return;
		const sample = bar.querySelector('.Button');
		const wrap = doc.createElement('div');
		wrap.className = 'tool-tip-source Focusable beyondsteam-button';
		const btn = doc.createElement('div');
		btn.className = (sample ? sample.className.split(' ').filter((c) => !/Announcements|Active|Notification|Friends|Account|Badge/i.test(c)).join(' ') : 'Button');
		btn.title = 'Beyond Steam';
		btn.setAttribute('role', 'button');
		btn.tabIndex = 0;
		btn.style.cssText = 'display:flex;align-items:center;justify-content:center;min-width:32px;';
		btn.innerHTML = BUTTON_ICON;
		btn.addEventListener('click', () => open());
		btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
		wrap.appendChild(btn);
		bar.insertBefore(wrap, bar.firstChild);
	}

	// ---------- applying themes ----------

	const fileUrl = (rel) => HOST + '/themes/' + encodeURIComponent(BS.state.active) + '/' + String(rel).split('/').map(encodeURIComponent).join('/');
	const list = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

	function patchesOf(data) {
		let own = Array.isArray(data.Patches) ? data.Patches : [];
		if (data.UseDefaultPatches) {
			const mine = new Set(own.map((p) => p.MatchRegexString));
			own = DEFAULT_PATCHES.filter((p) => !mine.has(p.MatchRegexString)).concat(own);
		}
		return own;
	}

	function matches(m, title, classes) {
		try { if (title.match(m)) return true; } catch {}
		return classes.some((c) => c.includes(m));
	}

	function accentCss(hex) {
		const n = parseInt(hex.slice(1), 16), rgb = [n >> 16 & 255, n >> 8 & 255, n & 255];
		const mix = (t, w) => rgb.map((c) => Math.round(c + (t - c) * w));
		const v = (name, c) => `--SystemAccentColor${name}: rgb(${c.join(', ')}); --SystemAccentColor${name}-RGB: ${c.join(', ')};`;
		return ':root { ' + v('', rgb) + [1, 2, 3].map((i) => v('Light' + i, mix(255, i * 0.2)) + v('Dark' + i, mix(0, i * 0.2))).join(' ') + ' }';
	}

	function popups() {
		const pm = window.g_PopupManager;
		return pm ? Array.from(pm.GetPopups()) : [];
	}

	// Labels each window with the same class names Millennium used, so themes that target them keep working.
	function breadcrumbs(p, doc) {
		const add = (c) => doc.documentElement.classList.add(c);
		const name = p.m_strName || '', title = p.m_strTitle || '';
		if (name === MAIN) return add('MillenniumWindow_MainSteamWindow');
		if (name === 'friendslist_uid0') return add('MillenniumWindow_FriendsList');
		if (name.includes('chat_ChatWindow_')) return add('MillenniumWindow_FriendChatWindow');
		if (name.includes('contextmenu')) { add('MillenniumWindow_ContextMenu'); add(title.replace(/[^a-zA-Z0-9]/g, '_')); }
		if (p.m_rgParams?.minHeight === 601 && p.m_rgParams?.minWidth === 842) add('MillenniumWindow_GameProperties');
	}

	const safeFont = (f) => String(f).replace(/["\\;{}<>]/g, '');

	// Your own settings, layered over whatever theme is on: accent, font, zoom, tweaks and your CSS.
	function prefsCss(title, isMain) {
		const p = prefs(), out = [];
		if (/^#[0-9a-fA-F]{6}$/.test(p.accent || '')) out.push(accentCss(p.accent));
		if (p.font) out.push(`body, button, input, select, textarea, a, p, span, div, li, td, th, h1, h2, h3, h4, h5, h6 { font-family: "${safeFont(p.font)}", "Segoe UI", sans-serif !important; }`);
		if (isMain && p.zoom && Math.abs(p.zoom - 1) > 0.01) out.push(`html { zoom: ${Math.min(1.6, Math.max(0.7, Number(p.zoom)))}; }`);
		for (const t of TWEAKS) if (p.tweaks?.[t.id] && t.where.test(title)) out.push(t.css);
		if (p.css?.global) out.push(p.css.global);
		const mine = p.css?.themes?.[BS.state?.active];
		if (mine) out.push(mine);
		return out.join('\n');
	}

	function patch(p) {
		const win = p.m_popup?.window || p.window;
		const doc = win?.document;
		if (!doc?.head) return false;
		doc.querySelectorAll('[data-bs]').forEach((e) => e.remove()); // styles only; theme scripts cannot be taken back
		doc.documentElement.classList.add('BeyondSteam');
		breadcrumbs(p, doc);
		const isMain = p.m_strName === MAIN;
		if (isMain) decorateMain(win);
		const st = BS.state;
		const title = p.title ?? p.m_strTitle ?? doc.title ?? '';
		const style = (css, id) => { const e = doc.createElement('style'); e.dataset.bs = id || ''; e.textContent = css; doc.head.appendChild(e); };
		if (!st || st.safe) return true; // safe mode: nothing but the Beyond Steam button

		if (st.theme) {
			const data = st.theme.data;
			const classes = `${p.params?.body_class ?? ''} ${p.params?.html_class ?? ''} ${p.m_rgParams?.body_class ?? ''} ${p.m_rgParams?.html_class ?? ''}`
				.split(' ').filter(Boolean).map((c) => '.' + c);
			const css = (rel) => { const e = doc.createElement('link'); e.rel = 'stylesheet'; e.href = fileUrl(rel) + (bust ? '?v=' + bust : ''); e.dataset.bs = ''; doc.head.appendChild(e); };
			const js = (rel) => {
				const src = fileUrl(rel);
				if (doc.querySelector(`script[src="${CSS.escape(src)}"]`)) return;
				const e = doc.createElement('script'); e.type = 'module'; e.src = src; e.dataset.bsTheme = ''; doc.head.appendChild(e);
			};

			style(accentCss(st.accent || '#1A9FFF'), 'accent');

			// Theme options ("Conditions"): either a slider that sets a CSS variable, or a choice that adds files.
			for (const [name, def] of Object.entries(data.Conditions || {})) {
				const value = st.conditions[name];
				if (value === undefined) continue;
				if (def.slider) { style(`:root { ${def.slider.cssVariable}: ${value}${def.slider.unit ?? ''}; }`, 'slider'); continue; }
				const choice = def.values?.[value];
				if (!choice) continue;
				if (choice.TargetCss && list(choice.TargetCss.affects).some((m) => matches(m, title, classes))) css(choice.TargetCss.src);
				if (choice.TargetJs && list(choice.TargetJs.affects).some((m) => matches(m, title, classes))) js(choice.TargetJs.src);
			}

			for (const pt of patchesOf(data)) {
				const alt = pt.MatchRegexString === '^Steam$' ? '^Steam Games List$' : null;
				if (!matches(pt.MatchRegexString, title, classes) && !(alt && matches(alt, title, classes))) continue;
				list(pt.TargetCss).forEach(css);
				list(pt.TargetJs).forEach(js);
			}

			if (st.rootColors) style(st.rootColors, 'root');
		}
		const mine = prefsCss(title, isMain);
		if (mine) style(mine, 'prefs');
		return true;
	}

	async function patchSoon(p) {
		for (let i = 0; i < 100; i++) {
			try { if (patch(p)) return; } catch (e) { console.warn('[Beyond Steam]', e); return; }
			await sleep(50);
		}
	}

	async function refresh() {
		BS.state = await api('state');
		popups().forEach(patchSoon);
		window.dispatchEvent(new CustomEvent('beyondsteam-state', { detail: BS.state }));
	}

	// A theme without a picture gets a snapshot of Steam wearing it (the Beyond Steam window is hidden meanwhile).
	async function maybeCapture() {
		const st = BS.state, t = st?.themes?.find((x) => x.folder === st.active);
		if (!t || t.preview) return;
		await sleep(3000);
		const main = () => mainPopup()?.window;
		for (let i = 0; i < 20 && main()?.document.hidden; i++) await sleep(500); // only a visible window can be photographed
		if (BS.state?.active !== t.folder || !main() || main().document.hidden) return;
		const host = main().document.getElementById('beyondsteam-manager');
		if (host) host.style.visibility = 'hidden';
		try { await api('capture', {}); } finally { if (host) host.style.visibility = ''; }
		await refresh();
	}

	// A theme's scripts cannot be unloaded, so leaving a theme that ran any reloads Steam's interface (a second or two).
	async function setTheme(folder) {
		const ranScripts = popups().some((p) => (p.m_popup?.window || p.window)?.document?.querySelector('script[data-bs-theme]'));
		BS.state = await api('set', { active: folder });
		if (ranScripts) return restartUI(manager?.isOpen() ? 'themes' : null, 'switched theme to ' + (folder || 'none'));
		popups().forEach(patchSoon);
		window.dispatchEvent(new CustomEvent('beyondsteam-state', { detail: BS.state }));
		maybeCapture();
	}

	async function setCondition(name, value) {
		BS.state = await api('set', { conditions: { [name]: value } });
		popups().forEach(patchSoon);
	}

	// ---------- inspector (for theme makers) ----------

	// Point at anything in Steam's main window to see the class names to target; click copies a selector. Esc ends it.
	let inspecting = null;
	function inspect(on = !inspecting) {
		const win = mainPopup()?.window, doc = win?.document;
		if (!doc) return false;
		if (!on) { inspecting?.(); inspecting = null; return false; }
		if (inspecting) return true;
		const box = doc.createElement('div'), tag = doc.createElement('div');
		box.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;outline:2px solid #6FE3D2;background:rgba(111,227,210,.12);transition:all .05s';
		tag.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;max-width:520px;padding:6px 9px;border-radius:6px;background:#0E1117;color:#E8ECF4;font:12px Consolas,monospace;box-shadow:0 4px 16px rgba(0,0,0,.5);white-space:pre-wrap';
		doc.body.append(box, tag);
		const readable = (el) => [...el.classList].filter((c) => /^[A-Za-z][A-Za-z-]{2,}$/.test(c) && !/\d/.test(c));
		const selector = (el) => {
			const parts = [];
			for (let e = el; e && e !== doc.body && parts.length < 3; e = e.parentElement) {
				const c = readable(e);
				if (c.length) parts.unshift('.' + c[0]);
				else if (!parts.length) parts.unshift(e.tagName.toLowerCase());
			}
			return parts.join(' ') || el.tagName.toLowerCase();
		};
		let current = null;
		const move = (e) => {
			const el = e.target;
			if (!el || el === box || el === tag || el.closest?.('#beyondsteam-manager')) return;
			current = el;
			const r = el.getBoundingClientRect();
			Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
			tag.textContent = selector(el) + '\n' + el.tagName.toLowerCase() + ' · ' + ([...el.classList].join(' ') || '(no classes)') + '\nClick to copy the selector · Esc to stop';
			tag.style.left = Math.min(r.left, win.innerWidth - 540) + 'px';
			tag.style.top = (r.bottom + 8 > win.innerHeight - 80 ? Math.max(4, r.top - 80) : r.bottom + 8) + 'px';
		};
		const click = (e) => {
			if (!current) return;
			e.preventDefault(); e.stopPropagation();
			const ta = doc.createElement('textarea');
			ta.value = selector(current);
			doc.body.appendChild(ta); ta.select(); doc.execCommand('copy'); ta.remove();
			tag.textContent = 'Copied: ' + selector(current);
		};
		const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); inspect(false); } };
		win.addEventListener('mousemove', move, true);
		win.addEventListener('click', click, true);
		win.addEventListener('keydown', key, true);
		inspecting = () => {
			win.removeEventListener('mousemove', move, true);
			win.removeEventListener('click', click, true);
			win.removeEventListener('keydown', key, true);
			box.remove(); tag.remove();
		};
		return true;
	}

	// ---------- start ----------

	(async () => {
		try { BS.state = await api('state'); } catch (e) { console.warn('[Beyond Steam] could not reach the app', e); }
		while (!window.g_PopupManager?.AddPopupCreatedCallback) await sleep(50);
		await sleep(500);
		if (window.Millennium || window.MILLENNIUM_API) { console.warn('[Beyond Steam] Millennium is running; not applying anything'); return; }
		api('booted', {}).catch(() => {});
		let reopen = null;
		try { reopen = localStorage.getItem('beyondsteam.reopen'); localStorage.removeItem('beyondsteam.reopen'); } catch {}
		// "A random favourite each time Steam starts" (not on reloads Beyond Steam itself asked for).
		const p = prefs(), favs = (p.favorites || []).filter((f) => BS.state?.themes?.some((t) => t.folder === f) && f !== BS.state.active);
		setTimeout(() => api('ready', {}).catch(() => {}), 15000); // started fine: not a crash loop
		if (!reopen && !BS.state?.safe && p.schedule?.mode === 'random' && favs.length) {
			note('random favourite at start');
			try { BS.state = await api('set', { active: favs[Math.floor(Math.random() * favs.length)] }); } catch {}
		}
		g_PopupManager.AddPopupCreatedCallback((p) => patchSoon(p));
		popups().forEach(patchSoon);
		if (!BS.state?.safe) startPlugins();
		console.log('[Beyond Steam] ready, theme:', BS.state?.active || '(none)', BS.state?.safe ? '(safe mode)' : '');
		// Keep the title-bar button in place if Steam redraws its title bar.
		setInterval(() => { const w = mainPopup()?.window; if (w) decorateMain(w); }, 2000);
		if (reopen) {
			// Steam keeps its window hidden after a reload if it was started minimised; bring it back first.
			for (let i = 0; i < 50 && !mainPopup(); i++) await sleep(100);
			const w = mainPopup();
			try { w?.SteamClient.Window.ShowWindow(); w?.SteamClient.Window.BringToFront(); } catch {}
			api('app', { open: 'steam' }).catch(() => {}); // un-minimise, or show if Steam still keeps it hidden
			for (let i = 0; i < 100; i++) { if (await open(reopen)) break; await sleep(100); }
			maybeCapture();
		}
	})();
})();
