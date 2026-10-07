import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/3D-Home-Web/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr', '**/*.exr', '**/*.ktx2'],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 3000,
  },
})
