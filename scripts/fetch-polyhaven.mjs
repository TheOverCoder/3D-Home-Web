#!/usr/bin/env node
// Downloads CC0 assets from Poly Haven (https://polyhaven.com) into the project.
//
//   npm run assets:hdri -- hdri  <id> [--res 2k] [--as home]    →  src/assets/hdri/<as>.hdr
//   npm run assets:hdri -- model <id> [--res 2k] [--as sofa]    →  src/assets/models/raw/props/<as>.gltf (+ textures)
//
// Then run `npm run assets:optimize` to turn raw models into compressed GLB.
// Poly Haven asks API users to credit them; this script appends a line to CREDITS.md.
//
// NOTE: written against the public API (api.polyhaven.com/files/<id>). It needs network access to
// api.polyhaven.com and dl.polyhaven.org and has not been run from the sandbox this repo was scaffolded in.
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

const [kind, id, ...rest] = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : fallback
}
if (!['hdri', 'model'].includes(kind) || !id) {
  console.error('usage: fetch-polyhaven.mjs <hdri|model> <asset-id> [--res 2k] [--as <name>]')
  process.exit(1)
}
const res = opt('res', '2k')
const as = opt('as', kind === 'hdri' ? 'home' : id.toLowerCase())
const headers = { 'User-Agent': '3d-home-web asset fetcher' }

async function get(url, asJson = false) {
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`)
  return asJson ? r.json() : Buffer.from(await r.arrayBuffer())
}

async function save(url, path, md5) {
  const data = await get(url)
  if (md5 && createHash('md5').update(data).digest('hex') !== md5) throw new Error(`checksum mismatch for ${url}`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
  console.log(`  ${path}  (${(data.length / 1e6).toFixed(2)} MB)`)
}

const files = await get(`https://api.polyhaven.com/files/${id}`, true)
console.log(`Poly Haven ${kind}: ${id} @ ${res}`)

if (kind === 'hdri') {
  const entry = files.hdri?.[res]?.hdr
  if (!entry) throw new Error(`no hdr at ${res}; available: ${Object.keys(files.hdri ?? {}).join(', ')}`)
  await save(entry.url, join('src/assets/hdri', `${as}.hdr`), entry.md5)
} else {
  const entry = files.gltf?.[res]?.gltf
  if (!entry) throw new Error(`no gltf at ${res}; available: ${Object.keys(files.gltf ?? {}).join(', ')}`)
  const dir = join('src/assets/models/raw/props', `.${as}-src`)
  // the .gltf references its textures and .bin by relative path, so keep the layout from `include`
  await save(entry.url, join(dir, `${as}.gltf`), entry.md5)
  for (const [rel, f] of Object.entries(entry.include ?? {})) await save(f.url, join(dir, rel), f.md5)
  console.log(`\nraw files in ${dir}. Optimise with: node scripts/optimize-models.mjs --in ${dir} --out src/assets/models/props`)
  console.log(`(the output keeps the input name, so rename ${as}.glb if the prop id differs)`)
}

if (!existsSync('CREDITS.md')) writeFileSync('CREDITS.md', '# Credits\n\n')
appendFileSync('CREDITS.md', `- Poly Haven — ${kind} “${id}” (CC0) — https://polyhaven.com/a/${id}\n`)
