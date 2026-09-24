import Phaser from 'phaser';
import { getCtx, setSoundOn, setSpeechOn } from '../game/context';
import { makeButton } from './ui';

/** Zwei Schalter nebeneinander: Sound an/aus und Aussprache an/aus */
export function audioToggles(scene: Phaser.Scene, x: number, y: number, width: number): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const bw = (width - 16) / 2;
  const soundLabel = () => `Sound: ${getCtx(scene).sfx.enabled ? 'an' : 'aus'}`;
  const speechLabel = () => {
    const s = getCtx(scene).speech;
    if (!s.supported) return 'Aussprache: –';
    if (!s.enabled) return 'Aussprache: aus';
    return s.hasVoice ? 'Aussprache: an' : 'Aussprache: keine Stimme';
  };

  const sound = makeButton(scene, x - width / 2 + bw / 2, y, bw, 54, soundLabel(), () => {
    setSoundOn(scene, !getCtx(scene).sfx.enabled);
    sound.setLabel(soundLabel());
    sound.setActive(getCtx(scene).sfx.enabled);
  }, { size: 22 });
  sound.setActive(getCtx(scene).sfx.enabled);

  const speech = makeButton(scene, x + width / 2 - bw / 2, y, bw, 54, speechLabel(), () => {
    const ctx = getCtx(scene);
    setSpeechOn(scene, !ctx.speech.enabled);
    speech.setLabel(speechLabel());
    speech.setActive(ctx.speech.enabled && ctx.speech.hasVoice);
    // kurze Hörprobe
    if (ctx.speech.enabled) ctx.speech.speak('Mustikka');
  }, { size: 22 });
  speech.setActive(getCtx(scene).speech.enabled && getCtx(scene).speech.hasVoice);

  // Stimmen laden im Browser oft verzögert
  const off = getCtx(scene).speech.onVoicesChanged(() => {
    speech.setLabel(speechLabel());
    speech.setActive(getCtx(scene).speech.enabled && getCtx(scene).speech.hasVoice);
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);

  c.add([sound.container, speech.container]);
  return c;
}
