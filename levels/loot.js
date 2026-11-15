// What players can find at each loot spot.
//
// 👤 Owner: Level design.
// Loot spots are placed in the map (levels/map/mars.json, objects layer, type "loot") with a
// property "table" naming one of the tables below. Each game, every spot rolls once:
//   crateChance: chance (0 to 1) that the spot is a supply crate instead of a single pile on the ground
//   crateItems:  [fewest, most] item piles inside a crate
//   crate / ground: { itemId: weight }. A bigger weight makes that item more likely. 0.5 = rare.
// Item IDs are listed in story/items.js.
//
// REPAIR PARTS (pipe, wire, circuit board, power core, rocket part) are NOT in these tables. The game places
// exactly enough of each part for the 5 repairs, plus 1 spare, one part per spot and spread as far apart as it
// can (game/rules/loot.js). PART_PLACES below says which kinds of spot each part can turn up at.

export const LOOT_TABLES = {
  // Along the crash trail: supply crates thrown from the lander
  crash: {
    crateChance: 0.5, crateItems: [1, 3],
    crate: { medkit: 1, scrap: 3, seeds_potato: 0.3, seeds_cabbage: 0.3, seeds_tomato: 0.3 },
    ground: { scrap: 4, seeds_potato: 0.3 },
  },
  // Out in the wild: seeds blown around, plus scrap. (No food anywhere: after the 3 food packs each, the Botanist feeds the crew.)
  common: {
    crateChance: 0.15, crateItems: [1, 2],
    crate: { seeds_potato: 1.4, seeds_cabbage: 1.4, seeds_tomato: 1.4, scrap: 4, medkit: 1 },
    ground: { seeds_potato: 1.4, seeds_cabbage: 1.4, seeds_tomato: 1.2, scrap: 9 },
  },
  // Reactor wreck: the best loot, but radiation makes it dangerous
  hazard: {
    crateChance: 0.6, crateItems: [1, 3],
    crate: { medkit: 2, scrap: 2 },
    ground: { scrap: 2 },
  },
};

// Which kinds of loot spot each repair part can be placed at (see REPAIR PARTS above).
// MOXIE's parts (2 pipes + 1 circuit board) always go on the crash trail close to the base, so the crew
// can fix the air in time.
export const PART_PLACES = {
  pipe:          ['crash', 'common'],
  wire:          ['crash', 'common'],
  circuit_board: ['crash', 'common', 'hazard'],
  power_core:    ['crash', 'hazard'],
  rocket_part:   ['crash', 'common', 'hazard'],
};

// How many you get when you pick up a pile of this item: [fewest, most] (anything not listed = 1)
// (seed packets come 1 at a time: there was far too much food)
export const PILE = { scrap: [1, 3], wire: [1, 2], pipe: [1, 2] };

// Spare parts shelves inside buildings: found once per game by whoever searches first. { roomId: [[itemId, count], ...] }
export const SHELF_LOOT = { workshop: [['wire', 2], ['pipe', 1]], garage: [['power_core', 1], ['wire', 1]] };
