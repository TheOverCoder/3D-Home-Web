// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BEDS, PRODUCERS, SHOP, cropById } from './data'
import { AWAY_MOST, awayNews, awaySummary, cameBack, capacity, farm, inLine, marketFill, plant, resetFarm, room, setRandom, tick, water, xpEventCount, yieldOf } from './state'
import { savedNow, startFrom } from './testSaves'

// Welcome back (src/farm/AwayPanel.tsx): the farm goes on for a time away — the page closed (from the save's time) or
// hidden (a long gap between frames: cameBack) — as it would have, for at most three hours, and what happened is told:
// what came to be ready, who joined the line, what needs you.

const NOW = Date.UTC(2026, 10, 11, 12)
const MIN = 60_000

/** A bed that can be planted: the first one built. */
const firstBed = () => farm.beds.findIndex((b, i) => b.built && !BEDS[i].expansion)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  localStorage.clear()
  resetFarm()
})
afterEach(() => {
  vi.useRealTimers()
})

/** The farm as it is now, saved `ago` ms before now, loaded again as the page starts. */
function reopenAfter(ago: number) {
  const save = { ...savedNow(), time: NOW - ago }
  startFrom(save)
}

describe('welcome back', () => {
  it('the page closed for an hour: the lettuce planted and watered is ripe, and the card says how many to harvest', () => {
    const i = firstBed()
    expect(i).toBeGreaterThanOrEqual(0)
    // with sprinklers it never dries out
    farm.sprinkler = true
    plant(i, 'lettuce')
    water(i)
    reopenAfter(60 * MIN)
    const r = awaySummary()
    expect(r, 'something to tell').not.toBeNull()
    expect(r!.seconds).toBeCloseTo(3600, 0)
    expect(r!.counted).toBeCloseTo(3600, 0)
    expect(farm.beds[i].growth).toBe(cropById('lettuce').growSeconds)
    expect(r!.goods).toContainEqual({ item: 'lettuce', count: yieldOf('lettuce') })
    expect(r!.thirsty).toBe(0)
  })

  it('the animals fill while you are away: what the cows give is counted as it came, never more than they hold', () => {
    farm.producers.cows.stock = farm.producers.cows.stock.map(() => 0)
    farm.producers.cows.timer = farm.producers.cows.timer.map(() => 0)
    const cows = farm.producers.cows.stock.length
    reopenAfter(30 * MIN)
    const r = awaySummary()!
    const milk = r.goods.find((g) => g.item === PRODUCERS.cows.good)?.count ?? 0
    const held = farm.producers.cows.stock.reduce((a, b) => a + b, 0)
    expect(milk).toBe(held)
    expect(held).toBeGreaterThan(0)
    expect(held).toBeLessThanOrEqual(cows * PRODUCERS.cows.max)
  })

  it('away longer than three hours, the farm goes on for three: the card says how long you were away and how long it went on', () => {
    farm.producers.hens.stock = farm.producers.hens.stock.map(() => 0)
    farm.producers.hens.timer = farm.producers.hens.timer.map(() => 0)
    reopenAfter(5 * 60 * MIN)
    const r = awaySummary()!
    expect(r.seconds).toBeCloseTo(5 * 3600, 0)
    expect(r.counted).toBe(AWAY_MOST)
  })

  it('a short time away, or nothing that happened, says nothing (the farm still goes on)', () => {
    farm.producers.hens.stock = farm.producers.hens.stock.map(() => 0)
    farm.producers.hens.timer = farm.producers.hens.timer.map(() => 0)
    reopenAfter(MIN)
    expect(awaySummary()).toBeNull()
    expect(farm.producers.hens.timer.some((t) => t > 0) || farm.producers.hens.stock.some((n) => n > 0)).toBe(true)
    // nothing on the farm that grows, fills or comes: no card, however long
    resetFarm()
    for (const id of Object.keys(farm.producers) as (keyof typeof farm.producers)[]) {
      const p = farm.producers[id]
      p.stock = p.stock.map(() => PRODUCERS[id].max)
    }
    const fullAlready = cameBack(2 * 3600)
    expect(fullAlready!.goods).toEqual([])
  })

  it('the page hidden (a long gap between frames) goes on like the page closed: buyers join the line as they came', () => {
    farm.started = true
    farm.nextVisitorIn = 10
    const before = inLine().length
    const r = cameBack(20 * 60)!
    expect(r.buyers).toBe(inLine().length - before)
    expect(r.buyers).toBeGreaterThan(0)
    expect(awaySummary()).toBe(r)
  })

  it('what needs you: a building too full to take what waits is named, and beds gone dry are counted', () => {
    // the barn full, eggs waiting in the nest
    farm.inv.wool = 0
    farm.inv.egg = capacity('barn')
    expect(room('barn')).toBeLessThanOrEqual(0)
    farm.producers.hens.stock = farm.producers.hens.stock.map(() => 0)
    farm.producers.hens.timer = farm.producers.hens.timer.map(() => 0)
    const r = cameBack(20 * 60)!
    expect(r.full).toContain('barn')
    expect(r.full).not.toContain('silo')
    // a bed planted, never watered, no sprinklers: dry
    resetFarm()
    farm.sprinkler = false
    const i = firstBed()
    plant(i, 'carrot')
    farm.beds[i].water = 0
    const dry = cameBack(10 * 60)!
    expect(dry.thirsty).toBeGreaterThan(0)
  })

  it('going on in steps is the same as frames would have been: a machine finishes in the step it would have', () => {
    // what one long gap gives equals the same time in frames of 5 s (the steps it takes)
    farm.producers.hens.stock = farm.producers.hens.stock.map(() => 0)
    farm.producers.hens.timer = farm.producers.hens.timer.map(() => 0)
    const start = JSON.stringify(farm.producers)
    cameBack(600)
    const away = JSON.stringify(farm.producers)
    farm.producers = JSON.parse(start)
    for (let t = 0; t < 600; t += 5) tick(5)
    expect(JSON.stringify(farm.producers)).toBe(away)
  })

  it('the page closed for an hour with goods on your shelves: shoppers came and bought as they would have, and the card says so', () => {
    marketFill('egg')
    farm.market.nextIn = 30
    setRandom(() => 0)
    try {
      const xp = { points: farm.xp.points, events: xpEventCount() }
      reopenAfter(60 * MIN)
      const r = awaySummary()!
      // everything on the shelves sold to the first visit (dice 0): what it paid waits in the till for you
      expect(r.shop).toEqual({ goods: farm.market.till.goods, coins: farm.market.till.coins })
      expect(r.shop!.goods).toBe(farm.market.shelves.length * SHOP.units)
      expect(farm.market.shelves.every((s) => s.units === 0)).toBe(true)
      expect(awayNews({ ...r, goods: [], buyers: 0, orders: 0, tractor: false, thirsty: 0, full: [] })).toBe(true)
      // an hour is three farm days: the contractor has new pieces
      expect(r.pieces).toBe(true)
      // no XP for time away (the till's coins are a sale once taken)
      expect([farm.xp.points, xpEventCount()]).toEqual([xp.points, xp.events])
    } finally {
      setRandom(null)
    }
  })
})
