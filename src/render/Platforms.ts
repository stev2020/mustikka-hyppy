import Phaser from 'phaser';
import { CHARACTER, PLANK_SNOW, PLANK_WORD } from '../config/assets';
import { DEPTH, DESIGN_H, WORD_PLANK } from '../config/tuning';
import { PLANK_FONT_FAMILY } from '../level/rowLayout';
import { renderScale } from './ui';

export const worldY = (h: number) => DESIGN_H - h;

export interface Landable {
  /** Höhe der Lauffläche */
  h: number;
  x: number;
  halfWidth: number;
  canLand(): boolean;
}

export type NeutralSpecial = 'moving' | 'spring' | 'crumble';

export class NeutralPlank implements Landable {
  readonly img: Phaser.GameObjects.Image;
  readonly halfWidth: number;
  private glow?: Phaser.GameObjects.Image;
  private arrows?: Phaser.GameObjects.Text;
  private readonly baseX: number;
  private t = 0;
  broken = false;

  constructor(
    private scene: Phaser.Scene,
    public x: number,
    public h: number,
    width: number,
    public special?: NeutralSpecial,
    private move?: { amp: number; periodT: number; phase: number },
  ) {
    const s = width / PLANK_SNOW.width;
    this.baseX = x;
    this.img = scene.add
      .image(x, worldY(h), PLANK_SNOW.key)
      .setOrigin(0.5, PLANK_SNOW.surfaceY / PLANK_SNOW.height)
      .setScale(s)
      .setDepth(DEPTH.platforms);
    this.halfWidth = width / 2;

    if (special === 'spring') {
      // Sprungfeder: goldene Planke mit pulsierendem Leuchten
      this.img.setTint(0xffc94d);
      this.glow = scene.add
        .image(x, worldY(h) + 2, 'fx_glow')
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setTint(0xffb020)
        .setDisplaySize(width * 1.9, 110)
        .setDepth(DEPTH.platforms - 0.1);
      scene.tweens.add({ targets: this.glow, alpha: { from: 0.25, to: 0.55 }, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      // hüpfende Pfeile nach oben
      this.arrows = makePlainText(scene, x, worldY(h) - 26, '▲ ▲ ▲', 20, '#d17a00', '#6a3b00').setDepth(DEPTH.platforms + 0.2);
      scene.tweens.add({ targets: this.arrows, y: worldY(h) - 40, alpha: { from: 1, to: 0.35 }, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else if (special === 'crumble') {
      // bröselnde Planke: morsches, graubraunes Holz, wackelt leicht
      this.img.setTint(0x8e7263).setAlpha(0.92);
      scene.tweens.add({ targets: this.img, angle: { from: -1.4, to: 1.4 }, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    if (special === 'moving') this.update(0, 1);
  }

  canLand(): boolean {
    return !this.broken;
  }

  /** Bewegung (nur bewegliche Plattformen); T = aktuelle Flugzeit */
  update(dt: number, T: number): void {
    if (this.special !== 'moving' || !this.move) return;
    this.t += dt;
    const w = (Math.PI * 2) / (this.move.periodT * T);
    this.x = this.baseX + this.move.amp * Math.sin(this.move.phase + this.t * w);
    this.img.x = this.x;
  }

  bounce(scene: Phaser.Scene): void {
    if (this.special === 'spring') {
      // Feder: kräftig stauchen und zurückschnellen
      const sy = this.img.scaleY;
      scene.tweens.add({ targets: this.img, scaleY: { from: sy * 0.45, to: sy }, duration: 380, ease: 'Elastic.Out' });
      const sparks = scene.add.particles(this.x, worldY(this.h), 'fx_dot', {
        emitting: false,
        lifespan: { min: 350, max: 700 },
        speed: { min: 150, max: 380 },
        angle: { min: 230, max: 310 },
        scale: { start: 0.5, end: 0 },
        tint: [0xffd27a, 0x4a64c8],
        blendMode: Phaser.BlendModes.NORMAL,
      });
      sparks.setDepth(DEPTH.fx);
      sparks.explode(18);
      scene.time.delayedCall(800, () => sparks.destroy());
      return;
    }
    scene.tweens.add({
      targets: this.img,
      y: { from: worldY(this.h) + 7, to: worldY(this.h) },
      duration: 220,
      ease: 'Back.Out',
    });
  }

  /** bröselnde Planke zerfällt nach dem Absprung */
  crumble(splinterFrames: string[]): void {
    if (this.broken) return;
    this.broken = true;
    const scene = this.scene;
    const wy = worldY(this.h);
    const s = PLANK_WORD.displayHeight / PLANK_WORD.height;
    const bits = scene.add.particles(this.x, wy + 6, PLANK_WORD.key, {
      frame: splinterFrames,
      emitting: false,
      lifespan: { min: 500, max: 900 },
      speed: { min: 60, max: 220 },
      angle: { min: 20, max: 160 },
      gravityY: 1400,
      rotate: { min: -180, max: 180 },
      scale: { start: s * 0.9, end: s * 0.5 },
      tint: 0xb49a86,
      alpha: { start: 1, end: 0 },
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-this.halfWidth, -4, this.halfWidth * 2, 10) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
    });
    const snow = scene.add.particles(this.x, wy - 4, 'fx_dot', {
      emitting: false,
      lifespan: { min: 400, max: 800 },
      speed: { min: 40, max: 140 },
      angle: { min: 200, max: 340 },
      gravityY: 500,
      scale: { start: 0.45, end: 0.1 },
      alpha: { start: 0.9, end: 0 },
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-this.halfWidth, -3, this.halfWidth * 2, 6) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
    });
    bits.setDepth(DEPTH.fx);
    snow.setDepth(DEPTH.fx);
    bits.explode(14);
    snow.explode(16);
    scene.time.delayedCall(1000, () => {
      bits.destroy();
      snow.destroy();
    });
    scene.tweens.killTweensOf(this.img);
    scene.tweens.add({ targets: this.img, y: wy + 160, alpha: 0, angle: (Math.random() < 0.5 ? -1 : 1) * 25, duration: 550, ease: 'Quad.In' });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.img);
    this.img.destroy();
    if (this.glow) {
      this.scene.tweens.killTweensOf(this.glow);
      this.glow.destroy();
    }
    if (this.arrows) {
      this.scene.tweens.killTweensOf(this.arrows);
      this.arrows.destroy();
    }
  }
}

function makePlainText(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color: string, stroke: string): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: PLANK_FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: 'normal',
      color,
      stroke,
      strokeThickness: 4,
      padding: { x: 2, y: 4 },
      resolution: renderScale(scene),
    })
    .setOrigin(0.5);
}

/** einsammelbare Heidelbeere */
export class Berry {
  readonly img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  collected = false;

  constructor(
    private scene: Phaser.Scene,
    public x: number,
    public h: number,
  ) {
    const wy = worldY(h);
    this.glow = scene.add
      .image(x, wy, 'fx_glow')
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setTint(0x9fb4ff)
      .setDisplaySize(76, 56)
      .setAlpha(0.45)
      .setDepth(DEPTH.platforms + 1);
    this.img = scene.add
      .image(x, wy, CHARACTER.frames.idle)
      .setOrigin(0.5, 0.52)
      .setScale(BERRY_SIZE / CHARACTER.bodyHeight)
      .setDepth(DEPTH.platforms + 1.1);
    const phase = Math.random() * 600;
    scene.tweens.add({ targets: [this.img, this.glow], y: wy - 7, duration: 900, delay: phase, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    scene.tweens.add({ targets: this.img, angle: { from: -8, to: 8 }, duration: 1300, delay: phase, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** fliegt in die Anzeige (Bildschirmkoordinaten) und verschwindet */
  collect(camH: number, target: { x: number; y: number }, onArrive: () => void): void {
    this.collected = true;
    const sy = this.img.y + camH; // Welt → Bildschirm (scrollY = −camH)
    const flyer = this.scene.add
      .image(this.x, sy, CHARACTER.frames.idle)
      .setOrigin(0.5, 0.52)
      .setScale(this.img.scale)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);
    const sparks = this.scene.add.particles(this.x, this.img.y, 'fx_dot', {
      emitting: false,
      lifespan: { min: 300, max: 600 },
      speed: { min: 80, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      tint: [0xb9c8ff, 0x4a64c8],
      blendMode: Phaser.BlendModes.NORMAL,
    });
    sparks.setDepth(DEPTH.fx);
    sparks.explode(12);
    this.scene.time.delayedCall(700, () => sparks.destroy());
    this.destroy();
    this.scene.tweens.add({
      targets: flyer,
      x: target.x,
      y: target.y,
      scale: flyer.scale * 0.8,
      duration: 420,
      ease: 'Cubic.In',
      onComplete: () => {
        flyer.destroy();
        onArrive();
      },
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.img, this.glow]);
    this.img.destroy();
    this.glow.destroy();
  }
}

/** Darstellungsgröße der Beeren (Design-Pixel) */
export const BERRY_SIZE = 40;

export type WordPlankState = 'active' | 'correct' | 'broken' | 'retired';

export class WordPlank implements Landable {
  readonly container: Phaser.GameObjects.Container;
  private plank: Phaser.GameObjects.Container;
  private plankParts: Phaser.GameObjects.Image[];
  private label: Phaser.GameObjects.Text;
  private glow: Phaser.GameObjects.Image;
  readonly halfWidth: number;
  state: WordPlankState = 'active';

  constructor(
    private scene: Phaser.Scene,
    public x: number,
    public h: number,
    public width: number,
    public text: string,
    public correct: boolean,
    fontSize: number,
  ) {
    const s = PLANK_WORD.displayHeight / PLANK_WORD.height;
    this.halfWidth = width / 2;

    this.glow = scene.add.image(0, 0, 'fx_glow').setBlendMode(Phaser.BlendModes.NORMAL).setAlpha(0).setTint(0x5dff84);
    // 3-Slice: linke/rechte Kappe fest, Mitte gedehnt (Maserung läuft waagrecht)
    const tex = scene.textures.get(PLANK_WORD.key);
    const L = PLANK_WORD.sliceLeft;
    const R = PLANK_WORD.sliceRight;
    if (!tex.has('capL')) {
      tex.add('capL', 0, 0, 0, L, PLANK_WORD.height);
      tex.add('mid', 0, L, 0, PLANK_WORD.width - L - R, PLANK_WORD.height);
      tex.add('capR', 0, PLANK_WORD.width - R, 0, R, PLANK_WORD.height);
    }
    const oy = PLANK_WORD.surfaceY / PLANK_WORD.height;
    const capW = L * s;
    const midW = Math.max(1, width - capW - R * s);
    const left = scene.add.image(-width / 2, 0, PLANK_WORD.key, 'capL').setOrigin(0, oy).setScale(s);
    // Mitte minimal überlappen, damit keine Haarlinien entstehen
    const mid = scene.add.image(-width / 2 + capW - 0.5, 0, PLANK_WORD.key, 'mid').setOrigin(0, oy);
    mid.setDisplaySize(midW + 1, PLANK_WORD.height * s);
    const right = scene.add.image(width / 2, 0, PLANK_WORD.key, 'capR').setOrigin(1, oy).setScale(s);
    this.plankParts = [left, mid, right];
    this.plank = scene.add.container(0, 0, this.plankParts);

    const faceCenter = ((PLANK_WORD.height / 2 - PLANK_WORD.surfaceY) * s);
    this.glow.setPosition(0, faceCenter).setDisplaySize(width * 1.55, PLANK_WORD.displayHeight * 2.6);

    this.label = scene.add.text(0, faceCenter, text, {
      fontFamily: PLANK_FONT_FAMILY,
      fontSize: `${fontSize}px`,
      fontStyle: 'normal',
      color: WORD_PLANK.textColor,
      stroke: WORD_PLANK.strokeColor,
      strokeThickness: WORD_PLANK.strokeThickness,
      padding: { x: 4, y: Math.ceil(fontSize * 0.25) },
      resolution: renderScale(scene),
    });
    this.label.setOrigin(0.5, 0.5);
    const maxTextW = width - 2 * 16;
    if (this.label.width > maxTextW) this.label.setScale(maxTextW / this.label.width, 1);

    this.container = scene.add.container(x, worldY(h), [this.glow, this.plank, this.label]).setDepth(DEPTH.platforms);
  }

  canLand(): boolean {
    return this.state === 'active' || this.state === 'correct';
  }

  private pulseGlow(color: number, peak: number, repeat: number, duration: number): void {
    this.glow.setTint(color);
    this.scene.tweens.killTweensOf(this.glow);
    this.glow.setAlpha(0);
    this.scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0, to: peak * 0.6 }, // auf Papier wie ein Textmarker, nicht als Leuchten
      duration,
      yoyo: true,
      repeat,
      ease: 'Sine.InOut',
      onComplete: () => this.glow.setAlpha(0),
    });
  }

  /** richtige Antwort gewählt: kurz grün leuchten, Planke hüpft */
  markCorrect(): void {
    this.state = 'correct';
    this.pulseGlow(0x5dff84, 1, 0, 260);
    this.plankParts.forEach((p) => p.setTint(0xd9ffd9));
    this.scene.time.delayedCall(520, () => this.plankParts.forEach((p) => p.clearTint()));
    this.scene.tweens.add({ targets: this.container, y: worldY(this.h) + 8, duration: 90, yoyo: true, ease: 'Quad.Out' });
  }

  /** nach falscher Wahl: richtige Lösung aufleuchten lassen */
  revealSolution(): void {
    this.state = 'correct';
    this.pulseGlow(0x5dff84, 1, 2, 230);
    this.scene.tweens.add({ targets: this.container, scale: 1.08, duration: 230, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
  }

  /** falsche Planke bricht mit Holzsplittern */
  shatter(splinterFrames: string[]): void {
    this.state = 'broken';
    const wy = worldY(this.h);
    const s = PLANK_WORD.displayHeight / PLANK_WORD.height;
    const emitter = this.scene.add.particles(0, 0, PLANK_WORD.key, {
      frame: splinterFrames,
      emitting: false,
      lifespan: { min: 700, max: 1200 },
      speed: { min: 160, max: 480 },
      angle: { min: 195, max: 345 },
      gravityY: 1600,
      rotate: { min: -180, max: 180 },
      scale: { start: s * 1.4, end: s * 0.9 },
      alpha: { start: 1, end: 0, ease: 'Quad.In' },
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-this.width / 2, 0, this.width, PLANK_WORD.displayHeight * 0.8) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
    });
    emitter.setDepth(DEPTH.fx);
    emitter.explode(Math.round(18 + this.width / 10), this.x, wy);
    this.scene.time.delayedCall(1500, () => emitter.destroy());

    // Planke knickt ein und fällt
    this.plankParts.forEach((p) => p.setTint(0xffb0a0));
    this.scene.tweens.add({
      targets: this.container,
      y: wy + 420,
      angle: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 16),
      alpha: 0,
      scaleX: 0.85,
      duration: 750,
      ease: 'Quad.In',
    });
  }

  /** übrige falsche Planken nach der Antwort ausblenden (ohne Strafe) */
  retire(delay = 0): void {
    if (this.state !== 'active') return;
    this.state = 'retired';
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: worldY(this.h) + 60,
      delay,
      duration: 450,
      ease: 'Quad.In',
    });
  }

  bounce(): void {
    this.scene.tweens.add({ targets: this.container, y: worldY(this.h) + 6, duration: 80, yoyo: true, ease: 'Quad.Out' });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.killTweensOf(this.glow);
    this.container.destroy();
  }
}
