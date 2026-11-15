// Loads fonts, art and the map, then starts the world.
//
// 👤 Owner: Game logic & backend. Art files are in levels/art (Level design): to add a new picture,
// put the PNG there and add a this.load line below. Sounds load automatically (systems/Audio.js).
import { showCrawl } from '../crawl.js';
import { JOBS, LOOKS } from '/game/rules/settings.js';
import { net } from '../net.js';
import { audio } from '../systems/Audio.js';

/** The first scene: shows a loading bar, loads every picture and the map, then waits for the game to start. */
export class BootScene extends Phaser.Scene {
  /** Register the scene under the name 'Boot'. */
  constructor() { super('Boot'); }

  /** Phaser calls this first: queue every file to load. The bar fills as files arrive. */
  preload() {
    const w = this.scale.width, h = this.scale.height;
    const bar = this.add.rectangle(w / 2 - 100, h / 2, 0, 8, 0xff8a3d).setOrigin(0, 0.5);
    this.add.rectangle(w / 2, h / 2, 204, 12).setStrokeStyle(2, 0xf3d9a4);
    this.load.on('progress', p => { bar.width = 200 * p; });

    // Map: the tile pictures and the Tiled map itself (levels/map/mars.json)
    this.load.image('tiles', '/levels/art/tiles.png');
    this.load.tilemapTiledJSON('mars', '/levels/map/mars.json');
    // Astronauts (one sheet per job: 3 frames x 4 directions), buildings (b-*), objects, machines (eq-*),
    // furniture (f-*) and the item icons (one 16x16 frame per item, numbered by `icon` in game/rules/items.js)
    for (const job of Object.keys(JOBS))
      this.load.spritesheet(`astro-${job}`, `/levels/art/astronaut-${job}.png`, { frameWidth: 16, frameHeight: 16 });
    for (const b of ['hab', 'greenhouse', 'workshop', 'garage', 'comms', 'rocket', 'wreck'])
      this.load.image(`b-${b}`, `/levels/art/b-${b}.png`);
    this.load.spritesheet('rover-sheet', '/levels/art/rover-sheet.png', { frameWidth: 32, frameHeight: 24 });   // 3 views x 2 wheel frames
    this.load.image('rocket-ship', '/levels/art/rocket-ship.png');   // launch day: the rocket without its pad
    this.load.image('crate', '/levels/art/crate.png');
    this.load.image('crate-open', '/levels/art/crate-open.png');
    this.load.image('chest', '/levels/art/chest.png');
    for (const e of ['generator', 'generator-broken', 'moxie']) this.load.image(`eq-${e}`, `/levels/art/eq-${e}.png`);
    this.load.image('interior', '/levels/art/interior.png');
    for (const f of ['bunk', 'medbed', 'table', 'planter', 'bench', 'radio', 'shelf', 'console', 'locker', 'wirepanel', 'seat', 'toilet', 'toiletdoor', 'lightpanel', 'microscope']) this.load.image(`f-${f}`, `/levels/art/f-${f}.png`);
    this.load.image('reporter', '/levels/art/reporter.png');
    this.load.spritesheet('items', '/levels/art/items.png', { frameWidth: 16, frameHeight: 16 });
    audio.preload(this);    // music & sound effects that exist in levels/audio
  }

  /** Phaser calls this once everything has loaded: build the astronaut colours, then start the game. */
  async create() {
    // Make sure the pixel fonts are ready before any text is drawn
    try { await Promise.all([document.fonts.load('8px "Press Start 2P"'), document.fonts.load('16px VT323')]); } catch {}

    // One astronaut sheet per job x visor colour ("look" chosen in the lobby)
    for (const job of Object.keys(JOBS)) for (let look = 0; look < LOOKS.length; look++) await this.makeSkin(job, look);

    // Wait for the lobby to start the game (or start straight away for quick tests: ?job=pilot)
    const d = net.startData;
    if (d) this.go(d); else net.onStart = data => this.go(data);
  }

  /** Copy a job's astronaut sheet, recolour the visor, and make walking animations for it. */
  async makeSkin(job, look) {
    const key = `astro-${job}-${look}`;
    const src = this.textures.get(`astro-${job}`).getSourceImage();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    if (look > 0) {
      const img = g.getImageData(0, 0, c.width, c.height), px = img.data;
      const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
      const [vFrom, sFrom] = [hex(LOOKS[0].visor), hex(LOOKS[0].shine)], [vTo, sTo] = [hex(LOOKS[look].visor), hex(LOOKS[look].shine)];
      for (let i = 0; i < px.length; i += 4) {
        const m = (a) => px[i] === a[0] && px[i + 1] === a[1] && px[i + 2] === a[2];
        if (m(vFrom)) [px[i], px[i + 1], px[i + 2]] = vTo; else if (m(sFrom)) [px[i], px[i + 1], px[i + 2]] = sTo;
      }
      g.putImageData(img, 0, 0);
    }
    const im = new Image();
    await new Promise(r => { im.onload = r; im.src = c.toDataURL(); });
    this.textures.addSpriteSheet(key, im, { frameWidth: 16, frameHeight: 16 });
    // Sheet rows: 0 down, 1 left, 2 right, 3 up. Frames: 0 stand, 1 & 2 steps.
    ['down', 'left', 'right', 'up'].forEach((dir, row) => {
      const f = n => ({ key, frame: row * 3 + n });
      this.anims.create({ key: `${key}-walk-${dir}`, frames: [f(1), f(0), f(2), f(0)], frameRate: 8, repeat: -1 });
      this.anims.create({ key: `${key}-idle-${dir}`, frames: [f(0)], frameRate: 1 });
    });
  }

  /** Start the game: the story (Interview) if the leader ticked it, otherwise straight to Mars (World). */
  go(d) {
    if (this.started) return;
    this.started = true;
    const me = d.players.find(p => p.id === net.id) ?? d.players[0];
    // With the story on, the opening crawl ("THE YEAR IS 2041...") comes first, then launch day
    if (d.story && !d.rejoin) showCrawl(() => this.scene.start('Interview', { ...d, me }));
    else this.scene.start('World', { ...d, me });
  }
}
