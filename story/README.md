# 📖 Story & NASA data

This folder holds **every word players read** in the story and the facts, plus **the real NASA numbers** the game is built on. You can edit all of it without touching game code.

After any change: save the file and **reload the browser**.
Quick tests: `http://localhost:3000/?job=pilot&story=1` plays the whole story solo. `?job=pilot` jumps straight to Mars.

| File | What players see |
|---|---|
| `intro.js` | The opening crawl: the yellow words that slide up into space at the very start ("THE YEAR IS 2041..."), and how many seconds it takes |
| `interview.js` | Scene One: the reporter's questions, 3 answers per job, the reporter's replies, the bonus item for each answer |
| `voyage.js` | Scene Two: each job's emergency task (title, how to do it, fact) and the story cards |
| `crash.js` | The 5 crash cutscene captions, the first message on Mars, and `HOME`: the "make it back before it's too late" lines (machines panel, menu, flight console) |
| `endings.js` | The win screen (results, stars) and the lesson shown when the crew fails |
| `jobs.js` | Job names, one-line goals, lobby descriptions, every to-do list item, and "Only the Builder can…" messages |
| `items.js` | Each item's name, description and real-science fact (backpack screen) |
| `machines.js` | The 5 machines: name, what they do, the "fixed!" message, a fact |
| `places.js` | Facts for the 7 map areas (shown the first time you walk in) and the 6 buildings (shown when you go inside) |
| `radio.js` | Mission Control's advice, messages from home, and the crew's quick shouts (R) |
| `minigames.js` | Every mini game: its title, the one-line how-to, messages (like "Try again!") and the real fact shown on the big fact screen when you win. Also the fact screen's own words, the Exit to main menu box, and Frost Watch's gust and close-save messages. Also the words for the toilet and fertilizer, the light panel, the microscope desk, the stuck rover and the Hit Earth line on the comms console |
| `nasa-data.js` | REAL numbers: radiation, real solar flares, Earth–Mars signal delay, sol length, trip times |

---

## How to edit safely

These are JavaScript files, but you only change the **text between quotes**.

```js
  medkit: {
    name: 'Medkit',                                   ← change the words
    desc: 'Radiation medicine. Press F to lower your radiation level.',
    fact: 'On Mars, the nearest hospital is months away...',
  },
```

- **Keep the IDs** on the left (`medkit:`, `moxie:`, `botanist:`, to-do IDs like `seeds:`). The game finds the text by them.
- **Apostrophes:** inside `'single quotes'`, write `\'`, e.g. `'It\'s true!'`. Or switch the quotes to double quotes: `"It's true!"`.
- **`${...}` is filled in by the game.** In text inside backticks (`` `like this` ``), `${name}` becomes the astronaut's name, `${s.sol}` the sol number, and so on. You can move these around or remove them, but don't invent new ones.
- `\n` starts a new line.
- Keep sentences short and words simple: players are 7–12 years old.
- If the game goes black after an edit, open the browser console (F12). It names the file and line with the mistake (usually a missing quote or comma).

Each file explains its own fields at the top.

### Rules for some files

- **`interview.js`:** exactly **3 answers** per job (players press 1, 2 or 3). `bonus: ['seeds_cabbage', 2]` gives 2 red cabbage seeds on Mars. Item IDs are the keys in `items.js`.
- **`crash.js`:** keep **5 shots** in the same order. The pictures are drawn by code to match them. `ms` is how long each shot stays on screen.
- **`places.js`:** area names must match the zone names in the map exactly (Level design's `levels/map/mars.json`).
- **`minigames.js`:** the IDs (`moxie`, `atom`, `weld`, `unstick`, `rocks`...) must stay the same. Keep the `how` lines short: they must fit on one or two lines at the bottom of a small frame. Facts must be true; where the game is simpler than real life, say so with `GAME:`.
- **`jobs.js`:** the NEXT line at the top of the screen must fit on one line. If a to-do's text is too long for it, put a shorter version in `TODO_HUD` (same ID).
- **`jobs.js`:** the to-do *text* is here, but *when* a to-do ticks off is game logic (`game/rules/tasks.js`). If you change what a to-do asks for, the Game logic person has to change its check too.

---

## NASA data (`nasa-data.js`)

These are the real-world numbers the game rules use, for example the Mars-surface radiation dose measured by Curiosity, the biggest storm dose, and the 6 real X-class flares from NASA's DONKI archive that the in-game flares are modelled on.

- When you update a number, add a comment saying **where it came from** (mission, paper, NASA page).
- Changing a number **changes the game** (e.g. a bigger flare dose makes flares more dangerous). Tell the Game logic person so they can check the balance still works.
- The game labels everything as **REAL** (from data) or **GAME** (simplified for play). The GAME numbers live in `game/rules/survival.js`. If you think a GAME simplification is misleading, raise it with the Game logic person.

Good sources: NASA's Mars Exploration pages, the Curiosity RAD papers, DONKI (kauai.ccmc.gsfc.nasa.gov/DONKI), and NASA's Human Research Program.

---

## What's NOT in this folder (needs the Game logic person)

Some words are still written inside the game code, because they're built from live game numbers or tied to how a screen works:

- Short in-game messages and hints, e.g. "Bag full!", "Your suit is out of air!", the morning report, flare warnings (`game/client/js/scenes/*.js` and `game/client/js/systems/Survival.js`)
- Menu and button labels, the controls hint, the voyage mini-game instructions on the panels themselves (the Mars mini game words ARE here, in `minigames.js`)
- The labels on the HUD (FOOD / OXYGEN / RADIATION, "5 MACHINES")

If you want to change any of those, write down the new wording and ask the Game logic person to put it in.

Adding a **new** kind of story moment (a new scene, a new item, a new machine, a new ending) also needs code. The words go here; the Game logic person makes the game use them.
