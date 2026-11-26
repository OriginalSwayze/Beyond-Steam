// Writes catalog/stats.json: GitHub stars, install count (downloads of the release zip Beyond Steam installs from)
// and last update for every catalog item. Run daily by .github/workflows/stats.yml; locally with GITHUB_TOKEN set.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..');
const catalog = JSON.parse(readFileSync(join(root, 'catalog', 'catalog.json'), 'utf8').replace(/^﻿/, ''));
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'beyond-steam-stats' };
if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
const get = async (path) => {
	const r = await fetch('https://api.github.com' + path, { headers });
	if (!r.ok) throw new Error(path + ': ' + r.status);
	return r.json();
};

const items = {};
for (const item of catalog.items) {
	const repo = item.repo;
	if (!repo) continue;
	const asset = item.zip ? item.zip.split('/').pop() : null;
	try {
		const info = await get('/repos/' + repo);
		let downloads = 0;
		for (let page = 1; page < 10; page++) {
			const rel = await get(`/repos/${repo}/releases?per_page=100&page=${page}`);
			for (const r of rel) for (const a of r.assets) if (!asset || a.name === asset) downloads += a.download_count;
			if (rel.length < 100) break;
		}
		items[item.id] = { stars: info.stargazers_count, downloads, updated: info.pushed_at };
	} catch (e) {
		console.error('skipped', item.id, e.message);
	}
}
const out = { updated: new Date().toISOString(), items };
writeFileSync(join(root, 'catalog', 'stats.json'), JSON.stringify(out, null, 1) + '\n');
console.log('stats for', Object.keys(items).length, 'items');
