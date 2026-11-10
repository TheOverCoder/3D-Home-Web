import { createRequire } from 'node:module'
import { defineConfig, type Plugin } from 'vitest/config'

// In the browser `manifold-3d/manifold.wasm?url` is a URL the page fetches; in Node it must be the file's path, or
// the solid engine fails to load (quietly: the models are built without their cuts and the checks pass anyway).
const wasmPathInNode = (): Plugin => ({
  name: 'wasm-url-as-path',
  enforce: 'pre',
  resolveId: (id) => (id === 'manifold-3d/manifold.wasm?url' ? '\0manifold-wasm-path' : null),
  load: (id) => (id === '\0manifold-wasm-path' ? `export default ${JSON.stringify(createRequire(import.meta.url).resolve('manifold-3d/manifold.wasm'))}` : null),
})

// Unit tests: pure logic in Node (no browser, no WebGL). The Playwright specs in tests/e2e are not Vitest's.
export default defineConfig({ plugins: [wasmPathInNode()], test: { include: ['src/**/*.test.ts'], environment: 'node' } })
