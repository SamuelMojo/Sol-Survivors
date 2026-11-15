// Pilot mini game for the rover stuck in the sand: UNSTICK THE ROVER.
// The rover starts half buried near the crash site (when a person is the Pilot). Tap Space (or click) to rev
// the motor. Keep the needle in the green band: too high and the motor overheats (the revs drop to zero and
// it cools for a moment), too low and it stalls. 5 seconds in the green in total frees the rover. Time in
// the green is never lost, so failing is gentle.
//
// 👤 Owner: Game logic & backend. Words: story/minigames.js (unstick). Opened by WorldScene.findTarget.
import { MiniGameScene, VT, PX } from './MiniGame.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

const TAP = 0.1;                 // revs added per tap
const DRAIN = 0.32;              // revs lost per second (the sand holds the wheels back)
const GREEN = [0.45, 0.75];      // the green band
const HOT = 0.93;                // above this the motor overheats
const RUNNING = 0.3;             // the motor counts as running once the revs get this high
const STALL = 0.12;              // the motor was running and dropped below this: it stalls
const COOL_MS = 1200;            // after overheating, taps do nothing for this long
const NEED_S = 5;                // seconds in the green to get free

/** Scene: keep the rover's revs in the green until it climbs out of the sand. */
export class UnstickGame extends MiniGameScene {
  constructor() { super('UnstickGame'); }
  get text() { return MINIGAME_TEXT.unstick; }
  /** Close if the rover got freed some other way (e.g. a snapshot from the leader). */
  shouldClose() { return !this.world?.rover?.stuck; }

  /** The rover in its sand mound, the rev gauge and the 'getting free' meter. */
  build() {
    const A = this.playArea;
    this.revs = 0; this.green = 0; this.coolUntil = 0; this.running = false; this.lastTap = 0;
    this.g = this.add.graphics().setDepth(1);
    this.fg = this.add.graphics().setDepth(3);
    this.carX = A.x + A.w / 2; this.carY = A.y + 92;
    this.car = this.add.image(this.carX, this.carY, 'rover-sheet', 0).setScale(3).setOrigin(0.5, 0.85).setDepth(2);
    this.gauge = { x: A.x + 30, y: A.y + 124, w: A.w - 60, h: 14 };
    this.add.text(this.gauge.x, this.gauge.y - 4, 'REVS', { ...VT, fontSize: '13px', color: '#c9ad93' }).setOrigin(0, 1).setDepth(5);
    this.add.text(this.gauge.x + this.gauge.w * (GREEN[0] + GREEN[1]) / 2, this.gauge.y - 4, 'GOOD', { ...VT, fontSize: '13px', color: '#7bd88f' }).setOrigin(0.5, 1).setDepth(5);
    this.add.text(this.gauge.x + this.gauge.w * (HOT + 1) / 2, this.gauge.y - 4, 'HOT', { ...VT, fontSize: '13px', color: '#ff5f5f' }).setOrigin(0.5, 1).setDepth(5);
    this.freeLabel = this.add.text(this.gauge.x, this.gauge.y + 30, 'FREE', { ...PX, fontSize: '8px' }).setOrigin(0, 0.5).setDepth(5);
    this.puffs = [];
    // Big click target: the whole play area revs the motor
    this.add.rectangle(A.x, A.y, A.w, A.h, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.tap());
    for (const k of ['SPACE', 'ENTER', 'UP', 'W']) this.input.keyboard.addKey(k).on('down', () => this.tap());
  }

  /** One tap on the pedal. */
  tap() {
    if (this.won) return;
    const now = this.time.now;
    if (now < this.coolUntil) return;
    if (now - this.lastTap < 60) return;           // no faster than ~16 a second
    this.lastTap = now;
    this.revs = Math.min(1, this.revs + TAP);
    if (this.revs >= RUNNING) this.running = true;   // the motor has properly started (so it can stall later)
  }

  /** Revs drain, green time adds up, overheating and stalling, then draw. */
  tick(time, delta) {
    const dt = delta / 1000, cooling = time < this.coolUntil;
    this.revs = Math.max(0, this.revs - DRAIN * dt * (1 + 0.25 * Math.sin(time / 300)));   // the sand grabs a bit more, then a bit less
    if (this.revs >= HOT && !cooling) {
      this.revs = 0; this.running = false; this.coolUntil = time + COOL_MS;
      this.cameras.main.shake(150, 0.006);
      this.say(this.text.hot, '#ff5f5f', 1800);
    } else if (this.running && this.revs < STALL) {
      this.running = false;
      this.say(this.text.stall, '#ffd34d', 1400);
    }
    const inGreen = this.revs >= GREEN[0] && this.revs <= GREEN[1];
    if (inGreen) this.green = Math.min(NEED_S, this.green + dt);
    if (this.green >= NEED_S) return this.free();
    this.draw(time, inGreen, cooling);
  }

  /** 5 seconds in the green: the rover climbs out of the sand. */
  free() {
    this.win();                 // sets this.won, so tick() stops
    this.draw(this.time.now, true, false);
    this.tweens.add({ targets: this.car, x: this.carX + 40, y: this.carY - 8, duration: 500, ease: 'Quad.easeOut' });
  }

  /** Drawing: sand, the rover (shaking with the revs), dust or smoke, and the two meters. */
  draw(time, inGreen, cooling) {
    const g = this.g, fg = this.fg, A = this.playArea, G = this.gauge;
    g.clear(); fg.clear();
    // the sky and the ground
    g.fillStyle(0xd68a5c, 0.25).fillRect(A.x, A.y, A.w, 70);
    g.fillStyle(0xb4572f).fillRect(A.x, A.y + 70, A.w, 36);
    // the rover shakes more the faster the motor goes, and its wheels turn when it revs
    const shake = this.won ? 0 : this.revs * 2.5;
    if (!this.won) this.car.setPosition(this.carX + (Math.random() - 0.5) * shake, this.carY + (Math.random() - 0.5) * shake * 0.5);
    this.car.setFrame(this.revs > 0.05 && Math.floor(time / (180 - this.revs * 140)) % 2 ? 1 : 0);
    // the sand mound over the wheels (shrinks as it digs out)
    const dig = this.green / NEED_S, mx = this.carX, my = this.carY + 2;
    fg.fillStyle(0xc9764a).fillEllipse(mx, my, 120 - 30 * dig, 34 - 16 * dig);
    fg.fillStyle(0xd68a5c).fillEllipse(mx - 14, my - 6, 70 - 20 * dig, 14 - 6 * dig);
    // flying sand (in the green) or smoke (too hot / cooling)
    if (time - (this.puffAt ?? 0) > 70 && (inGreen || cooling || this.revs > 0.8)) {
      this.puffAt = time;
      const hot = cooling || this.revs > 0.8;
      this.puffs.push({ x: mx + (hot ? 10 : -50), y: my - (hot ? 30 : 6), vx: hot ? 6 : -50 - Math.random() * 40, vy: -20 - Math.random() * 30, t: 0, hot });
    }
    for (const p of this.puffs) { p.t += 0.016; p.x += p.vx * 0.016; p.y += p.vy * 0.016; }
    this.puffs = this.puffs.filter(p => p.t < 0.7);
    for (const p of this.puffs) fg.fillStyle(p.hot ? 0x9aa3a8 : 0xe09a6c, 0.8 * (1 - p.t / 0.7)).fillCircle(p.x, p.y, 3 + p.t * 8);
    // the rev gauge: dark bar, green band, hot zone, needle
    g.fillStyle(0x160c11).fillRect(G.x, G.y, G.w, G.h);
    g.fillStyle(0x2f6b3c).fillRect(G.x + G.w * GREEN[0], G.y + 1, G.w * (GREEN[1] - GREEN[0]), G.h - 2);
    g.fillStyle(0x7a2a2a).fillRect(G.x + G.w * HOT, G.y + 1, G.w * (1 - HOT), G.h - 2);
    g.fillStyle(cooling ? 0x9aa3a8 : inGreen ? 0x7bd88f : 0xffd34d).fillRect(G.x + 1, G.y + 3, (G.w - 2) * this.revs, G.h - 6);
    const nx = G.x + G.w * this.revs;
    g.fillStyle(0xffffff).fillRect(nx - 1, G.y - 3, 3, G.h + 6);
    g.lineStyle(1, 0x9aa3a8).strokeRect(G.x, G.y, G.w, G.h);
    // how free the rover is
    this.meter(g, G.x + 40, G.y + 25, G.w - 40, 10, this.green / NEED_S);
  }
}
