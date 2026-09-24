import Phaser from 'phaser';
import { DEFAULT_SETTINGS, LocalPrefs, type GameSettings } from '../config/settings';
import { DESIGN_H, DESIGN_W, TEMPOS, type Tempo } from '../config/tuning';
import { BootScene } from '../scenes/BootScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { GameScene } from '../scenes/GameScene';
import { MenuScene } from '../scenes/MenuScene';
import { PauseScene } from '../scenes/PauseScene';
import { ImportScene } from '../scenes/ImportScene';
import { StatsScene } from '../scenes/StatsScene';
import { normalizeVocabFile, type RoundResult, type VocabFile } from '../vocab/types';
import { activateList, applyPageBackground, setTempo, type GameContext } from './context';
import { BUILTIN_LIST, WordListStore } from '../import/wordLists';
import { Sfx } from '../audio/Sfx';
import { Speech, type SpeakFn } from '../audio/Speech';
import { LocalProgressStore, ProgressTracker, type ProgressStore } from '../vocab/Progress';
import { THEME_IDS, type ThemeId } from '../config/themes';
import { installOrientationGuard, isTouchDevice } from './orientation';

export interface MustikkaHyppyOptions {
  /** Element (oder dessen id), in das das Spiel gerendert wird */
  parent: HTMLElement | string;
  /** Wortliste: Array von Einträgen oder { meta, entries } */
  words: VocabFile;
  /** Einstellungen (Sprache, Richtung, Level, Kategorien, Tempo …) */
  settings?: Partial<GameSettings>;
  /** wird am Ende jeder Runde mit dem Ergebnis aufgerufen */
  onResult?: (result: RoundResult) => void;
  /** "Beenden" gedrückt (nur wenn allowMenu = false) */
  onExit?: () => void;
  /** Debug-Anzeige + Autopilot (Taste B), nur für Entwicklung */
  debug?: boolean;
  debugSpeed?: number;
  /** eigene Sprachausgabe (z. B. Capacitor-Plugin auf Android); sonst Web Speech API */
  speak?: SpeakFn;
  /** eigener Speicher für den Lernstand (z. B. Lernprofil der App); sonst localStorage */
  progressStore?: ProgressStore;
  /** weitere mitgelieferte Wortlisten (erscheinen neben der Standardliste in der Listenwahl) */
  extraLists?: { id: string; file: VocabFile }[];
}

export interface MustikkaHyppyInstance {
  game: Phaser.Game;
  setTempo(t: Tempo): void;
  pause(): void;
  resume(): void;
  /** Ergebnis der letzten beendeten Runde */
  lastResult(): RoundResult | undefined;
  destroy(): void;
}

export function createMustikkaHyppy(opts: MustikkaHyppyOptions): MustikkaHyppyInstance {
  const parentEl = typeof opts.parent === 'string' ? document.getElementById(opts.parent) : opts.parent;
  if (!parentEl) throw new Error('Mustikka Hyppy: parent-Element nicht gefunden');

  const settings: GameSettings = { ...DEFAULT_SETTINGS, ...opts.settings };
  const { meta, entries } = normalizeVocabFile(opts.words);
  if (meta.sourceLang && !opts.settings?.sourceLang) settings.sourceLang = meta.sourceLang;
  if (meta.targetLang && !opts.settings?.targetLang) settings.targetLang = meta.targetLang;
  if (entries.length < 2) throw new Error('Mustikka Hyppy: mindestens 2 Vokabeln nötig');

  const prefs = new LocalPrefs(settings.storagePrefix);
  const tempo: Tempo = settings.tempo && TEMPOS.includes(settings.tempo) ? settings.tempo : prefs.getTempo() ?? 'normal';
  if (settings.tempo) prefs.setTempo(tempo);
  const theme: ThemeId = settings.theme && THEME_IDS.includes(settings.theme) ? settings.theme : prefs.getTheme() ?? 'night';
  if (settings.theme) prefs.setTheme(theme);

  const ctx: GameContext = {
    settings,
    entries,
    meta,
    prefs,
    tempo,
    tilt: settings.tilt ?? prefs.getTilt() ?? false,
    theme,
    sfx: new Sfx(settings.sound ?? prefs.getBool('sound') ?? true),
    speech: new Speech(settings.pronunciation ?? prefs.getBool('speech') ?? true, settings.targetLang, opts.speak),
    progress: new ProgressTracker(opts.progressStore ?? new LocalProgressStore(`${settings.storagePrefix}.progress.${settings.direction}`)),
    builtin: { meta, entries },
    lists: new WordListStore(settings.storagePrefix),
    listId: BUILTIN_LIST,
    listTitle: meta.title ?? 'Beispiel-Wortschatz',
    customProgressStore: opts.progressStore,
    debug: !!opts.debug,
    debugSpeed: opts.debugSpeed ?? 1,
    parentEl,
    onResult: opts.onResult,
    onExit: opts.onExit,
  };

  applyPageBackground(ctx);
  if (settings.allowImport) for (const x of opts.extraLists ?? []) registerExtraList(ctx, x.id, x.file);
  // zuletzt gewählte (importierte) Wortliste
  if (settings.allowImport) activateList(ctx, ctx.lists.getActive());

  // Audio darf erst nach einer Nutzeraktion starten
  const unlock = () => ctx.sfx.unlock();
  parentEl.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // HiDPI: intern mit höherer Auflösung rendern, Kamera zoomt auf Design-Koordinaten
  const rect = parentEl.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  let rw = rect.width || DESIGN_W;
  let rh = rect.height || DESIGN_H;
  // Handy: immer fürs Hochformat rechnen (auch wenn die Seite quer geöffnet wurde)
  if (isTouchDevice() && rw > rh) [rw, rh] = [rh, rw];
  const fit = Math.min(rw / DESIGN_W, rh / DESIGN_H);
  const k = Phaser.Math.Clamp(Math.round(fit * dpr * 4) / 4, 1, 2.5);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentEl,
    width: Math.round(DESIGN_W * k),
    height: Math.round(DESIGN_H * k),
    backgroundColor: '#0b0a22',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: 'high-performance',
    },
    input: { activePointers: 3 },
    audio: { noAudio: true },
    disableContextMenu: true,
    banner: false,
    scene: [BootScene, MenuScene, GameScene, PauseScene, GameOverScene, ImportScene, StatsScene],
    callbacks: {
      preBoot: (g) => g.registry.set('ctx', ctx),
    },
  });

  // Handy: nur Hochformat; nach dem Drehen sauber neu einpassen
  const removeOrientationGuard = installOrientationGuard(game, parentEl, () => {
    if (game.scene.isActive('Game') && !game.scene.isActive('Pause')) {
      game.scene.pause('Game');
      game.scene.run('Pause');
    }
  });

  return {
    game,
    setTempo(t: Tempo) {
      const scene = game.scene.getScenes(true)[0] ?? game.scene.getScene('Boot');
      if (scene) setTempo(scene, t);
      else ctx.tempo = t;
    },
    pause() {
      const g = game.scene.getScene('Game');
      if (g && game.scene.isActive('Game')) {
        game.scene.pause('Game');
        game.scene.run('Pause');
      }
    },
    resume() {
      if (game.scene.isActive('Pause')) {
        game.scene.stop('Pause');
        game.scene.resume('Game');
      }
    },
    lastResult: () => ctx.lastResult,
    destroy() {
      parentEl.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      removeOrientationGuard();
      ctx.speech.cancel();
      ctx.sfx.suspend();
      game.destroy(true);
    },
  };
}

/**
 * Mitgelieferte Zusatzliste in den Listenspeicher legen (bei jedem Start aktualisiert).
 * Beim ersten Mal wird sie aktiv, und passender Lernstand aus der Standardliste
 * (gleiche Wort-IDs, z. B. als die Liste noch Standard war) wird übernommen.
 */
function registerExtraList(ctx: GameContext, id: string, file: VocabFile): void {
  const { meta, entries } = normalizeVocabFile(file);
  if (entries.length < 2) return;
  const isNew = !ctx.lists.load(id);
  ctx.lists.save({ id, title: meta.title ?? id, count: entries.length, meta, entries, importedAt: new Date().toISOString() });
  if (!isNew) return;
  const prefix = ctx.settings.storagePrefix;
  const ids = new Set(entries.map((e) => e.id));
  for (const dir of ['forward', 'reverse']) {
    const from = new LocalProgressStore(`${prefix}.progress.${dir}`);
    const to = new LocalProgressStore(`${prefix}.progress.${id}.${dir}`);
    const old = from.load();
    const mine = Object.fromEntries(Object.entries(old).filter(([k]) => ids.has(k)));
    if (Object.keys(mine).length && !Object.keys(to.load()).length) to.save(mine);
  }
  if (ctx.lists.getActive() === BUILTIN_LIST) ctx.lists.setActive(id);
}
