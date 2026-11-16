from PIL import Image, ImageDraw, ImageFilter
import math, os, sys

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
S = 1024  # draw big then downscale


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make(size, maskable=False):
    pad = 0.0
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # diagonal gradient background
    c1 = (140, 116, 255)  # #8C74FF
    c2 = (92, 68, 214)    # #5C44D6
    grad = Image.new("RGB", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / (S - 1)
        gd.line([(0, y), (S, y)], fill=lerp(c1, c2, t))
    # radial highlight
    hi = Image.new("L", (S, S), 0)
    hd = ImageDraw.Draw(hi)
    hd.ellipse([-S * 0.35, -S * 0.55, S * 0.85, S * 0.45], fill=70)
    hi = hi.filter(ImageFilter.GaussianBlur(S * 0.12))
    white = Image.new("RGB", (S, S), (255, 255, 255))
    grad = Image.composite(white, grad, hi.point(lambda v: v))

    if maskable:
        # full-bleed square for maskable icons
        img.paste(grad, (0, 0))
    else:
        r = int(S * 0.22)
        mask = Image.new("L", (S, S), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)
        img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    cx, cy = S / 2, S * 0.47
    w, h = S * 0.46, S * 0.36
    box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
    d.rounded_rectangle(box, radius=int(h * 0.42), fill=(255, 255, 255, 255))
    # tail
    tx, ty = cx - w * 0.26, cy + h * 0.44
    d.polygon([(tx, ty - S * 0.02), (tx + S * 0.10, ty - S * 0.02), (tx + S * 0.01, ty + S * 0.075)],
              fill=(255, 255, 255, 255))
    # three dots
    dot_r = S * 0.028
    base_y = cy + S * 0.005
    for i, dx in enumerate([-w * 0.24, 0, w * 0.24]):
        d.ellipse([cx + dx - dot_r, base_y - dot_r, cx + dx + dot_r, base_y + dot_r],
                  fill=(124, 99, 245, 255))
    # small heart bottom-right
    hs = S * 0.11
    hx, hy = cx + w * 0.36, cy + h * 0.44

    def heart(dr, x, y, s, fill):
        pts = []
        for i in range(200):
            t = 2 * math.pi * i / 200
            X = 16 * math.sin(t) ** 3
            Y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
            pts.append((x + X * s / 32, y + Y * s / 32))
        dr.polygon(pts, fill=fill)

    heart(d, hx, hy, hs, (255, 255, 255, 255))
    heart(d, hx, hy, hs * 0.78, (255, 150, 190, 255))

    return img.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
make(192).save(os.path.join(OUT, "icon-192.png"))
make(512).save(os.path.join(OUT, "icon-512.png"))
make(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
make(180).save(os.path.join(OUT, "apple-touch-icon.png"))
print("icons ok")