// Scene Two: the voyage. The crew is aboard the mothership Perseverance VI, a few weeks from Mars,
// when a swarm of micrometeoroids hits. Each job rushes to its station.
//
// 👤 Owner: Story & NASA data. The ship's floor plan is in levels/ship.js (Level design).

// Each job's emergency task: the title, how to do it, and a REAL fact shown when it's done
export const VOYAGE_TASKS = {
  botanist: {
    title: 'Fix the 3 air leaks',
    how: 'Find the white puffs. Hold E on each one.',
    fact: 'In 2020, astronauts found a tiny air leak by watching floating tea leaves drift towards it!',
  },
  builder: {
    title: 'Fix the wires',
    how: 'Press E at the wire panel. Join each wire to the same colour.',
    fact: 'Space wires are tested in heat, cold and shaking. There are no shops in space!',
  },
  pilot: {
    title: 'Fly past the space debris',
    how: 'Press E at the pilot seat. Use W and S to dodge.',
    fact: 'Even a tiny fleck of paint, moving fast enough, can chip a spacecraft window. Ships have layered shields to stop small pieces.',
  },
};

// The scene's story cards, in the order they appear
export const VOYAGE_STORY = {
  title: 'PERSEVERANCE VI · 3 DAYS FROM MARS',                     // shown at the top of the screen
  intro: 'Day 23 on the ship Perseverance VI. Mars is only a few days away...',
  alarm: 'SPACE ROCKS! The ship has been hit. Go to your job!',
  // pilot = the name of the crew's Pilot (a player, or the computer crewmate)
  escape: pilot => `A big rock smashes into the ship!\nPilot ${pilot}: "Everyone into the lander, NOW! I'll fly us down to Mars!"`,
  fact: 'Most space rocks are smaller than a grain of sand, but faster than a bullet.',
};
