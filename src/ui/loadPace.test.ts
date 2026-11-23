import { describe, expect, it } from 'vitest'
import { CREEP_MS, EVEN, FASTEST_MS, FIRST_TIMES, LAST, RATE_STEP, SLOWEST, blend, finishAt, paceFrom, rateFor, shareAt, tick, tookTimes, worthChanging, type Pace } from './loadPace'

// The loading bar (./loadPace.ts): one even pace over the time the load will take, as this device's last loads took,
// its speed changed (never its run) when a step ends sooner or later, never back, never faster than a bar in FASTEST_MS
// nor slower than SLOWEST, creeping short of full past its plan.

const PAST = { fetch: 1000, build: 4000, light: 2000 }

describe('the loading bar’s pace', () => {
  it('plans the whole way by the steps’ times: the ones done, this one, the ones to come', () => {
    expect(finishAt('fetch', 0, 0, PAST)).toBe(7000)
    // the downloads took 3 s, not 1: the build and the graphics still to come
    expect(finishAt('build', 3000, 3000, PAST)).toBe(9000)
    // a step that has already run past its time is given a beat more, never ended under it
    expect(finishAt('build', 0, 6000, PAST)).toBe(6400 + 2000)
    // the downloads' own count, once some way in, says how long they take
    expect(finishAt('fetch', 0, 2000, PAST, 0.25)).toBe(8000 + 6000)
    expect(finishAt('ready', 0, 5000, PAST)).toBe(5000)
  })

  it('moves at one even pace from nothing to EVEN by its end, then creeps short of full', () => {
    const d0 = 8000
    const steps = [0, 1000, 2000, 4000, 6000, 8000].map((c) => shareAt(c, d0))
    expect(steps[0]).toBe(0)
    expect(steps[1]).toBeCloseTo(EVEN / 8, 9)
    expect(steps[3]).toBeCloseTo(EVEN / 2, 9)
    expect(steps[5]).toBeCloseTo(EVEN, 9)
    // the same each second: even
    expect(steps[2] - steps[1]).toBeCloseTo(steps[1] - steps[0], 9)
    expect(shareAt(d0 + CREEP_MS, d0)).toBeCloseTo(LAST, 9)
    expect(shareAt(d0 + 60_000, d0)).toBeLessThanOrEqual(LAST)
  })

  /** The bar through ticks of 100 ms while the load's end moves as `endAt(t)` says. */
  function run(endAt: (t: number) => number, until: number) {
    let p: Pace = paceFrom(0, endAt(0))
    const shown: number[] = []
    for (let t = 100; t <= until; t += 100) {
      p = tick(p, 100, t, endAt(t))
      shown.push(shareAt(p.c, p.d0))
    }
    return { p, shown }
  }

  it('arrives at EVEN when the load ends as planned, at one pace all the way', () => {
    const { shown } = run(() => 8000, 8000)
    expect(shown.at(-1)).toBeCloseTo(EVEN, 2)
    const each = shown.map((v, i) => v - (shown[i - 1] ?? 0)).slice(1)
    expect(Math.max(...each) - Math.min(...each)).toBeLessThan(1e-9)
  })

  it('speeds up when a step ends early and slows when one is late, never back, and still arrives', () => {
    // planned for 8 s; at 2 s the end comes to 5 s; at 3 s it goes out to 10 s
    const endAt = (t: number) => (t < 2000 ? 8000 : t < 3000 ? 5000 : 10_000)
    const { shown } = run(endAt, 10_000)
    for (let i = 1; i < shown.length; i++) expect(shown[i]).toBeGreaterThanOrEqual(shown[i - 1])
    expect(shown.at(-1)).toBeCloseTo(EVEN, 2)
  })

  it('never runs faster than a whole bar in FASTEST_MS, nor slower than SLOWEST, however the end moves', () => {
    const p: Pace = { d0: 10_000, c: 1000, rate: 1 }
    // the end said to be now: as fast as allowed
    expect(rateFor(p, 1000, 1001)).toBeCloseTo(p.d0 / (EVEN * FASTEST_MS), 9)
    // the end far off: as slow as allowed
    expect(rateFor(p, 1000, 10_000_000)).toBe(SLOWEST)
    // past EVEN: the creep's own pace
    expect(rateFor({ ...p, c: 10_000 }, 0, 1)).toBe(1)
  })

  it('puts a new rate on the page only when it is a real change (each change holds the animation a frame)', () => {
    expect(worthChanging(1, 1 + RATE_STEP / 2)).toBe(false)
    expect(worthChanging(1, 1 + RATE_STEP * 2)).toBe(true)
    expect(worthChanging(1, 1 - RATE_STEP * 2)).toBe(true)
  })

  it('keeps each step’s time from the loader’s marks, half the last kept and half this one, within reason', () => {
    expect(tookTimes({ startedAt: 100, downloadedAt: 1100, compileAt: 5100, readyAt: 7100 })).toEqual({ fetch: 1000, build: 4000, light: 2000 })
    expect(tookTimes({ startedAt: 100, downloadedAt: 0, compileAt: 0, readyAt: 7100 })).toBeNull()
    expect(blend(null, PAST)).toEqual(PAST)
    expect(blend(PAST, { fetch: 3000, build: 2000, light: 2000 })).toEqual({ fetch: 2000, build: 3000, light: 2000 })
    expect(blend(null, { fetch: 1, build: 999_999, light: 500 })).toEqual({ fetch: 100, build: 60_000, light: 500 })
    // a first load from the device's own copy is guessed shorter than one over the network
    const total = (t: typeof PAST) => t.fetch + t.build + t.light
    expect(total(FIRST_TIMES.device)).toBeLessThan(total(FIRST_TIMES.network))
  })
})
