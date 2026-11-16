// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ITEMS, cropById, produceById, type ProduceId } from './data'
import { orderPay } from './orders'
import { priceOf } from './prices'
import {
  acceptOffer,
  addJob,
  buy,
  cameBack,
  drawLucky,
  eventTime,
  eventSpeed,
  farm,
  luckyPool,
  machineView,
  newsBadge,
  plant,
  resetFarm,
  sawNews,
  sellToManager,
  sendOrder,
  setEventClock,
  setRandom,
  spawnVisitor,
  tick,
} from './state'
import { OLD_SAVE, justSaved, levelPay, savedNow, startFrom } from './testSaves'

// The week's events on the farm (src/farm/events.ts; their clock, the lucky draw and the news in src/farm/state.ts): off
// where the game is tested unless a test sets a clock; the lucky draw once on its day, its two goods double wherever
// they sell (priceOf) and what already waits for them raised at once; two gifts on gift day; the crops and the machines
// faster and the buyers more often only while their event is on, a time away counted step by step across an event's
// edge; no XP from any of it; and the record kept in the save.

const at = (day: number, hour: number, minute = 0, second = 0) => new Date(2026, 10, day, hour, minute, second).getTime()
const SATURDAY = at(21, 10)
const always = (n: number) => () => n
/** Building materials found as surprises, all together (a level a sale reaches brings materials of its own: not these). */
const materials = () => ITEMS.reduce((n, id) => n + farm.got[id], 0)

beforeEach(() => {
  localStorage.clear()
  setEventClock(null)
  resetFarm()
})
afterEach(() => {
  setEventClock(null)
  setRandom(null)
})

describe('the events’ clock', () => {
  it('is off under the tests until one sets it: no event changes a price, a gift or a speed', () => {
    expect(eventTime()).toBeNull()
    expect(eventSpeed('crops')).toBe(1)
    expect(drawLucky()).toBeNull()
    expect(newsBadge()).toBe(0)
    setEventClock(SATURDAY)
    expect(eventTime()).toBe(SATURDAY)
    expect(newsBadge()).toBe(1)
    setEventClock(null)
    expect(eventTime()).toBeNull()
  })
})

describe('the lucky draw', () => {
  it('draws two goods the farm makes on its dice, once on its day, and gives no XP', () => {
    setEventClock(at(20, 12))
    expect(drawLucky()).toBeNull() // Friday: not its day
    setEventClock(SATURDAY)
    setRandom(always(0))
    const xp = farm.xp.points
    const goods = drawLucky()!
    expect(goods).toHaveLength(2)
    expect(new Set(goods).size).toBe(2)
    for (const g of goods) expect(luckyPool()).toContain(g)
    expect(farm.events.draw).toEqual({ day: '2026-11-21', goods })
    expect(farm.xp.points).toBe(xp)
    // once: later the same day, nothing
    setEventClock(at(21, 23, 30))
    expect(drawLucky()).toBeNull()
    expect(farm.events.draw!.goods).toEqual(goods)
    // the next Saturday is a new draw
    setEventClock(at(28, 9))
    expect(drawLucky()).not.toBeNull()
  })

  it('its goods sell for double wherever they are sold, on its day only', () => {
    setEventClock(SATURDAY)
    setRandom(always(0))
    const [good] = drawLucky()!
    const base = produceById(good).price
    expect(priceOf(good)).toBe(base * 2)
    // the manager pays double for the same goods
    farm.inv[good] = 10
    const twice = sellToManager(good)
    setEventClock(null)
    farm.inv[good] = 10
    const once = sellToManager(good)
    expect(twice).toBeGreaterThan(once)
    expect(Math.abs(twice - 2 * once)).toBeLessThanOrEqual(1)
    // the day after, its price again
    setEventClock(at(22, 9))
    expect(priceOf(good)).toBe(base)
    // a new order made on its day pays double for it (each rounds its own total)
    setEventClock(SATURDAY)
    expect(Math.abs(orderPay([{ good, want: 3 }]) - 2 * orderPayOff(good, 3))).toBeLessThanOrEqual(1)
  })

  it('what already waits for a drawn good is raised at once: a buyer’s offer, an order’s pay for its part', () => {
    setEventClock(SATURDAY)
    farm.started = true
    const pool = luckyPool()
    // the dice that draw the first two goods of the pool
    setRandom(always(0))
    const [a, b] = [pool[0], pool[1]]
    // (tomatoes: a good this new farm does not grow, never drawn)
    expect(pool).not.toContain('tomato')
    const buyer = spawnVisitor({ want: a, qty: 2, offer: 9, queued: true })
    const other = spawnVisitor({ want: 'tomato', qty: 1, offer: 4, queued: true })
    farm.orders[0] = {
      order: {
        id: 1,
        lines: [
          { good: b, want: 2, have: 0 },
          { good: 'tomato', want: 2, have: 0 },
        ],
        coins: 40,
        surprise: false,
      },
    }
    farm.orders[1] = { order: { id: 2, lines: [{ good: 'tomato', want: 2, have: 0 }], coins: 7, surprise: false } }
    const share = (priceOf(b) * 2) / (priceOf(b) * 2 + priceOf('tomato') * 2)
    expect(drawLucky()).toEqual([a, b])
    expect(buyer.offer).toBe(18)
    expect(other.offer).toBe(4)
    expect('order' in farm.orders[0] && farm.orders[0].order.coins).toBe(Math.round(40 * (1 + share)))
    expect('order' in farm.orders[1] && farm.orders[1].order.coins).toBe(7)
    // sold to: the raised offer
    farm.inv[a] = 2
    const coins = farm.coins
    const paid = farm.xp.paid
    acceptOffer(buyer.id)
    expect(farm.coins - coins).toBe(18 + levelPay(paid))
  })
})

/** What `orderPay` would say with the events off. */
function orderPayOff(good: ProduceId, want: number) {
  const now = eventTime()
  setEventClock(null)
  const pay = orderPay([{ good, want }])
  setEventClock(now)
  return pay
}

describe('gift day', () => {
  const sendSurprise = () => {
    farm.orders[0] = { order: { id: 1, lines: [{ good: 'tomato', want: 2, have: 2 }], coins: 12, surprise: true } }
    const before = materials()
    expect(sendOrder(0)).toBe(true)
    return materials() - before
  }

  it('an order’s gift comes twice on gift day, once on any other', () => {
    setRandom(always(0.5))
    setEventClock(at(19, 10)) // Thursday
    expect(sendSurprise()).toBe(2)
    setEventClock(at(18, 10)) // Wednesday
    expect(sendSurprise()).toBe(1)
    setEventClock(null)
    expect(sendSurprise()).toBe(1)
  })

  it('so does a buyer’s', () => {
    setRandom(always(0.5))
    setEventClock(at(19, 10))
    farm.inv.tomato = 4
    const v = spawnVisitor({ want: 'tomato', qty: 2, offer: 6, queued: true, gift: true })
    const before = materials()
    acceptOffer(v.id)
    expect(materials() - before).toBe(2)
  })
})

describe('faster while on, and a time away across an event’s edge', () => {
  it('the harvest festival: crops grow twice as fast, and the time left says so', () => {
    buy('sprinkler')
    farm.coins = 100
    plant(0, 'pumpkin')
    setEventClock(at(18, 10))
    tick(10)
    expect(farm.beds[0].growth).toBe(20)
    setEventClock(at(17, 10))
    tick(10)
    expect(farm.beds[0].growth).toBe(30)
  })

  it('a time away counts each event only for its part: away across midnight into the festival', () => {
    buy('sprinkler')
    farm.coins = 100
    plant(0, 'pumpkin')
    expect(cropById('pumpkin').growSeconds).toBeGreaterThan(160)
    // back at 00:00:50 on Wednesday after 100 s away: 50 s on Tuesday, 50 s of the festival
    setEventClock(at(18, 0, 0, 50))
    cameBack(100)
    expect(farm.beds[0].growth).toBe(150)
  })

  it('the machine rush: jobs go twice as fast from 16:00 on Friday, the times shown in real seconds', () => {
    Object.assign(farm.inv, { flour: 3, sugar: 3, egg: 3, milk: 3, pumpkin: 3 })
    for (let k = 0; k < 3; k++) expect(addJob('oven', 'pumpkin_pie')).toBe(true)
    const job = machineView('oven').slots[0].seconds
    setEventClock(at(20, 16))
    expect(machineView('oven').slots[0].seconds).toBe(job / 2)
    // away from 15:59:30 for a minute: 30 s at the old pace, 30 s twice as fast — 90 s of work done
    setEventClock(at(20, 16, 0, 30))
    cameBack(60)
    expect(farm.machines.oven.worked).toBe(90)
    expect(farm.machines.oven.done).toBe(2)
  })

  it('market day: buyers come twice as often, in play and for the part of a time away it was on', () => {
    farm.started = true
    farm.nextVisitorIn = 100
    setEventClock(at(16, 9))
    tick(10)
    expect(farm.nextVisitorIn).toBe(80)
    // away from 19:59:00 for two minutes: a minute of the market (120 s of countdown), a minute after it (60 s)
    farm.nextVisitorIn = 1000
    setEventClock(at(16, 20, 1))
    cameBack(120)
    expect(farm.nextVisitorIn).toBe(1000 - 180)
  })
})

describe('the news and the save', () => {
  it('opened, the events on are shown: the badge goes, but for a draw not made', () => {
    setEventClock(at(16, 10))
    expect(newsBadge()).toBe(1)
    sawNews()
    expect(newsBadge()).toBe(0)
    expect(farm.events.seen).toEqual(['market@2026-11-16'])
    setEventClock(SATURDAY)
    sawNews()
    expect(newsBadge()).toBe(1)
    drawLucky()
    expect(newsBadge()).toBe(0)
  })

  it('what was drawn and shown is kept in the save, and loads back', () => {
    setEventClock(SATURDAY)
    setRandom(always(0.3))
    sawNews()
    const goods = drawLucky()
    const saved = savedNow()
    expect(saved.events).toEqual({ draw: { day: '2026-11-21', goods }, seen: ['lucky@2026-11-21'] })
    startFrom(justSaved(saved))
    expect(farm.events).toEqual({ draw: { day: '2026-11-21', goods }, seen: ['lucky@2026-11-21'] })
    expect(drawLucky()).toBeNull()
  })

  it('a farm from before the events loads with none drawn or shown, and draws on its first lucky day', () => {
    startFrom(justSaved(OLD_SAVE))
    expect(farm.events).toEqual({ draw: null, seen: [] })
    setEventClock(SATURDAY)
    expect(drawLucky()).toHaveLength(2)
  })
})
