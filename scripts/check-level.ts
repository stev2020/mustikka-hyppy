/**
 * Prüft die Level-Erzeugung ohne Browser: Erreichbarkeit, erste Reihe,
 * Optionen je Reihe. Aufruf: npm run check
 */
import { LevelGenerator, checkReachability, type PlatformSpec } from '../src/level/LevelGenerator';
import { VocabDeck } from '../src/vocab/VocabDeck';
import { ProgressTracker } from '../src/vocab/Progress';
import { DESIGN_H, LEVEL } from '../src/config/tuning';
import words from '../vocab/de-fi-basis.json';
import standard from '../vocab/de-fi-grundwortschatz.json';
import type { VocabEntry } from '../src/vocab/types';

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const entries = (words as { entries: VocabEntry[] }).entries;
let problems = 0;

for (const direction of ['forward', 'reverse'] as const) {
  for (let run = 0; run < 40; run++) {
    seed = 1000 + run;
    const deck = new VocabDeck(entries, { direction, repeatAfterRows: [3, 4], rng });
    const gen = new LevelGenerator(deck, rng);
    const specs: PlatformSpec[] = [gen.start()];
    specs.push(...gen.generateUpTo(40000));
    const errs = checkReachability(specs);
    const rows = specs.filter((s) => s.kind === 'row');
    const first = rows[0];
    if (first.h > DESIGN_H - LEVEL.firstRowMinFromTop) errs.push(`erste Reihe zu hoch: ${first.h}`);
    for (const r of rows) {
      if (r.kind !== 'row') continue;
      const o = r.question.options;
      if (new Set(o.map((x) => x.toLowerCase())).size !== o.length) errs.push(`doppelte Optionen: ${o}`);
      if (o.filter((x) => x === r.question.answer).length !== 1) errs.push(`Antwort fehlt: ${o}`);
      if (o.length < 2) errs.push('zu wenige Optionen');
    }
    if (errs.length) {
      problems += errs.length;
      console.log(direction, run, errs.slice(0, 5));
    }
    if (run === 0 && direction === 'forward') {
      const count = (f: (s: PlatformSpec) => boolean) => specs.filter(f).length;
      console.log(
        `Sonderplattformen bis 40000: ${count((s) => s.kind === 'neutral' && s.special === 'moving')} beweglich, ` +
          `${count((s) => s.kind === 'neutral' && s.special === 'spring')} Federn, ` +
          `${count((s) => s.kind === 'neutral' && s.special === 'crumble')} bröselnd, ${count((s) => s.kind === 'berry')} Beeren`,
      );
    }
    if (run === 0) {
      const sample = rows.slice(0, 12).map((r) => (r.kind === 'row' ? `${Math.round(r.h)}: ${r.question.prompt} → [${r.question.options.join(', ')}]` : ''));
      console.log(`${direction}: ${rows.length} Reihen bis 40000, erste Reihe bei ${Math.round(first.h)}`);
      console.log(sample.join('\n'));
    }
  }
}
// Wiederholung falsch beantworteter Wörter
{
  seed = 42;
  const deck = new VocabDeck(entries, { direction: 'forward', repeatAfterRows: [3, 4], rng });
  const q = deck.next(2, 0, 1);
  deck.report(q.entry, false);
  const later = Array.from({ length: 6 }, () => deck.next(2, 0, 1).entry.id);
  const pos = later.indexOf(q.entry.id);
  if (pos < 2 || pos > 4) {
    problems++;
    console.log('Wiederholung nicht nach 3–4 Reihen:', q.entry.id, later);
  } else console.log(`Wiederholung: "${q.entry.source}" kommt nach ${pos} anderen Reihen wieder`);
}
// Lernstand: unsichere Wörter kommen über Runden häufiger dran
{
  seed = 7;
  const tracker = new ProgressTracker();
  const l1 = entries.filter((e) => (e.level ?? 1) === 1);
  const weak = l1[0].id;
  // alle anderen Level-1-Wörter gelten als sicher, ein Wort als unsicher
  for (const e of l1) for (let i = 0; i < 3; i++) tracker.record(e.id, true);
  tracker.record(weak, false);
  let hits = 0;
  const rounds = 200;
  for (let r = 0; r < rounds; r++) {
    const deck = new VocabDeck(entries, { direction: 'forward', repeatAfterRows: [3, 4], rng, progress: tracker });
    for (let i = 0; i < 5; i++) if (deck.next(2, 0, 1).entry.id === weak) hits++;
  }
  const fair = (rounds * 5) / l1.length;
  console.log(`Lernstand: unsicheres Wort ${hits}× in ${rounds} Runden (gleichmäßig wären ~${fair.toFixed(0)}×)`);
  if (hits < fair * 2) {
    problems++;
    console.log('unsicheres Wort kommt nicht häufiger dran');
  }
}
// Standard-Wortliste: Reihen bauen, Optionen eindeutig, Schrift nicht zu klein
{
  seed = 11;
  const std = (standard as { entries: VocabEntry[] }).entries;
  const deck = new VocabDeck(std, { direction: 'forward', repeatAfterRows: [3, 4], rng });
  const gen = new LevelGenerator(deck, rng);
  const specs: PlatformSpec[] = [gen.start(), ...gen.generateUpTo(60000)];
  const errs = checkReachability(specs);
  let minFont = 99;
  for (const r of specs) {
    if (r.kind !== 'row') continue;
    const o = r.question.options.map((x) => x.toLowerCase());
    if (new Set(o).size !== o.length) errs.push(`doppelte Optionen: ${o}`);
    const alts = new Set([r.question.answer, ...(r.question.entry.alternatives ?? [])].map((x) => x.toLowerCase()));
    const wrongButCorrect = o.filter((x) => x !== r.question.answer.toLowerCase() && alts.has(x));
    if (wrongButCorrect.length) errs.push(`Variante als Ablenker: ${r.question.prompt} → ${o}`);
    minFont = Math.min(minFont, r.layout.fontSize);
  }
  console.log(`Standardliste: ${std.length} Wörter, ${specs.filter((s) => s.kind === 'row').length} Reihen geprüft, kleinste Plankenschrift ${minFont}px`);
  if (errs.length) {
    problems += errs.length;
    console.log(errs.slice(0, 5));
  }
}
// Lernpfad: leichte Wörter zuerst, neue erst, wenn alte sicher sitzen
{
  seed = 21;
  const std = (standard as { entries: VocabEntry[] }).entries;
  const tracker = new ProgressTracker();
  const firstSeen: number[] = [];
  const seenIds = new Set<string>();
  let maxInWork = 0;
  for (let round = 0; round < 40; round++) {
    const deck = new VocabDeck(std, { direction: 'forward', repeatAfterRows: [3, 4], rng, progress: tracker, learningPath: { maxLearning: 15, reviewShare: 0.2 } });
    for (let i = 0; i < 20; i++) {
      const q = deck.next(2, 0);
      if (!seenIds.has(q.entry.id)) {
        seenIds.add(q.entry.id);
        firstSeen.push(q.entry.level ?? 1);
      }
      // simulierter Lerner: 85 % richtig
      deck.report(q.entry, rng() < 0.85);
      const st = tracker.stats(std.map((e) => e.id));
      maxInWork = Math.max(maxInWork, st.learning);
    }
  }
  const st = tracker.stats(std.map((e) => e.id));
  const first15 = firstSeen.slice(0, 15);
  console.log(`Lernpfad: nach 40 Runden ${st.known} sicher, ${st.learning} in Arbeit, ${seenIds.size} gesehen; Stufen der ersten 15: ${first15.join('')}; max. gleichzeitig in Arbeit: ${maxInWork}`);
  if (first15.some((l) => l > 1)) {
    problems++;
    console.log('Lernpfad beginnt nicht mit Stufe 1');
  }
  if (maxInWork > 16) {
    problems++;
    console.log('zu viele Wörter gleichzeitig in Arbeit');
  }
}
console.log(problems ? `FEHLER: ${problems}` : 'OK – alle Prüfungen bestanden');
process.exit(problems ? 1 : 0);
