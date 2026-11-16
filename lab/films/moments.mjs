// A film checked in pictures and in numbers, with the lab served (`npm run lab`, port 5180):
//
//   node lab/films/moments.mjs <board> <out-dir> <t1,t2,…> [--devices upright,sideways] [--state whole] [--scale 0.5]
//   node lab/films/moments.mjs <board> --levels [--wav out.wav]
//
// The first: the film's frame at each second given (the player's window.__filmPlayer.seek: the film stopped there, so
// each picture is that moment exactly, however slow the machine), one sheet per screen, and the film's lint (lab/FILM.md
// rules that can be counted). Effects that fire at a moment (a flash, a glint) are passed by a seek: watch those with
// scripts/lab-film.mjs. Each moment also says when the camera looks across the lane at the farm (a film never does:
// src/film/set.ts, looksAtFarm). The second: the score rendered offline (src/film/score.ts, render: the music, the
// voices and the stings) and its loudness every half second, so a cue too quiet, a voice lost under the music or a
// drop too loud shows without listening; --wav writes it to a file to listen to. The game's own sounds (coins, the
// till, a level) are not in it.
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
    const { rows, pcm } = await page.evaluate(async (wav) => {
      const p = window.__filmPlayer
      const rate = 22050
      const d = (await p.render(rate)).getChannelData(0)
      // who speaks in each half second
      const who = (a, b) => [...new Set(p.speech.filter((s) => s.t < b && s.t + s.u.length > a).map((s) => s.who))].join(' ')
      const out = []
      for (let i = 0; i < d.length; i += rate / 2) {
        let sum = 0
        let peak = 0
        for (let j = i; j < Math.min(d.length, i + rate / 2); j++) {
          sum += d[j] * d[j]
          peak = Math.max(peak, Math.abs(d[j]))
        }
        out.push(`${(i / rate).toFixed(1).padStart(5)} s   rms ${Math.sqrt(sum / (rate / 2)).toFixed(3)}   peak ${peak.toFixed(2)}   ${who(i / rate, (i + rate / 2) / rate)}`)
      }
      // 16-bit samples, for a wav
      const pcm = wav ? Array.from(d, (x) => Math.round(Math.max(-1, Math.min(1, x)) * 32767)) : null
      return { rows: out, pcm }
    }, !!a.wav)
    console.log(rows.join('\n'))
    if (pcm) {
      const rate = 22050
      const head = Buffer.alloc(44)
      head.write('RIFF', 0)
      head.writeUInt32LE(36 + pcm.length * 2, 4)
      head.write('WAVEfmt ', 8)
      head.writeUInt32LE(16, 16)
      head.writeUInt16LE(1, 20)
      head.writeUInt16LE(1, 22)
      head.writeUInt32LE(rate, 24)
      head.writeUInt32LE(rate * 2, 28)
      head.writeUInt16LE(2, 32)
      head.writeUInt16LE(16, 34)
      head.write('data', 36)
      head.writeUInt32LE(pcm.length * 2, 40)
      const body = Buffer.alloc(pcm.length * 2)
      pcm.forEach((x, i) => body.writeInt16LE(x, i * 2))
      await writeFile(String(a.wav), Buffer.concat([head, body]))
      console.log(a.wav)
    }
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
      const farm = []
      for (const t of ts) {
        await page.evaluate((t) => window.__filmPlayer.seek(t), t)
        await page.waitForTimeout(Number(a.wait ?? 900))
        if (await page.evaluate(() => window.__filmPlayer.view()?.farm)) farm.push(t)
        shots.push({ png: await page.screenshot(), w: spec.w, label: `${t} s` })
      }
      if (farm.length) console.log(`${device}: the camera looks at the farm at ${farm.join(', ')} s`)
      const file = join(out, `${board}-moments-${device}.png`)
      await writeFile(file, await sheet(browser, shots, { cols: spec.w > spec.h ? 3 : 6, scale: Number(a.scale ?? 0.5), title: `${board} · ${device}` }))
      console.log(file)
      await ctx.close()
    }
  }
} finally {
  await browser.close()
}
