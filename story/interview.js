// Scene One: the launch-day interview on Earth.
// The reporter asks each astronaut a question about their job. Each answer gives a small bonus
// item at the start on Mars, so the choice matters a little but nobody is punished.
//
// 👤 Owner: Story & NASA data.  Change the words freely.
//   ask:     the question; ${name} is the astronaut's name
//   answers: exactly 3 per job (players press 1, 2 or 3)
//     text = what the astronaut says, reply = the reporter's answer,
//     bonus = [itemId, count] given at the start on Mars (item IDs are listed in story/items.js)
//   facts:   facts[0] is shown at the end of the interview
export const INTERVIEW = {
  intro: 'Hello from the launch pad! Today three astronauts fly to Mars. Let\'s meet them!',
  outro: 'Thank you, crew. Good luck, and come home safe!',
  board: 'Time to get in the rocket! Walk to the ladder (A and D), then climb up to your door (W). Or just click.',
  allAboard: 'Everyone is in the rocket!',
  hostLaunch: 'Press Space to launch!',
  waitLaunch: 'Waiting for the host to launch...',
  questions: {
    botanist: {
      ask: name => `${name}, you're the Botanist. How will you get food on Mars?`,
      answers: [
        { text: 'We\'ll grow it in a greenhouse.', reply: 'Smart! Astronauts have really eaten salad grown in space.', bonus: ['seeds_cabbage', 2] },
        { text: 'Potatoes. Lots of potatoes!', reply: 'Ha! Scientists really have grown potatoes in Mars-like soil.', bonus: ['seeds_potato', 2] },
        { text: 'I\'ll make the first farm on another planet!', reply: 'That would make history!', bonus: ['seeds_tomato', 2] },
      ],
    },
    builder: {
      ask: name => `${name}, you're the Builder. What if something breaks on Mars?`,
      answers: [
        { text: 'We bring spare parts and fix it ourselves.', reply: 'Good plan. Spare parts could save you!', bonus: ['wire', 2] },
        { text: 'Duct tape! NASA really packs it.', reply: 'True! Apollo 13 used duct tape to fix their air machine.', bonus: ['pipe', 1] },
        { text: 'I\'ll build a new one from scraps!', reply: 'A real inventor!', bonus: ['scrap', 4] },
      ],
    },
    pilot: {
      ask: name => `${name}, you're the Pilot. Are you scared?`,
      answers: [
        { text: 'A little. But we trained for years.', reply: 'Training keeps astronauts safe.', bonus: ['medkit', 1] },
        { text: 'Only of the space food!', reply: 'Ha! Most of it comes dried, in pouches.', bonus: ['seeds_potato', 2] },
        { text: 'No way. I can\'t wait to go!', reply: 'Spoken like a true explorer!', bonus: ['wire', 1] },
      ],
    },
  },
  facts: [
    'Real science: the trip to Mars takes about 7 months.',
    'Real science: Earth and Mars line up for a trip only every 26 months.',
  ],
};
