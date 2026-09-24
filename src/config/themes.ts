import { ASSET_FILES, type AssetKey } from './assets';
import { SKY_GRADIENT } from './tuning';

/**
 * Themen (Tageszeiten). "night" ist die ursprüngliche Abendstimmung,
 * "day" eine helle Variante mit umgefärbten Hintergründen aus assets/day/
 * (erzeugt mit `npm run day-assets`).
 */
export type ThemeId = 'night' | 'day';
export const THEME_IDS: ThemeId[] = ['night', 'day'];

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
  night: {
    id: 'night',
    label: 'Abend',
    bgDir: '',
    sky: SKY_GRADIENT,
    stars: 1,
    aurora: 1,
    moon: true,
    sun: false,
    windowGlow: 1,
    pageBackground: '#0b0a22',
  },
  day: {
    id: 'day',
    label: 'Tag',
    bgDir: 'day/',
    sky: [
      { h: 0, top: 0x5aa6e8, mid: 0x9ed0f5, bottom: 0xe6f4ff },
      { h: 2500, top: 0x4e9be3, mid: 0x8ec6f2, bottom: 0xd2ecfd },
      { h: 5500, top: 0x3f8bdb, mid: 0x7db7ee, bottom: 0xbfe1fb },
      { h: 8500, top: 0x2f78cf, mid: 0x6aa8e8, bottom: 0xaed7f7 },
    ],
    stars: 0,
    aurora: 0,
    moon: false,
    sun: true,
    windowGlow: 0.3,
    pageBackground: '#4f8fd0',
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
