// Entry point: the browser runs this first (from game/client/index.html).
// It connects to the server, shows the lobby, and creates the Phaser game with all its scenes.
//
// 👤 Owner: Game logic & backend.
//
// Scene order: Boot (load art) -> Interview -> Voyage (+ Wires, Dodge) -> Crash -> World (+ Hud, Interior,
// Inventory, Menu, Night) -> End.  Without the story, Boot goes straight to World.
import { SCREEN } from '/game/rules/settings.js';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { HudScene } from './scenes/HudScene.js';
import { InventoryScene } from './scenes/InventoryScene.js';
import { InteriorScene } from './scenes/InteriorScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { NightScene } from './scenes/NightScene.js';
import { EndScene } from './scenes/EndScene.js';
import { InterviewScene } from './scenes/InterviewScene.js';
import { VoyageScene } from './scenes/VoyageScene.js';
import { WiresScene } from './scenes/WiresScene.js';
import { DodgeScene } from './scenes/DodgeScene.js';
import { CrashScene } from './scenes/CrashScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { FactScene } from './scenes/FactScene.js';
// Mini games ("game within a game"), all built on scenes/MiniGame.js
import { MoxieGame } from './scenes/MoxieGame.js';
import { AtomGame } from './scenes/AtomGame.js';
import { WeldGame } from './scenes/WeldGame.js';
import { LightGame } from './scenes/LightGame.js';
import { FrostGame } from './scenes/FrostGame.js';
import { UnstickGame } from './scenes/UnstickGame.js';
import { RockGame } from './scenes/RockGame.js';
import { EarthGame } from './scenes/EarthGame.js';
import { connect } from './net.js';
import { showLobby } from './lobby.js';
import { audio } from './systems/Audio.js';

connect();       // talk to the host server (game/server/index.js)
showLobby();     // name, look and job screen

// window.game is handy for debugging in the browser console
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN.width,      // the game is drawn at 480x320 and scaled up for the chunky pixel look
  height: SCREEN.height,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#160c11',
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Every scene must be listed here. The first one (Boot) starts automatically.
  scene: [BootScene, WorldScene, HudScene, InteriorScene, InventoryScene, MenuScene, NightScene, EndScene, InterviewScene, VoyageScene, WiresScene, DodgeScene, CrashScene, PauseScene, FactScene,
    MoxieGame, AtomGame, WeldGame, LightGame, FrostGame, UnstickGame, RockGame, EarthGame],
});
audio.init(window.game);
// If the window loses focus (another app, a pop-up), let go of every key, so nobody keeps running by themselves
const letGo = () => window.game.scene.getScenes(true).forEach(s => s.input?.keyboard?.resetKeys());
window.addEventListener('blur', letGo);
document.addEventListener('visibilitychange', letGo);   // music & sounds (levels/audio/sounds.js); M mutes
