// The Mars surface: the main scene of the game. It owns the game state while you play:
//   the map, buildings, the player, your bag, the crew chest, crops, loot, the 5 machines, the rover,
//   survival (clock + bars), to-do lists, multiplayer and computer crewmates.
// Other scenes (Hud, Interior, Inventory, Menu, Night, End) read from and call into this one.
//
// 👤 Owner: Game logic & backend. The map is levels/map/mars.json (Level design); the words come from story/.
import { PLAYER, JOBS } from '/game/rules/settings.js';
import { createInventory, addItem, takeFromSlot, removeItem, countItem, BAG_SIZE, CHEST_SIZE } from '/game/rules/inventory.js';
import { itemName } from '/game/rules/items.js';
import { can, WHO } from '/game/rules/jobs.js';
import { PLANTERS, GROW_MINUTES } from '/game/rules/farm.js';
import { INTERIORS } from '/levels/rooms.js';
import { LIGHT_MINUTES, SHOUTS } from '/story/radio.js';
import { Loot } from '../systems/Loot.js';
import { Equipment } from '../systems/Equipment.js';
import { Rover } from '../systems/Rover.js';
import { Survival, fmtTime } from '../systems/Survival.js';
import { TASKS } from '/game/rules/tasks.js';
import { FOOD_VALUE, HEAL_ITEMS, BODY, LAUNCH, RADIATION, START_FOOD, AIR, BASE } from '/game/rules/survival.js';
import { JOB_GOALS } from '/game/rules/tasks.js';
import { ZONE_FACTS } from '/story/places.js';
import { SHELF_LOOT } from '/levels/loot.js';
import { ARRIVAL, HOME } from '/story/crash.js';
import { audio, EVENT_SOUNDS } from '../systems/Audio.js';
import { makeRng } from '/game/rules/rng.js';
import { net } from '../net.js';
import { Multiplayer } from '../systems/Multiplayer.js';
import { Bots } from '../systems/Bots.js';
import { MINIGAME_KEYS } from './MiniGame.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

/** Read a custom property that Level design set on a Tiled map object (e.g. a zone's 'hazard'). */
const prop = (o, k) => o.properties?.find(p => p.name === k)?.value;
// The mini game the Builder plays to fix each machine (instead of a progress bar). See scenes/*Game.js.
// The colour of tuned grow lights (mostly red + blue): the greenhouse glows this pink, inside and out
export const PINK = 0xff5fd2;
const REPAIR_GAME = { moxie: 'MoxieGame', fission_generator: 'AtomGame', greenhouse_lights: 'WeldGame', laser_comms: 'WeldGame', rocket: 'WeldGame' };
const START_ITEMS = [START_FOOD];   // every astronaut lands with 3 food packs (game/rules/survival.js); after that the Botanist feeds the crew

/** Scene: Mars. Everything that happens outdoors, plus the shared game state. */
export class WorldScene extends Phaser.Scene {
  /** Register the scene under the name 'World'. */
  constructor() { super('World'); }

  /** Who am I (name, job, look) and the shared random seed for this game. */
  init(data) {
    this.startData = data;
    this.me = data.me ?? { id: 'me', name: 'Astronaut', job: 'builder', look: 0 };
    this.job = this.me.job || 'builder';
    this.look = this.me.look ?? 0;
    this.rng = makeRng(data.seed ?? 1);
  }
  /** Sprite sheet for my job + visor colour */
  get skin() { return `astro-${this.job}-${this.look}`; }
  /** Playing with other people? (menus no longer pause the clock) */
  get multi() { return net.multi; }

  /** Build the world from the map, then set up the player, controls, survival, multiplayer and bots. */
  create() {
    // ---- map (made in Tiled: levels/map/mars.json) ----
    const map = this.make.tilemap({ key: 'mars' });
    const tiles = map.addTilesetImage('mars', 'tiles');
    map.createLayer('ground', tiles, 0, 0).setDepth(-10000);
    const obstacles = this.obstacles = map.createLayer('obstacles', tiles, 0, 0).setDepth(-9999);
    obstacles.setCollisionByProperty({ collides: true });
    this.mapSize = { w: map.widthInPixels, h: map.heightInPixels };
    this.objects = map.getObjectLayer('objects').objects;

    // ---- buildings & landmarks ----
    const solids = this.solids = [];
    const addSolid = (x, y, w, h) => { const z = this.add.zone(x, y, w, h); this.physics.add.existing(z, true); solids.push(z); };
    this.buildings = {};
    for (const o of this.objects) {
      if (o.type !== 'building' && o.type !== 'landmark') continue;
      const key = o.type === 'landmark' ? 'b-wreck' : `b-${o.name}`;
      const img = this.add.image(o.x, o.y, key).setOrigin(0, 0).setDepth(o.y + o.height - 6);
      if (o.name === 'greenhouse') {             // tuned grow lights make it glow pink (see updateGreenhouseGlow)
        this.greenhouseImg = img;
        this.greenhouseGlow = this.add.ellipse(o.x + o.width / 2, o.y + o.height / 2, o.width + 28, o.height + 18, PINK, 0.32)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(o.y + o.height - 5).setVisible(false);
      }
      // Only the bottom part blocks you, so you can walk "behind" roofs and towers
      const fh = Math.max(10, Math.round(o.height * 0.4));
      addSolid(o.x + o.width / 2, o.y + o.height - fh / 2 - 5, o.width - 8, fh);
      this.buildings[o.name] = { ...o, door: { x: o.x + o.width / 2, y: o.y + o.height + 2 } };
      if (o.name === 'rocket') this.decorateRocket(this.buildings.rocket);
      // A name sign on top of each building, so you know where you are
      if (INTERIORS[o.name]) this.add.text(o.x + o.width / 2, o.y + 2, INTERIORS[o.name].name.toUpperCase(), { fontFamily: 'VT323', fontSize: '12px', color: '#fbefd5', backgroundColor: '#2a4a6a', padding: { x: 3, y: 0 } })
        .setOrigin(0.5, 1).setDepth(99990);
    }
    for (const o of this.objects.filter(o => o.type === 'equipment'))      // machines block movement too
      addSolid(o.x + o.width / 2, o.y + o.height - 6, o.width - 10, 8);

    // ---- crew storage chest: lives inside the hab ----
    this.chest = { inv: createInventory(CHEST_SIZE) };

    // ---- greenhouse planters (logic in game/rules/farm.js; the beds are inside the greenhouse) ----
    this.planters = new Array(PLANTERS).fill(null);
    this.fert = new Array(PLANTERS).fill(false);      // beds the Botanist fertilized (grow 2x until their next harvest); synced like the planters
    this.lightsTuned = false;                         // the Botanist tuned the grow lights (Light Recipe mini game); until then crops grow at half speed
    this.fertSol = 0;                                 // the sol I last made fertilizer at the toilet (once per sol)
    this.frost = null;                                // tonight's frost for the Botanist: { sol, until, playing } (see Survival.step)

    // ---- indoor state ----
    this.inside = null;                                     // which building you're in, or null
    this.roomPiles = {};                                    // things dropped inside buildings: { roomId: [{ gid, id, n, x, y }] }
    this.shelves = structuredClone(SHELF_LOOT);   // one-time finds on the spare parts shelves (levels/loot.js)
    this.messages = [];                                     // radio replies on their way from Earth
    this.lightMinutes = this.rng.int(...LIGHT_MINUTES);

    // ---- zones ----
    this.zones = this.objects.filter(o => o.type === 'zone')
      .map(o => ({ name: o.name, rect: new Phaser.Geom.Rectangle(o.x, o.y, o.width, o.height), fact: ZONE_FACTS[o.name] ?? '', hazard: !!prop(o, 'hazard') }))
      .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height); // smallest (most specific) first
    this.zone = null;

    // ---- loot: crates and items scattered across Mars ----
    const spots = this.objects.filter(o => o.type === 'loot').map(o => ({ x: o.x, y: o.y, table: prop(o, 'table') }));
    const ps = this.objects.find(o => o.name === 'player_start');
    this.basePoint = ps ? { x: ps.x, y: ps.y } : null;     // MOXIE's parts are placed near here (game/rules/loot.js)
    this.loot = new Loot(this, spots, obstacles, this.rng, this.startData.seed ?? 1);
    this.placeRockSamples();

    // ---- the rover (works from the start; only the Pilot drives) & the 5 broken machines ----
    this.rover = new Rover(this, this.objects.find(o => o.name === 'rover'), obstacles, solids);
    // A person is the Pilot: the rover starts half buried in sand near the crash site, and the Pilot frees it
    // (the Unstick mini game). A computer Pilot (or no Pilot at all): it starts parked in the garage, like before.
    if (this.startData.players.some(p => p.job === 'pilot')) { const at = this.stuckSpot(); this.rover.setStuck(true, at.x, at.y); }
    else this.rover.setInGarage(true, this.buildings.garage.door);
    const b = this.buildings, eq = n => this.objects.find(o => o.type === 'equipment' && o.name === n);
    const panels = this.objects.filter(o => o.type === 'equipment' && o.name === 'generator');
    const om = eq('moxie');
    this.equipment = new Equipment(this, this.objects, {
      fission_generator: { x: panels.reduce((t, o) => t + o.x + o.width / 2, 0) / panels.length, y: Math.max(...panels.map(o => o.y + o.height)) + 4 },
      moxie: { x: om.x + om.width / 2, y: om.y + om.height + 2 },
      greenhouse_lights: { x: b.greenhouse.door.x + 30, y: b.greenhouse.door.y - 6 },   // the lights' power box, beside the greenhouse door
      laser_comms: { x: b.comms.door.x + 22, y: b.comms.door.y - 6 },                  // the laser telescope mast, beside the door
      rocket: { x: b.rocket.door.x - 22, y: b.rocket.door.y - 6 },                     // the engine bay, beside the door
    }, this.rng);

    // ---- player ----
    // Start at the base, or beside the crashed lander if we've just played the story
    const wreck = this.objects.find(o => o.name === 'wreck');
    const start = this.startData.fromCrash ? { x: wreck.x + wreck.width + 10, y: wreck.y + wreck.height + 6 } : this.objects.find(o => o.name === 'player_start');
    this.player = this.physics.add.sprite(start.x, start.y, this.skin, 0).setOrigin(0.5, 1);
    this.player.body.setSize(8, 5).setOffset(4, 10);       // collision box at the feet
    this.player.setCollideWorldBounds(true);
    this.facing = 'down';
    this.physics.world.setBounds(0, 0, this.mapSize.w, this.mapSize.h);
    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.player, solids);
    this.physics.add.collider(this.player, this.rover.sprite);

    // ---- inventory ----
    this.inv = createInventory(BAG_SIZE);
    for (const [id, n] of START_ITEMS) addItem(this.inv, id, n);
    for (const [id, n] of this.startData.bonus ?? []) addItem(this.inv, id, n);    // from your launch interview answer
    this.sel = 0;               // selected hotbar slot
    this.uiOpen = false;        // true while a screen (bag, chest, greenhouse) is open
    this.action = null;         // timed action in progress (repairing, resting...)
    this.actionBar = this.add.graphics().setDepth(100001);

    // ---- camera ----
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.mapSize.w, this.mapSize.h);
    cam.startFollow(this.player, true, 0.2, 0.2);
    cam.setRoundPixels(true);

    // ---- controls ----
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,I,Q,J,B,SPACE');
    const numKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'];
    numKeys.forEach((k, i) => this.input.keyboard.addKey(k).on('down', () => !this.busy() && this.select(i)));
    this.input.on('wheel', (_p, _o, _dx, dy) => !this.busy() && this.select((this.sel + (dy > 0 ? 1 : -1) + BAG_SIZE) % BAG_SIZE));
    this.keys.E.on('down', () => !this.busy() && !this.inside && !this.onLadder && this.interact());
    this.keys.SPACE.on('down', () => !this.busy() && !this.inside && this.interact());
    this.keys.I.on('down', () => !this.busy() && !this.inRover && this.openScreen('Inventory', { mode: 'bag' }));
    // Q drops one; HOLD Q (half a second) to drop the whole stack
    this.keys.Q.on('down', () => {
      if (this.busy() || this.inRover) return;
      this.qHold = this.time.delayedCall(500, () => { this.qHold = null; this.drop(this.sel, true); });
    });
    this.keys.Q.on('up', () => { if (this.qHold) { this.qHold.remove(); this.qHold = null; this.drop(this.sel, false); } });
    this.keys.B.on('down', () => this.game.events.emit('toggleBase'));
    // TESTING ONLY (quick-test mode, ?job=...): J switches job. Normal games pick jobs in the lobby.
    this.keys.J.on('down', () => {
      if (!this.startData.quick || this.busy() || this.inRover || this.inside) return;
      const jobs = Object.keys(JOBS); this.setJob(jobs[(jobs.indexOf(this.job) + 1) % jobs.length]);
      if (this.bots.list.length) this.toast('Test mode: the computer crewmates keep their jobs too.', '#c9ad93');
    });

    // ---- survival & to-do lists ----
    this.survival = new Survival(this, this.rng);
    this.stats = { harvested: new Set(), zones: new Set() };
    this.tasks = Object.fromEntries(Object.keys(TASKS).map(j => [j, { done: new Set(), progress: {} }]));
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.checkTasks() });
    this.keys.F = this.input.keyboard.addKey('F');
    this.keys.F.on('down', () => !this.busy() && this.useItem(this.sel));
    this.input.keyboard.addKey('T').on('down', () => !this.busy() && this.showTasks());
    // Esc or P: the pause menu (controls, full to-do list, machines, crew)
    ['ESC', 'P'].forEach(k => this.input.keyboard.addKey(k).on('down', () => !this.uiOpen && this.now() - (this.uiClosedAt ?? -1e9) > 150 && this.openScreen('Pause')));
    this.input.keyboard.addKey('R').on('down', () => !this.busy() && this.shoutMenu());

    // ---- multiplayer: other astronauts and the shared world ----
    this.mp = new Multiplayer(this, this.startData);
    // ---- computer crewmates play the jobs nobody picked ----
    const taken = new Set(this.startData.players.filter(p => p.job).map(p => p.job));
    const aiJobs = new URLSearchParams(location.search).has('nobots') ? [] : Object.keys(JOBS).filter(j => !taken.has(j));
    this.bots = new Bots(this, aiJobs);
    this.pendingDelta = {};
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.flushDelta() });

    this.scene.launch('Hud');
    if (this.startData.rejoin) this.toast('Welcome back! Loading the crew\'s world...', '#7bd88f');
    // Arrival message (after the story). MOXIE is always the first job: its 10-minute timer starts when the game does.
    if (this.startData.fromCrash) this.time.delayedCall(800, () => this.openScreen('Menu', {
      title: ARRIVAL.title, color: '#ff8a3d',
      body: ARRIVAL.body({ job: JOBS[this.job].name, goal: JOB_GOALS[this.job], opens: LAUNCH.opens, closes: LAUNCH.closes, minutes: Math.round(this.survival.moxieLeft / 60) }),
      options: [{ label: ARRIVAL.button, fn: () => this.startMoxieTimer() }],
    }));
    else this.startMoxieTimer();
  }

  /** Start the 10-minute MOXIE timer (once the arrival message is closed). */
  startMoxieTimer() {
    if (this.moxieTimerOn) return;
    this.moxieTimerOn = true;
    this.game.events.emit('tasks');
  }

  /**
   * Where the stuck rover sits at the start: just left of the crashed lander (the story drops the player on
   * its right). The same spot on every screen (no randomness), nudged out of any rock.
   */
  stuckSpot() {
    const wr = this.objects.find(o => o.name === 'wreck'), x = wr.x - 26, y = wr.y + wr.height - 4;
    const clear = (cx, cy) => [-14, 0, 14].every(dx => !this.blockedAt(cx + dx, cy) && !this.blockedAt(cx + dx, cy + 6));
    if (clear(x, y)) return { x, y };
    for (let r = 8; r <= 96; r += 8) for (let a = 0; a < 16; a++) {
      const nx = Math.round(x + Math.cos(a / 16 * 6.283) * r), ny = Math.round(y + Math.sin(a / 16 * 6.283) * r);
      if (clear(nx, ny)) return { x: nx, y: ny };
    }
    return { x, y };
  }

  /**
   * 3 glowing rock samples for the Pilot, each in a different area (never the Reactor Wreck or Jezero Base).
   * Their spots come from their OWN random numbers made from the game's seed (like Loot.spillSpots), so every
   * screen puts them in the same places without using up the shared random numbers. Fixed ids ('rock-0..2')
   * make picking one up a normal claim, like any crate item.
   */
  placeRockSamples() {
    const rnd = makeRng(((this.startData.seed ?? 1) ^ 0x5a3c9e1) >>> 0);
    const skip = new Set(['Reactor Wreck', 'Jezero Base']);
    const areaAt = (x, y) => this.zones.find(z => z.rect.contains(x, y))?.name;    // the smallest area at a spot
    const areas = this.zones.filter(z => !skip.has(z.name)).map(z => z.name);
    for (let i = areas.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [areas[i], areas[j]] = [areas[j], areas[i]]; }
    let k = 0;
    for (const name of areas) {
      if (k >= 3) break;
      const r = this.zones.find(z => z.name === name).rect;
      for (let t = 0; t < 300; t++) {
        const x = Math.round(r.x + 48 + rnd() * (r.width - 96)), y = Math.round(r.y + 48 + rnd() * (r.height - 96));
        if (areaAt(x, y) !== name || this.blockedAt(x, y) || this.blockedAt(x, y - 8) || this.loot.ground.some(g => Math.hypot(g.x - x, g.y - y) < 24)) continue;
        this.loot.addGround(x, y, 'rock_sample', 1, null, null, `rock-${k}`);
        k++; break;
      }
    }
  }

  // ---------- multiplayer helpers ----------
  /** A change to the base supplies made by a non-leader. Sent to the leader each second. */
  baseDelta(k, v) { if (net.isLeader) return; this.pendingDelta[k] = (this.pendingDelta[k] ?? 0) + v; }
  /** Send any saved-up base changes to the leader (once a second). */
  flushDelta() {
    if (!Object.keys(this.pendingDelta).length) return;
    this.mp.send('baseDelta', { delta: this.pendingDelta }); this.pendingDelta = {};
  }
  /** The shared state the leader sends every second: clock, forecasts, machines, crops, the fix-first choice. */
  syncState() {
    const sv = this.survival;
    return { sol: sv.sol, min: sv.min, base: sv.base, known: Object.keys(sv.known).map(Number), equip: this.equipment.state(), planters: this.planters, moxieLeft: sv.moxieLeft, frozen: !!this.frozen,
      fert: this.fert, tuned: this.lightsTuned, roverStuck: !!this.rover.stuck };
  }
  /** Copy the leader's shared state (not the clock while I'm asleep; not machines mid-repair). */
  applySync(d) {
    const sv = this.survival;
    if (!this.sleeping) { sv.sol = d.sol; sv.min = d.min; }
    Object.assign(sv.base, d.base);
    for (const k of d.known) sv.known[k] = true;
    if (!this.action) this.equipment.applyState(d.equip);
    this.planters = d.planters;
    if (d.fert) this.fert = d.fert;
    if (d.tuned) this.setLightsTuned(true, false);                        // one-way: once tuned, always tuned
    if (d.roverStuck === false && this.rover.stuck) this.rover.setStuck(false);   // one-way: a stale sync can never re-stick a freed rover
    if (d.moxieLeft != null) { sv.moxieLeft = d.moxieLeft; if (d.moxieLeft < AIR.moxieSeconds) this.moxieTimerOn = true; }   // the leader's MOXIE timer
    if (d.frozen !== undefined && d.frozen !== !!this.frozen) this.setFrozen(d.frozen, false);
  }

  /**
   * The host's pause: on = true freezes the game for EVERYONE (no time passes, nobody moves, the computer
   * crewmates stop). broadcast: tell the others (false when the message came from the host).
   */
  setFrozen(on, broadcast) {
    this.frozen = !!on;
    if (broadcast) this.mp.send('freeze', { on: this.frozen });
    this.player.setVelocity(0, 0);
    this.game.events.emit('frozen', this.frozen);
  }
  /** Everything a rejoining player needs: the sync state plus loot, chest, shelves and the rover. */
  snapshot() {
    return { ...this.syncState(), loot: this.loot.snapshot(), chest: this.chest.inv, shelves: this.shelves, rover: { x: this.rover.x, y: this.rover.y, v: this.rover.view, f: this.rover.sprite.flipX, g: !!this.rover.inGarage, s: !!this.rover.stuck }, roomPiles: this.roomPiles };
  }
  /** Something dropped inside a building. broadcast: I dropped it (tell everyone). */
  addRoomPile(room, pile, broadcast) {
    (this.roomPiles[room] ??= []).push(pile);
    if (broadcast) this.mp.send('roomDrop', { room, pile });
    this.game.events.emit('roomPiles');
  }
  /** A pile inside a building was picked up (by me or someone else). */
  removeRoomPile(room, gid) {
    this.roomPiles[room] = (this.roomPiles[room] ?? []).filter(p => p.gid !== gid);
    this.game.events.emit('roomPiles');
  }

  /** Load a snapshot from the leader (I just rejoined the game). */
  applySnapshot(s) {
    const sv = this.survival;
    sv.sol = s.sol; sv.min = s.min; this.applySync(s);
    this.loot.applySnapshot(s.loot);
    this.chest.inv = s.chest; this.shelves = s.shelves;
    if (!this.inRover) {                     // (if I'm in the rover, my own position for it is the right one)
      this.rover.park(s.rover.x, s.rover.y, s.rover.v, s.rover.f);
      this.rover.setInGarage(!!s.rover.g, s.rover.g ? this.buildings.garage.door : null);
      if (s.rover.s) this.rover.setStuck(true, s.rover.x, s.rover.y);     // still stuck in the sand (the leader's word is the latest)
      else if (this.rover.stuck) this.rover.setStuck(false);
      this.game.events.emit('garage');
    }
    this.roomPiles = s.roomPiles ?? {};
    this.invChanged(); this.game.events.emit('base');
    this.toast('You\'re back with the crew!', '#7bd88f');
  }
  /** Tell the crew the planters changed (planted or harvested). */
  plantersChanged() { this.mp.send('planters', { planters: this.planters }); }
  /** Tell the crew which beds are fertilized. */
  fertChanged() { this.mp.send('fert', { fert: this.fert }); }
  /** The grow lights were tuned (Light Recipe). broadcast: I did it (tell everyone). */
  setLightsTuned(on, broadcast) {
    if (this.lightsTuned === !!on) return;
    this.lightsTuned = !!on;
    if (broadcast) this.mp.send('tuned', {});
    this.game.events.emit('base');
  }
  /**
   * Frost Watch: freeze the growing beds the Botanist didn't heat in time (saved = the bed indexes that were
   * heated; null = none). Frozen beds pause until the morning. Returns how many froze, and tells the crew.
   */
  freezeBeds(saved) {
    let n = 0;
    this.planters.forEach((p, i) => { if (p && (p.grown ?? 0) < GROW_MINUTES && !saved?.has(i) && !p.frozen) { p.frozen = true; n++; } });
    if (n) this.plantersChanged();
    return n;
  }
  /**
   * Is the greenhouse glowing pink? Once the grow lights are tuned (Light Recipe) and working, the red + blue
   * light makes it pink, inside and out, for everyone (it's shared state: 'tuned' + the lights' repair).
   */
  greenhousePink() { return this.lightsOk() && this.equipment.working('greenhouse_lights'); }
  /** Show the pink glow on the greenhouse building outside (gently pulsing). */
  updateGreenhouseGlow(time) {
    const on = this.greenhousePink();
    this.greenhouseGlow?.setVisible(on).setAlpha(0.24 + 0.08 * Math.sin(time / 700));
    if (on !== this.greenhouseWasPink) { this.greenhouseWasPink = on; on ? this.greenhouseImg?.setTint(0xffc4ee) : this.greenhouseImg?.clearTint(); }
  }
  /** Are the grow lights tuned? A computer Botanist tunes them by itself, so they count as tuned. */
  lightsOk() { return this.lightsTuned || !!this.bots?.list.some(b => b.job === 'botanist'); }
  /** Tell the crew the chest's contents changed. */
  chestChanged() { this.mp.send('chest', { inv: this.chest.inv }); }
  /** Tell the crew a machine changed, and redraw the base panel. */
  equipmentChanged() { this.mp.send('equip', { state: this.equipment.state() }); this.game.events.emit('base'); }

  /** Picked something up (the server agreed it was mine). */
  onPickedUp(id, n) {
    const p = this.player;
    const left = addItem(this.inv, id, n);
    if (left) this.dropAtFeet(id, left);
    this.loot.popText(p.x, p.y, `+${n - left} ${itemName(id)}`, '#7bd88f');
    this.invChanged(); this.taskEvent('pickup', id, n - left);
  }
  /** Put items on the ground at my feet and tell the crew. */
  dropAtFeet(id, n, near = null) {
    const at = near ?? this.player;
    const p = this.loot.freeSpotNear(at.x, at.y, 4, 14);
    const g = this.loot.addGround(p.x, p.y, id, n, this.player);
    if (g) this.mp.send('drop', { drops: [{ gid: g.gid, id, n, x: p.x, y: p.y }] });
  }



  /** R: quick shouts to the crew (and orders for computer crewmates). */
  shoutMenu() {
    const shout = text => { this.mp.send('shout', { text }); this.mp.showBubble(net.id, text); };
    const opts = SHOUTS.map(t => ({ label: `"${t}"`, fn: () => shout(t) }));
    if (this.bots?.list.length) opts.push(...this.bots.orderOptions());
    this.openScreen('Menu', { title: 'Shout to the crew', color: '#ffd34d', body: 'Everyone sees your shout. Computer crewmates follow orders.', options: opts });
  }

  /** Where I'm standing inside a building (for multiplayer). */
  interiorPos() { const i = this.scene.get('Interior'); return i?.player ? { x: i.player.x, y: i.player.y } : { x: 0, y: 0 }; }

  // ---------- to-do lists (one per job; see game/rules/tasks.js) ----------
  taskEvent(name, detail, n = 1) {
    if (EVENT_SOUNDS[name]) audio.sfx(EVENT_SOUNDS[name]);          // every game event can have a sound
    const t = this.tasks[this.job];
    for (const task of TASKS[this.job]) {
      if (t.done.has(task.id) || task.on !== name || task.check) continue;
      if (task.match && !task.match(detail)) continue;
      t.progress[task.id] = (t.progress[task.id] ?? 0) + n;
      if (t.progress[task.id] >= (task.count ?? 1)) this.completeTask(task);
    }
  }
  /** Once a second: tick off to-dos that test the game state (e.g. 'visit all 7 areas'). */
  checkTasks() {
    const t = this.tasks[this.job];
    for (const task of TASKS[this.job]) if (task.check && !t.done.has(task.id) && task.check(this)) this.completeTask(task);
  }
  /** A to-do is done: sound, message, and a star message when the whole list is done. */
  completeTask(task) {
    this.tasks[this.job].done.add(task.id);
    audio.sfx('todo');
    this.toast(`✔ To-do done: ${task.text}`, '#7bd88f');
    this.game.events.emit('tasks');
    if (this.tasks[this.job].done.size === TASKS[this.job].length) this.toast(`★ You finished the whole ${JOBS[this.job].name} to-do list!`, '#ffd34d');
  }
  /** The to-dos I haven't done yet. */
  openTasks() { return TASKS[this.job].filter(t => !this.tasks[this.job].done.has(t.id)); }
  /**
   * The ONE task the game tells me to do next (shown on the HUD). Tasks go in list order, except the Builder,
   * whose first two follow the crew's choice: power first means the fission generators come before MOXIE.
   */
  nextTask() {
    return this.openTasks()[0] ?? null;
  }
  /** T or the TO-DO button: the pause menu, open on the to-do list (✔ done, ▶ next, counts like (2/3)). */
  showTasks() { this.openScreen('Pause', { tab: 1, peek: true }); }
  /** How much food is in the crew chest (for the Botanist's 'pantry' to-do). */
  foodInChest() { return this.chest.inv.reduce((t, s) => t + (s && FOOD_VALUE[s.id] ? s.n : 0), 0); }

  // ---------- using items (F) ----------
  /** F: use the selected item. Oxygen canister: +50% suit air. Medkit: lowers radiation. Food: eat (indoors only). */
  useItem(slot) {
    const s = this.inv[slot], me = this.survival.me;
    if (!s) return;
    if (HEAL_ITEMS[s.id]) {
      if (me.health >= 98) return this.toast('Your health is already full.', '#ffd34d');
      removeItem(this.inv, s.id, 1); this.survival.heal(HEAL_ITEMS[s.id]);
      this.toast(`Medkit used: health +${HEAL_ITEMS[s.id]}.`, '#7bd88f'); return this.invChanged();
    }
    if (FOOD_VALUE[s.id]) {
      if (!this.inside) return this.toast('You can\'t eat in a spacesuit! Go inside first.', '#ffd34d');
      return this.eat(s.id);
    }
    if (s.id === 'fertilizer') return this.toast(MINIGAME_TEXT.fertilizer.useWhere, '#ffd34d');
    this.toast(`${itemName(s.id)} can't be used like that.`, '#c9ad93');
  }
  /** Eat one food item. */
  eat(id) {
    const me = this.survival.me;
    if (me.food >= 98) return this.toast('You\'re full!', '#ffd34d');
    removeItem(this.inv, id, 1); me.food = Math.min(100, me.food + FOOD_VALUE[id]);
    this.invChanged(); this.taskEvent('eat', id);
    this.toast(`Ate ${itemName(id)}: +${FOOD_VALUE[id]} food.`, '#7bd88f');
  }

  // ---------- knocked out, sleeping, morning ----------
  /**
   * Passed out (health reached 0; reason = what hurt you last: 'air', 'food' or 'radiation'). You drop your
   * bag where you fell and wake up 2 hours later in the medbay with half health. Nobody dies in this game.
   */
  knockOut(reason = 'air') {
    if (this.knockingOut) return;
    audio.sfx('knockout');
    this.knockingOut = true; this.knockStart = this.now();
    this.leaveRover();
    // Everything you carried stays where you fell (outside the building's door if you were indoors)
    const at = { x: this.player.x, y: this.player.y };
    const dropped = [], drops = [];
    this.inv.forEach((s, i) => {
      if (!s) return;
      const p = this.loot.freeSpotNear(at.x, at.y, 4, 22);
      const g = this.loot.addGround(p.x, p.y, s.id, s.n);
      if (g) drops.push({ gid: g.gid, id: s.id, n: s.n, x: p.x, y: p.y });
      dropped.push(`${s.n} ${itemName(s.id)}`); this.inv[i] = null;
    });
    if (drops.length) this.mp.send('drop', { drops });
    this.invChanged();
    const sv = this.survival;
    const me = sv.me;
    if (sv.airOn) me.suit = 100;                                        // the medbay has air once MOXIE works
    else me.suit = Math.max(me.suit, 30);
    me.food = Math.max(me.food, 20);                                    // your crew gave you a little food
    me.health = 50;                                                     // the medbay patched you up
    sv.min = Math.min(1439, sv.min + BODY.knockoutMinutes);
    const why = { air: 'You ran out of air', food: 'You fainted from hunger', radiation: 'Too much radiation made you sick' }[reason] ?? 'You passed out';
    this.goToHab('medbed', () => {
      this.knockingOut = false;
      this.toast(`${why}! You woke up in the medbay.${dropped.length ? ' Your things are where you fell.' : ''}`, '#ff5f5f');
    });
  }

  /** Go to sleep: freeze the player, tell the server, and show the Night screen. */
  sleep() {
    if (this.sleeping || this.ended) return;
    this.sleeping = true;
    this.leaveRover();
    this.uiOpen = true; this.player.setVelocity(0, 0);
    net.send('asleep', true);
    this.scene.launch('Night');
  }

  /** [E] Get up on the night screen: changed my mind, there's still work to do. */
  wakeUp() {
    if (!this.sleeping || this.scene.get('Night')?.racing) return;
    this.sleeping = false;
    net.send('asleep', false);
    this.scene.stop('Night');
    this.closeUI();
    this.toast('You got up. Go to bed when you\'re ready.', '#c9ad93');
  }

  /** The leader (or a solo player) runs the shared night and tells the crew. */
  runNightAsLeader() {
    if (!this.sleeping) return;
    const from = this.survival.min;                                  // for the night screen's racing clock
    const n = { ...this.survival.runNightShared(), from };
    this.mp.send('morning', { n, sync: this.syncState() });
    this.applyMorning({ n, leader: true });
  }

  /** Everyone: apply the night's results, my own part of it, and show the morning report. */
  applyMorning(e) {
    // First the night screen races the clock to 06:00, then the morning happens
    if (!e.raced && this.scene.isActive('Night')) return this.scene.get('Night').raceClock(e.n.from ?? 22 * 60, () => this.applyMorning({ ...e, raced: true }));
    if (!e.leader) {
      const sv = this.survival;
      sv.sol = e.sync.sol; sv.min = e.sync.min; this.applySync(e.sync);
    }
    const personal = this.survival.runNightPersonal(e.n);
    this.scene.stop('Night');
    this.uiOpen = false;
    this.morning([...e.n.lines, ...personal], this.survival.morningWarnings());
  }

  /** The morning report. If the emergency air ran out or the launch window has closed, the game ends instead. */
  morning(lines, warn) {
    this.taskEvent('sleep');
    if (this.survival.airMissed) { this.sleeping = false; return this.endGame(false, 'air'); }
    if (this.survival.windowMissed) { this.sleeping = false; return this.endGame(false, 'window'); }
    const sv = this.survival;
    this.openScreen('Menu', {
      title: `Good morning! Sol ${sv.sol}, ${fmtTime(sv.min)}`, color: '#ffd34d',
      body: [...lines, ...(warn.length ? ['', ...warn] : [])].join('\n'),
      options: [{ label: 'Start the day', fn: () => {} }],
    });
    this.sleeping = false;
    if (this.inside !== 'hab') this.goToHab('bunk');
  }

  /** Move the player into the hab, standing by a piece of furniture. */
  goToHab(at, then) {
    const go = () => { this.inside = null; this.enterBuilding('hab', at, then); };
    if (this.inside) { this.scene.stop('Interior'); this.scene.setVisible(true); }
    const door = this.buildings.hab.door; this.player.setPosition(door.x, door.y + 6);
    go();
  }

  // ---------- launch & endings ----------
  /** What still has to happen before launch (empty list = ready). */
  launchCheck() {
    const r = this.equipment.get('rocket'), sv = this.survival, need = [];
    if (r.progress < r.def.steps) need.push(`install ${r.def.steps - r.progress} more rocket part(s)`);
    const broken = this.equipment.list.filter(e => e.key !== 'rocket' && e.broken).map(e => e.def.name);
    if (broken.length) need.push(`fix ${broken.join(', ')}`);                 // you can fly as soon as EVERYTHING is fixed
    return need;
  }
  /** Crewmates (people) who still need to get into the rocket. Computer crewmates board by themselves. */
  missingCrew() { return [...this.mp.remotes.values()].filter(r => !r.bot && r.connected !== false && r.inside !== 'rocket'); }
  /** Launch! Everyone (people) must be inside the rocket first. */
  launch() {
    if (this.launchCheck().length) return;
    const missing = this.missingCrew();
    if (missing.length) return this.toast(`Wait! Still outside: ${missing.map(r => r.name).join(', ')}.`, '#ffd34d');
    this.taskEvent('launch');
    this.mp.send('launch', {});
    this.endGame(true, 'launch');
  }
  /** End the game for me and show the End scene with the crew's results. */
  endGame(win, reason) {
    if (this.ended) return;
    this.ended = true; this.uiOpen = true;
    if (net.isLeader) net.send('gameOver');
    const sv = this.survival;
    this.scene.launch('End', {
      win, reason, job: this.job,
      stats: {
        sol: sv.sol, dose: sv.me.totalDose, budget: RADIATION.limit,
        crops: [...this.stats.harvested].length, harvests: this.stats.harvests ?? 0,
        repairs: this.equipment.list.filter(e => !e.broken).length, equipment: this.equipment.list.length,
        tasks: this.tasks[this.job].done.size, taskTotal: TASKS[this.job].length,
        flares: sv.flares.filter(f => f.done && f.dose < RADIATION.flareDose * 0.5).length,
      },
    });
  }

  // ---------- helpers used by the HUD and other screens ----------
  /** The hab door: where the compass points. */
  get home() { return this.buildings.hab?.door ?? { x: 0, y: 0 }; }
  /** Tell the HUD my bag changed. */
  invChanged() { this.game.events.emit('inv'); }
  /** Show a message (the HUD draws it). */
  toast(text, color) { this.game.events.emit('toast', text, color); }
  /** Select hotbar slot i. */
  select(i) { this.sel = i; this.game.events.emit('sel', i); }

  /** Game clock in ms. Keeps running while you're indoors. */
  now() { return this.game.loop.time; }

  // A screen is open, an action is running, or a screen was just closed by this same key press
  /** True while a screen is open, an action is running, or a screen was closed by this same key press. */
  busy() { return this.frozen || this.uiOpen || !!this.action || this.now() - (this.uiClosedAt ?? -1e9) < 150; }
  /** A screen closed: the player can move again. */
  closeUI() { this.uiOpen = false; this.uiClosedAt = this.now(); }

  // ---------- buildings ----------
  /**
   * Go into a building: fade out, hide the outdoors and open the Interior scene.
   * at = furniture to stand next to; then = run once inside.
   */
  enterBuilding(id, at = null, then = null) {
    audio.sfx('door');
    this.inside = id;
    this.enteredAt = this.now();               // the room takes a moment to open (fade), so the safety net waits
    this.player.setVelocity(0, 0);
    this.leaveRover();
    const go = () => {
      this.scene.setVisible(false);
      this.scene.launch('Interior', { id, at });
      this.game.events.emit('inside', id);
      then?.();
    };
    if (this.scene.isVisible()) { this.cameras.main.fadeOut(200, 11, 7, 16); this.cameras.main.once('camerafadeoutcomplete', go); }
    else go();
  }

  /** Leave a building: close the Interior scene and stand in front of the door. */
  exitBuilding() {
    audio.sfx('door');
    const door = this.buildings[this.inside].door;
    this.scene.stop('Interior');
    this.inside = null;
    this.player.setPosition(door.x, door.y + 6);
    this.facing = 'down';
    this.scene.setVisible(true);
    this.cameras.main.fadeIn(250, 11, 7, 16);
    this.target = null;
    this.game.events.emit('inside', null);
    if (door === this.buildings.rocket.door) { this.getOnLadder(true); this.toast('Hold S (or Down) to climb down the ladder.', '#ffd34d'); }   // out of the rocket = at the top of the ladder
  }

  /** Change job (quick-test mode only, J key). */
  setJob(job) {
    this.job = job;
    this.player.setTexture(this.skin, 0);
    this.game.events.emit('job', job);
    this.toast(`You are now the ${JOBS[job].name}. ${JOBS[job].blurb}`, JOBS[job].color);
  }

  /**
   * A real-science fact, shown big on its own screen (scenes/FactScene.js). Facts wait in a queue and open one at a
   * time, only when no other screen is open (so a fact never pops up over a menu, a mini game or the night).
   * f: { title, body, icon?, color?, label? }
   */
  showFact(f) {
    if (!f?.body) return;
    (this.factQueue ??= []).push(f);
    this.nextFact();
  }
  /** Open the next waiting fact if nothing else is happening. */
  nextFact() {
    if (!this.factQueue?.length || this.uiOpen || this.ended || this.knockingOut || this.sleeping || this.action || this.frozen) return;
    if (this.now() - (this.uiClosedAt ?? -1e9) < 300) return;     // let the last screen finish closing first
    this.openScreen('Fact', { ...this.factQueue.shift(), fromWorld: true });
  }

  /** Open a pop-up scene (Menu, Inventory...). The player stops while it's open. */
  openScreen(key, data) {
    this.uiOpen = true; this.uiOpenedAt = this.now();
    this.player.setVelocity(0, 0);
    this.scene.launch(key, data);
  }

  /**
   * Safety net against 'I can't move!' (checked twice a second). Each of these should never happen, but if a
   * screen closes without telling us, or a timer is lost, the player would be stuck for ever:
   *   - a menu is marked open but no menu scene is running        -> mark it closed
   *   - 'inside' a building but the room isn't running             -> back outside at the door
   *   - passing out took far too long, or an action never finished -> clear it
   *   - standing inside a building or a rock (e.g. after getting out of the rover) -> step to a free spot
   */
  unstick(time) {
    // On the ladder the player is meant to be 'not solid'. But if something moved them off it (passing out,
    // "I'm stuck!", going into a building), they're not on the ladder any more.
    if (this.onLadder) {
      const L = this.buildings.rocket.ladder;
      if (!this.inside && !this.knockingOut && Math.abs(this.player.x - L.x) < 2) return;
      this.onLadder = false; this.player.body.enable = true;
    }
    if (this.ended || time - (this.lastUnstick ?? 0) < 500) return;
    this.lastUnstick = time;
    const sm = this.scene, now = this.now(), UI = ['Menu', 'Inventory', 'Pause', 'Night', 'Fact', ...MINIGAME_KEYS];   // every pop-up screen, mini games included
    if (this.uiOpen && !this.sleeping && now - (this.uiOpenedAt ?? 0) > 1500 && !UI.some(k => sm.isActive(k))) this.closeUI();
    if (this.inside && !this.knockingOut && now - (this.enteredAt ?? 0) > 2000 && !sm.isActive('Interior') && !sm.isPaused('Interior')) {
      const door = this.buildings[this.inside]?.door;
      this.inside = null; sm.setVisible(true);
      if (door) this.player.setPosition(door.x, door.y + 6);
      this.game.events.emit('inside', null);
    }
    if (this.knockingOut && now - (this.knockStart ?? now) > 10000) this.knockingOut = false;
    if (this.action && now - this.action.start > this.action.ms + 5000) this.action = null;
    const p = this.player;
    // Not in the rover or a building, but invisible / see-through / not solid? Show me properly again.
    if (!this.inside && !this.inRover && !this.knockingOut && !this.tweens.isTweening(p) && (!p.visible || p.alpha < 1 || p.scaleX !== 1 || !p.body.enable)) {
      p.setVisible(true).setAlpha(1).setScale(1); p.body.enable = true;
    }
    if (!this.inside && !this.inRover && p.body?.enable && this.blockedAt(p.x, p.y)) {
      const spot = this.freeSpotAround(p.x, p.y);
      if (spot) p.setPosition(spot.x, spot.y);
    }
  }

  /** Is this spot inside a rock, a mountain or a building? */
  blockedAt(x, y) {
    const t = this.obstacles.getTileAtWorldXY(x, y - 2);
    if (t?.collides) return true;
    return this.solids.some(z => Math.abs(z.x - x) < z.width / 2 && Math.abs(z.y - (y - 2)) < z.height / 2);
  }

  /** The nearest free spot around (x, y), searching outwards, or null. */
  freeSpotAround(x, y) {
    for (let r = 8; r <= 96; r += 8) for (let a = 0; a < 16; a++) {
      const nx = x + Math.cos(a / 16 * 6.283) * r, ny = y + Math.sin(a / 16 * 6.283) * r;
      if (!this.blockedAt(nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }

  /**
   * The rocket on Mars is the same picture as on launch day (the mission patch and NASA are painted in it), plus a
   * hatch, plus a separate ladder standing beside it (not part of the rocket). The way in is up the ladder,
   * so the rocket's 'door' is the bottom of the ladder.
   */
  decorateRocket(b) {
    const x = b.x, y = b.y, depth = y + b.height - 5;
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(0x2a2a2a).fillRect(x + 26, y + 44, 4, 9).lineStyle(1, 0x8e949b).strokeRect(x + 26, y + 44, 4, 9);   // the hatch
    g.fillStyle(0x1d3f8f).fillCircle(x + 28, y + 47, 1.2);
    // The ladder: on its own feet, a little gap away from the rocket, up to the hatch
    const lx = x + 37, top = y + 46, foot = y + b.height - 6;
    const l = this.add.graphics().setDepth(depth + 1);
    l.fillStyle(0x8e949b).fillRect(lx, top, 1, foot - top).fillRect(lx + 6, top, 1, foot - top);
    for (let yy = top + 3; yy < foot; yy += 5) l.fillRect(lx, yy, 7, 1);
    l.fillStyle(0x6f777d).fillRect(lx - 1, foot - 1, 9, 2);
    b.ladder = { x: lx + 3.5, top: top + 9, foot: foot + 8 };
    b.door = { x: lx + 3.5, y: b.y + b.height + 2 };
  }

  /**
   * The rocket's ladder works like the one on launch day: walk to the bottom of it and hold W (or Up) to
   * climb; at the top you go in through the hatch. Coming out, you start at the top: hold S (or Down) to
   * climb down, and you step off at the bottom.
   */
  atLadderFoot() {
    const p = this.player, L = this.buildings.rocket?.ladder;
    return !!L && Math.abs(p.x - L.x) < 9 && p.y > L.foot - 8 && p.y < L.foot + 14;
  }
  getOnLadder(atTop = false) {
    const p = this.player, L = this.buildings.rocket.ladder;
    this.onLadder = true; p.body.enable = false; p.setVelocity(0, 0);
    p.setPosition(L.x, atTop ? L.top : Math.min(p.y, L.foot));
    p.setDepth(L.foot);                       // in front of the ladder the whole way up
    this.facing = 'up';
    this.target = { label: 'On the ladder: hold W to climb up into the rocket, S to climb down', act: () => {} };
  }
  /** One frame on the ladder: up / down with W / S (or the arrow keys). */
  ladderStep(dy, delta) {
    const p = this.player, L = this.buildings.rocket.ladder;
    if (dy) { p.y = Phaser.Math.Clamp(p.y + Math.sign(dy) * 45 * delta / 1000, L.top, L.foot); p.anims.play(`${this.skin}-walk-up`, true); }
    else p.anims.play(`${this.skin}-idle-up`, true);
    if (p.y <= L.top && dy < 0) { this.onLadder = false; return this.enterBuilding('rocket'); }          // at the hatch: in you go
    if (p.y >= L.foot && dy > 0) { this.onLadder = false; p.body.enable = true; this.facing = 'down'; }   // back on the ground
  }

  /** Menu > SETTINGS > "I'm stuck!": walk out of anything, close anything stuck, or go back to the hab door. */
  imStuck() {
    this.closeUI(); this.action = null; this.leaveRover();
    const spot = this.blockedAt(this.player.x, this.player.y) ? this.freeSpotAround(this.player.x, this.player.y) : null;
    const door = this.buildings.hab.door;
    this.player.setPosition(spot?.x ?? door.x, spot?.y ?? door.y + 10);
    this.player.body.enable = true; this.player.setVisible(true);
    this.toast('Unstuck! If it happens again, tell the host.', '#7bd88f');
  }

  /** Something that takes time (you can't move while doing it). Shows a progress bar above you. */
  startAction(label, ms, onDone) {
    this.player.setVelocity(0, 0);
    this.action = { label, ms, start: this.now(), onDone };
    this.game.events.emit('action', label);
  }

  /** Finish the timed action when its time is up (called every frame, indoors or out). */
  tickAction() {
    if (this.action && this.now() - this.action.start >= this.action.ms) { const a = this.action; this.action = null; a.onDone(); }
  }

  /** Drop one item (or the whole stack) from a bag slot onto the ground in front of you. */
  drop(slot, all = false) {
    const s = this.inv[slot];
    if (!s) return;
    const got = takeFromSlot(this.inv, slot, all ? s.n : 1);
    if (this.inside) {                        // indoors: it goes on the room's floor (everyone sees it)
      const ip = this.interiorPos(), pile = { gid: this.mp.newGid(), id: got.id, n: got.n, x: Math.round(ip.x), y: Math.round(ip.y + 6) };
      this.addRoomPile(this.inside, pile, true);
      pile.mine = this.now() + 2000;            // don't pick it straight back up
      this.toast(`Dropped ${got.n} ${itemName(got.id)}`, '#c9ad93'); return this.invChanged();
    }
    const ahead = { down: [0, 10], up: [0, -10], left: [-10, 0], right: [10, 0] }[this.facing];
    const p = this.loot.freeSpotNear(this.player.x + ahead[0], this.player.y + ahead[1], 0, 8);
    const g = this.loot.addGround(p.x, p.y, got.id, got.n, this.player, { x: this.player.x, y: this.player.y - 6 });
    if (g) this.mp.send('drop', { drops: [{ gid: g.gid, id: got.id, n: got.n, x: p.x, y: p.y }] });
    this.loot.popText(this.player.x, this.player.y, `Dropped ${got.n} ${itemName(got.id)}`, '#c9ad93');
    this.invChanged();
  }

  // ---------- what E does ----------
  /** What E would use right now: the rover exit, a door, the rover, a machine or a crate (in that order). */
  findTarget() {
    const p = this.player, near = (o, r) => Math.hypot(o.x - p.x, o.y - p.y) < r;
    if (this.rover.driving && near(this.buildings.garage.door, 34)) return { label: 'Park the rover in the garage', act: () => this.parkInGarage() };
    if (this.inRover) return { label: 'Get out of the rover', act: () => this.leaveRover() };

    // Building doors
    for (const [id, b] of Object.entries(this.buildings)) {
      if (id === 'rocket' && near(b.door, 14)) return { label: 'Ladder: hold W (or Up) to climb into the rocket', act: () => this.toast('Hold W (or the Up arrow) to climb the ladder into the rocket.', '#ffd34d') };
      if (INTERIORS[id] && near(b.door, 14)) return { label: `Enter the ${INTERIORS[id].name}`, act: () => this.enterBuilding(id) };
    }

    // Stuck in the sand: only the Pilot can free it (the Unstick mini game). Nobody can drive or ride it until then.
    if (this.rover.stuck && near({ x: this.rover.x, y: this.rover.y + 6 }, 26)) {
      const U = MINIGAME_TEXT.unstick;
      if (!can(this.job, 'drive')) return { label: U.promptOther, act: () => this.toast(U.promptOther, '#ffd34d') };
      return { label: U.prompt, act: () => this.openScreen('UnstickGame', { onWin: () => this.freeRover() }) };
    }
    if (!this.rover.inGarage && !this.rover.stuck && near({ x: this.rover.x, y: this.rover.y + 6 }, 22)) {
      // Not the Pilot, or someone is already driving: ride along as a passenger (3 seats)
      if (this.rover.driverId || !can(this.job, 'drive')) {
        const free = this.rover.constructor.freeSeats(this.roverRiders().length);
        if (free <= 0) return { label: 'The rover is full (3 seats)', act: () => {} };
        return { label: `Ride in the rover (${free} seat${free > 1 ? 's' : ''} free)`, act: () => this.rideRover() };
      }
      return { label: 'Drive the rover', act: async () => {
        if (!can(this.job, 'drive')) return this.toast(WHO.drive, '#ff5f5f');
        const ok = await net.claim('rover');
        if (ok === null) return this.toast('The connection is slow. Try again.', '#ffd34d');
        if (!ok) return this.toast('Someone else just got in!', '#ffd34d');
        this.rover.enter(this.player); this.taskEvent('drive');
      } };
    }
    const e = this.equipment.nearest(p.x, p.y);
    if (e) return this.equipmentTarget(e);
    const c = this.loot.nearestCrate(p.x, p.y);
    if (c) return { label: 'Open supply crate', act: async () => { if (await this.loot.openCrate(c)) { audio.sfx('crate'); this.loot.popText(c.x, c.y, 'Crate opened!', '#ffd34d'); } } };
    return null;
  }

  /** What E does at a machine: fix it, install a rocket part, or show what it does. */
  equipmentTarget(e) {
    const name = e.def.name;
    // The rocket takes several parts, installed one at a time
    if (e.key === 'rocket') {
      const steps = e.def.steps;
      if (e.progress >= steps) return { label: 'Ascent rocket: all parts installed!', act: () => this.toast(`The rocket is fixed! When every machine works, go inside and launch. ${HOME.line}`, '#7bd88f') };
      return { label: `Install rocket parts (${e.progress}/${steps} done, you have ${countItem(this.inv, 'rocket_part')})`, machine: e, act: () => this.repair(e) };
    }
    if (e.broken) return { label: `Fix the ${name}`, machine: e, act: () => this.repair(e) };   // the HUD shows the parts it needs
    const state = this.equipment.onBattery(e.key) ? 'working on battery at HALF SPEED (fix the fission generators)' : this.equipment.working(e.key) ? 'working' : 'fixed, but NO POWER (fix the fission generators)';
    return { label: `${name}: ${state}`, act: () => this.showFact({ title: name, body: `${e.def.does}\n\n${e.def.fact}` }) };
  }

  /**
   * Fix a machine (Builder only, with the right parts in your bag). You still need the parts to start.
   * A mini game replaces the old timed progress bar (REPAIR_GAME says which one); winning it runs
   * finishRepair, the same repair code as before. Esc quits the mini game with nothing used up.
   */
  repair(e) {
    if (!can(this.job, 'repair')) return this.toast(`${WHO.repair}`, '#ff5f5f');
    const missing = this.equipment.missing(e, this.inv);
    if (missing.length) return this.toast(`You still need: ${missing.map(m => `${m.need - m.have} more ${itemName(m.id)}`).join(', ')}.`, '#ff5f5f');
    const game = REPAIR_GAME[e.key];
    if (game) return this.openScreen(game, { machine: e, onWin: () => this.finishRepair(e) });
    // No mini game for this machine: the old progress bar
    const parts = e.key === 'rocket' ? Math.min(countItem(this.inv, 'rocket_part'), e.def.steps - e.progress) : 0;
    this.startAction(e.key === 'rocket' ? `Installing ${parts} rocket part${parts > 1 ? 's' : ''}` : `Repairing ${e.def.name}`, e.def.repairMs, () => this.finishRepair(e));
  }

  /**
   * The repair itself: parts used up, the machine fixed, everyone told, to-do ticked, facts shown.
   * The rocket: install EVERY rocket part you're carrying in one go (up to the number still missing).
   */
  finishRepair(e) {
    const missing = this.equipment.missing(e, this.inv);
    if (missing.length) return this.toast(`You still need: ${missing.map(m => `${m.need - m.have} more ${itemName(m.id)}`).join(', ')}.`, '#ff5f5f');
    if (e.key !== 'rocket' && !e.broken) return;                 // already fixed (by a crewmate) while we played
    const parts = e.key === 'rocket' ? Math.min(countItem(this.inv, 'rocket_part'), e.def.steps - e.progress) : 0;
    if (e.key === 'rocket' && parts <= 0) return;
    if (e.key === 'rocket') removeItem(this.inv, 'rocket_part', parts);
    else for (const [id, n] of Object.entries(e.def.needs)) removeItem(this.inv, id, n);
    this.invChanged();
    if (e.key === 'rocket') { e.progress += parts; e.broken = e.progress < e.def.steps; } else e.broken = false;
    this.equipment.refresh();
    this.equipmentChanged();
    this.toast(e.key === 'rocket' ? (e.broken ? `${parts} rocket part${parts > 1 ? 's' : ''} installed (${e.progress}/${e.def.steps}).` : 'All 5 rocket parts are in. The rocket is fixed!') : `${e.def.fixed}${e.def.powered && !this.equipment.powered ? ' (It needs power: fix the fission generators!)' : e.def.battery && !this.equipment.powered ? ' (It runs at half speed on its battery until the fission generators work.)' : ''}`, '#7bd88f');
    this.taskEvent('repair', e.key);
    if (!REPAIR_GAME[e.key]) this.showFact({ title: e.def.name, body: e.def.fact });   // (a mini game shows its own fact when you win)
  }

  /** E pressed outdoors: do whatever the target is. */
  interact() { this.target?.act(); }
  /** Get out of the rover and let someone else claim it. */
  exitRover() {
    if (!this.rover.driving) return;
    this.rover.exit(this.player, this.obstacles); net.release('rover');
    this.mp.send('roverPark', { x: Math.round(this.rover.x), y: Math.round(this.rover.y), v: this.rover.view, f: this.rover.sprite.flipX });   // everyone parks it in the same spot
  }
  /** Pilot, in the garage: drive the rover out of the door (you're driving as soon as you're outside). */
  async driveOutOfGarage() {
    if (!can(this.job, 'drive')) return this.toast(WHO.drive, '#ff5f5f');
    const ok = await net.claim('rover');
    if (ok === null) return this.toast('The connection is slow. Try again.', '#ffd34d');
    if (!ok) return this.toast('Someone else just got in!', '#ffd34d');
    const door = this.buildings.garage.door;
    this.exitBuilding();
    this.rover.setInGarage(false, door);
    this.mp.send('roverGarage', { in: false });
    this.rover.enter(this.player); this.taskEvent('drive');
    this.game.events.emit('garage');
  }
  /** Drive into the garage: the rover is parked inside, and I get out by the door. */
  parkInGarage() {
    this.exitRover();
    this.rover.setInGarage(true, this.buildings.garage.door);
    this.mp.send('roverGarage', { in: true });
    this.toast('Rover parked in the garage. Go inside the garage to drive it out again.', '#c9ad93');
    this.game.events.emit('garage');
  }

  /** I (the Pilot) won the Unstick mini game: the rover is free, and everyone is told (the leader's sync and snapshots carry it too). */
  freeRover() {
    if (!this.rover.stuck) return;
    this.rover.setStuck(false);
    this.mp.send('roverFree', {});
    this.game.events.emit('garage');
    this.toast(MINIGAME_TEXT.unstick.free, '#7bd88f');
  }

  /** Am I in the rover (driving or riding)? */
  get inRover() { return this.rover.driving || !!this.riding; }
  /** Hop into a passenger seat. Only the Pilot drives; passengers just enjoy the ride. */
  rideRover() {
    this.riding = true;
    this.rover.climbIn(this.player);
    this.toast(this.rover.driverId ? 'You hop into a passenger seat. Wheee!' : 'You sit in a passenger seat. Wait for the Pilot to drive!', '#7bd88f');
  }
  /** Get out of a passenger seat. */
  exitRide() {
    if (!this.riding) return;
    this.riding = false;
    this.rover.climbOut(this.player, ...this.rover.exitSpot(this.obstacles));
  }
  /** Get out of the rover, whichever seat I'm in. */
  leaveRover() { this.exitRover(); this.exitRide(); }
  /** Job colours of everyone in the rover, driver first (for the helmets drawn on its seats). */
  roverRiders() {
    const col = job => Phaser.Display.Color.HexStringToColor(JOBS[job].color).color;
    const remotes = [...(this.mp?.remotes.values() ?? [])].filter(r => r.connected !== false);
    const driver = this.rover.driving ? this.job : remotes.find(r => r.driving)?.job;
    const riders = [...(this.riding ? [this.job] : []), ...remotes.filter(r => r.riding).map(r => r.job)];
    return [...(driver ? [driver] : []), ...riders].map(col);
  }

  // ---------- every frame ----------
  /**
   * Every frame: radio replies, survival, multiplayer, music, bots, then movement, pick-ups,
   * the [E] target and which area you're in.
   */
  update(time, delta) {
    const k = this.keys, p = this.player;

    // Radio replies arrive after the Earth–Mars delay, wherever you are
    while (this.messages.length && this.messages[0].at <= this.now()) { const m = this.messages.shift(); m.fn?.(); this.toast(`${m.text}`, '#6cc4ff'); }
    this.survival.tick(delta / 1000);
    this.mp.update(time);
    this.nextFact();                                     // a science fact waiting to be shown (showFact)
    this.updateGreenhouseGlow(time);
    if (!this.ended) audio.music(this.survival.daylight ? 'mars_day' : 'mars_night');   // day / night music
    // The host paused the game: nobody moves and no time passes (the clock check is in Survival.tick)
    if (this.frozen) { p.setVelocity(0, 0); this.rover.drive(0, 0); p.anims.play(`${this.skin}-idle-${this.facing}`, true); return; }
    this.unstick(time);
    this.bots?.update(time, delta);
    this.rover.update(time, this.roverRiders());   // wheels, dust and the helmets on its seats
    this.messages.sort((a, b) => a.at - b.at);

    if (this.inside || this.knockingOut) { p.setVelocity(0, 0); return; }   // indoors, the Interior scene is in charge
    this.drawActionBar();
    if (this.uiOpen) { p.setVelocity(0, 0); p.anims.play(`${this.skin}-idle-${this.facing}`, true); this.rover.drive(0, 0); return; }

    // Timed action in progress: stand still until it finishes
    if (this.action) {
      p.setVelocity(0, 0); p.anims.play(`${this.skin}-idle-${this.facing}`, true);
      this.tickAction();
      return;
    }

    let dx = (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown);
    let dy = (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown);
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    // The rocket's ladder: W at the bottom gets you on it; on it, only up and down
    if (this.onLadder) return this.ladderStep(dy, delta);
    if (!this.inRover && dy < 0 && this.atLadderFoot()) return this.getOnLadder();

    if (this.inRover) {
      if (this.rover.driving) this.rover.drive(dx * (this.survival.isStorm() ? BASE.stormSpeed : 1), dy * (this.survival.isStorm() ? BASE.stormSpeed : 1));
      if (!p.visible) p.setPosition(this.rover.x, this.rover.y);   // the astronaut rides along (for compass and areas)
    } else {
      const speed = (k.SHIFT.isDown ? PLAYER.runSpeed : PLAYER.walkSpeed) * (this.survival.isStorm() ? BASE.stormSpeed : 1);
      p.setVelocity(dx * speed, dy * speed);
      if (dx || dy) {
        this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        p.anims.play(`${this.skin}-walk-${this.facing}`, true);
        p.anims.timeScale = k.SHIFT.isDown ? 1.5 : 1;
      } else {
        p.anims.play(`${this.skin}-idle-${this.facing}`, true);
      }
      p.setDepth(p.y);

      // Walk over items to pick them up (not while driving: you'd need to get out)
      this.loot.update(p, this.inv,
        id => this.toast(`Bag full! Press I to drop something.`, '#ff5f5f'),
        this.now());
    }

    this.target = this.findTarget();

    // Which area are we in?
    const z = this.zones.find(z => z.rect.contains(p.x, p.y)) ?? null;
    if (z !== this.zone) { this.zone = z; this.game.events.emit('zone', z); if (z) { this.stats.zones.add(z.name); this.taskEvent('zone', z.name); } }
  }

  /** The progress bar above your head during a timed action. */
  drawActionBar() {
    const g = this.actionBar; g.clear();
    if (!this.action) return;
    const t = Math.min(1, (this.now() - this.action.start) / this.action.ms), p = this.player;
    g.fillStyle(0x160c11).fillRect(p.x - 13, p.y - 24, 26, 5);
    g.fillStyle(0x7bd88f).fillRect(p.x - 12, p.y - 23, 24 * t, 3);
  }
}
