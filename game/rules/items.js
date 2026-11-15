// Every item in the game: the numbers the game logic needs.
//   icon:  frame number in levels/art/items.png (16x16 icons, left to right, top to bottom)
//   stack: how many fit in one bag slot
//   kind:  seed | food | supply | part | sample (decides what F does with it, and what bots collect)
//   job:   only this job can pick the item up (rock samples: the Pilot)
// The words (name, description, real-science fact) live in story/items.js and are merged in below,
// so the rest of the game can just read ITEMS[id].name, ITEMS[id].fact and so on.
//
// 👤 Owner: Game logic & backend.
import { ITEM_TEXT } from '../../story/items.js';

const STATS = {
  seeds_potato:   { icon: 0, stack: 20, kind: 'seed' },
  seeds_cabbage:  { icon: 1, stack: 20, kind: 'seed' },
  seeds_tomato:   { icon: 2, stack: 20, kind: 'seed' },
  food_ration:    { icon: 3, stack: 10, kind: 'food' },
  food_pack:      { icon: 4, stack: 10, kind: 'food' },
  medkit:         { icon: 7, stack: 5, kind: 'supply' },
  pipe:           { icon: 8, stack: 10, kind: 'part' },
  wire:           { icon: 9, stack: 10, kind: 'part' },
  circuit_board:  { icon: 10, stack: 10, kind: 'part' },
  power_core:     { icon: 11, stack: 5, kind: 'part' },
  rocket_part:    { icon: 12, stack: 3, kind: 'part' },
  scrap:          { icon: 13, stack: 20, kind: 'part' },
  crop_potato:    { icon: 14, stack: 10, kind: 'food' },
  crop_cabbage:   { icon: 15, stack: 10, kind: 'food' },
  crop_tomato:    { icon: 16, stack: 10, kind: 'food' },
  fertilizer:     { icon: 17, stack: 5, kind: 'supply' },               // the Botanist makes it at the hub toilet; E at a plant bed
  rock_sample:    { icon: 18, stack: 3, kind: 'sample', job: 'pilot' }, // glowing rocks: only this job can pick them up
};

// Merge numbers + words into one object per item. If the story file is missing an item,
// the item's ID is used as its name so the game never crashes on missing text.
export const ITEMS = Object.fromEntries(Object.entries(STATS).map(([id, s]) => [id, { name: id, desc: '', fact: '', ...s, ...ITEM_TEXT[id] }]));

/** The display name of an item ID (falls back to the ID itself). */
export const itemName = id => ITEMS[id]?.name ?? id;
