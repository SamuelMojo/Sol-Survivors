// Parts are scarce but the game is ALWAYS winnable: rolls the map's loot for 2000 seeds and checks every one.
//   node tests/loot_seeds.mjs
import { readFileSync } from 'node:fs';
import { rollAllSpots, PARTS_ON_MAP, PARTS_NEEDED, MOXIE_NEAR_TILES } from '../game/rules/loot.js';
import { EQUIPMENT } from '../game/rules/equipment.js';
import { makeRng } from '../game/rules/rng.js';

const map = JSON.parse(readFileSync(new URL('../levels/map/mars.json', import.meta.url)));
const objs = map.layers.filter(l => l.type === 'objectgroup').flatMap(l => l.objects);
const prop = (o, k) => o.properties?.find(p => p.name === k)?.value;
const spots = objs.filter(o => (o.type ?? o.class) === 'loot').map(o => ({ x: o.x, y: o.y, table: prop(o, 'table') }));
const ps = objs.find(o => o.name === 'player_start'), base = { x: ps.x, y: ps.y };
const SEEDS = 2000, fails = [];
let minGap = Infinity, sumGap = 0, gaps = 0, moxieFar = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const rolled = rollAllSpots(spots, makeRng(seed), base);
  const count = id => rolled.reduce((t, s) => t + s.items.filter(i => i.id === id).reduce((a, i) => a + i.n, 0), 0);
  for (const [id, n] of Object.entries(PARTS_ON_MAP)) {
    if (count(id) !== n) fails.push(`seed ${seed}: ${count(id)} ${id} (want exactly ${n})`);
    if (count(id) < PARTS_NEEDED[id]) fails.push(`seed ${seed}: NOT WINNABLE, ${count(id)} ${id} < ${PARTS_NEEDED[id]}`);
  }
  // one part per spot, spread out
  const partSpots = rolled.filter(s => s.items.some(i => i.id in PARTS_ON_MAP));
  const perSpot = Math.max(...partSpots.map(s => s.items.filter(i => i.id in PARTS_ON_MAP).length));
  if (perSpot > 1) fails.push(`seed ${seed}: ${perSpot} parts in one spot`);
  for (let i = 0; i < partSpots.length; i++) for (let j = i + 1; j < partSpots.length; j++) {
    const d = Math.hypot(partSpots[i].x - partSpots[j].x, partSpots[i].y - partSpots[j].y) / 16;
    minGap = Math.min(minGap, d);
  }
  const nn = partSpots.map(a => Math.min(...partSpots.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.y - b.y) / 16)));
  sumGap += nn.reduce((a, b) => a + b, 0); gaps += nn.length;
  // MOXIE's parts within reach of the base, on the crash trail
  for (const [id, n] of Object.entries(EQUIPMENT.moxie.needs)) {
    const near = rolled.filter(s => s.table === 'crash' && Math.hypot(s.x - base.x, s.y - base.y) <= MOXIE_NEAR_TILES * 16).reduce((t, s) => t + s.items.filter(i => i.id === id).length, 0);
    if (near < n) { moxieFar++; fails.push(`seed ${seed}: only ${near} ${id} near the base for MOXIE`); }
  }
  // the same seed gives the same map (every player sees the same thing)
  if (seed <= 50 && JSON.stringify(rollAllSpots(spots, makeRng(seed), base)) !== JSON.stringify(rolled)) fails.push(`seed ${seed}: not repeatable`);
}
console.log(`parts on the map: ${JSON.stringify(PARTS_ON_MAP)} (needed: ${JSON.stringify(PARTS_NEEDED)})`);
console.log(`${SEEDS} seeds; closest two parts ever: ${minGap.toFixed(1)} tiles; average gap to the nearest other part: ${(sumGap / gaps).toFixed(1)} tiles`);
console.log(fails.length ? `FAILURES (${fails.length}):\n  ${fails.slice(0, 10).join('\n  ')}` : 'OK: every seed is winnable, parts are exact, one per spot, MOXIE parts near the base');
process.exit(fails.length ? 1 : 0);
