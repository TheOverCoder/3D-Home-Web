// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { takeFx } from '../fx/fx'
import { useHome } from '../store'
import { ITEMS } from './data'
import { dayCoins, dayMaterials, dayNumber } from './daily'
import { calendarDay, capacity, claimDaily, dailyDue, dailyNow, dailyWaiting, farm, offerDaily, quietDaily, resetFarm, setDailyClock, setRandom, used, xpEventCount } from './state'
import { OLD_SAVE, justSaved, savedNow, startFrom } from './testSaves'
import { levelOf } from './xp'

// The daily gift on the farm (src/farm/daily.ts, claimDaily and the rest in src/farm/state.ts): once a day of the
// device's calendar, paid once on the farm's own dice, goods into their building even past full, no XP; it opens by
// itself once a day on a farm that has begun, a day changing while the game is open brings the new day's; all of it
// kept in the save, an old save starting with none claimed.

const DAY_MS = 86_400_000
/** Noon on a day of the calendar, `k` days after the first. */
const NOON = new Date(2026, 10, 2, 12).getTime()
const at = (k: number) => setDailyClock(() => NOON + k * DAY_MS)
const always = (n: number) => () => n
/** Every good of the farm's, and its coins. */
const purse = () => ({ coins: farm.coins, inv: { ...farm.inv } })

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  quietDaily(false)
  setRandom(always(0))
  at(0)
  takeFx()
})
afterEach(() => {
  setRandom(null)
  setDailyClock(null)
  quietDaily(false)
})

describe('claimed once a day', () => {
  it('the first day: day 1’s coins, paid once; the same day again gives nothing', () => {
    const before = purse()
    expect(dailyNow()).toMatchObject({ ready: true, day: 1, was: 0, streak: 1, first: true })
    expect(claimDaily()).toEqual([{ coins: dayCoins(1, 1) }])
    expect(farm.coins).toBe(before.coins + dayCoins(1, 1))
    expect(farm.daily).toMatchObject({ last: calendarDay(), streak: 1 })
    // again, the same day (even in the evening): nothing
    expect(claimDaily()).toBeNull()
    setDailyClock(() => NOON + 11 * 3600_000)
    expect(claimDaily()).toBeNull()
    expect(farm.coins).toBe(before.coins + dayCoins(1, 1))
    expect(farm.inv).toEqual(before.inv)
    expect(dailyNow()).toMatchObject({ ready: false, streak: 1 })
  })

  it('the next day: the streak goes on, day 2’s building material (the dice pick which) into the barn', () => {
    claimDaily()
    at(1)
    setRandom(always(0.99))
    const before = purse()
    expect(claimDaily()).toEqual([{ item: ITEMS[5], n: dayMaterials(2, 1) }])
    expect(farm.inv[ITEMS[5]]).toBe(before.inv[ITEMS[5]] + dayMaterials(2, 1))
    expect(farm.coins).toBe(before.coins)
    expect(farm.daily.streak).toBe(2)
  })

  it('a missed day: the streak waits; two missed: a new week from day 1', () => {
    claimDaily()
    at(1)
    claimDaily()
    at(3) // day 2 of the calendar missed
    expect(dailyNow()).toMatchObject({ ready: true, day: 3, streak: 3, kept: true })
    expect(claimDaily()).toEqual([{ coins: dayCoins(3, 1) }])
    at(6) // two missed
    expect(dailyNow()).toMatchObject({ ready: true, day: 1, was: 0, streak: 1, broke: true })
    claimDaily()
    expect(farm.daily).toMatchObject({ streak: 1, week: [[{ coins: dayCoins(1, 1) }]] })
  })

  it('the clock moved back gives nothing until it is past the last day claimed again', () => {
    claimDaily()
    at(1)
    claimDaily()
    const coins = farm.coins
    for (const k of [0, -1, -30]) {
      at(k)
      expect(claimDaily(), `${k} days`).toBeNull()
      expect(dailyWaiting()).toBe(false)
    }
    expect(farm.coins).toBe(coins)
    at(2)
    expect(claimDaily()).toEqual([{ coins: dayCoins(3, 1) }])
  })

  it('goods go in even past full (as surprises do); a farm that has made nothing gets a material for goods', () => {
    farm.made.push('egg')
    farm.inv.egg = capacity('barn') // the barn full
    expect(used('barn')).toBe(capacity('barn'))
    farm.daily = { last: calendarDay() - 1, streak: 3, offered: -1, week: [[], [], []] }
    expect(claimDaily()).toEqual([{ item: 'egg', n: 3 }])
    expect(farm.inv.egg).toBe(capacity('barn') + 3)
    farm.made.length = 0
    farm.daily = { last: calendarDay(), streak: 3, offered: -1, week: [[], [], []] }
    at(1)
    expect(claimDaily()).toEqual([{ item: ITEMS[0], n: dayMaterials(4, 1) }])
  })

  it('no XP: a gift claimed is not something done (no points, no crystals)', () => {
    farm.xp.points = 4000
    farm.xp.paid = levelOf(4000)
    const events = xpEventCount()
    const got = claimDaily()!
    // (sized to the farm's level)
    expect(got).toEqual([{ coins: dayCoins(1, levelOf(4000)) }])
    expect([farm.xp.points, xpEventCount()]).toEqual([4000, events])
    expect(takeFx().filter((f) => f.kind === 'xp')).toEqual([])
  })

  it('the week: seven days that grow, the seventh the big one (coins, a material, goods), then a new week', () => {
    farm.made.push('lettuce')
    const kinds: string[] = []
    for (let k = 0; k < 8; k++) {
      at(k)
      const got = claimDaily()!
      kinds.push(got.map((p) => ('coins' in p ? 'coins' : ITEMS.includes(p.item as never) ? 'material' : 'goods')).join('+'))
    }
    expect(kinds).toEqual(['coins', 'material', 'coins', 'goods', 'coins', 'material', 'coins+material+goods', 'coins'])
    expect(farm.daily.streak).toBe(8)
    expect(farm.daily.week).toHaveLength(1)
  })
})

describe('offered once a day, on a farm that has begun', () => {
  it('a new farm (nothing planted): waiting for nothing yet; once it has begun, due, and opened by itself once a day', () => {
    expect([dailyWaiting(), dailyDue()]).toEqual([false, false])
    farm.started = true
    expect([dailyWaiting(), dailyDue()]).toEqual([true, true])
    offerDaily()
    expect(farm.daily.offered).toBe(calendarDay())
    // still waiting (the menu has it), not due again today
    expect([dailyWaiting(), dailyDue()]).toEqual([true, false])
    claimDaily()
    expect([dailyWaiting(), dailyDue()]).toEqual([false, false])
  })

  it('a day changing while the game is open: the new day’s gift is due', () => {
    farm.started = true
    offerDaily()
    claimDaily()
    expect(dailyDue()).toBe(false)
    at(1)
    expect(dailyDue()).toBe(true)
    expect(dailyNow()).toMatchObject({ ready: true, day: 2 })
  })

  it('put out of the way (tests): neither waiting nor due, and its card closes', () => {
    farm.started = true
    useHome.getState().openPanel({ kind: 'daily' })
    quietDaily(true)
    expect([dailyWaiting(), dailyDue()]).toEqual([false, false])
    expect(useHome.getState().panel).toBeNull()
    // the gift itself still waits for the day it is put back
    quietDaily(false)
    expect(dailyDue()).toBe(true)
  })

  it('the calendar is the device’s own: the clock’s day, from just after midnight to just before the next', () => {
    setDailyClock(() => new Date(2026, 10, 2, 0, 0, 5).getTime())
    const day = calendarDay()
    setDailyClock(() => new Date(2026, 10, 2, 23, 59, 55).getTime())
    expect(calendarDay()).toBe(day)
    setDailyClock(() => new Date(2026, 10, 3, 0, 0, 5).getTime())
    expect(calendarDay()).toBe(day + 1)
    expect(day).toBe(dayNumber(NOON))
  })
})

describe('kept in the save', () => {
  it('claimed, saved and loaded: the streak, the day and the week as they were; nothing again that day', () => {
    claimDaily()
    at(1)
    claimDaily()
    offerDaily()
    const daily = structuredClone(farm.daily)
    startFrom(justSaved(savedNow()))
    expect(farm.daily).toEqual(daily)
    expect(claimDaily()).toBeNull()
    at(2)
    expect(claimDaily()).toEqual([{ coins: dayCoins(3, 1) }])
  })

  it('a farm from before the daily gift: none claimed yet, day 1 waits (and it has begun: it is due)', () => {
    startFrom(justSaved(OLD_SAVE))
    expect(farm.daily).toEqual({ last: -1, streak: 0, offered: -1, week: [] })
    expect(dailyNow()).toMatchObject({ ready: true, day: 1, first: true })
    farm.started = true
    expect(dailyDue()).toBe(true)
  })

  it('broken in the save: today counts as taken (nothing twice), tomorrow a new week', () => {
    claimDaily()
    startFrom(justSaved({ ...savedNow(), daily: { last: 'yesterday', streak: 4 } }))
    expect(farm.daily).toMatchObject({ last: calendarDay(), streak: 4 })
    expect(claimDaily()).toBeNull()
    at(1)
    expect(dailyNow()).toMatchObject({ ready: true, streak: 5, day: 5 })
  })
})
