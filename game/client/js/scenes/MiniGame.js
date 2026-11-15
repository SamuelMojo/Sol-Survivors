// The shared part of every mini game ("game within a game"): the dark backdrop, the frame, the title, a
// one-line how-to, 'Esc: quit', the win screen with a real fact, and the safety rules every mini game follows:
//   - opened like any pop-up screen (WorldScene.openScreen -> uiOpen), so the player stands still;
//     in solo the clock pauses like a menu, in multiplayer the world keeps running
//   - Esc quits and nothing is used up (parts stay in the bag): d.onClose is called
//   - the host's pause freezes it (it pauses itself while the world is frozen)
//   - it closes by itself if the player passes out, the game ends, or shouldClose() says the job got done
//     some other way (e.g. a crewmate fixed the machine)
//   - winning: d.onWin() runs FIRST (the real game change, e.g. the repair), then the game closes and its fact
//     opens on the big fact screen (scenes/FactScene.js)
// A mini game runs only on its own player's screen: only the result is shared (by whatever onWin does).
// Each mini game is one scene that extends this class, implements build() and (optionally) tick(), reset(),
// shouldClose(). Every scene key is listed in MINIGAME_KEYS, used by WorldScene.unstick's safety net.
//
// 👤 Owner: Game logic & backend. The words are in story/minigames.js.
import { SCREEN } from '/game/rules/settings.js';
import { MINIGAME_TEXT } from '/story/minigames.js';
import { audio } from '../systems/Audio.js';

export const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' };
export const VT = { fontFamily: 'VT323', fontSize: '15px', color: '#fbefd5' };
export const COMMON = MINIGAME_TEXT.common;

// Every mini game scene key (the Mars ones). WorldScene.unstick must know them all, or it would close a game
// 1.5 s after it opened, thinking the screen was stuck.
export const MINIGAME_KEYS = ['MoxieGame', 'AtomGame', 'WeldGame', 'LightGame', 'FrostGame', 'UnstickGame', 'RockGame', 'EarthGame'];

/** Base class for the Mars mini games. Subclasses set this.text (their words) and implement build(). */
export class MiniGameScene extends Phaser.Scene {
  /** d: { onWin, onClose, ...anything the game needs }. */
  init(d) { this.d = d ?? {}; this.won = false; this.closing = false; }

  /** Frame size (subclasses may override). */
  get frame() { return { w: 400, h: 264 }; }
  /** The words for this game (subclasses override with e.g. MINIGAME_TEXT.moxie). */
  get text() { return MINIGAME_TEXT[this.textKey] ?? {}; }
  /** A title to show instead of text.title (e.g. the machine's name). */
  get title() { return this.text.title ?? ''; }

  /** Draw the shared frame, then let the game build itself inside it. */
  create() {
    this.scene.bringToTop();
    this.world = this.scene.get('World');
    const W = SCREEN.width, H = SCREEN.height, f = this.frame;
    this.fx = (W - f.w) / 2; this.fy = (H - f.h) / 2;       // top-left of the frame
    this.cx = W / 2; this.cy = H / 2;
    // Backdrop: blocks clicks reaching the world and the HUD
    this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive().setDepth(-2);
    this.add.rectangle(this.fx, this.fy, f.w, f.h, 0x22262b, 0.98).setOrigin(0).setStrokeStyle(3, 0x9aa3a8).setDepth(-1);
    this.titleText = this.add.text(this.cx, this.fy + 8, this.title, PX).setOrigin(0.5, 0).setDepth(50);
    this.howText = this.add.text(this.cx, this.fy + f.h - 10, this.text.how ?? '', { ...VT, fontSize: '14px', color: '#c9ad93', align: 'center', wordWrap: { width: f.w - 60 } }).setOrigin(0.5, 1).setDepth(50);
    this.add.text(this.fx + f.w - 6, this.fy + 4, COMMON.quit, { ...VT, fontSize: '12px', color: '#c9ad93' }).setOrigin(1, 0).setDepth(50)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.quit());
    this.pausedText = this.add.text(this.cx, this.cy, COMMON.paused, { ...PX, fontSize: '12px', backgroundColor: '#2a1820', padding: { x: 10, y: 8 } }).setOrigin(0.5).setDepth(200).setVisible(false);

    this.input.keyboard.addKey('ESC').on('down', () => this.quit());
    // The host paused the game: freeze this mini game too (and show it)
    this.onFrozen = on => { if (this.closing) return; this.pausedText.setVisible(!!on); on ? this.scene.pause() : this.scene.resume(); };
    this.game.events.on('frozen', this.onFrozen);
    this.events.once('shutdown', () => this.game.events.off('frozen', this.onFrozen));
    this.playArea = { x: this.fx + 12, y: this.fy + 26, w: f.w - 24, h: f.h - 56 };   // between the title and the how-to line
    this.build();
  }

  /** Subclasses: draw the game inside this.playArea. */
  build() {}
  /** Subclasses: per-frame logic (time in ms, delta in ms), only while playing. */
  tick(_time, _delta) {}
  /** Subclasses: true when the job got done some other way, so the game should close. */
  shouldClose() { return false; }

  /** Show a short message on the how-to line for a moment (e.g. 'Try again!'). */
  say(msg, color = '#ffd34d', ms = 1600) {
    this.howText.setText(msg).setColor(color);
    this.sayTimer?.remove();
    this.sayTimer = this.time.delayedCall(ms, () => { if (this.scene.isActive()) this.howText.setText(this.text.how ?? '').setColor('#c9ad93'); });
  }

  /** Phaser calls this every frame. Safety closes first, then the game's own tick. */
  update(time, delta) {
    if (this.closing) return;
    const w = this.world;
    if (w && (w.knockingOut || w.ended)) return this.close();
    if (!this.won && this.shouldClose()) { w?.toast(COMMON.closedFixed, '#7bd88f'); return this.close(); }
    if (!this.won) this.tick(time, delta);
  }

  /** The player won: run the real game change, then show the fact. */
  win() {
    if (this.won || this.closing) return;
    this.won = true;
    audio.sfx('todo');
    this.cameras.main.flash(120, 255, 255, 255);
    try { this.d.onWin?.(); } catch (e) { console.error(e); }
    this.time.delayedCall(350, () => this.showFact());
  }

  /** Subclasses: true = show the win fact only the first time this game is won (e.g. Rock Sample, played 3 times). */
  get factOnce() { return false; }

  /** The win: the mini game closes and its real fact opens on the big fact screen (closed with its X, or Esc). */
  showFact() {
    if (this.closing) return;
    const f = { label: COMMON.factDone, title: this.title, body: this.text.fact ?? '', color: '#7bd88f' };
    const w = this.world, key = this.scene.key;
    this.close();
    if (!f.body || !w) return;
    w.winFactsSeen ??= new Set();
    if (this.factOnce && w.winFactsSeen.has(key)) return w.toast(`${COMMON.done} ${this.title}`, '#7bd88f');   // seen it already: just a short message
    w.winFactsSeen.add(key);
    w.showFact(f);
  }

  /** Esc: leave without finishing. Nothing is used up. */
  quit() {
    if (this.closing) return;
    if (!this.won) this.d.onClose?.();
    this.close();
  }

  /** Close the scene and give control back to the world. */
  close() {
    if (this.closing) return;
    this.closing = true;
    this.world?.closeUI();
    this.scene.stop();
  }

  // ---------- small drawing helpers shared by the games ----------
  /** A simple progress meter: outline box filled to t (0..1). */
  meter(g, x, y, w, h, t, color = 0x7bd88f) {
    g.fillStyle(0x160c11).fillRect(x, y, w, h);
    g.fillStyle(color).fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, t)), h - 2);
    g.lineStyle(1, 0x9aa3a8).strokeRect(x, y, w, h);
  }
}
