// Multiplayer: shows the other astronauts, and keeps everyone's world the same.
//   - Each player sends their position ~10 times a second.
//   - Changes to the shared world are sent as events (see onEvent below).
//   - The crew leader sends the clock and base supplies every second (sync).
//   - Computer crewmates (bots) are run by the leader and shown like any other player.
//
// 👤 Owner: Game logic & backend. The server side is game/server/index.js; the connection is ../net.js.
import { JOBS, LOOKS } from '/game/rules/settings.js';
import { net } from '../net.js';
import { addItem } from '/game/rules/inventory.js';
import { itemName } from '/game/rules/items.js';

const SEND_MS = 100, SYNC_MS = 1000;      // send my position every 0.1 s; the leader syncs the clock every 1 s
const KEY_MS = 1000;                       // once a second my position is sent 'reliably' (never dropped), so nobody gets stuck
const STALE_MS = 5000;                     // nothing heard from a crewmate for 5 s: refresh them
const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px' };
const VT = { fontFamily: 'VT323', fontSize: '12px' };

/** Shows the other astronauts and keeps the shared world (crates, chest, machines, crops) the same for everyone. */
export class Multiplayer {
  /** Add a figure for every other player, and listen for server messages. */
  constructor(world, startData) {
    this.w = world;
    this.remotes = new Map();          // id -> { id, name, job, look, x, y, tx, ty, facing, moving, inside, driving, food, suit, rad, sprite, tag, bubble }
    for (const p of startData.players) if (p.id !== net.id) this.addRemote(p);
    this.lastSend = 0; this.lastSync = 0;
    this.gidCounter = 0;
    this.asleepCount = null;

    net.on('pos', d => this.onPos(d));
    net.on('ev', e => this.onEvent(e));
    net.on('sync', d => this.onSync(d));
    net.on('claimed', ({ key, by }) => this.onClaimed(key, by));
    net.on('released', key => { if (key === 'rover') this.w.rover.driverId = null; });
    net.on('left', ({ id, name, quit }) => {
      const r = this.remotes.get(id);
      if (!quit && r && performance.now() - (r.lastSeen ?? 0) < 3000) return;     // still hearing from them: not really gone
      if (r) { r.connected = false; r.sprite.setAlpha(0.35); }
      this.w.toast(quit ? `${name} left the game (Exit to main menu).` : `${name} lost connection. They come back by themselves, or can rejoin with the same name.`, '#ffd34d');
    });
    net.on('lobby', l => this.onLobby(l));
    net.on('renamed', ({ id, name }) => this.onRenamed(id, name));
    net.on('needSnapshot', to => net.send('snapshot', { to, snap: this.w.snapshot() }));
    net.on('snapshot', snap => this.w.applySnapshot(snap));
    // Rejoining: the leader sent a snapshot as soon as I said hello, but my world may still have been loading
    // (then nobody was listening). Ask again now that I'm ready, so things picked up while I was away stay gone.
    if (startData.rejoin && net.socket) net.send('wantSnapshot');
    // Night: the server counts who's asleep; when everyone is, it tells the leader to run the night
    net.on('sleepers', c => { this.asleepCount = c; this.w.game.events.emit('sleepers', c); });
    net.on('runNight', () => this.w.runNightAsLeader());
  }

  /** How many people are playing (me + connected players, not bots). */
  get humanCount() { return 1 + [...this.remotes.values()].filter(r => !r.bot && r.connected !== false).length; }
  /**
   * The player list changed. Someone who comes back (a new connection id) takes over their OLD astronaut,
   * so there is never a second copy of them: their old entry is moved to the new id.
   */
  onLobby(l) {
    const ids = new Set(l.players.map(p => p.id));
    for (const p of l.players) {
      if (p.id === net.id || !p.connected || !p.job) continue;
      let r = this.remotes.get(p.id);
      if (!r) {
        const old = [...this.remotes.values()].find(o => !o.bot && o.job === p.job && !ids.has(o.id));   // their previous self
        if (old) { this.remotes.delete(old.id); old.id = p.id; this.remotes.set(p.id, old); r = old; this.w.toast(`${p.name} is back!`, '#7bd88f'); }
      }
      if (!r) { this.addRemote(p); continue; }
      if (!r.connected) { r.connected = true; r.sprite.setAlpha(1); }
      if (r.name !== p.name) this.onRenamed(p.id, p.name);
    }
  }

  /** A crewmate changed their name (in the menu's SETTINGS tab). */
  onRenamed(id, name) {
    const r = this.remotes.get(id);
    if (!r || r.name === name) return;
    r.name = name; r.tag.setText(name);
  }

  /** A new pile id nobody else can make (my id + a counter), for items I drop. */
  newGid() { return `${net.id}-${++this.gidCounter}`; }

  // ---------- other astronauts ----------
  /** Add another astronaut (person or bot): a sprite plus a name tag in their job colour. */
  addRemote(p, bot = false) {
    if (this.remotes.has(p.id)) return this.remotes.get(p.id);
    const s = this.w;
    const skin = `astro-${p.job}-${p.look ?? 0}`;
    const start = s.player;
    const sprite = s.add.sprite(start.x + 12, start.y, skin, 0).setOrigin(0.5, 1);
    const tag = s.add.text(start.x, start.y - 18, p.name, { ...VT, color: JOBS[p.job].color }).setOrigin(0.5, 1).setStroke('#160c11', 3).setDepth(99998);
    const r = { ...p, bot, skin, sprite, tag, x: sprite.x, y: sprite.y, tx: sprite.x, ty: sprite.y, facing: 'down', moving: false, inside: null, connected: true };
    this.remotes.set(p.id, r);
    return r;
  }

  /** Someone's position update: where they're heading, what they're doing, their bars, and the rover if they drive. */
  onPos(d) {
    let r = this.remotes.get(d.id);
    // A crewmate's messages now come from a new id (their connection dropped and came back before the lobby
    // told us): find their astronaut by job and move it to the new id, instead of ignoring them
    if (!r && d.job && d.id !== net.id) {
      const old = [...this.remotes.values()].find(o => !o.bot && o.job === d.job);
      if (old) { this.remotes.delete(old.id); old.id = d.id; this.remotes.set(d.id, old); r = old; }
    }
    if (!r) return;
    if (r.connected === false) { r.connected = true; r.sprite.setAlpha(1); }    // we're hearing from them, so they're online
    r.lastSeen = performance.now(); r.stale = false;
    Object.assign(r, { tx: d.x, ty: d.y, ix: d.ix, iy: d.iy, facing: d.facing, moving: d.moving, inside: d.inside, driving: d.driving, riding: d.riding, food: d.food, suit: d.suit, health: d.health, asleep: d.asleep, hidden: d.hidden });
    // Someone else is driving: slide the rover smoothly to where they say it is (see Rover.update)
    if (d.driving) { this.w.rover.driverId = d.id; this.w.rover.target = { x: d.rx, y: d.ry }; this.w.rover.face(d.rv ?? 'side', !!d.rflip); }
    else if (this.w.rover.driverId === d.id) this.w.rover.driverId = null;
  }

  /** Called every frame by the world. */
  update(time) {
    const w = this.w, me = w.player, sv = w.survival;
    // send my position
    if (time - this.lastSend > SEND_MS && net.socket) {
      this.lastSend = time;
      const key = time - (this.lastKey ?? 0) > KEY_MS || this.forceKey;
      if (key) { this.lastKey = time; this.forceKey = false; }
      const d = { job: w.job, x: Math.round(me.x), y: Math.round(me.y), facing: w.facing, moving: !!me.body?.velocity.length(), inside: w.inside, driving: w.rover.driving, riding: !!w.riding, food: Math.round(sv.me.food), suit: Math.round(sv.me.suit), health: Math.round(sv.me.health), asleep: !!w.sleeping, hidden: !!w.hidden };
      if (w.rover.driving) Object.assign(d, { rx: Math.round(w.rover.x), ry: Math.round(w.rover.y), rflip: w.rover.sprite.flipX, rv: w.rover.view });
      if (w.inside) { const ip = w.interiorPos(); Object.assign(d, { ix: Math.round(ip.x), iy: Math.round(ip.y), moving: !!this.w.scene.get('Interior')?.player?.body?.velocity.length() }); }
      if (key) d.key = true;
      net.send('pos', d);
      if (net.isLeader) for (const b of w.bots?.list ?? []) net.send('pos', b.posMessage());      // the leader speaks for the bots
    }
    // leader: share the clock and base supplies
    if (net.isLeader && net.socket && time - this.lastSync > SYNC_MS) { this.lastSync = time; net.send('sync', w.syncState()); }
    // draw other astronauts (outdoors)
    // Slide each astronaut a quarter of the way to their latest position every frame (smooth movement)
    const now = performance.now();
    for (const r of this.remotes.values()) {
      // Nothing heard for 5 s? Stop their walking animation, jump them to their last known spot, and ask for news
      if (r.connected !== false && !r.bot && now - (r.lastSeen ?? now) > STALE_MS && !r.stale) {
        r.stale = true; r.moving = false; r.x = r.tx; r.y = r.ty;
        net.eventTo(r.id, 'needPos', {});
      }
      if (r.stale && now - r.lastSeen > STALE_MS * 2) { r.stale = false; r.lastSeen = now - STALE_MS; }   // ask again every 5 s
      r.x += (r.tx - r.x) * 0.25; r.y += (r.ty - r.y) * 0.25;
      const inRover = r.driving || r.riding;   // driving or in a passenger seat: drawn as a helmet on the rover instead
      const show = !r.inside && !inRover && !w.inside;
      r.sprite.setVisible(show).setPosition(r.x, r.y).setDepth(r.y);
      r.tag.setVisible(show || (inRover && !w.inside)).setPosition(inRover ? w.rover.x : r.x, (inRover ? w.rover.y - 12 - (r.riding ? 8 : 0) : r.y) - 16);
      if (show) r.sprite.anims.play(`${r.skin}-${r.moving ? 'walk' : 'idle'}-${r.facing || 'down'}`, true);
      if (r.bubble) r.bubble.setPosition(r.x, r.y - 28).setVisible(show);
    }
  }

  /** Astronauts inside a building, for the Interior scene to draw. */
  inside(id) { return [...this.remotes.values()].filter(r => r.inside === id); }

  // ---------- shared world events ----------
  /** Tell everyone about a change to the shared world. */
  send(type, data) { net.event(type, data); }

  /** Apply a change someone else made. Each case is one kind of event (see the 'send' calls in the scenes). */
  onEvent(e) {
    const w = this.w;
    switch (e.type) {
      case 'crateOpened': w.loot.openCrateRemote(e.i); break;
      case 'drop': for (const d of e.drops) w.loot.addGround(d.x, d.y, d.id, d.n, null, null, d.gid); break;
      case 'equip': w.equipment.applyState(e.state); w.game.events.emit('base'); break;
      case 'freeze': w.setFrozen(e.on, false); break;
      case 'roomDrop': w.addRoomPile(e.room, e.pile, false); break;      // someone dropped something inside a building
      case 'roomTake': w.removeRoomPile(e.room, e.gid); break;
      case 'roverGarage': if (e.in && w.riding) w.exitRide(); w.rover.setInGarage(e.in, w.buildings.garage.door); w.game.events.emit('garage'); break;   // the rover went into / out of the garage
      case 'roverPark': w.rover.park(e.x, e.y, e.v, e.f); break;          // the driver got out: put the rover exactly where they left it                       // the host paused / unpaused the game                    // the leader chose what to fix first
      case 'planters': w.planters = e.planters; break;
      case 'fert': w.fert = e.fert; break;                                    // the Botanist fertilized a bed (or harvested one)
      case 'tuned': w.setLightsTuned(true, false); break;                     // the Botanist tuned the grow lights
      case 'roverFree': w.rover.setStuck(false); w.game.events.emit('garage'); break;   // the Pilot freed the stuck rover
      case 'chest': w.chest.inv = e.inv; w.game.events.emit('inv'); break;
      case 'shelf': w.shelves[e.id] = null; break;
      case 'known': for (const s of e.sols) w.survival.known[s] = true; break;
      case 'baseDelta': if (net.isLeader) for (const [k, v] of Object.entries(e.delta)) w.survival.base[k] = Math.max(0, Math.min(100, w.survival.base[k] + v)); break;
      case 'morning': w.applyMorning(e); break;
      case 'launch': w.endGame(true, 'launch'); break;
      case 'shout': this.showBubble(e.from, e.text); break;
      case 'botSay': w.toast(`${e.text}`, e.color); break;
      case 'needPos': this.forceKey = true; break;                          // a crewmate lost track of me: send my position now
      case 'order': w.bots?.order(e.order, e.from); break;
      case 'botTask': w.bots?.onRemoteTask?.(e); break;
    }
  }

  /** The server decided who got something: a pile ('g:'), a crate ('crate:') or the rover. */
  onClaimed(key, by) {
    const w = this.w;
    if (key.startsWith('g:')) w.loot.removeGroundById(key.slice(2), net.isMe(by));
    // A crate was opened (by anyone, me included even if my own answer was slow): it pops open here with its items.
    // Every screen spills it by itself, so a lost message can't leave a crate open and empty.
    // (If it's my claim and I'm still waiting on it, openCrate does the spilling, with the "Crate opened!" and sound.)
    if (key.startsWith('crate:')) { const c = w.loot.crates.find(c => c.i === +key.slice(6)); if (c && !(net.isMe(by) && c.claiming)) w.loot.spillCrate(c, false); }
    if (key === 'rover') w.rover.driverId = net.isMe(by) ? null : by;
  }

  /** The leader's clock and base supplies (everyone but the leader copies them). */
  onSync(d) { if (!net.isLeader) this.w.applySync(d); }

  // ---------- shouts ----------
  /** Someone shouted (R): a message at the top, and a speech bubble over their head for 3.5 s. */
  showBubble(fromId, text) {
    const w = this.w;
    const r = fromId === net.id ? null : this.remotes.get(fromId);
    const who = fromId === net.id ? 'You' : r?.name ?? 'Crewmate';
    w.toast(`${who}: ${text}`, r ? JOBS[r.job].color : '#fbefd5');
    if (!r) return;
    r.bubble?.destroy();
    r.bubble = w.add.text(r.x, r.y - 28, text, { ...VT, fontSize: '12px', color: '#160c11', backgroundColor: '#fbefd5', padding: { x: 3, y: 1 } }).setOrigin(0.5, 1).setDepth(99999);
    w.time.delayedCall(3500, () => { r.bubble?.destroy(); r.bubble = null; });
  }

  /** The nearest crewmate (human or bot) standing close to you, for giving items. */
  nearestCrewmate(range = 26) {
    const w = this.w, p = w.player;
    let best = null, bd = range;
    for (const r of this.remotes.values()) {
      if (r.connected === false || (r.inside ?? null) !== (w.inside ?? null) || r.driving || r.riding) continue;
      const d = w.inside ? (r.ix != null ? Math.hypot(r.ix - w.interiorPos().x, r.iy - w.interiorPos().y) : Infinity) : Math.hypot(r.x - p.x, r.y - p.y);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
}
