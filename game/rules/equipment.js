// The 5 broken machines: the game rules for repairing them.
// Only the Builder can fix them, using parts the whole crew collects.
// At the start the crew CHOOSES what to fix first: the MOXIE (air) or the fission generators (power).
// The generators power the greenhouse lights and laser comms. MOXIE runs on its own battery at
// half speed until the generators are fixed.
//
//   order:    position in the repair list (1 = first: MOXIE is always the first job)
//   needs:    parts used up by one repair, { itemId: count }
//   repairMs: how long the repair takes, in real milliseconds
//   powered:  true = only works while the fission generators work
//   battery:  true = works without power, but at half speed
//   steps:    the rocket takes several parts, installed one repair at a time
//
// The words (name, what it does, fixed message, real-science fact) are in story/machines.js
// and are merged in below. Where each machine stands on the map is set in WorldScene.js.
//
// 👤 Owner: Game logic & backend.
import { MACHINE_TEXT } from '../../story/machines.js';

const RULES = {
  moxie:             { order: 1, needs: { pipe: 2, circuit_board: 1 }, repairMs: 3000, battery: true },
  fission_generator: { order: 2, needs: { power_core: 2 }, repairMs: 3000 },
  greenhouse_lights: { order: 3, needs: { wire: 1, circuit_board: 1 }, repairMs: 3000, powered: true },
  laser_comms:       { order: 4, needs: { wire: 2, circuit_board: 1 }, repairMs: 3000, powered: true },
  rocket:            { order: 5, needs: { rocket_part: 1 }, steps: 5, repairMs: 2500 },
};

// Rules + words in one object per machine (EQUIPMENT.moxie.name, .needs, .fact ...)
export const EQUIPMENT = Object.fromEntries(Object.entries(RULES).map(([key, r]) => [key, { name: key, does: '', fixed: 'Fixed!', fact: '', ...r, ...MACHINE_TEXT[key] }]));
