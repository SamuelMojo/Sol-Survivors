// The words for places: the 7 map areas and the 6 buildings you can go inside.
// Area facts pop up the first time you walk into an area. Room facts show when you go inside.
//
// 👤 Owner: Story & NASA data.  Change the words freely.
// Area names must match the zone names in the map (levels/map/mars.json, objects layer, type "zone").
// Room IDs (hab, greenhouse...) must match levels/rooms.js.

// The 7 areas of the map, by name
export const ZONE_FACTS = {
  'Jezero Base': "Jezero Crater is real! NASA's Perseverance rover landed here in 2021.",
  'Crater Field': 'Mars has lots of craters. Its thin air can\'t burn up space rocks like Earth\'s air can.',
  'Delta Cliffs': 'Long ago a river flowed here. Scientists look in these rocks for signs of old life.',
  'Reactor Wreck': 'DANGER: radiation! Get what you need and leave fast.',
  'Dune Sea': 'Big sand dunes! A NASA rover called Spirit got stuck in sand like this in 2009.',
  'Crash Trail': 'Supplies from the crash are spread out here. Open the crates!',
  'Southern Plains': 'Mars nights can be colder than -70 °C. There is nowhere to hide out here.',
};

// Buildings you can enter: the name shown on screen and a REAL science fact
export const ROOM_TEXT = {
  hab: {
    name: 'Hub',
    fact: 'The hub is your home. It keeps the air in and the cold out.',
  },
  greenhouse: {
    name: 'Greenhouse',
    fact: 'Plants can\'t grow outside on Mars. It\'s too cold and the soil has harmful salts.',
  },
  workshop: {
    name: 'Workshop',
    fact: 'Astronauts have used 3D printers in space to make new parts.',
  },
  comms: {
    name: 'Laser Comms Tower',
    fact: 'NASA talks to Mars with giant radio dishes. Lasers could send much more.',
  },
  garage: {
    name: 'Garage',
    fact: 'NASA has designed rovers you can drive without a spacesuit, like a camper van!',
  },
  rocket: {
    name: 'Ascent Rocket',
    fact: 'No rocket has ever taken off from Mars. Yours will be the first!',
  },
};
