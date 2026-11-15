// A film checked in pictures and in numbers, with the lab served (`npm run lab`, port 5180):
//
//   node lab/films/moments.mjs <board> <out-dir> <t1,t2,…> [--devices upright,sideways] [--state whole] [--scale 0.5]
//   node lab/films/moments.mjs <board> --levels
//
// The first: the film's frame at each second given (the player's window.__filmPlayer.seek: the film stopped there, so
// each picture is that moment exactly, however slow the machine), one sheet per screen, and the film's lint (lab/FILM.md
// rules that can be counted). Effects that fire at a moment (a flash, a glint) are passed by a seek: watch those with
// scripts/lab-film.mjs. The second: the score rendered offline (lab/films/score.ts, Synth) and its loudness every half
// second, so a cue too quiet or a drop too loud shows without listening. The game's own sounds (coins, the till, a
// level) are not in it.
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { args, devicePage, frameUrl, labOf, launch, ready, sheet } from '../../scripts/lab-tools.mjs'

const a = args()
const [board, out, times] = a._
if (!board || (!a.levels && (!out || !times))) throw new Error('usage: node lab/films/moments.mjs <board> <out-dir> <t1,t2,…> [--devices d] [--state s] | <board> --levels')
const base = a.base ?? 'http://localhost:5180/'
const browser = await launch()
try {
  const lab = await labOf(browser, base)
  const b = lab.boards.find((x) => x.id === board)
  if (!b) throw new Error(`no board "${board}"`)
  if (a.levels) {
    const page = await browser.newPage()
    await page.goto(frameUrl(base, { board, variant: b.variants[0], state: b.states[0] }))
    await ready(page)
    await page.waitForFunction(() => window.__filmPlayer, null, { timeout: 60_000 })
    const rows = await page.evaluate(async () => {
      const { Synth } = await import('/films/score.ts')
      const tl = window.__filmPlayer.timeline
      const rate = 22050
      const ctx = new OfflineAudioContext(1, Math.ceil(rate * (tl.length + 4)), rate)
      const synth = new Synth(ctx, ctx.destination)
      const music = tl.cues.filter((c) => c.item.music)
      music.forEach((c, i) => c.item.music !== 'stop' && synth.music(c.item.music, c.t, music[i + 1]?.t ?? tl.length + 4, c.t))
      for (const c of tl.cues) {
        if (c.item.music === 'stop') synth.hush(c.t)
        if (c.item.sting && !['coins', 'till', 'level'].includes(c.item.sting)) synth.sting(c.item.sting, c.t)
      }
      const d = (await ctx.startRendering()).getChannelData(0)
      const out = []
      for (let i = 0; i < d.length; i += rate / 2) {
        let sum = 0
        let peak = 0
        for (let j = i; j < Math.min(d.length, i + rate / 2); j++) {
          sum += d[j] * d[j]
          peak = Math.max(peak, Math.abs(d[j]))
        }
        out.push(`${(i / rate).toFixed(1).padStart(5)} s   rms ${Math.sqrt(sum / (rate / 2)).toFixed(3)}   peak ${peak.toFixed(2)}`)
      }
      return out
    })
    console.log(rows.join('\n'))
  } else {
    const ts = String(times).split(',').map(Number)
    for (const device of String(a.devices ?? 'upright,sideways').split(',')) {
      const spec = lab.devices[device]
      const { ctx, page } = await devicePage(browser, spec, { reduced: !!a.reduced })
      await page.goto(frameUrl(base, { board, variant: a.variant ?? b.variants[0], state: a.state ?? b.states[0], device, fresh: true }))
      await ready(page)
      await page.waitForFunction(() => window.__filmPlayer, null, { timeout: 60_000 })
      const lint = await page.evaluate(() => window.__filmPlayer.lint)
      if (lint.length) console.log(`lint: ${lint.join(' · ')}`)
      const shots = []
      for (const t of ts) {
        await page.evaluate((t) => window.__filmPlayer.seek(t), t)
        await page.waitForTimeout(Number(a.wait ?? 900))
        shots.push({ png: await page.screenshot(), w: spec.w, label: `${t} s` })
      }
      const file = join(out, `${board}-moments-${device}.png`)
      await writeFile(file, await sheet(browser, shots, { cols: spec.w > spec.h ? 3 : 6, scale: Number(a.scale ?? 0.5), title: `${board} · ${device}` }))
      console.log(file)
      await ctx.close()
    }
  }
} finally {
  await browser.close()
}
