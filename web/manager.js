// Beyond Steam's window inside Steam: themes, theme options, personal touches, redesigns, the catalog, extras, settings.
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
.banners:empty { display: none; } .banners { padding: 14px 22px 0; } .banners .note { margin: 0 0 10px; } .note.warn { background: rgba(255,170,120,.12); box-shadow: inset 0 0 0 1px rgba(255,170,120,.4); }
.card[role=button] { cursor: pointer; } .card[role=button]:focus-visible { outline: 2px solid #8FE3D6; outline-offset: 2px; }
.star { position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 99px; background: rgba(10,12,18,.7); color: #C9D0DC; font-size: 16px; opacity: 0; transition: opacity .15s; }
.card:hover .star, .star.on, .star:focus-visible { opacity: 1; } .star.on { color: #FFD36E; }
.rank { position: absolute; bottom: 10px; left: 10px; padding: 2px 8px; border-radius: 6px; background: rgba(10,12,18,.82); color: #FFD36E; font: 700 13px 'Segoe UI', sans-serif; }
.pv .badge + .badge, .kind ~ .badge { left: auto; right: 10px; top: auto; bottom: 10px; background: #8D7DFF; color: #0A0C12; }
.nums { display: flex; gap: 12px; margin-top: 4px; color: #9AA3B5; font-size: 12px; font-variant-numeric: tabular-nums; }
.search.small { max-width: 220px; height: 34px; }
select[data-sort] { min-width: 160px; }
.link { color: #7FE0D3; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; } .link:hover { color: #A8F0E6; }
.lbl { display: block; margin: 12px 0 6px; font-size: 13px; font-weight: 600; color: #C9D0DC; }
textarea { width: 100%; min-height: 110px; padding: 10px 12px; border: 0; border-radius: 10px; background: #0E1117; color: #E8ECF4; font: 12.5px/1.5 Consolas, 'Cascadia Code', monospace; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); resize: vertical; }
input[type=color] { width: 44px; height: 32px; padding: 0; border: 0; border-radius: 8px; background: none; cursor: pointer; }
.row-in { display: flex; align-items: center; gap: 10px; }
.row.col { flex-direction: column; align-items: stretch; } .row.col > div:first-child { flex: none; }
.pair { display: flex; gap: 16px; flex-wrap: wrap; } .pair label, .wizard label { display: grid; gap: 6px; font-size: 13px; color: #9AA3B5; }
.wizard { display: flex; flex-wrap: wrap; align-items: end; gap: 14px; } .wizard input:not([type=color]) { height: 34px; width: 220px; padding: 0 10px; border: 0; border-radius: 8px; background: #0E1117; color: #E8ECF4; font: inherit; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
.wizard select { min-width: 160px; }
h3.sect { margin: 14px 0 0; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #6E788C; }
.extras { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .box { padding: 18px; border-radius: 12px; background: #161A22; } .box.wide { grid-column: 1 / -1; }
.box h3 { margin: 0 0 12px; font-size: 15px; } .box h4 { margin: 16px 0 4px; font-size: 13px; color: #C9D0DC; }
.picked { display: flex; gap: 14px; margin-top: 14px; } .picked img { width: 200px; border-radius: 8px; object-fit: cover; aspect-ratio: 460 / 215; } .picked .acts { margin-top: 10px; }
.pick > .btn { margin-top: 14px; }
.big { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; } .big b { font: 700 28px 'Segoe UI Variable Display', 'Segoe UI', sans-serif; } .big span { color: #8A93A6; font-size: 13px; }
.bars { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; } .bars li { display: grid; grid-template-columns: 200px 1fr 70px auto; align-items: center; gap: 10px; font-size: 13px; }
.bars .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; } .bars .nm:hover { color: #7FE0D3; }
.bars i { height: 8px; border-radius: 4px; background: linear-gradient(90deg, #6FE3D2, #8D7DFF); min-width: 2px; } .bars em { font-style: normal; color: #9AA3B5; text-align: right; font-variant-numeric: tabular-nums; }
.bars:not(.disk) li { grid-template-columns: 200px 1fr 70px; }
.btn.tiny { height: 26px; padding: 0 10px; font-size: 12px; }
.kbd { padding: 1px 6px; border-radius: 4px; background: #232836; font: 12px Consolas, monospace; }
`;


let ui = null; // { host, root, win, tab, ... }

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

const TABS = [['themes', 'Themes'], ['options', 'Theme options'], ['personalize', 'Personalize'], ['redesigns', 'Redesigns'], ['more', 'Get more'], ['extras', 'Extras'], ['about', 'Settings']];

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
		<nav>${TABS.map(([id, label]) => `<button data-tab="${id}">${label}</button>`).join('')}</nav>
		<span class="spacer"></span><button class="x" data-act="close" aria-label="Close">×</button></header>
		<div class="banners"></div><main></main></section></div>`;
	ui = { host, root, win, tab, q: '', reloadNote: false, catalog: null, kind: 'all', sort: 'installs', mq: '', busy: {}, errors: {}, confirm: null, extras: null, pick: null, wizard: null, msg: {} };
	ui.onKey = (e) => {
		if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
		if ((e.key === 'Enter' || e.key === ' ') && e.composedPath()[0]?.dataset?.theme !== undefined && e.composedPath()[0].tagName !== 'BUTTON') {
			e.preventDefault(); e.composedPath()[0].click();
		}
		if (root.activeElement || e.composedPath().includes(host)) e.stopPropagation(); // keep typing out of Steam's own shortcuts
	};
	ui.onState = () => render(BS);
	win.addEventListener('keydown', ui.onKey, true);
	window.addEventListener('beyondsteam-state', ui.onState);
	root.addEventListener('click', (e) => onClick(BS, e));
	root.addEventListener('input', (e) => onInput(BS, e));
	root.addEventListener('change', (e) => onInput(BS, e, true));
	root.addEventListener('error', (e) => { // a preview that fails to load becomes the drawn placeholder
		const img = e.target;
		if (img.tagName === 'IMG') img.replaceWith(Object.assign(doc.createElement('div'), { className: 'ph', textContent: (img.alt || '?').slice(0, 1).toUpperCase(), style: `--h:${hue(img.alt)}` }));
	}, true);
	render(BS);
	root.querySelector('.search')?.focus();
	return true;
}

function banners(BS) {
	const st = BS.state || {}, out = [];
	if (st.safe) out.push(`<div class="note warn"><span><b>Safe mode is on.</b> ${esc(st.safeReason || '')} Your theme and redesigns are switched off; your choices are kept.</span><button class="btn primary" data-act="unsafe">Turn safe mode off</button></div>`);
	if (st.update) out.push(`<div class="note"><span><b>Beyond Steam ${esc(st.update.version)} is available.</b> You have ${esc(st.version)}.</span>${ui.msg.update ? `<span class="sub">${esc(ui.msg.update)}</span>` : ''}<button class="btn primary" data-act="update">Update now</button></div>`);
	return out.join('');
}

function render(BS) {
	if (!ui) return;
	const st = BS.state || {};
	ui.root.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
	ui.root.querySelector('.banners').innerHTML = banners(BS);
	const main = ui.root.querySelector('main');
	const keepScroll = main.dataset.tab === ui.tab ? main.scrollTop : 0;
	const active = ui.root.activeElement;
	const focusKey = active?.dataset?.focus;
	const caret = active && 'selectionStart' in active ? active.selectionStart : null;
	const views = { themes: themesView, options: optionsView, personalize: personalizeView, redesigns: redesignsView, more: moreView, extras: extrasView, about: aboutView };
	main.innerHTML = (views[ui.tab] || themesView)(st, BS);
	main.dataset.tab = ui.tab;
	main.scrollTop = keepScroll;
	if (focusKey) { // keep typing where you were after a redraw
		const el = ui.root.querySelector(`[data-focus="${focusKey}"]`);
		if (el) { el.focus(); if (caret !== null) try { el.setSelectionRange(caret, caret); } catch {} }
	}
	if (ui.tab === 'about') loadApp(BS);
}

// ---------- Themes ----------

function themesView(st) {
	const q = ui.q.trim().toLowerCase();
	const favs = new Set(st.prefs?.favorites || []);
	const all = [...(st.themes || [])].sort((a, b) => favs.has(b.folder) - favs.has(a.folder));
	const shown = all.filter((t) => !q || [t.name, t.author, t.description, ...(t.tags || [])].join(' ').toLowerCase().includes(q));
	const card = (t) => {
		const on = t.folder === st.active, fav = favs.has(t.folder);
		const pic = t.preview ? `<img loading="lazy" decoding="async" src="${esc(t.preview)}" alt="${esc(t.name)}">` : `<div class="ph" style="--h:${hue(t.name)}">${esc(t.name.slice(0, 1).toUpperCase())}</div>`;
		return `<div class="card${on ? ' on' : ''}" role="button" tabindex="0" data-theme="${esc(t.folder)}" title="${esc(t.description)}">
			<div class="pv">${pic}${on ? '<span class="badge">Active</span>' : ''}<button class="star${fav ? ' on' : ''}" data-fav="${esc(t.folder)}" aria-label="${fav ? 'Remove from' : 'Add to'} favourites" title="${fav ? 'Favourite (Ctrl+Shift+T cycles favourites)' : 'Add to favourites'}">${fav ? '★' : '☆'}</button></div>
			<div class="meta"><b>${esc(t.name)}</b><small>${esc(t.author || 'Unknown author')}${t.version ? ' · v' + esc(t.version) : ''}${t.options ? ' · <i>options</i>' : ''}</small></div></div>`;
	};
	const stock = !q ? `<div class="card${!st.active ? ' on' : ''}" role="button" tabindex="0" data-theme=""><div class="pv"><div class="ph stock">Steam's own look</div>${!st.active ? '<span class="badge">Active</span>' : ''}</div>
		<div class="meta"><b>No theme</b><small>Steam as Valve made it</small></div></div>` : '';
	return `<div class="bar"><input class="search" data-focus="q" type="search" placeholder="Search themes" value="${esc(ui.q)}" spellcheck="false">
		<span class="count">${shown.length} of ${all.length} themes${favs.size ? ` · ${favs.size} favourite${favs.size > 1 ? 's' : ''}` : ''}</span><span class="spacer"></span>
		<button class="btn" data-tab="more">Get more themes</button><button class="btn quiet" data-act="folder">Open folder</button></div>
		${shown.length || stock ? `<div class="grid">${stock}${shown.map(card).join('')}</div>` : `<div class="empty">No theme matches “${esc(ui.q)}”.</div>`}`;
}

// ---------- Theme options ----------

function optionsView(st) {
	const t = st.theme;
	if (!t) return `<div class="empty">No theme is active. Pick one under Themes.</div>`;
	const info = (st.themes || []).find((x) => x.folder === st.active) || {};
	const conds = Object.entries(t.data.Conditions || {});
	const note = ui.reloadNote ? `<div class="note"><span>This change runs a script, so it takes effect after Steam reloads its interface (a couple of seconds).</span><button class="btn primary" data-act="reload">Reload now</button></div>` : '';
	const tip = `<p class="lede">Changes apply right away. For your own colours, fonts and CSS on top of any theme, see <button class="link" data-tab="personalize">Personalize</button>.</p>`;
	if (!conds.length) return `<h2>${esc(info.name || t.folder)}</h2><p class="lede">This theme has no options of its own.</p>${tip}`;
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
	return `<h2>${esc(info.name || t.folder)}</h2>${tip}${note}` +
		[...groups].map(([g, items]) => `<div class="group"><h3>${esc(g)}</h3>${items.map(([name, def]) =>
			`<div class="opt"><b>${esc(name)}</b>${def.description ? `<p>${esc(def.description)}</p>` : ''}<div class="ctl">${control(name, def)}</div></div>`).join('')}</div>`).join('');
}

// ---------- Personalize ----------

const FONTS = ['Segoe UI', 'Segoe UI Variable Display', 'Bahnschrift', 'Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Calibri', 'Candara', 'Georgia', 'Cambria', 'Consolas', 'Cascadia Code', 'Comic Sans MS'];

function personalizeView(st, BS) {
	const p = st.prefs || {};
	const tweaks = BS.tweaks || [];
	const zoom = Math.round((p.zoom || 1) * 100);
	const themeName = (st.themes || []).find((t) => t.folder === st.active)?.name;
	return `<div class="about"><h2>Personalize</h2><p class="lede">Your own touches, on top of whatever theme is on. They stay when you switch themes.</p>
		<div class="group"><h3>Look</h3>
		<div class="opt"><b>Accent colour</b><p>Recolours Steam and the themes that follow the system accent colour.</p>
			<div class="ctl row-in"><input type="color" data-pref="accent" value="${esc(p.accent || st.accent || '#1A9FFF')}">${p.accent ? '<button class="btn quiet" data-clear="accent">Reset</button>' : ''}</div></div>
		<div class="opt"><b>Font</b><p>Replaces the font everywhere in Steam.</p>
			<div class="ctl"><select data-pref="font"><option value="">The theme's own font</option>${FONTS.map((f) => `<option${p.font === f ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select></div></div>
		<div class="opt"><b>Zoom</b><p>Makes everything in Steam's main window bigger or smaller.</p>
			<div class="ctl range"><input type="range" data-pref="zoom" min="80" max="150" step="5" value="${zoom}"><output>${zoom}%</output></div></div></div>
		<div class="group"><h3>Tweaks</h3>${tweaks.map((t) => `<div class="opt"><b>${esc(t.name)}</b><p>${esc(t.description)}</p>
			<div class="ctl"><button class="toggle${p.tweaks?.[t.id] ? ' on' : ''}" data-tweak="${esc(t.id)}" aria-label="${esc(t.name)}"></button></div></div>`).join('')}</div>
		<div class="group"><h3>Your CSS</h3>
		<p class="sub">Applied in every Steam window, after the theme. Tip: the Inspector in Settings shows the class names to use.</p>
		<label class="lbl">For every theme</label><textarea data-css="global" data-focus="css-global" spellcheck="false" placeholder=".BottomBarContainer { opacity: .6; }">${esc(p.css?.global || '')}</textarea>
		${st.active ? `<label class="lbl">Only with ${esc(themeName || st.active)}</label><textarea data-css="theme" data-focus="css-theme" spellcheck="false">${esc(p.css?.themes?.[st.active] || '')}</textarea>` : ''}
		</div></div>`;
}

// ---------- Redesigns ----------

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
		${list.length ? list.map(item).join('') : '<div class="row"><div><b>No redesigns yet</b><p>Find them under <button class="link" data-tab="more">Get more</button>.</p></div></div>'}
		<div class="row"><div><b>Redesigns folder</b><p><code>${esc(st.pluginsDir || '')}</code></p><p>Making one? See the <button class="link" data-act="sdk">redesign guide</button>.</p></div><button class="btn" data-act="plugins">Open folder</button></div></div>`;
}

// ---------- Get more ----------

const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n || 0));
const ago = (iso) => {
	const d = (Date.now() - Date.parse(iso)) / 86400000;
	return !iso || isNaN(d) ? '' : d < 1 ? 'today' : d < 2 ? 'yesterday' : d < 30 ? Math.floor(d) + ' days ago' : d < 365 ? Math.floor(d / 30) + ' months ago' : Math.floor(d / 365) + ' years ago';
};

function installedOf(st, i) {
	return i.kind === 'theme' ? (st.themes || []).find((t) => t.folder.toLowerCase() === i.id.toLowerCase()) : (st.plugins || []).find((p) => p.id === i.id);
}

function moreView(st, BS) {
	if (!ui.catalog) {
		ui.catalog = 'loading';
		fetch(BS.host + '/api/catalog', { cache: 'no-store' }).then((r) => r.json()).then((c) => { ui && (ui.catalog = c); render(BS); })
			.catch(() => { ui && (ui.catalog = { items: [], failed: true }); render(BS); });
	}
	if (ui.catalog === 'loading') return '<div class="empty">Loading the catalog…</div>';
	const c = ui.catalog, stats = c.stats?.items || {};
	const s = (i) => stats[i.id] || {};
	const q = ui.mq.trim().toLowerCase();
	let items = (c.items || []).filter((i) => (ui.kind === 'all' || i.kind === ui.kind) && (!q || [i.name, i.author, i.description].join(' ').toLowerCase().includes(q)));
	const by = {
		installs: (a, b) => (s(b).downloads || 0) - (s(a).downloads || 0) || (s(b).stars || 0) - (s(a).stars || 0) || a.name.localeCompare(b.name),
		stars: (a, b) => (s(b).stars || 0) - (s(a).stars || 0) || (s(b).downloads || 0) - (s(a).downloads || 0) || a.name.localeCompare(b.name),
		updated: (a, b) => Date.parse(s(b).updated || 0) - Date.parse(s(a).updated || 0),
		name: (a, b) => a.name.localeCompare(b.name),
	};
	items = [...items].sort(by[ui.sort] || by.installs);
	const updatable = (c.items || []).filter((i) => { const h = installedOf(st, i); return h && (i.kind !== 'theme' || h.own) && i.version && h.version && i.version !== h.version; });
	const chip = (k, label) => `<button class="chip${ui.kind === k ? ' on' : ''}" data-kind="${k}">${label}</button>`;
	const ranked = ui.sort === 'installs' || ui.sort === 'stars';
	const card = (i, n) => {
		const theme = i.kind === 'theme';
		const have = installedOf(st, i);
		const own = theme ? have?.own : !!have;
		const newer = have && own && i.version && have.version && i.version !== have.version;
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
				acts += `<button class="btn${newer ? ' primary' : ''}" data-install="${esc(i.id)}">${newer ? 'Update to ' + esc(i.version) : 'Reinstall'}</button>`;
				acts += `<button class="btn quiet" data-remove="${esc(i.id)}" data-rkind="${theme ? 'theme' : 'redesign'}">${ui.confirm === i.id ? 'Click again to remove' : 'Remove'}</button>`;
			} else if (theme) acts += '<span class="tag" title="This copy is in Millennium\'s themes folder">Installed</span>';
		}
		const st2 = s(i);
		const numbers = [`<span title="Installs through Beyond Steam">↓ ${fmt(st2.downloads)}</span>`, `<span title="Stars on GitHub">★ ${fmt(st2.stars)}</span>`, st2.updated ? `<span title="Last updated">${esc(ago(st2.updated))}</span>` : ''].join('');
		return `<div class="card static"><div class="pv">${pic}<span class="kind">${theme ? 'Theme' : 'Redesign'}</span>${ranked ? `<span class="rank">#${n + 1}</span>` : ''}${newer ? '<span class="badge">Update</span>' : ''}</div>
			<div class="meta"><b>${esc(i.name)}</b><small>${esc(i.author || '')}${i.version ? ' · v' + esc(i.version) : ''}</small><div class="nums">${numbers}</div>
			<p class="desc">${esc(i.description || '')}</p>${ui.errors[i.id] ? `<p class="bad">${esc(ui.errors[i.id])}</p>` : ''}
			<div class="acts">${acts}${i.repo ? `<button class="btn quiet" data-open="https://github.com/${esc(i.repo)}" title="Open on GitHub (to star it)">GitHub</button>` : ''}</div></div></div>`;
	};
	return `<div class="bar">${chip('all', 'Everything')}${chip('theme', 'Themes')}${chip('redesign', 'Redesigns')}
		<input class="search small" data-focus="mq" type="search" placeholder="Search" value="${esc(ui.mq)}" spellcheck="false">
		<select data-sort><option value="installs"${ui.sort === 'installs' ? ' selected' : ''}>Most installed</option><option value="stars"${ui.sort === 'stars' ? ' selected' : ''}>Most stars</option>
		<option value="updated"${ui.sort === 'updated' ? ' selected' : ''}>Recently updated</option><option value="name"${ui.sort === 'name' ? ' selected' : ''}>Name</option></select>
		<span class="spacer"></span>${updatable.length ? `<button class="btn primary" data-act="update-all">Update all (${updatable.length})</button>` : ''}</div>
		<p class="sub">${c.offline ? 'Offline: showing the list built into Beyond Steam.' : `${(c.items || []).length} in the catalog. Installs and stars refresh daily${c.stats?.updated ? ' (last ' + esc(ago(c.stats.updated)) + ')' : ''}. Want yours listed? See the <button class="link" data-open="https://github.com/OriginalSwayze/Beyond-Steam/blob/main/catalog/README.md">submission guide</button>.`}</p>
		${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : '<div class="empty">Nothing matches.</div>'}`;
}

// ---------- Extras ----------

function games() {
	const apps = (window.appStore?.allApps || []).filter((a) => a.app_type === 1 && a.visible_in_game_list !== false);
	return apps.map((a) => ({
		id: a.appid, name: a.display_name, minutes: a.minutes_playtime_forever || 0, recent: a.minutes_playtime_last_two_weeks || 0,
		installed: !!(a.local_per_client_data?.installed || a.per_client_data?.some?.((c) => c.installed && c.clientid === '0')),
		size: Number(a.size_on_disk || 0), last: a.rt_last_time_played || 0,
	}));
}
const hours = (m) => (m >= 600 ? Math.round(m / 60) : (m / 60).toFixed(1)) + ' h';
const gb = (b) => (b >= 1e12 ? (b / 1e12).toFixed(2) + ' TB' : b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.max(0.1, b / 1e6).toFixed(0) + ' MB');
const art = (id) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;

function extrasView() {
	const all = games();
	if (!all.length) return '<div class="empty">Steam\'s library isn\'t loaded yet. Try again in a moment.</div>';
	ui.extras ??= { scope: 'installed' };
	const total = all.reduce((n, g) => n + g.minutes, 0), played = all.filter((g) => g.minutes > 0).length;
	const top = [...all].sort((a, b) => b.minutes - a.minutes).slice(0, 10), topMax = top[0]?.minutes || 1;
	const recent = all.filter((g) => g.recent > 0).sort((a, b) => b.recent - a.recent).slice(0, 6);
	const disk = all.filter((g) => g.installed && g.size > 0).sort((a, b) => b.size - a.size), diskTotal = disk.reduce((n, g) => n + g.size, 0), diskMax = disk[0]?.size || 1;
	const p = ui.pick;
	const scopes = [['installed', 'Installed'], ['unplayed', 'Never played'], ['all', 'Whole library']];
	return `<div class="extras">
		<section class="box pick"><h3>Can't decide what to play?</h3>
			<div class="seg">${scopes.map(([k, l]) => `<button data-scope="${k}" class="${ui.extras.scope === k ? 'on' : ''}">${l}</button>`).join('')}</div>
			${p ? `<div class="picked"><img src="${art(p.id)}" alt="${esc(p.name)}"><div><b>${esc(p.name)}</b><p class="sub">${p.minutes ? hours(p.minutes) + ' played' : 'Never played'}${p.installed ? ' · installed' : ''}</p>
				<div class="acts"><button class="btn primary" data-steam="steam://rungameid/${p.id}">${p.installed ? 'Play' : 'Install'}</button><button class="btn" data-steam="steam://nav/games/details/${p.id}">Open in library</button><button class="btn quiet" data-act="pick">Another</button></div></div></div>`
				: '<p class="sub">Picks a random game for you.</p>'}
			${p ? '' : '<button class="btn primary" data-act="pick">Pick a game</button>'}</section>
		<section class="box"><h3>Playtime</h3><div class="big"><b>${hours(total)}</b><span>across ${played} of ${all.length} games · ${all.length - played} never played</span></div>
			<ol class="bars">${top.map((g) => `<li><span class="nm" data-steam="steam://nav/games/details/${g.id}">${esc(g.name)}</span><i style="width:${(g.minutes / topMax) * 100}%"></i><em>${hours(g.minutes)}</em></li>`).join('')}</ol>
			${recent.length ? `<h4>Last two weeks</h4><p class="sub">${recent.map((g) => `${esc(g.name)} (${hours(g.recent)})`).join(' · ')}</p>` : ''}</section>
		<section class="box wide"><h3>Disk space</h3><div class="big"><b>${gb(diskTotal)}</b><span>in ${disk.length} installed games</span></div>
			<ol class="bars disk">${disk.slice(0, 25).map((g) => `<li><span class="nm" data-steam="steam://nav/games/details/${g.id}">${esc(g.name)}</span><i style="width:${(g.size / diskMax) * 100}%"></i><em>${gb(g.size)}</em>
				<button class="btn quiet tiny" data-uninstall="${g.id}">${ui.confirm === 'u' + g.id ? 'Click again' : 'Uninstall'}</button></li>`).join('')}</ol></section>
	</div>`;
}

// ---------- Settings ----------

function aboutView(st) {
	const p = st.prefs || {}, s = p.schedule || {};
	const themes = st.themes || [];
	const opts = (sel) => `<option value="">Choose a theme</option>${themes.map((t) => `<option value="${esc(t.folder)}"${sel === t.folder ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}`;
	const w = ui.wizard;
	return `<div class="about"><h2>Settings</h2>
		<div class="row"><div><b>Start with Windows</b><p>Beyond Steam waits in the tray and themes Steam whenever it starts.</p></div><button class="toggle" data-act="autostart" aria-label="Start with Windows"></button></div>
		<div class="row col"><div><b>Theme schedule</b><p>Switch themes by themselves.</p></div>
			<div class="seg">${[['off', 'Off'], ['windows', 'Follow Windows light/dark'], ['random', 'Random favourite at each start']].map(([k, l]) => `<button data-schedule="${k}" class="${(s.mode || 'off') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
			${s.mode === 'windows' ? `<div class="pair"><label>Light mode<select data-sched="light">${opts(s.light)}</select></label><label>Dark mode<select data-sched="dark">${opts(s.dark)}</select></label></div>` : ''}
			${s.mode === 'random' ? `<p class="sub">${(p.favorites || []).length < 2 ? 'Star at least two themes under Themes first.' : `Picks one of your ${(p.favorites || []).length} favourites each time Steam starts.`}</p>` : ''}</div>
		<div class="row"><div><b>Safe mode</b><p>Switches your theme and redesigns off without forgetting them, for when something breaks Steam. Panic key: <span class="kbd">Ctrl</span> + <span class="kbd">Shift</span> + <span class="kbd">Alt</span> + <span class="kbd">B</span>. Beyond Steam also turns it on by itself if Steam's interface keeps restarting.</p></div>
			<button class="toggle${st.safe ? ' on' : ''}" data-act="safe" aria-label="Safe mode"></button></div>
		<div class="row"><div><b>Backup</b><p>Everything you've set up (theme choices, options, favourites, tweaks, your CSS) in one file.</p>${ui.msg.backup ? `<p class="tag">${esc(ui.msg.backup)}</p>` : ''}</div>
			<button class="btn" data-act="export">Save backup…</button><button class="btn quiet" data-act="import">Restore…</button></div>
		<div class="row"><div><b>Updates</b><p>${st.update ? `Version ${esc(st.update.version)} is available.` : `You're on ${esc(st.version)}. Beyond Steam checks for new versions by itself.`}${st.dev ? ' (Developer build: updates are off.)' : ''}</p></div>
			${st.update ? '<button class="btn primary" data-act="update">Update now</button>' : `<button class="btn quiet" data-open="https://github.com/OriginalSwayze/Beyond-Steam/releases">Release notes</button>`}</div>
		<h3 class="sect">For theme makers</h3>
		<div class="row"><div><b>Live reload</b><p>Save a file of the active theme and Steam updates straight away (theme scripts still need <button class="link" data-act="reload">a reload</button>).</p></div>
			<button class="toggle${p.liveReload ? ' on' : ''}" data-act="live" aria-label="Live reload"></button></div>
		<div class="row"><div><b>Inspector</b><p>Point at anything in Steam to see its class names; click to copy a selector. Esc stops it.</p></div><button class="btn" data-act="inspect">Start inspecting</button></div>
		<div class="row col"><div><b>New theme</b><p>Starts a theme folder with your colours and font, switches to it and opens the folder.</p></div>
			${w ? `<div class="wizard"><label>Name<input data-w="name" data-focus="w-name" value="${esc(w.name)}" placeholder="My theme"></label>
				${[['background', 'Background'], ['panel', 'Panels'], ['text', 'Text'], ['accent', 'Accent']].map(([k, l]) => `<label>${l}<input type="color" data-w="${k}" value="${esc(w[k])}"></label>`).join('')}
				<label>Font<select data-w="font">${FONTS.map((f) => `<option${w.font === f ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
				<button class="btn primary" data-act="create">Create theme</button>${ui.msg.wizard ? `<p class="bad">${esc(ui.msg.wizard)}</p>` : ''}</div>`
				: '<button class="btn" data-act="wizard">Start a new theme</button>'}</div>
		<h3 class="sect">About</h3>
		<div class="row"><div><b>Shortcuts</b><p><span class="kbd">Ctrl</span>+<span class="kbd">Shift</span>+<span class="kbd">B</span> this window · <span class="kbd">Ctrl</span>+<span class="kbd">Shift</span>+<span class="kbd">T</span> next favourite theme · <span class="kbd">Ctrl</span>+<span class="kbd">Shift</span>+<span class="kbd">Alt</span>+<span class="kbd">B</span> safe mode</p></div></div>
		<div class="row"><div><b>Folders and log</b><p><code>${esc(st.themesDir || '')}</code></p></div><button class="btn" data-act="folder">Themes</button><button class="btn quiet" data-act="log">Log</button></div>
		<div class="row"><div><b>Beyond Steam ${esc(st.version || '')}</b><p>${themes.length} themes found. Themes made for Millennium work as they are.</p></div><button class="btn quiet" data-open="https://github.com/OriginalSwayze/Beyond-Steam">GitHub</button></div></div>`;
}

async function appApi(BS, body) {
	const r = await fetch(BS.host + '/api/app', body ? { method: 'POST', body: JSON.stringify(body) } : { cache: 'no-store' });
	return r.json();
}

async function loadApp(BS) {
	try {
		const a = await appApi(BS);
		ui?.root.querySelector('[data-act=autostart]')?.classList.toggle('on', !!a.autostart);
	} catch {}
}

// True when picking this value (or leaving the current one) adds or removes a theme script.
function needsReload(st, name, value) {
	const values = st.theme?.data?.Conditions?.[name]?.values || {};
	return !!(values[value]?.TargetJs || values[st.conditions?.[name]]?.TargetJs);
}

const steamUrl = (url) => { try { SteamClient.URL.ExecuteSteamURL(url); } catch { window.open(url); } };
const openWeb = (url) => { try { SteamClient.System.OpenInSystemBrowser(url); } catch { steamUrl('steam://openurl/' + url); } };

async function install(BS, id) {
	ui.busy[id] = 'Downloading…'; delete ui.errors[id]; render(BS);
	try {
		const r = await (await fetch(BS.host + '/api/install', { method: 'POST', body: JSON.stringify({ id }) })).json();
		if (r.state) BS.state = r.state;
		if (!r.ok) ui.errors[id] = r.error || 'It could not be installed.';
	} catch { ui.errors[id] = 'Beyond Steam did not answer.'; }
	delete ui.busy[id];
}

async function onClick(BS, e) {
	const el = e.target.closest('button, [data-theme], [data-steam]');
	if (!el) { if (e.target.classList?.contains('scrim')) close(); return; }
	const d = el.dataset, st = BS.state;
	if (d.tab) { ui.tab = d.tab; render(BS); return; }
	if (d.act === 'close') return close();
	if (d.fav) {
		e.stopPropagation();
		const favs = new Set(st.prefs?.favorites || []);
		favs.has(d.fav) ? favs.delete(d.fav) : favs.add(d.fav);
		return BS.setPrefs({ favorites: [...favs] });
	}
	if (d.act === 'folder') return appApi(BS, { open: 'themes' });
	if (d.act === 'plugins') return appApi(BS, { open: 'plugins' });
	if (d.act === 'log') return appApi(BS, { open: 'log' });
	if (d.act === 'reload') return BS.restartUI(ui.tab);
	if (d.act === 'unsafe') return BS.safe(false);
	if (d.act === 'safe') return BS.safe(!st.safe, 'You turned on safe mode.');
	if (d.act === 'sdk') return openWeb('https://github.com/OriginalSwayze/Beyond-Steam/blob/main/docs/REDESIGNS.md');
	if (d.open) return openWeb(d.open);
	if (d.steam) return steamUrl(d.steam);
	if (d.act === 'update') {
		ui.msg.update = 'Downloading…'; render(BS);
		const r = await (await fetch(BS.host + '/api/update', { method: 'POST', body: '{}' })).json();
		ui.msg.update = r.ok ? 'Installing; Beyond Steam restarts in a moment.' : r.error;
		return render(BS);
	}
	if (d.act === 'autostart') { const a = await appApi(BS, { autostart: !el.classList.contains('on') }); el.classList.toggle('on', !!a.autostart); return; }
	if (d.act === 'live') return BS.setPrefs({ liveReload: !st.prefs?.liveReload });
	if (d.act === 'inspect') { close(); return BS.inspect(true); }
	if (d.act === 'export' || d.act === 'import') {
		ui.msg.backup = d.act === 'export' ? 'Choose where to save it (the dialog may open behind Steam).' : 'Choose the backup file (the dialog may open behind Steam).';
		render(BS);
		const r = await (await fetch(BS.host + '/api/backup', { method: 'POST', body: JSON.stringify({ action: d.act }) })).json();
		ui.msg.backup = r.cancelled ? '' : r.ok ? (d.act === 'export' ? 'Saved to ' + r.path : 'Restored. Steam is reloading.') : r.error;
		return render(BS);
	}
	if (d.act === 'wizard') { ui.wizard = { name: '', background: '#12141A', panel: '#1B1F28', text: '#E8ECF4', accent: '#6FE3D2', font: 'Segoe UI' }; return render(BS); }
	if (d.act === 'create') {
		const r = await (await fetch(BS.host + '/api/newtheme', { method: 'POST', body: JSON.stringify(ui.wizard) })).json();
		if (!r.ok) { ui.msg.wizard = r.error; return render(BS); }
		ui.wizard = null; ui.msg.wizard = '';
		BS.state = r.state;
		await BS.setPrefs({ liveReload: true });
		return BS.setTheme(r.folder);
	}
	if (d.schedule) return BS.setPrefs({ schedule: { mode: d.schedule } });
	if (d.tweak) return BS.setPrefs({ tweaks: { [d.tweak]: !st.prefs?.tweaks?.[d.tweak] } });
	if (d.clear) return BS.setPrefs({ [d.clear]: null });
	if (d.scope) { ui.extras.scope = d.scope; ui.pick = null; return render(BS); }
	if (d.act === 'pick') {
		const pool = games().filter((g) => ui.extras.scope === 'installed' ? g.installed : ui.extras.scope === 'unplayed' ? g.minutes === 0 : true);
		ui.pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
		return render(BS);
	}
	if (d.uninstall) {
		const key = 'u' + d.uninstall;
		if (ui.confirm !== key) { ui.confirm = key; render(BS); setTimeout(() => { if (ui?.confirm === key) { ui.confirm = null; render(BS); } }, 3500); return; }
		ui.confirm = null;
		return steamUrl('steam://uninstall/' + d.uninstall);
	}
	if (d.plugin !== undefined) {
		const p = (st.plugins || []).find((x) => x.id === d.plugin);
		return BS.setPlugin(d.plugin, !(p?.enabled));
	}
	if (d.kind) { ui.kind = d.kind; render(BS); return; }
	if (d.install) {
		await install(BS, d.install);
		window.dispatchEvent(new CustomEvent('beyondsteam-state', { detail: BS.state }));
		return render(BS);
	}
	if (d.act === 'update-all') {
		const c = ui.catalog;
		for (const i of c.items || []) {
			const h = installedOf(BS.state, i);
			if (h && (i.kind !== 'theme' || h.own) && i.version && h.version && i.version !== h.version) await install(BS, i.id);
		}
		await BS.refresh();
		return;
	}
	if (d.remove) {
		const id = d.remove;
		if (ui.confirm !== id) { ui.confirm = id; render(BS); setTimeout(() => { if (ui?.confirm === id) { ui.confirm = null; render(BS); } }, 3500); return; }
		ui.confirm = null;
		const r = await (await fetch(BS.host + '/api/remove', { method: 'POST', body: JSON.stringify({ id, kind: d.rkind }) })).json();
		if (r.state) BS.state = r.state;
		await BS.refresh();
		return;
	}
	if (d.theme !== undefined) {
		if (d.theme === (st?.active || '')) return;
		ui.reloadNote = false;
		await BS.setTheme(d.theme); // reloads Steam's interface if the old theme ran scripts; this window reopens
		render(BS);
		return;
	}
	if (d.cond !== undefined && d.val !== undefined) {
		const reload = needsReload(st, d.cond, d.val);
		await BS.setCondition(d.cond, d.val);
		if (reload) ui.reloadNote = true;
		render(BS);
	}
}

let timer = 0;
const later = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

async function onInput(BS, e, committed) {
	const el = e.target, d = el.dataset;
	if (el.classList.contains('search')) {
		if (committed) return;
		if (d.focus === 'mq') ui.mq = el.value; else ui.q = el.value;
		return render(BS);
	}
	if (d.sort !== undefined && committed) { ui.sort = el.value; return render(BS); }
	if (d.pref === 'accent') return later(() => BS.setPrefs({ accent: el.value }), 150);
	if (d.pref === 'font' && committed) return BS.setPrefs({ font: el.value || null });
	if (d.pref === 'zoom') { el.nextElementSibling.textContent = el.value + '%'; return later(() => BS.setPrefs({ zoom: Number(el.value) / 100 }), committed ? 0 : 250); }
	if (d.css) {
		const patch = d.css === 'global' ? { css: { global: el.value } } : { css: { themes: { [BS.state.active]: el.value } } };
		return later(() => BS.setPrefs(patch), 450);
	}
	if (d.sched && committed) return BS.setPrefs({ schedule: { [d.sched]: el.value } });
	if (d.w) { ui.wizard[d.w] = el.value; return; }
	const name = d.cond;
	if (name === undefined) return;
	if (el.type === 'range') {
		const unit = BS.state.theme?.data?.Conditions?.[name]?.slider?.unit || '';
		el.nextElementSibling.textContent = el.value + unit;
		return later(() => BS.setCondition(name, Number(el.value)), committed ? 0 : 120);
	}
	if (el.tagName === 'SELECT' && committed) {
		const reload = needsReload(BS.state, name, el.value);
		await BS.setCondition(name, el.value);
		if (reload) ui.reloadNote = true;
		render(BS);
	}
}
