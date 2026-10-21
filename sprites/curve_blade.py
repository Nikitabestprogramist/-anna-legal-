# Bends the straight blade into a curved (katana-style) one in every frame.
# The blade (steel pixels + the outline hugging them) is shifted sideways by an
# amount that grows with distance from the guard, so the tip sweeps back.
from PIL import Image
import sys
src, dst = sys.argv[1], sys.argv[2]
# how far the tip bends: upright blades have room to sweep 2px, horizontal ones 1px
MAXOFF = {'v': 2, 'h': 1}
OUTLINE = (24, 18, 32)
STEEL = {(66, 68, 88), (92, 96, 118), (148, 154, 178), (255, 255, 255)}
# (frame origin, orientation, guard line, cross-axis search range); all local coords.
# 'v': tip points up, bends left.  'h': tip points right, bends up.
FRAMES = [
    ((4, 14), 'v', 11, (0, 6)),
    ((3, 46), 'h', 6, (9, 17)),
    ((28, 46), 'h', 6, (9, 17)),
    ((3, 74), 'v', 11, (0, 6)),
    ((29, 74), 'v', 11, (0, 5)),
    ((53, 74), 'v', 12, (0, 6)),
    ((78, 74), 'v', 12, (0, 6)),
    ((104, 74), 'v', 11, (0, 5)),
    ((4, 104), 'h', 10, (11, 15)),
    ((34, 104), 'h', 10, (9, 17)),
    ((64, 104), 'h', 6, (9, 17)),
    ((89, 104), 'h', 6, (9, 17)),
]
im = Image.open(src).convert('RGBA')
out = im.copy()
px, op = im.load(), out.load()
W, H = im.size

def get(x, y):
    return px[x, y] if 0 <= x < W and 0 <= y < H else (0, 0, 0, 0)

def is_steel(x, y, slash_ok):
    p = get(x, y)
    if p[3] == 0:
        return False
    # in the slash frame the blade tip was tinted purple by the slash pass
    return p[:3] in STEEL or (slash_ok and p[0] > 150 and p[2] > 200 and p[1] < 230)

for i, ((fx, fy), orient, guard, (c0, c1)) in enumerate(FRAMES):
    slash_ok = (fx, fy) == (4, 104)
    # local (along, cross) -> absolute (x, y)
    if orient == 'v':
        to_xy = lambda a, c: (fx + c, fy + a)
        along = range(guard - 1, -1, -1)
    else:
        to_xy = lambda a, c: (fx + a, fy + c)
        along = range(guard + 1, 24)
    steel = {(a, c) for a in along for c in range(c0, c1 + 1) if is_steel(*to_xy(a, c), slash_ok)}
    if not steel:
        continue
    dist = lambda a: abs(a - guard)
    L = max(dist(a) for a, _ in steel) + 1
    # blade mask: steel plus outline pixels touching it (incl. diagonals), beyond the guard
    mask = set(steel)
    for a, c in steel:
        for da in (-1, 0, 1):
            for dc in (-1, 0, 1):
                n = (a + da, c + dc)
                if dist(n[0]) > 0 and n not in mask and get(*to_xy(*n))[:3] == OUTLINE and get(*to_xy(*n))[3]:
                    mask.add(n)
    off = {a: round(MAXOFF[orient] * (dist(a) / L) ** 2) for a, _ in mask}
    # clear the old blade: keep outline that also borders non-blade content, else
    # reveal what sits behind the blade on the side it moves away from
    for a, c in mask:
        if off[a] == 0:
            continue
        x, y = to_xy(a, c)
        keep = None
        for n in ((a + 1, c), (a - 1, c), (a, c + 1), (a, c - 1)):
            if n not in mask and get(*to_xy(*n))[3]:
                if get(x, y)[:3] == OUTLINE:
                    keep = get(x, y)
                break
        if keep is None:
            behind = to_xy(a, c + 1)
            b = get(*behind)
            keep = b if (a, c + 1) not in mask and b[3] and orient == 'h' else (0, 0, 0, 0)
        op[x, y] = keep
    # paint the bent blade (shift toward smaller cross coord: left / up)
    for a, c in sorted(mask, key=lambda m: off[m[0]]):
        x, y = to_xy(a, c - off[a])
        if 0 <= x < W and 0 <= y < H:
            op[x, y] = get(*to_xy(a, c))
out.save(dst)
