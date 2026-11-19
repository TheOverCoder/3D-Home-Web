import { describe, expect, it } from 'vitest'
import { PRODUCE } from '../data'
import { dateKey } from '../events'
import { moodOf } from '../mood'
import { marketView, type MarketNow } from './marketView'
import { planView } from './planView'
import { todayView } from './todayView'
import { SATURDAY, WEDNESDAY, farmOf, nowAt } from './testFarms'

// The desktop's "Today" (./todayView.ts): read off the Market's and the Planner's own views, so it never disagrees with
// them.

const today = (f = farmOf(), now: MarketNow = nowAt(null)) => todayView(marketView(f, now), planView(f, now))

describe("the desktop's Today", () => {
  it('on a new farm with the market quiet: the index at 100 and still, no draw, the best bed open, what pays most of what it knows', () => {
    const t = today()
    expect(t.index).toEqual({ now: 100, days: Array(7).fill(100), tomorrow: 100, dir: 'flat', pct: 0 })
    expect(t.drawn).toEqual([])
    // lettuce brings most a minute of the crops open at level 1
    expect(t.bestBed?.crop).toBe('lettuce')
    expect(t.bestBed?.perMinute).toBeCloseTo(40 / 3, 6)
    // nothing in store: of what a new farm knows (lemons, eggs, milk), at the place that pays most a unit
    const v = marketView(farmOf(), nowAt(null))
    const known = v.goods.filter((g) => g.known && !g.material && g.locked === null)
    const most = Math.max(...known.map((g) => g.channels.find((c) => c.id === g.best)!.per))
    expect(t.paysMost?.per).toBe(most)
    expect(known.map((g) => g.id)).toContain(t.paysMost?.good)
  })

  it('of what the farm has, the good that pays most, and where', () => {
    const f = farmOf({ inv: { ...farmOf().inv, egg: 4, lettuce: 3 }, planted: ['lettuce'] })
    const t = today(f)
    // an egg is worth less than a lettuce: the lettuce, at an order (a quarter more than fair)
    expect(t.paysMost).toEqual({ good: 'lettuce', channel: 'order', per: PRODUCE.find((p) => p.id === 'lettuce')!.price * 1.25 })
  })

  it("on the lucky draw's day, its goods", () => {
    const f = farmOf({ events: { draw: { day: dateKey(SATURDAY), goods: ['tomato', 'egg'] }, seen: [] } })
    expect(today(f, nowAt(SATURDAY)).drawn).toEqual(['egg', 'tomato'].sort((a, b) => PRODUCE.findIndex((p) => p.id === a) - PRODUCE.findIndex((p) => p.id === b)))
  })

  it('with the mood on: the index of the last seven days and tomorrow, and where it is heading', () => {
    const now: MarketNow = { ...nowAt(WEDNESDAY), mood: moodOf }
    const v = marketView(farmOf(), now)
    const t = todayView(v, planView(farmOf(), now))
    expect(t.index.days).toEqual(v.index.days.slice(-7))
    expect(t.index.now).toBe(v.index.now)
    const pct = (v.index.tomorrow / v.index.now - 1) * 100
    expect(t.index.pct).toBeCloseTo(pct, 9)
    expect(t.index.dir).toBe(pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat')
  })
})
