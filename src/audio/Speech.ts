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

export class Speech {
  private voice?: SpeechSynthesisVoice;
  private listeners: (() => void)[] = [];

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
    // Rangfolge: passende Region, "Natural"-Stimmen (Edge), Online vor alten lokalen Stimmen
    const score = (v: SpeechSynthesisVoice) =>
      (norm(v) === loc ? 4 : 0) + (/natural/i.test(v.name) ? 3 : 0) + (/online|neural|google/i.test(v.name) ? 1 : 0);
    const best = [...matches].sort((a, b) => score(b) - score(a))[0];
    console.info('[Mustikka Hyppy] Stimme für', this.lang, '→', best.name, `(${best.lang})`);
    return best;
  }

  /** Name der gewählten Stimme (für die Anzeige) */
  get voiceName(): string | undefined {
    return this.custom ? 'eigene Sprachausgabe' : this.voice?.name;
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
