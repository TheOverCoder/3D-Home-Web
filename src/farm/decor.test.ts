import { describe, expect, it } from 'vitest'
import { DECOR, FRUIT, nextPrice } from './decor'

describe("the farm shop's prices", () => {
  it('each one costs a fifth of the first more; every ten the rise doubles (the yard lamp: 200, 240, 280, 320 … 600, 680 …)', () => {
    const lamp = DECOR.lamp.price
    expect([0, 1, 2, 3].map((n) => nextPrice(lamp, n))).toEqual([200, 240, 280, 320])
    expect(nextPrice(lamp, 10)).toBe(600)
    expect([11, 12].map((n) => nextPrice(lamp, n))).toEqual([680, 760])
    expect(nextPrice(lamp, 20)).toBe(1400)
    expect(nextPrice(lamp, 21) - nextPrice(lamp, 20)).toBe(160)
    expect(nextPrice(lamp, 31) - nextPrice(lamp, 30)).toBe(320)
  })
  it('never falls, and owning none (or a broken count) costs the first price', () => {
    for (const def of [...Object.values(DECOR), ...Object.values(FRUIT)]) {
      let last = 0
      for (let n = 0; n < 60; n++) {
        const p = nextPrice(def.price, n)
        expect(p).toBeGreaterThan(last)
        last = p
      }
      expect(nextPrice(def.price, -3)).toBe(def.price)
      expect(nextPrice(def.price, Number.NaN)).toBe(def.price)
    }
  })
})
