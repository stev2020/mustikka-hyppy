/**
 * Aufräumen von Anki-Feldern und Erkennen der Sprachen.
 * Läuft ohne DOM (auch im Prüfskript unter Node).
 */

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  shy: '',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  aring: 'å',
  Aring: 'Å',
  szlig: 'ß',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/** alle Zeilen eines Feldes ohne HTML, Audio, Cloze-Klammern */
export function fieldLines(raw: string): string[] {
  let s = raw
    .replace(/\[sound:[^\]]*\]/gi, ' ')
    .replace(/\{\{c\d+::(.*?)(::[^}]*)?\}\}/g, '$1')
    .replace(/<br\s*\/?>|<\/?(div|p|li|ul|ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** erste Zeile eines Feldes, bereinigt */
export function cleanField(raw: string): string {
  return fieldLines(raw)[0] ?? '';
}

/**
 * Antwort für eine Planke: das ganze Feld, wenn es kurz genug ist; sonst die erste
 * von mehreren durch Komma/Semikolon getrennten Varianten. Alle Varianten gelten als richtig.
 */
export function splitAnswer(text: string, maxLen: number): { display: string; alternatives: string[] } | null {
  const parts = text
    .split(/\s*[;,]\s*|\s+\/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const alternatives = parts.length > 1 ? parts : [];
  if (text.length <= maxLen) return { display: text, alternatives };
  const first = parts[0];
  if (first && first.length <= maxLen) return { display: first, alternatives };
  return null;
}

// ---------------------------------------------------------------------------
// Spracherkennung (grob, reicht zum Vorbelegen – im Dialog änderbar)
// ---------------------------------------------------------------------------

const FI_RE = /[äöÄÖ]|\b\w*(ssa|ssä|sta|stä|lla|llä|lta|ltä|lle|nen|ksi|aan|ään|ssaan|mme|tte|vat|vät|taa|tää)\b|(aa|ee|ii|oo|uu|yy|ää|öö|kk|pp|tt)/gi;
const EN_RE = /\b(the|to|a|an|is|are|you|of|and|it|in|on|what|how|my|your|he|she|we|they|this|that|with|for|be)\b/gi;
const DE_RE = /\b(der|die|das|den|dem|ein|eine|einen|ist|sind|und|nicht|ich|du|er|wir|ihr|zu|mit|für|von|im|am|wie|was)\b|[ßüÜ]/gi;
const SV_RE = /\b(och|att|det|en|ett|jag|du|är|inte|på|med|för|av)\b|[åÅ]/gi;

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

export function languageScores(texts: string[]): Record<'fi' | 'en' | 'de' | 'sv', number> {
  const all = texts.join('\n');
  return {
    fi: count(all, FI_RE),
    en: count(all, EN_RE),
    de: count(all, DE_RE),
    sv: count(all, SV_RE),
  };
}

/** welche Sprache (außer Finnisch) passt am besten? */
export function guessOtherLanguage(texts: string[]): string {
  const s = languageScores(texts);
  const best = (['en', 'de', 'sv'] as const).reduce((a, b) => (s[b] > s[a] ? b : a), 'en' as 'en' | 'de' | 'sv');
  return best;
}

/** Index des Feldes, das am ehesten Finnisch ist */
export function guessFinnishField(columns: string[][]): number {
  let best = 0;
  let bestScore = -Infinity;
  columns.forEach((col, i) => {
    const s = languageScores(col.slice(0, 300));
    const score = s.fi - 1.5 * (s.en + s.de + s.sv);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** einfacher, stabiler Hash für IDs (z. B. bei Textdateien ohne Noten-ID) */
export function hashId(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
