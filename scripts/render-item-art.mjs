// Draws the farm's item pictures from the models (src/models/itemArt.ts) and saves them as WebP files in
// src/assets/items, and the wardrobe's garments in src/assets/garments, which src/farm/icons.ts serves. Run it with
// the dev server up (npm run dev):
//
//   node scripts/render-item-art.mjs [http://localhost:5173/] [--shot page.png]
//
// It opens the site with ?items in Playwright's Chromium (PW_CHROMIUM_PATH if set), waits for every picture and
// writes them; --shot also saves a screenshot of the page, to look at them side by side.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const shotAt = args.indexOf('--shot')
const shot = shotAt >= 0 ? args.splice(shotAt, 2)[1] : null
const base = args[0] ?? 'http://localhost:5173/'
const out = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/items')
const clothes = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/garments')

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 } })
  page.on('pageerror', (e) => console.error('[page]', e.message))
  await page.goto(new URL('?items', base).href)
  await page.waitForFunction(() => window.__itemArt, null, { timeout: 120_000 })
  const { items, garments } = await page.evaluate(() => ({ items: window.__itemArt, garments: window.__garmentArt }))
  for (const [dir, pictures] of [
    [out, items],
    [clothes, garments],
  ]) {
    await mkdir(dir, { recursive: true })
    let total = 0
    for (const [id, url] of Object.entries(pictures)) {
      const [head, data] = url.split(',')
      if (!head.includes('image/webp')) throw new Error(`${id}: the browser did not make a WebP (${head})`)
      const bytes = Buffer.from(data, 'base64')
      total += bytes.length
      await writeFile(join(dir, `${id}.webp`), bytes)
      if (dir === out) console.log(`${id}.webp  ${(bytes.length / 1024).toFixed(1)} KB`)
    }
    if (dir === clothes) console.log(`${Object.keys(pictures).length} garments, ${(total / 1024).toFixed(0)} KB`)
  }
  if (shot) {
    await page.waitForTimeout(300)
    await page.screenshot({ path: shot, fullPage: true })
  }
} finally {
  await browser.close()
}
