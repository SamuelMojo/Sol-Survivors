// Builder mini game for MOXIE: SPLIT THE CO2.
// 4 carbon dioxide molecules (O=C=O). Drag one oxygen atom off each one (leaving carbon monoxide, CO),
// then drag the free oxygen atoms together in pairs to make 2 oxygen molecules (O2).
// Keyboard: 1-4 pops an O off molecule 1-4; Space joins two free O atoms.
//
// 👤 Owner: Game logic & backend. Words: story/minigames.js (moxie). Opened by WorldScene.repair().
import { MiniGameScene, VT } from './MiniGame.js';
import { MINIGAME_TEXT } from '/story/minigames.js';

const R = 11;                    // atom radius (big click targets)
const COL = { C: 0x55595e, O: 0xff5f5f, Ofree: 0xff8a70 };

/** Scene: drag oxygen atoms off CO2 molecules and pair them up into O2. */
export class MoxieGame extends MiniGameScene {
  constructor() { super('MoxieGame'); }
  get text() { return MINIGAME_TEXT.moxie; }
  /** Close if MOXIE got fixed some other way (e.g. by a crewmate) while we were playing. */
  shouldClose() { return !!this.d.machine && !this.d.machine.broken; }

  /** Make the 4 molecules and their atoms. */
  build() {
    const A = this.playArea;
    this.g = this.add.graphics().setDepth(1);
    this.atoms = [];                 // every atom: { kind: 'C'|'O', obj, label, mol, free, partner }
    this.mols = [];                  // { c, left, right, split }
    const cols = 2, rows = 2, gx = A.w / cols, gy = (A.h - 40) / rows;
    for (let i = 0; i < 4; i++) {
      const cx = A.x + gx * (i % cols) + gx / 2, cy = A.y + 14 + gy * Math.floor(i / cols) + gy / 2;
      const c = this.atom('C', cx, cy), l = this.atom('O', cx - 30, cy), r = this.atom('O', cx + 30, cy);
      const m = { c, left: l, right: r, split: false, i };
      c.mol = l.mol = r.mol = m;
      this.mols.push(m);
      m.tag = this.add.text(cx, cy - 30, 'CO2', { ...VT, fontSize: '13px', color: '#c9ad93' }).setOrigin(0.5).setDepth(5);
    }
    this.o2 = 0;
    this.input.on('drag', (_p, obj, x, y) => this.onDrag(obj.atom, x, y));
    this.input.on('dragend', (_p, obj) => this.onDrop(obj.atom));
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((k, i) => this.input.keyboard.addKey(k).on('down', () => this.popOff(i)));
    this.input.keyboard.addKey('SPACE').on('down', () => this.joinNearest());
  }

  /** One atom: a circle with its letter. Oxygen atoms can be dragged. */
  atom(kind, x, y) {
    const obj = this.add.circle(x, y, R, COL[kind]).setStrokeStyle(2, 0xffffff, 0.5).setDepth(10);
    const label = this.add.text(x, y, kind, { ...VT, fontSize: '16px', color: '#160c11' }).setOrigin(0.5).setDepth(11);
    const a = { kind, obj, label, free: false, partner: null, home: { x, y } };
    obj.atom = a;
    if (kind === 'O') { obj.setInteractive({ useHandCursor: true, draggable: true }); }
    this.atoms.push(a);
    return a;
  }

  /** Can this oxygen still be moved? Not once its molecule gave up its other O, and not once it's in an O2. */
  movable(a) { return a.kind === 'O' && !a.partner && (a.free || !a.mol.split); }

  /** Dragging an O: move it. If it's still on its molecule and gets far enough, it pops off (the molecule becomes CO). */
  onDrag(a, x, y) {
    if (!this.movable(a)) return;
    const A = this.playArea;
    x = Phaser.Math.Clamp(x, A.x + R, A.x + A.w - R); y = Phaser.Math.Clamp(y, A.y + R, A.y + A.h - R);
    a.obj.setPosition(x, y); a.label.setPosition(x, y);
    if (!a.free && Phaser.Math.Distance.Between(x, y, a.mol.c.obj.x, a.mol.c.obj.y) > 34) this.detach(a);
  }

  /** The O is off its molecule: the rest is CO. */
  detach(a) {
    a.free = true; a.mol.split = true; a.obj.setFillStyle(COL.Ofree);
    a.mol.tag.setText('CO').setColor('#ffd34d');
    this.cameras.main.flash(60, 255, 255, 255);
    if (this.mols.every(m => m.split)) this.say(this.text.stepTwo, '#7bd88f', 4000);
  }

  /** Dropped an O: if it's free and next to another free O, they join into O2. */
  onDrop(a) {
    if (!a.free || a.partner) return;
    const other = this.atoms.find(b => b !== a && b.kind === 'O' && b.free && !b.partner && Phaser.Math.Distance.Between(a.obj.x, a.obj.y, b.obj.x, b.obj.y) < R * 2.6);
    if (other) this.pair(a, other);
  }

  /** Two free O atoms become one O2 molecule. */
  pair(a, b) {
    a.partner = b; b.partner = a;
    const mx = (a.obj.x + b.obj.x) / 2, my = (a.obj.y + b.obj.y) / 2;
    const place = (o, dx) => { this.tweens.add({ targets: [o.obj, o.label], x: mx + dx, y: my, duration: 150 }); o.obj.setFillStyle(0x6cc4ff).disableInteractive(); };
    place(a, -R + 1); place(b, R - 1);
    this.add.text(mx, my - 22, 'O2', { ...VT, fontSize: '14px', color: '#6cc4ff' }).setOrigin(0.5).setDepth(12);
    this.o2++;
    this.cameras.main.flash(80, 200, 240, 255);
    if (this.o2 >= 2) this.time.delayedCall(300, () => this.win());
  }

  /** Keyboard 1-4: pop the right-hand O off molecule i and park it below. */
  popOff(i) {
    const m = this.mols[i];
    if (!m || m.split) return;
    const a = m.right, A = this.playArea, x = A.x + 40 + i * 70, y = A.y + A.h - 22;
    this.tweens.add({ targets: [a.obj, a.label], x, y, duration: 200 });
    this.detach(a);
  }

  /** Keyboard Space: join the two free O atoms that are closest together. */
  joinNearest() {
    const free = this.atoms.filter(a => a.kind === 'O' && a.free && !a.partner);
    if (free.length < 2) return;
    let best = null, bd = Infinity;
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const d = Phaser.Math.Distance.Between(free[i].obj.x, free[i].obj.y, free[j].obj.x, free[j].obj.y);
      if (d < bd) { bd = d; best = [free[i], free[j]]; }
    }
    if (best) { this.tweens.add({ targets: [best[1].obj, best[1].label], x: best[0].obj.x + R * 2, y: best[0].obj.y, duration: 150, onComplete: () => this.pair(best[0], best[1]) }); }
  }

  /** Draw the bonds every frame: double bonds between C and the O atoms still attached, and in each O2. */
  tick() {
    const g = this.g; g.clear();
    const bond = (a, b, color) => {
      const dx = b.obj.x - a.obj.x, dy = b.obj.y - a.obj.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len * 2.5, ny = dx / len * 2.5;
      g.lineStyle(2, color).lineBetween(a.obj.x + nx, a.obj.y + ny, b.obj.x + nx, b.obj.y + ny).lineBetween(a.obj.x - nx, a.obj.y - ny, b.obj.x - nx, b.obj.y - ny);
    };
    for (const m of this.mols) for (const o of [m.left, m.right]) if (!o.free) bond(m.c, o, 0xc6cdd1);
    for (const a of this.atoms) if (a.partner && a.obj.x < a.partner.obj.x) bond(a, a.partner, 0x6cc4ff);
  }
}
