/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp, watchErrors } from './helpers'

// The measuring tool for real phones (?tune, the Measure folder: src/debug/measure.ts), in a page of its own: the
// folder is there with what the device is; Go to puts you in the kitchen with its door shut; the test farm is filled
// only on farm 3; Measure still gives six slices (ON, OFF, ON, OFF, ON-sync, OFF-sync) with frames, draws and
// triangles in each and the work of a frame in the sync ones, the drawing pass drawing less with the door shut, and the
// switch back as it was; Copy gives the same as JSON. Measure turning with the sun's map kept as the switch: turning in
// the living room, the map is drawn again on fewer frames with it on than off. No console errors.

test('the measuring tool: six slices with the drawing pass on and off', { tag: '@boot' }, async ({ browser }) => {
  test.setTimeout(1_800_000)
  const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4185' })
  const page = await context.newPage()
  const errors: string[] = []
  watchErrors(page, errors)
  await bootApp(page, 'tune&debug&quality=low')
  await page.waitForFunction(() => (window as any).__home?.useHome.getState().phase === 'playing' && !!(window as any).__home.measure && !!(window as any).__home.teleport, null, {
    timeout: 120_000,
    polling: 500,
  })
  const m = (fn: string, ...args: unknown[]) => page.evaluate(([fn, args]) => (window as any).__home.measure[fn as string](...(args as unknown[])), [fn, args] as const)

  await expect(page.locator('.lil-gui .lil-title', { hasText: /^Measure$/ })).toHaveCount(1)
  const info = await m('info')
  expect(info.gpu.length).toBeGreaterThan(0)
  expect(info.multi_draw).toMatch(/^(yes|no)$/)
  expect(info.canvas).toMatch(/^640×360 @ 1\.00$/)
  expect(info.tier).toMatch(/^low/)
  expect(info.content).toMatch(/^farm 1 /)

  // not on a farm someone plays
  await m('fill')
  expect(await page.evaluate(() => (window as any).__home.measure.lines.status)).toBe('Fill only on farm 3')

  await m('goTo', 'Kitchen (door shut)')
  await page.waitForFunction(() => (window as any).__home.useHome.getState().room === 'kitchen', null, { timeout: 60_000 })
  await page.waitForTimeout(3000)
  expect(await page.evaluate(() => (window as any).__home.useHome.getState().doors['door-kitchen-bedroom'])).toBe(false)

  // slices of 5 s, or long enough for a dozen frames where software rendering is slow
  const sliceMs = await page.evaluate(async () => {
    let frames = 0
    let on = true
    const count = () => {
      frames++
      if (on) requestAnimationFrame(count)
    }
    requestAnimationFrame(count)
    await new Promise((r) => setTimeout(r, 6000))
    on = false
    return Math.min(60_000, Math.max(5000, Math.round((6000 / Math.max(1, frames)) * 12)))
  })
  console.log('slices of', sliceMs, 'ms')
  await m('run', 'still', sliceMs)
  await page.waitForFunction(() => (window as any).__home.measure.result() !== null, null, { timeout: 600_000, polling: 1000 })
  const r = await m('result')
  console.log(JSON.stringify(r.slices.map((s: any) => ({ name: s.name, frames: s.frames, draws: s.draws, work: s.work, interval: s.interval, shadow: s.shadowRedraws }))))
  expect(r.kind).toBe('still')
  expect(r.slices.map((s: any) => s.name)).toEqual(['ON', 'OFF', 'ON', 'OFF', 'ON-sync', 'OFF-sync'])
  for (const s of r.slices) {
    expect(s.frames, `${s.name}: frames`).toBeGreaterThan(0)
    expect(s.draws, `${s.name}: draws`).toBeGreaterThan(0)
    expect(s.triangles, `${s.name}: triangles`).toBeGreaterThan(0)
    expect(s.interval.p50, `${s.name}: interval`).toBeGreaterThan(0)
    if (s.name.endsWith('sync')) expect(s.work.p50, `${s.name}: work`).toBeGreaterThan(0)
  }
  // in the kitchen with its door shut the pass leaves the other rooms out
  expect(r.slices[0].draws).toBeLessThan(r.slices[1].draws)
  expect(r.work.on).toBeGreaterThan(0)
  expect(await page.evaluate(() => (window as any).__home.view.on)).toBe(true)
  expect(JSON.parse(await m('copy')).slices).toHaveLength(6)

  // turning in the living room, the switch the sun's map kept: drawn again on fewer frames with it on
  await m('goTo', 'Living room')
  await page.waitForTimeout(3000)
  await page.evaluate(() => ((window as any).__home.measure.switch = 'keep'))
  await m('run', 'turning', sliceMs)
  await page.waitForFunction(() => (window as any).__home.measure.result()?.kind === 'turning', null, { timeout: 600_000, polling: 1000 })
  const t = await m('result')
  const redraws = (on: boolean) => t.slices.filter((s: any) => s.name.startsWith(on ? 'ON' : 'OFF')).reduce((n: number, s: any) => n + s.shadowRedraws, 0)
  console.log('turning, shadow redraws with the map kept / not:', redraws(true), redraws(false))
  expect(t.switch).toBe('keep')
  expect(redraws(true)).toBeLessThan(redraws(false))
  expect(await page.evaluate(() => (window as any).__home.view.keep)).toBe(true)

  expect(errors).toEqual([])
  await context.close()
})
