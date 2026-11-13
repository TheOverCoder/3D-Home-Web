// An animation of the design lab as one picture: its frames at even steps of time, side by side with their times, so a
// motion is checked frame by frame (how it comes in, how it settles, what a press does). The page's clocks are stopped
// and moved by hand (Playwright's clock for timers, requestAnimationFrame and Motion; every CSS and Web Animation set
// to the same time), so each frame is exactly at its time however slow the machine is. With the lab served:
//
//   node scripts/lab-film.mjs <board> <variant> <out.png> [--state gift] [--device upright] [--every 50] [--frames 16]
//                             [--tap ".selector"] [--before 1200] [--scale 0.5] [--base http://localhost:5180/]
//
// Without --tap it films the opening, from the first frame. With --tap it lets the opening play for --before ms, taps
// the element (as a finger: the mark shows where), and films what follows.
import { args, devicePage, frameUrl, labOf, launch, ready, sheet } from './lab-tools.mjs'

const a = args()
const [board, variant, out] = a._
if (!board || !variant || !out) throw new Error('usage: node scripts/lab-film.mjs <board> <variant> <out.png> [--state s] [--device d] [--every ms] [--frames n] [--tap sel] [--before ms]')
const base = a.base ?? 'http://localhost:5180/'
const every = Number(a.every ?? 50)
const frames = Number(a.frames ?? 16)
const before = Number(a.before ?? (a.tap ? 1200 : 0))
const browser = await launch()
try {
  const lab = await labOf(browser, base)
  const b = lab.boards.find((x) => x.id === board)
  if (!b) throw new Error(`no board "${board}"`)
  const state = a.state ?? b.states[0]
  const device = a.device ?? 'upright'
  const spec = lab.devices[device]
  const { ctx, page } = await devicePage(browser, spec)
  // once as it is, so its pictures and fonts are at hand; then held, with the clocks stopped
  await page.goto(frameUrl(base, { board, variant, state, device }))
  await ready(page)
  await page.waitForTimeout(400)
  await page.clock.install()
  await page.goto(frameUrl(base, { board, variant, state, device, hold: true, touches: true }))
  await ready(page)
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000)
  // every CSS and Web Animation stopped, then moved on by hand with the clock
  await page.evaluate(() => {
    const seen = new Map()
    const done = new WeakSet()
    window.__film = (ms) => {
      for (const anim of seen.keys()) if (!done.has(anim)) seen.set(anim, seen.get(anim) + ms)
      for (const anim of document.getAnimations()) {
        if (done.has(anim)) continue
        if (!seen.has(anim)) seen.set(anim, 0)
        const t = seen.get(anim)
        // one at its end is finished, so whatever waits for it (Motion, a way out) goes on
        if (t >= Number(anim.effect?.getComputedTiming().endTime ?? Infinity)) {
          done.add(anim)
          anim.finish()
          continue
        }
        anim.pause()
        anim.currentTime = t
      }
    }
  })
  const step = async (ms) => {
    if (ms > 0) await page.clock.runFor(ms)
    await page.evaluate((t) => window.__film(t), ms)
  }
  await page.evaluate(() => window.__labGo())
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__labShown)); i++) await new Promise((r) => setTimeout(r, 50))
  await step(0)
  if (before > 0) for (let t = 0; t < before; t += 50) await step(Math.min(50, before - t))
  if (a.tap) {
    await page.locator(String(a.tap)).first().tap({ timeout: 5000 })
    await step(0)
  }
  const shots = []
  for (let i = 0; i < frames; i++) {
    if (i > 0) await step(every)
    shots.push({ png: await page.screenshot(), w: spec.w, label: `${a.tap ? '+' : ''}${i * every} ms` })
  }
  await ctx.close()
  const cols = spec.w > spec.h ? 4 : 8
  const scale = Number(a.scale ?? 0.5)
  const { writeFile } = await import('node:fs/promises')
  await writeFile(
    out,
    await sheet(browser, shots, { cols, scale, title: `${board} · ${variant} · ${state} · ${device}${a.tap ? ` · tap ${a.tap} after ${before} ms` : ' · opening'} · every ${every} ms` }),
  )
  console.log(out)
} finally {
  await browser.close()
}
