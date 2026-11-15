// Seeded random numbers. Every player's game uses the same seed (sent by the host),
// so the map's loot, flares, dust storms and broken panels are identical on every screen.
//
// 👤 Owner: Game logic & backend.

/**
 * Make a random number generator from a seed. Same seed = same numbers, in the same order.
 *   rnd() -> 0..1   rnd.int(lo, hi) -> whole number   rnd.shuffle(array)   rnd.pick(array)
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  const rnd = () => {           // mulberry32
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rnd.int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  rnd.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = rnd.int(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  rnd.pick = arr => arr[Math.floor(rnd() * arr.length)];
  return rnd;
}
