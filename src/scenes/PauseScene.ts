import Phaser from 'phaser';
import { DEPTH, DESIGN_H, DESIGN_W } from '../config/tuning';
import { getCtx } from '../game/context';
import { tempoSelector } from '../render/tempoSelector';
import { audioToggles } from '../render/audioToggles';
import { dimmer, makeButton, makeText, panel, setupCamera } from '../render/ui';
import type { GameScene } from './GameScene';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    setupCamera(this);
    const ctx = getCtx(this);
    const game = this.scene.get('Game') as GameScene;
    const cx = DESIGN_W / 2;
    const top = DESIGN_H / 2 - 330;
    const h = ctx.settings.allowMenu || ctx.onExit ? 670 : 580;

    dimmer(this, 0.6).setDepth(DEPTH.overlay);
    panel(this, 60, top, DESIGN_W - 120, h, 34, 0.94).setDepth(DEPTH.overlay);
    const layer = this.add.container(0, 0).setDepth(DEPTH.overlay + 1);
    layer.add(makeText(this, cx, top + 70, 'Pause', { size: 56, weight: 900 }));
    layer.add(tempoSelector(this, cx, top + 200, 540));
    layer.add(audioToggles(this, cx, top + 290, 540));

    const resume = () => {
      this.scene.stop();
      this.scene.resume('Game');
    };
    layer.add(makeButton(this, cx, top + 395, 420, 80, 'Weiter', resume, { size: 34, color: 0x9be07a }).container);
    layer.add(
      makeButton(this, cx, top + 495, 420, 72, 'Neu starten', () => {
        game.endRound('quit');
        this.scene.stop();
        this.scene.stop('Game');
        this.scene.start('Game');
      }, { size: 28 }).container,
    );
    if (ctx.settings.allowMenu || ctx.onExit) {
      layer.add(
        makeButton(this, cx, top + 590, 420, 72, ctx.settings.allowMenu ? 'Hauptmenü' : 'Beenden', () => {
          game.endRound('quit');
          this.scene.stop('Game');
          if (ctx.settings.allowMenu) this.scene.start('Menu');
          else {
            this.scene.stop();
            ctx.onExit?.();
          }
        }, { size: 28 }).container,
      );
    }

    const kb = this.input.keyboard!;
    kb.once('keydown-ESC', resume);
    kb.once('keydown-P', resume);
    kb.once('keydown-ENTER', resume);
    kb.once('keydown-SPACE', resume);
  }
}
