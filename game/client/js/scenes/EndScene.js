// The ending: a launch and star rating if you made it, or a lesson if you didn't.
//
// 👤 Owner: Game logic & backend. All the words come from story/endings.js (Story person).
import { SCREEN, JOBS } from '/game/rules/settings.js';
import { LAUNCH } from '/game/rules/survival.js';
import { audio } from '../systems/Audio.js';
import { WIN, LESSONS, FAIL, PLAY_AGAIN } from '/story/endings.js';   // all the words

const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' };
const VT = { fontFamily: 'VT323', fontSize: '16px', color: '#fbefd5' };


/** Scene: the end of the game, win or lose. */
export class EndScene extends Phaser.Scene {
  /** Register the scene under the name 'End'. */
  constructor() { super('End'); }

  /** data = { win, reason, job, stats } from WorldScene.endGame(). */
  init(data) { this.d = data; }

  /** Draw space and Mars. Win: the rocket lifts off, then the results panel. Lose: the panel straight away. */
  create() {
    this.scene.bringToTop();
    const { win } = this.d, W = SCREEN.width, H = SCREEN.height;
    audio.music(win ? 'win' : 'lose');
    this.add.rectangle(0, 0, W, H, 0x05040c).setOrigin(0);
    // stars and a strip of Mars
    for (let i = 0; i < 90; i++) this.add.rectangle(Math.random() * W, Math.random() * H * 0.7, 1, 1, 0xffffff, Math.random());
    this.add.rectangle(0, H - 50, W, 50, 0xb4572f).setOrigin(0);
    this.add.rectangle(0, H - 50, W, 3, 0xc97446).setOrigin(0);
    if (win) {
      // The same NASA rocket as on launch day: it lifts off, the pad stays on Mars
      this.add.rectangle(W / 2, H - 46, 48, 10, 0x6e6e6e).setOrigin(0.5, 1);
      const rocket = this.add.image(W / 2, H - 52, 'rocket-ship').setOrigin(0.5, 1);
      const flame = this.add.graphics();
      this.tweens.add({ targets: [rocket], y: '-=' + (H + 40), duration: 4200, ease: 'Cubic.easeIn', delay: 900 });
      this.events.on('update', () => {
        flame.clear();
        if (this.time.now < 600) return;
        const ey = rocket.y - 16;                    // the engine bell, at the bottom of the rocket
        for (let i = 0; i < 16; i++) flame.fillStyle([0xffd34d, 0xff8a3d, 0xff5f2d, 0xffffff][i % 4]).fillRect(rocket.x - 6 + Math.random() * 8, ey + Math.random() * 22, 3, 3);
      });
      this.cameras.main.shake(900, 0.004);
      this.time.delayedCall(5000, () => this.panel());
    } else this.time.delayedCall(400, () => this.panel());
  }

  /** The results box. Win: 1-3 stars (home, low radiation, 2+ crops) and the crew's numbers. Lose: the lesson. */
  panel() {
    const { win, reason, stats: s, job } = this.d, W = SCREEN.width;
    const pw = 370, ph = 290, px = (W - pw) / 2, py = 14;
    this.add.rectangle(px, py, pw, ph, 0x2a1820, 0.97).setOrigin(0).setStrokeStyle(2, win ? 0x7bd88f : 0xff5f5f);
    if (win) {
      const stars = 1 + (s.dose <= s.budget ? 1 : 0) + (s.crops >= 2 ? 1 : 0);
      this.add.text(W / 2, py + 12, WIN.title, { ...PX, fontSize: '12px', color: '#7bd88f' }).setOrigin(0.5, 0);
      this.add.text(W / 2, py + 30, '★'.repeat(stars) + '☆'.repeat(3 - stars), { ...VT, fontSize: '28px', color: '#ffd34d' }).setOrigin(0.5, 0);
      this.add.text(px + 14, py + 64, [...WIN.lines(s, JOBS[job].name)].join('\n'), { ...VT, wordWrap: { width: pw - 28 }, lineSpacing: -2 });
      this.add.text(px + 14, py + 186, WIN.stars, { ...VT, fontSize: '13px', color: '#ffd34d', wordWrap: { width: pw - 28 }, lineSpacing: -3 });   // wraps so it never goes off the box
      this.add.text(px + 14, py + 214, WIN.fact, { ...VT, fontSize: '14px', color: '#6cc4ff', wordWrap: { width: pw - 28 }, lineSpacing: -3 });
    } else {
      const [title, lesson] = LESSONS[reason]?.({ ...LAUNCH }) ?? [FAIL.title, ''];
      this.add.text(W / 2, py + 12, title, { ...PX, color: '#ff5f5f' }).setOrigin(0.5, 0);
      this.add.text(px + 14, py + 34, FAIL.body(s.sol, lesson), { ...VT, wordWrap: { width: pw - 28 }, lineSpacing: -2 });
    }
    this.add.text(W / 2, py + ph - 10, PLAY_AGAIN, { ...VT, backgroundColor: '#3a2129', padding: { x: 6, y: 2 } }).setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => location.reload());
    this.input.keyboard.addKey('ENTER').on('down', () => location.reload());
  }
}
