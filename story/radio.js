// Messages from Earth, picked at random when you use the laser comms console in the Laser Comms Tower.
// Replies arrive after the real Earth–Mars signal delay (story/nasa-data.js, LIGHT_MINUTES)
// (GAME RULE: sped up so 1 minute of delay = 1 real second).
//
// 👤 Owner: Story & NASA data.  Add, remove or change messages freely.
export { LIGHT_MINUTES } from './nasa-data.js';

// Advice from Mission Control

export const MISSION_CONTROL = [
  'Earth: Your generators work at night too. They don\'t need the Sun.',
  'Earth: The Reactor Wreck has good parts. But don\'t stay long!',
  'Earth: Keep MOXIE working. You need air!',
  'Earth: Put spare parts in a chest. Then the Builder can find them.',
  'Earth: Keep some seeds to plant again.',
  'Earth: Our messages take minutes to reach you. You have to solve problems yourselves!',
];

// Messages from the astronauts' families
export const FROM_HOME = [
  'From home: The whole school watched you on the news!',
  'From home: The dog waits by the door every night. Come home safe!',
  'From home: We saw Mars in a telescope. A tiny red dot, and you\'re on it!',
  'From home: Grandma says eat your vegetables. Even Mars ones!',
];

// Quick shouts to the crew (press R in game)
export const SHOUTS = ['Help!', 'Get inside, flare coming!', 'Over here!', 'I found rocket parts!', 'Bring me parts!'];
