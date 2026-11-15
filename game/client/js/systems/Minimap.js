// The map in the bottom-right corner (it replaces the old compass). It starts dark: every part of Mars
// you (or a crewmate) walk near gets uncovered. On it:
//   white dot      you                       coloured dots   your crewmates (their job colour)
//   red squares    broken machines           yellow blink    where your NEXT task is
//   green square   the hab (home)           little rover    the rover
//   bright green   glowing rock samples (Pilot only)
// Click the map to make it big; click again to make it small.
//
// 👤 Owner: Game logic & backend. Colours of the ground come from the map's tiles (levels/map/mars.json).
import { SCREEN, WORLD, JOBS } from '/game/rules/settings.js';

const CHUNK = 5;                 // the map uncovers in squares of 5 x 5 tiles
const REVEAL = 3;                // how many squares around you get uncovered
const SMALL = 2 / 3, BIG = 2;    // pixels per tile, small and big
// Ground colour on the map for each tile id (anything not listed is plain sand)
const COLOURS = { 3: 0x8a3f26, 4: 0xc9764a, 5: 0xc9764a, 6: 0x8e3f22, 7: 0x9a9088, 8: 0x7a341c, 9: 0xc76d40, 10: 0x9a5236, 11: 0x7e6a3a, 12: 0x4a281d, 23: 0x8a4a2a };
const WALL = new Set([20, 21, 22]);

/** The explore-to-uncover map on the HUD. */
export class Minimap {
  /** Build the map picture once from the tile layers, and the fog that hides what nobody has explored. */
  constructor(hud, world) {
    this.hud = hud; this.w = world;
    const map = world.cache.tilemap.get('mars').data, Wt = map.width, Ht = map.height;
    this.Wt = Wt; this.Ht = Ht;
    const ground = map.layers.find(l => l.name === 'ground').data, obst = map.layers.find(l => l.name === 'obstacles').data;
    // The picture: one pixel per tile
    const key = 'minimap-base';
    if (!hud.textures.exists(key)) {
      const tex = hud.textures.createCanvas(key, Wt, Ht), ctx = tex.getContext();
      for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
        const o = obst[y * Wt + x] - 1, g = ground[y * Wt + x] - 1;
        const c = WALL.has(o) ? 0x3f1f12 : o >= 0 ? 0x6b3622 : COLOURS[g] ?? 0xb4572f;
        ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`; ctx.fillRect(x, y, 1, 1);
      }
      tex.refresh();
    }
    this.big = false;
    this.frame = hud.add.rectangle(0, 0, 10, 10, 0x2a1820, 0.95).setOrigin(0).setStrokeStyle(2, 0xf3d9a4);
    this.img = hud.add.image(0, 0, key).setOrigin(0);
    this.fog = hud.add.graphics();
    this.dots = hud.add.graphics();
    this.label = hud.add.text(0, 0, 'MAP (click)', { fontFamily: 'VT323', fontSize: '12px', color: '#c9ad93' }).setOrigin(1, 1);
    this.img.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.big = !this.big; this.layout(); });
    world.explored ??= new Set();
    this.layout();
  }

  /** Place the map: small in the corner, or big in the middle of the screen. */
  layout() {
    const s = this.big ? BIG : SMALL, w = this.Wt * s, h = this.Ht * s;
    const x = this.big ? (SCREEN.width - w) / 2 : SCREEN.width - w - 6, y = this.big ? (SCREEN.height - h) / 2 - 10 : SCREEN.height - h - 6;
    this.x = x; this.y = y; this.s = s;
    this.frame.setPosition(x - 2, y - 2).setSize(w + 4, h + 4);
    this.img.setPosition(x, y).setScale(s);
    this.label.setPosition(x + w, y - 3).setText(this.big ? 'MAP (click to close)' : 'MAP (click)');
    this.fogKey = '';
  }

  /** Uncover the squares around a spot (pixels). Returns true if anything new was uncovered. */
  reveal(px, py) {
    const cx = Math.floor(px / WORLD.tileSize / CHUNK), cy = Math.floor(py / WORLD.tileSize / CHUNK);
    let added = false;
    for (let j = -REVEAL + 1; j < REVEAL; j++) for (let i = -REVEAL; i <= REVEAL; i++) {
      const k = `${cx + i},${cy + j}`;
      if (!this.w.explored.has(k)) { this.w.explored.add(k); added = true; }
    }
    return added;
  }

  /** Where my NEXT task is on Mars (pixels), or null. */
  target() {
    const w = this.w, next = w.nextTask(), b = w.buildings;
    if (!next) return null;
    const zone = name => { const z = w.objects.find(o => o.type === 'zone' && o.name === name); return z && { x: z.x + z.width / 2, y: z.y + z.height / 2 }; };
    const machine = { moxie: 'moxie', power: 'fission_generator', lights: 'greenhouse_lights', laser: 'laser_comms', rocket: 'rocket' }[next.id];
    if (w.job === 'builder' && machine) return w.equipment.get(machine);
    return {
      moxie: zone('Crash Trail'), drive: w.rover, dunes: zone('Dune Sea'), parts: zone('Crash Trail'), rocketpart: zone('Reactor Wreck'),
      home: b.rocket?.door, seeds: zone('Crash Trail'), plant: b.greenhouse?.door, harvest: b.greenhouse?.door, kinds: b.greenhouse?.door, pantry: b.hab?.door,
      rocks: w.inv.some(s => s?.id === 'rock_sample') ? b.workshop?.door : this.nearestRock(), earth: b.comms?.door,
      tune: b.greenhouse?.door, fertilize: w.inv.some(s => s?.id === 'fertilizer') ? b.greenhouse?.door : b.hab?.door,
    }[next.id] ?? null;
  }

  /** The glowing rock sample nearest to me (Pilot), or null. */
  nearestRock() {
    const p = this.w.player;
    let best = null, bd = Infinity;
    for (const g of this.w.loot.ground) if (g.id === 'rock_sample') { const d = Math.hypot(g.x - p.x, g.y - p.y); if (d < bd) { bd = d; best = g; } }
    return best;
  }

  /** Every frame: uncover around everyone, then draw the fog and the dots. */
  update(time) {
    const w = this.w, p = w.player, crew = [...(w.mp?.remotes.values() ?? [])];
    let changed = !w.inside && this.reveal(p.x, p.y);
    for (const r of crew) if (!r.inside && r.connected !== false) changed = this.reveal(r.x, r.y) || changed;
    const key = `${w.explored.size}|${this.s}`;
    if (changed || key !== this.fogKey) {          // redraw the fog only when something changed
      this.fogKey = key;
      const f = this.fog; f.clear().fillStyle(0x0b0710, 1);
      const cs = CHUNK * this.s;
      for (let cy = 0; cy * CHUNK < this.Ht; cy++) for (let cx = 0; cx * CHUNK < this.Wt; cx++)
        if (!w.explored.has(`${cx},${cy}`)) f.fillRect(this.x + cx * cs, this.y + cy * cs, Math.min(cs, (this.Wt - cx * CHUNK) * this.s), Math.min(cs, (this.Ht - cy * CHUNK) * this.s));
    }
    // Dots
    const d = this.dots; d.clear();
    const at = (o, size, col) => { if (!o) return; const tx = this.x + o.x / WORLD.tileSize * this.s, ty = this.y + o.y / WORLD.tileSize * this.s; d.fillStyle(col).fillRect(Math.round(tx - size / 2), Math.round(ty - size / 2), size, size); };
    const sz = this.big ? 6 : 3;
    at(w.buildings.hab?.door, sz + 1, 0x7bd88f);
    // The rover: a little rover picture (bigger and blinking for the Pilot, who drives it)
    if (!w.inRover) {
      const rx = Math.round(this.x + w.rover.x / WORLD.tileSize * this.s), ry = Math.round(this.y + w.rover.y / WORLD.tileSize * this.s);
      const k = this.big ? 2 : 1, show = w.job !== 'pilot' || Math.floor(time / 500) % 2 === 0 || this.big;
      if (show) d.fillStyle(0xe8e8e8).fillRect(rx - 3 * k, ry - 2 * k, 6 * k, 3 * k).fillStyle(0xff8a3d).fillRect(rx - 2 * k, ry - 3 * k, 4 * k, k).fillStyle(0x222222).fillRect(rx - 3 * k, ry + k, 2 * k, k).fillRect(rx + k, ry + k, 2 * k, k);
    }
    for (const e of w.equipment.list) if (e.broken) at(e, sz, 0xff5f5f);
    // Glowing rock samples (only the Pilot can pick them up): a little green cross, so they don't look like the hub
    if (w.job === 'pilot') for (const g of w.loot.ground) if (g.id === 'rock_sample') {
      const tx = Math.round(this.x + g.x / WORLD.tileSize * this.s), ty = Math.round(this.y + g.y / WORLD.tileSize * this.s), a = this.big ? 4 : 2, b = this.big ? 2 : 1;
      d.fillStyle(0x7bff9a).fillRect(tx - a, ty - b / 2, a * 2 + 1, b).fillRect(tx - b / 2, ty - a, b, a * 2 + 1);
    }
    if (Math.floor(time / 350) % 2) at(this.target(), sz + 2, 0xffd34d);
    for (const r of crew) if (r.connected !== false && !r.inside) at(r.driving || r.riding ? w.rover : r, sz, Phaser.Display.Color.HexStringToColor(JOBS[r.job].color).color);
    at(w.inRover ? w.rover : p, sz + 1, 0xffffff);
  }
}
