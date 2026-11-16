import { afterEach, describe, expect, it } from 'vitest'
import { ITEMS, isItem, type ProduceId } from './data'
import { GRACE, WEEK, WEEK_GIFTS, claimed, dailyFresh, dailyStatus, dailyView, dayCoins, dayGoods, dayMaterials, dayNumber, peekDay, rollDay, sanitizeDaily, weekDay, type Daily } from './daily'
import type { Prize } from './gifts'
import { levelReward } from './xp'

// The daily gift as rules (src/farm/daily.ts): a day of the device's calendar, a week of gifts that grow, the streak with
// one missed day forgiven, nothing twice (the same day, or the clock moved back), what each day holds on dice given,
// what the card shows, and the record as saved, read back safe.

/** Dice that give these numbers in turn (the last one after that). */
const dice = (...n: number[]) => {
  let k = 0
  return () => n[Math.min(k++, n.length - 1)]
}
const coins = (n: number): Prize[] => [{ coins: n }]
/** A record claimed day after day from `first`, `n` times (each gift a coin, to tell them apart). */
function claimRun(first: number, n: number, from: Daily = dailyFresh()): Daily {
  let d = from
  for (let k = 0; k < n; k++) d = claimed(d, first + k, coins(k + 1))!
  return d
}

const DAY = 20_400 // a day of the calendar (late 2025)

describe('a day of the device’s calendar', () => {
  const tz = process.env.TZ
  afterEach(() => {
    process.env.TZ = tz
  })

  it('the local date, one more each day: from just after midnight to just before the next', () => {
    const start = new Date(2026, 0, 1, 0, 0, 30).getTime()
    const first = dayNumber(start)
    for (let k = 0; k < 400; k++) {
      const morning = new Date(2026, 0, 1 + k, 0, 0, 30).getTime()
      const night = new Date(2026, 0, 1 + k, 23, 59, 30).getTime()
      expect(dayNumber(morning), `day ${k}, just after midnight`).toBe(first + k)
      expect(dayNumber(night), `day ${k}, just before midnight`).toBe(first + k)
    }
  })

  it('summer time changing (a day of 23 or 25 hours) is still one day: where the clocks move', () => {
    for (const zone of ['America/New_York', 'Europe/Berlin', 'Australia/Sydney', 'Asia/Jerusalem']) {
      process.env.TZ = zone
      const first = dayNumber(new Date(2026, 0, 1, 12).getTime())
      for (let k = 0; k < 366; k++) {
        expect(dayNumber(new Date(2026, 0, 1 + k, 0, 30).getTime()), `${zone}, day ${k}`).toBe(first + k)
        expect(dayNumber(new Date(2026, 0, 1 + k, 23, 30).getTime()), `${zone}, day ${k}, late`).toBe(first + k)
      }
    }
  })
})

describe('the week and the streak', () => {
  it('the first gift ever: day 1, a streak of 1', () => {
    expect(dailyStatus(dailyFresh(), DAY)).toEqual({ ready: true, day: 1, streak: 1, kept: false, broke: false, first: true })
    const d = claimed(dailyFresh(), DAY, coins(10))!
    expect(d).toEqual({ last: DAY, streak: 1, offered: -1, week: [coins(10)] })
  })

  it('the next day: the next day of the week, the streak on; after day 7 a new week, the streak counting on', () => {
    let d = dailyFresh()
    for (let k = 0; k < 2 * WEEK + 3; k++) {
      const s = dailyStatus(d, DAY + k)
      expect(s, `day ${k}`).toMatchObject({ ready: true, day: (k % WEEK) + 1, streak: k + 1, kept: false, broke: false })
      d = claimed(d, DAY + k, coins(k + 1))!
      // the week holds this week's days taken, from its day 1
      expect(d.week.map((p) => (p[0] as { coins: number }).coins)).toEqual(Array.from({ length: (k % WEEK) + 1 }, (_, i) => k - (k % WEEK) + i + 1))
    }
    expect(d.streak).toBe(2 * WEEK + 3)
    expect(weekDay(7)).toBe(7)
    expect(weekDay(8)).toBe(1)
    expect(weekDay(0)).toBe(1)
  })

  it('the same day twice: nothing (claimed gives no record, the status says taken)', () => {
    const d = claimed(dailyFresh(), DAY, coins(10))!
    expect(dailyStatus(d, DAY)).toEqual({ ready: false, why: 'taken' })
    expect(claimed(d, DAY, coins(99))).toBeNull()
  })

  it(`a missed day is forgiven (${GRACE}): the streak and the week go on, and the card says it waited`, () => {
    const d = claimRun(DAY, 3)
    // (the last claimed DAY + 2; DAY + 3 missed)
    const s = dailyStatus(d, DAY + 2 + 1 + GRACE)
    expect(s).toEqual({ ready: true, day: 4, streak: 4, kept: true, broke: false, first: false })
    const after = claimed(d, DAY + 4, coins(4))!
    expect(after).toMatchObject({ last: DAY + 4, streak: 4 })
    expect(after.week).toHaveLength(4)
  })

  it('two missed days or more: a new week from day 1, the streak at 1 (what was claimed is kept)', () => {
    const d = claimRun(DAY, 5)
    for (const gap of [3, 4, 30, 400]) {
      const s = dailyStatus(d, DAY + 4 + gap)
      expect(s, `${gap} days later`).toEqual({ ready: true, day: 1, streak: 1, kept: false, broke: true, first: false })
      expect(claimed(d, DAY + 4 + gap, coins(7))).toEqual({ last: DAY + 4 + gap, streak: 1, offered: -1, week: [coins(7)] })
    }
  })

  it('the clock moved back: nothing until the calendar is past the last day claimed again (no day twice)', () => {
    const d = claimRun(DAY, 3) // last: DAY + 2
    for (const back of [1, 2, 10]) {
      expect(dailyStatus(d, DAY + 2 - back), `${back} days back`).toEqual({ ready: false, why: 'early' })
      expect(claimed(d, DAY + 2 - back, coins(1))).toBeNull()
    }
    // forward again: the day after the last claimed goes on as ever
    expect(dailyStatus(d, DAY + 3)).toMatchObject({ ready: true, day: 4, streak: 4 })
  })

  it('a day changing while the game is open: the new day’s gift (a status asked again)', () => {
    const d = claimed(dailyFresh(), DAY, coins(1))!
    expect(dailyStatus(d, DAY).ready).toBe(false)
    expect(dailyStatus(d, DAY + 1)).toMatchObject({ ready: true, day: 2, streak: 2 })
  })
})

describe('what a day holds (the dice given)', () => {
  const made: ProduceId[] = ['lettuce', 'egg', 'brick']

  it('a week that grows: coins, a material, coins, goods, coins, materials, and the big one', () => {
    expect(WEEK_GIFTS).toEqual(['coins', 'material', 'coins', 'goods', 'coins', 'material', 'big'])
    // the coin days: half the next level's coins, three quarters, all of them; the big one twice
    expect([1, 3, 5, 7].map((day) => dayCoins(day, 1))).toEqual([10, 15, 20, 40])
    expect([1, 3, 5, 7].map((day) => dayCoins(day, 10))).toEqual([55, 83, 110, 220])
    expect(dayCoins(5, 10)).toBe(levelReward(11))
    for (const level of [1, 7, 30, 200, 500]) {
      const c = [1, 3, 5, 7].map((day) => dayCoins(day, level))
      expect(c, `level ${level}`).toEqual([...c].sort((a, b) => a - b))
      expect(dayMaterials(6, level)).toBeGreaterThanOrEqual(dayMaterials(2, level))
      expect(dayGoods(7, level)).toBeGreaterThanOrEqual(dayGoods(4, level))
    }
  })

  it('each day rolled: coins; one building material (the dice pick which); a few of a good the farm made; the big one all three', () => {
    expect(rollDay(1, 1, made, dice(0.3))).toEqual([{ coins: 10 }])
    expect(rollDay(2, 1, made, dice(0))).toEqual([{ item: ITEMS[0], n: 2 }])
    expect(rollDay(2, 1, made, dice(0.99))).toEqual([{ item: ITEMS[5], n: 2 }])
    expect(rollDay(4, 1, made, dice(0))).toEqual([{ item: 'lettuce', n: 3 }])
    // (never a building material as "goods": the farm's own goods only)
    expect(rollDay(4, 1, made, dice(0.99))).toEqual([{ item: 'egg', n: 3 }])
    expect(rollDay(6, 1, made, dice(0.5))).toEqual([{ item: ITEMS[3], n: 3 }])
    expect(rollDay(7, 1, made, dice(0, 0.5))).toEqual([{ coins: 40 }, { item: ITEMS[0], n: 3 }, { item: 'egg', n: 4 }])
  })

  it('a farm that has made nothing yet: a material in place of goods', () => {
    expect(rollDay(4, 1, [], dice(0))).toEqual([{ item: ITEMS[0], n: dayMaterials(4, 1) }])
    expect(rollDay(7, 1, [], dice(0, 0.99))).toEqual([{ coins: 40 }, { item: ITEMS[0], n: 3 }, { item: ITEMS[5], n: 3 }])
  })

  it('every gift small and real at any level: coins from 5, materials 1 to 6, goods 1 to 12', () => {
    let seed = 3
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let level = 1; level <= 500; level += 13)
      for (let day = 1; day <= WEEK; day++)
        for (const p of rollDay(day, level, made, random)) {
          if ('coins' in p) {
            expect(p.coins).toBeGreaterThanOrEqual(5)
            continue
          }
          expect(p.n).toBeGreaterThanOrEqual(1)
          expect(p.n).toBeLessThanOrEqual(isItem(p.item) ? 6 : 12)
        }
  })

  it('a peek tells a day before it is opened: the coins it will give, or its kind', () => {
    for (let day = 1; day <= WEEK; day++) {
      const peek = peekDay(day, 9)
      expect(peek.kind).toBe(WEEK_GIFTS[day - 1])
      if ('coins' in peek) expect(rollDay(day, 9, made, dice(0))[0]).toEqual({ coins: peek.coins })
    }
  })
})

describe('what the card shows', () => {
  it('mid-week, today waiting: the days taken with what they gave, today, the days to come with their peeks', () => {
    const d = claimRun(DAY, 3)
    const v = dailyView(d, DAY + 3, 4)
    expect(v).toMatchObject({ ready: true, day: 4, was: 3, streak: 4, kept: false, broke: false, first: false, tomorrow: 5 })
    expect(v.week.map((w) => w.state)).toEqual(['past', 'past', 'past', 'today', 'next', 'next', 'next'])
    expect(v.week.map((w) => w.got)).toEqual([coins(1), coins(2), coins(3), null, null, null, null])
    expect(v.week[6].peek).toEqual({ kind: 'big', coins: dayCoins(7, 4) })
  })

  it('taken today: today among the days taken, the streak as it stands, tomorrow the next day', () => {
    const v = dailyView(claimRun(DAY, 4), DAY + 3, 4)
    expect(v).toMatchObject({ ready: false, day: 4, was: 4, streak: 4, tomorrow: 5 })
    expect(v.week.map((w) => w.state)).toEqual(['past', 'past', 'past', 'past', 'next', 'next', 'next'])
    // the week done: every day taken, a new one tomorrow
    const done = dailyView(claimRun(DAY, 7), DAY + 6, 4)
    expect(done.week.every((w) => w.state === 'past')).toBe(true)
    expect(done.tomorrow).toBe(1)
  })

  it('after a break: a new week (nothing taken in it), the streak from 0; after a missed day: it waited', () => {
    const d = claimRun(DAY, 5)
    const broke = dailyView(d, DAY + 9, 4)
    expect(broke).toMatchObject({ ready: true, day: 1, was: 0, streak: 1, broke: true, kept: false })
    expect(broke.week.map((w) => w.state)).toEqual(['today', 'next', 'next', 'next', 'next', 'next', 'next'])
    const kept = dailyView(d, DAY + 6, 4)
    expect(kept).toMatchObject({ ready: true, day: 6, was: 5, streak: 6, kept: true })
    expect(dailyView(dailyFresh(), DAY, 1)).toMatchObject({ ready: true, day: 1, was: 0, streak: 1, first: true, tomorrow: 2 })
  })

  it('the clock moved back: nothing waiting, the week as it was', () => {
    const v = dailyView(claimRun(DAY, 2), DAY - 3, 4)
    expect(v).toMatchObject({ ready: false, day: 2, streak: 2 })
  })
})

describe('the record as saved', () => {
  const good: Daily = { last: DAY + 2, streak: 10, offered: DAY + 2, week: [coins(10), [{ item: 'brick', n: 2 }], [{ coins: 40 }, { item: 'log', n: 3 }, { item: 'egg', n: 4 }]] }

  it('a farm from before it: never claimed (day 1 waits)', () => {
    expect(sanitizeDaily(undefined, DAY)).toEqual(dailyFresh())
  })

  it('as saved, it loads as it is (twice the same), whatever today is (the clock back keeps it)', () => {
    for (const today of [DAY - 400, DAY, DAY + 2, DAY + 900]) {
      expect(sanitizeDaily(good, today)).toEqual(good)
      expect(sanitizeDaily(JSON.parse(JSON.stringify(sanitizeDaily(good, today))), today)).toEqual(good)
    }
  })

  it('broken: nothing twice — a day that cannot be read is today, taken; the streak kept when it can be read', () => {
    for (const last of ['x', 2.5, -7, null, 1e20, NaN]) {
      const d = sanitizeDaily({ ...good, last }, DAY)
      expect(d.last, JSON.stringify(last)).toBe(DAY)
      expect(dailyStatus(d, DAY)).toEqual({ ready: false, why: 'taken' })
    }
    for (const raw of [null, 'daily', 7, true]) {
      const d = sanitizeDaily(raw, DAY)
      expect(d, JSON.stringify(raw)).toEqual({ last: DAY, streak: 0, offered: -1, week: [] })
      // tomorrow a new week begins
      expect(dailyStatus(d, DAY + 1)).toMatchObject({ ready: true, day: 1, streak: 1 })
    }
    // a streak that cannot be read: 0 (the next gift starts a new week)
    expect(sanitizeDaily({ ...good, streak: -3 }, DAY)).toEqual({ ...good, streak: 0, week: [] })
    expect(sanitizeDaily({ ...good, streak: '10' }, DAY).streak).toBe(0)
    // never a streak with no day taken
    expect(sanitizeDaily({ ...good, last: -1 }, DAY)).toEqual({ last: -1, streak: 0, offered: DAY + 2, week: [] })
    // the day it opened by itself: -1 when it cannot be read
    expect(sanitizeDaily({ ...good, offered: 'today' }, DAY).offered).toBe(-1)
  })

  it('the week: no more days than the streak’s place in its week; a day that cannot be read is taken, what it gave not known', () => {
    // streak 10: day 3 of its second week, so three days
    expect(sanitizeDaily({ ...good, week: [...good.week, coins(5), coins(6)] }, DAY).week).toEqual(good.week)
    expect(sanitizeDaily({ ...good, week: [coins(10), 'x', [{ coins: -4 }], [{ item: 'nothing', n: 2 }]] }, DAY).week).toEqual([coins(10), [], []])
    expect(sanitizeDaily({ ...good, week: 'x' }, DAY).week).toEqual([])
    // a day of four prizes: three at most (the big one's)
    expect(sanitizeDaily({ ...good, week: [[...good.week[2], { coins: 1 }]] }, DAY).week).toEqual([good.week[2]])
    // and the card shows a day not known as taken, with nothing in it
    const v = dailyView(sanitizeDaily({ ...good, last: DAY, week: [coins(10), 'x'] }, DAY + 1), DAY + 1, 3)
    expect(v.week.slice(0, 3).map((w) => [w.state, w.got])).toEqual([
      ['past', coins(10)],
      ['past', null],
      ['past', null],
    ])
  })
})
