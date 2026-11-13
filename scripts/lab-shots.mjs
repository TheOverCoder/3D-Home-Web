// Pictures of the design lab's screens, to check a variant at a phone's size before it is shown: each variant of a
// board in each state, on a phone upright (390×844) and sideways (844×390), at twice the pixels. With the lab served
// (`npm run lab`, port 5180, or the build: `npx vite preview --config vite.lab.config.ts --port 5180`):
//
//   node scripts/lab-shots.mjs <board> <out-dir> [variant,variant…] [http://localhost:5180/]
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const [board, out, only, base = 'http://localhost:5180/'] = process.argv.slice(2)
if (!board || !out) throw new Error('usage: node scripts/lab-shots.mjs <board> <out-dir> [variants] [base]')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined })
try {
  const page = await browser.newPage()
  await page.goto(new URL('frame.html', base).href)
  // the board's variants and states, as the lab has them
  await page.waitForFunction(() => window.__lab, null, { timeout: 30_000 })
  const { variants, states } = await page.evaluate((id) => window.__lab.find((b) => b.id === id) ?? { variants: [], states: [] }, board)
  const which = only ? only.split(',') : variants.length ? variants : ['today']
  for (const { name, viewport } of [
    { name: 'upright', viewport: { width: 390, height: 844 } },
    { name: 'sideways', viewport: { width: 844, height: 390 } },
  ]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => console.error('[page]', e.message))
    for (const v of which)
      for (const s of states.length ? states : ['']) {
        await p.goto(new URL(`frame.html#${board}/${v}/${s}/0`, base).href)
        await p.waitForTimeout(900)
        const file = join(out, `${board}-${v}-${s || 'state'}-${name}.png`)
        await p.screenshot({ path: file })
        console.log(file)
      }
    await ctx.close()
  }
} finally {
  await browser.close()
}
