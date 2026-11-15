// Pause for the story scenes (launch day, the spaceship, the crash), using the same menu as on Mars
// (PauseScene, in 'story' mode). Esc or P: the HOST pauses the story for everyone; Esc or P again carries on.
// Anyone else's screen just flashes: only the host can pause.
//
// 👤 Owner: Game logic & backend.
import { net } from '../net.js';

// The story scenes that stop while paused
const STORY = ['Interview', 'Voyage', 'Wires', 'Dodge', 'Crash'];

/**
 * Give a story scene the Esc / P pause keys, and listen for the host pausing. Call once in the scene's create().
 */
export function addStoryPause(scene) {
  const toggle = key => {
    const sm = scene.game.scene;
    if (performance.now() - (scene.game.resumedAt ?? 0) < 250) return;      // the key press that just closed the pause
    if (key === 'ESC' && (sm.isActive('Wires') || sm.isActive('Dodge'))) return;   // there Esc leaves the station (P still pauses)
    if (!net.isLeader) return scene.cameras.main.flash(80, 60, 40, 50);     // only the host can pause
    setPaused(scene.game, true, true);
  };
  for (const k of ['ESC', 'P']) scene.input.keyboard.addKey(k).on('down', () => toggle(k));
  const onEv = e => { if (e.type === 'storyPause') setPaused(scene.game, e.on, false); };
  net.on('ev', onEv);
  scene.events.once('shutdown', () => net.off('ev', onEv));
}

/** Pause or carry on with every running story scene. broadcast: the host tells the others. */
export function setPaused(game, on, broadcast) {
  const sm = game.scene;
  if (broadcast) net.event('storyPause', { on });
  if (on) {
    if (sm.isActive('Pause')) return;
    for (const k of STORY) if (sm.isActive(k)) sm.pause(k);
    sm.run('Pause', { story: true });
  } else {
    game.resumedAt = performance.now();
    for (const k of STORY) if (sm.isPaused(k)) sm.resume(k);
    sm.stop('Pause');
  }
}
