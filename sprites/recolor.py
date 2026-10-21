from PIL import Image, ImageDraw
import sys
src, outdir = sys.argv[1], sys.argv[2]
# original palette groups
CAPE = [(99,28,17),(156,26,35),(174,40,49)]          # dark, mid, light
ARMOR = [(55,55,87),(79,79,119),(119,119,151),(167,167,191),(167,175,199)]
variants = {
 'blue_cape':   {'cape':[(18,32,96),(36,70,170),(60,100,200)]},
 'green_cape':  {'cape':[(20,70,30),(40,135,60),(64,165,84)]},
 'purple_cape': {'cape':[(60,20,90),(115,40,160),(140,62,185)]},
 'gold_knight': {'armor':[(110,72,24),(160,112,36),(208,160,60),(236,206,120),(240,214,130)]},
 'shadow_knight': {'armor':[(30,30,36),(48,48,58),(74,74,88),(112,112,128),(118,120,134)],
                   'cape':[(10,60,60),(20,120,115),(36,150,140)]},
}
im = Image.open(src).convert('RGBA')
outs = [('original', im)]
for name, v in variants.items():
    m = {}
    if 'cape' in v: m.update(zip(CAPE, v['cape']))
    if 'armor' in v: m.update(zip(ARMOR, v['armor']))
    o = Image.new('RGBA', im.size)
    o.putdata([m.get(p[:3], p[:3]) + (p[3],) for p in im.getdata()])
    o.save(f'{outdir}/knight_{name}.png')
    outs.append((name, o))
# 3x preview sheet
S = 3; W = im.width*S
sheet = Image.new('RGBA', (W*3+40, (im.height*S+20)*2+10), (235,235,235,255))
d = ImageDraw.Draw(sheet)
for i,(n,o) in enumerate(outs):
    x = 10 + (i%3)*(W+10); y = 5 + (i//3)*(im.height*S+20)
    sheet.alpha_composite(o.resize((W, im.height*S), Image.NEAREST), (x, y+14))
    d.text((x, y), n, fill=(0,0,0,255))
sheet.save(f'{outdir}/preview.png')
