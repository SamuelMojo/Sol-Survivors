# 🗺️ Level design, music & sounds

This folder holds everything about **where things are, what they look like and what they sound like**. Most of it can be edited without touching any game code.

After any change: save the file and **reload the browser** (the server doesn't need restarting).
Quick test: open `http://localhost:3000/?job=pilot` to jump straight onto Mars.

| File | What it is | Edit with |
|---|---|---|
| `map/mars.json` | The 20-screen Mars map | [Tiled](https://www.mapeditor.org) |
| `map/make-map.js` | Makes a fresh starter map | `npm run make:map` (overwrites `mars.json`!) |
| `rooms.js` | The inside of each building, drawn as text | any text editor |
| `ship.js` | The Perseverance VI's floor plan (the voyage) | any text editor |
| `loot.js` | What can be found at each loot spot and on shelves | any text editor |
| `art/*.png` | Every picture in the game | [Piskel](https://www.piskelapp.com), Aseprite, any pixel editor |
| `art/make-art.py` | Makes the placeholder art | `python3 levels/art/make-art.py` (overwrites the PNGs!) |
| `audio/sounds.js` | Which music / sound file plays for what | any text editor |
| `audio/music/`, `audio/sfx/` | The audio files themselves | drop files in |

---

## The map (`map/mars.json`)

Open it in Tiled. The map is **150 × 80 tiles** of 16 px (5 screens wide, 4 tall). It has three layers:

| Layer | What it does |
|---|---|
| `ground` | Sand, dunes, paths, craters… (you walk over all of these) |
| `obstacles` | Rocks, ridges, debris. Tiles with the `collides` property block movement. |
| `objects` | Everything the game looks for (see below) |

The tiles come from `art/tiles.png` (5 columns × 4 rows). Tiles 13–19 (rocks, boulders, ridges, scrap, reactor debris, warning posts, frosty rocks) block movement.

### Objects the game looks for

The game finds objects by their **type** (Tiled's "Class" field) and **name**. Keep these exactly as they are:

| Type | Name(s) | What it is |
|---|---|---|
| `building` | `hab`, `greenhouse`, `workshop`, `garage`, `comms`, `rocket` | A building you can enter. The door is the middle of its bottom edge (the rocket's is at the foot of its ladder, drawn in code). The rectangle size should match its picture `art/b-<name>.png`. |
| `landmark` | `wreck` | The crashed lander. Story players start next to it. |
| `spawn` | `player_start` | Where players start when they skip the story. |
| `vehicle` | `rover` | Where the rover is parked. |
| `equipment` | `moxie`, `generator` (×4) | MOXIE (makes oxygen) and the 4 fission generators (pictures `art/eq-*.png`). |
| `zone` | `Jezero Base`, `Crater Field`, `Delta Cliffs`, `Reactor Wreck`, `Dune Sea`, `Crash Trail`, `Southern Plains` | The 7 areas. A bool property `hazard` = true makes it radioactive. Area facts are written by the Story person in `story/places.js` (names must match). |
| `loot` | `loot` | A point where a crate or an item pile appears. A string property `table` = `crash`, `common` or `hazard` (see `loot.js`). |

You can freely move, add or remove **loot** points, reshape **zones**, paint **ground** and **obstacles**, and move buildings (keep their rectangles the same size as their pictures, and keep paths clear to their doors).

⚠️ **Needs the Game logic person:**
- A new building or a new kind of object needs code.
- Moving the greenhouse lights, laser comms tower or rocket repair spots needs code. Their positions are worked out from the building doors in `game/client/js/scenes/WorldScene.js`.
- Renaming a zone also means changing `story/places.js` (Story person) and the Pilot's to-do list, which checks for the `Dune Sea` and "all 7 areas".

`npm run make:map` builds a brand new random map and **overwrites** `mars.json`. Once you start editing the map in Tiled, stop using it (or copy your map first).

---

## Rooms (`rooms.js`) and the ship (`ship.js`)

Rooms are drawn with letters, one string per row:

```
'######ww######',     #  wall      w  wall with a window
'#.B..........#',     .  floor     D  the door (bottom wall only)
'#....C.......#',     Capital letters place furniture: the letter marks its TOP-LEFT tile,
'######D#######',     and the tiles the furniture covers stay '.'
```

Furniture letters and sizes (width × height in tiles):

| Letter | Furniture | Size | What E does |
|---|---|---|---|
| `B` | Bunk bed | 2×3 | sleep |
| `M` | Medbay bed | 2×3 | lower radiation |
| `K` | Kitchen table | 3×2 | eat |
| `C` | Crew storage chest | 1×1 | open the chest |
| `P` | Planter | 3×1 | plant / harvest |
| `W` | Workbench | 3×2 | make parts from scrap |
| `R` | Radio console | 3×2 | talk to Earth |
| `S` | Spare parts shelf | 2×1 | search once |
| `T` | Flight console | 4×2 | launch |
| `L` | Suit locker | 1×2 | info |
| `Q` | Toilet door (hub) | 1×2 | the Botanist goes through it and makes fertilizer (once MOXIE works, once per sol); keep it away from the chest |
| `O` | Toilet | 1×2 | (no room uses it now: the hub's toilet is behind the `Q` door) |
| `G` | Light panel (greenhouse) | 2×1 | the Botanist tunes the grow lights (Light Recipe mini game) |
| `U` | Microscope desk (workshop) | 2×2 | the Pilot studies glowing rock samples (Rock Sample mini game) |

Rules: every row must be the **same length**, and the bottom row needs a **`D`**. The game checks both and tells you which row is wrong.
`floor:` picks the floor tiles: `metal`, `green` or `concrete`.

⚠️ The greenhouse must keep **6 planters** (`P`). The number is set in `game/rules/farm.js`, so tell the Game logic person if you change it.

The ship (`ship.js`) uses the same letters, plus `X` (the Builder's wire panel), `s` (the pilot seat), `1` `2` `3` (the 3 oxygen leaks) and `*` (where the crew starts). Keep one of each.

---

## Loot (`loot.js`)

Each loot point in the map names a **table**. For each table:
- `crateChance`: 0 to 1, the chance the spot is a crate instead of a single pile.
- `crateItems`: `[fewest, most]` piles inside a crate.
- `crate` and `ground` list `itemId: weight`. A bigger weight makes the item more likely; `0.5` is rare.

Item IDs are listed in `story/items.js`. **Repair parts are not in the loot tables:** the game places exactly what the 5 repairs need plus 1 spare of each, one per loot spot, spread as far apart as it can. `PART_PLACES` in `levels/loot.js` says which kinds of spot (crash, common, hazard) each part may go to; MOXIE's parts always go on the crash trail near the base. So you can't make the game unwinnable (tests/loot_seeds.mjs checks 2000 games).

`SHELF_LOOT` sets what's on the spare parts shelves (found once per game).

---

## Art (`art/`)

Everything is pixel art at 16 px per tile, drawn at 1× and scaled up by the game. **Keep the same file name and size** when you redraw something, and it just works.

| File(s) | Size | Notes |
|---|---|---|
| `tiles.png` | 80×64 | Map tiles, 5 × 4 grid of 16×16. Order matters (tile numbers are used in the map). |
| `astronaut-<job>.png` | 48×64 | 3 frames × 4 rows (down, left, right, up). Frame 0 = standing, 1 and 2 = steps. The visor colour `#d9a426` / shine `#fff7c2` gets swapped for the lobby's visor colours, so keep exactly those colours on the visor. |
| `b-<building>.png` | see files | Building pictures (hab 96×72, greenhouse 96×60, workshop 80×56, garage 96×56, comms 48×80, rocket 48×128 with its pad, no ladder, wreck 64×40). The hab shows in the game as the "Hub". |
| `eq-moxie.png`, `eq-generator.png`, `eq-generator-broken.png` | 30×26, 48×28 | Machines (MOXIE, fission generators) |
| `f-<furniture>.png` | width × height in tiles × 16 | Furniture (e.g. `f-bunk.png` 32×48) |
| `interior.png` | 128×16 | Indoor tiles: metal, -, green, concrete, wall top, wall face, window, door |
| `items.png` | 304×16 | 19 icons, one 16×16 icon per item. The icon number for each item is set in `game/rules/items.js`. Icon 17 is the fertilizer bag, 18 the glowing rock sample. |
| `f-toiletdoor.png`, `f-toilet.png`, `f-lightpanel.png`, `f-microscope.png` | 16×32, 16×32, 32×16, 32×32 | Furniture for the mini games (the hub's toilet door with a toilet sign, the old toilet, light panel, microscope desk) |
| `f-wirepanel.png` | 32×32 | The Builder's wire panel on the spaceship (the screws and wires are drawn in code) |
| `rover.png`, `crate.png`, `crate-open.png`, `chest.png`, `reporter.png` | see files | |

`make-art.py` makes all of the placeholder art. **Running it overwrites your hand-drawn PNGs**, so only use it to get the starter set back.

⚠️ **Needs the Game logic person:**
- A brand new picture (not a replacement) also needs a `this.load` line in `game/client/js/scenes/BootScene.js`.
- Some things are drawn with code, not image files: the mini game screens (molecules, atoms, cracks, sliders, heaters, the rev gauge, the microscope view, the stars and Earth), the sand mound round the stuck rover, the green glow under rock samples, the crash cutscene, the launch-day sky, the rocket flame, the voyage's stars and space rocks, leaks, crops in planters, the HUD and the compass. Changing how those look means changing code.

---

## Music and sounds (`audio/`)

**There are no audio files yet.** The game plays silently wherever a file is missing, so you can add them one at a time.

1. Make or find the sound. Use only sounds you made yourselves or ones with a licence that allows it (e.g. CC0 from freesound.org or OpenGameArt). Keep a note of where each one came from.
2. Save it as `.mp3`, `.ogg`, `.wav` or `.m4a` in `audio/music/` or `audio/sfx/`.
3. Name it to match `audio/sounds.js`, without the extension (e.g. `audio/sfx/pickup.wav` for `SFX.pickup`).
4. Reload the game.

Music loops (`earth`, `voyage`, `crash`, `mars_day`, `mars_night`, `win`, `lose`). Sound effects play once (`click`, `door`, `crate`, `pickup`, `drop`, `give`, `repair`, `plant`, `harvest`, `eat`, `rover`, `radio`, `alarm`, `knockout`, `todo`, `hit`, `launch`). `VOLUME` sets the loudness. Players press **M** to mute.

Tips: short sound effects (under 1 second), music loops under about 2 MB. Chiptune tools like [BeepBox](https://www.beepbox.co) or [jsfxr](https://sfxr.me) fit the 8-bit style.

⚠️ **Needs the Game logic person:** a sound for a *new* moment in the game (anything not listed in `sounds.js`) needs a line of code where it should play.

## The crater wall (Phase 10.9)

`levels/map/make-map.js` now makes the whole map a big round crater: everything outside a rounded oval is mountains (tiles 20–22 in `tiles.png`, all solid), with a rocky slope (tile 23) just inside. Tile 24 is free. The wreck and the Reactor Wreck moved inwards to fit. If you redraw `tiles.png`, keep it 5×5 tiles.
