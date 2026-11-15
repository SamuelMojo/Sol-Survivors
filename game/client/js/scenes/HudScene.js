// The HUD: everything drawn on top of the world while you play on Mars. Kept deliberately small:
//   top left: clock and warnings (the MOXIE countdown too). Your to-do list is in the menu (T), not on screen
//   top right: the 3 bars (food, oxygen, radiation), and TO-DO and MENU buttons
//   bottom: hotbar (with the key to use the selected item), messages, [E] prompt, and the map (click it to make it big)
// Everything else (controls, full to-do list, machines, crew) is in the pause menu (Esc). B shows the machines panel.
// It reads from the World scene every frame and listens for game events ('inv', 'toast', 'zone'...).
//
// 👤 Owner: Game logic & backend.
import { WORLD, SCREEN, JOBS } from '/game/rules/settings.js';
import { ITEMS } from '/game/rules/items.js';
import { INTERIORS } from '/levels/rooms.js';
import { RADIATION, TIME, LAUNCH } from '/game/rules/survival.js';
import { itemHint, partLines } from './PauseScene.js';
import { HOME } from '/story/crash.js';
import { fmtTime } from '../systems/Survival.js';
import { net } from '../net.js';
import { Minimap } from '../systems/Minimap.js';

const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#fbefd5' };
// Messages (bottom left) stack upwards from here: above the [E] prompt line, which is at SCREEN.height - 46
const TOAST_BOTTOM = SCREEN.height - 66;
const VT = { fontFamily: 'VT323', fontSize: '16px', color: '#fbefd5' };

/** Scene: the heads-up display, drawn on top of the World scene. */
export class HudScene extends Phaser.Scene {
  /** Register the scene under the name 'Hud'. */
  constructor() { super('Hud'); }

  /** Create every HUD element once and subscribe to the game events that change them. */
  create() {
    this.world = this.scene.get('World');
    const W = SCREEN.width, H = SCREEN.height;

    // ---- sky effects drawn over the world: night, dust storms, flare particles ----
    this.sky = this.add.graphics().setDepth(-10);
    // The night's darkness, with head-torch light cut out of it (see drawDarkness)
    this.darkTex = this.textures.exists('darkness') ? this.textures.get('darkness') : this.textures.createCanvas('darkness', W, H);
    this.darkCtx = this.darkTex.getContext();
    this.darkImg = this.add.image(0, 0, 'darkness').setOrigin(0).setDepth(-11).setVisible(false);

    // ---- the map (bottom right): uncovers as the crew explores; shows the crew and where to go next ----
    this.minimap = new Minimap(this, this.world);

    // ---- sector + area (top left) ----
    this.clockText = this.add.text(6, 4, '', { ...PX, color: '#ffd34d' }).setStroke('#160c11', 4);
    this.chips = this.add.text(6, 15, '', { ...VT, fontSize: '14px', wordWrap: { width: 250 }, lineSpacing: -4 }).setStroke('#160c11', 4);

    // ---- the 3 things you manage: food, air, health (top right) ----
    this.add.rectangle(W - 2, 2, 148, 40, 0x160c11, 0.72).setOrigin(1, 0);    // a dark panel behind the bars (world labels showed through)
    this.bars = this.add.graphics();
    this.barLabels = ['FOOD', 'OXYGEN', 'HEALTH'].map((t, i) => this.add.text(W - 112, 6 + i * 12, t, { ...PX, fontSize: '8px', color: '#c9ad93' }).setOrigin(1, 0).setStroke('#160c11', 3));
    this.barVals = [0, 1, 2].map(i => this.add.text(W - 44, 5 + i * 12, '', { ...VT, fontSize: '13px' }).setStroke('#160c11', 3));

    // ---- your job, at the top in the middle ----
    this.roleText = this.add.text(W / 2 + 6, 4, '', { ...PX, fontSize: '8px' }).setOrigin(0.5, 0).setStroke('#160c11', 4);

    // ---- buttons: TO-DO list and the pause MENU (top right, under the bars) ----
    const button = (x, label, fn) => this.add.text(x, 44, label, { ...VT, fontSize: '14px', backgroundColor: '#2a1820', padding: { x: 4, y: 1 } })
      .setOrigin(1, 0).setStroke('#160c11', 2).setInteractive({ useHandCursor: true }).on('pointerdown', fn);
    this.menuBtn = button(W - 6, '☰ MENU [Esc]', () => !this.world.uiOpen && this.world.openScreen('Pause'));
    this.todoBtn = button(this.menuBtn.x - this.menuBtn.width - 4, '✔ TO-DO [T]', () => !this.world.uiOpen && this.world.showTasks());

    // ---- arrows pointing to crewmates who are off screen ----
    this.arrows = this.add.graphics();
    this.arrowTags = [];

    // ---- machines panel (top right, hidden; B shows it) ----
    this.basePanel = this.add.container(W - 6, 64);
    this.baseVisible = false;
    this.basePanel.setVisible(false);
    this.game.events.on('toggleBase', () => { this.baseVisible = !this.baseVisible; this.basePanel.setVisible(this.baseVisible); });
    this.drawBase();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.drawBase() });
    this.game.events.on('base', () => this.drawBase());

    // ---- radiation hazard warning ----
    this.hazardFrame = this.add.rectangle(W / 2, H / 2, W - 4, H - 4).setStrokeStyle(4, 0xff3355).setVisible(false);
    this.hazardText = this.add.text(W / 2, 28, 'RADIATION HAZARD', { ...PX, color: '#ff5f5f' }).setOrigin(0.5).setStroke('#160c11', 4).setVisible(false);

    // ---- area banner (top centre) ----
    this.banner = this.add.container(W / 2, 74).setAlpha(0);
    this.bannerBg = this.add.rectangle(0, 0, 320, 40, 0x2a1820, 0.92).setStrokeStyle(2, 0xf3d9a4).setOrigin(0.5, 0);
    this.bannerTitle = this.add.text(0, 6, '', { ...PX, color: '#ffd34d' }).setOrigin(0.5, 0);
    this.bannerFact = this.add.text(0, 18, '', { ...VT, wordWrap: { width: 300 }, align: 'center', lineSpacing: -4 }).setOrigin(0.5, 0);
    this.banner.add([this.bannerBg, this.bannerTitle, this.bannerFact]);
    this.seen = new Set();
    this.game.events.on('zone', z => this.onZone(z));
    this.game.events.on('inside', () => { this.tweens.killTweensOf(this.banner); this.banner.setAlpha(0); });   // no area banner over a room
    if (this.world.zone) this.onZone(this.world.zone);

    // ---- hotbar: your 10 bag slots (bottom centre) ----
    this.hotbar = this.add.container(0, 0);
    this.drawHotbar();
    this.game.events.on('inv', () => this.drawHotbar());
    this.game.events.on('sel', () => this.drawHotbar());
    this.game.events.on('base', () => this.drawHotbar());   // a machine got fixed: item hints change

    // ---- standing at a broken machine: the parts it needs, with pictures and what you're carrying ----
    this.needs = this.add.container(W / 2, 80);           // top centre, under the HUD
    this.needsKey = '';

    // ---- "press E" prompt ----
    this.prompt = this.add.text(W / 2, H - 46, '', { ...VT, backgroundColor: '#2a1820', padding: { x: 5, y: 1 } }).setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => { const w = this.world; if (!w.busy()) (w.inside ? w.scene.get('Interior').target : w.target)?.act(); });   // click it instead of pressing E

    // ---- messages ----
    this.toasts = [];
    this.game.events.on('toast', (t, c) => this.toast(t, c));

    // ---- about to pass out: fade to black + red CRITICAL warning (drawn in drawStatus) ----
    this.fade = this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0).setAlpha(0).setDepth(-5);
    this.critText = this.add.text(W / 2, H / 2 + 40, 'CRITICAL: HEALTH LOW!\nGet inside, eat, or use a medkit', { ...PX, fontSize: '10px', color: '#ff3355', align: 'center', lineSpacing: 6 })
      .setOrigin(0.5).setStroke('#160c11', 4).setVisible(false);

    // ---- the host paused the game: big message for everyone else ----
    this.frozenText = this.add.text(W / 2, H / 2 - 20, 'PAUSED\nThe host paused the game', { ...PX, fontSize: '12px', align: 'center', lineSpacing: 8, backgroundColor: '#2a1820', padding: { x: 10, y: 8 } })
      .setOrigin(0.5).setStroke('#160c11', 4).setVisible(false).setDepth(10);

    // ---- a short hint at the start (the full controls are in the pause menu) ----
    this.toast('WASD move   E use   Esc menu & controls', '#fbefd5');

    this.events.once('shutdown', () => ['zone', 'job', 'inv', 'sel', 'toast', 'base', 'toggleBase', 'tasks', 'inside', 'frozen'].forEach(e => this.game.events.off(e)));
  }

  /** Arrows at the screen edge pointing to crewmates you can't see. (The crew list is in the pause menu.) */
  drawCrew() {
    const w = this.world, mp = w.mp, cam = w.cameras.main;
    const crew = [...(mp?.remotes.values() ?? [])];
    // Edge arrows (only while I'm outside)
    const g = this.arrows; g.clear();
    this.arrowTags.forEach(t => t.destroy()); this.arrowTags = [];
    if (w.inside) return;
    const W = SCREEN.width, H = SCREEN.height, cx = W / 2, cy = H / 2;
    for (const r of crew) {
      if (r.inside || r.connected === false) continue;
      const inRover = r.driving || r.riding, rx = (inRover ? w.rover.x : r.x) - cam.scrollX, ry = (inRover ? w.rover.y : r.y) - cam.scrollY;
      if (rx > 8 && rx < W - 8 && ry > 8 && ry < H - 8) continue;           // already on screen
      // Put the arrow where a line from the screen centre to the crewmate leaves the screen
      const a = Math.atan2(ry - cy, rx - cx);
      const t = Math.min((W / 2 - 14) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - 14) / Math.abs(Math.sin(a) || 1e-6));
      const x = cx + Math.cos(a) * t, y = Phaser.Math.Clamp(cy + Math.sin(a) * t, 70, H - 50);   // keep clear of the HUD at the top and bottom
      const col = Phaser.Display.Color.HexStringToColor(JOBS[r.job].color).color;
      g.fillStyle(col).fillTriangle(x + Math.cos(a) * 7, y + Math.sin(a) * 7, x + Math.cos(a + 2.5) * 6, y + Math.sin(a + 2.5) * 6, x + Math.cos(a - 2.5) * 6, y + Math.sin(a - 2.5) * 6);
      const m = Math.round(Math.hypot(rx - cx, ry - cy) / 16 * 4);
      this.arrowTags.push(this.add.text(x - Math.cos(a) * 12, y - Math.sin(a) * 12, `${r.name} ${m}m`, { ...VT, fontSize: '12px', color: JOBS[r.job].color }).setOrigin(0.5).setStroke('#160c11', 3));
    }
  }

  /** My NEXT task, one at a time (the full list is behind the TO-DO button or T). */
  /**
   * At a broken machine: a box above the [E] prompt listing each part it needs, with its picture,
   * how many you have and a ✔ or ✗. Redrawn only when something changes.
   */
  drawNeeds(e) {
    const w = this.world, lines = e ? partLines(w, e) : [];
    const key = e ? `${e.key}|${lines.map(l => l[0]).join()}|${w.job}` : '';
    if (key === this.needsKey) return;
    this.needsKey = key;
    const C = this.needs; C.removeAll(true);
    if (!e) return;
    const allOk = lines.every(l => l[1]);
    const foot = w.job !== 'builder' ? 'Only the Builder can fix it. Bring them these parts!' : allOk ? 'You have everything: press E to fix it!' : 'Find the ✗ parts: crates, the crew chest, or ask the crew.';
    const title = this.add.text(0, 0, `${e.def.name.toUpperCase()} NEEDS:`, { ...PX, color: '#ffd34d' }).setOrigin(0.5, 0);
    const rows = lines.map(([t, ok, id]) => [this.add.image(0, 0, 'items', ITEMS[id].icon), this.add.text(0, 0, t, { ...VT, fontSize: '15px', color: ok ? '#7bd88f' : '#ff8a70' }).setOrigin(0, 0.5)]);
    const footT = this.add.text(0, 0, foot, { ...VT, fontSize: '14px', color: allOk && w.job === 'builder' ? '#7bd88f' : '#fbefd5' }).setOrigin(0.5, 0);
    const width = Math.max(title.width, footT.width, ...rows.map(r => r[1].width + 22)) + 16, height = 14 + rows.length * 18 + 18;
    const top = 0;
    this.banner.setAlpha(0);                              // the area banner would cover it
    C.add(this.add.rectangle(0, top, width, height, 0x2a1820, 0.95).setOrigin(0.5, 0).setStrokeStyle(2, 0xffd34d));
    title.y = top + 4; C.add(title);
    rows.forEach(([img, t], i) => { const y = top + 22 + i * 18; img.setPosition(-width / 2 + 14, y); t.setPosition(-width / 2 + 26, y); C.add([img, t]); });
    footT.y = top + 14 + rows.length * 18 + 2; C.add(footT);
  }

  /** The '5 machines' panel: each machine's state, the air supply and the launch window. */
  drawBase() {
    const P = this.basePanel; P.removeAll(true);
    const w = this.world, sv = w.survival;
    const lines = [
      ...w.equipment.status(),
      [w.equipment.get('moxie').broken ? `Emergency air runs out: end of Sol ${sv.airDeadline}` : 'Air: MOXIE is making oxygen', !w.equipment.get('moxie').broken],
      [HOME.panel(LAUNCH.closes), true],
    ];
    const bg = this.add.rectangle(0, 0, 162, 26 + lines.length * 11, 0x2a1820, 0.85).setOrigin(1, 0);
    P.add(bg);
    P.add(this.add.text(-157, 2, '5 MACHINES  [B] hide', { ...PX, fontSize: '8px', color: '#ffd34d' }));
    P.add(this.add.text(-157, 12, 'Only the Builder can fix', { ...VT, fontSize: '12px', color: '#c9ad93' }));
    lines.forEach(([t, ok], i) => P.add(this.add.text(-157, 24 + i * 11, t, { ...VT, fontSize: '13px', color: ok ? '#7bd88f' : '#ff8a70' })));
  }

  /** The 10 bag slots at the bottom, with the selected slot highlighted and its item's name above. */
  drawHotbar() {
    const w = this.world, H = SCREEN.height, size = 20, gap = 2, n = w.inv.length;
    const x0 = Math.round((SCREEN.width - (n * size + (n - 1) * gap)) / 2) - 20, y0 = H - size - 4;
    this.hotbar.removeAll(true);
    w.inv.forEach((s, i) => {
      const x = x0 + i * (size + gap), sel = i === w.sel;
      this.hotbar.add(this.add.rectangle(x, y0, size, size, 0x2a1820, 0.9).setOrigin(0).setStrokeStyle(sel ? 2 : 1, sel ? 0xffd34d : 0x7a5a4a)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => !w.busy() && w.select(i)));   // click a slot to pick it
      if (s) {
        this.hotbar.add(this.add.image(x + size / 2, y0 + size / 2, 'items', ITEMS[s.id].icon));
        if (s.n > 1) this.hotbar.add(this.add.text(x + size, y0 + size + 1, String(s.n), { ...PX, fontSize: '8px' }).setOrigin(1, 1).setStroke('#160c11', 3));
      }
    });
    // The selected item's name, and which key uses it (e.g. "Space ration · F: eat (indoors)")
    const s = w.inv[w.sel], hint = s ? itemHint(s.id, w.job, w) : '';
    this.hotbar.add(this.add.text(x0, y0 - 2, s ? `${ITEMS[s.id].name}${hint ? `  ·  ${hint}` : ''}` : '', { ...VT, fontSize: '14px' }).setOrigin(0, 1).setStroke('#160c11', 3));
  }

  /** Show a message in the bottom left. Up to 3 stack up; each fades after 4.5 s. */
  toast(text, color = '#fbefd5') {
    const t = this.add.text(6, TOAST_BOTTOM, text, { ...VT, fontSize: '14px', color, backgroundColor: '#2a1820', padding: { x: 4, y: 1 }, wordWrap: { width: 200 }, lineSpacing: -3 }).setOrigin(0, 1);
    this.toasts.push(t);
    while (this.toasts.length > 3) { const old = this.toasts.shift(); this.tweens.killTweensOf(old); old.destroy(); }
    let y = TOAST_BOTTOM;
    for (const o of [...this.toasts].reverse()) { o.y = y; y -= o.height + 3; }
    this.tweens.add({ targets: t, alpha: 0, delay: 4500, duration: 600, onComplete: () => { const i = this.toasts.indexOf(t); if (i >= 0) this.toasts.splice(i, 1); t.destroy(); } });
  }

  /** Walked into a new area: show its name; the first time, its real-science fact opens on the big fact screen. */
  onZone(z) {
    if (!z || this.world.inside) return;
    const first = !this.seen.has(z.name);
    this.seen.add(z.name);
    this.bannerTitle.setText(z.name.toUpperCase());
    this.bannerFact.setText('');
    this.bannerBg.setSize(this.bannerTitle.width + 24, 20);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 2500, duration: 800 });
    if (first && z.fact) this.world.showFact({ title: z.name, body: z.fact });
  }

  /** Clock, warning chips, the 3 bars, crewmate arrows, and sky effects (night, dust storm, flare). */
  drawStatus(time) {
    const w = this.world, sv = w.survival, me = sv.me, W = SCREEN.width, H = SCREEN.height;
    // Clock and warning chips
    this.clockText.setText(`SOL ${sv.sol}  ${fmtTime(sv.min)}  ${sv.min >= TIME.wake && sv.min < TIME.sunset ? 'DAY' : 'NIGHT'}`);
    const chips = [];
    if (!sv.airOn && w.moxieTimerOn) chips.push(`FIX MOXIE: ${sv.moxieClock} left! Oxygen can't refill until then.`);   // the air clock (was on the NEXT line)
    const fa = sv.flareActive, f = sv.flareOn();
    if (fa) chips.push('SPACE STORM: stay inside!');
    else if (f && !f.done && f.alarm) chips.push('SPACE STORM COMING: get inside!');
    else if (f && !f.done && sv.known[sv.sol]) chips.push(`Space storm at about ${fmtTime(f.start)}`);
    if (sv.isStorm()) chips.push('DUST STORM: you are slowed!');
    else if (sv.stormComing) chips.push('DUST STORM COMING!');
    this.chips.setText(chips.join('   ')).setColor(fa || f?.alarm || (!sv.airOn && sv.moxieLeft < 120) ? (Math.floor(time / 300) % 2 ? '#ff5f5f' : '#ffd34d') : '#ff8a70');

    // Bars
    const g = this.bars; g.clear();
    const blink = Math.floor(time / 250) % 2;
    const vals = [
      [me.food / 100, me.food < 20 ? (blink ? 0xff5f5f : 0x7a2a2a) : 0xffd34d, me.food <= 0 ? '0!' : `${Math.round(me.food)}`],
      [me.suit / 100, me.suit < 25 ? (blink ? 0xff5f5f : 0x7a2a2a) : 0x6cc4ff, `${Math.round(me.suit)}%${w.inside && sv.airOn && me.suit < 100 ? '+' : ''}`],
      [me.health / 100, me.health < 25 ? (blink ? 0xff5f5f : 0x7a2a2a) : me.health < 50 ? 0xff8a3d : 0x7bd88f, `${Math.round(me.health)}`],
    ];
    const bx = SCREEN.width - 108;
    vals.forEach(([v, col, label], i) => {
      const y = 7 + i * 12;
      g.fillStyle(0x160c11, 0.85).fillRect(bx, y, 62, 8);
      g.fillStyle(col).fillRect(bx + 1, y + 1, 60 * Math.max(0, Math.min(1, v)), 6);
      this.barVals[i].setText(label);
    });

    this.drawCrew();
    this.roleText.setText(`YOU: ${JOBS[w.job].name.toUpperCase()}`).setColor(JOBS[w.job].color);

    // About to pass out: the screen slowly fades to black, with a flashing red warning
    const crit = Math.max(0, (25 - me.health) / 25);
    this.fade.setAlpha(Math.min(0.92, crit * 1.1));
    this.critText.setVisible(crit > 0 && !w.knockingOut).setAlpha(0.6 + 0.4 * Math.sin(time / 150));

    // Sky: night darkness, dust storm haze, flare particles (outdoors only)
    const sky = this.sky; sky.clear();
    if (w.inside) { this.darkImg.setVisible(false); return; }
    const m = sv.min;
    // Night is VERY dark: it fades in after sunset and out at sunrise. Everyone has a torch on their helmet.
    const dawn = TIME.wake + 30;                                   // light by 06:30 (the day starts at 06:00)
    // Long, slow dusk (3 Mars hours from sunset) and dawn (2 hours up to 06:30)
    const dark = m < dawn - 120 ? 0.9 : m < dawn ? 0.9 * (dawn - m) / 120 : m > TIME.sunset - 60 ? Math.min(0.9, (m - TIME.sunset + 60) / 180 * 0.9) : 0;
    this.drawDarkness(dark);
    if (sv.isStorm()) {
      sky.fillStyle(0xc8783c, 0.32).fillRect(0, 0, W, H);
      sky.fillStyle(0xe9a46b, 0.5);
      for (let i = 0; i < 70; i++) sky.fillRect((i * 97 + time / 6 * (1 + i % 3)) % W, (i * 53 + Math.sin(i + time / 900) * 20 + H) % H, 6, 1);
    }
    if (fa) {
      sky.fillStyle(0xff2050, 0.1 + Math.sin(time / 200) * 0.04).fillRect(0, 0, W, H);
      sky.fillStyle(0xffffff, 1);
      for (let i = 0; i < 40; i++) sky.fillRect(Math.random() * W, Math.random() * H, 1, 1 + Math.random() * 2);   // like the "snow" on Curiosity's camera
    }
  }

  /**
   * The night: a dark layer over Mars with a pool of light around every astronaut and a torch beam
   * where they're facing (head torches). Drawn on a small canvas and only when it's dark.
   */
  drawDarkness(dark) {
    this.darkImg.setVisible(dark > 0.02);
    if (dark <= 0.02) return;
    const w = this.world, cam = w.cameras.main, ctx = this.darkCtx, W = SCREEN.width, H = SCREEN.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = `rgba(5, 4, 16, ${dark})`; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';              // cut the light out of the darkness
    const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const torch = (x, y, facing, big) => {
      const sx = x - cam.scrollX, sy = y - cam.scrollY - 8;
      let g = ctx.createRadialGradient(sx, sy, 2, sx, sy, big ? 46 : 34);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, big ? 46 : 34, 0, 7); ctx.fill();
      const [dx, dy] = DIR[facing] ?? DIR.down, ex = sx + dx * 90, ey = sy + dy * 90;   // the beam
      g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 95);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(ex - dy * 34, ey - dx * 34); ctx.lineTo(ex + dy * 34, ey + dx * 34); ctx.closePath(); ctx.fill();
    };
    if (w.inRover) torch(w.rover.x, w.rover.y, w.rover.view === 'side' ? (w.rover.sprite.flipX ? 'left' : 'right') : w.rover.view, true);
    else torch(w.player.x, w.player.y, w.facing, false);
    for (const r of w.mp?.remotes.values() ?? []) if (!r.inside && r.connected !== false && !r.driving && !r.riding) torch(r.x, r.y, r.facing, false);
    for (const [k, b] of Object.entries(w.buildings)) if (k === 'hab' || k === 'greenhouse') { const sx = b.door.x - cam.scrollX, sy = b.door.y - cam.scrollY;   // lit doorways
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 26); g.addColorStop(0, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 26, sy - 26, 52, 52); }
    // A pink greenhouse glows in the dark too
    if (w.greenhousePink?.()) { const b = w.buildings.greenhouse, sx = b.x + b.width / 2 - cam.scrollX, sy = b.y + b.height / 2 - cam.scrollY;
      const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, 70); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 70, sy - 70, 140, 140); }
    this.darkTex.refresh();
  }

  /** Every frame: the map, status, the hazard frame and the [E] prompt. */
  update(time) {
    const p = this.world.player;
    if (!p) return;
    const inside = this.world.inside;

    this.minimap.update(time);              // the explore-to-uncover map (bottom right)

    this.drawStatus(time);

    // Radiation hazard warning
    const hz = !!this.world.zone?.hazard && !inside;
    this.hazardFrame.setVisible(hz).setAlpha(0.5 + Math.sin(time / 150) * 0.4);
    this.hazardText.setVisible(hz);

    // Paused by the host? Show it (and if the host left while paused, the new host unpauses)
    const w = this.world;
    if (w.frozen && net.isLeader && !this.scene.isActive('Pause')) w.setFrozen(false, true);
    this.frozenText.setVisible(!!w.frozen && !net.isLeader);

    const target = this.world.uiOpen || this.world.action ? null : this.world.target;
    this.prompt.setVisible(!!target);
    if (target) this.prompt.setText(`[E] ${target.label}`);
    this.drawNeeds(target?.machine);

  }
}
