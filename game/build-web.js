// Builds a static web version of Sol Survivors: plain files any web host can serve, with no Node server.
//
//   npm run build:web                 -> dist/web/
//   npm run build:web -- <folder>     -> <folder>/  (e.g. a folder in your website)
//
// 👤 Owner: Game logic & backend.
//
// The web version is SOLO only (with computer crewmates): multiplayer needs the host server
// (npm start). It works in any sub-folder of a website, because every path is made relative:
//   - imports like '/game/rules/items.js' become relative to the file they're in
//   - pictures and the map ('/levels/...') become relative to index.html
//   - the server's /api/audio list becomes a file, audio-files.json
//   - Phaser and the fonts are copied in from node_modules
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, parse, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? join(root, 'dist/web'));

// Files that only matter for development (tools, guides, sources), left out of the web version
const SKIP = new Set(['README.md', 'make-map.js', 'make-art.py', '.gitkeep', '.DS_Store', '__pycache__']);
const copyDir = (from, to) => cpSync(join(root, from), join(out, to), { recursive: true, filter: src => !SKIP.has(parse(src).base) });

// 1. Fresh output folder with the same layout the server uses
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyDir('game/client', '.');                    // index.html, style.css, js/
copyDir('game/rules', 'game/rules');
copyDir('levels', 'levels');
copyDir('story', 'story');
mkdirSync(join(out, 'lib/phaser'), { recursive: true });
cpSync(join(root, 'node_modules/phaser/dist/phaser.min.js'), join(out, 'lib/phaser/phaser.min.js'));
for (const font of ['press-start-2p', 'vt323']) {
  const file = `${font}-latin-400-normal.woff2`;
  mkdirSync(join(out, 'fonts', font), { recursive: true });
  cpSync(join(root, `node_modules/@fontsource/${font}/files/${file}`), join(out, 'fonts', font, file));
}

// 2. The list of music / sound files that exist (what /api/audio answers on the server)
const audio = {};
for (const dir of ['music', 'sfx']) {
  const folder = join(root, 'levels/audio', dir);
  if (!existsSync(folder)) continue;
  for (const f of readdirSync(folder)) {
    const { name, ext } = parse(f);
    if (['.mp3', '.ogg', '.wav', '.m4a'].includes(ext.toLowerCase())) audio[`${dir}/${name}`] ??= `${dir}/${f}`;
  }
}
writeFileSync(join(out, 'audio-files.json'), JSON.stringify(audio));

// 3. Make every path relative
const files = [];
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk(out);
const toUrl = p => p.split(sep).join('/');

for (const file of files) {
  const ext = parse(file).ext;
  if (!['.js', '.html', '.css'].includes(ext)) continue;
  let s = readFileSync(file, 'utf8');
  if (ext === '.js') {
    // Imports: relative to this file ('/game/rules/x.js' from js/scenes/ -> '../../game/rules/x.js')
    s = s.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])\/([^'"]+)\2/g, (_m, pre, q, path) => {
      let rel = toUrl(relative(dirname(file), join(out, path)));
      if (!rel.startsWith('.')) rel = './' + rel;
      return `${pre}${q}${rel}${q}`;
    });
    // Files loaded by Phaser: relative to index.html
    s = s.replace(/(['"`])\/levels\//g, '$1levels/');
    s = s.replace(/(['"])\/api\/audio\1/g, '$1audio-files.json$1');
  }
  if (ext === '.html') {
    s = s.replace(/\s*<script src="\/socket\.io\/socket\.io\.js"><\/script>/, '');   // no server: plays offline
    s = s.replace(/(src|href)="\/(?!\/)/g, '$1="./');
  }
  if (ext === '.css') s = s.replace(/url\((['"]?)\/(?!\/)/g, 'url($1');
  writeFileSync(file, s);
}

// 4. Check nothing still points at the server
const leftovers = [];
for (const file of files.filter(f => /\.(js|html|css)$/.test(f))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (l.trim().startsWith('//') || l.trim().startsWith('*')) return;          // comments don't matter
    if (l.includes("'/api/join'")) return;                                      // only asked when a server exists
    if (/(['"`(])\/(game|levels|story|lib|fonts|js|api|socket\.io)\//.test(l)) leftovers.push(`${toUrl(relative(out, file))}:${i + 1}: ${l.trim()}`);
  });
}
if (leftovers.length) {
  console.error('These lines still use server paths:\n' + leftovers.join('\n'));
  process.exit(1);
}
console.log(`Web version built in ${out} (${files.length} files, ${Object.keys(audio).length} audio files).`);
