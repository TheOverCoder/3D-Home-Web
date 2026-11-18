// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MACHINES, MACHINE_IDS, ORDERS, PRODUCE, SELLABLE, produceById, type MachineId, type ProduceId } from './data'
import { dateKey, priceFactor } from './events'
import { MACHINE_LEVELS, machineLevel } from './machineView'
import { managerPay, managerPct, unitPrice } from './market'
import { orderPay } from './orders'
import { priceOf } from './prices'
import { eventTime, fairPrice, farm, managerPays, setEventClock, spawnVisitor } from './state'
import { playedSave, startFrom } from './testSaves'

// No price a player sees changed when every price went through priceAt and the gate's offers through BUYER_OFFERS
// (update v1): priceOf and priceFor as they were written before (2026-11-18), word for word, against the game's own on
// today's farm — every good, each machine at every level, with the lucky draw on and off — and so every price made
// from them (a buyer's offer on the same dice, an order's pay, the manager's, a unit on your shelves).

const MAKER_BEFORE = new Map<ProduceId, MachineId>(MACHINE_IDS.flatMap((id) => MACHINES[id].recipes.map((r) => [r.makes, id] as const)))

/** priceOf as it was, with the parts the farm gave it then (start() in src/farm/state.ts): each machine's level's coins
 *  boost and the events' factor. */
function priceBefore(good: ProduceId): number {
  const base = produceById(good).price
  const maker = MAKER_BEFORE.get(good)
  const more = maker ? machineLevel(farm.machines[maker].worked).boost.coins : 0
  const price = more > 0 ? base * (1 + more) : base
  const k = priceFactor(good, farm.events, eventTime())
  return k !== 1 ? price * k : price
}

/** priceFor's offer as it was, for its roll `r`. */
function offerBefore(want: ProduceId, qty: number, r: number) {
  const factor = r < 0.15 ? 0.6 : r < 0.38 ? 0.85 : r < 0.66 ? 1 : r < 0.86 ? 1.25 : 1.6
  return Math.max(1, Math.round(priceBefore(want) * qty * factor))
}

/** A Saturday morning: the lucky draw's day. */
const SATURDAY = new Date(2026, 10, 21, 10).getTime()
let today: Record<string, unknown>

beforeAll(() => {
  today = playedSave()
})
beforeEach(() => {
  localStorage.clear()
  startFrom(today)
})
afterEach(() => {
  setEventClock(null)
  vi.restoreAllMocks()
})

/** Every machine at the start of level n (1: new). */
const machinesAt = (n: number) => {
  for (const id of MACHINE_IDS) farm.machines[id].worked = MACHINE_LEVELS[n - 1].minutes * 60
}

/** Each way the farm can stand: every machine level, with the events off, and on the draw's day with each good drawn. */
function* everyDay(): Generator<string> {
  for (let n = 1; n <= MACHINE_LEVELS.length; n++) {
    machinesAt(n)
    setEventClock(null)
    yield `machines at level ${n}, no events`
    setEventClock(SATURDAY)
    for (const good of SELLABLE) {
      farm.events = { ...farm.events, draw: { day: dateKey(SATURDAY), goods: [good] } }
      yield `machines at level ${n}, ${good} drawn`
    }
  }
}

describe("today's prices, unchanged", () => {
  it('every good is worth what it was, to the last bit, at every machine level, with the lucky draw on and off', () => {
    let seen = 0
    for (const how of everyDay())
      for (const p of PRODUCE) {
        expect(priceOf(p.id), `${p.id}, ${how}`).toBe(priceBefore(p.id))
        seen++
      }
    expect(seen).toBe(MACHINE_LEVELS.length * (1 + SELLABLE.length) * PRODUCE.length)
    // (a lemon cake from a level-2 oven on the draw: a fifth more, and double)
    machinesAt(2)
    setEventClock(SATURDAY)
    farm.events = { ...farm.events, draw: { day: dateKey(SATURDAY), goods: ['lemon_cake'] } }
    expect(priceOf('lemon_cake')).toBeCloseTo(42 * 1.2 * 2, 10)
  })

  it('so is every price made from it: what goods are worth to a buyer, an order, the manager and your shelves', () => {
    // (the manager's, while the shop is his)
    farm.market.owned = false
    for (const how of everyDay())
      for (const good of SELLABLE) {
        const was = priceBefore(good)
        expect(fairPrice(good, 3), `${good}, ${how}`).toBe(Math.round(was * 3))
        expect(orderPay([{ good, want: 3 }])).toBe(Math.max(1, Math.round(was * 3 * ORDERS.markup)))
        farm.inv[good] = 7
        expect(managerPays(good)).toBe(managerPay(was, 7, managerPct(farm.ladders.rate)))
        expect(unitPrice(priceOf(good), 150)).toBe(unitPrice(was, 150))
      }
  })

  it("a buyer at the gate offers what they did on the same roll of the dice, at every step of the offers' odds", () => {
    const rolls = [0, 0.1, 0.15, 0.2, 0.38, 0.5, 0.66, 0.7, 0.86, 0.9, 0.999]
    for (const how of everyDay())
      for (const good of ['tomato', 'egg', 'cloth', 'lemon_cake', 'pumpkin'] as const)
        for (const r of rolls) {
          // the first roll the buyer takes is their offer's (one coming from a side given, and not a request rolled)
          vi.spyOn(Math, 'random').mockReturnValueOnce(r)
          const v = spawnVisitor({ want: good, qty: 3, from: 1 })
          expect(v.offer, `${good} at ${r}, ${how}`).toBe(offerBefore(good, 3, r))
          farm.visitors.length = 0
          vi.restoreAllMocks()
        }
  })
})
