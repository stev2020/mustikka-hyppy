import Phaser from 'phaser';
import { DEPTH, DESIGN_H, DESIGN_W } from '../config/tuning';
import { getCtx } from '../game/context';
import { COLORS, dimmer, fitText, makeButton, makeText, panel, setupCamera } from '../render/ui';
import type { RoundResult } from '../vocab/types';

interface Data {
  result: RoundResult;
  wrong: { source: string; target: string }[];
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: Data): void {
    setupCamera(this);
    const ctx = getCtx(this);
    const { result, wrong } = data;
    const cx = DESIGN_W / 2;
    const showMenu = ctx.settings.allowMenu || !!ctx.onExit;

    dimmer(this, 0.62).setDepth(DEPTH.overlay);
    const top = 110;
    const bottom = DESIGN_H - 90;
    panel(this, 44, top, DESIGN_W - 88, bottom - top, 34, 0.95).setDepth(DEPTH.overlay);
    const L = this.add.container(0, 0).setDepth(DEPTH.overlay + 1);

    const learned = result.newlyKnown > 0 ? ` · ${result.newlyKnown} ${result.newlyKnown === 1 ? 'Wort' : 'Wörter'} neu gelernt` : '';
    const title = (result.endedBy === 'hearts' ? 'Keine Herzen mehr' : 'Abgestürzt!') + learned;
    L.add(makeText(this, cx, top + 70, 'Game Over', { size: 60, weight: 900 }));
    L.add(makeText(this, cx, top + 128, title, { size: 26, weight: 600, color: '#6b5f86', strokeThickness: 0 }));

    // Highscore
    if (result.newHighscore) {
      const hs = makeText(this, cx, top + 292, result.previousHighscore > 0 ? `Neuer Highscore! (vorher ${result.previousHighscore})` : 'Neuer Highscore!', { size: 30, weight: 900, color: '#d17a00', strokeThickness: 6 });
      L.add(hs);
      this.tweens.add({ targets: hs, scale: { from: 1, to: 1.08 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const sparks = this.add.particles(cx, top + 292, 'fx_dot', {
        lifespan: { min: 600, max: 1000 },
        speed: { min: 60, max: 180 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.45, end: 0 },
        tint: [0xffd27a, 0x4a64c8],
        blendMode: Phaser.BlendModes.NORMAL,
        frequency: 70,
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-200, -16, 400, 32) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
      });
      sparks.setDepth(DEPTH.overlay + 2);
    } else {
      const best = ctx.prefs.getHighscore();
      if (best && best.score > 0) L.add(makeText(this, cx, top + 292, `Highscore: ${best.score} Punkte`, { size: 24, weight: 700, color: '#d17a00', strokeThickness: 0 }));
    }

    const correct = result.answers.filter((a) => a.correct).length;
    const stats = [
      [`${result.score}`, 'Punkte'],
      [`${result.maxHeightMeters} m`, 'Höhe'],
      [`${correct}/${result.answers.length}`, 'richtig'],
    ];
    stats.forEach(([v, l], i) => {
      const x = cx + (i - 1) * 200;
      L.add(makeText(this, x, top + 205, v, { size: 44, weight: 900 }));
      L.add(makeText(this, x, top + 250, l, { size: 20, weight: 600, color: '#6b5f86', strokeThickness: 0 }));
    });

    // Liste der falsch beantworteten Wörter
    const listTop = top + 330;
    const g = this.add.graphics();
    g.fillStyle(0x2b2230, 0.06);
    g.fillRoundedRect(76, listTop, DESIGN_W - 152, 500, 22);
    L.add(g);
    if (wrong.length === 0) {
      L.add(makeText(this, cx, listTop + 60, result.answers.length ? 'Alles richtig – stark!' : 'Noch keine Wörter beantwortet.', { size: 28, weight: 700, color: '#2f8a45' }));
    } else {
      L.add(makeText(this, cx, listTop + 38, 'Nochmal üben:', { size: 26, weight: 800, color: '#d17a00' }));
      const maxRows = 8;
      wrong.slice(0, maxRows).forEach((w, i) => {
        const y = listTop + 92 + i * 48;
        const s = makeText(this, cx - 14, y, w.source, { size: 26, weight: 700 }).setOrigin(1, 0.5);
        const dash = makeText(this, cx, y, '→', { size: 22, weight: 700, color: '#6b5f86', strokeThickness: 0 });
        const t = makeText(this, cx + 14, y, w.target, { size: 26, weight: 800, color: '#2f8a45' }).setOrigin(0, 0.5);
        fitText(s, 250, 26, 18);
        fitText(t, 250, 26, 18);
        L.add([s, dash, t]);
      });
      if (wrong.length > maxRows) {
        L.add(makeText(this, cx, listTop + 92 + maxRows * 48 - 6, `… und ${wrong.length - maxRows} weitere`, { size: 20, weight: 600, color: COLORS.cream, strokeThickness: 0 }));
      }
    }

    const again = () => {
      this.scene.stop('Game');
      this.scene.start('Game');
    };
    const by = bottom - (showMenu ? 150 : 70);
    L.add(makeButton(this, cx, by, 420, 80, 'Nochmal', again, { size: 34, color: 0x9be07a }).container);
    if (showMenu) {
      L.add(
        makeButton(this, cx, by + 92, 420, 70, ctx.settings.allowMenu ? 'Hauptmenü' : 'Beenden', () => {
          this.scene.stop('Game');
          if (ctx.settings.allowMenu) this.scene.start('Menu');
          else {
            this.scene.stop();
            ctx.onExit?.();
          }
        }, { size: 28 }).container,
      );
    }
    this.input.keyboard?.once('keydown-ENTER', again);
    this.input.keyboard?.once('keydown-SPACE', again);

    L.setAlpha(0);
    this.tweens.add({ targets: L, alpha: 1, duration: 300 });
  }
}
