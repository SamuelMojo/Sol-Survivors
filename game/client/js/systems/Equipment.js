// The 5 broken machines on the map (rules in game/rules/equipment.js). Only the Builder can fix them.
// MOXIE (air) is always the first job. The fission generators power the greenhouse lights and the laser
// comms; MOXIE runs on its own battery at half speed until the generators work.
//
// 👤 Owner: Game logic & backend. Repairs themselves happen in WorldScene.repair() and in Bots.js.
import { EQUIPMENT } from '/game/rules/equipment.js';
import { countItem } from '/game/rules/inventory.js';
import { itemName, ITEMS } from '/game/rules/items.js';

// How close (pixels) you must stand to use a machine
const RANGE = 24;

/** Keeps track of the 5 machines: broken or fixed, rocket progress, and their pictures and '!' markers. */
export class Equipment {
  /**
   * places: where each machine stands ({ key: { x, y } }, set in WorldScene).
   * objects: the map's objects (for the generator and MOXIE pictures).
   * rnd: the shared seeded random, so every player sees the same 2 generators broken.
   */
  constructor(scene, objects, places, rnd = Math.random) {
    this.scene = scene;
    // Fission generator pictures (2 of 4 broken in the crash; one repair fixes them all)
    const panels = objects.filter(o => o.type === 'equipment' && o.name === 'generator');
    const order = [...panels]; for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const cracked = new Set(order.slice(0, 2));
    this.panelImgs = panels.map(o => ({ img: scene.add.image(o.x, o.y, cracked.has(o) ? 'eq-generator-broken' : 'eq-generator').setOrigin(0, 0).setDepth(o.y + o.height - 3), cracked: cracked.has(o) }));
    const om = objects.find(o => o.type === 'equipment' && o.name === 'moxie');
    if (om) scene.add.image(om.x, om.y, 'eq-moxie').setOrigin(0, 0).setDepth(om.y + om.height - 3);
    // Name signs, like the buildings have: MOXIE, and one over the 4 fission generators
    const sign = (x, y, text) => scene.add.text(x, y, text, { fontFamily: 'VT323', fontSize: '12px', color: '#fbefd5', backgroundColor: '#2a4a6a', padding: { x: 3, y: 0 } }).setOrigin(0.5, 1).setDepth(99990);
    if (om) sign(om.x + om.width / 2, om.y - 2, 'MOXIE');
    if (panels.length) sign(panels.reduce((t, o) => t + o.x + o.width / 2, 0) / panels.length, Math.min(...panels.map(o => o.y)) - 2, 'FISSION GENERATORS');
    // MOXIE's red warning light flashes until it's fixed
    if (om) {
      this.moxieLight = scene.add.circle(om.x + 22, om.y + 2, 2.5, 0xff2a2a).setDepth(om.y + om.height);
      scene.time.addEvent({ delay: 350, loop: true, callback: () => this.moxieLight.setVisible(!!this.get('moxie')?.broken && !this.moxieLight.visible) });
    }

    // One entry per machine, in repair order: { key, def (rules + words), x, y, broken, progress }
    this.list = Object.entries(EQUIPMENT).sort((a, b) => a[1].order - b[1].order).map(([key, def]) => ({
      key, def, x: places[key].x, y: places[key].y, broken: true, progress: def.steps ? 0 : undefined,
    }));
    // a red "!" above anything broken
    for (const e of this.list) {
      const tx = e.key === 'rocket' ? e.x - 30 : e.x;     // the rocket's tag goes beside it, so NASA on its side stays readable
      const lift = e.key === 'moxie' ? 18 : 0;            // MOXIE has a name sign on top: the '!' and parts go above it
      e.mark = scene.add.text(tx, e.y - 34 - lift, '!', { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ff5f5f' })
        .setOrigin(0.5).setStroke('#160c11', 3).setDepth(99999);
      scene.tweens.add({ targets: e.mark, y: e.mark.y - 3, duration: 500, yoyo: true, repeat: -1 });
      // ...and the parts it needs, as pictures, so everyone can see what to bring (e.g. [pipe] x2 [board] x1)
      e.partsTag = scene.add.container(tx, e.y - 50 - lift).setDepth(99999);
    }
    // A lamp outside the greenhouse that lights up once the grow lights work
    const gl = places.greenhouse_lights;
    this.lamp = { x: gl.x + 14, y: gl.y + 4, g: scene.add.graphics().setDepth(gl.y + 4) };
    this.refresh();
  }

  /** Draw the greenhouse lamp: dark, or glowing once the grow lights work. */
  drawLamp() {
    const { x, y, g } = this.lamp, on = this.working('greenhouse_lights');
    g.clear();
    if (on) g.fillStyle(0xfff3a0, 0.18).fillCircle(x, y - 22, 16).fillStyle(0xfff3a0, 0.25).fillCircle(x, y - 22, 9);
    g.fillStyle(0x6f777d).fillRect(x - 1, y - 20, 2, 20).fillRect(x - 4, y - 1, 8, 2);      // the post
    g.fillStyle(on ? 0xfff3a0 : 0x3a3a3a).fillCircle(x, y - 22, 3);                       // the bulb
  }

  /** Find a machine by key, e.g. get('rocket'). */
  get(key) { return this.list.find(e => e.key === key); }
  /** Is there power? (True once the fission generators are fixed.) */
  get powered() { return !this.get('fission_generator').broken; }
  /** A machine is working when it's fixed (and, if it needs power, the generators are fixed too). */
  working(key) { const e = this.get(key); return !!e && !e.broken && (!e.def.powered || this.powered); }
  /** Working on battery only (MOXIE before the generators are fixed): runs at half speed. */
  onBattery(key) { const e = this.get(key); return !!e && !e.broken && e.def.battery && !this.powered; }

  /** The machine within RANGE of (x, y), closest first, or null. */
  nearest(x, y) {
    let best = null, bd = RANGE;
    for (const e of this.list) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  /** Parts still missing for a repair: [{ id, need, have }] */
  missing(e, inv) {
    return Object.entries(e.key === 'rocket' ? { rocket_part: 1 } : e.def.needs).map(([id, need]) => ({ id, need, have: countItem(inv, id) })).filter(m => m.have < m.need);
  }
  /** The parts a repair needs as text, e.g. '2 Pipe, 1 Circuit board'. */
  needsText(e) { return Object.entries(e.def.needs).map(([id, n]) => `${n} ${itemName(id)}`).join(', '); }

  /** Shared state for multiplayer. */
  state() { return this.list.map(e => ({ b: !!e.broken, p: e.progress ?? 0 })); }
  /** Copy machine states from the crew leader (multiplayer). */
  applyState(st) {
    st.forEach((x, i) => { const e = this.list[i]; if (!e) return; e.broken = x.b; if (e.progress != null) e.progress = x.p; });
    this.refresh();
  }

  /** The parts a machine still needs: { itemId: count }. The rocket needs one rocket part per part still missing. */
  partsNeeded(e) { return e.key === 'rocket' ? { rocket_part: e.def.steps - e.progress } : e.def.needs; }

  /** The broken machines that need this item (e.g. 'pipe' -> [MOXIE]). */
  usesOf(itemId) { return this.list.filter(e => e.broken && this.partsNeeded(e)[itemId]); }

  /** Draw the row of part pictures above a broken machine (hidden once it's fixed). */
  drawPartsTag(e) {
    const s = this.scene, C = e.partsTag; C.removeAll(true);
    C.setVisible(!!e.broken);
    if (!e.broken) return;
    const parts = Object.entries(this.partsNeeded(e)), w = parts.length * 30 + 4;
    C.add(s.add.rectangle(0, 0, w, 18, 0x2a1820, 0.9).setStrokeStyle(1, 0xffd34d));
    parts.forEach(([id, n], i) => {
      const x = -w / 2 + 4 + i * 30;
      C.add(s.add.image(x + 8, 0, 'items', ITEMS[id].icon));
      C.add(s.add.text(x + 16, 0, `x${n}`, { fontFamily: 'VT323', fontSize: '13px', color: '#fbefd5' }).setOrigin(0, 0.5));
    });
  }

  /** Update the pictures: '!' and the needed parts above broken machines; broken generators light up once fixed. */
  refresh() {
    for (const e of this.list) { e.mark.setVisible(!!e.broken); this.drawPartsTag(e); }
    if (this.lamp) this.drawLamp();
    const fixed = this.powered;
    for (const p of this.panelImgs) p.img.setTexture(p.cracked && !fixed ? 'eq-generator-broken' : 'eq-generator');
  }

  /** Lines for the HUD's base status panel: [text, ok] */
  status() {
    return this.list.map((e, i) => {
      if (e.key === 'rocket') return [`${i + 1}. Rocket parts: ${e.progress}/${e.def.steps}`, e.progress >= e.def.steps];
      const state = e.broken ? 'BROKEN' : e.def.powered && !this.powered ? 'NO POWER' : this.onBattery(e.key) ? 'ON BATTERY (half speed)' : 'WORKING';
      return [`${i + 1}. ${e.def.name}: ${state}`, state === 'WORKING'];
    });
  }
}
