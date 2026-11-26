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

	const BS = (window.__BS = { version: '0.2.0', host: HOST, state: null, api, refresh, setTheme, setCondition, open, restartUI, popups: () => popups() });

	// The Beyond Steam window (web/manager.js), loaded the first time it is opened.
	let manager = null;
	async function open(tab) {
		manager ??= await import(HOST + '/web/manager.js');
		return manager.open(BS, tab);
	}

	// Reloads Steam's interface (needed to drop a theme's scripts) and reopens the Beyond Steam window afterwards.
	function restartUI(reopenTab) {
		try { if (reopenTab) localStorage.setItem('beyondsteam.reopen', reopenTab); } catch {}
		SteamClient.Browser.RestartJSContext();
	}

	const BUTTON_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M3.2 15.5C1.6 11 6 5.2 12.6 3.6c4.3-1 7.6.3 8.4 2.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20.8 8.5c1.6 4.5-2.8 10.3-9.4 11.9-4.3 1-7.6-.3-8.4-2.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/></svg>';

	// A Beyond Steam button beside Steam's own title-bar buttons, styled like them; Ctrl+Shift+B opens the window too.
	function decorateMain(win) {
		const doc = win.document;
		if (!doc.documentElement.dataset.bsKeys) {
			doc.documentElement.dataset.bsKeys = '1';
			win.addEventListener('keydown', (e) => {
				if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyB') { e.preventDefault(); e.stopPropagation(); open(); }
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
		if (p.m_strName === 'SP Desktop_uid0') decorateMain(win);
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
	// A theme without a picture gets a snapshot of Steam wearing it (the Beyond Steam window is hidden meanwhile).
	async function maybeCapture() {
		const st = BS.state, t = st?.themes?.find((x) => x.folder === st.active);
		if (!t || t.preview) return;
		await sleep(3000);
		const main = () => g_PopupManager.GetExistingPopup('SP Desktop_uid0')?.m_popup?.window;
		for (let i = 0; i < 20 && main()?.document.hidden; i++) await sleep(500); // only a visible window can be photographed
		if (BS.state?.active !== t.folder || !main() || main().document.hidden) return;
		const host = g_PopupManager.GetExistingPopup('SP Desktop_uid0')?.m_popup?.window?.document.getElementById('beyondsteam-manager');
		if (host) host.style.visibility = 'hidden';
		try { await api('capture', {}); } finally { if (host) host.style.visibility = ''; }
		await refresh();
	}

	async function setTheme(folder) {
		const ranScripts = popups().some((p) => (p.m_popup?.window || p.window)?.document?.querySelector('script[data-bs-theme]'));
		BS.state = await api('set', { active: folder });
		if (ranScripts) return restartUI(manager?.isOpen() ? 'themes' : null);
		popups().forEach(patchSoon);
		maybeCapture();
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
		// Keep the title-bar button in place if Steam redraws its title bar.
		setInterval(() => { const w = g_PopupManager.GetExistingPopup('SP Desktop_uid0')?.m_popup?.window; if (w) decorateMain(w); }, 2000);
		let reopen = null;
		try { reopen = localStorage.getItem('beyondsteam.reopen'); localStorage.removeItem('beyondsteam.reopen'); } catch {}
		if (reopen) {
			// Steam keeps its window hidden after a reload if it was started minimised; bring it back first.
			for (let i = 0; i < 50 && !g_PopupManager.GetExistingPopup('SP Desktop_uid0'); i++) await sleep(100);
			const w = g_PopupManager.GetExistingPopup('SP Desktop_uid0')?.m_popup;
			try { w?.SteamClient.Window.ShowWindow(); w?.SteamClient.Window.BringToFront(); } catch {}
			api('app', { open: 'steam' }).catch(() => {}); // un-minimise, or show if Steam still keeps it hidden
			for (let i = 0; i < 100; i++) { if (await open(reopen)) break; await sleep(100); }
			maybeCapture();
		}
	})();
})();
