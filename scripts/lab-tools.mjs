// What scripts/lab-shots.mjs and scripts/lab-film.mjs share: their flags, the lab's frames, and a sheet of pictures
// made into one picture (so a whole board, or a whole animation, is looked at once).
import { chromium } from '@playwright/test'

/** `node x.mjs a b --flag value --switch` → { _: ['a', 'b'], flag: 'value', switch: true } */
export function args(argv = process.argv.slice(2)) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) out._.push(a)
    else if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) out[a.slice(2)] = true
    else out[a.slice(2)] = argv[++i]
  }
  return out
}

export const launch = () => chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined })

/** A frame's address (lab/frame.html: see lab/env.ts for its settings). */
export const frameUrl = (base, { board, variant, state, run = 0, device = 'upright', touches = false, hold = false, speed = 1, reduced = false, fresh = false }) =>
  new URL(
    `frame.html?device=${device}&touches=${touches ? 1 : 0}&speed=${speed}${hold ? '&hold=1' : ''}${reduced ? '&motion=reduce' : ''}${fresh ? `&at=${variant}.${state}` : ''}#${board}/${variant}/${state}/${run}`,
    base,
  ).href

/** What the lab holds (its boards, their variants, states and screens; the devices' sizes), read from a frame. */
export async function labOf(browser, base) {
  const page = await browser.newPage()
  try {
    await page.goto(new URL('frame.html', base).href)
    await page.waitForFunction(() => window.__lab, null, { timeout: 30_000 })
    return await page.evaluate(() => window.__lab)
  } finally {
    await page.close()
  }
}

/** A page at a device's size, a touch screen unless it is the desktop. */
export async function devicePage(browser, spec, { dpr = 1, reduced = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: spec.w, height: spec.h },
    deviceScaleFactor: dpr,
    isMobile: spec.touch,
    hasTouch: spec.touch,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('[page]', e.message))
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()))
  return { ctx, page }
}

/** Waits for a frame's fonts and still (window.__labReady), without the page's own timers (they may be stopped). */
export async function ready(page, timeout = 20_000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await page.evaluate(() => window.__labReady === true)) return
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error('the frame was not ready (fonts or still)')
}

/** Pictures (PNG buffers) laid out in a grid with their captions, as one PNG. */
export async function sheet(browser, items, { cols, scale = 1, title = '' }) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 })
  try {
    const cells = items
      .map((it) => `<figure><img src="data:image/png;base64,${it.png.toString('base64')}" style="width:${Math.round(it.w * scale)}px"><figcaption>${it.label}</figcaption></figure>`)
      .join('')
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>
        body{margin:0;padding:14px;background:#20242a;color:#eef1f4;font:600 14px/1.3 system-ui,sans-serif;width:max-content}
        h1{font-size:15px;margin:0 0 10px;color:#ffc93c}
        .g{display:grid;grid-template-columns:repeat(${cols},max-content);gap:10px}
        figure{margin:0;display:grid;gap:4px} img{display:block;border-radius:6px;background:#000}
        figcaption{font-weight:500;color:#c9d0d8}
      </style><h1>${title}</h1><div class="g">${cells}</div>`,
    )
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())))
    return await page.screenshot({ fullPage: true })
  } finally {
    await page.close()
  }
}
