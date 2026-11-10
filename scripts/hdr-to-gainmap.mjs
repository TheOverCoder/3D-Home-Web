// Saves the sky light (src/assets/hdri/*.hdr) as a JPEG with a gain map beside it (src/assets/hdri/<name>.jpg):
// the same light, a fraction of the download. Run it with the dev server up (npm run dev):
//
//   node scripts/hdr-to-gainmap.mjs [http://localhost:5173/]
//
// It opens the site with ?gainmap in Playwright's Chromium (PW_CHROMIUM_PATH if set), which encodes each .hdr in
// src/assets/hdri or src/assets/hdri/raw (src/tools/hdrToGainmap.ts), writes the JPEGs, and moves an .hdr it has
// converted into src/assets/hdri/raw, which is neither shipped nor committed (src/assets/registry.ts takes the
// JPEG). Today's sky came from `npm run assets:hdri -- hdri blouberg_sunrise_2 --res 1k --as home`.
import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:5173/'
const out = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/hdri')

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('[page]', e.message))
  await page.goto(new URL('?gainmap', base).href)
  await page.waitForFunction(() => window.__gainmap, null, { timeout: 180_000 })
  const files = await page.evaluate(() => window.__gainmap)
  for (const [name, b64] of Object.entries(files)) {
    const bytes = Buffer.from(b64, 'base64')
    await writeFile(join(out, `${name}.jpg`), bytes)
    console.log(`${name}.jpg  ${(bytes.length / 1024).toFixed(1)} KB`)
    // the source stays, where it is not shipped
    const hdr = join(out, `${name}.hdr`)
    if (await stat(hdr).catch(() => null)) {
      await mkdir(join(out, 'raw'), { recursive: true })
      await rename(hdr, join(out, 'raw', `${name}.hdr`))
      console.log(`${name}.hdr  → raw/`)
    }
  }
} finally {
  await browser.close()
}
