// The pause menu (Esc, P, or the ☰ MENU button). The SAME menu is used everywhere: on launch day, on the
// spaceship and in the crash (data.story = true: just the BUTTONS and SETTINGS tabs), and on Mars. Everything that used to crowd the screen lives here, in tabs:
//   BUTTONS   every key and what it does
//   TO-DO     your whole to-do list, with ✔ for done
//   MACHINES  the 5 machines, the air clock and the launch window
//   CREW      who's playing, their job, where they are and their bars
// Left/Right or 1-4 (or a click) switch tabs. Esc, P or E closes. M mutes.
// The HOST's pause menu freezes the whole game for everyone (no time passes, nobody can move).
// Anyone else's pause menu is just a menu: the game keeps going.
//
// 👤 Owner: Game logic & backend.
import { SCREEN, JOBS } from '/game/rules/settings.js';
import { TASKS } from '/game/rules/tasks.js';
import { ITEMS } from '/game/rules/items.js';
import { countItem } from '/game/rules/inventory.js';
import { FOOD_VALUE, HEAL_ITEMS, LAUNCH } from '/game/rules/survival.js';
import { INTERIORS } from '/levels/rooms.js';
import { audio } from '../systems/Audio.js';
import { net, exitToMenu } from '../net.js';
import { setPaused } from './PausedScene.js';
import { MINIGAME_TEXT } from '/story/minigames.js';
import { HOME } from '/story/crash.js';
import { TODO_HUD } from '/story/jobs.js';

const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' };
const EXIT = MINIGAME_TEXT.common.exit;
const VT = { fontFamily: 'VT323', fontSize: '15px', color: '#fbefd5' };

/** Every key in the game, shown on the BUTTONS tab. */
export const CONTROLS = [
  ['WASD / arrows', 'walk (hold Shift to run)'],
  ['E / Space', 'use, talk, get in or out of the rover'],
  ['F', 'use your item (eat, medkit)'],
  ['1-0 / wheel / click', 'pick a bag slot'],
  ['I', 'open your bag'],
  ['Q', 'drop item (hold Q: drop them all)'],
  ['R', 'shout to the crew'],
  ['T', 'show / hide your to-do list'],
  ['B', 'show / hide the machines panel'],
  ['M', 'sound on / off'],
  ['Esc / P', 'this menu'],
];

/**
 * What an item is for and which key uses it, written next to its name above the hotbar, so you never
 * have to guess. e.g. 'F: eat (indoors only)' or 'fixes MOXIE: take it to the Builder'.
 * w (the World scene) is needed to know which machines are still broken.
 */
export function itemHint(id, job, w) {
  if (HEAL_ITEMS[id]) return 'F: heal';
  if (FOOD_VALUE[id]) return 'F: eat (indoors only)';
  if (id.startsWith('seeds_')) return job === 'botanist' ? 'plant it: E at a greenhouse planter' : 'drop it by the Botanist (Q)';
  if (id === 'fertilizer') return job === 'botanist' ? MINIGAME_TEXT.fertilizer.useHint : 'drop it by the Botanist (Q)';
  if (id === 'rock_sample') return MINIGAME_TEXT.rocks.deskNone;
  const uses = w?.equipment.usesOf(id) ?? [];
  if (uses.length) return `fixes ${uses.map(e => e.def.name).join(' + ')}${job === 'builder' ? '' : ': drop it by the Builder (Q)'}`;
  if (id === 'scrap') return job === 'builder' ? 'turn 3 into a pipe or wire at the workbench' : 'drop it by the Builder (Q)';
  return 'Q: drop (hold to drop all)';
}

/** One line per part a machine needs, with what I have: e.g. ['✔ Pipe: have 2 of 2', true]. */
export function partLines(w, e) {
  return Object.entries(w.equipment.partsNeeded(e)).map(([id, need]) => {
    const have = countItem(w.inv, id);
    return [`${have >= need ? '✔' : '✗'} ${ITEMS[id].name}: you have ${have} of ${need}`, have >= need, id];
  });
}

const TABS = ['BUTTONS', 'TO-DO', 'MACHINES', 'CREW', 'SETTINGS'];
const STORY_TABS = ['BUTTONS', 'SETTINGS'];
/** The keys during the story (before Mars), shown on the BUTTONS tab. */
const STORY_CONTROLS = [
  ['Space / NEXT', 'next (the host)'],
  ['1, 2, 3 / click', 'pick your answer'],
  ['W / Up arrow', 'jump'],
  ['A / D', 'walk (to the rocket ladder, on the ship)'],
  ['W / S', 'climb the ladder, dodge space rocks'],
  ['E', 'use (wire panel, pilot seat, hold on a leak)'],
  ['M', 'sound on / off'],
  ['Esc / P', 'this menu (the host pauses everyone)'],
];

// The Builder's to-do IDs and the machine each one fixes
const REPAIR_TASK = { moxie: 'moxie', power: 'fission_generator', lights: 'greenhouse_lights', laser: 'laser_comms', rocket: 'rocket' };

/**
 * Extra help under the task you should do next (this used to be the NEXT line on screen): the MOXIE countdown,
 * the parts a repair needs and how many are in your bag, and what the Botanist's crops are still waiting for.
 */
export function taskDetail(w, next) {
  if (!next) return [];
  const out = [];
  if (next.id === 'moxie' && w.moxieTimerOn && !w.survival.airOn) out.push(`${w.survival.moxieClock} left to fix MOXIE!`);
  const e = (w.job === 'builder' || next.id === 'moxie') && w.equipment.get(REPAIR_TASK[next.id]);
  if (e?.broken) out.push(`parts: ${Object.entries(w.equipment.partsNeeded(e)).map(([id, n]) => { const have = Math.min(n, countItem(w.inv, id)); return `${have >= n ? '✔' : '✗'} ${ITEMS[id].name} ${have}/${n}`; }).join('   ')}`);
  if (w.job === 'botanist' && ['tune', 'harvest', 'kinds', 'pantry'].includes(next.id) && !w.equipment.working('greenhouse_lights')) {
    out.push(`plants need: ${!w.equipment.get('greenhouse_lights').broken ? '✔' : '✗'} grow lights fixed   ${w.equipment.powered ? '✔' : '✗'} power (generators)`);
  } else if (w.job === 'botanist' && ['harvest', 'kinds', 'pantry'].includes(next.id) && !w.lightsTuned) out.push(TODO_HUD.tuneHint);
  return out;
}

/** Scene: the tabbed pause menu. */
export class PauseScene extends Phaser.Scene {
  /** Register the scene under the name 'Pause'. */
  constructor() { super('Pause'); }

  /** Remember which tab to open on (data.tab, default BUTTONS). */
  init(data) { this.tab = data?.tab ?? 0; this.story = !!data?.story; this.peek = !!data?.peek; this.opened = performance.now(); }

  /** The tabs: just BUTTONS and SETTINGS during the story. */
  get tabs() { return this.story ? STORY_TABS : TABS; }
  /** The name of the open tab. */
  get tabName() { return this.tabs[this.tab]; }

  /** Am I the host (crew leader)? Only the host's pause freezes the game. */
  get host() { return net.isLeader; }

  /** Dim the game, set up the keys and draw the first tab. */
  create() {
    this.scene.bringToTop();
    this.world = this.story ? null : this.scene.get('World');
    // The host pauses the game for everyone (story: setPaused does it). Just looking at the to-do list (T) in a crew
    // game doesn't stop everyone else: it's the only place your tasks are shown now, so people check it often.
    this.multi = (this.world?.mp?.humanCount ?? 1) > 1;
    if (this.host && !this.story && !(this.peek && this.multi)) this.world.setFrozen(true, true);
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x000000, 0.55).setOrigin(0).setInteractive();
    this.layer = this.add.container(0, 0);
    const kb = this.input.keyboard;
    ['ESC', 'P', 'E'].forEach(k => kb.addKey(k).on('down', () => { if (this.confirmExit) { this.confirmExit = false; this.draw(); } else this.close(); }));
    kb.addKey('LEFT').on('down', () => this.show((this.tab + this.tabs.length - 1) % this.tabs.length));
    kb.addKey('RIGHT').on('down', () => this.show((this.tab + 1) % this.tabs.length));
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((k, i) => kb.addKey(k).on('down', () => i < this.tabs.length && this.show(i)));
    // T toggles the to-do list: T opens it (WorldScene) and T again closes it
    if (!this.story) kb.addKey('T').on('down', () => this.tab === 1 ? this.close() : this.show(1));
    this.onRenameFailed = msg => this.world?.toast(msg, '#ff5f5f');
    net.on('renameFailed', this.onRenameFailed);
    this.events.once('shutdown', () => net.off('renameFailed', this.onRenameFailed));
    this.draw();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.draw() });   // keep CREW / MACHINES live
  }

  /** Switch to tab i. */
  show(i) { if (i === this.tab) return; audio.sfx('click'); this.tab = i; this.draw(); }

  /** SETTINGS: ask for a new name, save it in this browser and tell everyone. */
  rename() {
    const now = (() => { try { return localStorage.getItem('sol-name'); } catch { return ''; } })() || '';
    const name = window.prompt('Your new name (up to 15 letters):', now)?.trim().slice(0, 15);
    if (!name) return;
    try { localStorage.setItem('sol-name', name); } catch {}
    net.send('rename', name);
    if (this.world) { this.world.myName = name; this.world.toast(`Your name is now ${name}.`, '#7bd88f'); }
    this.draw();
  }

  /** Close the menu and give control back to the World scene. */
  close() {
    if (performance.now() - this.opened < 250) return;      // the key press that opened it
    if (this.story) { if (this.host) setPaused(this.game, false, true); return; }   // only the host carries on the story
    if (this.host && this.world.frozen) this.world.setFrozen(false, true);
    this.world.closeUI(); this.scene.stop();
  }

  /** The lines for the open tab: an array of [text, colour, key?] (key: a key name drawn in its own column). */
  lines() {
    const w = this.world;
    if (this.tabName === 'BUTTONS') return (this.story ? STORY_CONTROLS : CONTROLS).map(([k, what]) => [what, '#fbefd5', k]);
    if (this.tabName === 'SETTINGS') return [];   // buttons, drawn in draw()
    if (this.tab === 1) {
      const t = w.tasks[w.job], next = w.nextTask();
      return [[`${JOBS[w.job].name.toUpperCase()}: ${JOBS[w.job].short}`, JOBS[w.job].color],
        ...TASKS[w.job].flatMap(task => {
          const done = t.done.has(task.id), prog = task.count > 1 && !done ? ` (${Math.min(task.count, t.progress[task.id] ?? 0)}/${task.count})` : '';
          const row = [`${done ? '✔' : task === next ? '▶' : '☐'} ${task.text}${prog}`, done ? '#7bd88f' : task === next ? '#ffd34d' : '#fbefd5', null, null, task === next];
          return task === next ? [row, ...taskDetail(w, next).map(d => [`     ${d}`, '#ff8a70'])] : [row];
        }), [next ? '▶ = do this next. Each crew member has their own list.' : 'All your tasks are done! ★', next ? '#c9ad93' : '#ffd34d']];
    }
    if (this.tab === 2) {
      const sv = w.survival, moxie = w.equipment.get('moxie');
      // Each machine's state, and under a broken one: the parts it needs (with what I'm carrying)
      const rows = [];
      w.equipment.status().forEach(([t, ok], i) => {
        rows.push([t, ok ? '#7bd88f' : '#ff8a70']);
        const e = w.equipment.list[i];
        if (e.broken) rows.push([`     needs: ${Object.entries(w.equipment.partsNeeded(e)).map(([id, n]) => `${ITEMS[id].name} ${Math.min(n, countItem(w.inv, id))}/${n}`).join(', ')}`, '#c9ad93']);
      });
      return [...rows,
        [moxie.broken ? `Fix MOXIE first! ${sv.moxieClock} left. Suits can't refill until it works.` : 'Air: MOXIE is making air', moxie.broken ? '#ff8a70' : '#7bd88f'],
        [HOME.panel(LAUNCH.closes), '#fbefd5']];
    }
    // CREW: just everyone's health (a bar each). Computer crewmates don't get hurt, so they're always full.
    const crew = [...(w.mp?.remotes.values() ?? [])].filter(r => r.connected !== false);
    return [[`You (${JOBS[w.job].name})`, JOBS[w.job].color, null, w.survival.me.health],
      ...crew.map(r => [`${r.name} (${JOBS[r.job].name})${r.bot ? ' - computer' : ''}`, JOBS[r.job].color, null, r.bot ? 100 : (r.health ?? 100)])];
  }

  /** Draw the box, the tab row, the open tab's lines and the bottom buttons. */
  draw() {
    const L = this.layer; L.removeAll(true);
    const pw = 400, ph = 260, px = (SCREEN.width - pw) / 2, py = (SCREEN.height - ph) / 2;
    L.add(this.add.rectangle(px, py, pw, ph, 0x2a1820, 0.97).setOrigin(0).setStrokeStyle(2, 0xf3d9a4));
    const people = this.world ? this.world.mp?.humanCount ?? 1 : net.lobby?.players?.filter(p => p.connected).length ?? 1;
    L.add(this.add.text(px + 12, py + 9, this.peek && this.multi && !this.world?.frozen ? 'MENU' : this.host || people <= 1 ? 'PAUSED' : this.story ? 'PAUSED BY THE HOST' : 'MENU', PX));
    const crew = people > 1;
    L.add(this.add.text(px + pw - 12, py + 7, !crew ? '' : this.peek && !this.world?.frozen ? 'The game keeps going' : this.host ? 'Game paused for everyone' : 'Only the host can pause the game', { ...VT, fontSize: '13px', color: '#c9ad93' }).setOrigin(1, 0));
    // Tabs
    let x = px + 12;
    this.tabs.forEach((name, i) => {
      const on = i === this.tab;
      const t = this.add.text(x, py + 24, `${i + 1} ${name}`, { ...VT, color: on ? '#160c11' : '#fbefd5', backgroundColor: on ? '#ffd34d' : '#3a2129', padding: { x: 5, y: 1 } })
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.show(i));
      L.add(t); x += t.width + 4;
    });
    // Lines
    let y = py + 48;
    for (const [text, color, key, health, now] of this.lines()) {
      if (health != null) {                       // a crew row: name, then a health bar
        L.add(this.add.text(px + 14, y, text, { ...VT, color }));
        const bx = px + 200, h = Math.max(0, Math.min(100, health));
        L.add(this.add.rectangle(bx, y + 4, 150, 10, 0x160c11).setOrigin(0));
        L.add(this.add.rectangle(bx + 1, y + 5, 148 * h / 100, 8, h < 25 ? 0xff5f5f : h < 50 ? 0xff8a3d : 0x7bd88f).setOrigin(0));
        L.add(this.add.text(bx + 156, y, `${Math.round(h)}`, { ...VT, color: '#fbefd5' }));
        y += 22; continue;
      }
      const indent = key ? 136 : 0, small = (this.tab === 1 || this.tab === 2) && !this.story;
      const t = this.add.text(px + 14 + indent, y, text, { ...VT, fontSize: this.tab === 2 && !this.story ? '14px' : small ? '15px' : '16px', color, wordWrap: { width: pw - 28 - indent }, lineSpacing: -4 });
      if (y + t.height > py + ph - 28) { t.destroy(); L.add(this.add.text(px + 14, y, '...', { ...VT, color: '#c9ad93' })); break; }   // never run into the buttons
      if (key) L.add(this.add.text(px + 14, y, key, { ...VT, color: '#ffd34d' }));
      if (now) L.add(this.add.rectangle(px + 8, y - 1, pw - 16, t.height + 2, 0xffd34d, 0.14).setOrigin(0));   // the task to do next
      L.add(t); y += t.height + (key ? -1 : small ? 0 : 1);
    }
    // SETTINGS: buttons
    if (this.tabName === 'SETTINGS') {
      const name = (() => { try { return localStorage.getItem('sol-name'); } catch { return null; } })() ?? this.world?.myName ?? 'Astronaut';
      const row = (yy, label, fn) => L.add(this.add.text(px + 14, yy, label, { ...VT, backgroundColor: '#3a2129', padding: { x: 5, y: 2 } }).setInteractive({ useHandCursor: true }).on('pointerdown', fn));
      L.add(this.add.text(px + 14, py + 50, `Your name: ${name}`, { ...VT, color: '#ffd34d' }));
      row(py + 74, 'Change my name', () => this.rename());
      row(py + 100, audio.muted ? 'Sound: OFF (click to turn on)' : 'Sound: ON (click to turn off)', () => { audio.setMuted(!audio.muted); this.draw(); });
      if (!this.story) row(py + 126, "I'm stuck! (move me somewhere free)", () => { this.close(); this.world.imStuck(); });
      L.add(this.add.text(px + 14, py + 156, 'If you lose connection, come back with the same name\nand you get your astronaut back.', { ...VT, color: '#c9ad93', lineSpacing: -3 }));
    }

    // Bottom buttons
    const btn = (bx, label, fn) => L.add(this.add.text(bx, py + ph - 8, label, { ...VT, backgroundColor: '#3a2129', padding: { x: 4, y: 1 } }).setOrigin(1, 1)
      .setInteractive({ useHandCursor: true }).on('pointerdown', fn));
    btn(px + pw - 10, '[Esc] Resume', () => this.close());
    btn(px + pw - 110, audio.muted ? '[M] Sound off' : '[M] Sound on', () => { audio.setMuted(!audio.muted); this.draw(); });
    L.add(this.add.text(px + 12, py + ph - 8, EXIT.button, { ...VT, color: '#ff8a70', backgroundColor: '#3a2129', padding: { x: 4, y: 1 } }).setOrigin(0, 1)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.confirmExit = true; this.draw(); }));

    // "Are you sure?" before leaving the game
    if (this.confirmExit) {
      L.add(this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x000000, 0.5).setOrigin(0).setInteractive());
      const bw = 300, bh = 104, bx = (SCREEN.width - bw) / 2, by = (SCREEN.height - bh) / 2;
      L.add(this.add.rectangle(bx, by, bw, bh, 0x2a1820, 1).setOrigin(0).setStrokeStyle(2, 0xff8a70));
      L.add(this.add.text(SCREEN.width / 2, by + 10, EXIT.title, { ...PX, color: '#ff8a70' }).setOrigin(0.5, 0));
      const people = (this.world?.mp?.humanCount ?? net.lobby?.players?.filter(p => p.connected).length ?? 1) > 1;
      L.add(this.add.text(SCREEN.width / 2, by + 26, people ? EXIT.crew : EXIT.solo, { ...VT, align: 'center', wordWrap: { width: bw - 24 }, lineSpacing: -3 }).setOrigin(0.5, 0));
      const choice = (x, label, color, fn) => L.add(this.add.text(x, by + bh - 10, label, { ...VT, color, backgroundColor: '#3a2129', padding: { x: 6, y: 2 } }).setOrigin(0.5, 1)
        .setInteractive({ useHandCursor: true }).on('pointerdown', fn));
      choice(SCREEN.width / 2 - 70, EXIT.yes, '#ff8a70', () => this.exit());
      choice(SCREEN.width / 2 + 70, EXIT.no, '#7bd88f', () => { this.confirmExit = false; this.draw(); });
    }
  }

  /** Leave the game for good and go back to the main menu (the lobby). */
  exit() {
    if (this.exiting) return;
    this.exiting = true;
    if (this.story) { if (this.host) setPaused(this.game, false, true); }
    else if (this.host && this.world?.frozen) this.world.setFrozen(false, true);   // don't leave the crew paused
    exitToMenu();
  }
}
