// The floor plan of the mothership Perseverance VI, used in Scene Two (the voyage).
//
// 👤 Owner: Level design.  The story text for this scene is in story/voyage.js.
//
//   #  wall   w  window   .  floor   Capital letters: furniture (same letters as levels/rooms.js), plus:
//   X  wire panel (Builder)   1 2 3  oxygen leaks (Botanist)   s  pilot seat (Pilot)   *  where the crew starts
// Every row must be the same length. Keep exactly one X, one s, and the leaks 1, 2 and 3:
// the voyage code looks for those letters.
//   rooms: x0..x1 are the tile columns of each room (for the room name shown at the top of the screen)
export const SHIP = {
  rows: [
    '######################################################',
    '#........#...................#...........#...........#',
    '#..T.....#...................#...........#..B..B..B..#',
    '#........#....1.......2......#...X.......#...........#',
    '#...s................................................#',
    '#........#...................#...........#...........#',
    '#........#.........3.........#...........#....***....#',
    '#........#...................#...........#...........#',
    '######################################################',
  ],
  rooms: [
    { name: 'Cockpit', x0: 0, x1: 9 },
    { name: 'Lab & air supply', x0: 10, x1: 29 },
    { name: 'Engine room', x0: 30, x1: 41 },
    { name: 'Crew quarters', x0: 42, x1: 53 },
  ],
};

