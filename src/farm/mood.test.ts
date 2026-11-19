import { afterEach, describe, expect, it } from 'vitest'
import { CROPS, PRODUCE, SELLABLE, isItem } from './data'
import { dayNumber } from './calendar'
import { BASKET, MOOD, moodDays, moodOf, moodOn, moodToday, setMood, vegIndex } from './mood'

// The town's market mood (./mood.ts): a little up or down each day, the same on every farm for a date, never far from
// fair for long, never a jump from one day to the next, and never on the building materials.

/** Two years of days round the update (calendar day numbers), and the goods it moves. */
const FROM = dayNumber(new Date(2026, 0, 1).getTime())
const DAYS = Array.from({ length: 730 }, (_, k) => FROM + k)
const GOODS = SELLABLE

afterEach(() => setMood(false))

describe("the market's mood", () => {
  it('is the same for the same good and date, whatever was asked before (nothing is kept)', () => {
    const day = dayNumber(new Date(2026, 10, 18).getTime())
    const first = GOODS.map((g) => moodOf(g, day))
    // asked in another order, and other days between
    for (const g of [...GOODS].reverse()) moodOf(g, day + 3)
    expect(GOODS.map((g) => moodOf(g, day))).toEqual(first)
    // not every good alike, nor every day
    expect(new Set(first.map((m) => m.toFixed(6))).size).toBeGreaterThan(GOODS.length / 2)
    expect(moodOf('tomato', day)).not.toBe(moodOf('tomato', day + 1))
  })

  it('stays within a tenth of fair, either way, and goes most of the way there', () => {
    let lo = Infinity
    let hi = -Infinity
    for (const g of GOODS)
      for (const d of DAYS) {
        const m = moodOf(g, d)
        lo = Math.min(lo, m)
        hi = Math.max(hi, m)
      }
    expect(lo).toBeGreaterThanOrEqual(1 - MOOD.amount)
    expect(hi).toBeLessThanOrEqual(1 + MOOD.amount)
    expect(lo).toBeLessThan(1 - MOOD.amount * 0.9)
    expect(hi).toBeGreaterThan(1 + MOOD.amount * 0.9)
  })

  it('never moves a price more than 7 % from one day to the next', () => {
    for (const g of GOODS)
      for (const d of DAYS) {
        const step = moodOf(g, d + 1) / moodOf(g, d) - 1
        expect(Math.abs(step), `${g} on day ${d}`).toBeLessThan(0.07)
      }
  })

  it('comes to fair over any eight weeks, within 1 %', () => {
    for (const g of GOODS)
      for (const d of DAYS) {
        const mean = moodDays(g, d + 55, 56).reduce((n, m) => n + m, 0) / 56
        expect(Math.abs(mean - 1), `${g}, the eight weeks to day ${d + 55}`).toBeLessThan(0.01)
      }
  })

  it('never moves a building material, nor on a day that is not one', () => {
    for (const p of PRODUCE.filter((q) => isItem(q.id))) for (const d of DAYS.slice(0, 60)) expect(moodOf(p.id, d)).toBe(1)
    expect(moodOf('tomato', NaN)).toBe(1)
    expect(moodOf('tomato', Infinity)).toBe(1)
  })

  it("is each good's own wave and the market's shared one: goods move together, and apart", () => {
    // half of the mood is shared: on a day of the shared wave's top, most goods are up
    const top = DAYS.find((d) => Math.abs(Math.sin((2 * Math.PI * d) / MOOD.waves.shared) - 1) < 0.02)!
    const bottom = DAYS.find((d) => Math.abs(Math.sin((2 * Math.PI * d) / MOOD.waves.shared) + 1) < 0.02)!
    const up = GOODS.filter((g) => moodOf(g, top) > 1).length
    const down = GOODS.filter((g) => moodOf(g, bottom) < 1).length
    expect(up).toBeGreaterThan(GOODS.length / 2)
    expect(down).toBeGreaterThan(GOODS.length / 2)
  })

  it('gives the vegetable index: the mean mood of every crop, ×100', () => {
    expect(BASKET).toEqual(CROPS.map((c) => c.id))
    for (const d of DAYS.slice(0, 30)) {
      const mean = BASKET.reduce((n, c) => n + moodOf(c, d), 0) / BASKET.length
      expect(vegIndex(d)).toBeCloseTo(100 * mean, 9)
      expect(Math.abs(vegIndex(d) - 100)).toBeLessThanOrEqual(100 * MOOD.amount)
    }
    // with every good at fair, 100
    expect(vegIndex(FROM, () => 1)).toBe(100)
  })

  it('gives a good its days, the oldest first and today last', () => {
    expect(moodDays('carrot', FROM + 6, 7)).toEqual(Array.from({ length: 7 }, (_, k) => moodOf('carrot', FROM + k)))
    expect(moodDays('carrot', FROM, 0)).toEqual([])
  })

  it('is quiet under Vitest until a test turns it on, and quiet again gives every good 1', () => {
    expect(moodOn()).toBe(false)
    const day = FROM + 40
    expect(GOODS.map((g) => moodToday(g, day))).toEqual(GOODS.map(() => 1))
    setMood(true)
    expect(moodOn()).toBe(true)
    expect(GOODS.map((g) => moodToday(g, day))).toEqual(GOODS.map((g) => moodOf(g, day)))
    setMood(false)
    expect(moodToday('tomato', day)).toBe(1)
  })
})
