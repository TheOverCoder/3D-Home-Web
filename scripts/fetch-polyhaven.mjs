#!/usr/bin/env node
// Downloads CC0 assets from Poly Haven (https://polyhaven.com) into the project.
//
//   npm run assets:hdri -- list  <hdris|models|textures> [--category furniture] [--search sofa]   find ids
//   npm run assets:hdri -- hdri  <id> [--res 2k] [--as home]    →  src/assets/hdri/<as>.hdr
//   npm run assets:hdri -- model <id> [--res 2k] [--as sofa]    →  src/assets/models/raw/props/.<as>-src/  (gltf + textures)
//   npm run assets:hdri -- texture <id> [--res 2k] [--as wood]  →  src/assets/textures/<as>/  (diffuse, normal, roughness)
//
// Then run `npm run assets:optimize` to turn raw models into compressed GLB.
// Poly Haven asks API users to credit them; this script appends a line to CREDITS.md.
//
// NOTE: written against the public API (api.polyhaven.com). It needs network access to api.polyhaven.com and
// dl.polyhaven.org and has NOT been run end to end — the sandbox this repo was scaffolded in blocks both hosts.
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

const [kind, id, ...rest] = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : fallback
}
if (!['hdri', 'model', 'texture', 'list'].includes(kind) || !id) {
  console.error('usage: fetch-polyhaven.mjs <hdri|model|texture> <asset-id> [--res 2k] [--as <name>]\n       fetch-polyhaven.mjs list <hdris|models|textures> [--category <c>] [--search <text>]')
  process.exit(1)
}
const res = opt('res', '2k')
const as = opt('as', kind === 'hdri' ? 'home' : kind === 'texture' ? 'wood' : id.toLowerCase())
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

if (kind === 'list') {
  const category = opt('category', '')
  const search = opt('search', '').toLowerCase()
  const all = await get(`https://api.polyhaven.com/assets?t=${id}${category ? `&c=${category}` : ''}`, true)
  const rows = Object.entries(all).filter(([k, v]) => !search || k.includes(search) || `${v.name} ${(v.tags ?? []).join(' ')}`.toLowerCase().includes(search))
  for (const [k, v] of rows) console.log(`${k.padEnd(34)} ${String(v.name).padEnd(32)} ${(v.categories ?? []).join(',')}`)
  console.log(`\n${rows.length} ${id}${category ? ` in ${category}` : ''}`)
  process.exit(0)
}

const files = await get(`https://api.polyhaven.com/files/${id}`, true)
console.log(`Poly Haven ${kind}: ${id} @ ${res}`)

if (kind === 'hdri') {
  const entry = files.hdri?.[res]?.hdr
  if (!entry) throw new Error(`no hdr at ${res}; available: ${Object.keys(files.hdri ?? {}).join(', ')}`)
  await save(entry.url, join('src/assets/hdri', `${as}.hdr`), entry.md5)
} else if (kind === 'texture') {
  // Poly Haven names the PBR channels Diffuse / nor_gl (OpenGL normals, what three.js wants) / Rough
  for (const [channel, short] of [['Diffuse', 'diff'], ['nor_gl', 'nor_gl'], ['Rough', 'rough']]) {
    const e = files[channel]?.[res]?.jpg
    if (!e) throw new Error(`no ${channel} jpg at ${res}; available: ${Object.keys(files[channel] ?? {}).join(', ') || 'none'}`)
    await save(e.url, join('src/assets/textures', as, `${id}_${short}_${res}.jpg`), e.md5)
  }
  console.log(`\nthe app picks the folder name up as a surface: wood, tile, carpet, plaster, fabric, grass, veneer, leather, brushed, stone, paint`)
  console.log(`(adjust the floor repeat in src/scene/Floors.tsx TILE if the real texture covers a different size)`)
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
