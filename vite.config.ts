import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/3D-Home-Web/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr', '**/*.exr', '**/*.ktx2'],
  build: {
    target: 'es2022',
    // INLINE_ASSETS=1 embeds models/HDRIs as data: URIs — for hosts that only serve a fixed list of file types
    assetsInlineLimit: process.env.INLINE_ASSETS ? 100_000_000 : 0,
    chunkSizeWarningLimit: 3000,
  },
})
