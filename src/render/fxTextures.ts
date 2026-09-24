import Phaser from 'phaser';

/**
 * Kleine Effekt-Texturen, die per Code erzeugt werden (Sternpunkt,
 * Lichtschein, Polarlicht-Vorhang). Keine Spielgrafiken – nur Licht.
 */
export function createFxTextures(scene: Phaser.Scene): void {
  const tex = scene.textures;

  if (!tex.exists('fx_dot')) {
    const c = tex.createCanvas('fx_dot', 32, 32)!;
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    c.refresh();
  }

  if (!tex.exists('fx_sun')) {
    // Sonnenscheibe: warmweißer Kern mit weichem Rand
    const s = 128;
    const c = tex.createCanvas('fx_sun', s, s)!;
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,246,1)');
    g.addColorStop(0.42, 'rgba(255,250,222,1)');
    g.addColorStop(0.52, 'rgba(255,238,170,0.75)');
    g.addColorStop(0.7, 'rgba(255,230,150,0.22)');
    g.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    c.refresh();
  }

  if (!tex.exists('fx_glow')) {
    const w = 256;
    const h = 128;
    const c = tex.createCanvas('fx_glow', w, h)!;
    const ctx = c.getContext();
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    c.refresh();
  }

  if (!tex.exists('fx_aurora')) {
    // Vorhang: unten hell, nach oben ausfadend, mit feinen senkrechten Strahlen
    const w = 512;
    const h = 256;
    const c = tex.createCanvas('fx_aurora', w, h)!;
    const ctx = c.getContext();
    const img = ctx.createImageData(w, h);
    // deterministisches Rauschen für die Strahlen
    const rays: number[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < w; x++) rays.push(0);
    for (let k = 0; k < 60; k++) {
      const cx = rnd() * w;
      const width = 2 + rnd() * 10;
      const amp = 0.25 + rnd() * 0.75;
      for (let x = 0; x < w; x++) {
        let d = Math.abs(x - cx);
        d = Math.min(d, w - d);
        rays[x] += amp * Math.exp(-(d * d) / (2 * width * width));
      }
    }
    const maxRay = Math.max(...rays);
    for (let y = 0; y < h; y++) {
      const u = y / (h - 1); // 0 oben … 1 unten
      // Profil: nach oben lang auslaufend, unten helle, weiche Kante
      const t = Math.min(1, Math.max(0, (1 - u) / 0.14));
      const bottomEdge = t * t * (3 - 2 * t);
      const prof = Math.pow(u, 1.7) * bottomEdge;
      for (let x = 0; x < w; x++) {
        const r = 0.45 + 0.55 * (rays[x] / maxRay);
        const a = Math.max(0, Math.min(1, prof * r));
        const i = (y * w + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    c.refresh();
  }
}

/** Splitter-Frames aus der Wortplanke schneiden (echte Holztextur) */
export function addSplinterFrames(scene: Phaser.Scene, key: string, rects: { x: number; y: number; w: number; h: number }[]): string[] {
  const t = scene.textures.get(key);
  const names: string[] = [];
  rects.forEach((r, i) => {
    const name = `splinter${i}`;
    if (!t.has(name)) t.add(name, 0, r.x, r.y, r.w, r.h);
    names.push(name);
  });
  return names;
}
