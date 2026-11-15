// REAL numbers from NASA missions and science papers. The game's rules are built on these.
//
// 👤 Owner: Story & NASA data.  Check sources, update numbers, add new real data here.
// The game logic reads these values (game/rules/survival.js and others), so keep the names the same.
// If you change a number, the game changes too: tell the Game logic person so they can rebalance.

// ---- Mars days ----
export const SOL_LENGTH = '24 hours 39 minutes';     // one Mars day (a "sol")

// ---- Radiation ----
// Average Mars-surface dose measured by Curiosity's RAD instrument (Hassler et al., Science 2013), in mSv per sol
export const SURFACE_DOSE_PER_SOL = 0.67;
// Biggest storm dose measured on the Mars surface so far: Curiosity, 20 May 2024 (8,100 micrograys)
export const BIGGEST_FLARE_DOSE = 8.1;
// NASA's career radiation limit for astronauts, in mSv (the game uses a much smaller "game limit")
export const CAREER_LIMIT = 600;

// Real X-class solar flares from NASA's DONKI space weather archive. Each in-game flare is modelled on one.
export const REAL_FLARES = [
  { date: '9 Aug 2011', cls: 'X6.9' }, { date: '7 Mar 2012', cls: 'X5.4' }, { date: '6 Sep 2017', cls: 'X9.3' },
  { date: '10 Sep 2017', cls: 'X8.2' }, { date: '14 May 2024', cls: 'X8.7' }, { date: '3 Oct 2024', cls: 'X9.0' },
];

// ---- Talking to Earth ----
// One-way radio signal delay, in minutes, depending on where Earth and Mars are in their orbits
export const LIGHT_MINUTES = [4, 22];

// ---- Spacesuits ----
export const SUIT_HOURS = 8;                         // a real spacewalk suit lasts about 8 hours

// ---- Trips ----
export const TRIP_MONTHS = 7;                        // Earth to Mars with today's rockets
export const LAUNCH_WINDOW_MONTHS = 26;              // Earth and Mars line up for a trip about this often
