// Computer crewmates: they play the jobs nobody picked (solo and duo games).
// They run on the crew leader's computer and appear on everyone's screen like normal players.
//   🌱 Botanist bot: plants seeds from the crew chest, harvests ready crops into the chest, gathers loose seeds.
//   🔧 Builder bot:  fixes the 5 broken machines using parts from the chest (or given to it), installs rocket
//                    parts, recycles scrap at the workshop.
//   🚀 Pilot bot:    collects loot around the base and brings it back to the chest. Flies the rocket if
//                    no person is the Pilot.
// Everyone: shelters indoors during solar flares and sleeps in the hab at night.
// Orders (R menu): Follow me / Stay at base / Back to work.
// GAME SIMPLIFICATION: computer crewmates don't get hungry or hurt.
//
// 👤 Owner: Game logic & backend. Bot names are below (BOT_NAMES). Bots "think" twice a second: each time
// they pick the most useful job for their role and walk there using the Pathfinder.
import { JOBS } from '/game/rules/settings.js';
import { BASE } from '/game/rules/survival.js';
import { EQUIPMENT } from '/game/rules/equipment.js';
import { CROPS, growth } from '/game/rules/farm.js';
import { addItem, countItem, removeItem, createInventory, BAG_SIZE } from '/game/rules/inventory.js';
import { itemName, ITEMS } from '/game/rules/items.js';
import { INTERIORS } from '/levels/rooms.js';
import { net } from '../net.js';
import { Pathfinder } from './Pathfinder.js';
import { RECIPES } from '/game/rules/crafting.js';

// The computer crewmates' names, by job
export const BOT_NAMES = { botanist: 'Nova', builder: 'Bolt', pilot: 'Sky' };
// Bots walk a bit slower than people
const SPEED = 60;            // px per second
// Where each computer crewmate sleeps: the hub's bunks (the 'B's in levels/rooms.js), one per job
const BUNKS = (() => {
  const out = []; INTERIORS.hab.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'B') out.push({ x: x * 16 + 8, y: y * 16 + 28 }); }));
  return out;
})();
const BUNK_OF = { botanist: 0, builder: 1, pilot: 2 };

/** Manages all the computer crewmates: creates them, updates them and handles orders. */
export class Bots {
  /** Create one bot per job nobody picked, next to the player, and show them like any other astronaut. */
  constructor(world, jobs) {
    this.w = world;
    this.list = [];
    this.mode = 'work';      // 'work' | 'follow' | 'stay'
    this.followId = null;
    this.path = new Pathfinder(world.obstacles, world.solids, world.mapSize.w, world.mapSize.h);
    const start = world.player;
    jobs.forEach((job, i) => {
      const b = new Bot(this, job, start.x + 18 + i * 14, start.y + 10);
      this.list.push(b);
      world.mp.addRemote({ id: b.id, name: b.name, job, look: (i + 1) % 4 }, true);
    });
  }

  /** Only the crew leader's computer runs the bots. */
  get leader() { return net.isLeader; }
  /** A bot message, shown to everyone. */
  say(text, color) { this.w.toast(`${text}`, color); this.w.mp.send('botSay', { text, color }); }

  /** Every frame. Leader: run each bot and copy its position to its figure. Others: just show where they are. */
  update(time, delta) {
    if (!this.list.length) return;
    this.time = time;
    const dt = delta / 1000;
    for (const b of this.list) {
      const r = this.w.mp.remotes.get(b.id);
      if (!this.leader) { if (r) { b.x = r.tx; b.y = r.ty; } continue; }   // someone else runs the bots
      b.update(dt, time);
      if (r) Object.assign(r, { tx: b.x, ty: b.y, facing: b.facing, moving: b.moving, inside: b.inside, ix: b.ix, iy: b.iy, asleep: b.asleep });
    }
  }

  /** Something was given to a computer crewmate (G key). */
  receive(botId, id, n) {
    const b = this.list.find(b => b.id === botId); if (!b) return;
    const left = addItem(b.inv, id, n);
    if (left) addItem(this.w.chest.inv, id, left), this.w.chestChanged();
    this.say(`${b.name}: Thanks for the ${itemName(id)}!`, JOBS[b.job].color);
  }
  /** Another player gave a bot something; the leader (who runs the bots) adds it. */
  onRemoteTask(e) { if (this.leader && e.kind === 'receive') this.receive(e.bot, e.id, e.n); }

  /** Change what all bots are doing: 'follow' (the player who gave the order), 'stay' or 'work'. */
  order(order, fromId) {
    if (!this.leader) return;
    this.mode = order; this.followId = fromId;
    for (const b of this.list) b.reset();
    const t = { follow: 'following you', stay: 'staying at the base', work: 'getting back to work' }[order];
    this.say(`Crew: ${t}!`, '#ffd34d');
  }

  /** The bot orders for the shout menu (R). */
  orderOptions() {
    const send = o => net.isLeader ? this.order(o, net.id) : this.w.mp.send('order', { order: o });
    return [
      { label: 'Computer crew: follow me', fn: () => send('follow') },
      { label: 'Computer crew: stay at base', fn: () => send('stay') },
      { label: 'Computer crew: back to work', fn: () => send('work') },
    ];
  }

  /** Where a crewmate (or me) is, for "follow me". */
  playerPos(id) {
    if (!id || id === net.id) return this.w.inside ? null : { x: this.w.player.x, y: this.w.player.y };
    const r = this.w.mp.remotes.get(id); return r && !r.inside ? { x: r.tx, y: r.ty } : null;
  }
}

/** One computer crewmate. */
class Bot {
  /** A bot has a job, a position, its own bag, and whether it's inside a building. */
  constructor(mgr, job, x, y) {
    this.mgr = mgr; this.w = mgr.w; this.job = job;
    this.id = `ai-${job}`; this.name = BOT_NAMES[job];
    this.x = x; this.y = y; this.facing = 'down'; this.moving = false;
    this.inv = createInventory(BAG_SIZE);
    this.inside = null; this.ix = null; this.iy = null;
    this.reset();
  }
  /** Forget the current route, waiting and task (used when orders change). */
  reset() { this.route = null; this.goal = null; this.busyUntil = 0; this.thinkAt = 0; this.task = null; }

  /** Position message (sent by the leader so everyone sees the bot move). */
  posMessage() { return { id: this.id, x: Math.round(this.x), y: this.y | 0, facing: this.facing, moving: this.moving, inside: this.inside, ix: this.ix, iy: this.iy, asleep: !!this.asleep }; }

  // ---------- movement ----------
  /** Find a path to (x, y) and walk it; 'then' runs on arrival. Returns false if there is no way there. */
  goTo(x, y, then) {
    this.inside = null;
    const p = this.mgr.path.find(this.x, this.y, x, y);
    if (!p) { this.task = null; return false; }
    this.route = p; this.goal = { x, y, then };
    return true;
  }
  /** Walk along the route for one frame (slower in dust storms). Returns true while still walking. */
  step(dt) {
    if (!this.route?.length) { this.moving = false; return false; }
    const [tx, ty] = this.route[0];
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy), s = SPEED * dt * (this.w.survival.isStorm() ? BASE.stormSpeed : 1);
    if (d <= s) { this.x = tx; this.y = ty; this.route.shift(); }
    else { this.x += dx / d * s; this.y += dy / d * s; }
    this.moving = true;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    if (!this.route.length) { this.moving = false; const g = this.goal; this.goal = null; g?.then?.(); }
    return true;
  }
  /** Go into a building (shown standing just inside its door). */
  enter(id, then) {
    const door = this.w.buildings[id].door;
    this.goTo(door.x, door.y + 4, () => {
      const rows = INTERIORS[id].rows, dx = rows[rows.length - 1].indexOf('D');
      this.inside = id; this.ix = dx * 16 + 8 + (this.job === 'pilot' ? 14 : this.job === 'builder' ? -14 : 0); this.iy = (rows.length - 1) * 16 - 18;
      this.facing = 'up';
      then?.();
    });
  }
  /** In the hub at night: lie down in my bunk (shown with 'z z z' on everyone's screen). */
  goToBed() {
    const bunk = BUNKS[BUNK_OF[this.job] ?? 0] ?? BUNKS[0];
    if (!bunk) return;
    this.ix = bunk.x; this.iy = bunk.y; this.facing = 'down'; this.moving = false;
    this.asleep = true;
  }
  /** Morning (or a flare alarm is over): get up and stand by the door again. */
  wakeUp() {
    if (!this.asleep) return;
    this.asleep = false;
    if (this.inside === 'hab') { const rows = INTERIORS.hab.rows; this.ix = rows[rows.length - 1].indexOf('D') * 16 + 8; this.iy = (rows.length - 1) * 16 - 18; }
  }
  /** Stand still for ms (doing a job, e.g. repairing), then run 'then'. */
  wait(ms, then) { this.busyUntil = this.w.now() + ms; this.afterWait = then; }

  // ---------- thinking ----------
  /**
   * The bot's brain, every frame: safety first (flares, night), then finish waiting or walking, then
   * every 0.5 s pick something to do based on orders and job.
   */
  update(dt, time) {
    const w = this.w, sv = w.survival;
    // Safety first: drop everything and shelter in the hab during a flare alarm, or sleep at night
    const f = sv.flareOn(), night = sv.min >= 21 * 60 || w.sleeping, danger = (f && !f.done && f.alarm) || night;
    if (danger && this.task !== 'shelter') { this.reset(); this.task = 'shelter'; if (this.inside !== 'hab') this.enter('hab'); }
    if (!danger && this.task === 'shelter') { this.task = null; this.wakeUp(); }
    // Night: once inside the hub, walk to my bunk and go to sleep (and get up again in the morning)
    if (this.task === 'shelter' && night && this.inside === 'hab' && !this.asleep && !this.goal) this.goToBed();
    if (this.asleep && !night) this.wakeUp();
    if (this.asleep) { this.moving = false; return; }
    if (this.busyUntil) { if (w.now() < this.busyUntil) return; this.busyUntil = 0; const f = this.afterWait; this.afterWait = null; f?.(); return; }
    if (this.step(dt)) return;
    if (time < this.thinkAt) return;
    this.thinkAt = time + 500;

    if (this.task === 'shelter') { if (this.inside !== 'hab' && !this.goal) this.enter('hab'); return; }
    if (this.inside) { const door = w.buildings[this.inside].door; this.inside = null; this.x = door.x; this.y = door.y + 6; }

    if (this.mgr.mode === 'stay') { const d = w.buildings.hab.door; if (Math.hypot(this.x - d.x, this.y - d.y) > 40) this.goTo(d.x + 20, d.y + 24); return; }
    if (this.mgr.mode === 'follow') {
      const p = this.mgr.playerPos(this.mgr.followId);
      if (p && Math.hypot(this.x - p.x, this.y - p.y) > 30) this.goTo(p.x + (this.job === 'pilot' ? 14 : -14), p.y + 10);
      return;
    }
    ({ botanist: () => this.botanist(), builder: () => this.builder(), pilot: () => this.pilot() })[this.job]();
  }

  // ---------- shared helpers ----------
  /** The crew storage chest in the hab. */
  chest() { return this.w.chest.inv; }
  /** Do I (or the chest) have n of this item? */
  has(id, n = 1) { return countItem(this.inv, id) + countItem(this.chest(), id) >= n; }
  /** Take items from my bag first, then the crew chest. */
  take(id, n) {
    const mine = Math.min(n, countItem(this.inv, id));
    if (mine) removeItem(this.inv, id, mine);
    if (n - mine) { removeItem(this.chest(), id, n - mine); this.w.chestChanged(); }
  }
  /** Empty my bag into the chest (at the hab). */
  deposit(then) {
    this.enter('hab', () => this.wait(800, () => {
      let any = false;
      this.inv.forEach((s, i) => { if (!s) return; const left = addItem(this.chest(), s.id, s.n); if (left < s.n) any = true; this.inv[i] = left ? { id: s.id, n: left } : null; });
      if (any) { this.w.chestChanged(); this.mgr.say(`${this.name} put supplies in the crew chest.`, JOBS[this.job].color); }
      then?.();
    }));
  }
  /** Bots head back to the chest once 6 slots are used. */
  bagFull() { return this.inv.filter(Boolean).length >= 6; }
  /** Walk to the nearest loose item (optionally only some kinds) and pick it up. */
  gather(filter, maxDist) {
    const L = this.w.loot;
    let best = null, bd = maxDist;
    for (const g of L.ground) {
      if (L.pending.has(g.gid) || !filter(g.id) || ITEMS[g.id]?.job) continue;     // (job-only items, like rock samples, are for people)
      const z = this.w.zones.find(z => z.rect.contains(g.x, g.y));
      if (z?.hazard) continue;                                   // bots avoid the Reactor Wreck
      const d = Math.hypot(g.x - this.x, g.y - this.y); if (d < bd) { bd = d; best = g; }
    }
    if (!best) return false;
    this.goTo(best.x, best.y, async () => {
      if (!L.ground.includes(best) || L.pending.has(best.gid)) return;
      L.pending.add(best.gid);
      L.botPending.set(best.gid, g => addItem(this.inv, g.id, g.n));   // when the server agrees, it goes in MY bag
      const ok = await net.claim(`g:${best.gid}`);
      if (!ok) { L.pending.delete(best.gid); L.botPending.delete(best.gid); return; }
      if (net.solo) L.removeGroundById(best.gid, true);
    });
    return true;
  }
  /** Walk to the nearest unopened crate (not in the Reactor Wreck) and open it. */
  openNearbyCrate(maxDist) {
    const L = this.w.loot;
    let best = null, bd = maxDist;
    for (const c of L.crates) {
      if (c.open) continue;
      const z = this.w.zones.find(z => z.rect.contains(c.x, c.y)); if (z?.hazard) continue;
      const d = Math.hypot(c.x - this.x, c.y - this.y); if (d < bd) { bd = d; best = c; }
    }
    if (!best) return false;
    this.goTo(best.x, best.y + 10, () => L.openCrate(best));
    return true;
  }

  // ---------- 🌱 Botanist ----------
  /** Botanist bot: harvest anything ready, plant seeds in empty planters, otherwise gather seeds and food. */
  botanist() {
    const w = this.w, P = w.planters;
    const ready = P.findIndex(p => p && growth(p) >= 1);
    if (ready >= 0) return this.enter('greenhouse', () => this.wait(1500, () => {
      const p = P[ready]; if (!p || growth(p) < 1) return;
      const c = CROPS[p.seed];
      addItem(this.inv, c.crop, c.yield); if (Math.random() < c.seedBack) addItem(this.inv, p.seed, 1);
      P[ready] = null; w.plantersChanged(); w.stats.harvested.add(c.crop);
      if (w.fert[ready]) { w.fert[ready] = false; w.fertChanged(); }
      this.mgr.say(`${this.name} harvested ${c.yield} ${itemName(c.crop)}!`, JOBS.botanist.color);
      this.deposit();
    }));
    const empty = P.findIndex(p => !p);
    const seed = Object.keys(CROPS).find(id => this.has(id));
    if (empty >= 0 && seed) {
      const fromChest = countItem(this.inv, seed) === 0;
      const plant = () => this.enter('greenhouse', () => this.wait(1500, () => {
        if (w.planters[empty] || !this.has(seed)) return;
        this.take(seed, 1); w.planters[empty] = { seed, grown: 0 }; w.plantersChanged();
        this.mgr.say(`${this.name} planted ${CROPS[seed].name}. It grows in 1 minute when the grow lights work.`, JOBS.botanist.color);
      }));
      return fromChest ? this.enter('hab', () => this.wait(600, plant)) : plant();
    }
    if (this.bagFull()) return this.deposit();
    if (this.gather(id => id.startsWith('seeds_') || id.startsWith('food') || id.startsWith('crop'), 700)) return;
    if (this.inv.some(Boolean)) return this.deposit();
    this.wander();
  }

  // ---------- 🔧 Builder ----------
  /** Builder bot: repair the next machine it has parts for, recycle scrap into missing parts, otherwise gather parts. */
  builder() {
    const w = this.w, E = w.equipment;
    // 1. Repairs we have the parts for (rocket included)
    for (const e of E.list) {
      if (!e.broken && !(e.key === 'rocket' && e.progress < e.def.steps)) continue;
      const needs = Object.entries(e.def.needs);
      if (!needs.every(([id, n]) => this.has(id, n))) continue;
      const needChest = needs.some(([id, n]) => countItem(this.inv, id) < n);
      const fix = () => this.goTo(e.x, e.y + 4, () => this.wait(e.def.repairMs, () => {
        if (!needs.every(([id, n]) => this.has(id, n))) return;
        // The rocket: put in every rocket part we have in one go
        let k = 1;
        if (e.key === 'rocket') while (k < e.def.steps - e.progress && this.has('rocket_part', k + 1)) k++;
        if (e.key === 'rocket') this.take('rocket_part', k); else for (const [id, n] of needs) this.take(id, n);
        if (e.key === 'rocket') { e.progress += k; e.broken = e.progress < e.def.steps; } else e.broken = false;
        E.refresh(); w.equipmentChanged();
        this.mgr.say(e.key === 'rocket' ? `${this.name} installed ${k} rocket part${k > 1 ? 's' : ''} (${e.progress}/${e.def.steps}).` : `${this.name} repaired the ${e.def.name}!`, JOBS.builder.color);
      }));
      return needChest ? this.enter('hab', () => this.wait(600, fix)) : fix();
    }
    // 2. Recycle scrap into a part a repair is waiting for
    const canMake = r => Object.entries(r.from).every(([id, n]) => this.has(id, n));
    const wanted = RECIPES.find(r => E.list.some(e => e.broken && e.def.needs[r.make] && !this.has(r.make, e.def.needs[r.make])));
    if (wanted && canMake(wanted)) return this.enter('workshop', () => this.wait(2000, () => {
      if (!canMake(wanted)) return;
      for (const [id, n] of Object.entries(wanted.from)) this.take(id, n);
      addItem(this.inv, wanted.make, wanted.n);
      this.mgr.say(`${this.name} recycled scrap into a ${itemName(wanted.make)}.`, JOBS.builder.color);
    }));
    // 3. Look for parts nearby
    if (this.gather(id => ['pipe', 'wire', 'scrap', 'circuit_board', 'power_core', 'rocket_part'].includes(id), 500)) return;
    if (this.inv.some(Boolean) && !this.inv.some(s => s && ['pipe', 'wire', 'circuit_board', 'power_core', 'rocket_part'].includes(s.id))) return this.deposit();
    const ws = w.buildings.workshop.door; this.goTo(ws.x + Math.random() * 40 - 20, ws.y + 20);
  }

  // ---------- 🚀 Pilot ----------
  /** Pilot bot: grab loot near the base, open crates, and bring everything back to the chest. */
  pilot() {
    if (this.bagFull()) return this.deposit();
    if (this.gather(() => true, 250)) return;            // grab what's close first
    if (this.openNearbyCrate(650)) return;               // then open crates
    if (this.gather(() => true, 900)) return;
    if (this.inv.some(Boolean)) return this.deposit();
    this.wander();
  }

  /** Nothing to do: stroll around near the hab for a few seconds. */
  wander() {
    const d = this.w.buildings.hab.door;
    this.goTo(d.x + Math.random() * 160 - 80, d.y + 20 + Math.random() * 60);
    this.thinkAt = (this.mgr.time ?? 0) + 3000;
  }
}
