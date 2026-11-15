// Sleeping. Solo: the night passes after a moment (2.5 s, so you can still change your mind).
// Multiplayer: everyone has to be in a hab bunk; then the crew leader runs the night for everyone.
// [E] Get up: get back out of bed. The night never starts until EVERYONE is in bed (at midnight the clock waits).
//
// 👤 Owner: Game logic & backend. Opened by WorldScene.sleep(); closed by WorldScene.applyMorning() when the night has run.
// The server counts who is asleep (game/server/index.js, 'asleep') and tells the leader to run the night.
import { SCREEN } from '/game/rules/settings.js';
import { TIME } from '/game/rules/survival.js';
import { fmtTime } from '../systems/Survival.js';

const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' };
const VT = { fontFamily: 'VT323', fontSize: '16px', color: '#fbefd5' };

/** Scene: the dark 'sleeping' screen shown while the night passes. */
export class NightScene extends Phaser.Scene {
  /** Register the scene under the name 'Night'. */
  constructor() { super('Night'); }

  /** Draw the night screen. Solo: run the night after a short pause. Multiplayer: show who's still awake. */
  create() {
    this.scene.bringToTop();
    this.world = this.scene.get('World');
    const W = SCREEN.width, H = SCREEN.height;
    this.add.rectangle(0, 0, W, H, 0x05040c, 0.97).setOrigin(0).setInteractive();
    this.add.text(W / 2, H / 2 - 40, `NIGHT OF SOL ${this.world.survival.sol}`, PX).setOrigin(0.5);
    this.zzz = this.add.text(W / 2, H / 2 - 16, 'Z z z . . .', { ...VT, fontSize: '22px', color: '#6cc4ff' }).setOrigin(0.5);
    this.racing = false;
    this.info = this.add.text(W / 2, H / 2 + 20, '', { ...VT, align: 'center', wordWrap: { width: 340 } }).setOrigin(0.5, 0);
    // [E] Get up (there's a button too)
    this.getUp = this.add.text(W / 2, H / 2 + 80, '[E] Get up', { ...VT, backgroundColor: '#3a2129', padding: { x: 5, y: 1 } }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.world.wakeUp());
    this.input.keyboard.addKey('E').on('down', () => this.world.wakeUp());
    if (!this.world.multi) {
      this.info.setText('Sleeping...');
      this.time.delayedCall(1500, () => this.world.runNightAsLeader());
      return;
    }
    // Multiplayer: show 'x/y asleep' and update it whenever the server sends a new count
    const ev = this.world.game.events, show = c => this.info.setText(`Waiting for everyone to go to bed${c ? ` (${c.asleep} of ${c.total} in bed)` : ''}.\nThe night starts when the whole crew is in a hub bunk.`);
    show(this.world.mp.asleepCount);
    ev.on('sleepers', show);
    this.events.once('shutdown', () => ev.off('sleepers', show));
  }

  /**
   * Everyone is asleep: the clock races from 'from' (Mars minutes) round to 06:00 in 3 seconds, so you see
   * the night pass. Then 'then' runs (the morning).
   */
  raceClock(from, then) {
    this.racing = true;
    this.getUp.setVisible(false);                  // no getting up now
    this.info.setText('Everyone is asleep. Good night!');
    const to = 1440 + TIME.wake, clock = { m: from };
    this.zzz.setFontSize(32).setColor('#ffd34d');
    this.tweens.add({ targets: clock, m: to, duration: 3000, ease: 'Sine.easeInOut',
      onUpdate: () => this.zzz.setText(fmtTime(clock.m)),
      onComplete: () => this.time.delayedCall(400, then) });
  }
}
