// Beyond Steam — runs inside Steam's UI process (SharedJSContext). It reads the chosen theme from the Beyond Steam
// app and adds its styles and scripts to every Steam window as it opens. Theme files use the skin.json format, so
// themes made for Millennium work unchanged.
(() => {
	if (window.__BS) return;
	// Served by the Beyond Steam app's local server; everything else comes from the same place.
	const HOST = document.currentScript ? new URL(document.currentScript.src).origin : 'http://127.0.0.1:37421';
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const api = async (path, body) => {
		const r = await fetch(HOST + '/api/' + path, body === undefined ? { cache: 'no-store' } : { method: 'POST', body: JSON.stringify(body) });
		return r.json();
	};

	// Steam windows that themes made for Millennium expect to be styled even when they list no patch for them.
	const DEFAULT_PATCHES = [
		['^Steam$', 'libraryroot'], ['^OverlayBrowser_Browser$', 'libraryroot'], ['^SP Overlay:', 'libraryroot'], ['Menu$', 'libraryroot'],
		['Supernav$', 'libraryroot'], ['^notificationtoasts_', 'libraryroot'], ['^SteamBrowser_Find$', 'libraryroot'], ['^OverlayTab\\d+_Find$', 'libraryroot'],
		['^Steam Big Picture Mode$', 'bigpicture'], ['^QuickAccess_', 'bigpicture'], ['^MainMenu_', 'bigpicture'], ['.friendsui-container', 'friends'],
		['.ModalDialogPopup', 'libraryroot'], ['.FullModalOverlay', 'libraryroot'],
	].map(([m, f]) => ({ MatchRegexString: m, TargetCss: f + '.custom.css', TargetJs: f + '.custom.js' }));

	const BS = (window.__BS = { version: '0.1.0', state: null, api, refresh, setTheme, setCondition, popups: () => popups() });

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
		if (name === 'SP Desktop_uid0') return add('MillenniumWindow_MainSteamWindow');
		if (name === 'friendslist_uid0') return add('MillenniumWindow_FriendsList');
		if (name.includes('chat_ChatWindow_')) return add('MillenniumWindow_FriendChatWindow');
		if (name.includes('contextmenu')) { add('MillenniumWindow_ContextMenu'); add(title.replace(/[^a-zA-Z0-9]/g, '_')); }
		if (p.m_rgParams?.minHeight === 601 && p.m_rgParams?.minWidth === 842) add('MillenniumWindow_GameProperties');
	}

	function patch(p) {
		const win = p.m_popup?.window || p.window;
		const doc = win?.document;
		if (!doc?.head) return false;
		doc.querySelectorAll('[data-bs]').forEach((e) => e.remove()); // styles only; theme scripts cannot be taken back
		doc.documentElement.classList.add('BeyondSteam');
		breadcrumbs(p, doc);
		const st = BS.state;
		if (!st?.theme) return true;

		const data = st.theme.data;
		const title = p.title ?? p.m_strTitle ?? doc.title ?? '';
		const classes = `${p.params?.body_class ?? ''} ${p.params?.html_class ?? ''} ${p.m_rgParams?.body_class ?? ''} ${p.m_rgParams?.html_class ?? ''}`
			.split(' ').filter(Boolean).map((c) => '.' + c);
		const style = (css, id) => { const e = doc.createElement('style'); e.dataset.bs = id || ''; e.textContent = css; doc.head.appendChild(e); };
		const css = (rel) => { const e = doc.createElement('link'); e.rel = 'stylesheet'; e.href = fileUrl(rel); e.dataset.bs = ''; doc.head.appendChild(e); };
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

	// A theme's scripts cannot be unloaded, so leaving a theme that ran any reloads Steam's interface (a second or two).
	async function setTheme(folder) {
		const ranScripts = popups().some((p) => (p.m_popup?.window || p.window)?.document?.querySelector('script[data-bs-theme]'));
		BS.state = await api('set', { active: folder });
		if (ranScripts) return SteamClient.Browser.RestartJSContext();
		popups().forEach(patchSoon);
	}

	async function setCondition(name, value) {
		BS.state = await api('set', { conditions: { [name]: value } });
		popups().forEach(patchSoon);
	}

	(async () => {
		try { BS.state = await api('state'); } catch (e) { console.warn('[Beyond Steam] could not reach the app', e); }
		while (!window.g_PopupManager?.AddPopupCreatedCallback) await sleep(50);
		g_PopupManager.AddPopupCreatedCallback((p) => patchSoon(p));
		popups().forEach(patchSoon);
		console.log('[Beyond Steam] ready, theme:', BS.state?.active || '(none)');
	})();
})();
