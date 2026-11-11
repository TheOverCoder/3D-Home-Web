// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_AIR, crystalsFor, flyXp, onXpFlight, shares, xpInFlight } from './xp'

// The XP crystals (src/fx/xp.ts): how many carry a gain, that they carry all of it, that the bar is told as they take
// off and land, and that none fly with the bar hidden or too many in the air. The page has no layout here: the bar's
// box and the Web Animations API are stood in for, and each flight is landed by hand.

interface Flight {
  onfinish: (() => void) | null
  oncancel: (() => void) | null
}
let flights: Flight[] = []

/** The level chip's bar at the top, `width` px wide (0: hidden, as with the top of the screen set to clear). */
function bar(width: number) {
  document.body.innerHTML = '<div class="xp-bar"><span class="xp-bar-fill"></span></div>'
  const el = document.querySelector('.xp-bar') as HTMLElement
  const box = { left: 20, right: 20 + width, top: 60, bottom: 66, width, height: 6, x: 20, y: 60 } as DOMRect
  el.getBoundingClientRect = () => box
  el.getClientRects = () => (width > 0 ? [box] : []) as unknown as DOMRectList
}

/** Lands every crystal in the air. */
function landAll() {
  for (const f of flights.splice(0)) f.onfinish?.()
}

describe('XP crystals', () => {
  beforeEach(() => {
    flights = []
    HTMLElement.prototype.animate = vi.fn(() => {
      const f: Flight = { onfinish: null, oncancel: null }
      flights.push(f)
      return f as unknown as Animation
    })
  })
  afterEach(() => {
    landAll()
    document.body.innerHTML = ''
  })

  it('a few crystals for a gain, more for a bigger one, never a swarm', () => {
    expect(crystalsFor(0)).toBe(0)
    expect(crystalsFor(1)).toBe(1)
    expect(crystalsFor(2)).toBe(2)
    expect(crystalsFor(5)).toBe(3)
    expect(crystalsFor(25)).toBe(5)
    expect(crystalsFor(400)).toBe(6)
  })

  it('the crystals of a gain carry all of it, in whole points', () => {
    for (const [xp, n] of [
      [1, 1],
      [2, 2],
      [7, 3],
      [25, 5],
      [101, 6],
    ]) {
      const s = shares(xp, n)
      expect(s).toHaveLength(n)
      expect(s.reduce((a, b) => a + b, 0)).toBe(xp)
      expect(Math.max(...s) - Math.min(...s)).toBeLessThanOrEqual(1)
    }
  })

  it('in the air, the gain is held back from the bar until each crystal lands', () => {
    bar(200)
    const told = vi.fn()
    const off = onXpFlight(told)
    expect(flyXp(100, 300, 9)).toBe(true)
    expect(flights).toHaveLength(3)
    expect(xpInFlight()).toBe(9)
    expect(document.querySelectorAll('.xp-fly')).toHaveLength(3)
    flights.shift()!.onfinish!()
    expect(xpInFlight()).toBe(6)
    landAll()
    expect(xpInFlight()).toBe(0)
    expect(document.querySelectorAll('.xp-fly')).toHaveLength(0)
    expect(told).toHaveBeenCalledTimes(4) // took off, and each of the three landed
    off()
  })

  it('XP with no point on the screen flies from low in the middle', () => {
    bar(200)
    expect(flyXp(Number.NaN, Number.NaN, 1)).toBe(true)
    const img = document.querySelector('.xp-fly') as HTMLElement
    expect(parseFloat(img.style.left)).toBeCloseTo(innerWidth / 2 - 12)
    expect(parseFloat(img.style.top)).toBeCloseTo(innerHeight * 0.6 - 12)
  })

  it('a crystal stopped on its way still gives its share back', () => {
    bar(200)
    flyXp(100, 300, 4)
    for (const f of flights.splice(0)) f.oncancel?.()
    expect(xpInFlight()).toBe(0)
  })

  it(`at most ${MAX_AIR} in the air: what does not fit joins the bar at once`, () => {
    bar(200)
    let launched = 0
    for (let i = 0; i < 10; i++) if (flyXp(100, 300, 25)) launched++
    expect(flights.length).toBe(MAX_AIR)
    expect(launched).toBe(3) // 5 + 5 + 2: the third gain shares its 25 out over the two places left
    expect(xpInFlight()).toBe(75)
  })

  it('none fly with the bar hidden, for no XP, or with less motion asked for', () => {
    bar(0)
    expect(flyXp(100, 300, 5)).toBe(false)
    bar(200)
    expect(flyXp(100, 300, 0)).toBe(false)
    expect(flyXp(100, 300, Number.NaN)).toBe(false)
    const media = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q })) as unknown as typeof window.matchMedia
    expect(flyXp(100, 300, 5)).toBe(false)
    window.matchMedia = media
    expect(flights).toHaveLength(0)
    expect(xpInFlight()).toBe(0)
  })
})
