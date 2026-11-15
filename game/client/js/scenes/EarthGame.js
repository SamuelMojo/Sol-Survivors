// Pilot mini game at the laser comms console: HIT EARTH.
// Earth is a tiny dot drifting across the stars. Keep the laser's crosshair on it (mouse, or WASD / arrow
// keys) while the bar fills; it drains while you're off. About 10 seconds on target sends the message.
// Winning sends a message home (a reply arrives after the Earth-Mars delay) and ticks 'Send a message to Earth'.
//
// 👤 Owner: Game logic & backend. Words: story/minigames.js (earth). Opened by InteriorScene.radio.
import { MiniGameScene, VT } from './MiniGame.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

const FILL = 0.11;        // bar gained per second on target (about 9 s)
const DRAIN = 0.07;       // bar lost per second off target
const HIT_R = 12;         // how close the crosshair must be (pixels)
const AIM_SPEED = 130;    // crosshair speed with the keys (pixels per second)
const EARTH_SPEED = 26;   // how fast Earth drifts (pixels per second)

/** Scene: keep a laser on a drifting Earth. */
export class EarthGame extends MiniGameScene {
  constructor() { super('EarthGame'); }
  get text() { return MINIGAME_TEXT.earth; }
  /** Close if the laser comms stopped working (no power) while we played. */
  shouldClose() { return !!this.world && !this.world.equipment.working('laser_comms'); }

  /** Stars, Earth, the crosshair and the bar. */
  build() {
    const A = this.playArea;
    this.sky = { x: A.x, y: A.y, w: A.w, h: A.h - 34 };          // room under the sky for the bar (and a 2-line how-to)
    this.g = this.add.graphics().setDepth(1);
    this.stars = Array.from({ length: 50 }, () => ({ x: A.x + Math.random() * A.w, y: this.sky.y + Math.random() * this.sky.h, b: Math.random() }));
    this.earth = { x: A.x + A.w * 0.65, y: this.sky.y + this.sky.h * 0.4, vx: 0, vy: 0, a: Math.random() * 6.28 };
    this.aim = { x: this.cx, y: this.sky.y + this.sky.h / 2 };
    this.bar = 0;
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    // The mouse moves the crosshair (anywhere over the sky)
    this.input.on('pointermove', p => { this.aim.x = p.x; this.aim.y = p.y; this.clampAim(); });
    this.add.text(A.x + 4, this.sky.y + this.sky.h + 17, 'SIGNAL', { ...VT, fontSize: '13px', color: '#c9ad93' }).setOrigin(0, 1).setDepth(5);
  }

  /** Keep the crosshair inside the sky. */
  clampAim() {
    const S = this.sky;
    this.aim.x = Phaser.Math.Clamp(this.aim.x, S.x + 4, S.x + S.w - 4);
    this.aim.y = Phaser.Math.Clamp(this.aim.y, S.y + 4, S.y + S.h - 4);
  }

  /** Earth drifts (a smooth random walk), the keys move the crosshair, the bar fills or drains. */
  tick(time, delta) {
    const dt = delta / 1000, E = this.earth, S = this.sky, k = this.keys;
    E.a += (Math.random() - 0.5) * 3 * dt;                     // slowly turn
    E.vx += (Math.cos(E.a) * EARTH_SPEED - E.vx) * dt * 2; E.vy += (Math.sin(E.a) * EARTH_SPEED - E.vy) * dt * 2;
    E.x += E.vx * dt; E.y += E.vy * dt;
    const m = 24;                                               // bounce off the edges
    if (E.x < S.x + m || E.x > S.x + S.w - m) { E.a = Math.PI - E.a; E.x = Phaser.Math.Clamp(E.x, S.x + m, S.x + S.w - m); }
    if (E.y < S.y + m || E.y > S.y + S.h - m) { E.a = -E.a; E.y = Phaser.Math.Clamp(E.y, S.y + m, S.y + S.h - m); }
    const dx = (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown), dy = (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown);
    if (dx || dy) { this.aim.x += dx * AIM_SPEED * dt; this.aim.y += dy * AIM_SPEED * dt; this.clampAim(); }
    const on = Math.hypot(this.aim.x - E.x, this.aim.y - E.y) < HIT_R;
    this.bar = Phaser.Math.Clamp(this.bar + (on ? FILL : -DRAIN) * dt, 0, 1);
    this.draw(time, on);
    if (this.bar >= 1) { this.say(this.text.sent, '#7bd88f', 3000); this.win(); }
  }

  /** Drawing: stars, Earth (with its Moon), the laser beam, the crosshair and the bar. */
  draw(time, on) {
    const g = this.g, A = this.playArea, E = this.earth, S = this.sky; g.clear();
    g.fillStyle(0x05040a).fillRect(S.x, S.y, S.w, S.h);
    for (const s of this.stars) g.fillStyle(0xffffff, 0.3 + 0.5 * Math.abs(Math.sin(time / 700 + s.b * 6))).fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    // Earth: a tiny blue dot with a bit of green and white, and the Moon close by
    g.fillStyle(0x3d7bd9).fillCircle(E.x, E.y, 4);
    g.fillStyle(0x5fbf5f).fillRect(Math.round(E.x) - 2, Math.round(E.y) - 1, 2, 2);
    g.fillStyle(0xffffff, 0.8).fillRect(Math.round(E.x) + 1, Math.round(E.y) - 3, 2, 1);
    g.fillStyle(0xb0b0b0).fillCircle(E.x + 9, E.y - 5, 1.2);
    // the laser beam from the comms mast (bottom middle) to the crosshair
    const bx = this.cx, by = S.y + S.h;
    g.lineStyle(on ? 2 : 1, on ? 0x7bff9a : 0x7bd88f, on ? 0.9 : 0.35).lineBetween(bx, by, this.aim.x, this.aim.y);
    g.fillStyle(0x6f777d).fillRect(bx - 5, by - 6, 10, 6);
    // the crosshair
    const c = on ? 0x7bff9a : 0xffd34d, x = this.aim.x, y = this.aim.y, r = HIT_R;
    g.lineStyle(1, c).strokeCircle(x, y, r);
    g.lineBetween(x - r - 4, y, x - r + 3, y).lineBetween(x + r - 3, y, x + r + 4, y).lineBetween(x, y - r - 4, x, y - r + 3).lineBetween(x, y + r - 3, x, y + r + 4);
    // the signal bar
    this.meter(g, A.x + 56, S.y + S.h + 6, A.w - 64, 10, this.bar, on ? 0x7bff9a : 0x7bd88f);
  }
}
