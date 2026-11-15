# Sol Survivors: Progress Log

A record of what each phase of the build does, what changed, and how to test it.
Newest phase at the bottom. Update this file whenever a phase is finished.

**Project:** Sol Survivors, a co-op Mars survival game for kids aged 7–12
**Event:** 2026 NASA Space Apps Challenge
**Run it:** `npm install` (first time only), then `npm start`, then open http://localhost:3000

---

## Overview

| Phase | Name | Status |
|---|---|---|
| 0 | Single-player prototype | ✅ Done (kept in `prototype/`) |
| 1 | Foundation: big map, camera, compass | ✅ Done |
| 2 | Items, inventory, storage chest | ✅ Done |
| 3 | Job abilities: Botanist, Builder, Pilot | ✅ Done |
| 4 | Enterable buildings | ✅ Done |
| 5 | Survival + personal to-do lists | ✅ Done |
| 6 | Fuel, launch and endings | ✅ Done |
| 7 | LAN multiplayer: lobby, character and job select, 2–3 players | ✅ Done |
| 8 | Computer crewmates for solo and duo | ✅ Done |
| 9 | Scene Two: the voyage mini-games and the crash | ✅ Done |
| 10 | Scene One: launch-day interview | ✅ Done |
| 11 | Polish: art, sound, NASA data panel, online hosting for judges | ⏳ Next |

---

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Platform | Web browser + Node.js host (not Roblox) | LAN play with no internet, no accounts or installs for kids or judges |
| Multiplayer | One laptop runs the host; others join over the same Wi-Fi | Works in classrooms offline; the same server can go online for remote judges |
| Engine | Phaser 4 (2D), plain JavaScript, no build tools | Quick to learn, tilemaps and cameras built in |
| Maps | Tiled editor (`public/maps/mars.json`) | Team members can design levels without coding |
| Jobs | 🌱 Botanist, 🔧 Builder, 🚀 Pilot | Each job can do things the others can't, so the team must cooperate |
| Health at 0 | Knocked out and wake up in the medbay (no death) | Tense but suitable for ages 7–12 |
| Missing players | Computer crewmates (Nova, Bolt, Sky) play unpicked jobs | Solo and duo games still have a full, interdependent crew |
| Communication | Shout buttons and Give, no text chat | Safe for 7–12-year-olds and works for kids who can't type fast |
| Story | Launch interview → voyage → crash, which the crew leader can switch off | Builds attachment to the characters; quick games stay possible |
| Radiation hotspot | Wreckage of the ship's damaged nuclear power unit | Believable (real Mars rovers use sealed nuclear power) and teachable |
| Ship damage | A micrometeoroid strike (not the asteroid belt) | The Earth–Mars route doesn't cross the asteroid belt |
| Science | Every mechanic is tied to a real Mars challenge, with real NASA data where possible; game simplifications are labelled | The challenge is about teaching real trade-offs |

---

## Phase 0: Single-player prototype ✅

**What it is:** The first quick version, a one-screen game made in a single HTML file. It's kept in `prototype/single-player.html` as a reference.

- Alone on Mars after a fire on the ship; survive until the launch window
- Oxygen, food and power, with a nightly power plan where you can't run everything
- Solar flares modelled on real NASA DONKI events; dust storms; radio delay to Earth
- Real Curiosity rover radiation data

---

## Phase 1: Foundation ✅

**Goal:** A big Mars world you can walk around in, plus the host server everything else builds on.

**What's in it**
- **A 20-screen map** (5 × 4 screens, 150 × 80 tiles, about 600 m across) with seven areas:
  - Jezero Base (centre)
  - Crater Field
  - Delta Cliffs
  - Reactor Wreck
  - Dune Sea
  - Crash Trail
  - Southern Plains
- **Movement:** walk and run (Shift), with four-direction animation. The camera follows you.
- **Collisions:** rocks, cliffs, crash debris, reactor wreckage and buildings block you. You can walk behind tall things.
- **Compass** pointing home to the hab, with the distance in metres.
- **Sector label** (A1–E4), so players can say "meet me at B3".
- **Area banners:** a real Mars fact the first time you enter each area.
- **Radiation hazard warning** in the Reactor Wreck (visual only for now).
- **Host server:** prints the address for other players on the same Wi-Fi and shows "HOST CONNECTED".
- **Offline:** Phaser and the pixel fonts load from the project, not the internet.

**Main files:**
- `server/index.js`
- `shared/settings.js`
- `public/js/scenes/BootScene.js`, `WorldScene.js`, `HudScene.js`
- `tools/make-map.js`
- `public/maps/mars.json`

**Try it:** walk to the Crash Trail to find the lander, visit the Reactor Wreck, and follow the compass home.

---

## Phase 2: Items, inventory and storage ✅

**Goal:** Things to find, carry and share.

**What's in it**
- **Loot all over Mars:** about 40 crates and about 50 loose items, re-rolled every game.
  - The Crash Trail has supply crates.
  - Wild areas have seeds, snacks and scrap.
  - The Reactor Wreck has the best parts.
  - There are always at least 7 rocket parts.
- **Crates:** press **E** to open them; the items burst out.
- **Auto pick-up:** walk over items. If your bag is full, the item stays on the ground with a warning.
- **10-slot backpack** where the same items stack (seeds 20, rations 10, rocket parts 3, and so on).
- **Hotbar** along the bottom. Choose a slot with **1–0** or the mouse wheel.
- **Backpack screen (I):** item details plus a real-science fact for every item.
- **Dropping:** **Q** drops one and **Shift+Q** drops the stack, so teammates can share.
- **Crew storage chest** (30 slots) beside the hab door.
- **Items:**
  - 🌱 Seeds: potato, lettuce, tomato
  - 🥫 Food: space ration, snack pack
  - 🧰 Supplies: oxygen canister, fuel canister, medkit
  - ⚙️ Parts: pipe, wire, circuit board, solar cell, rocket part, scrap

**How it differs from Phase 1:** Phase 1 was a world to look at; crates were decoration. Phase 2 turns the world into something to explore for a reason. The inventory rules live in `shared/` so the multiplayer host can use them later.

**Main files:**
- `shared/items.js`, `shared/inventory.js`, `shared/loot.js`
- `public/js/systems/Loot.js`
- `public/js/scenes/InventoryScene.js`

**Try it:** open crates on the Crash Trail, fill your bag until it's full, and store things in the chest.

---

## Phase 3: Job abilities ✅

**Goal:** Each job can do things the others can't, so the crew has to work together. Items now have a use.

**What's in it**

**🌱 Botanist: the only one who can plant**
- Press **E** at the **greenhouse door** to open 6 planters.
- Plant lettuce, tomato or potato seeds with **1–3**.
- Crops grow over time, shown with a progress bar and sprouts that get taller.
- **Anyone** can harvest a ready crop (**Enter**). Harvests give food items: potato, lettuce, tomato.
- Some harvests give a seed back, which teaches sustainable farming.
- Growing is sped up as a GAME RULE (lettuce 1 min, tomato 1.5 min, potato 2 min). Real growing times are in the item facts.
- Real science shown: why crops can't grow outside on Mars (thin cold air, perchlorate salts in the soil).

**🔧 Builder: the only one who can repair equipment and clean the solar panels**
- Everything at the base starts broken after the crash. Broken things have a red **!** above them.

  | Equipment | Parts needed |
  |---|---|
  | Oxygen maker | 2 pipe + 1 circuit board |
  | Water recycler | 2 pipe + 1 wire |
  | Comms dish | 2 wire + 1 circuit board |
  | Solar panels (2 of 4 cracked) | 1 solar cell each |
  | Rover | 1 wire + 1 solar cell |
  | Ascent rocket | 5 rocket parts, installed one at a time |

- **Repairs take a few seconds.** A progress bar shows above the Builder, who can't move while working.
- **Dust settles on the solar panels over time.** Dusty panels make less power. The Builder brushes them clean (**E**).
- If parts are missing, the game lists exactly what's needed and how many you have.
- Each repair shows a real NASA fact: MOXIE oxygen, Space Station water recycling, Earth–Mars radio delay, the 2018 dust storm that ended Opportunity's mission.

**🚀 Pilot: the only one who can drive the rover**
- Once the Builder has repaired the rover, the Pilot presses **E** to get in.
- The rover is about **twice as fast as running**, and the compass and areas still work while driving.
- Press **E** again to get out. You can't pick things up while driving.
- Fuel comes in Phase 6, when it will share fuel with the rocket.

**Teamwork messages:** if the wrong job tries something, the game explains who can do it and how to help. For example: "Only the Builder can repair equipment. Bring the parts to your Builder!"

**Base status panel** (top right, **B** to hide or show): oxygen maker, water recycler, comms, solar panels with dust and power output, rover, and rocket parts.

**How it differs from Phase 2:** in Phase 2 you could collect items but not use them. Now seeds become food, parts repair the base, and rocket parts go into the rocket. Jobs make players depend on each other: the Builder fixes the rover so the Pilot can drive, and everyone brings seeds to the Botanist.

**Testing note:** until multiplayer (Phase 7) and computer crewmates (Phase 8) exist, press **J** to switch jobs and try all three yourself.

**New files:**
- `shared/jobs.js` (who can do what)
- `shared/equipment.js` (repairs and parts)
- `shared/farm.js` (crops and growing)
- `public/js/systems/Equipment.js`
- `public/js/systems/Rover.js`
- `public/js/scenes/GreenhouseScene.js`

**Updated:**
- `WorldScene.js` (timed actions, job checks, the rover)
- `HudScene.js` (base status panel)
- `shared/items.js` (3 crops)
- The map, which now has an oxygen maker, a water recycler and 4 solar panels

**Try it:**
1. As the **Botanist**, find seeds and plant them in the greenhouse.
2. Press **J** to switch to the **Builder**, gather pipes and a circuit board, and fix the oxygen maker. Clean a dusty solar panel.
3. Repair the rover (1 wire + 1 solar cell).
4. Switch to the **Pilot** and drive it out to the Dune Sea.

---

## Phase 4: Enterable buildings ✅

**Goal:** Walk inside the base's buildings, each with its own job.

**What's in it**
- **Enter and leave all six buildings.** Walk up to a door and press **E** ("Enter the Hab"). To leave, walk onto the yellow door mat or press **E** at the door. The screen fades between outside and inside.
- **The outside world keeps going while you're indoors:** crops grow, dust settles, and radio replies arrive.
- **Each room teaches one real fact** when you walk in.

| Building | What's inside | What you can do |
|---|---|---|
| 🏠 **Hab** | Crew storage chest, 2 bunks, medbay bed, kitchen table, suit locker | **The storage chest now lives here.** It's the crew's shared supply point. Bunks, medbay, kitchen and locker get their jobs in Phase 5 (sleep, healing, eating, suit oxygen) |
| 🌱 **Greenhouse** | 6 planter beds | Walk up to a bed and press **E** to plant (Botanist only). It uses the seed selected in your hotbar, or any seed you carry. Plants visibly grow, with a progress bar. Anyone can harvest |
| 🔧 **Workshop** | Workbench, spare parts shelf | **Builder only:** recycle 3 scrap into 1 pipe or 1 wire. The shelf has a one-time stash of 2 wire + 1 pipe |
| 📡 **Comms Tower** | Radio console | Once the dish outside is repaired, message Mission Control or home. **Replies take the real Earth–Mars signal delay** (4–22 minutes each way), sped up so 1 minute = 1 second |
| 🚙 **Garage** | Fuel tank, spare parts shelf | The shelf has a one-time stash of 1 solar cell + 1 wire. The fuel tank is empty until fuel arrives in Phase 6 |
| 🚀 **Ascent Rocket** | Flight console | Shows parts installed and fuel. Pilot-only launch controls arrive later |

**Teamwork:**
- **Anyone can collect items. Only the Builder can repair and use the workbench.**
- Collected parts get to the Builder by being **dropped** next to them or **stored in the hab's chest**.
- A direct **Give** action between players arrives with multiplayer (Phase 7).
- You can't drop items indoors; use the chest instead.

**Other changes:**
- The greenhouse is now a real room. The old pop-up planter screen is gone.
- The comms dish and rocket repair spots moved beside their doors, so the doors can be used for entering.
- New generic menu screen (`MenuScene.js`), used by the workbench, radio and rocket console.

**How it differs from Phase 3:** in Phase 3, buildings were just pictures and the greenhouse was a pop-up screen. Now the base is a real place you go inside, with a home (the hab), a farm, a workshop, a radio room, a garage and a cockpit, each for a different purpose.

**Designing rooms:** rooms are drawn as text in `shared/interiors.js`, so anyone can move furniture or reshape a room. See the README.

**New files:**
- `shared/interiors.js`, `shared/messages.js`
- `public/js/scenes/InteriorScene.js`, `MenuScene.js`
- Interior art: `public/assets/interior.png`, `f-*.png`

**Removed:** `GreenhouseScene.js`

**Try it:**
1. As the **Botanist**, carry seeds into the greenhouse, select them in the hotbar and plant at a bed.
2. Press **J** to become the **Builder**. Search the workshop shelf, then recycle scrap at the bench.
3. Fix the comms dish (2 wire + 1 circuit board), go into the comms tower and radio Earth. Watch how long the reply takes.
4. Store spare parts in the hab's chest.

---

## Phase 5: Survival and to-do lists ✅

**Goal:** Make staying alive on Mars the heart of the game, with real trade-offs: no choice is free. Give every job its own to-do list.

### The Mars clock
- Each sol runs from 06:00 to midnight in about **3.5 real minutes** (1 real second = 5 Mars minutes).
- The clock pauses while a menu is open.
- **The Sun rises at 07:00 and sets at 19:00.** Solar panels only charge the battery in daylight, and the screen darkens at night.
- **At 22:00 you get a warning.** At midnight you stumble back to the hab exhausted (-15 health) and the night starts.

### Your body (top left of the screen)

| Bar | What drains it | What refills it |
|---|---|---|
| ❤️ **Health** | Empty suit, starving, reactor radiation, freezing nights, no air or water in the base | Sleep (if fed): +20 · medbay rest: +30 · medkit (**F**): +45 |
| 🫁 **Suit O2** | Being outdoors. Lasts 6 Mars hours, **9 for the Pilot** (biggest tank) | Refills automatically indoors, using base oxygen · oxygen canister (**F**): +50% |
| 🍽️ **Food** | Slowly, all the time | Eat at the hab's **kitchen**, or press **F** with food selected. **Indoors only:** you can't eat in a spacesuit! |
| ☢️ **Dose** | Background space radiation (real Curiosity data: 0.67 mSv per sol), solar flares, the Reactor Wreck | Never goes down, like real radiation dose. Budget: 25 mSv |

### Knocked out (health 0)
- You wake up 2 hours later in the **medbay** with half health and a full suit.
- **Everything in your bag is left where you fell.** Go back and collect it!

### Base supplies (base status panel)
- **Base oxygen:** the crew breathes 15 a night, and refilling suits uses some too. The oxygen maker makes 22 a night when powered.
- **Water:** the crew uses 12 a sol. The water recycler wins 9 back when powered (real science: the Space Station recycles about 98% of its water).
- **Battery:** charged by the solar panels in daylight. **Broken or dusty panels charge far less.**

### 🌙 The night power plan (sleep in a hab bunk)
You can never power everything. That's the core trade-off.

| System | Cost | Effect |
|---|---|---|
| Life support & heaters | ⚡20 | Off: everyone wakes up freezing (-25 health) |
| Oxygen maker | ⚡20 | +22 base oxygen (must be repaired first) |
| Water recycler | ⚡10 | Saves 9 water (must be repaired first) |
| Greenhouse grow lights | ⚡15 | **Crops now grow one step per lit night:** lettuce 2, tomato 3, potato 4 |

After the plan comes a **morning report** showing what changed overnight, along with warnings (storm today, low oxygen, a flare forecast).

### ☢️ Hazards
- **Reactor Wreck:** health drains fast and dose climbs. It has the best loot, but you need to grab it and go.
- **Solar flares:** 3 per game, each modelled on a **real X-class flare from NASA's DONKI archive**.
  - **The alarm sounds 30 minutes before** the particles arrive. This is real: a flare's X-rays travel at light speed and the particles follow.
  - Outdoors you get the full dose (8.1 mSv, based on the biggest storm Curiosity measured on Mars). **Indoors you get a quarter.**
  - Red flashing and white specks on screen copy the "snow" on Curiosity's camera.
- **Dust storms:** 1–2 per game. Solar power drops to about 35%, panels get dusty fast, and walking is slower. This is inspired by the 2018 storm that ended Opportunity's mission.
- **Space weather forecast:** once the comms dish is fixed, ask Mission Control on the radio. The reply arrives after the real signal delay and reveals flares and storms for the next 3 sols.

### ✅ Personal to-do lists
- **Each job has its own list** of different tasks. The next two show on screen, and **T** shows the full list. Tasks tick off automatically.

| 🌱 Botanist | 🔧 Builder | 🚀 Pilot |
|---|---|---|
| Collect 3 seed packets | Repair the oxygen maker | Collect 2 oxygen canisters |
| Plant your first crop | Clean a dusty solar panel | Get a space weather forecast |
| Power the grow lights for a night | Fix both cracked solar panels | Visit all 7 areas |
| Harvest a crop | Repair the water recycler | Drive the rover |
| Grow all 3 kinds of crop | Recycle scrap at the workbench | Drive out to the Dune Sea |
| Store 6 food in the chest | Fix the comms dish | Store a rocket part in the chest |
| | Repair the rover | Get inside before a flare hits |
| | Install a rocket part | |

- Lists are easy to edit in `shared/tasks.js`.
- In single player, **J** switches jobs, and each job's list keeps its own progress.

**How it differs from Phase 4:** before this phase nothing could hurt you and time didn't pass. Now every choice has a cost:
- Exploring uses suit air.
- Loot in the Reactor Wreck costs health and dose.
- Running the oxygen maker means less power for crops.
- Skipping repairs means a weaker battery.

The base's broken equipment now really matters, and the to-do lists give each player a clear purpose.

**New files:**
- `shared/survival.js`, `shared/tasks.js`
- `public/js/systems/Survival.js`
- `public/js/scenes/NightScene.js`

**Changed:**
- `shared/farm.js`: crops grow by lit nights
- World, Interior and HUD scenes: kitchen, bunks, medbay, forecast, F to use items, T for the to-do list
- The hab's chest now starts with 4 emergency rations

**Try it:**
1. Head out and watch your suit air drop.
2. Run into the Reactor Wreck and back out again.
3. Fix the comms dish and ask for a forecast.
4. Hide in a building when the flare alarm sounds.
5. Plant something, then sleep and give the grow lights power.

---

## Phase 6: Fuel, launch and endings ✅

**Goal:** Add the last big trade-off (fuel) and give the game a real ending, so it can be played from start to finish.

### ⛽ One shared fuel tank
- **The rover and the rocket share the same fuel tank** (in the garage). Every drive burns fuel the crew needs to get home.
- **Rover:** burns 1 fuel per ~37 m driven, so crossing the whole map costs about 16. With an empty tank the rover won't move; get out and walk, or refuel it.
- **Fuel factory:** a new 5th system in the night power plan (⚡25). It makes +12 fuel per night and **uses 5 water**.
  - Real science: the Sabatier reaction turns carbon dioxide from the Mars air plus hydrogen (split from water) into methane fuel.
  - This creates a three-way trade-off: power, water and fuel.
- **Fuel canisters** (mostly in the Reactor Wreck): select one and press **F** next to the rover or inside the garage to pour +15 into the tank.
- **The garage's fuel tank** shows the level, and the base status panel shows fuel and the launch window.

### 🚀 Launch window and launch
- **The rescue ship passes overhead between Sol 8 and Sol 12** (a GAME rule).
  - Real science: Earth and Mars only line up for a trip about every 26 months.
- **To launch you need:**
  1. all 5 rocket parts installed
  2. at least 80 fuel in the tank
  3. a sol inside the window
  4. **the Pilot at the rocket's flight console**
- The morning report counts down to the window and how many sols are left.

### 🏁 Endings
- **Win:** a launch animation, then a star rating: ★ got home, ★ stayed under the 25 mSv radiation budget, ★ grew 2+ kinds of crop. You also see stats: dose, crops, equipment fixed, flares sheltered from, and your to-do list progress.
- **Lose:** missing the launch window ends the game with a "what real mission planners learn" lesson.
- **Play again** restarts with a new random game.

### Also new
- **Pilot to-do list:** "Pour a fuel canister into the shared tank".
- **Night plan:** fits 5 systems, and keys **1–5** toggle them.

**How it differs from Phase 5:** Phase 5 was about staying alive, with no way to win. Phase 6 adds the goal (get home) and the final trade-off: **every rover trip spends fuel the rocket needs**, and the fuel factory competes with life support and crops for power, and with the crew for water.

**New files:** `public/js/scenes/EndScene.js`

**Changed:**
- `shared/survival.js` (FUEL and LAUNCH settings, fuel factory)
- the Survival system (night fuel and window checks)
- World (rover fuel, fuel canisters, launch, endings)
- Interior (flight console launch, garage fuel tank)
- the HUD (fuel and window lines)

**Try it:**
1. As the Builder, fix the rover. Switch to the Pilot (**J**) and drive, watching the fuel drop.
2. Power the fuel factory overnight.
3. Fill the rocket and launch from the flight console during Sol 8–12.

---

## Phase 7: LAN multiplayer ✅

**Goal:** 1–3 players on the same Wi-Fi share one Mars, each with their own job.

### How to play together
1. One computer runs `npm start` (the **host**). The terminal prints addresses, for example `http://192.168.1.24:3000`.
2. Everyone opens that address in a browser on the same Wi-Fi. Tablets can **scan the QR code** on the lobby screen.
3. **Lobby:** type your name, pick a **helmet visor colour** (your character), then **choose a job**. Each job can only be taken once.
4. Everyone presses **Ready**. The **crew leader ⭐** (the first to join) presses **Start mission**.
5. With fewer than 3 players, the empty jobs are played by **computer crewmates** (Phase 8). The lobby shows "Solo", "Duo" or "Trio".

### What you see and do together
- **Other astronauts on the map:** suit colours by job, visor colours by choice, and name tags. They move smoothly, and you see them inside buildings too.
- **Arrows at the edge of the screen** point to crewmates who are off-screen, with their distance.
- **Crew panel** (left side): each crewmate's job, health and where they are (outside, in the Hab, driving...).
- **G = Give:** hand your selected item stack to the crewmate next to you. This is how parts reach the Builder.
- **R = Shout:** "Help!", "Get inside, flare coming!", "Over here!", "I found rocket parts!", "Bring me parts!". A speech bubble appears over your astronaut. It works without chat, which suits the 7–12 age group.
- **One shared world:**
  - crates and items: two players can never grab the same thing
  - repairs and solar panel dust
  - planters and the crew chest
  - spare parts shelves
  - the rover (one driver at a time)
  - forecasts, the clock and base supplies
- **Crew night:** everyone has to get into a hab bunk. Then **anyone can switch systems in the shared power plan**, and the night starts when every player presses **Ready**. At midnight, anyone still awake falls asleep anyway.
- **Launch:** the Pilot can only launch when **every player is inside the rocket**. Nobody gets left behind.
- **Rejoining:** if someone's browser closes, they rejoin with the **same name** and get their astronaut back in the current world. If the crew leader leaves, the next player takes over automatically.
- **The clock keeps running while menus are open** in multiplayer. In solo, menus still pause it.

### How it works (for the team)
- **Server (`server/index.js`):** runs the lobby and job choice, and settles "who got it first" claims for crates, items, shelves and the rover. It also passes events between players and handles rejoining and the night ready-checks.
- **Same world on every screen:** the server sends one random **seed** at the start. Loot, flares, dust storms and broken panels are generated from it (`shared/rng.js`), so every screen starts out identical.
- **Crew leader:** the leader's browser sends the clock, base supplies, equipment and planters to everyone each second, and runs the shared part of the night.
- **Events:** changes are sent as small messages (`crateOpened`, `drop`, `equip`, `planters`, `chest`, `give`, `shout`, `morning`, `launch`...) handled in `public/js/systems/Multiplayer.js`.

**How it differs from Phase 6:** the game was single-player with a job-switching shortcut (**J**). Now real players take the jobs, and the game's teamwork is real. The Builder needs the Pilot to bring parts back from the Reactor Wreck. The Botanist needs seeds from everyone. The crew has to agree each night's power plan. And you can only leave when everyone is aboard.

**New files:**
- `public/js/lobby.js`
- `public/js/systems/Multiplayer.js`
- `shared/rng.js`

**Changed:**
- the server (lobby, claims, night, rejoining)
- `net.js`
- Loot (item ids, claimed pick-ups)
- Equipment (shared state)
- Survival (leader-only shared parts, split night)
- World (give, shout, sync, snapshot, crew launch)
- Interior (crewmates indoors)
- Night (crew plan and Ready)
- HUD (crew panel, arrows)
- Boot (visor colours)

**New package:** `qrcode` (run `npm install`)

**Testing shortcut:** `http://localhost:3000/?job=pilot` skips the lobby and starts a solo test game as that job. **J** still switches jobs, but only in this test mode.

**Try it:** open two browser windows. Join as two different jobs, start, and try giving items (**G**), shouting (**R**), and going to sleep together.

---

## Phase 8: Computer crewmates ✅

**Goal:** Solo and duo games still have a full crew of three. The computer plays any job nobody picked.

### Meet the computer crew
| Crewmate | Job | What it does |
|---|---|---|
| 🤖 **Nova** | 🌱 Botanist | Plants seeds from the crew chest, harvests ready crops and puts the food in the chest, and gathers loose seeds and food around the base |
| 🤖 **Bolt** | 🔧 Builder | Repairs broken equipment with parts from the chest (or parts you **give** it), installs rocket parts, cleans the dustiest solar panel, and recycles scrap at the workshop when a repair is waiting on a pipe or wire |
| 🤖 **Sky** | 🚀 Pilot | Collects loose items and opens supply crates around the base, then brings everything back to the crew chest. **Flies the rocket** if no player is the Pilot |

**All of them:**
- **Drop everything and shelter in the hab when a flare alarm sounds.** They also go to the hab to sleep at night.
- **Avoid the Reactor Wreck.** That loot is left for brave humans.
- **Find their way around rocks and buildings** using A* pathfinding on the map grid.
- Show up on every player's screen with a 🤖 name tag, appear in the crew panel, and announce what they did ("🤖 Bolt repaired the Oxygen maker!").

### Working with them
- **The crew chest is how you work together.** Put parts in it and Bolt fixes things. Put seeds in it and Nova plants them. Sky fills it with supplies.
- **G = Give:** hand items straight to a computer crewmate. For example, give Bolt 2 pipes and a circuit board and it goes and fixes the oxygen maker.
- **R = Orders** (in the shout menu): **Follow me**, **Stay at base**, **Back to work**.
- **The night power plan is still yours.** Nova's crops only grow if you power the grow lights.

### How it works (for the team)
- Crewmates run on the **crew leader's** computer. They're sent to everyone like normal players and use the same shared-world events (claims, chest, equipment, planters). If the leader leaves, the next leader takes them over.
- Each crewmate is a small "brain" that re-thinks every half second, in priority order: safety first, then your orders, then its job (`public/js/systems/Bots.js`).
- **Game simplification:** computer crewmates don't get hungry, run out of air or get hurt.

**How it differs from Phase 7:** solo and duo players no longer have to do everything themselves (or switch jobs with **J**). Every game has a full crew, and the jobs still depend on each other. In solo you're the planner and explorer, feeding your crewmates what they need.

**New files:**
- `public/js/systems/Bots.js`
- `public/js/systems/Pathfinder.js`

**Changed:**
- World (creates the crewmates for unpicked jobs; give works with crewmates)
- Loot (crewmate pick-ups)
- Multiplayer (crewmate positions and messages)
- Interior (the computer Pilot can fly the rocket)

**Try it:** start a solo game. Put a pipe, wire or seeds in the hab's chest and watch Bolt and Nova put them to use. Press **R → Follow me** and lead them somewhere.

---

## Phase 9: Scene Two, the voyage and the crash ✅

**Goal:** A playable trip to Mars where each job does its own task at the same time, ending in the crash that strands the crew.

### The story
- **Day 23 aboard the mothership Perseverance VI,** 3 days from Mars. All systems normal... until a **micrometeoroid swarm** hits the ship. Alarms sound, the screen flashes red, and everyone runs to their station.

### The ship
- One long, two-screen ship you walk through: **Cockpit → Lab & air supply → Engine room → Crew quarters**. The crew starts in their bunks.
- **A yellow arrow** points each player to their task, and a **task list** shows everyone's progress.

### The three tasks (all at the same time)

| Job | Task | How | Real science shown afterwards |
|---|---|---|---|
| 🌱 Botanist | **Patch the oxygen leaks** in the lab | Find the 3 leaks (white puffs of escaping air) and **hold E** at each | In 2020 the Space Station crew found a tiny air leak using floating **tea leaves**! |
| 🔧 Builder | **Reconnect the broken wires** in the engine room | **E** at the wiring panel opens a mini-game: match each coloured wire to its socket (click, or keys 1–4) | Spacecraft wiring is tested for heat, cold, shaking and radiation |
| 🚀 Pilot | **Fly through the debris** | **E** at the pilot seat opens a dodging game: steer up and down (W/S or arrows) past space rocks | Real micrometeoroids are too small and fast to dodge, so ships carry layered **Whipple shields** |

- **Computer crewmates** do their task automatically, with their progress shown in the list.
- **The final strike:** when the Botanist and Builder have finished, one **huge rock always hits**. The Pilot sees it home in on the ship. The story needs it!

### The crash (cutscene)
1. The lander blasts away from the damaged Perseverance VI.
2. Fiery entry into the thin Martian air.
3. Parachutes, with a damaged engine.
4. **CRASH** in Jezero Crater, with supplies scattered.
5. A message from Mission Control arrives 14 minutes later. It explains the plan: the base was landed ahead of the crew but knocked out, and the Perseverance VI will return between Sol 8 and Sol 12.

**Space** skips each shot.

### Arriving on Mars
- After the story, **the crew starts beside the crashed lander** on the Crash Trail, not at the base.
- A welcome message explains the goals and points you to the **compass**.

**How it differs from Phase 8:** the game used to start with you standing at the base. Now you live through the voyage and the crash, practise your job's skills (patching, wiring, piloting) in a safe setting, and then make your way to the base.

**New files:**
- `shared/voyage.js` (ship layout drawn as text, the tasks, facts)
- `public/js/scenes/VoyageScene.js`, `WiresScene.js`, `DodgeScene.js`, `CrashScene.js`
- Art: `f-wirepanel.png`, `f-seat.png`

---

## Phase 10: Scene One, the launch-day interview ✅

**Goal:** Open the game on Earth, introduce the crew, and let each player shape their astronaut.

### What happens
- **Launch day on Earth:** blue sky, a crowd, the rocket on its pad, and the **crew in uniform** with their names. A **reporter** holds a microphone.
- **The reporter asks each astronaut a job-based question.** A yellow marker shows whose turn it is.
  - 🌱 **Botanist:** *"How will you feed a crew on a planet with no farms?"*
  - 🔧 **Builder:** *"What happens if something breaks millions of kilometres from a hardware shop?"*
  - 🚀 **Pilot:** *"Aren't you scared of what's out there?"*
- **Each player picks one of 3 answers** (keys 1–3 or click), and everyone sees it. The computer answers for its crewmates.
- **The reporter reacts,** often with a real fact. For example, NASA really did use duct tape to save Apollo 13.
- **Each answer gives a small bonus on Mars,** so the choice matters but nobody is punished:

| Job | Answer 1 | Answer 2 | Answer 3 |
|---|---|---|---|
| Botanist | +2 lettuce seeds | +2 potato seeds | +2 tomato seeds |
| Builder | +2 wire | +1 pipe | +4 scrap |
| Pilot | +1 medkit | +2 snack packs | +1 oxygen canister |

- **Lift-off:** the rocket launches with flames and a rumble, then the voyage begins.

### The full game flow now

**Lobby → Launch interview (Earth) → Voyage (Perseverance VI) → Crash → Mars survival → Launch home → Ending**

- **The crew leader can switch the story off** in the lobby ("Play the story" checkbox) to go straight to Mars. That's handy for quick games and for testing.
- **Rejoining** players skip the story and go straight into the current world.
- **Quick-test mode:** `?job=pilot` skips the story; `?job=pilot&story=1` plays it.

### How it works (for the team)
- All story text is in `shared/story.js` (interview) and `shared/voyage.js` (voyage). Edit the questions, answers, bonuses and facts there.
- **Multiplayer:**
  - Interview answers and voyage task completions are sent to everyone.
  - The crew leader decides when the computer crewmates answer and when the final strike happens.
  - A short buffer of recent events means a player who reaches a scene a moment late still catches up.

**How it differs from Phase 9:** the game now starts on Earth with a personal moment for each player. They choose how their astronaut talks, which builds attachment to the character and gives a small reward that carries through to Mars.

**New files:**
- `shared/story.js`
- `public/js/scenes/InterviewScene.js`
- Art: `reporter.png`

---

## Phase 10.5: Simpler rules, clearer jobs ✅

**Why:** the game had too many things to track (health, water, battery, fuel, a night power plan, dusty panels). For 7–12 year olds we cut it down to what matters most.

**What changed:**
- **Only 3 bars per player:** 🍽 Food, 🫁 Oxygen (suit air) and ☢ Radiation. Health, water, battery and fuel are gone.
  - Out of air (after a short grace period), starving (after a longer one) or radiation at the limit → knocked out, wake in the medbay.
  - Medkits (F) and the medbay now lower radiation. (Labelled as a GAME rule: real dose never goes away.)
- **Only 5 things to fix, all by the Builder, in order:**
  1. Solar panels (2 solar cells). They power the next three.
  2. Oxygen maker (2 pipe, 1 circuit board). Suits refill for free indoors; until then they use the emergency air tanks.
  3. Greenhouse lights (1 wire, 1 circuit board). Crops only grow overnight while these work.
  4. Comms dish (2 wire, 1 circuit board). Radio, flare forecasts.
  5. Ascent rocket (5 rocket parts).
- **Clear jobs**, shown on the HUD as "YOUR JOB":
  - Botanist: grow enough food for the whole crew.
  - Builder: fix the 5 machines.
  - Pilot: drive the rover to find parts and supplies, then fly everyone home.
- **The rover works from the start.** No fuel, no repair. Only the Pilot drives.
- **Night is simple:** sleep in a bunk. Solo: the night passes at once. Multiplayer: it starts when everyone is in bed (or at midnight).
- **Story scenes stay in sync:** only the crew leader (first to join) can press Space in the interview and crash scenes; everyone else follows.
- **No QR code:** the lobby shows the join address only. The `qrcode` package was removed.

**Files:** `shared/survival.js`, `shared/equipment.js`, `shared/tasks.js` rewritten; `Equipment.js`, `Survival.js`, `NightScene.js` rewritten; World, Interior, HUD, End, Interview, Crash scenes, bots, multiplayer, server and lobby updated.

**Tested:** solo (rover drive, radiation knock-out, fixing solar + oxygen maker, sleep, medkit, launch), 2-player (shared loot, repairs, give, night, rejoin), 2-player story (only the leader's Space advances, answers and bonuses synced), computer crewmates.

## Phase 10.6: Team folders, sound system, comments ✅

**Why:** three people now work on the game, so each needs their own area.

**What changed:**
- **Renamed** the game to **Sol Survivors**.
- **Three team folders** (each with its own README):
  - `levels/` (Level design, music & sounds): map, rooms, ship plan, loot tables, art, audio.
  - `story/` (Story & NASA data): all story text, item/machine/place facts, job and to-do text, radio messages, real NASA numbers.
  - `game/` (Game logic & backend): server, browser code, rules.
- **Text split from code:**
  - Item, machine, job and room words now live in `story/`.
  - Rules files merge the words in, so game code didn't need to change.
  - Crash captions, the arrival message, endings, voyage cards and shouts moved to `story/` too.
- **Sound system:**
  - `levels/audio/sounds.js` lists which file plays for what.
  - The server reports which files exist, so missing ones are skipped.
  - Music changes by scene and by day/night. M mutes.
  - No audio files yet.
- **Comments:**
  - Every file has an owner line.
  - Every function has a comment.
  - Tricky logic is explained inline.
- **Tidy-up:**
  - Removed unused art (water recycler, fuel tank) and the water recycler map object.
  - Removed the old single-player prototype (it's still in git history).
  - Workbench recipes are now shared by players and bots (`game/rules/crafting.js`).

Note: the phases above describe the old folder names (`shared/`, `public/`, `server/`).

## Phase 10.7: Playtest changes ✅

**From the first playtest:**
- **MOXIE and the big choice:**
  - Fixing **MOXIE** (oxygen) is now the first emergency. The crew leader chooses: MOXIE first (air lasts until the end of Sol 3) or the **fission generators** first (air lasts until the end of Sol 2). If MOXIE isn't fixed in time, the game ends.
  - Without power, MOXIE runs at half speed on its battery.
  - Real facts: MOXIE made oxygen on Mars on 20 April 2021; NASA's KRUSTY fission test (2018).
- **Machines renamed:** solar panels became **nuclear fission generators**; the radio dish became a **laser comms tower** (NASA's DSOC laser test, 2023). New art for both, plus a gold MOXIE box.
- **Crops:** lettuce became **red cabbage** (with potatoes and tomatoes). Planting pops up a real space fact about the crop.
- **Less on screen:**
  - The 3 bars moved to the top right.
  - The to-do list and crew list left the screen. The game shows **one NEXT task at a time**; for the Builder, it follows the crew's choice.
  - New **TO-DO** and **MENU** buttons. The pause menu (Esc/P) has tabs: Buttons, To-do, Machines, Crew.
  - The machines panel is hidden until you press B.
  - The hotbar says which key uses the selected item.
- **Story:** jump on launch day (↑); voyage messages stay up twice as long.
- **Sleeping:** E gets you back up (not after midnight).
- **Rover:** 3 seats, so the crew can ride along with the Pilot. It now faces 4 directions, its wheels turn, it kicks up dust, and you climb in and out.

## Phase 10.8: Second playtest ✅

- **Host pause:** the host's Esc menu freezes the whole game for everyone: no time passes and nobody moves. Others see "PAUSED". Anyone else's menu doesn't pause.
- **Sleep:** the night only passes when every astronaut is in bed (the clock waits at midnight). Nobody is knocked out while asleep. Sleep refills your air and lowers radiation by 5, but not food (and the night never takes you below 10 food).
- **Spaceship:** you only see your own task.
- **Launch day:** after the interview, each astronaut climbs the ladder into their own door on the rocket (3 doors, one above the other, each with a little window). When everyone is in, the host can launch.
- **Repair parts made obvious:** part pictures float above every broken machine; standing at one shows what it needs, what you carry, and ✔/✗; the Builder's NEXT line counts parts; item hints say which machine a part fixes; the Machines tab lists every machine's parts.
- **Simpler words:** all story text and in-game messages rewritten in short, simple sentences for ages 7–12.

## Phase 10.9: Third playtest ✅

- **Air:** MOXIE is always the first job, with 10 real minutes to fix it (countdown on the Builder's and Pilot's NEXT line). No oxygen canisters; suits only refill indoors once MOXIE works. Suits last 5 real minutes outside (Pilot 7). The MOXIE-or-power choice is gone.
- **Health** replaces the radiation bar. Radiation (worst in the Reactor Wreck), an empty suit and starving all lower it. Near 0 the screen fades to black with a red CRITICAL warning. Medkits, the medbay and sleep heal.
- **Food:** 3 food packs each and no food anywhere else, so the Botanist feeds the crew. Hunger 1.5x slower. Crops grow in 2 real minutes (with the grow lights). The planting fact pops up only the first time. A chest in the greenhouse; a lamp outside it lights up when the grow lights are fixed.
- **Items:** no giving: drop only (hold Q to drop the whole stack).
- **Night:** 3 bunks in the hab; when everyone is in bed the clock races to morning on the night screen.
- **Multiplayer:** the rover glides smoothly on everyone's screen and parks in exactly the same spot; rejoining takes over your old astronaut (no ghost copy); change your name in the menu's SETTINGS tab. The crew tab shows everyone's health.
- **Launch day:** walk to the ladder and climb into your door yourself (or click); name tags don't overlap; drifting clouds; press photographers with camera flashes; a mission badge on the rocket; NEXT button for mouse players.
- **Story:** the escape order now comes from the crew's own Pilot.
- **Mars:** the map is a round crater with a mountain wall all round; signs on every building; the compass is replaced by a map that uncovers as you explore, with dots for the crew, broken machines and your next task.
- **No emojis** in game text.

## Phase 10.10: Fourth playtest ✅

- **Bug found: the night froze everything.** Two causes. (1) The game stopped the clock at midnight on purpose until everyone was in bed, and the bars and crops only move when the clock moves. (2) While the host was in bed, the host's clock was capped at 23:59 and sent to everyone, so all screens froze too. Fixed: the clock never stops; after midnight a new sol begins.
- **Nights:** very dark, with head torches, and 2 dust storms every night (70% slower). Space storms (flares) every sol, 10 health a second outside, safe inside, with 12 seconds of warning.
- **Host:** the person running the game (on localhost) is always the host, and can pause at any time, including in the story (Esc / P).
- **Connection:** positions are sent 'reliably' once a second; a crewmate not heard from for 5 seconds is refreshed and asked for their position. Keys are released when the window loses focus (no more running by itself).
- **Launch day:** names up to 15 letters; 'Jump: W or Up arrow'; NASA written on the rocket; the rocket is a separate picture, so there's one ladder and the pad stays behind at lift-off.
- **Mars:** MOXIE explained for kids at the start; OXYGEN bar with a 'can't refill until MOXIE is fixed' reminder; your job at the top; name signs on top of buildings; crops grow in 1 minute with a % shown; red cabbage is red; the O2 sign fits on MOXIE; you can launch as soon as everything is fixed (by Sol 12); the end screen text wraps.

## Phase 10.11: Fifth playtest ✅

- **Launch day:** the chosen layout (the press pen): photographers behind a red rope with a LIVE TV sign and a TV camera, the reporter in front, astronauts moved right. The flame now comes out of the rocket's engine and flies with it. The website card picture shows this scene.
- **Spaceship:** smaller beds; patched leaks show on everyone's screen; the ship seen from outside (crash scene) is the same NASA rocket.
- **Pause:** one pause menu everywhere (launch day, spaceship, crash, Mars).
- **Mars:** softer hab/greenhouse shadows; dust storms last 30 real seconds, with a warning like the space storm alarm; longer dusk and dawn; the rover starts in the garage (drive it out from inside, park it by driving to the garage door); a rover icon on the map; signs on MOXIE and the fission generators; MOXIE's red light flashes until it's fixed; the Botanist's NEXT line says the greenhouse needs its lights fixed AND power; you can drop things inside buildings; an empty stomach knocks you out fast (10 health a second); no more mentions of giving; smaller beds.

## Phase 10.12: Sixth playtest ✅

- **Players vanishing in multiplayer (diagnosed and fixed):** when a phone or laptop briefly lost its connection (common through a Cloudflare tunnel or on school Wi-Fi), it reconnected with a new connection ID but never told the server who it was. Everyone else then ignored its position updates, so that astronaut froze or faded out on their screens while it still walked around on its own. It also couldn't open crates or pick things up (the server didn't know the new ID), which caused some of the "empty crates". Fixes: Socket.IO connection recovery (short drops keep the same ID), the client says hello again with a per-tab token after any reconnect, the server hands the old astronaut and its claims to the new connection, the "left" message waits 4 seconds, other screens match a returning player by job, and the game is only reset after 60 seconds with nobody online.
- **Your own astronaut invisible:** getting in and out of the rover quickly could leave your astronaut hidden. The animations now cancel each other properly, and a safety check shows you again.
- **Bounced out of doors:** the "I'm stuck" safety check could push you back outside while a room was still fading in. It now waits for the room to open.
- **Spaceship:** the brown cabinets are gone (also from inside the Mars rocket).
- **Mars:** the Hab is now called the Hub; every building has a crew chest (all one shared chest); the Builder installs all the rocket parts they carry in one go; the rocket on Mars is the same NASA rocket as on launch day, with a separate ladder that everyone climbs to get in and out; the win screen launches that same rocket off its pad.

## Phase 10.13: Crates that open with nothing inside ✅

- **Diagnosis:** crate contents are never rolled empty (checked over 18,100 simulated crates), and in tests crates opened correctly on every screen, even over a slow, dropping connection. But a crate's items only appeared on other screens when the opener's "crate opened" message arrived. Every other screen only marked the crate open (just the picture) when the server said someone had it. So any lost message (a connection blink at the wrong moment, a tab that didn't recognise its own ID, a tab still playing an older game holding the crate on the server) left a crate open and empty.
- **Fix: every screen spills crates itself.** Where a crate's items land is worked out from the game's seed and the crate number, so it's the same on every screen. Whenever any screen learns a crate was opened (the server's answer, a refusal, or the opener's message), it spills the items itself. Items someone picked up are remembered, so a late spill can't bring them back, and a pile the server says someone else already has is removed.
- **Claims:** with a server, the game always asks it (it waits for a blinking connection to come back, instead of saying "it's mine"). The server only answers players in the game, and says no to a tab that's still playing an older game. Answers are also matched against the tab's live connection ID. The `?job=` quick test is fully solo.
- **Mars:** the rocket ladder is climbed by hand like on launch day (hold W to climb up, S to climb down); space storm (flare) damage halved to 5 health a second (dust storms unchanged); the Botanist's first task is "Fix MOXIE first!" (with the parts list), like the Pilot's; the "!" and parts over MOXIE moved above its name sign.
- **Crash cutscene:** the small Earth in the top right is gone.

## Phase 10.14: Mini games ✅

**"A game within a game"**, like Among Us tasks. Each one is 10 to 20 seconds, with big click targets, mouse or keyboard.
- **The same rules for every mini game** (one shared helper, `game/client/js/scenes/MiniGame.js`):
  - The same frame, title, one-line how-to, "Esc: quit" and a win screen with a real fact.
  - It opens like any pop-up screen, so you stand still. In solo the clock pauses, like a menu.
  - Esc quits with nothing used up. Failing is gentle: try again.
  - The host's pause freezes it (PAUSED). It closes by itself if you pass out, or if the job gets done another way.
  - It runs only on your screen. Only the result is shared, through the normal events and the leader's sync and snapshot, so a rejoining player sees it.
  - Computer crewmates never play: their jobs just get done.
- **Spaceship (Builder):** 4 screws to unscrew before the wires. The wires game is unchanged.
- **Builder repairs:** a mini game replaces the progress bar. You still need the parts to start, and winning runs the same repair code as before.
  - **Split the CO2** for MOXIE.
  - **Split the Atom** for the fission generators.
  - **Weld the Crack** for the grow lights, the laser comms and the rocket parts (a different crack for each; the rocket is the hardest).
- **Botanist:**
  - **Toilet and fertilizer:** a toilet in the hub. Once MOXIE works, it makes 1 bag of fertilizer per sol. A fertilized bed grows twice as fast until its next harvest.
  - **Light Recipe:** the Botanist tunes the grow lights at a new light panel. Until then crops grow at half speed. A computer Botanist tunes them by itself.
  - **Frost Watch:** around 21:00, if a crop is growing, heat each bed before it freezes. A frozen bed stops growing until the morning; nothing is lost. A computer Botanist: no frost.
- **Pilot:**
  - **The stuck rover:** with a person as the Pilot, the rover starts half buried in sand next to the crashed lander. Nobody can drive or ride it until the Pilot wins **Unstick the Rover**. After that the garage works as before. A computer Pilot: the rover starts in the garage, like before.
  - **Glowing rock samples:** 3 glowing rocks in 3 different areas (never the Reactor Wreck or the base). Only the Pilot can pick them up, and they show on the Pilot's map. Study them at a new microscope desk in the workshop (**Rock Sample**: match olivine, hematite or carbonate). To-do: "Analyze 3 glowing rocks".
  - **Hit Earth:** once the laser comms work, the comms console has a 4th line for the Pilot: keep the crosshair on a tiny drifting Earth. A message goes home, and a reply arrives later. To-do: "Send a message to Earth".
- **New to-dos:** Botanist "Tune the grow lights" and "Fertilize a plant bed"; Pilot "Free the rover..." (the drive to-do), "Analyze 3 glowing rocks" and "Send a message to Earth". Each has a map target.
- **Words:** all in `story/minigames.js`. **Art:** the toilet, light panel and microscope desk, plus 2 new item icons (fertilizer, rock sample), in `levels/art/make-art.py`. The mini game screens themselves are drawn in code.
- **Tests** (`tests/`, Playwright against `localhost:3000`):
  - `stage1.py`, `stage3.py`, `stage4.py`: each mini game played to a win, quit with Esc, and failed.
  - `wires.py`: the spaceship screws and wires.
  - `safety.py`: freezing, passing out and the "I'm stuck" safety net.
  - `stage5mp.py`: 3 tabs through the real lobby. Results show on every screen, rejoining players see the right state, the host's pause freezes a mini game on another tab, and computer crewmates keep working.
  - `regression.py`: the story through the crash, then the rover, ladder, crates, chests, night, storms, flares and launch.

## Phase 10.15: Game rooms and online deployment ✅
- Server (game/server/index.js): one Room per game with a 4-letter code (own players, leader, seed, claims); Socket.IO rooms scope every broadcast; empty rooms close after 60 s; MAX_ROOMS / MAX_CLIENTS limits; `/healthz`; production mode (NODE_ENV=production listens on 127.0.0.1 behind nginx, trusts the proxy).
- Lobby: "Create a game" / "Join with code", `?room=CODE` links, refresh keeps your game, clear messages for a wrong code, a full game and a started game.
- deploy/: nginx config, systemd service, setup / deploy / install scripts and AWS_DEPLOY.md for nasa.samuelojo.tech.
- Tests: tests/rooms.py (new); harness and stage5mp updated for the room flow.

## Phase 10.16: Playtest fixes and Botanist update ✅
- **Computer crewmates:** aboard the Perseverance VI at their stations from the start (the Botanist walks leak to leak); on Mars they sleep in their own hub bunk at night ("z z z", shared with everyone) and get up in the morning. The night still only waits for people (the server counts humans).
- **"Make it back before it's too late"** replaces "rescue between Sol 8 and 12" everywhere (`HOME` in story/crash.js). The rules didn't change: launch any time once everything is fixed, last chance at the end of Sol 12.
- **To-do list only in the menu (T):** no NEXT line on screen. The To-do tab highlights the next task with its details (parts in your bag, MOXIE countdown, what the crops wait for). The MOXIE countdown moved to the warning line. Pressing T doesn't pause a crew game.
- **Scarce parts, always winnable:** parts are no longer in the loot tables. The map holds exactly what the repairs need + 1 spare (20 parts, was about 75 on average), one per spot, spread far apart; MOXIE's 3 parts land on the crash trail near the base. tests/loot_seeds.mjs checks 2000 seeds.
- **Food drains twice as fast** (full stomach about 4.5 real min; nights use 30 food). Oxygen was doubled too, then put back as it was (5 real min outside, Pilot 7).
- **Exit to main menu** in the pause menu, with "are you sure?". A crew is told at once (server 'leave'); the leaver can rejoin with the code and name.
- **Science facts on their own screen** (scenes/FactScene.js): place, building, crop, machine, item (backpack F), fertilizer and every mini game's win fact. Closed only by the X (or Esc); queued so they never cover another screen; the solo clock pauses.
- **Spacing:** every pop-up checked at 480x320. Menus wrap long options and shrink very long text, messages sit above the [E] prompt, the oxygen hint joined the warning line, a dark panel behind the bars, pause tabs never run into the buttons, backpack and chest layouts fixed.
- **Botanist:** the greenhouse glows pink once the lights are tuned and working (inside, outside and at night; shared and kept on rejoin). The toilet is behind its own door (Q in levels/rooms.js, f-toiletdoor.png): the Botanist goes in, vanishes for everyone ("IN USE") and comes out with fertilizer. **Frost Watch** is new: a 20 s night with a moon bar, beds cooling at their own speeds, cold gusts with a warning, puffs of hot air, close saves and streaks, thermometers and frost on the soil.
- **Fewer seeds (75% less):** about 20 seed packets per game instead of about 86, one packet per pile; at least 2 of each crop are always on the map (`SEEDS_MIN` in game/rules/loot.js), so all 3 crops can still be grown.
- **Fix:** a rejoining player now asks for the world snapshot once their world has loaded (the first one could arrive too early and be lost).
- Tests: tests/bots.py, tests/menus.py, tests/botanist.py, tests/loot_seeds.mjs (new); the harness closes facts by itself in tests that aren't about facts; older tests updated (win screens are facts now, the toilet door, the new Frost Watch).

## Phase 10.17: Opening crawl and touch-ups ✅
- **Opening crawl** ("THE YEAR IS 2041..."): yellow words tilted back and sliding up into space, the first screen of a game with the story on. HTML + CSS over the canvas (game/client/js/crawl.js, #crawl in style.css), words in story/intro.js, music slot `music/intro`. Only the host can skip; a skip ends it for the crew. tests/crawl.py.
- One rocket picture everywhere (our own mission patch + NASA painted in), space debris and a dead satellite in the Pilot's dodge game, the ship renamed Perseverance VI, the Rock Sample fact shown only the first time, oxygen drain back to the old rate.

## Phase 11: Polish and submission ⏳ (next)

**Planned:**
- **Art:** redraw the placeholder art (astronauts, buildings, items, interiors) in Piskel or Aseprite at the same sizes.
- **Sound and music:** 8-bit effects (pick-ups, alarms, repairs) made with jsfxr, and a chiptune soundtrack made with BeepBox.
- **In-game NASA data panel:** every real dataset and fact used, with sources, and the game simplifications labelled.
- **Quick and Full mission lengths** (for example, a shorter launch window for judging).
- **Online hosting** (Render or Railway) so remote judges can play from a link, plus a demo video showing LAN play on three devices.
- **Space Apps submission write-up:** datasets used and why, how the game teaches real trade-offs.
- **Accessibility:** touch controls for tablets, a colour-blind-friendly palette check, and a bigger text option.

---

## Known issues and ideas

- **The crew leader's browser runs the shared clock and the computer crewmates.** If the leader closes their browser, the next player takes over automatically. If the **host server** is stopped, the game ends. No save files yet.
- **Computer crewmates** don't get hungry or hurt, don't drive the rover and don't play mini games: their jobs just get done (a game simplification).
- **Menus:** in solo they pause the clock. In multiplayer the clock keeps running.
- **Joining late:** if a player joins during the story, they skip it and arrive in the current world. Players can only rejoin a game in progress with the name they used before (or from the same browser tab, after a connection drop).
- **Placeholder art:** all art was generated in code. Redraw it in Piskel at the same pixel sizes.
- **Testing shortcut:** `?job=pilot` (add `&story=1` for the story, `&nobots` for no crewmates). **J** switches jobs only in this mode.
- **npm warnings:** `npm install` reports moderate warnings from `nodemon`, a dev-only tool. They're safe to ignore.
- **Game rules vs real numbers:** game-rule numbers are labelled in `shared/survival.js` (GAME vs REAL).
