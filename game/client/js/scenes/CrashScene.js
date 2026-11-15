// The crash: the crew escapes the damaged Perseverance VI in the lander and comes down hard in Jezero Crater.
// Space / Enter skips, but only for the crew leader (whoever started the game), so the whole crew stays together.
//
// 👤 Owner: Game logic & backend. The words and timings are in story/crash.js (Story person);
// the pictures are drawn with simple shapes in update() below.
import { addStoryPause } from './PausedScene.js';
import { audio } from '../systems/Audio.js';
import { SCREEN } from '/game/rules/settings.js';
import { net } from '../net.js';
import { CRASH_SHOTS } from '/story/crash.js';

const VT = { fontFamily: 'VT323', fontSize: '16px', color: '#fbefd5' };
const SHOTS = CRASH_SHOTS;   // the words and timings are in story/crash.js

/** Scene: the crash cutscene, 5 shots, then Mars. */
export class CrashScene extends Phaser.Scene {
  /** Register the scene under the name 'Crash'. */
  constructor() { super('Crash'); }
  /** Keep the start data (players, seed, interview bonuses) to pass on to the World scene. */
  init(d) { this.d = d; }

  /** Set up the text box and the skip key, then show the first shot. */
  create() {
    addStoryPause(this);                                   // Esc / P: the host pauses the story for everyone
    audio.music('crash');
    this.shot = 0; this.t0 = this.time.now;
    this.g = this.add.graphics();
    this.box = this.add.rectangle(SCREEN.width / 2, SCREEN.height - 34, SCREEN.width - 24, 52, 0x2a1820, 0.95).setStrokeStyle(2, 0xf3d9a4);
    this.text = this.add.text(20, SCREEN.height - 56, '', { ...VT, wordWrap: { width: SCREEN.width - 40 }, lineSpacing: -3 });
    this.add.text(SCREEN.width - 8, 6, net.isLeader ? 'Space: skip' : 'The crew leader can skip', { ...VT, fontSize: '13px', color: '#c9ad93' }).setOrigin(1, 0);
    // The Perseverance VI in space is the same rocket that took off on launch day (lying on its side)
    this.ship = this.add.image(200, 89, 'rocket-ship').setAngle(90).setScale(1.1).setVisible(false);
    this.shipText = this.add.text(0, 0, '').setVisible(false);    // (NASA and the patch are painted in the rocket picture now)
    this.fx = this.add.graphics().setDepth(3);              // sparks from the damaged ship (drawn over it)
    this.stars = Array.from({ length: 70 }, () => [Math.random() * SCREEN.width, Math.random() * SCREEN.height * 0.8]);
    for (const k of ['SPACE', 'ENTER']) this.input.keyboard.addKey(k).on('down', () => {
      if (!net.isLeader) return;
      net.event('crashSkip', { shot: this.shot }); this.next();
    });
    // Other players follow the leader's skip (only if they're on the same shot, so nobody skips twice)
    this.onEv = e => { if (e.type === 'crashSkip' && e.shot === this.shot) this.next(); };
    net.on('ev', this.onEv);
    this.events.once('shutdown', () => net.off('ev', this.onEv));
    this.show();
  }

  /** Show the current shot's text and start its timer. Shot 4 (index 3) is the crash: shake and flash. */
  show() {
    this.t0 = this.time.now;
    this.text.setText(SHOTS[this.shot].text);
    if (this.shot === 3) { this.cameras.main.shake(900, 0.03); this.cameras.main.flash(200, 255, 220, 180); }
    this.timer?.remove();
    this.timer = this.time.delayedCall(SHOTS[this.shot].ms, () => this.next());
  }

  /** Move to the next shot, or fade out to Mars after the last one. */
  next() {
    if (this.leaving) return;
    if (++this.shot >= SHOTS.length) {
      this.leaving = true;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World', { ...this.d, fromCrash: true }));
      return;
    }
    this.show();
  }

  /** Draw the current shot every frame with simple shapes (t = seconds since the shot started). */
  update(time) {
    const g = this.g, W = SCREEN.width, H = SCREEN.height, t = (time - this.t0) / 1000;
    g.clear(); this.fx.clear();
    g.fillStyle(0x05040c).fillRect(0, 0, W, H);
    for (const [x, y] of this.stars) g.fillStyle(0xffffff, 0.7).fillRect(x, y, 1, 1);
    const s = this.shot;
    this.ship.setVisible(s === 0); this.shipText.setVisible(s === 0);
    this.ship.setDepth(1); this.shipText.setDepth(2);
    if (s === 0) {                       // lander leaves the damaged mothership
      g.fillStyle(0xb45a33).fillCircle(W / 2, H + 420, 520);                     // Mars below
      const kx = 140, ky = 80;
      for (let i = 0; i < 8; i++) this.fx.fillStyle([0xff5f2d, 0xffb02e, 0x555555][i % 3], 0.8).fillRect(kx + 60 + Math.random() * 30, ky - 4 + Math.random() * 20, 4, 4);
      const lx = kx + 60 + t * 25, ly = ky + 30 + t * 30;
      g.fillStyle(0xf4efe6).fillRect(lx, ly, 18, 14).fillStyle(0xff8a3d).fillRect(lx + 6, ly + 4, 6, 4);
    } else if (s === 1) {                // entry: glowing heat shield
      g.fillStyle(0xb45a33).fillCircle(W / 2, H + 260, 380);
      const lx = W / 2 - 9 + Math.sin(t * 9) * 3, ly = 60 + t * 25;
      for (let i = 0; i < 18; i++) g.fillStyle([0xffd34d, 0xff8a3d, 0xff5f2d][i % 3], 0.85).fillRect(lx - 6 + Math.random() * 30, ly - 6 - Math.random() * 40, 4, 4);
      g.fillStyle(0xf4efe6).fillRect(lx, ly, 18, 14).fillStyle(0xffb02e).fillRect(lx - 2, ly + 14, 22, 4);
    } else if (s === 2) {                // parachutes, wobbly
      g.fillStyle(0xd88a5a).fillRect(0, 0, W, H).fillStyle(0xb45a33).fillRect(0, H - 100, W, 100);
      const lx = W / 2 - 9 + Math.sin(t * 4) * 12, ly = 40 + t * 40;
      g.fillStyle(0xff8a3d).fillEllipse(lx + 9, ly - 30, 50, 22).fillStyle(0xffffff).fillRect(lx + 8, ly - 30, 2, 30);
      g.lineStyle(1, 0xdddddd).lineBetween(lx - 14, ly - 28, lx, ly).lineBetween(lx + 32, ly - 28, lx + 18, ly);
      g.fillStyle(0xf4efe6).fillRect(lx, ly, 18, 14);
      if (Math.floor(t * 6) % 2) g.fillStyle(0x555555, 0.7).fillRect(lx + 14, ly + 6, 8, 6);
    } else {                             // crash site / message from Earth
      g.fillStyle(0xd88a5a).fillRect(0, 0, W, H).fillStyle(0xb45a33).fillRect(0, H - 120, W, 120);
      g.fillStyle(0x7a7f86).fillTriangle(W / 2 - 40, H - 112, W / 2 + 30, H - 140, W / 2 + 50, H - 108);
      for (let i = 0; i < 12; i++) g.fillStyle(0x555555, Math.max(0, 0.6 - t * 0.1)).fillCircle(W / 2 + Math.sin(i) * 60 * (1 + t * 0.3), H - 130 - t * 8 - i * 3, 6 + t * 2);
      for (let i = 0; i < 9; i++) g.fillStyle(0xc49a5a).fillRect(W / 2 - 160 + i * 40 + Math.sin(i * 7) * 12, H - 102 + (i % 3) * 8, 8, 6);
    }
  }
}
