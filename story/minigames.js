// The words for the mini games (the little "game within a game" screens): titles, one-line
// instructions, messages and the REAL fact shown when you win. Also the words for the toilet,
// the fertilizer, the light panel, the microscope desk and the stuck rover.
//
// 👤 Owner: Story & NASA data.  Change the words freely.
// The IDs (moxie, atom, weld...) must stay the same: the game finds the text by them.
// Keep every line short: the mini game frames are small, and players are 7 to 12 years old.
// Facts must be TRUE. Where the game is simpler than real life, say so with GAME:.

export const MINIGAME_TEXT = {
  // Shared buttons and messages
  common: {
    quit: 'Esc: quit',                         // shown in the corner of every mini game
    quitHint: 'Nothing is used up if you quit.',
    done: 'DONE!',                             // the big word on the win screen
    fact: 'Real science:',                     // in front of the fact
    go: '[E] Carry on',                        // closes the win screen (E, Space, Enter or a click)
    tryAgain: 'Try again!',
    paused: 'PAUSED',
    closedFixed: 'Someone else fixed it. Nice teamwork!',   // the thing you were fixing got fixed another way
    // The big science fact screen (every fact in the game, and every mini game's win screen)
    factLabel: 'REAL SCIENCE',                 // the small word above the fact's title
    factDone: 'DONE!  REAL SCIENCE',           // the same, after winning a mini game
    factClose: 'Click the X in the corner (or press Esc) to carry on',
    factButton: 'Science fact',                // the menu line that opens a fact (kitchen, workbench, flight console)
    factItem: '[F] Science fact',              // the backpack button
    // The menu's "Exit to main menu" button and its "are you sure?" box
    exit: {
      button: 'Exit to main menu',
      title: 'LEAVE THE GAME?',
      solo: 'Your mission ends and you go back to the main menu.',
      crew: 'You go back to the main menu. Your crew carries on without you (you can rejoin with the game code and the same name).',
      yes: 'Yes, leave',
      no: 'No, stay',
    },
  },

  // ---- Spaceship: the Builder's screw panel (before the wires) ----
  screws: {
    title: 'ENGINE ROOM WIRING PANEL',
    how: 'Unscrew the 4 screws: click each one 3 times (or press 1-4)',
    plate: 'DANGER: HIGH VOLTAGE',
    off: 'Panel off! Now join the wires.',
  },

  // ---- Builder: MOXIE ----
  moxie: {
    title: 'SPLIT THE CO2',
    how: 'Drag one O off each CO2. Then drag two free O together.',
    stepTwo: 'Now join the free O atoms in pairs to make O2.',
    fact: "MOXIE, on NASA's Perseverance rover, made oxygen from Mars air this way: it split CO2 into O and CO.",
  },

  // ---- Builder: fission generators ----
  atom: {
    title: 'SPLIT THE ATOM',
    how: 'Tap Space (or click) fast to fire neutrons. Fill the meter!',
    miss: 'miss',
    hit: 'HIT!',
    split: 'SPLIT! Heat and 3 new neutrons.',
    fact: 'In a reactor, one neutron splits a uranium atom and lets out heat. GAME: here it takes many hits.',
  },

  // ---- Builder: greenhouse lights, laser comms, rocket ----
  weld: {
    title: 'WELD THE CRACK',
    how: 'Hold the mouse down and trace the crack from START.',
    cooled: 'You slipped off. That bit cooled. Weld it again.',
    names: { greenhouse_lights: 'Grow lights', laser_comms: 'Laser mast', rocket: 'Rocket engine' },
    fact: 'In space, two clean pieces of metal can stick together by themselves. It is called cold welding.',
  },

  // ---- Botanist: toilet and fertilizer ----
  fertilizer: {
    toilet: 'Toilet: make fertilizer',                        // the [E] prompt
    toiletOther: 'Toilet',
    noAir: 'The toilet recycler needs MOXIE. Fix MOXIE first!',
    today: 'You already made fertilizer today. Come back tomorrow.',
    making: 'Making fertilizer',                             // the progress bar
    inUse: 'IN USE',                                         // over the toilet door while someone is inside
    got: 'You got 1 bag of fertilizer. Use it on a plant bed (E).',
    onlyBotanist: 'Only the Botanist makes fertilizer.',
    useBed: 'Fertilize this bed',                            // the [E] prompt at a planter
    doneBed: 'This bed grows twice as fast now!',
    already: 'This bed is already fertilized.',
    useHint: 'E at a plant bed: grows 2x faster',            // next to the item above the hotbar
    useWhere: 'Use it on a plant bed in the greenhouse (E).',
    factTitle: 'SPACE FACT: RECYCLING',
    fact: 'The Space Station recycles about 98% of its water. Yes, even the wee!',
    button: 'Wow!',
  },

  // ---- Botanist: light recipe ----
  light: {
    title: 'LIGHT RECIPE',
    how: 'Move the sliders to match the target glow (click, or 1/2/3 then Up/Down)',
    panel: 'Tune the grow lights',                            // the [E] prompt
    panelOther: 'Light panel (the Botanist tunes it)',
    needLights: 'The grow lights must work first. The Builder fixes them (and the power).',
    tuned: 'The lights are tuned. The plants love it!',
    target: 'TARGET', yours: 'YOUR LIGHTS',
    red: 'RED', green: 'GREEN', blue: 'BLUE',
    close: 'Close! Keep going.',
    fact: "NASA's Veggie garden on the Space Station uses mostly red and blue LEDs. That is why it glows pink.",
  },

  // ---- Botanist: frost watch ----
  frost: {
    title: 'FROST WATCH',
    how: 'Click a bed (or press its number) to warm it up!',
    warn: 'FROST! Your plants are freezing. Go to the greenhouse!',
    froze: n => `The frost has passed. ${n} bed${n > 1 ? 's' : ''} froze: they grow again in the morning.`,
    saved: 'The frost has passed. You saved every bed!',
    heater: 'HEAT',                                        // the button under each bed
    frozen: 'FROZEN',
    passes: 'Frost passes in:',                            // the night bar at the top
    gustSoon: 'A cold gust is coming...',
    gust: 'COLD GUST!',
    close: 'Close save!',                                  // a puff on a bed that was nearly frozen
    streak: n => `Close save x${n}!`,
    saves: n => `Close saves: ${n}`,
    fact: 'Nights on Mars can drop below -70 °C. Plants need heaters and a roof to survive.',
  },

  // ---- Pilot: the stuck rover ----
  unstick: {
    title: 'UNSTICK THE ROVER',
    how: 'Tap Space (or click) to keep the revs in the green for 5 seconds',
    prompt: 'Free the rover from the sand',                   // the [E] prompt (Pilot)
    promptOther: 'The rover is stuck in the sand. Only the Pilot can free it.',
    hot: 'Too fast! The motor got hot. Let it cool.',
    stall: 'Too slow! It stalled.',
    free: 'The rover is free! Drive it to the base.',
    fact: "NASA's Spirit rover got stuck in soft sand in 2009 and was never freed.",
  },

  // ---- Pilot: rock samples ----
  rocks: {
    title: 'ROCK SAMPLE',
    how: 'Look in the microscope. Click the matching mineral.',
    desk: 'Microscope: look at a rock sample',                // the [E] prompt (Pilot, with a sample)
    deskNone: 'Microscope (bring a glowing rock sample)',
    deskOther: 'Microscope (only the Pilot studies rock samples)',
    onlyPilot: 'Only the Pilot can pick up rock samples.',
    wrong: 'Look again! Match the colour and shape.',
    right: 'Yes! That is',
    minerals: {
      olivine: { name: 'Olivine', look: 'green crystals' },
      hematite: { name: 'Hematite', look: 'grey-red balls' },
      carbonate: { name: 'Carbonate', look: 'pale layers' },
    },
    fact: 'Perseverance seals its rock samples in tubes for a future trip back to Earth.',
  },

  // ---- Pilot: hit Earth ----
  earth: {
    title: 'HIT EARTH',
    how: 'Keep the crosshair on Earth while the bar fills (mouse or WASD)',
    option: 'Aim the laser at Earth and send a message',     // the extra line on the comms console
    needPilot: 'Only the Pilot aims the laser.',
    sent: 'Message sent! Earth got it.',
    fact: 'A laser message takes 3 to 22 minutes to get from Mars to Earth, depending on where the planets are.',
  },
};
