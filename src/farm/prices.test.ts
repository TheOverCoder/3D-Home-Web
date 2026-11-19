import { afterEach, describe, expect, it } from 'vitest'
import { BUYER_OFFERS, PRODUCE, buyerMean, produceById, type MachineId, type ProduceId } from './data'
import { makerOf, offerFactor, priceAt, priceBoosts, priceEvents, priceOf } from './prices'

// What a good is worth (src/farm/prices.ts): priceAt with its parts given is what priceOf works out from the farm's, so
// a view of the prices (src/farm/computer) can never disagree with a sale; and the table of what buyers offer, which
// the gate's offers roll on. (Today's farm, every price as it was before: src/farm/state.prices.test.ts.)

/** The floats just below and just above a number. */
function besideOf(x: number): [number, number] {
  const f = new Float64Array([x])
  const bits = new BigInt64Array(f.buffer)
  const at = bits[0]
  bits[0] = at - 1n
  const down = f[0]
  bits[0] = at + 1n
  return [down, f[0]]
}

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
    const boost: Record<MachineId, number> = { mill: 0.2, loom: 0, oven: 0.6, dairy: 0.3 }
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
    // the cumulative odds are the steps priceFor in src/farm/state/buyers.ts rolls against
    let sum = 0
    const steps = BUYER_OFFERS.slice(0, -1).map((o) => (sum += o.odds))
    steps.forEach((s, k) => expect(s).toBeCloseTo([0.15, 0.38, 0.66, 0.86][k], 12))
    expect(factors).toEqual([0.6, 0.85, 1, 1.25, 1.6])
  })

  it('draws each factor for a roll as its odds say, a step exactly where the odds put it', () => {
    // a roll under 0.15 is cheeky, from 0.15 to under 0.38 a little under, … from 0.86 up to 1 generous
    const steps = [0, 0.15, 0.38, 0.66, 0.86]
    steps.forEach((step, k) => {
      expect(offerFactor(step), `at ${step}`).toBe(BUYER_OFFERS[k].factor)
      if (k > 0) expect(offerFactor(besideOf(step)[0]), `just under ${step}`).toBe(BUYER_OFFERS[k - 1].factor)
    })
    expect(offerFactor(besideOf(1)[0])).toBe(1.6)
    // a sweep of rolls: each factor as often as its odds
    const rolls = Array.from({ length: 10_000 }, (_, k) => (k + 0.5) / 10_000)
    for (const o of BUYER_OFFERS) expect(rolls.filter((r) => offerFactor(r) === o.factor).length / rolls.length).toBeCloseTo(o.odds, 3)
  })

  it('is, at every roll, what priceFor drew before it read the table: the same offers on the same dice', () => {
    // priceFor's roll as it was written before (2026-11-18), word for word
    const before = (r: number) => (r < 0.15 ? 0.6 : r < 0.38 ? 0.85 : r < 0.66 ? 1 : r < 0.86 ? 1.25 : 1.6)
    // each step and the floats either side of it, the ends, and a sweep of rolls between
    const rolls = [0, besideOf(1)[0], ...[0.15, 0.38, 0.66, 0.86].flatMap((s) => [s, ...besideOf(s)])]
    for (let k = 0; k < 20_000; k++) rolls.push(k / 20_000, (k + Math.random()) / 20_000)
    for (const r of rolls) expect(offerFactor(r), `roll ${r}`).toBe(before(r))
  })

  it('comes to a little over fair on average', () => {
    expect(buyerMean()).toBeCloseTo(1.0395, 12)
    expect(produceById('egg').price * buyerMean()).toBeCloseTo(2.079)
  })
})
