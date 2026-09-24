import { TEMPOS, type Tempo } from './tuning';
import { THEME_IDS, type ThemeId } from './themes';

/** Richtung der Abfrage bezogen auf die Vokabeldatei: forward = source → target */
export type Direction = 'forward' | 'reverse';

export interface GameSettings {
  /** Sprache der Spalte "source" (z. B. "de") */
  sourceLang: string;
  /** Sprache der Spalte "target" (z. B. "fi") */
  targetLang: string;
  /** forward: source → target (DE→FI), reverse: target → source (FI→DE) */
  direction: Direction;
  /** nur diese Vokabel-Level (leer/undefined = alle) */
  levels?: number[];
  /** nur diese Kategorien (leer/undefined = alle) */
  categories?: string[];
  /** Tempo-Stufe; wenn gesetzt, überschreibt sie die gespeicherte Wahl */
  tempo?: Tempo;
  /** Neigungssteuerung auf Mobilgeräten */
  tilt?: boolean;
  /** Tageszeit/Farbstimmung: 'night' (Abend) oder 'day' (hell); überschreibt die gespeicherte Wahl */
  theme?: ThemeId;
  /** Soundeffekte (überschreibt die gespeicherte Wahl) */
  sound?: boolean;
  /** Aussprache der Zielwörter (überschreibt die gespeicherte Wahl) */
  pronunciation?: boolean;
  /** Startbildschirm zeigen (false = Runde startet sofort, z. B. eingebettet) */
  showMenu: boolean;
  /** "Menü"-Knopf im Game-Over/Pause-Bildschirm anzeigen */
  allowMenu: boolean;
  /** Wortlisten-Import (Anki) im Startmenü anbieten */
  allowImport: boolean;
  /** Basis-URL, unter der der Asset-Ordner erreichbar ist */
  assetBaseUrl?: string;
  /** Schlüssel-Präfix für lokale Speicherung */
  storagePrefix: string;
}

export const DEFAULT_SETTINGS: GameSettings = {
  sourceLang: 'de',
  targetLang: 'fi',
  direction: 'forward',
  showMenu: true,
  allowMenu: true,
  allowImport: true,
  storagePrefix: 'mustikka-hyppy',
};

export const LANGUAGE_NAMES: Record<string, string> = {
  de: 'Deutsch',
  fi: 'Finnisch',
  en: 'Englisch',
  sv: 'Schwedisch',
  et: 'Estnisch',
  fr: 'Französisch',
  es: 'Spanisch',
  it: 'Italienisch',
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

// ---------------------------------------------------------------------------
// Lokale Speicherung (fehlertolerant: private Fenster, WebViews ohne Storage …)
// ---------------------------------------------------------------------------

export interface Highscore {
  score: number;
  /** erreichte Höhe in m in dieser Runde */
  meters: number;
  /** höchste je erreichte Höhe in m (unabhängig von den Punkten) */
  bestMeters: number;
  date: string;
  tempo: string;
}

export class LocalPrefs {
  constructor(private prefix: string) {}

  private get(key: string): string | null {
    try {
      return window.localStorage.getItem(`${this.prefix}.${key}`);
    } catch {
      return null;
    }
  }

  private set(key: string, value: string): void {
    try {
      window.localStorage.setItem(`${this.prefix}.${key}`, value);
    } catch {
      /* ignorieren */
    }
  }

  getTempo(): Tempo | null {
    const v = this.get('tempo');
    return v && (TEMPOS as string[]).includes(v) ? (v as Tempo) : null;
  }

  setTempo(t: Tempo): void {
    this.set('tempo', t);
  }

  getTheme(): ThemeId | null {
    const v = this.get('theme');
    return v && (THEME_IDS as string[]).includes(v) ? (v as ThemeId) : null;
  }

  setTheme(t: ThemeId): void {
    this.set('theme', t);
  }

  getHighscore(): Highscore | null {
    try {
      const v = this.get('highscore');
      if (!v) return null;
      const h = JSON.parse(v) as Highscore;
      return typeof h.score === 'number' ? h : null;
    } catch {
      return null;
    }
  }

  setHighscore(h: Highscore): void {
    this.set('highscore', JSON.stringify(h));
  }

  getBool(key: string): boolean | null {
    const v = this.get(key);
    return v === null ? null : v === '1';
  }

  setBool(key: string, on: boolean): void {
    this.set(key, on ? '1' : '0');
  }

  getTilt(): boolean | null {
    const v = this.get('tilt');
    return v === null ? null : v === '1';
  }

  setTilt(on: boolean): void {
    this.set('tilt', on ? '1' : '0');
  }
}
