/**
 * Öffentliche Schnittstelle von Mustikka Hyppy für die Einbettung in eine
 * Lern-App. Eingabe: Wortliste + Einstellungen. Ausgabe: Ergebnis-Objekt am
 * Rundenende (Callback onResult und DOM-Event "mustikka-hyppy:result").
 */
export { createMustikkaHyppy } from './game/createGame';
export type { MustikkaHyppyOptions, MustikkaHyppyInstance } from './game/createGame';
export type { GameSettings, Direction } from './config/settings';
export type { Tempo } from './config/tuning';
export type { VocabEntry, VocabFile, VocabFileMeta, RoundResult, AnswerRecord } from './vocab/types';
