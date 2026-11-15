// Plays music and sound effects. Which file plays for what is decided in levels/audio/sounds.js.
//
// 👤 Owner: Game logic & backend. The sound files and the list are Level design, music & sounds.
//
// How it works:
//   1. BootScene asks the server which audio files exist (/api/audio) and loads only those.
//      Missing files are skipped, so the game works fine with no audio at all.
//   2. Game code calls audio.sfx('pickup') or audio.music('mars_day'). If that sound isn't
//      loaded, nothing happens.
//   3. Press M to mute or unmute (remembered in this browser).
import { MUSIC, SFX, VOLUME } from '/levels/audio/sounds.js';

// Game events (the same ones the to-do lists use) and the sound effect each one plays
export const EVENT_SOUNDS = {
  pickup: 'pickup', plant: 'plant', harvest: 'harvest', repair: 'repair', craft: 'repair', eat: 'eat',
  drive: 'rover', store: 'drop', radio: 'radio', launch: 'launch',
};

const key = (kind, name) => `${kind}-${name}`;      // Phaser cache key, e.g. "sfx-pickup"

export const audio = {
  game: null,          // the Phaser game (set in init)
  current: null,       // name of the music playing now
  track: null,         // the Phaser sound object for that music
  muted: false,

  /** Called once from main.js. Sets up the M key and remembers the mute setting. */
  init(game) {
    this.game = game;
    try { this.muted = localStorage.getItem('sol-muted') === '1'; } catch {}
    window.addEventListener('keydown', e => {
      if (e.key !== 'm' && e.key !== 'M') return;
      if (document.activeElement?.tagName === 'INPUT') return;       // typing a name in the lobby
      this.setMuted(!this.muted);
    });
  },

  /** Mute or unmute everything, and remember it in this browser. */
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('sol-muted', m ? '1' : '0'); } catch {}
    if (this.game) this.game.sound.mute = m;
  },

  /** Called from BootScene.preload: queue every audio file that exists on the server. */
  preload(scene) {
    scene.load.json('audio-files', '/api/audio');
    scene.load.once('filecomplete-json-audio-files', (_k, _t, files) => {
      // files maps a base name ("sfx/pickup") to the real file ("sfx/pickup.mp3")
      const queue = (kind, list) => {
        for (const [name, base] of Object.entries(list)) if (files[base]) scene.load.audio(key(kind, name), `/levels/audio/${files[base]}`);
      };
      queue('music', MUSIC); queue('sfx', SFX);
    });
  },

  /** True if this sound was found and loaded. */
  has(kind, name) { return !!this.game?.cache.audio.exists(key(kind, name)); },

  /** Play a sound effect once (does nothing if the file doesn't exist). */
  sfx(name) {
    if (!this.has('sfx', name)) return;
    this.game.sound.play(key('sfx', name), { volume: VOLUME.sfx });
  },

  /** Switch the background music (keeps playing if it's already this piece). */
  music(name) {
    if (this.current === name) return;
    this.track?.stop(); this.track?.destroy(); this.track = null;
    this.current = name;
    if (!this.has('music', name)) return;
    this.track = this.game.sound.add(key('music', name), { loop: true, volume: VOLUME.music });
    this.track.play();
  },
};
