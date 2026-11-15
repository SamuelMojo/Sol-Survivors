"""Full regression (solo): story -> interview -> voyage -> crash -> Mars (Pilot: stuck rover by the wreck),
rover stuck -> free -> drive -> garage -> drive out, ladder, crates, chests, night (bed), dust storm, flare,
and launch. Also ?job=builder and ?job=botanist load cleanly. No console errors."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

results = {}
def check(name, ok):
    results[name] = bool(ok); print(('  PASS ' if ok else '  FAIL ') + name)

async def wait_scene(t, key, secs=40):
    for _ in range(secs * 10):
        if key in await t.active(): return True
        await asyncio.sleep(0.1)
    return False

async def story_run(pw):
    print('STORY (Pilot): interview, boarding, voyage, crash, Mars')
    browser, (t,) = await open_tabs(pw, ['story'])
    await t.goto('/?job=pilot&story=1')
    await t.skip_crawl()                  # the opening crawl comes first
    check('interview starts', await wait_scene(t, 'Interview', 20))
    await asyncio.sleep(1.5)
    for _ in range(40):                                  # Space through the lines; answer my question with 1
        if 'Voyage' in await t.active(): break
        st = await t.js("() => { const s = game.scene.getScene('Interview'); return s && s.scene.isActive() ? [s.step, s.waitingSpace, s.boarding, s.opts.length, !!s.boarded.pilot, !!s.climbing.pilot] : null; }")
        if not st: break
        if st[3] and not st[1]: await t.page.keyboard.press('1')
        if st[2] and not st[5]: await t.js("() => game.scene.getScene('Interview').board('pilot')")
        await t.key(' '); await asyncio.sleep(0.9)
    await t.shot('interview-end')
    check('voyage starts', await wait_scene(t, 'Voyage', 30))
    await asyncio.sleep(2); await t.shot('voyage')
    check('crash cutscene', await wait_scene(t, 'Crash', 60))
    await t.shot('crash')
    for _ in range(8): await t.key(' '); await asyncio.sleep(0.6)
    check('Mars after the crash', await wait_scene(t, 'World', 20))
    await asyncio.sleep(1.5)
    if 'Menu' in await t.active(): await t.shot('arrival'); await t.key('e'); await asyncio.sleep(0.5)
    r = await t.world("[!!w.rover.stuck, Math.round(w.rover.x), Math.round(w.rover.y), Math.round(w.player.x), Math.round(w.player.y), w.blockedAt(w.player.x, w.player.y)]")
    print('  rover stuck, rover x/y, player x/y, player blocked:', r)
    check('rover starts stuck by the wreck (Pilot is a person)', r[0])
    check('player not blocked at the crash start', not r[5])
    check('player and rover are close (rover left, player right of the wreck)', r[1] < r[3] and abs(r[1] - r[3]) < 160)
    await t.shot('mars-start-stuck-rover')
    # Walk to the rover with the keys (not teleporting), to prove it can be reached
    for _ in range(60):
        lbl = await t.world('w.target?.label')
        if lbl == 'Free the rover from the sand': break
        dx = await t.world('Math.sign(w.rover.x - w.player.x)'); dy = await t.world('Math.sign(w.rover.y + 14 - w.player.y)')
        key = 'ArrowLeft' if dx < 0 else 'ArrowRight'
        await t.key(key, 120)
        if dy: await t.key('ArrowDown' if dy > 0 else 'ArrowUp', 80)
    check('walked to the stuck rover', (await t.world('w.target?.label')) == 'Free the rover from the sand')
    ok = report([t]); check('story: no console errors', ok)
    await browser.close()

async def mars_run(pw):
    print('MARS (Pilot solo, computer Builder + Botanist)')
    browser, (t,) = await open_tabs(pw, ['mars'])
    await t.goto('/?job=pilot'); await t.wait_world(); await asyncio.sleep(1.5)
    # rover: free it, drive, park in the garage, drive out again
    await t.world("(() => { w.freeRover(); w.player.setPosition(w.rover.x, w.rover.y + 16); return 1; })()"); await asyncio.sleep(0.4)
    await t.key('e'); await asyncio.sleep(0.5)
    check('driving after freeing', await t.world('w.rover.driving'))
    await t.world("(() => { const d = w.buildings.garage.door; w.rover.sprite.setPosition(d.x, d.y + 20); w.player.setPosition(d.x, d.y + 20); return 1; })()"); await asyncio.sleep(0.4)
    print('  target at the garage:', await t.world('w.target?.label'))
    await t.key('e'); await asyncio.sleep(0.5)
    check('rover parked in the garage', await t.world('w.rover.inGarage && !w.rover.driving'))
    await t.world("(() => { w.enterBuilding('garage'); return 1; })()"); await asyncio.sleep(0.9)
    await t.js("() => { const i = game.scene.getScene('Interior'); i.player.setPosition(i.roverSpot.x, i.roverSpot.y + 10); }"); await asyncio.sleep(0.3)
    print('  garage target:', await t.js("() => game.scene.getScene('Interior').target?.label"))
    await t.key('e'); await asyncio.sleep(1.0)
    check('drove out of the garage', await t.world('w.rover.driving && !w.rover.inGarage && !w.inside'))
    await t.world("(() => { w.exitRover(); return 1; })()"); await asyncio.sleep(0.5)
    # ladder
    await t.world("(() => { const L = w.buildings.rocket.ladder; w.player.setPosition(L.x, L.foot + 4); return 1; })()"); await asyncio.sleep(0.3)
    await t.key('ArrowUp', 3500); await asyncio.sleep(1.0)
    check('climbed the ladder into the rocket', (await t.world('w.inside')) == 'rocket')
    await t.js("() => game.scene.getScene('Interior').leave()"); await asyncio.sleep(0.9)
    check('back out at the top of the ladder', await t.world('w.onLadder'))
    await t.key('ArrowDown', 3500); await asyncio.sleep(0.3)
    check('climbed down the ladder', not await t.world('w.onLadder'))
    # crates
    n0 = await t.world('w.loot.ground.length + w.inv.filter(Boolean).length')   # (a crate may hold 1 item, picked up at once)
    await t.world("(() => { const c = w.loot.crates.find(c => !c.open); w._c = c.i; w.player.setPosition(c.x, c.y + 12); return 1; })()"); await asyncio.sleep(0.4)
    print('  crate target:', await t.world('w.target?.label'))
    await t.key('e'); await asyncio.sleep(0.8)
    print('  crate after E (open, ground+bag before/after, screens):', await t.world('[w.loot.crates.find(c => c.i === w._c).open, w.loot.ground.length + w.inv.filter(Boolean).length, w.uiOpen, w.target?.label]'), n0, await t.active())
    # (computer crewmates pick up loose seeds too, so look for this crate's own piles, or that the bag grew)
    check('crate opened and spilled items', await t.world("w.loot.crates.find(c => c.i === w._c).open && (w.loot.ground.some(g => g.gid.startsWith('c' + w._c + '-')) || [...w.loot.taken].some(g => g.startsWith('c' + w._c + '-')))"))
    inv0 = await t.world('w.inv.filter(Boolean).reduce((a, s) => a + s.n, 0)')
    await t.world("(() => { const c = w.loot.crates.find(c => c.i === w._c); w.loot.addGround(c.x + 30, c.y + 20, 'scrap', 1, null, null, 'test-pile'); const g = w.loot.ground.find(g => g.gid.startsWith('c' + w._c + '-')) ?? w.loot.ground.find(g => g.gid === 'test-pile'); w.player.setPosition(g.x, g.y); return 1; })()"); await asyncio.sleep(0.8)
    inv1 = await t.world('w.inv.filter(Boolean).reduce((a, s) => a + s.n, 0)')
    check('picked up a crate item', inv1 > inv0)
    # chest + dropping indoors
    await t.world("(() => { w.enterBuilding('hab'); return 1; })()"); await asyncio.sleep(0.9)
    await t.js("() => { const i = game.scene.getScene('Interior'); const f = i.furniture.find(f => f.key === 'chest'); i.player.setPosition(f.cx, f.front + 2); }"); await asyncio.sleep(0.3)
    await t.key('e'); await asyncio.sleep(0.5)
    check('crew chest opens', 'Inventory' in await t.active())
    await t.key('Escape'); await asyncio.sleep(0.4)
    await t.js("() => { const i = game.scene.getScene('Interior'); i.player.setPosition(100, 120); }"); await asyncio.sleep(0.3)
    await t.world("(() => { w.select(0); return 1; })()"); await t.key('q'); await asyncio.sleep(0.4)
    check('dropped an item indoors', (await t.world("(w.roomPiles.hab ?? []).length")) >= 1)
    # night: dark outside, then bed -> morning
    await t.js("() => game.scene.getScene('Interior').leave()"); await asyncio.sleep(0.9)
    await t.world("(() => { w.survival.min = 23 * 60; return 1; })()"); await asyncio.sleep(1.0)
    await t.shot('night-outside')
    check('night time (not daylight)', not await t.world('w.survival.daylight'))
    storm = await t.world("w.survival.nightStorms[0]")
    await t.world(f"(() => {{ const a = {storm[0]}; w.survival.sol = 1 + Math.floor(a / 1440); w.survival.min = a % 1440 + 1; return 1; }})()"); await asyncio.sleep(0.6)
    check('dust storm on', await t.world('w.survival.isStorm()'))
    await t.shot('dust-storm')
    await t.world("(() => { w.survival.sol = 1; w.survival.min = 23 * 60; w.enterBuilding('hab', 'bunk'); return 1; })()"); await asyncio.sleep(1.0)
    await t.js("() => { const i = game.scene.getScene('Interior'); const f = i.furniture.find(f => f.key === 'bunk'); i.player.setPosition(f.cx, f.front + 2); }"); await asyncio.sleep(0.3)
    await t.key('e'); await asyncio.sleep(0.5)
    check('in bed (night screen)', 'Night' in await t.active())
    for _ in range(60):
        if await t.world('w.survival.sol') >= 2 and 'Night' not in await t.active(): break
        await asyncio.sleep(0.5)
    check('slept to the next morning', await t.world('w.survival.sol') >= 2)
    if 'Menu' in await t.active(): await t.key('e'); await asyncio.sleep(0.4)
    # flare
    f = await t.world('w.survival.flareOn()')
    await t.world(f"(() => {{ w.survival.min = {f['start']} + 1; return 1; }})()"); await asyncio.sleep(0.6)
    check('space storm (flare) active', await t.world('!!w.survival.flareActive'))
    await t.world(f"(() => {{ w.survival.min = {f['end']} + 1; return 1; }})()"); await asyncio.sleep(0.4)
    # launch: everything fixed + 5 rocket parts, then the flight console
    await t.js("() => game.scene.getScene('Interior')?.scene.isActive() && game.scene.getScene('Interior').leave()"); await asyncio.sleep(0.9)
    await t.world("(() => { for (const e of w.equipment.list) { e.broken = false; if (e.key === 'rocket') e.progress = e.def.steps; } w.equipment.refresh(); w.equipmentChanged(); return 1; })()")
    check('launch check is empty', (await t.world('w.launchCheck().length')) == 0)
    await t.world("(() => { w.enterBuilding('rocket'); return 1; })()"); await asyncio.sleep(0.9)
    await t.js("() => { const i = game.scene.getScene('Interior'); const f = i.furniture.find(f => f.key === 'console'); i.player.setPosition(f.cx, f.front + 2); }"); await asyncio.sleep(0.3)
    await t.key('e'); await asyncio.sleep(0.5)
    await t.shot('flight-console')
    await t.page.keyboard.press('1'); await asyncio.sleep(1.5)
    check('launched (End scene, win)', 'End' in await t.active())
    await t.shot('end')
    ok = report([t]); check('mars: no console errors', ok)
    await browser.close()

async def jobs_run(pw):
    print('QUICK TESTS for each job')
    browser, tabs = await open_tabs(pw, ['qbuilder', 'qbotanist', 'qpilot'])
    for t, job in zip(tabs, ['builder', 'botanist', 'pilot']):
        await t.goto(f'/?job={job}'); await t.wait_world()
    await asyncio.sleep(3)
    for t, job in zip(tabs, ['builder', 'botanist', 'pilot']):
        r = await t.world('[w.job, !!w.rover.stuck, !!w.rover.inGarage, w.bots.list.length, w.nextTask()?.id]')
        print(f'  {job}:', r)
        check(f'{job}: rover {"stuck" if job == "pilot" else "in the garage"}', r[1] if job == 'pilot' else r[2])
    ok = report(tabs); check('quick tests: no console errors', ok)
    await browser.close()

async def main():
    async with async_playwright() as pw:
        await jobs_run(pw)
        await mars_run(pw)
        await story_run(pw)
    print('\nSUMMARY:', sum(results.values()), '/', len(results), 'passed')
    for k, v in results.items():
        if not v: print('  FAILED:', k)
    print('OK' if all(results.values()) else 'FAILURES')

if __name__ == "__main__": asyncio.run(main())
