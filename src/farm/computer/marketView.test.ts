import { afterEach, describe, expect, it } from 'vitest'
import { CONTRACTOR, CROPS, ITEMS, ORDERS, PRODUCE, SELLABLE, SHOP, XP_FOR, arrivalEvery, buyerMean, produceById, type ProduceId } from '../data'
import { dateKey, priceFactor } from '../events'
import { freshLedger, noteSale } from '../ledger'
import { buyChance, freshMarket, shopperEvery, unitPrice } from '../market'
import { machineLevel } from '../machineView'
import { priceBoosts, priceEvents, priceOf } from '../prices'
import { goodOpensAt, marketView, pricesNow, type GoodMarket, type MarketFarm, type MarketNow } from './marketView'
import { MONDAY, SATURDAY, THURSDAY, WEDNESDAY, buyer, farmOf, nowAt, order } from './testFarms'

// What the computer's Market shows (./marketView.ts): every good's price now and why, what each place that buys it
// pays a unit, by the game's own rules, so that it never disagrees with a sale.

afterEach(() => {
  priceBoosts(() => 0)
  priceEvents(() => 1)
})

const OFF = nowAt(null)
const good = (v: ReturnType<typeof marketView>, id: ProduceId) => v.goods.find((g) => g.id === id)!
const channel = (g: GoodMarket, id: string) => g.channels.find((c) => c.id === id)

/** A farm played a while, on a Saturday with the draw made: the oven at level 2, the mill at 3, the manager's rate up
 *  two steps; a line and an order that want tomatoes and eggs; the draw's tomatoes and cloth. */
function played(): { f: MarketFarm; now: MarketNow } {
  const f = farmOf({
    machines: { ...farmOf().machines, oven: { ...farmOf().machines.oven, worked: 360 * 60 }, mill: { ...farmOf().machines.mill, worked: 1080 * 60 } },
    ladders: { ...farmOf().ladders, rate: 2 },
    events: { draw: { day: dateKey(SATURDAY), goods: ['tomato', 'cloth'] }, seen: [] },
    visitors: [buyer('tomato', 3, 12), buyer('egg', 2, 3, 'arriving'), buyer('milk', 1, 4, 'leaving')],
    orders: [order(30, ['tomato', 4, 1], ['egg', 2, 0]), { wait: 100 }],
    planted: ['tomato', 'lettuce'],
    made: ['cloth'],
    xp: { points: 2000, paid: 1 },
  })
  return { f, now: nowAt(SATURDAY) }
}

describe("a new farm's market, with the events off", () => {
  const v = marketView(farmOf(), OFF)

  it('prices every good at its fair price, with nothing to say why and nowhere it is heading', () => {
    expect(v.goods.map((g) => g.id)).toEqual(PRODUCE.map((p) => p.id))
    expect(v.events).toEqual([])
    expect(Object.values(v.speeds)).toEqual([1, 1, 1, 1, 1])
    for (const id of SELLABLE) {
      const g = good(v, id)
      const fair = produceById(id).price
      expect([g.base, g.now, g.move, g.why]).toEqual([fair, fair, 0, []])
      expect(g.trend).toEqual({ days: Array(7).fill(fair), tomorrow: fair, dir: 'flat', pct: 0 })
      expect(g.yours).toEqual(Array(14).fill(null))
    }
    expect(v.index.days).toEqual(Array(14).fill(100))
    expect([v.index.now, v.index.tomorrow, v.index.basket]).toEqual([100, 100, CROPS.map((c) => c.id)])
  })

  it('offers each good to a buyer, an order and the manager, as the gate, orderPay and managerPay would pay', () => {
    for (const id of SELLABLE) {
      const g = good(v, id)
      const p = produceById(id).price
      expect(g.channels.map((c) => c.id)).toEqual(['gate', 'order', 'manager'])
      const gate = channel(g, 'gate')!
      expect([gate.per, gate.low, gate.high, gate.gift, gate.gifts, gate.wait]).toEqual([p * buyerMean(), p * 0.6, p * 1.6, 0.5, 1, null])
      const ord = channel(g, 'order')!
      expect([ord.per, ord.bonusXp, ord.gift, ord.wait]).toEqual([p * ORDERS.markup, XP_FOR.order, 0.5, null])
      expect(ord.xp).toBeCloseTo((p * ORDERS.markup) / 5)
      expect(channel(g, 'manager')!.per).toBeCloseTo(p * 0.2)
      // an order pays most; the manager takes it at once
      expect([g.best, g.soonest]).toEqual(['order', 'manager'])
      expect(g.asks).toEqual({ buyer: produceById(id).maxAsk, order: Math.max(1, Math.round(produceById(id).maxAsk * 1.5)) })
      expect(g.line.every).toBe(arrivalEvery(0))
    }
  })

  it('sells a material to the contractor only, at what he pays, and says what he sells one for', () => {
    for (const id of ITEMS) {
      const g = good(v, id)
      expect([g.material, g.known, g.store, g.base, g.now, g.buyFor, g.best]).toEqual([true, true, 'barn', CONTRACTOR.buys, CONTRACTOR.buys, CONTRACTOR.sells, 'contractor'])
      expect(g.channels).toEqual([{ id: 'contractor', per: 10, low: 10, high: 10, xp: 2, bonusXp: 0, gift: 0, gifts: 0, wait: 0 }])
    }
  })

  it('knows what every farm has and what it grows and makes, and locks each good until the level it can first be had', () => {
    expect(['lemon', 'egg', 'milk', 'tomato', 'apple', 'cloth'].map((id) => good(v, id as ProduceId).known)).toEqual([true, true, true, false, false, false])
    const w = marketView(farmOf({ planted: ['tomato'], made: ['cloth'], producers: { ...farmOf().producers, 'apple-tree': { animals: 1, stock: [], timer: [] } } }), OFF)
    expect(['tomato', 'cloth', 'apple'].map((id) => good(w, id as ProduceId).known)).toEqual([true, true, true])
    expect(['pumpkin', 'carrot_cake', 'flour', 'apple', 'egg', 'cloth', 'brick'].map((id) => good(v, id as ProduceId).locked)).toEqual([10, 5, 2, 11, null, null, null])
    expect(goodOpensAt('sugar')).toBe(4)
    expect(marketView(farmOf(), { ...OFF, allOpen: true }).goods.every((g) => g.locked === null)).toBe(true)
  })
})

describe("a played farm's market on the draw's day", () => {
  const { f, now } = played()
  const v = marketView(f, now)

  it('is priced exactly as priceOf prices every good, given the same machines and the same day', () => {
    priceBoosts((m) => machineLevel(f.machines[m].worked).boost.coins)
    priceEvents((g) => priceFactor(g, f.events, now.at))
    const prices = pricesNow(f, now)
    for (const p of PRODUCE) expect(prices[p.id], p.id).toBe(priceOf(p.id))
    for (const id of SELLABLE) expect(good(v, id).now, id).toBe(priceOf(id))
  })

  it("says why: the oven's level, the mill's, the draw", () => {
    expect(v.events).toContain('lucky')
    expect(good(v, 'lemon_cake').why).toEqual([{ kind: 'machine', machine: 'oven', level: 2, times: 1.2 }])
    expect(good(v, 'lemon_cake').now).toBeCloseTo(50.4)
    expect(good(v, 'flour').why).toEqual([{ kind: 'machine', machine: 'mill', level: 3, times: 1.4 }])
    expect(good(v, 'cloth').why).toEqual([{ kind: 'draw', times: 2 }])
    const tomato = good(v, 'tomato')
    expect([tomato.now, tomato.move, tomato.why]).toEqual([6, 100, [{ kind: 'draw', times: 2 }]])
    // the draw is today's alone: tomorrow it is back at fair
    expect(tomato.trend).toEqual({ days: [3, 3, 3, 3, 3, 3, 6], tomorrow: 3, dir: 'down', pct: -50 })
  })

  it('shows who wants it in line and in the orders, and what the orders pay a unit of it', () => {
    const tomato = good(v, 'tomato')
    expect(tomato.line).toEqual({ buyers: 1, units: 3, best: 4, every: arrivalEvery(0) })
    // the order pays 30 for 4 tomatoes (6 each today) and 2 eggs (2 each): the tomatoes' share is 30 · 24 / 28
    expect(tomato.orders.orders).toBe(1)
    expect(tomato.orders.want).toBe(3)
    expect(tomato.orders.per).toBeCloseTo((30 * 24) / 28 / 4)
    // a buyer standing in line and an order that wants it take one at once, as the manager does: the order pays most
    expect(tomato.channels.map((c) => [c.id, c.wait])).toEqual([
      ['gate', 0],
      ['order', 0],
      ['manager', 0],
    ])
    expect(channel(tomato, 'manager')!.per).toBeCloseTo(6 * 0.3)
    expect([tomato.best, tomato.soonest]).toEqual(['order', 'order'])
    // a buyer on their way counts, but cannot be sold to yet; one going home does not count
    const egg = good(v, 'egg')
    expect([egg.line.buyers, egg.line.units, egg.line.best, channel(egg, 'gate')!.wait]).toEqual([1, 2, 1.5, null])
    expect(egg.orders).toEqual({ orders: 1, want: 2, per: (30 * 4) / 28 / 2 })
    expect(good(v, 'milk').line).toEqual({ buyers: 0, units: 0, best: 0, every: arrivalEvery(0) })
  })
})

describe('your own shop', () => {
  const f = farmOf({
    market: { ...freshMarket(), owned: true },
    ladders: { ...farmOf().ladders, places: 2, group: 1, pace: 2 },
  })
  f.market.shelves[0] = { good: 'carrot_cake', units: 3, pct: 150 }
  f.market.shelves[3] = { good: 'carrot_cake', units: 1, pct: 200 }
  // (a place not open holds nothing that counts)
  f.market.shelves[6] = { good: 'carrot_cake', units: 3, pct: 90 }
  const v = marketView(f, OFF)
  const every = shopperEvery(2)
  const wait = (pct: number) => every / (1 - (1 - buyChance(pct)) ** 2)

  it("takes the manager's place, at the price of the first shelf that holds the good", () => {
    const cake = good(v, 'carrot_cake')
    expect(cake.channels.map((c) => c.id)).toEqual(['gate', 'order', 'shop'])
    const shop = channel(cake, 'shop')!
    expect([shop.per, shop.low, shop.high]).toEqual([unitPrice(40, 150), unitPrice(40, SHOP.pct.min), unitPrice(40, SHOP.pct.max)])
    expect(shop.wait).toBeCloseTo(wait(150))
    expect(cake.shelves.map((s) => [s.place, s.pct, s.units, s.per])).toEqual([
      [0, 150, 3, 60],
      [3, 200, 1, 80],
    ])
    expect(cake.best).toBe('shop')
    // a good on no shelf: at the shop's starting price
    expect(channel(good(v, 'egg'), 'shop')!.per).toBe(unitPrice(2, SHOP.pct.start))
  })

  it('draws its price against its wait, a step at a time: dearer, less likely, longer', () => {
    const curve = good(v, 'carrot_cake').curve
    expect(curve.map((c) => c.pct)).toEqual(Array.from({ length: 22 }, (_, k) => 90 + 10 * k))
    for (let k = 1; k < curve.length; k++) {
      expect(curve[k].per).toBeGreaterThanOrEqual(curve[k - 1].per)
      expect(curve[k].chance).toBeLessThan(curve[k - 1].chance)
      expect(curve[k].wait).toBeGreaterThan(curve[k - 1].wait)
    }
    expect(curve[6].wait).toBeCloseTo(wait(150))
    // none before the shop is yours
    expect(good(marketView(farmOf(), OFF), 'carrot_cake').curve).toEqual([])
  })
})

describe('the week and the mood', () => {
  it("halves the wait for a buyer on market day, doubles the gifts on Thursday, and the crops' speed on Wednesday", () => {
    const monday = marketView(farmOf(), nowAt(MONDAY))
    expect(monday.events).toContain('market')
    expect([monday.speeds.buyers, good(monday, 'egg').line.every]).toEqual([2, arrivalEvery(0) / 2])
    const thursday = marketView(farmOf(), nowAt(THURSDAY))
    expect(
      good(thursday, 'egg')
        .channels.slice(0, 2)
        .map((c) => c.gifts),
    ).toEqual([2, 2])
    expect(marketView(farmOf(), nowAt(WEDNESDAY)).speeds.crops).toBe(2)
  })

  it("takes a mood for each good and day: today's in the price and its why, the week's and tomorrow's in its trend and the index", () => {
    const day = 20_410
    const mood = (g: ProduceId, d: number) => (g === 'tomato' ? 1 + (d - day + 1) / 100 : 3)
    const v = marketView(farmOf(), { at: null, day, mood })
    const tomato = good(v, 'tomato')
    expect(tomato.now).toBeCloseTo(3.03)
    expect(tomato.why).toEqual([{ kind: 'mood', times: 1.01 }])
    expect(tomato.trend.days.map((n) => Math.round(n * 100) / 100)).toEqual([2.85, 2.88, 2.91, 2.94, 2.97, 3, 3.03])
    expect(tomato.trend.dir).toBe('up')
    expect(tomato.trend.pct).toBeCloseTo((3.06 / 3.03 - 1) * 100)
    expect(channel(tomato, 'gate')!.per).toBeCloseTo(3.03 * buyerMean())
    // never a material's
    expect(good(v, 'brick').now).toBe(CONTRACTOR.buys)
    expect(good(v, 'brick').why).toEqual([])
    // the vegetable index: every other crop at 3, tomatoes at 1.01, the mean ×100
    expect(v.index.now).toBeCloseTo((100 * (11 * 3 + 1.01)) / 12)
    expect(v.index.tomorrow).toBeCloseTo((100 * (11 * 3 + 1.02)) / 12)
  })

  it("reads what you got a unit from the farm's sales book", () => {
    const day = 20_410
    const ledger = noteSale(noteSale(freshLedger(), day - 2, 'order', 'tomato', 4, 15), day, 'gate', 'tomato', 4, 14)
    const yours = good(marketView(farmOf({ ledger }), { at: null, day }), 'tomato').yours
    expect(yours.slice(-3)).toEqual([3.75, null, 3.5])
    expect(yours.filter((n) => n !== null)).toHaveLength(2)
  })
})
