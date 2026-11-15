// Backpack screen (press I) and storage chest screen (press E at the chest).
//   Bag:   arrows/WASD or click to choose a slot, X drop one, Shift+X drop all, I/Esc close
//   Chest: Tab or click to switch side, Enter / click again to move a stack, Shift+Enter move one
//
// 👤 Owner: Game logic & backend. Item names, descriptions and facts come from story/items.js.
import { ITEMS } from '/game/rules/items.js';
import { moveStack, BAG_SIZE } from '/game/rules/inventory.js';
import { SCREEN, JOBS } from '/game/rules/settings.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

const PX = { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd34d' };
const VT = { fontFamily: 'VT323', fontSize: '16px', color: '#fbefd5' };
// Slot size and gap between slots, in pixels
const SLOT = 24, GAP = 3;
const FACT_BTN = MINIGAME_TEXT.common.factItem;

/** Scene: the backpack and chest screens. */
export class InventoryScene extends Phaser.Scene {
  /** Register the scene under the name 'Inventory'. */
  constructor() { super('Inventory'); }

  /** mode: 'bag' (just your backpack) or 'chest' (your bag next to the crew chest). */
  init(data) { this.mode = data.mode || 'bag'; }

  /** Set up the keys (move the cursor, drop, move stacks, close) and draw. */
  create() {
    this.scene.bringToTop();                 // always draw above the HUD and rooms
    this.world = this.scene.get('World');
    this.side = 'bag';                       // which grid is selected in chest mode
    this.cursor = { bag: this.world.sel ?? 0, chest: 0 };
    this.layer = this.add.container(0, 0);
    this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x000000, 0.55).setOrigin(0).setDepth(-1)
      .setInteractive();                     // blocks clicks reaching the world

    const kb = this.input.keyboard;
    const keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,X,I,ESC,TAB,ENTER,SHIFT,E');
    // Move the cursor around the grid, wrapping at the ends
    const move = (dx, dy) => {
      const cols = this.side === 'bag' ? 5 : 6, size = this.inv(this.side).length;
      let i = this.cursor[this.side] + dx + dy * cols;
      this.cursor[this.side] = (i + size) % size; this.draw();
    };
    keys.LEFT.on('down', () => move(-1, 0)); keys.A.on('down', () => move(-1, 0));
    keys.RIGHT.on('down', () => move(1, 0)); keys.D.on('down', () => move(1, 0));
    keys.UP.on('down', () => move(0, -1)); keys.W.on('down', () => move(0, -1));
    keys.DOWN.on('down', () => move(0, 1)); keys.S.on('down', () => move(0, 1));
    keys.X.on('down', () => this.mode === 'bag' && this.dropSel(keys.SHIFT.isDown));
    keys.TAB.on('down', e => { e?.originalEvent?.preventDefault?.(); if (this.mode === 'chest') { this.side = this.side === 'bag' ? 'chest' : 'bag'; this.draw(); } });
    keys.ENTER.on('down', () => this.mode === 'chest' && this.transfer(keys.SHIFT.isDown ? 1 : Infinity));
    for (const k of [keys.I, keys.ESC, keys.E]) k.on('down', () => this.close());
    kb.addKey('F').on('down', () => this.openFact());
    kb.addCapture('TAB');

    this.draw();
  }

  /** The selected item's real-science fact, on the big fact screen. This screen waits (paused) until it's closed. */
  openFact() {
    const s = this.inv(this.side)[this.cursor[this.side]], it = s && ITEMS[s.id];
    if (!it?.fact || this.scene.isActive('Fact')) return;
    this.scene.launch('Fact', { title: it.name, body: it.fact, icon: s.id, resume: 'Inventory' });
    this.scene.pause();
  }

  /** The bag or the chest's slots. */
  inv(side) { return side === 'bag' ? this.world.inv : this.world.chest.inv; }

  /** Close the screen. The slot you had selected becomes your hotbar selection. */
  close() {
    this.world.sel = this.cursor.bag;
    this.world.game.events.emit('sel', this.world.sel);
    this.world.closeUI();
    this.scene.stop();
  }

  /** Drop the selected bag item on the ground (one, or the whole stack). */
  dropSel(all) { this.world.drop(this.cursor.bag, all); this.draw(); }

  /** Move n of the selected stack to the other side (bag <-> chest). Storing counts for the to-do lists. */
  transfer(n) {
    const from = this.inv(this.side), to = this.inv(this.side === 'bag' ? 'chest' : 'bag');
    const id = from[this.cursor[this.side]]?.id;
    const moved = moveStack(from, this.cursor[this.side], to, n);
    if (moved && this.side === 'bag') this.world.taskEvent('store', id, moved);
    if (moved) this.world.chestChanged();
    if (!moved && from[this.cursor[this.side]]) this.world.toast(this.side === 'bag' ? 'The chest is full!' : 'Your bag is full!', '#ff5f5f');
    this.world.invChanged(); this.draw();
  }

  // ---------- drawing ----------
  /**
   * Draw one grid of slots with icons and counts. Click a slot to select it; click again (chest) to move it.
   * Returns the y position just below the grid.
   */
  grid(side, x, y, cols, title) {
    const inv = this.inv(side), L = this.layer;
    const rows = Math.ceil(inv.length / cols);
    L.add(this.add.text(x, y - 12, title, PX));
    inv.forEach((s, i) => {
      const sx = x + (i % cols) * (SLOT + GAP), sy = y + Math.floor(i / cols) * (SLOT + GAP);
      const active = this.side === side && this.cursor[side] === i;
      const box = this.add.rectangle(sx, sy, SLOT, SLOT, 0x3a2129).setOrigin(0)
        .setStrokeStyle(active ? 2 : 1, active ? 0xffd34d : 0x7a5a4a).setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        const again = this.side === side && this.cursor[side] === i;
        this.side = side; this.cursor[side] = i;
        if (again && this.mode === 'chest') this.transfer(Infinity); else this.draw();
      });
      L.add(box);
      if (s) {
        L.add(this.add.image(sx + SLOT / 2, sy + SLOT / 2, 'items', ITEMS[s.id].icon));
        if (s.n > 1) L.add(this.add.text(sx + SLOT - 1, sy + SLOT, String(s.n), { ...PX, color: '#fbefd5' }).setOrigin(1, 1).setStroke('#160c11', 3));
      }
      if (side === 'bag' && this.mode === 'bag') L.add(this.add.text(sx + 2, sy + 1, String((i + 1) % 10), { ...VT, fontSize: '10px', color: '#c9ad93' }));
    });
    return y + rows * (SLOT + GAP);
  }

  /** A clickable text button. */
  button(x, y, label, fn) {
    const t = this.add.text(x, y, label, { ...VT, backgroundColor: '#3a2129', padding: { x: 4, y: 1 } })
      .setInteractive({ useHandCursor: true }).on('pointerdown', fn);
    this.layer.add(t);
    return t;
  }

  /** Redraw the whole screen: grids, the selected item's description and real-science fact, and the buttons. */
  draw() {
    this.layer.removeAll(true);
    const L = this.layer, W = SCREEN.width;
    const chestMode = this.mode === 'chest';
    const pw = chestMode ? 400 : 300, ph = chestMode ? 268 : 230;
    const px = (W - pw) / 2, py = (SCREEN.height - ph) / 2;
    L.add(this.add.rectangle(px, py, pw, ph, 0x2a1820, 0.97).setOrigin(0).setStrokeStyle(2, 0xf3d9a4));

    let bottom;
    if (!chestMode) {
      const job = JOBS[this.world.job];
      L.add(this.add.text(px + 8, py + 6, job.name, { ...VT, fontSize: '14px', color: job.color }));   // top left (it overlapped the title)
      bottom = this.grid('bag', px + (pw - (5 * SLOT + 4 * GAP)) / 2, py + 28, 5, `BACKPACK  (${BAG_SIZE} SLOTS)`);
    } else {
      const b1 = this.grid('bag', px + 14, py + 28, 5, 'YOUR BAG');
      const b2 = this.grid('chest', px + pw - 14 - (6 * SLOT + 5 * GAP), py + 28, 6, 'CREW STORAGE CHEST');
      L.add(this.add.text(px + pw / 2 - 6, py + 70, '⇄', { ...VT, fontSize: '22px', color: '#ffd34d' }).setOrigin(0.5));
      bottom = Math.max(b1, b2);
    }

    // Selected item details, with a real-science fact
    const s = this.inv(this.side)[this.cursor[this.side]];
    const ix = px + 12, iw = pw - 24;
    let y = bottom + 4;
    if (s) {
      const it = ITEMS[s.id];
      L.add(this.add.text(ix, y, `${it.name.toUpperCase()}  x${s.n}`, PX)); y += 12;
      const d = this.add.text(ix, y, it.desc, { ...VT, wordWrap: { width: iw } }); L.add(d); y += d.height + 2;
      if (it.fact) { const b = this.button(ix, y, FACT_BTN, () => this.openFact()); b.setColor('#6cc4ff'); y += b.height + 4; }   // the fact opens big (FactScene)
    } else {
      L.add(this.add.text(ix, y, 'Empty slot', { ...VT, color: '#c9ad93' })); y += 20;
    }

    // Buttons (also work with the keyboard shortcuts in brackets)
    const by = py + ph - 22;
    if (!chestMode) {
      this.button(px + 10, by, '[X] Drop 1', () => this.dropSel(false));
      this.button(px + 92, by, '[Shift+X] Drop all', () => this.dropSel(true));
    } else {
      this.button(px + 10, by, '[Enter] Move stack', () => this.transfer(Infinity));
      this.button(px + 140, by, '[Shift+Enter] Move 1', () => this.transfer(1));
      L.add(this.add.text(px + 12, py + ph - 43, '[Tab] switch side', { ...VT, color: '#c9ad93' }));   // its own line: it ran off the panel
    }
    this.button(px + pw - 70, py + ph - (chestMode ? 44 : 22), '[I] Close', () => this.close());
  }
}
