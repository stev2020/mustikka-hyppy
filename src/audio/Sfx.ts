/**
 * Soundeffekte, per WebAudio synthetisiert (keine Audiodateien nötig).
 * Der AudioContext wird erst bei der ersten Nutzeraktion gestartet
 * (Autoplay-Regeln der Browser).
 */

import { AUDIO } from '../config/tuning';

export type SfxName =
  | 'jump'
  | 'correct'
  | 'wrong'
  | 'heart'
  | 'whoosh'
  | 'highscore'
  | 'gameover'
  | 'click'
  | 'streak'
  | 'berry'
  | 'spring'
  | 'crumble'
  | 'heartUp';

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  delay?: number;
  freqEnd?: number;
  attack?: number;
}

interface NoiseOpts {
  vol?: number;
  delay?: number;
  filter?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
}

export class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noiseBuf?: AudioBuffer;
  private lastJump = 0;

  constructor(public enabled: boolean) {}

  /** bei der ersten Nutzeraktion aufrufen */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -10;
        comp.ratio.value = 3;
        comp.connect(this.ctx.destination);
        this.master = this.ctx.createGain();
        this.master.gain.value = AUDIO.sfxVolume;
        this.master.connect(comp);
        const len = Math.floor(this.ctx.sampleRate * 0.6);
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* kein Audio verfügbar */
    }
  }

  /** stumm schalten, ohne den Context zu schließen */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  private tone(freq: number, dur: number, o: ToneOpts = {}): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + dur);
    const vol = o.vol ?? 0.2;
    const a = o.attack ?? 0.006;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, o: NoiseOpts = {}): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'bandpass';
    f.frequency.setValueAtTime(o.freq ?? 1500, t0);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + dur);
    f.Q.value = o.q ?? 1.2;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name: SfxName): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    switch (name) {
      case 'jump': {
        // leises "Hopp" – nicht öfter als nötig
        const now = this.ctx.currentTime;
        if (now - this.lastJump < 0.12) return;
        this.lastJump = now;
        const f = r(330, 380);
        this.tone(f, 0.13, { type: 'sine', vol: 0.06, freqEnd: f * 1.9 });
        break;
      }
      case 'correct': {
        // helles Glockenspiel: C6 – E6 – G6
        const notes = [1046.5, 1318.5, 1568];
        notes.forEach((n, i) => {
          this.tone(n, 0.55 - i * 0.05, { type: 'triangle', vol: 0.13, delay: i * 0.065 });
          this.tone(n * 2, 0.3, { type: 'sine', vol: 0.03, delay: i * 0.065 });
        });
        break;
      }
      case 'wrong': {
        // Holz bricht: Knacken + dumpfer Schlag
        this.noise(0.09, { freq: 2600, freqEnd: 900, q: 2, vol: 0.4 });
        this.noise(0.12, { freq: 1800, freqEnd: 500, q: 1.5, vol: 0.3, delay: 0.045 });
        this.noise(0.22, { filter: 'lowpass', freq: 700, freqEnd: 150, vol: 0.25, delay: 0.02 });
        this.tone(150, 0.26, { type: 'triangle', vol: 0.22, freqEnd: 55 });
        break;
      }
      case 'heart':
        this.tone(392, 0.16, { type: 'triangle', vol: 0.1, delay: 0.16 });
        this.tone(262, 0.3, { type: 'triangle', vol: 0.1, delay: 0.3, freqEnd: 220 });
        break;
      case 'whoosh':
        this.noise(0.38, { freq: 350, freqEnd: 2600, q: 0.9, vol: 0.07 });
        this.tone(880, 0.25, { type: 'sine', vol: 0.025, delay: 0.1, freqEnd: 1320 });
        break;
      case 'highscore': {
        const notes = [784, 988, 1175, 1568];
        notes.forEach((n, i) => this.tone(n, i === 3 ? 0.6 : 0.16, { type: 'triangle', vol: 0.12, delay: i * 0.09 }));
        break;
      }
      case 'streak': {
        const notes = [1318.5, 1760, 2093];
        notes.forEach((n, i) => this.tone(n, 0.3, { type: 'sine', vol: 0.06, delay: 0.25 + i * 0.05 }));
        break;
      }
      case 'gameover': {
        const notes = [523, 440, 349, 262];
        notes.forEach((n, i) => this.tone(n, i === 3 ? 0.7 : 0.22, { type: 'triangle', vol: 0.12, delay: i * 0.16 }));
        break;
      }
      case 'berry': {
        // heller Zupfton, leicht variiert
        const f = r(1480, 1640);
        this.tone(f, 0.12, { type: 'triangle', vol: 0.1 });
        this.tone(f * 1.5, 0.16, { type: 'sine', vol: 0.06, delay: 0.05 });
        break;
      }
      case 'spring':
        this.tone(220, 0.42, { type: 'sine', vol: 0.14, freqEnd: 880 });
        this.tone(440, 0.3, { type: 'triangle', vol: 0.05, freqEnd: 1320, delay: 0.03 });
        break;
      case 'crumble':
        this.noise(0.22, { filter: 'lowpass', freq: 1200, freqEnd: 250, vol: 0.22, delay: 0.03 });
        this.noise(0.06, { freq: 2400, q: 2, vol: 0.18, delay: 0.05 });
        this.noise(0.06, { freq: 1900, q: 2, vol: 0.14, delay: 0.12 });
        break;
      case 'heartUp': {
        const notes = [659, 880, 1109, 1319];
        notes.forEach((n, i) => this.tone(n, i === 3 ? 0.5 : 0.14, { type: 'triangle', vol: 0.12, delay: i * 0.07 }));
        break;
      }
      case 'click':
        this.tone(1200, 0.045, { type: 'square', vol: 0.025 });
        break;
    }
  }
}
