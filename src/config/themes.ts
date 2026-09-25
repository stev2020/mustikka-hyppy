import { ASSET_FILES, type AssetKey } from './assets';
import { SKY_GRADIENT } from './tuning';

/**
 * Aussehen des Spiels. Seit dem Kritzel-Umbau gibt es nur noch ein Thema:
 * alles wie mit Filzstift ins karierte Schulheft gezeichnet (Grafiken aus
 * scripts/doodle/generate.py). Die Struktur bleibt, damit später weitere
 * Themen dazukommen können.
 */
export type ThemeId = 'doodle';
export const THEME_IDS: ThemeId[] = ['doodle'];

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
    label: 'Kritzel',
    bgDir: '',
    sky: SKY_GRADIENT,
    stars: 0.35,
    aurora: 0.8,
    moon: true,
    sun: false,
    windowGlow: 0,
    pageBackground: '#faf7ef',
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
