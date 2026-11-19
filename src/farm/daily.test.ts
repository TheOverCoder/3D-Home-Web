import { afterEach, describe, expect, it } from 'vitest'
import { ITEMS, isItem, type ProduceId } from './data'
import {
  BACK_GIFT,
  OWED_MOST,
  WEEK,
  WEEK_GIFTS,
  allPrizes,
  backCoins,
  boxOdds,
  cameBackTo,
  chanceWords,
  claimed,
  countdown,
  dailyDay,
  dailyFresh,
  dailyStatus,
  dailyView,
  dayCoins,
  dayGoods,
  dayMaterials,
  dayNumber,
  dayOdds,
  dayStart,
  merged,
  owedDays,
  peekDay,
  rollClaim,
  rollDay,
  sanitizeDaily,
  type ClaimPrizes,
  type Daily,
  type WeekClock,
} from './daily'
import { GIFT_ODDS, type Prize } from './gifts'
import { sized } from './prize'
import { SEASON_DAYS } from './season'
import { levelReward } from './xp'

// The daily gift as rules (src/farm/daily.ts): the season's week on days played (it waits through any absence: N2), a
// week of gifts that grow, a day played whose gift was not claimed joining the next claim, the welcome-back gift after
// two whole days away (the same however long), nothing twice (the same day, or the clock moved back), what each day
// holds on dice given and how likely, what the card shows, and the record as saved, read back safe.

/** Dice that give these numbers in turn (the last one after that). */
const dice = (...n: number[]) => {
  let k = 0
  return () => n[Math.min(k++, n.length - 1)]
}
const coins = (n: number): Prize[] => [{ coins: n }]

const DAY = 20_400 // a calendar day (late 2025)
/** The week's clock on day played `played` of a farm whose seasons began on day played `from`, the calendar day `today`
 *  (by default as many calendar days after DAY as days played). */
const on = (played: number, today = DAY + played, from = 1): WeekClock => ({ played, from, today })
/** A claim of coins only: today's `n`, and each day that waited its own (1000 + its day played). */
const gives = (d: Daily, c: WeekClock, n: number): ClaimPrizes => ({
  today: coins(n),
  owed: owedDays(d, c).map((played) => ({ played, day: dailyDay(played, c.from).day, prizes: coins(1000 + played) })),
  back: d.back ? coins(backCoins(1)) : [],
})
/** A record claimed on days played 1 to `n`, a calendar day apart (day played k's gift: k coins). */
function claimRun(n: number, from: Daily = dailyFresh()): Daily {
  let d = from
  for (let k = 1; k <= n; k++) d = claimed(d, on(k), gives(d, on(k), k))!
  return d
}

describe('a day of the device’s calendar', () => {
  const tz = process.env.TZ
  afterEach(() => {
    process.env.TZ = tz
  })

  it('the local date, one more each day: from just after midnight to just before the next', () => {
    const first = dayNumber(new Date(2026, 0, 1, 0, 0, 30).getTime())
    for (let k = 0; k < 400; k++) {
      expect(dayNumber(new Date(2026, 0, 1 + k, 0, 0, 30).getTime()), `day ${k}, just after midnight`).toBe(first + k)
      expect(dayNumber(new Date(2026, 0, 1 + k, 23, 59, 30).getTime()), `day ${k}, just before midnight`).toBe(first + k)
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

describe('the season’s week, on days played', () => {
  it('the week is the season’s: day N is the season’s day N, day 7 its last', () => {
    expect(WEEK).toBe(SEASON_DAYS)
    for (let p = 1; p <= 3 * WEEK; p++) {
      expect(dailyDay(p, 1), `day played ${p}`).toMatchObject({ day: ((p - 1) % WEEK) + 1, ordinal: Math.floor((p - 1) / WEEK) })
      // a farm whose seasons began on its fifth day played: its week starts there
      expect(dailyDay(p + 4, 5).day).toBe(((p - 1) % WEEK) + 1)
    }
    expect(dailyDay(7, 1).left).toBe(0)
  })

  it('the first gift ever: today’s day of the season', () => {
    expect(dailyStatus(dailyFresh(), on(1))).toEqual({ ready: true, day: 1, owed: [], back: false, first: true })
    expect(claimed(dailyFresh(), on(1), gives(dailyFresh(), on(1), 10))).toEqual({ last: DAY + 1, offered: -1, at: 1, week: [coins(10)], back: false })
  })

  it('day after day played: the next day of the week; after day 7 a new week (the next season’s)', () => {
    let d = dailyFresh()
    for (let p = 1; p <= 2 * WEEK + 3; p++) {
      expect(dailyStatus(d, on(p)), `day played ${p}`).toMatchObject({ ready: true, day: ((p - 1) % WEEK) + 1, owed: [], back: false })
      d = claimed(d, on(p), gives(d, on(p), p))!
      // the week holds this season's days taken, from its day 1
      expect(d.week.map((w) => (w[0] as { coins: number }).coins)).toEqual(Array.from({ length: ((p - 1) % WEEK) + 1 }, (_, i) => p - ((p - 1) % WEEK) + i))
      expect(d.at).toBe(p)
    }
  })

  it('it waits through any absence: days away count nothing, the next day played is the next day of the week', () => {
    const d = claimRun(3)
    for (const away of [2, 3, 10, 400]) {
      // played on day 4 after `away` calendar days: still day 4, nothing waited (no day was played without a claim)
      expect(dailyStatus(d, on(4, DAY + 3 + away)), `${away} days later`).toEqual({ ready: true, day: 4, owed: [], back: false, first: false })
    }
  })

  it('the same day twice: nothing (claimed gives no record, the status says taken)', () => {
    const d = claimRun(1)
    expect(dailyStatus(d, on(1))).toEqual({ ready: false })
    expect(claimed(d, on(1), gives(d, on(1), 99))).toBeNull()
    expect(rollClaim(d, on(1), 1, [], dice(0))).toBeNull()
  })

  it('the clock moved back: days played never fall, so nothing until another day is played (no day twice)', () => {
    const d = claimRun(3) // claimed on day played 3, the calendar day DAY + 3
    for (const back of [1, 2, 10]) {
      expect(dailyStatus(d, on(3, DAY + 3 - back)), `${back} days back`).toEqual({ ready: false })
      // and a farm from before the season's week (no day played known) waits for the calendar past its last claim
      expect(dailyStatus({ ...d, at: 0, week: [] }, on(3, DAY + 3 - back)), `${back} days back, from before`).toEqual({ ready: false })
    }
    expect(dailyStatus(d, on(4))).toMatchObject({ ready: true, day: 4 })
  })

  it('a day played whose gift was not claimed joins the next claim, in its place on the road (none skipped)', () => {
    const d = claimRun(2)
    // days played 3 and 4 without a claim, then day 5
    expect(owedDays(d, on(5))).toEqual([3, 4])
    expect(dailyStatus(d, on(5))).toEqual({ ready: true, day: 5, owed: [3, 4], back: false, first: false })
    const after = claimed(d, on(5), gives(d, on(5), 5))!
    expect(after.week).toEqual([coins(1), coins(2), coins(1003), coins(1004), coins(5)])
    expect(after).toMatchObject({ at: 5, last: DAY + 5 })
    // and never again
    expect(owedDays(after, on(6))).toEqual([])
  })

  it('a first gift on a later day of the season: the days of it before join it; the days before the season began do not', () => {
    // seasons began on day played 3 (the first steps ended then); first claim on day played 5
    expect(owedDays(dailyFresh(), on(5, DAY + 5, 3))).toEqual([3, 4])
    expect(dailyStatus(dailyFresh(), on(5, DAY + 5, 3))).toMatchObject({ day: 3, owed: [3, 4], first: true })
  })

  it('the days that waited across a season’s end: given with the claim; the new week holds only its own', () => {
    const d = claimRun(5)
    // days 6 and 7 played without a claim; claimed on day played 9 (the next season's day 2)
    const c = on(9)
    expect(owedDays(d, c)).toEqual([6, 7, 8])
    const got = rollClaim(d, c, 10, ['egg'], dice(0))!
    expect(got.owed.map((o) => [o.played, o.day])).toEqual([
      [6, 6],
      [7, 7],
      [8, 1],
    ])
    // the big one of the season that ended is among them
    expect(got.owed[1].prizes).toHaveLength(3)
    const after = claimed(d, c, got)!
    expect(after.week).toEqual([got.owed[2].prizes, got.today])
  })

  it('at most a week of days that waited: a forgotten season does not pile up', () => {
    const d = claimRun(1)
    expect(owedDays(d, on(40))).toHaveLength(OWED_MOST)
    expect(owedDays(d, on(40))).toEqual([34, 35, 36, 37, 38, 39])
  })

  it('a farm from before the season’s week (its claim’s day played not known): nothing before today joins its next claim', () => {
    const old: Daily = { last: DAY + 1, offered: -1, at: 0, week: [], back: false }
    expect(owedDays(old, on(9, DAY + 4, 6))).toEqual([])
    expect(dailyStatus(old, on(9, DAY + 4, 6))).toEqual({ ready: true, day: 4, owed: [], back: false, first: false })
    // claimed on the calendar day it updated (in the game before): taken that day
    expect(dailyStatus({ ...old, last: DAY + 4 }, on(9, DAY + 4, 6))).toEqual({ ready: false })
  })
})

describe('the welcome-back gift', () => {
  it(`a return ${BACK_GIFT.away} calendar days or more after the day last played (two whole days missed) brings it, once`, () => {
    const d = claimRun(3)
    expect(cameBackTo(d, 1).back).toBe(false)
    expect(cameBackTo(d, BACK_GIFT.away - 1).back).toBe(false)
    for (const away of [BACK_GIFT.away, 5, 30, 400]) expect(cameBackTo(d, away).back, `${away} days`).toBe(true)
    // a first gift has no week that waited
    expect(cameBackTo(dailyFresh(), 10).back).toBe(false)
  })

  it('it comes with the next claim: day 1’s coins, the same however long the absence (playing daily pays more)', () => {
    const d = cameBackTo(claimRun(3), 30)
    expect(dailyStatus(d, on(4))).toMatchObject({ ready: true, day: 4, back: true })
    for (const level of [1, 8, 40]) {
      const got = rollClaim(d, on(4), level, [], dice(0))!
      expect(got.back).toEqual(coins(backCoins(level)))
      expect(backCoins(level)).toBe(dayCoins(1, level))
      expect(backCoins(level)).toBe(sized(BACK_GIFT.share, level, 5))
    }
    // given once: the claim takes it
    const after = claimed(d, on(4), gives(d, on(4), 4))!
    expect(after.back).toBe(false)
    expect(dailyStatus(after, on(5))).toMatchObject({ back: false })
  })

  it('a week claimed every day pays more than one with the welcome-back gift', () => {
    const level = 10
    const daily = [1, 2, 3, 4, 5, 6, 7].reduce((n, day) => n + rollDay(day, level, [], dice(0)).reduce((m, p) => m + ('coins' in p ? p.coins : 0), 0), 0)
    expect(daily).toBeGreaterThan(backCoins(level) + dayCoins(7, level))
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

  it('a claim rolls the days that waited first, in order, then today’s; its prizes as few pictures (coins together, each good together)', () => {
    const d = claimRun(1)
    const got = rollClaim(d, on(4), 1, made, dice(0))!
    expect(got.owed.map((o) => o.day)).toEqual([2, 3])
    expect(got.owed[0].prizes).toEqual([{ item: ITEMS[0], n: 2 }])
    expect(got.owed[1].prizes).toEqual(coins(15))
    expect(got.today).toEqual([{ item: 'lettuce', n: 3 }])
    expect(allPrizes(got)).toEqual([{ item: ITEMS[0], n: 2 }, ...coins(15), { item: 'lettuce', n: 3 }])
    expect(merged([...coins(5), { item: 'egg', n: 2 }, ...coins(7), { item: 'egg', n: 1 }, { item: 'log', n: 1 }])).toEqual([...coins(12), { item: 'egg', n: 3 }, { item: 'log', n: 1 }])
  })
})

describe('the odds, on screen', () => {
  const made: ProduceId[] = ['lettuce', 'egg', 'brick']
  it('a day’s kind is always its own; only which material or which good is on the dice, each alike', () => {
    expect(dayOdds(1, 1, made)).toEqual([{ what: '10 coins', share: 1 }])
    expect(dayOdds(2, 1, made).map((c) => c.share)).toEqual([1, 1 / ITEMS.length])
    // two goods made (the brick is a material, never a good)
    expect(dayOdds(4, 1, made)[1]).toEqual({ what: 'Which good: each of your 2 alike', share: 1 / 2 })
    expect(dayOdds(4, 1, [])[1].share).toBe(1 / ITEMS.length)
    expect(dayOdds(7, 1, made)).toHaveLength(5)
  })

  it('the level’s boxes: their odds sum to one; with no goods made, a material in their place', () => {
    for (const m of [made, [] as ProduceId[]]) expect(boxOdds(m).reduce((n, c) => n + c.share, 0)).toBeCloseTo(1, 9)
    expect(boxOdds(made)[0]).toEqual({ what: 'Coins', share: GIFT_ODDS.coins })
    expect(boxOdds([])).toHaveLength(2)
  })

  it('a chance in words', () => {
    expect(chanceWords(1)).toBe('Always')
    expect(chanceWords(1 / 6)).toBe('1 in 6')
    expect(chanceWords(0.55)).toBe('55 %')
    expect(chanceWords(0.5)).toBe('50 %')
    expect(chanceWords(1 / 20)).toBe('1 in 20')
    expect(chanceWords(0)).toBe('Never')
  })
})

describe('what the card shows', () => {
  it('mid-week, today waiting: the days taken with what they gave, today, the days to come with their peeks', () => {
    const v = dailyView(claimRun(3), on(4), 4)
    expect(v).toMatchObject({ ready: true, day: 4, days: 4, first: false, back: null, owed: 0, left: 3, tomorrow: 5 })
    expect(v.week.map((w) => w.state)).toEqual(['past', 'past', 'past', 'today', 'next', 'next', 'next'])
    expect(v.week.map((w) => w.got)).toEqual([coins(1), coins(2), coins(3), null, null, null, null])
    expect(v.week[6].peek).toEqual({ kind: 'big', coins: dayCoins(7, 4) })
  })

  it('days whose gifts waited glow beside today’s; the welcome-back gift’s coins wait with it', () => {
    const d = cameBackTo(claimRun(2), 4)
    const v = dailyView(d, on(5), 4)
    expect(v).toMatchObject({ ready: true, day: 5, owed: 2, back: backCoins(4) })
    expect(v.week.map((w) => w.state)).toEqual(['past', 'past', 'owed', 'owed', 'today', 'next', 'next'])
  })

  it('taken today: today among the days taken, the next day played the next day of the week', () => {
    const v = dailyView(claimRun(4), on(4), 4)
    expect(v).toMatchObject({ ready: false, day: 4, tomorrow: 5, back: null, owed: 0 })
    expect(v.week.map((w) => w.state)).toEqual(['past', 'past', 'past', 'past', 'next', 'next', 'next'])
    // the week done: every day taken, a new one the next day played
    const done = dailyView(claimRun(7), on(7), 4)
    expect(done.week.every((w) => w.state === 'past')).toBe(true)
    expect(done).toMatchObject({ tomorrow: 1, left: 0 })
    // a new season: a new week, nothing taken in it
    expect(dailyView(claimRun(7), on(8), 4).week.map((w) => w.state)).toEqual(['today', 'next', 'next', 'next', 'next', 'next', 'next'])
    expect(dailyView(dailyFresh(), on(1), 1)).toMatchObject({ ready: true, day: 1, first: true, tomorrow: 2, days: 1 })
  })

  it('how long until the next gift opens: to the next midnight (today’s waiting or taken), after the last day claimed when the clock went back; none without the moment', () => {
    // 15:30:20 on day played 3 (the calendar day DAY + 3): 8 h 29 min 40 s to midnight
    const at = (day: number, h: number, m = 0, s = 0) => {
      const d = new Date(dayStart(day))
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, s).getTime()
    }
    const now = at(DAY + 3, 15, 30, 20)
    expect(dayNumber(now)).toBe(DAY + 3)
    const left = 8 * 3600 + 29 * 60 + 40
    expect(dailyView(claimRun(2), on(3), 4, [], now).opensIn).toBeCloseTo(left, 6)
    expect(dailyView(claimRun(3), on(3), 4, [], now).opensIn).toBeCloseTo(left, 6)
    expect(dailyView(dailyFresh(), on(3), 4, [], now).opensIn).toBeCloseTo(left, 6)
    // half a second before midnight: half a second
    expect(dailyView(claimRun(3), on(3), 4, [], dayStart(DAY + 4) - 500).opensIn).toBeCloseTo(0.5, 6)
    // the clock moved back two days before the last day claimed: until the day after it
    const back = at(DAY + 1, 15, 30, 20)
    expect(dailyView(claimRun(3), on(3, DAY + 1), 4, [], back).opensIn).toBeCloseTo((dayStart(DAY + 4) - back) / 1000, 6)
    expect(dailyView(claimRun(3), on(3), 4).opensIn).toBeNull()
  })

  it('a day begins at its own midnight, where the clocks move too (a day of 23 or 25 hours)', () => {
    const tz = process.env.TZ
    try {
      for (const zone of ['UTC', 'America/New_York', 'Europe/Berlin', 'Australia/Sydney', 'Asia/Jerusalem', 'America/Santiago']) {
        process.env.TZ = zone
        const first = dayNumber(new Date(2026, 0, 1, 12).getTime())
        for (let k = 0; k < 366; k++) {
          const start = dayStart(first + k)
          expect(dayNumber(start), `${zone}, day ${k}`).toBe(first + k)
          expect(dayNumber(start - 1), `${zone}, day ${k}, a moment before`).toBe(first + k - 1)
        }
      }
    } finally {
      process.env.TZ = tz
    }
  })

  it('the countdown as a digital clock: hours, minutes, seconds; days past a day; a part of a second is a whole one', () => {
    expect(countdown(8 * 3600 + 29 * 60 + 40)).toBe('08:29:40')
    expect(countdown(59.2)).toBe('00:01:00')
    expect(countdown(0.4)).toBe('00:00:01')
    expect(countdown(0)).toBe('00:00:00')
    expect(countdown(-3)).toBe('00:00:00')
    expect(countdown(86_399)).toBe('23:59:59')
    expect(countdown(2 * 86_400 + 3 * 3600)).toBe('2d 03:00:00')
  })
})

describe('the record as saved', () => {
  const good: Daily = { last: DAY + 2, offered: DAY + 2, at: 10, week: [coins(10), [{ item: 'brick', n: 2 }], [{ coins: 40 }, { item: 'log', n: 3 }, { item: 'egg', n: 4 }]], back: true }

  it('a farm from before it: never claimed (day 1 waits)', () => {
    expect(sanitizeDaily(undefined, DAY)).toEqual(dailyFresh())
  })

  it('as saved, it loads as it is (twice the same), whatever today is (the clock back keeps it)', () => {
    for (const today of [DAY - 400, DAY, DAY + 2, DAY + 900]) {
      expect(sanitizeDaily(good, today)).toEqual(good)
      expect(sanitizeDaily(JSON.parse(JSON.stringify(sanitizeDaily(good, today))), today)).toEqual(good)
    }
  })

  it('a farm from before the season’s week (a streak, no day played): its last claim kept, its week starts with the season, no welcome back owed', () => {
    const old = { last: DAY + 2, streak: 12, offered: DAY + 1, week: [coins(10), coins(20)] }
    expect(sanitizeDaily(old, DAY + 3)).toEqual({ last: DAY + 2, offered: DAY + 1, at: 0, week: [], back: false })
  })

  it('broken: nothing twice — a day that cannot be read is today, taken', () => {
    for (const last of ['x', 2.5, -7, null, 1e20, NaN]) {
      const d = sanitizeDaily({ ...good, last }, DAY)
      expect(d.last, JSON.stringify(last)).toBe(DAY)
      expect(dailyStatus(d, on(10, DAY))).toEqual({ ready: false })
    }
    for (const raw of [null, 'daily', 7, true]) {
      const d = sanitizeDaily(raw, DAY)
      expect(d, JSON.stringify(raw)).toEqual({ last: DAY, offered: -1, at: 0, week: [], back: false })
      // the next day played: its gift waits
      expect(dailyStatus(d, on(3, DAY + 1))).toMatchObject({ ready: true, day: 3, owed: [] })
    }
    // a day played that cannot be read: not known (no week, nothing joins)
    for (const at of [-3, '10', 2.5, 0]) expect(sanitizeDaily({ ...good, at }, DAY), JSON.stringify(at)).toEqual({ ...good, at: 0, week: [] })
    // never a claim's day played, a week or a welcome back with no day taken
    expect(sanitizeDaily({ ...good, last: -1 }, DAY)).toEqual({ last: -1, offered: DAY + 2, at: 0, week: [], back: false })
    // the day it opened by itself: -1 when it cannot be read; a welcome back only when it says so
    expect(sanitizeDaily({ ...good, offered: 'today' }, DAY).offered).toBe(-1)
    expect(sanitizeDaily({ ...good, back: 'yes' }, DAY).back).toBe(false)
  })

  it('a claim’s day played past today’s (a save from elsewhere) is not believed: as a claim whose day played is not known', () => {
    const d = { ...good, at: 50, last: DAY - 5 }
    expect(dailyStatus(d, on(12, DAY))).toMatchObject({ ready: true, owed: [] })
    expect(
      dailyView(d, on(12, DAY), 3)
        .week.slice(0, 5)
        .map((w) => w.got),
    ).toEqual([null, null, null, null, null])
    expect(dailyStatus({ ...d, last: DAY }, on(12, DAY))).toEqual({ ready: false })
  })

  it('the week: a week at most; a day that cannot be read is taken, what it gave not known', () => {
    expect(sanitizeDaily({ ...good, week: [...good.week, ...good.week, coins(5), coins(6)] }, DAY).week).toHaveLength(WEEK)
    expect(sanitizeDaily({ ...good, week: [coins(10), 'x', [{ coins: -4 }], [{ item: 'nothing', n: 2 }]] }, DAY).week).toEqual([coins(10), [], [], []])
    expect(sanitizeDaily({ ...good, week: 'x' }, DAY).week).toEqual([])
    // a day of four prizes: three at most (the big one's)
    expect(sanitizeDaily({ ...good, week: [[...good.week[2], { coins: 1 }]] }, DAY).week).toEqual([good.week[2]])
  })
})
