// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ITEMS, ORDERS, SELLABLE, TRACTOR, orderSlots, orderWait, produceById, type ProduceId } from './data'
import { cratesFor, isComplete, makeOrder, mostAsked, orderPay, type Order } from './orders'
import { buyOffice, declineOrder, farm, fillOrder, gateX, orderAt, orderPlaces, resetFarm, sendOrder, setRandom, tick, used } from './state'
import { AWAY_SECONDS, loadingSeconds, tractorPose, tripSeconds } from './tractorRoute'

// The order board on the office's computer and the tractor that takes the orders away (src/farm/orders.ts,
// src/farm/state.ts, src/farm/tractorRoute.ts).

/** Math.random from a seed (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const KNOWN: ProduceId[] = ['lettuce', 'carrot', 'strawberry', 'tomato', 'corn', 'pumpkin', 'wheat', 'sugarcane', 'lemon', 'egg', 'milk', 'wool', 'flour', 'sugar', 'cloth', 'lemon_cake']

describe('an order', () => {
  it('asks for one to nine different goods the farm makes (never a building material), a few of each, and pays a quarter over their fair price', () => {
    const random = seeded(21)
    const kinds = new Set<number>()
    let surprises = 0
    for (let k = 0; k < 2000; k++) {
      const o = makeOrder(KNOWN, random)
      kinds.add(o.lines.length)
      expect(o.lines.length).toBeGreaterThanOrEqual(1)
      expect(o.lines.length).toBeLessThanOrEqual(ORDERS.kinds)
      expect(new Set(o.lines.map((l) => l.good)).size).toBe(o.lines.length)
      for (const l of o.lines) {
        expect(KNOWN).toContain(l.good)
        expect(ITEMS).not.toContain(l.good)
        expect(l.want).toBeGreaterThanOrEqual(1)
        expect(l.want).toBeLessThanOrEqual(mostAsked(l.good))
        expect(l.have).toBe(0)
      }
      const fair = o.lines.reduce((n, l) => n + produceById(l.good).price * l.want, 0)
      expect(o.coins).toBe(Math.max(1, Math.round(fair * 1.25)))
      if (o.surprise) surprises++
    }
    // every count of kinds turns up, from one to nine
    expect([...kinds].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    // one in two brings a surprise
    expect(Math.abs(surprises / 2000 - 0.5)).toBeLessThan(0.04)
  })

  it('a farm that makes only a few goods gets orders of only those', () => {
    const o = makeOrder(['egg', 'milk'], seeded(4))
    expect(o.lines.every((l) => l.good === 'egg' || l.good === 'milk')).toBe(true)
    expect(orderPay([{ good: 'cloth', want: 2 }])).toBe(38)
  })

  it('fills the tractor with a crate for every dozen goods, one to three', () => {
    const order = (want: number): Order => ({ id: 1, lines: [{ good: 'egg', want, have: 0 }], coins: 1, surprise: false })
    expect([1, 12, 13, 24, 25, 99].map((n) => cratesFor(order(n)))).toEqual([1, 1, 2, 2, 3, 3])
  })
})

describe('the order board', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFarm()
    setRandom(seeded(9))
    farm.planted = ['lettuce', 'carrot', 'wheat']
    farm.made = ['egg', 'milk', 'flour']
    // a new order in every place
    tick(0.01)
  })
  afterEach(() => setRandom(null))

  /** Enough of what order k asks for, in the silo and the barn. */
  const stockFor = (k: number, share = 1) => {
    for (const l of orderAt(k)!.lines) farm.inv[l.good] = Math.ceil(l.want * share)
  }

  it('starts with three orders, and a new one comes after ten minutes once one is declined', () => {
    expect(orderPlaces()).toBe(3)
    expect([0, 1, 2].every((k) => orderAt(k))).toBe(true)
    expect(declineOrder(1)).toBe(true)
    expect(orderAt(1)).toBe(null)
    expect(farm.orders[1]).toEqual({ wait: 600 })
    tick(599)
    expect(orderAt(1)).toBe(null)
    tick(1.5)
    expect(orderAt(1)).not.toBe(null)
  })

  it('takes goods partly: what there is goes in and leaves the silo and the barn; the rest can follow', () => {
    const o = orderAt(0)!
    const want = o.lines.reduce((n, l) => n + l.want, 0)
    const line = o.lines.find((l) => l.want >= 2) ?? o.lines[0]
    o.lines.forEach((l) => (farm.inv[l.good] = 0))
    farm.inv[line.good] = 1
    expect(fillOrder(0)).toBe(1)
    expect(line.have).toBe(1)
    expect(farm.inv[line.good]).toBe(0)
    expect(isComplete(o)).toBe(want === 1)
    // nothing to put in: nothing happens
    expect(fillOrder(0)).toBe(0)
    // the rest, later
    stockFor(0)
    expect(fillOrder(0)).toBe(want - 1)
    expect(isComplete(o)).toBe(true)
  })

  it('declined half filled, it gives back what was put in, even into a full silo or barn', () => {
    const o = orderAt(0)!
    stockFor(0)
    fillOrder(0)
    const back = o.lines.map((l) => [l.good, l.have] as const)
    // the silo and the barn filled to the brim meanwhile
    farm.inv.wheat = 50
    farm.inv.milk = 50
    const before = Object.fromEntries(back.map(([good]) => [good, farm.inv[good]]))
    expect(declineOrder(0)).toBe(true)
    for (const [good, n] of back) expect(farm.inv[good]).toBe(before[good] + n)
    expect(used('silo') + used('barn')).toBeGreaterThan(100)
  })

  it('sent, it is paid at once, its crates go to the pallet, and a new order takes its place straight away', () => {
    const o = orderAt(2)!
    stockFor(2)
    fillOrder(2)
    expect(sendOrder(1)).toBe(false) // not all in
    const coins = farm.coins
    expect(sendOrder(2)).toBe(true)
    expect(farm.coins).toBe(coins + o.coins)
    expect(farm.dispatch.waiting + farm.dispatch.aboard).toBe(cratesFor(o))
    const next = orderAt(2)!
    expect(next).not.toBe(null)
    expect(next.id).not.toBe(o.id)
    expect(next.lines.every((l) => l.have === 0)).toBe(true)
  })

  it('one order in two brings a surprise: it goes into the barn as the order is sent', () => {
    const o = orderAt(0)!
    o.surprise = true
    stockFor(0)
    fillOrder(0)
    setRandom(() => 0.99) // the last of the six: logs
    sendOrder(0)
    expect(farm.inv.log).toBe(1)
    const p = orderAt(0)!
    p.surprise = false
    stockFor(0)
    fillOrder(0)
    sendOrder(0)
    expect(ITEMS.reduce((n, id) => n + farm.inv[id], 0)).toBe(1)
  })

  it('the office adds places up to nine (a new order in each at once) and takes the wait down to five minutes', () => {
    farm.coins = 100_000
    for (let k = 0; k < 10; k++) buyOffice('slots')
    expect(orderPlaces()).toBe(ORDERS.maxSlots)
    expect(farm.orders.length).toBe(9)
    expect(farm.orders.every((s) => 'order' in s)).toBe(true)
    declineOrder(4)
    expect(farm.orders[4]).toEqual({ wait: 600 })
    for (let k = 0; k < 10; k++) buyOffice('wait')
    expect(farm.office.wait).toBe(5)
    // the wait already running is cut to the new one
    expect(farm.orders[4]).toEqual({ wait: 300 })
    declineOrder(5)
    expect(farm.orders[5]).toEqual({ wait: 300 })
    expect([orderSlots(0), orderWait(0), orderSlots(6), orderWait(5)]).toEqual([3, 600, 9, 300])
  })

  it('upgrades cost coins, each step more, and nothing without them', () => {
    farm.coins = 79
    expect(buyOffice('slots')).toBe(false)
    farm.coins = 80
    expect(buyOffice('slots')).toBe(true)
    expect(farm.coins).toBe(0)
    farm.coins = 1000
    buyOffice('slots')
    expect(farm.coins).toBe(1000 - 120)
  })

  it('never asks for building materials, and its goods are all ones buyers buy', () => {
    for (let k = 0; k < 3; k++) for (const l of orderAt(k)!.lines) expect(SELLABLE).toContain(l.good)
  })
})

describe('the tractor', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFarm()
  })

  it('takes up to four crates a trip, the rest wait on the pallet for the next one; back home it stands where it started', () => {
    farm.dispatch.waiting = 6
    tick(0.01)
    expect(farm.dispatch).toMatchObject({ waiting: 2, aboard: 4 })
    const trip = tripSeconds(4, gateX())
    tick(trip - 1)
    expect(farm.dispatch.trip).toBeGreaterThan(0)
    tick(2)
    // the next trip with the other two
    expect(farm.dispatch).toMatchObject({ waiting: 0, aboard: 2 })
    tick(tripSeconds(2, gateX()) + 1)
    expect(farm.dispatch).toEqual({ waiting: 0, aboard: 0, trip: -1 })
  })

  it('a long time away (the page closed for hours) finishes every trip', () => {
    farm.dispatch.waiting = 40
    tick(3600)
    expect(farm.dispatch).toEqual({ waiting: 0, aboard: 0, trip: -1 })
  })

  it('loads, drives out through the gate, is out of sight while away, comes back and backs in: smoothly, facing west at home', () => {
    const gate = gateX()
    expect(gate).toBe(-14)
    const total = tripSeconds(4, gate)
    expect(total).toBeGreaterThan(loadingSeconds(4) + AWAY_SECONDS)
    let last = tractorPose(0, 4, gate)
    expect(last).toMatchObject({ phase: 'loading', aboard: 0, x: TRACTOR.park })
    let outside = false
    let backing = false
    for (let t = 0.05; t < total; t += 0.05) {
      const p = tractorPose(t, 4, gate)
      if (p.visible && last.visible) {
        // no jumps: never faster than it can go
        expect(Math.hypot(p.x - last.x, p.z - last.z)).toBeLessThan(0.05 * 8)
      }
      // it never comes further into the farm than its yard, and keeps to its track inside the hedge
      expect(p.x).toBeLessThanOrEqual(TRACTOR.park + 1e-6)
      if (p.x > gate) expect(Math.abs(p.z - TRACTOR.z)).toBeLessThan(1e-6)
      if (p.x < gate - 3) outside = true
      if (p.reverse) backing = true
      last = p
    }
    expect(outside && backing).toBe(true)
    const home = tractorPose(total - 0.001, 4, gate)
    expect(home.x).toBeCloseTo(TRACTOR.park, 2)
    expect(Math.cos(home.heading - -Math.PI / 2)).toBeCloseTo(1, 3)
    expect(tractorPose(-1, 0, gate)).toMatchObject({ phase: 'home', visible: true })
  })

  it('with the west meadow bought, its gate is in the hedge round the meadow, and it drives across the meadow', () => {
    farm.layout = { ...farm.layout, land: ['west'] }
    expect(gateX()).toBe(-26)
    expect(tripSeconds(1, -26)).toBeGreaterThan(tripSeconds(1, -14))
  })
})
