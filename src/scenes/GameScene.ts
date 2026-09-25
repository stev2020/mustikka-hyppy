import Phaser from 'phaser';
import { CHARACTER } from '../config/assets';
import { languageName } from '../config/settings';
import {
  CAMERA_FOLLOW_OFFSET,
  DEPTH,
  DESIGN_H,
  DESIGN_W,
  DIFFICULTY,
  FALL_OUT_MARGIN,
  ANNOUNCE,
  HEARTS,
  LEARNING,
  SPECIALS,
  LEVEL,
  SCORING,
  physicsFor,
  speedupAt,
  type Physics,
  type Tempo,
} from '../config/tuning';
import { getCtx, setSoundOn, type GameContext } from '../game/context';
import { Controls } from '../input/Controls';
import { keepScreenOn } from '../game/wakeLock';
import { LevelGenerator, checkReachability, type PlatformSpec, type RowSpec } from '../level/LevelGenerator';
import { Background } from '../render/Background';
import { THEMES } from '../config/themes';
import { Berry, NeutralPlank, WordPlank, worldY, type Landable } from '../render/Platforms';
import type { Highscore } from '../config/settings';
import { COLORS, fitText, makeButton, makeText, panel, setupCamera, sketchRect } from '../render/ui';
import type { AnswerRecord, RoundResult, VocabEntry } from '../vocab/types';
import { VocabDeck } from '../vocab/VocabDeck';
import { KNOWN_BOX } from '../vocab/Progress';

interface Row {
  spec: RowSpec;
  planks: WordPlank[];
  resolved: boolean;
}

type Pose = 'idle' | 'jump' | 'land' | 'hurt';

const HUD_H = 176;

export class GameScene extends Phaser.Scene {
  private ctx!: GameContext;
  private phys!: Physics;
  private bg!: Background;
  private controls!: Controls;
  private deck!: VocabDeck;
  private gen!: LevelGenerator;

  // Spieler (Füße: x, h)
  private px = DESIGN_W / 2;
  private ph = 0;
  private vx = 0;
  private vy = 0;
  private sprite!: Phaser.GameObjects.Image;
  private ghost!: Phaser.GameObjects.Image;
  private pose: Pose = 'idle';
  private landTimer = 0;
  private hurtTimer = 0;
  private squash = 0;
  private lastLandedH = 0;

  private camH = 0;
  private maxH = 0;
  private neutrals: NeutralPlank[] = [];
  private berries: Berry[] = [];
  /** Beeren bis zum nächsten Herz */
  private berryCount = 0;
  private berriesTotal = 0;
  private berryIcon!: Phaser.GameObjects.Image;
  private berryText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private rows: Row[] = [];
  private allSpecs: PlatformSpec[] = [];

  private hearts = HEARTS;
  private score = 0;
  private streak = 0;
  private answers: AnswerRecord[] = [];
  private wrongEntries = new Map<string, VocabEntry>();
  private elapsedMs = 0;
  private over = false;
  private dying = false;

  // HUD
  private heartTexts: Phaser.GameObjects.Text[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private promptHint!: Phaser.GameObjects.Text;
  private shownRowId = -1;
  private promptLockUntil = 0;
  private announcement?: Phaser.GameObjects.Container;
  private best: Highscore | null = null;
  private highscoreToastShown = false;
  private announcementsShown = 0;
  /** in dieser Runde neu sicher gewordene Wörter */
  private newlyKnown = new Set<string>();
  private debugText?: Phaser.GameObjects.Text;
  private autopilot = false;

  constructor() {
    super('Game');
  }

  init(): void {
    // Zustand bei Neustart zurücksetzen
    this.px = DESIGN_W / 2;
    this.ph = 0;
    this.vx = 0;
    this.vy = 0;
    this.pose = 'idle';
    this.landTimer = this.hurtTimer = this.squash = 0;
    this.camH = this.maxH = 0;
    this.neutrals = [];
    this.rows = [];
    this.berries = [];
    this.berryCount = 0;
    this.berriesTotal = 0;
    this.allSpecs = [];
    this.hearts = HEARTS;
    this.score = this.streak = 0;
    this.answers = [];
    this.wrongEntries = new Map();
    this.over = this.dying = false;
    this.shownRowId = -1;
    this.promptLockUntil = 0;
    this.elapsedMs = 0;
    this.heartTexts = [];
    this.highscoreToastShown = false;
    this.announcementsShown = 0;
    this.newlyKnown = new Set();
  }

  create(): void {
    this.ctx = getCtx(this);
    setupCamera(this);
    this.phys = physicsFor(this.ctx.tempo);
    this.best = this.ctx.prefs.getHighscore();

    this.bg = new Background(this, THEMES[this.ctx.theme]);
    this.controls = new Controls(this, this.ctx.tilt);
    this.controls.hudHeight = HUD_H + 10;

    this.deck = new VocabDeck(this.ctx.entries, {
      direction: this.ctx.settings.direction,
      levels: this.ctx.settings.levels,
      categories: this.ctx.settings.categories,
      repeatAfterRows: DIFFICULTY.repeatAfterRows,
      progress: this.ctx.progress,
      learningPath: { maxLearning: LEARNING.maxLearning, reviewShare: LEARNING.reviewShare },
    });
    this.gen = new LevelGenerator(this.deck);

    // Startplattform + erstes Stück Level
    const start = this.gen.start();
    this.spawn(start);
    this.allSpecs.push(start);
    this.ensureGenerated();

    this.ph = start.h;
    this.px = start.x;
    this.lastLandedH = start.h;
    this.vy = this.phys.jumpVelocity;

    const s = CHARACTER.displayHeight / CHARACTER.bodyHeight;
    this.sprite = this.add.image(this.px, worldY(this.ph), CHARACTER.frames.idle).setOrigin(0.5, CHARACTER.footY / CHARACTER.sourceSize).setScale(s).setDepth(DEPTH.player);
    this.ghost = this.add.image(0, 0, CHARACTER.frames.idle).setOrigin(0.5, CHARACTER.footY / CHARACTER.sourceSize).setScale(s).setDepth(DEPTH.player).setVisible(false);

    this.createHud();

    // Pause
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.openPause());
    kb.on('keydown-P', () => this.openPause());
    kb.on('keydown-M', () => setSoundOn(this, !this.ctx.sfx.enabled));
    const onHidden = () => this.openPause();
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.BLUR, onHidden);
    const onTempo = (t: Tempo) => this.applyTempo(t);
    this.game.events.on('tempo-changed', onTempo);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.BLUR, onHidden);
      this.game.events.off('tempo-changed', onTempo);
      this.controls.destroy();
    });

    if (this.ctx.debug) {
      this.debugText = makeText(this, 12, HUD_H + 24, '', { size: 18, weight: 600 }).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud);
      kb.on('keydown-B', () => (this.autopilot = !this.autopilot));
      this.autopilot = new URLSearchParams(location.search).has('autopilot');
      (window as unknown as Record<string, unknown>).__mustikka = this;
    }

    this.cameras.main.fadeIn(350, 250, 247, 239);

    // Bildschirm während der Runde nicht abschalten lassen
    keepScreenOn(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keepScreenOn(false));
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  private createHud(): void {
    const hud = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    hud.add(panel(this, 14, 14, DESIGN_W - 28, HUD_H - 14, 26, 0.86));

    for (let i = 0; i < HEARTS; i++) {
      const t = makeText(this, 46 + i * 42, 52, '♥', { size: 40, color: COLORS.heart, strokeThickness: 5 });
      this.heartTexts.push(t);
      hud.add(t);
    }
    // Beerenzähler
    this.berryIcon = this.add.image(186, 52, CHARACTER.frames.idle).setOrigin(0.5, 0.52).setScale(34 / CHARACTER.bodyHeight);
    this.berryText = makeText(this, 206, 53, '', { size: 22, weight: 800, strokeThickness: 4 }).setOrigin(0, 0.5);
    hud.add([this.berryIcon, this.berryText]);
    this.scoreText = makeText(this, 432, 52, '', { size: 25, weight: 700 });
    hud.add(this.scoreText);
    this.streakText = makeText(this, DESIGN_W - 40, 92, '', { size: 18, weight: 800, color: '#d17a00', strokeThickness: 3 }).setOrigin(1, 0.5);
    hud.add(this.streakText);

    const pause = makeButton(this, DESIGN_W - 66, 52, 76, 52, 'II', () => this.openPause(), { size: 26 });
    hud.add(pause.container);

    const from = languageName(this.ctx.settings.direction === 'forward' ? this.ctx.meta.sourceLang ?? this.ctx.settings.sourceLang : this.ctx.meta.targetLang ?? this.ctx.settings.targetLang);
    const to = languageName(this.ctx.settings.direction === 'forward' ? this.ctx.meta.targetLang ?? this.ctx.settings.targetLang : this.ctx.meta.sourceLang ?? this.ctx.settings.sourceLang);
    this.promptHint = makeText(this, DESIGN_W / 2, 92, `${from} → ${to}`, { size: 18, weight: 600, color: '#6b5f86', strokeThickness: 0 });
    this.promptText = makeText(this, DESIGN_W / 2, 132, '', { size: 50, weight: 900 });
    hud.add([this.promptHint, this.promptText]);
    this.updateHud();
  }

  private updateHud(): void {
    this.heartTexts.forEach((t, i) => t.setColor(i < this.hearts ? COLORS.heart : COLORS.heartLost));
    this.scoreText.setText(`${this.score} Punkte · ${Math.floor(this.maxH / 100)} m`);
    fitText(this.scoreText, 390, 25, 18);
    this.berryText.setText(`${this.berryCount}/${SPECIALS.berriesForHeart}`);
    const mult = Math.min(SCORING.streakMax, 1 + SCORING.streakStep * this.streak);
    this.streakText.setText(this.streak >= 2 ? `Serie ${this.streak} · ×${mult.toFixed(1).replace('.', ',')}` : '');
    if (!this.highscoreToastShown && this.best && this.best.score > 0 && this.score > this.best.score) {
      this.highscoreToastShown = true;
      this.highscoreToast();
    }

    if (this.time.now < this.promptLockUntil) return;
    const row = this.currentRow();
    const id = row ? row.spec.id : -1;
    if (id !== this.shownRowId) {
      this.shownRowId = id;
      this.setPrompt(row ? row.spec.question.prompt : '', COLORS.cream);
      if (row && !this.dying && !this.over) this.announce(row.spec.question.prompt, { label: 'Neues Wort' });
    }
  }

  /**
   * Großes Wort in der Bildmitte: springt auf, bleibt kurz stehen und
   * fliegt dann verblassend nach oben in die Anzeige.
   */
  private announce(text: string, o: { label?: string; color?: string; glow?: number; hold?: number } = {}): void {
    if (this.announcement) {
      this.tweens.killTweensOf(this.announcement);
      this.announcement.destroy();
    }
    const word = makeText(this, 0, o.label ? 18 : 0, text, { size: 66, weight: 900, color: o.color ?? COLORS.cream, strokeThickness: 11 });
    fitText(word, DESIGN_W - 130, 66, 30);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const w = Math.min(DESIGN_W - 50, Math.max(320, word.displayWidth + 100));
    const h = o.label ? 176 : 132;

    const glow = this.add.image(0, 0, 'fx_glow').setBlendMode(Phaser.BlendModes.NORMAL).setTint(o.glow ?? 0xffd27a);
    glow.setDisplaySize(w * 1.6, h * 2.4).setAlpha(0.5);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.ink, 0.1);
    bg.fillRoundedRect(-w / 2 + 6, -h / 2 + 8, w, h, 24);
    sketchRect(bg, -w / 2, -h / 2, w, h, 24, { fill: COLORS.panel, width: 4 });
    parts.push(glow, bg);
    if (o.label) parts.push(makeText(this, 0, -46, o.label, { size: 22, weight: 700, color: '#6b5f86', strokeThickness: 0 }));
    parts.push(word);

    if (this.announcementsShown++ > 0) this.ctx.sfx.play('whoosh');
    const c = this.add.container(DESIGN_W / 2, ANNOUNCE.y, parts).setScrollFactor(0).setDepth(DEPTH.hud - 1);
    this.announcement = c;

    // Auftritt
    c.setScale(0.45).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: ANNOUNCE.intro, ease: 'Back.Out' });
    this.tweens.add({ targets: glow, alpha: { from: 0.8, to: 0.3 }, duration: 520, yoyo: true, repeat: 1, ease: 'Sine.InOut' });

    // Funken
    const sparks = this.add.particles(DESIGN_W / 2, ANNOUNCE.y, 'fx_dot', {
      emitting: false,
      lifespan: { min: 500, max: 900 },
      speed: { min: 140, max: 330 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [o.glow ?? 0xffe39a, 0x4a64c8],
      blendMode: Phaser.BlendModes.NORMAL,
      emitZone: { type: 'edge', source: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h) as unknown as Phaser.Types.GameObjects.Particles.EdgeZoneSource, quantity: 22 },
    });
    sparks.setScrollFactor(0).setDepth(DEPTH.hud - 1);
    sparks.explode(22);
    this.time.delayedCall(1000, () => sparks.destroy());

    // Abgang: nach oben in die Anzeige
    const hold = o.hold ?? Math.min(ANNOUNCE.holdMax, ANNOUNCE.holdBase + ANNOUNCE.holdPerChar * text.length);
    this.tweens.add({
      targets: c,
      delay: ANNOUNCE.intro + hold,
      y: this.promptText.y,
      scale: 0.4,
      alpha: 0,
      duration: ANNOUNCE.outro,
      ease: 'Cubic.In',
      onComplete: () => {
        c.destroy();
        if (this.announcement === c) this.announcement = undefined;
        const sx = this.promptText.scaleX;
        this.tweens.add({ targets: this.promptText, scaleX: sx * 1.12, scaleY: this.promptText.scaleY * 1.12, duration: 120, yoyo: true, ease: 'Quad.Out' });
      },
    });
  }

  /** kleiner Hinweis unter der Anzeige, sobald der Rekord geknackt ist */
  private highscoreToast(): void {
    const t = makeText(this, DESIGN_W / 2, HUD_H + 40, 'Neuer Highscore!', { size: 34, weight: 900, color: '#d17a00', strokeThickness: 7 });
    t.setScrollFactor(0).setDepth(DEPTH.hud).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 320, ease: 'Back.Out' });
    this.tweens.add({ targets: t, angle: { from: -3, to: 3 }, duration: 160, yoyo: true, repeat: 3, ease: 'Sine.InOut' });
    this.tweens.add({ targets: t, alpha: 0, y: HUD_H + 10, delay: 1900, duration: 500, ease: 'Quad.In', onComplete: () => t.destroy() });
    const sparks = this.add.particles(DESIGN_W / 2, HUD_H + 40, 'fx_dot', {
      emitting: false,
      lifespan: { min: 500, max: 900 },
      speed: { min: 120, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      tint: [0xffd27a, 0x4a64c8],
      blendMode: Phaser.BlendModes.NORMAL,
    });
    sparks.setScrollFactor(0).setDepth(DEPTH.hud);
    sparks.explode(26);
    this.ctx.sfx.play('highscore');
    this.time.delayedCall(1000, () => sparks.destroy());
  }

  private setPrompt(text: string, color: string): void {
    this.promptText.setText(text).setColor(color);
    fitText(this.promptText, DESIGN_W - 80, 50, 26);
    const sx = this.promptText.scaleX;
    this.tweens.killTweensOf(this.promptText);
    this.promptText.setScale(sx * 0.7).setAlpha(0);
    this.tweens.add({ targets: this.promptText, scale: sx, alpha: 1, duration: 220, ease: 'Back.Out' });
  }

  // -------------------------------------------------------------------------
  // Level
  // -------------------------------------------------------------------------

  private spawn(spec: PlatformSpec): void {
    if (spec.kind === 'neutral') {
      this.neutrals.push(new NeutralPlank(this, spec.x, spec.h, spec.w, spec.special, spec.move));
    } else if (spec.kind === 'berry') {
      this.berries.push(new Berry(this, spec.x, spec.h));
    } else {
      const q = spec.question;
      const planks = spec.layout.planks.map(
        (p, i) => new WordPlank(this, p.x, spec.h, p.w, q.options[i], i === q.correctIndex, spec.layout.fontSize),
      );
      this.rows.push({ spec, planks, resolved: false });
    }
  }

  private ensureGenerated(): void {
    const target = this.camH + DESIGN_H + LEVEL.generateAhead;
    if (this.gen.topHeight >= target) return;
    const specs = this.gen.generateUpTo(target);
    for (const s of specs) this.spawn(s);
    if (this.ctx.debug) {
      this.allSpecs.push(...specs);
      const errs = checkReachability(this.allSpecs);
      if (errs.length) console.warn('[Mustikka Hyppy] Erreichbarkeit:', errs);
      if (this.allSpecs.length > 60) this.allSpecs.splice(0, this.allSpecs.length - 40);
    }
  }

  private cleanup(): void {
    const limit = this.camH - 200;
    this.neutrals = this.neutrals.filter((n) => {
      if (n.h < limit) {
        n.destroy();
        return false;
      }
      return true;
    });
    this.berries = this.berries.filter((b) => {
      if (b.collected) return false;
      if (b.h < limit) {
        b.destroy();
        return false;
      }
      return true;
    });
    this.rows = this.rows.filter((r) => {
      if (r.spec.h < limit && r.resolved) {
        r.planks.forEach((p) => p.destroy());
        return false;
      }
      return true;
    });
  }

  private currentRow(): Row | undefined {
    let best: Row | undefined;
    for (const r of this.rows) if (!r.resolved && (!best || r.spec.h < best.spec.h)) best = r;
    return best;
  }

  // -------------------------------------------------------------------------
  // Tempo / Pause
  // -------------------------------------------------------------------------

  private applyTempo(t: Tempo): void {
    const old = this.phys;
    this.phys = physicsFor(t);
    // laufende Bewegung passend umrechnen (gleiche Flugbahn, anderes Tempo)
    this.vy *= this.phys.jumpVelocity / old.jumpVelocity;
    this.vx *= this.phys.maxVx / old.maxVx;
  }

  private openPause(): void {
    if (this.over || !this.scene.isActive()) return;
    this.scene.pause();
    this.scene.launch('Pause');
  }

  // -------------------------------------------------------------------------
  // Spielschleife
  // -------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dtReal = Math.min(delta, 50) / 1000;
    const debugSpeed = this.ctx.debug ? this.ctx.debugSpeed : 1;
    this.elapsedMs += Math.min(delta, 250);

    if (!this.over) {
      const total = dtReal * speedupAt(this.maxH) * debugSpeed;
      const steps = Math.max(1, Math.ceil(total / (1 / 120)));
      for (let i = 0; i < steps && !this.over; i++) this.step(total / steps);
    }

    this.updatePlayerSprite(dtReal);
    this.cameras.main.scrollY = -this.camH;
    this.bg.update(this.camH, dtReal * debugSpeed);
    this.updateHud();

    if (this.debugText) {
      this.debugText.setText(
        `h ${this.ph.toFixed(0)}  cam ${this.camH.toFixed(0)}  T ${this.phys.T}s  x${speedupAt(this.maxH).toFixed(3)}  ${this.autopilot ? 'AUTO' : ''}`,
      );
    }
  }

  private steerAutopilot(): number {
    // Nur für Tests: steuert zur nächsten Plattform bzw. zur richtigen Planke
    let target: Landable | undefined;
    const cands: Landable[] = [...this.neutrals];
    const wrongMode = new URLSearchParams(location.search).has('wrong');
    for (const r of this.rows)
      for (const p of r.planks) {
        if (p.state === 'correct' || (p.state === 'active' && p.correct !== wrongMode)) cands.push(p);
      }
    for (const c of cands) if (c.h > this.lastLandedH + 1 && (!target || c.h < target.h)) target = c;
    if (!target) return 0;
    let dx = target.x - this.px;
    if (dx > DESIGN_W / 2) dx -= DESIGN_W;
    if (dx < -DESIGN_W / 2) dx += DESIGN_W;
    if (this.vy > 0 && this.ph < target.h) return Math.abs(dx) > 8 ? Math.sign(dx) : 0;
    return Math.abs(dx) > 8 ? Math.sign(dx) : 0;
  }

  private step(dt: number): void {
    const p = this.phys;
    const dir = this.dying ? 0 : this.autopilot ? this.steerAutopilot() : this.controls.direction();

    const target = dir * p.maxVx;
    const dv = target - this.vx;
    const maxDv = p.accel * dt;
    this.vx += Phaser.Math.Clamp(dv, -maxDv, maxDv);
    this.px += this.vx * dt;
    if (this.px < 0) this.px += DESIGN_W;
    if (this.px >= DESIGN_W) this.px -= DESIGN_W;

    for (const n of this.neutrals) if (n.special === 'moving') n.update(dt, p.T);

    const prevH = this.ph;
    this.vy -= p.gravity * dt;
    this.ph += this.vy * dt;

    if (this.vy < 0 && !this.dying) this.checkLanding(prevH);
    if (!this.dying) this.collectBerries();

    this.camH = Math.max(this.camH, this.ph - CAMERA_FOLLOW_OFFSET);
    this.maxH = Math.max(this.maxH, this.ph);
    this.ensureGenerated();
    this.cleanup();

    this.landTimer = Math.max(0, this.landTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);

    if (this.ph < this.camH - FALL_OUT_MARGIN) this.endRound(this.hearts <= 0 ? 'hearts' : 'fall');
  }

  private checkLanding(prevH: number): void {
    let best: { p: Landable; row?: Row } | undefined;
    const test = (pl: Landable, row?: Row) => {
      if (!pl.canLand()) return;
      if (!(prevH >= pl.h - 0.5 && this.ph <= pl.h)) return;
      let dx = Math.abs(this.px - pl.x) % DESIGN_W;
      dx = Math.min(dx, DESIGN_W - dx);
      if (dx > pl.halfWidth + CHARACTER.footHalfWidth) return;
      if (!best || pl.h > best.p.h) best = { p: pl, row };
    };
    for (const n of this.neutrals) test(n);
    for (const r of this.rows) for (const pl of r.planks) test(pl, r);
    if (!best) return;
    const { p, row } = best;

    if (p instanceof WordPlank && row && p.state === 'active' && !row.resolved) {
      if (p.correct) this.answerCorrect(row, p);
      else this.answerWrong(row, p);
      return;
    }
    this.bounceOn(p);
  }

  private bounceOn(p: Landable): void {
    this.ph = p.h;
    this.vy = this.phys.jumpVelocity;
    this.lastLandedH = p.h;
    this.landTimer = 0.13;
    this.squash = 1;
    if (p instanceof NeutralPlank && p.special === 'spring') {
      this.vy = this.phys.jumpVelocity * Math.sqrt(SPECIALS.springFactor);
      this.ctx.sfx.play('spring');
    } else {
      this.ctx.sfx.play('jump');
    }
    if (p instanceof NeutralPlank) {
      p.bounce(this);
      if (p.special === 'crumble') {
        this.ctx.sfx.play('crumble');
        this.time.delayedCall(40, () => p.crumble(['splinter0', 'splinter1', 'splinter2', 'splinter3', 'splinter4']));
      }
    } else if (p instanceof WordPlank) p.bounce();
  }

  /** Beeren einsammeln, wenn die Figur sie berührt */
  private collectBerries(): void {
    const cy = this.ph + CHARACTER.displayHeight * 0.45; // Körpermitte
    for (const b of this.berries) {
      if (b.collected) continue;
      let dx = Math.abs(this.px - b.x) % DESIGN_W;
      dx = Math.min(dx, DESIGN_W - dx);
      const dy = cy - b.h;
      if (dx * dx + dy * dy > 58 * 58) continue;
      this.berriesTotal++;
      this.score += SPECIALS.berryPoints;
      this.ctx.sfx.play('berry');
      b.collect(this.camH, { x: this.berryIcon.x, y: this.berryIcon.y }, () => this.berryArrived());
    }
  }

  private berryArrived(): void {
    if (this.over) return;
    this.berryCount++;
    this.tweens.add({ targets: this.berryIcon, scale: { from: this.berryIcon.scale * 1.5, to: 34 / CHARACTER.bodyHeight }, duration: 260, ease: 'Back.Out' });
    if (this.berryCount < SPECIALS.berriesForHeart) return;
    this.berryCount = 0;
    if (this.hearts < HEARTS) {
      const t = this.heartTexts[this.hearts];
      this.hearts++;
      this.ctx.sfx.play('heartUp');
      t.setScale(2);
      this.tweens.add({ targets: t, scale: 1, duration: 450, ease: 'Back.Out' });
      this.floatText(DESIGN_W / 2, worldY(this.ph) - 150, '+1 Herz!', '#d6455d');
    } else {
      this.score += SPECIALS.berryBonusPoints;
      this.ctx.sfx.play('heartUp');
      this.floatText(DESIGN_W / 2, worldY(this.ph) - 150, `+${SPECIALS.berryBonusPoints} Beerenbonus!`, '#3f5bc4');
    }
  }

  private record(row: Row, chosen: WordPlank, correct: boolean): void {
    const q = row.spec.question;
    this.answers.push({
      id: q.entry.id,
      prompt: q.prompt,
      answer: q.answer,
      chosen: chosen.text,
      correct,
      height: Math.round(row.spec.h),
      timeMs: Math.round(this.elapsedMs),
    });
    const before = this.ctx.progress.get(q.entry.id)?.box ?? -1;
    this.deck.report(q.entry, correct);
    const after = this.ctx.progress.get(q.entry.id)?.box ?? -1;
    if (correct && before < KNOWN_BOX && after >= KNOWN_BOX) this.newlyKnown.add(q.entry.id);
    if (!correct) this.wrongEntries.set(q.entry.id, q.entry);
  }

  private answerCorrect(row: Row, p: WordPlank): void {
    row.resolved = true;
    this.record(row, p, true);
    this.bounceOn(p);
    p.markCorrect();
    for (const o of row.planks) if (o !== p) o.retire(150);

    const n = row.planks.length;
    const mult = Math.min(SCORING.streakMax, 1 + SCORING.streakStep * this.streak);
    const pts = Math.round((SCORING.correct + SCORING.perExtraOption * (n - 2)) * mult);
    this.streak++;
    this.ctx.sfx.play('correct');
    this.ctx.speech.speak(row.spec.question.entry.target);
    if (this.streak % 5 === 0) {
      this.ctx.sfx.play('streak');
      this.bg.flare(this.streak >= 10 ? 1 : 0.75);
      this.sparkleRain(this.streak >= 10 ? 70 : 45);
      this.time.delayedCall(250, () => this.floatText(DESIGN_W / 2, worldY(p.h) - 120, `${this.streak} richtig in Folge!`, '#d17a00'));
    }
    this.score += pts;
    this.floatText(p.x, worldY(p.h) - 40, `+${pts}`, '#2f8a45');
  }

  private answerWrong(row: Row, p: WordPlank): void {
    row.resolved = true;
    this.record(row, p, false);
    this.streak = 0;
    this.hearts = Math.max(0, this.hearts - 1);

    p.shatter(['splinter0', 'splinter1', 'splinter2', 'splinter3', 'splinter4']);
    this.ctx.sfx.play('wrong');
    this.ctx.sfx.play('heart');
    // Lösung vorlesen, sobald sie aufleuchtet
    const target = row.spec.question.entry.target;
    this.time.delayedCall(450, () => this.ctx.speech.speak(target));
    const correct = row.planks.find((o) => o.correct);
    this.time.delayedCall(120, () => correct?.revealSolution());
    for (const o of row.planks) if (o !== p && o !== correct) o.retire(650);

    // Spieler fällt durch
    this.vy = Math.min(this.vy, 0) * 0.3;
    this.hurtTimer = 0.9;
    this.cameras.main.shake(180, 0.006);
    this.heartTexts[this.hearts]?.setScale(1.5);
    this.tweens.add({ targets: this.heartTexts[this.hearts], scale: 1, duration: 300, ease: 'Back.Out' });

    // oben kurz die Lösung zeigen
    const q = row.spec.question;
    this.promptLockUntil = this.time.now + ANNOUNCE.intro + ANNOUNCE.solutionHold + ANNOUNCE.outro + 50;
    this.shownRowId = -2;
    this.setPrompt(`${q.prompt} = ${q.answer}`, '#d17a00');
    if (this.hearts > 0) this.announce(q.answer, { label: `„${q.prompt}“ heißt`, color: '#2f8a45', glow: 0x5dff84, hold: ANNOUNCE.solutionHold });

    if (this.hearts <= 0) {
      this.dying = true;
      this.time.delayedCall(1100, () => this.endRound('hearts'));
    }
  }

  /** goldener Funkenregen über den ganzen Bildschirm (Serien-Effekt) */
  private sparkleRain(count: number): void {
    const rain = this.add.particles(0, 0, 'fx_dot', {
      x: { min: 0, max: DESIGN_W },
      y: { min: -20, max: 200 },
      lifespan: { min: 1200, max: 2000 },
      speedY: { min: 120, max: 320 },
      speedX: { min: -30, max: 30 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd27a, 0x9dffb4, 0xa6c8ff, 0x4a64c8],
      blendMode: Phaser.BlendModes.NORMAL,
      frequency: 25,
      quantity: 2,
    });
    rain.setScrollFactor(0).setDepth(DEPTH.hud - 2);
    this.time.delayedCall((count / 2) * 25, () => rain.stop());
    this.time.delayedCall(2600, () => rain.destroy());
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = makeText(this, x, y, text, { size: 34, color }).setDepth(DEPTH.fx);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 900, ease: 'Quad.Out', onComplete: () => t.destroy() });
  }

  private updatePlayerSprite(dt: number): void {
    let pose: Pose;
    if (this.hurtTimer > 0) pose = 'hurt';
    else if (this.landTimer > 0) pose = 'land';
    else if (this.vy > this.phys.jumpVelocity * 0.2) pose = 'jump';
    else pose = 'idle';
    if (pose !== this.pose) {
      this.pose = pose;
      this.sprite.setTexture(CHARACTER.frames[pose]);
      this.ghost.setTexture(CHARACTER.frames[pose]);
    }

    // Squash & Stretch
    const base = CHARACTER.displayHeight / CHARACTER.bodyHeight;
    this.squash = Math.max(0, this.squash - dt / 0.16);
    const v = Phaser.Math.Clamp(this.vy / this.phys.jumpVelocity, -1, 1);
    let sx = 1 - 0.05 * Math.abs(v);
    let sy = 1 + 0.07 * Math.abs(v);
    const sq = Math.sin(this.squash * Math.PI * 0.5);
    sx += 0.14 * sq;
    sy -= 0.16 * sq;
    const lean = (this.vx / this.phys.maxVx) * 7;

    const y = worldY(this.ph);
    this.sprite.setPosition(this.px, y).setScale(base * sx, base * sy).setAngle(lean);
    const edge = 60;
    if (this.px < edge || this.px > DESIGN_W - edge) {
      this.ghost.setVisible(true).setPosition(this.px < edge ? this.px + DESIGN_W : this.px - DESIGN_W, y).setScale(base * sx, base * sy).setAngle(lean);
    } else this.ghost.setVisible(false);
  }

  // -------------------------------------------------------------------------
  // Rundenende
  // -------------------------------------------------------------------------

  buildResult(endedBy: RoundResult['endedBy']): RoundResult {
    const correctIds = [...new Set(this.answers.filter((a) => a.correct).map((a) => a.id))];
    const wrongIds = [...new Set(this.answers.filter((a) => !a.correct).map((a) => a.id))];
    return {
      correctIds,
      wrongIds,
      answers: [...this.answers],
      score: this.score,
      maxHeight: Math.round(this.maxH),
      maxHeightMeters: Math.floor(this.maxH / 100),
      durationMs: Math.round(this.elapsedMs),
      tempo: this.ctx.tempo,
      direction: this.ctx.settings.direction,
      endedBy,
      berries: this.berriesTotal,
      newlyKnown: this.newlyKnown.size,
      newHighscore: this.score > 0 && this.score > (this.best?.score ?? 0),
      previousHighscore: this.best?.score ?? 0,
    };
  }

  /** Ergebnis melden (Callback + DOM-Event) */
  emitResult(result: RoundResult): void {
    this.ctx.lastResult = result;
    try {
      this.ctx.onResult?.(result);
    } catch (e) {
      console.error(e);
    }
    this.ctx.parentEl.dispatchEvent(new CustomEvent('mustikka-hyppy:result', { detail: result, bubbles: true }));
  }

  private saveHighscore(r: RoundResult): void {
    const prev = this.best;
    const bestMeters = Math.max(prev?.bestMeters ?? 0, r.maxHeightMeters);
    if (r.newHighscore || !prev) {
      this.ctx.prefs.setHighscore({ score: r.score, meters: r.maxHeightMeters, bestMeters, date: new Date().toISOString(), tempo: r.tempo });
    } else if (bestMeters > (prev.bestMeters ?? 0)) {
      this.ctx.prefs.setHighscore({ ...prev, bestMeters });
    }
  }

  endRound(endedBy: RoundResult['endedBy']): void {
    if (this.over) return;
    this.over = true;
    const result = this.buildResult(endedBy);
    this.saveHighscore(result);
    this.emitResult(result);
    const wrong = [...this.wrongEntries.values()].map((e) => ({ source: e.source, target: e.target }));
    if (endedBy === 'quit') return;
    this.ctx.sfx.play('gameover');
    this.time.delayedCall(250, () => {
      this.scene.launch('GameOver', { result, wrong });
      this.scene.pause();
    });
  }
}
