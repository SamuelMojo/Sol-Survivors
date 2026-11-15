// Connection to the host server (multiplayer). Works offline too: then you just play solo.
//
// 👤 Owner: Game logic & backend.
//
//   net.send(type, data)        raw message to the server
//   net.event(type, data)       tell every other player something happened
//   net.eventTo(id, type, data) tell one player
//   net.on(type, fn)            listen for a server message (lobby, pos, ev, sync, ...)
//   await net.claim(key)        ask "can I take this?" -> true if you were first, false if someone
//                               else was, null if the network was too slow to answer (try again)
// The server side of all of this is game/server/index.js.
export const net = {
  socket: null,        // the Socket.IO connection (null when playing offline)
  connected: false,    // is the socket connected right now?
  id: null,            // my player id (the server gives it to us)
  leader: null,        // the crew leader's player id
  room: null,          // the 4-letter code of the game I'm in (null when playing solo)
  lobby: null,         // the latest lobby state (names, jobs, ready)
  startData: null,     // what the server sent when the game started (seed, players, story...)
  onStart: null,       // BootScene sets this to start the game when 'start' arrives

  /** More than one person connected? (Computer crewmates don't count.) */
  get multi() { return (this.startData?.players?.filter(p => p.connected !== false).length ?? 1) > 1; },
  /** Is this player id me? (Checks the live connection too, so a just-changed id still counts as me.) */
  isMe(id) { return !!id && (id === this.id || id === this.socket?.id); },
  /** Playing on my own without the server deciding things: the website version, or a ?job= quick test. */
  get solo() { return !this.socket || !!this.startData?.quick; },
  /** Am I the crew leader? True when offline or solo, so solo games run everything themselves. */
  get isLeader() { return this.solo || !this.leader || this.leader === this.id; },
  /** Send a message to the server (silently dropped if we're offline). */
  send(type, data) { this.socket?.connected && this.socket.emit(type, data); },
  /** Tell every other player that something happened (the server relays it). */
  event(type, data = {}) { this.send('ev', { type, ...data }); },
  /** Tell one player that something happened. */
  eventTo(to, type, data = {}) { this.send('evTo', { to, ev: { type, ...data } }); },
  /** Listen for a message from the server. */
  on(type, fn) { this.socket?.on(type, fn); },
  /** Stop listening (scenes do this when they close). */
  off(type, fn) { this.socket?.off(type, fn); },

  // This browser tab's secret, so the server can give us our astronaut back after a dropped connection
  token: (() => { try { let t = sessionStorage.getItem('sol-token'); if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('sol-token', t); } return t; } catch { return Math.random().toString(36).slice(2); } })(),
  hello: null,         // what we said when joining ({ name, look, token, create | room }), resent after a reconnection
  pending: new Map(),  // claims waiting for an answer: key -> resolve function
  recent: [],          // the last few events, for scenes that open a moment after an event arrived

  /**
   * Ask the server for something only one player can have (a crate, an item, the rover).
   * Resolves true (it's yours), false (someone beat you) or null (no answer in 4 s: try again).
   */
  claim(key) {
    if (this.solo) return Promise.resolve(true);             // nobody else playing (website version or quick test): it's yours
    // Connected to a server: ALWAYS ask it. (If the connection is blinking, wait for it to come back. Saying
    // "it's mine" without asking used to let two players take the same thing, and the crew never heard about it.)
    return new Promise(res => {
      const done = v => { clearTimeout(timer); this.socket.off('connect', ask); if (this.pending.get(key) === done) this.pending.delete(key); res(v); };
      const ask = () => { this.pending.set(key, done); this.socket.emit('claim', key, this.startData?.seed ?? null); };
      const timer = setTimeout(() => done(null), 4000);
      if (this.socket.connected) ask(); else this.socket.once('connect', ask);
    });
  },
  /** Give back something you claimed (e.g. getting out of the rover). */
  release(key) { this.send('release', key); },
};

/** Connect to the server that served this page, and keep net's fields up to date. */
export function connect() {
  if (typeof io !== 'function') return;          // socket.io script missing: play offline
  const socket = io();
  net.socket = socket;
  // Connection dropped and came back:
  //  - usually socket.io recovers it with the SAME id and nothing else needs doing (socket.recovered);
  //  - otherwise it's a brand-new connection the server doesn't know, so say hello again (same name and tab
  //    token): the server gives us our astronaut back and tells the crew our new id. Without this, the crew
  //    would stop seeing us (our messages would come from an unknown id) and nothing we grabbed would work.
  socket.on('connect', () => {
    if (socket.recovered && net.id !== socket.id && net.everConnected) net.id = socket.id;   // recovered: same id as the server has
    const again = net.everConnected;
    net.connected = true; net.everConnected = true;
    if (again && !socket.recovered && net.hello) socket.emit('hello', net.hello);
  });
  socket.on('disconnect', () => { net.connected = false; });
  // my id, and the code of my game. From now on a reconnection says hello to THIS room (not 'create' again), and
  // the address becomes ?room=CODE, so refreshing the page or sharing the link brings you back to the same game
  socket.on('you', d => {
    net.id = d.id; net.room = d.room;
    if (net.hello) net.hello = { name: net.hello.name, look: net.hello.look, token: net.hello.token, room: d.room };
    try { const u = new URL(location.href); u.searchParams.set('room', d.room); history.replaceState(null, '', u); } catch {}
  });
  socket.on('lobby', l => { net.lobby = l; net.leader = l.leader; });         // lobby changed
  socket.on('leader', id => { net.leader = id; });                            // leader left; someone else leads
  socket.on('start', d => {                                                   // the game starts
    if (net.inGame && d.rejoin && d.seed === net.startData?.seed) return;   // already playing this game: our reconnection was accepted
    if (net.inGame && d.seed !== net.startData?.seed) return location.reload();   // a NEW game started while we were away: join that one
    net.inGame = true; net.startData = d; net.onStart?.(d);
  });
  // Answers to claims: 'claimed' goes to everyone (the winner resolves true), 'denied' only to the loser
  socket.on('claimed', ({ key, by }) => { if (net.isMe(by) && net.pending.has(key)) { net.pending.get(key)(true); net.pending.delete(key); } });
  socket.on('denied', key => { if (net.pending.has(key)) { net.pending.get(key)(false); net.pending.delete(key); } });
  // Keep the last 60 events, so a scene that opens late can catch up (e.g. answers in the interview)
  socket.on('ev', e => { net.recent.push({ ...e, at: Date.now() }); if (net.recent.length > 60) net.recent.shift(); });
}

/**
 * Exit to main menu: leave this game (the crew is told you left) and reload the page without the game code,
 * which shows the lobby again. Works in solo games too (and in the web version, which has no server).
 */
export function exitToMenu() {
  try { net.socket?.emit('leave'); } catch {}
  const go = () => { location.href = location.pathname; };
  net.socket ? setTimeout(go, 200) : go();
}
