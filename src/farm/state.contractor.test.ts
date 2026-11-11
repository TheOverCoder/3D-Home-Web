// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CONTRACTOR_SPOT } from '../data/market'
import { useHome } from '../store'
import { CONTRACTOR, DAY, LADDERS, XP_FOR, produceById } from './data'
import { offersPerDay, piecePrice, shortMaterials } from './contractor'
import {
  buyFromContractor,
  buyLadder,
  cameBack,
  capacity,
  contractorHere,
  contractorNow,
  contractorOffers,
  dayIsFrozen,
  dayNow,
  farm,
  freezeDay,
  ladderOpen,
  resetFarm,
  sellToContractor,
  setHour,
  setRandom,
  tick,
} from './state'
import { xpForSale } from './xp'

// The contractor behind the market and the farm's day (src/farm/state.ts; the rules in src/farm/contractor.ts and
// day.ts): he is at his window in the morning, at noon and in the evening, walks off at night and back in the
// morning; he buys building materials, and sells a few pieces a day, first those the silo or the barn is short of.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(false)
  setRandom(() => 0.5)
})
afterEach(() => {
  setRandom(null)
  freezeDay(false)
})

const HOUR = DAY.length / 24

describe('the day', () => {
  it('a new farm starts at eight in the morning; the clock goes on in play, stops while frozen, and goes on while away', () => {
    expect(dayNow()).toEqual({ hour: DAY.start, phase: 'morning', day: 0 })
    tick(HOUR)
    expect(dayNow().hour).toBeCloseTo(DAY.start + 1)
    freezeDay(true)
    expect(dayIsFrozen()).toBe(true)
    tick(10 * HOUR)
    expect(dayNow().hour).toBeCloseTo(DAY.start + 1)
    cameBack(3 * HOUR)
    expect(dayNow().hour).toBeCloseTo(DAY.start + 4)
  })

  it('setHour: an hour of today, which runs from the morning through the small hours; 24 more is tomorrow', () => {
    setHour(12)
    expect(dayNow()).toEqual({ hour: 12, phase: 'noon', day: 0 })
    setHour(9)
    expect(dayNow()).toMatchObject({ hour: 9, day: 0 })
    setHour(2)
    expect(dayNow()).toEqual({ hour: 2, phase: 'night', day: 0 })
    setHour(24 + 9)
    expect(dayNow()).toEqual({ hour: 9, phase: 'morning', day: 1 })
    // the farm's first morning began at eight: six o'clock that day never was, so it is the next day's
    resetFarm()
    setHour(6)
    expect(dayNow()).toMatchObject({ hour: 6, day: 1 })
    expect(farm.day.t).toBeGreaterThan(0)
  })
})

describe('the contractor', () => {
  it('is at his window in the morning, at noon and in the evening, and away at night', () => {
    for (const [h, here] of [
      [9, true],
      [13, true],
      [18, true],
      [22, false],
      [28, false],
    ] as const) {
      setHour(h)
      expect(contractorHere(), `${h}:00`).toBe(here)
      if (here) expect(contractorNow(), `${h}:00`).toMatchObject({ x: CONTRACTOR_SPOT.x, z: CONTRACTOR_SPOT.z, heading: CONTRACTOR_SPOT.heading, walking: false })
    }
  })

  it('in the first minute of the night he waves and walks off; in the first of the morning he walks back to his window', () => {
    setHour(21)
    expect(contractorNow()).toMatchObject({ pose: 'wave', x: CONTRACTOR_SPOT.x })
    setHour(21 + 10 / HOUR)
    expect(contractorNow()?.walking).toBe(true)
    setHour(21 + 50 / HOUR)
    expect(contractorNow()).toBeNull()
    setHour(24 + 5 + 5 / HOUR)
    expect(contractorNow()?.walking).toBe(true)
    // frame by frame as the clock runs, to his window
    for (let t = 0; t < 60; t += 0.25) {
      tick(0.25)
      contractorNow()
    }
    expect(contractorNow()).toMatchObject({ x: CONTRACTOR_SPOT.x, z: CONTRACTOR_SPOT.z, walking: false })
    expect(contractorNow()!.heading).toBeCloseTo(CONTRACTOR_SPOT.heading)
  })

  it('his pieces for the day are made the first time the day is seen: those the silo or the barn is shortest of first', () => {
    // the barn's next level short of planks the most
    farm.storage.barn = 3
    Object.assign(farm.inv, { brick: 2, nail: 2, plank: 0 })
    const offers = contractorOffers()
    expect(offers.length).toBe(offersPerDay(0))
    expect(offers[0]).toEqual({ item: 'plank', sold: false })
    expect(offers.map((o) => o.item)).toEqual(shortMaterials(farm).slice(0, offers.length))
    expect(farm.contractor.day).toBe(0)
    // the same day: the same pieces; the next: new ones
    tick(1)
    expect(contractorOffers()).toBe(offers)
    setHour(24 + 9)
    tick(0.1)
    expect(farm.contractor.day).toBe(1)
    expect(contractorOffers()).not.toBe(offers)
  })

  it('buys the whole stack of a building material at his price, as a sale; nothing at night, nor a good of the farm', () => {
    farm.inv.brick = 7
    const before = { coins: farm.coins, sold: farm.stats.sold, earned: farm.stats.earned, xp: farm.xp.points }
    expect(sellToContractor('brick')).toBe(7 * CONTRACTOR.buys)
    expect([farm.inv.brick, farm.coins - before.coins, farm.stats.sold - before.sold, farm.stats.earned - before.earned]).toEqual([0, 70, 7, 70])
    expect(farm.xp.points - before.xp).toBe(xpForSale(70))
    farm.inv.egg = 3
    expect(sellToContractor('egg' as 'brick')).toBe(0)
    farm.inv.log = 2
    setHour(22)
    expect(sellToContractor('log')).toBe(0)
    expect(farm.inv.log).toBe(2)
  })

  it('sells his pieces: each once, into the barn even past full, a trade (no XP, not a surprise found); not at night', () => {
    farm.coins = 1000
    const offers = contractorOffers()
    const item = offers[0].item
    farm.inv.milk = capacity('barn') // the barn full
    const before = { inv: farm.inv[item], got: farm.got[item], xp: farm.xp.points, coins: farm.coins }
    expect(buyFromContractor(0)).toBe(true)
    expect([farm.inv[item] - before.inv, farm.got[item] - before.got, farm.xp.points - before.xp, before.coins - farm.coins]).toEqual([1, 0, 0, CONTRACTOR.sells])
    expect(offers[0].sold).toBe(true)
    expect(useHome.getState().toast?.text).toBe(`+ 1 ${produceById(item).name} · ${CONTRACTOR.sells} coins`)
    expect(buyFromContractor(0)).toBe(false)
    expect(buyFromContractor(offers.length)).toBe(false)
    setHour(22)
    expect(buyFromContractor(1)).toBe(false)
    // nor with too few coins
    setHour(12)
    farm.coins = CONTRACTOR.sells - 1
    expect(buyFromContractor(1)).toBe(false)
  })

  it('his ladders: only while he is there; more pieces bring one more today, a better deal is the price from the next piece on', () => {
    farm.coins = 10_000
    contractorOffers()
    setHour(22)
    expect([ladderOpen('stock'), buyLadder('stock'), ladderOpen('discount')]).toEqual([false, false, false])
    setHour(12)
    const xp = farm.xp.points
    expect(buyLadder('stock')).toBe(true)
    expect(farm.xp.points - xp).toBe(XP_FOR.build)
    const offers = contractorOffers()
    expect(offers.length).toBe(offersPerDay(1))
    expect(new Set(offers.map((o) => o.item)).size).toBe(offers.length) // the new one not one he had already
    expect(buyLadder('discount')).toBe(true)
    const coins = farm.coins
    buyFromContractor(0)
    expect(coins - farm.coins).toBe(piecePrice(1))
    // tomorrow: the day's full count
    setHour(24 + 9)
    expect(contractorOffers().length).toBe(offersPerDay(1))
    for (let k = 1; k < LADDERS.stock.levels; k++) buyLadder('stock')
    expect([ladderOpen('stock'), buyLadder('stock')]).toEqual([false, false])
  })

  it('the morning he has what the silo or the barn is short of, a word as it turns; not for a morning that came while away', () => {
    setHour(24 + 4.9) // the small hours, just before five
    tick(0.1)
    useHome.getState().showToast('-')
    tick(10)
    expect(dayNow().phase).toBe('morning')
    const piece = farm.contractor.offers[0].item
    expect(shortMaterials(farm)).toContain(piece)
    expect(useHome.getState().toast?.text).toBe(`The contractor has ${produceById(piece).plural} today`)
    // from the small hours, away across the morning: no word as you come back
    setHour(24 + 24 + 4.9)
    tick(0.1)
    useHome.getState().showToast('-')
    const r = cameBack(30)!
    tick(0.1)
    expect(useHome.getState().toast?.text).toBe('-')
    // and the card knows a new day began: new pieces
    expect(r.pieces).toBe(true)
    expect(cameBack(30)!.pieces).toBe(false)
  })
})
