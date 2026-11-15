"""Mini game safety rules in solo: clock pauses, freeze pauses the game, passing out closes it, unstick leaves it alone."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

async def main():
    async with async_playwright() as pw:
        browser, (t,) = await open_tabs(pw, ['safety'])
        await t.goto('/?job=builder&nobots')
        await t.wait_world(); await asyncio.sleep(0.5)
        await t.world("(() => { w.inv[1] = { id: 'power_core', n: 2 }; w.invChanged(); const e = w.equipment.get('fission_generator'); w.player.setPosition(e.x, e.y + 4); return 1; })()")
        await asyncio.sleep(0.3); await t.key('e'); await asyncio.sleep(0.3)
        assert 'AtomGame' in await t.active()
        m0 = await t.world('w.survival.min'); await asyncio.sleep(2.5); m1 = await t.world('w.survival.min')
        print('solo clock while game open (should not move):', round(m0, 2), '->', round(m1, 2))
        # unstick must not close it (wait > 1.5 s): still open?
        print('still open after 2.5 s:', 'AtomGame' in await t.active())
        # freeze (host pause from elsewhere)
        await t.world("(() => { w.setFrozen(true, false); return 1; })()"); await asyncio.sleep(0.3)
        print('frozen: game paused?', await t.js("() => game.scene.isPaused('AtomGame')"), 'PAUSED label:', await t.js("() => game.scene.getScene('AtomGame').pausedText.visible"))
        await t.shot('frozen')
        await t.world("(() => { w.setFrozen(false, false); return 1; })()"); await asyncio.sleep(0.3)
        print('unfrozen: game active?', await t.js("() => game.scene.isActive('AtomGame')"), 'label hidden:', await t.js("() => !game.scene.getScene('AtomGame').pausedText.visible"))
        # pass out while playing: the game closes, parts stay (dropped at your feet by knockOut as usual)
        await t.world("(() => { w.survival.me.health = 0; w.knockOut('food'); return 1; })()"); await asyncio.sleep(1.0)
        print('after knock-out active:', await t.active(), 'uiOpen:', await t.world('w.uiOpen'), 'inside:', await t.world('w.inside'))
        # machine fixed another way while playing -> closes with a message
        await t.world("(() => { w.knockingOut = false; w.exitBuilding(); w.inv[1] = { id: 'power_core', n: 2 }; w.invChanged(); const e = w.equipment.get('fission_generator'); w.player.setPosition(e.x, e.y + 4); return 1; })()")
        await asyncio.sleep(0.5); await t.key('e'); await asyncio.sleep(0.3)
        print('reopened:', 'AtomGame' in await t.active())
        await t.world("(() => { const e = w.equipment.get('fission_generator'); e.broken = false; w.equipment.refresh(); return 1; })()"); await asyncio.sleep(0.4)
        print('after remote fix active:', await t.active(), 'cores kept:', await t.world("w.inv.filter(s => s && s.id === 'power_core').map(s => s.n)"))
        ok = report([t])
        await browser.close()
        print('OK' if ok else 'ERRORS')

asyncio.run(main())
