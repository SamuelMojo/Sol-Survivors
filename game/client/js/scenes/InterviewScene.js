// Scene One: launch day on Earth. A reporter interviews the crew; each astronaut picks an answer
// (1-3 or click). The computer answers for its crewmates. Then everyone climbs the ladder into their own
// door on the rocket (E). When the whole crew is in, the host presses Space to launch, and the voyage begins.
//
// 👤 Owner: Game logic & backend. The questions, answers and bonuses are in story/interview.js (Story person).
// Multiplayer: each player answers their own question (sent as an interviewAnswer event) and climbs in
// themselves (interviewBoard); only the crew leader can press Space to move on (an interviewNext event),
// so everyone stays on the same line.
import { addStoryPause } from './PausedScene.js';
import { audio } from '../systems/Audio.js';
import { SCREEN, JOBS } from '/game/rules/settings.js';
import { INTERVIEW } from '/story/interview.js';
import { itemName } from '/game/rules/items.js';
import { net } from '../net.js';
import { BOT_NAMES } from '../systems/Bots.js';

const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' };
const VT = { fontFamily: 'VT323', fontSize: '16px', color: '#fbefd5' };
// The reporter interviews the jobs in this order
const ORDER = ['botanist', 'builder', 'pilot'];
// The rocket's ladder and the 3 doors, one above the other (the Pilot sits at the top, by the controls)
const LADDER_X = 368, GROUND_Y = 198;
const DOORS = { pilot: { x: 352, y: 88 }, builder: { x: 352, y: 116 }, botanist: { x: 352, y: 144 } };

/** Scene: the launch-day interview (Scene One of the story). */
export class InterviewScene extends Phaser.Scene {
  /** Register the scene under the name 'Interview'. */
  constructor() { super('Interview'); }

  /** Build the crew line-up: real players by job, plus computer crewmates for missing jobs. */
  init(d) {
    this.d = d; this.d.bonus = [];
    this.humans = d.players.filter(p => p.connected !== false);
    this.crew = ORDER.map((job, i) => {
      const h = this.humans.find(p => p.job === job);
      return h ? { job, name: h.name, look: h.look ?? 0, id: h.id, bot: false } : { job, name: BOT_NAMES[job], look: (i + 1) % 4, bot: true };
    });
    this.step = -1; this.answers = {};
    this.boarding = false; this.climbing = {}; this.boarded = {};
  }

  /** Draw the launch pad, the crew and the dialogue box, set up keys and network events, then say the intro. */
  create() {
    addStoryPause(this);                                   // Esc / P: the host pauses the story for everyone
    audio.music('earth');
    const W = SCREEN.width, H = SCREEN.height;
    // Earth launch site
    const g = this.add.graphics();
    for (let y = 0; y < 200; y += 4) g.fillStyle(Phaser.Display.Color.GetColor(70 + y / 3, 140 + y / 4, 220), 1).fillRect(0, y, W, 4);
    g.fillStyle(0xfff6c2).fillCircle(60, 40, 14).fillStyle(0xffffff, 0.35).fillCircle(60, 40, 19);   // the Sun
    // Fluffy pixel clouds that drift across the sky (moved in update)
    this.clouds = [[30, 30, 1], [190, 52, 0.8], [300, 22, 1.2], [430, 60, 0.7]].map(([x, y, sc]) => {
      const c = this.add.graphics({ x, y });
      c.fillStyle(0xdfe9f5).fillEllipse(0, 4, 56 * sc, 14 * sc);                                       // shadow underneath
      c.fillStyle(0xffffff).fillCircle(-14 * sc, 0, 8 * sc).fillCircle(0, -5 * sc, 11 * sc).fillCircle(14 * sc, -1 * sc, 9 * sc).fillEllipse(0, 2, 52 * sc, 12 * sc);
      c.speed = 4 + sc * 4;
      return c;
    });
    g.fillStyle(0x5f9b4a).fillRect(0, 196, W, H - 196).fillStyle(0x8e949b).fillRect(240, 200, 200, 30);
    g.fillStyle(0x6f777d).fillRect(390, 70, 6, 132).fillRect(380, 90, 20, 3).fillRect(380, 130, 20, 3);   // the launch tower
    g.fillStyle(0x6e6e6e).fillRect(320, 190, 60, 12).fillStyle(0x8a8a8a).fillRect(320, 190, 60, 2);           // the launch pad (stays behind)
    this.rocket = this.add.image(350, 202, 'rocket-ship').setOrigin(0.5, 1).setScale(1.25);                 // only the rocket flies
    // (The crew's mission patch and NASA down the side are painted in the picture itself: levels/art/rocket-ship.png)
    // The ladder up the side of the rocket, and the 3 doors (redrawn when someone climbs in)
    g.fillStyle(0x8e949b).fillRect(LADDER_X - 4, 80, 2, GROUND_Y - 78).fillRect(LADDER_X + 4, 80, 2, GROUND_Y - 78);
    for (let y = 84; y < GROUND_Y; y += 6) g.fillRect(LADDER_X - 4, y, 10, 1);
    for (const d of Object.values(DOORS)) g.fillStyle(0x8e949b).fillRect(d.x + 8, d.y + 11, LADDER_X - d.x - 10, 2);   // a little walkway to each door
    this.doors = this.add.graphics();
    this.drawDoors();
    this.flame = this.add.graphics();
    // The press pen behind the reporter: two rows of photographers behind a red rope, a LIVE TV sign and a
    // TV camera on a tripod (the photographers' cameras flash in update)
    const cg = this.add.graphics();
    this.cameras_ = [];
    const SKIN = [0xd9a07a, 0xa8714a, 0xf0c8a0, 0x7a4a2a], HAIR = [0x2a1a10, 0x6b3a1a, 0xd9b048, 0x111111, 0x8a8a8a];
    const JACKET = [0x3a2a5a, 0x5a3a2a, 0x2a4a5a, 0x4a5a2a, 0x6a2a3a];
    const person = (x, y, i, camera) => {
      cg.fillStyle(0x222222).fillRect(x - 3, y + 4, 2, 4).fillRect(x + 1, y + 4, 2, 4);                       // legs
      cg.fillStyle(JACKET[i % 5]).fillRect(x - 4, y - 6, 8, 11);                                              // jacket
      cg.fillStyle(SKIN[i % 4]).fillCircle(x, y - 9, 3);                                                      // head
      cg.fillStyle(HAIR[i % 5]).fillRect(x - 3, y - 12, 6, 2);                                                // hair
      if (camera) {                                                                                           // camera held up to the face
        cg.fillStyle(0x1a1a1a).fillRect(x - 4, y - 11, 8, 5).fillStyle(0x555555).fillCircle(x, y - 9, 2).fillStyle(0xcccccc).fillRect(x + 2, y - 12, 2, 1);
        this.cameras_.push({ x, y: y - 10 });
      }
    };
    for (let k = 0; k < 13; k++) person(18 + k * 10, 178, k + 2, k % 3 === 0);                              // back row
    for (let k = 0; k < 12; k++) person(22 + k * 11, 186, k, k % 2 === 0);                                   // front row
    cg.fillStyle(0xc9a227).fillRect(8, 182, 3, 14).fillRect(146, 182, 3, 14);                              // rope posts
    cg.lineStyle(2, 0xb3122e).lineBetween(9, 185, 147, 185);                                                // the red rope
    cg.fillStyle(0x6f777d).fillRect(24, 146, 2, 30).fillRect(102, 146, 2, 30);                              // sign poles
    cg.fillStyle(0x1d3f8f).fillRect(20, 140, 88, 15).lineStyle(1, 0xffffff).strokeRect(20, 140, 88, 15);    // the LIVE TV sign
    cg.fillStyle(0xff3355).fillCircle(30, 147, 3);
    // TV camera on a tripod, with its operator
    cg.lineStyle(1, 0x333333).lineBetween(156, 196, 162, 176).lineBetween(168, 196, 162, 176).lineBetween(162, 196, 162, 176);
    cg.fillStyle(0x2a2a2a).fillRect(154, 166, 16, 10).fillStyle(0x444444).fillRect(170, 168, 5, 6).fillStyle(0x6cc4ff).fillRect(174, 169, 1, 4);
    cg.fillStyle(0xff3355).fillRect(156, 164, 2, 2);
    this.add.text(64, 147, 'LIVE TV', { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#ffffff' }).setOrigin(0.5);
    this.flashes = this.add.graphics();
    this.nextFlash = 0;
    this.add.text(W / 2, 6, 'LAUNCH DAY · EARTH', PX).setOrigin(0.5, 0).setStroke('#160c11', 4);
    // reporter and crew
    this.add.image(138, 198, 'reporter').setOrigin(0.5, 1).setScale(1.6);          // in front of the press pen
    // The crew, with name tags at two heights so long names next to each other don't overlap (they follow
    // the astronauts in update)
    this.tags = [];
    this.astros = this.crew.map((c, i) => {
      const s = this.add.sprite(206 + i * 38, 198, `astro-${c.job}-${c.look}`, 0).setOrigin(0.5, 1).setScale(1.6);
      this.tags.push(this.add.text(s.x, 166, c.name, { ...VT, fontSize: '13px', color: JOBS[c.job].color, backgroundColor: '#160c11aa', padding: { x: 2, y: 0 } }).setOrigin(0.5, 1));
      return s;
    });
    this.marker = this.add.text(0, 0, '▼', { ...VT, color: '#ffd34d' }).setOrigin(0.5, 1).setVisible(false);
    // dialogue box
    this.box = this.add.rectangle(W / 2, H - 4, W - 12, 104, 0x2a1820, 0.96).setOrigin(0.5, 1).setStrokeStyle(2, 0xf3d9a4);
    this.say = this.add.text(14, H - 104, '', { ...VT, wordWrap: { width: W - 28 }, lineSpacing: -3 });
    this.opts = this.add.container(0, 0);
    // Only the crew leader (whoever started the game) moves the story on, so everyone stays together
    this.add.text(W - 8, 20, net.isLeader ? 'Space or click NEXT' : 'The host moves the story on', { ...VT, fontSize: '13px', color: '#fbefd5' }).setOrigin(1, 0).setStroke('#160c11', 3).setDepth(50);
    // A NEXT button for the host (mouse players), shown whenever Space would move the story on
    this.nextBtn = this.add.text(W - 12, H - 10, 'NEXT >', { ...VT, backgroundColor: '#3a2129', padding: { x: 6, y: 2 } }).setOrigin(1, 1)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => net.isLeader && this.advance()).setVisible(false);
    // Click anywhere during boarding: your astronaut walks to the ladder and climbs in by itself
    this.input.on('pointerdown', (_p, over) => { const me = this.myCrew(); if (this.boarding && me && !over.length) this.board(me.job); });
    this.keys = this.input.keyboard.addKeys('A,D,W,S,LEFT,RIGHT,UP,DOWN');
    this.lastMoveSent = 0;

    ['ONE', 'TWO', 'THREE'].forEach((k, i) => this.input.keyboard.addKey(k).on('down', () => this.choose(i)));
    // Just for fun: W / up makes your astronaut hop (everyone sees it). At the ladder it climbs instead.
    this.add.text(8, 20, 'Jump: W or Up arrow', { ...VT, fontSize: '13px', color: '#fbefd5' }).setStroke('#160c11', 3).setDepth(50);
    for (const k of ['UP', 'W']) this.input.keyboard.addKey(k).on('down', () => {
      const me = this.myCrew();
      if (!me || this.climbing[me.job] || this.onLadder) return;
      if (this.boarding && Math.abs(this.myAstro().x - LADDER_X - 1) < 6) return;      // at the ladder: update() climbs
      this.hop(me.job); net.event('interviewHop', { job: me.job });
    });
    for (const k of ['SPACE', 'ENTER']) this.input.keyboard.addKey(k).on('down', () => { if (net.isLeader) this.advance(); });
    this.onEv = e => {
      if (e.type === 'interviewAnswer') this.applyAnswer(e.job, e.choice);
      if (e.type === 'interviewHop') this.hop(e.job);
      if (e.type === 'interviewBoard') this.board(e.job, true);
      if (e.type === 'interviewMove') this.moveRemote(e);
      if (e.type === 'interviewNext' && e.step === this.step) this.advance(true);
    };
    net.on('ev', this.onEv);
    this.events.once('shutdown', () => net.off('ev', this.onEv));
    for (const e of net.recent) if (Date.now() - e.at < 120000 && e.type === 'interviewAnswer') this.answers[e.job] = e.choice;

    this.line(`Reporter: ${INTERVIEW.intro}`);
    this.waitingSpace = true;
  }

  /** My own astronaut sprite. */
  myAstro() { return this.astros[this.crew.indexOf(this.myCrew())]; }

  /**
   * Every frame: clouds drift, cameras flash, name tags follow, the NEXT button shows, and while boarding
   * I walk (A/D) to the ladder and climb it (W/S) to my door myself.
   */
  update(time, delta) {
    const dt = delta / 1000;
    for (const c of this.clouds) { c.x += c.speed * dt; if (c.x > SCREEN.width + 50) c.x = -50; }
    // Press photographers' flashes
    this.flashes.clear();
    if (!this.launched && time > this.nextFlash && this.cameras_.length) {
      this.nextFlash = time + 250 + Math.random() * 700;
      this.flashAt = { ...Phaser.Utils.Array.GetRandom(this.cameras_), until: time + 90 };
    }
    if (this.flashAt && time < this.flashAt.until) this.flashes.fillStyle(0xffffff, 0.9).fillCircle(this.flashAt.x, this.flashAt.y, 5).fillStyle(0xffffff, 0.3).fillCircle(this.flashAt.x, this.flashAt.y, 11);
    this.astros.forEach((s, i) => this.tags[i].setPosition(s.x, s.y - 30 - (i % 2) * 12).setVisible(s.visible && s.alpha > 0.5));
    this.nextBtn.setVisible(net.isLeader && !!this.waitingSpace && !this.launched);
    this.moveMe(dt, time);
  }

  /** Boarding: move my own astronaut with the keys (walk on the ground, climb the ladder) and tell the crew. */
  moveMe(dt, time) {
    const me = this.myCrew();
    if (!this.boarding || !me || this.climbing[me.job]) return;
    const s = this.myAstro(), k = this.keys, d = DOORS[me.job], skin = `astro-${me.job}-${me.look}`;
    const dx = (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown), dy = (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown);
    const play = dir => this.anims.exists(`${skin}-walk-${dir}`) && s.anims.play(`${skin}-walk-${dir}`, true);
    if (!this.onLadder) {
      if (dx) { s.x = Phaser.Math.Clamp(s.x + dx * 70 * dt, 180, LADDER_X + 1); play(dx > 0 ? 'right' : 'left'); }
      else s.anims.stop();
      if (dy < 0 && Math.abs(s.x - LADDER_X - 1) < 6) { this.onLadder = true; s.x = LADDER_X + 1; this.tweens.killTweensOf(s); s.y = GROUND_Y; }
    } else {
      if (dy) { s.y = Phaser.Math.Clamp(s.y + dy * 45 * dt, d.y + 13, GROUND_Y); play('up'); } else s.anims.stop();
      if (s.y >= GROUND_Y && dy > 0) this.onLadder = false;                 // climbed back down
      if (s.y <= d.y + 13) { this.onLadder = false; return this.board(me.job); }   // reached my door: in I go
    }
    if (time - this.lastMoveSent > 100 && (dx || dy)) { this.lastMoveSent = time; net.event('interviewMove', { job: me.job, x: Math.round(s.x), y: Math.round(s.y) }); }
  }

  /** Another player's astronaut moved during boarding: slide it there. */
  moveRemote(e) {
    const i = this.crew.findIndex(c => c.job === e.job), s = this.astros[i];
    if (!s || this.climbing[e.job]) return;
    this.tweens.killTweensOf(s); s.hopping = false;
    this.tweens.add({ targets: s, x: e.x, y: e.y, duration: 110 });
  }

  /** My own entry in the crew (null if I'm not in it). */
  myCrew() { return this.crew.find(c => !c.bot && c.id === net.id) ?? null; }

  /** Draw the 3 doors: open and dark while empty, closed with the astronaut's visor in the window once they're in. */
  drawDoors() {
    const g = this.doors; g.clear();
    for (const [job, d] of Object.entries(DOORS)) {
      const inside = this.boarded[job];
      g.fillStyle(inside ? 0xcfcfcf : 0x2a2a2a).fillRect(d.x, d.y, 8, 12);                       // the door
      g.lineStyle(1, 0x8e949b).strokeRect(d.x, d.y, 8, 12);
      g.fillStyle(0x1d2f5c).fillCircle(d.x + 4, d.y + 4, 2.5);                                  // the little window
      if (inside) g.fillStyle(Phaser.Display.Color.HexStringToColor(JOBS[job].color).color).fillCircle(d.x + 4, d.y + 4, 1.5);
    }
  }

  /** The interview is over: everyone climbs in. The computer crewmates go by themselves (the leader sends theirs). */
  startBoarding() {
    this.boarding = true;
    this.opts.removeAll(true); this.marker.setVisible(false);
    this.line(`Reporter: ${INTERVIEW.board}`);
    if (!net.isLeader) return;
    this.crew.filter(c => c.bot).forEach((c, i) => this.time.delayedCall(1200 + i * 1500, () => this.board(c.job)));
    // A player who has left the game gets climbed in for them
    this.time.delayedCall(45000, () => this.crew.forEach(c => !c.bot && !net.lobby?.players?.find(p => p.id === c.id && p.connected) && this.board(c.job)));
  }

  /**
   * An astronaut walks to the ladder, climbs up to their door and goes in. fromNet: someone else's
   * climb we heard about (so we don't send it again).
   */
  board(job, fromNet = false) {
    if (this.climbing[job] || this.launched) return;
    this.climbing[job] = true;
    if (!fromNet) net.event('interviewBoard', { job });
    const i = this.crew.findIndex(c => c.job === job), s = this.astros[i], c = this.crew[i], d = DOORS[job];
    const skin = `astro-${c.job}-${c.look}`, walk = dir => this.anims.exists(`${skin}-walk-${dir}`) && s.anims.play(`${skin}-walk-${dir}`, true);
    this.tweens.killTweensOf(s); s.hopping = true;
    if (s.x < LADDER_X - 2) s.y = GROUND_Y;            // still on the ground (not partway up the ladder)
    walk('right');
    this.tweens.chain({ targets: s, tweens: [
      { x: LADDER_X + 1, duration: Math.max(1, Math.abs(LADDER_X + 1 - s.x) * 9) },              // walk to the ladder
      { y: d.y + 13, duration: Math.max(1, (s.y - d.y - 13) * 14), onStart: () => walk('up') },   // climb up
      { x: d.x + 4, scale: 1.1, alpha: 0, duration: 450, onStart: () => walk('left') },           // step in through the door
    ], onComplete: () => {
      s.setVisible(false); s.anims.stop();
      this.boarded[job] = true; this.drawDoors(); audio.sfx('click');
      if (this.crew.every(c => this.boarded[c.job])) this.allAboard();
    } });
  }

  /** The whole crew is in: the host can launch. */
  allAboard() {
    this.line(`Reporter: ${INTERVIEW.allAboard}\n\n${INTERVIEW.facts[0]}\n\n${net.isLeader ? INTERVIEW.hostLaunch : INTERVIEW.waitLaunch}`);
    this.waitingSpace = true;
  }

  /** Show a line in the dialogue box. */
  line(t) { this.say.setText(t); }

  /** Make an astronaut (by job) do a little jump. Ignored while they're already in the air. */
  hop(job) {
    const s = this.astros[this.crew.findIndex(c => c.job === job)];
    if (!s || s.hopping || this.launched) return;
    s.hopping = true; audio.sfx('click');
    this.tweens.killTweensOf(s); s.y = 198;
    this.tweens.add({ targets: s, y: 180, duration: 180, ease: 'Quad.easeOut', yoyo: true, onComplete: () => { s.hopping = false; s.y = 198; } });
  }

  /** Space moves on from lines that don't need an answer. */
  /**
   * Space (leader only) moves on from a line that doesn't need an answer. Other players get here via the
   * leader's interviewNext event (fromLeader = true).
   */
  advance(fromLeader) {
    if (!this.waitingSpace && !fromLeader) return;
    if (this.launched) return;
    if (net.isLeader) net.event('interviewNext', { step: this.step });
    this.waitingSpace = false;
    if (this.step >= ORDER.length) {
      if (!this.boarding) return this.startBoarding();                 // after the goodbye: climb in
      if (this.crew.every(c => this.boarded[c.job])) return this.launch();
      return;
    }
    this.nextQuestion();
  }

  /**
   * Ask the next crew member their question (or say the outro after the last one).
   * Your own question shows clickable answers; bots answer by themselves (the leader picks for them).
   */
  nextQuestion() {
    this.step++;
    if (this.step >= ORDER.length) { this.marker.setVisible(false); this.line(`Reporter: ${INTERVIEW.outro}`); this.waitingSpace = true; return; }
    const c = this.crew[this.step], q = INTERVIEW.questions[c.job];
    this.marker.setVisible(true).setPosition(this.astros[this.step].x, 150);
    this.line(`Reporter: ${q.ask(c.name)}`);
    this.opts.removeAll(true);
    const mine = !c.bot && c.id === net.id;
    if (this.answers[c.job] != null) return this.applyAnswer(c.job, this.answers[c.job]);
    if (mine) {
      let y = this.say.y + this.say.height + 3;
      q.answers.forEach((a, i) => {
        const t = this.add.text(18, y, `[${i + 1}] ${a.text}`, { ...VT, fontSize: '14px', backgroundColor: '#3a2129', padding: { x: 3, y: 0 }, wordWrap: { width: SCREEN.width - 44 }, lineSpacing: -4 })
          .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(i));
        this.opts.add(t); y += t.height + 2;
      });
    } else if (c.bot) {
      if (net.isLeader) this.time.delayedCall(1500, () => { const i = Math.floor(Math.random() * 3); net.event('interviewAnswer', { job: c.job, choice: i }); this.applyAnswer(c.job, i); });
    } else {
      this.opts.add(this.add.text(18, SCREEN.height - 40, `Waiting for ${c.name} to answer...`, { ...VT, color: '#c9ad93' }));
      // if that player has gone, the leader answers for them after a while
      if (net.isLeader) this.time.delayedCall(25000, () => { if (this.answers[c.job] == null && this.crew[this.step]?.job === c.job) { net.event('interviewAnswer', { job: c.job, choice: 0 }); this.applyAnswer(c.job, 0); } });
    }
  }

  /** I picked answer i to my own question: tell everyone and show it. */
  choose(i) {
    const c = this.crew[this.step];
    if (!c || c.bot || c.id !== net.id || this.answers[c.job] != null) return;
    net.event('interviewAnswer', { job: c.job, choice: i });
    this.applyAnswer(c.job, i);
  }

  /**
   * Show an answer (mine or someone else's). My own answer adds its bonus item for Mars.
   * After a pause the next question comes automatically.
   */
  applyAnswer(job, i) {
    this.answers[job] = i;
    const c = this.crew[this.step];
    if (!c || c.job !== job) return;                     // answered early (arrives before we got here)
    const a = INTERVIEW.questions[job].answers[i];
    this.opts.removeAll(true);
    const mine = !c.bot && c.id === net.id;
    if (mine) this.d.bonus.push(a.bonus);
    this.line(`${c.name}: "${a.text}"\nReporter: ${a.reply}${mine ? `\n(Bonus for Mars: +${a.bonus[1]} ${itemName(a.bonus[0])})` : ''}`);
    const s = this.astros[this.step]; if (!s.hopping) this.tweens.add({ targets: s, y: 194, duration: 120, yoyo: true });
    this.waitingSpace = false;
    this.time.delayedCall(3200, () => this.nextQuestion());
  }

  /** 3-2-1 lift-off animation, then the voyage. */
  launch() {
    this.launched = true;
    this.line('3... 2... 1... LIFT-OFF! The crew is on its way to Mars.');
    this.astros.forEach(a => a.setVisible(false)); this.marker.setVisible(false);
    this.cameras.main.shake(2500, 0.006);
    this.tweens.add({ targets: [this.rocket, this.doors], y: '-=262', duration: 3500, ease: 'Cubic.easeIn', delay: 600 });   // the doors fly with the rocket
    this.events.on('update', () => {
      const f = this.flame; f.clear();
      // The flame comes out of the engine bell, 20 px above the bottom of the rocket picture, and moves with the rocket
      const ey = this.rocket.y - 20;
      for (let i = 0; i < 22; i++) f.fillStyle([0xffd34d, 0xff8a3d, 0xff5f2d, 0xffffff][i % 4]).fillRect(this.rocket.x - 7 + Math.random() * 10 - 1, ey + Math.random() * (18 + Math.random() * 16), 4, 4);
    });
    this.time.delayedCall(4200, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Voyage', this.d));
    });
  }
}
