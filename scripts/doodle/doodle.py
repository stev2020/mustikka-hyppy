"""Kritzel-Renderer für Mustikka Hyppy.

Zeichnet Formen wie mit Filzstift ins Schulheft: wackelige Konturen,
schnell hin und her gekritzelte Füllungen, leichte Überzeichnung am Ende.
Alle Koordinaten in Bildpixeln des Ziel-Assets; intern 2-fach überabgetastet.
"""
import math
import os
import cv2
import numpy as np
from PIL import Image

S = 2

# Thema über Umgebungsvariable: DOODLE_THEME=night erzeugt die Nachtfassung
# der Hintergründe (dunkles Karopapier, heller Gelstift) nach assets/night/.
THEME = os.environ.get('DOODLE_THEME', 'doodle')
if THEME not in ('doodle', 'night'):
    raise SystemExit(f'Unbekanntes Thema: {THEME}')
THEME_DIR = '' if THEME == 'doodle' else f'{THEME}/'

PALETTES = {
    # Filzstift auf hellem Karopapier
    'doodle': dict(
        ink=(38, 30, 44), pencil=(112, 106, 128), pencil_pale=(150, 146, 166),
        paper=(250, 247, 239), grid=(178, 198, 216),
        pine=(112, 168, 116), pine_pale=(160, 196, 162), grass=(120, 170, 110),
        red=(214, 96, 84), sauna=(170, 118, 88), roof=(236, 238, 244), door=(150, 90, 70),
        window=(250, 214, 120), smoke=(150, 150, 165),
        water=(120, 160, 222), ripple=(84, 124, 196),
        rock=(190, 186, 196), mountain=(200, 204, 222), hills=(206, 208, 228), snow=(255, 255, 255),
        cloud=(255, 255, 255), cloud_shade=(200, 204, 222),
        moon=(246, 220, 120), moon_dot=(222, 186, 86), star=(246, 206, 70), glow=(255, 214, 110),
    ),
    # Gelstift auf dunkelblauem Karopapier (Nachtheft)
    'night': dict(
        ink=(238, 234, 250), pencil=(176, 184, 226), pencil_pale=(120, 128, 180),
        paper=(28, 32, 66), grid=(56, 68, 122),
        pine=(70, 150, 124), pine_pale=(66, 104, 128), grass=(92, 156, 120),
        red=(176, 70, 84), sauna=(140, 92, 88), roof=(196, 206, 236), door=(96, 64, 70),
        window=(255, 214, 100), smoke=(130, 138, 180),
        water=(64, 96, 190), ripple=(120, 150, 230),
        rock=(104, 108, 148), mountain=(84, 92, 150), hills=(70, 78, 132), snow=(222, 230, 250),
        cloud=(98, 108, 168), cloud_shade=(140, 150, 206),
        moon=(255, 226, 120), moon_dot=(220, 184, 80), star=(255, 220, 90), glow=(255, 206, 96),
    ),
}
PALETTE = PALETTES[THEME]
INK = PALETTE['ink']
PENCIL = PALETTE['pencil']


class Rand:
    def __init__(self, seed):
        self.g = np.random.default_rng(seed)

    def n(self, *a):
        return self.g.normal(*a)

    def u(self, a=0.0, b=1.0):
        return float(self.g.uniform(a, b))


def resample(pts, step=3.0):
    pts = np.asarray(pts, np.float32)
    out = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        d = float(np.linalg.norm(b - a))
        n = max(1, int(d / step))
        for t in np.linspace(0, 1, n + 1)[1:]:
            out.append(a + (b - a) * t)
    return np.array(out)


def ellipse(cx, cy, rx, ry=None, n=90, start=0.0, turns=1.0):
    ry = rx if ry is None else ry
    t = np.linspace(start, start + 2 * math.pi * turns, n)
    return np.stack([cx + rx * np.cos(t), cy + ry * np.sin(t)], 1)


def capsule(x0, y0, x1, y1, rx=None, n=14):
    """Planke/Kapsel mit abgerundeten Enden."""
    h = y1 - y0
    rx = rx or h / 2
    cy = (y0 + y1) / 2
    right = ellipse(x1 - rx, cy, rx, h / 2, n, -math.pi / 2, 0.5)
    left = ellipse(x0 + rx, cy, rx, h / 2, n, math.pi / 2, 0.5)
    return np.vstack([[(x0 + rx, y0), (x1 - rx, y0)], right, [(x0 + rx, y1)], left])


class Canvas:
    """Premultiplizierte RGBA-Leinwand (float) mit Kritzel-Werkzeugen."""

    def __init__(self, w, h, seed=1, bg=None):
        self.w, self.h = w, h
        self.r = Rand(seed)
        self.rgb = np.zeros((h * S, w * S, 3), np.float32)
        self.a = np.zeros((h * S, w * S), np.float32)
        if bg is not None:
            self.rgb[:] = np.array(bg, np.float32) / 255
            self.a[:] = 1

    # --- Grundlagen -------------------------------------------------------
    def blend(self, mask, color, alpha=1.0, box=None):
        y0, y1, x0, x1 = box or (0, self.h * S, 0, self.w * S)
        m = np.clip(mask, 0, 1) * alpha
        c = np.array(color, np.float32) / 255
        rgb = self.rgb[y0:y1, x0:x1]
        a = self.a[y0:y1, x0:x1]
        rgb *= (1 - m)[..., None]
        rgb += c * m[..., None]
        a *= 1 - m
        a += m

    def wobble(self, pts, amp):
        p = resample(pts, 3)
        if len(p) < 3 or amp <= 0:
            return p
        d = np.gradient(p, axis=0)
        nrm = np.stack([-d[:, 1], d[:, 0]], 1)
        nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-6
        k = max(2, int(len(p) * 0.08))
        noise = np.interp(np.linspace(0, k, len(p)), np.arange(k + 3), self.r.n(0, amp, k + 3))
        return p + nrm * noise[:, None]

    def mask_poly(self, pts, shrink=0.0):
        m = np.zeros((self.h * S, self.w * S), np.uint8)
        cv2.fillPoly(m, [(np.asarray(pts) * S).astype(np.int32)], 255, cv2.LINE_AA)
        if shrink > 0:
            k = max(1, int(shrink * S))
            m = cv2.erode(m, np.ones((k, k), np.uint8))
        return m.astype(np.float32) / 255

    # --- Werkzeuge --------------------------------------------------------
    def line(self, pts, color=INK, width=5.0, alpha=1.0, amp=1.4, closed=False, taper=True, overshoot=True):
        p = np.asarray(pts, np.float32)
        if closed:
            p = np.vstack([p, p[:1]])
        p = self.wobble(p, amp)
        if closed and overshoot and len(p) > 8:
            k = max(2, len(p) // 12)
            p = np.vstack([p, p[1:k] + self.r.n(0, 1.2, (k - 1, 2))])
        pad = int(width * S * 2 + 6)
        x0 = max(0, int(p[:, 0].min() * S) - pad)
        y0 = max(0, int(p[:, 1].min() * S) - pad)
        x1 = min(self.w * S, int(p[:, 0].max() * S) + pad)
        y1 = min(self.h * S, int(p[:, 1].max() * S) + pad)
        if x1 <= x0 or y1 <= y0:
            return
        m = np.zeros((y1 - y0, x1 - x0), np.float32)
        off = np.array([x0, y0], np.float32)
        n = len(p)
        for i in range(n - 1):
            t = i / max(1, n - 2)
            wf = 1.0 if (closed or not taper) else 0.6 + 0.4 * math.sin(math.pi * t)
            ww = max(1, int(round(width * S * wf * (0.92 + 0.16 * self.r.u()))))
            a = tuple((p[i] * S - off).astype(int))
            b = tuple((p[i + 1] * S - off).astype(int))
            cv2.line(m, a, b, 1.0, ww, cv2.LINE_AA)
        self.blend(m, color, alpha, (y0, y1, x0, x1))

    def scribble(self, mask, color, angle=0.9, gap=5.5, width=7.0, base=0.6, alpha=0.95, shade=0.9):
        """Filzstift-Füllung: Grundton plus Zickzack-Striche."""
        if base > 0:
            self.blend(mask, color, base)
        ys, xs = np.nonzero(mask > 0.5)
        if len(xs) == 0:
            return
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        R = math.hypot(x1 - x0, y1 - y0) / 2 + 10
        ca, sa = math.cos(angle), math.sin(angle)
        m = np.zeros_like(mask)
        pts = []
        k, side = -R, 0
        while k < R:
            a = (-R, k + self.r.n(0, 0.8 * S))
            b = (R, k + gap * S * 0.5 + self.r.n(0, 0.8 * S))
            pts += [a, b] if side == 0 else [b, a]
            side ^= 1
            k += gap * S
        for (u1, v1), (u2, v2) in zip(pts[:-1], pts[1:]):
            p1 = (int(cx + u1 * ca - v1 * sa), int(cy + u1 * sa + v1 * ca))
            p2 = (int(cx + u2 * ca - v2 * sa), int(cy + u2 * sa + v2 * ca))
            cv2.line(m, p1, p2, 1.0, max(1, int(width * S)), cv2.LINE_AA)
        col = np.array(color, np.float32) * shade
        self.blend(np.clip(m, 0, 1) * mask, col, alpha)

    def hatch(self, mask, color=INK, angle=-0.8, gap=6.0, width=1.6, alpha=0.55):
        ys, xs = np.nonzero(mask > 0.5)
        if len(xs) == 0:
            return
        m = np.zeros_like(mask)
        cx, cy = xs.mean(), ys.mean()
        R = max(np.ptp(xs), np.ptp(ys))
        ca, sa = math.cos(angle), math.sin(angle)
        k = -R
        while k < R:
            p1 = (int(cx - R * ca - k * sa), int(cy - R * sa + k * ca))
            p2 = (int(cx + R * ca - k * sa), int(cy + R * sa + k * ca))
            cv2.line(m, p1, p2, 1.0, max(1, int(width * S)), cv2.LINE_AA)
            k += gap * S
        self.blend(np.clip(m, 0, 1) * mask, color, alpha)

    def shape(self, pts, fill, ink=INK, width=5.0, angle=0.9, gap=5.5, stroke=7.0, base=0.6, amp=1.4, alpha=1.0):
        mk = self.mask_poly(pts, shrink=width * 0.3) * alpha
        if fill is not None:
            self.scribble(mk, fill, angle, gap, stroke, base, shade=0.97 if min(fill) > 240 else 0.9)
        if ink is not None and width > 0:
            self.line(pts, ink, width, closed=True, amp=amp, alpha=alpha)

    def dot(self, x, y, r, color, alpha=1.0):
        m = np.zeros((self.h * S, self.w * S), np.float32)
        cv2.circle(m, (int(x * S), int(y * S)), max(1, int(r * S)), 1.0, -1, cv2.LINE_AA)
        self.blend(m, color, alpha)

    # --- Ausgabe ----------------------------------------------------------
    def image(self):
        a = np.clip(self.a, 0, 1)
        rgb = np.where(a[..., None] > 1e-4, self.rgb / np.maximum(a[..., None], 1e-4), 0)
        out = np.dstack([np.clip(rgb, 0, 1), a])
        im = Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')
        return im.resize((self.w, self.h), Image.LANCZOS)

    def save(self, path):
        self.image().save(path, optimize=True)


def circles_mask(canvas, circles):
    """Vereinigung von Kreisen/Ellipsen als Maske (für Wolken, Mond)."""
    m = np.zeros((canvas.h * S, canvas.w * S), np.uint8)
    for cx, cy, rx, ry, sign in circles:
        cv2.ellipse(m, (int(cx * S), int(cy * S)), (int(rx * S), int(ry * S)), 0, 0, 360, 255 if sign > 0 else 0, -1, cv2.LINE_AA)
    return m


def outline_of(mask, step=4):
    """Äußere Kontur einer Maske als Punktliste (Bildkoordinaten)."""
    cs, _ = cv2.findContours((mask > 127).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(np.float32) / S
    return c[::step]
