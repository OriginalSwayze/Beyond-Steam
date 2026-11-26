// Maintainer script: packages each published theme for Beyond Steam.
//   - README: install section for Beyond Steam (and Millennium by hand), options wording, pushed.
//   - Release: <Repo>.zip (the theme without its media/ demo GIFs) attached to the latest release, or a new
//     v<version> release. Beyond Steam installs from releases/latest/download/<Repo>.zip, so GitHub counts installs.
// Run: node tools/release-themes.mjs [--dry]   (needs git and gh, signed in as the theme owner)
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DRY = process.argv.includes('--dry');
const OWNER = 'OriginalSwayze';
const root = join(import.meta.dirname, '..');
const sib = join(root, '..');
const steamThemes = 'C:/Program Files (x86)/Steam/millennium/themes';
const tmp = join(root, 'build', 'theme-zips');
mkdirSync(tmp, { recursive: true });
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const dirs = [];
for (const name of run('cmd', ['/c', 'dir', '/b', '/ad', steamThemes.replace(/\//g, '\\')]).split(/\r?\n/)) dirs.push(join(steamThemes, name));
dirs.push(join(sib, 'Playbox-Theme'));

function installSection(name, folder, repo) {
	return `## Install

- **With [Beyond Steam](https://github.com/OriginalSwayze/Beyond-Steam) (easiest):** in Steam press **Ctrl+Shift+B**, open
  **Get more** and install **${name}**.
- **By hand:** download **${repo}.zip** from the [latest release](https://github.com/${OWNER}/${repo}/releases/latest) and unzip
  it into \`%APPDATA%\\Beyond Steam\\themes\\${folder}\` (Beyond Steam) or \`Steam\\millennium\\themes\\${folder}\` (Millennium).

`;
}

for (const dir of dirs) {
	const skinPath = join(dir, 'skin.json');
	if (!existsSync(skinPath)) continue;
	const skin = JSON.parse(readFileSync(skinPath, 'utf8'));
	if (skin.github?.owner !== OWNER) continue;
	const repo = skin.github.repo_name, name = skin.name, folder = repo === 'Playbox-Theme' ? 'Kestrel' : dir.split(/[\\/]/).pop();
	const version = String(skin.version || '1.0.0');

	// README
	const readmePath = join(dir, 'README.md');
	let md = readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
	const before = md;
	md = md.replace(/## Install\n[\s\S]*?(?=\n## )/, installSection(name, folder, repo).trimEnd() + '\n');
	md = md.replace(/ A \[Millennium\]\(https:\/\/steambrew\.app\) theme for the Steam client\./,
		' A Steam client theme for [Beyond Steam](https://github.com/OriginalSwayze/Beyond-Steam) and [Millennium](https://steambrew.app).');
	md = md.replace(/Open \*\*Millennium → Themes → ([^*]+)\*\* to change:/, "In Beyond Steam's **Theme options** tab (or **Millennium → Themes → $1**) you can change:");
	if (md !== before) {
		if (!DRY) {
			writeFileSync(readmePath, md);
			run('git', ['add', 'README.md'], dir);
			run('git', ['commit', '-q', '-m', 'README: install with Beyond Steam; release zip\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'], dir);
			run('git', ['push', '-q', 'origin', 'HEAD'], dir);
		}
		console.log(repo, 'README updated');
	}

	// Release asset
	const zip = join(tmp, `${repo}.zip`);
	if (!DRY) run('git', ['archive', '--format=zip', '-o', zip, 'HEAD', '--', '.', ':(exclude)media'], dir);
	let latest = null;
	try { latest = JSON.parse(run('gh', ['release', 'view', '-R', `${OWNER}/${repo}`, '--json', 'tagName,body'])); } catch {}
	const note = `- Packaged as **${repo}.zip** for one-click install in [Beyond Steam](https://github.com/OriginalSwayze/Beyond-Steam) (Get more tab). ` +
		`It also works with Millennium: unzip it into \`Steam/millennium/themes/${folder}\`.`;
	if (latest) {
		if (!DRY) {
			run('gh', ['release', 'upload', latest.tagName, zip, '--clobber', '-R', `${OWNER}/${repo}`]);
			if (!latest.body.includes(`${repo}.zip`)) {
				const notesFile = join(tmp, `${repo}-notes.md`);
				writeFileSync(notesFile, latest.body.trimEnd() + '\n\n### Beyond Steam\n' + note + '\n');
				run('gh', ['release', 'edit', latest.tagName, '-R', `${OWNER}/${repo}`, '--notes-file', notesFile]);
			}
		}
		console.log(repo, 'zip added to', latest.tagName);
	} else {
		const notesFile = join(tmp, `${repo}-notes.md`);
		writeFileSync(notesFile, `${name} ${version}.\n\n${note}\n`);
		if (!DRY) run('gh', ['release', 'create', `v${version}`, zip, '-R', `${OWNER}/${repo}`, '--title', `${name} ${version}`, '--notes-file', notesFile]);
		console.log(repo, 'released', `v${version}`);
	}
}
