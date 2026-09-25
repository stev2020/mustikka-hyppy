/**
 * Erzeugt die hellen Tag-Varianten der Hintergrundbilder aus assets/bg/
 * nach assets/day/bg/. Es werden keine neuen Motive gemalt, nur die
 * vorhandenen Bilder umgefärbt:
 *   - Violett/Lila → helles Himmelblau (Dämmerung → Tag)
 *   - Schatten und Mitteltöne aufhellen
 *   - ferne Ebenen bekommen etwas Dunst in Himmelsfarbe
 *
 * Aufruf: npm run day-assets   (nach dem Austausch von Hintergrundgrafiken erneut ausführen)
 */
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/** Dunstfarbe (heller Horizont) */
const HAZE = [214, 236, 251];

/**
 * lift: Aufhellung (0 = keine), haze: Anteil Dunst in Horizontfarbe
 */
const JOBS = [
  ['bg/lake/far.png', { lift: 0.45, haze: 0.2 }],
  ['bg/lake/mid.png', { lift: 0.3, haze: 0.1 }],
  ['bg/lake/near.png', { lift: 0.25, haze: 0 }],
  ['bg/lake/midglow.png', { lift: 0, haze: 0 }],
  ['bg/lake/nearglow.png', { lift: 0, haze: 0 }],
  ['bg/forest/far_tile.png', { lift: 0.3, haze: 0.3 }],
  ['bg/forest/mid_tile.png', { lift: 0.22, haze: 0.14 }],
  ['bg/forest/near_tile.png', { lift: 0.16, haze: 0 }],
  ['bg/fjell/mid_tile.png', { lift: 0.5, haze: 0.18 }],
  ['bg/fjell/near_tile.png', { lift: 0.4, haze: 0.04 }],
  ['bg/sky/cloud1.png', { lift: 0.45, haze: 0 }],
  ['bg/sky/cloud2.png', { lift: 0.45, haze: 0 }],
  ['bg/sky/cloud3.png', { lift: 0.45, haze: 0 }],
];

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hh = h / 360;
  return [hue(p, q, hh + 1 / 3), hue(p, q, hh), hue(p, q, hh - 1 / 3)];
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function grade(r, g, b, o) {
  let [h, s, l] = rgbToHsl(r / 255, g / 255, b / 255);
  // Gewicht für Violett/Indigo (ca. 225°–300°)
  const purple = smooth(215, 240, h) * (1 - smooth(290, 320, h)) * smooth(0.04, 0.12, s);
  h = h + (208 - h) * 0.85 * purple;
  s = Math.min(1, s * (1 + 0.15 * purple));
  // Aufhellen: Schatten stärker als Lichter; kräftige Warmtöne (rotes Haus, Holz) weniger
  const warm = (1 - smooth(40, 70, h) + smooth(320, 345, h)) * smooth(0.25, 0.45, s);
  l = 1 - Math.pow(1 - l, 1 + o.lift * (1 - 0.75 * Math.min(1, warm)));
  // Tannengrün etwas frischer
  const green = smooth(120, 140, h) * (1 - smooth(175, 195, h));
  s = Math.min(1, s * (1 + 0.12 * green));
  let [nr, ng, nb] = hslToRgb(h, s, l).map((v) => v * 255);
  if (o.haze > 0) {
    nr += (HAZE[0] - nr) * o.haze;
    ng += (HAZE[1] - ng) * o.haze;
    nb += (HAZE[2] - nb) * o.haze;
  }
  return [nr, ng, nb];
}

for (const [rel, opts] of JOBS) {
  const src = PNG.sync.read(readFileSync(join(root, rel)));
  const d = src.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const [r, g, b] = grade(d[i], d[i + 1], d[i + 2], opts);
    d[i] = Math.round(Math.min(255, Math.max(0, r)));
    d[i + 1] = Math.round(Math.min(255, Math.max(0, g)));
    d[i + 2] = Math.round(Math.min(255, Math.max(0, b)));
  }
  const out = join(root, 'day', rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, PNG.sync.write(src, { colorType: 6 }));
  console.log('✓', 'day/' + rel);
}
