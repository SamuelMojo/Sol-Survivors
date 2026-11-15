# Sol Survivors

A co-op Mars survival game for kids aged 7–12, made for the **2026 NASA Space Apps Challenge**.

Play solo, as a duo or as a crew of three (🌱 Botanist, 🔧 Builder, 🚀 Pilot) on the same Wi-Fi network. Computer crewmates fill any job nobody picks. Every mechanic is based on a real challenge of living on Mars, using real NASA data wherever it exists.

**New to the code (or an AI assistant)?** Read **[CLAUDE.md](CLAUDE.md)** first: how it all fits together, the rules to follow, how to test and deploy.

🌐 **Play online:** https://nasa.samuelojo.tech (create a game, share the 4-letter code).

📒 **PROGRESS_LOG.md** says what each build phase did and why. The full system guide (how everything fits together) is the *Sol Survivors: How the System Works* doc.

## Who works where

The project is split into three folders, one per person. Each folder has its own README with step-by-step instructions.

| Folder | Owner | What's inside |
|---|---|---|
| [`levels/`](levels/README.md) | 🗺️ **Level design, music & sounds** | The Mars map (Tiled), building and ship floor plans, what loot is found where, all the pixel art, music and sound effects |
| [`story/`](story/README.md) | 📖 **Story & NASA data** | Every word players read (interview, voyage, crash, endings, item and place facts, jobs, to-do lists, radio) and the real NASA numbers |
| [`game/`](game/README.md) | ⚙️ **Game logic & backend** | The host server, the browser game code (scenes and systems) and the game rules (balance numbers) |

Every code file starts with a 👤 **Owner** line, so you can always tell whose file it is. If you need a change in someone else's folder, ask them (or agree it together), so two people don't edit the same file at once.

## Play online with friends (rooms)

Run `npm start`, open the game, then **Create a game**. You get a 4-letter code and a link; friends press **Join** and type the code (or open the link). Up to 3 players per game, and many games can run at the same time on one server.

To put the game on the internet at your own address (AWS, nginx, HTTPS), follow `deploy/AWS_DEPLOY.md`.

## Run it

You need **Node.js 22 or newer** (`node -v`).

```bash
npm install      # first time (and after unzipping a fresh copy): downloads Phaser, Express, Socket.IO, fonts
npm start        # starts the host
```

The terminal prints the addresses:

```
  ==========  SOL SURVIVORS HOST  ==========
  On this computer:   http://localhost:3000
  Same Wi-Fi players: http://192.168.1.24:3000
```

1. Open the address in a browser and press **Create a game**. You get a 4-letter code and a link to share. Friends press **Join** and type the code (on the same Wi-Fi they use the second address; online, the website).
2. Everyone picks a different job and presses **Ready**.
3. The host ⭐ presses **Start mission**. With "Play the story" ticked, the game opens with the crawl ("THE YEAR IS 2041..."), then launch day; untick it to go straight to Mars.

**Tests:** `npm start` in one terminal, then `python3 tests/<name>.py` (Playwright: `pip install playwright && python3 -m playwright install chromium` once) and `node tests/loot_seeds.mjs`. See CLAUDE.md.

**For developers:** `npm run dev` restarts the server automatically when you edit server or rules code (just reload the browser for everything else). `http://localhost:3000/?job=pilot` skips the lobby and the story for a quick solo test. Add `&story=1` to include the story, or `&nobots` to play without computer crewmates.

**School Wi-Fi tip:** some networks block devices from talking to each other. If others can't join, run the game on a phone hotspot or a travel router.

## The game in one minute

**Lobby → Opening crawl ("THE YEAR IS 2041...") → Launch interview (Earth) → Voyage (Perseverance VI) → Crash → Survive on Mars → Launch home**

The story parts (crawl, interview, voyage, crash) play when the host ticks "play the story" in the lobby. Only the host can skip them (Space), and a skip moves the whole crew on.

1. **Launch interview:** a reporter asks each astronaut a question. Your answer gives you a small bonus item on Mars.
2. **Voyage:** micrometeoroids hit the ship.
   - 🌱 The Botanist patches oxygen leaks.
   - 🔧 The Builder reconnects wires.
   - 🚀 The Pilot dodges debris.

   The last strike always hits, and the crew crash-lands in Jezero Crater.
3. **Mars:** fix everything and fly home before the end of Sol 12.
   - **MOXIE first, always:** the crash broke MOXIE, the machine that makes air. The crew has **10 real minutes** to fix it (2 pipes + 1 circuit board), or the mission is over. Until it works, suits can't refill. The countdown is at the top left of everyone's screen.
   - Every player manages just **3 bars** (top right): **Food**, **Oxygen** (suit air, 5 real minutes outside, Pilot 7) and **Health**. Health drops from radiation (badly in the Reactor Wreck), from an empty suit and from starving. When it gets low the screen fades to black with a red CRITICAL warning.
   - **Food:** everyone lands with 3 food packs. There is no other food on Mars: after that, the Botanist feeds the crew. Crops take 1 real minute to grow once the grow lights work (watch the bar under the planter). A full stomach lasts about 4.5 real minutes, so the Botanist's crops matter early.
   - **The map** (bottom right) starts dark and uncovers as the crew explores. It shows you, your crewmates, broken machines and where your next task is. Click it to make it big.
   - The game tells each player **one task at a time** (top left). The full to-do list is behind the TO-DO button. Everyone's first task is fixing MOXIE: the Pilot and Botanist find the parts for the Builder.
   - The crew must fix **5 broken machines** (Builder only): MOXIE and the fission generators (in the chosen order) → greenhouse lights → laser comms → ascent rocket (5 parts; the Builder puts in every rocket part they're carrying in one go).
   - **Science facts** fill the screen: the first time you reach an area or go into a building, plant a crop, fix a machine or win a mini game, and from the backpack (**F** on an item). Close a fact with the **X** in the top corner (or **Esc**). In a solo game the clock pauses while a fact is open.
   - **Your to-do list** is in the menu (**T**, or the TO-DO button). The task to do next is highlighted, with the parts you still need and the MOXIE countdown under it. (There's no task line on the screen: it's kept clear for the game.)
   - **Repair parts are scarce:** the map holds exactly what the 5 repairs need plus 1 spare of each part, spread out across Mars (MOXIE's parts are always on the crash trail near the base). Explore, and share what you find.
   - Shelter indoors from solar flares and stay away from the Reactor Wreck.
   - **Mini games** ("a game within a game", like Among Us tasks): short pop-up games of 10 to 20 seconds. See [Mini games](#mini-games) below.
4. **Launch:** as soon as every machine is fixed (all 5 rocket parts in) and everyone is aboard, the Pilot launches. The rocket on Mars is the same NASA rocket you flew in. Everyone climbs the ladder beside it to get in, just like on launch day: walk to the bottom and hold **W** (or Up). Coming out, hold **S** (or Down) to climb back down. Make it back before it's too late: after Sol 12 Earth and Mars are too far apart to fly home. Star rating!

**Passed out (never killed):** if your health reaches 0, you wake up in the medbay 2 hours later with half health. Your bag stays where you fell.

## Mini games

Short pop-up games, like Among Us tasks. Each one takes 10 to 20 seconds, uses big click targets and works with the mouse or the keyboard. Every mini game works the same way:
- You stand still while it's open. In solo the clock pauses (like a menu); in multiplayer the world keeps going.
- **Esc quits** and nothing is used up (your parts stay in your bag). Failing is gentle: just try again.
- Winning shows a **real science fact** on its own big screen (close it with the X, or Esc).
- The host's pause freezes mini games too. If you pass out, or the thing you're fixing gets done another way, the game closes by itself.
- Only you see your mini game. Only the result is shared with the crew.
- Computer crewmates never play mini games: their jobs just get done.

| Who | Where | Mini game | How to play |
|---|---|---|---|
| 🔧 Builder | Spaceship wire panel | **Screws, then wires** | Click each of the 4 screws 3 times (or press 1-4). The panel slides off, then join the wires as before |
| 🔧 Builder | MOXIE | **Split the CO2** | Drag one O off each CO2, then drag the free O atoms together in pairs to make O2 |
| 🔧 Builder | Fission generators | **Split the Atom** | Tap Space (or click) fast to fire neutrons until the meter is full |
| 🔧 Builder | Grow lights, laser comms, rocket parts | **Weld the Crack** | Hold the mouse and trace the crack. Slip off and that bit cools |
| 🌱 Botanist | Light panel (greenhouse) | **Light Recipe** | Match the target glow with the red, green and blue sliders (click, or 1/2/3 then Up/Down). Until the lights are tuned, crops grow at half speed |
| 🌱 Botanist | Greenhouse, at night | **Frost Watch** | Around 21:00, if a crop is growing. About 20 seconds: keep every bed warm until the frost passes. Click a bed (or press its number) to puff hot air. Each bed cools at its own speed, and cold gusts (with a warning) cool everything faster. Saving a nearly frozen bed is a close save. A frozen bed stops growing until the morning |
| 🚀 Pilot | The stuck rover | **Unstick the Rover** | Tap Space (or click) to keep the revs in the green. Too fast overheats, too slow stalls. 5 seconds in the green frees it |
| 🚀 Pilot | Microscope desk (workshop) | **Rock Sample** | Look in the microscope, then click the matching mineral (or press 1-3) |
| 🚀 Pilot | Comms console | **Hit Earth** | Keep the crosshair on the tiny drifting Earth (mouse or WASD) while the bar fills |

The Builder still needs the parts to start a repair: the mini game replaces only the old progress bar.

**More new things:**
- **Toilet and fertilizer (Botanist):** the hub has a toilet behind its own door (on the top wall, away from the chest). Once MOXIE works, the Botanist presses **E** on the door, goes in (and disappears for everyone, the door says IN USE) and comes back out with 1 bag of fertilizer, once each sol. Use it on a plant bed (E at the planter): that bed grows twice as fast until its next harvest. It's a bonus, not needed for food.
- **The stuck rover (Pilot):** if a person is the Pilot, the rover starts half buried in sand next to the crashed lander. Nobody can drive or ride it until the Pilot frees it (Unstick the Rover). After that the garage works as before. With a computer Pilot, the rover starts in the garage.
- **Glowing rock samples (Pilot):** 3 glowing rocks lie in 3 different areas (never the Reactor Wreck or the base). They show on the Pilot's map as green crosses. Only the Pilot can pick them up. Take them to the microscope desk in the workshop.
- **Pink greenhouse:** once the grow lights are tuned (Light Recipe) and working, the greenhouse glows pink, inside and out (and through the dark at night), on every screen.
- **Computer crewmates** are aboard the spaceship at their stations, and at night they sleep in the hub bunks (with "z z z"). The night never waits for them: it passes when every person is in bed.
- **Hit Earth (Pilot):** once the laser comms work (with power), the comms console has a 4th line for the Pilot: aim the laser by hand. The other 3 lines are the same for everyone.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move (hold **Shift** to run) |
| **E** or Space | Use: doors, crates, furniture, repairs, the rover (drive it, or ride in a passenger seat). With a person as the Pilot, the rover starts stuck in the sand by the crashed lander: the Pilot frees it first (a mini game). Park it by driving up to the garage door; drive it out again from inside the garage |
| **I** | Backpack: item details with real science, drop items |
| **Q** / hold **Q** | Drop one / the whole stack of the selected item, outside or inside buildings (to share, drop things by your crewmate or use a chest) |
| **F** | Use the selected item: medkit (+30 health), food (indoors only) |
| **R** | Shout to the crew / give orders to computer crewmates |
| **T** | Show / hide your to-do list (also the TO-DO button) |
| **B** | Show or hide the machines panel |
| **Esc** / **P** | Menu (also the ☰ MENU button): tabs for Buttons, To-do, Machines, Crew, Settings, and **Exit to main menu** (it asks "are you sure?" first; in a crew game the others carry on and are told you left). The **host's** menu pauses the whole game for everyone (just looking at the to-do list with **T** doesn't) |
| **1–0** / mouse wheel / click | Choose a hotbar slot |
| **M** | Mute or unmute music and sounds |

**Screens:**
- **Backpack:** arrows choose a slot, X drops (Shift+X drops all).
- **Chest:** Tab switches side, Enter moves a stack (Shift+Enter moves one).
- **Night:** the clock never stops. After sunset it gets very dark (everyone has a head torch) and there are 2 dust storms every night (30 real seconds each, you move 70% slower, with a warning first). A space storm (solar flare) hits every sol: outside it takes 5 health a second, inside you're safe. (Dust storms only slow you down.)
- **Chests:** every building has a crew chest, and they're all the same shared chest: put something in one, take it out of any other.
- **Sleeping:** the hub (your home base, called the hab in the code) has 3 bunks. **E** gets you back up. When the whole crew is in bed, the clock races to 06:00 on the night screen. You can't pass out in your sleep. Sleep gives back 40 health (and air, once MOXIE works) but makes you hungrier.
- **Mouse:** click the [E] prompt instead of pressing E, click hotbar slots, the TO-DO and MENU buttons, the map, and on launch day NEXT and anywhere to climb into the rocket.
- **Names:** change your name in the menu's SETTINGS tab. If you lose connection, come back with the same name to get your astronaut back.
- **Bad Wi-Fi:** short drops (up to 2 minutes) reconnect by themselves and you keep playing as the same astronaut. Crewmates don't see you vanish unless you're gone for more than 4 seconds. A crate always spills the same items in the same spots on every screen, so even if a message is lost, nobody sees an open, empty crate.
- **The host** is whoever runs the game on their computer and sends the links (they open `localhost:3000`). They can pause at any time with **Esc** or **P**, which pauses everyone.
- **Story scenes:** only the host presses Space to move the interview and crash scenes on, so everyone stays together. On launch day, **W** makes your astronaut jump, and after the interview everyone walks to the ladder (**A/D**) and climbs up (**W**) into their own door on the rocket (or clicks to do it automatically). The host can launch once the whole crew is in.
- **Repair parts:** every broken machine has pictures of the parts it needs floating above it. Standing at one shows a box with each part, how many you carry and a ✔ or ✗. The to-do list (T) counts them too.
- **Items:** the line above the hotbar names the selected item and the key that uses it (for example "F: eat (indoors only)").
- **Mini games:** mouse or keyboard (each one says how on its bottom line). **Esc** quits with nothing used up. Winning opens a science fact: close it with its **X** (or Esc).

## The jobs

| Job | Your goal | Only this job can... |
|---|---|---|
| 🌱 **Botanist** | Grow enough food for the whole crew | Plant seeds in the greenhouse (anyone can harvest), make fertilizer in the hub toilet, tune the grow lights, keep the beds warm on frosty nights |
| 🔧 **Builder** | Fix the 5 broken machines | Repair machines (each repair is a mini game), use the workbench. Parts come from the crew chests, or crewmates drop them nearby |
| 🚀 **Pilot** | Drive the rover to find parts and supplies, then fly everyone home | Free the stuck rover and drive it (no fuel needed), pick up and study the glowing rock samples, aim the laser at Earth, fly the rocket. Biggest suit air tank (7 real minutes outside instead of 5) |

**Computer crewmates:**
- 🤖 **Nova** (Botanist), 🤖 **Bolt** (Builder) and 🤖 **Sky** (Pilot) play any job nobody picked.
- They use the crew chest, shelter from flares and follow orders (**R**).

## Tech stack

| Part | Tool |
|---|---|
| Game engine (browser) | [Phaser 4](https://phaser.io), served from `node_modules` (works offline) |
| Host server | Node.js + Express |
| Multiplayer | Socket.IO (lobby, events, "who got it first" claims) |
| Maps | [Tiled](https://www.mapeditor.org) JSON (`levels/map/mars.json`); rooms drawn as text |
| Fonts | Press Start 2P + VT323, bundled through npm |

## Project layout

```
levels/                    🗺️ Level design, music & sounds
  map/mars.json            the 20-screen Mars map (open in Tiled)
  map/make-map.js          makes a fresh starter map (npm run make:map; overwrites mars.json!)
  rooms.js                 the inside of every building, drawn as text
  ship.js                  the Perseverance VI's floor plan (the voyage)
  loot.js                  what can be found at each loot spot and on shelves
  art/                     all the pixel art (PNG) + make-art.py (makes the placeholder art)
  audio/sounds.js          which music and sound file plays for what
  audio/music/, audio/sfx/ put the audio files here
story/                     📖 Story & NASA data
  intro.js                 the opening crawl ("THE YEAR IS 2041...")
  interview.js             Scene One: the launch-day interview
  voyage.js                Scene Two: the voyage tasks and story cards
  crash.js                 the crash cutscene and the arrival message
  endings.js               win and lose screens
  jobs.js                  job names, goals, to-do list text, "only the X can..." messages
  items.js                 item names, descriptions and facts
  machines.js              the 5 machines' names, messages and facts
  places.js                facts for the map's areas and the buildings
  radio.js                 Mission Control and family messages, crew shouts
  minigames.js             every mini game's words and facts, the fact screen, Exit to main menu
  nasa-data.js             the REAL numbers the game is built on
game/                      ⚙️ Game logic & backend
  server/index.js          the host: serves the game, lobby, claims, relays events, night
  client/index.html        the page (lobby HTML + game canvas), style.css
  client/js/               main.js, net.js (connection + rooms), lobby.js, crawl.js (opening crawl)
    scenes/                Boot, Interview, Voyage (+Wires, Dodge), Crash, World, Hud, Interior,
                           Inventory, Menu, Pause, Night, End, Fact (science facts),
                           MiniGame (base) + Moxie, Atom, Weld, Light, Frost, Unstick, Rock, Earth games
    systems/               Survival, Equipment, Loot, Rover, Multiplayer, Bots, Pathfinder, Audio, Minimap
  rules/                   game rules and balance: settings, survival, equipment, items, inventory,
                           farm, crafting, jobs, tasks, loot (rolling + part placement), rng
  build-web.js             npm run build:web: the solo-only static version in dist/web
deploy/                    🌐 Online hosting (AWS EC2 + nginx + HTTPS): AWS_DEPLOY.md, deploy.sh
tests/                     🧪 Playwright browser tests + loot_seeds.mjs (see CLAUDE.md)
```

## NASA science in the game

**REAL data:**
- Mars surface radiation of 0.67 mSv/sol (Curiosity RAD)
- The biggest Mars-surface storm dose, 8.1 mGy (May 2024)
- Real X-class flares from NASA's DONKI archive
- Earth–Mars signal delay of 3–22 minutes
- MOXIE oxygen from Mars air
- MOXIE making oxygen on Mars (20 April 2021), Kilopower/KRUSTY fission power (2018), DSOC laser communications (2023)
- Space-grown potatoes (1995), Chinese cabbage (2017) and tomatoes (2023)
- The 2018 dust storm that ended Opportunity's mission
- Jezero Crater and its ancient river delta
- Perchlorates in Mars soil
- Launch windows every ~26 months
- The tea-leaf leak hunt on the Space Station, Whipple shields, Apollo 13 duct tape

The REAL numbers live in `story/nasa-data.js`. **GAME simplifications** are labelled in `game/rules/survival.js` and in-game: sped-up time, crop growth, the radiation limit of 25 and medkits/the medbay lowering it (real dose never goes away), the shelter factor, and the Reactor Wreck (fiction based on real rover nuclear power units).
