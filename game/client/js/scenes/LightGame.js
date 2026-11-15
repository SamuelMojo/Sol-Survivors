// Botanist mini game at the greenhouse light panel: LIGHT RECIPE.
// Three sliders (red, green, blue) set the colour of the grow lights. Match the target glow: mostly red
// and blue with a little green (like NASA's Veggie garden). Until the lights are tuned, crops grow at
// half speed. Mouse: click or drag on a slider. Keyboard: 1/2/3 picks a slider, Up/Down moves it.
//
// 👤 Owner: Game logic & backend. Words: story/minigames.js (light). Opened from the light panel (InteriorScene).
import { MiniGameScene, VT, PX } from './MiniGame.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

const STEP = 0.05, CLOSE = 0.08;        // slider step, and how close every slider must be to win
const COLS = [0xff5f5f, 0x7bd88f, 0x6cc4ff];

/** Scene: match the target light colour with three sliders. */
export class LightGame extends MiniGameScene {
  constructor() { super('LightGame'); }
  get text() { return MINIGAME_TEXT.light; }
  /** Close if the lights got tuned some other way. */
  shouldClose() { return !!this.world?.lightsTuned; }

  /** The two glows (target and yours) and the three sliders. */
  build() {
    const A = this.playArea, T = this.text;
    // Target: mostly red and blue, a little green (rounded to slider steps)
    const r = v => Math.round(v / STEP) * STEP;
    this.target = [r(0.75 + Math.random() * 0.2), r(0.1 + Math.random() * 0.2), r(0.6 + Math.random() * 0.25)];
    this.val = [0.5, 0.5, 0.5];
    this.sel = 0;
    this.hintAt = this.time.now + 8000;        // after 8 s a faint tick shows where each target is (help for younger players)
    this.g = this.add.graphics().setDepth(1);
    this.glowY = A.y + 48;
    this.add.text(A.x + A.w * 0.3, A.y + 6, T.target, PX).setOrigin(0.5, 0).setDepth(5);
    this.add.text(A.x + A.w * 0.7, A.y + 6, T.yours, PX).setOrigin(0.5, 0).setDepth(5);
    // Sliders: three horizontal bars in the lower half
    this.bars = [T.red, T.green, T.blue].map((name, i) => {
      const y = A.y + 104 + i * 26, x = A.x + 70, w = A.w - 110;
      this.add.text(A.x + 10, y, `${i + 1} ${name}`, { ...VT, fontSize: '14px', color: `#${COLS[i].toString(16).padStart(6, '0')}` }).setOrigin(0, 0.5).setDepth(5);
      const hit = this.add.rectangle(x - 8, y - 11, w + 16, 22, 0x000000, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', p => { this.sel = i; this.setFromPointer(i, p.x); });
      hit.on('pointermove', p => { if (p.isDown) { this.sel = i; this.setFromPointer(i, p.x); } });
      return { x, y, w };
    });
    ['ONE', 'TWO', 'THREE'].forEach((k, i) => this.input.keyboard.addKey(k).on('down', () => { this.sel = i; }));
    this.input.keyboard.addKey('UP').on('down', () => this.nudge(STEP));
    this.input.keyboard.addKey('DOWN').on('down', () => this.nudge(-STEP));
    this.input.keyboard.addKey('W').on('down', () => this.nudge(STEP));
    this.input.keyboard.addKey('S').on('down', () => this.nudge(-STEP));
    this.input.keyboard.addKey('RIGHT').on('down', () => this.nudge(STEP));
    this.input.keyboard.addKey('LEFT').on('down', () => this.nudge(-STEP));
  }

  /** Set slider i from a pointer x position. */
  setFromPointer(i, px) {
    const b = this.bars[i];
    this.val[i] = Math.round(Phaser.Math.Clamp((px - b.x) / b.w, 0, 1) / STEP) * STEP;
    this.check();
  }
  /** Move the selected slider by d. */
  nudge(d) { this.val[this.sel] = Math.round(Phaser.Math.Clamp(this.val[this.sel] + d, 0, 1) / STEP) * STEP; this.check(); }

  /** Won when every slider is close to the target. */
  check() {
    const diffs = this.val.map((v, i) => Math.abs(v - this.target[i]));
    if (diffs.every(d => d <= CLOSE + 1e-6)) this.time.delayedCall(200, () => this.win());
    else if (diffs.every(d => d <= 0.2)) this.say(this.text.close, '#7bd88f', 800);
  }

  /** A colour from r, g, b in 0..1. */
  rgb(v) { return Phaser.Display.Color.GetColor(Math.round(v[0] * 255), Math.round(v[1] * 255), Math.round(v[2] * 255)); }

  /** Draw the glows and the sliders every frame. */
  tick(time) {
    const g = this.g, A = this.playArea; g.clear();
    const glow = (cx, v) => {
      const c = this.rgb(v);
      g.fillStyle(c, 0.25).fillCircle(cx, this.glowY, 34); g.fillStyle(c, 0.5).fillCircle(cx, this.glowY, 24); g.fillStyle(c, 1).fillCircle(cx, this.glowY, 14);
      // a little plant under the lamp
      g.fillStyle(0x4caf50).fillRect(cx - 1, this.glowY + 18, 2, 8).fillStyle(0x7bd88f).fillRect(cx - 4, this.glowY + 18, 8, 3);
    };
    glow(A.x + A.w * 0.3, this.target); glow(A.x + A.w * 0.7, this.val);
    this.bars.forEach((b, i) => {
      g.fillStyle(0x160c11).fillRect(b.x, b.y - 3, b.w, 6);
      g.fillStyle(COLS[i], 0.35).fillRect(b.x, b.y - 3, b.w * this.val[i], 6);
      if (time > this.hintAt) g.fillStyle(0xffffff, 0.5).fillRect(b.x + b.w * this.target[i] - 1, b.y - 7, 2, 14);   // where the target is (a faint tick, after a while)
      const kx = b.x + b.w * this.val[i];
      g.fillStyle(COLS[i]).fillRect(kx - 5, b.y - 8, 10, 16);
      if (i === this.sel) g.lineStyle(2, 0xffffff, 0.6 + 0.4 * Math.sin(time / 150)).strokeRect(kx - 7, b.y - 10, 14, 20);
    });
  }
}
