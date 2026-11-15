// Each job has its own clear to-do list. This file decides WHEN each to-do ticks off;
// the words shown to players are in story/jobs.js (TODO_TEXT), matched by id.
// Tasks tick off when the matching event happens.
//   on:    the event name (sent by the game when something happens)
//   match: optional check on the event's detail
//   count: how many times it must happen (default 1)
//   check: optional test of the game state instead of an event (checked every second)
// Events the game sends:
//   pickup(itemId, n) plant(seed) harvest(crop) repair(key) craft(itemId) drive() zone(name)
//   radio(kind) eat(itemId) sleep() store(itemId, n) shelter() launch()
//   tune() fertilize(bedIndex) analyze(itemId) earth()   (mini games)
//
// 👤 Owner: Game logic & backend.
import { TODO_TEXT, JOB_TEXT } from '../../story/jobs.js';

export const TASKS = {
  botanist: [
    { id: 'moxie', check: w => !w.equipment.get('moxie').broken },        // everyone helps the Builder fix MOXIE first
    { id: 'seeds', on: 'pickup', match: id => id.startsWith('seeds_'), count: 3 },
    { id: 'plant', on: 'plant' },
    { id: 'tune', on: 'tune' },                                            // the Light Recipe mini game at the light panel
    { id: 'harvest', on: 'harvest' },
    { id: 'fertilize', on: 'fertilize' },                                  // fertilizer from the hub toilet, used on a bed
    { id: 'kinds', check: w => ['crop_cabbage', 'crop_tomato', 'crop_potato'].every(c => w.stats.harvested.has(c)) },
    { id: 'pantry', check: w => w.foodInChest() >= 9 },
  ],
  builder: [
    { id: 'moxie', on: 'repair', match: k => k === 'moxie' },
    { id: 'power', on: 'repair', match: k => k === 'fission_generator' },
    { id: 'lights', on: 'repair', match: k => k === 'greenhouse_lights' },
    { id: 'laser', on: 'repair', match: k => k === 'laser_comms' },
    { id: 'rocket', check: w => (w.equipment.get('rocket')?.progress ?? 0) >= 5 },
  ],
  pilot: [
    { id: 'moxie', check: w => !w.equipment.get('moxie').broken },        // help the Builder fix MOXIE first
    { id: 'drive', on: 'drive' },
    { id: 'dunes', check: w => w.rover.driving && w.zone?.name === 'Dune Sea' },
    { id: 'parts', on: 'store', match: id => ['pipe', 'wire', 'circuit_board', 'power_core', 'rocket_part'].includes(id), count: 3 },
    { id: 'rocks', on: 'analyze', count: 3 },                              // glowing rock samples, studied with the workshop microscope
    { id: 'rocketpart', on: 'pickup', match: id => id === 'rocket_part' },
    { id: 'explore', check: w => w.stats.zones.size >= 7 },
    { id: 'earth', on: 'earth' },                                          // Hit Earth at the comms console (after the laser comms are fixed)
    { id: 'home', on: 'launch' },
  ],
};

// Add each to-do's words from story/jobs.js (falls back to the ID if the words are missing).
for (const [job, list] of Object.entries(TASKS)) for (const t of list) t.text = TODO_TEXT[job]?.[t.id] ?? t.id;

// One clear sentence for each job (shown on arrival), from story/jobs.js.
export const JOB_GOALS = Object.fromEntries(Object.entries(JOB_TEXT).map(([job, j]) => [job, j.goal]));
