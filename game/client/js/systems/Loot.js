// Items lying on the ground and supply crates: spawning, opening, picking up, dropping.
// Every pile has an id (gid) so all players agree which pile is which.
// Picking up and opening go through net.claim(), so two players can never grab the same thing.
//
// 👤 Owner: Game logic & backend. What each spot can hold is set in levels/loot.js (Level design);
// the loot spots themselves are objects in the map (levels/map/mars.json, type "loot").
import { ITEMS, itemName } from '/game/rules/items.js';
import { rollAllSpots } from '/game/rules/loot.js';
import { roomFor } from '/game/rules/inventory.js';
import { net } from '../net.js';
import { makeRng } from '/game/rules/rng.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

const PICKUP_RANGE = 9;     // pixels from your feet
// How close (pixels) you must be to open a crate
const CRATE_RANGE = 16;

/** Everything you can pick up on the map: item piles on the ground and supply crates. */
export class Loot {
  /** Roll every loot spot (same result on every screen thanks to the shared seed) and place crates and piles. */
  constructor(scene, spots, obstacles, rnd, seed = 1) {
    this.scene = scene;
    this.obstacles = obstacles;
    this.seed = seed;                  // the game's shared seed: where a crate's items land is the same on every screen
    this.ground = [];
    this.crates = [];
    this.taken = new Set();            // piles someone has picked up: they must never come back (e.g. from a late crate spill)
    this.pending = new Set();          // piles we've asked the server for
    this.botPending = new Map();       // piles a computer crewmate asked for: gid -> give it to the bot
    rollAllSpots(spots, rnd, scene.basePoint ?? null).forEach((s, i) => {
      if (s.kind === 'crate') this.addCrate(s.x, s.y, s.items, i);
      else s.items.forEach((it, k) => this.addGround(s.x, s.y, it.id, it.n, null, null, `s${i}-${k}`));
    });
  }

  /** Place a closed crate. i is its number, used for claims ('crate:12') and network messages. */
  addCrate(x, y, items, i) {
    const img = this.scene.add.image(x, y, 'crate').setOrigin(0.5, 0.9).setDepth(y);
    this.crates.push({ i, x, y, items, img, open: false });
  }

  /** Put an item pile on the ground. `blockedFor` stops whoever dropped it from instantly picking it back up. */
  addGround(x, y, id, n, blockedFor = null, from = null, gid = null) {
    const s = this.scene;
    gid = gid ?? s.mp?.newGid() ?? `l${Math.random().toString(36).slice(2, 9)}`;
    if (this.ground.some(g => g.gid === gid)) return null;
    const shadow = s.add.ellipse(x, y, 9, 3, 0x000000, 0.35).setDepth(y - 1);
    const img = s.add.image(from?.x ?? x, from?.y ?? y, 'items', ITEMS[id].icon).setOrigin(0.5, 0.9).setDepth(y);
    if (from) {   // little toss animation from the crate or the player's hands
      s.tweens.add({ targets: img, x, duration: 300 });
      s.tweens.add({ targets: img, y: { from: from.y - 10, to: y }, duration: 300, ease: 'Bounce.easeOut' });
    }
    s.tweens.add({ targets: img, y: y - 2, duration: 900, yoyo: true, repeat: -1, delay: (from ? 320 : 0) + Math.random() * 800, ease: 'Sine.easeInOut' });
    const g = { gid, id, n, x, y, img, shadow, blockedFor, lastFull: 0 };
    // Glowing rock samples (for the Pilot): a soft green glow pulses under them, so they're easy to spot
    if (id === 'rock_sample') {
      g.glow = s.add.ellipse(x, y - 2, 22, 12, 0x7bff9a, 0.8).setDepth(y - 2).setStrokeStyle(1, 0xd8ffe0, 0.9);
      s.tweens.add({ targets: g.glow, scaleX: 1.5, scaleY: 1.5, alpha: 0.3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.ground.push(g);
    return g;
  }

  /** Take a pile off the map (its picture, shadow and list entry). */
  removeGround(g) {
    this.scene.tweens.killTweensOf(g.img);
    g.img.destroy(); g.shadow.destroy();
    if (g.glow) { this.scene.tweens.killTweensOf(g.glow); g.glow.destroy(); }
    const i = this.ground.indexOf(g); if (i >= 0) this.ground.splice(i, 1);
  }

  /** The server said someone took a pile. If it was me, it goes in my bag. */
  removeGroundById(gid, mine) {
    this.taken.add(gid);                       // even if this screen hasn't seen the pile yet
    const g = this.ground.find(g => g.gid === gid);
    this.pending.delete(gid);
    if (!g) return;
    const bot = this.botPending.get(gid);
    if (bot) { this.botPending.delete(gid); if (mine) bot(g); }
    else if (mine) this.scene.onPickedUp(g.id, g.n, g);
    this.removeGround(g);
  }

  /** A nearby spot that isn't inside a rock. */
  freeSpotNear(x, y, minD = 8, maxD = 18) {
    for (let t = 0; t < 30; t++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d * 0.7;
      const tile = this.obstacles.getTileAtWorldXY(nx, ny);
      const tooClose = this.ground.some(g => Math.hypot(g.x - nx, g.y - ny) < 7);
      if ((!tile || !tile.collides) && !tooClose) return { x: Math.round(nx), y: Math.round(ny) };
    }
    return { x, y: y + 8 };
  }

  /** The closest unopened crate within reach, or null. */
  nearestCrate(x, y) {
    let best = null, bd = CRATE_RANGE;
    for (const c of this.crates) if (!c.open) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  /** Show crate i as opened (just the picture: spillCrate puts its items on the ground). */
  markCrateOpen(i) {
    const c = this.crates.find(c => c.i === i);
    if (!c || c.open) return;
    c.open = true; c.img.setTexture('crate-open');
  }

  /** I opened a crate: spill its items and tell everyone where they landed. */
  async openCrate(c) {
    if (c.open || c.claiming) return null;
    c.claiming = true;
    const ok = await net.claim(`crate:${c.i}`);
    c.claiming = false;
    if (ok === null) { this.scene.toast?.('The connection is slow. Try opening the crate again.', '#ffd34d'); return null; }
    if (!ok) { this.spillCrate(c, false); return null; }     // someone beat me to it: it still pops open with its items
    return this.spillCrate(c);
  }

  /**
   * Where crate c's items land: the same spots on every screen (worked out from the game's seed and the
   * crate's number), so ANY screen can spill a crate by itself. Nobody has to wait for the opener's message,
   * which can get lost when a connection blinks: that used to leave crates open with nothing in them.
   */
  spillSpots(c) {
    const rnd = makeRng((this.seed ^ Math.imul(c.i + 1, 2654435761)) >>> 0), spots = [];
    for (const [k, it] of c.items.entries()) {
      let spot = { x: c.x + (k % 2 ? 9 : -9), y: c.y + 8 + 5 * Math.floor(k / 2) };
      for (let t = 0; t < 30; t++) {
        const a = rnd() * Math.PI * 2, d = 10 + rnd() * 10;
        const x = Math.round(c.x + Math.cos(a) * d), y = Math.round(c.y + 4 + Math.sin(a) * d * 0.7);
        const tile = this.obstacles.getTileAtWorldXY(x, y);
        if ((!tile || !tile.collides) && !spots.some(s => Math.hypot(s.x - x, s.y - y) < 7)) { spot = { x, y }; break; }
      }
      spots.push({ gid: `c${c.i}-${k}`, id: it.id, n: it.n, ...spot });
    }
    return spots;
  }

  /**
   * Open crate c and put its items on the ground (skipping any someone already picked up).
   * announce: I opened it, so tell the crew (they'd spill it themselves anyway when the server tells them).
   */
  spillCrate(c, announce = true) {
    if (!c || c.spilled) return null;
    c.spilled = true;
    this.markCrateOpen(c.i);
    this.scene.tweens.add({ targets: c.img, scaleX: 1.2, scaleY: 0.8, duration: 80, yoyo: true });
    for (const d of this.spillSpots(c)) if (!this.taken.has(d.gid)) this.addGround(d.x, d.y, d.id, d.n, null, c, d.gid);
    if (announce) this.scene.mp?.send('crateOpened', { i: c.i });
    return c.items;
  }

  /** Someone else opened a crate: spill it here too (same items, same spots). */
  openCrateRemote(i) { this.spillCrate(this.crates.find(c => c.i === i), false); }

  /** Auto pick-up anything you walk over (asks the server first). */
  update(player, inv, onFull, time) {
    // Piles you just dropped are skipped until you step away. A full bag shows a message (at most every 2.5 s).
    for (const g of this.ground) {
      const d = Math.hypot(g.x - player.x, g.y - player.y);
      if (g.blockedFor === player) { if (d > 18) g.blockedFor = null; else continue; }
      if (d > PICKUP_RANGE || this.pending.has(g.gid)) continue;
      // Job-only items (glowing rock samples: the Pilot's): anyone else just gets a reminder, at most every 2.5 s
      const only = ITEMS[g.id]?.job;
      if (only && only !== this.scene.job) { if (time - (this.lastJobToast ?? -1e9) > 2500) { this.lastJobToast = time; this.scene.toast?.(MINIGAME_TEXT.rocks.onlyPilot, '#ffd34d'); } continue; }
      if (roomFor(inv, g.id) < g.n) { if (time - g.lastFull > 2500) { g.lastFull = time; onFull(g.id); } continue; }
      this.pending.add(g.gid);
      net.claim(`g:${g.gid}`).then(ok => {
        if (ok === false) { this.taken.add(g.gid); if (this.ground.includes(g)) this.removeGround(g); }   // someone else already has it: it shouldn't be here
        if (!ok) { this.pending.delete(g.gid); return; }
        if (net.solo) this.removeGroundById(g.gid, true);   // solo: no server to echo it back
      });
    }
  }

  /** Floating "+2 Potato seeds" text above the player. */
  popText(x, y, text, color = '#fbefd5') {
    const t = this.scene.add.text(x, y - 18, text, { fontFamily: 'VT323', fontSize: '14px', color })
      .setOrigin(0.5).setDepth(100000).setStroke('#160c11', 3);
    this.scene.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 1400, onComplete: () => t.destroy() });
  }

  /** For rejoining players: the current piles and opened crates. */
  snapshot() { return { ground: this.ground.map(({ gid, id, n, x, y }) => ({ gid, id, n, x, y })), opened: this.crates.filter(c => c.open).map(c => c.i) }; }
  /** Replace all piles and crates with the leader's snapshot (when rejoining a game). */
  applySnapshot(s) {
    for (const g of [...this.ground]) this.removeGround(g);
    for (const d of s.ground) this.addGround(d.x, d.y, d.id, d.n, null, null, d.gid);
    // Opened crates: their piles are in the leader's list if they're still there; the rest were picked up
    const here = new Set(s.ground.map(d => d.gid));
    for (const i of s.opened) {
      const c = this.crates.find(c => c.i === i); if (!c) continue;
      this.markCrateOpen(i); c.spilled = true;
      c.items.forEach((_, k) => { if (!here.has(`c${i}-${k}`)) this.taken.add(`c${i}-${k}`); });
    }
  }
}

