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
    rolldownOptions: {
      output: {
        // Libraries change far less often than the app: give the big ones their own long-lived chunks so a
        // redeploy only invalidates the (small) app code, and the browser can fetch them in parallel.
        codeSplitting: {
          groups: [
            { name: 'vendor-physics', test: /node_modules[\\/]@dimforge[\\/]/ },
            { name: 'vendor-three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'vendor-r3f', test: /node_modules[\\/](@react-three|three-stdlib|troika-[^\\/]+|camera-controls|postprocessing|n8ao|maath|ecctrl|three-mesh-bvh|@monogrid|meshline|stats-gl|suspend-react|its-fine|hls\.js)[\\/]/ },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]/ },
          ],
        },
      },
    },
  },
})
