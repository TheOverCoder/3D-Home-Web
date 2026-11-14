// The game stills behind the design lab's phones (lab/stills): the yard as it is under an open panel — the chips at the
// top, the scene, the touch controls as a panel leaves them — on a phone held upright and sideways, at twice the
// pixels, with the phone's safe areas (the notch, the home bar: lab/devices.ts) as the game, full screen, keeps clear
// of them. Beside each, <name>.json: where the screen's own buttons and chips are in it (the level chip, the coins, the
// gear…), the spots the lab's sandbox opens a board from; and yard-clean-*.jpg, the same with nothing at the top (for a
// board that designs the top itself). Run it with the dev server up (npm run dev):
//
//   node scripts/lab-stills.mjs [http://localhost:5173/]
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.argv[2] ?? 'http://localhost:5173/'
const out = join(dirname(fileURLToPath(import.meta.url)), '../lab/stills')
// the sizes and safe areas of lab/devices.ts
const PHONES = [
  { name: 'yard-upright', viewport: { width: 390, height: 844 }, safe: { top: 47, right: 0, bottom: 34, left: 0 } },
  { name: 'yard-sideways', viewport: { width: 844, height: 390 }, safe: { top: 0, right: 47, bottom: 21, left: 47 } },
]

// where the screen's own buttons and chips are, in CSS pixels: each chip of the top row by its name (coins, line, silo,
// barn, goals, day, level), the gear, the view button, the compass, the action button
function spots() {
  const named = { settings: '.gear:not(.hud-mode)', view: '.gear.hud-mode', compass: '.compass', action: '.act-btn.main' }
  const out = {}
  const put = (name, el) => {
    const r = el.getBoundingClientRect()
    let key = name
    for (let n = 2; out[key]; n++) key = `${name}-${n}`
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') out[key] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
  }
  for (const el of document.querySelectorAll('.farm-chip-item')) put(el.classList[1] ?? 'chip', el)
  for (const [name, sel] of Object.entries(named)) {
    const el = document.querySelector(sel)
    if (el) put(name, el)
  }
  return { w: innerWidth, h: innerHeight, spots: out }
}

// the game's env(safe-area-inset-*) given the phone's values (a page in a test browser has none), as lab/env.ts does
function safeAreas(safe) {
  const SAFE = /env\(\s*safe-area-inset-(top|right|bottom|left)\s*(,[^)]*)?\)/g
  const toVars = (css) => css.replace(SAFE, (_, side, fallback) => `var(--lab-safe-${side}${fallback ?? ', 0px'})`)
  const fix = (rules) => {
    for (const r of rules) {
      if (r instanceof CSSStyleRule && r.style.cssText.includes('env(')) r.style.cssText = toVars(r.style.cssText)
      if (r.cssRules?.length) fix(r.cssRules)
    }
  }
  for (const s of document.styleSheets)
    try {
      fix(s.cssRules)
    } catch {
      // another origin's
    }
  for (const el of document.querySelectorAll('[style*="env("]')) el.setAttribute('style', toVars(el.getAttribute('style')))
  for (const [side, px] of Object.entries(safe)) document.documentElement.style.setProperty(`--lab-safe-${side}`, `${px}px`)
  dispatchEvent(new Event('resize'))
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
try {
  for (const { name, viewport, safe } of PHONES) {
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
    await page.evaluate(safeAreas, safe)
    await page.waitForTimeout(6000)
    await writeFile(join(out, `${name}.json`), JSON.stringify(await page.evaluate(spots), null, 1) + '\n')
    await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 80 })
    console.log(`${name}.jpg`)
    // the same with nothing at the top of the screen (yard-clean): behind a board that designs the top itself
    await page.addStyleTag({ content: '.farm-chip, .gear, .top-stack, .compass { visibility: hidden !important; }' })
    await page.waitForTimeout(500)
    const clean = name.replace('yard', 'yard-clean')
    await page.screenshot({ path: join(out, `${clean}.jpg`), type: 'jpeg', quality: 80 })
    console.log(`${clean}.jpg`)
    await ctx.close()
  }
} finally {
  await browser.close()
}
