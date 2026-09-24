/** Ein Vokabeleintrag – sprachneutral: "source" und "target" sind nur Spalten. */
export interface VocabEntry {
  id: string;
  /** Ausgangssprache, z. B. "der Hund" oder "im Haus" */
  source: string;
  /** Zielsprache, z. B. "koira" oder "talossa" */
  target: string;
  /** Grundform des Zielworts (für "andere Formen desselben Worts") */
  lemma?: string;
  /** Grammatikform, z. B. "nominativ", "inessiv", "plural" */
  form?: string;
  category?: string;
  level?: number;
  /** handverlesene Ablenker in der Zielsprache */
  distractors?: string[];
  /** weitere richtige Varianten der Zielsprache (z. B. "suuri, iso") – nie als Ablenker */
  alternatives?: string[];
  /** frei verwendbare Schlagworte (z. B. Kapitel aus Anki) */
  tags?: string[];
}

export interface VocabFileMeta {
  title?: string;
  /** Herkunft, z. B. 'anki' */
  origin?: string;
  sourceLang?: string;
  targetLang?: string;
}

/** Eine Vokabeldatei ist entweder ein Array von Einträgen oder { meta, entries }. */
export type VocabFile = VocabEntry[] | { meta?: VocabFileMeta; entries: VocabEntry[] };

export function normalizeVocabFile(file: VocabFile): { meta: VocabFileMeta; entries: VocabEntry[] } {
  if (Array.isArray(file)) return { meta: {}, entries: file };
  return { meta: file.meta ?? {}, entries: file.entries ?? [] };
}

/** Eine Frage für eine Wortreihe */
export interface Question {
  entry: VocabEntry;
  /** oben angezeigt */
  prompt: string;
  /** richtige Antwort */
  answer: string;
  /** alle Optionen (gemischt), enthält answer genau einmal */
  options: string[];
  correctIndex: number;
}

export interface AnswerRecord {
  id: string;
  prompt: string;
  answer: string;
  chosen: string;
  correct: boolean;
  /** Kletterhöhe (Design-Pixel) beim Antworten */
  height: number;
  /** ms seit Rundenstart */
  timeMs: number;
}

/** Ergebnis-Objekt am Rundenende (Schnittstelle zur Lern-App) */
export interface RoundResult {
  /** IDs, die mindestens einmal richtig beantwortet wurden */
  correctIds: string[];
  /** IDs, die mindestens einmal falsch beantwortet wurden */
  wrongIds: string[];
  /** alle Antworten in Reihenfolge */
  answers: AnswerRecord[];
  score: number;
  /** erreichte Höhe in Design-Pixeln (720×1280) */
  maxHeight: number;
  /** erreichte Höhe in "Metern" wie im HUD angezeigt (1 m = 100 px) */
  maxHeightMeters: number;
  durationMs: number;
  tempo: string;
  direction: string;
  endedBy: 'fall' | 'hearts' | 'quit';
  /** eingesammelte Heidelbeeren */
  berries: number;
  /** Wörter, die in dieser Runde "sicher" geworden sind (3× richtig in Folge) */
  newlyKnown: number;
  /** Punkte-Rekord dieser Runde geknackt (lokal gespeichert) */
  newHighscore: boolean;
  /** bisheriger Rekord vor dieser Runde */
  previousHighscore: number;
}
