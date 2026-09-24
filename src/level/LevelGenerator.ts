import { DESIGN_H, DESIGN_W, DIFFICULTY, JUMP_HEIGHT, LEVEL, SPECIALS, lateralReach } from '../config/tuning';
import { PLANK_SNOW } from '../config/assets';
import type { Question } from '../vocab/types';
import type { VocabDeck } from '../vocab/VocabDeck';
import { layoutRow, type RowLayout } from './rowLayout';

export interface NeutralSpec {
  kind: 'neutral';
  id: number;
  x: number;
  h: number;
  w: number;
  role: 'start' | 'normal' | 'launch' | 'exit' | 'extra';
  /** Sonderplattform */
  special?: 'moving' | 'spring' | 'crumble';
  /** Bewegung (nur moving): Mitte = x, Ausschlag amp, Periode in Flugzeiten */
  move?: { amp: number; periodT: number; phase: number };
}

export interface BerrySpec {
  kind: 'berry';
  id: number;
  x: number;
  h: number;
}

export interface RowSpec {
  kind: 'row';
  id: number;
  h: number;
  index: number;
  question: Question;
  layout: RowLayout;
}

export type PlatformSpec = NeutralSpec | RowSpec | BerrySpec;

const wrapDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % DESIGN_W;
  return Math.min(d, DESIGN_W - d);
};

/**
 * Erzeugt das Level schrittweise nach oben.
 *
 * Garantien:
 *  - jede neutrale Plattform ist von der vorherigen aus erreichbar
 *    (Höhenabstand < Sprunghöhe, seitlicher Abstand < Reichweite, mit Wrap-Around);
 *  - vor jeder Wortreihe liegt eine Absprungplattform (150 px darunter) in einer
 *    Lücke zwischen den Planken; von ihr sind alle Optionen erreichbar;
 *  - keine andere Plattform unterhalb der Reihe erreicht die Reihe, und keine
 *    Plattform oberhalb ist von der Absprungplattform aus erreichbar –
 *    die Reihe kann also nicht übersprungen werden;
 *  - die erste Plattform über der Reihe ist von jeder Planke der Reihe erreichbar.
 *
 * Sonderplattformen:
 *  - bewegliche Plattformen liegen höchstens 118 px über/unter ihren Nachbarn –
 *    dann ist jede x-Position erreichbar, egal wo die Plattform gerade ist;
 *  - Sprungfedern gibt es nur, wenn ihr hoher Sprung unter der nächsten Reihe endet;
 *  - bröselnde Planken sind Extras neben dem Weg (nie nötig) und liegen nie in der
 *    Schutzzone um eine Reihe.
 */
export class LevelGenerator {
  private nextId = 1;
  private lastH = 0;
  private lastX = DESIGN_W / 2;
  private rowIndex = 0;
  /** normale Plattformen bis zur nächsten Absprungplattform */
  private normalsLeft = LEVEL.neutralsBeforeFirstRow - 1;
  private pendingRow: { question: Question; layout: RowLayout; launchX: number } | null = null;
  private readonly plankW = PLANK_SNOW.displayWidth;
  /** nächste Wegplattform muss nah liegen (nach einer beweglichen Plattform) */
  private forceSmallGap = false;
  /** Höhe der letzten Wortreihe (für die Schutzzone der Extras) */
  private lastRowH = -Infinity;

  constructor(
    private deck: VocabDeck,
    private rng: () => number = Math.random,
  ) {}

  get topHeight(): number {
    return this.lastH;
  }

  private rand(a: number, b: number): number {
    return a + (b - a) * this.rng();
  }

  private gapRange(h: number): [number, number] {
    const t = Math.min(1, h / LEVEL.gapRampHeight);
    return [
      LEVEL.gapMinStart + (LEVEL.gapMinEnd - LEVEL.gapMinStart) * t,
      LEVEL.gapMaxStart + (LEVEL.gapMaxEnd - LEVEL.gapMaxStart) * t,
    ];
  }

  private neutral(x: number, h: number, role: NeutralSpec['role']): NeutralSpec {
    this.lastH = h;
    this.lastX = x;
    return { kind: 'neutral', id: this.nextId++, x, h, w: this.plankW, role };
  }

  /** Anteil 0…1 der Höhen-Rampe ab `from` */
  private ramp(h: number, from: number): number {
    return Math.min(1, Math.max(0, (h - from) / (SPECIALS.rampHeight - from)));
  }

  private wrapX(x: number, margin: number): number {
    let v = ((x % DESIGN_W) + DESIGN_W) % DESIGN_W;
    v = Math.min(DESIGN_W - margin, Math.max(margin, v));
    return v;
  }

  /** Beere seitlich versetzt (lohnt einen riskanten Sprung zur Seite) */
  private berryNear(x: number, h: number): BerrySpec {
    const [a, b] = SPECIALS.berryOffset;
    const side = this.rng() < 0.5 ? -1 : 1;
    return { kind: 'berry', id: this.nextId++, x: this.wrapX(x + side * this.rand(a, b), 40), h };
  }

  /** zufälliges x, das von fromX aus (dy höher) erreichbar ist – optional auch zu einem Ziel hin */
  private pickX(fromX: number, dy: number, target?: { x: number; dy: number }): number {
    const half = this.plankW / 2 + 6;
    const maxDx = Math.min(lateralReach(dy) - 10, 330);
    const maxToTarget = target ? Math.min(lateralReach(target.dy) - 10, 340) : Infinity;
    for (let i = 0; i < 40; i++) {
      const x = this.rand(half, DESIGN_W - half);
      if (wrapDist(x, fromX) > maxDx) continue;
      if (target && wrapDist(x, target.x) > maxToTarget) continue;
      // nicht exakt übereinander stapeln, das wirkt langweilig
      if (wrapDist(x, fromX) < 40 && this.rng() < 0.7) continue;
      return x;
    }
    // Rückfall: Richtung Ziel bzw. nahe am Ausgangspunkt
    const base = target ? target.x : fromX;
    return Math.min(DESIGN_W - half, Math.max(half, base + this.rand(-60, 60)));
  }

  start(): NeutralSpec {
    return this.neutral(DESIGN_W / 2, LEVEL.startPlatformHeight, 'start');
  }

  private prepareRow(rowH: number): void {
    const n = DIFFICULTY.optionsAt(rowH);
    const question = this.deck.next(n, DIFFICULTY.similarityAt(rowH), DIFFICULTY.maxLevelAt(rowH));
    const layout = layoutRow(question.options);
    const launchX = layout.gapCenters[Math.floor(this.rng() * layout.gapCenters.length)] ?? DESIGN_W / 2;
    this.pendingRow = { question, layout, launchX };
  }

  /** erzeugt Plattformen, bis mindestens `height` erreicht ist */
  generateUpTo(height: number): PlatformSpec[] {
    const out: PlatformSpec[] = [];
    const firstSegment = this.rowIndex === 0;

    while (this.lastH < height) {
      if (this.normalsLeft > 0) {
        let [gMin, gMax] = this.gapRange(this.lastH);
        if (this.rowIndex === 0) {
          // erste Reihe muss beim Start sichtbar sein
          gMin = 105;
          gMax = 135;
        }
        const isPreLaunch = this.normalsLeft === 1;
        const est = this.lastH + gMin;

        // Sonderplattform für diesen Wegpunkt auswählen
        let special: NeutralSpec['special'];
        if (!isPreLaunch) {
          const [m0, m1] = SPECIALS.movingChance;
          const movingP = est >= SPECIALS.movingFrom ? m0 + (m1 - m0) * this.ramp(est, SPECIALS.movingFrom) : 0;
          // Feder nur, wenn der hohe Sprung sicher unter der nächsten Reihe endet:
          // nächste Reihe ≥ h + (verbleibende Plattformen)·100 + Absprung + Reihe
          const remainingAfter = this.normalsLeft - 1;
          const nextRowMin = remainingAfter * 100 + LEVEL.preLaunchGap + LEVEL.rowLaunchGap;
          const springOk = SPECIALS.springFactor * JUMP_HEIGHT + 20 < nextRowMin;
          const r = this.rng();
          if (est >= SPECIALS.springFrom && springOk && r < SPECIALS.springChance) special = 'spring';
          else if (r < SPECIALS.springChance + movingP) special = 'moving';
        }
        if (special === 'moving' || this.forceSmallGap) {
          gMin = Math.min(gMin, 100);
          gMax = Math.min(gMax, SPECIALS.movingMaxGap);
        }
        this.forceSmallGap = special === 'moving';

        const dy = this.rand(gMin, gMax);
        const h = this.lastH + dy;
        const prevX = this.lastX;
        const prevH = this.lastH;
        this.normalsLeft--;
        let spec: NeutralSpec;
        if (this.normalsLeft === 0) {
          // Plattform vor der Absprungplattform: muss die Absprungplattform erreichen
          this.prepareRow(h + LEVEL.preLaunchGap + LEVEL.rowLaunchGap);
          const x = this.pickX(this.lastX, dy, { x: this.pendingRow!.launchX, dy: LEVEL.preLaunchGap });
          spec = this.neutral(x, h, 'normal');
        } else {
          spec = this.neutral(this.pickX(this.lastX, dy), h, 'normal');
        }
        if (special === 'moving') {
          const half = this.plankW / 2 + 6;
          const [a0, a1] = SPECIALS.movingAmp;
          // Mitte so legen, dass der Ausschlag auf den Bildschirm passt
          let amp = this.rand(a0, a1);
          amp = Math.min(amp, (DESIGN_W - 2 * half) / 2);
          spec.x = Math.min(DESIGN_W - half - amp, Math.max(half + amp, spec.x));
          this.lastX = spec.x;
          const [p0, p1] = SPECIALS.movingPeriodT;
          spec.special = 'moving';
          spec.move = { amp, periodT: this.rand(p0, p1), phase: this.rand(0, Math.PI * 2) };
        } else if (special === 'spring') {
          spec.special = 'spring';
        }
        out.push(spec);

        // Beere zwischen der vorigen und dieser Plattform
        if (this.rng() < SPECIALS.berryChance) out.push(this.berryNear((prevX + spec.x) / 2, prevH + dy * 0.55));

        // bröselnde Extra-Planke seitlich (nie in der Schutzzone einer Reihe)
        const [c0, c1] = SPECIALS.crumbleChance;
        const crumbleP = h >= SPECIALS.crumbleFrom ? c0 + (c1 - c0) * this.ramp(h, SPECIALS.crumbleFrom) : 0;
        if (this.normalsLeft >= 1 && this.rng() < crumbleP) {
          const eh = h + this.rand(-30, 40);
          const nextRowMin = h + this.normalsLeft * 100 + LEVEL.preLaunchGap + LEVEL.rowLaunchGap;
          const safe = eh < nextRowMin - SPECIALS.rowSafeBelow && eh > this.lastRowH + SPECIALS.rowSafeAbove;
          if (safe) {
            const [o0, o1] = SPECIALS.crumbleOffset;
            const side = this.rng() < 0.5 ? -1 : 1;
            const half = this.plankW / 2 + 6;
            const ex = this.wrapX(spec.x + side * this.rand(o0, o1), half);
            if (wrapDist(ex, spec.x) > this.plankW + 20) {
              out.push({ kind: 'neutral', id: this.nextId++, x: ex, h: eh, w: this.plankW, role: 'extra', special: 'crumble' });
              if (this.rng() < SPECIALS.berryOnExtraChance) out.push({ kind: 'berry', id: this.nextId++, x: ex, h: eh + 75 });
            }
          }
        }
        continue;
      }

      // Absprungplattform – Wortreihe – Ausstiegsplattform
      if (!this.pendingRow) this.prepareRow(this.lastH + LEVEL.preLaunchGap + LEVEL.rowLaunchGap);
      const row = this.pendingRow!;
      this.pendingRow = null;

      const launchH = this.lastH + LEVEL.preLaunchGap;
      out.push(this.neutral(row.launchX, launchH, 'launch'));

      let rowH = launchH + LEVEL.rowLaunchGap;
      if (firstSegment && this.rowIndex === 0) {
        rowH = Math.min(rowH, DESIGN_H - LEVEL.firstRowMinFromTop);
      }
      out.push({ kind: 'row', id: this.nextId++, h: rowH, index: this.rowIndex++, question: row.question, layout: row.layout });
      this.lastH = rowH;
      this.lastRowH = rowH;
      this.forceSmallGap = false;

      const exitH = rowH + LEVEL.rowExitGap;
      out.push(this.neutral(this.rand(this.plankW / 2 + 6, DESIGN_W - this.plankW / 2 - 6), exitH, 'exit'));

      const [a, b] = LEVEL.neutralsBetweenRows;
      const total = a + Math.floor(this.rng() * (b - a + 1));
      // total zählt Ausstieg + normale + Absprung
      this.normalsLeft = Math.max(1, total - 2);
    }
    return out;
  }
}

/** Selbstprüfung der Geometrie-Garantien (für Tests / Debug) */
export function checkReachability(all: PlatformSpec[]): string[] {
  const errors: string[] = [];
  // Weg = Wegplattformen + Reihen (ohne Extras und Beeren)
  const specs = all.filter((s): s is NeutralSpec | RowSpec => s.kind === 'row' || (s.kind === 'neutral' && s.role !== 'extra'));
  const extras = all.filter((s): s is NeutralSpec => s.kind === 'neutral' && s.role === 'extra');
  const rows = specs.filter((s): s is RowSpec => s.kind === 'row');

  let prev: NeutralSpec | null = null;
  let prevRow: RowSpec | null = null;
  let lastBeforeLaunch: NeutralSpec | null = null;
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    if (s.kind === 'row') {
      if (!prev) {
        /* Liste beginnt mitten im Level */
      } else if (prev.role !== 'launch') errors.push(`Reihe ${s.index}: keine Absprungplattform`);
      else {
        const dy = s.h - prev.h;
        if (dy >= JUMP_HEIGHT) errors.push(`Reihe ${s.index}: zu hoch (${dy})`);
        for (const p of s.layout.planks) {
          if (wrapDist(p.x, prev.x) > lateralReach(dy) + p.w / 2) errors.push(`Reihe ${s.index}: Planke bei ${p.x.toFixed(0)} nicht erreichbar`);
        }
        if (lastBeforeLaunch && s.h - lastBeforeLaunch.h <= JUMP_HEIGHT + LEVEL.unreachableMargin)
          errors.push(`Reihe ${s.index}: von unterhalb der Absprungplattform erreichbar`);
      }
      prevRow = s;
      continue;
    }
    if (prevRow && s.role === 'exit') {
      for (const p of prevRow.layout.planks) {
        if (wrapDist(p.x, s.x) > lateralReach(s.h - prevRow.h) + p.w / 2) errors.push(`Ausstieg nach Reihe ${prevRow.index} von ${p.x.toFixed(0)} nicht erreichbar`);
      }
      if (prev && s.h - prev.h <= JUMP_HEIGHT + LEVEL.unreachableMargin) errors.push(`Ausstieg nach Reihe ${prevRow.index} direkt von Absprung erreichbar`);
    } else if (prev) {
      const dy = s.h - prev.h;
      if (dy >= JUMP_HEIGHT) errors.push(`Plattform ${s.id}: zu hoch (${dy.toFixed(0)})`);
      // bewegliche Plattformen: jede Position muss erreichbar sein
      const moving = s.special === 'moving' || prev.special === 'moving';
      if (moving && dy > SPECIALS.movingMaxGap + 0.5) errors.push(`Plattform ${s.id}: zu weit von/zu beweglicher Plattform (${dy.toFixed(0)})`);
      const dist = moving ? DESIGN_W / 2 : wrapDist(s.x, prev.x);
      if (dist > lateralReach(dy) + s.w / 2) errors.push(`Plattform ${s.id}: seitlich nicht erreichbar`);
    }
    if (s.special === 'spring') {
      const nextRow = rows.find((r) => r.h > s.h);
      if (nextRow && s.h + SPECIALS.springFactor * JUMP_HEIGHT + 20 >= nextRow.h) errors.push(`Feder ${s.id}: Sprung reicht über Reihe ${nextRow.index}`);
    }
    if (s.special === 'moving' && s.move && (s.x - s.move.amp < s.w / 2 || s.x + s.move.amp > DESIGN_W - s.w / 2))
      errors.push(`Bewegliche Plattform ${s.id}: verlässt den Bildschirm`);
    if (s.role === 'launch') lastBeforeLaunch = prev;
    prev = s;
  }
  for (const e of extras) {
    if (e.special === 'spring') errors.push(`Extra ${e.id}: Feder als Extra nicht erlaubt`);
    for (const r of rows) {
      if (e.h > r.h - SPECIALS.rowSafeBelow && e.h < r.h + SPECIALS.rowSafeAbove) errors.push(`Extra ${e.id}: in der Schutzzone von Reihe ${r.index}`);
    }
  }
  return errors;
}
