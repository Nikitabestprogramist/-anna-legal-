# Remakes the horse's head in every frame where it shows: two ears, a purple mane
# down the back of the neck, the armoured face plate, and a longer muzzle with a
# nostril. The short teal tail stub becomes a purple tail to match the mane.
# Anchored on the horse's eye; never paints over the knight or the sword.
from PIL import Image
import sys
src, dst = sys.argv[1], sys.argv[2]
OUTLINE = (24, 18, 32)
EYE = (200, 110, 255)
TEAL = {(20, 120, 115), (36, 150, 140), (10, 60, 60), (8, 40, 52)}
PLATE = {(92, 92, 120), (62, 60, 84), (130, 130, 160)}   # horse face armour
COL = {
    '#': OUTLINE, 'E': EYE,
    'r': (36, 150, 140), 'e': (20, 120, 115), 'w': (10, 60, 60), 'q': (8, 40, 52),   # horse teal
    'h': (130, 130, 160), 'm': (92, 92, 120),                                     # face plate
    'M': (150, 80, 200), 'N': (96, 48, 136),                                      # mane / tail
}
# cols dx -4..+4 from the eye, rows ey-3..ey+2
HEAD = [
    "..#.#....",
    ".#r#e#...",
    ".Mrreh#..",
    ".NeeEhe#.",
    "#Neeemew#",
    "#Neew###.",
]
im = Image.open(src).convert('RGBA')
px = im.load()
W, H = im.size

def get(x, y):
    return px[x, y] if 0 <= x < W and 0 <= y < H else (0, 0, 0, 0)

def paintable(x, y, dx):
    p = get(x, y)
    return p[3] == 0 or p[:3] == OUTLINE or p[:3] in TEAL or (dx >= 0 and p[:3] in PLATE)

# the horse eye is the purple pixel sitting in teal (the knight's eyes sit in the visor)
eyes = [(x, y) for y in range(H) for x in range(W)
        if get(x, y)[3] and get(x, y)[:3] == EYE
        and sum(get(x + a, y + b)[:3] in TEAL for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 2]
for ex, ey in eyes:
    for ty, row in enumerate(HEAD):
        for tx, ch in enumerate(row):
            dx, x, y = tx - 4, ex + tx - 4, ey + ty - 3
            if ch != '.' and paintable(x, y, dx):
                px[x, y] = COL[ch] + (255,)

# tail: a 2px teal stub boxed in by outline at the back of the horse
tails = []
for y in range(1, H - 1):
    for x in range(1, W - 2):
        run = [get(x, y)[:3], get(x + 1, y)[:3]]
        box = [get(x - 1, y), get(x + 2, y), get(x, y - 1), get(x + 1, y - 1), get(x, y + 1), get(x + 1, y + 1)]
        # the tail is the left-most thing on the sprite; hooves have the body to their left
        clear_left = all(get(xx, yy)[3] == 0 for yy in range(y - 3, y + 4) for xx in range(max(0, x - 8), x - 1))
        if all(c in TEAL for c in run) and all(p[3] and p[:3] == OUTLINE for p in box) and clear_left:
            tails.append((x, y))
            px[x, y] = COL['N'] + (255,)
            px[x + 1, y] = COL['M'] + (255,)
print(len(eyes), 'heads', eyes, '|', len(tails), 'tails', tails)
im.save(dst)
