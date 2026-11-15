// The words for the 3 jobs: names, goals, to-do list text, and "you can't do that" messages.
//
// 👤 Owner: Story & NASA data.  Change the words freely.
// Job IDs (botanist, builder, pilot) and to-do IDs (seeds, plant...) must stay the same.
// WHEN a to-do ticks off is a game rule: see game/rules/tasks.js. Job colours are in game/rules/settings.js.

export const JOB_TEXT = {
  botanist: {
    name: 'Botanist',
    short: 'grow food',                                        // shown on the HUD: "YOUR JOB: Botanist - ..."
    goal: 'Grow food for the crew.',                           // one clear sentence (arrival screen)
    blurb: 'Grow food for the crew. Only you can plant seeds.',   // lobby job card
  },
  builder: {
    name: 'Builder',
    short: 'fix the 5 machines',
    goal: 'Fix the 5 broken machines.',
    blurb: 'Fix the 5 broken machines. Only you can fix things.',
  },
  pilot: {
    name: 'Pilot',
    short: 'drive the rover, fly home',
    goal: 'Drive the rover to find parts. Then fly everyone home.',
    blurb: 'Drive the rover to find parts. Then fly everyone home.',
  },
};

// Shorter words for the NEXT line at the top of the screen (when the full to-do text is too long to fit).
// The parts still needed are shown on the line under it.
export const TODO_HUD = {
  moxie: 'Fix MOXIE first!',
  drive: 'Free the rover, then drive it (E)',
  tuneHint: 'plants grow at half speed: tune the lights at the light panel',   // under the Botanist's NEXT line
};

// Each job's to-do list (press T in game), in the order shown.
export const TODO_TEXT = {
  botanist: {
    moxie: 'Fix MOXIE first! Find 2 pipes and 1 circuit board for the Builder',
    seeds: 'Find 3 seed packets',
    plant: 'Plant a seed in the greenhouse',
    tune: 'Tune the grow lights at the light panel',
    harvest: 'Pick a crop (needs the grow lights)',
    fertilize: 'Fertilize a plant bed',
    kinds: 'Grow red cabbage, tomatoes and potatoes',
    pantry: 'Put 9 food in the hub chest',
  },
  builder: {
    moxie: 'Fix MOXIE, fast!',
    power: 'Fix the fission generators',
    lights: 'Fix the greenhouse lights',
    laser: 'Fix the laser comms',
    rocket: 'Add all 5 rocket parts',
  },
  pilot: {
    moxie: 'Fix MOXIE first! Find 2 pipes and 1 circuit board for the Builder',
    drive: 'Free the rover from the sand, then drive it (E next to it)',
    dunes: 'Drive to the Dune Sea',
    parts: 'Put 3 parts in a chest for the Builder',
    rocks: 'Analyze 3 glowing rocks',
    rocketpart: 'Find a rocket part in the Reactor Wreck',
    explore: 'Visit all 7 places on the map',
    earth: 'Send a message to Earth',
    home: 'Fly everyone home',
  },
};

// Shown when someone tries something their job can't do. Points them at teamwork.
export const CANT_DO = {
  plant: 'Only the Botanist can plant. Drop your seeds by them, or put them in a chest!',
  repair: 'Only the Builder can fix things. Drop the parts by them, or put them in a chest!',
  drive: 'Only the Pilot can drive. Press E to ride along instead!',
};
