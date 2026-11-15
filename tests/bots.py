"""Computer crewmates: aboard the ship in the voyage, and asleep in the hub bunks at night (solo + 2 players)."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

results = {}
def check(name, ok):
    results[name] = bool(ok); print(('  PASS ' if ok else '  FAIL ') + name)

async def to_voyage(t, job):
    await t.goto(f'/?job={job}&story=1')
    await t.skip_crawl()                  # the opening crawl comes first
    for _ in range(100):
        if 'Interview' in await t.active(): break
        await asyncio.sleep(0.1)
    await t.js("(() => { const s = game.scene.getScene('Interview'); s.scene.start('Voyage', s.d); })()")
    await asyncio.sleep(1.2)

async def main():
    async with async_playwright() as pw:
        browser, (A, B, C) = await open_tabs(pw, ['bA', 'bB', 'bC'])
        print('VOYAGE')
        await to_voyage(A, 'builder')
        figs = await A.js("(() => { const v = game.scene.getScene('Voyage'); return [...v.botFigs.entries()].map(([j, b]) => [j, Math.round(b.x), Math.round(b.y), b.sprite.visible]); })()")
        print('  bots aboard:', figs)
        check('two computer crewmates aboard (Botanist + Pilot)', sorted(f[0] for f in figs) == ['botanist', 'pilot'])
        st = await A.js("(() => { const v = game.scene.getScene('Voyage'); return { pilot: v.stations.pilot, leak: v.leaks[0] }; })()")
        pil = next(f for f in figs if f[0] == 'pilot')
        check('Pilot bot sits at the pilot seat', abs(pil[1] - st['pilot']['x']) < 2 and abs(pil[2] - st['pilot']['y']) < 2)
        bot = next(f for f in figs if f[0] == 'botanist')
        check('Botanist bot starts by the first leak', abs(bot[1] - st['leak']['x']) < 2)
        await A.shot('voyage-bots')
        # the Botanist bot walks to the next leak once it starts patching
        await asyncio.sleep(14)
        moved = await A.js("(() => { const v = game.scene.getScene('Voyage'), b = v.botFigs.get('botanist'); return [Math.round(b.x), v.leaks.filter(l => l.fixed).length]; })()")
        print('  botanist bot now:', moved)
        check('Botanist bot moves between leaks as it patches', moved[1] == 0 or moved[0] != bot[1])
        await to_voyage(C, 'pilot')
        figsC = await C.js("(() => [...game.scene.getScene('Voyage').botFigs.keys()])()")
        check('as Pilot: Botanist + Builder bots aboard', sorted(figsC) == ['botanist', 'builder'])

        print('NIGHT (solo)')
        await B.goto('/?job=botanist'); await B.wait_world(); await asyncio.sleep(1.5)
        await B.world("(w.scene.isActive('Menu') && w.scene.stop('Menu'), w.closeUI(), 1)")
        # bring the bots next to the hub door, then make it late evening
        await B.world("(() => { const d = w.buildings.hab.door; w.bots.list.forEach((b, i) => { b.reset(); b.x = d.x + 10 + i * 6; b.y = d.y + 20; }); w.survival.min = 21 * 60 + 5; return 1; })()")
        ok = False
        for _ in range(80):
            st = await B.world("w.bots.list.map(b => [b.job, b.inside, b.asleep, b.ix, b.iy])")
            if all(s[1] == 'hab' and s[2] for s in st): ok = True; break
            await asyncio.sleep(0.25)
        print('  bots:', st)
        check('both bots are asleep in the hub at night', ok)
        check('bots are in different bunks', len({(s[3], s[4]) for s in st}) == len(st))
        # walk in to see them, then sleep: the night must run (bots don't block it)
        await B.world("(w.goToHab('bunk'), 1)"); await asyncio.sleep(1.2)
        await B.shot('bots-asleep')
        zzz = await B.js("(() => [...game.scene.getScene('Interior').others.values()].filter(o => o.zzz).length)()")
        check("'z z z' shows over the sleeping bots", zzz == 2)
        await B.world("(w.sleep(), 1)")
        morning = False
        for _ in range(60):
            if await B.world("w.survival.min < 8 * 60 && !w.sleeping"): morning = True; break
            await asyncio.sleep(0.25)
        check('solo: the night passes when the player sleeps', morning)
        await asyncio.sleep(1.5)
        check('bots wake up in the morning', await B.world("w.bots.list.every(b => !b.asleep)"))
        ok = report([A, B, C])
        await browser.close()
    print('\nSUMMARY:', sum(results.values()), '/', len(results), 'passed')
    for k, v in results.items():
        if not v: print('  FAILED:', k)
    print('OK' if all(results.values()) and ok else 'FAILURES')

asyncio.run(main())
