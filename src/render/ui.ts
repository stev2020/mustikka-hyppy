import Phaser from 'phaser';
import { DESIGN_H, DESIGN_W } from '../config/tuning';
import { PLANK_FONT_FAMILY } from '../level/rowLayout';

export const UI_FONT = PLANK_FONT_FAMILY;

export const COLORS = {
  cream: '#FFF6E1',
  brown: '#32190E',
  panel: 0x1a1440,
  panelStroke: 0xfff6e1,
  accent: 0x6fd58a,
  accentDark: 0x2f7a47,
  button: 0x3a2868,
  buttonActive: 0xe89276,
  heart: '#ff5a72',
  heartLost: '#5a4a78',
};

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
    fontStyle: String(o.weight ?? 800),
    color: o.color ?? COLORS.cream,
    stroke: o.stroke ?? COLORS.brown,
    strokeThickness: o.strokeThickness ?? Math.max(0, Math.round(size / 6)),
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
    t.setStroke(COLORS.brown, Math.max(3, Math.round(size / 6)));
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
  g.fillStyle(COLORS.panel, alpha);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(3, COLORS.panelStroke, 0.22);
  g.strokeRoundedRect(x, y, w, h, radius);
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
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, h / 2.6);
    g.fillStyle(col, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + (pressed ? 3 : 0), w, h, h / 2.6);
    g.lineStyle(3, 0xfff6e1, active ? 0.8 : 0.3);
    g.strokeRoundedRect(-w / 2, -h / 2 + (pressed ? 3 : 0), w, h, h / 2.6);
  };
  draw();
  const size = o.size ?? 30;
  const text = makeText(scene, 0, 0, label, { size });
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
  return scene.add.rectangle(0, 0, DESIGN_W, DESIGN_H, 0x06051a, alpha).setOrigin(0).setScrollFactor(0);
}
