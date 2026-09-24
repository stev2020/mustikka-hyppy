import Phaser from 'phaser';
import { DESIGN_W } from '../config/tuning';
import { pointerDesign } from '../render/ui';

/**
 * Steuerung: Tastatur (Pfeile, A/D), Touch/Maus (linke/rechte Bildhälfte),
 * optional Neigungssensor. Liefert eine Richtung von −1 … +1.
 */
export class Controls {
  private keys: {
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
  };
  private tiltGamma: number | null = null;
  /** true, sobald der Sensor wirklich Werte geliefert hat */
  tiltReceived = false;
  private tiltHandler?: (e: DeviceOrientationEvent) => void;
  private motionHandler?: (e: DeviceMotionEvent) => void;
  private fromOrientation = false;
  /** Bereich oben (HUD), in dem Touch nicht steuert */
  hudHeight = 0;

  constructor(
    private scene: Phaser.Scene,
    tiltEnabled: boolean,
  ) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
    };
    if (tiltEnabled) this.enableTilt();
  }

  enableTilt(): void {
    if (this.tiltHandler || typeof window === 'undefined') return;
    // 1) Lagesensor (deviceorientation / deviceorientationabsolute)
    this.tiltHandler = (e: DeviceOrientationEvent) => {
      if (e.gamma == null) return;
      this.tiltReceived = true;
      this.fromOrientation = true;
      const angle = screenAngle();
      let g = e.gamma;
      if (angle === 90) g = e.beta ?? g;
      else if (angle === 270) g = -(e.beta ?? -g);
      this.tiltGamma = g;
    };
    // 2) Rückfall: Beschleunigungssensor (Schwerkraft) – manche Browser liefern nur diesen
    this.motionHandler = (e: DeviceMotionEvent) => {
      if (this.fromOrientation) return;
      const deg = gammaFromMotion(e);
      if (deg === null) return;
      this.tiltReceived = true;
      this.tiltGamma = deg;
    };
    window.addEventListener('deviceorientation', this.tiltHandler);
    window.addEventListener('deviceorientationabsolute' as 'deviceorientation', this.tiltHandler);
    window.addEventListener('devicemotion', this.motionHandler);
  }

  disableTilt(): void {
    if (this.tiltHandler) {
      window.removeEventListener('deviceorientation', this.tiltHandler);
      window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', this.tiltHandler);
    }
    if (this.motionHandler) window.removeEventListener('devicemotion', this.motionHandler);
    this.tiltHandler = undefined;
    this.motionHandler = undefined;
    this.tiltGamma = null;
    this.fromOrientation = false;
  }

  /**
   * Browser liefern den Neigungssensor nur auf sicheren Seiten (https:// oder localhost).
   * Über http://192.168… im WLAN kommen keine Werte an.
   */
  static tiltBlockedReason(): string | null {
    if (typeof window === 'undefined') return 'kein Sensor';
    if (!window.isSecureContext) return 'braucht https://';
    if (!('DeviceOrientationEvent' in window)) return 'kein Sensor';
    return null;
  }

  /** prüft kurz, ob der Sensor Werte liefert */
  static probeTilt(timeoutMs = 2500): Promise<boolean> {
    return new Promise((resolve) => {
      if (Controls.tiltBlockedReason()) return resolve(false);
      const cleanup = () => {
        window.removeEventListener('deviceorientation', onOri);
        window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', onOri);
        window.removeEventListener('devicemotion', onMot);
        clearTimeout(t);
      };
      const onOri = (e: DeviceOrientationEvent) => {
        if (e.gamma == null && e.beta == null) return;
        cleanup();
        resolve(true);
      };
      const onMot = (e: DeviceMotionEvent) => {
        if (gammaFromMotion(e) === null) return;
        cleanup();
        resolve(true);
      };
      const t = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
      window.addEventListener('deviceorientation', onOri);
      window.addEventListener('deviceorientationabsolute' as 'deviceorientation', onOri);
      window.addEventListener('devicemotion', onMot);
    });
  }

  /** iOS verlangt eine Erlaubnis aus einer Nutzeraktion heraus */
  static async requestTiltPermission(): Promise<boolean> {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        return (await DOE.requestPermission()) === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }

  direction(): number {
    let dir = 0;
    if (this.keys.left.some((k) => k.isDown)) dir -= 1;
    if (this.keys.right.some((k) => k.isDown)) dir += 1;
    if (dir !== 0) return dir;

    // Touch / Maus
    let l = false;
    let r = false;
    for (const p of this.scene.input.manager.pointers) {
      if (!p || !p.isDown) continue;
      const d = pointerDesign(this.scene, p);
      if (d.y < this.hudHeight) continue;
      if (d.x < DESIGN_W / 2) l = true;
      else r = true;
    }
    if (l !== r) return l ? -1 : 1;

    // Neigung
    if (this.tiltGamma !== null) {
      const g = this.tiltGamma;
      const dead = 3;
      if (Math.abs(g) < dead) return 0;
      return Phaser.Math.Clamp((g - Math.sign(g) * dead) / 18, -1, 1);
    }
    return 0;
  }

  destroy(): void {
    this.disableTilt();
  }
}

function screenAngle(): number {
  const a = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
  return ((a % 360) + 360) % 360;
}

/** Seitenneigung in Grad (wie gamma) aus dem Schwerkraftanteil des Beschleunigungssensors */
function gammaFromMotion(e: DeviceMotionEvent): number | null {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null || g.y == null) return null;
  const angle = screenAngle();
  let side = angle === 90 ? g.y : angle === 270 ? -g.y : g.x;
  // iOS meldet die Achsen mit umgekehrtem Vorzeichen
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) side = -side;
  const s = Math.max(-1, Math.min(1, side / 9.81));
  return (-Math.asin(s) * 180) / Math.PI;
}

