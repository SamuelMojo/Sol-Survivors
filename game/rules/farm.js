// Greenhouse crops. Crops grow while the greenhouse lights work (fixed, with power from the fission generators).
// GAME RULE: every crop takes 1 real minute to grow (real crops take weeks to months; real times are in each crop's fact).
//
// 👤 Owner: Game logic & backend.
import { itemName } from './items.js';

export const PLANTERS = 6;   // planters in the greenhouse (must match the P's in levels/rooms.js)

// How long a crop takes to grow, in Mars minutes (1 real second = 5 Mars minutes, so 300 = 1 real minute)
export const GROW_MINUTES = 300;

// For each seed: the crop it grows, how many crops you harvest, and the chance of getting a seed back.
// (The crop's name comes from story/items.js.)
export const CROPS = {
  seeds_cabbage: { crop: 'crop_cabbage', yield: 2, seedBack: 0.5 },
  seeds_tomato:  { crop: 'crop_tomato',  yield: 3, seedBack: 0.5 },
  seeds_potato:  { crop: 'crop_potato',  yield: 4, seedBack: 1 },
};
for (const c of Object.values(CROPS)) Object.defineProperty(c, 'name', { get: () => itemName(c.crop), enumerable: true });

/** A planter is null (empty) or { seed, grown: Mars minutes grown so far }. Returns its growth from 0 (just planted) to 1 (ready). */
export const growth = p => !p ? 0 : Math.min(1, (p.grown ?? 0) / GROW_MINUTES);
/** Real seconds until a planter's crop is ready (while the lights work). */
export const secondsLeft = p => !p ? 0 : Math.ceil(Math.max(0, GROW_MINUTES - (p.grown ?? 0)) / 5);
