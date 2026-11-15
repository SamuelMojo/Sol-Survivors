// Builder mini game for the fission generators: SPLIT THE ATOM.
// A big uranium nucleus sits in the middle. Each press of Space (or a click) fires a neutron from the
// neutron gun on the left. Most miss, so press fast. A meter fills with hits and slowly drains if you
// stop. When it's full the nucleus splits in two with a flash, and 3 new neutrons fly off.
//
// 👤 Owner: Game logic & backend. Words: story/minigames.js (atom). Opened by WorldScene.repair().
import { MiniGameScene, VT } from './MiniGame.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

const HIT = 0.13;            // meter gained per hit (about 8 hits)
const DRAIN = 0.05;          // meter lost per second while you rest
const NUCLEUS_R = 18;
const SPREAD = 58;           // neutrons fly off at a random height within +-SPREAD: only the middle ones hit

/** Scene: fire neutrons at a uranium nucleus until it splits. */
export class AtomGame extends MiniGameScene {
  constructor() { super('AtomGame'); }
  get text() { return MINIGAME_TEXT.atom; }
  shouldClose() { return !!this.d.machine && !this.d.machine.broken; }

  /** The gun, the nucleus and the meter. */
  build() {
    const A = this.playArea;
    this.g = this.add.graphics().setDepth(1);
    this.meterVal = 0; this.neutrons = []; this.split = false; this.lastShot = 0;
    this.nuc = { x: A.x + A.w * 0.6, y: A.y + A.h / 2 - 8 };
    this.gun = { x: A.x + 30, y: this.nuc.y };
    this.add.text(this.nuc.x, this.nuc.y - 40, 'URANIUM', { ...VT, fontSize: '13px', color: '#c9ad93' }).setOrigin(0.5).setDepth(5);
    this.hitText = this.add.text(this.nuc.x, this.nuc.y + 36, '', { ...VT, fontSize: '16px', color: '#ffd34d' }).setOrigin(0.5).setDepth(5);
    // Big click target: the whole play area fires
    this.add.rectangle(A.x, A.y, A.w, A.h, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.fire());
    this.input.keyboard.addKey('SPACE').on('down', () => this.fire());
    this.input.keyboard.addKey('ENTER').on('down', () => this.fire());
  }

  /** Fire one neutron. Whether it hits is decided now (by its height); it just flies there. */
  fire() {
    if (this.split || this.won) return;
    const now = this.time.now;
    if (now - this.lastShot < 90) return;                    // no faster than ~10 a second
    this.lastShot = now;
    const dy = (Math.random() * 2 - 1) * SPREAD;
    const hit = Math.abs(dy) < NUCLEUS_R * 0.9;
    this.neutrons.push({ x: this.gun.x + 10, y: this.gun.y, vx: 260, vy: dy / ((this.nuc.x - this.gun.x) / 260), hit, done: false });
    this.gunKick = now;
  }

  /** Move neutrons, count hits, drain the meter, and draw everything. */
  tick(time, delta) {
    const dt = delta / 1000, A = this.playArea;
    if (!this.split) {
      this.meterVal = Math.max(0, this.meterVal - DRAIN * dt);
      for (const n of this.neutrons) {
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (!n.done && n.x >= this.nuc.x - NUCLEUS_R) {
          n.done = true;
          if (n.hit) { n.dead = true; this.meterVal = Math.min(1, this.meterVal + HIT); this.hitText.setText(this.text.hit); this.wobble = time; }
          else this.hitText.setText(this.text.miss).setColor('#c9ad93');
          if (n.hit) this.hitText.setColor('#ffd34d');
        }
      }
      this.neutrons = this.neutrons.filter(n => !n.dead && n.x < A.x + A.w + 10 && n.y > A.y - 10 && n.y < A.y + A.h + 10);
      if (this.meterVal >= 1) this.doSplit();
    }
    this.draw(time);
  }

  /** The meter is full: the nucleus splits into two with a flash, and 3 neutrons fly off. */
  doSplit() {
    this.split = true;
    this.cameras.main.flash(250, 255, 255, 200); this.cameras.main.shake(200, 0.01);
    this.hitText.setText(this.text.split).setColor('#7bd88f');
    this.halves = { t: 0 };
    this.flyoff = [0, 1, 2].map(i => ({ a: -0.6 + i * 0.6 + Math.random() * 0.2, s: 0 }));
    this.tweens.add({ targets: this.halves, t: 1, duration: 900, onComplete: () => this.win() });
  }

  /** Drawing: gun, nucleus (or its two halves), neutrons and the meter. */
  draw(time) {
    const g = this.g, A = this.playArea, N = this.nuc; g.clear();
    // the neutron gun
    const kick = this.gunKick && time - this.gunKick < 80 ? -3 : 0;
    g.fillStyle(0x6f777d).fillRect(this.gun.x - 22 + kick, this.gun.y - 9, 30, 18).fillStyle(0x9aa3a8).fillRect(this.gun.x - 22 + kick, this.gun.y - 9, 30, 3);
    g.fillStyle(0x3a3f45).fillRect(this.gun.x + 6 + kick, this.gun.y - 4, 10, 8);
    // nucleus: a bumpy ball of protons (red) and neutrons (grey)
    const drawBall = (x, y, r, wob) => {
      g.fillStyle(0xff5f5f, 0.35).fillCircle(x, y, r + 6 + wob);
      for (let i = 0; i < 14; i++) { const a = i * 2.4, rr = r * 0.62 * ((i % 3) / 3 + 0.4); g.fillStyle(i % 2 ? 0xff5f5f : 0x9aa3a8).fillCircle(x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.42); }
    };
    if (!this.split) {
      const wob = this.wobble && time - this.wobble < 150 ? 3 : 0;
      drawBall(N.x, N.y, NUCLEUS_R, wob);
    } else {
      const t = this.halves.t, d = 26 * t;
      drawBall(N.x - d, N.y - d * 0.4, NUCLEUS_R * 0.75, 0); drawBall(N.x + d, N.y + d * 0.4, NUCLEUS_R * 0.75, 0);
      g.fillStyle(0xffd34d, Math.max(0, 0.6 - t)).fillCircle(N.x, N.y, 10 + 60 * t);
      for (const f of this.flyoff) g.fillStyle(0xc6cdd1).fillCircle(N.x + Math.cos(f.a) * 90 * t, N.y + Math.sin(f.a) * 90 * t, 4);
    }
    for (const n of this.neutrons) g.fillStyle(0xc6cdd1).fillCircle(n.x, n.y, 4);
    // the meter
    const mw = A.w - 60;
    this.meter(g, A.x + 30, A.y + A.h - 14, mw, 10, this.meterVal, this.meterVal > 0.75 ? 0xffd34d : 0x7bd88f);
  }
}
