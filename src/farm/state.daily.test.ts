// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { takeFx } from '../fx/fx'
import { useHome } from '../store'
import { ITEMS } from './data'
import { BACK_GIFT, backCoins, dayCoins, dayMaterials, dayNumber, WEEK } from './daily'
import {
  calendarDay,
  capacity,
  claimDaily,
  claimToday,
  dailyDayNow,
  dailyDue,
  dailyNow,
  dailyWaiting,
  farm,
  markPlayed,
  offerDaily,
  quietDaily,
  resetFarm,
  resetRewardCounts,
  rewardCounts,
  setDailyClock,
  setRandom,
  tick,
  used,
  xpEventCount,
} from './state'
import { OLD_SAVE, justSaved, savedNow, startFrom } from './testSaves'
import { levelOf } from './xp'

// The daily gift on the farm (src/farm/daily.ts, claimDaily and the rest in src/farm/state/daily.ts): the season's week
// on days played (it waits through any absence), paid once a day played on the farm's own dice, goods into their
// building even past full, no XP; a day played whose gift was not claimed joins the next claim; a return after two whole
// days away brings the welcome-back gift with it; it opens by itself once a day on a farm that has begun, a day
// changing while the game is open brings the new day's; all of it kept in the save, an old save starting with none
// claimed.

const DAY_MS = 86_400_000
/** Noon on a day of the calendar, `k` days after the first. */
const NOON = new Date(2026, 10, 2, 12).getTime()
const at = (k: number) => setDailyClock(() => NOON + k * DAY_MS)
/** The farm opened on the calendar day `k` days after the first: its first frame of that day counts it played. */
const play = (k: number) => {
  at(k)
  return markPlayed()
}
const always = (n: number) => () => n
/** Every good of the farm's, and its coins. */
const purse = () => ({ coins: farm.coins, inv: { ...farm.inv } })

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  quietDaily(false)
  setRandom(always(0))
  play(0)
  takeFx()
})
afterEach(() => {
  setRandom(null)
  setDailyClock(null)
  quietDaily(false)
})

describe('claimed once a day played', () => {
  it('the first day: day 1’s coins, paid once; the same day again gives nothing', () => {
    const before = purse()
    expect(dailyNow()).toMatchObject({ ready: true, day: 1, days: 1, first: true, back: null, owed: 0 })
    expect(claimDaily()).toEqual([{ coins: dayCoins(1, 1) }])
    expect(farm.coins).toBe(before.coins + dayCoins(1, 1))
    expect(farm.daily).toMatchObject({ last: calendarDay(), at: 1, week: [[{ coins: dayCoins(1, 1) }]] })
    // again, the same day (even in the evening): nothing
    expect(claimDaily()).toBeNull()
    setDailyClock(() => NOON + 11 * 3600_000)
    expect(claimDaily()).toBeNull()
    expect(farm.coins).toBe(before.coins + dayCoins(1, 1))
    expect(farm.inv).toEqual(before.inv)
    expect(dailyNow()).toMatchObject({ ready: false, day: 1 })
  })

  it('the next day played: the season’s day 2, its building material (the dice pick which) into the barn', () => {
    claimDaily()
    play(1)
    setRandom(always(0.99))
    const before = purse()
    expect(dailyDayNow()).toMatchObject({ day: 2, ordinal: 0 })
    expect(claimDaily()).toEqual([{ item: ITEMS[5], n: dayMaterials(2, 1) }])
    expect(farm.inv[ITEMS[5]]).toBe(before.inv[ITEMS[5]] + dayMaterials(2, 1))
    expect(farm.coins).toBe(before.coins)
    expect(farm.daily.at).toBe(2)
  })

  it('it waits: days away count nothing, the next day played is the next day of the week', () => {
    claimDaily()
    play(1)
    claimDaily()
    play(9) // a week away
    expect(dailyNow()).toMatchObject({ ready: true, day: 3, days: 3, owed: 0 })
    expect(claimToday()!.prizes.filter((p) => !('coins' in p && p.coins === backCoins(1)) || farm.daily.back)).toEqual([{ coins: dayCoins(3, 1) }])
  })

  it('a day played without a claim: its gift joins the next one, and the road has it in its place', () => {
    claimDaily()
    play(1) // played, not claimed
    play(2)
    expect(dailyNow()).toMatchObject({ ready: true, day: 3, owed: 1 })
    expect(dailyNow().week.map((w) => w.state)).toEqual(['past', 'owed', 'today', 'next', 'next', 'next', 'next'])
    const got = claimDaily()!
    expect(got).toEqual([{ item: ITEMS[0], n: dayMaterials(2, 1) }, { coins: dayCoins(3, 1) }])
    expect(farm.daily.week).toEqual([[{ coins: dayCoins(1, 1) }], [{ item: ITEMS[0], n: dayMaterials(2, 1) }], [{ coins: dayCoins(3, 1) }]])
  })

  it(`a return ${BACK_GIFT.away} days or more after the day last played: the welcome-back gift with the next claim, once, a reward of its own`, () => {
    claimDaily()
    expect(play(1 + BACK_GIFT.away)).toBe(1 + BACK_GIFT.away)
    expect(farm.daily.back).toBe(true)
    expect(dailyNow()).toMatchObject({ ready: true, day: 2, back: backCoins(1) })
    resetRewardCounts()
    const coins = farm.coins
    const got = claimToday()!
    expect(got.back).toEqual([{ coins: backCoins(1) }])
    expect(farm.coins).toBe(coins + backCoins(1))
    expect(farm.daily.back).toBe(false)
    // the day's gifts one reward, the welcome back another (each through give)
    const counted = (k: 'daily' | 'back') => Object.values(rewardCounts()[k]).reduce((n, c) => n + c, 0)
    expect([counted('daily'), counted('back')]).toEqual([1, 1])
    expect(['small', 'medium', 'big', 'huge']).toContain(got.tier)
    // a return after one day: none
    play(1 + BACK_GIFT.away + 2)
    expect(farm.daily.back).toBe(false)
  })

  it('the clock moved back gives nothing: days played never fall', () => {
    claimDaily()
    play(1)
    claimDaily()
    const coins = farm.coins
    for (const k of [0, -1, -30]) {
      play(k)
      expect(claimDaily(), `${k} days`).toBeNull()
      expect(dailyWaiting()).toBe(false)
    }
    expect(farm.coins).toBe(coins)
    play(2)
    expect(claimDaily()).toEqual([{ coins: dayCoins(3, 1) }])
  })

  it('goods go in even past full (as surprises do); a farm that has made nothing gets a material for goods', () => {
    claimDaily()
    for (const k of [1, 2]) {
      play(k)
      claimDaily()
    }
    farm.made.push('egg')
    farm.inv.egg += capacity('barn') - used('barn') // the barn full
    expect(used('barn')).toBe(capacity('barn'))
    const eggs = farm.inv.egg
    play(3)
    expect(claimDaily()).toEqual([{ item: 'egg', n: 3 }])
    expect(farm.inv.egg).toBe(eggs + 3)
    farm.made.length = 0
    farm.daily = { ...farm.daily, last: calendarDay() - 1, at: 3, week: farm.daily.week.slice(0, 3) }
    expect(dailyNow().day).toBe(4)
    expect(claimDaily()).toEqual([{ item: ITEMS[0], n: dayMaterials(4, 1) }])
  })

  it('no XP: a gift claimed is not something done (no points, no crystals)', () => {
    farm.xp.points = 4000
    farm.xp.paid = levelOf(4000)
    const events = xpEventCount()
    // (sized to the farm's level)
    expect(claimDaily()).toEqual([{ coins: dayCoins(1, levelOf(4000)) }])
    expect([farm.xp.points, xpEventCount()]).toEqual([4000, events])
    expect(takeFx().filter((f) => f.kind === 'xp')).toEqual([])
  })

  it('the week: seven days played that grow, the seventh the big one (coins, a material, goods), then the next season’s week', () => {
    farm.made.push('lettuce')
    const kinds: string[] = []
    for (let k = 0; k < WEEK + 1; k++) {
      play(k)
      const got = claimDaily()!
      kinds.push(got.map((p) => ('coins' in p ? 'coins' : ITEMS.includes(p.item as never) ? 'material' : 'goods')).join('+'))
    }
    expect(kinds).toEqual(['coins', 'material', 'coins', 'goods', 'coins', 'material', 'coins+material+goods', 'coins'])
    expect(farm.daily.week).toHaveLength(1)
    expect(dailyDayNow()).toMatchObject({ day: 1, ordinal: 1 })
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

  it('a day changing while the game is open: the new day’s gift is due (today counted even before its first frame)', () => {
    farm.started = true
    offerDaily()
    claimDaily()
    expect(dailyDue()).toBe(false)
    at(1)
    expect(dailyDue()).toBe(true)
    expect(dailyNow()).toMatchObject({ ready: true, day: 2, days: 2 })
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

describe('days played', () => {
  it('counted once a calendar day, the first time the farm runs that day; how long the player was away', () => {
    resetFarm()
    expect(farm.played).toEqual({ days: 0, last: -1 })
    expect(markPlayed()).toBe(0)
    expect(farm.played).toEqual({ days: 1, last: calendarDay() })
    // the same day again, later: nothing
    setDailyClock(() => NOON + 11 * 3600_000)
    expect(markPlayed()).toBe(0)
    expect(farm.played.days).toBe(1)
    // three days on: one more day played, three away
    at(3)
    expect(markPlayed()).toBe(3)
    expect(farm.played).toEqual({ days: 2, last: calendarDay() })
  })

  it('each frame asks: a farm left open over midnight counts the new day', () => {
    resetFarm()
    tick(1)
    expect(farm.played.days).toBe(1)
    tick(1)
    at(1)
    tick(1)
    expect(farm.played).toEqual({ days: 2, last: calendarDay() })
  })

  it('never falls: the clock moved back counts nothing, and it waits through any absence', () => {
    resetFarm()
    at(5)
    markPlayed()
    for (const k of [4, 0, -30]) {
      at(k)
      expect(markPlayed(), `${k}`).toBe(0)
      expect(farm.played.days).toBe(1)
    }
    at(40)
    expect(markPlayed()).toBe(35)
    expect(farm.played.days).toBe(2)
  })

  it('kept in the save: saved and loaded as it was', () => {
    play(2)
    const played = { ...farm.played }
    startFrom(justSaved(savedNow()))
    expect(farm.played).toEqual(played)
  })
})

describe('kept in the save', () => {
  it('claimed, saved and loaded: the day played, the week and the welcome back as they were; nothing again that day', () => {
    claimDaily()
    play(1)
    claimDaily()
    offerDaily()
    play(6)
    const daily = structuredClone(farm.daily)
    expect(daily.back).toBe(true)
    startFrom(justSaved(savedNow()))
    expect(farm.daily).toEqual(daily)
    expect(claimToday()!.back).toEqual([{ coins: backCoins(1) }])
    expect(claimDaily()).toBeNull()
  })

  it('a farm from before the daily gift: none claimed yet, the season’s day waits (and it has begun: it is due)', () => {
    startFrom(justSaved(OLD_SAVE))
    expect(farm.daily).toEqual({ last: -1, offered: -1, at: 0, week: [], back: false })
    expect(dailyNow()).toMatchObject({ ready: true, day: 1, first: true })
    farm.started = true
    expect(dailyDue()).toBe(true)
  })

  it('a farm from before the season’s week: its streak gone, its last claim kept (nothing twice that day), its week starts with the season', () => {
    claimDaily()
    startFrom(justSaved({ ...savedNow(), daily: { last: calendarDay(), streak: 4, offered: -1, week: [[{ coins: 5 }]] } }))
    expect(farm.daily).toEqual({ last: calendarDay(), offered: -1, at: 0, week: [], back: false })
    expect(claimDaily()).toBeNull()
    play(1)
    expect(dailyNow()).toMatchObject({ ready: true, owed: 0 })
    expect(claimDaily()).not.toBeNull()
  })

  it('broken in the save: today counts as taken (nothing twice), the next day played its gift waits', () => {
    claimDaily()
    startFrom(justSaved({ ...savedNow(), daily: { last: 'yesterday' } }))
    expect(farm.daily).toMatchObject({ last: calendarDay(), at: 0 })
    expect(claimDaily()).toBeNull()
    play(1)
    expect(dailyNow()).toMatchObject({ ready: true, day: 2 })
  })
})
