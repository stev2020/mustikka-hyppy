import Phaser from 'phaser';
import { ASSET_FILES, PLANK_WORD } from '../config/assets';
import { DEFAULT_ASSET_BASE } from '../config/assets';
import { DESIGN_H, DESIGN_W } from '../config/tuning';
import { getCtx } from '../game/context';
import { addSplinterFrames, createFxTextures } from '../render/fxTextures';
import { makeText, setupCamera } from '../render/ui';
import { THEMED_ASSETS } from '../config/themes';
import { queueTheme } from '../render/themeLoader';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    setupCamera(this);
    const ctx = getCtx(this);
    let base = ctx.settings.assetBaseUrl ?? DEFAULT_ASSET_BASE;
    if (base && !base.endsWith('/')) base += '/';
    this.load.setPath(base);

    const label = makeText(this, DESIGN_W / 2, DESIGN_H / 2, 'Lade …', { size: 34 });
    const bar = this.add.rectangle(DESIGN_W / 2 - 200, DESIGN_H / 2 + 60, 0, 12, 0x6fd58a).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => {
      bar.width = 400 * p;
      label.setText(`Lade … ${Math.round(p * 100)} %`);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error('[Mustikka Hyppy] Asset fehlt:', file.src);
    });

    // gemeinsame Grafiken + Hintergründe des gewählten Themas (Tag/Abend)
    for (const [key, path] of Object.entries(ASSET_FILES)) {
      if (!(THEMED_ASSETS as string[]).includes(key)) this.load.image(key, path);
    }
    queueTheme(this, ctx.theme);
  }

  create(): void {
    createFxTextures(this);
    addSplinterFrames(this, PLANK_WORD.key, PLANK_WORD.splinterRects);
    const ctx = getCtx(this);
    this.scene.start(ctx.settings.showMenu ? 'Menu' : 'Game');
  }
}
