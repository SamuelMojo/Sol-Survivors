// Builder mini game for the greenhouse lights, the laser comms and the rocket: WELD THE CRACK.
// A crack runs across a metal plate. Hold the mouse button and trace along the crack from its start.
// Stray off the line and the bit you were on cools down and must be welded again. Each machine has its
// own crack shape (the rocket's is the hardest). Mouse only: tracing needs a pointer.
//
// 👤 Owner: Game logic & backend. Words: story/minigames.js (weld). Opened by WorldScene.repair().
import { MiniGameScene, VT } from './MiniGame.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

// One crack per machine: points (0..1 of the play area), how many bits it's welded in, and how close you must stay (px)
const CRACKS = {
  greenhouse_lights: { pts: [[0.1, 0.5], [0.3, 0.35], [0.5, 0.6], [0.7, 0.4], [0.9, 0.55]], bits: 3, tol: 14 },
  laser_comms:       { pts: [[0.1, 0.7], [0.25, 0.3], [0.45, 0.25], [0.55, 0.6], [0.75, 0.75], [0.9, 0.35]], bits: 4, tol: 12 },
  rocket:            { pts: [[0.08, 0.3], [0.22, 0.7], [0.32, 0.25], [0.5, 0.75], [0.6, 0.3], [0.75, 0.65], [0.92, 0.25]], bits: 5, tol: 10 },
};

/** Scene: trace along a crack with the mouse to weld it shut. */
export class WeldGame extends MiniGameScene {
  constructor() { super('WeldGame'); }
  get text() { return MINIGAME_TEXT.weld; }
  get title() { return `${this.text.title}: ${this.text.names[this.d.machine?.key] ?? ''}`; }
  shouldClose() { const m = this.d.machine; return !!m && (m.key === 'rocket' ? m.progress >= m.def.steps : !m.broken); }

  /** Lay out the crack for this machine. */
  build() {
    const A = this.playArea, c = CRACKS[this.d.machine?.key] ?? CRACKS.greenhouse_lights;
    this.tol = c.tol;
    this.pts = c.pts.map(([px, py]) => ({ x: A.x + 20 + px * (A.w - 40), y: A.y + 10 + py * (A.h - 40) }));
    // The crack as a list of tiny steps along its length, so progress is a number of steps
    this.steps = [];
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i], n = Math.ceil(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 2);
      for (let k = 0; k < n; k++) this.steps.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
    }
    this.steps.push(this.pts[this.pts.length - 1]);
    this.bitLen = Math.ceil(this.steps.length / c.bits);
    this.pos = 0;                  // welded up to this step
    this.g = this.add.graphics().setDepth(1);
    this.torch = this.add.graphics().setDepth(20);
    this.add.text(this.pts[0].x, this.pts[0].y - 16, 'START', { ...VT, fontSize: '12px', color: '#7bd88f' }).setOrigin(0.5).setDepth(5);
  }

  /** Follow the pointer: advance along the crack while it stays close; cool the current bit if it strays. */
  tick(time) {
    const p = this.input.activePointer;
    this.draw(time, p);
    if (!p.isDown || this.pos >= this.steps.length - 1) return;
    // How far along the crack is the pointer, if it's close to the next bit of crack?
    const ahead = Math.min(this.steps.length - 1, this.pos + 12);
    let best = -1, bd = this.tol;
    for (let i = Math.max(0, this.pos - 3); i <= ahead; i++) { const d = Phaser.Math.Distance.Between(p.x, p.y, this.steps[i].x, this.steps[i].y); if (d < bd) { bd = d; best = i; } }
    if (best > this.pos) { this.pos = best; this.lastGood = time; if (this.pos >= this.steps.length - 1) return this.time.delayedCall(250, () => this.win()); }
    else if (best < 0) {
      // Off the line with the torch on: only counts if you were welding a moment ago (so just holding the button somewhere else is harmless)
      const onLine = this.steps.some(s => Phaser.Math.Distance.Between(p.x, p.y, s.x, s.y) < this.tol * 1.6);
      if (this.pos > 0 && this.lastGood && time - this.lastGood < 600 && !onLine) {
        this.pos = Math.floor(this.pos / this.bitLen) * this.bitLen;   // back to the start of this bit
        this.lastGood = 0; this.cameras.main.shake(120, 0.006);
        this.say(this.text.cooled);
      }
    }
  }

  /** The plate, the crack (dark), the welded part (bright) and the torch at the pointer. */
  draw(time, p) {
    const g = this.g, A = this.playArea; g.clear();
    g.fillStyle(0x6f777d).fillRect(A.x, A.y, A.w, A.h - 24).fillStyle(0x8e949b).fillRect(A.x, A.y, A.w, 3);
    for (let i = 0; i < 6; i++) g.fillStyle(0x55595e).fillCircle(A.x + 10 + (i % 3) * ((A.w - 20) / 2), A.y + 10 + Math.floor(i / 3) * (A.h - 44), 2);   // rivets
    g.lineStyle(5, 0x1b1d20);
    for (let i = 1; i < this.steps.length; i++) g.lineBetween(this.steps[i - 1].x, this.steps[i - 1].y, this.steps[i].x, this.steps[i].y);
    g.lineStyle(4, 0xff8a3d);
    for (let i = 1; i <= this.pos; i++) g.lineBetween(this.steps[i - 1].x, this.steps[i - 1].y, this.steps[i].x, this.steps[i].y);
    // bit markers, so you can see where a cooled bit starts again
    for (let i = this.bitLen; i < this.steps.length; i += this.bitLen) g.fillStyle(0xc6cdd1).fillCircle(this.steps[i].x, this.steps[i].y, 2);
    const cur = this.steps[Math.min(this.pos, this.steps.length - 1)];
    if (this.pos < this.steps.length - 1) g.fillStyle(0xffd34d, 0.5 + 0.5 * Math.sin(time / 120)).fillCircle(cur.x, cur.y, 6);   // where to weld next
    const t = this.torch; t.clear();
    if (p.x > A.x && p.x < A.x + A.w && p.y > A.y && p.y < A.y + A.h) {
      t.fillStyle(0x3a3f45).fillRect(p.x + 2, p.y - 2, 14, 5).fillStyle(0x6cc4ff, p.isDown ? 1 : 0.4).fillCircle(p.x, p.y, 3);
      if (p.isDown) for (let i = 0; i < 4; i++) t.fillStyle(0xffd34d).fillRect(p.x + (Math.random() - 0.5) * 12, p.y + (Math.random() - 0.5) * 12, 2, 2);
    }
    const mw = A.w - 60;
    this.meter(g, A.x + 30, A.y + A.h - 14, mw, 10, this.pos / (this.steps.length - 1));
  }
}
