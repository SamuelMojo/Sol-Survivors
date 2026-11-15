// A real-science fact, shown big: it fills the whole screen and stays until you close it with the X in the
// top corner (or Esc). Used for place facts (a new area or building), crop facts, machine facts, item facts
// (from the backpack) and the win screen of every mini game.
//
// Open it from the World with world.showFact({ title, body, icon, color }): facts wait in a queue and open
// one at a time, only when no other screen is open. While a fact is open the player stands still, nothing
// behind it can be clicked, and in a solo game the clock pauses (like any pop-up screen).
// From another screen (e.g. the backpack): scene.launch('Fact', { ..., resume: '<that scene key>' }) after
// pausing that scene; it's resumed when the fact closes.
//
// 👤 Owner: Game logic & backend. The words come from story/ (items.js, places.js, machines.js, minigames.js).
import { SCREEN } from '/game/rules/settings.js';
import { ITEMS } from '/game/rules/items.js';
import { MINIGAME_TEXT } from '/story/minigames.js';
import { audio } from '../systems/Audio.js';

const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' };
const VT = { fontFamily: 'VT323', fontSize: '20px', color: '#fbefd5' };
const T = MINIGAME_TEXT.common;

/** Scene: one science fact, full screen, closed only by its X button (or Esc). */
export class FactScene extends Phaser.Scene {
  /** Register the scene under the name 'Fact'. */
  constructor() { super('Fact'); }

  /** d: { title, body, icon (an item id, optional), color, label (small word above the title), resume, fromWorld } */
  init(d) { this.d = d ?? {}; this.closing = false; }

  /** Draw the panel, the X button and the words, sized so they never overlap. */
  create() {
    this.scene.bringToTop();
    const W = SCREEN.width, H = SCREEN.height, d = this.d, col = d.color ?? '#6cc4ff';
    const num = Phaser.Display.Color.HexStringToColor(col).color;
    // The whole screen: nothing behind can be clicked
    this.add.rectangle(0, 0, W, H, 0x0b0710, 0.97).setOrigin(0).setInteractive();
    this.add.rectangle(8, 8, W - 16, H - 16, 0x2a1820, 1).setOrigin(0).setStrokeStyle(3, num);
    // Top: a small label and the title (kept clear of the X button)
    this.add.text(24, 22, d.label ?? T.factLabel, { ...PX, color: '#c9ad93' });
    const title = this.add.text(24, 38, (d.title ?? '').toUpperCase(), { ...PX, fontSize: '10px', color: col, wordWrap: { width: W - 96 }, lineSpacing: 4 });
    const top = title.y + title.height + 16, bottom = H - 44;
    // The fact itself: big and easy to read, shrunk only if it's very long
    const icon = d.icon && ITEMS[d.icon] ? this.add.image(W / 2, 0, 'items', ITEMS[d.icon].icon).setScale(3) : null, iconH = icon ? 50 : 0;
    let size = 22, body;
    do {
      body?.destroy();
      body = this.add.text(W / 2, 0, d.body ?? '', { ...VT, fontSize: `${size}px`, align: 'center', wordWrap: { width: W - 72 }, lineSpacing: -2 }).setOrigin(0.5, 0);
      size -= 2;
    } while (top + iconH + body.height > bottom && size >= 14);
    // Picture and words in the middle of the free space
    const y = Math.max(top, top + (bottom - top - iconH - body.height) / 2);
    icon?.setY(y + 20); body.setY(y + iconH);
    // Bottom: how to close it
    this.add.text(W / 2, H - 22, T.factClose, { ...VT, fontSize: '15px', color: '#c9ad93' }).setOrigin(0.5, 1);
    // The X button, top right corner
    const bx = W - 34, by = 16;
    const box = this.add.rectangle(bx, by, 22, 22, 0x3a2129).setOrigin(0).setStrokeStyle(2, 0xf3d9a4).setInteractive({ useHandCursor: true });
    const x = this.add.text(bx + 11, by + 12, 'X', { ...PX, fontSize: '10px', color: '#fbefd5' }).setOrigin(0.5);
    box.on('pointerover', () => box.setFillStyle(0x5a3040)).on('pointerout', () => box.setFillStyle(0x3a2129)).on('pointerdown', () => this.close());
    this.closeBtn = box; this.closeX = x;
    this.input.keyboard.addKey('ESC').on('down', () => this.close());
    audio.sfx('click');
  }

  /**
   * Close the fact. The World can move again straight away (its Esc key ignores the same press: see
   * WorldScene's uiClosedAt check). A paused screen underneath (the backpack) waits a moment before it's
   * resumed, so the same Esc press doesn't close it too.
   */
  close() {
    if (this.closing) return;
    this.closing = true;
    const d = this.d, world = this.scene.get('World'), sm = this.scene;
    this.scene.stop();
    if (d.fromWorld) world?.closeUI();
    setTimeout(() => {
      if (d.resume && sm.isPaused(d.resume)) sm.resume(d.resume);
      d.onClose?.();
    }, 60);
  }
}
