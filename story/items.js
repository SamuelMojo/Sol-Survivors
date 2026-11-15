// The words for every item: its name, a short description, and a REAL science fact.
// Shown in the backpack (I), the hotbar and messages.
//
// 👤 Owner: Story & NASA data.  Change the words freely.
// The item IDs (seeds_potato, wire...) must stay the same: the game uses them.
// To add a NEW item, the Game logic person also adds it to game/rules/items.js (icon, stack size, kind).

export const ITEM_TEXT = {
  // A seed's fact pops up when the Botanist plants it
  seeds_potato: {
    name: 'Potato seeds',
    desc: 'Only the Botanist can plant these.',
    fact: 'Potatoes were the first food grown in space, in 1995! In a Mars soil test, only 4 out of 65 kinds of potato grew.',
  },
  seeds_cabbage: {
    name: 'Red cabbage seeds',
    desc: 'Only the Botanist can plant these.',
    fact: 'In 2017 astronaut Peggy Whitson grew cabbage in space. Nobody has grown RED cabbage in space yet. Maybe you\'ll be first!',
  },
  seeds_tomato: {
    name: 'Tomato seeds',
    desc: 'Only the Botanist can plant these.',
    fact: 'In 2023 astronaut Frank Rubio grew a tomato in space and lost it! It floated away. It was found 8 months later.',
  },
  food_ration: {
    name: 'Space ration',
    desc: 'A meal in a pouch. Eat it indoors.',
    fact: 'Food for Mars must stay good for years.',
  },
  food_pack: {
    name: 'Snack pack',
    desc: 'Dried fruit and crackers. Eat it indoors.',
    fact: 'Most space food is dried and sealed in pouches.',
  },
  medkit: {
    name: 'Medkit',
    desc: 'Press F to lower your radiation.',
    fact: 'On Mars the nearest hospital is months away.',
  },
  pipe: {
    name: 'Pipe',
    desc: 'A part. MOXIE needs 2.',
    fact: 'The Space Station recycles almost all its water through pipes.',
  },
  wire: {
    name: 'Wire',
    desc: 'A part. The grow lights and laser comms need wire.',
    fact: 'Mars is so cold that wires need little heaters.',
  },
  circuit_board: {
    name: 'Circuit board',
    desc: 'A part. MOXIE, the grow lights and the laser comms need one each.',
    fact: 'Space radiation can mess up computer chips. Space chips are made extra tough.',
  },
  power_core: {
    name: 'Power core',
    desc: 'A part. The fission generators need 2.',
    fact: 'Dust storms on Mars can hide the Sun for weeks. That\'s why NASA wants nuclear power there.',
  },
  rocket_part: {
    name: 'Rocket part',
    desc: 'A part. The rocket needs 5. Your ticket home!',
    fact: 'No rocket has ever taken off from another planet.',
  },
  scrap: {
    name: 'Scrap metal',
    desc: 'The Builder can turn 3 into a pipe or a wire.',
    fact: 'One day astronauts may recycle scrap into new parts with 3D printers.',
  },
  // ---- harvested crops (food) ----
  crop_potato: {
    name: 'Potato',
    desc: 'Fresh food from the greenhouse.',
    fact: 'Real potatoes take 3 to 4 months to grow. The game is faster!',
  },
  crop_cabbage: {
    name: 'Red cabbage',
    desc: 'Crunchy purple leaves. Fresh food!',
    fact: 'Salad grown in space was ready to eat in about a month.',
  },
  crop_tomato: {
    name: 'Tomato',
    desc: 'Juicy and full of vitamins.',
    fact: 'Fresh food has more vitamins than old stored food.',
  },
  // ---- mini game items ----
  fertilizer: {
    name: 'Fertilizer',
    desc: 'Made at the hub toilet. E at a plant bed: it grows twice as fast.',
    fact: 'The Space Station recycles about 98% of its water, even the wee. One day waste may feed Mars plants too.',
  },
  rock_sample: {
    name: 'Rock sample',
    desc: 'A glowing rock. Only the Pilot can pick it up. Look at it with the microscope in the workshop.',
    fact: 'Perseverance seals its rock samples in tubes for a future trip back to Earth.',
  },
};
