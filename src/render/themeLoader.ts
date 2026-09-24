import Phaser from 'phaser';
import { DEFAULT_ASSET_BASE } from '../config/assets';
import { THEMED_ASSETS, THEME_IDS, texKey, themedPath, type ThemeId } from '../config/themes';
import { getCtx } from '../game/context';

export function assetBase(scene: Phaser.Scene): string {
  let base = getCtx(scene).settings.assetBaseUrl ?? DEFAULT_ASSET_BASE;
  if (base && !base.endsWith('/')) base += '/';
  return base;
}

/** Hintergründe eines Themas in die Ladeliste setzen (nur fehlende) */
export function queueTheme(scene: Phaser.Scene, theme: ThemeId): number {
  let n = 0;
  scene.load.setPath(assetBase(scene));
  for (const key of THEMED_ASSETS) {
    const k = texKey(key, theme);
    if (scene.textures.exists(k)) continue;
    scene.load.image(k, themedPath(key, theme));
    n++;
  }
  return n;
}

/** Thema nachladen (z. B. nach Umschalten im Menü) */
export function loadTheme(scene: Phaser.Scene, theme: ThemeId): Promise<void> {
  return new Promise((resolve) => {
    if (queueTheme(scene, theme) === 0) return resolve();
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

/** Texturen der anderen Themen freigeben (Speicher auf Mobilgeräten) */
export function freeOtherThemes(scene: Phaser.Scene, keep: ThemeId): void {
  for (const id of THEME_IDS) {
    if (id === keep) continue;
    for (const key of THEMED_ASSETS) {
      const k = texKey(key, id);
      if (scene.textures.exists(k)) scene.textures.remove(k);
    }
  }
}
