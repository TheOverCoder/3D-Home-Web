import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LADDERS, LADDER_IDS, MANAGER, PRODUCE, SELLABLE, SHOP, produceById, type LadderId, type ProduceId } from './data'
import {
  MAX_PLACES,
  SHOP_LADDERS,
  buyChance,
  clampLevels,
  freshMarket,
  ladderPrice,
  managerPay,
  managerPct,
  placesOpen,
  rollShopper,
  sanitizeMarket,
  shopperEvery,
  shoppersAtOnce,
  snapPct,
  unitPrice,
  type Market,
  type Shelf,
} from './market'

// The supermarket's rules (src/farm/market.ts): what the manager pays, the ladders' prices and saved levels, a place's
// price and the chance a shopper takes a unit at it, what one shopper buys, and the saved market read back. Pure.

const RUNS = Number(process.env.FC_RUNS) || 300

/** The farm's dice in a test: the same numbers every run (mulberry32). */
function dice(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NONE: Record<LadderId, number> = clampLevels({})
const TOP = Object.fromEntries(LADDER_IDS.map((id) => [id, LADDERS[id].levels])) as Record<LadderId, number>
const shelf = (good: ProduceId | null, units: number, pct: number = SHOP.pct.start): Shelf => ({ good, units, pct })
const onStep = (pct: number) => pct >= SHOP.pct.min && pct <= SHOP.pct.max && (pct - SHOP.pct.min) % SHOP.pct.step === 0

/** A market the game can use, for these ladder levels (see sanitizeMarket). */
function problems(m: Market, levels: Record<LadderId, number>): string[] {
  const out: string[] = []
  const open = m.owned ? placesOpen(levels.places) : 0
  if (typeof m.owned !== 'boolean') out.push('owned')
  if (!Array.isArray(m.shelves) || m.shelves.length !== MAX_PLACES) out.push('shelves')
  m.shelves.forEach((s, k) => {
    if (s.good !== null && !SELLABLE.includes(s.good)) out.push(`${k}: good ${s.good}`)
    if (!Number.isInteger(s.units) || s.units < 0 || s.units > SHOP.units) out.push(`${k}: units ${s.units}`)
    if (s.good === null && s.units !== 0) out.push(`${k}: units with no good`)
    if (!onStep(s.pct)) out.push(`${k}: pct ${s.pct}`)
    if (k >= open && (s.good !== null || s.units !== 0 || s.pct !== SHOP.pct.start)) out.push(`${k}: a closed place holds something`)
  })
  for (const v of [m.till.coins, m.till.goods]) if (!Number.isSafeInteger(v) || v < 0) out.push(`till ${v}`)
  if (!m.owned && (m.till.coins !== 0 || m.till.goods !== 0)) out.push('a till in a shop not yours')
  if (!Number.isInteger(m.nextIn) || m.nextIn < 0 || m.nextIn > shopperEvery(levels.pace)) out.push(`nextIn ${m.nextIn}`)
  return out
}

describe('the manager', () => {
  it('pays MANAGER.pct, MANAGER.pctStep more for every step of his ladder: 20% to 40% at its top', () => {
    expect(managerPct(0)).toBe(MANAGER.pct)
    expect(managerPct(0)).toBe(20)
    expect(managerPct(LADDERS.rate.levels)).toBe(40)
    for (let k = 0; k <= LADDERS.rate.levels; k++) expect(LADDERS.rate.say(k)).toBe(`Pays ${managerPct(k)}%`)
  })

  it('pays the whole stack rounded down: a good worth 5 at 20% pays 1, 5 lettuces 3, 1 carrot 0', () => {
    expect(managerPay(5, 1, 20)).toBe(1)
    expect(produceById('lettuce').price).toBe(3)
    expect(managerPay(produceById('lettuce').price, 5, managerPct(0))).toBe(3)
    expect(produceById('carrot').price).toBe(2)
    expect(managerPay(produceById('carrot').price, 1, managerPct(0))).toBe(0)
    expect(managerPay(produceById('pumpkin_pie').price, 3, managerPct(4))).toBe(60)
    expect(managerPay(7, 0, 40)).toBe(0)
  })
})

describe('the ladders', () => {
  it('step k costs base + step · k', () => {
    expect(ladderPrice('rate', 0)).toBe(120)
    expect(ladderPrice('rate', 3)).toBe(360)
    expect(ladderPrice('places', 6)).toBe(80 + 40 * 6)
    for (const id of LADDER_IDS) for (let k = 0; k < LADDERS[id].levels; k++) expect(ladderPrice(id, k)).toBe(LADDERS[id].price[0] + LADDERS[id].price[1] * k)
  })

  it('saved levels read back whole, from 0 to each top; broken ones are 0', () => {
    for (const raw of [undefined, null, 'x', 4, [], {}, { rate: 'all' }, { rate: NaN, places: -Infinity }]) expect(clampLevels(raw), JSON.stringify(raw)).toEqual(NONE)
    expect(clampLevels({ rate: 2.9, places: 99, group: -2, pace: 1, stock: Infinity, discount: 5, extra: 3 })).toEqual({ rate: 2, places: 7, group: 0, pace: 1, stock: 0, discount: 5 })
    expect(clampLevels(TOP)).toEqual(TOP)
  })

  it('a shop not yours has none of its own ladders; the manager and the contractor keep theirs', () => {
    expect(SHOP_LADDERS).toEqual(['places', 'group', 'pace'])
    expect(clampLevels(TOP, false)).toEqual({ ...TOP, places: 0, group: 0, pace: 0 })
    expect(clampLevels(TOP, true)).toEqual(TOP)
    expect(clampLevels(TOP)).toEqual(TOP)
  })
})

describe('a place on the shelves', () => {
  it('sells a unit at pct% of its fair price, rounded, at least one coin', () => {
    expect(unitPrice(3, 100)).toBe(3)
    expect(unitPrice(2, 90)).toBe(2)
    expect(unitPrice(1, 90)).toBe(1)
    expect(unitPrice(3, 150)).toBe(5)
    expect(unitPrice(50, 300)).toBe(150)
    expect(unitPrice(0, 90)).toBe(1)
  })

  it('a price snaps into its range, on its step', () => {
    expect(snapPct(100)).toBe(100)
    expect(snapPct(94)).toBe(90)
    expect(snapPct(96)).toBe(100)
    expect(snapPct(0)).toBe(SHOP.pct.min)
    expect(snapPct(-50)).toBe(SHOP.pct.min)
    expect(snapPct(1000)).toBe(SHOP.pct.max)
    expect(snapPct(NaN)).toBe(SHOP.pct.start)
    expect(snapPct(Infinity)).toBe(SHOP.pct.start)
    for (let p = -20; p < 400; p += 0.7) expect(onStep(snapPct(p)), String(p)).toBe(true)
  })

  it('a shopper takes a unit with 0.9 at the lowest price, 0.04 at the highest, 0.37 at 150%', () => {
    expect(buyChance(SHOP.pct.min)).toBe(0.9)
    expect(buyChance(90)).toBe(0.9)
    expect(buyChance(300)).toBeCloseTo(0.04, 12)
    expect(buyChance(150)).toBeCloseTo(0.37, 2)
    expect(buyChance(SHOP.pct.start)).toBeGreaterThan(0.5)
  })

  it('the dearer, the less likely: falling all the way, the same share for every step, kept within its ends outside the range', () => {
    let last = Infinity
    for (let p = SHOP.pct.min; p <= SHOP.pct.max; p += 0.5) {
      const c = buyChance(p)
      expect(c, String(p)).toBeLessThan(last)
      last = c
    }
    const share = buyChance(SHOP.pct.min + SHOP.pct.step) / buyChance(SHOP.pct.min)
    for (let p = SHOP.pct.min; p < SHOP.pct.max; p += SHOP.pct.step) expect(buyChance(p + SHOP.pct.step) / buyChance(p)).toBeCloseTo(share, 12)
    expect(buyChance(10)).toBe(0.9)
    expect(buyChance(5000)).toBeCloseTo(0.04, 12)
    expect(buyChance(NaN)).toBe(0.9)
  })
})

describe('the visits', () => {
  it('come every SHOP.every seconds, SHOP.faster sooner for each step of pace; one shopper more for each step of group', () => {
    expect(shopperEvery(0)).toBe(150)
    expect(shopperEvery(LADDERS.pace.levels)).toBe(30)
    expect(shoppersAtOnce(0)).toBe(1)
    expect(shoppersAtOnce(LADDERS.group.levels)).toBe(4)
    for (let k = 0; k <= LADDERS.pace.levels; k++) expect(LADDERS.pace.say(k)).toBe(`Every ${shopperEvery(k)} s`)
    for (let k = 0; k <= LADDERS.group.levels; k++) expect(LADDERS.group.say(k)).toBe(`${shoppersAtOnce(k)} at a time`)
    for (let k = 0; k <= LADDERS.places.levels; k++) expect(LADDERS.places.say(k)).toBe(`${placesOpen(k)} places`)
    expect(placesOpen(LADDERS.places.levels)).toBe(MAX_PLACES)
    expect(MAX_PLACES).toBe(10)
  })
})

describe('a shopper', () => {
  const shelves = [shelf('lettuce', 3, 100), shelf('pumpkin_pie', 2, 300), shelf(null, 0), shelf('egg', 1, 90), shelf('milk', 0, 120), shelf('cloth', 3, 150)]

  it('with the dice always 0 buys every unit on the open places, and pays each at its price', () => {
    const r = rollShopper(shelves, 4, () => 0)
    expect(r.taken).toEqual([3, 2, 0, 1, 0, 0])
    expect(r.units).toBe(6)
    const price = (id: ProduceId) => produceById(id).price
    expect(r.coins).toBe(3 * unitPrice(price('lettuce'), 100) + 2 * unitPrice(price('pumpkin_pie'), 300) + 1 * unitPrice(price('egg'), 90))
    expect(rollShopper(shelves, 99, () => 0).taken).toEqual([3, 2, 0, 1, 0, 3])
  })

  it('with the dice always high buys nothing; with no places open, nothing', () => {
    expect(rollShopper(shelves, 6, () => 0.999999)).toEqual({ taken: [0, 0, 0, 0, 0, 0], coins: 0, units: 0 })
    expect(rollShopper(shelves, 0, () => 0)).toEqual({ taken: [0, 0, 0, 0, 0, 0], coins: 0, units: 0 })
  })

  it('does not change the shelves', () => {
    const before = JSON.stringify(shelves)
    rollShopper(shelves, 6, () => 0)
    expect(JSON.stringify(shelves)).toBe(before)
  })

  it('over 60,000 units takes each with its chance, within ±1%', () => {
    for (const pct of [90, 100, 150, 200, 250, 300]) {
      const rand = dice(pct)
      const one = [shelf('tomato', SHOP.units, pct)]
      let units = 0
      let coins = 0
      for (let n = 0; n < 60000 / SHOP.units; n++) {
        const r = rollShopper(one, 1, rand)
        units += r.units
        coins += r.coins
      }
      expect(Math.abs(units / 60000 - buyChance(pct)), `${pct}%: ${units / 60000} against ${buyChance(pct)}`).toBeLessThan(0.01)
      expect(coins).toBe(units * unitPrice(produceById('tomato').price, pct))
    }
  })
})

describe('the saved market read back', () => {
  const owned = (shelves: unknown[], rest: object = {}) => ({ owned: true, shelves, till: { coins: 40, goods: 9 }, nextIn: 20, ...rest })

  it('a new market: not yours, ten empty places, an empty till, a whole wait to the first visit', () => {
    const m = freshMarket()
    expect(m).toEqual({ owned: false, shelves: Array.from({ length: 10 }, () => shelf(null, 0)), till: { coins: 0, goods: 0 }, nextIn: SHOP.every })
    expect(problems(m, NONE)).toEqual([])
    expect(sanitizeMarket(m, NONE)).toEqual(m)
  })

  it('keeps a good save as it is', () => {
    const levels = { ...NONE, rate: 4, places: 2, pace: 1 }
    const saved = owned([shelf('lettuce', 3, 120), shelf('egg', 1, 90), shelf('cloth', 2, 300), shelf('milk', 0, 150), shelf(null, 0)], { nextIn: 80 })
    const m = sanitizeMarket(saved, levels)
    expect(m.shelves.slice(0, 5)).toEqual(saved.shelves)
    expect(m.till).toEqual({ coins: 40, goods: 9 })
    expect(m.nextIn).toBe(80)
    expect(problems(m, levels)).toEqual([])
  })

  it('an open place sold out keeps its good and its price (as a bed keeps its crop)', () => {
    const m = sanitizeMarket(owned([shelf('strawberry', 0, 180), shelf('corn', 0, 90)]), NONE)
    expect(m.shelves[0]).toEqual(shelf('strawberry', 0, 180))
    expect(m.shelves[1]).toEqual(shelf('corn', 0, 90))
  })

  it('a closed place holds nothing', () => {
    const full = Array.from({ length: 10 }, () => shelf('egg', 3, 200))
    const m = sanitizeMarket(owned(full), { ...NONE, places: 2 })
    expect(m.shelves.slice(0, 5)).toEqual(full.slice(0, 5))
    expect(m.shelves.slice(5)).toEqual(Array.from({ length: 5 }, () => shelf(null, 0)))
  })

  it('a shop not yours has empty shelves and an empty till, whatever was saved', () => {
    const full = Array.from({ length: 10 }, () => shelf('egg', 3, 200))
    for (const o of [false, undefined, 'yes', 1]) {
      const m = sanitizeMarket({ owned: o, shelves: full, till: { coins: 500, goods: 30 }, nextIn: 10 }, TOP)
      expect(m.owned).toBe(false)
      expect(m.shelves).toEqual(freshMarket().shelves)
      expect(m.till).toEqual({ coins: 0, goods: 0 })
      expect(problems(m, clampLevels(TOP, false))).toEqual([])
    }
  })

  it('only goods that sell go on a shelf: a building material or an unknown good empties the place', () => {
    const m = sanitizeMarket(owned([shelf('brick', 3), { good: 'banana', units: 2, pct: 100 }, { good: 7, units: 1, pct: 100 }]), NONE)
    expect(m.shelves.slice(0, 3)).toEqual([shelf(null, 0), shelf(null, 0), shelf(null, 0)])
    for (const p of PRODUCE) if (p.material) expect(SELLABLE).not.toContain(p.id)
  })

  it('puts broken numbers right: units whole from 0 to SHOP.units, prices on their step, the till whole, the wait no longer than a visit', () => {
    const m = sanitizeMarket(
      owned([
        { good: 'egg', units: -2, pct: 95 },
        { good: 'egg', units: 7, pct: 1000 },
        { good: 'egg', units: NaN, pct: -5 },
        { good: 'egg', units: '3', pct: 'cheap' },
        { good: 'egg', units: 2.6, pct: Infinity },
      ]),
      { ...NONE, places: 2, pace: 4 },
    )
    expect(m.shelves.slice(0, 5)).toEqual([shelf('egg', 0, 100), shelf('egg', 3, 300), shelf('egg', 0, 90), shelf('egg', 0, 100), shelf('egg', 2, 100)])
    expect(sanitizeMarket(owned([], { nextIn: 1e9 }), { ...NONE, pace: 4 }).nextIn).toBe(30)
    expect(sanitizeMarket(owned([], { nextIn: -3 }), NONE).nextIn).toBe(SHOP.every)
    expect(sanitizeMarket(owned([], { nextIn: NaN }), NONE).nextIn).toBe(SHOP.every)
    expect(sanitizeMarket(owned([], { nextIn: 12.8 }), NONE).nextIn).toBe(12)
    expect(sanitizeMarket(owned([], { till: { coins: -5, goods: 'many' } }), NONE).till).toEqual({ coins: 0, goods: 0 })
    expect(sanitizeMarket(owned([], { till: { coins: 1e300, goods: 3.5 } }), NONE).till).toEqual({ coins: Number.MAX_SAFE_INTEGER, goods: 3 })
    expect(sanitizeMarket(owned([], { till: 'full' }), NONE).till).toEqual({ coins: 0, goods: 0 })
  })

  it('too many shelves, or shelves that are not shelves, read back as ten places', () => {
    const long = Array.from({ length: 50 }, () => shelf('egg', 3, 200))
    expect(sanitizeMarket(owned(long), TOP).shelves).toHaveLength(10)
    for (const shelves of ['shelves', 5, null, { 0: shelf('egg', 3) }, [null, 'egg', 3, [], true]]) {
      const m = sanitizeMarket({ owned: true, shelves }, TOP)
      expect(m.shelves, JSON.stringify(shelves)).toEqual(freshMarket().shelves)
    }
  })

  it('garbage reads back as a new market; broken ladder levels are read as none', () => {
    for (const raw of [undefined, null, 'market', 42, true, [], {}, { owned: 'yes' }]) expect(sanitizeMarket(raw, NONE), JSON.stringify(raw)).toEqual(freshMarket())
    const m = sanitizeMarket(owned([shelf('egg', 3)], { nextIn: 500 }), {} as Record<LadderId, number>)
    expect(problems(m, NONE)).toEqual([])
    expect(m.nextIn).toBe(SHOP.every)
  })

  it('whatever was saved, reads back as a market the game can use', () => {
    const num = fc.oneof(fc.double(), fc.integer({ min: -5, max: 400 }), fc.constantFrom(NaN, Infinity, -Infinity, 1e300))
    const good = fc.oneof(fc.constantFrom<unknown>(...PRODUCE.map((p) => p.id), null, 'banana', ''), fc.anything())
    const aShelf = fc.oneof(fc.record({ good, units: fc.oneof(num, fc.anything()), pct: fc.oneof(num, fc.anything()) }, { requiredKeys: [] }), fc.anything())
    const raw = fc.oneof(
      fc.anything(),
      fc.record(
        {
          owned: fc.oneof(fc.boolean(), fc.anything()),
          shelves: fc.oneof(fc.array(aShelf, { maxLength: 14 }), fc.anything()),
          till: fc.oneof(fc.record({ coins: num, goods: num }, { requiredKeys: [] }), fc.anything()),
          nextIn: fc.oneof(num, fc.anything()),
        },
        { requiredKeys: [] },
      ),
    )
    const levels = fc.record(Object.fromEntries(LADDER_IDS.map((id) => [id, fc.oneof(fc.integer({ min: -2, max: 9 }), num)])) as Record<LadderId, fc.Arbitrary<number>>)
    fc.assert(
      fc.property(raw, levels, (r, lv) => {
        const m = sanitizeMarket(r, lv)
        return problems(m, clampLevels(lv)).length === 0
      }),
      { numRuns: RUNS },
    )
  })
})
