# CLAUDE.md: start here

Guide for anyone (person or AI assistant) picking up **Sol Survivors**. Read this first, then `README.md` (how to play),
`PROGRESS_LOG.md` (what each phase did and why) and the README in each folder (`game/`, `levels/`, `story/`, `deploy/`).

## What it is

A co-op Mars survival game for kids aged **7–12**, made for the **NASA Space Apps Challenge 2026** (brief: let kids run
a Mars outpost and feel real trade-offs: life support, radiation, power, food, communication delay; ground it in
real NASA data). 1–3 players (Botanist, Builder, Pilot); computer crewmates (Nova, Bolt, Sky) play missing jobs.

- **Play online:** https://nasa.samuelojo.tech (AWS EC2 t4g.micro, see `deploy/AWS_DEPLOY.md`)
- **Flow:** Lobby (Create / Join with a 4-letter code) → [story on] opening crawl → launch interview → voyage aboard
  *Perseverance VI* → crash → **Mars** (fix MOXIE in 10 min, then generators, grow lights, laser comms, rocket) → launch home.
- **Lose:** MOXIE not fixed in time, or not home by the end of Sol 12 ("make it back before it's too late").
  Nobody dies: at 0 health you wake in the medbay.

## Run it

```bash
npm install           # Node 22+
npm start             # http://localhost:3000  (npm run dev = auto-restart on server/rules/levels/story edits)
```
- Quick solo test, skipping lobby + story: `http://localhost:3000/?job=pilot` (or botanist / builder).
  Add `&story=1` for the story (crawl first), `&nobots` for no computer crewmates.
- Live state in the browser console: `game.scene.getScene('World')` (e.g. `.survival.min = 21*60`).
- Solo static build (no server): `npm run build:web` → `dist/web` (delete the old `dist/web` first).

## Where things live (and who owns them)

| Change… | Edit | Notes |
|---|---|---|
| Any words players read | `story/*.js` | Short, plain sentences for 7–12-year-olds. Facts must be TRUE; label simplifications `GAME:` |
| Real NASA numbers | `story/nasa-data.js` | DONKI flares, Curiosity RAD dose, sol length, signal delay… |
| Balance numbers / rules | `game/rules/*.js` | Shared by server and browser. Comments mark REAL vs GAME values |
| Map, rooms, loot tables, art, sounds | `levels/` | Map in Tiled; rooms drawn as text; `levels/audio/sounds.js` lists sound names |
| Browser game | `game/client/js/` | Phaser 4 scenes + systems; HTML lobby and crawl on top of the canvas |
| Server | `game/server/index.js` | Express + Socket.IO; rooms with codes |

Every code file starts with a 👤 **Owner** line. Comments are written for beginners; keep that style.

## How it works (the parts you must not break)

1. **The server is a thin relay.** Each game is a *room* (4-letter code = Socket.IO room). It keeps players, leader,
   seed, claims; it relays `pos` / `ev` / `sync` / `snapshot` inside the room. It does not simulate the world.
2. **The leader's browser runs the world** (clock, computer crewmates, the night, snapshots). Others follow its
   `sync` every second. Leader = first player in the room; if they leave, the next one.
3. **Same seed = same world.** The server sends a random seed at Start; every browser builds the identical map,
   crates and parts from it with `makeRng(seed)` (`game/rules/rng.js`). **Never use `Math.random()` for anything that
   must be the same on every screen.**
4. **Claims stop double pick-ups:** picking up, opening a crate, taking the rover → `net.claim(key)`; the first to ask wins.
5. **New shared state** must be added to `WorldScene.syncState()` / `snapshot()` / `applySnapshot()` and/or a
   `Multiplayer` event, or rejoining players won't see it. Rejoiners ask for a snapshot once loaded (`wantSnapshot`).
6. **Screens:** open pop-ups with `world.openScreen(key, data)` (player stops; in solo the clock pauses because
   `uiOpen && !multi`). Close with `world.closeUI()`. Science facts: `world.showFact({ title, body, icon })`: a queued,
   full-screen `FactScene`, closed only by its **X** or Esc (by request: E/Space/clicks do not close it).
7. **Mini games** extend `scenes/MiniGame.js` (`MiniGameScene`): add the key to `MINIGAME_KEYS`, register the scene
   in `main.js`, put words in `story/minigames.js`, open with `openScreen`. Winning calls `d.onWin()` then shows the
   fact (`factOnce` = only the first win). Esc quits with nothing used up.
8. **To-do lists:** `game/rules/tasks.js` (when they tick) + `story/jobs.js` (words). Shown only in the menu (T),
   not on the HUD. T doesn't pause a crew game.
9. **Repair parts** are placed by rule (`game/rules/loot.js`): exactly what the 5 repairs need + 1 spare, one per spot,
   spread out; MOXIE's parts on the crash trail near the base. Seeds are scarce (min 2 of each crop). Loot tables
   (`levels/loot.js`) don't contain parts.
10. **Story scenes** (crawl, interview, voyage, crash): only the host can skip / advance, and it moves the whole crew.
11. **Canvas is 480×320**, scaled up (pixel art). Check new text at that size: nothing may overlap (see tests/menus.py).

## Testing (always run after a change)

```bash
pip install playwright && python3 -m playwright install chromium   # once
npm start                                                           # in another terminal (port 3000)
python3 tests/smoke.py        # and: stage1 stage3 stage4 wires safety stage5mp regression rooms bots menus botanist crawl
node tests/loot_seeds.mjs     # 2000 seeds: parts exact and always winnable
```
- Each test prints PASS/FAIL and `OK` at the end. `rooms.py` and `stage5mp.py` restart the server themselves.
- The harness (`tests/harness.py`) closes fact screens by itself unless `wait_world(facts=True)`, and has
  `skip_crawl()` for story tests. Env: `SOL_URL`, `SOL_CHROME`, `SOL_SHOTS`.
- Add a test for every new feature (see the existing ones for the pattern), and look at screenshots in `tests/shots/`.

## Deploying (the live site)

```bash
bash deploy/deploy.sh ec2-user@13.134.189.153 ~/.ssh/<your key>    # copies, npm ci, restarts; ends {"ok":true}
curl https://nasa.samuelojo.tech/healthz                            # open games and connections
```
- The server is **shared** with another project (an F1 telemetry site on `telemetry.samuelojo.tech`, Streamlit on 8501,
  a Python app on 8765). **Only touch** `/opt/sol-survivors`, the `sol-survivors` systemd service and
  `/etc/nginx/conf.d/nasa.conf`. Never edit `telemetry.conf` or certbot's other certificates.
- You need your own SSH key added to the server by the owner. No keys or secrets belong in this repo.
- Restarting ends games in progress. Limits: `MAX_ROOMS=40`, `MAX_CLIENTS=250` (service file).

## Current state and what's next

- Done: phases 0–10.17 (see `PROGRESS_LOG.md`): rooms + online hosting, 8 mini games, facts screen, crawl,
  scarce parts, Botanist update (pink greenhouse, toilet door, Frost Watch), bots aboard / asleep.
- **Biggest gap against the brief:** real *trade-offs*. Ideas, roughly in order of value:
  1. A **power budget**: the generators make less power than MOXIE + grow lights + comms + a storm shield want, and the
     crew chooses the split (less light = less food; no shield = more radiation).
  2. **Flare decisions** (power the shield vs. hide and lose time), and **rock samples** worth stars but costing air.
  3. A **NASA data panel** in the menu listing every dataset and source (DONKI flares, Curiosity RAD, MOXIE 2021,
     Veggie), clearly marked archived, not live. Optionally today's real space weather from DONKI via the server.
  4. A one-page dataset write-up for judges. Sounds: the slots exist (`levels/audio/sounds.js`), no files yet.
- Ask the owner before big design changes; small, tested steps; don't break solo, rooms, rejoin, the web build or
  the mini games.
