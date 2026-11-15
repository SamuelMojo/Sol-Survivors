# ⚙️ Game logic & backend

This folder is the engine room: the **host server**, the **browser game code** and the **game rules**. It reads the map, art and sounds from `levels/`, and all the story text and NASA numbers from `story/`.

```
game/
  server/index.js     the host (Node + Express + Socket.IO)
  client/             what the browser loads
    index.html        the page: lobby HTML + the game canvas
    style.css         lobby styles
    js/main.js        creates the Phaser game and lists every scene
    js/net.js         the connection to the server (send, events, claims)
    js/lobby.js       name / visor / job screen
    js/scenes/        one file per screen (see below)
    js/systems/       the parts the World scene is built from (see below)
  rules/              game rules and balance numbers, shared by browser and server
```

Run with `npm run dev` while working: it restarts the server when you change `game/server`, `game/rules`, `levels` or `story` files. Browser code just needs a reload.

## Quick-test URLs

| URL | What it does |
|---|---|
| `/?job=pilot` (or botanist / builder) | Skips the lobby and story; solo game as that job. **J** cycles jobs. |
| `/?job=pilot&story=1` | The same, but with the interview, voyage and crash |
| `/?job=pilot&nobots` | No computer crewmates |

In the browser console, `game.scene.getScene('World')` gives you the live game state, e.g. `.survival.me.rad = 0` or `.equipment.get('rocket').progress = 5`.

## Scenes (`client/js/scenes/`)

| Scene | When | Notes |
|---|---|---|
| `BootScene` | first | Loads art and map, builds visor colours, waits for the start |
| `InterviewScene` | story 1 | Launch-day interview; only the leader advances |
| `VoyageScene` | story 2 | Aboard the Perseverance VI; opens `WiresScene` (Builder) and `DodgeScene` (Pilot) |
| `CrashScene` | story 3 | Cutscene; only the leader skips |
| `WorldScene` | Mars | **The main scene.** Owns the game state and runs everything outdoors |
| `HudScene` | over World | Clock, warnings, NEXT task, the 3 bars, TO-DO/MENU buttons, hotbar + item key hint, machines panel (B), compass, messages |
| `PauseScene` | Esc / P | Tabs: Buttons, To-do, Machines, Crew (health), Settings (name, sound). Exit to main menu (with "are you sure?"). The host's menu pauses everyone (looking at the to-do list with T doesn't) |
| `FactScene` | `world.showFact({ title, body, icon })` | A real-science fact on its own full screen, closed only by its X (or Esc). Facts wait in a queue and never cover another screen. Used for places, buildings, crops, machines, items (backpack F) and every mini game's win |
| `InteriorScene` | inside buildings | Draws rooms from `levels/rooms.js`; furniture actions |
| `InventoryScene`, `MenuScene` | pop-ups | Backpack/chest, and every menu |
| `NightScene` | sleeping | Waits for the crew, then the leader runs the night |
| `EndScene` | the end | Win (stars) or lose (lesson) |

## Systems (`client/js/systems/`)

| System | Does |
|---|---|
| `Survival` | The clock, my 3 bars (food, air, health), the 10-minute MOXIE timer, crops growing, flares, storms, the night |
| `Minimap` | The explore-to-uncover map in the HUD (replaces the compass) |
| `Equipment` | The 5 machines: broken/fixed, power, rocket progress |
| `Loot` | Crates and item piles; picking up through claims |
| `Rover` | The Pilot's rover |
| `Multiplayer` | Other players' figures; applies shared-world events |
| `Bots` + `Pathfinder` | Computer crewmates (run on the leader's computer), A* walking |
| `Audio` | Plays the music/sounds listed in `levels/audio/sounds.js` |

## Rules (`rules/`)

| File | Holds |
|---|---|
| `settings.js` | Map size, screen size, speeds, job colours, visor colours, port |
| `survival.js` | Time, suit air, hunger, radiation (REAL numbers come from `story/nasa-data.js`), air tanks, launch window |
| `equipment.js` | Each machine's parts, repair time, power (words from `story/machines.js`) |
| `items.js` | Each item's icon, stack size and kind (words from `story/items.js`) |
| `inventory.js` | Bag/chest stacking logic |
| `farm.js` | Crops: nights to grow, yield |
| `crafting.js` | Workbench recipes |
| `jobs.js` | Who can do what |
| `tasks.js` | When each to-do ticks off (words from `story/jobs.js`) |
| `loot.js` | Rolls loot spots (tables from `levels/loot.js`) and guarantees enough parts |
| `rng.js` | Seeded random numbers, so every player gets the same world |

**How words get in:** rules files import the story text and merge it in (e.g. `ITEMS.medkit` = numbers from `rules/items.js` + words from `story/items.js`), so game code just reads `ITEMS[id].name`.

**Paths:** the server serves `game/client` at `/`, and `game/rules`, `levels` and `story` at `/game/rules`, `/levels` and `/story`. Files import each other with the same paths in Node and in the browser.

## How multiplayer works (short version)

- The **server** runs the lobby, hands out **claims** ("who got this crate/item/the rover first") and **relays** messages. It doesn't simulate the game.
- Every browser builds the **same world** from the game's seed.
- The **crew leader** (first to join) runs the shared clock, base air and the computer crewmates, and sends a `sync` every second.
- Changes to the shared world (crates, drops, chest, machines, crops) are sent as **events** (`net.event`) and applied in `Multiplayer.onEvent`.
- Rejoining with the same name gets a **snapshot** from the leader.

The full explanation is in the *Sol Survivors: How the System Works* doc.

## Things the other two will ask you for

- A new building, furniture type, map object type, or moving machine repair spots (`WorldScene.create`)
- A new picture's `this.load` line (`BootScene.preload`)
- A sound for a new moment (`audio.sfx('name')` where it should play)
- New story moments, items, machines, endings or to-do checks
- In-game messages that are still written in code (toasts, menu labels)
- Rebalancing after a NASA number changes
