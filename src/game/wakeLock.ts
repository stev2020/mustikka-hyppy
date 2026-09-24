/**
 * Bildschirm während einer Runde anlassen (Screen Wake Lock API).
 * Funktioniert in Chrome/Edge/Safari auf sicheren Seiten (https:// oder localhost).
 * Der Browser gibt die Sperre frei, sobald der Tab verdeckt wird – beim
 * Zurückkehren wird sie neu angefordert.
 */

interface Sentinel {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', fn: () => void): void;
}

let sentinel: Sentinel | null = null;
let wanted = false;
let listening = false;

async function request(): Promise<void> {
  if (!wanted || document.visibilityState !== 'visible') return;
  const wl = (navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }).wakeLock;
  if (!wl || (sentinel && !sentinel.released)) return;
  try {
    const s = await wl.request('screen');
    sentinel = s;
    s.addEventListener('release', () => {
      if (sentinel === s) sentinel = null;
    });
    if (!wanted) void release();
  } catch {
    /* z. B. Energiesparmodus – dann eben nicht */
  }
}

async function release(): Promise<void> {
  const s = sentinel;
  sentinel = null;
  try {
    await s?.release();
  } catch {
    /* ignorieren */
  }
}

/** true = Bildschirm anlassen, false = normales Verhalten */
export function keepScreenOn(on: boolean): void {
  wanted = on;
  if (!listening && typeof document !== 'undefined') {
    listening = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void request();
    });
  }
  if (on) void request();
  else void release();
}
