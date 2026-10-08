#!/usr/bin/env node
// Downloads the assets listed in scripts/assets.manifest.json (any host the environment can reach —
// raw.githubusercontent.com works from the cloud sandbox; add Poly Haven / Quaternius URLs once those are allowed).
//
//   npm run assets:fetch                 everything in the manifest
//   npm run assets:fetch -- --only sofa  one entry (by id)
//   npm run assets:fetch -- --list       show what is in the manifest
//
// Models land in src/assets/models/raw/ — run `npm run assets:optimize` next to compress them into src/assets/models/.
// Credits (src/data/credits.ts + CREDITS.md) are written by hand from the manifest's license field; CC-BY needs them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const manifest = JSON.parse(readFileSync(new URL('./assets.manifest.json', import.meta.url), 'utf8'))
const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

if (args.includes('--list')) {
  for (const a of manifest) console.log(`${a.id.padEnd(24)} ${a.license.padEnd(10)} ${a.what}\n  ${a.url}`)
  process.exit(0)
}

let failed = 0
for (const a of manifest) {
  if (only && a.id !== only) continue
  try {
    const r = await fetch(a.url, { headers: { 'User-Agent': '3d-home-web asset fetcher' } })
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    const data = Buffer.from(await r.arrayBuffer())
    mkdirSync(dirname(a.dest), { recursive: true })
    writeFileSync(a.dest, data)
    console.log(`ok   ${a.id.padEnd(24)} ${(data.length / 1e6).toFixed(2)} MB → ${a.dest}  [${a.license}]`)
  } catch (e) {
    failed++
    console.error(`FAIL ${a.id}: ${e.message}  (${a.url})`)
    if (existsSync(a.dest)) console.error(`     keeping the existing ${a.dest}`)
  }
}
process.exit(failed ? 1 : 0)
