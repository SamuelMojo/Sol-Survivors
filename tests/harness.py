"""Playwright harness for Sol Survivors tests (headless Chrome against localhost:3000).

Setup once:  pip install playwright && python3 -m playwright install chromium
Run:         npm start   (in another terminal), then  python3 tests/<name>.py
Env:         SOL_URL (default http://localhost:3000), SOL_CHROME (a Chrome to use), SOL_SHOTS (screenshot folder)
"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright

BASE = os.environ.get('SOL_URL', 'http://localhost:3000')
SHOTS = os.environ.get('SOL_SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'))   # screenshots go here (not in git)
os.makedirs(SHOTS, exist_ok=True)

AUTO_CLOSE_FACTS = """() => { if (window.__factCloser) return; window.__factCloser = setInterval(() => {
  const f = game.scene.getScene('Fact'); if (!f || !f.scene.isActive()) { window.__factSeen = 0; return; }
  window.__factSeen = window.__factSeen || performance.now();
  if (performance.now() - window.__factSeen > 300) { window.__factSeen = 0; f.close(); }
}, 50); }"""

class Tab:
    def __init__(self, page, name):
        self.page, self.name, self.errors, self.logs = page, name, [], []
        page.on('console', lambda m: (self.errors.append(m.text) if m.type == 'error' else self.logs.append(m.text)))
        page.on('pageerror', lambda e: self.errors.append(str(e)))

    async def goto(self, path):
        await self.page.goto(BASE + path)

    async def js(self, code):
        return await self.page.evaluate(code)

    async def world(self, code):
        """Run code with `w` = the World scene."""
        return await self.page.evaluate("(() => { const w = game.scene.getScene('World'); return (%s); })()" % code)

    async def key(self, k, ms=60):
        if getattr(self, 'auto_facts', False): await self.no_fact()
        await self.page.keyboard.down(k); await asyncio.sleep(ms / 1000); await self.page.keyboard.up(k)

    async def skip_crawl(self, timeout=20):
        """The story starts with the opening crawl (js/crawl.js): wait for it, then skip it with Space."""
        await self.page.wait_for_selector('#crawl .crawl-inner', state='visible', timeout=timeout * 1000)
        await asyncio.sleep(0.3); await self.page.keyboard.press('Space'); await asyncio.sleep(0.3)

    async def no_fact(self, timeout=4):
        """Wait until no science-fact screen is open or waiting (they close by themselves in most tests)."""
        for _ in range(int(timeout * 20)):
            busy = await self.page.evaluate("() => { const f = window.game && game.scene.getScene('Fact'), w = window.game && game.scene.getScene('World'); return !!(f && f.scene.isActive()) || !!(w && w.factQueue && w.factQueue.length) || !!(w && w.now && w.now() - (w.uiClosedAt ?? -1e9) < 200); }")
            if not busy: return
            await asyncio.sleep(0.05)

    async def shot(self, name):
        await self.page.screenshot(path=f'{SHOTS}/{self.name}-{name}.png')

    async def wait_world(self, timeout=20, facts=False):
        """Wait for the Mars scene. Unless facts=True, science-fact screens close by themselves after 0.3 s
        (most tests aren't about facts; tests/menus.py tests the fact screen itself)."""
        for _ in range(timeout * 10):
            ok = await self.page.evaluate("() => !!(window.game && game.scene.getScene('World') && game.scene.getScene('World').player)")
            if ok:
                if not facts: await self.page.evaluate(AUTO_CLOSE_FACTS); self.auto_facts = True
                return True
            await asyncio.sleep(0.1)
        raise RuntimeError(f'{self.name}: World scene never started')

    async def active(self):
        return await self.page.evaluate("() => game.scene.getScenes(true).map(s => s.scene.key)")

async def open_tabs(pw, names, size=(960, 640)):
    # Chrome: SOL_CHROME=/path/to/chrome, else /usr/bin/google-chrome if it exists, else Playwright's own Chromium
    chrome = os.environ.get('SOL_CHROME') or ('/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None)
    browser = await pw.chromium.launch(**({'executable_path': chrome} if chrome else {}), args=['--no-sandbox', '--use-gl=swiftshader', '--mute-audio'])
    tabs = []
    for n in names:
        ctx = await browser.new_context(viewport={'width': size[0], 'height': size[1]})
        page = await ctx.new_page()
        tabs.append(Tab(page, n))
    return browser, tabs

async def lobby_join(tab, name, job, host=False, story=False, code=None):
    """Join through the real lobby (multiplayer). The host (no code) creates a game; the others pass its code.
    Returns the game code."""
    p = tab.page
    await tab.goto('/')
    await p.fill('#lobby-name', name)
    if code:
        await p.fill('#lobby-code', code)
        await p.click('#lobby-code-btn')
    else:
        await p.click('#lobby-join-btn')
    await p.wait_for_selector('#lobby-step2', state='visible')
    await asyncio.sleep(0.3)
    # pick job: the job buttons are in #lobby-jobs in JOBS order
    idx = ['botanist', 'builder', 'pilot'].index(job)
    await p.click(f'#lobby-jobs button:nth-child({idx + 1})')
    await asyncio.sleep(0.2)
    await p.click('#lobby-ready')
    await asyncio.sleep(0.2)
    if host:
        await p.evaluate("(s) => { document.getElementById('lobby-story').checked = s; }", story)
    for _ in range(30):
        c = await p.inner_text('#lobby-room')
        if 'GAME CODE' in c: break
        await asyncio.sleep(0.1)
    return c.split('GAME CODE:')[1].split()[0].strip()

def report(tabs):
    bad = False
    for t in tabs:
        errs = [e for e in t.errors if 'favicon' not in e and 'audio' not in e.lower() and '404' not in e]
        if errs:
            bad = True
            print(f'[{t.name}] CONSOLE ERRORS:'); [print('   ', e[:300]) for e in errs]
    return not bad

async def canvas_xy(t, gx, gy):
    r = await t.js("() => { const c = document.querySelector('#game canvas').getBoundingClientRect(); return [c.left, c.top, c.width / 480, c.height / 320]; }")
    return r[0] + gx * r[2], r[1] + gy * r[3]
