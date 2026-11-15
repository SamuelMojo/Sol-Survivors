// Botanist mini game at night: FROST WATCH.
// Opens by itself when the Botanist comes into the greenhouse during a frost (Survival.frostWatch sets
// world.frost at about 21:00 if a bed has a growing crop).
//
// How it plays (about 20 seconds): the night bar at the top fills until the frost passes. Every growing bed
// cools down, each at its own speed (its thermometer drops and the soil turns blue). Click a bed (or press its
// number) to puff hot air on it. Every few seconds a COLD GUST blows across (with a warning first) and everything
// cools twice as fast. Saving a bed that's nearly frozen is a CLOSE SAVE, and close saves in a row make a streak.
// A bed whose thermometer reaches the bottom freezes: it stops growing until the morning (nothing is lost).
// When the night bar is full the frost has passed: you win, and every bed that didn't freeze is safe.
// Esc quits gently: beds that are still fairly warm are safe, the cold ones freeze.
//
// 👤 Owner: Game logic & backend. Words: story/minigames.js (frost). Opened from InteriorScene (greenhouse).
import { MiniGameScene, VT, PX } from './MiniGame.js';
import { MINIGAME_TEXT } from '/story/minigames.js';
import { CROPS, GROW_MINUTES } from '/game/rules/farm.js';
import { audio } from '../systems/Audio.js';

const KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
const NIGHT_MS = 20000;           // the frost passes after this long
const PUFF = 0.34;                // warmth from one puff of hot air
const COOL = [0.13, 0.22];        // warmth lost per second, slowest and fastest bed
const GUST_EVERY = [5000, 7000];  // time between cold gusts
const GUST_WARN = 1200, GUST_MS = 2200, GUST_X = 2.2;   // warning first, then the gust cools this many times faster
const CLOSE = 0.3;                // below this the bed is nearly frozen (a puff here is a close save)

/** Scene: keep the beds warm until the frost passes. */
export class FrostGame extends MiniGameScene {
  constructor() { super('FrostGame'); }
  get text() { return MINIGAME_TEXT.frost; }
  /** Close if the frost is over (e.g. morning came) while we were playing. */
  shouldClose() { return !this.world?.frost; }

  /** One card per growing bed: its plants, soil, thermometer and a big HEAT button. */
  build() {
    const A = this.playArea, w = this.world;
    this.beds = [];
    w.planters.forEach((p, i) => { if (p && (p.grown ?? 0) < GROW_MINUTES && !p.frozen) this.beds.push({ i, seed: p.seed, warm: 0.7 + Math.random() * 0.15, rate: COOL[0] + Math.random() * (COOL[1] - COOL[0]), frozen: false, flash: 0 }); });
    this.elapsed = 0; this.over = false; this.saves = 0; this.streak = 0; this.puffs = [];
    this.nextGust = 4000 + Math.random() * 1500; this.gust = null;
    // the night bar (top of the play area)
    this.nightY = A.y + 4;
    this.add.text(A.x + 2, this.nightY, this.text.passes, { ...VT, fontSize: '13px', color: '#c9ad93' }).setDepth(5);
    this.gustText = this.add.text(this.cx, A.y + 26, '', { ...PX, fontSize: '9px', color: '#9ad8ff' }).setOrigin(0.5, 0).setStroke('#160c11', 3).setDepth(20);
    this.scoreText = this.add.text(A.x + A.w - 2, this.nightY, '', { ...VT, fontSize: '13px', color: '#ffd34d' }).setOrigin(1, 0).setDepth(5);
    // the beds
    const n = this.beds.length, cols = Math.min(3, n), rows = Math.ceil(n / cols), top = A.y + 44;
    const cw = A.w / cols, ch = (A.y + A.h - top) / rows;
    this.g = this.add.graphics().setDepth(1);
    this.fx = this.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD);   // wind and warm air glow
    this.beds.forEach((b, k) => {
      b.x = A.x + cw * (k % cols) + cw / 2; b.y = top + ch * Math.floor(k / cols) + ch / 2; b.w = Math.min(cw - 14, 120); b.h = ch - 8;
      this.add.text(b.x - b.w / 2 + 2, b.y - b.h / 2 + 1, `${k + 1} ${CROPS[b.seed]?.name ?? ''}`, { ...VT, fontSize: '13px', color: '#c9ad93' }).setDepth(5);
      // the whole card is a button, and so is the big HEAT label
      this.add.zone(b.x, b.y, b.w, b.h).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.heat(b));
      b.btn = this.add.text(b.x, b.y + b.h / 2 - 3, this.text.heater, { ...VT, fontSize: '15px', color: '#160c11', backgroundColor: '#ff8a3d', padding: { x: 8, y: 1 } }).setOrigin(0.5, 1).setDepth(5);
      this.input.keyboard.addKey(KEYS[k]).on('down', () => this.heat(b));
    });
    if (!n) this.time.delayedCall(10, () => this.finish());     // nothing to save (shouldn't happen)
  }

  /** A puff of hot air on this bed. Saving a nearly frozen bed is a close save (and builds a streak). */
  heat(b) {
    if (b.frozen || this.over || this.won) return;
    const close = b.warm < CLOSE;
    b.warm = Math.min(1, b.warm + PUFF); b.flash = 1;
    if (close) { this.saves++; this.streak++; this.say(this.streak > 1 ? this.text.streak(this.streak) : this.text.close, '#ffd34d', 900); }
    else if (b.warm >= 1) this.streak = 0;                   // puffing a bed that's already toasty breaks the streak
    for (let k = 0; k < 4; k++) this.puffs.push({ x: b.x - 14 + (Math.random() - 0.5) * b.w * 0.6, y: b.y - 8, vy: -24 - Math.random() * 20, life: 1 });
    audio.sfx('click');
  }

  /** The frost has passed (or every bed froze): apply it to the world and show the result. */
  finish() {
    if (this.over) return;
    this.over = true;
    const w = this.world, saved = new Set(this.beds.filter(b => !b.frozen).map(b => b.i)), frozen = this.beds.filter(b => b.frozen).length;
    this.d.onWin = () => { w.freezeBeds(saved); w.frost = null; w.taskEvent('frost', frozen); };
    this.say(frozen ? this.text.froze(frozen) : this.text.saved, frozen ? '#6cc4ff' : '#7bd88f', 3000);
    this.gustText.setText('');
    this.time.delayedCall(900, () => this.win());
  }

  /** Esc: beds that are still fairly warm are safe, the cold ones freeze (gentle, nothing is lost). */
  quit() {
    if (this.closing || this.won) return;
    const w = this.world;
    if (w?.frost) { w.freezeBeds(new Set(this.beds.filter(b => !b.frozen && b.warm > 0.4).map(b => b.i))); w.frost = null; }
    this.close();
  }

  /** The night goes on: gusts come and go, beds cool and may freeze. Then draw everything. */
  tick(time, delta) {
    if (!this.over) {
      this.elapsed += delta;
      // cold gusts: a warning, then a few seconds of fast cooling
      if (!this.gust && this.elapsed >= this.nextGust - GUST_WARN) { this.gust = { warnUntil: this.nextGust, until: this.nextGust + GUST_MS }; this.gustText.setText(this.text.gustSoon); }
      const gusting = this.gust && this.elapsed >= this.gust.warnUntil;
      if (gusting && this.gustText.text !== this.text.gust) { this.gustText.setText(this.text.gust); this.cameras.main.shake(GUST_MS, 0.003); audio.sfx('hit'); }
      if (this.gust && this.elapsed >= this.gust.until) { this.gust = null; this.gustText.setText(''); this.nextGust = this.elapsed + GUST_EVERY[0] + Math.random() * (GUST_EVERY[1] - GUST_EVERY[0]); }
      for (const b of this.beds) {
        if (b.frozen) continue;
        b.warm -= b.rate * (gusting ? GUST_X : 1) * delta / 1000;
        if (b.warm <= 0) { b.warm = 0; b.frozen = true; this.streak = 0; b.btn.setStyle({ backgroundColor: '#6cc4ff' }).setText(this.text.frozen); this.cameras.main.flash(80, 160, 210, 255); }
        b.flash = Math.max(0, b.flash - delta / 300);
      }
      if (this.elapsed >= NIGHT_MS || this.beds.every(b => b.frozen)) this.finish();
    }
    this.scoreText.setText(this.saves ? this.text.saves(this.saves) : '');
    this.draw(time, delta, this.gust && this.elapsed >= this.gust.warnUntil);
  }

  /** The night bar, the beds (soil turns icy blue as it cools), thermometers, wind and warm puffs. */
  draw(time, delta, gusting) {
    const A = this.playArea, g = this.g, fx = this.fx; g.clear(); fx.clear();
    // night bar with a moon moving across it
    const bx = A.x + 92, bw = A.w - 180, t = Math.min(1, this.elapsed / NIGHT_MS);
    g.fillStyle(0x160c11).fillRect(bx, this.nightY + 4, bw, 8).fillStyle(0x3a5a9a).fillRect(bx + 1, this.nightY + 5, (bw - 2) * t, 6);
    g.fillStyle(0xf4efe6).fillCircle(bx + bw * t, this.nightY + 8, 5).fillStyle(0x22262b).fillCircle(bx + bw * t + 2, this.nightY + 6, 4);
    for (const b of this.beds) {
      const c = b.frozen ? 1 : 1 - b.warm, x0 = b.x - b.w / 2, y0 = b.y - b.h / 2;
      // the card: a red outline when it's nearly frozen
      g.lineStyle(2, b.frozen ? 0x6cc4ff : b.warm < CLOSE ? (Math.floor(time / 180) % 2 ? 0xff5f5f : 0x7a2a2a) : 0x55595e).strokeRect(x0, y0, b.w, b.h);
      // the soil, browner when warm, icy blue when cold
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(0x6b, 0x4a, 0x2c), new Phaser.Display.Color(0x9a, 0xd8, 0xff), 100, Math.round(c * 100));
      const sy = b.y - 4, sw = b.w - 34;
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b)).fillRect(x0 + 6, sy, sw, 16);
      for (const ox of [0.2, 0.5, 0.8]) {      // three little plants, drooping and icy as it gets cold
        const px = x0 + 6 + sw * ox, droop = Math.round(c * 4);
        g.fillStyle(b.frozen ? 0x9ad8ff : 0x4caf50).fillRect(px - 1, sy - 9 + droop, 2, 9 - droop);
        g.fillStyle(b.frozen ? 0xd8f0ff : 0x7bd88f).fillRect(px - 3 + (droop > 2 ? 1 : 0), sy - 10 + droop, 6, 3);
      }
      if (c > 0.45) for (let k = 0; k < Math.round(c * 10); k++) g.fillStyle(0xffffff, 0.85).fillRect(x0 + 8 + ((k * 37) % (sw - 4)), sy + 2 + ((k * 13) % 12), 2, 2);   // frost
      if (b.flash > 0) fx.fillStyle(0xff8a3d, 0.5 * b.flash).fillCircle(b.x - 14, sy + 6, 24);   // a warm glow where the hot air hit
      // thermometer on the right: red when warm, blue when cold, a mark at the danger line
      const tx = x0 + b.w - 20, ty = y0 + 18, th = b.h - 44;
      g.fillStyle(0x160c11).fillRect(tx, ty, 8, th).fillCircle(tx + 4, ty + th + 4, 6);
      const tc = b.frozen ? 0x6cc4ff : b.warm < CLOSE ? 0x6cc4ff : b.warm < 0.6 ? 0xffd34d : 0xff5f5f;
      g.fillStyle(tc).fillRect(tx + 2, ty + th * (1 - b.warm), 4, th * b.warm).fillCircle(tx + 4, ty + th + 4, 4);
      g.lineStyle(1, 0xffffff, 0.6).lineBetween(tx - 2, ty + th * (1 - CLOSE), tx + 10, ty + th * (1 - CLOSE));
    }
    // wind streaks during a gust
    if (gusting) for (let k = 0; k < 14; k++) { const yy = A.y + 40 + ((k * 53) % (A.h - 50)), xx = A.x + ((time / 2 + k * 97) % A.w); fx.lineStyle(1, 0xd8f0ff, 0.6).lineBetween(xx, yy, Math.min(A.x + A.w, xx + 26), yy - 2); }
    // warm puffs rising
    this.puffs = this.puffs.filter(p => (p.life -= delta / 700) > 0);
    for (const p of this.puffs) { p.y += p.vy * delta / 1000; fx.fillStyle(0xffd34d, p.life * 0.55).fillCircle(p.x, p.y, 1.5 + (1 - p.life) * 3); }
  }
}
