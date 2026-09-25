import Phaser from 'phaser';
import { CHARACTER, PLANK_SNOW } from '../config/assets';
import { languageName } from '../config/settings';
import { DEPTH, DESIGN_W, physicsFor } from '../config/tuning';
import { activateList, getCtx, isTouchDevice, setTheme } from '../game/context';
import { BUILTIN_LIST } from '../import/wordLists';
import { loadApkgDeps, parseAnkiText, parseApkg } from '../import/anki';
import { pickFile } from '../import/pickFile';
import { hashId } from '../import/clean';
import { normalizeVocabFile, type VocabFile } from '../vocab/types';
import { Controls } from '../input/Controls';
import { Background } from '../render/Background';
import { tempoSelector } from '../render/tempoSelector';
import { makeButton, makeText, panel, setupCamera, type Button } from '../render/ui';
import { audioToggles } from '../render/audioToggles';
import { VocabDeck } from '../vocab/VocabDeck';
import { THEMES, THEME_IDS, type ThemeId } from '../config/themes';
import { freeOtherThemes, loadTheme } from '../render/themeLoader';

export class MenuScene extends Phaser.Scene {
  private bg!: Background;
  private berry!: Phaser.GameObjects.Image;
  private t = 0;
  private berryBaseY = 0;

  constructor() {
    super('Menu');
  }

  create(): void {
    setupCamera(this);
    const ctx = getCtx(this);
    freeOtherThemes(this, ctx.theme);
    this.bg = new Background(this, THEMES[ctx.theme]);
    const cx = DESIGN_W / 2;

    // Titel
    const title = makeText(this, cx, 170, 'Mustikka Hyppy', { size: 70, weight: 900, strokeThickness: 12 }).setDepth(DEPTH.hud);
    this.tweens.add({ targets: title, y: 180, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const from = languageName(ctx.settings.direction === 'forward' ? ctx.meta.sourceLang ?? ctx.settings.sourceLang : ctx.meta.targetLang ?? ctx.settings.targetLang);
    const to = languageName(ctx.settings.direction === 'forward' ? ctx.meta.targetLang ?? ctx.settings.targetLang : ctx.meta.sourceLang ?? ctx.settings.sourceLang);
    makeText(this, cx, 250, `Vokabel-Sprungspiel · ${from} → ${to}`, { size: 26, weight: 700, color: '#6b4a3a' }).setDepth(DEPTH.hud);

    // Highscore
    // Highscore + Lernstand
    const hs = ctx.prefs.getHighscore();
    const poolIds = new VocabDeck(ctx.entries, {
      direction: ctx.settings.direction,
      levels: ctx.settings.levels,
      categories: ctx.settings.categories,
      repeatAfterRows: [3, 4],
    }).poolIds;
    const st = ctx.progress.stats(poolIds);
    // antippbar: öffnet die Lernstand-Übersicht
    const bits: string[] = [];
    if (hs && hs.score > 0) bits.push(`Highscore ${hs.score}`);
    bits.push(st.known + st.learning > 0 ? `${st.known}/${st.total} sicher · ${st.learning} in Arbeit` : `${st.total} Wörter · Lernstand`);
    const statsBtn = makeButton(this, cx, 302, 560, 46, `${bits.join('  ·  ')}  ▸`, () => {
      this.scene.launch('Stats');
      this.scene.pause();
    }, { size: 20 });
    statsBtn.container.setDepth(DEPTH.hud);

    // Heidelbeere hüpft auf einer Schneeplanke
    const plankY = 560;
    this.add
      .image(cx, plankY, PLANK_SNOW.key)
      .setOrigin(0.5, PLANK_SNOW.surfaceY / PLANK_SNOW.height)
      .setScale(PLANK_SNOW.displayWidth / PLANK_SNOW.width)
      .setDepth(DEPTH.platforms);
    const s = (CHARACTER.displayHeight / CHARACTER.bodyHeight) * 1.15;
    this.berry = this.add.image(cx, plankY, CHARACTER.frames.idle).setOrigin(0.5, CHARACTER.footY / CHARACTER.sourceSize).setScale(s).setDepth(DEPTH.player);
    this.berryBaseY = plankY;

    // Bedienfeld
    const top = 620;
    panel(this, 40, top, DESIGN_W - 80, 640, 34, 0.84).setDepth(DEPTH.hud);
    const ui = this.add.container(0, 0).setDepth(DEPTH.hud + 1);
    ui.add(tempoSelector(this, cx, top + 95, 580));
    // Tageszeit-Wahl nur, wenn es mehr als ein Aussehen gibt (seit dem Kritzel-Look nicht mehr)
    const multiTheme = THEME_IDS.length > 1;
    if (multiTheme) ui.add(this.themeSelector(cx, top + 215, 580));
    const rowY = multiTheme ? top + 292 : top + 205;
    const touch = isTouchDevice();
    if (touch) {
      ui.add(audioToggles(this, cx - 99, rowY, 382));
      ui.add(this.tiltButton(cx + 199, rowY, 182));
    } else ui.add(audioToggles(this, cx, rowY, 580));

    const start = () => this.startGame();
    ui.add(makeButton(this, cx, top + (multiTheme ? 388 : 330), 440, 96, 'Los geht’s!', start, { size: 44, color: 0x9be07a }).container);

    const hint = touch
      ? 'Lenken: Pfeiltasten ← → oder A / D\noder links / rechts auf den Bildschirm tippen'
      : 'Lenken: ← → oder A / D · Pause: Esc · Ton: M\nLande auf der richtigen Übersetzung!';
    ui.add(makeText(this, cx, top + (multiTheme ? 490 : 450), hint, { size: 22, weight: 600, strokeThickness: 0, color: '#4a4058' }));

    // Wortliste wählen / importieren
    if (ctx.settings.allowImport) ui.add(this.listRow(cx, top + (multiTheme ? 580 : 560), 580));
    else ui.add(makeText(this, cx, top + (multiTheme ? 580 : 560), `${ctx.entries.length} Vokabeln geladen`, { size: 18, weight: 600, strokeThickness: 0, color: '#857a9e' }));

    // eingebettet (z. B. im Satztrainer): zurück zur App
    if (ctx.onExit) {
      const exit = makeButton(this, 92, 62, 150, 58, '← Zurück', () => ctx.onExit?.(), { size: 26 });
      exit.container.setDepth(DEPTH.hud + 2);
    }

    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-SPACE', start);
    this.cameras.main.fadeIn(300, 250, 247, 239);
  }

  /** Umschalter Abend / Tag */
  private themeSelector(x: number, y: number, width: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    c.add(makeText(this, x, y - 52, 'Tageszeit', { size: 24, weight: 700, color: '#6b5f86', strokeThickness: 0 }));
    const bw = (width - 16) / 2;
    let busy = false;
    const choose = async (id: ThemeId) => {
      if (busy || id === getCtx(this).theme) return;
      busy = true;
      buttons.forEach((b, i) => b.setLabel(THEME_IDS[i] === id ? 'Lade …' : THEMES[THEME_IDS[i]].label));
      await loadTheme(this, id);
      setTheme(this, id);
      this.scene.restart();
    };
    const buttons: Button[] = THEME_IDS.map((id, i) => {
      const b = makeButton(this, x - width / 2 + bw / 2 + i * (bw + 16), y, bw, 58, THEMES[id].label, () => void choose(id), { size: 24 });
      b.setActive(id === getCtx(this).theme);
      c.add(b.container);
      return b;
    });
    this.input.keyboard?.on('keydown-T', () => {
      const cur = THEME_IDS.indexOf(getCtx(this).theme);
      void choose(THEME_IDS[(cur + 1) % THEME_IDS.length]);
    });
    return c;
  }

  /** Neigungssteuerung an/aus (nur Touch-Geräte) */
  private tiltButton(x: number, y: number, w: number): Phaser.GameObjects.Container {
    let status: string | null = null;
    const label = () => `Neigen: ${status ?? (getCtx(this).tilt ? 'an' : 'aus')}`;
    const btn = makeButton(this, x, y, w, 54, label(), async () => {
      const c = getCtx(this);
      if (!c.tilt) {
        const blocked = Controls.tiltBlockedReason();
        if (blocked) {
          status = blocked;
          btn.setLabel(label());
          return;
        }
        const ok = await Controls.requestTiltPermission();
        if (!ok) return;
        status = 'prüfe …';
        btn.setLabel(label());
        const works = await Controls.probeTilt();
        status = works ? null : 'kein Sensor';
        if (!works) {
          btn.setLabel(label());
          return;
        }
      }
      c.tilt = !c.tilt;
      c.prefs.setTilt(c.tilt);
      status = null;
      btn.setLabel(label());
      btn.setActive(c.tilt);
    }, { size: 22 });
    btn.setActive(getCtx(this).tilt);
    if (getCtx(this).tilt && Controls.tiltBlockedReason()) {
      status = Controls.tiltBlockedReason();
      btn.setLabel(label());
    }
    return btn.container;
  }

  /** Zeile: aktive Wortliste (antippen = nächste), Löschen, Importieren */
  private listRow(cx: number, y: number, width: number): Phaser.GameObjects.Container {
    const ctx = getCtx(this);
    const c = this.add.container(0, 0);
    const lists = [{ id: BUILTIN_LIST, title: ctx.builtin.meta.title ?? 'Beispiel-Wortschatz', count: ctx.builtin.entries.length }, ...ctx.lists.index()];
    const imported = ctx.listId !== BUILTIN_LIST && !ctx.listId.startsWith('privat-');
    const importW = 150;
    const delW = imported ? 64 : 0;
    const gap = 10;
    const listW = width - importW - gap - (imported ? delW + gap : 0);
    const left = cx - width / 2;

    const label = `${ctx.listTitle} · ${ctx.entries.length}${lists.length > 1 ? '  ▸' : ''}`;
    const listBtn = makeButton(this, left + listW / 2, y, listW, 56, label, () => {
      if (lists.length < 2) return;
      const i = lists.findIndex((l) => l.id === ctx.listId);
      activateList(ctx, lists[(i + 1) % lists.length].id);
      this.scene.restart();
    }, { size: 21 });
    c.add(listBtn.container);

    if (imported) {
      let armed = false;
      const del = makeButton(this, left + listW + gap + delW / 2, y, delW, 56, '✕', () => {
        if (!armed) {
          armed = true;
          del.setLabel('?');
          del.setActive(true);
          listBtn.setLabel('Nochmal ✕ = Liste löschen');
          this.time.delayedCall(2500, () => {
            if (!del.container.active) return;
            armed = false;
            del.setLabel('✕');
            del.setActive(false);
            listBtn.setLabel(label);
          });
          return;
        }
        ctx.lists.remove(ctx.listId);
        activateList(ctx, BUILTIN_LIST);
        this.scene.restart();
      }, { size: 24 });
      c.add(del.container);
    }

    const imp = makeButton(this, cx + width / 2 - importW / 2, y, importW, 56, 'Import …', () => void this.startImport(imp), { size: 21 });
    c.add(imp.container);
    return c;
  }

  private async startImport(btn: Button): Promise<void> {
    const file = await pickFile('.apkg,.colpkg,.txt,.tsv,.csv,.json');
    if (!file) return;
    btn.setLabel('Lese …');
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      if (/\.json$/i.test(file.name)) {
        this.importJson(new TextDecoder().decode(data), file.name);
        return;
      }
      const deck = /\.(apkg|colpkg)$/i.test(file.name)
        ? parseApkg(data, await loadApkgDeps())
        : parseAnkiText(new TextDecoder().decode(data), file.name);
      btn.setLabel('Import …');
      this.scene.launch('Import', { deck, fileName: file.name });
      this.scene.pause();
    } catch (e) {
      console.error(e);
      btn.setLabel('Fehler');
      const msg = makeText(this, DESIGN_W / 2, 1255, `Import fehlgeschlagen: ${(e as Error).message}`, { size: 18, weight: 700, color: '#c8323c', strokeThickness: 3, wrapWidth: DESIGN_W - 60 }).setDepth(DEPTH.hud + 2);
      this.time.delayedCall(5000, () => {
        msg.destroy();
        btn.setLabel('Import …');
      });
    }
  }

  /** Wortliste im Spielformat ({ meta, entries }) übernehmen – Stufen und Kategorien bleiben erhalten */
  private importJson(text: string, fileName: string): void {
    const ctx = getCtx(this);
    const { meta, entries: raw } = normalizeVocabFile(JSON.parse(text) as VocabFile);
    const entries = raw.filter((e) => e && typeof e.source === 'string' && typeof e.target === 'string' && e.source.trim() && e.target.trim());
    if (entries.length < 4) throw new Error('keine Wortliste im Spielformat');
    entries.forEach((e, i) => (e.id = String(e.id ?? `w${i}`)));
    const title = meta.title ?? fileName.replace(/\.json$/i, '');
    const id = `json-${hashId(`${title}|${entries[0].id}`)}`;
    if (!ctx.lists.save({ id, title, count: entries.length, meta: { ...meta, origin: meta.origin ?? 'json' }, entries, importedAt: new Date().toISOString() }))
      throw new Error('Browser-Speicher voll?');
    activateList(ctx, id);
    this.scene.restart();
  }

  private startGame(): void {
    this.cameras.main.fadeOut(220, 250, 247, 239);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.bg.update(0, dt);

    // gleiche Sprungkurve wie im Spiel (Tempo-Vorschau)
    const p = physicsFor(getCtx(this).tempo);
    this.t = (this.t + dt) % p.T;
    const h = p.jumpVelocity * this.t - 0.5 * p.gravity * this.t * this.t;
    const scale = 0.42; // Menü-Sprung flacher, damit er unter Titel und Lernstand passt
    this.berry.y = this.berryBaseY - h * scale;
    const phase = this.t / p.T;
    const key = phase < 0.08 || phase > 0.96 ? CHARACTER.frames.land : phase < 0.4 ? CHARACTER.frames.jump : CHARACTER.frames.idle;
    if (this.berry.texture.key !== key) this.berry.setTexture(key);
  }
}
