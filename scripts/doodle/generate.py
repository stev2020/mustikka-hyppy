"""Erzeugt alle Spielgrafiken im Kritzel-Stil (Schulheft, Filzstift).

    python3 scripts/doodle/generate.py

Erzeugt zuerst das helle Thema (assets/) und danach die Nachtfassung der
Hintergründe (assets/night/). Nur ein Thema: DOODLE_THEME=doodle bzw. night.

Benötigt Python 3 mit numpy, opencv-python und Pillow. Die Maße und Anker
entsprechen src/config/assets.ts, damit Spiellogik und Level unverändert
bleiben. Die früheren gemalten Grafiken liegen in art/original/.
"""
import math
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from doodle import INK, PALETTE, PENCIL, THEME, THEME_DIR, Canvas, capsule, circles_mask, ellipse, outline_of  # noqa: E402

ROOT = Path(__file__).resolve().parents[2] / 'assets'
OUT = ROOT / THEME_DIR

BLUE = (66, 92, 200)
BLUE_DARK = (30, 38, 118)
LEAF = (118, 196, 86)
PINK = (238, 128, 168)
WOOD = (206, 148, 92)
WOOD_LIGHT = (236, 196, 136)
GRAIN = (140, 90, 50)
SNOW = (255, 255, 255)

# Farben der Hintergründe je Thema (Figur und Planken sind in allen Themen gleich)
P = PALETTE
PINE = P['pine']
PINE_PALE = P['pine_pale']
RED = P['red']
SAUNA = P['sauna']
WATER = P['water']
RIPPLE = P['ripple']
PAPER = P['paper']
GRID = P['grid']
ROOF = P['roof']
WINDOW = P['window']
DOOR = P['door']
SMOKE = P['smoke']
ROCK = P['rock']
MOUNTAIN = P['mountain']
HILLS = P['hills']
PENCIL_PALE = P['pencil_pale']
GRASS = P['grass']
BG_SNOW = P['snow']
CLOUD = P['cloud']
CLOUD_SHADE = P['cloud_shade']
MOON = P['moon']
MOON_DOT = P['moon_dot']
STAR = P['star']
GLOW = P['glow']


def save(c, rel):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    c.save(p)
    print('  ', rel)


# ---------------------------------------------------------------- Figur
def berry(pose):
    """Heidelbeere 512×512, Unterkante bei y = 450, horizontal mittig."""
    c = Canvas(512, 512, seed={'idle': 1, 'jump': 2, 'land': 3, 'hurt': 4}[pose])
    sx, sy = {'idle': (1, 1), 'jump': (0.88, 1.08), 'land': (1.2, 0.8), 'hurt': (1, 1)}[pose]
    rx, ry = 170 * sx, 168 * sy
    cx, cy = 256, 450 - ry
    ink = 18
    body = ellipse(cx, cy, rx, ry, n=110)
    mk = c.mask_poly(body, 4)
    c.scribble(mk, BLUE, angle=0.8, gap=17, width=22, base=0.82)
    shadow = c.mask_poly(ellipse(cx + rx * 0.28, cy + ry * 0.3, rx * 0.86, ry * 0.8, n=80)) * mk
    c.hatch(shadow, BLUE_DARK, -0.7, 16, 6, 0.55)
    c.line(body, INK, ink, closed=True, amp=3)
    # Glanzlicht
    c.line(ellipse(cx - rx * 0.44, cy - ry * 0.4, rx * 0.26, ry * 0.26, n=24, start=3.3, turns=0.33), (236, 242, 255), 16, amp=0.6)
    c.dot(cx - rx * 0.62, cy - ry * 0.12, 7, (236, 242, 255))
    # Krone + Blatt
    top = cy - ry
    crown = [(cx - 36, top + 14), (cx - 26, top - 18), (cx - 8, top - 2), (cx + 8, top - 20), (cx + 24, top - 2), (cx + 36, top + 14)]
    c.shape(crown, BLUE_DARK, INK, 10, base=1, stroke=14, gap=12)
    leaf = [(cx + 6, top - 12), (cx + 40, top - 74), (cx + 104, top - 84), (cx + 76, top - 20)]
    c.shape(leaf, LEAF, INK, 11, angle=0.5, gap=15, stroke=18, base=0.85)
    c.line([(cx + 14, top - 18), (cx + 88, top - 70)], INK, 6, amp=1)
    # Gesicht
    ey = cy - ry * 0.12
    for side in (-1, 1):
        ex = cx + side * rx * 0.36
        if pose == 'hurt':
            for a in (1, -1):
                c.line([(ex - 26, ey - 26 * a), (ex + 26, ey + 26 * a)], INK, 12, amp=0.8, taper=False)
        else:
            c.shape(ellipse(ex, ey, 34, 42 if pose != 'land' else 34, n=40), (255, 255, 255), INK, 9, base=1, stroke=12, gap=10)
            c.dot(ex + 6, ey + (4 if pose != 'jump' else -2), 17, INK)
            c.dot(ex, ey - 6, 6, (255, 255, 255))
        c.shape(ellipse(ex + side * 30, ey + 60, 26, 14, n=24), PINK, None, 0, base=0.9, stroke=10, gap=8)
    my = cy + ry * (0.24 if pose != 'land' else 0.2)
    if pose == 'jump':
        c.shape(ellipse(cx, my + 8, 16, 22, n=24), (120, 36, 60), INK, 8, base=1, stroke=10, gap=8)
    elif pose == 'hurt':
        pts = [(cx - 40 + i * 10, my + 10 + 7 * math.sin(i * 1.4)) for i in range(9)]
        c.line(pts, INK, 9, amp=0.5)
    else:
        c.line(ellipse(cx, my - 6, 34, 24, n=20, start=0.45, turns=0.3), INK, 10, amp=0.6)
    if pose == 'land':
        for side in (-1, 1):
            c.line([(cx + side * (rx + 12), 440), (cx + side * (rx + 44), 430)], INK, 8, amp=0.5)
    return c


# ---------------------------------------------------------------- Planken
def plank_word():
    """890×226, 9-Slice (links/rechts 90 px fest), Lauffläche bei y = 14."""
    c = Canvas(890, 226, seed=11)
    pts = capsule(10, 14, 880, 212, rx=86)
    mk = c.mask_poly(pts, 6)
    c.scribble(mk, WOOD_LIGHT, angle=0.06, gap=20, width=24, base=0.78)
    # Maserung nur in den festen Randstücken, damit nichts verzerrt
    c.line(ellipse(58, 110, 16, 10, n=18, turns=0.9), GRAIN, 6, amp=0.4)
    c.line([(830, 70), (845, 90), (838, 118)], GRAIN, 6, amp=0.5)
    c.line(pts, INK, 20, closed=True, amp=2.2)
    return c


def plank_snow():
    """894×153, neutrale Planke mit Schneehaube, Lauffläche bei y = 30."""
    c = Canvas(894, 153, seed=12)
    wood = capsule(14, 50, 880, 146, rx=48)
    c.shape(wood, (200, 136, 78), INK, 34, angle=0.05, gap=24, stroke=28, base=0.8, amp=2.5)
    c.line([(90, 96), (330, 100), (420, 94)], GRAIN, 11, amp=1.2)
    c.line([(470, 118), (760, 114)], GRAIN, 11, amp=1.2)
    bumps = [(40, 62)] + [(60 + i * 780 / 8, 28 - 12 * math.sin(i * 1.9) - 8 * (i % 2)) for i in range(9)] + [(852, 62), (700, 70), (450, 66), (200, 70)]
    c.shape(bumps, SNOW, INK, 26, base=1, amp=1.5, stroke=10, gap=30)
    return c


# ---------------------------------------------------------------- Kleinteile
def pine(c, x, y, s, fill=PINE, ink=PENCIL, w=2.6, base=0.35, snow=True):
    for ww, hh in ((1.0, 0.0), (0.8, -0.32), (0.58, -0.6)):
        by = y + hh * s
        tri = [(x - s * 0.42 * ww, by), (x + s * 0.42 * ww, by), (x, by - s * 0.5)]
        c.shape(tri, fill, ink, w, angle=1.1, gap=6, stroke=5, base=base)
    c.line([(x, y), (x, y + s * 0.12)], ink, w)
    if snow:
        c.line([(x - s * 0.05, y - s * 0.95), (x, y - s * 1.02), (x + s * 0.05, y - s * 0.95)], BG_SNOW, max(2, w), amp=0.3)


def cabin(c, x, y, s, wall=RED, ink=PENCIL, w=2.6, base=0.38, smoke=True):
    c.shape([(x, y), (x + s, y), (x + s, y - s * 0.7), (x, y - s * 0.7)], wall, ink, w, base=base)
    c.shape([(x - s * 0.12, y - s * 0.66), (x + s * 0.5, y - s * 1.12), (x + s * 1.12, y - s * 0.66)], ROOF, ink, w, base=0.55, angle=0.3)
    c.shape([(x + s * 0.18, y - s * 0.5), (x + s * 0.4, y - s * 0.5), (x + s * 0.4, y - s * 0.3), (x + s * 0.18, y - s * 0.3)], WINDOW, ink, w, base=0.65)
    c.shape([(x + s * 0.6, y), (x + s * 0.8, y), (x + s * 0.8, y - s * 0.42), (x + s * 0.6, y - s * 0.42)], DOOR, ink, w, base=0.45)
    c.line([(x + s * 0.72, y - s * 1.0), (x + s * 0.72, y - s * 1.18), (x + s * 0.84, y - s * 1.18), (x + s * 0.84, y - s * 0.9)], ink, w)
    if smoke:
        sm = ellipse(x + s * 0.86, y - s * 1.34, s * 0.07, n=40, turns=2.6) + np.linspace([0, 0], [s * 0.18, -s * 0.45], 40)
        c.line(sm, SMOKE, max(1.8, w * 0.8), amp=0.6)


def rock(c, x, y, s, ink=PENCIL, w=2.6):
    pts = [(x - s, y), (x - s * 0.8, y - s * 0.6), (x - s * 0.2, y - s * 0.9), (x + s * 0.5, y - s * 0.7), (x + s, y - s * 0.1), (x + s * 0.9, y)]
    c.shape(pts, ROCK, ink, w, base=0.35, angle=1.3)
    c.line([(x - s * 0.6, y - s * 0.55), (x - s * 0.1, y - s * 0.85), (x + s * 0.3, y - s * 0.68)], BG_SNOW, w + 1, amp=0.3)


def mountain(c, x0, x1, base_y, peak_x, peak_y, ink=PENCIL, w=2.6, fill=MOUNTAIN):
    c.shape([(x0, base_y), (peak_x, peak_y), (x1, base_y)], fill, ink, w, base=0.32, angle=1.25, gap=7)
    h = base_y - peak_y
    lx = peak_x - (peak_x - x0) * 0.28
    rx = peak_x + (x1 - peak_x) * 0.28
    y = peak_y + h * 0.28
    cap = [(lx, y), (peak_x, peak_y), (rx, y)]
    for k in range(4, 0, -1):  # Zickzack-Schneegrenze
        t = k / 5
        cap.append((lx + (rx - lx) * t, y + (8 if k % 2 else -4)))
    c.shape(cap, BG_SNOW, ink, w * 0.9, base=1, amp=0.8)


# ---------------------------------------------------------------- Welt 1: See
def lake_far():
    c = Canvas(720, 1280, seed=21)
    hills = [(-10, 800), (110, 730), (250, 770), (400, 690), (560, 735), (730, 680), (730, 848), (-10, 848)]
    c.shape(hills, HILLS, None, 0, base=0.22, angle=1.2, gap=8, stroke=4)
    c.line(hills[:6], PENCIL, 2.4, amp=2.5)
    c.line([(-10, 848), (730, 846)], PENCIL_PALE, 2, amp=1.5)
    for i, x in enumerate(range(20, 720, 46)):
        pine(c, x + (i % 3) * 7, 845 - (i % 2) * 12, 34 + (i % 3) * 6, PINE_PALE, PENCIL_PALE, 1.8, 0.22, snow=False)
    return c


def lake_mid():
    c = Canvas(720, 1280, seed=22)
    for x, y, s in [(30, 1000, 110), (100, 1025, 80), (170, 1010, 60), (560, 995, 100), (640, 1020, 120), (700, 990, 70)]:
        pine(c, x, y, s)
    cabin(c, 280, 1010, 140)
    c.line([(-10, 1012), (180, 1020), (380, 1010), (730, 1016)], PENCIL, 2.2, amp=1.8)
    return c


def lake_near():
    c = Canvas(720, 1280, seed=23)
    water = [(-10, 1098), (730, 1086), (730, 1290), (-10, 1290)]
    c.scribble(c.mask_poly(water), WATER, angle=0.04, gap=9, width=3, base=0.2, alpha=0.6)
    for i, y in enumerate(range(1122, 1280, 30)):
        x0 = 30 + (i * 83) % 200
        c.line([(x0, y), (x0 + 180 + (i * 37) % 120, y + 3)], RIPPLE, 2.2, amp=1.2)
    # Ufer mit Schnee
    c.line([(-10, 1096), (200, 1090), (460, 1094), (730, 1084)], PENCIL, 2.6, amp=2)
    snow = [(-10, 1096), (200, 1090), (460, 1094), (730, 1084), (730, 1060), (520, 1070), (300, 1064), (-10, 1072)]
    c.shape(snow, BG_SNOW, None, 0, base=0.9)
    # Steg
    c.shape([(300, 1132), (480, 1128), (480, 1146), (300, 1150)], WOOD, PENCIL, 2.4, base=0.5, angle=0.05)
    for x in (320, 380, 440):
        c.line([(x, 1148), (x + 2, 1178)], PENCIL, 2.4)
    # Saunahütte links, große Tannen rechts
    cabin(c, 40, 1082, 110, wall=SAUNA)
    pine(c, 650, 1085, 190)
    pine(c, 575, 1090, 120)
    pine(c, 12, 1110, 90)
    return c


def empty():
    return Canvas(720, 1280, seed=0)


# ---------------------------------------------------------------- Welt 2: Wald
def forest(layer):
    c = Canvas(720, 1280, seed={'far': 31, 'mid': 32, 'near': 33}[layer])
    r = c.r
    if layer == 'far':
        for i in range(16):
            x = r.u(0, 720)
            y = r.u(120, 1240)
            s = r.u(28, 44)
            pine(c, x, y, s, PINE_PALE, PENCIL_PALE, 1.7, 0.18, snow=False)
    elif layer == 'mid':
        for i in range(12):
            left = i % 2 == 0
            x = r.u(10, 150) if left else r.u(570, 710)
            y = r.u(170, 1250)
            pine(c, x, y, r.u(60, 95), PINE, PENCIL, 2.3, 0.3)
    else:
        for i, y in enumerate(range(260, 1280, 250)):
            left = i % 2 == 0
            x = r.u(-10, 60) if left else r.u(660, 730)
            pine(c, x, y, r.u(150, 200), PINE, PENCIL, 2.8, 0.38)
        # Äste, die ins Bild ragen
        c.line([(-10, 700), (70, 690), (120, 700)], PENCIL, 2.6, amp=1)
        for k in range(5):
            c.line([(20 + k * 20, 694), (30 + k * 20, 710)], PINE, 3, amp=0.3)
    return c


# ---------------------------------------------------------------- Welt 3: Fjell
def fjell(layer):
    c = Canvas(720, 1280, seed={'mid': 41, 'near': 42}[layer])
    r = c.r
    if layer == 'mid':
        for i, y in enumerate(range(300, 1280, 330)):
            if i % 2 == 0:
                mountain(c, -40, 240, y, r.u(70, 150), y - r.u(170, 230))
            else:
                mountain(c, 480, 760, y, r.u(560, 650), y - r.u(170, 230))
    else:
        for i, y in enumerate(range(200, 1280, 210)):
            x = r.u(20, 110) if i % 2 == 0 else r.u(610, 700)
            rock(c, x, y, r.u(22, 38))
            if i % 3 == 1:
                for k in range(3):
                    c.line([(x + 40 + k * 8, y), (x + 44 + k * 8, y - 14)], GRASS, 2.4, amp=0.3)
    return c


# ---------------------------------------------------------------- Welt 4: Himmel
def cloud(seed, w=562, h=180):
    c = Canvas(w, h, seed=seed)
    r = c.r
    n = 4 + seed % 2
    circles = [(40 + (w - 80) / 2, h - 40, (w - 80) / 2, 26, 1)]
    for i in range(n):
        cx = 90 + i * (w - 180) / (n - 1)
        rr = r.u(44, 66) * (1.15 if 0 < i < n - 1 else 0.9)
        circles.append((cx, h - 40 - rr * 0.55, rr, rr * 0.85, 1))
    pts = outline_of(circles_mask(c, circles))
    c.shape(pts, CLOUD, PENCIL, 7, base=1, amp=1.4)
    c.line([(w * 0.3, h - 40), (w * 0.62, h - 36)], CLOUD_SHADE, 4, amp=0.8)
    return c


def moon():
    c = Canvas(406, 406, seed=51)
    pts = outline_of(circles_mask(c, [(203, 203, 158, 158, 1), (268, 168, 140, 140, -1)]))
    c.shape(pts, MOON, INK, 9, base=0.9, gap=14, stroke=16, amp=1.6)
    c.dot(130, 250, 12, MOON_DOT)
    c.dot(110, 176, 8, MOON_DOT)
    c.dot(176, 318, 9, MOON_DOT)
    return c


def star():
    c = Canvas(64, 64, seed=52)
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = 26 if i % 2 == 0 else 11
        pts.append((32 + rr * math.cos(a), 33 + rr * math.sin(a)))
    c.shape(pts, STAR, INK, 3, base=1, stroke=4, gap=4, amp=0.6)
    return c


def aurora_band():
    """Weißes Gekritzel-Band; wird im Spiel eingefärbt."""
    c = Canvas(512, 96, seed=53)
    m = np.zeros((96 * 2, 512 * 2), np.float32)
    m[30:170, :] = 1
    m = cv2.GaussianBlur(m, (0, 0), 14)
    c.scribble(m, (255, 255, 255), angle=1.45, gap=5, width=3, base=0.08, alpha=0.85, shade=1)
    return c


def paper_tile(cell=26, n=8):
    """Kachelbares Karopapier (208×208)."""
    size = cell * n
    rng = np.random.default_rng(61)
    base = np.ones((size, size, 3), np.float32) * np.array(PAPER, np.float32)
    def wrap_blur(sigma, amp):
        pad = int(sigma * 4) + 2
        noise = np.pad(rng.normal(0, 1, (size, size)).astype(np.float32), pad, mode='wrap')
        return cv2.GaussianBlur(noise, (0, 0), sigma)[pad:-pad, pad:-pad] * amp
    grain = wrap_blur(1.2, 4)
    fib = wrap_blur(5, 6)
    base += (grain + fib)[..., None]
    line = np.array(GRID, np.float32)
    for k in range(0, size, cell):
        base[:, k] = base[:, k] * 0.35 + line * 0.65
        base[k, :] = base[k, :] * 0.35 + line * 0.65
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB')
    p = OUT / 'bg/paper_tile.png'
    p.parent.mkdir(parents=True, exist_ok=True)
    img.save(p, optimize=True)
    print('   bg/paper_tile.png')


def window_glow(windows):
    """Warmer Lichtschein um die Hüttenfenster (nur nachts sichtbar)."""
    c = Canvas(720, 1280, seed=0)
    if THEME != 'night':
        return c
    for x, y, r in windows:
        m = np.zeros((1280 * 2, 720 * 2), np.float32)
        cv2.circle(m, (int(x * 2), int(y * 2)), int(r * 2), 1.0, -1)
        m = cv2.GaussianBlur(m, (0, 0), r * 0.9)
        c.blend(m / max(m.max(), 1e-6), GLOW, 0.55)
        # ein paar kurze Gelstift-Strahlen wie ins Heft gemalt
        for k in range(7):
            a = k * 2 * math.pi / 7 + 0.3
            r0, r1 = r * 0.95, r * 1.35
            c.line([(x + r0 * math.cos(a), y + r0 * math.sin(a)), (x + r1 * math.cos(a), y + r1 * math.sin(a))], GLOW, 2.6, amp=0.2)
    return c


def cabin_window(x, y, s):
    """Mitte des Fensters einer Hütte (siehe cabin)."""
    return (x + s * 0.29, y - s * 0.4, s * 0.34)


def main():
    print('Kritzel-Grafiken nach', OUT, f'(Thema {THEME})')
    if THEME == 'doodle':
        # Figur, Planken und Polarlicht gibt es nur einmal
        for pose in ('idle', 'jump', 'land', 'hurt'):
            save(berry(pose), f'character/berry_{pose}.png')
        save(plank_word(), 'platforms/plank_word.png')
        save(plank_snow(), 'platforms/plank_snow.png')
        save(aurora_band(), 'bg/sky/aurora_band.png')
    save(lake_far(), 'bg/lake/far.png')
    save(lake_mid(), 'bg/lake/mid.png')
    save(lake_near(), 'bg/lake/near.png')
    save(window_glow([cabin_window(280, 1010, 140)]), 'bg/lake/midglow.png')
    save(window_glow([cabin_window(40, 1082, 110)]), 'bg/lake/nearglow.png')
    for layer in ('far', 'mid', 'near'):
        save(forest(layer), f'bg/forest/{layer}_tile.png')
    for layer in ('mid', 'near'):
        save(fjell(layer), f'bg/fjell/{layer}_tile.png')
    for i, (seed, h) in enumerate([(71, 174), (72, 190), (73, 181)], 1):
        save(cloud(seed, 562, h), f'bg/sky/cloud{i}.png')
    save(moon(), 'bg/sky/moon.png')
    save(star(), 'bg/sky/star.png')
    paper_tile()
    if THEME == 'doodle':
        cover()


def cover():
    """Vorschaubild 640×400 für Spielauswahl in Lern-Apps (auf Karopapier)."""
    c = Canvas(640, 400, seed=81, bg=PAPER)
    for x in range(0, 640, 26):
        c.blend(np.pad(np.ones((800, 2), np.float32), ((0, 0), (x * 2, 1280 - x * 2 - 2)))[:, :1280], GRID, 0.6)
    for y in range(0, 400, 26):
        c.blend(np.pad(np.ones((2, 1280), np.float32), ((y * 2, 800 - y * 2 - 2), (0, 0)))[:800], GRID, 0.6)
    pine(c, 60, 390, 150)
    pine(c, 590, 395, 170)
    c.line([(0, 372), (640, 366)], PENCIL, 2.4, amp=1.6)
    for x0, y0, w in [(110, 300, 150), (380, 210, 150), (170, 120, 130)]:
        c.shape(capsule(x0, y0, x0 + w, y0 + 24), (200, 136, 78), INK, 4.5, angle=0.05, gap=5, stroke=6, base=0.8)
        c.shape([(x0 + 6, y0 + 4)] + [(x0 + 10 + i * (w - 20) / 6, y0 - 5 - 3 * math.sin(i * 1.9)) for i in range(7)] + [(x0 + w - 6, y0 + 4)], SNOW, INK, 3.2, base=1, amp=0.6)
    b = berry('jump').image().resize((220, 220), Image.LANCZOS)
    base = c.image()
    base.alpha_composite(b, (360, 40))
    s = c.r
    for x, y in [(80, 60), (520, 300), (300, 40), (40, 200)]:
        base.alpha_composite(star().image().resize((34, 34)), (x, y))
    p = ROOT.parent / 'art' / 'cover.png'
    base.convert('RGB').save(p, optimize=True)
    print('   ../art/cover.png')


if __name__ == '__main__':
    main()
    # ohne DOODLE_THEME: danach auch die Nachtfassung erzeugen
    if 'DOODLE_THEME' not in os.environ:
        import subprocess
        subprocess.run([sys.executable, __file__], env={**os.environ, 'DOODLE_THEME': 'night'}, check=True)
