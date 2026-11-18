// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CONTRACTOR, LADDERS, SHOP, produceById, type ProduceId } from './data'
import { dayNumber } from './daily'
import { LEDGER_DAYS, type Channel, type Tally } from './ledger'
import { MAX_PLACES, unitPrice } from './market'
import { priceEvents, priceOf } from './prices'
import {
  acceptOffer,
  buyLadder,
  buyMarket,
  cameBack,
  declineOffer,
  declineOrder,
  farm,
  fillPlace,
  ledgerNow,
  managerPays,
  marketFill,
  orderAt,
  orderShares,
  resetFarm,
  sellAll,
  sellAllToManager,
  sellToContractor,
  sellToManager,
  sendOrder,
  setDailyClock,
  setHour,
  setPlacePrice,
  setRandom,
  spawnVisitor,
  takeTill,
  tick,
} from './state'
import { savedNow, startFrom } from './testSaves'

// The sales book in play (src/farm/state/ledger.ts; its rules in src/farm/ledger.ts): every sale writes itself in once,
// on its day, at the place it was made — a buyer at the gate, an order sent (good by good, by its share of the pay),
// the manager, your shop's shelves (as a shopper buys, while you are away too) and the contractor — and a decline
// writes nothing.

/** Noon on a day of November 2026, on the device's calendar (local time). */
const noon = (d: number) => new Date(2026, 10, d, 12).getTime()
const TODAY = dayNumber(noon(18))

beforeEach(() => {
  localStorage.clear()
  setDailyClock(() => noon(18))
  resetFarm()
  setRandom(() => 0.99)
})
afterEach(() => {
  setRandom(null)
  setDailyClock(null)
  priceEvents(() => 1)
})

/** What the book holds for a good at a place, on a day (today unless said). */
const tally = (good: ProduceId, channel: Channel, day = TODAY): Tally | undefined => farm.ledger.days.find((d) => d.day === day)?.sold[good]?.[channel]

/** An order on the board, filled: these lines (good, how many), paying `coins`. */
function filledOrder(k: number, coins: number, ...lines: [ProduceId, number][]) {
  farm.orders[k] = { order: { id: 900 + k, coins, surprise: false, lines: lines.map(([good, want]) => ({ good, want, have: want })) } }
}

/** The manager's rate to its top and the shop bought. */
function ownShop() {
  farm.coins = 100_000
  for (let k = 0; k < LADDERS.rate.levels; k++) expect(buyLadder('rate')).toBe(true)
  expect(buyMarket()).toBe(true)
}

describe('every sale, written in the book once', () => {
  it('a new farm has sold nothing', () => {
    expect(farm.ledger).toEqual({ days: [] })
  })

  it('at the gate: what each buyer took and paid, today; a buyer declined writes nothing', () => {
    farm.inv.lettuce = 9
    farm.inv.egg = 4
    expect(acceptOffer(spawnVisitor({ want: 'lettuce', qty: 2, offer: 9, queued: true }).id)).toBe(true)
    expect(tally('lettuce', 'gate')).toEqual([2, 9])
    expect(declineOffer(spawnVisitor({ want: 'egg', qty: 2, offer: 5, queued: true }).id)).toBe(true)
    expect(tally('egg', 'gate')).toBeUndefined()
    // everyone in line you have enough for: each sale adds up on the day
    spawnVisitor({ want: 'lettuce', qty: 3, offer: 10, queued: true })
    spawnVisitor({ want: 'egg', qty: 4, offer: 7, queued: true })
    expect(sellAll()).toBe(2)
    expect([tally('lettuce', 'gate'), tally('egg', 'gate')]).toEqual([
      [5, 19],
      [4, 7],
    ])
  })

  it('an order sent: each good with its share of the pay, by what it is worth, in whole coins that add up to the pay; one declined writes nothing', () => {
    // tomatoes 4 × 3 and eggs 2 × 2: the tomatoes three quarters of 30, the eggs the rest
    filledOrder(0, 30, ['tomato', 4], ['egg', 2])
    expect(orderShares(orderAt(0)!)).toEqual([
      { good: 'tomato', units: 4, coins: 23 },
      { good: 'egg', units: 2, coins: 7 },
    ])
    expect(sendOrder(0)).toBe(true)
    expect([tally('tomato', 'order'), tally('egg', 'order')]).toEqual([
      [4, 23],
      [2, 7],
    ])
    filledOrder(1, 50, ['corn', 2])
    expect(declineOrder(1)).toBe(true)
    expect(tally('corn', 'order')).toBeUndefined()
  })

  it("an order's shares follow what each good is worth now: a good on the lucky draw takes its doubled share", () => {
    priceEvents((good) => (good === 'egg' ? 2 : 1))
    filledOrder(0, 31, ['tomato', 4], ['egg', 2], ['lemon_cake', 1])
    const o = orderAt(0)!
    const shares = orderShares(o)
    // tomatoes 12, eggs 8 (doubled), a lemon cake 42: of 62
    expect(shares.map((s) => s.coins)).toEqual([6, 4, 21])
    expect(shares.reduce((n, s) => n + s.coins, 0)).toBe(o.coins)
    for (const s of shares) expect(Math.abs(s.coins - (o.coins * priceOf(s.good) * s.units) / 62)).toBeLessThan(1)
  })

  it('to the manager: the stack he took and his coins, each good of a Sell all on its own; nothing when he pays nothing', () => {
    farm.inv.pumpkin = 3
    const coins = managerPays('pumpkin')
    expect(sellToManager('pumpkin')).toBe(coins)
    expect(tally('pumpkin', 'manager')).toEqual([3, coins])
    // one carrot at his first rate comes to nothing: no sale
    farm.inv.carrot = 1
    expect(sellToManager('carrot')).toBe(0)
    expect(tally('carrot', 'manager')).toBeUndefined()
    Object.assign(farm.inv, { tomato: 7, milk: 5 })
    const pays = { tomato: managerPays('tomato'), milk: managerPays('milk') }
    sellAllToManager()
    expect([tally('tomato', 'manager'), tally('milk', 'manager')]).toEqual([
      [7, pays.tomato],
      [5, pays.milk],
    ])
  })

  it('off your shelves: what each shopper took from each place, at its price, as they buy (taking the till writes nothing more)', () => {
    ownShop()
    Object.assign(farm.inv, { lettuce: 3, pumpkin: 2 })
    fillPlace(0, 'lettuce', 3)
    fillPlace(1, 'pumpkin', 2)
    setPlacePrice(0, 150)
    setRandom(() => 0)
    for (let t = 0; t < SHOP.every + 300 && farm.market.till.goods < 5; t += 0.25) tick(0.25)
    expect(farm.market.till.goods).toBe(5)
    expect([tally('lettuce', 'shop'), tally('pumpkin', 'shop')]).toEqual([
      [3, 3 * unitPrice(produceById('lettuce').price, 150)],
      [2, 2 * unitPrice(produceById('pumpkin').price, SHOP.pct.start)],
    ])
    // together, what they paid into the till
    expect(tally('lettuce', 'shop')![1] + tally('pumpkin', 'shop')![1]).toBe(farm.market.till.coins)
    const book = farm.ledger
    expect(takeTill()).toBeGreaterThan(0)
    expect(farm.ledger).toBe(book)
  })

  it('to the contractor: the stack of a material and his coins; nothing when he is not at his window', () => {
    farm.inv.brick = 7
    expect(sellToContractor('brick')).toBe(7 * CONTRACTOR.buys)
    expect(tally('brick', 'contractor')).toEqual([7, 7 * CONTRACTOR.buys])
    setHour(22)
    farm.inv.log = 2
    expect(sellToContractor('log')).toBe(0)
    expect(tally('log', 'contractor')).toBeUndefined()
  })
})

describe('the book over days', () => {
  it("while you are away the shop's shoppers buy into the book, as the welcome back counts them", () => {
    farm.coins = 100_000
    buyLadder('group')
    marketFill('pumpkin')
    farm.market.nextIn = 10
    setRandom(() => 0)
    const r = cameBack(15)!
    expect(r.shop).toEqual({ goods: MAX_PLACES * SHOP.units, coins: MAX_PLACES * SHOP.units * produceById('pumpkin').price })
    expect(tally('pumpkin', 'shop')).toEqual([r.shop!.goods, r.shop!.coins])
    // nothing on the shelves: nothing more
    const book = farm.ledger
    cameBack(3600)
    expect(farm.ledger).toBe(book)
  })

  it('a new day starts a new page; two weeks on, the oldest has gone', () => {
    farm.inv.brick = 20
    sellToContractor('brick')
    setDailyClock(() => noon(19))
    farm.inv.brick = 1
    sellToContractor('brick')
    expect(farm.ledger.days.map((d) => d.day)).toEqual([TODAY, TODAY + 1])
    expect([tally('brick', 'contractor'), tally('brick', 'contractor', TODAY + 1)]).toEqual([
      [20, 200],
      [1, 10],
    ])
    // the book as it stands two weeks after the first sale: only the second day's
    setDailyClock(() => noon(18 + LEDGER_DAYS))
    expect(ledgerNow().days.map((d) => d.day)).toEqual([TODAY + 1])
  })

  it('the save keeps it, and a farm loaded on a later day keeps only the days of its two weeks', () => {
    farm.inv.brick = 2
    sellToContractor('brick')
    startFrom(savedNow())
    expect(tally('brick', 'contractor')).toEqual([2, 20])
    setDailyClock(() => noon(18 + LEDGER_DAYS))
    startFrom(savedNow())
    expect(farm.ledger).toEqual({ days: [] })
  })
})
