// The opening crawl ("THE YEAR IS 2041..."): yellow words sliding up and away into space, tilted back like the
// start of a space film. Plain HTML + CSS on top of the game canvas (like the lobby), so the browser does the 3D:
//   #crawl has `perspective`, its text block is tilted with rotateX(25deg), and a CSS animation slides it up.
// The words are in story/intro.js. Only the host (or a solo player) can skip it (Space, Enter, Esc or a click),
// and a skip ends it for the whole crew.
//
// 👤 Owner: Game logic & backend. Styles: game/client/style.css (#crawl).
import { INTRO } from '/story/intro.js';
import { net } from './net.js';
import { audio } from './systems/Audio.js';

/** Show the crawl, then call onDone (once) when it ends or is skipped. */
export function showCrawl(onDone) {
  const el = document.getElementById('crawl');
  if (!el) return onDone();
  const host = !net.socket || net.isLeader;
  // CAPITAL words (2 letters or more) stand out
  const words = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\b([A-Z][A-Z0-9-]+)\b/g, '<b>$1</b>');
  el.innerHTML = `<div class="crawl-fade"></div><div class="crawl-text"><div class="crawl-inner" style="animation-duration:${INTRO.seconds}s">
    <h2>${words(INTRO.title)}</h2>${INTRO.paragraphs.map(p => `<p>${words(p)}</p>`).join('')}</div></div>
    <div class="crawl-skip">${host ? INTRO.skip : INTRO.skipOther}</div>`;
  el.style.display = 'block';
  audio.music('intro');
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    el.style.display = 'none'; el.innerHTML = '';
    removeEventListener('keydown', onKey, true); el.removeEventListener('pointerdown', skip);
    net.off('ev', onEv); clearTimeout(safety);
    onDone();
  };
  const skip = () => { if (!host) return; net.event('crawlSkip'); end(); };
  const onKey = e => { if ([' ', 'Enter', 'Escape'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); skip(); } };
  const onEv = e => { if (e?.type === 'crawlSkip') end(); };      // the host skipped: everyone moves on
  addEventListener('keydown', onKey, true);
  el.addEventListener('pointerdown', skip);
  net.on('ev', onEv);
  el.querySelector('.crawl-inner').addEventListener('animationend', end);
  const safety = setTimeout(end, (INTRO.seconds + 3) * 1000);     // never get stuck on the crawl
}
