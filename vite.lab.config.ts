import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// The design lab (lab/, lab/README.md): the game's interface on phone frames with no game round it — design references
// built side by side and chosen before anything goes into the game. `npm run lab` serves it as you work (port 5180);
// `npm run lab:build` makes dist-lab, published as a link of its own in seconds (no CI: it is not the game).
export default defineConfig({
  root: resolve(__dirname, 'lab'),
  base: './',
  publicDir: false,
  plugins: [react()],
  server: { port: 5180, strictPort: true, host: true, fs: { allow: [resolve(__dirname)] } },
  build: {
    outDir: resolve(__dirname, 'dist-lab'),
    emptyOutDir: true,
    // every picture a file of its own (the link's files), none inlined into the script
    assetsInlineLimit: 0,
    rollupOptions: { input: { index: resolve(__dirname, 'lab/index.html'), frame: resolve(__dirname, 'lab/frame.html') } },
  },
})
