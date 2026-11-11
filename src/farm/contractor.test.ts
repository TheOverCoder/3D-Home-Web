import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CONTRACTOR, ITEMS, LADDERS, PRODUCE, STORES, isItem, type ItemId, type ProduceId, type StoreId } from './data'
import { dailyOffers, offersPerDay, piecePrice, sanitizeContractor, shortMaterials, type Contractor } from './contractor'
import { GOALS, goalReward } from './goals'
import type { FarmData } from './state'

// The contractor's rules (src/farm/contractor.ts): how many pieces a day and at what price, which pieces (first what
// the next silo or barn level is shortest of, the same measure as a goal's reward), and his saved day read back. Pure.

const RUNS = Number(process.env.FC_RUNS) || 300

/** A farm as the contractor sees it: what it holds and the levels of its silo and barn. */
function farmWith(storage: Record<StoreId, number>, have: Partial<Record<ProduceId, number>> = {}) {
  const inv = Object.fromEntries(PRODUCE.map((p) => [p.id, have[p.id] ?? 0])) as Record<ProduceId, number>
  return { inv, storage }
}

/** The dice in a test: these numbers in turn, then the last one again. */
const rolls = (...r: number[]) => {
  let k = 0
  return () => r[Math.min(k++, r.length - 1)]
}

describe('his numbers', () => {
  it('three pieces a day, one more for each step of stock; 100 coins a piece, 10 less for each step of discount', () => {
    expect(offersPerDay(0)).toBe(CONTRACTOR.offers)
    expect(offersPerDay(2)).toBe(5)
    expect(piecePrice(0)).toBe(CONTRACTOR.sells)
    expect(piecePrice(5)).toBe(50)
    for (let k = 0; k <= LADDERS.stock.levels; k++) expect(LADDERS.stock.say(k)).toBe(`${offersPerDay(k)} pieces a day`)
    for (let k = 0; k <= LADDERS.discount.levels; k++) expect(LADDERS.discount.say(k)).toBe(`${piecePrice(k)} coins a piece`)
  })
})

describe("the day's offers", () => {
  // silo at level 4 needs 4 iron, 4 bolts, 4 logs; the barn at level 2 needs 2 bricks, 2 planks, 2 nails
  const f = farmWith({ silo: 4, barn: 2 }, { iron: 4, bolt: 1, log: 3, brick: 0, plank: 2, nail: 5 })

  it('the materials short for the next levels, the shortest first, each once', () => {
    expect(shortMaterials(f)).toEqual(['bolt', 'brick', 'log'])
    expect(dailyOffers(f, 3, () => 0)).toEqual(['bolt', 'brick', 'log'])
    expect(dailyOffers(f, 2, () => 0)).toEqual(['bolt', 'brick'])
    expect(dailyOffers(f, 1, () => 0)).toEqual(['bolt'])
    expect(dailyOffers(f, 0, () => 0)).toEqual([])
  })

  it('the first is the material a goal would give (the same measure: goalReward in goals.ts)', () => {
    const farms = [
      f,
      farmWith({ silo: 1, barn: 1 }),
      farmWith({ silo: 1, barn: 5 }, { brick: 2 }),
      farmWith({ silo: 7, barn: 3 }, { iron: 6, bolt: 7, log: 1, brick: 3, plank: 3, nail: 3 }),
      farmWith({ silo: 2, barn: 2 }, { iron: 2, bolt: 2, log: 2, brick: 2, plank: 2, nail: 1 }),
    ]
    for (const g of farms) expect(dailyOffers(g, 1, () => 0)[0], JSON.stringify(g.storage)).toBe(goalReward(GOALS[0], 0, g as unknown as FarmData).item)
  })

  it('materials equally short keep the order the silo and the barn list them', () => {
    expect(shortMaterials(farmWith({ silo: 1, barn: 1 }))).toEqual([...STORES.silo.materials, ...STORES.barn.materials])
  })

  it('the rest at random on the dice', () => {
    expect(dailyOffers(f, 5, rolls(0.5, 0.99))).toEqual(['bolt', 'brick', 'log', ITEMS[3], ITEMS[5]])
    // nothing short: all at random
    const rich = farmWith({ silo: 2, barn: 2 }, Object.fromEntries(ITEMS.map((i) => [i, 9])))
    expect(shortMaterials(rich)).toEqual([])
    expect(dailyOffers(rich, 3, rolls(0.1, 0.6, 0.95))).toEqual([ITEMS[0], ITEMS[3], ITEMS[5]])
  })

  it('gives only building materials, exactly as many as asked (never more than the most a day can have)', () => {
    const most = offersPerDay(LADDERS.stock.levels)
    const level = fc.integer({ min: 1, max: 30 })
    const count = fc.integer({ min: 0, max: 40 })
    const have = fc.record(Object.fromEntries(ITEMS.map((i) => [i, count])) as Record<ItemId, fc.Arbitrary<number>>)
    fc.assert(
      fc.property(level, level, have, fc.integer({ min: 0, max: 9 }), fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), (silo, barn, h, n, x) => {
        const offers = dailyOffers(farmWith({ silo, barn }, h), n, () => x)
        return offers.length === Math.min(n, most) && offers.every((o) => isItem(o))
      }),
      { numRuns: RUNS },
    )
    for (const n of [NaN, -3, Infinity, 2.7]) expect(dailyOffers(f, n, () => 0).length, String(n)).toBe(n === Infinity ? most : n === 2.7 ? 2 : 0)
  })
})

describe('his saved day read back', () => {
  /** A saved contractor the game can use: a whole day, and no more than `perDay` offers, each a material. */
  const valid = (c: Contractor, perDay: number) =>
    Number.isInteger(c.day) &&
    c.day >= -1 &&
    Array.isArray(c.offers) &&
    c.offers.length <= Math.max(0, perDay) &&
    c.offers.every((o) => isItem(o.item) && typeof o.sold === 'boolean' && Object.keys(o).length === 2)

  it('keeps a good save as it is', () => {
    const saved = {
      day: 12,
      offers: [
        { item: 'brick', sold: true },
        { item: 'log', sold: false },
        { item: 'brick', sold: false },
      ],
    }
    expect(sanitizeContractor(saved, 3)).toEqual(saved)
  })

  it('garbage reads back as no day yet and no offers', () => {
    for (const raw of [undefined, null, 'contractor', 3, true, [], {}, { day: 'monday' }, { offers: 'all' }]) expect(sanitizeContractor(raw, 3), JSON.stringify(raw)).toEqual({ day: -1, offers: [] })
  })

  it('only materials, each bought or not, and never more offers than the day allows', () => {
    const offers = [
      { item: 'lettuce', sold: false },
      { item: 'banana' },
      null,
      5,
      'nail',
      { item: 'iron', sold: 'yes' },
      { item: 'nail', sold: true, price: 1 },
      { item: 'bolt' },
      { item: 'plank' },
      { item: 'log' },
    ]
    expect(sanitizeContractor({ day: 4, offers }, 3)).toEqual({
      day: 4,
      offers: [
        { item: 'iron', sold: false },
        { item: 'nail', sold: true },
        { item: 'bolt', sold: false },
      ],
    })
    expect(sanitizeContractor({ day: 4, offers }, 5).offers).toHaveLength(5)
    for (const perDay of [0, -2, NaN]) expect(sanitizeContractor({ day: 4, offers }, perDay).offers, String(perDay)).toEqual([])
  })

  it('a broken day is no day yet; a fraction is the day it is in', () => {
    expect(sanitizeContractor({ day: NaN, offers: [] }, 3).day).toBe(-1)
    expect(sanitizeContractor({ day: Infinity, offers: [] }, 3).day).toBe(-1)
    expect(sanitizeContractor({ day: -40, offers: [] }, 3).day).toBe(-1)
    expect(sanitizeContractor({ day: 6.8, offers: [] }, 3).day).toBe(6)
  })

  it('whatever was saved, reads back as a contractor the game can use', () => {
    const item = fc.oneof(fc.constantFrom<unknown>(...PRODUCE.map((p) => p.id), 'banana', ''), fc.anything())
    const offer = fc.oneof(fc.record({ item, sold: fc.anything() }, { requiredKeys: [] }), fc.anything())
    const raw = fc.oneof(
      fc.anything(),
      fc.record({ day: fc.oneof(fc.double(), fc.integer(), fc.anything()), offers: fc.oneof(fc.array(offer, { maxLength: 12 }), fc.anything()) }, { requiredKeys: [] }),
    )
    const perDay = fc.oneof(fc.integer({ min: -2, max: 8 }), fc.double())
    fc.assert(
      fc.property(raw, perDay, (r, n) => valid(sanitizeContractor(r, n), Number.isFinite(n) ? n : n > 0 ? Infinity : 0)),
      { numRuns: RUNS },
    )
  })
})
