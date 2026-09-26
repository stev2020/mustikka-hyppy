import Phaser from 'phaser';
import { DEPTH, DESIGN_H, DESIGN_W, LEARNING } from '../config/tuning';
import { getCtx } from '../game/context';
import { COLORS, dimmer, fitText, makeButton, makeText, panel, setupCamera } from '../render/ui';
import { KNOWN_BOX } from '../vocab/Progress';
import { VocabDeck } from '../vocab/VocabDeck';

const COL_KNOWN = 0x5fcf7f;
const COL_LEARN = 0xffc857;
const COL_NEW = 0xe4dfe8;

/** Übersicht: Fortschritt je Schwierigkeitsstufe und Wörter, die oft falsch sind */
export class StatsScene extends Phaser.Scene {
  constructor() {
    super('Stats');
  }

  create(): void {
    setupCamera(this);
    const ctx = getCtx(this);
    const cx = DESIGN_W / 2;
    const top = 70;
    const bottom = DESIGN_H - 50;

    dimmer(this, 0.7).setDepth(DEPTH.overlay);
    panel(this, 30, top, DESIGN_W - 60, bottom - top, 34, 0.96).setDepth(DEPTH.overlay);
    const L = this.add.container(0, 0).setDepth(DEPTH.overlay + 1);

    L.add(makeText(this, cx, top + 52, 'Lernstand', { size: 44, weight: 900 }));
    const sub = makeText(this, cx, top + 100, ctx.listTitle, { size: 22, weight: 700, color: COLORS.muted, strokeThickness: 0 });
    fitText(sub, DESIGN_W - 120, 22, 14);
    L.add(sub);

    // Wörter der aktiven Liste (mit denselben Filtern wie im Spiel)
    const ids = new VocabDeck(ctx.entries, {
      direction: ctx.settings.direction,
      levels: ctx.settings.levels,
      categories: ctx.settings.categories,
      repeatAfterRows: [3, 4],
    }).poolIds;
    const idSet = new Set(ids);
    const entries = ctx.entries.filter((e) => idSet.has(e.id));
    const P = ctx.progress;
    const total = P.stats(ids);

    // Gesamt
    const hs = ctx.prefs.getHighscore();
    L.add(makeText(this, cx, top + 150, `${total.known} sicher · ${total.learning} in Arbeit · ${total.fresh} neu`, { size: 26, weight: 800 }));
    if (hs && hs.score > 0) L.add(makeText(this, cx, top + 188, `Highscore ${hs.score} · Rekordhöhe ${Math.max(hs.bestMeters ?? 0, hs.meters)} m`, { size: 19, weight: 700, color: COLORS.orange, strokeThickness: 0 }));

    // je Stufe
    const g = this.add.graphics();
    L.add(g);
    const barX = 250;
    const barW = DESIGN_W - 70 - barX;
    const levels = [1, 2, 3, 4, 5];
    const hasLevels = new Set(entries.map((e) => e.level ?? 1)).size > 1;
    let y = top + 245;
    for (const lv of hasLevels ? levels : [0]) {
      const es = lv ? entries.filter((e) => (e.level ?? 1) === lv) : entries;
      if (!es.length) continue;
      const st = P.stats(es.map((e) => e.id));
      const name = lv ? `Stufe ${lv}` : 'Alle Wörter';
      L.add(makeText(this, 64, y - 12, name, { size: 22, weight: 800 }).setOrigin(0, 0.5));
      if (lv) L.add(makeText(this, 64, y + 14, LEARNING.levelNames[lv - 1], { size: 16, weight: 600, color: COLORS.muted, strokeThickness: 0 }).setOrigin(0, 0.5));
      const w1 = (barW * st.known) / st.total;
      const w2 = (barW * st.learning) / st.total;
      g.fillStyle(COL_NEW, 1).fillRoundedRect(barX, y - 14, barW, 28, 10);
      if (w1 + w2 > 0) g.fillStyle(COL_LEARN, 1).fillRoundedRect(barX, y - 14, Math.max(w1 + w2, 12), 28, 10);
      if (w1 > 0) g.fillStyle(COL_KNOWN, 1).fillRoundedRect(barX, y - 14, Math.max(w1, 12), 28, 10);
      L.add(makeText(this, barX + barW / 2, y, `${st.known} / ${st.total}`, { size: 17, weight: 800, strokeThickness: 3, color: COLORS.buttonText, stroke: COLORS.buttonTextStroke }));
      y += 64;
    }
    // Legende
    const legend = [
      [COL_KNOWN, 'sicher (3× richtig in Folge)'],
      [COL_LEARN, 'in Arbeit'],
      [COL_NEW, 'neu'],
    ] as const;
    let lx = 64;
    for (const [col, label] of legend) {
      g.fillStyle(col, 1).fillRoundedRect(lx, y - 8, 18, 18, 5);
      const t = makeText(this, lx + 26, y, label, { size: 16, weight: 600, strokeThickness: 0, color: COLORS.text2 }).setOrigin(0, 0.5);
      L.add(t);
      lx += 26 + t.width + 22;
    }
    y += 50;

    // oft falsch
    const trouble = entries
      .map((e) => ({ e, p: P.get(e.id) }))
      .filter((x) => x.p && x.p.wrong > 0)
      .sort((a, b) => b.p!.wrong - a.p!.wrong || (a.p!.box - b.p!.box))
      .slice(0, 7);
    L.add(makeText(this, cx, y, trouble.length ? 'Oft falsch' : 'Noch keine Fehler – weiter so!', { size: 22, weight: 800, color: trouble.length ? COLORS.orange : COLORS.green, strokeThickness: 0 }));
    y += 40;
    for (const { e, p } of trouble) {
      const t = makeText(this, 70, y, `${e.source}  →  ${e.target}`, { size: 20, weight: 700, strokeThickness: 3 }).setOrigin(0, 0.5);
      fitText(t, DESIGN_W - 250, 20, 13);
      const mark = p!.box >= KNOWN_BOX ? '✓' : '';
      L.add(t);
      L.add(makeText(this, DESIGN_W - 70, y, `✗${p!.wrong}  ✓${p!.right} ${mark}`, { size: 18, weight: 800, color: COLORS.red, strokeThickness: 3 }).setOrigin(1, 0.5));
      y += 34;
    }

    // Knöpfe
    const back = () => {
      this.scene.stop();
      this.scene.resume('Menu');
    };
    L.add(makeButton(this, cx - 120, bottom - 50, 220, 64, 'Zurück', back, { size: 26, color: 0x9be07a }).container);
    let armed = false;
    const reset = makeButton(this, cx + 120, bottom - 50, 220, 64, 'Zurücksetzen', () => {
      if (!armed) {
        armed = true;
        reset.setLabel('Wirklich?');
        reset.setActive(true);
        this.time.delayedCall(2500, () => {
          armed = false;
          reset.setLabel('Zurücksetzen');
          reset.setActive(false);
        });
        return;
      }
      ctx.progress.reset();
      this.scene.stop();
      this.scene.stop('Menu');
      this.scene.start('Menu');
    }, { size: 22 });
    L.add(reset.container);
    this.input.keyboard?.once('keydown-ESC', back);
  }
}
