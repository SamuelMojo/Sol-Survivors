// The first screen: choose your name, look and job, then wait for the crew.
// Built in plain HTML (easier for typing names) and shown over the game canvas.
//
// 👤 Owner: Game logic & backend. (The job descriptions shown here come from story/jobs.js.)
// The page layout is in game/client/index.html and the styles in game/client/style.css.
import { JOBS, LOOKS } from '/game/rules/settings.js';
import { net } from './net.js';

const $ = id => document.getElementById(id);

/** Show the lobby (or skip it for quick tests: ?job=pilot, &story=1, &nobots) and wire up its buttons. */
export function showLobby() {
  const el = $('lobby');
  // Quick test: ?job=pilot skips the lobby and starts a solo game as that job
  const quick = new URLSearchParams(location.search).get('job');
  if (quick && JOBS[quick]) {
    const story = new URLSearchParams(location.search).has('story');
    const go = () => { net.id = net.socket?.id ?? 'me'; net.startData = { seed: Math.floor(Math.random() * 2 ** 31), players: [{ id: net.id, name: 'Tester', job: quick, look: 0, connected: true }], quick: true, story }; net.onStart?.(net.startData); };
    if (net.socket && !net.socket.connected) net.socket.once('connect', go); else go();
    return;
  }
  el.style.display = 'flex';
  let look = 0;
  const saved = (() => { try { return localStorage.getItem('sol-name'); } catch { return null; } })();
  $('lobby-name').value = saved || '';

  // No server (the web version): solo only, no codes. With a server: Create a game, or join with a code
  // (or arrive from a friend's link, ?room=ABCD, which fills the code in).
  const wanted = (new URLSearchParams(location.search).get('room') || '').trim().toUpperCase().slice(0, 4);
  if (!net.socket) {
    $('lobby-join').textContent = 'Web version: play solo with computer crewmates. Run the game with npm start for multiplayer.';
    $('lobby-join-btn').textContent = 'Play solo ▶'; $('lobby-code-row').style.display = 'none';
  } else {
    if (wanted) { $('lobby-code').value = wanted; $('lobby-msg').textContent = `You are joining game ${wanted}. Type your name, then press Join.`; }
    // The address friends can use: the Wi-Fi address on a home computer, or this website when it's online
    fetch('/api/join').then(r => r.json()).then(({ urls }) => { net.shareBase = urls[0] ?? location.origin; if (net.lobby) render(net.lobby); }).catch(() => { net.shareBase = location.origin; });
  }

  // Look picker
  const looks = $('lobby-looks');
  looks.innerHTML = '';
  LOOKS.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'look' + (i === look ? ' sel' : ''); b.title = l.name; b.style.background = l.visor;
    b.onclick = () => { look = i; [...looks.children].forEach(c => c.classList.remove('sel')); b.classList.add('sel'); net.send('look', look); };
    looks.appendChild(b);
  });

  /** Say hello to the server: create a new game, or join the game with this code. */
  const enter = code => {
    const name = $('lobby-name').value.trim() || 'Astronaut';
    try { localStorage.setItem('sol-name', name); } catch {}
    if (!net.socket) return offlineLobby(name, look);    // no server: choose a job, then a solo game
    $('lobby-msg').textContent = '';
    net.hello = code ? { name, look, token: net.token, room: code } : { name, look, token: net.token, create: true };
    net.send('hello', net.hello);
    $('lobby-step1').style.display = 'none'; $('lobby-step2').style.display = 'block';
  };
  $('lobby-join-btn').onclick = () => enter(null);
  $('lobby-code-btn').onclick = () => {
    const code = $('lobby-code').value.trim().toUpperCase();
    if (code.length !== 4) return void ($('lobby-msg').textContent = 'A game code has 4 letters. Ask your friend for it.');
    enter(code);
  };
  $('lobby-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  $('lobby-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('lobby-code-btn').click(); });
  // Enter in the name box: join if a code is filled in (a friend's link), otherwise create a game
  $('lobby-name').addEventListener('keydown', e => { if (e.key === 'Enter') ($('lobby-code').value.length === 4 ? $('lobby-code-btn') : $('lobby-join-btn')).click(); });

  net.on('full', msg => { $('lobby-msg').textContent = msg; $('lobby-step1').style.display = 'block'; $('lobby-step2').style.display = 'none'; });
  net.on('lobby', render);
  net.on('start', () => { el.style.display = 'none'; });
  if (net.lobby) render(net.lobby);
}

/**
 * Redraw the lobby from the server's lobby state: job cards, crew list, Ready/Start buttons.
 * Only the crew leader (first to join, ⭐) sees the Start button and the story checkbox.
 */
function render(l) {
  if (l.started && !net.startData) { $('lobby-msg').textContent = 'A game is running. Use the same name you had to rejoin it.'; }
  const me = l.players.find(p => p.id === net.id);
  // Job cards
  const jobs = $('lobby-jobs'); jobs.innerHTML = '';
  for (const [key, j] of Object.entries(JOBS)) {
    const taker = l.players.find(p => p.job === key && p.connected);
    const b = document.createElement('button');
    b.className = 'job' + (me?.job === key ? ' sel' : '') + (taker && taker.id !== net.id ? ' taken' : '');
    b.style.borderColor = j.color;
    b.innerHTML = `<b style="color:${j.color}">${j.name}</b><br><small>${j.blurb}</small><br><i>${taker ? (taker.id === net.id ? 'You' : taker.name) : 'Computer crewmate'}</i>`;
    b.disabled = !!taker && taker.id !== net.id;
    b.onclick = () => net.send('pickJob', key);
    jobs.appendChild(b);
  }
  // The game code, and the link to share
  const link = `${net.shareBase ?? location.origin}/?room=${l.room}`;
  $('lobby-room').innerHTML = l.room ? `GAME CODE: <b>${l.room}</b><br><small>Friends join with the code, or this link: <span class="sel-all">${link}</span></small>` : '';
  // Crew list
  $('lobby-crew').innerHTML = l.players.filter(p => p.connected).map(p =>
    `<li><b>${escapeHtml(p.name)}</b>${p.id === l.leader ? ' (host)' : ''} ${p.job ? `<span style="color:${JOBS[p.job].color}">${JOBS[p.job].name}</span>` : '<i>choosing...</i>'} ${p.ready ? '✔ ready' : ''}</li>`).join('');
  const humans = l.players.filter(p => p.connected).length;
  const empty = 3 - l.players.filter(p => p.connected && p.job).length;
  $('lobby-mode').textContent = `${humans === 1 ? 'Solo' : humans === 2 ? 'Duo' : 'Trio'} game${empty > 0 ? `: ${empty} job(s) will be played by computer crewmates` : ''}.`;
  // Buttons
  const ready = $('lobby-ready'), start = $('lobby-start');
  ready.disabled = !me?.job; ready.textContent = me?.ready ? 'Not ready' : 'Ready!';
  ready.onclick = () => net.send('ready', !me?.ready);
  const allReady = l.players.filter(p => p.connected).every(p => p.job && p.ready);
  start.style.display = net.id === l.leader ? 'inline-block' : 'none';
  start.disabled = !allReady;
  start.onclick = () => net.send('start', { story: $('lobby-story').checked });
  $('lobby-story-wrap').style.display = net.id === l.leader ? 'block' : 'none';
  $('lobby-wait').textContent = net.id === l.leader ? (allReady ? 'Everyone is ready. Start when you like!' : 'Waiting for everyone to pick a job and press Ready.') : `Waiting for ${l.players.find(p => p.id === l.leader)?.name ?? 'the crew leader'} (the host) to start.`;
}

/**
 * No server (the web version, or socket.io missing): pick a job and whether to play the story, then start
 * a solo game. The two jobs you don't pick are played by computer crewmates.
 */
function offlineLobby(name, look) {
  let job = 'builder';
  $('lobby-step1').style.display = 'none'; $('lobby-step2').style.display = 'block';
  $('lobby-ready').style.display = 'none';                 // nobody else to wait for
  $('lobby-story-wrap').style.display = 'block';
  const draw = () => {
    const jobs = $('lobby-jobs'); jobs.innerHTML = '';
    for (const [key, j] of Object.entries(JOBS)) {
      const b = document.createElement('button');
      b.className = 'job' + (job === key ? ' sel' : '');
      b.style.borderColor = j.color;
      b.innerHTML = `<b style="color:${j.color}">${j.name}</b><br><small>${j.blurb}</small><br><i>${job === key ? 'You' : 'Computer crewmate'}</i>`;
      b.onclick = () => { job = key; draw(); };
      jobs.appendChild(b);
    }
    $('lobby-crew').innerHTML = `<li><b>${escapeHtml(name)}</b> <span style="color:${JOBS[job].color}">${JOBS[job].name}</span></li>`;
  };
  draw();
  $('lobby-mode').textContent = 'Solo game: the other 2 jobs will be played by computer crewmates.';
  $('lobby-wait').textContent = 'Pick your job, then start the mission.';
  const start = $('lobby-start');
  start.style.display = 'inline-block'; start.disabled = false;
  start.onclick = () => startOffline(name, look, job, $('lobby-story').checked);
}

/** Start a solo game with no server. */
function startOffline(name, look, job = 'builder', story = false) {
  const d = { seed: Math.floor(Math.random() * 2 ** 31), players: [{ id: 'me', name, job, look, connected: true }], offline: true, story };
  net.id = 'me'; net.startData = d;
  document.getElementById('lobby').style.display = 'none';
  net.onStart?.(d);
}

/** Make a player's name safe to put inside HTML (stops names like <b> breaking the page). */
const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
