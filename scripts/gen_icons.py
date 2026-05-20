"""Gera ícones PWA do Flashy: 192x192 e 512x512, normais e maskable.

Estética: fundo escuro com letra F amarela, igual ao favicon SVG do index.html.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
os.makedirs(OUT_DIR, exist_ok=True)

BG = (15, 17, 21, 255)          # var(--bg)
ACCENT = (255, 209, 102, 255)   # var(--accent)
INK = (26, 21, 0, 255)          # var(--accent-ink)

def find_font(size, prefer_bold=True):
    candidates = [
        "C:\\Windows\\Fonts\\seguibl.ttf",       # Segoe UI Black
        "C:\\Windows\\Fonts\\segoeuib.ttf",      # Segoe UI Bold
        "C:\\Windows\\Fonts\\arialbd.ttf",       # Arial Bold
        "C:\\Windows\\Fonts\\arial.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()

def render(size, maskable):
    img = Image.new('RGBA', (size, size), BG if maskable else (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Tile arredondado de fundo
    if maskable:
        # maskable: precisa de safe zone (80% central).
        bg_inset = 0
    else:
        bg_inset = int(size * 0.06)
    radius = int(size * 0.22)
    draw.rounded_rectangle(
        [bg_inset, bg_inset, size - bg_inset, size - bg_inset],
        radius=radius, fill=ACCENT
    )
    # Letra F
    font_size = int(size * 0.6)
    font = find_font(font_size, prefer_bold=True)
    text = "F"
    try:
        bbox = draw.textbbox((0, 0), text, font=font, anchor="lt")
    except TypeError:
        bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1] - int(size * 0.02)
    draw.text((tx, ty), text, fill=INK, font=font)
    return img

def main():
    targets = [
        ('icon-192.png', 192, False),
        ('icon-512.png', 512, False),
        ('icon-192-maskable.png', 192, True),
        ('icon-512-maskable.png', 512, True),
        ('apple-touch-icon.png', 180, False),
    ]
    for name, size, maskable in targets:
        img = render(size, maskable)
        out = os.path.join(OUT_DIR, name)
        img.save(out, 'PNG', optimize=True)
        print(f'Generated {out} ({size}x{size}{" maskable" if maskable else ""})')

if __name__ == '__main__':
    main()
