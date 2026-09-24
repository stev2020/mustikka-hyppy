import Phaser from 'phaser';
import { languageName } from '../config/settings';
import { DEPTH, DESIGN_H, DESIGN_W } from '../config/tuning';
import { activateList, getCtx } from '../game/context';
import { convertDeck, guessMapping, type FieldMapping, type RawDeck } from '../import/anki';
import { hashId } from '../import/clean';
import { dimmer, fitText, makeButton, makeText, panel, setupCamera, type Button } from '../render/ui';

interface Data {
  deck: RawDeck;
  fileName: string;
}

const SOURCE_LANGS = ['en', 'de', 'sv', 'fr', 'es', 'it'];

/**
 * Vorschau eines importierten Anki-Decks: Felder zuordnen, Sprache wählen,
 * übernehmen. Wird über dem Menü geöffnet.
 */
export class ImportScene extends Phaser.Scene {
  private deck!: RawDeck;
  private map!: FieldMapping;
  private fieldBtns: { target?: Button; source?: Button; lang?: Button } = {};
  private preview: Phaser.GameObjects.Text[] = [];
  private statsText!: Phaser.GameObjects.Text;
  private errorText!: Phaser.GameObjects.Text;

  constructor() {
    super('Import');
  }

  create(data: Data): void {
    setupCamera(this);
    this.deck = data.deck;
    this.map = guessMapping(this.deck);
    this.preview = [];
    const cx = DESIGN_W / 2;
    const top = 90;
    const bottom = DESIGN_H - 70;

    dimmer(this, 0.7).setDepth(DEPTH.overlay);
    panel(this, 36, top, DESIGN_W - 72, bottom - top, 34, 0.96).setDepth(DEPTH.overlay);
    const L = this.add.container(0, 0).setDepth(DEPTH.overlay + 1);

    L.add(makeText(this, cx, top + 56, 'Wortliste importieren', { size: 40, weight: 900 }));
    const title = makeText(this, cx, top + 106, `„${this.deck.title}“ · ${this.deck.notes.length} Karten`, { size: 22, weight: 700, color: '#c9bfff', strokeThickness: 0 });
    fitText(title, DESIGN_W - 120, 22, 14);
    L.add(title);

    // Feldzuordnung
    const rowY = top + 180;
    L.add(makeText(this, 80, rowY - 38, 'Lernsprache (auf den Planken)', { size: 18, weight: 700, color: '#c9bfff', strokeThickness: 0 }).setOrigin(0, 0.5));
    this.fieldBtns.target = makeButton(this, cx, rowY, DESIGN_W - 140, 54, '', () => this.cycleField('target'), { size: 22 });
    L.add(this.fieldBtns.target.container);

    L.add(makeText(this, 80, rowY + 62, 'Übersetzung (Frage oben)', { size: 18, weight: 700, color: '#c9bfff', strokeThickness: 0 }).setOrigin(0, 0.5));
    this.fieldBtns.source = makeButton(this, cx - 95, rowY + 100, DESIGN_W - 330, 54, '', () => this.cycleField('source'), { size: 22 });
    this.fieldBtns.lang = makeButton(this, DESIGN_W - 70 - 85, rowY + 100, 170, 54, '', () => this.cycleLang(), { size: 22 });
    L.add([this.fieldBtns.source.container, this.fieldBtns.lang.container]);

    // Vorschau
    const pvTop = rowY + 160;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(66, pvTop, DESIGN_W - 132, 430, 22);
    L.add(g);
    L.add(makeText(this, cx, pvTop + 30, 'Vorschau', { size: 20, weight: 800, color: '#ffd27a', strokeThickness: 0 }));
    for (let i = 0; i < 8; i++) {
      const t = makeText(this, cx, pvTop + 76 + i * 44, '', { size: 23, weight: 700, strokeThickness: 4 });
      this.preview.push(t);
      L.add(t);
    }
    this.statsText = makeText(this, cx, pvTop + 460, '', { size: 19, weight: 600, color: '#e9e2ff', strokeThickness: 0, wrapWidth: DESIGN_W - 140 });
    L.add(this.statsText);
    this.errorText = makeText(this, cx, bottom - 180, '', { size: 20, weight: 700, color: '#ff8f8f', strokeThickness: 0 });
    L.add(this.errorText);

    L.add(makeButton(this, cx, bottom - 118, 440, 80, 'Übernehmen', () => this.accept(), { size: 32, color: 0x2f7a47 }).container);
    L.add(makeButton(this, cx, bottom - 44, 300, 54, 'Abbrechen', () => this.close(), { size: 22 }).container);

    this.refresh();
    this.input.keyboard?.once('keydown-ESC', () => this.close());
  }

  private cycleField(which: 'target' | 'source'): void {
    const n = this.deck.fieldNames.length;
    const other = which === 'target' ? this.map.source : this.map.target;
    let v = this.map[which];
    do v = (v + 1) % n;
    while (v === other && n > 2);
    if (v === other) {
      // nur zwei Felder: tauschen
      this.map = { ...this.map, target: this.map.source, source: this.map.target };
    } else this.map = { ...this.map, [which]: v };
    this.refresh();
  }

  private cycleLang(): void {
    const i = SOURCE_LANGS.indexOf(this.map.sourceLang);
    this.map = { ...this.map, sourceLang: SOURCE_LANGS[(i + 1) % SOURCE_LANGS.length] };
    this.refresh();
  }

  private refresh(): void {
    const f = this.deck.fieldNames;
    this.fieldBtns.target?.setLabel(`${languageName(this.map.targetLang)}: Feld „${f[this.map.target]}“`);
    this.fieldBtns.source?.setLabel(`Feld „${f[this.map.source]}“`);
    this.fieldBtns.lang?.setLabel(languageName(this.map.sourceLang));
    const res = convertDeck(this.deck, this.map);
    const step = Math.max(1, Math.floor(res.entries.length / this.preview.length));
    this.preview.forEach((t, i) => {
      const e = res.entries[i * step];
      t.setText(e ? `${e.source}  →  ${e.target}` : '');
      fitText(t, DESIGN_W - 160, 23, 14);
    });
    const sk = res.skipped;
    const parts = [];
    if (sk.empty) parts.push(`${sk.empty} leer`);
    if (sk.tooLong) parts.push(`${sk.tooLong} zu lang`);
    if (sk.duplicate) parts.push(`${sk.duplicate} doppelt`);
    if (sk.same) parts.push(`${sk.same} gleich auf beiden Seiten`);
    const seeded = Object.keys(res.seedBoxes).length;
    this.statsText.setText(
      `${res.entries.length} Wörter übernehmen` +
        (parts.length ? ` · übersprungen: ${parts.join(', ')}` : '') +
        (seeded ? `\n${seeded} Wörter bringen ihren Lernstand aus Anki mit` : ''),
    );
  }

  private accept(): void {
    const ctx = getCtx(this);
    const res = convertDeck(this.deck, this.map);
    if (res.entries.length < 4) {
      this.errorText.setText('Zu wenige verwendbare Wörter – Felder prüfen.');
      return;
    }
    const id = `anki-${hashId(`${this.deck.title}|${this.deck.notes[0]?.id ?? ''}`)}`;
    const ok = ctx.lists.save({
      id,
      title: this.deck.title,
      count: res.entries.length,
      meta: { ...res.meta, origin: 'anki' },
      entries: res.entries,
      importedAt: new Date().toISOString(),
    });
    if (!ok) {
      this.errorText.setText('Speichern fehlgeschlagen (Browser-Speicher voll?)');
      return;
    }
    activateList(ctx, id);
    ctx.progress.seed(res.seedBoxes);
    this.scene.stop();
    this.scene.stop('Menu');
    this.scene.start('Menu');
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Menu');
  }
}
