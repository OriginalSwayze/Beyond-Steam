// Beyond Steam's window inside Steam: browse and switch themes, change the active theme's options, app settings.
// It is drawn into Steam's main window inside a shadow root, so no theme's CSS can reach it and it reaches nothing.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path transform="rotate(-28 12 12)" d="M1.8 12A10.2 3.5 0 0 1 22.2 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" opacity=".55"/><circle cx="12" cy="12" r="3.6" fill="currentColor"/><path transform="rotate(-28 12 12)" d="M22.2 12A10.2 3.5 0 0 1 1.8 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`;
export { ICON };

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; font: 14px/1.45 "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif; color: #E8ECF4; -webkit-font-smoothing: antialiased; }
.scrim { position: absolute; inset: 0; background: rgba(6, 8, 12, .62); backdrop-filter: blur(6px); animation: fade .18s ease-out both; }
.panel { position: relative; display: grid; grid-template-rows: auto 1fr; width: min(1100px, 94vw); height: min(740px, 90vh); overflow: hidden; border-radius: 16px; background: #10131A; box-shadow: 0 0 0 1px rgba(255,255,255,.07), 0 30px 80px rgba(0,0,0,.6); animation: rise .24s cubic-bezier(.2,.8,.2,1) both; }
@keyframes fade { from { opacity: 0; } } @keyframes rise { from { opacity: 0; transform: translateY(14px) scale(.985); } }
header { display: flex; align-items: center; gap: 18px; padding: 14px 18px 0 22px; border-bottom: 1px solid rgba(255,255,255,.07); }
.brand { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; font: 600 16px "Segoe UI Variable Display", "Segoe UI", sans-serif; letter-spacing: .01em; }
.brand svg { width: 26px; height: 26px; color: #8FE3D6; filter: drop-shadow(0 0 8px rgba(120,220,210,.45)); }
.brand small { font-weight: 400; color: #6E788C; }
nav { display: flex; gap: 4px; margin-left: 10px; align-self: end; }
nav button { position: relative; padding: 8px 14px 15px; color: #9AA3B5; font-weight: 600; }
nav button:hover { color: #E8ECF4; }
nav button.on { color: #E8ECF4; } nav button.on::after { content: ""; position: absolute; left: 14px; right: 14px; bottom: -1px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, #6FE3D2, #8D7DFF); }
.spacer { flex: 1; }
.x { width: 34px; height: 34px; margin-bottom: 12px; border-radius: 8px; color: #9AA3B5; font-size: 20px; line-height: 1; } .x:hover { background: rgba(255,255,255,.07); color: #fff; }
button { all: unset; cursor: pointer; box-sizing: border-box; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #8FE3D6; outline-offset: 2px; }
main { min-height: 0; overflow-y: auto; padding: 20px 22px 26px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent; }
.bar { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.search { flex: 1; max-width: 380px; height: 38px; padding: 0 14px; border: 0; border-radius: 10px; background: #1A1E27; color: #E8ECF4; font: inherit; box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
.search::placeholder { color: #6E788C; }
.count { color: #6E788C; font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(236px, 1fr)); gap: 16px; }
.card { display: grid; grid-template-rows: auto 1fr; overflow: hidden; border-radius: 12px; background: #161A22; box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); transition: transform .15s, box-shadow .15s; }
.card:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14), 0 10px 24px rgba(0,0,0,.35); }
.card.on { box-shadow: inset 0 0 0 2px #7FE0D3, 0 0 0 4px rgba(127,224,211,.14); }
.pv { position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: #0B0D12; }
.pv img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ph { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(120% 90% at 20% 10%, hsl(var(--h) 70% 42%), transparent 60%), radial-gradient(100% 100% at 90% 100%, hsl(calc(var(--h) + 60) 60% 30%), #0B0D12 70%); font: 700 44px "Segoe UI Variable Display", "Segoe UI", sans-serif; color: rgba(255,255,255,.85); text-shadow: 0 4px 20px rgba(0,0,0,.4); }
.ph.stock { background: linear-gradient(135deg, #1B2838, #2A475E); font-size: 15px; font-weight: 600; letter-spacing: .02em; }
.badge { position: absolute; top: 10px; left: 10px; padding: 3px 9px; border-radius: 99px; background: #7FE0D3; color: #06201C; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.meta { display: grid; gap: 2px; padding: 11px 13px 13px; }
.meta b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta small { color: #8A93A6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta i { font-style: normal; color: #7FE0D3; }
.empty { padding: 40px; text-align: center; color: #8A93A6; }
h2 { margin: 0 0 4px; font: 600 20px "Segoe UI Variable Display", "Segoe UI", sans-serif; }
.lede { margin: 0 0 22px; color: #9AA3B5; }
.group { margin-bottom: 26px; } .group h3 { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #6E788C; }
.opt { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 24px; align-items: center; padding: 14px 16px; border-radius: 10px; background: #161A22; margin-bottom: 8px; }
.opt b { font-weight: 600; } .opt p { grid-column: 1; margin: 0; color: #8A93A6; font-size: 13px; }
.opt .ctl { grid-column: 2; grid-row: 1 / span 2; }
.seg { display: inline-flex; padding: 3px; border-radius: 10px; background: #0E1117; box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
.seg button { padding: 6px 12px; border-radius: 7px; color: #9AA3B5; font-weight: 600; font-size: 13px; white-space: nowrap; }
.seg button:hover { color: #E8ECF4; } .seg button.on { background: #2A3040; color: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.4); }
select { height: 34px; min-width: 180px; padding: 0 10px; border: 0; border-radius: 8px; background: #0E1117; color: #E8ECF4; font: inherit; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
.range { display: flex; align-items: center; gap: 12px; } .range input { width: 200px; accent-color: #7FE0D3; } .range output { min-width: 56px; text-align: right; color: #C9D0DC; font-variant-numeric: tabular-nums; }
.note { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding: 12px 16px; border-radius: 10px; background: rgba(141,125,255,.12); box-shadow: inset 0 0 0 1px rgba(141,125,255,.35); }
.note span { flex: 1; }
.btn { display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 9px; background: #232836; font-weight: 600; } .btn:hover { background: #2C3243; }
.btn.primary { background: linear-gradient(90deg, #6FE3D2, #8D7DFF); color: #0A0C12; } .btn.primary:hover { filter: brightness(1.08); }
.about { display: grid; gap: 14px; max-width: 720px; }
.row { display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 10px; background: #161A22; }
.row div { flex: 1; } .row p { margin: 2px 0 0; color: #8A93A6; font-size: 13px; } .row code { font: 12px Consolas, monospace; color: #C9D0DC; }
.toggle { width: 44px; height: 24px; border-radius: 99px; background: #2A3040; position: relative; transition: background .15s; }
.toggle::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #C9D0DC; transition: transform .15s; }
.toggle.on { background: #5FCFC0; } .toggle.on::after { transform: translateX(20px); background: #fff; }
.sub { color: #8A93A6; font-size: 13px; }
.chip { padding: 7px 14px; border-radius: 99px; background: #1A1E27; color: #9AA3B5; font-weight: 600; font-size: 13px; } .chip:hover { color: #E8ECF4; }
.chip.on { background: #E8ECF4; color: #0E1117; }
.card.static:hover { transform: none; }
.kind { position: absolute; top: 10px; right: 10px; padding: 3px 9px; border-radius: 99px; background: rgba(10,12,18,.78); color: #C9D0DC; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.desc { margin: 6px 0 0; color: #8A93A6; font-size: 12.5px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; } .acts .btn { height: 32px; padding: 0 12px; font-size: 13px; }
.btn.quiet { background: transparent; color: #9AA3B5; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); } .btn.quiet:hover { color: #FFB4A8; }
.btn[disabled] { opacity: .7; cursor: default; }
.tag { font-size: 12px; font-weight: 600; color: #7FE0D3; } .bad { color: #FF9A8A !important; }
.kbd { padding: 1px 6px; border-radius: 4px; background: #232836; font: 12px Consolas, monospace; }
`;

let ui = null; // { host, root, win, tab, q, reloadNote }

function mainWindow() {
	return g_PopupManager.GetExistingPopup('SP Desktop_uid0')?.m_popup?.window ?? null;
}

export function isOpen() {
	return !!ui?.host?.isConnected;
}

export function close() {
	if (!ui) return;
	ui.win.removeEventListener('keydown', ui.onKey, true);
	window.removeEventListener('beyondsteam-state', ui.onState);
	ui.host.remove();
	ui = null;
}

export function open(BS, tab = 'themes') {
	const win = mainWindow();
	if (!win) return false;
	if (isOpen() && ui.win === win) { ui.tab = tab; render(BS); return true; }
	close();
	const doc = win.document;
	const host = doc.createElement('div');
	host.id = 'beyondsteam-manager';
	doc.body.appendChild(host);
	const root = host.attachShadow({ mode: 'open' });
	root.innerHTML = `<style>${CSS}</style><div class="root"><div class="scrim"></div><section class="panel" role="dialog" aria-modal="true" aria-label="Beyond Steam">
		<header><div class="brand">${ICON}<span>Beyond Steam <small>${esc(BS.state?.version || '')}</small></span></div>
		<nav><button data-tab="themes">Themes</button><button data-tab="options">Theme options</button><button data-tab="redesigns">Redesigns</button><button data-tab="more">Get more</button><button data-tab="about">Settings</button></nav>
		<span class="spacer"></span><button class="x" data-act="close" aria-label="Close">×</button></header>
		<main></main></section></div>`;
	ui = { host, root, win, tab, q: '', reloadNote: false, catalog: null, kind: 'all', busy: {}, errors: {}, confirm: null };
	ui.onKey = (e) => {
		if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
		else if (root.activeElement || e.composedPath().includes(host)) e.stopPropagation(); // keep typing out of Steam's own shortcuts
	};
	ui.onState = () => render(BS);
	win.addEventListener('keydown', ui.onKey, true);
	window.addEventListener('beyondsteam-state', ui.onState);
	root.addEventListener('click', (e) => onClick(BS, e));
	root.addEventListener('input', (e) => onInput(BS, e));
	root.addEventListener('change', (e) => onInput(BS, e, true));
	root.addEventListener('error', (e) => { // a preview that fails to load becomes the drawn placeholder
		const img = e.target;
		if (img.tagName === 'IMG') img.replaceWith(Object.assign(doc.createElement('div'), { className: 'ph', textContent: img.alt.slice(0, 1).toUpperCase(), style: `--h:${hue(img.alt)}` }));
	}, true);
	render(BS);
	root.querySelector('.search')?.focus();
	return true;
}

function render(BS) {
	if (!ui) return;
	const st = BS.state || {};
	ui.root.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
	const main = ui.root.querySelector('main');
	const keepScroll = main.dataset.tab === ui.tab ? main.scrollTop : 0;
	const focused = ui.root.activeElement?.classList.contains('search');
	main.innerHTML = ui.tab === 'themes' ? themesView(st) : ui.tab === 'options' ? optionsView(st) : ui.tab === 'redesigns' ? redesignsView(st, BS) : ui.tab === 'more' ? moreView(st, BS) : aboutView(st);
	main.dataset.tab = ui.tab;
	main.scrollTop = keepScroll;
	if (focused) { const s = ui.root.querySelector('.search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
	if (ui.tab === 'about') loadApp();
}

function themesView(st) {
	const q = ui.q.trim().toLowerCase();
	const all = st.themes || [];
	const shown = all.filter((t) => !q || [t.name, t.author, t.description, ...(t.tags || [])].join(' ').toLowerCase().includes(q));
	const card = (t) => {
		const on = t.folder === st.active;
		const pic = t.preview ? `<img loading="lazy" decoding="async" src="${esc(t.preview)}" alt="${esc(t.name)}">` : `<div class="ph" style="--h:${hue(t.name)}">${esc(t.name.slice(0, 1).toUpperCase())}</div>`;
		return `<button class="card${on ? ' on' : ''}" data-theme="${esc(t.folder)}" title="${esc(t.description)}">
			<div class="pv">${pic}${on ? '<span class="badge">Active</span>' : ''}</div>
			<div class="meta"><b>${esc(t.name)}</b><small>${esc(t.author || 'Unknown author')}${t.version ? ' · v' + esc(t.version) : ''}${t.options ? ' · <i>options</i>' : ''}</small></div></button>`;
	};
	const stock = !q ? `<button class="card${!st.active ? ' on' : ''}" data-theme=""><div class="pv"><div class="ph stock">Steam's own look</div>${!st.active ? '<span class="badge">Active</span>' : ''}</div>
		<div class="meta"><b>No theme</b><small>Steam as Valve made it</small></div></button>` : '';
	return `<div class="bar"><input class="search" type="search" placeholder="Search themes" value="${esc(ui.q)}" spellcheck="false">
		<span class="count">${shown.length} of ${all.length} themes</span><span class="spacer"></span><button class="btn" data-act="folder">Add themes…</button></div>
		${shown.length || stock ? `<div class="grid">${stock}${shown.map(card).join('')}</div>` : `<div class="empty">No theme matches “${esc(ui.q)}”.</div>`}`;
}

function optionsView(st) {
	const t = st.theme;
	if (!t) return `<div class="empty">No theme is active. Pick one under Themes.</div>`;
	const info = (st.themes || []).find((x) => x.folder === st.active) || {};
	const conds = Object.entries(t.data.Conditions || {});
	const note = ui.reloadNote ? `<div class="note"><span>This change runs a script, so it takes effect after Steam reloads its interface (a couple of seconds).</span><button class="btn primary" data-act="reload">Reload now</button></div>` : '';
	if (!conds.length) return `<h2>${esc(info.name || t.folder)}</h2><p class="lede">This theme has no options.</p>`;
	const groups = new Map();
	for (const [name, def] of conds) {
		const g = def.tab || 'General';
		if (!groups.has(g)) groups.set(g, []);
		groups.get(g).push([name, def]);
	}
	const control = (name, def) => {
		const v = st.conditions?.[name];
		if (def.slider) {
			const s = def.slider;
			return `<div class="range"><input type="range" data-cond="${esc(name)}" min="${esc(s.min ?? 0)}" max="${esc(s.max ?? 100)}" step="${esc(s.step ?? 1)}" value="${esc(parseFloat(v ?? s.default ?? s.min ?? 0))}"><output>${esc(parseFloat(v ?? s.default ?? 0))}${esc(s.unit || '')}</output></div>`;
		}
		const keys = Object.keys(def.values || {});
		if (keys.length <= 4 && keys.join('').length <= 34)
			return `<div class="seg">${keys.map((k) => `<button data-cond="${esc(name)}" data-val="${esc(k)}" class="${k === v ? 'on' : ''}">${esc(k)}</button>`).join('')}</div>`;
		return `<select data-cond="${esc(name)}">${keys.map((k) => `<option${k === v ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select>`;
	};
	return `<h2>${esc(info.name || t.folder)}</h2><p class="lede">Changes apply right away.</p>${note}` +
		[...groups].map(([g, items]) => `<div class="group"><h3>${esc(g)}</h3>${items.map(([name, def]) =>
			`<div class="opt"><b>${esc(name)}</b>${def.description ? `<p>${esc(def.description)}</p>` : ''}<div class="ctl">${control(name, def)}</div></div>`).join('')}</div>`).join('');
}

function redesignsView(st, BS) {
	const list = st.plugins || [];
	const themeName = (f) => (st.themes || []).find((t) => t.folder.toLowerCase() === String(f).toLowerCase())?.name;
	const item = (p) => {
		const status = BS.loaded?.[p.id];
		const failed = p.enabled && status && status.startsWith('failed');
		const companion = p.theme && themeName(p.theme) && st.active?.toLowerCase() !== p.theme.toLowerCase()
			? `<button class="btn" data-theme="${esc(p.theme)}">Use its theme, ${esc(themeName(p.theme))}</button>` : '';
		return `<div class="row"><div><b>${esc(p.name)}</b> <span class="sub">${esc(p.author)}${p.version ? ' · v' + esc(p.version) : ''}</span>
			<p>${esc(p.description)}</p>${failed ? `<p class="bad">It could not start: ${esc(status.slice(8))}</p>` : ''}</div>
			${p.enabled ? companion : ''}<button class="toggle${p.enabled ? ' on' : ''}" data-plugin="${esc(p.id)}" aria-label="Turn ${esc(p.name)} ${p.enabled ? 'off' : 'on'}"></button></div>`;
	};
	return `<div class="about"><h2>Redesigns</h2><p class="lede">Redesigns replace Steam's interface with a new one. Turning one on or off reloads Steam's interface for a moment.</p>
		${list.length ? list.map(item).join('') : '<div class="row"><div><b>No redesigns yet</b><p>Put the folder of a redesign (one with a <code>plugin.json</code>) in the redesigns folder.</p></div></div>'}
		<div class="row"><div><b>Redesigns folder</b><p><code>${esc(st.pluginsDir || '')}</code></p></div><button class="btn" data-act="plugins">Open folder</button></div></div>`;
}

// "Get more": themes and redesigns from the Beyond Steam catalog, installed with one click.
function moreView(st, BS) {
	if (!ui.catalog) {
		ui.catalog = 'loading';
		fetch(BS.host + '/api/catalog', { cache: 'no-store' }).then((r) => r.json()).then((c) => { ui && (ui.catalog = c); render(BS); })
			.catch(() => { ui && (ui.catalog = { items: [], failed: true }); render(BS); });
	}
	if (ui.catalog === 'loading') return '<div class="empty">Loading the catalog…</div>';
	const c = ui.catalog;
	const items = (c.items || []).filter((i) => ui.kind === 'all' || i.kind === ui.kind);
	const chip = (k, label) => `<button class="chip${ui.kind === k ? ' on' : ''}" data-kind="${k}">${label}</button>`;
	const card = (i) => {
		const theme = i.kind === 'theme';
		const have = theme ? (st.themes || []).find((t) => t.folder.toLowerCase() === i.id.toLowerCase()) : (st.plugins || []).find((p) => p.id === i.id);
		const own = theme ? have?.own : !!have;
		const busy = ui.busy[i.id];
		const pic = i.preview ? `<img loading="lazy" decoding="async" src="${esc(/^https?:/.test(i.preview) ? i.preview : (c.base || '') + i.preview)}" alt="${esc(i.name)}">`
			: `<div class="ph" style="--h:${hue(i.name)}">${esc(i.name.slice(0, 1))}</div>`;
		let acts = '';
		if (busy) acts = `<button class="btn" disabled>${esc(busy)}</button>`;
		else if (!have) acts = `<button class="btn primary" data-install="${esc(i.id)}">Install</button>`;
		else {
			if (theme && st.active?.toLowerCase() !== i.id.toLowerCase()) acts += `<button class="btn" data-theme="${esc(have.folder)}">Use</button>`;
			if (theme && st.active?.toLowerCase() === i.id.toLowerCase()) acts += '<span class="tag">In use</span>';
			if (!theme) acts += `<button class="btn" data-plugin="${esc(i.id)}">${have.enabled ? 'Turn off' : 'Turn on'}</button>`;
			if (own) {
				acts += `<button class="btn" data-install="${esc(i.id)}">Update</button>`;
				acts += `<button class="btn quiet" data-remove="${esc(i.id)}" data-rkind="${theme ? 'theme' : 'redesign'}">${ui.confirm === i.id ? 'Click again to remove' : 'Remove'}</button>`;
			} else if (theme) acts += '<span class="tag" title="This copy is in Millennium\'s themes folder">Installed</span>';
		}
		return `<div class="card static"><div class="pv">${pic}<span class="kind">${theme ? 'Theme' : 'Redesign'}</span></div>
			<div class="meta"><b>${esc(i.name)}</b><small>${esc(i.author || '')}${i.version ? ' · v' + esc(i.version) : ''}</small>
			<p class="desc">${esc(i.description || '')}</p>${ui.errors[i.id] ? `<p class="bad">${esc(ui.errors[i.id])}</p>` : ''}<div class="acts">${acts}</div></div></div>`;
	};
	return `<div class="bar">${chip('all', 'Everything')}${chip('theme', 'Themes')}${chip('redesign', 'Redesigns')}<span class="spacer"></span>
		<span class="count">${c.offline ? 'Offline: showing the built-in list' : (c.items || []).length + ' in the catalog'}</span></div>
		${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : '<div class="empty">Nothing here yet.</div>'}`;
}

function aboutView(st) {
	return `<div class="about"><h2>Settings</h2>
		<div class="row"><div><b>Start with Windows</b><p>Beyond Steam waits in the tray and themes Steam whenever it starts.</p></div><button class="toggle" data-act="autostart" aria-label="Start with Windows"></button></div>
		<div class="row"><div><b>Themes folder</b><p>Drop a theme folder (one with a <code>skin.json</code>) in here and it appears under Themes.</p><p><code>${esc(st.themesDir || '')}</code></p></div><button class="btn" data-act="folder">Open folder</button></div>
		<div class="row"><div><b>Open this window</b><p>Use the Beyond Steam button in Steam's title bar, press <span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">B</span>, or click the tray icon.</p></div></div>
		<div class="row"><div><b>Log</b><p>What Beyond Steam has been doing, for troubleshooting.</p></div><button class="btn" data-act="log">Open log</button></div>
		<div class="row"><div><b>Beyond Steam ${esc(st.version || '')}</b><p>${(st.themes || []).length} themes found. Themes made for Millennium work as they are.</p></div></div></div>`;
}

async function appApi(body) {
	const r = await fetch(window.__BS.host + '/api/app', body ? { method: 'POST', body: JSON.stringify(body) } : { cache: 'no-store' });
	return r.json();
}

async function loadApp() {
	try {
		const a = await appApi();
		ui?.root.querySelector('[data-act=autostart]')?.classList.toggle('on', !!a.autostart);
	} catch {}
}

// True when picking this value (or leaving the current one) adds or removes a theme script.
function needsReload(st, name, value) {
	const values = st.theme?.data?.Conditions?.[name]?.values || {};
	return !!(values[value]?.TargetJs || values[st.conditions?.[name]]?.TargetJs);
}

async function onClick(BS, e) {
	const el = e.target.closest('button');
	if (!el) { if (e.target.classList?.contains('scrim')) close(); return; }
	if (el.dataset.tab) { ui.tab = el.dataset.tab; render(BS); return; }
	if (el.dataset.act === 'close') return close();
	if (el.dataset.act === 'folder') return appApi({ open: 'themes' });
	if (el.dataset.act === 'plugins') return appApi({ open: 'plugins' });
	if (el.dataset.plugin !== undefined) {
		const p = (BS.state?.plugins || []).find((x) => x.id === el.dataset.plugin);
		return BS.setPlugin(el.dataset.plugin, !(p?.enabled));
	}
	if (el.dataset.kind) { ui.kind = el.dataset.kind; render(BS); return; }
	if (el.dataset.install) {
		const id = el.dataset.install, item = (ui.catalog?.items || []).find((i) => i.id === id);
		ui.busy[id] = 'Downloading…'; delete ui.errors[id]; render(BS);
		try {
			const r = await (await fetch(BS.host + '/api/install', { method: 'POST', body: JSON.stringify({ id }) })).json();
			if (r.state) BS.state = r.state;
			if (!r.ok) ui.errors[id] = r.error || 'It could not be installed.';
			else if (item?.kind === 'redesign' && !(BS.state.plugins || []).find((p) => p.id === id)?.enabled) ui.errors[id] = 'Installed. Turn it on when you are ready.';
		} catch { ui.errors[id] = 'Beyond Steam did not answer.'; }
		delete ui.busy[id];
		window.dispatchEvent(new CustomEvent('beyondsteam-state', { detail: BS.state }));
		render(BS);
		return;
	}
	if (el.dataset.remove) {
		const id = el.dataset.remove;
		if (ui.confirm !== id) { ui.confirm = id; render(BS); setTimeout(() => { if (ui?.confirm === id) { ui.confirm = null; render(BS); } }, 3500); return; }
		ui.confirm = null;
		const r = await (await fetch(BS.host + '/api/remove', { method: 'POST', body: JSON.stringify({ id, kind: el.dataset.rkind }) })).json();
		if (r.state) BS.state = r.state;
		await BS.refresh();
		return;
	}
	if (el.dataset.act === 'log') return appApi({ open: 'log' });
	if (el.dataset.act === 'reload') return BS.restartUI('options');
	if (el.dataset.act === 'autostart') { const a = await appApi({ autostart: !el.classList.contains('on') }); el.classList.toggle('on', !!a.autostart); return; }
	if (el.dataset.theme !== undefined) {
		if (el.dataset.theme === (BS.state?.active || '')) return;
		ui.reloadNote = false;
		await BS.setTheme(el.dataset.theme); // reloads Steam's interface if the old theme ran scripts; this window reopens
		render(BS);
		return;
	}
	if (el.dataset.cond !== undefined && el.dataset.val !== undefined) {
		const reload = needsReload(BS.state, el.dataset.cond, el.dataset.val);
		await BS.setCondition(el.dataset.cond, el.dataset.val);
		if (reload) ui.reloadNote = true;
		render(BS);
	}
}

let sliderTimer = 0;
async function onInput(BS, e, committed) {
	const el = e.target;
	if (el.classList.contains('search')) { if (!committed) { ui.q = el.value; render(BS); } return; }
	const name = el.dataset.cond;
	if (name === undefined) return;
	if (el.type === 'range') {
		const unit = BS.state.theme?.data?.Conditions?.[name]?.slider?.unit || '';
		el.nextElementSibling.textContent = el.value + unit;
		clearTimeout(sliderTimer);
		sliderTimer = setTimeout(() => BS.setCondition(name, Number(el.value)), committed ? 0 : 120);
		return;
	}
	if (el.tagName === 'SELECT' && committed) {
		const reload = needsReload(BS.state, name, el.value);
		await BS.setCondition(name, el.value);
		if (reload) ui.reloadNote = true;
		render(BS);
	}
}
