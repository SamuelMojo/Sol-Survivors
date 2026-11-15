// Rolling the loot at each loot spot, and placing the repair parts. WHAT can be found where (the loot tables and
// where parts may go) is level design: see levels/loot.js. This file does the dice rolling.
//
// 👤 Owner: Game logic & backend.
// GAME RULE: parts are scarce but the game is ALWAYS winnable. The map holds exactly what the 5 repairs need,
// plus 1 spare of each part (PARTS_ON_MAP). Each part sits at its own loot spot, as far as possible from the
// other parts, so the crew has to explore. (The spare parts shelves in the workshop and garage are a bonus on top,
// and the Builder can make pipes and wire from scrap at the workbench.) Everyone's screen rolls the same seed,
// so every player sees the parts in the same places.
import { LOOT_TABLES, PILE, PART_PLACES } from '../../levels/loot.js';
import { EQUIPMENT } from './equipment.js';
export { LOOT_TABLES };

/** How many of each part the 5 repairs use up (the rocket needs one part per step). */
export const PARTS_NEEDED = (() => {
  const need = {};
  for (const e of Object.values(EQUIPMENT)) for (const [id, n] of Object.entries(e.needs)) need[id] = (need[id] ?? 0) + n * (e.steps ?? 1);
  return need;
})();
/** GAME RULE: exactly this many of each part lie on the map: what's needed + 1 spare. */
export const PARTS_ON_MAP = Object.fromEntries(Object.entries(PARTS_NEEDED).map(([id, n]) => [id, n + 1]));
/** MOXIE's parts are placed first, on the crash trail within this many tiles of the base (16 px tiles). */
export const MOXIE_NEAR_TILES = 32;
const PARTS = new Set(Object.keys(PARTS_ON_MAP));
/** GAME RULE: at least this many seed packets of each crop on the map (seeds are rare, but all 3 crops can be grown). */
export const SEEDS_MIN = 2;

/** Pick one item ID from a { itemId: weight } table. Bigger weight = more likely. */
function weighted(table, rnd) {
  const entries = Object.entries(table);
  let r = rnd() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of entries) if ((r -= w) <= 0) return id;
  return entries[0][0];
}
/** A whole number from a to b (inclusive). */
const range = ([a, b], rnd) => a + Math.floor(rnd() * (b - a + 1));
/** One pile of an item: { id, n } with n from the PILE sizes (default 1). */
const pile = (id, rnd) => ({ id, n: PILE[id] ? range(PILE[id], rnd) : 1 });

/** Roll what is at one loot spot: { kind: 'crate'|'ground', items: [{id,n}] }. Never a repair part. */
export function rollSpot(tableName, rnd = Math.random) {
  const t = LOOT_TABLES[tableName] ?? LOOT_TABLES.common;
  if (rnd() < t.crateChance) {
    const items = [];
    for (let i = range(t.crateItems, rnd); i > 0; i--) items.push(pile(weighted(t.crate, rnd), rnd));
    return { kind: 'crate', items: items.filter(it => !PARTS.has(it.id)) };
  }
  const it = pile(weighted(t.ground, rnd), rnd);
  return { kind: 'ground', items: PARTS.has(it.id) ? [{ id: 'scrap', n: 1 }] : [it] };
}

/**
 * Pick a spot for one part, far from the parts already placed: the spots are ranked by distance to the
 * nearest placed part, and one of the 3 farthest is chosen (so it's spread out, but not the same every game).
 */
function farSpot(cands, placed, rnd) {
  if (!cands.length) return null;
  const score = s => placed.length ? Math.min(...placed.map(p => Math.hypot(p.x - s.x, p.y - s.y))) : rnd();
  const ranked = cands.map(s => [score(s), s]).sort((a, b) => b[0] - a[0]);
  return ranked[Math.floor(rnd() * Math.min(3, ranked.length))][1];
}

/**
 * Roll every spot, then place the repair parts (see the GAME RULE above).
 * base = { x, y } in pixels: the middle of the base (MOXIE's parts go near it). Returns the rolled spots.
 */
export function rollAllSpots(spots, rnd = Math.random, base = null) {
  const rolled = spots.map(s => ({ ...s, ...rollSpot(s.table, rnd) }));
  const used = new Set(), placed = [];
  const put = (s, id) => {
    used.add(s); placed.push(s);
    if (s.kind === 'crate') s.items.push({ id, n: 1 });
    else s.items = [{ id, n: 1 }];                      // a ground spot becomes the part
  };
  const free = (id, near) => rolled.filter(s => !used.has(s) && (PART_PLACES[id] ?? ['crash']).includes(s.table) &&
    (!near || Math.hypot(s.x - base.x, s.y - base.y) <= MOXIE_NEAR_TILES * 16));
  // 1. MOXIE's parts first, on the crash trail near the base (the air clock is ticking)
  const left = { ...PARTS_ON_MAP };
  for (const [id, n] of Object.entries(EQUIPMENT.moxie.needs)) for (let k = 0; k < n; k++) {
    const near = base ? free(id, true).filter(s => s.table === 'crash') : [];
    const s = farSpot(near.length ? near : free(id), placed, rnd);
    if (s) { put(s, id); left[id]--; }
  }
  // 2. Then every other part, one per spot, spread as far apart as possible (big parts first)
  for (const id of ['rocket_part', 'power_core', 'circuit_board', 'wire', 'pipe']) for (; left[id] > 0; left[id]--) {
    const s = farSpot(free(id), placed, rnd) ?? farSpot(rolled.filter(s => !used.has(s)), placed, rnd) ?? farSpot(rolled, placed, rnd);
    if (!s) break;
    if (used.has(s)) s.items.push({ id, n: 1 }); else put(s, id);
  }
  // Seeds are scarce, but the Botanist must be able to grow all 3 crops: make sure there are at least
  // SEEDS_MIN packets of each kind somewhere on the map (on spots that hold no repair part)
  for (const id of ['seeds_potato', 'seeds_cabbage', 'seeds_tomato']) {
    const have = () => rolled.reduce((t, s) => t + s.items.filter(i => i.id === id).reduce((a, i) => a + i.n, 0), 0);
    const pool = rolled.filter(s => !used.has(s) && s.table !== 'hazard');
    while (have() < SEEDS_MIN && pool.length) { const s = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; if (s.kind === 'crate') s.items.push({ id, n: 1 }); else s.items = [{ id, n: 1 }]; }
  }
  // A crate left with nothing in it gets some scrap (an empty crate is no fun)
  for (const s of rolled) if (s.kind === 'crate' && !s.items.length) s.items.push({ id: 'scrap', n: 1 });
  return rolled;
}
