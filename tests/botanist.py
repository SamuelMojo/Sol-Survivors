"""Botanist features: pink greenhouse (inside, outside, shared, after rejoin), the toilet door (the Botanist
vanishes for everyone while making fertilizer), and the new Frost Watch (gusts, close saves, the frost passes)."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

results = {}
def check(name, ok):
    results[name] = bool(ok); print(('  PASS ' if ok else '  FAIL ') + name)

async def eventually(t, code, want=True, secs=6):
    for _ in range(int(secs * 10)):
        if await t.world(code) == want: return True
        await asyncio.sleep(0.1)
    return False

async def stand_at(t, key, index=None):
    idx = 'null' if index is None else index
    await t.js(f"() => {{ const i = game.scene.getScene('Interior'); const f = i.furniture.find(f => f.key === '{key}' && ({idx} === null || f.index === {idx})); i.player.setPosition(f.cx, f.front + 2); }}")
    await asyncio.sleep(0.3)
    return await t.js("() => game.scene.getScene('Interior').target?.label")

async def main():
    async with async_playwright() as pw:
        browser, (A, B) = await open_tabs(pw, ['boA', 'boB'])
        code = await lobby_join(A, 'Ada', 'botanist', host=True)
        await lobby_join(B, 'Bo', 'builder', code=code)
        await asyncio.sleep(0.6)
        await A.page.evaluate("() => { document.getElementById('lobby-story').checked = false; }")
        await A.page.click('#lobby-start')
        for t in (A, B): await t.wait_world()
        await asyncio.sleep(2)
        # the Builder fixes MOXIE, the generators and the grow lights (by hand, shared with the crew)
        await B.world("(() => { for (const k of ['moxie', 'fission_generator', 'greenhouse_lights']) { w.equipment.get(k).broken = false; } w.equipment.refresh(); w.equipmentChanged(); return 1; })()")
        await asyncio.sleep(1.5)

        print('PINK GREENHOUSE')
        check('not pink before the lights are tuned', not await A.world('w.greenhousePink()') and not await A.world('w.greenhouseGlow.visible'))
        await A.world("(w.setLightsTuned(true, true), 1)"); await asyncio.sleep(0.5)
        check('pink outside after tuning (glow + tint)', await A.world('w.greenhouseGlow.visible && w.greenhouseImg.isTinted'))
        check("the crewmate's greenhouse is pink too", await eventually(B, 'w.greenhouseGlow.visible'))
        await A.world("(() => { const d = w.buildings.greenhouse.door; w.player.setPosition(d.x, d.y + 30); return 1; })()"); await asyncio.sleep(0.8)
        await A.shot('pink-outside')
        await A.world("(w.enterBuilding('greenhouse'), 1)"); await asyncio.sleep(1.2)
        check('pink inside the greenhouse', await A.js("(() => game.scene.getScene('Interior').pinkLight?.visible)()"))
        await A.shot('pink-inside')
        await A.world("(w.survival.min = 22 * 60, 1)"); await A.js("() => game.scene.getScene('Interior').leave()"); await asyncio.sleep(1.2)
        await A.world("(() => { const d = w.buildings.greenhouse.door; w.player.setPosition(d.x + 60, d.y + 40); return 1; })()"); await asyncio.sleep(0.8)
        await A.shot('pink-night')
        await A.world("(w.survival.min = 8 * 60, 1)")
        # rejoin: the pink comes back with the snapshot
        await B.page.reload(); await B.page.wait_for_selector('#lobby-name', state='visible')
        await B.page.fill('#lobby-name', 'Bo'); await B.page.click('#lobby-code-btn'); await B.wait_world(); await asyncio.sleep(2.5)
        check('still pink after a crewmate rejoins', await eventually(B, 'w.greenhouseGlow.visible'))

        print('TOILET DOOR')
        await A.world("(w.enterBuilding('hab'), 1)"); await asyncio.sleep(1.2)
        await B.world("(w.enterBuilding('hab'), 1)"); await asyncio.sleep(1.5)
        check('the hub has a toilet door, not a toilet', await A.js("(() => { const f = game.scene.getScene('Interior').furniture; return f.some(x => x.key === 'toiletdoor') && !f.some(x => x.key === 'toilet'); })()"))
        far = await A.js("(() => { const f = game.scene.getScene('Interior').furniture, d = f.find(x => x.key === 'toiletdoor'), c = f.find(x => x.key === 'chest'); return Math.hypot(d.cx - c.cx, d.y - c.y) / 16; })()")
        check(f'the door is away from the chest ({far:.1f} tiles)', far >= 6)
        print('  prompt:', await stand_at(A, 'toiletdoor'))
        await A.key('e'); await asyncio.sleep(0.8)
        check('the Botanist vanished (own screen)', await A.js("(() => game.scene.getScene('Interior').player.alpha < 0.2)()"))
        check("the door says IN USE", await A.js("(() => !!game.scene.getScene('Interior').inUse)()"))
        seen = await B.js("(() => { const o = [...game.scene.getScene('Interior').others.values()][0]; return o ? o.sprite.visible : 'none'; })()")
        check('the Botanist vanished on the crewmate\'s screen', seen is False)
        await A.shot('toilet-in-use')
        await asyncio.sleep(2.6)
        check('came back out with 1 fertilizer', await A.js("(() => game.scene.getScene('Interior').player.alpha === 1)()") and await A.world("w.inv.some(s => s && s.id === 'fertilizer')"))
        check('visible again for the crewmate', await B.js("(() => { const o = [...game.scene.getScene('Interior').others.values()][0]; return !!o?.sprite.visible; })()"))
        print('  builder prompt:', await stand_at(B, 'toiletdoor'))
        check("the Builder can't make fertilizer", 'Botanist' in (await B.js("() => game.scene.getScene('Interior').target?.label") or ''))
        await A.js("() => game.scene.getScene('Interior').leave()"); await asyncio.sleep(1)
        await browser.close()

        print('FROST WATCH (solo)')
        browser, (C,) = await open_tabs(pw, ['boC'])
        await C.goto('/?job=botanist&nobots'); await C.wait_world(); await asyncio.sleep(1.2)
        await C.world("(() => { for (const k of ['moxie', 'fission_generator', 'greenhouse_lights']) w.equipment.get(k).broken = false; w.equipment.refresh(); for (let i = 0; i < 4; i++) w.planters[i] = { seed: ['seeds_potato', 'seeds_tomato', 'seeds_cabbage', 'seeds_potato'][i], grown: 1 }; w.survival.min = 21 * 60 + 5; w.survival.frostSol = w.survival.sol; w.frost = { sol: 1, until: 23 * 60 + 30, playing: true }; w.openScreen('FrostGame', {}); return 1; })()")
        await asyncio.sleep(0.6)
        rates = await C.js("(() => game.scene.getScene('FrostGame').beds.map(b => +b.rate.toFixed(3)))()")
        print('  cooling speeds:', rates)
        check('4 beds, each cooling at its own speed', len(rates) == 4 and len(set(rates)) > 1)
        await C.js("(() => { const g = game.scene.getScene('FrostGame'); g.beds[0].warm = 0.2; })()")
        await C.page.keyboard.press('1'); await asyncio.sleep(0.2)
        check('a puff on a nearly frozen bed is a close save', await C.js("(() => game.scene.getScene('FrostGame').saves)()") == 1)
        gust = False
        for _ in range(80):
            for k in '1234': await C.page.keyboard.press(k)
            await asyncio.sleep(0.12)
            if await C.js("(() => { const g = game.scene.getScene('FrostGame'); return !!g.gust && g.elapsed >= g.gust.warnUntil; })()"): gust = True; break
        check('a cold gust blows during the night', gust)
        await C.shot('frost-gust')
        await C.js("(() => { const g = game.scene.getScene('FrostGame'); g.beds[3].warm = 0.01; g.beds[3].rate = 5; })()"); await asyncio.sleep(0.4)
        check('a bed left to cool freezes', await C.js("(() => game.scene.getScene('FrostGame').beds[3].frozen)()"))
        check('still playing before the frost passes', await C.js("(() => !game.scene.getScene('FrostGame').over)()"))
        print('  beds before the end:', await C.js("(() => game.scene.getScene('FrostGame').beds.map(b => [b.i, +b.warm.toFixed(2), b.frozen]))()"))
        await C.js("(() => { game.scene.getScene('FrostGame').elapsed = 19950; })()")
        for _ in range(30):
            await asyncio.sleep(0.2)
            if not await C.js("(() => game.scene.isActive('FrostGame'))()"): break
        check('the frost passes: the game is won', await C.world('w.frost === null'))
        print('  planters after:', await C.world("w.planters.slice(0, 4).map(p => [p.grown, !!p.frozen])"))
        check('only the frozen bed froze', await C.world("w.planters.slice(0, 4).map(p => !!p.frozen).join()") == 'false,false,false,true')
        ok = report([C])
        await browser.close()
    print('\nSUMMARY:', sum(results.values()), '/', len(results), 'passed')
    for k, v in results.items():
        if not v: print('  FAILED:', k)
    print('OK' if all(results.values()) and ok else 'FAILURES')

asyncio.run(main())
