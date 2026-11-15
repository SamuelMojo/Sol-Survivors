// Survival rules. Every player manages THREE things: FOOD, AIR and HEALTH.
// REAL = based on real NASA data. GAME = simplified so it plays well in a short game (labelled in-game too).
// The REAL numbers come from story/nasa-data.js (the Story & NASA data person keeps them up to date).
//
// 👤 Owner: Game logic & backend.
import { SOL_LENGTH, SURFACE_DOSE_PER_SOL, BIGGEST_FLARE_DOSE, REAL_FLARES as FLARES } from '../../story/nasa-data.js';

export const TIME = {
  minutesPerSecond: 5,      // GAME: 1 real second = 5 Mars minutes, so a day (06:00–24:00) lasts about 3.5 real minutes
  wake: 6 * 60,             // you wake at 06:00
  sunrise: 7 * 60, sunset: 19 * 60,
  lateWarning: 22 * 60,
  solLength: SOL_LENGTH,              // REAL: one Mars day (sol)
};

// ---- the three bars: FOOD, AIR, HEALTH ----
export const BODY = {
  // AIR: your suit's air. Drains outside. Refills indoors ONLY once MOXIE works (MOXIE is the first job).
  suitMinutes: { botanist: 1500, builder: 1500, pilot: 2100 },  // GAME: 5 real minutes outside (Pilot 7). REAL suits last about 8 h
  suitRefillPerMin: 4,      // % per minute while indoors with MOXIE working
  // FOOD: drains all the time. Eat indoors (F with food selected, or the kitchen).
  hungerPerMin: 0.055 / 0.75,  // GAME: a full stomach lasts about 22 hours (about 4.5 real minutes)
  // HEALTH: goes down from radiation (most in the Reactor Wreck and in space storms), from having no air,
  // and from starving. At 0 you pass out (and wake up in the medbay).
  radToHealth: 4,           // health lost per unit of radiation
  reactorPerMin: 0.15,      // GAME: radiation per minute in the Reactor Wreck
  noAirDamagePerMin: 5,     // health lost per minute with an empty suit
  starvingDamagePerMin: 2,     // health lost per Mars minute with no food (10 a real second: an empty stomach knocks you out fast)
  knockoutMinutes: 120,     // time lost when you pass out
  // SLEEP: heals you but doesn't feed you. You can't pass out while asleep.
  nightHunger: 30,          // food used up overnight
  nightFoodFloor: 10,       // ...but the night never takes you below this
  sleepHeal: 40,            // health back after a night's sleep
  medbayHeal: 25,           // health back after resting in the medbay
};

// How much food each item gives when eaten
export const FOOD_VALUE = { food_pack: 25, food_ration: 50, crop_potato: 40, crop_cabbage: 25, crop_tomato: 30 };
export const HEAL_ITEMS = { medkit: 30 };       // GAME: a medkit gives back this much health
export const START_FOOD = ['food_pack', 3];     // every astronaut lands with 3 food packs; after that, the Botanist feeds the crew

export const RADIATION = {
  surfacePerSol: SURFACE_DOSE_PER_SOL,   // REAL: Curiosity RAD, average Mars-surface dose
  flareDose: BIGGEST_FLARE_DOSE,         // REAL: biggest storm dose measured on Mars (Curiosity, May 2024)
  flareHours: 2,            // GAME: a space storm lasts 2 Mars hours (24 real seconds)
  flareHealthPerMin: 1,     // GAME: outside in a space storm you lose 5 health a real second (1 per Mars minute). Indoors you're safe.
  alarmMinutes: 60,         // REAL idea: a flare's X-rays arrive first; particles follow later. GAME: 12 real seconds of warning
  limit: 25,                // GAME: the 'radiation under the limit' star at the end compares your TOTAL dose with this
  // REAL: radiation dose adds up for life. In the game it hurts your HEALTH (BODY.radToHealth); the ending shows your total dose.
};

// REAL X-class solar flares from NASA's DONKI archive (story/nasa-data.js). Each in-game flare is modelled on one.
export const REAL_FLARES = FLARES;

// ---- the base ----
export const BASE = {
  stormSpeed: 0.3,          // dust storms make you 70% slower (and the rover too)
};
// GAME: every night there are 2 dust storms (one in the evening, one after midnight)
export const NIGHT_STORMS = { evening: [20 * 60, 21 * 60], late: [60, 3 * 60], minutes: [150, 150], warnMinutes: 60 };   // each lasts 30 real seconds; 12 real seconds of warning

// ---- the air clock ----
// The crash broke MOXIE, the machine that makes air. Fixing it is ALWAYS the first job. Until it works,
// suits can't refill, and the crew has this many real seconds of play to fix it (the clock stops while
// the host pauses and at night). Run out and the mission is over.
export const AIR = {
  moxieSeconds: 600,        // GAME: 10 real minutes
  batterySpeed: 0.5,        // MOXIE runs at half speed on its battery until the fission generators work
};

// GAME: you can fly home as soon as EVERYTHING is fixed (opens: 1). Make it back before it's too late: after Sol 12
// Earth and Mars drift too far apart and the mission is lost.
export const LAUNCH = { opens: 1, closes: 12 };
