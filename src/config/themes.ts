import { ASSET_FILES, type AssetKey } from './assets';
import { SKY_GRADIENT } from './tuning';

/**
 * Aussehen des Spiels, beide im Kritzel-Stil (Grafiken aus
 * scripts/doodle/generate.py):
 * - "doodle": Filzstift auf hellem Karopapier
 * - "night": dunkles Nachtheft, heller Gelstift, leuchtende Hüttenfenster
 *   (Hintergründe in assets/night/, erzeugt mit `npm run doodle-assets`)
 * Figur und Planken sind in beiden Themen gleich.
 */
export type ThemeId = 'doodle' | 'night';
export const THEME_IDS: ThemeId[] = ['doodle', 'night'];

/** Ohne gespeicherte Wahl: dem hellen/dunklen Modus des Geräts folgen */
export function defaultTheme(): ThemeId {
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'night';
  } catch {
    /* egal */
  }
  return 'doodle';
}

export interface SkyStop {
  h: number;
  top: number;
  mid: number;
  bottom: number;
}

export interface Theme {
  id: ThemeId;
  label: string;
  /** Unterordner der umgefärbten Hintergründe ('' = Originale) */
  bgDir: string;
  sky: SkyStop[];
  /** Sterne (0 = keine, 1 = volle Dichte) */
  stars: number;
  /** Polarlicht-Stärke (0 = aus) */
  aurora: number;
  moon: boolean;
  sun: boolean;
  /** Deckkraft des Fensterscheins am See */
  windowGlow: number;
  /** Farbe der Ränder außerhalb des Spielfelds (CSS) */
  pageBackground: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  doodle: {
    id: 'doodle',
    label: 'Hell',
    bgDir: '',
    sky: SKY_GRADIENT,
    stars: 0.35,
    aurora: 0.8,
    moon: true,
    sun: false,
    windowGlow: 0,
    pageBackground: '#faf7ef',
  },
  night: {
    id: 'night',
    label: 'Dunkel',
    bgDir: 'night/',
    sky: SKY_GRADIENT,
    stars: 0.65,
    aurora: 1,
    moon: true,
    sun: false,
    windowGlow: 1,
    pageBackground: '#1c2042',
  },
};

/** Hintergründe, die es je Thema in eigener Farbfassung gibt */
export const THEMED_ASSETS: AssetKey[] = [
  'lake_far',
  'lake_mid',
  'lake_midglow',
  'lake_near',
  'lake_nearglow',
  'forest_far',
  'forest_mid',
  'forest_near',
  'fjell_mid',
  'fjell_near',
  'cloud1',
  'cloud2',
  'cloud3',
  'moon',
  'star',
  'paper',
];

const themedSet = new Set<string>(THEMED_ASSETS);

/** Textur-Schlüssel eines Assets im gewählten Thema */
export function texKey(key: string, theme: ThemeId): string {
  return themedSet.has(key) ? `${key}@${theme}` : key;
}

/** Dateipfad eines themenabhängigen Assets */
export function themedPath(key: AssetKey, theme: ThemeId): string {
  return THEMES[theme].bgDir + ASSET_FILES[key];
}
