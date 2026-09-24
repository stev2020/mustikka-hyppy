/**
 * Importierte Wortlisten im Browser speichern (localStorage).
 * Index: <prefix>.lists, Inhalt: <prefix>.list.<id>, aktive Liste: <prefix>.activeList
 */
import type { VocabEntry, VocabFileMeta } from '../vocab/types';

export const BUILTIN_LIST = 'builtin';

export interface ListInfo {
  id: string;
  title: string;
  count: number;
}

export interface StoredList extends ListInfo {
  meta: VocabFileMeta;
  entries: VocabEntry[];
  importedAt: string;
}

export class WordListStore {
  constructor(private prefix: string) {}

  private get(k: string): string | null {
    try {
      return window.localStorage.getItem(`${this.prefix}.${k}`);
    } catch {
      return null;
    }
  }

  private set(k: string, v: string): boolean {
    try {
      window.localStorage.setItem(`${this.prefix}.${k}`, v);
      return true;
    } catch {
      return false;
    }
  }

  private del(k: string): void {
    try {
      window.localStorage.removeItem(`${this.prefix}.${k}`);
    } catch {
      /* ignorieren */
    }
  }

  index(): ListInfo[] {
    try {
      const v = JSON.parse(this.get('lists') ?? '[]') as ListInfo[];
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  load(id: string): StoredList | null {
    try {
      const v = this.get(`list.${id}`);
      return v ? (JSON.parse(v) as StoredList) : null;
    } catch {
      return null;
    }
  }

  /** speichert (oder ersetzt) eine Liste; false, wenn der Speicher voll ist */
  save(list: StoredList): boolean {
    if (!this.set(`list.${list.id}`, JSON.stringify(list))) return false;
    const idx = this.index().filter((l) => l.id !== list.id);
    idx.push({ id: list.id, title: list.title, count: list.count });
    return this.set('lists', JSON.stringify(idx));
  }

  remove(id: string): void {
    this.del(`list.${id}`);
    this.set('lists', JSON.stringify(this.index().filter((l) => l.id !== id)));
    if (this.getActive() === id) this.setActive(BUILTIN_LIST);
  }

  getActive(): string {
    return this.get('activeList') ?? BUILTIN_LIST;
  }

  setActive(id: string): void {
    this.set('activeList', id);
  }
}
