// Generates a STARTER Mars map in Tiled's JSON format: levels/map/mars.json
//
// 👤 Owner: Level design.
//
//   npm run make:map            (seed 2041)
//   npm run make:map -- 1234    (different random seed)
//
// WARNING: this overwrites levels/map/mars.json. Once your team starts hand-editing
// the map in Tiled, stop running this script (or save your edited map under a new name).
import { writeFileSync } from 'node:fs';
import { WORLD } from '../../game/rules/settings.js';

const W = WORLD.widthTiles, H = WORLD.heightTiles, TS = WORLD.tileSize;
let seed = Number(process.argv[2] ?? 2041);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[Math.floor(rnd() * a.length)];

// Tile ids in levels/art/tiles.png (Tiled "gid" = id + 1; 0 = empty)
const T = {
  sand: [0, 1, 2], dark: 3, dune: 4, ripple: 5, path: 6, pad: 7, craterFloor: 8, craterRim: 9,
  bedrock: 10, hazard: 11, scorched: 12,
  rock: 13, boulder: 14, ridge: 15, scrap: 16, reactor: 17, warnPost: 18, frostRock: 19,
  mountain: 20, peak: 21, mountainFoot: 22, slope: 23,
};
const COLLIDES = [T.rock, T.boulder, T.ridge, T.scrap, T.reactor, T.warnPost, T.frostRock, T.mountain, T.peak, T.mountainFoot];

const ground = new Array(W * H).fill(0);
const obst = new Array(W * H).fill(-1);
const idx = (x, y) => y * W + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const setG = (x, y, t) => inMap(x, y) && (ground[idx(x, y)] = t);
const setO = (x, y, t) => inMap(x, y) && (obst[idx(x, y)] = t);
const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

// ---- value noise for natural-looking ground ----
const grid = Array.from({ length: 40 * 40 }, () => rnd());
const smooth = t => t * t * (3 - 2 * t);
/** Smooth random value 0..1 at tile (x, y); s = size of the blobs in tiles. Used for natural-looking ground. */
function noise(x, y, s) {
  const gx = x / s, gy = y / s, x0 = Math.floor(gx), y0 = Math.floor(gy);
  const g = (i, j) => grid[((j % 40) + 40) % 40 * 40 + ((i % 40) + 40) % 40];
  const tx = smooth(gx - x0), ty = smooth(gy - y0);
  const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx;
  const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
  return a + (b - a) * ty;
}

// ---- zones (tile rectangles) ----
const Z = {
  base:    { x: 56, y: 28, w: 40, h: 26, name: 'Jezero Base' },
  crater:  { x: 0, y: 0, w: 46, h: 44, name: 'Crater Field' },
  delta:   { x: 46, y: 0, w: 60, h: 24, name: 'Delta Cliffs' },
  reactor: { x: 112, y: 0, w: 38, h: 28, name: 'Reactor Wreck' },
  dunes:   { x: 106, y: 28, w: 44, h: 52, name: 'Dune Sea' },
  crash:   { x: 0, y: 44, w: 56, h: 36, name: 'Crash Trail' },
  plains:  { x: 56, y: 54, w: 50, h: 26, name: 'Southern Plains' },
};

// ---- the whole map is the inside of a big round crater (Jezero!) with a mountain wall all round ----
// edge(x, y) is about 1 on the crater wall, less inside, more outside. It's a rounded oval (the map is wider
// than it is tall), with a bumpy edge so it looks natural.
const CX = (W - 1) / 2, CY = (H - 1) / 2;
const edge = (x, y) => (Math.abs((x - CX) / (CX - 1)) ** 2.4 + Math.abs((y - CY) / (CY - 1)) ** 2.4) ** (1 / 2.4) + (noise(x + 500, y + 500, 4) - 0.5) * 0.08;
const WALL = 0.97, SLOPE = 0.91;     // edge() above WALL = mountains, between SLOPE and WALL = the rocky slope below them

// fuzzy zone edges so regions blend naturally
const inZone = (x, y, r) => inRect(x + Math.round((noise(x + 50, y, 3) - 0.5) * 10), y + Math.round((noise(x, y + 90, 3) - 0.5) * 10), r);

// ---- ground pass ----
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const n = noise(x, y, 9), n2 = noise(x + 300, y + 300, 4);
  let t = n < 0.33 ? T.sand[0] : n < 0.62 ? T.sand[1] : T.sand[2];
  if (n2 > 0.78) t = T.dark;
  if (inZone(x, y, Z.dunes)) t = noise(x, y * 2, 5) > 0.5 ? T.ripple : T.dune;
  if (inZone(x, y, Z.delta) && noise(x, y, 6) > 0.45) t = T.bedrock;
  if (inZone(x, y, Z.reactor)) t = noise(x, y, 5) > 0.35 ? T.hazard : t;
  if (edge(x, y) > SLOPE) t = T.slope;
  setG(x, y, t);
}
// base pad
for (let y = 29; y < 49; y++)
  for (let x = 58; x < 94; x++) if (!((x < 60 || x > 91) && (y < 31 || y > 46))) setG(x, y, T.pad);

// ---- craters ----
function crater(cx, cy, r) {
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = Math.hypot(x, y * 1.2);
    if (d <= r - 0.5) setG(cx + x, cy + y, T.craterFloor);
    else if (d <= r + 1) setG(cx + x, cy + y, T.craterRim);
  }
}
for (let i = 0; i < 22; i++) crater(ri(4, 42), ri(4, 40), ri(2, 6));
for (let i = 0; i < 8; i++) crater(ri(58, 104), ri(56, 77), ri(2, 4));
for (let i = 0; i < 4; i++) crater(ri(8, 50), ri(48, 76), ri(2, 3));

// ---- crash trail: lander skidded from SW toward base ----
const wreckTile = { x: 26, y: 62 };
const trailEnd = { x: 54, y: 50 };
for (let s = 0; s <= 1; s += 0.004) {
  const x = Math.round(wreckTile.x + (trailEnd.x - wreckTile.x) * s + Math.sin(s * 9) * 2);
  const y = Math.round(wreckTile.y + (trailEnd.y - wreckTile.y) * s);
  for (let k = -2; k <= 2; k++) if (rnd() < 0.8) setG(x + k, y + (k % 2), T.scorched);
}

// ---- obstacles ----
const keepClear = [
  { x: Z.base.x, y: Z.base.y, w: Z.base.w, h: Z.base.h },
];
const clear = (x, y) => !keepClear.some(r => inRect(x, y, r));
// the crater wall: mountains all round, so players can't walk off the world and it never just 'ends'
const isWall = (x, y) => !inMap(x, y) || edge(x, y) > WALL;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!isWall(x, y)) continue;
  const foot = !isWall(x, y + 1) || !isWall(x - 1, y) || !isWall(x + 1, y) || !isWall(x, y - 1);   // touching the crater floor
  setO(x, y, foot ? T.mountainFoot : noise(x * 3, y * 3, 2) > 0.62 ? T.peak : T.mountain);
}
// a few boulders that rolled down onto the slope
for (let i = 0; i < 160; i++) { const x = ri(2, W - 3), y = ri(2, H - 3); const e = edge(x, y); if (e > SLOPE && e <= WALL) setO(x, y, T.boulder); }
// scattered rocks everywhere
for (let i = 0; i < 520; i++) {
  const x = ri(2, W - 3), y = ri(2, H - 3);
  if (!clear(x, y)) continue;
  const g = ground[idx(x, y)];
  if (g === T.craterFloor) continue;
  setO(x, y, rnd() < 0.7 ? T.rock : T.boulder);
}
// delta cliffs: ridges of layered rock with gaps
for (let r = 0; r < 7; r++) {
  const y = ri(4, 20), x0 = ri(48, 90), len = ri(6, 16);
  for (let x = x0; x < x0 + len; x++) if (rnd() < 0.88) { setO(x, y, T.ridge); if (rnd() < 0.5) setO(x, y + 1, T.ridge); }
}
// frosty rocks in crater shadows (real: thin frost forms on Mars on cold mornings)
for (let i = 0; i < 30; i++) { const x = ri(3, 44), y = ri(3, 42); if (ground[idx(x, y)] === T.craterRim) setO(x, y, T.frostRock); }
// crash debris
for (let i = 0; i < 70; i++) {
  const s = rnd(), x = Math.round(wreckTile.x + (trailEnd.x - wreckTile.x) * s + ri(-5, 5));
  const y = Math.round(wreckTile.y + (trailEnd.y - wreckTile.y) * s + ri(-4, 4));
  if (clear(x, y)) setO(x, y, T.scrap);
}
// reactor wreck: debris core + ring of warning posts
const core = { x: 122, y: 17 };
for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, d = rnd() * 6; setO(Math.round(core.x + Math.cos(a) * d * 1.4), Math.round(core.y + Math.sin(a) * d), T.reactor); }
for (let a = 0; a < 6.28; a += 0.32) { const x = Math.round(core.x + Math.cos(a) * 13), y = Math.round(core.y + Math.sin(a) * 9); if (!isWall(x, y)) setO(x, y, T.warnPost); }

// ---- rover tracks / paths out of base (cleared of rocks) ----
function path(x0, y0, x1, y1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      if (ground[idx(x + dx, y + dy)] !== T.pad) setG(x + dx, y + dy, T.path);
      if (!isWall(x + dx, y + dy)) setO(x + dx, y + dy, -1);
    }
  }
}
path(56, 46, 28, 62);    // to crash site
path(76, 28, 76, 6);     // north to delta
path(96, 40, 128, 40);   // east into dunes
path(96, 32, 112, 22);   // NE toward reactor (stops at the warning ring)
path(76, 54, 80, 74);    // south plains
path(56, 34, 28, 24);    // west to craters

// ---- objects ----
let oid = 1;
const objects = [];
const px = t => t * TS;
// Add a map object (Tiled format). Point objects (w = h = 0) mark a single spot, like a loot spot.
const obj = (name, type, x, y, w = 0, h = 0, props = {}) => {
  const o = { id: oid++, name, type, x, y, width: w, height: h, rotation: 0, visible: true };
  const p = Object.entries(props).map(([k, v]) => ({ name: k, type: typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float') : typeof v === 'boolean' ? 'bool' : 'string', value: v }));
  if (p.length) o.properties = p;
  if (!w && !h) o.point = true;
  objects.push(o); return o;
};
// buildings: x,y = top-left of the image in pixels; size matches the art
const B = [
  ['hab', 60, 31, 96, 72], ['comms', 71, 30, 48, 80], ['greenhouse', 60, 43, 96, 60],
  ['workshop', 70, 44, 80, 56], ['garage', 77, 32, 96, 56], ['rocket', 89, 30, 48, 128],
];
for (const [name, tx, ty, w, h] of B) {
  obj(name, 'building', px(tx), px(ty), w, h);
  for (let y = ty; y < ty + Math.ceil(h / TS); y++) for (let x = tx; x < tx + Math.ceil(w / TS); x++) setO(x, y, -1);
}
obj('wreck', 'landmark', px(wreckTile.x) - 32, px(wreckTile.y) - 24, 64, 40);
obj('player_start', 'spawn', px(63), px(37));

obj('rover', 'vehicle', px(84), px(37) + 8);
// base equipment (starts broken; the Builder repairs it). Size matches the art.
obj('moxie', 'equipment', px(66) + 8, px(31), 30, 26);
for (const [tx, ty] of [[76, 39], [79.5, 39], [76, 42.5], [79.5, 42.5]]) obj('generator', 'equipment', px(tx), px(ty), 48, 28);

for (const z of Object.values(Z)) obj(z.name, 'zone', px(z.x), px(z.y), px(z.w), px(z.h), {
  hazard: z.name === 'Reactor Wreck',
});

// Loot spots: how many of each loot table go in each area (what each table holds is in levels/loot.js)
const lootPlan = [[Z.crash, 'crash', 26], [Z.crater, 'common', 14], [Z.delta, 'common', 12], [Z.dunes, 'common', 12],
  [Z.plains, 'common', 10], [Z.reactor, 'hazard', 14]];
for (const [z, table, n] of lootPlan) {
  let made = 0, tries = 0;
  while (made < n && tries++ < 500) {
    const x = ri(z.x + 2, z.x + z.w - 3), y = ri(z.y + 2, z.y + z.h - 3);
    if (obst[idx(x, y)] !== -1 || edge(x, y) > SLOPE) continue;      // not in the mountains or on the slope
    obj('loot', 'loot', px(x) + 8, px(y) + 8, 0, 0, { table }); made++;
  }
}

// ---- write Tiled JSON ----
const layer = (id, name, data) => ({ id, name, type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
const map = {
  compressionlevel: -1, type: 'map', version: '1.10', tiledversion: '1.11.2', orientation: 'orthogonal', renderorder: 'right-down',
  infinite: false, width: W, height: H, tilewidth: TS, tileheight: TS, nextlayerid: 4, nextobjectid: oid,
  layers: [
    layer(1, 'ground', ground.map(t => t + 1)),
    layer(2, 'obstacles', obst.map(t => t + 1)),
    { id: 3, name: 'objects', type: 'objectgroup', draworder: 'topdown', opacity: 1, visible: true, x: 0, y: 0, objects },
  ],
  tilesets: [{
    firstgid: 1, name: 'mars', image: '../art/tiles.png', imagewidth: 80, imageheight: 80,
    tilewidth: TS, tileheight: TS, columns: 5, tilecount: 25, margin: 0, spacing: 0,
    tiles: COLLIDES.map(id => ({ id, properties: [{ name: 'collides', type: 'bool', value: true }] })),
  }],
};
writeFileSync(new URL('./mars.json', import.meta.url), JSON.stringify(map));
console.log(`Map written: ${W}x${H} tiles (${W * TS}x${H * TS}px), ${objects.length} objects, seed ${process.argv[2] ?? 2041}`);
