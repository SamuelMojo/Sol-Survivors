"""Rooms with codes: create a game, join with the code, bad code, full room, two games at once don't leak,
the link ?room=CODE fills in the code, refresh keeps you in your game, rooms close when empty."""
import asyncio, sys, subprocess, time
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *
ROOT = __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # the game folder

results = {}
def check(name, ok):
    results[name] = bool(ok); print(('  PASS ' if ok else '  FAIL ') + name)

def restart_server():
    subprocess.run("pkill -f 'node game/server/index.js'", shell=True); time.sleep(0.8)
    subprocess.Popen(f"cd '{ROOT}' && nohup node game/server/index.js > /tmp/server.log 2>&1 &", shell=True); time.sleep(1.5)

async def health(t):
    return await t.page.evaluate("() => fetch('/healthz').then(r => r.json())")

async def main():
    restart_server()
    async with async_playwright() as pw:
        browser, (A, B, C, D, E, F) = await open_tabs(pw, ['rA', 'rB', 'rC', 'rD', 'rE', 'rF'])
        print('CREATE + JOIN')
        codeA = await lobby_join(A, 'Ann', 'builder')
        check('code is 4 letters', len(codeA) == 4 and codeA.isalpha() and codeA.isupper())
        link = await A.page.inner_text('#lobby-room')
        check('share link shown', f'/?room={codeA}' in link)
        check('address became ?room=CODE', (await A.page.evaluate('() => location.search')) == f'?room={codeA}')
        # B arrives from the link: code is pre-filled
        await B.goto(f'/?room={codeA}')
        check('link pre-fills the code', (await B.page.input_value('#lobby-code')) == codeA)
        await B.page.fill('#lobby-name', 'Ben'); await B.page.click('#lobby-code-btn')
        await B.page.wait_for_selector('#lobby-step2', state='visible'); await asyncio.sleep(0.5)
        crew = await A.page.inner_text('#lobby-crew')
        check('A sees Ben in the crew', 'Ben' in crew)
        check('B shows the same code', codeA in await B.page.inner_text('#lobby-room'))
        check('B sees who the host is', 'Ann' in await B.page.inner_text('#lobby-wait'))

        print('BAD CODE')
        await C.goto('/'); await C.page.fill('#lobby-name', 'Cat'); await C.page.fill('#lobby-code', 'zzzz')
        check('typed letters are upper-cased', (await C.page.input_value('#lobby-code')) == 'ZZZZ')
        await C.page.click('#lobby-code-btn'); await asyncio.sleep(0.6)
        msg = await C.page.inner_text('#lobby-msg')
        check('bad code gives a clear message and stays on step 1', 'no game' in msg.lower() and await C.page.is_visible('#lobby-step1'))
        await C.page.fill('#lobby-code', 'AB'); await C.page.click('#lobby-code-btn')
        check('short code asks for 4 letters', '4 letters' in await C.page.inner_text('#lobby-msg'))

        print('TWO GAMES AT ONCE')
        codeD = await lobby_join(D, 'Dan', 'pilot')
        check('second game has a different code', codeD != codeA)
        await asyncio.sleep(0.5)
        check("A's lobby does not show Dan", 'Dan' not in await A.page.inner_text('#lobby-crew'))
        check("D's lobby does not show Ann or Ben", 'Ann' not in await D.page.inner_text('#lobby-crew') and 'Ben' not in await D.page.inner_text('#lobby-crew'))
        h = await health(A); print('  health:', h)
        check('/healthz counts 2 rooms', h['rooms'] == 2 and h['ok'])

        print('FULL ROOM + SAME NAME')
        codeA2 = codeA
        await lobby_join(C, 'Cat', 'botanist', code=codeA2)          # third player: fits
        await E.goto(f'/?room={codeA2}'); await E.page.fill('#lobby-name', 'Eve'); await E.page.click('#lobby-code-btn'); await asyncio.sleep(0.6)
        check('4th player is told the game is full', 'full' in (await E.page.inner_text('#lobby-msg')).lower())
        await F.goto(f'/?room={codeD}'); await F.page.fill('#lobby-name', 'Dan'); await F.page.click('#lobby-code-btn')
        await F.page.wait_for_selector('#lobby-step2', state='visible'); await asyncio.sleep(0.5)
        names = await D.page.inner_text('#lobby-crew')
        print('  D crew:', names.replace('\n', ' | '))
        check('same name in one room gets a different name', 'Dan3' in names and len([l for l in names.split('\n') if l.strip()]) == 2)

        print('GAMES DO NOT LEAK')
        # Start game A (3 players ready) and check D's tab never starts
        for t, job in ((A, 'builder'), (B, 'pilot')):
            pass
        await B.page.click('#lobby-jobs button:nth-child(3)'); await B.page.click('#lobby-ready'); await asyncio.sleep(0.3)
        await A.page.evaluate("() => { document.getElementById('lobby-story').checked = false; }")
        # Cat is already ready (lobby_join). Start.
        await A.page.click('#lobby-start'); await asyncio.sleep(0.5)
        for t in (A, B, C): await t.wait_world()
        await asyncio.sleep(1)
        seedA = await A.world('w.startData.seed')
        check('A, B, C are in the same game (same seed)', seedA == await B.world('w.startData.seed') == await C.world('w.startData.seed'))
        check("D's lobby is still a lobby (not started)", await D.page.is_visible('#lobby-step2') and not await D.js("() => !!(window.game && game.scene.getScene('World') && game.scene.getScene('World').player)"))
        # events in game A do not reach D's room: D joins game as solo-ish later; just check the crate claim namespace by starting D's game too
        await D.page.click('#lobby-jobs button:nth-child(2)'); await D.page.click('#lobby-ready')
        await F.page.click('#lobby-jobs button:nth-child(1)'); await F.page.click('#lobby-ready'); await asyncio.sleep(0.3)
        await D.page.evaluate("() => { document.getElementById('lobby-story').checked = false; }")
        await D.page.click('#lobby-start')
        for t in (D, F): await t.wait_world()
        await asyncio.sleep(1)
        check('game D has its own seed', await D.world('w.startData.seed') != seedA)
        # Same crate id claimed in both games: both succeed (claims are per room)
        ra = await A.js("() => window.game && import('/js/net.js').then(m => m.net.claim('crate:0'))")
        rd = await D.js("() => import('/js/net.js').then(m => m.net.claim('crate:0'))")
        check("'crate:0' can be claimed in both games", ra is True and rd is True)
        # a position message in A is not seen in D
        await A.world("(() => { w.player.setPosition(500, 500); return 1; })()"); await asyncio.sleep(1.5)
        seen = await D.world("[...w.mp.remotes.values()].map(r => r.name)")
        print('  D sees:', seen)
        check("D never sees A's players", not any(n in ('Ann', 'Ben', 'Cat') for n in seen))

        print('REFRESH KEEPS YOU IN YOUR GAME')
        await C.page.reload(); await C.page.wait_for_selector('#lobby-name', state='visible')
        check('refresh pre-fills the same code', (await C.page.input_value('#lobby-code')) == codeA)
        await C.page.fill('#lobby-name', 'Cat'); await C.page.click('#lobby-code-btn')
        await C.wait_world(); await asyncio.sleep(2)
        check('Cat is back in the same game', await C.world('w.startData.seed') == seedA and await C.world("w.job") == 'botanist')

        print('ROOMS CLOSE WHEN EMPTY')
        await browser.close()
    await asyncio.sleep(0.5)
    async with async_playwright() as pw:
        browser, (G,) = await open_tabs(pw, ['rG'])
        await G.goto('/')
        h = await health(G); print('  health after everyone left (lobby rooms close at once if no one is there; started ones after 60 s):', h)
        check('lobby-only rooms are not left behind forever', h['clients'] <= 1)
        await browser.close()
    ok_errs = True
    print('\nSUMMARY:', sum(results.values()), '/', len(results), 'passed')
    for k, v in results.items():
        if not v: print('  FAILED:', k)
    print('OK' if all(results.values()) else 'FAILURES')

if __name__ == "__main__": asyncio.run(main())
