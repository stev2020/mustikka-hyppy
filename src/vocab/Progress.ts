/**
 * Lernstand über mehrere Runden (Karteikasten-Prinzip).
 *
 * Jedes Wort liegt in einem Fach 0–4. Richtig → ein Fach weiter,
 * falsch → zurück in Fach 0. Wörter in niedrigen Fächern und Wörter,
 * deren Wiederholungszeit abgelaufen ist, werden häufiger abgefragt.
 */

export interface WordProgress {
  /** Fach 0 (unsicher) … 4 (sicher) */
  box: number;
  right: number;
  wrong: number;
  /** Zeitpunkt der letzten Abfrage (ms seit 1970) */
  last: number;
}

export type ProgressMap = Record<string, WordProgress>;

/** Speicher für den Lernstand – austauschbar, z. B. gegen das Lernprofil der App */
export interface ProgressStore {
  load(): ProgressMap;
  save(all: ProgressMap): void;
}

export const MAX_BOX = 4;
/** ab diesem Fach gilt ein Wort als "sicher" */
export const KNOWN_BOX = 3;
/** nach dieser Zeit ist ein Wort im jeweiligen Fach wieder "fällig" */
export const BOX_INTERVAL_MS = [0, 10 * 60e3, 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3];
/** Grundgewicht je Fach (wie oft ein Wort gezogen wird) */
const BOX_WEIGHT = [6, 3, 1.6, 0.9, 0.5];
const NEW_WEIGHT = 2.5;

export function progressWeight(p: WordProgress | undefined, now: number): number {
  if (!p) return NEW_WEIGHT;
  const base = BOX_WEIGHT[p.box] ?? BOX_WEIGHT[MAX_BOX];
  const due = p.box > 0 && now - p.last >= BOX_INTERVAL_MS[p.box];
  // oft falsch beantwortete Wörter kommen zusätzlich häufiger
  const trouble = 1 + Math.min(1.5, (0.5 * p.wrong) / (p.right + 1));
  return base * (due ? 2 : 1) * trouble;
}

export class LocalProgressStore implements ProgressStore {
  constructor(private key: string) {}

  load(): ProgressMap {
    try {
      const v = window.localStorage.getItem(this.key);
      const m = v ? (JSON.parse(v) as ProgressMap) : {};
      return m && typeof m === 'object' ? m : {};
    } catch {
      return {};
    }
  }

  save(all: ProgressMap): void {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(all));
    } catch {
      /* ignorieren */
    }
  }
}

/** hält den Lernstand im Speicher und schreibt Änderungen sofort zurück */
export class ProgressTracker {
  private map: ProgressMap;

  constructor(private store?: ProgressStore) {
    this.map = store?.load() ?? {};
  }

  get(id: string): WordProgress | undefined {
    return this.map[id];
  }

  weight(id: string, now = Date.now()): number {
    return progressWeight(this.map[id], now);
  }

  record(id: string, correct: boolean, now = Date.now()): WordProgress {
    const p = this.map[id] ?? { box: 0, right: 0, wrong: 0, last: 0 };
    const next: WordProgress = correct
      ? { box: Math.min(MAX_BOX, p.box + 1), right: p.right + 1, wrong: p.wrong, last: now }
      : { box: 0, right: p.right, wrong: p.wrong + 1, last: now };
    this.map[id] = next;
    this.store?.save(this.map);
    return next;
  }

  /** Startwert setzen (z. B. aus Anki), überschreibt keinen vorhandenen Lernstand */
  seed(boxes: Record<string, number>): void {
    let changed = false;
    for (const [id, box] of Object.entries(boxes)) {
      if (this.map[id]) continue;
      this.map[id] = { box: Math.min(MAX_BOX, box), right: 0, wrong: 0, last: 0 };
      changed = true;
    }
    if (changed) this.store?.save(this.map);
  }

  /** fällig zur Wiederholung? */
  isDue(id: string, now = Date.now()): boolean {
    const p = this.map[id];
    return !!p && p.box > 0 && now - p.last >= BOX_INTERVAL_MS[p.box];
  }

  /** gesamten Lernstand dieser Liste löschen */
  reset(): void {
    this.map = {};
    this.store?.save(this.map);
  }

  /** Überblick für eine Liste von Wort-IDs */
  stats(ids: string[]): { known: number; learning: number; fresh: number; total: number } {
    let known = 0;
    let learning = 0;
    let fresh = 0;
    for (const id of ids) {
      const p = this.map[id];
      if (!p) fresh++;
      else if (p.box >= KNOWN_BOX) known++;
      else learning++;
    }
    return { known, learning, fresh, total: ids.length };
  }
}
