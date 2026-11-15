// The crash cutscene, and the message you see when you arrive on Mars.
//
// 👤 Owner: Story & NASA data.  Change the words freely.
// Each shot is one picture in the cutscene. The pictures themselves are drawn in code
// (game/client/js/scenes/CrashScene.js), so keep 5 shots in this order:
//   1 lander leaves the ship   2 glowing entry   3 parachutes   4 crash   5 message from Earth
//   ms: how long the shot stays on screen, in milliseconds (the crew leader can skip with Space)
export const CRASH_SHOTS = [
  { ms: 3500, text: 'The crew escapes in the lander.' },
  { ms: 3500, text: 'Into the Mars air, super fast. The heat shield glows!' },
  { ms: 3000, text: 'Parachutes! But one engine is broken...' },
  { ms: 3200, text: 'CRASH! Supplies fly everywhere.' },
  { ms: 4500, text: 'Earth: "We see you! Your base is near. Fix the rocket and make it back before it\'s too late!"' },
];

// The first screen on Mars. The game fills in the details:
//   job = your job's name, goal = your job's goal (story/jobs.js), opens/closes = the launch window sols,
//   minutes = how long the crew has to fix MOXIE
export const ARRIVAL = {
  title: 'Sol 1 · Jezero Crater, Mars',
  body: ({ job, goal, opens, closes, minutes }) =>
    `You made it! But the crash broke MOXIE.\n\n` +
    `What is MOXIE? Mars air is mostly carbon dioxide, which people can't breathe. MOXIE is a machine that pulls oxygen out of it, a bit like a tree does. No MOXIE, no new oxygen!\n\n` +
    `FIRST JOB: FIX MOXIE IN ${minutes} MINUTES! It needs 2 pipes and 1 circuit board. Until it works, your OXYGEN bar can't fill up again.\n\n` +
    `YOU ARE THE ${job.toUpperCase()}: ${goal}\n` +
    `Fix everything, then fly home. ${HOME.line}`,
};

// The deadline for flying home, everywhere it's mentioned (machines panel, menu, flight console, ending).
//   closes = the last sol you can launch on (game/rules/survival.js, LAUNCH.closes)
export const HOME = {
  line: 'Make it back before it\'s too late!',
  panel: closes => `Make it back before it's too late (end of Sol ${closes})`,
  console: (closes, sol) => `Make it back before it's too late: you must launch by the end of Sol ${closes} (today is Sol ${sol}).`,
};
