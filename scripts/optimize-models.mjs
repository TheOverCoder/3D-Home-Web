#!/usr/bin/env node
// Optimises raw .glb/.gltf files for the web: meshopt geometry compression + WebP textures.
//
//   npm run assets:optimize                      raw/  →  models/   (same relative paths)
//   npm run assets:optimize -- --only pouf       just the files whose name starts with "pouf"
//   node scripts/optimize-models.mjs --in <dir> --out <dir> [--size 2048]
//
// Put downloads in src/assets/models/raw/ (git-ignored) using the final names, e.g.
//   raw/house.glb  raw/character.glb  raw/animations.glb  raw/props/sofa.glb
// Per-file settings come from scripts/assets.manifest.json (matched on `dest`): `textureSize` caps the
// textures (small props need 512–1024 px, not 2K) and `simplify` (0–1, share of vertices kept; `simplifyError`
// = allowed deviation as a fraction of the model's size, default 0.001) thins out over-dense meshes. The app loads meshopt-compressed GLB out of the box; it does not need a Draco/KTX2 decoder.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, extname, resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const inDir = resolve(flag('in', 'src/assets/models/raw'))
const outDir = resolve(flag('out', 'src/assets/models'))
const size = flag('size', '2048')
const only = flag('only', null)

const manifest = JSON.parse(readFileSync(new URL('./assets.manifest.json', import.meta.url), 'utf8'))
const settings = new Map(manifest.filter((a) => a.kind === 'model').map((a) => [resolve(a.dest), a]))

if (!existsSync(inDir)) {
  console.error(`Nothing to do: ${inDir} does not exist. Put raw .glb/.gltf files there first.`)
  process.exit(1)
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : ['.glb', '.gltf'].includes(extname(p).toLowerCase()) ? [p] : []
  })

const files = walk(inDir).filter((p) => !only || p.split('/').pop().startsWith(only))
if (files.length === 0) {
  console.error(`No .glb/.gltf files found in ${inDir}`)
  process.exit(1)
}

let failed = 0
for (const input of files) {
  const rel = relative(inDir, input).replace(/\.gltf$/i, '.glb')
  const output = join(outDir, rel)
  const entry = settings.get(input) ?? {}
  const simplify = entry.simplify
    ? ['--simplify', 'true', '--simplify-ratio', String(entry.simplify), '--simplify-error', String(entry.simplifyError ?? 0.001)]
    : ['--simplify', 'false']
  mkdirSync(dirname(output), { recursive: true })
  console.log(`\n→ ${rel}${entry.textureSize ? `  (textures ≤ ${entry.textureSize}px)` : ''}${entry.simplify ? `  (simplify to ${entry.simplify})` : ''}`)
  const r = spawnSync(
    'npx',
    ['--no-install', 'gltf-transform', 'optimize', input, output, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', String(entry.textureSize ?? size), ...simplify],
    { stdio: 'inherit' },
  )
  if (r.status !== 0) {
    failed++
    console.error(`  failed: ${rel}`)
  } else {
    console.log(`  ${(statSync(input).size / 1e6).toFixed(2)} MB  →  ${(statSync(output).size / 1e6).toFixed(2)} MB`)
  }
}
process.exit(failed ? 1 : 0)
