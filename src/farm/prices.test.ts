import { afterEach, describe, expect, it } from 'vitest'
import { BUYER_OFFERS, PRODUCE, buyerMean, produceById, type MachineId, type ProduceId } from './data'
import { makerOf, priceAt, priceBoosts, priceEvents, priceOf } from './prices'

// What a good is worth (src/farm/prices.ts): priceAt with its parts given is what priceOf works out from the farm's, so
// a view of the prices (src/farm/computer) can never disagree with a sale; and the table of what buyers offer.

afterEach(() => {
  priceBoosts(() => 0)
  priceEvents(() => 1)
})

describe('a price with its parts given', () => {
  it('is the fair price with no boost and no factor, and its parts multiply', () => {
    for (const p of PRODUCE) expect(priceAt(p.id)).toBe(p.price)
    expect(priceAt('lemon_cake', 0.2)).toBeCloseTo(42 * 1.2)
    expect(priceAt('tomato', 0, 2)).toBe(6)
    expect(priceAt('lemon_cake', 0.4, 2)).toBeCloseTo(42 * 1.4 * 2)
    // nothing below the fair price for a machine's level, as priceOf
    expect(priceAt('flour', -0.5)).toBe(4)
  })

  it('is what priceOf gives for every good, whatever the farm says of its machines and its day', () => {
    const boost: Record<MachineId, number> = { mill: 0.2, loom: 0, oven: 0.6 }
    const factor = (good: ProduceId) => (good === 'tomato' || good === 'cloth' ? 2 : good === 'carrot' ? 0.93 : 1)
    priceBoosts((m) => boost[m])
    priceEvents(factor)
    for (const p of PRODUCE) {
      const maker = makerOf(p.id)
      expect(priceOf(p.id), p.id).toBe(priceAt(p.id, maker ? boost[maker] : 0, factor(p.id)))
    }
    expect(priceOf('pumpkin_pie')).toBeCloseTo(50 * 1.6)
    expect(priceOf('cloth')).toBe(30)
  })
})

describe('what a buyer at the gate offers', () => {
  it("is five factors, cheeky to generous, whose odds sum to 1 and are priceFor's", () => {
    expect(BUYER_OFFERS.reduce((n, o) => n + o.odds, 0)).toBeCloseTo(1, 12)
    const factors = BUYER_OFFERS.map((o) => o.factor)
    expect([...factors].sort((a, b) => a - b)).toEqual(factors)
    // the cumulative odds are the steps priceFor in src/farm/state.ts rolls against
    let sum = 0
    const steps = BUYER_OFFERS.slice(0, -1).map((o) => (sum += o.odds))
    steps.forEach((s, k) => expect(s).toBeCloseTo([0.15, 0.38, 0.66, 0.86][k], 12))
    expect(factors).toEqual([0.6, 0.85, 1, 1.25, 1.6])
  })

  it('comes to a little over fair on average', () => {
    expect(buyerMean()).toBeCloseTo(1.0395, 12)
    expect(produceById('egg').price * buyerMean()).toBeCloseTo(2.079)
  })
})
