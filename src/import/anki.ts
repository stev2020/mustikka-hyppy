/**
 * Anki-Import: .apkg (Anki-Paket) und Klartext-Export (.txt/.tsv/.csv).
 *
 * .apkg ist ein ZIP mit einer SQLite-Datenbank:
 *  - collection.anki21b  (neue Anki-Versionen, zstd-komprimiert, Schema 18)
 *  - collection.anki21   (ältere Versionen / "Legacy"-Export)
 *  - collection.anki2    (sehr alt; bei neuen Exporten nur ein Platzhalter)
 * Die Bibliotheken (sql.js, fflate, fzstd) werden erst beim Import geladen.
 */

import type { SqlJsStatic, Database } from 'sql.js';
import type { VocabEntry, VocabFileMeta } from '../vocab/types';
import { cleanField, guessFinnishField, guessOtherLanguage, hashId, splitAnswer } from './clean';

export interface RawNote {
  id: string;
  fields: string[];
  tags: string[];
  deck: string;
  /** längstes Wiederholungsintervall der Karten dieser Notiz (Tage, 0 = neu) */
  ivl: number;
}

export interface RawDeck {
  title: string;
  fieldNames: string[];
  notes: RawNote[];
  source: 'apkg' | 'txt';
  /** Notizen mit anderem Notiztyp, die nicht übernommen wurden */
  otherModelNotes: number;
}

export interface ApkgDeps {
  SQL: SqlJsStatic;
  unzip: (data: Uint8Array) => Record<string, Uint8Array>;
  zstd: (data: Uint8Array) => Uint8Array;
}

/** Bibliotheken für .apkg im Browser nachladen */
export async function loadApkgDeps(): Promise<ApkgDeps> {
  const [sqlMod, wasm, fflate, fzstd] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
    import('fflate'),
    import('fzstd'),
  ]);
  const initSqlJs = (sqlMod as unknown as { default: (cfg: object) => Promise<SqlJsStatic> }).default;
  const SQL = await initSqlJs({ locateFile: () => wasm.default });
  return { SQL, unzip: (d) => fflate.unzipSync(d), zstd: (d) => fzstd.decompress(d) };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function query(db: Database, sql: string): unknown[][] {
  try {
    const r = db.exec(sql);
    return r[0]?.values ?? [];
  } catch {
    return [];
  }
}

export function parseApkg(data: Uint8Array, deps: ApkgDeps): RawDeck {
  const files = deps.unzip(data);
  let dbBytes: Uint8Array | undefined;
  if (files['collection.anki21b']) dbBytes = deps.zstd(files['collection.anki21b']);
  else if (files['collection.anki21']) dbBytes = files['collection.anki21'];
  else if (files['collection.anki2']) dbBytes = files['collection.anki2'];
  if (!dbBytes) throw new Error('Keine Anki-Sammlung in der Datei gefunden.');

  const db = new deps.SQL.Database(dbBytes);
  try {
    // Notiztypen und Felder: alt als JSON in col.models, neu in Tabelle "fields"
    const fieldsByModel = new Map<string, string[]>();
    const colRow = query(db, 'select models, decks from col')[0];
    let deckNames = new Map<string, string>();
    if (colRow && typeof colRow[0] === 'string' && colRow[0].length > 2) {
      const models = JSON.parse(colRow[0] as string) as Record<string, { flds: { name: string; ord: number }[] }>;
      for (const [mid, m] of Object.entries(models)) {
        fieldsByModel.set(String(mid), [...m.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name));
      }
      const decks = JSON.parse((colRow[1] as string) || '{}') as Record<string, { name: string }>;
      deckNames = new Map(Object.entries(decks).map(([id, d]) => [String(id), d.name]));
    } else {
      for (const [ntid, , name] of query(db, 'select ntid, ord, name from fields order by ntid, ord')) {
        const k = String(ntid);
        const list = fieldsByModel.get(k) ?? [];
        list.push(String(name));
        fieldsByModel.set(k, list);
      }
      deckNames = new Map(query(db, 'select id, name from decks').map(([id, name]) => [String(id), String(name).replace(/\x1f/g, '::')]));
    }

    // Deck und Intervall je Notiz
    const cardInfo = new Map<string, { did: string; ivl: number }>();
    for (const [nid, did, ivl] of query(db, 'select nid, did, max(ivl) from cards group by nid')) {
      cardInfo.set(String(nid), { did: String(did), ivl: Number(ivl) || 0 });
    }

    const rows = query(db, 'select id, mid, flds, tags from notes');
    if (!rows.length) throw new Error('Das Deck enthält keine Karten.');
    // häufigster Notiztyp = Hauptformat
    const modelCount = new Map<string, number>();
    for (const r of rows) modelCount.set(String(r[1]), (modelCount.get(String(r[1])) ?? 0) + 1);
    const mainModel = [...modelCount.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const notes: RawNote[] = [];
    let other = 0;
    for (const [id, mid, flds, tags] of rows) {
      if (String(mid) !== mainModel) {
        other++;
        continue;
      }
      const ci = cardInfo.get(String(id));
      notes.push({
        id: String(id),
        fields: String(flds).split('\x1f'),
        tags: String(tags).trim().split(/\s+/).filter(Boolean),
        deck: ci ? (deckNames.get(ci.did) ?? '') : '',
        ivl: ci?.ivl ?? 0,
      });
    }

    const deckCount = new Map<string, number>();
    for (const n of notes) deckCount.set(n.deck, (deckCount.get(n.deck) ?? 0) + 1);
    const mainDeck = [...deckCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const title = capitalize(mainDeck.split('::').pop()?.trim() || 'Anki-Deck');

    const fieldNames = fieldsByModel.get(mainModel) ?? notes[0].fields.map((_, i) => `Feld ${i + 1}`);
    return { title, fieldNames, notes, source: 'apkg', otherModelNotes: other };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Klartext-Export
// ---------------------------------------------------------------------------

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"' && cur === '') q = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseAnkiText(text: string, filename: string): RawDeck {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const header: Record<string, string> = {};
  const data: string[] = [];
  for (const l of lines) {
    const m = /^#([a-z ]+):(.*)$/i.exec(l);
    if (m && data.length === 0) header[m[1].trim().toLowerCase()] = m[2].trim();
    else if (l.trim()) data.push(l);
  }
  const sepNames: Record<string, string> = { tab: '\t', comma: ',', semicolon: ';', pipe: '|', space: ' ', colon: ':' };
  let sep = header.separator ? (sepNames[header.separator.toLowerCase()] ?? header.separator) : '';
  if (!sep) {
    const sample = data.slice(0, 20).join('\n');
    sep = sample.includes('\t') ? '\t' : (sample.match(/;/g)?.length ?? 0) > (sample.match(/,/g)?.length ?? 0) ? ';' : ',';
  }
  const col = (k: string) => (header[k] ? Number(header[k]) - 1 : -1);
  const special = new Set([col('guid column'), col('notetype column'), col('deck column'), col('tags column')].filter((i) => i >= 0));
  const tagsCol = col('tags column');
  const deckCol = col('deck column');
  const guidCol = col('guid column');

  const notes: RawNote[] = [];
  let width = 0;
  for (const l of data) {
    const cells = splitCsvLine(l, sep);
    const fields = cells.filter((_, i) => !special.has(i));
    width = Math.max(width, fields.length);
    notes.push({
      id: guidCol >= 0 ? `g${cells[guidCol]}` : `t${hashId(fields.slice(0, 2).join('|'))}`,
      fields,
      tags: tagsCol >= 0 ? (cells[tagsCol] ?? '').split(/\s+/).filter(Boolean) : [],
      deck: deckCol >= 0 ? (cells[deckCol] ?? '') : '',
      ivl: 0,
    });
  }
  if (!notes.length || width < 2) throw new Error('Keine Karten mit mindestens zwei Feldern gefunden.');
  const deck = notes.find((n) => n.deck)?.deck ?? '';
  const title = capitalize(deck.split('::').pop()?.trim() || filename.replace(/\.[^.]+$/, ''));
  return { title, fieldNames: Array.from({ length: width }, (_, i) => `Feld ${i + 1}`), notes, source: 'txt', otherModelNotes: 0 };
}

// ---------------------------------------------------------------------------
// Umwandlung in Spiel-Vokabeln
// ---------------------------------------------------------------------------

/** längste Antwort, die noch gut auf eine Planke passt */
export const MAX_ANSWER_LEN = 24;
/** längste Frage (oben in der Anzeige) */
export const MAX_PROMPT_LEN = 60;

export interface FieldMapping {
  /** Feld in der Lernsprache (Antwort auf den Planken) */
  target: number;
  /** Feld mit der Übersetzung (Frage oben) */
  source: number;
  sourceLang: string;
  targetLang: string;
}

export interface ConvertResult {
  entries: VocabEntry[];
  meta: VocabFileMeta;
  skipped: { empty: number; tooLong: number; duplicate: number; same: number };
  /** Wort-ID → Fach aus dem Anki-Lernstand */
  seedBoxes: Record<string, number>;
}

/** sinnvolle Vorbelegung: welches Feld ist Finnisch, welches die Übersetzung? */
export function guessMapping(deck: RawDeck): FieldMapping {
  const cols = deck.fieldNames.map((_, i) => deck.notes.slice(0, 300).map((n) => cleanField(n.fields[i] ?? '')));
  const filled = cols.map((c) => c.filter(Boolean).length);
  // nur Felder, die meistens gefüllt sind, kommen in Frage
  const candidates = cols.map((_, i) => i).filter((i) => filled[i] >= Math.max(1, filled.length ? Math.max(...filled) * 0.5 : 1));
  const fiIdx = candidates[guessFinnishField(candidates.map((i) => cols[i]))] ?? 0;
  const source = candidates.find((i) => i !== fiIdx) ?? (fiIdx === 0 ? 1 : 0);
  return { target: fiIdx, source, targetLang: 'fi', sourceLang: guessOtherLanguage(cols[source] ?? []) };
}

/**
 * Grobe Schwierigkeit 1–5 für importierte Karten: Lehrbuchkapitel (Tag "1"…"9"),
 * Länge, Wendungen und Grammatikkarten.
 */
export function estimateDifficulty(target: string, tags: string[]): number {
  if (/(^|\s)[-+]|[-+](\s|$)|\bG \+|\(|\)/.test(target)) return 5; // Grammatikkarten, Suffixe, Hinweise
  const chapter = tags.map(Number).find((n) => Number.isInteger(n) && n > 0);
  let d = chapter ? 1 + Math.floor((Math.min(chapter, 10) - 1) / 2.5) : 2;
  const words = target.trim().split(/\s+/).length;
  if (target.length > 11) d++;
  if (words > 2) d++;
  return Math.max(1, Math.min(5, d));
}

const GENERIC_TAGS = new Set(['sanasto', 'tarina', 'fraasit', 'vocab', 'vocabulary', 'leech', 'marked', 'duplicate']);

export function convertDeck(deck: RawDeck, map: FieldMapping): ConvertResult {
  // Tag-Häufigkeiten: das seltenste Themen-Tag einer Notiz wird zur Kategorie
  const tagFreq = new Map<string, number>();
  for (const n of deck.notes) for (const t of n.tags) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);

  const entries: VocabEntry[] = [];
  const seedBoxes: Record<string, number> = {};
  const skipped = { empty: 0, tooLong: 0, duplicate: 0, same: 0 };
  const seen = new Set<string>();

  for (const n of deck.notes) {
    const target = cleanField(n.fields[map.target] ?? '');
    const source = cleanField(n.fields[map.source] ?? '');
    if (!target || !source) {
      skipped.empty++;
      continue;
    }
    const ans = splitAnswer(target, MAX_ANSWER_LEN);
    if (!ans || source.length > MAX_PROMPT_LEN) {
      skipped.tooLong++;
      continue;
    }
    // gleiche Wörter auf beiden Seiten ("tango → tango") sind keine Übung
    if (ans.display.toLowerCase() === source.toLowerCase()) {
      skipped.same++;
      continue;
    }
    const key = `${ans.display.toLowerCase()}|${source.toLowerCase()}`;
    if (seen.has(key)) {
      skipped.duplicate++;
      continue;
    }
    seen.add(key);

    const topical = n.tags.filter((t) => !/^\d+$/.test(t) && !GENERIC_TAGS.has(t.toLowerCase()));
    const chapter = n.tags.find((t) => /^\d+$/.test(t));
    const category = topical.length
      ? topical.sort((a, b) => (tagFreq.get(a) ?? 0) - (tagFreq.get(b) ?? 0))[0]
      : chapter
        ? `Kapitel ${chapter}`
        : 'allgemein';

    const id = `anki-${n.id}`;
    entries.push({
      id,
      source,
      target: ans.display,
      lemma: ans.display,
      category,
      level: estimateDifficulty(ans.display, n.tags),
      alternatives: ans.alternatives.length ? ans.alternatives : undefined,
      tags: n.tags.length ? n.tags : undefined,
    });
    if (n.ivl >= 21) seedBoxes[id] = 3;
    else if (n.ivl >= 7) seedBoxes[id] = 2;
    else if (n.ivl >= 1) seedBoxes[id] = 1;
  }
  return {
    entries,
    meta: { title: deck.title, sourceLang: map.sourceLang, targetLang: map.targetLang },
    skipped,
    seedBoxes,
  };
}
