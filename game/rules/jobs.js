// What each job is allowed to do. Checked by the game before an action happens.
// (Names and colours are in settings.js; the words are in story/jobs.js.)
import { CANT_DO } from '../../story/jobs.js';
//
// 👤 Owner: Game logic & backend.

// ability -> the jobs that may do it
export const ABILITIES = {
  plant: ['botanist'],              // only the Botanist can plant seeds
  repair: ['builder'],              // only the Builder can fix the 5 broken machines
  drive: ['pilot'],                 // only the Pilot can drive the rover
};

/** Can this job do this ability? (Abilities not listed here are allowed for everyone.) */
export const can = (job, ability) => ABILITIES[ability]?.includes(job) ?? true;

// Shown when someone tries something their job can't do (words are in story/jobs.js).
export const WHO = CANT_DO;
