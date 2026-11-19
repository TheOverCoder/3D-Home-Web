import { describe, expect, it } from 'vitest'
import { seasonGarment } from './outfit'
import { sized } from './prize'
import { reached } from './road'
import { ROAD_XP, SEASON_ROAD, fed, freshRoad, roadEnd, roadOf, roadView, sanitizeSeasonRoad, seasonName, settleRoad, stopPrizes } from './seasonRoad'

// The season road as rules (src/farm/seasonRoad.ts): ten stops a season fed by XP, each reached once; a road not
// finished carries on into the next season (never reset by the calendar), the XP past its end flowing on while the farm
// is behind; a finished road waits for the next season's; what each stop gives; what the tab shows; the record as saved.

describe('the road', () => {
  it('ten stops a season, rising, the last at its end; the last stop the season’s garment with a big gift', () => {
    expect(SEASON_ROAD).toHaveLength(10)
    const road = roadOf(0)
    expect(road).toHaveLength(10)
    for (let k = 1; k < road.length; k++) expect(road[k]).toBeGreaterThan(road[k - 1])
    expect(roadEnd(0)).toBe(Math.ceil(ROAD_XP))
    expect(SEASON_ROAD[9].kind).toBe('garment')
  })

  it('fed: each stop reached once, in order; more XP later reaches the next ones', () => {
    const road = roadOf(0)
    let r = freshRoad(0)
    const a = fed(r, road[1], 0)
    expect(a.reached).toEqual([
      { on: 0, stop: 1 },
      { on: 0, stop: 2 },
    ])
    r = a.road
    expect(r).toEqual({ on: 0, xp: road[1], paid: 2 })
    expect(fed(r, 0, 0).reached).toEqual([])
    expect(fed(r, road[2] - road[1] - 1, 0).reached).toEqual([])
    expect(fed(r, road[2] - road[1], 0).reached).toEqual([{ on: 0, stop: 3 }])
    // nothing from nothing, or from a number that is not one
    expect(fed(r, -5, 0).road).toEqual(r)
    expect(fed(r, NaN, 0).road).toEqual(r)
  })

  it('the season now’s road, once finished, takes no more: nothing is banked for the next', () => {
    const end = roadEnd(2)
    const { road, reached: got } = fed(freshRoad(2), end + 5000, 2)
    expect(got.map((s) => s.stop)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(road).toEqual({ on: 2, xp: end, paid: 10 })
    expect(fed(road, 1000, 2).reached).toEqual([])
    // the next season: its road opens from nothing
    expect(settleRoad(road, 3)).toEqual(freshRoad(3))
    expect(fed(road, 10, 3).road).toEqual({ on: 3, xp: 10, paid: 0 })
  })

  it('never reset by the calendar: a road not finished carries on into the next seasons, and what is past its end flows on until the farm has caught up', () => {
    const r = { on: 0, xp: roadOf(0)[6], paid: 7 }
    // three seasons on, it is still the first spring's road
    expect(settleRoad(r, 3)).toBe(r)
    expect(roadView(r, { ordinal: 3, left: 4 }, 10)).toMatchObject({ on: 0, current: false, done: false })
    const { road, reached: got } = fed(r, roadEnd(0) - r.xp + roadOf(1)[0] + 1, 3)
    expect(got).toEqual([
      { on: 0, stop: 8 },
      { on: 0, stop: 9 },
      { on: 0, stop: 10 },
      { on: 1, stop: 1 },
    ])
    expect(road).toEqual({ on: 1, xp: roadOf(1)[0] + 1, paid: 1 })
  })
})

describe('what a stop gives', () => {
  it('coins sized to the level; a few of the material the stores are shortest of; a few of the good made most; the season’s garment and a big gift', () => {
    expect(stopPrizes(1, 0, 10, 'brick', 'egg')).toEqual([{ coins: sized(0.25, 10, 5) }])
    expect(stopPrizes(2, 0, 10, 'brick', 'egg')).toEqual([{ item: 'brick', n: 2 }])
    expect(stopPrizes(4, 0, 10, 'brick', 'egg')).toEqual([{ item: 'egg', n: 4 }])
    // no good made yet: a material
    expect(stopPrizes(4, 0, 10, 'brick', null)).toEqual([{ item: 'brick', n: 2 }])
    expect(stopPrizes(10, 0, 10, 'brick', 'egg')).toEqual([{ garment: seasonGarment(0)!.id }, { coins: sized(1, 10, 5) }])
    // each season of the first two years its own garment; past them, the big gift alone
    expect(stopPrizes(10, 5, 10, 'brick', 'egg')[0]).toEqual({ garment: seasonGarment(5)!.id })
    expect(stopPrizes(10, 8, 10, 'brick', 'egg')).toEqual([{ coins: sized(1, 10, 5) }])
  })
})

describe('what the tab shows', () => {
  it('the season’s name, the stops given, the next with how far, the garment at its end; done: when the next season’s opens', () => {
    const road = roadOf(1)
    const v = roadView({ on: 1, xp: road[2] + 1, paid: 3 }, { ordinal: 1, left: 4 }, 10)
    expect(v).toMatchObject({ on: 1, name: 'Summer', art: 'sun', current: true, done: false, opens: null })
    expect(v.stops.map((s) => s.state)).toEqual(['got', 'got', 'got', 'next', 'later', 'later', 'later', 'later', 'later', 'later'])
    expect(v.next).toMatchObject({ stop: 4, left: road[3] - road[2] - 1 })
    expect(v.stops[9]).toMatchObject({ kind: 'garment', garment: seasonGarment(1) })
    const done = roadView({ on: 1, xp: roadEnd(1), paid: 10 }, { ordinal: 1, left: 2 }, 10)
    expect(done).toMatchObject({ done: true, next: null, opens: { name: 'Autumn', days: 3 } })
    expect(seasonName(4)).toEqual({ name: 'Spring, year 2', art: 'seedling' })
  })
})

describe('the record as saved', () => {
  it('a farm from before it: the season now’s road, from its start', () => {
    expect(sanitizeSeasonRoad(undefined, 3)).toEqual(freshRoad(3))
    expect(sanitizeSeasonRoad('x', 0)).toEqual(freshRoad(0))
  })

  it('as saved; a road never past the season now; its XP no more than its end; its stops no more than its XP reaches', () => {
    const good = { on: 1, xp: 700, paid: reached(roadOf(1), 700) }
    expect(sanitizeSeasonRoad(good, 2)).toEqual(good)
    expect(sanitizeSeasonRoad(JSON.parse(JSON.stringify(good)), 2)).toEqual(good)
    expect(sanitizeSeasonRoad({ ...good, on: 3 }, 2)).toEqual(freshRoad(2))
    expect(sanitizeSeasonRoad({ ...good, xp: 1e9 }, 2)).toMatchObject({ xp: roadEnd(1) })
    expect(sanitizeSeasonRoad({ ...good, paid: 10 }, 2).paid).toBe(good.paid)
    // a stop reached and not given: given with the next XP
    expect(sanitizeSeasonRoad({ ...good, paid: 0 }, 2).paid).toBe(0)
    expect(sanitizeSeasonRoad({ ...good, paid: 'x' }, 2).paid).toBe(good.paid)
    expect(sanitizeSeasonRoad({ ...good, xp: -4 }, 2)).toEqual({ on: 1, xp: 0, paid: 0 })
  })
})
