import { describe, expect, it } from 'vitest'
import { dateKey, dateOf, dayNumber, dayStart, freshPlayed, longDay, markPlayed, sanitizePlayed } from './calendar'
import { dayNumber as dailyDayNumber, dayStart as dailyDayStart } from './daily'
import { dateKey as eventsDateKey } from './events'

// The calendar and days played (update-v1/CONTRACTS.md §1.10): its days whole on the device's clock every hour across
// two years, summer time's changes among them; daily.ts and events.ts hand on these same functions.

describe('the calendar', () => {
  it('every hour across two years: the moment is inside its day, from its midnight to the next, and its date is the day’s', () => {
    const from = new Date(2026, 0, 1).getTime()
    for (let h = 0; h < 2 * 366 * 24; h++) {
      const ms = from + h * 3_600_000
      const day = dayNumber(ms)
      expect(dayStart(day) <= ms && ms < dayStart(day + 1), new Date(ms).toString()).toBe(true)
      const { year, month, date } = dateOf(day)
      expect(dateKey(ms)).toBe(`${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`)
    }
  })

  it('is the one the daily gift and the week’s events count on', () => {
    expect([dailyDayNumber, dailyDayStart, eventsDateKey]).toEqual([dayNumber, dayStart, dateKey])
  })

  it('a day number’s date is the local date it was made from', () => {
    const ms = new Date(2026, 10, 18, 23, 59).getTime()
    expect(dateOf(dayNumber(ms))).toEqual({ year: 2026, month: 11, date: 18, weekday: 3 })
    expect(dateKey(ms)).toBe('2026-11-18')
    expect(dateOf(dayNumber(new Date(2028, 1, 29, 0, 1).getTime()))).toEqual({ year: 2028, month: 2, date: 29, weekday: 2 })
  })
})

describe('days played', () => {
  const DAY = dayNumber(new Date(2026, 10, 18, 12).getTime())

  it('counts each calendar day once, the first time too', () => {
    let p = freshPlayed()
    let r = markPlayed(p, DAY)
    expect(r).toEqual({ played: { days: 1, last: DAY }, away: 0 })
    p = r.played
    expect(markPlayed(p, DAY)).toEqual({ played: p, away: 0 })
    r = markPlayed(p, DAY + 1)
    expect(r).toEqual({ played: { days: 2, last: DAY + 1 }, away: 1 })
  })

  it('waits through an absence, and says how long it was', () => {
    const p = { days: 5, last: DAY }
    expect(markPlayed(p, DAY + 30)).toEqual({ played: { days: 6, last: DAY + 30 }, away: 30 })
  })

  it('never falls: a clock moved back counts nothing', () => {
    const p = { days: 5, last: DAY }
    expect(markPlayed(p, DAY - 3)).toEqual({ played: p, away: 0 })
    expect(markPlayed(p, NaN)).toEqual({ played: p, away: 0 })
  })

  it('as saved: a count, and a last day no later than today', () => {
    expect(sanitizePlayed({ days: 12, last: DAY - 1 }, DAY)).toEqual({ days: 12, last: DAY - 1 })
    // (a last day played means at least one day played)
    expect(sanitizePlayed({ days: -4, last: DAY + 9 }, DAY)).toEqual({ days: 1, last: DAY })
    expect(sanitizePlayed({ days: [], last: DAY - 3 }, DAY)).toEqual({ days: 1, last: DAY - 3 })
    expect(sanitizePlayed({ days: 2.6, last: 'x' }, DAY)).toEqual({ days: 3, last: -1 })
    expect(sanitizePlayed({ days: Infinity, last: -50 }, DAY)).toEqual({ days: 0, last: -1 })
  })

  it('a farm from before them starts from its old streak and last claim; else from none', () => {
    expect(sanitizePlayed(undefined, DAY, { days: 9, last: DAY - 2 })).toEqual({ days: 9, last: DAY - 2 })
    expect(sanitizePlayed([1, 2], DAY, { days: 9, last: DAY + 2 })).toEqual({ days: 9, last: DAY })
    for (const raw of [undefined, null, 'x', 3, []]) expect(sanitizePlayed(raw, DAY)).toEqual(freshPlayed())
  })

  it('is the long clock', () => {
    expect(longDay({ days: 23, last: DAY }, DAY)).toBe(23)
  })
})
