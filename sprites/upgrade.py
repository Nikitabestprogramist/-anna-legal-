# Upgrades the shaded purple-eyed shadow knight in place: armour lifted away from
# the outline, cool purple-black outline, cool steel sword, purple fading slash.
from PIL import Image
import sys
src, dst = sys.argv[1], sys.argv[2]
SWAP = {
    (43, 41, 40): (24, 18, 32),                                     # outline
    (22, 20, 34): (34, 30, 50), (30, 30, 36): (44, 42, 60),         # armour ramp, one step lighter
    (48, 48, 58): (62, 60, 84), (74, 74, 88): (92, 92, 120),
    (112, 112, 128): (130, 130, 160), (118, 120, 134): (130, 130, 160),
    (146, 150, 172): (172, 174, 200),
    (62, 59, 57): (66, 68, 88), (78, 75, 73): (92, 96, 118),        # sword greys -> cool steel
    (115, 113, 111): (148, 154, 178),
}
SLASH_BOX = (6, 104, 24, 118)  # the white swing arc in the bottom-left frame
TAIL, MID, TIP = (100, 54, 150), (200, 110, 255), (244, 222, 255)

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

im = Image.open(src).convert('RGBA')
px = im.load()
x0, y0, x1, y1 = SLASH_BOX
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        c = (r, g, b)
        if c == (255, 255, 255) and x0 <= x <= x1 and y0 <= y <= y1:
            # fade from a dim tail (top-left) to a bright leading edge (bottom-right)
            t = ((x - x0) + (y - y0)) / ((x1 - x0) + (y1 - y0))
            c = lerp(TAIL, MID, t / 0.5) if t < 0.5 else lerp(MID, TIP, (t - 0.5) / 0.5)
            a = round(a * (0.55 + 0.45 * t))
        else:
            c = SWAP.get(c, c)
        px[x, y] = c + (a,)
im.save(dst)
