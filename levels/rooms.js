// Building interiors, drawn as text so anyone on the team can redesign a room.
//
//   #  wall          w  wall with a window      .  floor        D  the way out (bottom wall)
//   Capital letters place furniture; the letter marks its TOP-LEFT tile (see FURNITURE for sizes).
//   Leave the tiles a piece of furniture covers as '.'.
//
// Every row of a room must be the same length. The game checks this and tells you if one is wrong.
//
// 👤 Owner: Level design.  The room's name and real-science fact are in story/places.js.
//   floor: which floor tiles to draw (metal | green | concrete)
// To add a new piece of furniture you need a sprite in levels/art (f-<key>.png, loaded in BootScene.js)
// and, if players can use it, code in game/client/js/scenes/InteriorScene.js (Game logic person).
// To add a whole new building, the Game logic person also has to place its door in WorldScene.js.
import { ROOM_TEXT } from '../story/places.js';

export const FURNITURE = {
  B: { key: 'bunk',    w: 1, h: 2, label: 'Bunk bed' },
  M: { key: 'medbed',  w: 2, h: 3, label: 'Medbay bed' },
  K: { key: 'table',   w: 3, h: 2, label: 'Kitchen table' },
  C: { key: 'chest',   w: 1, h: 1, label: 'Crew storage chest' },
  P: { key: 'planter', w: 3, h: 1, label: 'Planter' },
  W: { key: 'bench',   w: 3, h: 2, label: 'Workbench' },
  R: { key: 'radio',   w: 3, h: 2, label: 'Laser comms console' },
  S: { key: 'shelf',   w: 2, h: 1, label: 'Spare parts shelf' },
  T: { key: 'console', w: 4, h: 2, label: 'Flight console' },
  L: { key: 'locker',  w: 1, h: 2, label: 'Suit locker' },
  O: { key: 'toilet',  w: 1, h: 2, label: 'Toilet' },               // (not used in any room now: the hub has a toilet DOOR, Q)
  Q: { key: 'toiletdoor', w: 1, h: 2, label: 'Toilet door' },      // the hub's toilet, behind a door: the Botanist goes in and makes fertilizer
  G: { key: 'lightpanel', w: 2, h: 1, label: 'Light panel' },      // the Botanist tunes the grow lights here (a mini game)
  U: { key: 'microscope', w: 2, h: 2, label: 'Microscope desk' },  // the Pilot studies glowing rock samples here (a mini game)
};

const ROOMS = {
  // The hab has 3 bunks: one for each astronaut (the night only starts when everyone is in bed), and the toilet
  // behind its own door (Q) on the top wall, well away from the crew chest (C)
  hab: {
    floor: 'metal',
    rows: [
      '######ww######ww######',
      '#..........Q.........#',
      '#.B..B..B.......M....#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#..................C.#',
      '#....................#',
      '#..K.................#',
      '#....................#',
      '#.L..................#',
      '#....................#',
      '##########D###########',
    ],
  },
  // The greenhouse has 6 planters. EVERY building has a crew chest (C): they're all the same shared chest, so
// anything put in one can be taken out of any other.
  greenhouse: {
    floor: 'green',
    rows: [
      '#ww##ww##ww##ww##ww##',
      '#.G...............C.#',
      '#...................#',
      '#..P.....P.....P....#',
      '#...................#',
      '#...................#',
      '#..P.....P.....P....#',
      '#...................#',
      '#...................#',
      '#...................#',
      '##########D##########',
    ],
  },
  workshop: {
    floor: 'metal',
    rows: [
      '##################',
      '#.............C..#',
      '#..W...U...S.....#',
      '#................#',
      '#................#',
      '#................#',
      '#................#',
      '#................#',
      '#######D##########',
    ],
  },
  comms: {
    floor: 'metal',
    rows: [
      '###ww###ww###',
      '#.........C.#',
      '#....R......#',
      '#...........#',
      '#...........#',
      '#...........#',
      '######D######',
    ],
  },
  garage: {
    floor: 'concrete',
    rows: [
      '######################',
      '#.C..................#',
      '#...............S....#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '#....................#',
      '##########D###########',
    ],
  },
  rocket: {
    floor: 'metal',
    rows: [
      '########',
      '#......#',
      '#.T....#',
      '#......#',
      '#......#',
      '#.....C#',
      '#......#',
      '####D###',
    ],
  },
};

// Layout + words in one object per room (INTERIORS.hab.rows, INTERIORS.hab.name, INTERIORS.hab.fact)
export const INTERIORS = Object.fromEntries(Object.entries(ROOMS).map(([id, r]) => [id, { name: id, fact: '', ...r, ...ROOM_TEXT[id] }]));

/** Throws a helpful error if a room's rows aren't all the same length. */
export function checkInterior(id) {
  const r = INTERIORS[id].rows, w = r[0].length;
  r.forEach((row, i) => { if (row.length !== w) throw new Error(`Interior "${id}" row ${i} is ${row.length} wide, expected ${w}`); });
  if (!r[r.length - 1].includes('D')) throw new Error(`Interior "${id}" has no door (D) in its bottom row`);
}
