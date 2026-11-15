"""Baseline smoke test: solo quick-test loads for each job, no console errors, screenshot."""
import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))   # (the tests folder)
from harness import *

async def main():
    async with async_playwright() as pw:
        browser, tabs = await open_tabs(pw, ['builder', 'botanist', 'pilot'])
        for t in tabs:
            await t.goto(f'/?job={t.name}')
            await t.wait_world()
            await asyncio.sleep(1.5)
            print(t.name, 'active scenes:', await t.active())
            print(t.name, 'job:', await t.world("w.job"), 'sol/min:', await t.world("[w.survival.sol, Math.round(w.survival.min)]"))
            await t.shot('start')
        ok = report(tabs)
        await browser.close()
        print('OK' if ok else 'ERRORS')

asyncio.run(main())
