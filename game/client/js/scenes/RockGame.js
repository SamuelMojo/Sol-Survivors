// Pilot mini game at the workshop microscope desk: ROCK SAMPLE.
// Look through the microscope at a glowing rock sample and click the mineral that matches it:
//   olivine   (green angular crystals)    hematite (grey-red round balls)    carbonate (pale layers)
// Mouse: click a picture. Keyboard: 1, 2 or 3. A wrong pick just shakes the picture: look again.
// Winning uses up 1 rock sample and ticks the Pilot's 'Analyze 3 glowing rocks' to-do (InteriorScene.microscopeTarget).
//
// 👤 Owner: Game logic & backend. Words: story/minigames.js (rocks). Opened by InteriorScene.microscopeTarget.
import { MiniGameScene, VT } from './MiniGame.js';
import { MINIGAME_TEXT } from '/story/minigames.js';
import { countItem } from '/game/rules/inventory.js';

const MINERALS = ['olivine', 'hematite', 'carbonate'];

/** Scene: match what you see in the microscope to one of three mineral pictures. */
export class RockGame extends MiniGameScene {
  constructor() { super('RockGame'); }
  get text() { return MINIGAME_TEXT.rocks; }
  /** Close if I somehow no longer carry a rock sample. */
  /** The Perseverance fact shows only after the first sample (you study 3). */
  get factOnce() { return true; }
  shouldClose() { return !!this.world && countItem(this.world.inv, 'rock_sample') < 1; }

  /** The microscope view and the three mineral cards. */
  build() {
    const A = this.playArea, T = this.text;
    this.picked = false;                                   // (scenes are reused: reset everything here)
    this.answer = this.d.mineral ?? MINERALS[Math.floor(Math.random() * MINERALS.length)];
    this.seed = Math.floor(Math.random() * 1000);        // so each sample looks a little different
    const g = this.add.graphics().setDepth(1);
    // The microscope's eyepiece: a black ring around a lit circle with the sample in it
    const cx = this.cx, cy = A.y + 52, r = 48;
    g.fillStyle(0x0b0710).fillCircle(cx, cy, r + 8);
    g.fillStyle(0x3a3f45).fillCircle(cx, cy, r + 5);
    this.drawMineral(g, this.answer, cx, cy, r, 1.6, this.seed);
    // a ring on top, to hide the edges of the drawing
    g.lineStyle(8, 0x3a3f45).strokeCircle(cx, cy, r + 3);
    g.fillStyle(0xffffff, 0.12).fillCircle(cx - r * 0.35, cy - r * 0.35, r * 0.25);    // a glint on the glass
    // The three cards to pick from
    const cw = 118, ch = 72, gap = 8, y0 = A.y + 112, x0 = this.cx - (cw * 3 + gap * 2) / 2;
    this.cards = MINERALS.map((m, i) => {
      const x = x0 + i * (cw + gap);
      const box = this.add.rectangle(x, y0, cw, ch, 0x160c11).setOrigin(0).setStrokeStyle(2, 0x9aa3a8).setDepth(2)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pick(i))
        .on('pointerover', () => box.setStrokeStyle(2, 0xffd34d)).on('pointerout', () => box.setStrokeStyle(2, 0x9aa3a8));
      const pic = this.add.graphics().setDepth(3);
      // a small square picture of the mineral (masked into a square by drawing inside it)
      this.drawMineral(pic, m, x + 20, y0 + 24, 15, 0.7, 7 + i, true);
      const name = this.add.text(x + 40, y0 + 10, `${i + 1} ${T.minerals[m].name}`, { ...VT, fontSize: '14px', color: '#ffd34d' }).setDepth(3);
      const look = this.add.text(x + 40, y0 + 28, T.minerals[m].look, { ...VT, fontSize: '13px', color: '#c9ad93', wordWrap: { width: cw - 44 } }).setDepth(3);
      return { m, x, box, parts: [box, pic, name, look] };
    });
    ['ONE', 'TWO', 'THREE'].forEach((k, i) => this.input.keyboard.addKey(k).on('down', () => this.pick(i)));
  }

  /** Clicked (or pressed the number of) card i. */
  pick(i) {
    if (this.won || this.picked) return;
    const c = this.cards[i];
    if (c.m === this.answer) {
      this.picked = true;
      c.box.setStrokeStyle(3, 0x7bd88f);
      this.say(`${this.text.right} ${this.text.minerals[c.m].name}!`, '#7bd88f', 2000);
      this.time.delayedCall(700, () => this.win());
      return;
    }
    // Wrong: a gentle shake and a hint, then try again
    c.box.setStrokeStyle(2, 0xff5f5f);
    this.tweens.add({ targets: c.parts, x: '+=4', duration: 50, yoyo: true, repeat: 3, onComplete: () => c.box.setStrokeStyle(2, 0x9aa3a8) });
    this.say(this.text.wrong, '#ffd34d', 1800);
  }

  /**
   * Draw a mineral in a circle (or a square, for the small pictures) at (cx, cy), radius r.
   * k: how big the bits are. seed: where the bits go (a tiny fixed pattern, no Math.random, so it doesn't flicker).
   */
  drawMineral(g, m, cx, cy, r, k, seed, square = false) {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const inside = (x, y, m = 0) => square ? Math.abs(x - cx) < r - m && Math.abs(y - cy) < r - m : Math.hypot(x - cx, y - cy) < r - 2;
    const bg = { olivine: 0x2a2620, hematite: 0x8a5a4a, carbonate: 0xd8cbb0 }[m];
    if (square) g.fillStyle(bg).fillRect(cx - r, cy - r, r * 2, r * 2); else g.fillStyle(bg).fillCircle(cx, cy, r);
    if (m === 'olivine') {
      // green angular crystals: little diamonds and triangles in greens
      for (let i = 0; i < 26 * (square ? 1 : 1); i++) {
        const x = cx + (rnd() * 2 - 1) * r, y = cy + (rnd() * 2 - 1) * r, sz = (5 + rnd() * 6) * k;
        if (!inside(x, y, sz)) continue;
        const col = [0x6f9e3a, 0x8fc04a, 0x4f7a2a, 0xa8d060][Math.floor(rnd() * 4)];
        g.fillStyle(col).fillTriangle(x, y - sz, x + sz * 0.7, y, x - sz * 0.6, y + sz * 0.3);
        g.fillStyle(0xd8f08a, 0.6).fillTriangle(x, y - sz, x + sz * 0.3, y - sz * 0.4, x - sz * 0.15, y - sz * 0.35);   // a shiny edge
      }
    } else if (m === 'hematite') {
      // grey-red round balls
      for (let i = 0; i < 18 * (square ? 1 : 1); i++) {
        const x = cx + (rnd() * 2 - 1) * r, y = cy + (rnd() * 2 - 1) * r, rr = (3 + rnd() * 3) * k;
        if (!inside(x, y, rr + 1)) continue;
        g.fillStyle(0x3a2a2a, 0.5).fillCircle(x + 1, y + 1.5, rr);           // shadow
        g.fillStyle([0x6f6670, 0x7d5a58, 0x5e5560][Math.floor(rnd() * 3)]).fillCircle(x, y, rr);
        g.fillStyle(0xc8bcc4, 0.6).fillCircle(x - rr * 0.35, y - rr * 0.35, rr * 0.3);   // shine
      }
    } else {
      // pale layers: wavy stripes in cream and beige
      const cols = [0xefe4cc, 0xc9b892, 0xe2d4b4, 0xb8a47c];
      for (let row = -r, n = 0; row < r; row += 4 * k, n++) {
        g.fillStyle(cols[n % cols.length]);
        for (let x = -r; x < r; x += 2) {
          const y = row + Math.sin((x + seed * 3) / (9 * k)) * 2 * k;
          if (inside(cx + x, cy + y)) g.fillRect(cx + x, cy + y, 2, Math.max(1, 2.5 * k));
        }
      }
    }
  }
}
