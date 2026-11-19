// The device's calendar, and the farm's long clock (update-v1/CONTRACTS.md §1.10). The calendar counts days the way the
// player lives them — the day's one gift, one day played, the sales book's two weeks, a birthday — whatever the time zone
// or summer time does. The long clock is what the long game runs on: the daily week, the seasons and the season road.
// Pure.
//
// The calendar's one home: src/farm/daily.ts hands on dayNumber and dayStart, src/farm/events.ts dateKey. Days played
// are kept in the farm's save (`farm.played`) and counted by src/farm/state/daily.ts, markPlayed.

import { field, int, isRecord, MOST } from '../lib/saved'

const DAY_MS = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

/** The device's calendar day at a moment: the days from 1 January 1970 to its own date there (the local date, whatever
 *  the time zone or summer time). */
export function dayNumber(ms: number): number {
  const d = new Date(ms)
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
}

/** The moment a calendar day (`dayNumber`) begins on the device: its local midnight (where summer time skips midnight,
 *  the first moment of that date). */
export function dayStart(day: number): number {
  const d = new Date(day * DAY_MS)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime()
}

/** The device's local date of a moment: "2026-11-21". */
export function dateKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** A calendar day's date: its year, month (1–12), date (1–31) and weekday (0: Sunday). */
export function dateOf(day: number): { year: number; month: number; date: number; weekday: number } {
  const d = new Date(day * DAY_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, date: d.getUTCDate(), weekday: d.getUTCDay() }
}

// ───────────────────────────── days played: the long clock ─────────────────────────────

/** Days played: the days the farm has been opened, each counted once, by the calendar. It never falls, so whatever runs
 *  on it waits through any absence. `last`: the calendar day last played (-1: never). */
export interface Played {
  days: number
  last: number
}
export const freshPlayed = (): Played => ({ days: 0, last: -1 })

/** Today played: counted once a calendar day; a clock moved back counts nothing. `away`: the whole days since the day
 *  last played (0 on the same day, and the first time). */
export function markPlayed(p: Played, today: number): { played: Played; away: number } {
  const day = Math.floor(today)
  if (!Number.isFinite(day) || day <= p.last) return { played: p, away: 0 }
  return { played: { days: Math.min(MOST, p.days + 1), last: day }, away: p.last < 0 ? 0 : day - p.last }
}

/** Days played as saved, against today: a count, and a last day no later than today. Missing or unreadable (a farm from
 *  before them): `before`, read the same way (its old daily streak and last claim), else none yet. */
export function sanitizePlayed(raw: unknown, today: number, before?: Played): Played {
  const day = Number.isFinite(today) ? Math.floor(today) : -1
  // a last day played means at least one day played (a count lost to a bad value is never below it)
  const read = (v: unknown): Played => {
    const last = int(field(v, 'last'), -1, -1, Math.max(-1, day))
    return { days: Math.max(int(field(v, 'days'), 0, 0, MOST), last >= 0 ? 1 : 0), last }
  }
  if (isRecord(raw)) return read(raw)
  return before ? read(before) : freshPlayed()
}

/** [review] The long game's clock (update-v1/JOURNEY.md fix 4): days played. The daily week, the seasons and the season
 *  road count their days in it, so each waits through any absence. The one switch for that choice: 'calendar' runs them
 *  on the device's calendar instead. */
export const LONG_CLOCK: 'played' | 'calendar' = 'played'

/** The long clock's day now: days played so far, or (on the calendar) today's calendar day. */
export const longDay = (played: Played, today: number): number => (LONG_CLOCK === 'played' ? played.days : today)
