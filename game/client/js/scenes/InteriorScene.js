// Inside a building. Rooms are drawn from the text layouts in levels/rooms.js (Level design).
// The outside world keeps running (the clock, other players) while you're indoors.
// Each piece of furniture does something when you press E next to it (see furnitureTarget).
//
// 👤 Owner: Game logic & backend. Room layouts: levels/rooms.js. Room names and facts: story/places.js.
import { PLAYER, SCREEN, JOBS } from '/game/rules/settings.js';
import { INTERIORS, FURNITURE, checkInterior } from '/levels/rooms.js';
import { ITEMS, itemName } from '/game/rules/items.js';
import { CROPS, growth, secondsLeft } from '/game/rules/farm.js';
import { FOOD_VALUE, LAUNCH, BODY } from '/game/rules/survival.js';
import { fmtTime } from '../systems/Survival.js';
import { addItem, countItem, removeItem, roomFor } from '/game/rules/inventory.js';
import { can, WHO } from '/game/rules/jobs.js';
import { MISSION_CONTROL, FROM_HOME } from '/story/radio.js';
import { net } from '../net.js';
import { RECIPES } from '/game/rules/crafting.js';
import { MINIGAME_TEXT } from '/story/minigames.js';
import { HOME } from '/story/crash.js';
import { PINK } from './WorldScene.js';
import { audio } from '../systems/Audio.js';

const FERT = MINIGAME_TEXT.fertilizer, LIGHT = MINIGAME_TEXT.light, ROCKS = MINIGAME_TEXT.rocks;

// Frame numbers in levels/art/interior.png for each kind of floor and wall
const TILE = { metal: 0, green: 2, concrete: 3, wallTop: 4, wallFace: 5, window: 6, door: 7 };
const SOLID_TILES = [TILE.wallTop, TILE.wallFace, TILE.window];


/** Scene: the inside of a building. The World scene is hidden (but keeps running) while this is open. */
export class InteriorScene extends Phaser.Scene {
  /** Register the scene under the name 'Interior'. */
  constructor() { super('Interior'); }

  /** data.id = which building; data.at = a furniture key to start next to (e.g. 'medbed' after a knock-out). */
  init(data) { this.id = data.id; this.at = data.at; this.leaving = false; this.target = null; }   // reset: this scene is reused for every building

  /** Build the room from its text layout: tiles, furniture, the player at the door, the camera and keys. */
  create() {
    this.world = this.scene.get('World');
    checkInterior(this.id);
    const room = this.room = INTERIORS[this.id];
    const rows = room.rows, H = rows.length, Wd = rows[0].length;

    // ---- tiles ----
    const floor = TILE[room.floor] ?? TILE.metal;
    const isWall = (x, y) => '#w'.includes(rows[y]?.[x] ?? '#');
    const data = rows.map((row, y) => [...row].map((ch, x) => {
      if (ch === 'D') return TILE.door;
      if (ch === '#' || ch === 'w') return isWall(x, y + 1) || y === H - 1 ? TILE.wallTop : (ch === 'w' ? TILE.window : TILE.wallFace);
      return floor;
    }));
    const map = this.make.tilemap({ data, tileWidth: 16, tileHeight: 16 });
    const layer = map.createLayer(0, map.addTilesetImage('interior'), 0, 0);
    map.setCollision(SOLID_TILES);
    this.size = { w: Wd * 16, h: H * 16 };

    // ---- furniture ----
    this.furniture = [];
    const solids = [];
    let planterIndex = 0;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const f = FURNITURE[ch];
      if (!f) return;
      const px = x * 16, py = y * 16, w = f.w * 16, h = f.h * 16;
      const tex = f.key === 'chest' ? 'chest' : `f-${f.key}`;
      this.add.image(px + w / 2, py + h, tex).setOrigin(0.5, 1).setDepth(py + h);
      const z = this.add.zone(px + w / 2, py + h - Math.min(h, 14) / 2, w, Math.min(h, 14)); this.physics.add.existing(z, true); solids.push(z);
      const item = { ...f, x: px, y: py, w, h, cx: px + w / 2, front: py + h + 4 };
      if (f.key === 'planter') item.index = planterIndex++;
      this.furniture.push(item);
    }));
    this.plantGfx = this.add.graphics().setDepth(5000);
    // The greenhouse glows pink once the grow lights are tuned and working (red + blue light)
    if (this.id === 'greenhouse') this.pinkLight = this.add.rectangle(0, 0, this.size.w, this.size.h, PINK, 1).setOrigin(0).setDepth(90000).setVisible(false);
    // The garage: the rover is parked here (when it's in the garage)
    if (this.id === 'garage') {
      this.roverSpot = { x: 7 * 16, y: 5 * 16 };
      this.roverImg = this.add.image(this.roverSpot.x, this.roverSpot.y, 'rover-sheet', 2).setScale(1.5).setOrigin(0.5, 0.85).setDepth(this.roverSpot.y);
      const show = () => this.roverImg.setVisible(!!this.world.rover.inGarage);
      this.world.game.events.on('garage', show);
      this.events.once('shutdown', () => this.world.game.events.off('garage', show));
      show();
    }
    // Things dropped on this room's floor (walk over them to pick them up)
    this.pileLayer = this.add.container(0, 0).setDepth(4000);
    const redraw = () => this.drawPiles();
    this.world.game.events.on('roomPiles', redraw);
    this.events.once('shutdown', () => this.world.game.events.off('roomPiles', redraw));
    this.drawPiles();

    // ---- player (enters just inside the door) ----
    const doorX = rows[H - 1].indexOf('D');
    this.door = { x: doorX * 16 + 8, y: (H - 1) * 16 };
    const job = this.world.job;
    const spot = this.at && this.furniture.find(f => f.key === this.at);
    this.player = this.physics.add.sprite(spot ? spot.cx : this.door.x, spot ? spot.front + 6 : this.door.y - 2, this.world.skin, spot ? 0 : 9).setOrigin(0.5, 1);
    this.others = new Map();          // other astronauts in this room (multiplayer)
    this.player.body.setSize(8, 5).setOffset(4, 10);
    this.facing = spot ? 'down' : 'up';
    this.physics.add.collider(this.player, layer);
    this.physics.add.collider(this.player, solids);
    this.physics.world.setBounds(0, 0, this.size.w, this.size.h);

    // ---- camera: centre the room on screen ----
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0b0710');
    if (this.size.w <= SCREEN.width && this.size.h <= SCREEN.height) cam.centerOn(this.size.w / 2, this.size.h / 2 - 10);
    else { cam.setBounds(0, 0, this.size.w, this.size.h); cam.startFollow(this.player, true, 0.2, 0.2); }

    this.actionBar = this.add.graphics().setDepth(100001);
    this.openedAt = this.time.now;
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,SPACE');
    this.keys.E.on('down', () => !this.world.busy() && this.target?.act());
    this.keys.SPACE.on('down', () => !this.world.busy() && this.target?.act());

    this.cameras.main.fadeIn(250, 11, 7, 16);
    // The first time in each building: its real-science fact on the big fact screen. After that, just its name.
    const w0 = this.world; w0.roomsSeen ??= new Set();
    if (!w0.roomsSeen.has(this.id)) { w0.roomsSeen.add(this.id); w0.showFact({ title: room.name, body: room.fact }); }
    else w0.toast(room.name, '#6cc4ff');
    for (const k of ['Hud', 'Night', 'Menu', 'Inventory']) if (this.scene.isActive(k)) this.scene.bringToTop(k);
  }

  /** Fade out and go back outside. */
  leave() {
    if (this.leaving) return;
    this.comeOutOfToilet();
    this.leaving = true;
    this.cameras.main.fadeOut(200, 11, 7, 16);
    this.cameras.main.once('camerafadeoutcomplete', () => this.world.exitBuilding());
  }

  // ---------- what E does ----------
  /** What's in reach for E: the door, or the closest piece of furniture. */
  findTarget() {
    const p = this.player;
    if (Math.hypot(this.door.x - p.x, this.door.y - p.y) < 14) return { label: 'Go outside', act: () => this.leave() };
    if (this.roverImg?.visible && Math.hypot(this.roverSpot.x - p.x, this.roverSpot.y + 10 - p.y) < 28)
      return can(this.world.job, 'drive') ? { label: 'Drive the rover out', act: () => this.world.driveOutOfGarage() } : { label: 'The rover (only the Pilot drives it)', act: () => this.world.toast(WHO.drive, '#ff5f5f') };
    let best = null, bd = 12;
    for (const f of this.furniture) {
      const dx = Math.max(f.x - p.x, 0, p.x - (f.x + f.w)), dy = Math.max(f.y - p.y, 0, p.y - (f.y + f.h + 6));
      const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = f; }
    }
    return best ? this.furnitureTarget(best) : null;
  }

  /** What E does at each kind of furniture: { label (shown as the [E] prompt), act (what happens) }. */
  furnitureTarget(f) {
    const w = this.world;
    switch (f.key) {
      case 'chest': return { label: 'Open crew storage chest', act: () => w.openScreen('Inventory', { mode: 'chest' }) };
      case 'planter': return this.planterTarget(f);
      case 'bench': return { label: 'Use the workbench', act: () => this.workbench() };
      case 'radio': return { label: 'Use the laser comms', act: () => this.radio() };
      case 'shelf': {
        const loot = w.shelves[this.id];
        return { label: loot ? 'Search the spare parts shelf' : 'Empty shelf', act: () => this.searchShelf() };
      }
      case 'console': return { label: 'Flight console', act: () => this.rocketConsole() };
      case 'bunk': return { label: `Sleep (it's ${fmtTime(w.survival.min)})`, act: () => w.sleep() };
      case 'medbed': return { label: 'Medbay: rest and heal', act: () => this.medbay() };
      case 'table': return { label: 'Kitchen: eat', act: () => this.kitchen() };
      case 'locker': return { label: 'Suit locker', act: () => w.toast(w.survival.airOn ? 'Your suit fills with air while you are indoors.' : 'Suits can\'t fill with air until MOXIE is fixed!', '#6cc4ff') };
      case 'toilet': case 'toiletdoor': return this.toiletTarget(f);
      case 'lightpanel': return this.lightPanelTarget();
      case 'microscope': return this.microscopeTarget();
    }
    return null;
  }

  // ---------- greenhouse planters ----------
  /**
   * A greenhouse planter: plant (Botanist only), check growth, or harvest (anyone).
   * With fertilizer: the Botanist can fertilize a bed that isn't ripe yet (it grows 2x until its next harvest).
   */
  planterTarget(f) {
    const w = this.world, p = w.planters[f.index];
    const ripe = p && growth(p) >= 1;
    const fertSel = w.inv[w.sel]?.id === 'fertilizer', hasFert = countItem(w.inv, 'fertilizer') > 0;
    // Fertilize: when the fertilizer is the selected item, or the bed is already growing (no seed to plant there anyway)
    if (hasFert && !ripe && can(w.job, 'plant') && (fertSel || p)) {
      if (w.fert[f.index]) { if (fertSel) return { label: FERT.already, act: () => w.toast(FERT.already, '#c9ad93') }; }
      else return { label: FERT.useBed, act: () => w.startAction(FERT.useBed, 800, () => {
        if (w.fert[f.index] || !removeItem(w.inv, 'fertilizer', 1)) return;
        w.fert[f.index] = true; w.fertChanged(); w.invChanged();
        w.taskEvent('fertilize', f.index);
        w.toast(FERT.doneBed, '#7bd88f');
      }) };
    }
    if (!p) {
      const sel = w.inv[w.sel];
      const seed = sel && CROPS[sel.id] ? sel.id : Object.keys(CROPS).find(id => countItem(w.inv, id) > 0);
      if (!seed) return { label: 'Empty planter (you have no seeds)', act: () => w.toast('Find seeds outside, then come back.', '#ffd34d') };
      return {
        label: `Plant ${CROPS[seed].name}`, act: () => {
          if (!can(w.job, 'plant')) return w.toast(WHO.plant, '#ff5f5f');
          w.startAction(`Planting ${CROPS[seed].name}`, 1000, () => {
            removeItem(w.inv, seed, 1); w.invChanged();
            w.planters[f.index] = { seed, grown: 0 }; w.plantersChanged();
            w.taskEvent('plant', seed);
            w.toast(w.equipment.working('greenhouse_lights') ? 'Planted! It will be ready in 1 minute. Watch the bar under the planter.' : 'Planted! It grows once the grow lights work.', '#7bd88f');
            // A space fact pop-up about this crop, the FIRST time you plant it (the words are the seed's fact in story/items.js)
            w.factsSeen ??= new Set();
            if (!w.factsSeen.has(seed)) {
              w.factsSeen.add(seed);
              w.showFact({ title: CROPS[seed].name, body: ITEMS[seed].fact, icon: seed, color: '#7bd88f' });
            }
          });
        },
      };
    }
    const c = CROPS[p.seed], g = growth(p);
    if (g < 1) {
      const lights = w.equipment.working('greenhouse_lights'), t = secondsLeft(p);
      return { label: lights ? `${c.name}: ${Math.floor(g * 100)}% grown (ready in ${t}s)` : `${c.name}: waiting for the grow lights`, act: () => w.toast(lights ? 'It\'s growing! Come back soon.' : 'Plants can\'t grow yet. The Builder must fix the grow lights (and the power).', '#ffd34d') };
    }
    return {
      label: `Harvest ${c.name}`, act: () => {
        if (roomFor(w.inv, c.crop) < c.yield) return w.toast('Your bag is full!', '#ff5f5f');
        w.startAction('Harvesting', 800, () => {
          addItem(w.inv, c.crop, c.yield);
          let msg = `Harvested ${c.yield} ${ITEMS[c.crop].name}!`;
          if (Math.random() < c.seedBack && addItem(w.inv, p.seed, 1) === 0) msg += ' You saved 1 seed to replant.';
          w.planters[f.index] = null; w.plantersChanged(); w.invChanged(); w.toast(msg, '#7bd88f');
          if (w.fert[f.index]) { w.fert[f.index] = false; w.fertChanged(); }   // the fertilizer was for this crop only
          w.stats.harvested.add(c.crop); w.stats.harvests = (w.stats.harvests ?? 0) + 1; w.taskEvent('harvest', c.crop);
        });
      },
    };
  }

  /** Draw growing crops in the planters (4 sizes) plus a growth bar under each planter. Fertilized beds have dark, rich soil; frozen ones are blue. */
  drawPlants() {
    const g = this.plantGfx, w = this.world; g.clear();
    for (const f of this.furniture.filter(f => f.key === 'planter')) {
      const p = w.planters[f.index];
      if (w.fert?.[f.index]) { g.fillStyle(0x3a2112).fillRect(f.x + 2, f.y + 5, f.w - 4, 6); for (const ox of [5, 14, 23, 32, 41]) g.fillStyle(0x7bd88f).fillRect(f.x + ox, f.y + 6 + (ox % 3), 1, 1); }
      if (!p) continue;
      const gr = growth(p), st = gr >= 1 ? 3 : Math.floor(gr * 3);
      const hgt = [3, 6, 9, 11][st];
      for (const ox of [8, 24, 40]) {
        g.fillStyle(0x4caf50).fillRect(f.x + ox - 1, f.y + 8 - hgt, 2, hgt);
        if (st >= 1) g.fillStyle(0x7bd88f).fillRect(f.x + ox - 3, f.y + 8 - hgt, 6, 3);
        if (st >= 3) g.fillStyle({ crop_tomato: 0xe0402f, crop_potato: 0xc99252, crop_cabbage: 0xc4364f }[CROPS[p.seed].crop]).fillRect(f.x + ox - 2, f.y + 5 - hgt, 4, 4);
      }
      g.fillStyle(0x000000, 0.5).fillRect(f.x + 2, f.y + 17, f.w - 4, 3);
      g.fillStyle(gr >= 1 ? 0x7bd88f : p.frozen ? 0x6cc4ff : 0xffd34d).fillRect(f.x + 2, f.y + 17, (f.w - 4) * gr, 3);
      if (p.frozen) g.fillStyle(0x9ad8ff, 0.45).fillRect(f.x, f.y - 6, f.w, f.h + 8);   // frozen: an icy blue haze
    }
  }

  // ---------- the hub toilet: fertilizer (Botanist, once per sol, once MOXIE works) ----------
  // The toilet is behind its own door. The Botanist presses E on the door, goes in (and disappears for everyone),
  // makes the fertilizer, then comes back out.
  toiletTarget(f) {
    const w = this.world, sv = w.survival;
    if (!can(w.job, 'plant')) return { label: FERT.toiletOther, act: () => w.toast(FERT.onlyBotanist, '#ff5f5f') };
    return { label: FERT.toilet, act: () => {
      if (!sv.airOn) return w.toast(FERT.noAir, '#ff5f5f');
      if (w.fertSol === sv.sol) return w.toast(FERT.today, '#ffd34d');
      if (roomFor(w.inv, 'fertilizer') < 1) return w.toast('Your bag is full!', '#ff5f5f');
      if (f?.key === 'toiletdoor') this.goIntoToilet(f);
      w.startAction(FERT.making, 2500, () => {
        this.comeOutOfToilet();
        if (w.fertSol === sv.sol || addItem(w.inv, 'fertilizer', 1)) return;
        w.fertSol = sv.sol; w.invChanged();
        w.toast(FERT.got, '#7bd88f');
        if (!w.fertFactSeen) { w.fertFactSeen = true; w.showFact({ title: FERT.factTitle, body: FERT.fact, icon: 'fertilizer', color: '#7bd88f' }); }
      });
    } };
  }

  /** Through the toilet door: the player vanishes (on everyone's screen) and the door says IN USE. */
  goIntoToilet(f) {
    const w = this.world, p = this.player;
    this.inToilet = f;
    w.hidden = true;                                       // sent with my position, so crewmates don't see me either
    p.setPosition(f.cx, f.front + 4); this.facing = 'up';
    this.tweens.add({ targets: p, alpha: 0, duration: 250 });
    this.inUse = this.add.text(f.cx, f.y - 2, FERT.inUse, { fontFamily: 'VT323', fontSize: '12px', color: '#fbefd5', backgroundColor: '#c0392b', padding: { x: 2, y: 0 } }).setOrigin(0.5, 1).setDepth(99999);
    audio.sfx('door');
  }
  /** Back out of the toilet door. */
  comeOutOfToilet() {
    if (!this.inToilet) return;
    const w = this.world, p = this.player;
    this.inToilet = null; w.hidden = false;
    this.tweens.killTweensOf(p); p.setAlpha(1).setVisible(true); this.facing = 'down';
    this.inUse?.destroy(); this.inUse = null;
    audio.sfx('door');
  }

  // ---------- the greenhouse light panel: Light Recipe (Botanist) ----------
  lightPanelTarget() {
    const w = this.world;
    if (!can(w.job, 'plant')) return { label: LIGHT.panelOther, act: () => w.toast(LIGHT.panelOther, '#c9ad93') };
    return { label: LIGHT.panel, act: () => {
      if (!w.equipment.working('greenhouse_lights')) return w.toast(LIGHT.needLights, '#ffd34d');
      if (w.lightsTuned) return w.toast(LIGHT.tuned, '#7bd88f');
      w.openScreen('LightGame', { onWin: () => { w.setLightsTuned(true, true); w.taskEvent('tune'); } });
    } };
  }

  // ---------- the workshop microscope desk: rock samples (Pilot) ----------
  microscopeTarget() {
    const w = this.world;
    if (!can(w.job, 'drive')) return { label: ROCKS.deskOther, act: () => w.toast(ROCKS.deskOther, '#c9ad93') };
    if (countItem(w.inv, 'rock_sample') < 1) return { label: ROCKS.deskNone, act: () => w.toast(ROCKS.deskNone, '#ffd34d') };
    return { label: ROCKS.desk, act: () => w.openScreen('RockGame', { onWin: () => {
      if (!removeItem(w.inv, 'rock_sample', 1)) return;
      w.invChanged(); w.taskEvent('analyze', 'rock_sample');
    } }) };
  }

  // ---------- hab ----------
  /** The kitchen table: a menu to eat food from your bag. */
  kitchen() {
    const w = this.world, me = w.survival.me;
    w.openScreen('Menu', {
      title: 'Kitchen', color: '#7bd88f',
      body: () => `Food: ${Math.round(me.food)}/100. Eat food from your bag.`,
      options: () => {
        const foods = Object.keys(FOOD_VALUE).filter(id => countItem(w.inv, id) > 0);
        const fact = { label: MINIGAME_TEXT.common.factButton, fn: () => w.showFact({ title: 'Space food', body: ITEMS.food_pack.fact, icon: 'food_pack' }) };
        if (!foods.length) return [{ label: 'No food in your bag. Check a chest, or ask the Botanist!', disabled: true }, fact];
        return [...foods.map(id => ({ label: `Eat ${itemName(id)} (+${FOOD_VALUE[id]} food, you have ${countItem(w.inv, id)})`, keep: true, fn: () => w.eat(id) })), fact];
      },
    });
  }

  /** Rest in the medbay for an hour to get some health back. */
  medbay() {
    const w = this.world, me = w.survival.me;
    if (me.health >= 98) return w.toast('Your health is already full.', '#7bd88f');
    w.startAction('Resting in the medbay', 2500, () => {
      w.survival.heal(BODY.medbayHeal); w.survival.min += 60;
      w.toast(`You rested. Health +${BODY.medbayHeal}.`, '#7bd88f');
    });
  }

  // ---------- workshop ----------
  /** The workbench (Builder only): turn scrap into parts using the recipes in game/rules/crafting.js. */
  workbench() {
    const w = this.world;
    if (!can(w.job, 'repair')) return w.toast('Only the Builder can use this. Drop your scrap by them!', '#ff5f5f');
    w.openScreen('Menu', {
      title: 'Workbench', color: '#ff8a3d',
      body: () => `Recycle scrap metal from the crash into new parts. You have ${countItem(w.inv, 'scrap')} scrap.`,
      options: () => [...RECIPES.map(r => {
        const need = Object.entries(r.from).map(([id, n]) => `${n} ${itemName(id)}`).join(' + ');
        const ok = Object.entries(r.from).every(([id, n]) => countItem(w.inv, id) >= n);
        return {
          label: `Make ${r.n} ${itemName(r.make)} (uses ${need})`, disabled: !ok,
          fn: () => w.startAction(`Making ${itemName(r.make)}`, 2000, () => {
            if (roomFor(w.inv, r.make) < r.n) return w.toast('No room in your bag!', '#ff5f5f');
            for (const [id, n] of Object.entries(r.from)) removeItem(w.inv, id, n);
            addItem(w.inv, r.make, r.n); w.invChanged();
            w.toast(`Made ${r.n} ${itemName(r.make)} from scrap.`, '#7bd88f');
            w.taskEvent('craft', r.make);
          }),
        };
      }), { label: MINIGAME_TEXT.common.factButton, fn: () => w.showFact({ title: 'Recycling on Mars', body: ITEMS.scrap.fact, icon: 'scrap' }) }],
    });
  }

  /** Search a spare parts shelf. Only the first person to search gets the parts (a 'shelf:' claim). */
  searchShelf() {
    const w = this.world, loot = w.shelves[this.id];
    if (!loot) return w.toast('Nothing left on this shelf.', '#c9ad93');
    w.startAction('Searching the shelf', 1200, async () => {
      const ok = await net.claim(`shelf:${this.id}`);
      if (ok === null) return w.toast('The connection is slow. Try searching the shelf again.', '#ffd34d');
      if (!ok) { w.shelves[this.id] = null; return w.toast('A crewmate already emptied this shelf.', '#c9ad93'); }
      const got = [];
      for (const [id, n] of loot) { const left = addItem(w.inv, id, n); if (left < n) got.push(`${n - left} ${itemName(id)}`); }
      w.shelves[this.id] = null; w.mp.send('shelf', { id: this.id }); w.invChanged();
      w.toast(got.length ? `Found ${got.join(', ')}!` : 'Your bag is full!', got.length ? '#7bd88f' : '#ff5f5f');
    });
  }

  // ---------- comms ----------
  /** The laser comms console (needs working, powered laser comms). Replies take the real Earth-Mars delay, sped up. */
  radio() {
    const w = this.world, dish = w.equipment.get('laser_comms');
    if (!w.equipment.working('laser_comms')) return w.openScreen('Menu', {
      title: 'Laser comms console', color: '#6cc4ff',
      body: dish.broken ? 'No signal. The laser comms outside are broken.\nThe Builder can fix them with 2 wire and 1 circuit board.' : 'No power! The laser comms are fixed, but the fission generators are broken. The Builder needs 2 power cores to fix them.',
    });
    const lm = w.lightMinutes;
    const send = (text, fn) => {
      w.messages.push({ at: w.now() + lm * 2 * 1000, text, fn });
      w.toast(`Message sent! Earth is far away, so the answer takes ${lm * 2} seconds.`, '#6cc4ff');
    };
    w.openScreen('Menu', {
      title: 'Laser comms console', color: '#6cc4ff',
      body: () => `Your message travels to Earth on a laser beam. Earth is ${lm} light-minutes away today. Every message takes that long to arrive, so the crew must solve most problems alone.${w.messages.length ? `\n\nWaiting for ${w.messages.length} repl${w.messages.length > 1 ? 'ies' : 'y'}...` : ''}`,
      options: [
        { label: 'Ask for a space weather forecast', fn: () => {
          const sv = w.survival, from = sv.sol;
          w.taskEvent('radio', 'forecast');
          send(sv.forecast(), () => { const sols = [from, from + 1, from + 2]; for (const s of sols) sv.known[s] = true; w.mp.send('known', { sols }); });
        } },
        { label: 'Ask Mission Control for advice', fn: () => { w.taskEvent('radio', 'advice'); send(Phaser.Utils.Array.GetRandom(MISSION_CONTROL)); } },
        { label: 'Send a message home', fn: () => { w.taskEvent('radio', 'home'); send(Phaser.Utils.Array.GetRandom(FROM_HOME)); } },
        // The Pilot can also aim the laser by hand (the Hit Earth mini game). The other 3 lines stay the same for everyone.
        ...(can(w.job, 'drive') ? [{ label: MINIGAME_TEXT.earth.option, fn: () => w.openScreen('EarthGame', { onWin: () => {
          w.taskEvent('earth');
          send(Phaser.Utils.Array.GetRandom(FROM_HOME));
        } }) }] : []),
      ],
    });
  }

  // ---------- rocket ----------
  /** The flight console: shows what's left to do, and launches when everything is ready (Pilot only). */
  rocketConsole() {
    const w = this.world, r = w.equipment.get('rocket'), sv = w.survival;
    const need = w.launchCheck();
    const botPilot = w.bots?.list.find(b => b.job === 'pilot');
    const pilot = can(w.job, 'drive') || !!botPilot;
    w.openScreen('Menu', {
      title: 'Flight console', color: '#6cc4ff',
      body: `Rocket parts: ${r.progress}/${r.def.steps}\nYou can fly home as soon as everything is fixed. ${HOME.console(LAUNCH.closes, sv.sol)}\n\n` +
        (need.length ? `Still to do: ${need.join('; ')}.` : can(w.job, 'drive') ? 'Everything is ready. You are the Pilot: take the crew home!' : botPilot ? `Everything is ready. ${botPilot.name}, your computer Pilot, will fly.` : 'Everything is ready, but only the Pilot can fly the rocket.'),
      options: [{ label: 'LAUNCH!', disabled: need.length > 0 || !pilot, fn: () => w.launch() },
        { label: MINIGAME_TEXT.common.factButton, fn: () => w.showFact({ title: INTERIORS.rocket.name, body: INTERIORS.rocket.fact }) }],
    });
  }

  /** Other crew members in this same building. */
  drawOthers() {
    const here = this.world.mp.inside(this.id), seen = new Set();
    for (const r of here) {
      if (r.ix == null) continue;
      seen.add(r.id);
      let o = this.others.get(r.id);
      if (!o) {
        o = { sprite: this.add.sprite(r.ix, r.iy, r.skin, 0).setOrigin(0.5, 1), tag: this.add.text(r.ix, r.iy - 16, r.name, { fontFamily: 'VT323', fontSize: '12px', color: JOBS[r.job].color }).setOrigin(0.5, 1).setStroke('#160c11', 3).setDepth(99998), x: r.ix, y: r.iy };
        this.others.set(r.id, o);
      }
      o.x += (r.ix - o.x) * 0.3; o.y += (r.iy - o.y) * 0.3;
      o.sprite.setPosition(o.x, o.y).setDepth(r.asleep ? o.y + 40 : o.y).setVisible(!r.hidden).anims.play(`${r.skin}-${r.moving ? 'walk' : 'idle'}-${r.asleep ? 'down' : r.facing || 'down'}`, true);
      o.tag.setPosition(o.x, o.y - 16).setVisible(!r.hidden);
      // Asleep in a bunk: 'z z z' floats up above them
      if (r.asleep && !o.zzz) o.zzz = this.add.text(o.x + 6, o.y - 18, 'z', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#c7ecff' }).setStroke('#160c11', 3).setDepth(99999);
      if (!r.asleep && o.zzz) { o.zzz.destroy(); o.zzz = null; }
      if (o.zzz) { const t = this.time.now / 1000; o.zzz.setText('z z z'.slice(0, 1 + 2 * (Math.floor(t * 1.5) % 3))).setPosition(o.x + 4, o.y - 20 - (t * 4) % 4); }
    }
    for (const [id, o] of this.others) if (!seen.has(id)) { o.sprite.destroy(); o.tag.destroy(); o.zzz?.destroy(); this.others.delete(id); }
  }

  // ---------- every frame ----------
  /** Every frame: draw crops and crewmates, move the player (no running indoors) and find what E would use. */
  update() {
    const w = this.world, k = this.keys, p = this.player;
    this.drawPlants();
    this.drawOthers();
    this.drawActionBar();
    this.pinkLight?.setVisible(w.greenhousePink()).setAlpha(0.27 + 0.05 * Math.sin(this.time.now / 700));
    if (this.inToilet && !w.action) this.comeOutOfToilet();      // (the action was cancelled, e.g. passing out)
    if (this.leaving) return;
    if (w.uiOpen || w.action || w.frozen) {
      p.setVelocity(0, 0); p.anims.play(`${w.skin}-idle-${this.facing}`, true);
      w.tickAction();
      return;
    }
    let dx = (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown);
    let dy = (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown);
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    const speed = PLAYER.walkSpeed * 0.85;                     // indoors: a little slower, no running
    p.setVelocity(dx * speed, dy * speed);
    if (dx || dy) {
      this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      p.anims.play(`${w.skin}-walk-${this.facing}`, true);
    } else p.anims.play(`${w.skin}-idle-${this.facing}`, true);
    p.setDepth(p.y);
    if (p.y > this.door.y + 6) return this.leave();          // walked onto the door mat
    // Frost Watch: the Botanist comes into the greenhouse during a frost -> the mini game opens by itself
    if (this.id === 'greenhouse' && w.frost && !w.frost.playing && w.job === 'botanist' && this.time.now - this.openedAt > 700) { w.frost.playing = true; return w.openScreen('FrostGame', {}); }
    this.pickUpPiles();
    this.target = this.findTarget();
    w.target = this.target;                                    // the HUD shows this as the [E] prompt
  }

  /** Draw the items lying on this room's floor. */
  drawPiles() {
    this.pileLayer.removeAll(true);
    for (const p of this.world.roomPiles[this.id] ?? []) {
      this.pileLayer.add(this.add.image(p.x, p.y, 'items', ITEMS[p.id].icon));
      if (p.n > 1) this.pileLayer.add(this.add.text(p.x + 8, p.y + 6, String(p.n), { fontFamily: 'VT323', fontSize: '12px', color: '#fbefd5' }).setOrigin(1, 1));
    }
  }

  /** Walk over an item on the floor to pick it up (the server makes sure only one person gets it). */
  async pickUpPiles() {
    const w = this.world, p = this.player;
    const pile = (w.roomPiles[this.id] ?? []).find(o => Math.hypot(o.x - p.x, o.y - p.y) < 10 && !o.taking && !(o.mine && o.mine > w.now()));
    if (!pile || roomFor(w.inv, pile.id) <= 0) return;
    pile.taking = true;
    const ok = await net.claim(`rp:${pile.gid}`);
    if (!ok) { pile.taking = false; pile.mine = w.now() + 1500; return; }
    const left = addItem(w.inv, pile.id, pile.n);
    w.removeRoomPile(this.id, pile.gid); w.mp.send('roomTake', { room: this.id, gid: pile.gid });
    if (left) w.addRoomPile(this.id, { ...pile, gid: w.mp.newGid(), n: left, taking: false, mine: w.now() + 1500 }, true);
    w.invChanged(); w.toast(`Picked up ${pile.n - left} ${ITEMS[pile.id].name}`, '#7bd88f');
  }

  /** The progress bar over your head while doing something (repairing, planting...). */
  drawActionBar() {
    const g = this.actionBar, a = this.world.action; g.clear();
    if (!a) return;
    const t = Math.min(1, (this.world.now() - a.start) / a.ms), p = this.player;
    g.fillStyle(0x160c11).fillRect(p.x - 13, p.y - 24, 26, 5);
    g.fillStyle(0x7bd88f).fillRect(p.x - 12, p.y - 23, 24 * t, 3);
  }
}
