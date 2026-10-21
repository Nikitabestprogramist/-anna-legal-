# Adds light-from-top-left shading: pixels whose top/left neighbour is outline or
# empty step one shade lighter; pixels whose bottom/right neighbour is step darker.
# Ramps are extended with new hue-shifted end colours (cool purple shadows, warm highlights).
from PIL import Image
import sys
src, dst = sys.argv[1], sys.argv[2]
OUTLINE = (43, 41, 40)
RAMPS = [
    # armour: new deep shadow, existing 4, new highlight
    [(22, 20, 34), (30, 30, 36), (48, 48, 58), (74, 74, 88), (112, 112, 128), (146, 150, 172)],
    # cape: new deep shadow, existing 3, new highlight
    [(8, 40, 52), (10, 60, 60), (20, 120, 115), (36, 150, 140), (84, 194, 160)],
]
ALIAS = {(118, 120, 134): (112, 112, 128)}
idx = {}
for r, ramp in enumerate(RAMPS):
    for i, c in enumerate(ramp[1:-1], 1):
        idx[c] = (r, i)

im = Image.open(src).convert('RGBA')
W, H = im.size
px = im.load()
def rgb(x, y):
    if not (0 <= x < W and 0 <= y < H) or px[x, y][3] == 0:
        return None
    return px[x, y][:3]
def exposed(x, y):
    c = rgb(x, y)
    return c is None or c == OUTLINE

out = im.copy()
op = out.load()
for y in range(H):
    for x in range(W):
        c = rgb(x, y)
        if c is None: continue
        c = ALIAS.get(c, c)
        if c not in idx: continue
        r, i = idx[c]
        lit = exposed(x, y - 1) or exposed(x - 1, y)
        dark = exposed(x, y + 1) or exposed(x + 1, y)
        step = (1 if lit else 0) - (1 if dark else 0)
        if step:
            ramp = RAMPS[r]
            op[x, y] = ramp[max(0, min(len(ramp) - 1, i + step))] + (px[x, y][3],)
out.save(dst)
