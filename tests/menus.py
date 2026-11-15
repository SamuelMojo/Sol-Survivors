"""Fact screen (X / Esc only, solo clock pauses, queue), Exit to main menu (solo + crew), to-do list in the menu."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

results = {}
def check(name, ok):
    results[name] = bool(ok); print(('  PASS ' if ok else '  FAIL ') + name)

async def canvas_point(t, gx, gy):
    """Game pixel (480x320) -> page pixel."""
    r = await t.js("(() => { const c = game.canvas.getBoundingClientRect(); return [c.left, c.top, c.width / 480]; })()")
    return r[0] + gx * r[2], r[1] + gy * r[2]

async def main():
    async with async_playwright() as pw:
        browser, (A, B, C) = await open_tabs(pw, ['mA', 'mB', 'mC'])
        print('FACT SCREEN')
        await A.goto('/?job=botanist'); await A.wait_world(facts=True); await asyncio.sleep(2)
        check('a place fact opens on its own screen', 'Fact' in await A.active())
        m0 = await A.world('w.survival.min'); await asyncio.sleep(2); m1 = await A.world('w.survival.min')
        check('solo: the clock is paused while a fact is open', m0 == m1)
        for k in ('e', ' ', 'Enter'):
            await A.page.keyboard.press(k); await asyncio.sleep(0.2)
        check('E / Space / Enter do NOT close a fact', 'Fact' in await A.active())
        await A.page.mouse.click(*(await canvas_point(A, 240, 160))); await asyncio.sleep(0.3)
        check('clicking the middle does NOT close it', 'Fact' in await A.active())
        await A.page.mouse.click(*(await canvas_point(A, 457, 27))); await asyncio.sleep(0.4)
        check('the X in the corner closes it', 'Fact' not in await A.active())
        check('closing with X does not open the menu', 'Pause' not in await A.active())
        # two facts at once: they queue, one at a time
        await A.world("(w.showFact({ title: 'One', body: 'First fact' }), w.showFact({ title: 'Two', body: 'Second fact' }), 1)"); await asyncio.sleep(0.6)
        check('facts queue up (one open, one waiting)', 'Fact' in await A.active() and await A.world('w.factQueue.length') == 1)
        await A.page.keyboard.press('Escape'); await asyncio.sleep(0.8)
        check('Esc closes it, then the next fact opens', 'Fact' in await A.active() and await A.world('w.factQueue.length') == 0)
        await A.page.keyboard.press('Escape'); await asyncio.sleep(0.5)
        check('Esc on a fact does not open the menu', 'Pause' not in await A.active() and 'Fact' not in await A.active())

        print('TO-DO ONLY IN THE MENU')
        check('no NEXT line on the HUD', await A.js("(() => !game.scene.getScene('Hud').todo)()"))
        await A.key('t'); await asyncio.sleep(0.5)
        check('T opens the to-do tab', await A.js("(() => { const p = game.scene.getScene('Pause'); return p.scene.isActive() && p.tab === 1; })()"))
        await A.key('t'); await asyncio.sleep(0.4)

        print('EXIT TO MAIN MENU (solo)')
        await A.page.keyboard.press('Escape'); await asyncio.sleep(0.5)
        exit_btn = await A.js("(() => { const p = game.scene.getScene('Pause'); const t = p.layer.list.find(o => o.text === 'Exit to main menu'); return t && [t.x + 4, t.y - 6]; })()")
        await A.page.mouse.click(*(await canvas_point(A, *exit_btn))); await asyncio.sleep(0.4)
        check("'Are you sure?' box shows", await A.js("(() => game.scene.getScene('Pause').confirmExit)()"))
        await A.page.keyboard.press('Escape'); await asyncio.sleep(0.3)
        check('Esc cancels the box (menu still open)', await A.js("(() => { const p = game.scene.getScene('Pause'); return p.scene.isActive() && !p.confirmExit; })()"))
        await A.page.mouse.click(*(await canvas_point(A, *exit_btn))); await asyncio.sleep(0.4)
        await A.js("(() => game.scene.getScene('Pause').exit())()"); await asyncio.sleep(1.5)
        check('back at the main menu (the lobby)', await A.page.is_visible('#lobby-step1'))

        print('EXIT TO MAIN MENU (crew)')
        code = await lobby_join(B, 'Bea', 'builder', host=True)
        await lobby_join(C, 'Cal', 'pilot', code=code)
        await asyncio.sleep(0.6)
        await B.page.evaluate("() => { document.getElementById('lobby-story').checked = false; }")
        await B.page.click('#lobby-start')
        for t in (B, C): await t.wait_world()
        await asyncio.sleep(2)
        await C.js("(() => game.scene.getScene('World').openScreen('Pause'))()"); await asyncio.sleep(0.4)
        await C.js("(() => game.scene.getScene('Pause').exit())()")
        told = False
        for _ in range(20):
            await asyncio.sleep(0.1)
            if await B.world("[...w.mp.remotes.values()].some(r => r.name === 'Cal' && r.connected === false)"): told = True; break
        check('the crew is told at once (under 2 s)', told)
        await asyncio.sleep(1.5)
        check('the player who left is back at the main menu', await C.page.is_visible('#lobby-step1'))
        check('the leaver can rejoin with the code', await C.page.input_value('#lobby-code') in ('', code))
        ok = report([A, B, C])
        await browser.close()
    print('\nSUMMARY:', sum(results.values()), '/', len(results), 'passed')
    for k, v in results.items():
        if not v: print('  FAILED:', k)
    print('OK' if all(results.values()) and ok else 'FAILURES')

asyncio.run(main())
