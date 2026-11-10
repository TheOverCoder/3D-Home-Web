import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/3D-Home-Web/").

/** A readable name for the loading screen's list of downloads. */
function labelFor(file: string): { label: string; kind: 'code' | 'model' | 'hdr' | 'texture' | 'other' } {
  const name = file.split('/').pop()!.replace(/-[\w-]{8}(?=\.)/, '') // drop the content hash
  const base = name.replace(/\.[^.]+$/, '')
  if (name.endsWith('.glb')) return { label: `Model · ${base.replace(/-/g, ' ')}`, kind: 'model' }
  if (/\.(hdr|exr)$/.test(name)) return { label: 'Sky light (HDR)', kind: 'hdr' }
  // the sky light as a JPEG with a gain map (src/assets/hdri/home.jpg)
  if (/\.jpe?g$/.test(name) && base === 'home') return { label: 'Sky light', kind: 'hdr' }
  if (/\.(jpe?g|png|webp|ktx2)$/.test(name)) return { label: `Texture · ${base.split('_')[0]}`, kind: 'texture' }
  if (name.endsWith('.css')) return { label: 'Styles', kind: 'other' }
  const known: Record<string, string> = {
    'vendor-physics': 'Physics engine (Rapier)',
    rapier_wasm3d_bg: 'Physics engine (Rapier)', // its WebAssembly, a file of its own (rapierWasmAsFile below)
    'vendor-three': '3D engine (three.js)',
    'vendor-r3f': 'Scene tools & film effects',
    'vendor-react': 'Interface (React)',
    Experience: 'The house, the garden and the farm',
    models: 'Animals, people and crops',
    realTextures: 'Texture loader',
    proceduralTextures: 'Surface painter',
  }
  return { label: known[base] ?? 'Game code', kind: 'code' }
}

/**
 * Rapier's compat build carries its WebAssembly as base64 inside the JS (2.2 MB of script, 830 KB gzipped); the
 * package also ships the same binary as a file: the build loads that instead (143 KB of script and the 1.57 MB file,
 * 612 KB gzipped together; compiled while it streams in, kept by the service worker like any other file). The dev
 * server keeps the package as it is. A changed pattern (another Rapier version) fails the build, not the game.
 */
function rapierWasmAsFile(): Plugin {
  // init's only argument in 0.19.x: `(<decoder>.toByteArray("<base64 wasm>").buffer)` (without `.buffer` the
  // replacement still builds but the game fails to start)
  const inlined = /\([\w$]+\.toByteArray\("AGFzbQ[A-Za-z0-9+/=]+"\)\.buffer\)/g
  return {
    name: 'home-rapier-wasm-file',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]@dimforge[\\/]rapier3d-compat[\\/]rapier\.mjs$/.test(id)) return
      if (code.match(inlined)?.length !== 1) this.error('@dimforge/rapier3d-compat: its inlined WebAssembly is not where this plugin expects it')
      return { code: `import rapierWasmUrl from './rapier_wasm3d_bg.wasm?url';\n${code.replace(inlined, '({ module_or_path: rapierWasmUrl })')}`, map: null }
    },
  }
}

/**
 * Writes two files into the build:
 * - assets-manifest.json: every file the 3D scene downloads after the page shell (its code, models, sky, textures)
 *   with its size — the loading screen fetches them with a progress count (src/lib/loader.ts).
 * - sw.js: a service worker that keeps the files on the device (src/sw-template.js), so the next visit loads
 *   from the phone or computer instead of the network. Hashed files never change and are served from the cache
 *   straight away; the page itself is fetched fresh when there is a connection (so new versions arrive).
 */
function offlineAndProgress(): Plugin {
  let base = '/'
  return {
    name: 'home-offline-and-progress',
    apply: 'build',
    configResolved(c) {
      base = c.base
    },
    generateBundle(_, bundle) {
      const entries = Object.values(bundle)
      const entry = entries.find((o) => o.type === 'chunk' && o.isEntry)
      // what the page shell loads by itself (the entry and everything it imports statically): already here
      const shell = new Set<string>()
      const walk = (fileName: string) => {
        if (shell.has(fileName)) return
        shell.add(fileName)
        const o = bundle[fileName]
        if (o?.type === 'chunk') {
          o.imports.forEach(walk)
          o.viteMetadata?.importedCss.forEach((css) => shell.add(css))
        }
      }
      if (entry) walk(entry.fileName)
      const sizeOf = (o: (typeof entries)[number]) => (o.type === 'chunk' ? Buffer.byteLength(o.code) : typeof o.source === 'string' ? Buffer.byteLength(o.source) : o.source.byteLength)
      const files = entries
        // (the model gallery, ?gallery, is a page of its own: the game never needs it)
        .filter((o) => !shell.has(o.fileName) && !/\.(map|json|txt)$/.test(o.fileName) && o.fileName !== 'sw.js' && !/[\\/]Gallery-/.test(o.fileName))
        .map((o) => ({ url: o.fileName, bytes: sizeOf(o), ...labelFor(o.fileName) }))
        .sort((a, b) => b.bytes - a.bytes)
      const all = entries.filter((o) => !/\.(map)$/.test(o.fileName)).map((o) => o.fileName)
      const version = createHash('sha256').update(all.sort().join('\n')).digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'assets-manifest.json', source: JSON.stringify({ version, files }, null, 1) })
      const shellFiles = ['', 'index.html', 'favicon.svg', ...[...shell].filter((f) => bundle[f])]
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: SW.replace('__VERSION__', version).replace('__BASE__', base).replace('__SHELL__', JSON.stringify(shellFiles)).replace('__FILES__', JSON.stringify(all)),
      })
    },
  }
}

// The service worker. Kept here (not in public/) because it carries the build's version and file list.
const SW = String.raw`/* 3D Home service worker: keeps the game on this device. Generated by vite.config.ts. */
const VERSION = '__VERSION__'
const BASE = '__BASE__'
const SHELL = __SHELL__ // the page and what it loads first: kept for offline starts
const FILES = __FILES__ // every file of this build: anything else in the cache is from an old version
const CACHE = 'home-' + VERSION
const at = (f) => new URL(BASE + f, self.location.origin).href
const KNOWN = new Set([...SHELL, ...FILES, 'og.jpg', 'favicon.svg'].map(at))

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL.map(at)))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // carry over the unchanged files (most of the engine) from the previous version, then drop it
      const keep = new Set(FILES.map(at))
      const cache = await caches.open(CACHE)
      for (const name of await caches.keys()) {
        if (name === CACHE || !name.startsWith('home-')) continue
        const old = await caches.open(name)
        for (const request of await old.keys()) {
          if (keep.has(request.url) && !(await cache.match(request))) {
            const response = await old.match(request)
            if (response) await cache.put(request, response)
          }
        }
        await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

// from the network, keeping a copy (the worker stays alive until the copy is written: big files take a moment)
const fresh = async (request, event) => {
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    const copy = response.clone()
    const write = caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
    if (event) event.waitUntil(write)
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('assets-manifest.json')) return
  if (request.mode === 'navigate') {
    // the page: from the network when there is one (a new version shows up at once), else the kept copy
    event.respondWith(
      fresh(request, event).catch(async () => (await caches.match(request, { ignoreSearch: true })) || (await caches.match(at('index.html'))) || Response.error()),
    )
    return
  }
  // only the game's own files: anything else on this origin (an API later on, a test's private path) is left alone
  if (!KNOWN.has(url.origin + url.pathname)) return
  if (url.pathname.startsWith(BASE + 'assets/')) {
    // content-hashed files never change: the kept copy, or download once and keep
    // (ignoreVary: a copy stored by a plain fetch serves a module-script request too, whatever "Vary" says)
    event.respondWith(caches.match(request, { ignoreVary: true }).then((hit) => hit || fresh(request, event)))
    return
  }
  // everything else (icons, preview image): the kept copy now, refreshed in the background
  event.respondWith(
    caches.match(request).then((hit) => {
      const update = fresh(request, event).catch(() => hit || Response.error())
      return hit || update
    }),
  )
})
`

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), rapierWasmAsFile(), offlineAndProgress()],
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
        // Priorities matter: a group also takes in what its modules import, so React (and Vite's preload helper),
        // which the 3D libraries import too, must be claimed first — or the page shell would have to download the
        // whole 3D bundle before the intro could show.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]|vite[\\/]preload-helper/, priority: 40 },
            { name: 'vendor-physics', test: /node_modules[\\/]@dimforge[\\/]/, priority: 30 },
            { name: 'vendor-three', test: /node_modules[\\/]three[\\/]/, priority: 20 },
            // the sculpted models and the kit they are made with: shared by the scene and the model gallery
            { name: 'models', test: /src[\\/](models[\\/](cow|sheep|chicken|person|crops|plants)|lib[\\/]sculpt[\\/])/, priority: 5 },
            { name: 'vendor-r3f', test: /node_modules[\\/](@react-three|three-stdlib|troika-[^\\/]+|camera-controls|postprocessing|n8ao|maath|ecctrl|three-mesh-bvh|@monogrid|meshline|stats-gl|suspend-react|its-fine|hls\.js)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
