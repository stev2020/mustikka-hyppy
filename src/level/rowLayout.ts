import { DESIGN_W, WORD_PLANK } from '../config/tuning';

export const PLANK_FONT_FAMILY = `"Patrick Hand", "Comic Sans MS", "Segoe Print", system-ui, sans-serif`;

let measureCtx: CanvasRenderingContext2D | null = null;

export function measureText(text: string, fontSize: number, weight = 400): number {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * fontSize * 0.6;
  measureCtx.font = `${weight} ${fontSize}px ${PLANK_FONT_FAMILY}`;
  return measureCtx.measureText(text).width;
}

export interface PlankSlot {
  x: number; // Mitte
  w: number;
}

export interface RowLayout {
  fontSize: number;
  planks: PlankSlot[];
  /** Mittelpunkte der Lücken zwischen den Planken (für die Absprungplattform) */
  gapCenters: number[];
}

/**
 * Legt 2–4 Wortplanken nebeneinander auf eine Reihe (volle Breite,
 * gleichmäßige Abstände). Breite je Planke passt sich dem Wort an; wird es
 * zu eng, wird die Schrift gemeinsam verkleinert.
 */
export function layoutRow(texts: string[]): RowLayout {
  const n = texts.length;
  const pad = WORD_PLANK.paddingX;
  let fontSize = WORD_PLANK.fontSizeMax;
  let minW = WORD_PLANK.minWidth;
  let widths: number[] = [];

  for (;;) {
    widths = texts.map((t) => Math.max(minW, Math.ceil(measureText(t, fontSize) + 2 * pad + WORD_PLANK.strokeThickness)));
    const total = widths.reduce((a, b) => a + b, 0) + (n + 1) * WORD_PLANK.minGap;
    if (total <= DESIGN_W) break;
    if (minW > WORD_PLANK.minWidthTight) {
      minW = Math.max(WORD_PLANK.minWidthTight, minW - 5);
      continue;
    }
    if (fontSize > WORD_PLANK.fontSizeMin) {
      fontSize -= 1;
      continue;
    }
    // Notfall: proportional stauchen (Text wird in der Planke ggf. horizontal skaliert)
    const avail = DESIGN_W - (n + 1) * WORD_PLANK.minGap;
    const sum = widths.reduce((a, b) => a + b, 0);
    widths = widths.map((w) => Math.floor((w * avail) / sum));
    break;
  }

  const sum = widths.reduce((a, b) => a + b, 0);
  const gap = (DESIGN_W - sum) / (n + 1);
  const planks: PlankSlot[] = [];
  const gapCenters: number[] = [];
  let x = gap;
  for (let i = 0; i < n; i++) {
    planks.push({ x: x + widths[i] / 2, w: widths[i] });
    x += widths[i];
    if (i < n - 1) gapCenters.push(x + gap / 2);
    x += gap;
  }
  return { fontSize, planks, gapCenters };
}
