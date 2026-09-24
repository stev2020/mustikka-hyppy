import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Die fertigen Grafiken liegen in ./assets und werden unverändert ausgeliefert
// (im Dev-Server unter /, im Build nach dist/ kopiert). base './' sorgt für
// relative Pfade – nötig für Capacitor (Android) und für das Einbetten.
//
// `npm run handy` startet den Dev-Server im WLAN über HTTPS (selbst signiertes
// Zertifikat). Browser erlauben den Neigungssensor nur auf HTTPS-Seiten.
export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: 'assets',
  server: mode === 'handy' ? { host: true } : undefined,
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    ...(mode === 'handy' ? [basicSsl()] : []),
    {
      name: 'strip-blender-scripts',
      apply: 'build' as const,
      closeBundle() {
        // Die Blender-Skripte gehören nicht ins ausgelieferte Spiel.
        rmSync(fileURLToPath(new URL('./dist/_blender_scripts', import.meta.url)), { recursive: true, force: true });
      },
    },
  ],
}));
