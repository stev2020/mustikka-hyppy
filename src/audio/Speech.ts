/**
 * Aussprache der Zielwörter per Sprachausgabe.
 *
 * Standard: Web Speech API des Browsers. Für Android (Capacitor-WebView hat
 * oft keine Sprachausgabe) oder die Lern-App kann eine eigene Funktion
 * übergeben werden, z. B. mit dem Capacitor-Plugin "text-to-speech".
 */

import { AUDIO } from '../config/tuning';

export type SpeakFn = (text: string, lang: string) => void;

/** Sprachcode → BCP-47 mit Region */
const LOCALES: Record<string, string> = {
  fi: 'fi-FI',
  de: 'de-DE',
  en: 'en-GB',
  sv: 'sv-SE',
  et: 'et-EE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
};

export function toLocale(lang: string): string {
  return LOCALES[lang] ?? lang;
}

/** iOS-Spaßstimmen (Eloquence), gibt es in vielen Sprachen – klingen roboterhaft */
const NOVELTY = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
/** bekannt gute Stimmen: Apple (Satu, Onni), Microsoft (Noora, Harri, Selma), Google */
const GOOD = /\b(satu|onni|noora|harri|selma|google)\b/i;

export class Speech {
  private voice?: SpeechSynthesisVoice;
  private listeners: (() => void)[] = [];
  private unlocked = false;

  constructor(
    public enabled: boolean,
    private lang: string,
    private custom?: SpeakFn,
  ) {
    if (!custom && this.supported) {
      const pick = () => {
        this.voice = this.findVoice();
        this.listeners.forEach((l) => l());
      };
      pick();
      window.speechSynthesis.addEventListener?.('voiceschanged', pick);
      // iOS/Safari: Stimmen kommen oft verspätet, und "voiceschanged" feuert nicht immer
      for (const ms of [250, 1000, 2500, 5000]) setTimeout(() => !this.voice && pick(), ms);
    }
  }

  /**
   * iOS spricht erst, nachdem die Sprachausgabe einmal innerhalb einer Berührung
   * benutzt wurde. Deshalb beim ersten Antippen eine stumme Äußerung abspielen.
   */
  unlock(): void {
    if (this.unlocked || this.custom || !this.supported) return;
    this.unlocked = true;
    try {
      if (!this.voice) this.voice = this.findVoice();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      if (this.voice) {
        u.voice = this.voice;
        u.lang = this.voice.lang;
      }
      window.speechSynthesis.speak(u);
    } catch {
      /* ignorieren */
    }
  }

  /** Sprache wechseln (z. B. andere Wortliste) */
  setLang(lang: string): void {
    if (lang === this.lang) return;
    this.lang = lang;
    if (!this.custom && this.supported) {
      this.voice = this.findVoice();
      this.listeners.forEach((l) => l());
    }
  }

  get supported(): boolean {
    return !!this.custom || (typeof window !== 'undefined' && 'speechSynthesis' in window);
  }

  /** gibt es eine Stimme für die Sprache? (eigene Funktion: immer ja) */
  get hasVoice(): boolean {
    return !!this.custom || !!this.voice;
  }

  onVoicesChanged(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  private findVoice(): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices();
    const loc = toLocale(this.lang).toLowerCase();
    const base = this.lang.toLowerCase().split('-')[0];
    const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
    // genau die Sprache (fi), nicht nur gleicher Anfang (fil = Filipino!)
    const matches = voices.filter((v) => norm(v).split('-')[0] === base);
    if (!matches.length) return undefined;
    // Rangfolge: passende Region, hochwertige Stimmen ("Natural" in Edge, "Premium"/"Enhanced"
    // auf iOS), bekannte gute Stimmen; iOS-Spaßstimmen (Eddy, Grandma …) nur als letzte Wahl
    const score = (v: SpeechSynthesisVoice) =>
      (norm(v) === loc ? 4 : 0) +
      (/natural|premium|enhanced|erweitert/i.test(v.name) ? 3 : 0) +
      (GOOD.test(v.name) ? 2 : 0) +
      (/online|neural/i.test(v.name) ? 1 : 0) -
      (NOVELTY.test(v.name) ? 10 : 0);
    const best = [...matches].sort((a, b) => score(b) - score(a))[0];
    console.info('[Mustikka Hyppy] Stimme für', this.lang, '→', best.name, `(${best.lang})`);
    return best;
  }

  /** Name der gewählten Stimme (für die Anzeige) */
  get voiceName(): string | undefined {
    return this.custom ? 'eigene Sprachausgabe' : this.voice?.name;
  }

  /** kurzer Stimmenname für Knöpfe, z. B. "Satu" statt "Satu (Premium)" oder "Microsoft Noora Online (Natural) - Finnish (Finland)" */
  get voiceLabel(): string | undefined {
    const n = this.voiceName;
    if (!n || this.custom) return n;
    const ms = /Microsoft (\w+)/.exec(n);
    if (ms) return ms[1];
    return n.replace(/\s*[(\-–].*$/, '').trim() || n;
  }

  speak(text: string): void {
    if (!this.enabled || !text) return;
    if (this.custom) {
      this.custom(text, toLocale(this.lang));
      return;
    }
    if (!this.supported || !this.voice) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice;
      u.lang = this.voice.lang;
      u.rate = 0.9;
      u.volume = AUDIO.speechVolume;
      synth.speak(u);
    } catch {
      /* ignorieren */
    }
  }

  cancel(): void {
    try {
      if (!this.custom && this.supported) window.speechSynthesis.cancel();
    } catch {
      /* ignorieren */
    }
  }
}
