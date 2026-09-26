import Phaser from 'phaser';
import { DESIGN_H, DESIGN_W } from '../config/tuning';
import { PLANK_FONT_FAMILY } from '../level/rowLayout';

export const UI_FONT = PLANK_FONT_FAMILY;

import type { ThemeId } from '../config/themes';

/**
 * Farben für den Kritzel-Look je Thema.
 * Hell: dunkle Tinte auf hellem Papier. Dunkel: heller Gelstift auf dunklem Nachtheft.
 * (Die Namen cream/brown sind historisch: cream = Textfarbe, brown = Kontur.)
 * Knöpfe bleiben in beiden Themen helle Klebezettel mit dunkler Schrift.
 */
const PALETTES = {
  doodle: {
    cream: '#2b2230',
    brown: '#fffdf5',
    ink: 0x2b2230,
    paper: 0xfffdf6,
    panel: 0xfffdf6,
    panelStroke: 0x2b2230,
    shadow: 0x2b2230,
    shadowAlpha: 0.1,
    accent: 0x6fd58a,
    accentDark: 0x9be07a,
    button: 0xfff1b8,
    buttonActive: 0xffb27a,
    buttonText: '#2b2230',
    buttonTextStroke: '#fffdf5',
    buttonStroke: 0x2b2230,
    heart: '#e0485a',
    heartLost: '#c9c0cf',
    /** Beschriftungen, Untertitel */
    muted: '#6b5f86',
    text2: '#4a4058',
    faint: '#857a9e',
    subtitle: '#6b4a3a',
    orange: '#d17a00',
    green: '#2f8a45',
    red: '#c8323c',
    heartPlus: '#d6455d',
    blue: '#3f5bc4',
    /** Schleier hinter Menüs */
    veil: 0xfaf7ef,
    /** leicht getönte Fläche (Listen, Vorschau) */
    tint: 0x2b2230,
    tintAlpha: 0.06,
    /** Kamera-Einblendung (RGB) */
    fade: [250, 247, 239] as [number, number, number],
    canvas: '#faf7ef',
  },
  night: {
    cream: '#f1edfb',
    brown: '#1c2042',
    ink: 0xeeeafa,
    paper: 0x262b58,
    panel: 0x262b58,
    panelStroke: 0xeeeafa,
    shadow: 0x05061a,
    shadowAlpha: 0.45,
    accent: 0x6fd58a,
    accentDark: 0x9be07a,
    button: 0xfff1b8,
    buttonActive: 0xffb27a,
    buttonText: '#2b2230',
    buttonTextStroke: '#fffdf5',
    buttonStroke: 0x0d0f26,
    heart: '#ff6b7c',
    heartLost: '#565a86',
    muted: '#b7b0dc',
    text2: '#d6d1ee',
    faint: '#9a94c4',
    subtitle: '#ffd98a',
    orange: '#ffb347',
    green: '#7fe39a',
    red: '#ff7a82',
    heartPlus: '#ff7a8e',
    blue: '#9fb4ff',
    veil: 0x14173a,
    tint: 0xffffff,
    tintAlpha: 0.07,
    fade: [28, 32, 66] as [number, number, number],
    canvas: '#1c2042',
  },
};

type Palette = (typeof PALETTES)['doodle'];

/** Aktuelle Farben; werden beim Themenwechsel ausgetauscht (vor dem Neuaufbau der Szenen) */
export const COLORS: Palette = { ...PALETTES.doodle };

export function applyUiTheme(theme: ThemeId): void {
  Object.assign(COLORS, PALETTES[theme]);
}

/** Kamera sanft in der Papierfarbe des Themas einblenden */
export function fadeInCamera(scene: Phaser.Scene, ms: number): void {
  const [r, g, b] = COLORS.fade;
  scene.cameras.main.fadeIn(ms, r, g, b);
}

export function fadeOutCamera(scene: Phaser.Scene, ms: number): void {
  const [r, g, b] = COLORS.fade;
  scene.cameras.main.fadeOut(ms, r, g, b);
}

/** Leicht wackeliges, abgerundetes Rechteck wie mit Filzstift gezeichnet */
export function sketchRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  o: { fill?: number; fillAlpha?: number; stroke?: number; width?: number; seed?: number } = {},
): void {
  let seed = o.seed ?? Math.round(x * 7 + y * 13 + w * 3 + h);
  const rnd = () => ((seed = (seed * 16807 + 11) % 2147483647) / 2147483647) - 0.5;
  r = Math.min(r, w / 2, h / 2);
  const pts: Phaser.Math.Vector2[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 40));
    for (let i = 1; i < n; i++) pts.push(new Phaser.Math.Vector2(x0 + ((x1 - x0) * i) / n + rnd() * 2.2, y0 + ((y1 - y0) * i) / n + rnd() * 2.2));
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  edge(x + w, y + r, x + w, y + h - r);
  corner(x + w - r, y + h - r, 0);
  edge(x + w - r, y + h, x + r, y + h);
  corner(x + r, y + h - r, Math.PI / 2);
  edge(x, y + h - r, x, y + r);
  corner(x + r, y + r, Math.PI);
  edge(x + r, y, x + w - r, y);
  if (o.fill !== undefined) {
    g.fillStyle(o.fill, o.fillAlpha ?? 1);
    g.fillPoints(pts, true);
  }
  const width = o.width ?? 4;
  g.lineStyle(width, o.stroke ?? COLORS.ink, 1);
  g.strokePoints(pts, true);
  // zweiter, versetzter Strich wie beim schnellen Nachziehen
  g.lineStyle(Math.max(1, width * 0.45), o.stroke ?? COLORS.ink, 0.55);
  g.beginPath();
  g.moveTo(pts[0].x + 1.5, pts[0].y - 1);
  for (let i = 1; i < Math.min(pts.length, 12); i++) g.lineTo(pts[i].x + 1.5, pts[i].y - 1);
  g.strokePath();
}

/** Render-Skalierung für HiDPI (Design 720×1280 → Canvas 720k×1280k) */
export function renderScale(scene: Phaser.Scene): number {
  return scene.scale.width / DESIGN_W;
}

/** Kamera auf Design-Koordinaten einstellen */
export function setupCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  const cam = scene.cameras.main;
  const k = renderScale(scene);
  cam.setOrigin(0, 0);
  cam.setZoom(k);
  return cam;
}

/** Pointer-Position in Design-Koordinaten (Bildschirm, ohne Scroll) */
export function pointerDesign(scene: Phaser.Scene, p: Phaser.Input.Pointer): { x: number; y: number } {
  const k = renderScale(scene);
  return { x: p.x / k, y: p.y / k };
}

export interface TextOpts {
  size?: number;
  color?: string;
  stroke?: string;
  strokeThickness?: number;
  weight?: number | string;
  align?: 'left' | 'center' | 'right';
  wrapWidth?: number;
}

export function makeText(scene: Phaser.Scene, x: number, y: number, text: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const size = o.size ?? 32;
  const t = scene.add.text(x, y, text, {
    fontFamily: UI_FONT,
    fontSize: `${size}px`,
    // Handschrift hat nur einen Schnitt; kein künstlicher Fettdruck
    fontStyle: 'normal',
    color: o.color ?? COLORS.cream,
    stroke: o.stroke ?? COLORS.brown,
    strokeThickness: Math.round((o.strokeThickness ?? Math.max(0, Math.round(size / 6))) * 0.6),
    align: o.align ?? 'center',
    wordWrap: o.wrapWidth ? { width: o.wrapWidth, useAdvancedWrap: true } : undefined,
    padding: { x: 4, y: Math.ceil(size * 0.18) },
    resolution: renderScale(scene),
  });
  t.setOrigin(0.5);
  return t;
}

/** Text auf maximale Breite verkleinern */
export function fitText(t: Phaser.GameObjects.Text, maxWidth: number, maxSize: number, minSize: number): void {
  let size = maxSize;
  t.setFontSize(size);
  while (t.width > maxWidth && size > minSize) {
    size -= 2;
    t.setFontSize(size);
    t.setStroke(String(t.style.stroke ?? COLORS.brown), Math.max(2, Math.round(size / 10)));
  }
  if (t.width > maxWidth) t.setScale(maxWidth / t.width);
  else t.setScale(1);
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 26,
  alpha = 0.82,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  // Zettel mit leichtem Schatten, Filzstiftrand
  g.fillStyle(COLORS.shadow, COLORS.shadowAlpha);
  g.fillRoundedRect(x + 6, y + 8, w, h, radius * 0.6);
  sketchRect(g, x, y, w, h, radius * 0.6, { fill: COLORS.panel, fillAlpha: Math.max(alpha, 0.94), width: 4 });
  return g;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setActive(on: boolean): void;
  setLabel(s: string): void;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  o: { size?: number; color?: number; activeColor?: number } = {},
): Button {
  const base = o.color ?? COLORS.button;
  const activeCol = o.activeColor ?? COLORS.buttonActive;
  const g = scene.add.graphics();
  let active = false;
  const draw = (pressed = false) => {
    g.clear();
    const col = active ? activeCol : base;
    const dy = pressed ? 3 : 0;
    g.fillStyle(COLORS.buttonStroke, 0.85);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, h / 3);
    sketchRect(g, -w / 2, -h / 2 + dy, w, h, h / 3, { fill: col, stroke: COLORS.buttonStroke, width: active ? 5 : 4, seed: Math.round(w * 3 + h) });
  };
  draw();
  const size = o.size ?? 30;
  const text = makeText(scene, 0, 0, label, { size, color: COLORS.buttonText, stroke: COLORS.buttonTextStroke });
  fitText(text, w - 22, size, 14);
  const c = scene.add.container(x, y, [g, text]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation?.();
    draw(true);
  });
  c.on('pointerout', () => draw(false));
  c.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation?.();
    draw(false);
    (scene.registry.get('ctx') as { sfx?: { play(n: 'click'): void } } | undefined)?.sfx?.play('click');
    onClick();
  });
  return {
    container: c,
    setActive(on: boolean) {
      active = on;
      draw();
    },
    setLabel(s: string) {
      text.setText(s);
      fitText(text, w - 22, size, 14);
    },
  };
}

/** Dunkle Abdeckung über das ganze Bild */
export function dimmer(scene: Phaser.Scene, alpha = 0.55): Phaser.GameObjects.Rectangle {
  // Papier-Schleier statt dunkler Abdeckung
  return scene.add.rectangle(0, 0, DESIGN_W, DESIGN_H, COLORS.veil, Math.min(0.8, alpha + 0.15)).setOrigin(0).setScrollFactor(0);
}
