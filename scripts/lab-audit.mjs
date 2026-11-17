// The design lab checked screen by screen: every board, every variant, every state, on a phone upright and sideways
// (and any device asked for), each loaded afresh as a finger would see it once its opening has played. For each screen:
// errors from the page; nothing drawn (a picture counts); the page scrolling sideways or down; buttons smaller than a
// finger (44 px); text under 13 px; a button under the notch, the home bar or off the screen (what a list that scrolls
// shows of it). Writes lab/audit.json (the lab's status page shows it) and prints a summary. With the lab served
// (`npm run lab`, port 5180):
//
//   node scripts/lab-audit.mjs [--boards level,top] [--devices upright,sideways] [--wait 1600] [--base url]
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { args, devicePage, frameUrl, labOf, launch, ready } from './lab-tools.mjs'

const a = args()
const base = a.base ?? 'http://localhost:5180/'
const wait = Number(a.wait ?? 1600)
const devices = a.devices ? String(a.devices).split(',') : ['upright', 'sideways']
const out = join(dirname(fileURLToPath(import.meta.url)), '../lab/audit.json')

// what one screen shows, measured in the page
function measure(safe) {
  const W = innerWidth
  const H = innerHeight
  const seen = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05
  }
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 40)
  const lab = (el) => el.closest('.lab-chrome, .lab-touches, .lab-marks, .lab-still')
  const drawn = [...document.querySelectorAll('#root *')].filter((el) => !lab(el) && seen(el)).length
  const small = []
  const under = []
  const off = []
  // what a list that scrolls shows of a button: its box cut by every box round it that clips (a button scrolled out of
  // a list is reached by scrolling it, not under the notch or off the screen; only what is shown of it is judged)
  const shown = (el) => {
    const r = el.getBoundingClientRect()
    let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
      const c = p.getBoundingClientRect()
      box = { left: Math.max(box.left, c.left), top: Math.max(box.top, c.top), right: Math.min(box.right, c.right), bottom: Math.min(box.bottom, c.bottom) }
    }
    return box.right - box.left > 1 && box.bottom - box.top > 1 ? box : null
  }
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select, textarea')) {
    if (lab(el) || !seen(el) || el.disabled) continue
    const size = el.getBoundingClientRect()
    if (Math.round(size.width) < 44 || Math.round(size.height) < 44) small.push(`${name(el)} ${Math.round(size.width)}×${Math.round(size.height)}`)
    const r = shown(el)
    if (!r) continue
    if (r.right < 1 || r.bottom < 1 || r.left > W - 1 || r.top > H - 1 || r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) off.push(name(el))
    else if (r.top < safe.top || r.bottom > H - safe.bottom || r.left < safe.left || r.right > W - safe.right) under.push(name(el))
  }
  const tiny = []
  for (const el of document.querySelectorAll('#root *')) {
    if (lab(el) || !seen(el)) continue
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!text) continue
    const px = parseFloat(getComputedStyle(el).fontSize)
    if (px < 12.5) tiny.push(`${name(el)} ${px}px`)
  }
  const scroll = document.documentElement.scrollWidth > W + 1 || document.documentElement.scrollHeight > H + 1
  return { drawn, scroll, small, tiny, under, off }
}

const browser = await launch()
// boards named with --boards are checked again; what the last audit found for the others is kept
const kept = a.boards
  ? await readFile(out, 'utf8')
      .then((t) => JSON.parse(t).boards ?? {})
      .catch(() => ({}))
  : {}
const report = { at: new Date().toISOString(), devices, boards: { ...kept } }
try {
  const lab = await labOf(browser, base)
  const only = a.boards ? String(a.boards).split(',') : null
  for (const b of lab.boards.filter((x) => !only || only.includes(x.id))) {
    const r = (report.boards[b.id] = { screens: 0, errors: [], blank: [], scroll: [], small: [], tiny: [], under: [], off: [] })
    for (const device of devices) {
      const spec = lab.devices[device]
      // a page of its own for each variant: one page through many 3D variants ran out of room for new frames
      for (const variant of b.variants) {
        const { ctx, page } = await devicePage(browser, spec)
        const errors = []
        page.removeAllListeners('pageerror')
        page.removeAllListeners('console')
        page.on('pageerror', (e) => errors.push(e.message))
        // (the browser's own ask for a favicon is no error of the board's: its message names it only in its location)
        page.on('console', (m) => m.type() === 'error' && !/favicon/.test(`${m.text()} ${m.location().url}`) && errors.push(m.text()))
        for (const state of b.states) {
          const where = `${variant}/${state}/${device}`
          errors.length = 0
          await page.goto(frameUrl(base, { board: b.id, variant, state, device, fresh: true }))
          await ready(page)
          await page.waitForTimeout(wait)
          const m = await page.evaluate(measure, spec.safe)
          r.screens++
          for (const e of errors) r.errors.push(`${where}: ${e.slice(0, 160)}`)
          if (m.drawn < 1) r.blank.push(where)
          if (m.scroll) r.scroll.push(where)
          // what a variant shares across states is one finding: keep each kind of thing once per variant and device
          const add = (list, items) => {
            for (const it of items) if (!list.some((x) => x.endsWith(`· ${it}`) && x.startsWith(`${variant}/`) && x.includes(`/${device}`))) list.push(`${where} · ${it}`)
          }
          add(r.small, m.small)
          add(r.tiny, m.tiny)
          add(r.under, m.under)
          add(r.off, m.off)
        }
        await ctx.close()
      }
    }
    const n = (k) => r[k].length
    console.log(
      `${b.id}: ${r.screens} screens · errors ${n('errors')} · blank ${n('blank')} · scrolls ${n('scroll')} · small targets ${n('small')} · tiny text ${n('tiny')} · under the notch or bar ${n('under')} · off screen ${n('off')}`,
    )
  }
} finally {
  await browser.close()
}
await writeFile(out, JSON.stringify(report, null, 1) + '\n')
console.log(`lab/audit.json`)
