// Shared game settings. Used by the server, the browser and the tools.
// Change numbers here instead of digging through game code.
//
// 👤 Owner: Game logic & backend.
import { JOB_TEXT } from '../../story/jobs.js';

// The map's size. Must match the Tiled map in levels/map/mars.json.
export const WORLD = {
  tileSize: 16,        // pixels per tile
  widthTiles: 150,     // 5 screens wide  (one screen = 30 x 20 tiles = 480 x 320 px)
  heightTiles: 80,     // 4 screens tall  -> 20 screens in total
  metresPerTile: 4,    // for the compass: 150 tiles = 600 m across
};

// The game is drawn at this size and scaled up to fill the window (chunky pixels)
export const SCREEN = { width: 480, height: 320 };

// How fast astronauts move
export const PLAYER = {
  walkSpeed: 70,       // pixels per second
  runSpeed: 110,       // holding Shift
};

// The 3 jobs. Colours are set here; names, goals and descriptions come from story/jobs.js.
export const JOBS = Object.fromEntries(Object.entries({
  botanist: { color: '#7bd88f' },
  builder:  { color: '#ff8a3d' },
  pilot:    { color: '#6cc4ff' },
}).map(([id, j]) => [id, { ...j, ...JOB_TEXT[id] }]));

// The port the host server listens on: players open http://<host address>:3000
export const NET = { port: 3000 };

// Character looks: the visor colour you pick in the lobby (the suit stripe colour comes from your job)
export const LOOKS = [
  { name: 'Gold visor', visor: '#d9a426', shine: '#fff7c2' },
  { name: 'Blue visor', visor: '#3a7fb0', shine: '#c7ecff' },
  { name: 'Green visor', visor: '#3f8f4a', shine: '#c8f2b0' },
  { name: 'Pink visor', visor: '#c0507a', shine: '#ffd0e0' },
];
