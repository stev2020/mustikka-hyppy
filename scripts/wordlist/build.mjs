// Baut vocab/de-fi-grundwortschatz.json aus scripts/wordlist/grundwortschatz.txt
//   npm run wordlist
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const lines = readFileSync(here('./grundwortschatz.txt'), 'utf8').split(/\r?\n/);
const MAX = 24;
const entries = [];
const seenTarget = new Map();
const seenSource = new Map();
const problems = [];
let category = '';

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

lines.forEach((raw, i) => {
  const line = raw.trim();
  if (!line) return;
  if (line.startsWith('## ')) {
    category = line.slice(3).trim();
    return;
  }
  if (line.startsWith('#')) return;
  const [lv, source, target, alts] = line.split('|').map((s) => s?.trim());
  const level = Number(lv);
  if (!(level >= 1 && level <= 5) || !source || !target) {
    problems.push(`Zeile ${i + 1}: unvollständig: ${line}`);
    return;
  }
  if (target.length > MAX) problems.push(`Zeile ${i + 1}: zu lang (${target.length}): ${target}`);
  const tk = target.toLowerCase();
  if (seenTarget.has(tk)) problems.push(`Zeile ${i + 1}: doppelt (fi) „${target}“ – auch Zeile ${seenTarget.get(tk)}`);
  seenTarget.set(tk, i + 1);
  const sk = source.toLowerCase();
  if (seenSource.has(sk)) problems.push(`Zeile ${i + 1}: doppelt (de) „${source}“ – auch Zeile ${seenSource.get(sk)}`);
  seenSource.set(sk, i + 1);
  let id = `gw-${slug(target)}`;
  while (entries.some((e) => e.id === id)) id += '-2';
  const e = { id, source, target, category, level };
  const alternatives = alts ? alts.split(';').map((s) => s.trim()).filter(Boolean) : [];
  if (alternatives.length) e.alternatives = alternatives;
  entries.push(e);
});

// Varianten dürfen der Antwort eines anderen Eintrags entsprechen (z. B. lernen → opiskella):
// das Spiel bietet sie dann nie als falsche Antwort an.

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const file = {
  meta: {
    title: 'Finnisch Grundwortschatz',
    sourceLang: 'de',
    targetLang: 'fi',
    license: 'CC0-1.0',
  },
  entries,
};
writeFileSync(here('../../vocab/de-fi-grundwortschatz.json'), JSON.stringify(file, null, 1) + '\n');
const byLevel = [1, 2, 3, 4, 5].map((l) => entries.filter((e) => e.level === l).length);
console.log(`${entries.length} Wörter, Stufen 1–5: ${byLevel.join(' / ')}`);
