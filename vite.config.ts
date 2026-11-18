import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/3D-Home-Web/").

/** A readable name for the loading screen's list of downloads. */
function labelFor(file: string): { label: string; kind: 'code' | 'model' | 'hdr' | 'texture' | 'other' } {
  const name = file
    .split('/')
    .pop()!
    .replace(/-[\w-]{8}(?=\.)/, '') // drop the content hash
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

// The 3D side: the physics engine, three.js, the scene's libraries and the sculpted models (each a chunk of its own, in
// the groups below) and the scene itself. The loader downloads it while the intro shows and the scene imports it once
// you play; the page shell (the intro, the opening menu, the loading screen, the saves) imports none of it.
const PHYSICS = /node_modules[\\/]@dimforge[\\/]/
const THREE = /node_modules[\\/]three[\\/]/
const R3F =
  /node_modules[\\/](@react-three|three-stdlib|troika-[^\\/]+|camera-controls|postprocessing|n8ao|maath|ecctrl|three-mesh-bvh|@monogrid|meshline|stats-gl|suspend-react|its-fine|hls\.js)[\\/]/
const MODELS = /src[\\/](models[\\/](cow|sheep|chicken|person|crops|plants)|lib[\\/]sculpt[\\/])/
const THREE_SIDE = [PHYSICS, THREE, R3F, MODELS, /src[\\/]scene[\\/]Experience\./]

/** Everything reached from `start` along `next`, breadth first, each with the one it was first reached from. */
function reach(start: string, next: (at: string) => readonly string[]) {
  const from = new Map<string, string | null>([[start, null]])
  for (const at of from.keys()) for (const n of next(at)) if (!from.has(n)) from.set(n, at) // a Map's keys() goes on to keys added meanwhile
  return from
}

/** The way `reach` came to `end`, from its start. */
function wayTo(from: Map<string, string | null>, end: string) {
  const way: string[] = []
  for (let at: string | null = end; at; at = from.get(at) ?? null) way.unshift(at)
  return way
}

/**
 * The most the page shell may weigh, gzipped (bytes): the entry, every chunk it imports statically and their styles —
 * what index.html loads before the intro shows (update-v1 decision 18: 160 KB). Measured 155.3 KB with the game's
 * interface (src/ui/GameLayer.tsx), the farm's state and the menu's pages that read it or are built with Radix
 * (src/ui/SavesPanel.tsx, IntroPages.tsx), the goods' pictures and the confetti out of it: React 69, the libraries the
 * intro needs (Motion above all) 37, the intro, the loading screen and what they read 31, the styles 18. Measured at the
 * default level of gzip, as served.
 */
export const SHELL_BYTES = 160_000

/** The shell's files with their gzipped sizes, biggest first (each file gzipped alone, as it is served). */
function shellSizes(files: { name: string; code: string | Uint8Array }[]) {
  return files.map((f) => ({ name: f.name, bytes: gzipSync(f.code).length })).sort((a, b) => b.bytes - a.bytes)
}

/**
 * Keeps the page shell light: the entry and every chunk it imports statically (what index.html loads and preloads
 * before the intro shows) hold nothing of the 3D side. One static import from the shell's code into it (a constant
 * read from a module that also draws, say) would put three.js in front of the intro on every phone: the build fails
 * instead, naming the chain of imports to cut (move what the shell needs into a module without three.js, or import
 * the 3D side with `import()`). 11-startup checks the served index.html the same way (and `shellWeight` its weight).
 */
function lightShell(): Plugin {
  return {
    name: 'home-light-shell',
    apply: 'build',
    generateBundle(_, bundle) {
      const entry = Object.values(bundle).find((o) => o.type === 'chunk' && o.isEntry)
      if (entry?.type !== 'chunk') return
      const heavy = (id: string) => THREE_SIDE.some((t) => t.test(id))
      const short = (id: string) =>
        id
          .replace(/^.*[\\/]node_modules[\\/]/, '')
          .replace(process.cwd(), '')
          .replace(/^[\\/]/, '')
      const chunk = (f: string) => {
        const o = bundle[f]
        return o?.type === 'chunk' ? o : undefined
      }
      // the chunks the shell loads (static imports only), each with the chunk that imports it
      const shell = reach(entry.fileName, (f) => chunk(f)?.imports ?? [])
      for (const f of shell.keys()) {
        const bad = chunk(f)?.moduleIds.find(heavy)
        if (!bad) continue
        // the static imports from the entry's module into the 3D side: where to cut
        const modules = reach(entry.facadeModuleId!, (id) => (heavy(id) ? [] : (this.getModuleInfo(id)?.importedIds ?? [])))
        const hit = [...modules.keys()].find(heavy)
        this.error(
          `The page shell loads the 3D side before the intro: ${wayTo(shell, f).join(' → ')} holds ${short(bad)}.` +
            (hit ? `\nImported by: ${wayTo(modules, hit).map(short).join(' → ')}` : '') +
            `\nThe shell may import only what the intro, the menu and the loading screen need: move what it reads into a module without three.js, or import the 3D side with import().`,
        )
      }
    },
  }
}

/**
 * Keeps the page shell's weight (the entry, every chunk it imports statically, and their styles: what index.html loads
 * before the intro shows) at SHELL_BYTES gzipped or less: past it the build fails, naming the biggest files. It runs
 * after every other plugin, on the files as they are served.
 */
function shellWeight(): Plugin {
  return {
    name: 'home-shell-weight',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const entry = Object.values(bundle).find((o) => o.type === 'chunk' && o.isEntry)
        if (entry?.type !== 'chunk') return
        const files: { name: string; code: string | Uint8Array }[] = []
        const walk = (f: string) => {
          const c = bundle[f]
          if (c?.type !== 'chunk' || files.some((x) => x.name === f)) return
          files.push({ name: f, code: c.code })
          for (const css of c.viteMetadata?.importedCss ?? []) {
            const a = bundle[css]
            if (a?.type === 'asset' && !files.some((x) => x.name === css)) files.push({ name: css, code: a.source })
          }
          c.imports.forEach(walk)
        }
        walk(entry.fileName)
        const sizes = shellSizes(files)
        const total = sizes.reduce((n, s) => n + s.bytes, 0)
        if (total > SHELL_BYTES)
          this.error(
            `The page shell is ${total.toLocaleString('en-US')} bytes gzipped, over SHELL_BYTES (${SHELL_BYTES.toLocaleString('en-US')}): what the intro needs comes first, the rest with import().` +
              `\nIts biggest files: ${sizes
                .slice(0, 6)
                .map((s) => `${s.name} ${s.bytes.toLocaleString('en-US')}`)
                .join(', ')}`,
          )
      },
    },
  }
}

/** The developer pages and tools (?gallery, ?furniture, ?items, ?tune, ?console, ?debug&stress: the model gallery's
 *  chunk and the dev-* groups below): they load only when their flag is used, so the loader does not download them for
 *  every player and the service worker does not keep them. */
const devOnly = (fileName: string) => /(?:^|[\\/])(?:Gallery|dev-[a-z]+)-[\w-]{8}\.js$/.test(fileName)

/** The farm's particle effects (three.quarks, the `effects` group below): the game imports them once it is playing, so
 *  the loader does not download them up front; the service worker still keeps them once they are fetched. */
const later = (fileName: string) => /(?:^|[\\/])effects-[\w-]{8}\.js$/.test(fileName)

/**
 * Writes two files into the build:
 * - assets-manifest.json: every file the 3D scene downloads after the page shell (its code, models, sky, textures)
 *   with its size — the loading screen fetches them with a progress count (src/lib/loader.ts).
 * - sw.js: a service worker that keeps the files on the device (src/sw-template.js), so the next visit loads
 *   from the phone or computer instead of the network. Hashed files never change and are served from the cache
 *   straight away; the page itself is fetched fresh when there is a connection (so new versions arrive).
 * Neither lists the developer pages and tools (`devOnly`).
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
        .filter((o) => !shell.has(o.fileName) && !/\.(map|json|txt)$/.test(o.fileName) && o.fileName !== 'sw.js' && !devOnly(o.fileName) && !later(o.fileName))
        .map((o) => ({ url: o.fileName, bytes: sizeOf(o), ...labelFor(o.fileName) }))
        .sort((a, b) => b.bytes - a.bytes)
      // the version goes by every file (a change to a developer page still makes a new one); the worker keeps the game's
      const all = entries.filter((o) => !o.fileName.endsWith('.map')).map((o) => o.fileName)
      const version = createHash('sha256').update(all.sort().join('\n')).digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'assets-manifest.json', source: JSON.stringify({ version, files }, null, 1) })
      const shellFiles = ['', 'index.html', 'favicon.svg', ...[...shell].filter((f) => bundle[f])]
      const kept = all.filter((f) => !devOnly(f))
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: SW.replace('__VERSION__', version).replace('__BASE__', base).replace('__SHELL__', JSON.stringify(shellFiles)).replace('__FILES__', JSON.stringify(kept)),
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
  plugins: [react(), rapierWasmAsFile(), lightShell(), shellWeight(), offlineAndProgress()],
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
            // the developer tools and pages, each a chunk of its own (`devOnly`: not downloaded up front, not kept by
            // the service worker). Only their own modules: what they share with the game stays in the game's chunks
            // (the game reaches them only by a dynamic import behind their flag, so no import cycle can form)
            { name: 'dev-console', test: /node_modules[\\/]eruda[\\/]|src[\\/]debug[\\/]console\./, priority: 51, includeDependenciesRecursively: false },
            { name: 'dev-stress', test: /src[\\/]debug[\\/]Stress\./, priority: 51, includeDependenciesRecursively: false },
            { name: 'dev-tune', test: /node_modules[\\/]lil-gui[\\/]|src[\\/]debug[\\/]/, priority: 50, includeDependenciesRecursively: false },
            { name: 'dev-pages', test: /src[\\/](home[\\/]FurnitureArtPage|models[\\/](ItemArtPage|itemArt))\./, priority: 50, includeDependenciesRecursively: false },
            // the particle engine and the effects made with it, imported once the game is playing (`later`)
            { name: 'effects', test: /node_modules[\\/](three\.quarks|quarks\.core)[\\/]|src[\\/]fx[\\/]quarks\./, priority: 45, includeDependenciesRecursively: false },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]|vite[\\/]preload-helper/, priority: 40 },
            // the page shell (what index.html loads before the intro: every module the entry imports statically) in
            // three files rather than a dozen pieces shared with the scene: React, the other libraries it needs
            // (long-lived, like React), and the game's own code with the entry. The same code, fewer requests, and
            // gzip finds more to share in one stream (5 KB less of SHELL_BYTES); the scene and the game's interface
            // import it from there, already loaded
            { name: 'vendor-shell', tags: ['$initial'], test: /node_modules[\\/]/, priority: 36 },
            { name: 'shell', tags: ['$initial'], priority: 35 },
            { name: 'vendor-physics', test: PHYSICS, priority: 30 },
            { name: 'vendor-three', test: THREE, priority: 20 },
            // the sculpted models and the kit they are made with: shared by the scene and the model gallery. Only their own
            // modules: pulled in with what they import, it took the device profile, which the page shell reads, and so put
            // three.js and the models in front of the intro (362 KB instead of 151 KB before it shows; 11-startup)
            { name: 'models', test: MODELS, priority: 5, includeDependenciesRecursively: false },
            { name: 'vendor-r3f', test: R3F, priority: 10 },
          ],
        },
      },
    },
  },
})
