import type Phaser from 'phaser';
import type { GameSettings, LocalPrefs } from '../config/settings';
import type { Tempo } from '../config/tuning';
import { THEMES, type ThemeId } from '../config/themes';
import type { Sfx } from '../audio/Sfx';
import type { Speech } from '../audio/Speech';
import { LocalProgressStore, ProgressTracker, type ProgressStore } from '../vocab/Progress';
import { BUILTIN_LIST, type WordListStore } from '../import/wordLists';
import type { RoundResult, VocabEntry, VocabFileMeta } from '../vocab/types';

/** Gemeinsamer Zustand aller Szenen (liegt in game.registry unter "ctx") */
export interface GameContext {
  settings: GameSettings;
  entries: VocabEntry[];
  meta: VocabFileMeta;
  prefs: LocalPrefs;
  tempo: Tempo;
  tilt: boolean;
  theme: ThemeId;
  sfx: Sfx;
  speech: Speech;
  progress: ProgressTracker;
  /** mitgelieferte Wortliste (aus createMustikkaHyppy) */
  builtin: { meta: VocabFileMeta; entries: VocabEntry[] };
  /** gespeicherte, importierte Wortlisten */
  lists: WordListStore;
  listId: string;
  listTitle: string;
  /** eigener Lernstand-Speicher der Lern-App (nur für die mitgelieferte Liste) */
  customProgressStore?: ProgressStore;
  debug: boolean;
  /** Test-Hilfe: Simulation beschleunigen (nur mit debug) */
  debugSpeed: number;
  parentEl: HTMLElement;
  onResult?: (r: RoundResult) => void;
  onExit?: () => void;
  lastResult?: RoundResult;
}

export const getCtx = (scene: Phaser.Scene): GameContext => scene.registry.get('ctx') as GameContext;

export function setTempo(scene: Phaser.Scene, t: Tempo): void {
  const ctx = getCtx(scene);
  ctx.tempo = t;
  ctx.prefs.setTempo(t);
  scene.game.events.emit('tempo-changed', t);
}

export function applyPageBackground(ctx: GameContext): void {
  ctx.parentEl.style.background = THEMES[ctx.theme].pageBackground;
}

export function setTheme(scene: Phaser.Scene, t: ThemeId): void {
  const ctx = getCtx(scene);
  ctx.theme = t;
  ctx.prefs.setTheme(t);
  applyPageBackground(ctx);
}

export function setSoundOn(scene: Phaser.Scene, on: boolean): void {
  const ctx = getCtx(scene);
  ctx.sfx.enabled = on;
  ctx.prefs.setBool('sound', on);
  if (on) ctx.sfx.unlock();
}

export function setSpeechOn(scene: Phaser.Scene, on: boolean): void {
  const ctx = getCtx(scene);
  ctx.speech.enabled = on;
  ctx.prefs.setBool('speech', on);
  if (!on) ctx.speech.cancel();
}

/** Wortliste aktivieren (mitgeliefert oder importiert) */
export function activateList(ctx: GameContext, id: string): void {
  const stored = id !== BUILTIN_LIST ? ctx.lists.load(id) : null;
  const listId = stored ? id : BUILTIN_LIST;
  const meta = stored ? stored.meta : ctx.builtin.meta;
  ctx.entries = stored ? stored.entries : ctx.builtin.entries;
  ctx.meta = meta;
  ctx.listId = listId;
  ctx.listTitle = stored ? stored.title : (ctx.builtin.meta.title ?? 'Beispiel-Wortschatz');
  if (meta.sourceLang) ctx.settings.sourceLang = meta.sourceLang;
  if (meta.targetLang) ctx.settings.targetLang = meta.targetLang;
  const prefix = ctx.settings.storagePrefix;
  const dir = ctx.settings.direction;
  const store =
    listId === BUILTIN_LIST
      ? (ctx.customProgressStore ?? new LocalProgressStore(`${prefix}.progress.${dir}`))
      : new LocalProgressStore(`${prefix}.progress.${listId}.${dir}`);
  ctx.progress = new ProgressTracker(store);
  ctx.speech.setLang(ctx.settings.targetLang);
  if (ctx.settings.allowImport) ctx.lists.setActive(listId);
}

export const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
