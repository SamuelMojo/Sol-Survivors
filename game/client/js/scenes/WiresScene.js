// Builder's voyage task. First a metal cover panel held by 4 screws: click each screw 3 times (or press 1-4)
// to take it out, and the panel slides off. Then reconnect 4 cut wires: click (or press 1-4) a wire on the
// left, then click (or press 1-4) the socket of the same colour on the right.
//
// 👤 Owner: Game logic & backend. Opened from VoyageScene when the Builder uses the wire panel.
import { SCREEN } from '/game/rules/settings.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

const SCREWS = MINIGAME_TEXT.screws;      // words for the screw panel that covers the wires
// The 4 wire colours and their names (for the 'wrong socket' message)
const COLORS = [0xff5f5f, 0x6cc4ff, 0xffd34d, 0x7bd88f];
const NAMES = ['red', 'blue', 'yellow', 'green'];
const VT = { fontFamily: 'VT323', fontSize: '16px', color: '#fbefd5' };

/** Scene: the Builder's wire-matching mini-game (a panel drawn over the voyage). */
export class WiresScene extends Phaser.Scene {
  /** Register the scene under the name 'Wires'. */
  constructor() { super('Wires'); }
  /** d.onDone is called when all 4 wires are joined; d.onClose if the player leaves with Esc. */
  init(d) { this.d = d; }

  /** Shuffle the wires and sockets, draw the panel, and set up clicks and the 1-4 keys. */
  create() {
    this.scene.bringToTop();
    const W = SCREEN.width, H = SCREEN.height;
    this.left = Phaser.Utils.Array.Shuffle([0, 1, 2, 3]);
    this.right = Phaser.Utils.Array.Shuffle([0, 1, 2, 3]);
    this.joined = new Set(); this.sel = null;
    this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive();
    this.add.rectangle(W / 2, H / 2, 300, 230, 0x22262b).setStrokeStyle(3, 0x9aa3a8);
    this.add.text(W / 2, H / 2 - 104, 'ENGINE ROOM WIRING PANEL', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' }).setOrigin(0.5);
    this.help = this.add.text(W / 2, H / 2 + 98, 'Pick a wire on the left (1-4), then its matching socket (1-4)', { ...VT, fontSize: '14px' }).setOrigin(0.5).setDepth(200);   // above the screw cover too
    this.g = this.add.graphics();
    this.ly = i => H / 2 - 70 + i * 44;
    this.lx = W / 2 - 120; this.rx = W / 2 + 120;
    for (let i = 0; i < 4; i++) {
      this.add.rectangle(this.lx, this.ly(i), 26, 14, COLORS[this.left[i]]).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pickLeft(i));
      this.add.text(this.lx - 22, this.ly(i), String(i + 1), VT).setOrigin(0.5);
      this.add.rectangle(this.rx, this.ly(i), 18, 18, 0x111111).setStrokeStyle(3, COLORS[this.right[i]]).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pickRight(i));
      this.add.text(this.rx + 22, this.ly(i), String(i + 1), VT).setOrigin(0.5);
    }
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((k, i) => this.input.keyboard.addKey(k).on('down', () => this.covered ? this.turnScrew(i) : this.sel == null ? this.pickLeft(i) : this.pickRight(i)));
    this.input.keyboard.addKey('ESC').on('down', () => { this.d.onClose?.(); this.scene.stop(); });
    this.draw();
    this.buildCover(W, H);
  }

  // ---------- the cover panel with 4 screws (before the wires) ----------
  /** A metal cover sits over the wires, held by 4 screws. Click each screw 3 times (or press 1-4) to take it out. */
  buildCover(W, H) {
    this.covered = true;
    this.help.setText(SCREWS.how);
    const C = this.cover = this.add.container(0, 0).setDepth(100);
    const plate = this.add.rectangle(W / 2, H / 2 + 12, 296, 196, 0x6f777d).setStrokeStyle(2, 0x9aa3a8).setInteractive();   // blocks clicks on the wires below
    C.add(plate);
    C.add(this.add.rectangle(W / 2, H / 2 + 12, 296, 4, 0x8e949b).setOrigin(0.5, 0));
    C.add(this.add.text(W / 2, H / 2 + 12, SCREWS.plate, { ...VT, fontSize: '14px', color: '#ffd34d' }).setOrigin(0.5));
    this.screws = [];
    const spots = [[-130, -78], [130, -78], [-130, 78], [130, 78]];
    spots.forEach(([dx, dy], i) => {
      const x = W / 2 + dx, y = H / 2 + 12 + dy;
      const head = this.add.circle(x, y, 9, 0xc6cdd1).setStrokeStyle(1, 0x55595e).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.turnScrew(i));
      const slot = this.add.rectangle(x, y, 12, 2, 0x3a3f45);
      const num = this.add.text(x + (dx < 0 ? 14 : -14), y, String(i + 1), { ...VT, fontSize: '13px', color: '#fbefd5' }).setOrigin(0.5);
      C.add([head, slot, num]);
      this.screws.push({ head, slot, num, turns: 0, out: false });
    });
  }

  /** Turn screw i a quarter turn. On the third turn it pops out; when all 4 are out, the panel slides off. */
  turnScrew(i) {
    const s = this.screws[i];
    if (!s || s.out) return;
    s.turns++;
    this.tweens.add({ targets: s.slot, angle: s.slot.angle + 90, duration: 120 });
    this.tweens.add({ targets: s.head, scale: 1 + s.turns * 0.12, duration: 120 });   // it rises as it comes out
    if (s.turns < 3) return;
    s.out = true; s.num.setVisible(false);
    this.cameras.main.flash(60, 255, 255, 255);
    this.tweens.add({ targets: [s.head, s.slot], y: s.head.y + 40, x: s.head.x + (i % 2 ? 30 : -30), alpha: 0, duration: 400, ease: 'Quad.easeIn' });
    if (!this.screws.every(k => k.out)) return;
    // Panel off: slide it away, then the wires game runs exactly as before
    this.help.setText(SCREWS.off);
    this.time.delayedCall(350, () => this.tweens.add({ targets: this.cover, x: 340, alpha: 0, duration: 500, ease: 'Quad.easeIn', onComplete: () => {
      this.cover.destroy(); this.covered = false;
      if (this.scene.isActive()) this.help.setText('Pick a wire on the left (1-4), then its matching socket (1-4)');
    } }));
  }

  /** Select the wire in row i (left side), unless it's already connected. */
  pickLeft(i) { if (this.covered || this.joined.has(this.left[i])) return; this.sel = i; this.draw(); }
  /** Try to plug the selected wire into socket i: right colour joins it, wrong colour shakes. */
  pickRight(i) {
    if (this.covered || this.sel == null) return;
    const c = this.left[this.sel];
    if (this.right[i] === c) {
      this.joined.add(c); this.sel = null; this.cameras.main.flash(80, 255, 255, 255);
      if (this.joined.size === 4) { this.help.setText('All wires connected! Power restored.'); this.draw(); this.time.delayedCall(900, () => { this.d.onDone?.(); this.scene.stop(); }); return; }
    } else { this.cameras.main.shake(150, 0.01); this.help.setText(`That's not the ${NAMES[c]} socket. Try again!`); this.sel = null; }
    this.draw();
  }

  /** Redraw the wires: joined ones stretch across, loose ones dangle; the selected wire gets a white box. */
  draw() {
    const g = this.g; g.clear();
    for (let i = 0; i < 4; i++) {
      const c = this.left[i];
      if (this.joined.has(c)) { const j = this.right.indexOf(c); g.lineStyle(4, COLORS[c]).lineBetween(this.lx + 13, this.ly(i), this.rx - 9, this.ly(j)); }
      else g.lineStyle(4, COLORS[c]).lineBetween(this.lx + 13, this.ly(i), this.lx + 40, this.ly(i) + (i % 2 ? 6 : -6));
    }
    if (this.sel != null) g.lineStyle(2, 0xffffff).strokeRect(this.lx - 15, this.ly(this.sel) - 9, 30, 18);
  }
}
