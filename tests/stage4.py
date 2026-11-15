"""Stage 4 tests: Pilot mini games. Stuck rover + Unstick, rock samples + microscope, Hit Earth."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

async def enter(t, building, at=None):
    await t.world(f"(() => {{ w.enterBuilding('{building}', {('null' if not at else repr(at))}); return 1; }})()")
    await asyncio.sleep(0.8)

async def stand_at(t, key):
    await t.js(f"() => {{ const i = game.scene.getScene('Interior'); const f = i.furniture.find(f => f.key === '{key}'); i.player.setPosition(f.cx, f.front + 2); }}")
    await asyncio.sleep(0.25)
    return await t.js("() => game.scene.getScene('Interior').target?.label")

async def how_lines(t, key):
    """How many lines the how-to text takes (must be 1 or 2) and its width (<= 340)."""
    return await t.js(f"() => {{ const s = game.scene.getScene('{key}'); return [s.howText.text, Math.round(s.howText.height), Math.round(s.howText.width)]; }}")

def check_how(h):
    print('    how-to:', h)
    assert h[1] <= 34 and h[2] <= 340, 'how-to text too big'

async def main():
    async with async_playwright() as pw:
        browser, (t, b) = await open_tabs(pw, ['pilot', 'builder'])
        await t.goto('/?job=pilot'); await b.goto('/?job=builder')
        await t.wait_world(); await b.wait_world(); await asyncio.sleep(1.2)

        print('BUILDER TAB: computer Pilot -> rover in the garage, not stuck')
        r = await b.world('[!!w.rover.inGarage, !!w.rover.stuck]'); print('  inGarage, stuck:', r)
        assert r == [True, False]

        print('STUCK ROVER (human Pilot)')
        r = await t.world('[!!w.rover.inGarage, !!w.rover.stuck, Math.round(w.rover.x), Math.round(w.rover.y)]'); print('  inGarage, stuck, x, y:', r)
        assert r[0] is False and r[1] is True
        await t.world("(() => { w.player.setPosition(w.rover.x, w.rover.y + 16); return 1; })()"); await asyncio.sleep(0.4)
        print('  target:', await t.world('w.target?.label'))
        await t.shot('rover-stuck-world')
        print('  drive blocked? label is the unstick prompt:', await t.world("w.target?.label === 'Free the rover from the sand'"))
        await t.key('e'); await asyncio.sleep(0.5)
        assert 'UnstickGame' in await t.active()
        check_how(await how_lines(t, 'UnstickGame'))
        await t.shot('unstick-open')
        # Esc quits: still stuck
        await t.key('Escape'); await asyncio.sleep(0.4)
        print('  after Esc active:', await t.active(), 'stuck:', await t.world('w.rover.stuck'), 'uiOpen:', await t.world('w.uiOpen'))
        assert 'UnstickGame' not in await t.active() and await t.world('w.rover.stuck')
        await asyncio.sleep(0.3)
        await t.key('e'); await asyncio.sleep(0.5)
        # Fail: hammer Space -> overheats
        for _ in range(40):
            await t.key(' ', 20)
            if await t.js("() => { const s = game.scene.getScene('UnstickGame'); return s.coolUntil > s.time.now; }"): break
        await asyncio.sleep(0.1)
        st = await t.js("() => { const s = game.scene.getScene('UnstickGame'); return [s.revs, s.coolUntil > s.time.now, s.howText.text]; }")
        print('  after hammering (revs, cooling, msg):', st); await t.shot('unstick-hot')
        assert st[1]
        await asyncio.sleep(1.4)
        # Play it properly: tap whenever the revs fall below the middle of the green band
        for _ in range(200):
            s = await t.js("() => { const s = game.scene.getScene('UnstickGame'); return s && s.scene.isActive() ? [s.revs, s.green, s.won] : null; }")
            if not s or s[2]: break
            if s[0] < 0.55: await t.key(' ', 20)
            await asyncio.sleep(0.05)
        await asyncio.sleep(0.6); await t.shot('unstick-won')
        print('  stuck after win:', await t.world('w.rover.stuck'))
        assert not await t.world('w.rover.stuck')
        await t.no_fact(); await asyncio.sleep(0.4)
        print('  active:', await t.active())
        await t.world("(() => { w.player.setPosition(w.rover.x, w.rover.y + 16); return 1; })()"); await asyncio.sleep(0.4)
        print('  target now:', await t.world('w.target?.label'))
        await t.key('e'); await asyncio.sleep(0.6)
        print('  driving:', await t.world('w.rover.driving'), 'drive to-do:', await t.world("w.tasks.pilot.done.has('drive')"))
        assert await t.world('w.rover.driving')
        await t.key('ArrowRight', 600)
        await t.world("(() => { w.parkInGarage(); return 1; })()"); await asyncio.sleep(0.4)
        print('  garage after parking:', await t.world('w.rover.inGarage'), 'snapshot rover:', await t.world('w.snapshot().rover'))

        print('ROCK SAMPLES')
        rocks = await t.world("w.loot.ground.filter(g => g.id === 'rock_sample').map(g => [g.gid, g.x, g.y, w.zones.find(z => z.rect.contains(g.x, g.y))?.name])")
        print('  pilot rocks:', rocks)
        brocks = await b.world("w.loot.ground.filter(g => g.id === 'rock_sample').length")
        assert len(rocks) == 3 and len({r[3] for r in rocks}) == 3 and not any(r[3] in ('Reactor Wreck', 'Jezero Base') for r in rocks)
        assert brocks == 3
        # same seed in two tabs -> same spots
        s1 = await t.js("() => { const w = game.scene.getScene('World'); w.loot.ground.filter(g => g.id === 'rock_sample').forEach(g => w.loot.removeGround(g)); w.startData.seed = 12345; w.placeRockSamples(); return w.loot.ground.filter(g => g.id === 'rock_sample').map(g => [g.gid, g.x, g.y]); }")
        s2 = await b.js("() => { const w = game.scene.getScene('World'); w.loot.ground.filter(g => g.id === 'rock_sample').forEach(g => w.loot.removeGround(g)); w.startData.seed = 12345; w.placeRockSamples(); return w.loot.ground.filter(g => g.id === 'rock_sample').map(g => [g.gid, g.x, g.y]); }")
        print('  same seed same spots:', s1 == s2, s1)
        assert s1 == s2
        # The Builder can't pick them up
        await b.world("(() => { const g = w.loot.ground.find(g => g.gid === 'rock-0'); w.player.setPosition(g.x, g.y); return 1; })()"); await asyncio.sleep(0.8)
        print('  builder has rock?', await b.world("w.inv.some(s => s && s.id === 'rock_sample')"), 'rock still there:', await b.world("w.loot.ground.some(g => g.gid === 'rock-0')"))
        await b.shot('rock-builder')
        assert not await b.world("w.inv.some(s => s && s.id === 'rock_sample')")
        # The Pilot: walk to the first rock (map target first)
        await t.world("(() => { for (const id of ['moxie', 'drive', 'dunes', 'parts']) w.tasks.pilot.done.add(id); w.game.events.emit('tasks'); return 1; })()")
        print('  next:', await t.world('w.nextTask().id'))
        mt = await t.js("() => { const h = game.scene.getScene('Hud'); const m = h.minimap; const tg = m.target(); return tg && [tg.gid ?? null, Math.round(tg.x), Math.round(tg.y)]; }")
        print('  map target (no rock in bag):', mt)
        await t.world("(() => { const g = w.loot.ground.find(g => g.gid === 'rock-0'); w.player.setPosition(g.x, g.y + 20); w.cameras.main.centerOn(g.x, g.y); return 1; })()"); await asyncio.sleep(0.5)
        await t.shot('rock-glow')
        await t.world("(() => { const g = w.loot.ground.find(g => g.gid === 'rock-0'); w.player.setPosition(g.x, g.y); return 1; })()"); await asyncio.sleep(0.8)
        print('  pilot has rock:', await t.world("w.inv.filter(s => s && s.id === 'rock_sample').map(s => s.n)"))
        mt = await t.js("() => { const tg = game.scene.getScene('Hud').minimap.target(); const d = game.scene.getScene('World').buildings.workshop.door; return [Math.round(tg.x), Math.round(tg.y), d.x, d.y]; }")
        print('  map target with a rock (should be the workshop door):', mt)
        assert mt[0] == mt[2] and mt[1] == mt[3]
        await t.js("() => { game.scene.getScene('Hud').minimap.big = true; game.scene.getScene('Hud').minimap.layout(); }"); await asyncio.sleep(0.6)
        await t.shot('rock-minimap')
        await t.js("() => { game.scene.getScene('Hud').minimap.big = false; game.scene.getScene('Hud').minimap.layout(); }")
        await enter(t, 'workshop')
        print('  microscope prompt:', await stand_at(t, 'microscope'))
        await t.key('e'); await asyncio.sleep(0.5)
        assert 'RockGame' in await t.active()
        check_how(await how_lines(t, 'RockGame'))
        ans = await t.js("() => game.scene.getScene('RockGame').answer")
        await t.shot('rock-open')
        idx = ['olivine', 'hematite', 'carbonate'].index(ans)
        wrong = (idx + 1) % 3
        await t.page.keyboard.press(str(wrong + 1)); await asyncio.sleep(0.4)
        print('  answer:', ans, 'won after wrong pick:', await t.js("() => game.scene.getScene('RockGame').won"))
        await t.shot('rock-wrong')
        await asyncio.sleep(0.5)
        await t.page.keyboard.press(str(idx + 1)); await asyncio.sleep(1.8)
        await t.shot('rock-won')
        print('  won:', await t.js("() => game.scene.getScene('RockGame').won"), 'rocks left:', await t.world("w.inv.filter(s => s && s.id === 'rock_sample').length"), 'progress:', await t.world('w.tasks.pilot.progress.rocks'))
        await t.no_fact(); await asyncio.sleep(0.4)
        # Esc with a sample: nothing used up
        await t.world("(() => { w.inv[5] = { id: 'rock_sample', n: 2 }; w.invChanged(); return 1; })()")
        await asyncio.sleep(0.3); await t.key('e'); await asyncio.sleep(0.5)
        assert 'RockGame' in await t.active()
        await t.key('Escape'); await asyncio.sleep(0.4)
        print('  after Esc, samples:', await t.world("w.inv.filter(s => s && s.id === 'rock_sample').map(s => s.n)"))
        for _ in range(2):
            await asyncio.sleep(0.3)
            await t.key('e'); await asyncio.sleep(0.5)
            ans = await t.js("() => game.scene.getScene('RockGame').answer")
            await t.page.keyboard.press(str(['olivine', 'hematite', 'carbonate'].index(ans) + 1)); await asyncio.sleep(1.6)
            print('    loop: active', await t.active(), 'progress', await t.world('w.tasks.pilot.progress.rocks'))
            await t.no_fact(); await asyncio.sleep(0.4)
        print('  rocks to-do done:', await t.world("w.tasks.pilot.done.has('rocks')"), 'samples left:', await t.world("w.inv.filter(s => s && s.id === 'rock_sample').length"))
        assert await t.world("w.tasks.pilot.done.has('rocks')")
        print('  prompt with no sample:', await stand_at(t, 'microscope'))
        await t.js("() => game.scene.getScene('Interior').leave()"); await asyncio.sleep(0.8)

        print('HIT EARTH')
        await t.world("(() => { for (const k of ['fission_generator', 'laser_comms']) w.equipment.get(k).broken = false; w.equipment.refresh(); return 1; })()")
        await enter(t, 'comms')
        print('  console prompt:', await stand_at(t, 'radio'))
        await t.key('e'); await asyncio.sleep(0.5)
        opts = await t.js("() => game.scene.getScene('Menu').options().map(o => o.label)"); print('  options:', opts)
        assert len(opts) == 4
        await t.shot('earth-menu')
        await t.page.keyboard.press('4'); await asyncio.sleep(0.5)
        assert 'EarthGame' in await t.active()
        check_how(await how_lines(t, 'EarthGame'))
        await t.page.mouse.move(*await canvas_xy(t, 100, 100)); await asyncio.sleep(2)
        print('  bar while off target:', await t.js("() => game.scene.getScene('EarthGame').bar"))
        await t.key('Escape'); await asyncio.sleep(0.4)
        print('  after Esc:', await t.active(), 'earth to-do:', await t.world("w.tasks.pilot.done.has('earth')"))
        await t.key('e'); await asyncio.sleep(0.4); await t.page.keyboard.press('4'); await asyncio.sleep(0.4)
        shot = False
        for i in range(160):
            e = await t.js("() => { const s = game.scene.getScene('EarthGame'); return s.scene.isActive() ? [s.earth.x, s.earth.y, s.won, s.bar] : null; }")
            if not e or e[2]: break
            await t.page.mouse.move(*await canvas_xy(t, e[0] + 2, e[1] + 1))
            if not shot and e[3] > 0.4: await t.shot('earth-playing'); shot = True
            await asyncio.sleep(0.08)
        await asyncio.sleep(0.6); await t.shot('earth-won')
        print('  earth to-do:', await t.world("w.tasks.pilot.done.has('earth')"), 'messages queued:', await t.world('w.messages.length'))
        assert await t.world("w.tasks.pilot.done.has('earth')")
        await t.no_fact(); await asyncio.sleep(0.4)
        # The Builder sees only the 3 old options
        await b.world("(() => { for (const k of ['fission_generator', 'laser_comms']) w.equipment.get(k).broken = false; w.equipment.refresh(); return 1; })()")
        await enter(b, 'comms'); await stand_at(b, 'radio'); await b.key('e'); await asyncio.sleep(0.5)
        bopts = await b.js("() => game.scene.getScene('Menu').options().map(o => o.label)"); print('  builder options:', bopts)
        assert len(bopts) == 3

        ok = report([t, b])
        await browser.close()
        print('OK' if ok else 'ERRORS')

if __name__ == "__main__": asyncio.run(main())
