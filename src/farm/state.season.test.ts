// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DAY, cropById } from './data'
import { SEASON_DAYS, SEASONS_AFTER_STEPS, seasonExtra } from './season'
import { CLEAR, standing, weatherAt } from './weather'
import { justSaved, savedNow, startFrom } from './testSaves'
import {
  arrivalShown,
  seasonArrival,
  seasonNews,
  bedYield,
  cameBack,
  farm,
  fullWater,
  harvestBeds,
  plant,
  quietSeasons,
  yieldNow,
  yieldOf,
  quietSteps,
  resetFarm,
  resumeSteps,
  seasonDay,
  seasonNow,
  setDailyClock,
  setSeason,
  setWeather,
  skipSteps,
  tick,
  weatherNow,
} from './state'

// The farm's year and weather in the farm (src/farm/state/season.ts): the season's clock counts days played from the day
// the farm's seasons began, waits through any absence and never goes back, and is never quiet; what the season and the
// weather change asks `seasonNow` and `weatherNow`, which are spring and clear while a new farm's first steps run and
// where the game is tested, until a test turns them on or sets its own.

const DAY_MS = 86_400_000
/** Noon on a day of the calendar, `k` days after the first. */
const NOON = new Date(2026, 10, 2, 12).getTime()
const at = (k: number) => setDailyClock(() => NOON + k * DAY_MS)
/** The farm opened on the `k`-th calendar day: a frame runs on it (a day played, when it is a new one). */
const playOn = (k: number) => {
  at(k)
  tick(0.1)
}
/** Farm time at every farm hour of `days` farm days. */
const hours = (days: number) => Array.from({ length: days * 24 }, (_, h) => (h * DAY.length) / 24)

beforeEach(() => {
  localStorage.clear()
  at(0)
  resetFarm()
  // the first day played
  tick(0.1)
})
afterEach(() => {
  setDailyClock(null)
  quietSeasons(true)
  quietSteps(true)
})

describe('the season’s clock: days played', () => {
  it('a new farm begins in spring on its first day played; a season every SEASON_DAYS days played', () => {
    // (begun: the steps quiet, as where the game is tested; its first spring has no arrival to show)
    expect(farm.season).toEqual({ from: 1, told: 0 })
    expect(seasonDay()).toMatchObject({ id: 'spring', day: 1, ordinal: 0, next: 'summer' })
    for (let k = 1; k < SEASON_DAYS; k++) playOn(k)
    expect(seasonDay()).toMatchObject({ id: 'spring', day: SEASON_DAYS, left: 0 })
    playOn(SEASON_DAYS)
    expect(seasonDay()).toMatchObject({ id: 'summer', day: 1, ordinal: 1 })
    for (let k = SEASON_DAYS + 1; k <= 3 * SEASON_DAYS; k++) playOn(k)
    expect(seasonDay()).toMatchObject({ id: 'winter', day: 1, ordinal: 3 })
  })

  it('it waits: a time away is no days played; the clock moved back never turns the season back', () => {
    playOn(1)
    // two months away, then back: one day played more
    playOn(60)
    expect(farm.played.days).toBe(3)
    expect(seasonDay()).toMatchObject({ id: 'spring', day: 3 })
    const now = seasonDay()
    playOn(10)
    playOn(59)
    expect(seasonDay()).toEqual(now)
  })

  it('never quiet: the clock runs where the game is tested, while its effects stay spring and clear', () => {
    for (let k = 1; k <= 2 * SEASON_DAYS; k++) playOn(k)
    expect(seasonDay().id).toBe('autumn')
    expect(seasonNow()).toBe('spring')
    for (const t of hours(30)) {
      farm.day.t = t
      expect(weatherNow()).toEqual(CLEAR)
    }
  })

  it('a time away runs in the season it was left in: the season turns on the next day played', () => {
    setSeason('clock')
    for (let k = 1; k < SEASON_DAYS; k++) playOn(k)
    expect(seasonNow()).toBe('spring')
    // the page closed on spring's last day, opened the next morning
    at(SEASON_DAYS)
    cameBack(3 * 3600)
    expect(seasonNow()).toBe('spring')
    tick(0.1)
    expect(seasonNow()).toBe('summer')
  })
})

describe('the season and the weather on', () => {
  it('by their clocks: the season of the days played, the weather of the farm’s clock in that season', () => {
    quietSeasons(false)
    for (let k = 1; k <= 3 * SEASON_DAYS; k++) playOn(k)
    expect(seasonNow()).toBe('winter')
    const kinds = new Set<string>()
    for (const t of hours(30)) {
      farm.day.t = t
      expect(weatherNow()).toEqual(weatherAt(t, 'winter'))
      kinds.add(weatherNow().kind)
    }
    expect(kinds.has('snow')).toBe(true)
    expect(kinds.has('rain')).toBe(false)
  })

  it('a test’s own season and weather stand whatever the clocks say; quiet again: spring and clear', () => {
    setSeason('autumn')
    const rain = standing('rain')
    setWeather(rain)
    rain.amount = 0
    playOn(1)
    for (const t of hours(2)) {
      farm.day.t = t
      expect([seasonNow(), weatherNow()]).toEqual(['autumn', standing('rain')])
    }
    quietSeasons(true)
    expect([seasonNow(), weatherNow()]).toEqual(['spring', CLEAR])
    quietSeasons(false)
    expect(seasonNow()).toBe(seasonDay().id)
    expect(weatherNow()).toEqual(weatherAt(farm.day.t, seasonNow()))
  })
})

describe('the seasons start once the first steps end', () => {
  it('while they run: spring and clear, and the first spring waits; it begins on the day played they end', () => {
    expect(SEASONS_AFTER_STEPS).toBe(true)
    resetFarm()
    quietSteps(false)
    quietSeasons(false)
    tick(0.1)
    // ten days played on the first steps
    for (let k = 1; k < 10; k++) playOn(k)
    expect(farm.played.days).toBe(10)
    expect(farm.season).toEqual({ from: 10, told: -1 })
    expect(seasonNow()).toBe('spring')
    for (const t of hours(30)) {
      farm.day.t = t
      expect(weatherNow()).toEqual(CLEAR)
    }
    // over: the year begins, on the first spring's first day, then on by days played
    skipSteps()
    tick(0.1)
    expect(farm.season).toEqual({ from: 10, told: 0 })
    expect(seasonDay()).toMatchObject({ id: 'spring', day: 1, ordinal: 0 })
    for (let k = 10; k < 10 + SEASON_DAYS; k++) playOn(k)
    expect(farm.season.from).toBe(10)
    expect([seasonDay().id, seasonNow()]).toEqual(['summer', 'summer'])
    // and the weather the clock's again: a shower within thirty farm days of summer
    const kinds = hours(30).map((t) => {
      farm.day.t = t
      return weatherNow().kind
    })
    expect(kinds).toContain('rain')
  })

  it('once begun it never waits again: the tips shown again later never turn the year back', () => {
    resetFarm()
    quietSteps(false)
    quietSeasons(false)
    tick(0.1)
    skipSteps()
    tick(0.1)
    for (let k = 1; k <= SEASON_DAYS; k++) playOn(k)
    expect(seasonDay()).toMatchObject({ id: 'summer', day: 1 })
    // Settings, *Show the tips again*: they run again, on a farm in summer
    expect(resumeSteps()).toBe(true)
    playOn(SEASON_DAYS + 1)
    expect(farm.season).toEqual({ from: 1, told: 0 })
    expect([seasonDay().id, seasonDay().day, seasonNow()]).toEqual(['summer', 2, 'summer'])
  })

  it('a test’s own season stands while they run', () => {
    resetFarm()
    quietSteps(false)
    setSeason('winter')
    setWeather(standing('snow'))
    tick(0.1)
    expect([seasonNow(), weatherNow()]).toEqual(['winter', standing('snow')])
  })
})

describe('?debug', () => {
  it('window.__home.season, made on the farm’s first frame: the season, the weather, the clock, the record, the switches', () => {
    const w = window as unknown as { __home?: Record<string, any> }
    w.__home = {}
    tick(0.1)
    const hook = w.__home.season
    expect(Object.keys(hook).sort()).toEqual(['day', 'now', 'quiet', 'record', 'set', 'weather'])
    hook.set('summer')
    hook.weather.set(standing('fog'))
    expect([hook.now(), hook.weather.now(), hook.record()]).toEqual(['summer', standing('fog'), farm.season])
    hook.quiet(true)
    expect([hook.now(), hook.weather.now(), hook.day()]).toEqual(['spring', CLEAR, seasonDay()])
    delete w.__home
  })
})

// Mission 10 c5: rain waters the beds — every bed still growing fills while it rains, for nothing and with no XP, in
// play and while away (the welcome back says so); never while the first steps run (their weather is clear).
describe('the rain waters the beds', () => {
  const sown = () => {
    farm.coins = 1000
    farm.beds[0] = { ...farm.beds[0], built: true, crop: null, growth: 0, water: 0 }
    expect(plant(0, 'lettuce')).toBe(true)
    farm.beds[0].water = 0
  }

  it('in play: a shower fills a dry bed still growing, gives no XP and counts no watering; a cloud does not', () => {
    sown()
    const xp = farm.xp.points
    const watered = farm.stats.watered
    setWeather(standing('cloudy'))
    tick(1)
    expect(farm.beds[0].water).toBe(0)
    setWeather(standing('rain'))
    tick(1)
    // full, less the second it then grew
    expect(farm.beds[0].water).toBeCloseTo(fullWater('lettuce') - 1)
    expect([farm.xp.points, farm.stats.watered]).toEqual([xp, watered])
  })

  it('a ripe bed takes no rain (nothing left to grow)', () => {
    sown()
    farm.beds[0].growth = cropById('lettuce').growSeconds
    setWeather(standing('rain'))
    tick(1)
    expect(farm.beds[0].water).toBe(0)
  })

  it('while away: the shower waters the beds and the welcome back tells it; with no rain it says nothing of it', () => {
    sown()
    setWeather(standing('rain'))
    expect(cameBack(3600)?.rained).toBe(true)
    expect(farm.beds[0].water).toBeGreaterThan(0)
    sown()
    setWeather(CLEAR)
    expect(cameBack(3600)?.rained).toBe(false)
  })
})

// Mission 10 c6: crops in season — a bed sown in its crop's season gives a quarter more (at least one), kept when the
// season turns before it is picked; out of season, and while the year is quiet or waits, as always.
describe('crops in season', () => {
  const ripe = (i: number) => (farm.beds[i].growth = cropById(farm.beds[i].crop!).growSeconds)
  const sow = (i: number, crop: Parameters<typeof plant>[1]) => {
    farm.coins = 10_000
    farm.beds[i] = { ...farm.beds[i], built: true, crop: null, growth: 0, water: 0, inSeason: false }
    expect(plant(i, crop)).toBe(true)
  }

  it('sown in autumn, picked in winter: a quarter more, kept; sown out of season: as always', () => {
    setSeason('autumn')
    sow(0, 'pumpkin')
    sow(1, 'lettuce')
    expect([farm.beds[0].inSeason, farm.beds[1].inSeason]).toEqual([true, false])
    expect(yieldNow('pumpkin')).toBe(yieldOf('pumpkin') + seasonExtra(yieldOf('pumpkin')))
    expect(yieldNow('lettuce')).toBe(yieldOf('lettuce'))
    setSeason('winter')
    ripe(0)
    ripe(1)
    expect(bedYield(0)).toBe(yieldOf('pumpkin') + seasonExtra(yieldOf('pumpkin')))
    expect(bedYield(1)).toBe(yieldOf('lettuce'))
    const before = farm.inv.pumpkin
    expect(harvestBeds([0])).toBe(bedYield(0) || yieldOf('pumpkin') + seasonExtra(yieldOf('pumpkin')))
    expect(farm.inv.pumpkin - before).toBe(yieldOf('pumpkin') + seasonExtra(yieldOf('pumpkin')))
    expect(farm.beds[0].inSeason).toBe(false)
  })

  it('quiet (spring is the farm as it always was) or waiting for the first steps: no bonus', () => {
    quietSeasons(true)
    sow(0, 'lettuce')
    expect(farm.beds[0].inSeason).toBe(false)
    expect(yieldNow('lettuce')).toBe(yieldOf('lettuce'))
  })

  it('kept in the save: a bed sown in season loads in season; one with nothing growing never is', () => {
    setSeason('autumn')
    sow(0, 'pumpkin')
    const save = savedNow()
    startFrom(justSaved(save))
    expect(farm.beds[0].inSeason).toBe(true)
    const beds = (save.beds as Record<string, unknown>[]).map((b, i) => (i === 1 ? { ...b, crop: null, inSeason: true } : b))
    startFrom(justSaved({ ...save, beds }))
    expect(farm.beds[1].inSeason).toBe(false)
  })
})

// Mission 10 c7: the season in the news and its arrival — told while the year plays, an arrival once a season (never
// the first spring), nothing while quiet.
describe('the season told', () => {
  it('a season that began is due to be shown once; shown, never again; the next season is due in its turn', () => {
    quietSeasons(false)
    expect(seasonNews()?.name).toBe('Spring')
    expect(seasonArrival()).toBe(null)
    for (let k = 1; k <= SEASON_DAYS; k++) playOn(k)
    expect(seasonArrival()?.name).toBe('Summer')
    expect(seasonArrival()).toMatchObject({ day: 1, days: SEASON_DAYS, next: { name: 'Autumn' } })
    arrivalShown()
    expect(seasonArrival()).toBe(null)
    for (let k = SEASON_DAYS + 1; k <= 2 * SEASON_DAYS; k++) playOn(k)
    expect(seasonArrival()?.name).toBe('Autumn')
  })

  it('quiet where the game is tested: nothing to tell', () => {
    quietSeasons(true)
    for (let k = 1; k <= SEASON_DAYS; k++) playOn(k)
    expect([seasonNews(), seasonArrival()]).toEqual([null, null])
  })
})
