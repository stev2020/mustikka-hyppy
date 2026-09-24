import type { Direction } from '../config/settings';
import type { Question, VocabEntry } from './types';
import { KNOWN_BOX, type ProgressTracker } from './Progress';

export type Similarity = 0 | 1 | 2;

export interface DeckOptions {
  direction: Direction;
  levels?: number[];
  categories?: string[];
  repeatAfterRows: [number, number];
  rng?: () => number;
  /** Lernstand über Runden; ohne ihn wird gleichmäßig gemischt */
  progress?: ProgressTracker;
  /** Lernpfad: neue Wörter nach Schwierigkeit einführen (braucht progress) */
  learningPath?: { maxLearning: number; reviewShare: number };
}

interface Candidate {
  text: string;
  tier: Similarity;
  handpicked: boolean;
  /** kleiner = bevorzugt (für Level-Nähe) */
  levelDistance: number;
  rand: number;
}

const norm = (s: string) => s.trim().toLocaleLowerCase();

/**
 * Wählt die abzufragenden Wörter aus, baut Ablenker und plant
 * Wiederholungen falsch beantworteter Wörter.
 */
export class VocabDeck {
  /** alle Einträge (Quelle für Ablenker) */
  private all: VocabEntry[];
  /** abfragbare Einträge (nach Level/Kategorie gefiltert) */
  private pool: VocabEntry[];
  private seenThisRound = new Map<string, number>();
  private pathOrder: VocabEntry[] = [];
  /** in dieser Runde neu eingeführt (noch ohne Lernstand) */
  private introduced = new Set<string>();
  private repeats: { entry: VocabEntry; dueIn: number }[] = [];
  private recent: string[] = [];
  private rng: () => number;
  private byTarget = new Map<string, VocabEntry[]>();

  constructor(entries: VocabEntry[], private opts: DeckOptions) {
    this.rng = opts.rng ?? Math.random;
    this.all = entries.filter((e) => e && e.id && e.source && e.target);
    const levels = opts.levels?.length ? new Set(opts.levels) : null;
    const cats = opts.categories?.length ? new Set(opts.categories) : null;
    this.pool = this.all.filter(
      (e) => (!levels || levels.has(e.level ?? 1)) && (!cats || cats.has(e.category ?? '')),
    );
    if (this.pool.length === 0) this.pool = [...this.all];
    // Reihenfolge des Lernpfads: leichte zuerst, innerhalb einer Stufe wie in der Liste
    this.pathOrder = this.pool.map((e, i) => ({ e, i })).sort((a, b) => (a.e.level ?? 1) - (b.e.level ?? 1) || a.i - b.i).map((x) => x.e);
    for (const e of this.all) {
      const k = norm(e.target);
      const list = this.byTarget.get(k) ?? [];
      list.push(e);
      this.byTarget.set(k, list);
    }
  }

  /** IDs der abfragbaren Wörter (nach Filtern) */
  get poolIds(): string[] {
    return this.pool.map((e) => e.id);
  }

  get size(): number {
    return this.pool.length;
  }

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private promptOf(e: VocabEntry): string {
    return this.opts.direction === 'forward' ? e.source : e.target;
  }

  private answerOf(e: VocabEntry): string {
    return this.opts.direction === 'forward' ? e.target : e.source;
  }

  /** nächstes Wort ziehen: fällige Wiederholungen zuerst, sonst gemischter Stapel */
  private pickEntry(maxLevel: number): VocabEntry {
    // Wiederholungen
    const dueIdx = this.repeats.findIndex((r) => r.dueIn <= 0);
    for (const r of this.repeats) r.dueIn--;
    if (dueIdx >= 0) {
      const [r] = this.repeats.splice(dueIdx, 1);
      return r.entry;
    }

    if (this.opts.progress && this.opts.learningPath) return this.pickFromPath();

    const eligible = (e: VocabEntry) => (e.level ?? 1) <= maxLevel;
    const hasEligible = this.pool.some(eligible);
    const ok = (e: VocabEntry) =>
      (!hasEligible || eligible(e)) &&
      !this.recent.includes(e.id) &&
      !this.repeats.some((r) => r.entry.id === e.id);

    for (let attempt = 0; attempt < 2; attempt++) {
      const cands = this.pool.filter(ok);
      if (cands.length) return this.weightedPick(cands);
      this.recent = this.recent.slice(-1);
    }
    // sehr kleiner Pool: notfalls irgendein Eintrag
    return this.pool[Math.floor(this.rng() * this.pool.length)];
  }

  /**
   * Lernpfad: sichere Wörter gelegentlich wiederholen, sonst aus den Wörtern
   * "in Arbeit" wählen; ist dort Platz, kommt das nächstleichte neue Wort dazu.
   */
  private pickFromPath(): VocabEntry {
    const P = this.opts.progress!;
    const { maxLearning, reviewShare } = this.opts.learningPath!;
    const ok = (e: VocabEntry) => !this.recent.includes(e.id) && !this.repeats.some((r) => r.entry.id === e.id);

    const learning: VocabEntry[] = [];
    const known: VocabEntry[] = [];
    const fresh: VocabEntry[] = [];
    for (const e of this.pathOrder) {
      const p = P.get(e.id);
      if (!p) (this.introduced.has(e.id) ? learning : fresh).push(e);
      else if (p.box >= KNOWN_BOX) known.push(e);
      else learning.push(e);
    }
    const slots = Math.max(0, maxLearning - learning.length);
    const active = [...learning, ...fresh.slice(0, slots)].filter(ok);
    const reviews = known.filter(ok);

    let pick: VocabEntry;
    if (reviews.length && (!active.length || this.rng() < reviewShare)) {
      // Wiederholung: fällige sichere Wörter bevorzugen
      const due = reviews.filter((e) => P.isDue(e.id));
      pick = this.weightedPick(due.length ? due : reviews);
    } else if (active.length) {
      pick = this.weightedPick(active);
    } else {
      const any = fresh.filter(ok);
      pick = any[0] ?? this.pool[Math.floor(this.rng() * this.pool.length)];
    }
    if (!P.get(pick.id)) this.introduced.add(pick.id);
    return pick;
  }

  /**
   * Gewichtete Auswahl: unsichere und fällige Wörter (Lernstand) kommen
   * öfter dran; was in dieser Runde schon dran war, seltener.
   */
  private weightedPick(cands: VocabEntry[]): VocabEntry {
    const now = Date.now();
    const weights = cands.map((e) => {
      const w = this.opts.progress ? this.opts.progress.weight(e.id, now) : 1;
      const seen = this.seenThisRound.get(e.id) ?? 0;
      return w / (1 + 1.5 * seen);
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = this.rng() * sum;
    for (let i = 0; i < cands.length; i++) {
      r -= weights[i];
      if (r <= 0) return cands[i];
    }
    return cands[cands.length - 1];
  }

  /** Ähnlichkeitsstufe eines Ablenkertextes relativ zum abgefragten Eintrag */
  private classifyHandpicked(entry: VocabEntry, text: string): Similarity {
    const hits = this.byTarget.get(norm(text)) ?? [];
    const lemma = norm(entry.lemma ?? entry.target);
    if (hits.some((h) => norm(h.lemma ?? h.target) === lemma)) return 2;
    if (hits.length > 0) return hits.some((h) => h.category && h.category === entry.category) ? 1 : 0;
    // unbekanntes Wort: gleicher Wortanfang → wohl eine andere Form desselben Worts
    // (Stamm ohne die letzten zwei Buchstaben, wegen Stufenwechsel: katu → kadun)
    const t = norm(text);
    const stem = lemma.slice(0, Math.max(2, lemma.length - 2));
    return t.startsWith(stem) ? 2 : 1;
  }

  private tierOf(entry: VocabEntry, other: VocabEntry): Similarity {
    const a = norm(entry.lemma ?? entry.target);
    const b = norm(other.lemma ?? other.target);
    if (a === b) return 2;
    if (entry.category && entry.category === other.category) return 1;
    return 0;
  }

  private buildCandidates(entry: VocabEntry): Candidate[] {
    const answer = norm(this.answerOf(entry));
    const prompt = norm(this.promptOf(entry));
    // Texte, die ebenfalls richtig wären (gleicher Prompt, andere Übersetzung), ausschließen
    const alsoCorrect = new Set(
      this.all.filter((e) => norm(this.promptOf(e)) === prompt).map((e) => norm(this.answerOf(e))),
    );
    // Varianten ("suuri, iso") sind ebenfalls richtig
    if (this.opts.direction === 'forward') for (const a of entry.alternatives ?? []) alsoCorrect.add(norm(a));
    const seen = new Set<string>([answer, ...alsoCorrect]);
    const out: Candidate[] = [];
    const level = entry.level ?? 1;

    const add = (text: string, tier: Similarity, handpicked: boolean, lvl: number) => {
      const k = norm(text);
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push({ text, tier, handpicked, levelDistance: Math.abs(lvl - level), rand: this.rng() });
    };

    // 1) handverlesene Ablenker
    for (const d of entry.distractors ?? []) {
      if (this.opts.direction === 'forward') {
        add(d, this.classifyHandpicked(entry, d), true, level);
      } else {
        // Rückwärts: den Ablenker über seinen Eintrag in die Ausgangssprache übersetzen
        for (const hit of this.byTarget.get(norm(d)) ?? []) add(hit.source, this.tierOf(entry, hit), true, hit.level ?? 1);
      }
    }
    // 2) automatisch: andere Einträge
    for (const other of this.all) {
      if (other.id === entry.id) continue;
      // Einträge, deren Varianten die richtige Antwort enthalten, wären mehrdeutig
      if (this.opts.direction === 'forward' && (other.alternatives ?? []).some((a) => alsoCorrect.has(norm(a)) || norm(a) === answer)) continue;
      add(this.answerOf(other), this.tierOf(entry, other), false, other.level ?? 1);
    }
    return out;
  }

  /**
   * Nächste Frage. numOptions = 2…4, similarity = gewünschte Ähnlichkeit der Ablenker.
   * Auswahl: gewünschte Stufe zuerst (handverlesene vor automatischen),
   * dann leichtere Stufen, zuletzt schwerere.
   */
  next(numOptions: number, similarity: Similarity, maxLevel = 99): Question {
    const entry = this.pickEntry(maxLevel);
    this.seenThisRound.set(entry.id, (this.seenThisRound.get(entry.id) ?? 0) + 1);
    this.recent.push(entry.id);
    if (this.recent.length > Math.min(6, Math.floor(this.pool.length / 2))) this.recent.shift();

    const cands = this.buildCandidates(entry);
    const rank = (c: Candidate) => {
      const d = similarity - c.tier;
      const tierRank = d >= 0 ? d : 3 + -d; // leichtere vor schwereren
      return tierRank * 10 + (c.handpicked ? 0 : 3) + Math.min(2, c.levelDistance) + c.rand;
    };
    cands.sort((a, b) => rank(a) - rank(b));

    const distractors = cands.slice(0, Math.max(1, numOptions - 1)).map((c) => c.text);
    const answer = this.answerOf(entry);
    const options = this.shuffle([answer, ...distractors]);
    return {
      entry,
      prompt: this.promptOf(entry),
      answer,
      options,
      correctIndex: options.indexOf(answer),
    };
  }

  /** nach einer Antwort aufrufen: falsche Wörter kommen nach einigen Reihen wieder */
  report(entry: VocabEntry, correct: boolean): void {
    this.opts.progress?.record(entry.id, correct);
    if (correct) return;
    if (this.repeats.some((r) => r.entry.id === entry.id)) return;
    const [a, b] = this.opts.repeatAfterRows;
    this.repeats.push({ entry, dueIn: a + Math.floor(this.rng() * (b - a + 1)) });
  }
}
