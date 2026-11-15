// Sol Survivors host server
//   npm start   -> serves the game and runs the multiplayer lobby on this computer
//
// 👤 Owner: Game logic & backend.
//
// How multiplayer works:
//   - Many games ("rooms") can run at once. Someone presses Create a game and gets a 4-letter code; friends
//     type the code (or open the link ?room=CODE) to join. Each room has its own lobby, leader, seed and claims.
//   - The server runs the lobby (names, jobs, ready) and decides "who got it first" (claims)
//     for things only one player can take: a crate, an item on the ground, a shelf, the rover.
//   - The first player to join is the crew leader. The leader's browser keeps the shared clock
//     and base supplies and sends them to everyone. If the leader leaves, the next player takes over.
//   - Everything else (repairs, planting, the chest...) is sent to the other players as events.
import express from 'express';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, parse } from 'node:path';
import { readdirSync } from 'node:fs';
import { Server } from 'socket.io';
import { NET, JOBS } from '../rules/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');   // the project folder
const app = express();
app.set('trust proxy', 'loopback');                                  // nginx on the same machine passes on the real address
const http = createServer(app);
// connectionStateRecovery: if a player's connection drops for a moment (Wi-Fi blip, Cloudflare tunnel hiccup),
// socket.io reconnects them with the SAME id and replays the messages they missed, so nobody 'disappears'.
const io = new Server(http, { connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: true } });

// Game files
// Each team folder is served at its own address, so files can import each other with the same
// paths in Node and in the browser (e.g. /game/rules/items.js imports /story/items.js).
app.use(express.static(join(root, 'game/client')));                  // index.html, style.css, js/
app.use('/game/rules', express.static(join(root, 'game/rules')));    // shared game rules
app.use('/levels', express.static(join(root, 'levels')));            // map, rooms, art, music, sounds
app.use('/story', express.static(join(root, 'story')));              // story text and NASA data
// Libraries served from node_modules, so the game works on a LAN with no internet
app.use('/lib/phaser', express.static(join(root, 'node_modules/phaser/dist')));
app.use('/fonts/press-start-2p', express.static(join(root, 'node_modules/@fontsource/press-start-2p/files')));
app.use('/fonts/vt323', express.static(join(root, 'node_modules/@fontsource/vt323/files')));

/** This computer's Wi-Fi / network addresses, so other players know where to connect. */
function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces()))
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}
const port = Number(process.env.PORT) || NET.port;
const PRODUCTION = process.env.NODE_ENV === 'production';       // on the AWS server: sits behind nginx, no LAN addresses
const HOST = process.env.HOST || (PRODUCTION ? '127.0.0.1' : '0.0.0.0');

// Join info for the lobby screen: the address other players type in
app.get('/api/join', async (_req, res) => {
  const urls = PRODUCTION ? [] : lanAddresses().map(ip => `http://${ip}:${port}`);   // (no private addresses on the public server)
  res.json({ urls });
});
// Used by the AWS load balancer, uptime checks and deploy.sh
app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size, clients: io.engine.clientsCount }));

// Which music and sound files exist (see levels/audio/sounds.js). Answers { "sfx/pickup": "sfx/pickup.mp3", ... }
// so the game only loads files that are really there, whatever their extension.
const AUDIO_TYPES = ['.mp3', '.ogg', '.wav', '.m4a'];
app.get('/api/audio', (_req, res) => {
  const found = {};
  for (const dir of ['music', 'sfx']) {
    let names = [];
    try { names = readdirSync(join(root, 'levels/audio', dir)); } catch {}
    for (const f of names) {
      const { name, ext } = parse(f);
      if (AUDIO_TYPES.includes(ext.toLowerCase())) found[`${dir}/${name}`] ??= `${dir}/${f}`;
    }
  }
  res.json(found);
});

// ---------------- game state kept by the server ----------------
// One Room per game. A room's code is also the name of its Socket.IO room, so a message to the room
// reaches only that game's players.
const MAX_PLAYERS = 3;
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 40;        // keeps a small server (t4g.micro) safe
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS) || 250;   // open connections in total
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';              // no I or O: they look like 1 and 0
const rooms = new Map();                                      // code -> room

/** Make a new empty room with a fresh 4-letter code. */
function makeRoom() {
  let code;
  do code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
  while (rooms.has(code));
  const room = {
    code,
    players: new Map(),     // socket id -> { id, name, job, look, ready, connected, asleep }
    leader: null,           // the crew leader's socket id (the first to join)
    started: false,         // is a game running?
    seed: null,             // the random seed for this game (every player builds the same world from it)
    story: true,            // play the interview + voyage before Mars?
    claims: new Map(),      // "crate:12" -> socket id
  };
  rooms.set(code, room);
  return room;
}
/** Players who are connected right now. */
const humans = R => [...R.players.values()].filter(p => p.connected);
/** What every lobby screen needs to show. */
const lobbyState = R => ({
  started: R.started, leader: R.leader, room: R.code,
  players: [...R.players.values()].map(({ id, name, job, look, ready, connected }) => ({ id, name, job, look, ready, connected })),
});
/** Send the lobby to everyone in the room. */
const sendLobby = R => io.to(R.code).emit('lobby', lobbyState(R));
/**
 * Choose the leader (the HOST) of a room. On a home computer, the person running the game on that computer is
 * always the host while they're connected. Otherwise the first player keeps it; if they leave, the next one.
 */
function pickLeader(R) {
  const h = humans(R), local = h.find(p => p.local);
  const want = local?.id ?? (h.find(p => p.id === R.leader) ? R.leader : h[0]?.id ?? null);
  if (want !== R.leader) { R.leader = want; if (R.leader) io.to(R.code).emit('leader', R.leader); }
}
/**
 * Is this browser on the computer that runs the server? (Opened at localhost, not through a
 * Cloudflare tunnel, nginx or another computer.) Proxies add 'cf-connecting-ip' / 'x-forwarded-for' headers.
 */
function isLocal(socket) {
  const h = socket.handshake.headers, a = socket.handshake.address ?? '';
  return !h['cf-connecting-ip'] && !h['x-forwarded-for'] && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(a);
}
/** Back to the lobby: forget the seed and all claims, and everyone has to press Ready again. */
function resetGame(R) { R.started = false; R.seed = null; R.claims.clear(); for (const p of R.players.values()) p.ready = false; }
/** Close a room (everyone has gone). */
function closeRoom(R) { clearTimeout(R.emptyTimer); for (const p of R.players.values()) clearTimeout(p.leftTimer); rooms.delete(R.code); console.log(`  x room ${R.code} closed (${rooms.size} open)`); }

// Too many connections in total? Turn new ones away politely.
io.use((_socket, next) => (io.engine.clientsCount > MAX_CLIENTS ? next(new Error('The server is full. Try again in a few minutes.')) : next()));

// Every browser that opens the game gets its own socket. Each socket.on(...) below is one kind of message.
io.on('connection', socket => {
  const id = socket.id;
  /** The room this socket is in (or undefined before it has said hello). */
  const room = () => rooms.get(socket.data.code);
  // A dropped connection that came back with its old id (see connectionStateRecovery above): just mark them online
  if (socket.recovered && room()?.players.has(id)) {
    const R = room(), me = R.players.get(id);
    me.connected = true; clearTimeout(me.leftTimer); clearTimeout(R.emptyTimer);
    pickLeader(R); sendLobby(R);
    console.log(`  ~ ${me.name} reconnected (room ${R.code})`);
  }

  // ---- lobby ----
  // hello: { name, look, token, create: true } makes a new room; { ..., room: 'ABCD' } joins one.
  socket.on('hello', ({ name, look, token, create, room: wanted } = {}) => {
    name = String(name || 'Astronaut').slice(0, 15);
    let R;
    if (create) {
      if (rooms.size >= MAX_ROOMS) return socket.emit('full', 'The server is busy right now. Try again in a few minutes.');
      R = makeRoom(); console.log(`  + room ${R.code} created (${rooms.size} open)`);
    } else {
      R = rooms.get(String(wanted ?? '').trim().toUpperCase());
      if (!R) return socket.emit('full', 'There is no game with that code. Check the letters, or ask your friend for a new link.');
    }
    // Moving from another room (e.g. a second hello): leave the old one first
    if (socket.data.code && socket.data.code !== R.code) { socket.leave(socket.data.code); }
    // Rejoining a game in progress takes back your astronaut: either the same browser tab coming back after a
    // dropped connection (its secret 'token' matches, even if the server hasn't noticed the old connection die
    // yet), or anyone typing the same name as a player who is offline.
    const byToken = token && [...R.players.values()].find(p => p.token === token && p.id !== id);
    const old = byToken ?? [...R.players.values()].find(p => !p.connected && p.name.toLowerCase() === name.toLowerCase());
    if (byToken && byToken.connected) io.sockets.sockets.get(byToken.id)?.disconnect(true);   // close the dead old connection
    if (R.started && !old) return socket.emit('full', 'That game has already started. To rejoin, use the same name you had before.');
    if (!R.started && !old && humans(R).length >= MAX_PLAYERS) return socket.emit('full', `That game is full (${MAX_PLAYERS} players).`);
    // Two people in the same room can't share a name
    if (!old && [...R.players.values()].some(p => p.connected && p.name.toLowerCase() === name.toLowerCase())) name = `${name.slice(0, 12)}${2 + R.players.size}`;
    clearTimeout(R.emptyTimer);
    socket.data.code = R.code; socket.join(R.code);
    if (old) {
      for (const [k, v] of R.claims) if (v === old.id) R.claims.set(k, id);     // things they owned are still theirs
      clearTimeout(old.leftTimer);
      R.players.delete(old.id); Object.assign(old, { id, connected: true, local: isLocal(socket), token: token ?? old.token }); R.players.set(id, old);
    }
    else R.players.set(id, { id, name, job: null, look: look ?? 0, ready: false, connected: true, local: isLocal(socket), token });
    pickLeader(R);
    socket.emit('you', { id, room: R.code });
    sendLobby(R);
    if (R.started) {             // rejoin: ask the leader for the current world
      socket.emit('start', { seed: R.seed, players: lobbyState(R).players, rejoin: true });
      io.to(R.leader).emit('needSnapshot', id);
    }
    console.log(`  + ${name} joined room ${R.code} (${humans(R).length} online)`);
  });
  // Choosing a job (each job can only be taken once), a visor colour, and Ready
  socket.on('pickJob', job => {
    const R = room(), me = R?.players.get(id);
    if (!me || R.started || !JOBS[job]) return;
    if ([...R.players.values()].some(p => p.id !== id && p.connected && p.job === job)) return;   // each job only once
    me.job = job; me.ready = false; sendLobby(R);
  });
  // Change your name (menu > SETTINGS). Names must be different from everyone else's.
  socket.on('rename', name => {
    const R = room(), me = R?.players.get(id);
    name = String(name || '').trim().slice(0, 15);
    if (!me || !name) return;
    if ([...R.players.values()].some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) return socket.emit('renameFailed', 'Someone already has that name.');
    me.name = name; io.to(R.code).emit('renamed', { id, name }); sendLobby(R);
  });
  socket.on('look', look => { const R = room(), me = R?.players.get(id); if (me) { me.look = look; sendLobby(R); } });
  socket.on('ready', r => { const R = room(), me = R?.players.get(id); if (me?.job && !R.started) { me.ready = !!r; sendLobby(R); } });
  // The leader presses Start: everyone must have a job and be ready. Disconnected players are dropped.
  socket.on('start', (opts = {}) => {
    const R = room();
    if (!R || id !== R.leader || R.started) return;
    R.story = opts.story !== false;
    const h = humans(R);
    if (!h.length || h.some(p => !p.job || !p.ready)) return;
    R.started = true; R.seed = Math.floor(Math.random() * 2 ** 31); R.claims.clear();
    for (const p of [...R.players.values()]) if (!p.connected) R.players.delete(p.id);
    io.to(R.code).emit('start', { seed: R.seed, players: lobbyState(R).players, story: R.story });
    sendLobby(R);
    console.log(`  * Game started in room ${R.code}: ${h.map(p => `${p.name} (${p.job})`).join(', ')}`);
  });

  // ---- in game ----
  // The server mostly passes messages on: positions (pos), world events (ev), messages to one player (evTo),
  // the leader's clock (sync) and snapshots for rejoining players. It doesn't run the game itself.
  // Everything stays inside the sender's room. Positions: most can be dropped if the network is busy
  // ('volatile'); the once-a-second 'key' ones never are.
  socket.on('pos', d => { const R = room(); if (R && d) (d.key ? socket.to(R.code) : socket.to(R.code).volatile).emit('pos', { id, ...d }); });
  socket.on('ev', ev => { const R = room(); if (R?.players.has(id) && ev) socket.to(R.code).emit('ev', { from: id, ...ev }); });   // only from players in the game
  socket.on('evTo', ({ to, ev } = {}) => { const R = room(); if (R?.players.has(to)) io.to(to).emit('ev', { from: id, ...ev }); });   // only to someone in the same room
  socket.on('sync', d => { const R = room(); if (R && id === R.leader) socket.to(R.code).volatile.emit('sync', d); });
  socket.on('snapshot', ({ to, snap } = {}) => { const R = room(); if (R && id === R.leader && R.players.has(to)) io.to(to).emit('snapshot', snap); });
  // Claims: the first player to ask for something gets it; everyone is told who.
  socket.on('claim', (key, seed) => {
    // Only players in this game can claim things. (A connection that hasn't said hello yet gets no answer: it will
    // ask again. A tab still playing an older game is told no, so it can't hold this game's crates.)
    const R = room();
    if (!R?.players.has(id) || typeof key !== 'string') return;
    if (R.started && seed != null && seed !== R.seed) return socket.emit('denied', key);
    // Already yours (your first answer was slow and you asked again)? Then yes, it's still yours.
    if (R.claims.has(key)) return R.claims.get(key) === id ? socket.emit('claimed', { key, by: id }) : socket.emit('denied', key);
    R.claims.set(key, id); io.to(R.code).emit('claimed', { key, by: id });
  });
  socket.on('release', key => { const R = room(); if (R?.claims.get(key) === id) { R.claims.delete(key); io.to(R.code).emit('released', key); } });

  // ---- night: when everyone is asleep in a bunk, the leader runs the night ----
  socket.on('asleep', a => {
    const R = room(), me = R?.players.get(id); if (!me) return;
    me.asleep = !!a;
    const h = humans(R); io.to(R.code).emit('sleepers', { asleep: h.filter(p => p.asleep).length, total: h.length });
    if (h.length && h.every(p => p.asleep)) {
      for (const p of h) p.asleep = false;
      io.to(R.leader).emit('runNight');
    }
  });

  // A rejoining player's world is ready: ask the leader for the current world again (the first one may have arrived too early)
  socket.on('wantSnapshot', () => { const R = room(); if (R?.started && R.players.has(id) && R.leader && R.leader !== id) io.to(R.leader).emit('needSnapshot', id); });

  // Exit to main menu: this player is leaving on purpose (the crew is told straight away, not after 4 s)
  socket.on('leave', () => { socket.data.leaving = true; socket.disconnect(true); });

  // The game ended (the leader tells us): back to the lobby
  socket.on('gameOver', () => { const R = room(); if (R && id === R.leader) { resetGame(R); sendLobby(R); } });

  // A player left: during a game they stay in the list (so they can rejoin with the same name);
  // the rover is freed if they were driving, and a new leader is picked if needed.
  socket.on('disconnect', () => {
    const R = room(), me = R?.players.get(id);
    if (!me) return;
    for (const [k, v] of R.claims) if (v === id && (k === 'rover')) { R.claims.delete(k); io.to(R.code).emit('released', k); }
    if (R.started) {
      // Mark them offline straight away, but only tell the crew if they haven't come back within 4 s (blips are common)
      me.connected = false; me.asleep = false;
      const quit = !!socket.data.leaving;
      me.leftTimer = setTimeout(() => { if (!me.connected) io.to(R.code).emit('left', { id: me.id, name: me.name, quit }); }, quit ? 0 : 4000);
    }
    else R.players.delete(id);
    pickLeader(R);
    // Everyone gone? Wait a minute before closing the room, in case they're all just reconnecting (a page refresh)
    clearTimeout(R.emptyTimer);
    if (!humans(R).length) R.emptyTimer = setTimeout(() => { if (!humans(R).length) closeRoom(R); }, 60000);
    sendLobby(R);
    console.log(`  - ${me.name} left room ${R.code} (${humans(R).length} online)`);
  });
});

// Start listening and print the addresses to share
http.listen(port, HOST, () => {
  console.log('\n  ==========  SOL SURVIVORS HOST  ==========');
  if (PRODUCTION) console.log(`  Production mode: listening on ${HOST}:${port} (behind nginx). Up to ${MAX_ROOMS} games at once.`);
  else {
    console.log(`  On this computer:   http://localhost:${port}`);
    for (const ip of lanAddresses()) console.log(`  Same Wi-Fi players: http://${ip}:${port}`);
  }
  console.log('  Players press "Create a game" and share the 4-letter code. Up to 3 players per game.');
  console.log('  Missing jobs are played by computer crewmates. Press Ctrl+C to stop.\n');
});
