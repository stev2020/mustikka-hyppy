/**
 * Spielkonstanten. Alle Maße in Design-Pixeln bei 720×1280 (Hochformat).
 * "Höhe" = Kletterhöhe, Start = 0, nach oben positiv.
 */

export const DESIGN_W = 720;
export const DESIGN_H = 1280;

// ---------------------------------------------------------------------------
// Tempo & Sprungphysik
// ---------------------------------------------------------------------------

export type Tempo = 'slow' | 'normal' | 'fast';
export const TEMPOS: Tempo[] = ['slow', 'normal', 'fast'];
export const TEMPO_LABELS: Record<Tempo, string> = { slow: 'Langsam', normal: 'Normal', fast: 'Schnell' };

/** maximale Sprunghöhe – unabhängig vom Tempo */
export const JUMP_HEIGHT = 230;

/** Flugzeit eines Sprungs (Absprung bis Rückkehr auf dieselbe Höhe) in Sekunden */
export const TEMPO_FLIGHT_TIME: Record<Tempo, number> = { slow: 1.2, normal: 0.95, fast: 0.75 };

/**
 * Seitliche Reichweite bei voller Seitwärtsgeschwindigkeit über eine ganze
 * Flugzeit. Die Seitwärtsgeschwindigkeit skaliert daher mit 1/T.
 */
export const LATERAL_REACH_PER_FLIGHT = 540;

/** Zeit (als Anteil von T), um von 0 auf volle Seitwärtsgeschwindigkeit zu kommen */
export const LATERAL_ACCEL_FRACTION = 0.1;

/** Schwierigkeit darf das Tempo höchstens um 15 % erhöhen */
export const MAX_SPEEDUP = 0.15;
/** Höhenbereich, in dem die Beschleunigung von 0 auf MAX_SPEEDUP steigt */
export const SPEEDUP_START = 1500;
export const SPEEDUP_FULL = 10000;

export interface Physics {
  T: number;
  gravity: number;
  jumpVelocity: number;
  maxVx: number;
  accel: number;
}

export function physicsFor(tempo: Tempo): Physics {
  const T = TEMPO_FLIGHT_TIME[tempo];
  const h = JUMP_HEIGHT;
  const maxVx = LATERAL_REACH_PER_FLIGHT / T;
  return {
    T,
    gravity: (8 * h) / (T * T),
    jumpVelocity: (4 * h) / T,
    maxVx,
    accel: maxVx / (LATERAL_ACCEL_FRACTION * T),
  };
}

/** Zeitfaktor ≥ 1: beschleunigt die Simulation mit der Höhe (max. +15 %). */
export function speedupAt(height: number): number {
  const t = Math.min(1, Math.max(0, (height - SPEEDUP_START) / (SPEEDUP_FULL - SPEEDUP_START)));
  return 1 + MAX_SPEEDUP * t;
}

/**
 * Horizontale Reichweite (Mitte zu Mitte) für einen Sprung auf eine
 * Plattform, die dy höher liegt. Tempo-unabhängig, weil vx·t konstant ist.
 * Enthält einen Sicherheitsabschlag.
 */
export function lateralReach(dy: number, safety = 0.85): number {
  const p = physicsFor('normal');
  if (dy >= JUMP_HEIGHT) return 0;
  const disc = p.jumpVelocity * p.jumpVelocity - 2 * p.gravity * dy;
  const t = (p.jumpVelocity + Math.sqrt(Math.max(0, disc))) / p.gravity;
  const accelLoss = (LATERAL_ACCEL_FRACTION * p.T) / 2;
  return Math.max(0, p.maxVx * (t - accelLoss) * safety);
}

// ---------------------------------------------------------------------------
// Kamera
// ---------------------------------------------------------------------------

/** Die Kamera folgt, sobald die Füße mehr als so hoch über dem unteren Rand sind. */
export const CAMERA_FOLLOW_OFFSET = 440;
/** So weit (Füße) unter dem unteren Bildrand = Game Over */
export const FALL_OUT_MARGIN = 60;

// ---------------------------------------------------------------------------
// Level-Erzeugung
// ---------------------------------------------------------------------------

export const LEVEL = {
  startPlatformHeight: 70,
  /** Abstand neutraler Plattformen (wächst leicht mit der Höhe) */
  gapMinStart: 100,
  gapMinEnd: 120,
  gapMaxStart: 150,
  gapMaxEnd: 180,
  gapRampHeight: 8000,
  /** neutrale Plattformen zwischen zwei Wortreihen (inkl. Absprungplattform) */
  neutralsBetweenRows: [6, 7] as [number, number],
  /** vor der ersten Reihe weniger, damit sie direkt sichtbar ist */
  neutralsBeforeFirstRow: 5,
  /** Absprungplattform → Wortreihe */
  rowLaunchGap: 150,
  /** Plattform vor der Absprungplattform → Absprungplattform (≤ 120: von überall erreichbar) */
  preLaunchGap: 112,
  /** Wortreihe → erste Plattform darüber (≤ 120: von jeder Planke aus erreichbar) */
  rowExitGap: 118,
  /** Sicherheitsabstand: nichts außer der Reihe darf von tiefer aus erreichbar sein */
  unreachableMargin: 20,
  /** erste Reihe mind. 250 px unter dem oberen Rand beim Start */
  firstRowMinFromTop: 250,
  /** Lookahead: so weit über den oberen Bildrand hinaus wird erzeugt */
  generateAhead: 500,
};

export const WORD_PLANK = {
  minWidth: 170,
  /** in Reihen mit 4 Optionen darf eine Planke schmaler werden, wenn es sonst nicht passt */
  minWidthTight: 150,
  paddingX: 26,
  fontSizeMax: 32,
  fontSizeMin: 20,
  minGap: 8,
  textColor: '#FFF6E1',
  strokeColor: '#32190E',
  strokeThickness: 7,
};

// ---------------------------------------------------------------------------
// Schwierigkeit
// ---------------------------------------------------------------------------

/**
 * Sonderplattformen und Heidelbeeren. Höhen in Design-Pixeln.
 * Alle Sonderfälle halten die Garantien des Level-Generators ein
 * (siehe LevelGenerator / checkReachability).
 */
export const SPECIALS = {
  /** bewegliche Plattformen (Teil des Wegs) */
  movingFrom: 1500,
  movingChance: [0.12, 0.32] as [number, number],
  /** Höhenabstand zu und von einer beweglichen Plattform (≤ 118: von überall erreichbar) */
  movingMaxGap: 118,
  movingAmp: [70, 190] as [number, number],
  /** Dauer einer Hin-und-her-Bewegung in Flugzeiten T (skaliert mit dem Tempo) */
  movingPeriodT: [2.6, 4.2] as [number, number],

  /** Sprungfedern (Teil des Wegs) */
  springFrom: 2500,
  springChance: 0.16,
  /** Sprunghöhe der Feder als Vielfaches der normalen Sprunghöhe */
  springFactor: 2.3,

  /** bröselnde Planken: Extra-Plattformen seitlich des Wegs, halten genau einen Sprung */
  crumbleFrom: 700,
  crumbleChance: [0.2, 0.38] as [number, number],
  crumbleOffset: [190, 300] as [number, number],

  /** Zone um Wortreihen, in der keine Extra-Plattform liegen darf (sonst ließe sich die Reihe überspringen) */
  rowSafeBelow: 250,
  rowSafeAbove: 110,

  /** Heidelbeeren */
  berryChance: 0.33,
  berryOnExtraChance: 0.57,
  berryOffset: [110, 250] as [number, number],
  berriesForHeart: 10,
  /** Punkte, wenn bei vollen Herzen 10 Beeren gesammelt werden */
  berryBonusPoints: 250,
  berryPoints: 10,
  /** Rampe für Wahrscheinlichkeiten: bei dieser Höhe ist der Höchstwert erreicht */
  rampHeight: 9000,
};

/**
 * Lernpfad: Wörter werden nach Schwierigkeit (level 1–5) eingeführt.
 * Es sind höchstens `maxLearning` Wörter gleichzeitig "in Arbeit"; ein neues
 * kommt erst dazu, wenn eines sicher sitzt (Fach ≥ 3, also 3× richtig in Folge).
 */
export const LEARNING = {
  maxLearning: 15,
  /** Anteil der Reihen, in denen sichere Wörter wiederholt werden */
  reviewShare: 0.2,
  levelNames: ['sehr leicht', 'leicht', 'mittel', 'schwer', 'sehr schwer'],
};

export const DIFFICULTY = {
  /** Anzahl Optionen je nach Höhe */
  optionsAt(height: number): number {
    if (height < 1500) return 2;
    if (height < 3600) return 3;
    return 4;
  },
  /** Ähnlichkeit der Ablenker: 0 = andere Kategorie, 1 = gleiche Kategorie, 2 = andere Form desselben Worts */
  similarityAt(height: number): 0 | 1 | 2 {
    if (height < 2500) return 0;
    if (height < 5500) return 1;
    return 2;
  },
  /** höchstes Vokabel-Level, das auf dieser Höhe abgefragt wird (Filter der Einstellungen bleibt bestehen) */
  maxLevelAt(height: number): number {
    if (height < 3000) return 1;
    if (height < 6500) return 2;
    return 99;
  },
  /** falsch beantwortete Wörter kommen nach so vielen Reihen wieder */
  repeatAfterRows: [3, 4] as [number, number],
};

export const SCORING = {
  correct: 100,
  /** Bonus je weiterer Option über 2 */
  perExtraOption: 25,
  /** Serienbonus: +10 % je richtige Antwort in Folge, max. ×2 */
  streakStep: 0.1,
  streakMax: 2,
};

export const HEARTS = 3;

/** Lautstärken: Soundeffekte vs. Aussprache (0 … 1, Effekte bis ca. 1.5) */
export const AUDIO = {
  sfxVolume: 1.25,
  speechVolume: 0.75,
};

/** Einblendung des neuen Worts in der Bildmitte */
export const ANNOUNCE = {
  /** Mitte der Einblendung (Design-Pixel, Bildschirm) – knapp über der Figur */
  y: 650,
  intro: 300,
  /** Standzeit: Grundwert + je Buchstabe, gedeckelt */
  holdBase: 850,
  holdPerChar: 35,
  holdMax: 1500,
  outro: 450,
  /** Lösung nach falscher Antwort */
  solutionHold: 1000,
};

// ---------------------------------------------------------------------------
// Welten & Hintergrund
// ---------------------------------------------------------------------------

export const WORLD_FADE = 420;

export interface LayerDef {
  key: string;
  f: number;
  /** optionale Lichtebene, die über dieser Ebene gezeichnet wird */
  glow?: string;
  /** Zeichenebene: 0 = far, 1 = mid, 2 = near */
  plane: 0 | 1 | 2;
}

export interface TiledWorldDef {
  name: string;
  start: number;
  end: number;
  layers: LayerDef[];
}

export const LAKE_LAYERS: LayerDef[] = [
  { key: 'lake_far', f: 0.35, plane: 0 },
  { key: 'lake_mid', f: 0.6, plane: 1, glow: 'lake_midglow' },
  { key: 'lake_near', f: 1.0, plane: 2, glow: 'lake_nearglow' },
];

export const TILED_WORLDS: TiledWorldDef[] = [
  {
    name: 'forest',
    start: 1100,
    end: 4700,
    layers: [
      { key: 'forest_far', f: 0.35, plane: 0 },
      { key: 'forest_mid', f: 0.6, plane: 1 },
      { key: 'forest_near', f: 1.0, plane: 2 },
    ],
  },
  {
    name: 'fjell',
    start: 4300,
    end: 8200,
    layers: [
      { key: 'fjell_mid', f: 0.6, plane: 1 },
      { key: 'fjell_near', f: 1.0, plane: 2 },
    ],
  },
];

export const SKY = {
  cloudsStart: 7400,
  cloudFactorMin: 0.75,
  cloudFactorMax: 0.95,
  cloudSpacingMin: 260,
  cloudSpacingMax: 520,
  cloudDriftMin: 6,
  cloudDriftMax: 22,
  moonStart: 6800,
  moonFade: 600,
  moonFactor: 0.08,
  starFactor: 0.04,
  starCount: 190,
};

/** Himmelsverlauf (oben / Mitte / unten) je Höhe; dazwischen stufenlos interpoliert */
export const SKY_GRADIENT: { h: number; top: number; mid: number; bottom: number }[] = [
  { h: 0, top: 0x121034, mid: 0x3a2868, bottom: 0xe89276 },
  { h: 2500, top: 0x100e32, mid: 0x2c2260, bottom: 0x785096 },
  { h: 5500, top: 0x0a0a26, mid: 0x1a1846, bottom: 0x3e3070 },
  { h: 8500, top: 0x050618, mid: 0x0e1030, bottom: 0x221e54 },
];

/** Zeichentiefen */
export const DEPTH = {
  sky: 0,
  stars: 1,
  aurora: 2,
  moon: 3,
  plane: [10, 20, 30] as const,
  clouds: 40,
  platforms: 50,
  fx: 55,
  player: 60,
  hud: 100,
  overlay: 200,
};
