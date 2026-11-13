// The game stills behind the design lab's phones (lab/stills): the yard as it is under an open panel — the chips at the
// top, the scene, the touch controls as a panel leaves them — on a phone held upright and sideways, at twice the
// pixels. Run it with the dev server up (npm run dev):
//
//   node scripts/lab-stills.mjs [http://localhost:5173/]
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.argv[2] ?? 'http://localhost:5173/'
const out = join(dirname(fileURLToPath(import.meta.url)), '../lab/stills')
const PHONES = [
  { name: 'yard-upright', viewport: { width: 390, height: 844 } },
  { name: 'yard-sideways', viewport: { width: 844, height: 390 } },
]

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  for (const { name, viewport } of PHONES) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    await page.goto(new URL('?debug&quality=medium', base).href)
    await page.waitForFunction(() => document.querySelector('.intro .primary:not(:disabled)'), null, { timeout: 300_000, polling: 500 })
    await page.locator('.intro .primary').click()
    await page.waitForFunction(() => window.__home?.useHome.getState().room != null && !!window.__home.teleport, null, { timeout: 180_000, polling: 500 })
    // the yard before noon, from the garden door across the beds; a panel open, then hidden (the scene as it is under one)
    await page.evaluate(() => {
      const h = window.__home
      h.farm.state.started = true
      h.farm.setHour(11)
      h.farm.freezeDay(true)
      h.teleport(-2.5, 1.4, 7.6)
      h.look.yaw = Math.PI + 0.45
      h.look.pitch = -0.16
      h.useHome.getState().openPanel({ kind: 'goals' })
    })
    await page.addStyleTag({ content: '.farm-backdrop { display: none !important; }' })
    await page.waitForTimeout(6000)
    await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 80 })
    console.log(`${name}.jpg`)
    await ctx.close()
  }
} finally {
  await browser.close()
}
