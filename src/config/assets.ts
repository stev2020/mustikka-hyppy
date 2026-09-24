/**
 * Zentrale Asset-Liste. Wer Grafiken austauscht, ändert nur diese Datei:
 * Dateipfade (relativ zur Asset-Basis-URL) und die Bildgeometrie, die die
 * Spiellogik braucht (Anker, Laufflächen, 9-Slice-Ränder).
 */

export const ASSET_FILES = {
  // Figur
  berry_idle: 'character/berry_idle.png',
  berry_jump: 'character/berry_jump.png',
  berry_land: 'character/berry_land.png',
  berry_hurt: 'character/berry_hurt.png',

  // Plattformen
  plank_word: 'platforms/plank_word.png',
  plank_snow: 'platforms/plank_snow.png',

  // Welt 1: See
  lake_far: 'bg/lake/far.png',
  lake_mid: 'bg/lake/mid.png',
  lake_midglow: 'bg/lake/midglow.png',
  lake_near: 'bg/lake/near.png',
  lake_nearglow: 'bg/lake/nearglow.png',

  // Welt 2: Wald (kachelbar)
  forest_far: 'bg/forest/far_tile.png',
  forest_mid: 'bg/forest/mid_tile.png',
  forest_near: 'bg/forest/near_tile.png',

  // Welt 3: Fjell (kachelbar)
  fjell_mid: 'bg/fjell/mid_tile.png',
  fjell_near: 'bg/fjell/near_tile.png',

  // Welt 4: Himmel
  cloud1: 'bg/sky/cloud1.png',
  cloud2: 'bg/sky/cloud2.png',
  cloud3: 'bg/sky/cloud3.png',
  moon: 'bg/sky/moon.png',
} as const;

export type AssetKey = keyof typeof ASSET_FILES;

/** Figur: 512×512, Unterkante bei y = 450, horizontal mittig. */
export const CHARACTER = {
  frames: { idle: 'berry_idle', jump: 'berry_jump', land: 'berry_land', hurt: 'berry_hurt' } as const,
  sourceSize: 512,
  footY: 450,
  /** Höhe der Idle-Figur im Bild (Oberkante 85 → Unterkante 450). */
  bodyHeight: 365,
  /** gewünschte Darstellungshöhe im Spiel (Design-Pixel) */
  displayHeight: 100,
  /** halbe Breite der "Füße" für die Landeprüfung (Design-Pixel) */
  footHalfWidth: 24,
};

/** Wortplanke: 890×226, dicke Planke ohne Schnee, 9-Slice (links/rechts fest). */
export const PLANK_WORD = {
  key: 'plank_word' as const,
  width: 890,
  height: 226,
  sliceLeft: 90,
  sliceRight: 90,
  /** Oberkante der Holzfläche im Bild (Lauffläche) */
  surfaceY: 14,
  /** Darstellungshöhe im Spiel */
  displayHeight: 62,
  /** Bereiche im Bild, aus denen Holzsplitter-Partikel geschnitten werden */
  splinterRects: [
    { x: 140, y: 40, w: 90, h: 16 },
    { x: 320, y: 90, w: 70, h: 14 },
    { x: 520, y: 140, w: 110, h: 18 },
    { x: 700, y: 60, w: 60, h: 12 },
    { x: 250, y: 170, w: 50, h: 20 },
  ],
};

/** Neutrale Schneeplanke: 894×153. */
export const PLANK_SNOW = {
  key: 'plank_snow' as const,
  width: 894,
  height: 153,
  /** Lauffläche: etwas in den Schnee hinein */
  surfaceY: 30,
  displayWidth: 150,
};

/** Wolken ca. 562×180, Mond 406×406 */
export const SKY_ASSETS = {
  clouds: ['cloud1', 'cloud2', 'cloud3'] as const,
  moon: 'moon' as const,
  moonDisplaySize: 180,
};

/** Standard-Basis-URL der Assets (Vite liefert ./assets als Wurzel aus). */
export const DEFAULT_ASSET_BASE: string = import.meta.env?.BASE_URL ?? './';
