// The end screens: winning (with a star rating) and the lessons shown if the crew fails.
//
// 👤 Owner: Story & NASA data.  Change the words freely.
// The numbers in ${...} are filled in by the game (see game/client/js/scenes/EndScene.js).

export const WIN = {
  title: 'GOING HOME!',
  // s = the crew's results: sol, dose, budget (the radiation limit), crops, harvests, repairs, equipment, flares, tasks, taskTotal
  lines: (s, jobName) => [
    `You took off on Sol ${s.sol} and made it back in time!`,
    '',
    `Radiation: ${Math.round(s.dose)} (limit ${s.budget})${s.dose <= s.budget ? ' ✔' : ''}`,
    `Kinds of crop grown: ${s.crops}${s.crops >= 2 ? ' ✔' : ''}`,
    `Machines fixed: ${s.repairs}/${s.equipment}`,
    `Space storms you hid from: ${s.flares}`,
    `${jobName} to-do list: ${s.tasks}/${s.taskTotal}`,
  ],
  stars: 'Stars: ★ get home  ★ radiation under the limit  ★ grow 2 kinds of crop',
  fact: 'Real science: NASA keeps track of all the radiation an astronaut gets in their life.',
};

// Why the mission failed -> [title, lesson]. The key is the reason the game gives.
export const LESSONS = {
  air: () => ['THE AIR RAN OUT', `MOXIE wasn't fixed in time. On Mars, making air is the most important job!\n\nNext time, everyone look for 2 pipes and 1 circuit board, fast. Drop them by the Builder.`],
  window: ({ closes }) => ['TOO LATE', `You didn't make it back in time. After Sol ${closes}, Earth and Mars drift too far apart to fly home. Planets keep moving!\n\nNext time, fix everything and find the rocket parts as a team, early.`],
};

// Shown on every failure screen, under the lesson
export const FAIL = {
  title: 'MISSION FAILED',
  body: (sol, lesson) => `You lasted until Sol ${sol}.\n\n${lesson}\n\nEvery game is different. Try again!`,
};

export const PLAY_AGAIN = '[Enter] Play again';
