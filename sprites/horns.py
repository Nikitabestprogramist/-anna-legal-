# Replaces the three crown spikes on the helmet with two curved demon horns.
# Finds the spikes in each frame, clears them, rounds off the helm top, and draws
# a horn on each side. Horns go behind the sword and the slash.
from PIL import Image
import sys
src, dst = sys.argv[1], sys.argv[2]
OUTLINE = (24, 18, 32)
STEEL = {(66, 68, 88), (92, 96, 118), (148, 154, 178), (255, 255, 255)}
COL = {
    '#': OUTLINE,
    'a': (112, 96, 116), 'b': (172, 160, 170), 'c': (226, 218, 222),   # horn: base -> tip (bone)
    'h': (130, 130, 160), 'm': (92, 92, 120), 'd': (62, 60, 84),       # helm top
}
# Template over cols L-3..L+9 (helm outline at L and L+6), rows r-2..r+3, where r is
# the row of the spike tips. '.' leaves the pixel, ' ' clears it.
TEMPLATE = [
    ".#.........#.",
    "#c#.......#c#",
    "#b#       #b#",
    "#bb#######bb#",
    ".#a#hhmmd#a#.",
    "..#.......#..",
]
im = Image.open(src).convert('RGBA')
px = im.load()
W, H = im.size

def get(x, y):
    return px[x, y] if 0 <= x < W and 0 <= y < H else (0, 0, 0, 0)

def is_outline(x, y):
    p = get(x, y)
    return p[3] > 0 and p[:3] == OUTLINE

def in_front(x, y):
    """Sword and slash pixels stay on top of the helmet."""
    p = get(x, y)
    return p[3] > 0 and (p[:3] in STEEL or (p[0] > 150 and p[2] > 200 and p[1] < 230 and p[:3] != (200, 110, 255)))

def is_slash(x, y):
    p = get(x, y)
    return p[3] > 0 and p[0] > 150 and p[2] > 200 and p[1] < 230 and p[:3] != (200, 110, 255)

def spikes_at(c, r):
    tips = [is_outline(c + k, r) or (k == 4 and is_slash(c + k, r)) for k in (0, 2, 4)]
    gaps = [get(c + k, r)[3] == 0 or is_slash(c + k, r) for k in (1, 3)]
    body = [get(c + k, r + 1)[3] > 0 and not is_outline(c + k, r + 1) for k in (0, 2, 4)]
    seps = [is_outline(c + k, r + 1) for k in (1, 3)]
    return all(tips) and all(gaps) and all(body) and all(seps)

found = [(c, r) for r in range(1, H - 3) for c in range(W - 5) if spikes_at(c, r)]
for c, r in found:
    L = c - 1
    for ty, row in enumerate(TEMPLATE):
        for tx, ch in enumerate(row):
            x, y = L - 3 + tx, r - 2 + ty
            if ch == '.' or not (0 <= x < W and 0 <= y < H) or in_front(x, y):
                continue
            px[x, y] = (0, 0, 0, 0) if ch == ' ' else COL[ch] + (255,)
print(len(found), 'helmets:', found)
im.save(dst)
