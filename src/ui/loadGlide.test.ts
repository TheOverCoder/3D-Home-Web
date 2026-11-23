import { describe, expect, it } from 'vitest'
import { GLIDE, GLIDE_MOST, WINDOWS, easeOut, glideAt, glideFrom, nextShown, type Glide, type LoadStep } from './loadGlide'

// The loading bar (./loadGlide.ts): never back, gliding on by itself through the coarse steps, never past a step's own
// end before the step is over, and full once ready.

/** The bar through a run of ticks: each [ms, step, the loader's own count]. */
function run(ticks: [number, LoadStep, number][]) {
  let shown = 0
  let glide: Glide | null = null
  const out: number[] = []
  for (const [t, step, real] of ticks) {
    ;({ shown, glide } = nextShown(shown, step, real, glide, t))
    out.push(shown)
  }
  return out
}

describe('the loading bar', () => {
  it('follows the downloads as they count, and never goes back', () => {
    expect(
      run([
        [0, 'fetch', 0.1],
        [100, 'fetch', 0.35],
        [200, 'fetch', 0.3],
        [300, 'fetch', 0.7],
      ]),
    ).toEqual([0.1, 0.35, 0.35, 0.7])
  })

  it('glides on through building the house by itself, never back and never into the next step', () => {
    const end = WINDOWS.build[0] + (WINDOWS.build[1] - WINDOWS.build[0]) * GLIDE_MOST
    const ticks: [number, LoadStep, number][] = []
    for (let t = 0; t <= 30_000; t += 500) ticks.push([t, 'build', 0.7])
    const shown = run(ticks)
    for (let i = 1; i < shown.length; i++) expect(shown[i]).toBeGreaterThanOrEqual(shown[i - 1])
    // it moves within the first second, about two thirds of the way in a quarter of its time, and stops short of 85 %
    expect(shown[2]).toBeGreaterThan(0.71)
    expect(shown[(GLIDE.build * 2) / 4]).toBeGreaterThan(0.7 + (end - 0.7) * 0.5)
    expect(Math.max(...shown)).toBeCloseTo(end, 6)
    expect(Math.max(...shown)).toBeLessThan(WINDOWS.build[1])
  })

  it('takes a whole step’s glide time to cross it, a part of the time for a part of the way', () => {
    const whole = glideFrom('build', WINDOWS.build[0], 0)!
    expect(whole.ms).toBeCloseTo(GLIDE.build * 1000, 6)
    const half = glideFrom('build', (whole.from + whole.to) / 2, 0)!
    expect(half.ms).toBeCloseTo(whole.ms / 2, 6)
    expect(glideAt(whole, 0)).toBe(whole.from)
    expect(glideAt(whole, whole.ms)).toBeCloseTo(whole.to, 9)
    // fast at first, slow near its end
    expect(easeOut(0.25)).toBeGreaterThan(0.5)
  })

  it('goes on from the step’s own count when it gets ahead, from the next step’s start, and is full once ready', () => {
    const shown = run([
      [0, 'build', 0.7],
      [500, 'build', 0.82],
      [1000, 'light', 0.85],
      [5000, 'light', 0.9],
      [6000, 'ready', 1],
    ])
    expect(shown[1]).toBe(0.82)
    expect(shown[2]).toBe(0.85)
    expect(shown[3]).toBeGreaterThan(0.9)
    expect(shown[3]).toBeLessThan(1)
    expect(shown[4]).toBe(1)
  })

  it('needs no glide of its own while the downloads count their bytes', () => {
    expect(glideFrom('fetch', 0.2, 0)).toBeNull()
    expect(glideFrom('ready', 1, 0)).toBeNull()
  })
})
