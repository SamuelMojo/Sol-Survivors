"""Voyage: the Builder's screw panel, then the wires (unchanged)."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

async def main():
    async with async_playwright() as pw:
        browser, (t,) = await open_tabs(pw, ['voyage'])
        await t.goto('/?job=builder&nobots')
        await t.wait_world(); await asyncio.sleep(0.5)
        # Jump straight to the voyage scene (test shortcut)
        await t.js("() => { const d = game.scene.getScene('World').startData; const me = d.me; game.scene.stop('Hud'); game.scene.stop('World'); game.scene.start('Voyage', { ...d, me }); }")
        await asyncio.sleep(6)
        print('active:', await t.active())
        st = await t.js("() => { const v = game.scene.getScene('Voyage'); return [v.started, v.stations.builder.x, v.stations.builder.y]; }")
        print('started, station:', st)
        await t.js("() => { const v = game.scene.getScene('Voyage'); v.player.setPosition(v.stations.builder.x, v.stations.builder.y + 4); }")
        await asyncio.sleep(0.3)
        await t.key('e'); await asyncio.sleep(0.5)
        print('active:', await t.active())
        assert 'Wires' in await t.active()
        await t.shot('wires-cover')
        # Wires must be blocked while covered: press 1 then the right socket, nothing joins
        s = await t.js("() => { const w = game.scene.getScene('Wires'); return { covered: w.covered, left: w.left, right: w.right, joined: [...w.joined] }; }")
        print('state:', s)
        # click screw 0 three times, use keys for the others
        heads = await t.js("() => game.scene.getScene('Wires').screws.map(s => [s.head.x, s.head.y])")
        for _ in range(3):
            x, y = await canvas_xy(t, *heads[0]); await t.page.mouse.click(x, y); await asyncio.sleep(0.2)
        await t.shot('wires-one-screw')
        for k in ['2', '3', '4']:
            for _ in range(3): await t.page.keyboard.press(k); await asyncio.sleep(0.15)
        await asyncio.sleep(0.6); await t.shot('wires-sliding')
        await asyncio.sleep(1.0)
        print('covered now:', await t.js("() => game.scene.getScene('Wires').covered"), 'help:', await t.js("() => game.scene.getScene('Wires').help.text"))
        await t.shot('wires-uncovered')
        # now the wires: for each left row i, press i+1 then the socket row with the same colour
        for i in range(4):
            j = s['right'].index(s['left'][i])
            await t.page.keyboard.press(str(i + 1)); await asyncio.sleep(0.1)
            await t.page.keyboard.press(str(j + 1)); await asyncio.sleep(0.2)
        print('joined:', await t.js("() => { const w = game.scene.getScene('Wires'); return w && w.scene.isActive() ? [...w.joined] : 'closed'; }"))
        await t.shot('wires-done')
        await asyncio.sleep(1.5)
        print('voyage done.builder:', await t.js("() => game.scene.getScene('Voyage').done.builder"), 'active:', await t.active())
        ok = report([t])
        await browser.close()
        print('OK' if ok else 'ERRORS')

asyncio.run(main())
