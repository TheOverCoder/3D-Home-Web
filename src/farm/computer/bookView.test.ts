import { describe, expect, it } from 'vitest'
import { LEDGER_DAYS, freshLedger, noteSale, type Channel, type Ledger } from '../ledger'
import type { ProduceId } from '../data'
import { bookView } from './bookView'

// What the computer's sales book shows (./bookView.ts): the book's days by the place the coins came from, this week
// against the last, your price index against the fair prices, and each good sold.

const TODAY = 20_410
const book = (...sales: [number, Channel, ProduceId, number, number][]) => sales.reduce((b: Ledger, [back, ch, good, u, c]) => noteSale(b, TODAY - back, ch, good, u, c), freshLedger())

describe('the sales book', () => {
  it('is two weeks of nothing for an empty book', () => {
    const v = bookView(freshLedger(), TODAY)
    expect(v.days).toHaveLength(LEDGER_DAYS)
    expect(v.days.map((d) => d.day)).toEqual(Array.from({ length: LEDGER_DAYS }, (_, k) => TODAY - LEDGER_DAYS + 1 + k))
    expect(v.days.every((d) => d.total === 0 && d.units === 0 && d.index === null)).toBe(true)
    expect([v.weekTotal, v.lastWeekTotal, v.index, v.goods]).toEqual([0, 0, null, []])
  })

  it("adds each day's coins by place, this week against the last, and what each good brought", () => {
    const v = bookView(book([8, 'contractor', 'brick', 2, 20], [3, 'manager', 'carrot', 10, 4], [0, 'gate', 'tomato', 4, 14], [0, 'order', 'egg', 2, 5], [0, 'order', 'tomato', 2, 8]), TODAY)
    const today = v.days[LEDGER_DAYS - 1]
    expect([today.coins.gate, today.coins.order, today.total, today.units]).toEqual([14, 13, 27, 8])
    expect(v.days[LEDGER_DAYS - 4].coins.manager).toBe(4)
    expect(v.days[LEDGER_DAYS - 9].coins.contractor).toBe(20)
    expect(v.week).toEqual({ gate: 14, order: 13, manager: 4, shop: 0, contractor: 0 })
    expect([v.weekTotal, v.lastWeekTotal]).toEqual([31, 20])
    expect(v.goods.map((g) => [g.good, g.units, g.coins, g.fair, g.places])).toEqual([
      ['tomato', 6, 22, 3, ['gate', 'order']],
      ['brick', 2, 20, 0, ['contractor']],
      ['egg', 2, 5, 2, ['order']],
      ['carrot', 10, 4, 2, ['manager']],
    ])
    expect(v.goods[0].per).toBeCloseTo(22 / 6)
  })

  it('sets what the goods brought against their fair price, ×100, materials not counted', () => {
    const v = bookView(book([8, 'contractor', 'brick', 2, 20], [3, 'manager', 'carrot', 10, 4], [0, 'gate', 'tomato', 4, 14], [0, 'order', 'egg', 2, 5]), TODAY)
    // today: 19 coins for 4 tomatoes (12 fair) and 2 eggs (4 fair); the week adds 10 carrots (20 fair) for 4
    expect(v.days[LEDGER_DAYS - 1].index).toBe(Math.round((19 / 16) * 100))
    expect(v.days[LEDGER_DAYS - 4].index).toBe(20)
    expect(v.days[LEDGER_DAYS - 9].index).toBeNull()
    expect(v.index).toBe(Math.round((23 / 36) * 100))
  })
})
