/**
 * Testet den Anki-Import ohne Browser: npm run test-import -- <datei.apkg|.txt>
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { unzipSync } from 'fflate';
import { decompress } from 'fzstd';
import { convertDeck, guessMapping, parseAnkiText, parseApkg } from '../src/import/anki';
import { VocabDeck } from '../src/vocab/VocabDeck';

const require = createRequire(import.meta.url);
const file = process.argv[2];
if (!file) {
  console.log('Aufruf: npm run test-import -- <datei.apkg|.txt>');
  process.exit(1);
}

const initSqlJs = require('sql.js');
const SQL = await initSqlJs();
const data = new Uint8Array(readFileSync(file));
const deck = file.toLowerCase().endsWith('.apkg')
  ? parseApkg(data, { SQL, unzip: (d) => unzipSync(d), zstd: (d) => decompress(d) })
  : parseAnkiText(new TextDecoder().decode(data), file);

const map = guessMapping(deck);
const res = convertDeck(deck, map);
console.log(`Deck: ${deck.title} (${deck.source}), Felder: ${deck.fieldNames.join(' | ')}`);
console.log(`Zuordnung: Lernsprache = "${deck.fieldNames[map.target]}" (${map.targetLang}), Übersetzung = "${deck.fieldNames[map.source]}" (${map.sourceLang})`);
console.log(`${res.entries.length} Wörter übernommen, übersprungen: ${JSON.stringify(res.skipped)}, anderer Notiztyp: ${deck.otherModelNotes}`);
const cats = new Map<string, number>();
for (const e of res.entries) cats.set(e.category!, (cats.get(e.category!) ?? 0) + 1);
console.log('Kategorien:', [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('Lernstand aus Anki:', Object.keys(res.seedBoxes).length, 'Wörter mit Intervall');
console.log('Beispiele:');
for (const e of res.entries.filter((_, i) => i % Math.max(1, Math.floor(res.entries.length / 12)) === 0).slice(0, 12))
  console.log(`  ${e.source}  →  ${e.target}${e.alternatives ? `   [${e.alternatives.join(' | ')}]` : ''}   (${e.category})`);

// Probe-Fragen
let s = 3;
const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const vd = new VocabDeck(res.entries, { direction: 'forward', repeatAfterRows: [3, 4], rng });
console.log('Probe-Reihen:');
for (let i = 0; i < 8; i++) {
  const q = vd.next(i < 3 ? 2 : 4, (i % 3) as 0 | 1 | 2);
  console.log(`  ${q.prompt}  →  [${q.options.join(', ')}]  richtig: ${q.answer}`);
}
