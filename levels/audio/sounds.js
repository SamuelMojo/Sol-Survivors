// Music and sound effects: which file plays for what.
//
// 👤 Owner: Level design, music & sounds.
//
// HOW TO ADD A SOUND
//   1. Put the file in levels/audio/music/ or levels/audio/sfx/  (.mp3, .ogg, .wav or .m4a all work)
//   2. Make sure its name matches the list below, WITHOUT the extension.
//      e.g. MUSIC.mars_day is 'music/mars-day', so levels/audio/music/mars-day.mp3 is used.
//   3. Reload the game. Files that don't exist yet are simply skipped (the game stays silent there).
//
// Keep files small: short sound effects (under 1 second) and music loops under about 2 MB.
// Players can press M at any time to mute or unmute.

// Background music. Each piece loops until the next one starts.
export const MUSIC = {
  intro:      'music/intro',        // the opening crawl ("THE YEAR IS 2041...")
  earth:      'music/earth',        // launch-day interview on Earth
  voyage:     'music/voyage',       // aboard the Perseverance VI
  crash:      'music/crash',        // the crash cutscene
  mars_day:   'music/mars-day',     // on Mars, daytime
  mars_night: 'music/mars-night',   // on Mars, after sunset
  win:        'music/win',          // the crew launches home
  lose:       'music/lose',         // mission failed
};

// Sound effects, played once.
export const SFX = {
  click:       'sfx/click',         // choosing an option in a menu
  door:        'sfx/door',          // going into or out of a building
  crate:       'sfx/crate',         // opening a supply crate
  pickup:      'sfx/pickup',        // picking something up
  drop:        'sfx/drop',          // dropping or storing an item
  give:        'sfx/give',          // giving an item to a crewmate
  repair:      'sfx/repair',        // a machine is fixed / a rocket part goes in
  plant:       'sfx/plant',         // planting a seed
  harvest:     'sfx/harvest',       // harvesting a crop
  eat:         'sfx/eat',           // eating
  rover:       'sfx/rover',         // getting into the rover
  radio:       'sfx/radio',         // sending a radio message
  alarm:       'sfx/alarm',         // solar flare alarm (get inside!)
  knockout:    'sfx/knockout',      // you were knocked out
  todo:        'sfx/todo',          // a to-do list item is done
  hit:         'sfx/hit',           // a space rock hits the ship (voyage)
  launch:      'sfx/launch',        // rocket launch
};

// Volume from 0 (silent) to 1 (full)
export const VOLUME = { music: 0.5, sfx: 0.8 };
