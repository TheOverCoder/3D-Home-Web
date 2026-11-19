import { describe, expect, it } from 'vitest'
import { DECOR, FRUIT, nextPrice, SET_IDS, setsOf, SHOP, type ShopItemView, type ShopKind } from './decor'

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

describe('the shop in sets (mission 02 c5)', () => {
  const view = (kind: ShopKind, owned = 0): ShopItemView => ({ kind, tab: SHOP[kind].tab, name: SHOP[kind].name, set: SHOP[kind].set, owned, price: 1, can: true })
  it('every kind is in one set, every set has kinds, and each set stays on one tab', () => {
    for (const id of SET_IDS) {
      const kinds = Object.values(SHOP).filter((d) => d.set === id)
      expect(kinds.length, id).toBeGreaterThan(0)
      expect(new Set(kinds.map((d) => d.tab)).size, id).toBe(1)
    }
  })
  it('groups the kinds given, the year first, and counts the kinds the farm has one of', () => {
    const items = [view('scarecrow-pumpkin', 2), view('scarecrow-witch'), view('scarecrow-crows', 1), view('lamp'), view('snowman')]
    const sets = setsOf(items)
    expect(sets.map((s) => s.id)).toEqual(['year', 'lights', 'harvest'])
    expect(sets[2]).toMatchObject({ name: 'Harvest scarecrows', got: 2, of: 3 })
    expect(sets[2].items.map((i) => i.kind)).toEqual(['scarecrow-pumpkin', 'scarecrow-witch', 'scarecrow-crows'])
  })
})
