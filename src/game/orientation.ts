import type Phaser from 'phaser';

/** Touch-Gerät (Handy/Tablet) – nur dort wird Querformat gesperrt */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

function isLandscape(): boolean {
  const a = screen.orientation?.type;
  if (a) return a.startsWith('landscape');
  return window.innerWidth > window.innerHeight;
}

/** versucht, den Bildschirm auf Hochformat festzulegen (geht nur im Vollbild/als installierte App) */
export function tryLockPortrait(): void {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  try {
    o?.lock?.('portrait').catch(() => {});
  } catch {
    /* nicht unterstützt */
  }
}

/**
 * Hochformat erzwingen:
 *  - Sperre per Screen Orientation API, wo der Browser sie erlaubt,
 *  - sonst im Querformat ein Hinweis „Bitte hochkant halten“ über dem Spiel (Spiel pausiert),
 *  - nach jeder Drehung das Spiel mehrmals neu einpassen (Android-Browser melden
 *    die neue Größe oft erst verzögert – sonst bleibt das Bild klein).
 */
export function installOrientationGuard(
  game: Phaser.Game,
  parentEl: HTMLElement,
  onLandscape: () => void,
): () => void {
  const touch = isTouchDevice();
  let overlay: HTMLDivElement | null = null;
  const timers: number[] = [];

  if (touch) {
    overlay = document.createElement('div');
    overlay.id = 'mh-rotate';
    overlay.setAttribute('role', 'alert');
    overlay.innerHTML = `
      <div class="mh-rot-phone"></div>
      <div class="mh-rot-text">Bitte das Handy<br>hochkant halten</div>`;
    const style = document.createElement('style');
    style.textContent = `
      #mh-rotate { position: fixed; inset: 0; z-index: 1000; display: none;
        flex-direction: column; align-items: center; justify-content: center; gap: 28px;
        background: radial-gradient(circle at 50% 40%, #2a2466, #0b0a22 75%);
        color: #fff4dc; font: 800 26px/1.3 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        text-align: center; text-shadow: 0 2px 0 #3a1d12; touch-action: none; }
      #mh-rotate .mh-rot-phone { width: 56px; height: 96px; border: 6px solid #fff4dc; border-radius: 14px;
        box-sizing: border-box; position: relative; animation: mh-rot 2.4s ease-in-out infinite; }
      #mh-rotate .mh-rot-phone::after { content: ''; position: absolute; left: 50%; bottom: 6px; width: 12px; height: 4px;
        margin-left: -6px; border-radius: 2px; background: #fff4dc; }
      @keyframes mh-rot { 0%, 25% { transform: rotate(-90deg); } 55%, 100% { transform: rotate(0deg); } }`;
    overlay.appendChild(style);
    document.body.appendChild(overlay);
  }

  const refresh = () => {
    try {
      game.scale.getParentBounds();
      game.scale.refresh();
    } catch {
      /* Spiel evtl. schon zerstört */
    }
  };

  const update = () => {
    const land = touch && isLandscape();
    if (overlay) overlay.style.display = land ? 'flex' : 'none';
    if (land) onLandscape();
    // falls der Browser herausgezoomt hat: Seite oben links festhalten
    window.scrollTo(0, 0);
    // mehrfach neu einpassen, bis der Browser die endgültige Größe kennt
    while (timers.length) clearTimeout(timers.pop());
    for (const ms of [0, 100, 300, 600, 1000]) timers.push(window.setTimeout(refresh, ms));
  };

  const onOrient = () => update();
  window.addEventListener('resize', onOrient);
  window.addEventListener('orientationchange', onOrient);
  screen.orientation?.addEventListener?.('change', onOrient);
  window.visualViewport?.addEventListener('resize', onOrient);
  // Sperre bei der ersten Berührung versuchen (manche Browser erlauben sie nur nach Nutzeraktion)
  const onFirst = () => tryLockPortrait();
  if (touch) parentEl.addEventListener('pointerdown', onFirst, { once: true });
  if (touch) tryLockPortrait();
  update();

  return () => {
    window.removeEventListener('resize', onOrient);
    window.removeEventListener('orientationchange', onOrient);
    screen.orientation?.removeEventListener?.('change', onOrient);
    window.visualViewport?.removeEventListener('resize', onOrient);
    parentEl.removeEventListener('pointerdown', onFirst);
    while (timers.length) clearTimeout(timers.pop());
    overlay?.remove();
  };
}
