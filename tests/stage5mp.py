"""Stage 5 multiplayer tests through the real lobby (3 tabs, then 2 tabs + a computer Botanist).
  - a repair won by the Builder shows fixed on every screen
  - the stuck rover: on every screen; freed by the Pilot -> free everywhere
  - fertilized / tuned / freed-rover state reaches a tab that rejoins (reload, same name) via the snapshot
  - rock samples: a picked-up rock is gone for everyone, and stays gone after a rejoin
  - the HOST's Esc menu freezes a mini game on another tab (PAUSED label, scene paused) and unfreezes it
  - computer crewmates keep working while the people play mini games
Run with a fresh server: the script restarts it."""
import asyncio, sys, subprocess, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *
ROOT = __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # the game folder

def restart_server():
    subprocess.run("pkill -f 'node game/server/index.js'", shell=True)
    time.sleep(0.8)
    subprocess.Popen(f"cd '{ROOT}' && nohup node game/server/index.js > /tmp/server.log 2>&1 &", shell=True)
    time.sleep(1.5)

async def start_game(tabs_jobs):
    """tabs_jobs: [(tab, name, job)], the first is the host and creates the game; the others join with its code.
    Then the host starts it (no story). Returns the game code."""
    code = None
    for i, (t, name, job) in enumerate(tabs_jobs):
        c = await lobby_join(t, name, job, host=(i == 0), story=False, code=code)
        if i == 0: code = c
    await asyncio.sleep(0.8)
    host = tabs_jobs[0][0]
    await host.page.evaluate("() => { document.getElementById('lobby-story').checked = false; }")
    await host.page.click('#lobby-start')
    for t, _, _ in tabs_jobs: await t.wait_world()
    await asyncio.sleep(1.5)
    return code

async def eventually(t, code, want=True, secs=6):
    for _ in range(int(secs * 10)):
        if await t.world(code) == want: return True
        await asyncio.sleep(0.1)
    return False

async def rejoin(t, name):
    """Reload the tab and join again with the same name (takes back the astronaut + gets the leader's snapshot)."""
    await t.page.reload()
    await t.page.wait_for_selector('#lobby-name', state='visible')
    await t.page.fill('#lobby-name', name)          # (the address is ?room=CODE, so the code is already filled in)
    await t.page.click('#lobby-code-btn')
    await t.wait_world(); await asyncio.sleep(2.5)

async def main():
    results = {}
    def check(name, ok):
        results[name] = bool(ok); print(('  PASS ' if ok else '  FAIL ') + name)

    restart_server()
    async with async_playwright() as pw:
        browser, (A, B, C) = await open_tabs(pw, ['mpA', 'mpB', 'mpC'])
        await start_game([(A, 'Ann', 'builder'), (B, 'Ben', 'pilot'), (C, 'Cat', 'botanist')])
        print('bots:', await A.world('w.bots.list.length'))

        print('STUCK ROVER')
        for t in (A, B, C): check(f'rover stuck on {t.name}', await t.world('w.rover.stuck && !w.rover.inGarage'))
        await A.world("(() => { w.player.setPosition(w.rover.x, w.rover.y + 16); return 1; })()"); await asyncio.sleep(0.4)
        check('builder sees "only the Pilot" prompt', 'Only the Pilot' in (await A.world('w.target?.label') or ''))
        await B.world("(() => { w.player.setPosition(w.rover.x, w.rover.y + 16); return 1; })()"); await asyncio.sleep(0.4)
        await B.key('e'); await asyncio.sleep(0.5)
        check('pilot opens UnstickGame', 'UnstickGame' in await B.active())
        await B.js("() => game.scene.getScene('UnstickGame').win()"); await asyncio.sleep(0.6)
        await B.no_fact(); await asyncio.sleep(0.3)
        for t in (A, C): check(f'rover freed on {t.name}', await eventually(t, 'w.rover.stuck', False))

        print('REPAIR BY THE BUILDER (MOXIE)')
        await A.world("(() => { w.inv[4] = { id: 'pipe', n: 2 }; w.inv[5] = { id: 'circuit_board', n: 1 }; w.invChanged(); const e = w.equipment.get('moxie'); w.player.setPosition(e.x, e.y + 14); return 1; })()"); await asyncio.sleep(0.5)
        print('  target:', await A.world('w.target?.label'))
        await A.key('e'); await asyncio.sleep(0.5)
        check('builder opens MoxieGame', 'MoxieGame' in await A.active())
        await A.js("() => game.scene.getScene('MoxieGame').win()"); await asyncio.sleep(0.6)
        await A.no_fact(); await asyncio.sleep(0.3)
        for t in (A, B, C): check(f'MOXIE fixed on {t.name}', await eventually(t, "w.equipment.get('moxie').broken", False))

        print('BOTANIST: fertilize + tune (shared)')
        await A.world("(() => { for (const k of ['fission_generator', 'greenhouse_lights']) w.equipment.get(k).broken = false; w.equipment.refresh(); w.equipmentChanged(); return 1; })()")
        await asyncio.sleep(1)
        await C.world("(() => { w.planters[0] = { seed: 'seeds_potato', grown: 0 }; w.plantersChanged(); w.fert[0] = true; w.fertChanged(); return 1; })()")
        await C.world("(() => { w.openScreen('LightGame', { onWin: () => { w.setLightsTuned(true, true); w.taskEvent('tune'); } }); return 1; })()"); await asyncio.sleep(0.5)
        await C.js("() => game.scene.getScene('LightGame').win()"); await asyncio.sleep(0.6); await C.no_fact()
        for t in (A, B): check(f'tuned + fert on {t.name}', await eventually(t, 'w.lightsTuned && w.fert[0] === true'))

        print('ROCK SAMPLE taken by the Pilot')
        await B.world("(() => { const g = w.loot.ground.find(g => g.gid === 'rock-0'); w.player.setPosition(g.x, g.y); return 1; })()")
        check('pilot picked up rock-0', await eventually(B, "w.inv.some(s => s && s.id === 'rock_sample')"))
        for t in (A, C): check(f'rock-0 gone on {t.name}', await eventually(t, "w.loot.ground.some(g => g.gid === 'rock-0')", False))

        print('REJOIN (reload, same name)')
        await rejoin(C, 'Cat')
        check('C rejoined as botanist', await C.world("w.job === 'botanist'"))
        check('C: rover not stuck after rejoin', await eventually(C, 'w.rover.stuck', False))
        check('C: lights tuned after rejoin', await eventually(C, 'w.lightsTuned'))
        check('C: bed 0 fertilized after rejoin', await eventually(C, 'w.fert[0] === true'))
        check('C: MOXIE fixed after rejoin', await eventually(C, "w.equipment.get('moxie').broken", False))
        check('C: rock-0 gone after rejoin', await eventually(C, "w.loot.ground.some(g => g.gid === 'rock-0')", False))
        check('C: rock-1 still there after rejoin', await C.world("w.loot.ground.some(g => g.gid === 'rock-1')"))
        await rejoin(B, 'Ben')
        check('B (Pilot) rejoined: rover not stuck', await eventually(B, 'w.rover.stuck', False))
        await B.world("(() => { w.player.setPosition(w.rover.x, w.rover.y + 16); return 1; })()"); await asyncio.sleep(0.5)
        check('B (Pilot) can drive after rejoin', (await B.world('w.target?.label')) == 'Drive the rover')

        print('HOST PAUSE freezes a mini game on another tab')
        await B.world("(() => { w.inv[6] = { id: 'rock_sample', n: 1 }; w.invChanged(); w.openScreen('RockGame', {}); return 1; })()"); await asyncio.sleep(0.6)
        check('B in RockGame', 'RockGame' in await B.active())
        await A.page.bring_to_front(); await A.key('Escape'); await asyncio.sleep(0.8)
        check('A pause menu open', 'Pause' in await A.active())
        check('B frozen', await B.world('!!w.frozen'))
        check('B RockGame paused', await B.js("() => game.scene.isPaused('RockGame')"))
        check('B PAUSED label', await B.js("() => game.scene.getScene('RockGame').pausedText.visible"))
        await B.shot('host-paused-minigame')
        await A.key('Escape'); await asyncio.sleep(0.8)
        check('B RockGame running again', await B.js("() => game.scene.isActive('RockGame') && !game.scene.isPaused('RockGame')"))
        check('B PAUSED label gone', await B.js("() => !game.scene.getScene('RockGame').pausedText.visible"))
        await B.page.bring_to_front(); await B.key('Escape'); await asyncio.sleep(0.4)
        check('B rock sample kept after Esc', await B.world("w.inv.some(s => s && s.id === 'rock_sample')"))
        ok = report([A, B, C]); check('no console errors (3 tabs)', ok)
        await browser.close()

    print('BOTS keep working while people play mini games (Builder + Pilot, computer Botanist)')
    restart_server()
    async with async_playwright() as pw:
        browser, (A, B) = await open_tabs(pw, ['botA', 'botB'])
        await start_game([(A, 'Ann', 'builder'), (B, 'Ben', 'pilot')])
        check('one bot (the Botanist)', await A.world("w.bots.list.length === 1 && w.bots.list[0].job === 'botanist'"))
        check('rover stuck (human Pilot)', await A.world('w.rover.stuck'))
        # Both people sit in mini games for 25 s
        await A.world("(() => { w.inv[4] = { id: 'power_core', n: 2 }; w.invChanged(); w.openScreen('AtomGame', { machine: w.equipment.get('fission_generator') }); return 1; })()")
        await B.world("(() => { w.player.setPosition(w.rover.x, w.rover.y + 16); w.openScreen('UnstickGame', {}); return 1; })()")
        b0 = await A.world("(() => { const b = w.bots.list[0]; return [Math.round(b.x), Math.round(b.y), b.inside, b.task, JSON.stringify(w.planters), w.loot.ground.length]; })()")
        await asyncio.sleep(25)
        b1 = await A.world("(() => { const b = w.bots.list[0]; return [Math.round(b.x), Math.round(b.y), b.inside, b.task, JSON.stringify(w.planters), w.loot.ground.length]; })()")
        print('  bot before:', b0); print('  bot after: ', b1)
        check('bot moved / did things during the mini games', b0 != b1)
        check('both still in their mini games', 'AtomGame' in await A.active() and 'UnstickGame' in await B.active())
        # The bot's movement reaches the other tab
        pos_b = await B.js("() => { const w = game.scene.getScene('World'); const r = [...w.mp.remotes.values()].find(r => r.bot); return r && [Math.round(r.tx), Math.round(r.ty)]; }")
        print('  bot seen on B at:', pos_b)
        check('bot visible on the other tab', pos_b is not None)
        ok = report([A, B]); check('no console errors (2 tabs + bot)', ok)
        await browser.close()

    print('\nSUMMARY:', sum(results.values()), '/', len(results), 'passed')
    for k, v in results.items():
        if not v: print('  FAILED:', k)
    print('OK' if all(results.values()) else 'FAILURES')

if __name__ == "__main__": asyncio.run(main())
