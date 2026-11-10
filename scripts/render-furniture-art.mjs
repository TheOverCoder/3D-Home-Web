// Draws the furniture's pictures from the pieces (src/home/FurnitureArtPage.tsx) and saves them as WebP files in
// src/assets/furniture, which src/home/pictures.ts serves. Run it with the dev server up (npm run dev):
//
//   node scripts/render-furniture-art.mjs [http://localhost:5173/] [--shot page.png]
//
// It opens the site with ?furniture in Playwright's Chromium (PW_CHROMIUM_PATH if set), waits for every picture and
// writes them; --shot also saves a screenshot of the page, to look at them side by side.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const shotAt = args.indexOf('--shot')
const shot = shotAt >= 0 ? args.splice(shotAt, 2)[1] : null
const base = args[0] ?? 'http://localhost:5173/'
const out = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/furniture')

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 } })
  page.on('pageerror', (e) => console.error('[page]', e.message))
  await page.goto(new URL('?furniture', base).href)
  await page.waitForFunction(() => window.__furnitureArt, null, { timeout: 120_000 })
  const items = await page.evaluate(() => window.__furnitureArt)
  await mkdir(out, { recursive: true })
  for (const [id, url] of Object.entries(items)) {
    const [head, data] = url.split(',')
    if (!head.includes('image/webp')) throw new Error(`${id}: the browser did not make a WebP (${head})`)
    const bytes = Buffer.from(data, 'base64')
    await writeFile(join(out, `${id}.webp`), bytes)
    console.log(`${id}.webp  ${(bytes.length / 1024).toFixed(1)} KB`)
  }
  if (shot) {
    await page.waitForTimeout(300)
    await page.screenshot({ path: shot, fullPage: true })
  }
} finally {
  await browser.close()
}
