// The words for the 5 broken machines (MOXIE, fission generators, greenhouse lights, laser comms, rocket): name, what it does, the message when it's fixed,
// and a REAL science fact shown when you look at it.
//
// 👤 Owner: Story & NASA data.  Change the words freely.
// The machine IDs (fission_generator, moxie...) must stay the same: the game uses them.
// What parts each repair needs, and the order, are game rules: see game/rules/equipment.js.

export const MACHINE_TEXT = {
  moxie: {
    name: 'MOXIE',
    does: 'Makes air to breathe. Fix it first: you have 10 minutes!',
    fixed: 'MOXIE works! It is making air from Mars air.',
    fact: "On 20 April 2021, NASA's MOXIE made oxygen on Mars for the first time. It was enough to breathe for 10 minutes.",
  },
  fission_generator: {
    name: 'Fission generators',
    does: 'Make power for the base, day and night.',
    fixed: 'The generators work! The base has power.',
    fact: 'In 2018 NASA tested a small nuclear power maker called KRUSTY. It works without sunlight, even in dust storms.',
  },
  greenhouse_lights: {
    name: 'Greenhouse lights',
    does: 'Plants only grow when the lights are on.',
    fixed: 'The grow lights are on. Plants can grow!',
    fact: 'Space gardens use red and blue lights. Plants use those colours the most.',
  },
  laser_comms: {
    name: 'Laser comms',
    does: 'Talk to Earth with a laser. Get warnings about space storms.',
    fixed: 'The laser works! You can talk to Earth.',
    fact: 'In 2023 NASA sent the first laser message from deep space. Lasers carry more data than radio.',
  },
  rocket: {
    name: 'Ascent rocket',
    does: 'Your ride home. It needs 5 rocket parts.',
    fixed: 'Rocket part added.',
    fact: 'No rocket has ever taken off from Mars. Mars has weaker gravity, so it needs less fuel.',
  },
};
