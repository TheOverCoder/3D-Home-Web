// Pictures of the design lab's screens, to check a board before it is shown: for each state and each screen, one sheet
// with every variant side by side (today, A, B, C), named <board>-<state>-<device>.png. With the lab served
// (`npm run lab`, port 5180, or the build: `npx vite preview --config vite.lab.config.ts --port 5180`):
//
//   node scripts/lab-shots.mjs <board> <out-dir> [--variants a,b] [--states gift] [--devices upright,sideways,small]
//                              [--wait 1200] [--each] [--dpr 2] [--reduced] [--base http://localhost:5180/]
//
// --wait: how long after the frame is ready the picture is taken (the opening played out); --each: every screen as a
// picture of its own too; --dpr 2: twice the pixels (for a person; 1 is enough to check); --reduced: as someone who
// prefers less motion sees it. Each screen is a page loaded afresh, so each opening starts from nothing.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { args, devicePage, frameUrl, labOf, launch, ready, sheet } from './lab-tools.mjs'

const a = args()
const [board, out] = a._
if (!board || !out) throw new Error('usage: node scripts/lab-shots.mjs <board> <out-dir> [--variants a,b] [--states s] [--devices upright,sideways] [--wait ms] [--each] [--dpr n]')
const base = a.base ?? 'http://localhost:5180/'
const wait = Number(a.wait ?? 1200)
const dpr = Number(a.dpr ?? 1)
await mkdir(out, { recursive: true })
const browser = await launch()
try {
  const lab = await labOf(browser, base)
  const b = lab.boards.find((x) => x.id === board)
  if (!b) throw new Error(`no board "${board}" (the lab has: ${lab.boards.map((x) => x.id).join(', ')})`)
  const variants = a.variants ? String(a.variants).split(',') : b.variants
  const states = a.states ? String(a.states).split(',') : b.states
  const devices = a.devices ? String(a.devices).split(',') : b.devices
  for (const device of devices) {
    const spec = lab.devices[device]
    if (!spec) throw new Error(`no device "${device}"`)
    const { ctx, page } = await devicePage(browser, spec, { dpr, reduced: !!a.reduced })
    for (const state of states) {
      const shots = []
      for (const variant of variants) {
        await page.goto(frameUrl(base, { board, variant, state, device, fresh: true }))
        await ready(page)
        await page.waitForTimeout(wait)
        const png = await page.screenshot()
        shots.push({ png, w: spec.w, label: variant === 'today' ? 'today' : variant.toUpperCase() })
        if (a.each) await writeFile(join(out, `${board}-${state}-${device}-${variant}.png`), png)
      }
      const cols = spec.w > spec.h ? 2 : Math.min(shots.length, 4)
      const file = join(out, `${board}-${state}-${device}.png`)
      await writeFile(file, await sheet(browser, shots, { cols, scale: 1 / dpr, title: `${board} · ${state} · ${spec.w}×${spec.h}` }))
      console.log(file)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}
