// Scene Two: the voyage. Aboard the Perseverance VI a few weeks from Mars, micrometeoroids strike.
// Each job has a station task (story/voyage.js; the ship's floor plan is levels/ship.js). Computer crewmates do theirs automatically.
// When the Botanist and Builder have finished, a final strike hits the ship no matter what,
// and the crew escapes in the lander (CrashScene) down to Mars.
//
// 👤 Owner: Game logic & backend.
// Multiplayer: players see each other walk around (pos messages with voyage: true). Finishing a task sends
// voyageDone; the crew leader decides when the final strike happens and sends finalHit to everyone.
import { addStoryPause } from './PausedScene.js';
import { audio } from '../systems/Audio.js';
import { PLAYER, SCREEN, JOBS } from '/game/rules/settings.js';
import { FURNITURE } from '/levels/rooms.js';
import { SHIP } from '/levels/ship.js';
import { VOYAGE_TASKS, VOYAGE_STORY } from '/story/voyage.js';
import { BOT_NAMES } from '../systems/Bots.js';
import { net } from '../net.js';

const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' };
const VT = { fontFamily: 'VT323', fontSize: '14px', color: '#fbefd5' };
// Frame numbers in levels/art/interior.png used to draw the ship's floor and walls
const TILE = { metal: 0, wallTop: 4, wallFace: 5, window: 6 };
// How long (ms) the Botanist holds E to patch one leak
const LEAK_MS = 1500;

/** Scene: the voyage aboard the Perseverance VI (Scene Two of the story). */
export class VoyageScene extends Phaser.Scene {
  /** Register the scene under the name 'Voyage'. */
  constructor() { super('Voyage'); }

  /** Work out who is a person and which jobs the computer plays. */
  init(d) {
    this.d = d;
    this.me = d.me; this.job = d.me.job; this.skin = `astro-${this.job}-${d.me.look ?? 0}`;
    this.humans = d.players.filter(p => p.connected !== false);
    this.botJobs = Object.keys(JOBS).filter(j => !this.humans.some(p => p.job === j));
    this.done = {};                 // job -> true when its task is finished
    this.progress = {};             // job -> 0..1 (my own is shown on screen)
    this.started = false; this.hit = false;
  }

  /** Build the ship from levels/ship.js, add the player, other players and HUD, then start the story. */
  create() {
    addStoryPause(this);                                   // Esc / P: the host pauses the story for everyone
    audio.music('voyage');
    const rows = SHIP.rows, H = rows.length;
    // Turn the text floor plan into tiles: walls get a top or a face depending on what's below them
    const isWall = (x, y) => '#w'.includes(rows[y]?.[x] ?? '#');
    const data = rows.map((row, y) => [...row].map((ch, x) => (ch === '#' || ch === 'w') ? (isWall(x, y + 1) || y === H - 1 ? TILE.wallTop : ch === 'w' ? TILE.window : TILE.wallFace) : TILE.metal));
    const map = this.make.tilemap({ data, tileWidth: 16, tileHeight: 16 });
    const layer = map.createLayer(0, map.addTilesetImage('interior'), 0, 0);
    map.setCollision([TILE.wallTop, TILE.wallFace, TILE.window]);
    this.size = { w: rows[0].length * 16, h: H * 16 };

    // furniture, leaks, stations
    // Furniture and stations from the letters in the plan; things you can't walk through become 'solids'
    const solids = []; this.leaks = []; this.stations = {}; let spawn = { x: 48 * 16, y: 6 * 16 };
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const px = x * 16, py = y * 16;
      if ('123'.includes(ch)) this.leaks.push({ x: px + 8, y: py + 8, fixed: false, held: 0 });
      else if (ch === 'X') { this.add.image(px + 16, py + 32, 'f-wirepanel').setOrigin(0.5, 1).setDepth(py + 32); this.stations.builder = { x: px + 16, y: py + 40 }; addSolid(px + 16, py + 24, 32, 14); }
      else if (ch === 's') { this.add.image(px + 8, py + 16, 'f-seat').setOrigin(0.5, 1).setDepth(py + 16); this.stations.pilot = { x: px + 8, y: py + 22 }; }
      else if (ch === '*' && !this.spawnSet) { spawn = { x: px + 24, y: py + 8 }; this.spawnSet = true; }
      else if (FURNITURE[ch]) {
        const f = FURNITURE[ch]; const w = f.w * 16, h = f.h * 16;
        this.add.image(px + w / 2, py + h, `f-${f.key}`).setOrigin(0.5, 1).setDepth(py + h);
        addSolid(px + w / 2, py + h - 7, w, 14);
      }
    }));
    function addSolid(x, y, w, h) { solids.push({ x, y, w, h }); }
    const sz = solids.map(s => { const z = this.add.zone(s.x, s.y, s.w, s.h); this.physics.add.existing(z, true); return z; });
    this.stations.botanist = this.leaks[0];
    this.pipeGfx = this.add.graphics().setDepth(10);
    this.fx = this.add.graphics().setDepth(5000);

    // player
    // The player, with a small body at the feet so they can walk close to walls
    this.player = this.physics.add.sprite(spawn.x, spawn.y, this.skin, 0).setOrigin(0.5, 1);
    this.player.body.setSize(8, 5).setOffset(4, 10);
    this.physics.add.collider(this.player, layer); this.physics.add.collider(this.player, sz);
    this.physics.world.setBounds(0, 0, this.size.w, this.size.h);
    this.facing = 'down';
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.size.w, this.size.h); cam.startFollow(this.player, true, 0.2, 0.2); cam.setBackgroundColor('#05040c');
    if (this.size.h < SCREEN.height) cam.setBounds(0, -(SCREEN.height - this.size.h) / 2, this.size.w, SCREEN.height);

    // Computer crewmates are aboard from the start, at their stations (they work once the alarm goes off)
    this.addBots();

    // other crew (people)
    // Other players: their positions arrive as 'pos' messages; we catch up on any tasks finished before we opened
    this.others = new Map();
    this.onPos = d => { if (d.voyage) this.updateOther(d); };
    this.onEv = e => this.onEvent(e);
    net.on('pos', this.onPos); net.on('ev', this.onEv);
    this.events.once('shutdown', () => { net.off('pos', this.onPos); net.off('ev', this.onEv); });
    this.time.delayedCall(2700, () => { for (const e of net.recent) if (Date.now() - e.at < 90000 && e.type === 'voyageDone') this.onEvent(e); });

    // HUD
    // On-screen text: my task, title, the [E] prompt, the arrow to your station, and the red alarm flash
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(100000);
    this.taskText = this.add.text(6, 22, '', { ...VT, lineSpacing: -3 }).setScrollFactor(0).setDepth(100001).setStroke('#160c11', 3);
    this.title = this.add.text(SCREEN.width / 2, 4, VOYAGE_STORY.title, PX).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100001).setStroke('#160c11', 4);
    this.prompt = this.add.text(SCREEN.width / 2, SCREEN.height - 8, '', { ...VT, fontSize: '16px', backgroundColor: '#2a1820', padding: { x: 5, y: 1 } }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100001);
    this.arrow = this.add.graphics().setScrollFactor(0).setDepth(100001);
    this.red = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0xff0000, 0).setOrigin(0).setScrollFactor(0).setDepth(99999);
    this.bar = this.add.graphics().setDepth(100002);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,SPACE');
    this.keys.E.on('down', () => this.useStation());
    this.keys.SPACE.on('down', () => this.useStation());

    this.story(VOYAGE_STORY.intro, 2600, () => {
      this.started = true;
      this.cameras.main.shake(700, 0.012); this.alarm();
      this.story(`${VOYAGE_STORY.alarm}\n\nYour job: ${VOYAGE_TASKS[this.job].title}. ${VOYAGE_TASKS[this.job].how}`, 6000);
      // computer crewmates get to work
      for (const j of this.botJobs) this.botWork(j);
    });
  }

  /**
   * The computer crewmates (Nova, Bolt, Sky) on board: the Builder at the wire panel, the Pilot in the seat, the
   * Botanist by the first leak. Every screen draws its own copy (they don't move far, so they look the same).
   */
  addBots() {
    this.botFigs = new Map();
    const jobs = Object.keys(JOBS);
    for (const job of this.botJobs) {
      const at = job === 'botanist' ? { x: this.leaks[0].x, y: this.leaks[0].y + 12 } : this.stations[job];
      if (!at) continue;
      const skin = `astro-${job}-${(jobs.indexOf(job) + 1) % 4}`;
      const sprite = this.add.sprite(at.x, at.y, skin, 0).setOrigin(0.5, 1).setDepth(at.y);
      const tag = this.add.text(at.x, at.y - 16, `${BOT_NAMES[job]} (computer)`, { ...VT, fontSize: '12px', color: JOBS[job].color }).setOrigin(0.5, 1).setStroke('#160c11', 3).setDepth(9000);
      this.botFigs.set(job, { sprite, tag, skin, x: at.x, y: at.y, tx: at.x, ty: at.y, facing: 'up' });
    }
  }

  /** Move the computer crewmates: the Botanist walks from leak to leak as it patches them. */
  updateBots(dt) {
    for (const [job, b] of this.botFigs ?? []) {
      if (job === 'botanist' && this.started) { const l = this.leaks.find(l => !l.fixed); if (l) { b.tx = l.x; b.ty = l.y + 12; } }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), step = 50 * dt;
      const moving = d > 1;
      if (moving) { b.x += dx / d * Math.min(step, d); b.y += dy / d * Math.min(step, d); b.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); }
      else b.facing = 'up';
      b.sprite.setPosition(b.x, b.y).setDepth(b.y).anims.play(`${b.skin}-${moving ? 'walk' : 'idle'}-${b.facing}`, true);
      b.tag.setPosition(b.x, b.y - 16);
    }
  }

  /** A text card in the middle of the screen. Cards stay up twice as long as ms (playtesters needed time to read). */
  story(text, ms, then) {
    ms *= 2;
    this.card?.destroy();
    const c = this.card = this.add.container(SCREEN.width / 2, 236).setScrollFactor(0).setDepth(100003);
    const t = this.add.text(0, 0, text, { ...VT, fontSize: '16px', align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5);
    c.add([this.add.rectangle(0, 0, t.width + 20, t.height + 14, 0x2a1820, 0.95).setStrokeStyle(2, 0xf3d9a4), t]);
    this.time.delayedCall(ms, () => { if (this.card === c) { c.destroy(); this.card = null; } then?.(); });
  }

  /** Flash the screen red a few times. */
  alarm() { this.tweens.add({ targets: this.red, alpha: 0.18, duration: 400, yoyo: true, repeat: 5 }); }

  // ---------- tasks ----------
  /** A computer crewmate does its task: it fills its progress bar over 14-22 seconds. */
  botWork(job) {
    const dur = 14000 + Math.random() * 8000, t0 = this.time.now;
    const tick = this.time.addEvent({ delay: 250, loop: true, callback: () => {
      this.progress[job] = Math.min(1, (this.time.now - t0) / dur);
      if (job === 'botanist') this.leaks.forEach((l, i) => { if (this.progress.botanist >= (i + 1) / this.leaks.length) l.fixed = true; });   // the computer Botanist patches them one by one
      if (this.progress[job] >= 1) { tick.remove(); this.finish(job, false); }
    } });
  }

  /** A task is done. If it was mine, tell the others and show a real-science fact. */
  finish(job, mine = true) {
    if (this.done[job]) return;
    this.done[job] = true; this.progress[job] = 1;
    if (job === 'botanist') this.leaks.forEach(l => { l.fixed = true; });
    if (mine) {
      net.event('voyageDone', { job });
      this.story(`✔ Well done! Real science: ${VOYAGE_TASKS[job].fact}`, 4500);
    }
    this.checkFinal();
  }

  /** When the Botanist and Builder are done, the last strike hits (decided by the crew leader). */
  checkFinal() {
    if (this.hit || !net.isLeader) return;
    if (this.done.botanist && this.done.builder) {
      this.time.delayedCall(this.job === 'pilot' || this.humans.some(p => p.job === 'pilot') ? 2500 : 1500, () => { net.event('finalHit'); this.finalHit(); });
    }
  }

  /** Messages from other players: someone finished their task, or the final strike. */
  onEvent(e) {
    if (e.type === 'voyageDone') this.finish(e.job, false);
    if (e.type === 'leakFixed' && this.leaks[e.i]) this.leaks[e.i].fixed = true;
    if (e.type === 'finalHit') this.finalHit();
  }

  /** The final strike: close the wires panel; if the Pilot is dodging, they see the huge rock first. */
  finalHit() {
    if (this.hit) return;
    this.hit = true;
    audio.sfx('hit');
    this.scene.stop('Wires');
    const dodging = this.scene.isActive('Dodge');
    this.game.events.emit('finalHit');                 // the dodging game shows the huge rock coming
    this.time.delayedCall(dodging ? 2600 : 0, () => this.afterHit());
  }

  /** The ship is wrecked: shake, flash, show the escape line, then fade to the crash cutscene. */
  afterHit() {
    this.scene.stop('Dodge');
    this.cameras.main.shake(1500, 0.03); this.alarm();
    this.cameras.main.flash(300, 255, 255, 255);
    const pilot = this.humans.find(p => p.job === 'pilot')?.name ?? BOT_NAMES.pilot;   // the crew's real Pilot says the line
    this.story(VOYAGE_STORY.escape(pilot), 4200, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Crash', this.d));
    });
  }

  /** E or Space at your station opens your mini-game (Builder: Wires, Pilot: Dodge). */
  useStation() {
    if (!this.started || this.hit || this.overlay) return;
    const t = this.nearStation();
    if (!t) return;
    if (t === 'builder') { this.overlay = true; this.scene.launch('Wires', { onDone: () => { this.overlay = false; this.finish('builder'); }, onClose: () => { this.overlay = false; } }); }
    if (t === 'pilot') { this.overlay = true; this.scene.launch('Dodge', { onClose: () => { this.overlay = false; } }); }
  }

  /** Which station am I standing next to (only my own job's station counts)? */
  nearStation() {
    const p = this.player, near = s => s && Math.hypot(s.x - p.x, s.y - p.y) < 22;
    if (this.job === 'builder' && !this.done.builder && near(this.stations.builder)) return 'builder';
    if (this.job === 'pilot' && near(this.stations.pilot)) return 'pilot';
    return null;
  }

  // ---------- other players ----------
  /** Another player moved: create their sprite and name tag the first time, then set where they're heading. */
  updateOther(d) {
    let o = this.others.get(d.id);
    if (!o) {
      o = { sprite: this.add.sprite(d.x, d.y, d.skin, 0).setOrigin(0.5, 1), tag: this.add.text(d.x, d.y, d.name, { ...VT, fontSize: '12px', color: JOBS[d.job].color }).setOrigin(0.5, 1).setStroke('#160c11', 3).setDepth(9000), skin: d.skin };
      this.others.set(d.id, o);
    }
    o.tx = d.x; o.ty = d.y; o.facing = d.facing; o.moving = d.moving; o.hidden = d.hidden;
  }

  /** Every frame: move, send my position, move other players, the Botanist's leak patching, then the HUD. */
  update(time, delta) {
    const k = this.keys, p = this.player;
    // movement
    let dx = (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown), dy = (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown);
    if (this.overlay || !this.started && this.time.now < 2600) dx = dy = 0;
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    const sp = k.SHIFT.isDown ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.setVelocity(dx * sp, dy * sp);
    if (dx || dy) { this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); p.anims.play(`${this.skin}-walk-${this.facing}`, true); }
    else p.anims.play(`${this.skin}-idle-${this.facing}`, true);
    p.setDepth(p.y);
    this.updateBots(delta / 1000);
    if (net.socket && time - (this.lastSend ?? 0) > 100) { this.lastSend = time; net.send('pos', { voyage: true, x: Math.round(p.x), y: Math.round(p.y), facing: this.facing, moving: !!(dx || dy), skin: this.skin, name: this.me.name, job: this.job, hidden: this.overlay }); }
    for (const o of this.others.values()) {
      o.sprite.x += ((o.tx ?? o.sprite.x) - o.sprite.x) * 0.3; o.sprite.y += ((o.ty ?? o.sprite.y) - o.sprite.y) * 0.3;
      o.sprite.setDepth(o.sprite.y).anims.play(`${o.skin}-${o.moving ? 'walk' : 'idle'}-${o.facing || 'down'}`, true);
      o.tag.setPosition(o.sprite.x, o.sprite.y - 16);
    }

    // Botanist: hold E at a leak to patch it
    this.bar.clear();
    if (this.job === 'botanist' && this.started && !this.done.botanist) {
      const leak = this.leaks.find(l => !l.fixed && Math.hypot(l.x - p.x, l.y + 10 - p.y) < 20);
      if (leak && k.E.isDown) {
        leak.held += delta;
        this.bar.fillStyle(0x160c11).fillRect(p.x - 13, p.y - 24, 26, 5).fillStyle(0x7bd88f).fillRect(p.x - 12, p.y - 23, 24 * Math.min(1, leak.held / LEAK_MS), 3);
        if (leak.held >= LEAK_MS) {
          leak.fixed = true; this.cameras.main.shake(100, 0.003);
          net.event('leakFixed', { i: this.leaks.indexOf(leak) });          // the patch shows on everyone's screen
          if (this.leaks.every(l => l.fixed)) this.finish('botanist');
        }
      } else if (leak) leak.held = Math.max(0, leak.held - delta);
      this.progress.botanist = this.leaks.filter(l => l.fixed).length / this.leaks.length;
    }

    // pipes and leak puffs
    // The lab's air pipe, and white puffs of escaping air at each leak (yellow patch once fixed)
    const g = this.pipeGfx; g.clear();
    g.fillStyle(0x9aa3a8).fillRect(10 * 16, 2 * 16 + 4, 19 * 16, 4).fillStyle(0x6f777d).fillRect(10 * 16, 2 * 16 + 8, 19 * 16, 1);
    const fx = this.fx; fx.clear();
    if (this.started) for (const l of this.leaks) {
      if (l.fixed) { fx.fillStyle(0xffd34d).fillRect(l.x - 3, l.y - 10, 6, 4); continue; }
      fx.fillStyle(0xffffff, 0.7);
      for (let i = 0; i < 6; i++) { const t = ((time / 600 + i / 6) % 1); fx.fillCircle(l.x + Math.sin(i * 2 + time / 300) * 5 * t, l.y - 8 + t * 18, 1 + t * 2); }
    }

    // My OWN task only (not the whole crew's), the [E] prompt and the arrow
    const j = this.job, pr = this.done[j] ? '✔ DONE' : j === 'pilot' ? '' : `${Math.round((this.progress[j] ?? 0) * 100)}%`;
    this.taskText.setText(this.started ? `YOUR JOB: ${VOYAGE_TASKS[j].title}${pr ? `  ${pr}` : ''}` : '').setColor(this.done[j] ? '#7bd88f' : JOBS[j].color);
    const near = this.nearStation();
    const leakNear = this.job === 'botanist' && this.leaks.some(l => !l.fixed && Math.hypot(l.x - p.x, l.y + 10 - p.y) < 20);
    this.prompt.setText(near === 'builder' ? '[E] Fix the wires' : near === 'pilot' ? '[E] Take the controls' : leakNear ? '[Hold E] Patch the leak' : '').setVisible(!!(near || leakNear) && !this.overlay);
    this.drawArrow();
  }

  /** Point at my task: a small arrow above it if it's on screen, otherwise at the edge of the screen. */
  drawArrow() {
    const a = this.arrow; a.clear();
    if (!this.started || this.done[this.job] || this.hit) return;
    const target = this.job === 'botanist' ? this.leaks.find(l => !l.fixed) : this.stations[this.job];
    if (!target) return;
    const cam = this.cameras.main, sx = target.x - cam.scrollX, sy = target.y - cam.scrollY;
    if (sx > 20 && sx < SCREEN.width - 20 && sy > 20 && sy < SCREEN.height - 20) { a.fillStyle(0xffd34d).fillTriangle(sx - 5, sy - 22, sx + 5, sy - 22, sx, sy - 15); return; }
    const cx = SCREEN.width / 2, cy = SCREEN.height / 2, ang = Math.atan2(sy - cy, sx - cx);
    const x = cx + Math.cos(ang) * (SCREEN.width / 2 - 16), y = cy + Math.sin(ang) * (SCREEN.height / 2 - 30);
    a.fillStyle(0xffd34d).fillTriangle(x + Math.cos(ang) * 9, y + Math.sin(ang) * 9, x + Math.cos(ang + 2.5) * 7, y + Math.sin(ang + 2.5) * 7, x + Math.cos(ang - 2.5) * 7, y + Math.sin(ang - 2.5) * 7);
  }
}
