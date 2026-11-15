"""Generates the starter pixel art for Sol Survivors (placeholder art; replace with Piskel/Aseprite art later).

Run:  python3 levels/art/make-art.py          (writes the PNGs next to this script)
Needs Python 3 and Pillow (pip install pillow).
WARNING: this overwrites the PNGs in this folder, including any you have redrawn by hand.

👤 Owner: Level design (art).
"""
import os, random, sys
from PIL import Image, ImageDraw

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))   # output folder
random.seed(7)
T = 16

def rgb(h):
    """Hex colour ('#ff8a3d' or '#f80') -> (r, g, b)."""
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

# ---------------- TILESET (5 cols x 5 rows = 25 tiles) ----------------
COLS, ROWS = 5, 5
ts = Image.new('RGBA', (COLS * T, ROWS * T), (0, 0, 0, 0))

def tile(i):
    """Top-left pixel of tile number i in the tileset (5 tiles per row)."""
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0)); return img, ImageDraw.Draw(img)

def speckle(d, base, cols, n):
    """Fill a 16x16 tile with a base colour and n random specks for texture."""
    d.rectangle([0, 0, T - 1, T - 1], fill=rgb(base))
    for _ in range(n):
        x, y = random.randrange(T), random.randrange(T)
        d.point((x, y), fill=rgb(random.choice(cols)))

def put(i, img):
    """Paste a finished 16x16 tile into the tileset at position i."""
    ts.paste(img, ((i % COLS) * T, (i // COLS) * T), img)

SAND = ['#a64b2a', '#c0643a', '#9a4524', '#c97446']
# 0-2 sand variants
for i, n in enumerate([14, 22, 30]):
    im, d = tile(i); speckle(d, '#b4572f', SAND, n); put(i, im)
# 3 dark sand
im, d = tile(3); speckle(d, '#97452a', ['#86391f', '#a5502f', '#7d351d'], 26); put(3, im)
# 4 dune light, 5 dune ripple
im, d = tile(4); speckle(d, '#c9764a', ['#d68a5c', '#bd6a40', '#e09a6c'], 18); put(4, im)
im, d = tile(5); speckle(d, '#c9764a', ['#d68a5c', '#bd6a40'], 10)
for y in (3, 9, 15):
    for x in range(T): d.point((x, (y + (x // 4) % 2) % T), fill=rgb('#a95e36'))
put(5, im)
# 6 path (rover tracks)
im, d = tile(6); speckle(d, '#b4572f', SAND, 12)
for y in range(T):
    if y % 3: d.point((4, y), fill=rgb('#8e3f22')); d.point((11, y), fill=rgb('#8e3f22'))
put(6, im)
# 7 concrete base pad
im, d = tile(7); d.rectangle([0, 0, 15, 15], fill=rgb('#8f8478'))
for _ in range(10): d.point((random.randrange(T), random.randrange(T)), fill=rgb('#7d7368'))
d.line([0, 15, 15, 15], fill=rgb('#6f665c')); d.line([15, 0, 15, 15], fill=rgb('#6f665c')); put(7, im)
# 8 crater floor, 9 crater rim
im, d = tile(8); speckle(d, '#8a3d22', ['#7a341c', '#96462a'], 18); put(8, im)
im, d = tile(9); speckle(d, '#c76d40', ['#d98252', '#b45a33'], 18); put(9, im)
# 10 bedrock (delta layers)
im, d = tile(10); d.rectangle([0, 0, 15, 15], fill=rgb('#a0583a'))
for y, c in ((2, '#8d4b30'), (6, '#b8694a'), (10, '#8d4b30'), (13, '#c27552')):
    d.line([0, y, 15, y], fill=rgb(c))
put(10, im)
# 11 hazard ground (reactor zone) - greenish tinted sand with warning stripes faint
im, d = tile(11); speckle(d, '#8c6a3a', ['#7e5e33', '#9c7a44', '#6f9a4a'], 20); put(11, im)
# 12 scorched ground
im, d = tile(12); speckle(d, '#5a2f22', ['#3d221a', '#6e3a28', '#2e1a14'], 40); put(12, im)

def blob(d, cx, cy, r, base, light, dark):
    """A rounded rock shape with a lit top and a shaded bottom."""
    for y in range(T):
        for x in range(T):
            dx, dy = (x - cx) / r[0], (y - cy) / r[1]
            if dx * dx + dy * dy <= 1:
                c = base
                if dy < -0.35 and dx < 0.3: c = light
                if dy > 0.45: c = dark
                d.point((x, y), fill=rgb(c))

# 13 small rock (collide)
im, d = tile(13)
d.ellipse([3, 12, 13, 15], fill=(0, 0, 0, 60)); blob(d, 8, 10, (5, 4), '#7d4428', '#9a5a3a', '#5f311d'); put(13, im)
# 14 boulder
im, d = tile(14)
d.ellipse([0, 11, 15, 15], fill=(0, 0, 0, 70)); blob(d, 8, 8, (7.5, 6.5), '#6e3a22', '#94563a', '#4f2817'); put(14, im)
# 15 ridge rock (cliff)
im, d = tile(15); d.rectangle([0, 0, 15, 15], fill=rgb('#5f311d'))
for y in range(T):
    for x in range(T):
        if (x + y * 3) % 7 == 0: d.point((x, y), fill=rgb('#7d4428'))
d.line([0, 0, 15, 0], fill=rgb('#9a5a3a')); d.line([0, 1, 15, 1], fill=rgb('#86492e')); put(15, im)
# 16 scrap metal (crash debris, collide)
im, d = tile(16); d.ellipse([1, 10, 15, 15], fill=(0, 0, 0, 70))
d.polygon([(2, 12), (6, 4), (13, 6), (14, 12)], fill=rgb('#8e949b')); d.line([6, 4, 13, 6], fill=rgb('#c6cdd1'))
d.line([4, 10, 12, 10], fill=rgb('#55595e')); d.point((9, 7), fill=rgb('#ff8a3d')); put(16, im)
# 17 reactor debris (glowing, collide)
im, d = tile(17); d.ellipse([1, 11, 15, 15], fill=(0, 0, 0, 70))
d.rectangle([3, 5, 12, 13], fill=rgb('#55595e')); d.rectangle([4, 6, 11, 12], fill=rgb('#3c3f43'))
for x, y in ((5, 8), (8, 7), (10, 10), (6, 11)): d.point((x, y), fill=rgb('#9dff6a'))
d.line([3, 5, 12, 5], fill=rgb('#ffd34d')); d.point((4, 5), fill=rgb('#222')); d.point((8, 5), fill=rgb('#222')); put(17, im)
# 18 hazard warning marker post (collide)
im, d = tile(18); d.ellipse([4, 13, 11, 15], fill=(0, 0, 0, 70))
d.rectangle([7, 4, 8, 15], fill=rgb('#cfcfcf')); d.polygon([(4, 1), (11, 1), (7.5, 6)], fill=rgb('#ffd34d'))
d.point((7, 3), fill=rgb('#222')); put(18, im)
# 19 ice-dusted rock (shade side frost) collide
im, d = tile(19); d.ellipse([2, 12, 14, 15], fill=(0, 0, 0, 60))
blob(d, 8, 9, (6, 5), '#6e3a22', '#e8eef2', '#4f2817'); put(19, im)

# 20-24: the crater wall: mountains all round the edge of the map, so the world doesn't just stop.
# (Their own random numbers, so adding them doesn't change any other picture.)
mr = random.Random(77)
def speck2(d, base, cols, n):
    """Like speckle(), using the mountains' own random numbers."""
    d.rectangle([0, 0, T - 1, T - 1], fill=rgb(base))
    for _ in range(n): d.point((mr.randrange(T), mr.randrange(T)), fill=rgb(mr.choice(cols)))
# 20 mountain rock (collide)
im, d = tile(20); speck2(d, '#5a2c1a', ['#4a2415', '#6b3622', '#3f1f12'], 40)
for k in range(3): x = mr.randrange(2, 13); d.line([x, mr.randrange(0, 8), x + mr.choice((-2, 2)), 15], fill=rgb('#3f1f12'))
put(20, im)
# 21 mountain peak (lit ridge lines, collide)
im, d = tile(21); speck2(d, '#5a2c1a', ['#4a2415', '#6b3622'], 30)
d.polygon([(0, 15), (6, 3), (9, 6), (15, 15)], fill=rgb('#6b3622')); d.line([0, 15, 6, 3], fill=rgb('#a0603e')); d.line([6, 3, 9, 6], fill=rgb('#c27552'))
put(21, im)
# 22 mountain foot: boulders piled at the bottom of the wall (collide)
im, d = tile(22); speck2(d, '#7d4428', ['#6b3622', '#8e4f2f'], 20)
for cx, cy, r in ((4, 10, 4), (11, 9, 4), (8, 4, 3)): d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgb('#5f311d')); d.arc([cx - r, cy - r, cx + r, cy + r], 200, 300, fill=rgb('#9a5a3a'))
put(22, im)
# 23 crater wall slope: walkable rocky ground at the edge
im, d = tile(23); speck2(d, '#9a4f2c', ['#b4572f', '#86441f', '#a85a34'], 26)
for k in range(2): y = mr.randrange(2, 14); d.line([0, y, 15, y + mr.choice((-1, 1))], fill=rgb('#7d3e1f'))
put(23, im)
# 24 building sign post (decoration on the ground layer is not used; kept free for later)
put(24, Image.new('RGBA', (T, T), (0, 0, 0, 0)))
ts.save(f'{OUT}/tiles.png')

# ---------------- ASTRONAUTS: 4 rows (down,left,right,up) x 3 frames, 16x16 ----------------
SPR = {
 'down': ["..WWWWWW..", ".WWWWWWWW.", ".WVVVVVVW.", ".WVLVVVVW.", ".WWWWWWWW.", "..WWWWWW..", ".KWCCCCWK.", "WKWCCCCWKW", "W.WWWWWW.W", "..WWDDWW..", "..WWWWWW..", "..WW..WW..", "..WW..WW..", "..DD..DD.."],
 'up':   ["..WWWWWW..", ".WWWWWWWW.", ".WWWWWWWW.", ".WWWWWWWW.", ".WWWWWWWW.", "..WWWWWW..", ".KKKKKKKK.", "WKKCCKKKKW", "W.KKKKKK.W", "..WWWWWW..", "..WWWWWW..", "..WW..WW..", "..WW..WW..", "..DD..DD.."],
 'left': ["..WWWWWW..", ".WWWWWWWW.", ".VVVVWWWW.", ".VLVVWWWW.", ".WWWWWWWW.", "..WWWWWW..", "..WCCWKKK.", "..WCCWKKK.", "..WWWWKKK.", "..WWDWW...", "..WWWWW...", "..WW.WW...", "..WW.WW...", "..DD.DD..."],
}
SPR['right'] = [r[::-1] for r in SPR['left']]

def walk(rows, f):
    """Draw one astronaut frame (facing row, step frame f)."""
    rows = list(rows)
    if f == 1:
        rows[11] = rows[11].replace('WW..WW', 'WW...W').replace('WW.WW', 'WW..W'); rows[13] = rows[13].replace('DD..DD', 'DD...D').replace('DD.DD', 'DD..D')
    if f == 2:
        rows[11] = rows[11].replace('WW..WW', 'W...WW').replace('WW.WW', 'W..WW'); rows[13] = rows[13].replace('DD..DD', 'D...DD').replace('DD.DD', 'D..DD')
    return rows

JOBS = {'botanist': '#7bd88f', 'builder': '#ff8a3d', 'pilot': '#6cc4ff'}
for job, col in JOBS.items():
    pal = {'W': '#f2f2f2', 'V': '#d9a426', 'L': '#fff7c2', 'C': col, 'K': '#9aa0a6', 'D': '#555b61'}
    sheet = Image.new('RGBA', (16 * 3, 16 * 4), (0, 0, 0, 0)); d = ImageDraw.Draw(sheet)
    for r, dirn in enumerate(['down', 'left', 'right', 'up']):
        for f in range(3):
            rows = walk(SPR[dirn], f)
            for j, row in enumerate(rows):
                for i, ch in enumerate(row):
                    if ch != '.': d.point((f * 16 + 3 + i, r * 16 + 1 + j), fill=rgb(pal[ch]))
    sheet.save(f'{OUT}/astronaut-{job}.png')

# ---------------- BUILDINGS ----------------
def dome(w, h, body, ribs, glass=None):
    """A domed building (hab, greenhouse) of size w x h."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    # a soft shadow, a little to the right (the same way as the other buildings' shadows)
    d.ellipse([4, h - 9, w - 1, h], fill=(0, 0, 0, 30)); d.ellipse([8, h - 8, w - 5, h - 1], fill=(0, 0, 0, 30))
    dh = h - 10
    for yy in range(dh):
        t = yy / dh; hw = ((1 - (1 - t) ** 2) ** 0.5) * (w / 2 - 2)
        c = body if not glass else glass
        if yy < 4: c = '#f4efe6' if not glass else '#cfeee6'
        elif (yy // 7) % 2 and not glass: c = ribs
        d.line([w / 2 - hw, yy, w / 2 + hw, yy], fill=rgb(c) if isinstance(c, str) else c)
    d.rectangle([0, h - 12, w - 1, h - 7], fill=rgb('#8b8173'))
    return im, d

# Hab 96x72
im, d = dome(96, 72, '#d6cdbf', '#e2dbcf')
for i in range(-3, 4):
    x = 48 + i * 12; d.line([x, 10 + abs(i) * 4, x, 60], fill=rgb('#b9ad9c'))
d.rectangle([40, 42, 55, 60], fill=rgb('#5b6670')); d.rectangle([42, 44, 53, 60], fill=rgb('#2e3940')); d.point((50, 52), fill=rgb('#ffd34d'))
d.rectangle([14, 30, 23, 36], fill=rgb('#3a7fb0')); d.rectangle([72, 30, 81, 36], fill=rgb('#3a7fb0'))
d.line([62, 0, 62, 10], fill=rgb('#888')); d.rectangle([60, 0, 65, 2], fill=rgb('#ff5f5f'))
im.save(f'{OUT}/b-hab.png')

# Greenhouse 96x60
im, d = dome(96, 60, None, None, glass=(127, 201, 185, 200))
for i in range(1, 6): d.line([i * 16, 8, i * 16, 48], fill=rgb('#cfeee6'))
for i in range(4):
    x = 10 + i * 20; d.rectangle([x, 40, x + 13, 45], fill=rgb('#5a3420'))
    d.line([x + 3, 36, x + 3, 40], fill=rgb('#4caf50')); d.line([x + 9, 37, x + 9, 40], fill=rgb('#4caf50'))
d.rectangle([42, 44, 53, 49], fill=rgb('#2e3940'))
im.save(f'{OUT}/b-greenhouse.png')

def boxb(w, h, wall, roof, door_col='#2e3940'):
    """A boxy building (workshop, garage) of size w x h."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([0, h - 6, w - 1, h], fill=(0, 0, 0, 70))
    d.rectangle([2, 10, w - 3, h - 4], fill=rgb(wall)); d.rectangle([0, 4, w - 1, 12], fill=rgb(roof))
    d.line([0, 4, w - 1, 4], fill=rgb('#e7ebef'))
    for x in range(6, w - 6, 6): d.line([x, 14, x, h - 6], fill=rgb('#00000022') if False else (0, 0, 0, 25))
    return im, d

# Workshop 80x56
im, d = boxb(80, 56, '#9aa3a8', '#c6cdd1')
d.rectangle([30, 30, 49, 51], fill=rgb('#2e3940')); d.line([30, 35, 49, 35], fill=rgb('#55595e')); d.line([30, 40, 49, 40], fill=rgb('#55595e'))
d.rectangle([8, 20, 18, 26], fill=rgb('#3a7fb0')); d.rectangle([60, 20, 70, 26], fill=rgb('#3a7fb0'))
d.rectangle([60, 0, 63, 6], fill=rgb('#777')); d.polygon([(6, 30), (14, 22), (22, 30)], fill=rgb('#ffd34d'))
im.save(f'{OUT}/b-workshop.png')

# Garage 96x56
im, d = boxb(96, 56, '#a69a8a', '#c9bfb1')
d.rectangle([20, 22, 75, 51], fill=rgb('#4a4f55'))
for y in range(24, 51, 4): d.line([20, y, 75, y], fill=rgb('#5c626a'))
d.rectangle([82, 30, 89, 51], fill=rgb('#2e3940'))
im.save(f'{OUT}/b-garage.png')

# Laser comms tower 48x80: a building with a mast and a laser telescope pointing up at Earth
# (like NASA's Deep Space Optical Communications, which sent data by laser in 2023)
im = Image.new('RGBA', (48, 80), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.ellipse([4, 74, 44, 80], fill=(0, 0, 0, 70))
d.rectangle([8, 54, 39, 76], fill=rgb('#9aa3a8')); d.rectangle([8, 52, 39, 55], fill=rgb('#c6cdd1')); d.rectangle([19, 62, 28, 76], fill=rgb('#2e3940'))
d.line([24, 52, 24, 30], fill=rgb('#777')); d.line([23, 52, 23, 30], fill=rgb('#999'))
d.rectangle([17, 26, 30, 31], fill=rgb('#6f777d'))                          # mount
d.polygon([(16, 26), (22, 10), (31, 13), (26, 28)], fill=rgb('#e8e8e8'))   # telescope tube, tilted up
d.line([16, 26, 22, 10], fill=rgb('#ffffff')); d.line([26, 28, 31, 13], fill=rgb('#b8bec3'))
d.polygon([(22, 10), (31, 13), (30, 9), (23, 7)], fill=rgb('#1d2f5c'))     # lens end
d.line([27, 8, 33, 0], fill=rgb('#7bff8f'))                                # the laser beam
d.point((27, 9), fill=rgb('#c8ffd0'))
im.save(f'{OUT}/b-comms.png')

def rocket_marks(im):
    """Our own mission patch (a Mars disc, a little rocket and a star in a gold ring) and NASA down the side.
    Painted on the rocket in rocket-ship.png and b-rocket.png, so every scene shows the same rocket."""
    patch = ["...GGGGG...","..GOOOOOG..",".GOOOOOOWG.","GOOOdOOWWOG","GOOddOWWOOG","GOOOOWWOOOG","GOOOWWOOYOG","GOOFOOOYYYG",".GOOOOOOYG.","..GOOOOOOG.","...GGGGG..."]
    col = {'G': '#ffd34d', 'O': '#d0583a', 'd': '#8a3a24', 'W': '#ffffff', 'F': '#ff8a3d', 'Y': '#ffd34d'}
    font = {'N': ["#..#","##.#","#.##","#..#","#..#"], 'A': [".##.","#..#","####","#..#","#..#"], 'S': [".###","#...",".##.","...#","###."]}
    for j, row in enumerate(patch):
        for i, c in enumerate(row):
            if c != '.': im.putpixel((15 + i, 45 + j), (*rgb(col[c]), 255))
    y = 60
    for ch in 'NASA':
        for j, row in enumerate(font[ch]):
            for i, c in enumerate(row):
                if c == '#': im.putpixel((18 + i, y + j), (*rgb('#c8102e'), 255))
        y += 7
# Rocket (ascent vehicle) on Mars, 48x128: the launch pad and the SAME rocket as on launch day on Earth.
# No ladder in the picture: the game draws a separate ladder next to it (WorldScene), which the crew climbs.
im = Image.new('RGBA', (48, 128), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([0, 118, 47, 127], fill=rgb('#6e6e6e')); d.line([0, 118, 47, 118], fill=rgb('#8a8a8a'))
x0, x1 = 10, 30
for i in range(12):
    w = int(20 * i / 12); d.line([20 - w // 2, 6 + i, 20 + w // 2, 6 + i], fill=rgb('#eeeeee'))
d.rectangle([x0, 18, x1, 104], fill=rgb('#eeeeee')); d.rectangle([x0, 18, x0 + 2, 104], fill=rgb('#cfcfcf'))
d.rectangle([x0, 38, x1, 41], fill=rgb('#ff5f5f')); d.rectangle([17, 26, 22, 31], fill=rgb('#3a7fb0'))
d.rectangle([6, 92, 9, 108], fill=rgb('#cfcfcf')); d.rectangle([31, 92, 34, 108], fill=rgb('#cfcfcf'))
d.rectangle([13, 104, 27, 112], fill=rgb('#555'))
rocket_marks(im); im.save(f'{OUT}/b-rocket.png')

# The same rocket on its own (no launch pad or tower), for launch day on Earth: only the rocket flies up.
im = Image.new('RGBA', (48, 128), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
for i in range(12):
    w = int(20 * i / 12); d.line([20 - w // 2, 6 + i, 20 + w // 2, 6 + i], fill=rgb('#eeeeee'))
d.rectangle([x0, 18, x1, 104], fill=rgb('#eeeeee')); d.rectangle([x0, 18, x0 + 2, 104], fill=rgb('#cfcfcf'))
d.rectangle([x0, 38, x1, 41], fill=rgb('#ff5f5f')); d.rectangle([17, 26, 22, 31], fill=rgb('#3a7fb0'))
d.rectangle([6, 92, 9, 108], fill=rgb('#cfcfcf')); d.rectangle([31, 92, 34, 108], fill=rgb('#cfcfcf'))
d.rectangle([13, 104, 27, 112], fill=rgb('#555'))
rocket_marks(im); im.save(f'{OUT}/rocket-ship.png')

# Crashed lander (wreck) 64x40
im = Image.new('RGBA', (64, 40), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.ellipse([0, 30, 63, 39], fill=(0, 0, 0, 80))
d.polygon([(6, 34), (10, 14), (40, 8), (56, 20), (58, 34)], fill=rgb('#7a7f86')); d.line([10, 14, 40, 8], fill=rgb('#c6cdd1'))
d.rectangle([22, 18, 30, 24], fill=rgb('#2a2a2a')); d.rectangle([44, 14, 52, 22], fill=rgb('#f4efe6')); d.rectangle([46, 16, 49, 19], fill=rgb('#ff5f5f'))
d.line([2, 36, 14, 30], fill=rgb('#55595e'), width=2); d.line([50, 30, 62, 36], fill=rgb('#55595e'), width=2)
im.save(f'{OUT}/b-wreck.png')

# Rover 32x24 (parked)
im = Image.new('RGBA', (32, 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.ellipse([1, 18, 31, 23], fill=(0, 0, 0, 70))
d.rectangle([3, 8, 28, 16], fill=rgb('#e8e8e8')); d.rectangle([3, 8, 28, 9], fill=rgb('#ffffff'))
d.rectangle([18, 4, 27, 9], fill=rgb('#3a7fb0')); d.rectangle([5, 4, 14, 7], fill=rgb('#1d2f5c'))
for x in (5, 13, 21): d.ellipse([x, 15, x + 6, 21], fill=rgb('#333')); d.point((x + 3, 18), fill=rgb('#888'))
d.line([8, 1, 8, 4], fill=rgb('#999'))
im.save(f'{OUT}/rover.png')

# Rover spritesheet: 6 frames of 32x24 in a row, 2 wheel frames for each view:
#   0-1 side (facing right; the game flips it for left)   2-3 driving down (front)   4-5 driving up (back)
# 3 seats (driver + 2 passengers). The game draws a helmet on each seat that someone is sitting in.
sheet = Image.new('RGBA', (32 * 6, 24), (0, 0, 0, 0))
def rover_side(f):
    im = Image.new('RGBA', (32, 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([1, 18, 31, 23], fill=(0, 0, 0, 70))
    d.rectangle([3, 9, 28, 16], fill=rgb('#e8e8e8')); d.rectangle([3, 9, 28, 10], fill=rgb('#ffffff'))
    d.rectangle([24, 4, 28, 9], fill=rgb('#3a7fb0')); d.line([24, 4, 28, 4], fill=rgb('#7fc0e8'))   # windscreen
    for x in (7, 13, 19): d.rectangle([x, 5, x + 3, 9], fill=rgb('#ff8a3d')); d.line([x, 5, x + 3, 5], fill=rgb('#ffb27a'))   # 3 seat backs
    d.line([4, 1, 4, 9], fill=rgb('#999')); d.point((4, 0), fill=rgb('#ff5f5f'))                    # antenna
    d.rectangle([27, 12, 29, 13], fill=rgb('#ffd34d'))                                              # headlight
    for x in (4, 12, 20):
        d.ellipse([x, 15, x + 7, 22], fill=rgb('#333')); d.ellipse([x + 2, 17, x + 5, 20], fill=rgb('#666'))
        sx, sy = ((x + 3, 16), (x + 6, 18))[f]; d.point((sx, sy), fill=rgb('#bbb'))                     # spinning spoke
    return im
def rover_front(f, back):
    im = Image.new('RGBA', (32, 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([2, 18, 30, 23], fill=(0, 0, 0, 70))
    for x in (2, 25):                                                                               # wheels with moving treads
        d.rectangle([x, 9, x + 4, 21], fill=rgb('#333'))
        for y in range(10 + f * 2, 21, 4): d.line([x, y, x + 4, y], fill=rgb('#666'))
    d.rectangle([6, 8, 25, 18], fill=rgb('#e8e8e8')); d.rectangle([6, 8, 25, 9], fill=rgb('#ffffff'))
    for x in (8, 14, 20): d.rectangle([x, 4, x + 3, 8], fill=rgb('#ff8a3d')); d.line([x, 4, x + 3, 4], fill=rgb('#ffb27a'))   # 3 seat backs
    if back:
        d.rectangle([7, 14, 9, 16], fill=rgb('#ff3355')); d.rectangle([22, 14, 24, 16], fill=rgb('#ff3355'))   # tail lights
        d.line([27, 1, 27, 8], fill=rgb('#999')); d.point((27, 0), fill=rgb('#ff5f5f'))
    else:
        d.rectangle([8, 10, 23, 13], fill=rgb('#3a7fb0')); d.line([8, 10, 23, 10], fill=rgb('#7fc0e8'))  # windscreen
        d.rectangle([7, 15, 9, 16], fill=rgb('#ffd34d')); d.rectangle([22, 15, 24, 16], fill=rgb('#ffd34d'))   # headlights
    return im
for i, im in enumerate([rover_side(0), rover_side(1), rover_front(0, False), rover_front(1, False), rover_front(0, True), rover_front(1, True)]):
    sheet.paste(im, (i * 32, 0), im)
sheet.save(f'{OUT}/rover-sheet.png')

# Loot crate 12x12 and compass is drawn in code
im = Image.new('RGBA', (12, 12), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.ellipse([0, 9, 11, 11], fill=(0, 0, 0, 60)); d.rectangle([1, 2, 10, 10], fill=rgb('#c49a5a')); d.line([1, 2, 10, 2], fill=rgb('#e3c08a'))
d.rectangle([1, 5, 10, 6], fill=rgb('#ff8a3d')); d.line([5, 2, 5, 10], fill=rgb('#8a6a3a'))
im.save(f'{OUT}/crate.png')
print('art ok')

# ---------------- ITEM ICONS (16x16 frames, one row) ----------------
icons = Image.new('RGBA', (16 * 19, 16), (0, 0, 0, 0))
def icon(i):
    """Top-left pixel of item icon i in items.png."""
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
def place(i, im):
    """Paste a finished icon into items.png at position i."""
    icons.paste(im, (i * 16, 0), im)
def packet(i, col, dot):
    """A seed packet icon in colour col with a seed dot."""
    im, d = icon(i)
    d.rectangle([3, 2, 12, 14], fill=rgb(col)); d.rectangle([3, 2, 12, 4], fill=rgb('#f4efe6'))
    d.line([3, 14, 12, 14], fill=(0, 0, 0, 90)); d.ellipse([5, 7, 10, 12], fill=rgb(dot)); d.point((6, 8), fill=rgb('#ffffff'))
    place(i, im)
packet(0, '#a8763e', '#d9b36a'); packet(1, '#a32638', '#ff6b6b'); packet(2, '#b8402f', '#ff6b4a')
im, d = icon(3); d.rounded_rectangle([3, 3, 12, 13], 2, fill=rgb('#c6cdd1')); d.rectangle([3, 3, 12, 5], fill=rgb('#9aa3a8')); d.rectangle([5, 8, 10, 10], fill=rgb('#ff8a3d')); place(3, im)
im, d = icon(4); d.rectangle([2, 5, 13, 13], fill=rgb('#ffd34d')); d.rectangle([2, 5, 13, 6], fill=rgb('#fff1a8')); d.ellipse([5, 8, 8, 11], fill=rgb('#d0583a')); d.ellipse([9, 8, 12, 11], fill=rgb('#7bd88f')); place(4, im)
im, d = icon(5); d.rounded_rectangle([5, 3, 10, 14], 2, fill=rgb('#6cc4ff')); d.rectangle([6, 1, 9, 3], fill=rgb('#9aa3a8')); d.line([6, 5, 6, 12], fill=rgb('#c7ecff')); d.rectangle([7, 7, 8, 9], fill=rgb('#1d2f5c')); place(5, im)
im, d = icon(6); d.rectangle([3, 4, 12, 14], fill=rgb('#ffb02e')); d.rectangle([9, 1, 11, 4], fill=rgb('#555')); d.line([3, 7, 12, 7], fill=rgb('#c97a10')); d.line([3, 11, 12, 11], fill=rgb('#c97a10')); place(6, im)
im, d = icon(7); d.rectangle([2, 4, 13, 13], fill=rgb('#f4efe6')); d.rectangle([6, 2, 9, 4], fill=rgb('#c6cdd1')); d.rectangle([7, 6, 8, 11], fill=rgb('#ff3355')); d.rectangle([5, 8, 10, 9], fill=rgb('#ff3355')); place(7, im)
im, d = icon(8); d.rectangle([1, 6, 14, 9], fill=rgb('#9aa3a8')); d.line([1, 6, 14, 6], fill=rgb('#c6cdd1')); d.rectangle([1, 5, 3, 10], fill=rgb('#6f777d')); d.rectangle([12, 5, 14, 10], fill=rgb('#6f777d')); place(8, im)
im, d = icon(9); d.ellipse([3, 3, 12, 12], outline=rgb('#ff8a3d'), width=2); d.ellipse([5, 5, 10, 10], outline=rgb('#d06a20')); d.line([12, 8, 15, 12], fill=rgb('#ff8a3d')); place(9, im)
im, d = icon(10); d.rectangle([2, 3, 13, 12], fill=rgb('#2f7d3a')); d.rectangle([5, 6, 9, 9], fill=rgb('#222'))
for x in (3, 11): d.line([x, 5, x, 10], fill=rgb('#ffd34d'))
d.line([9, 7, 12, 7], fill=rgb('#ffd34d')); place(10, im)
# 11 power core: a glowing fuel cylinder for the fission generators
im, d = icon(11); d.rectangle([4, 3, 11, 14], fill=rgb('#6f777d')); d.rectangle([4, 3, 11, 4], fill=rgb('#c6cdd1')); d.rectangle([4, 13, 11, 14], fill=rgb('#4a4f55'))
d.rectangle([6, 6, 9, 11], fill=rgb('#7bff8f')); d.line([7, 6, 7, 11], fill=rgb('#d8ffe0')); place(11, im)
im, d = icon(12); d.polygon([(5, 2), (10, 2), (12, 9), (3, 9)], fill=rgb('#eeeeee')); d.rectangle([3, 9, 12, 10], fill=rgb('#ff5f5f')); d.polygon([(5, 11), (10, 11), (12, 15), (3, 15)], fill=rgb('#555b61')); d.line([5, 2, 10, 2], fill=rgb('#ffffff')); place(12, im)
im, d = icon(13); d.polygon([(2, 11), (5, 4), (9, 6), (14, 3), (13, 12), (6, 13)], fill=rgb('#8e949b')); d.line([5, 4, 9, 6], fill=rgb('#c6cdd1')); d.line([4, 10, 11, 9], fill=rgb('#55595e')); place(13, im)
# 14 potato, 15 red cabbage, 16 tomato (harvested crops)
im, d = icon(14); d.ellipse([3, 5, 13, 13], fill=rgb('#b07a3e')); d.ellipse([4, 6, 9, 9], fill=rgb('#c99252'))
for x, y in ((6, 10), (10, 8), (9, 11)): d.point((x, y), fill=rgb('#7a4f22'))
place(14, im)
im, d = icon(15); d.ellipse([2, 4, 14, 14], fill=rgb('#8f1f2f')); d.ellipse([4, 5, 12, 13], fill=rgb('#c4364f')); d.ellipse([6, 7, 10, 11], fill=rgb('#e86b7f'))
d.arc([3, 5, 13, 14], 200, 340, fill=rgb('#f5c4cc')); d.line([8, 7, 8, 12], fill=rgb('#f5c4cc')); place(15, im)
im, d = icon(16); d.ellipse([3, 5, 13, 14], fill=rgb('#e0402f')); d.ellipse([5, 6, 8, 9], fill=rgb('#ff8a70')); d.polygon([(6, 4), (8, 2), (10, 4), (8, 6)], fill=rgb('#3f8f4a')); place(16, im)
# 17 fertilizer: a brown sack with a green sprout label (made at the hub toilet's recycler)
im, d = icon(17); d.polygon([(3, 5), (12, 5), (13, 14), (2, 14)], fill=rgb('#8a6a3a')); d.rectangle([5, 2, 10, 5], fill=rgb('#6b4a2c')); d.line([3, 5, 12, 5], fill=rgb('#c49a5a'))
d.rectangle([5, 8, 10, 12], fill=rgb('#f4efe6')); d.line([7, 12, 7, 9], fill=rgb('#4caf50')); d.point((6, 9), fill=rgb('#7bd88f')); d.point((8, 10), fill=rgb('#7bd88f')); place(17, im)
# 18 glowing rock sample: a dark rock with bright green crystal specks (only the Pilot picks these up)
im, d = icon(18); d.ellipse([2, 12, 14, 15], fill=(0, 0, 0, 60)); d.polygon([(3, 12), (4, 6), (8, 3), (12, 5), (13, 12)], fill=rgb('#5a4a5e')); d.line([4, 6, 8, 3], fill=rgb('#8a7a8e'))
for x, y in ((6, 8), (9, 6), (10, 10), (7, 11)): d.point((x, y), fill=rgb('#9dff6a'))
d.point((8, 7), fill=rgb('#d8ffc0')); place(18, im)
icons.save(f'{OUT}/items.png')

# ---------------- BASE EQUIPMENT ----------------
def generator_img(broken):
    """A small nuclear fission generator (like NASA's Kilopower/KRUSTY): a reactor can with a cone of radiator fins.
    Broken: dark, no glow, a bent fin and sparks."""
    im = Image.new('RGBA', (48, 28), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([4, 22, 44, 27], fill=(0, 0, 0, 70))
    d.rectangle([20, 14, 27, 24], fill=rgb('#6f777d')); d.rectangle([20, 14, 21, 24], fill=rgb('#9aa3a8'))   # reactor can
    d.polygon([(6, 16), (22, 2), (26, 2), (42, 16)], fill=rgb('#3a3f45' if broken else '#c6cdd1'))          # radiator cone
    for i in range(1, 7):
        x = 6 + i * 5; d.line([x, 16, 22 + i * 0.6, 3], fill=rgb('#2a2e33' if broken else '#8e949b'))
    d.line([22, 2, 26, 2], fill=rgb('#555' if broken else '#ffffff'))
    d.rectangle([22, 18, 25, 21], fill=rgb('#3a3a3a' if broken else '#7bff8f'))                              # status light
    if broken:
        d.line([34, 9, 44, 4], fill=rgb('#55595e'), width=2)                       # bent fin
        for x, y in ((30, 6), (33, 4), (16, 8)): d.point((x, y), fill=rgb('#ffd34d'))   # sparks
        d.line([30, 6, 32, 9], fill=rgb('#ffd34d'))
    return im
generator_img(False).save(f'{OUT}/eq-generator.png'); generator_img(True).save(f'{OUT}/eq-generator-broken.png')

im = Image.new('RGBA', (30, 26), (0, 0, 0, 0)); d = ImageDraw.Draw(im)   # MOXIE: a gold box (the real one rode on Perseverance)
d.ellipse([1, 20, 29, 25], fill=(0, 0, 0, 70)); d.rectangle([3, 6, 26, 22], fill=rgb('#d9a520')); d.rectangle([3, 6, 26, 8], fill=rgb('#ffe27a'))
d.line([3, 22, 26, 22], fill=rgb('#9a7414')); d.line([14, 9, 14, 21], fill=rgb('#b8891a'))
d.rectangle([6, 11, 11, 18], fill=rgb('#2e3940')); d.ellipse([7, 12, 10, 17], fill=rgb('#6cc4ff'))
# a tiny hand-drawn 'O2' that fits on the box
for x, y in ((16, 11), (17, 11), (15, 12), (18, 12), (15, 13), (18, 13), (15, 14), (18, 14), (16, 15), (17, 15)): d.point((x, y), fill=rgb('#5a3f08'))
for x, y in ((20, 13), (21, 13), (22, 14), (21, 15), (20, 16), (21, 16), (22, 16)): d.point((x, y), fill=rgb('#5a3f08'))
d.rectangle([20, 0, 23, 6], fill=rgb('#9aa3a8'))
im.save(f'{OUT}/eq-moxie.png')


# Storage chest 20x16
im = Image.new('RGBA', (20, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.ellipse([0, 12, 19, 15], fill=(0, 0, 0, 70)); d.rectangle([1, 3, 18, 13], fill=rgb('#9aa3a8')); d.rectangle([1, 3, 18, 6], fill=rgb('#c6cdd1'))
d.line([1, 7, 18, 7], fill=rgb('#6f777d')); d.rectangle([8, 6, 11, 9], fill=rgb('#ffd34d')); d.line([1, 3, 18, 3], fill=rgb('#e7ebef'))
im.save(f'{OUT}/chest.png')
# Opened crate 12x12
im = Image.new('RGBA', (12, 12), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.ellipse([0, 9, 11, 11], fill=(0, 0, 0, 60)); d.rectangle([1, 5, 10, 10], fill=rgb('#8a6a3a')); d.rectangle([2, 6, 9, 9], fill=rgb('#3d2a17')); d.line([0, 3, 7, 1], fill=rgb('#c49a5a'), width=2)
im.save(f'{OUT}/crate-open.png')
print('items ok')

# ---------------- INTERIOR TILESET (8 tiles in a row) ----------------
it = Image.new('RGBA', (16 * 8, 16), (0, 0, 0, 0))
def itile(i, img):
    """Paste a finished indoor tile into interior.png at position i."""
    it.paste(img, (i * 16, 0), img)
def floor(base, line, dots):
    """A 16x16 indoor floor tile."""
    im, d = tile(0); d.rectangle([0, 0, 15, 15], fill=rgb(base))
    d.line([0, 15, 15, 15], fill=rgb(line)); d.line([15, 0, 15, 15], fill=rgb(line))
    for x, y in dots: d.point((x, y), fill=rgb(line))
    return im
itile(0, floor('#b9bcc0', '#9a9ea3', [(3, 3), (12, 3), (3, 12), (12, 12)]))
im, d = tile(0); d.rectangle([0, 0, 15, 15], fill=rgb('#a9adb2'))
for x in range(1, 16, 3): d.line([x, 0, x, 15], fill=rgb('#8f9399'))
itile(1, im)
itile(2, floor('#6f8a5a', '#5b7349', [(4, 6), (11, 9), (7, 13)]))
itile(3, floor('#8f8478', '#776d62', [(5, 4), (10, 11)]))
im, d = tile(0); d.rectangle([0, 0, 15, 15], fill=rgb('#3a3f45')); d.line([0, 15, 15, 15], fill=rgb('#5b6168')); itile(4, im)
im, d = tile(0); d.rectangle([0, 0, 15, 15], fill=rgb('#d6cdbf')); d.rectangle([0, 0, 15, 2], fill=rgb('#f4efe6')); d.line([0, 15, 15, 15], fill=rgb('#8b8173'))
d.line([7, 3, 7, 14], fill=rgb('#c4baa9')); itile(5, im)
im, d = tile(0); d.rectangle([0, 0, 15, 15], fill=rgb('#d6cdbf')); d.rectangle([0, 0, 15, 2], fill=rgb('#f4efe6'))
d.rectangle([2, 4, 13, 12], fill=rgb('#2b1b33')); d.rectangle([3, 5, 12, 11], fill=rgb('#c9764a')); d.rectangle([3, 9, 12, 11], fill=rgb('#a6502c'))
d.point((10, 6), fill=rgb('#ffffff')); itile(6, im)
im, d = tile(0); d.rectangle([0, 0, 15, 15], fill=rgb('#3a3f45')); d.rectangle([2, 0, 13, 15], fill=rgb('#ffd34d'))
for y in range(0, 16, 4): d.line([2, y, 13, y + 3], fill=rgb('#3a3f45'))
itile(7, im)
it.save(f'{OUT}/interior.png')

# ---------------- FURNITURE ----------------
def furn(name, w, h, draw):
    """Make f-<name>.png, w x h tiles, using a draw(d, W, H) function."""
    im = Image.new('RGBA', (w * 16, h * 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im); draw(d, w * 16, h * 16); im.save(f'{OUT}/f-{name}.png')
def bunk(d, W, H):
    """A small single bunk (1 x 2 tiles): frame, blue blanket, white pillow."""
    d.rectangle([1, 1, W - 2, H - 2], fill=rgb('#6f777d')); d.rectangle([2, 3, W - 3, H - 3], fill=rgb('#3a7fb0'))
    d.rectangle([3, 4, W - 4, 9], fill=rgb('#f4efe6')); d.line([2, 18, W - 3, 18], fill=rgb('#2d6590'))
furn('bunk', 1, 2, bunk)
def medbed(d, W, H):
    d.rectangle([1, 4, W - 2, H - 3], fill=rgb('#c6cdd1')); d.rectangle([3, 6, W - 4, H - 5], fill=rgb('#f4efe6')); d.rectangle([4, 7, W - 5, 13], fill=rgb('#ffffff'))
    d.rectangle([W // 2 - 2, 22, W // 2 + 1, 33], fill=rgb('#ff3355')); d.rectangle([W // 2 - 6, 26, W // 2 + 5, 29], fill=rgb('#ff3355'))
    d.rectangle([W - 8, 0, W - 3, 6], fill=rgb('#6cc4ff'))
furn('medbed', 2, 3, medbed)
def table(d, W, H):
    d.rectangle([2, 4, W - 3, H - 6], fill=rgb('#e7ebef')); d.line([2, 4, W - 3, 4], fill=rgb('#ffffff')); d.rectangle([4, H - 6, 6, H - 2], fill=rgb('#8e949b')); d.rectangle([W - 7, H - 6, W - 5, H - 2], fill=rgb('#8e949b'))
    d.ellipse([10, 8, 17, 14], fill=rgb('#c6cdd1')); d.ellipse([28, 9, 34, 15], fill=rgb('#ffd34d'))
furn('table', 3, 2, table)
def planter(d, W, H):
    d.rectangle([0, 3, W - 1, H - 1], fill=rgb('#6b4a2c')); d.rectangle([2, 5, W - 3, H - 3], fill=rgb('#4a2d18'))
furn('planter', 3, 1, planter)
def bench(d, W, H):
    d.rectangle([1, 6, W - 2, H - 4], fill=rgb('#8a6a3a')); d.line([1, 6, W - 2, 6], fill=rgb('#c49a5a')); d.rectangle([3, H - 4, 5, H - 1], fill=rgb('#55595e')); d.rectangle([W - 6, H - 4, W - 4, H - 1], fill=rgb('#55595e'))
    d.rectangle([6, 1, 18, 9], fill=rgb('#3a3f45')); d.rectangle([8, 3, 16, 8], fill=rgb('#6cc4ff')); d.line([26, 9, 36, 5], fill=rgb('#9aa3a8'), width=2); d.rectangle([38, 8, 44, 11], fill=rgb('#ff8a3d'))
furn('bench', 3, 2, bench)
def radio(d, W, H):
    d.rectangle([1, 6, W - 2, H - 2], fill=rgb('#55595e')); d.rectangle([1, 6, W - 2, 8], fill=rgb('#6f777d'))
    d.rectangle([5, 0, 26, 12], fill=rgb('#2e3940')); d.rectangle([7, 2, 24, 10], fill=rgb('#1d4a2a'))
    for x in range(8, 24, 3): d.line([x, 6 + (x % 5) - 2, x + 2, 6 - (x % 3)], fill=rgb('#7bd88f'))
    d.ellipse([31, 12, 37, 18], fill=rgb('#c6cdd1')); d.point((40, 14), fill=rgb('#ff5f5f')); d.point((43, 14), fill=rgb('#7bd88f'))
furn('radio', 3, 2, radio)
def shelf(d, W, H):
    d.rectangle([0, 1, W - 1, H - 1], fill=rgb('#6f777d')); d.line([0, 8, W - 1, 8], fill=rgb('#9aa3a8'))
    d.rectangle([3, 3, 9, 7], fill=rgb('#c49a5a')); d.rectangle([12, 2, 18, 7], fill=rgb('#ff8a3d')); d.rectangle([22, 3, 28, 7], fill=rgb('#c6cdd1'))
furn('shelf', 2, 1, shelf)
def console(d, W, H):
    d.polygon([(0, 10), (6, 2), (W - 7, 2), (W - 1, 10), (W - 1, H - 2), (0, H - 2)], fill=rgb('#3a3f45'))
    for i, c in enumerate(['#6cc4ff', '#7bd88f', '#ffd34d', '#ff5f5f']): d.rectangle([8 + i * 12, 5, 15 + i * 12, 10], fill=rgb(c))
    d.rectangle([10, 15, W - 11, 24], fill=rgb('#1d2f5c')); d.line([12, 20, W - 13, 18], fill=rgb('#6cc4ff'))
furn('console', 4, 2, console)
def locker(d, W, H):
    d.rectangle([1, 1, W - 2, H - 1], fill=rgb('#9aa3a8')); d.line([W // 2, 3, W // 2, H - 3], fill=rgb('#6f777d'))
    d.ellipse([3, 6, 12, 15], fill=rgb('#f2f2f2')); d.rectangle([4, 9, 11, 12], fill=rgb('#d9a426'))
furn('locker', 1, 2, locker)
def toilet(d, W, H):
    """The hub toilet (1 x 2 tiles): a white bowl with a lid, a tank behind it and the recycler box on the wall."""
    d.rectangle([2, 0, W - 3, 10], fill=rgb('#9aa3a8')); d.rectangle([4, 2, W - 5, 5], fill=rgb('#7bd88f')); d.point((W - 6, 3), fill=rgb('#ffd34d'))   # recycler box with a green light
    d.rectangle([4, 11, W - 5, 19], fill=rgb('#c6cdd1')); d.line([4, 11, W - 5, 11], fill=rgb('#e7ebef'))                                               # tank
    d.ellipse([2, 18, W - 3, H - 3], fill=rgb('#f4efe6')); d.ellipse([5, 21, W - 6, H - 6], fill=rgb('#6cc4ff'))                                           # bowl
    d.rectangle([3, H - 3, W - 4, H - 1], fill=rgb('#c6cdd1'))
furn('toilet', 1, 2, toilet)
def toiletdoor(d, W, H):
    """The hub's toilet door (1 x 2 tiles): a grey door in a frame, a white sign with a toilet on it, a handle
    and a little light (the game shows 'IN USE' over it while someone is inside)."""
    d.rectangle([0, 0, W - 1, H - 1], fill=rgb('#6f777d')); d.rectangle([2, 2, W - 3, H - 1], fill=rgb('#c6cdd1'))      # frame + door
    d.line([2, 2, W - 3, 2], fill=rgb('#e7ebef')); d.line([W // 2, 14, W // 2, H - 2], fill=rgb('#a9b1b6'))              # top edge + panel line
    d.rectangle([3, 4, W - 4, 12], fill=rgb('#f4efe6')); d.rectangle([3, 4, W - 4, 12], outline=rgb('#3a7fb0'))       # the sign
    d.rectangle([6, 5, 9, 7], fill=rgb('#3a7fb0')); d.ellipse([5, 7, 10, 11], fill=rgb('#3a7fb0'))                    # a tiny toilet on it
    d.rectangle([W - 5, 19, W - 4, 21], fill=rgb('#55595e'))                                                          # handle
    d.point((W // 2, 1), fill=rgb('#7bd88f'))                                                                         # the light
furn('toiletdoor', 1, 2, toiletdoor)
def lightpanel(d, W, H):
    """The greenhouse light panel (2 x 1 tiles): a grey box with 3 slider bars, red, green and blue."""
    d.rectangle([1, 2, W - 2, H - 1], fill=rgb('#3a3f45')); d.rectangle([1, 2, W - 2, 3], fill=rgb('#6f777d'))
    for i, c in enumerate(['#ff5f5f', '#7bd88f', '#6cc4ff']):
        y = 6 + i * 3; d.line([4, y, W - 5, y], fill=rgb('#1b1d20')); d.rectangle([5 + i * 7, y - 1, 7 + i * 7, y + 1], fill=rgb(c))
    d.rectangle([W - 4, 5, W - 3, 6], fill=rgb('#ffd34d'))
furn('lightpanel', 2, 1, lightpanel)
def microscope(d, W, H):
    """The workshop microscope desk (2 x 2 tiles): a white desk with a microscope and a rack of sample tubes."""
    d.rectangle([1, 14, W - 2, H - 4], fill=rgb('#e7ebef')); d.line([1, 14, W - 2, 14], fill=rgb('#ffffff'))
    d.rectangle([3, H - 4, 5, H - 1], fill=rgb('#8e949b')); d.rectangle([W - 6, H - 4, W - 4, H - 1], fill=rgb('#8e949b'))
    d.rectangle([6, 10, 14, 13], fill=rgb('#3a3f45')); d.line([10, 4, 10, 10], fill=rgb('#55595e'), width=2)                    # base and arm
    d.polygon([(7, 2), (13, 2), (12, 7), (8, 7)], fill=rgb('#9aa3a8')); d.rectangle([9, 7, 11, 9], fill=rgb('#6cc4ff'))          # eyepiece and lens
    d.rectangle([18, 8, 28, 13], fill=rgb('#6f777d'))                                                                           # tube rack
    for i, c in enumerate(['#9dff6a', '#c4364f', '#f4efe6']): d.rectangle([19 + i * 3, 4, 20 + i * 3, 12], fill=rgb(c))
furn('microscope', 2, 2, microscope)
print('interiors ok')

# ---------------- VOYAGE ----------------
def wirepanel(d, W, H):
    d.rectangle([1, 1, W - 2, H - 2], fill=rgb('#3a3f45')); d.rectangle([3, 3, W - 4, H - 4], fill=rgb('#22262b'))
    for i, c in enumerate(['#ff5f5f', '#6cc4ff', '#ffd34d', '#7bd88f']):
        y = 6 + i * 6; d.line([5, y, 12, y + (3 if i % 2 else -2)], fill=rgb(c)); d.line([19, y + 1, W - 6, y], fill=rgb(c))
    d.rectangle([W - 8, H - 8, W - 5, H - 5], fill=rgb('#ff3355'))
furn('wirepanel', 2, 2, wirepanel)
def pilotseat(d, W, H):
    d.rectangle([3, 4, W - 4, H - 2], fill=rgb('#55595e')); d.rectangle([4, 1, W - 5, 8], fill=rgb('#6f777d')); d.rectangle([5, 9, W - 6, H - 4], fill=rgb('#3a7fb0'))
furn('seat', 1, 1, pilotseat)
# Reporter (for the launch interview): person in a jacket holding a microphone, 16x20
im = Image.new('RGBA', (16, 20), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.ellipse([5, 0, 11, 6], fill=rgb('#c68a5a')); d.rectangle([5, 0, 11, 2], fill=rgb('#3a2418'))
d.rectangle([4, 7, 12, 14], fill=rgb('#b8402f')); d.rectangle([5, 15, 7, 19], fill=rgb('#2e3940')); d.rectangle([9, 15, 11, 19], fill=rgb('#2e3940'))
d.line([12, 9, 15, 6], fill=rgb('#222')); d.ellipse([13, 3, 16, 6], fill=rgb('#555'))
im.save(f'{OUT}/reporter.png')
print('voyage art ok')
