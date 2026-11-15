"""The opening crawl: shown when a game starts with the story on; only the host can skip, and a skip ends it for
everyone; with the story off (or a quick test without story) there's no crawl."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

results = {}
def check(name, ok):
    results[name] = bool(ok); print(('  PASS ' if ok else '  FAIL ') + name)

async def main():
    async with async_playwright() as pw:
        browser, (A, B, C) = await open_tabs(pw, ['crA', 'crB', 'crC'])
        code = await lobby_join(A, 'Ann', 'pilot', host=True, story=True)
        await lobby_join(B, 'Ben', 'builder', code=code)
        await asyncio.sleep(0.6)
        await A.page.evaluate("() => { document.getElementById('lobby-story').checked = true; }")
        await A.page.click('#lobby-start')
        for t in (A, B): await t.page.wait_for_selector('#crawl .crawl-inner', state='visible', timeout=20000)
        check('the crawl is the first screen for both players', True)
        check('the host sees "Space: skip"', 'Space' in await A.page.inner_text('#crawl .crawl-skip'))
        check('the other player sees "The host can skip"', 'host' in await B.page.inner_text('#crawl .crawl-skip'))
        await asyncio.sleep(1); await B.page.keyboard.press('Space'); await asyncio.sleep(0.6)
        check("a non-host can't skip", await B.page.is_visible('#crawl'))
        await A.page.keyboard.press('Space'); await asyncio.sleep(1.5)
        check("the host's skip ends it for the host", not await A.page.is_visible('#crawl'))
        check('... and for the crew', not await B.page.is_visible('#crawl'))
        check('both move on to launch day', 'Interview' in await A.active() and 'Interview' in await B.active())
        await C.goto('/?job=pilot'); await C.wait_world(); await asyncio.sleep(0.5)
        check('no crawl with the story off', not await C.page.is_visible('#crawl'))
        ok = report([A, B, C])
        await browser.close()
    print('\nSUMMARY:', sum(results.values()), '/', len(results), 'passed')
    for k, v in results.items():
        if not v: print('  FAILED:', k)
    print('OK' if all(results.values()) and ok else 'FAILURES')

asyncio.run(main())
