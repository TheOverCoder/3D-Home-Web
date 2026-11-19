// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CONTRACTOR, ORDERS, PRODUCE, SELLABLE, isItem } from './data'
import { dayNumber } from './calendar'
import { dateKey, priceFactor } from './events'
import { managerPay, managerPct } from './market'
import { makerOf, priceAt, priceOf } from './prices'
import { moodOf, setMood } from './mood'
import { machineLevel } from './machineView'
import { orderPay } from './orders'
import { calendarDay, dayFactor, eventTime, fairPrice, farm, managerPays, setDailyClock, setEventClock, setStepAt } from './state'
import { playedSave, startFrom } from './testSaves'

// The day's factor on every price (src/farm/state/day.ts, the priceEvents line; update-v1 CONTRACTS B10): the lucky
// draw's ×2 and the town's market mood (src/farm/mood.ts), wherever a good is sold. Quiet in tests, it changes nothing;
// on, every good but the building materials is worth its mood of the day more or less, the same at every place.

/** A Wednesday and a Saturday morning (the lucky draw's day), on the device's clock. */
const WEDNESDAY = new Date(2026, 10, 18, 10).getTime()
const SATURDAY = new Date(2026, 10, 21, 10).getTime()

/** A good's worth with the farm's own machine level, times `k` (what priceOf takes from the farm). */
const worth = (good: (typeof PRODUCE)[number]['id'], k: number) => {
  const maker = makerOf(good)
  return priceAt(good, maker ? machineLevel(farm.machines[maker].worked).boost.coins : 0, k)
}

let today: Record<string, unknown>
beforeAll(() => {
  today = playedSave()
})
beforeEach(() => {
  localStorage.clear()
  startFrom(today)
  setDailyClock(() => WEDNESDAY)
})
afterEach(() => {
  setMood(false)
  setEventClock(null)
  setStepAt(null)
  setDailyClock(null)
})

describe("the day's factor on every price", () => {
  it('is only the lucky draw while the mood is quiet (as in every test): no price changes', () => {
    for (const p of PRODUCE) expect(dayFactor(p.id), p.id).toBe(1)
    setEventClock(SATURDAY)
    farm.events = { ...farm.events, draw: { day: dateKey(SATURDAY), goods: ['tomato'] } }
    for (const p of PRODUCE) expect(dayFactor(p.id), p.id).toBe(priceFactor(p.id, farm.events, eventTime()))
    expect(priceOf('tomato')).toBe(worth('tomato', 2))
  })

  it("with the mood on, every good is worth its mood of the day — the calendar's while the events are off", () => {
    setMood(true)
    const day = calendarDay()
    expect(day).toBe(dayNumber(WEDNESDAY))
    let moved = 0
    for (const p of PRODUCE) {
      expect(priceOf(p.id), p.id).toBe(worth(p.id, moodOf(p.id, day)))
      if (isItem(p.id)) expect(dayFactor(p.id), p.id).toBe(1)
      else if (dayFactor(p.id) !== 1) moved++
    }
    expect(moved).toBe(SELLABLE.length)
    // the next day, another mood
    setDailyClock(() => WEDNESDAY + 86_400_000)
    expect(priceOf('tomato')).toBe(worth('tomato', moodOf('tomato', day + 1)))
  })

  it("on the lucky draw's day, a drawn good is double its mood; the mood is the events' day's", () => {
    setMood(true)
    setEventClock(SATURDAY)
    farm.events = { ...farm.events, draw: { day: dateKey(SATURDAY), goods: ['strawberry'] } }
    const day = dayNumber(SATURDAY)
    expect(priceOf('strawberry')).toBeCloseTo(worth('strawberry', 2 * moodOf('strawberry', day)), 10)
    expect(priceOf('carrot')).toBe(worth('carrot', moodOf('carrot', day)))
    // a time away's step is judged on its own day
    setStepAt(SATURDAY - 2 * 86_400_000)
    expect(priceOf('carrot')).toBe(worth('carrot', moodOf('carrot', day - 2)))
  })

  it('so is every price made from it: what goods are worth to a buyer, an order, the manager and the contractor', () => {
    setMood(true)
    farm.market.owned = false
    for (const good of SELLABLE) {
      const now = priceOf(good)
      expect(fairPrice(good, 3), good).toBe(Math.round(now * 3))
      expect(orderPay([{ good, want: 3 }])).toBe(Math.max(1, Math.round(now * 3 * ORDERS.markup)))
      farm.inv[good] = 7
      expect(managerPays(good)).toBe(managerPay(now, 7, managerPct(farm.ladders.rate)))
    }
    // the contractor keeps his own price for materials
    expect(CONTRACTOR.buys).toBeGreaterThan(0)
    for (const p of PRODUCE.filter((q) => isItem(q.id))) expect(priceOf(p.id)).toBe(p.price)
  })
})
