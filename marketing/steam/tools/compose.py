# Capsules: the chosen art + the real logo (dist/assets/brand/logo.webp), at Steam's sizes.
# python3 compose.py  -> out/<concept>-main.png (1232x706), -header.png (920x430), -small.png (462x174), sheet.jpg
import json, sys
from PIL import Image, ImageFilter
HERE = __file__.rsplit("/", 1)[0]
LOGO = Image.open("/home/user/poolpanic/dist/assets/brand/logo.webp").convert("RGBA")
# per concept: art file, logo on the main capsule (centre x, centre y, width; fractions), header crop (y centre of the band),
# logo on the header, small capsule art band centre y
C = json.load(open(HERE + "/concepts.json"))

def shadowed(logo, w):
    h = round(logo.height * w / logo.width)
    lg = logo.resize((w, h), Image.LANCZOS)
    pad = max(8, w // 14)
    can = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", lg.size, (6, 30, 42, 0))
    sh.putalpha(lg.getchannel("A").point(lambda a: int(a * 0.55)))
    can.alpha_composite(sh, (pad, pad + max(3, w // 60)))
    can = can.filter(ImageFilter.GaussianBlur(max(3, w // 70)))
    can.alpha_composite(lg, (pad, pad))
    return can

def place(img, cx, cy, wf):
    W, H = img.size
    lg = shadowed(LOGO, round(W * wf))
    img.alpha_composite(lg, (round(W * cx - lg.width / 2), round(H * cy - lg.height / 2)))

def band(art, ratio, cy, zoom=1.0):
    W = art.width / zoom
    H = W / ratio
    x0 = (art.width - W) / 2 + 0
    y0 = min(max(0, art.height * cy - H / 2), art.height - H)
    return art.crop((round(x0), round(y0), round(x0 + W), round(y0 + H)))

for k, c in C.items():
    art = Image.open(HERE + "/gen/" + c["art"]).convert("RGBA")
    main = art.resize((1232, 706), Image.LANCZOS)
    place(main, *c["logo"])
    main.convert("RGB").save(f"{HERE}/out/{k}-main.png")
    hd = band(art, 920 / 430, c["header"]["y"]).resize((920, 430), Image.LANCZOS)
    place(hd, *c["header"]["logo"])
    hd.convert("RGB").save(f"{HERE}/out/{k}-header.png")
    sm = band(art, 462 / 174, c["small"]["y"], c["small"].get("zoom", 1.0)).resize((462, 174), Image.LANCZOS)
    # the small capsule: the logo nearly fills it, over a darkened art band
    dark = Image.new("RGBA", sm.size, (9, 43, 56, 150))
    sm.alpha_composite(dark)
    place(sm, 0.5, 0.5, 0.7)
    sm.convert("RGB").save(f"{HERE}/out/{k}-small.png")
    # how the small capsule reads at Steam's tiniest sizes
    for s in [(184, 69), (120, 45)]:
        sm.resize(s, Image.LANCZOS).convert("RGB").save(f"{HERE}/out/{k}-small-{s[0]}.png")
    print(k, "ok")

# a contact sheet
rows = []
for k in C:
    m = Image.open(f"{HERE}/out/{k}-main.png").resize((616, 353))
    h = Image.open(f"{HERE}/out/{k}-header.png").resize((460, 215))
    s = Image.open(f"{HERE}/out/{k}-small.png").resize((231, 87))
    t1 = Image.open(f"{HERE}/out/{k}-small-184.png")
    t2 = Image.open(f"{HERE}/out/{k}-small-120.png")
    row = Image.new("RGB", (616 + 460 + 231 + 40, 353), (16, 59, 72))
    row.paste(m, (0, 0)); row.paste(h, (626, 0)); row.paste(s, (1096, 0)); row.paste(t1, (1096, 100)); row.paste(t2, (1096, 180))
    rows.append(row)
sheet = Image.new("RGB", (rows[0].width, sum(r.height + 10 for r in rows)), (16, 59, 72))
y = 0
for r in rows:
    sheet.paste(r, (0, y)); y += r.height + 10
sheet.save(HERE + "/out/sheet.jpg", quality=85)
