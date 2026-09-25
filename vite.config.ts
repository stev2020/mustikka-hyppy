import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { rmSync } from 'node:fs';
import { transform } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Die fertigen Grafiken liegen in ./assets und werden unverändert ausgeliefert
// (im Dev-Server unter /, im Build nach dist/ kopiert). base './' sorgt für
// relative Pfade – nötig für Capacitor (Android) und für das Einbetten.
//
// `npm run handy` startet den Dev-Server im WLAN über HTTPS (selbst signiertes
// Zertifikat). Browser erlauben den Neigungssensor nur auf HTTPS-Seiten.
//
// `npm run build:embed` baut das Spiel als ES-Modul für die Einbettung in eine
// Lern-App (z. B. den Suomi-Satztrainer): dist-embed/mustikka-hyppy.js plus
// Grafiken und Schrift. Der Anki-Import (sql.js, fflate, fzstd) bleibt draußen;
// eingebettet wird er mit settings.allowImport = false nie geladen.
export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: 'assets',
  server: mode === 'handy' ? { host: true } : undefined,
  build:
    mode === 'embed'
      ? {
          outDir: 'dist-embed',
          minify: 'esbuild' as const,
          emptyOutDir: true,
          chunkSizeWarningLimit: 2000,
          lib: { entry: 'src/index.ts', formats: ['es' as const], fileName: () => 'mustikka-hyppy.js' },
          rollupOptions: { external: ['sql.js', 'fflate', 'fzstd', /^sql\.js\//], output: { inlineDynamicImports: true } },
        }
      : {
          outDir: 'dist',
          chunkSizeWarningLimit: 2000,
        },
  plugins: [
    ...(mode === 'handy' ? [basicSsl()] : []),
    // Vite minimiert ES-Bibliotheken nicht vollständig; für die Einbettung voll minimieren
    ...(mode === 'embed'
      ? [{ name: 'minify-embed', apply: 'build' as const, async renderChunk(code: string) { return (await transform(code, { minify: true, format: 'esm', target: 'es2020' })).code; } }]
      : []),
    {
      name: 'strip-blender-scripts',
      apply: 'build' as const,
      closeBundle() {
        // Die Blender-Skripte gehören nicht ins ausgelieferte Spiel.
        for (const out of ['./dist/_blender_scripts', './dist-embed/_blender_scripts']) rmSync(fileURLToPath(new URL(out, import.meta.url)), { recursive: true, force: true });
      },
    },
  ],
}));
