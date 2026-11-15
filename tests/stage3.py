"""Stage 3 tests: Botanist toilet/fertilizer, Light Recipe, Frost Watch, growth rates."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

async def enter(t, building, at=None):
    await t.world(f"(() => {{ w.enterBuilding('{building}', {('null' if not at else repr(at))}); return 1; }})()")
    await asyncio.sleep(0.8)

async def stand_at(t, key, index=None):
    """Stand in front of a piece of furniture in the current room."""
    idx = 'null' if index is None else index
    await t.js(f"() => {{ const i = game.scene.getScene('Interior'); const f = i.furniture.find(f => f.key === '{key}' && ({idx} === null || f.index === {idx})); i.player.setPosition(f.cx, f.front + 2); }}")
    await asyncio.sleep(0.25)
    return await t.js("() => game.scene.getScene('Interior').target?.label")

async def main():
    async with async_playwright() as pw:
        browser, (t,) = await open_tabs(pw, ['botanist'])
        await t.goto('/?job=botanist&nobots')
        await t.wait_world(); await asyncio.sleep(1)
        # fix MOXIE + generators + lights by hand (the Builder's job)
        await t.world("(() => { for (const k of ['moxie', 'fission_generator', 'greenhouse_lights']) w.equipment.get(k).broken = false; w.equipment.refresh(); w.inv[2] = { id: 'seeds_potato', n: 3 }; w.invChanged(); return 1; })()")

        print('TOILET')
        await enter(t, 'hab')
        print('  prompt:', await stand_at(t, 'toiletdoor'))
        await t.key('e'); await asyncio.sleep(3.2)
        print('  active:', await t.active(), 'fertilizer:', await t.world("w.inv.filter(s => s && s.id === 'fertilizer').map(s => s.n)"), 'fertSol:', await t.world('w.fertSol'))
        await t.shot('toilet-fact')
        await t.key('e'); await asyncio.sleep(0.3)
        await stand_at(t, 'toiletdoor'); await t.key('e'); await asyncio.sleep(1.6)     # again: already made today
        print('  second try still 1 bag:', await t.world("w.inv.filter(s => s && s.id === 'fertilizer').map(s => s.n)"))
        await t.js("() => game.scene.getScene('Interior').leave()"); await asyncio.sleep(0.8)

        print('GREENHOUSE: plant, fertilize, light panel')
        await enter(t, 'greenhouse')
        await t.world("(() => { w.sel = 2; w.game.events.emit('sel', 2); return 1; })()")
        print('  planter prompt:', await stand_at(t, 'planter', 0))
        await t.key('e'); await asyncio.sleep(1.5)
        print('  planted:', await t.world('w.planters[0]'), 'active:', await t.active())
        if 'Menu' in await t.active(): await t.key('e'); await asyncio.sleep(0.3)
        await t.world("(() => { w.sel = 1; w.game.events.emit('sel', 1); return 1; })()")   # fertilizer slot
        print('  fert prompt:', await stand_at(t, 'planter', 0))
        await t.key('e'); await asyncio.sleep(1.3)
        print('  fert:', await t.world('w.fert'), 'bag fert left:', await t.world("w.inv.filter(s => s && s.id === 'fertilizer').length"), 'tasks:', await t.world('[...w.tasks.botanist.done]'))
        await t.shot('fertilized-bed')
        # growth: not tuned (0.5) x fertilized (2) = 1.0 on bed 0; plant bed 1 unfertilized -> 0.5
        await t.world("(() => { w.planters[1] = { seed: 'seeds_potato', grown: 0 }; w.planters[0].grown = 0; return 1; })()")
        await asyncio.sleep(3)
        g = await t.world("[w.planters[0].grown, w.planters[1].grown, w.lightsOk()]"); print('  grown after 3 s (bed0 fert, bed1 plain, tuned?):', g)
        assert abs(g[0] - 2 * g[1]) < 2
        print('  panel prompt:', await stand_at(t, 'lightpanel'))
        await t.key('e'); await asyncio.sleep(0.4)
        assert 'LightGame' in await t.active()
        await t.shot('light-open')
        tgt = await t.js("() => game.scene.getScene('LightGame').target")
        # keyboard: pick each slider and nudge to target
        for i in range(3):
            await t.page.keyboard.press(str(i + 1))
            cur = 0.5; steps = round((tgt[i] - cur) / 0.05)
            for _ in range(abs(steps)): await t.page.keyboard.press('ArrowUp' if steps > 0 else 'ArrowDown'); await asyncio.sleep(0.03)
        await asyncio.sleep(0.8)
        print('  val vs target:', await t.js("() => [game.scene.getScene('LightGame').val, game.scene.getScene('LightGame').target]"), 'won:', await t.js("() => game.scene.getScene('LightGame').won"))
        await t.shot('light-won')
        await t.key('e'); await asyncio.sleep(0.3)
        print('  tuned:', await t.world('w.lightsTuned'), 'tasks:', await t.world('[...w.tasks.botanist.done]'))

        print('FROST')
        await t.js("() => game.scene.getScene('Interior').leave()"); await asyncio.sleep(0.8)
        await t.world("(() => { w.survival.min = 21 * 60 + 1; return 1; })()"); await asyncio.sleep(0.6)
        print('  frost:', await t.world('w.frost'))
        await enter(t, 'greenhouse'); await asyncio.sleep(1.0)
        print('  active:', await t.active())
        assert 'FrostGame' in await t.active()
        await asyncio.sleep(1.5); await t.shot('frost-open')
        # keep bed 1 warm, let bed 2 freeze; then the frost passes
        for _ in range(16):
            await t.page.keyboard.press('1'); await asyncio.sleep(0.5)
        await t.js("() => { game.scene.getScene('FrostGame').elapsed = 19900; }")
        for _ in range(40):
            await asyncio.sleep(0.25)
            if await t.js("() => game.scene.getScene('FrostGame').won || !game.scene.isActive('FrostGame')"): break
        await asyncio.sleep(1.0); await t.shot('frost-result')
        print('  planters frozen flags:', await t.world('w.planters.map(p => p && !!p.frozen)'), 'frost cleared:', await t.world('w.frost'))
        await t.key('e'); await asyncio.sleep(0.3)
        g0 = await t.world('[w.planters[0].grown, w.planters[1].grown]'); await asyncio.sleep(2); g1 = await t.world('[w.planters[0].grown, w.planters[1].grown]')
        print('  growth while frozen (bed1 should not move):', g0, '->', g1)
        await t.world("(() => { w.survival.min = 6 * 60 + 5; return 1; })()"); await asyncio.sleep(0.5)
        print('  thawed in the morning:', await t.world('w.planters.map(p => p && !!p.frozen)'))
        ok = report([t])
        await browser.close()
        print('OK' if ok else 'ERRORS')

if __name__ == "__main__": asyncio.run(main())
