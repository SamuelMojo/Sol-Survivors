"""Stage 1+2 tests: Builder repair mini games (MOXIE, Atom, Weld) in solo; Esc quits with parts kept."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

async def give(t, items):
    await t.world("(() => { %s; w.invChanged(); return 1; })()" % '; '.join(f"w.inv[{i + 1}] = {{ id: '{id}', n: {n} }}" for i, (id, n) in enumerate(items)))

async def go_machine(t, key):
    await t.world(f"(() => {{ const e = w.equipment.get('{key}'); w.player.setPosition(e.x, e.y + 4); return 1; }})()")
    await asyncio.sleep(0.3)
    label = await t.world("w.target && w.target.label")
    print('   target:', label)
    await t.key('e')
    await asyncio.sleep(0.5)

async def drag(t, x0, y0, x1, y1, steps=8):
    p = t.page.mouse
    ax, ay = await canvas_xy(t, x0, y0); bx, by = await canvas_xy(t, x1, y1)
    await p.move(ax, ay); await p.down()
    for i in range(1, steps + 1):
        await p.move(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps); await asyncio.sleep(0.03)
    await p.up(); await asyncio.sleep(0.15)

async def main():
    async with async_playwright() as pw:
        browser, (t,) = await open_tabs(pw, ['builder'])
        await t.goto('/?job=builder&nobots')
        await t.wait_world(); await asyncio.sleep(1)

        # ---- MOXIE: Split the CO2 ----
        print('MOXIE')
        await give(t, [('pipe', 2), ('circuit_board', 1)])
        await go_machine(t, 'moxie')
        print('   active:', await t.active())
        assert 'MoxieGame' in await t.active(), 'MoxieGame did not open'
        await t.shot('moxie-open')
        # drag the right-hand O off each molecule, down by 60px
        mols = await t.js("() => game.scene.getScene('MoxieGame').mols.map(m => [m.right.obj.x, m.right.obj.y])")
        for (x, y) in mols: await drag(t, x, y, x + 10, y + 62)
        free = await t.js("() => game.scene.getScene('MoxieGame').atoms.filter(a => a.free && !a.partner).map(a => [a.obj.x, a.obj.y])")
        print('   free O after detaching:', len(free))
        assert len(free) == 4
        await t.shot('moxie-split')
        await drag(t, *free[0], free[1][0] - 12, free[1][1])
        await drag(t, *free[2], free[3][0] - 12, free[3][1])
        await asyncio.sleep(0.8)
        print('   o2:', await t.js("() => game.scene.getScene('MoxieGame').o2"), 'won:', await t.js("() => game.scene.getScene('MoxieGame').won"))
        await t.shot('moxie-won')
        print('   moxie broken?', await t.world("w.equipment.get('moxie').broken"), 'pipes left:', await t.world("w.inv.filter(s => s && s.id === 'pipe').length"), 'task done:', await t.world("[...w.tasks.builder.done]"))
        await t.key('e'); await asyncio.sleep(0.3)
        print('   after close active:', await t.active(), 'uiOpen:', await t.world('w.uiOpen'))

        # ---- Atom: Esc quits, parts kept ----
        print('ATOM (Esc)')
        await give(t, [('power_core', 2)])
        await go_machine(t, 'fission_generator')
        assert 'AtomGame' in await t.active()
        await t.shot('atom-open')
        await t.key('Escape'); await asyncio.sleep(0.3)
        print('   after Esc active:', await t.active(), 'cores:', await t.world("w.inv.filter(s => s && s.id === 'power_core').map(s => s.n)"), 'broken:', await t.world("w.equipment.get('fission_generator').broken"))
        # ---- Atom: win by mashing Space ----
        print('ATOM (win)')
        await go_machine(t, 'fission_generator')
        for i in range(120):
            await t.page.keyboard.press('Space'); await asyncio.sleep(0.1)
            if await t.js("() => { const s = game.scene.getScene('AtomGame'); return s.split || s.won; }"): break
        print('   presses:', i + 1, 'meter:', await t.js("() => game.scene.getScene('AtomGame').meterVal"))
        await asyncio.sleep(0.5); await t.shot('atom-split')
        await asyncio.sleep(1.2); await t.shot('atom-won')
        print('   generator broken?', await t.world("w.equipment.get('fission_generator').broken"))
        await t.key('e'); await asyncio.sleep(0.3)

        # ---- Weld: slip off (cooled), then win ----
        print('WELD lights')
        await give(t, [('wire', 1), ('circuit_board', 1)])
        await go_machine(t, 'greenhouse_lights')
        assert 'WeldGame' in await t.active()
        await t.shot('weld-open')
        steps = await t.js("() => game.scene.getScene('WeldGame').steps.map(s => [s.x, s.y])")
        m = t.page.mouse
        async def trace(frm, to, every=3):
            for i in range(frm, to, every):
                x, y = await canvas_xy(t, *steps[i]); await m.move(x, y); await asyncio.sleep(0.02)
        x, y = await canvas_xy(t, *steps[0]); await m.move(x, y); await m.down()
        await trace(0, len(steps) // 3)
        pos1 = await t.js("() => game.scene.getScene('WeldGame').pos"); print('   pos after a third:', pos1)
        # slip off: move far away with the button held
        x, y = await canvas_xy(t, steps[len(steps)//3][0], steps[len(steps)//3][1] + 60); await m.move(x, y); await asyncio.sleep(0.2)
        pos2 = await t.js("() => game.scene.getScene('WeldGame').pos"); print('   pos after slipping off:', pos2, 'help:', await t.js("() => game.scene.getScene('WeldGame').howText.text"))
        await t.shot('weld-cooled')
        await m.up()
        x, y = await canvas_xy(t, *steps[max(0, pos2 - 1)]); await m.move(x, y); await m.down()
        await trace(max(0, pos2 - 1), len(steps), 2)
        x, y = await canvas_xy(t, *steps[-1]); await m.move(x, y); await asyncio.sleep(0.1); await m.up()
        await asyncio.sleep(0.8)
        print('   won:', await t.js("() => game.scene.getScene('WeldGame').won"), 'lights broken?', await t.world("w.equipment.get('greenhouse_lights').broken"))
        await t.shot('weld-won')
        await t.key('e'); await asyncio.sleep(0.3)

        # ---- Weld: rocket, 5 parts in one go ----
        print('WELD rocket')
        await give(t, [('rocket_part', 3), ('rocket_part', 2)])
        await go_machine(t, 'rocket')
        assert 'WeldGame' in await t.active()
        await t.shot('weld-rocket')
        steps = await t.js("() => game.scene.getScene('WeldGame').steps.map(s => [s.x, s.y])")
        x, y = await canvas_xy(t, *steps[0]); await m.move(x, y); await m.down()
        await trace(0, len(steps), 2)
        x, y = await canvas_xy(t, *steps[-1]); await m.move(x, y); await asyncio.sleep(0.1); await m.up()
        await asyncio.sleep(0.8)
        print('   rocket progress:', await t.world("w.equipment.get('rocket').progress"), 'parts left:', await t.world("w.inv.filter(s => s && s.id === 'rocket_part').length"))
        await t.key('e'); await asyncio.sleep(0.3)
        print('   tasks done:', await t.world("[...w.tasks.builder.done]"), 'active:', await t.active())

        ok = report([t])
        await browser.close()
        print('OK' if ok else 'ERRORS')

asyncio.run(main())
