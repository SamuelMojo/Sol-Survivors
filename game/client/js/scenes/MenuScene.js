// A simple pop-up menu used by the workbench, radio, rocket console and more.
//   scene.launch('Menu', { title, body, options: [{ label, fn, disabled, keep }] , color })
//   Number keys or clicks choose an option. E / Esc closes.
//   An option with keep: true leaves the menu open (and redraws it).
//
// 👤 Owner: Game logic & backend.
import { audio } from '../systems/Audio.js';
import { SCREEN } from '/game/rules/settings.js';

const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' };
const VT = { fontFamily: 'VT323', fontSize: '16px', color: '#fbefd5' };

/** Scene: a pop-up box with a title, some text and numbered options. */
export class MenuScene extends Phaser.Scene {
  /** Register the scene under the name 'Menu'. */
  constructor() { super('Menu'); }

  /**
   * Keep what to show ({ title, body, options, color, locked }). body and options can be functions, so they
   * stay up to date. locked: the menu can't be closed with E/Esc, only by picking an option.
   */
  init(data) { this.data_ = data; }

  /** Dim the game behind the menu, set up the number keys and E/Esc, and draw. */
  create() {
    this.scene.bringToTop();                 // always draw above the HUD and rooms
    this.world = this.scene.get('World');
    this.layer = this.add.container(0, 0);
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x000000, 0.5).setOrigin(0).setDepth(-1).setInteractive();
    const kb = this.input.keyboard;
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((k, i) => kb.addKey(k).on('down', () => this.choose(i)));
    kb.addKey('ESC').on('down', () => { if (!this.data_.locked) this.close(); });
    kb.addKey('E').on('down', () => { if (!this.data_.locked) this.close(); });
    this.draw();
  }

  /** Change what the menu shows without closing it. */
  update_(data) { Object.assign(this.data_, data); this.draw(); }

  /** Pick option i (number key i+1 or a click). Disabled options do nothing. */
  choose(i) {
    const o = this.options()[i];
    if (!o || o.disabled) return;
    audio.sfx('click');
    if (!o.keep) this.close();
    o.fn?.(this);
    if (o.keep && this.scene.isActive()) this.draw();
  }

  /** The current list of options (calls the function if options is one). */
  options() { const o = this.data_.options; return typeof o === 'function' ? o() : (o ?? []); }

  /** Close the menu and give control back to the World scene. */
  close() { this.world.closeUI(); this.scene.stop(); }

  /** Draw the box, sized to fit the text and the options, centred on screen. */
  draw() {
    this.layer.removeAll(true);
    const d = this.data_, L = this.layer, pw = 340, px = (SCREEN.width - pw) / 2;
    const opts = this.options();
    // Everything wraps inside the box; a very long body uses smaller letters so the box still fits the screen
    const title = this.add.text(px + 12, 0, (d.title ?? '').toUpperCase(), { ...PX, wordWrap: { width: pw - 24 }, lineSpacing: 3 });
    const optTexts = opts.map((o, i) => this.add.text(px + 12, 0, `[${i + 1}] ${o.label}`, { ...VT, color: o.disabled ? '#8a7a6a' : '#fbefd5', backgroundColor: o.disabled ? undefined : '#3a2129', padding: { x: 4, y: 1 }, wordWrap: { width: pw - 32 }, lineSpacing: -4 }));
    const optsH = optTexts.reduce((h, t) => h + t.height + 4, 0);
    let size = 16, body;
    do {
      body?.destroy();
      body = this.add.text(px + 12, 0, typeof d.body === 'function' ? d.body() : (d.body ?? ''), { ...VT, fontSize: `${size}px`, wordWrap: { width: pw - 24 }, lineSpacing: -3 });
      size -= 1;
    } while (16 + title.height + body.height + optsH + 34 > SCREEN.height - 16 && size >= 12);
    const ph = 16 + title.height + body.height + optsH + 34;
    const py = Math.max(8, (SCREEN.height - ph) / 2);
    L.add(this.add.rectangle(px, py, pw, ph, 0x2a1820, 0.97).setOrigin(0).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(d.color ?? '#f3d9a4').color));
    title.y = py + 9; L.add(title);
    body.y = title.y + title.height + 6; L.add(body);
    let y = body.y + body.height + 6;
    optTexts.forEach((t, i) => {
      t.y = y;
      if (!opts[i].disabled) t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(i));
      L.add(t); y += t.height + 4;
    });
    if (!d.locked) L.add(this.add.text(px + pw - 10, py + ph - 6, '[E] Close', { ...VT, backgroundColor: '#3a2129', padding: { x: 4, y: 1 } }).setOrigin(1, 1)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close()));
  }
}
