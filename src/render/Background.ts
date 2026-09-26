import Phaser from 'phaser';
import { SKY_ASSETS } from '../config/assets';
import { texKey, type SkyStop, type Theme } from '../config/themes';
import {
  DEPTH,
  DESIGN_H,
  DESIGN_W,
  LAKE_LAYERS,
  SKY,
  TILED_WORLDS,
  WORLD_FADE,
  type LayerDef,
} from '../config/tuning';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function skyColorsAt(h: number, stops: SkyStop[]): { top: number; mid: number; bottom: number } {
  if (h <= stops[0].h) return stops[0];
  for (let i = 1; i < stops.length; i++) {
    if (h <= stops[i].h) {
      const a = stops[i - 1];
      const b = stops[i];
      const t = smooth((h - a.h) / (b.h - a.h));
      return { top: lerpColor(a.top, b.top, t), mid: lerpColor(a.mid, b.mid, t), bottom: lerpColor(a.bottom, b.bottom, t) };
    }
  }
  return stops[stops.length - 1];
}

/** Tiefe innerhalb der Ebenen far/mid/near: See < Wald < Fjell */
const WORLD_ORDER: Record<string, number> = { lake: 0, forest: 1, fjell: 2 };

/**
 * Vertikal kachelbare Ebene einer Welt. Wird aus horizontalen Streifen
 * zusammengesetzt, damit Anfang und Ende der Welt weich (per Eck-Alpha)
 * ein- und ausgeblendet werden können.
 *
 * Ebenen-Koordinate L (nach oben): Bildschirm-y = H − L + Kamerahöhe·f.
 * Sichtbar ist die Welt im Bereich [start·f + H, ende·f + H].
 */
class TiledLayer {
  private static readonly STRIP = 64;
  private strips: Phaser.GameObjects.Image[] = [];
  private readonly A: number;
  private readonly B: number;
  private readonly frames: string[] = [];

  constructor(
    private scene: Phaser.Scene,
    private key: string,
    private f: number,
    start: number,
    end: number,
    private depth: number,
  ) {
    this.A = start * f + DESIGN_H;
    this.B = end * f + DESIGN_H;
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage() as HTMLImageElement;
    const texH = src.height || DESIGN_H;
    const n = Math.round(texH / TiledLayer.STRIP);
    for (let j = 0; j < n; j++) {
      const name = `strip${j}`;
      // j zählt von unten nach oben
      if (!tex.has(name)) tex.add(name, 0, 0, texH - (j + 1) * TiledLayer.STRIP, src.width || DESIGN_W, TiledLayer.STRIP);
      this.frames.push(name);
    }
  }

  private fade(L: number): number {
    return smooth((L - this.A) / WORLD_FADE) * smooth((this.B - L) / WORLD_FADE);
  }

  private strip(i: number): Phaser.GameObjects.Image {
    let s = this.strips[i];
    if (!s) {
      s = this.scene.add.image(0, 0, this.key, this.frames[0]).setOrigin(0, 1).setScrollFactor(0).setDepth(this.depth);
      this.strips[i] = s;
    }
    return s;
  }

  update(camH: number): void {
    const S = TiledLayer.STRIP;
    const Lb = camH * this.f;
    const lo = Math.max(Lb, this.A);
    const hi = Math.min(Lb + DESIGN_H, this.B);
    let used = 0;
    if (lo < hi) {
      const k0 = Math.floor((lo - this.A) / S);
      const k1 = Math.ceil((hi - this.A) / S);
      for (let k = k0; k < k1; k++) {
        const Lbottom = this.A + k * S;
        const aBottom = this.fade(Lbottom);
        const aTop = this.fade(Lbottom + S);
        if (aBottom <= 0.001 && aTop <= 0.001) continue;
        const img = this.strip(used++);
        img.setFrame(this.frames[k % this.frames.length]);
        img.setPosition(0, DESIGN_H - Lbottom + Lb);
        img.setAlpha(aTop, aTop, aBottom, aBottom);
        img.setVisible(true);
      }
    }
    for (let i = used; i < this.strips.length; i++) this.strips[i].setVisible(false);
  }
}

interface Star {
  img: Phaser.GameObjects.Image;
  x: number;
  y0: number;
  threshold: number;
  phase: number;
  speed: number;
  scale: number;
}

interface Cloud {
  img: Phaser.GameObjects.Image;
  L: number;
  f: number;
  vx: number;
}

export class Background {
  /** kariertes Papier, wandert mit der Welt (wie ein Heft, in das gezeichnet wird) */
  private sky: Phaser.GameObjects.TileSprite;
  private stars: Star[] = [];
  private auroras: { rope: Phaser.GameObjects.Rope; base: number; amp: number; k: number; w: number; phase: number; color: number; strength: number }[] = [];
  private moon?: Phaser.GameObjects.Image;
  private sun?: { core: Phaser.GameObjects.Image; halo: Phaser.GameObjects.Image };
  private lake: { img: Phaser.GameObjects.Image; f: number; glow?: Phaser.GameObjects.Image; phase: number }[] = [];
  private tiled: TiledLayer[] = [];
  private clouds: Cloud[] = [];
  private nextCloudAt = SKY.cloudsStart;
  private time = 0;
  /** kurzes Aufleuchten des Polarlichts (Serien-Effekt), klingt ab */
  private flareLevel = 0;

  constructor(
    private scene: Phaser.Scene,
    private theme: Theme,
  ) {
    this.sky = scene.add.tileSprite(0, 0, DESIGN_W, DESIGN_H, texKey('paper', theme.id)).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.sky);

    // Sterne
    const starCount = Math.round(SKY.starCount * theme.stars);
    for (let i = 0; i < starCount; i++) {
      // gekritzelte Sternchen (64 px), leicht schräg
      const img = scene.add.image(0, 0, texKey('star', theme.id)).setScrollFactor(0).setDepth(DEPTH.stars).setAngle(-15 + Math.random() * 30);
      const scale = 0.26 + Math.pow(Math.random(), 2) * 0.26;
      this.stars.push({
        img,
        x: Math.random() * DESIGN_W,
        y0: Math.random() * DESIGN_H,
        threshold: Math.random(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 2.2,
        scale,
      });
      img.setScale(scale);
    }

    // Polarlicht: drei wabernde Bänder
    const auroraDefs = [
      { base: 250, amp: 38, k: 0.0065, w: 0.35, color: 0x3cc98a, strength: 1.0 },
      { base: 190, amp: 30, k: 0.009, w: -0.27, color: 0x2fb4c6, strength: 0.75 },
      { base: 150, amp: 26, k: 0.0048, w: 0.2, color: 0x9a6ae0, strength: 0.6 },
    ];
    // auch am Tag angelegt (unsichtbar), damit der Serien-Effekt sie aufleuchten lassen kann
    for (const d of auroraDefs) {
      const n = 40;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < n; i++) pts.push(new Phaser.Math.Vector2(-60 + (i * (DESIGN_W + 120)) / (n - 1), 0));
      // Polarlicht als eingefärbtes Buntstift-Gekritzel
      const rope = scene.add.rope(0, 0, 'aurora_band', undefined, pts, true);
      rope.setScrollFactor(0).setDepth(DEPTH.aurora);
      rope.setColors(d.color);
      this.auroras.push({ rope, ...d, phase: Math.random() * 10 });
    }

    if (theme.moon) {
      this.moon = scene.add.image(DESIGN_W - 150, 150, texKey(SKY_ASSETS.moon, theme.id)).setScrollFactor(0).setDepth(DEPTH.moon);
      this.moon.setDisplaySize(SKY_ASSETS.moonDisplaySize, SKY_ASSETS.moonDisplaySize).setAlpha(0);
    }
    if (theme.sun) {
      // Sonne: nur Licht (per Code erzeugter Verlauf), keine Grafik
      const halo = scene.add.image(0, 0, 'fx_dot').setScrollFactor(0).setDepth(DEPTH.moon).setBlendMode(Phaser.BlendModes.NORMAL);
      halo.setDisplaySize(420, 420).setTint(0xfff1c4).setAlpha(0.55);
      const core = scene.add.image(0, 0, 'fx_sun').setScrollFactor(0).setDepth(DEPTH.moon + 0.1);
      core.setDisplaySize(150, 150);
      this.sun = { core, halo };
    }

    // See (unten verankert, nicht gekachelt)
    for (const l of LAKE_LAYERS) this.addLakeLayer(l);

    // Wald & Fjell
    for (const w of TILED_WORLDS) {
      for (const l of w.layers) {
        const depth = DEPTH.plane[l.plane] + WORLD_ORDER[w.name];
        this.tiled.push(new TiledLayer(scene, texKey(l.key, theme.id), l.f, w.start, w.end, depth));
      }
    }
  }

  private addLakeLayer(l: LayerDef): void {
    const depth = DEPTH.plane[l.plane] + WORLD_ORDER.lake;
    const img = this.scene.add.image(0, DESIGN_H, texKey(l.key, this.theme.id)).setOrigin(0, 1).setScrollFactor(0).setDepth(depth);
    let glow: Phaser.GameObjects.Image | undefined;
    if (l.glow) glow = this.scene.add.image(0, DESIGN_H, texKey(l.glow, this.theme.id)).setOrigin(0, 1).setScrollFactor(0).setDepth(depth + 0.5);
    this.lake.push({ img, f: l.f, glow, phase: Math.random() * Math.PI * 2 });
  }

  private spawnCloud(camH: number, screenY: number): void {
    const keys = SKY_ASSETS.clouds;
    const f = SKY.cloudFactorMin + Math.random() * (SKY.cloudFactorMax - SKY.cloudFactorMin);
    const img = this.scene.add.image(Math.random() * DESIGN_W, 0, texKey(keys[Math.floor(Math.random() * keys.length)], this.theme.id));
    // nähere Wolken (größeres f) etwas größer
    img.setScale(0.7 + (f - SKY.cloudFactorMin) * 2).setScrollFactor(0).setDepth(DEPTH.clouds + f);
    if (Math.random() < 0.5) img.setFlipX(true);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const vx = dir * (SKY.cloudDriftMin + Math.random() * (SKY.cloudDriftMax - SKY.cloudDriftMin));
    this.clouds.push({ img, f, vx, L: DESIGN_H - screenY + camH * f });
  }

  /** Polarlicht kurz hell aufleuchten lassen (0…1) */
  flare(strength = 1): void {
    this.flareLevel = Math.max(this.flareLevel, strength);
  }

  update(camH: number, dt: number): void {
    this.time += dt;
    const t = this.time;

    // Papier: Karos wandern mit den Plattformen nach unten
    this.sky.tilePositionY = -camH;

    // Sterne: dichter und heller mit der Höhe
    const hp = clamp01(camH / 8500);
    const density = 0.3 + 0.7 * hp;
    const bright = 0.45 + 0.55 * hp;
    const lowCut = 0.3 + 0.7 * clamp01(camH / 5000); // unten am Abendrot noch keine Sterne
    for (const s of this.stars) {
      const vis = smooth((density - s.threshold) / 0.08);
      if (vis <= 0) {
        s.img.setVisible(false);
        continue;
      }
      let y = (s.y0 + camH * SKY.starFactor) % DESIGN_H;
      if (y < 0) y += DESIGN_H;
      const yFade = 1 - smooth((y / DESIGN_H - lowCut) / 0.25);
      const tw = 0.85 + 0.15 * Math.sin(t * s.speed + s.phase);
      const a = vis * bright * tw * yFade;
      s.img.setVisible(a > 0.01).setPosition(s.x, y).setAlpha(a).setScale(s.scale * (0.8 + 0.4 * hp));
    }

    // Polarlicht
    this.flareLevel = Math.max(0, this.flareLevel - dt / 2.4);
    // Polarlicht erst weiter oben (am Start würde das Gekritzel wie ein Schleier wirken)
    const intensity = 0.9 * smooth((camH - 2500) / 5000) * this.theme.aurora;
    for (const a of this.auroras) {
      const pts = a.rope.points;
      for (let i = 0; i < pts.length; i++) {
        const x = pts[i].x;
        pts[i].y =
          a.base +
          a.amp * Math.sin(x * a.k + t * a.w + a.phase) +
          a.amp * 0.45 * Math.sin(x * a.k * 2.3 - t * a.w * 1.7 + a.phase * 2);
      }
      a.rope.setDirty();
      const breathe = 0.8 + 0.2 * Math.sin(t * 0.5 + a.phase);
      const flare = this.flareLevel * (0.75 + 0.25 * Math.sin(t * 9 + a.phase));
      a.rope.setAlpha(Math.min(1, intensity * a.strength * breathe * 0.85 + flare * (0.55 + 0.45 * a.strength)));
      a.rope.setVisible(a.rope.alpha > 0.005);
    }

    // Mond
    if (this.moon) {
      const moonA = smooth((camH - SKY.moonStart) / SKY.moonFade);
      this.moon.setVisible(moonA > 0).setAlpha(moonA);
      if (moonA > 0) this.moon.y = Math.min(330, 150 + (camH - (SKY.moonStart + SKY.moonFade)) * SKY.moonFactor);
    }

    // Sonne (Tag): steht rechts oben und sinkt beim Klettern kaum merklich
    if (this.sun) {
      const sy = Math.min(430, 300 + camH * 0.012);
      this.sun.core.setPosition(DESIGN_W - 150, sy);
      this.sun.halo.setPosition(DESIGN_W - 150, sy).setAlpha(0.5 + 0.08 * Math.sin(t * 0.7));
    }

    // See
    for (const l of this.lake) {
      const y = DESIGN_H + camH * l.f;
      const visible = y - DESIGN_H < DESIGN_H;
      l.img.setVisible(visible).setY(y);
      if (l.glow) {
        l.glow.setVisible(visible).setY(y);
        l.glow.setAlpha((0.78 + 0.22 * Math.sin(t * 1.3 + l.phase)) * this.theme.windowGlow);
      }
    }

    // Wald / Fjell
    for (const tl of this.tiled) tl.update(camH);

    // Wolken
    if (camH >= SKY.cloudsStart) {
      while (camH >= this.nextCloudAt) {
        const first = this.clouds.length === 0 && this.nextCloudAt === SKY.cloudsStart;
        this.spawnCloud(camH, first ? -120 - Math.random() * 100 : -110 - Math.random() * 120);
        this.nextCloudAt += SKY.cloudSpacingMin + Math.random() * (SKY.cloudSpacingMax - SKY.cloudSpacingMin);
      }
    }
    const cloudFade = smooth((camH - SKY.cloudsStart) / WORLD_FADE);
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cl = this.clouds[i];
      const y = DESIGN_H - cl.L + camH * cl.f;
      if (y - cl.img.displayHeight / 2 > DESIGN_H + 20) {
        cl.img.destroy();
        this.clouds.splice(i, 1);
        continue;
      }
      let x = cl.img.x + cl.vx * dt;
      const hw = cl.img.displayWidth / 2;
      if (x < -hw) x += DESIGN_W + 2 * hw;
      if (x > DESIGN_W + hw) x -= DESIGN_W + 2 * hw;
      cl.img.setPosition(x, y).setAlpha(cloudFade * 0.95);
    }
  }
}
