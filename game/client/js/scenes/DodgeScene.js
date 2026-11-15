// Pilot's voyage task: steer the Perseverance VI through tumbling space debris (W/S or arrows): bits of solar panel,
// metal plates, broken struts and tiny flecks. The last, huge piece is a dead satellite.
// It keeps going until the rest of the crew has finished their repairs; then one last
// huge strike hits no matter what (the story needs it!).
//
// 👤 Owner: Game logic & backend. Opened from VoyageScene when the Pilot sits in the pilot seat.
import { SCREEN } from '/game/rules/settings.js';

const VT = { fontFamily: 'VT323', fontSize: '16px', color: '#fbefd5' };

// The kinds of debris (drawn in code, see drawDebris)
const KINDS = ['panel', 'plate', 'strut', 'fleck'];

/** Scene: the Pilot's dodge-the-debris mini-game (drawn over the voyage). */
export class DodgeScene extends Phaser.Scene {
  /** Register the scene under the name 'Dodge'. */
  constructor() { super('Dodge'); }
  /** d.onClose is called if the player leaves early with Esc. */
  init(d) { this.d = d; }

  /** Set up the starfield, the ship and the keys, and listen for the voyage's 'finalHit' signal. */
  create() {
    this.scene.bringToTop();
    const W = SCREEN.width, H = SCREEN.height;
    this.add.rectangle(0, 0, W, H, 0x05040c).setOrigin(0);
    this.stars = Array.from({ length: 80 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 20 + Math.random() * 120 }));
    this.rocks = []; this.hits = 0; this.dodged = 0; this.final = null;
    this.ship = { x: 70, y: H / 2 };
    this.g = this.add.graphics();
    // The Perseverance VI: the same rocket picture as on launch day and on Mars, lying on its side, nose to the right
    this.shipImg = this.add.image(this.ship.x, this.ship.y, 'rocket-ship').setAngle(90).setScale(0.45).setDepth(2);
    this.flame = this.add.graphics().setDepth(1);
    this.info = this.add.text(8, 6, '', VT).setStroke('#05040c', 3);
    this.add.text(W / 2, H - 6, 'W/S or ↑/↓ to steer · Keep flying until the crew finishes repairs', { ...VT, fontSize: '14px', color: '#c9ad93' }).setOrigin(0.5, 1);
    this.keys = this.input.keyboard.addKeys('W,S,UP,DOWN,ESC');
    this.keys.ESC.on('down', () => { this.d.onClose?.(); this.scene.stop(); });
    this.spawnAt = 0;
    const voyage = this.scene.get('Voyage');
    this.onFinal = () => this.startFinal();
    voyage.game.events.on('finalHit', this.onFinal);
    this.events.once('shutdown', () => voyage.game.events.off('finalHit', this.onFinal));
  }

  /** The crew has finished: send the huge piece of debris (a dead satellite) that can't be dodged. */
  startFinal() {
    if (this.final) return;
    this.final = { x: SCREEN.width + 40, y: this.ship.y, r: 22, a: 0 };
  }

  /** Every frame: steer the ship, move stars and rocks, count hits and dodges, then draw everything. */
  update(time, delta) {
    const dt = delta / 1000, W = SCREEN.width, H = SCREEN.height, k = this.keys, s = this.ship;
    s.y = Phaser.Math.Clamp(s.y + ((k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown)) * 150 * dt, 40, H - 30);
    for (const st of this.stars) { st.x -= st.s * dt; if (st.x < 0) { st.x = W; st.y = Math.random() * H; } }
    // A new piece of debris every 0.35-0.8 s (until the final piece comes), each tumbling at its own speed
    if (!this.final && time > this.spawnAt) {
      this.spawnAt = time + 350 + Math.random() * 450;
      const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
      this.rocks.push({ x: W + 10, y: 20 + Math.random() * (H - 40), r: kind === 'fleck' ? 3 + Math.random() * 2 : 5 + Math.random() * 6, v: 140 + Math.random() * 140, kind, a: Math.random() * 6.3, spin: (Math.random() - 0.5) * 6 });
    }
    // Move the debris; a piece touching the ship counts as a hit (just a shake: you can't fail this task)
    for (const r of this.rocks) {
      r.x -= r.v * dt; r.a += r.spin * dt;
      if (!r.hit && Math.hypot(r.x - s.x, r.y - s.y) < r.r + 9) { r.hit = true; this.hits++; this.cameras.main.shake(200, 0.015); this.cameras.main.flash(100, 255, 80, 80); }
      if (r.x < -20 && !r.hit && !r.counted) { r.counted = true; this.dodged++; }
    }
    this.rocks = this.rocks.filter(r => r.x > -30);
    if (this.final) {
      const f = this.final; f.x -= 260 * dt; f.a += 1.2 * dt; f.y += (s.y - f.y) * 3 * dt;            // it always finds you
      if (f.x < s.x + 20) { this.cameras.main.shake(800, 0.04); this.cameras.main.flash(500, 255, 255, 255); this.final = null; this.time.delayedCall(700, () => this.scene.stop()); }
    }
    // draw
    const g = this.g; g.clear();
    for (const st of this.stars) g.fillStyle(0xffffff, st.s / 140).fillRect(st.x, st.y, st.s > 90 ? 2 : 1, 1);
    this.shipImg.setPosition(s.x, s.y);
    this.flame.clear().fillStyle(0xff8a3d).fillRect(s.x - 28 - Math.random() * 5, s.y - 3, 8, 6).fillStyle(0xffd34d).fillRect(s.x - 24, s.y - 2, 4, 4);   // engine flame
    for (const r of this.rocks) this.drawDebris(g, r);
    if (this.final) this.drawSatellite(g, this.final);
    this.info.setText(`PILOT CONTROLS   Debris dodged: ${this.dodged}   Hits: ${this.hits}${this.final ? '   HUGE DEBRIS INCOMING!' : ''}`);
  }

  /** A filled box of half-size w x h around (x, y), turned by angle a. */
  box(g, x, y, w, h, a, color, alpha = 1) {
    const c = Math.cos(a), s = Math.sin(a), pts = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([px, py]) => new Phaser.Math.Vector2(x + px * c - py * s, y + px * s + py * c));
    g.fillStyle(color, alpha).fillPoints(pts, true);
  }

  /** One piece of tumbling space debris. Once it has hit the ship it goes dark and dented. */
  drawDebris(g, r) {
    const { x, y, a } = r, s = r.r, dim = r.hit;
    if (r.kind === 'panel') {                          // a broken bit of solar panel: blue cells in a grey frame
      this.box(g, x, y, s * 1.3, s * 0.8, a, dim ? 0x55595e : 0x9aa3a8);
      this.box(g, x, y, s * 1.1, s * 0.6, a, dim ? 0x2a3540 : 0x2d5a9a);
      this.box(g, x, y, s * 0.08, s * 0.6, a, 0x9aa3a8);
    } else if (r.kind === 'plate') {                   // a bent metal plate with a bolt
      this.box(g, x, y, s, s * 0.7, a, dim ? 0x55595e : 0xc6cdd1);
      this.box(g, x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.4, s * 0.5, s * 0.25, a + 0.4, dim ? 0x3f4448 : 0x8e949b);
      g.fillStyle(0x3a3f45).fillCircle(x - Math.cos(a) * s * 0.5, y - Math.sin(a) * s * 0.5, 1.2);
    } else if (r.kind === 'strut') {                   // a snapped strut with a joint at one end
      this.box(g, x, y, s * 1.6, s * 0.2, a, dim ? 0x55595e : 0xb0b6bb);
      g.fillStyle(dim ? 0x3f4448 : 0xff8a3d).fillCircle(x + Math.cos(a) * s * 1.6, y + Math.sin(a) * s * 1.6, s * 0.35);
    } else {                                           // a tiny fleck of paint or metal (fast, but still dangerous)
      this.box(g, x, y, s * 0.6, s * 0.4, a, dim ? 0x55595e : 0xe7ebef);
    }
  }

  /** The final piece: a big, dead satellite tumbling straight at you (it can't be dodged). */
  drawSatellite(g, f) {
    const { x, y, a, r } = f, c = Math.cos(a), s = Math.sin(a);
    this.box(g, x - c * r * 1.5, y - s * r * 1.5, r * 0.9, r * 0.45, a, 0x2d5a9a);   // solar panels
    this.box(g, x + c * r * 1.5, y + s * r * 1.5, r * 0.9, r * 0.45, a, 0x2d5a9a);
    this.box(g, x, y, r * 0.15, r * 0.08, a, 0x9aa3a8);
    this.box(g, x, y, r * 0.6, r * 0.6, a, 0xd9a426);                                  // the body, wrapped in gold foil
    this.box(g, x, y, r * 0.45, r * 0.45, a, 0xb8860b);
    g.fillStyle(0xe7ebef).fillCircle(x - s * r * 0.7, y + c * r * 0.7, r * 0.25);       // a broken dish
    g.fillStyle(0xffd34d, 0.35).fillCircle(x + 20, y, 10);                               // glinting in the sunlight
  }
}
