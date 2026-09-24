/**
 * Eigenständiges Testspiel. Einstellungen lassen sich per URL setzen, z. B.
 *   ?tempo=fast  ?direction=reverse  ?levels=1,2  ?categories=tiere,natur  ?theme=day  ?play (ohne Menü)  ?debug
 */
import { createMustikkaHyppy } from './index';
import type { Direction } from './config/settings';
import type { Tempo } from './config/tuning';
import type { ThemeId } from './config/themes';
// Standard-Wortliste: eigener Grundwortschatz Deutsch → Finnisch (frei, CC0)
import words from '../vocab/de-fi-grundwortschatz.json';
import type { VocabFile } from './vocab/types';

// Private Listen (vocab/privat/*.json) – werden nicht veröffentlicht (.gitignore),
// sind aber beim lokalen Start automatisch als weitere Liste dabei.
const privateLists = Object.entries(
  import.meta.glob('../vocab/privat/*.json', { eager: true, import: 'default' }) as Record<string, VocabFile>,
).map(([path, file]) => ({ id: `privat-${path.split('/').pop()!.replace(/\.json$/, '')}`, file }));

const q = new URLSearchParams(location.search);
const list = (k: string) => q.get(k)?.split(',').map((s) => s.trim()).filter(Boolean);

const instance = createMustikkaHyppy({
  parent: 'game',
  words: words as VocabFile,
  extraLists: privateLists,
  settings: {
    tempo: (q.get('tempo') as Tempo) || undefined,
    direction: (q.get('direction') as Direction) || 'forward',
    levels: list('levels')?.map(Number),
    categories: list('categories'),
    showMenu: !q.has('play'),
    theme: (q.get('theme') as ThemeId) || undefined,
  },
  debug: q.has('debug'),
  debugSpeed: Number(q.get('speed') ?? 1) || 1,
  onResult: (r) => console.info('[Mustikka Hyppy] Ergebnis', r),
});

if (q.has('debug')) (window as unknown as Record<string, unknown>).__game = instance.game;
