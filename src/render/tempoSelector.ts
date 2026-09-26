import Phaser from 'phaser';
import { TEMPOS, TEMPO_LABELS, type Tempo } from '../config/tuning';
import { getCtx, setTempo } from '../game/context';
import { COLORS, makeButton, makeText, type Button } from './ui';

/** Drei Knöpfe Langsam / Normal / Schnell, zentriert um x */
export function tempoSelector(scene: Phaser.Scene, x: number, y: number, width = 600): Phaser.GameObjects.Container {
  const ctx = getCtx(scene);
  const c = scene.add.container(0, 0);
  c.add(makeText(scene, x, y - 58, 'Tempo', { size: 26, weight: 700, color: COLORS.muted, strokeThickness: 0 }));
  const bw = (width - 2 * 16) / 3;
  const buttons: Button[] = [];
  const refresh = () => buttons.forEach((b, i) => b.setActive(TEMPOS[i] === getCtx(scene).tempo));
  TEMPOS.forEach((t: Tempo, i) => {
    const b = makeButton(scene, x - width / 2 + bw / 2 + i * (bw + 16), y, bw, 64, TEMPO_LABELS[t], () => {
      setTempo(scene, t);
      refresh();
    }, { size: 26 });
    buttons.push(b);
    c.add(b.container);
  });
  refresh();
  // Pfeiltasten wechseln die Stufe
  const kb = scene.input.keyboard;
  const shift = (d: number) => {
    const i = TEMPOS.indexOf(ctx.tempo);
    const n = Phaser.Math.Clamp(i + d, 0, TEMPOS.length - 1);
    if (n !== i) {
      setTempo(scene, TEMPOS[n]);
      refresh();
    }
  };
  kb?.on('keydown-LEFT', () => shift(-1));
  kb?.on('keydown-RIGHT', () => shift(1));
  return c;
}
