// The daily gift (its card: src/farm/DailyCard.tsx): once a day of the device's own calendar, a gift to claim, and a
// streak of the days claimed in a row. Seven days make a week of gifts that grow — coins, a building material, more
// coins, a few of a good the farm makes, more coins, more materials — and the seventh is the big one: coins, materials
// and goods together. Then a new week begins, the streak counting on.
//
// A missed day is forgiven (GRACE): the streak waits, and the week goes on where it was. Miss two days in a row and a
// new week starts at day 1 (the streak at 1). A cosy farm is played in short visits: a busy day should not wipe out a
// week, yet a streak still means coming back (Duolingo found that a forgiving streak keeps more people playing than a
// strict one; what was claimed is never taken back). The clock moved back gives nothing until the calendar is past the
// last day claimed again: no day is ever claimed twice. Pure: the rules and the record kept in the save;
// src/farm/state.ts gives what they say, on the farm's own dice. None of it is XP: a gift is not something done.

import { SELLABLE, type ProduceId } from './data'
import { savedPrize, type Prize } from './gifts'
import { randomItem } from './storage'
import { levelReward } from './xp'

/** Days in a week of gifts. */
export const WEEK = 7
/** How many days in a row may be missed between two claims with the streak going on. */
export const GRACE = 1
/** What each day of the week holds: coins, a building material, a few of a good the farm makes, or the big one. */
export const WEEK_GIFTS = ['coins', 'material', 'coins', 'goods', 'coins', 'material', 'big'] as const
export type DayKind = (typeof WEEK_GIFTS)[number]

const DAY_MS = 86_400_000
/** The furthest calendar day a save may name (the year 10000): past it, a number is not a day. */
const LAST_DAY = 2_932_897

/** The daily gift as saved. A day is a calendar day of the device (`dayNumber`). */
export interface Daily {
  /** the day of the last gift claimed (-1: none yet) */
  last: number
  /** gifts claimed in a row, the last one's included (a missed day forgiven); 0 before the first */
  streak: number
  /** the day the gift last opened by itself (it does not again that day; -1: never) */
  offered: number
  /** what each day of this week claimed so far gave, from its day 1 (an empty list: taken, what it gave not known) */
  week: Prize[][]
}

/** A farm that has never claimed one. */
export const dailyFresh = (): Daily => ({ last: -1, streak: 0, offered: -1, week: [] })

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

/** A wait as a digital clock shows it, counting down: hours, minutes and seconds, two digits each ("07:42:05"), and
 *  the whole days before them past a day ("2d 03:00:00"). A part of a second counts as a whole one (it is not over). */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-9))
  const days = Math.floor(s / 86_400)
  const hms = [Math.floor((s % 86_400) / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')
  return days ? `${days}d ${hms}` : hms
}

/** The day of the week (1–7) of the streak's n-th gift. */
export const weekDay = (streak: number) => ((Math.max(1, Math.floor(streak)) - 1) % WEEK) + 1

/** Where the gift stands today: waiting (the week's day it is, the streak once it is claimed, a missed day forgiven, a
 *  new week after a break, the very first), or not (taken today; or the clock is before the last day claimed). */
export type DailyStatus = { ready: true; day: number; streak: number; kept: boolean; broke: boolean; first: boolean } | { ready: false; why: 'taken' | 'early' }

export function dailyStatus(d: Daily, today: number): DailyStatus {
  if (d.last < 0) return { ready: true, day: 1, streak: 1, kept: false, broke: false, first: true }
  const gap = today - d.last
  if (gap === 0) return { ready: false, why: 'taken' }
  if (gap < 0) return { ready: false, why: 'early' }
  if (d.streak >= 1 && gap <= 1 + GRACE) {
    const streak = d.streak + 1
    return { ready: true, day: weekDay(streak), streak, kept: gap > 1, broke: false, first: false }
  }
  return { ready: true, day: 1, streak: 1, kept: false, broke: d.streak >= 1, first: false }
}

/** The record once today's gift (`prizes`) is claimed, or null when there is none to claim today. */
export function claimed(d: Daily, today: number, prizes: Prize[]): Daily | null {
  const s = dailyStatus(d, today)
  if (!s.ready) return null
  const before = s.day === 1 ? [] : d.week.slice(0, s.day - 1)
  while (before.length < s.day - 1) before.push([])
  return { last: today, streak: s.streak, offered: d.offered, week: [...before, prizes] }
}

/** The coins a day's gift is sized from: the next level's own coins (so a gift means as much at level 40 as at 4). */
const base = (level: number) => levelReward(Math.max(1, Math.floor(level)) + 1)
/** The coins of a coin day (1, 3, 5: half the next level's coins, three quarters, all of them) and of the big one (7:
 *  twice). */
export function dayCoins(day: number, level: number): number {
  const share = day === 1 ? 0.5 : day === 3 ? 0.75 : day === 5 ? 1 : day === WEEK ? 2 : 0
  return Math.max(5, Math.round(base(level) * share))
}
/** How many of one building material a day gives (2: a few, 6: more, 7: the big one's), more at the higher levels. */
export function dayMaterials(day: number, level: number): number {
  const l = Math.max(1, Math.floor(level))
  return day === 2 ? Math.min(5, 2 + Math.floor(l / 20)) : Math.min(6, 3 + Math.floor(l / 15))
}
/** How many of a good the farm makes a day gives (4: a few; 7: the big one's), more at the higher levels. */
export function dayGoods(day: number, level: number): number {
  const l = Math.max(1, Math.floor(level))
  return day === WEEK ? Math.min(12, 4 + Math.floor(l / 8)) : Math.min(10, 3 + Math.floor(l / 10))
}

/** What a day's gift will be, before it is opened (the week's road peeks at it): coins with how many, or which kind. */
export type Peek = { kind: 'coins'; coins: number } | { kind: 'material' } | { kind: 'goods' } | { kind: 'big'; coins: number }

export function peekDay(day: number, level: number): Peek {
  const kind = WEEK_GIFTS[(Math.max(1, day) - 1) % WEEK]
  if (kind === 'coins' || kind === 'big') return { kind, coins: dayCoins(day, level) }
  return { kind }
}

/** The goods a gift may hold: those the farm has made (never a building material: those come as materials). */
const goodsOf = (made: readonly ProduceId[]) => made.filter((id) => SELLABLE.includes(id))
const pick = <T>(list: readonly T[], random: () => number) => list[Math.min(list.length - 1, Math.floor(random() * list.length))]

/** A day's gift, rolled on `random` (the farm's dice) as it is claimed: coins on a coin day; one building material
 *  (which of the six, on the dice); a few of one good the farm has made (a material while it has made none); the big
 *  one: its coins, a material and a good (or a second material). */
export function rollDay(day: number, level: number, made: readonly ProduceId[], random: () => number): Prize[] {
  const kind = WEEK_GIFTS[(Math.max(1, day) - 1) % WEEK]
  const goods = goodsOf(made)
  const material = (): Prize => ({ item: randomItem(random), n: dayMaterials(day, level) })
  const good = (): Prize => (goods.length ? { item: pick(goods, random), n: dayGoods(day, level) } : material())
  if (kind === 'coins') return [{ coins: dayCoins(day, level) }]
  if (kind === 'material') return [material()]
  if (kind === 'goods') return [good()]
  return [{ coins: dayCoins(day, level) }, material(), good()]
}

/** One day of the week's road on the card: taken (what it gave), today's, or still to come (what it will be). */
export interface DayView {
  day: number
  state: 'past' | 'today' | 'next'
  /** what it gave (past; null when not known) */
  got: Prize[] | null
  peek: Peek
}

/** What the daily gift's card shows (./DailyCard.tsx). */
export interface DailyView {
  /** today's gift waits to be claimed */
  ready: boolean
  /** the week's day of today's gift (or of the last one claimed, once it is taken) */
  day: number
  /** the streak as it stands now (before today's gift is claimed) */
  was: number
  /** the streak once today's is claimed (taken: as it stands) */
  streak: number
  /** today goes on after a missed day (the streak waited) */
  kept: boolean
  /** a new week after a break of two days or more */
  broke: boolean
  /** never claimed before */
  first: boolean
  /** the seven days of this week */
  week: DayView[]
  /** the week's day of tomorrow's gift (if tomorrow is played) */
  tomorrow: number
  /** the seconds (with their fraction) until the next gift opens: the start of the calendar day after today (today's
   *  waiting or taken) or, the clock moved back, after the last day claimed. Null: the view was made without the
   *  moment. */
  opensIn: number | null
}

/** The card's view of a record, today, at the farm's level; `now` (the device's clock at that moment, whose calendar
 *  day is `today`) gives how long until the next gift opens. */
export function dailyView(d: Daily, today: number, level: number, now?: number): DailyView {
  const s = dailyStatus(d, today)
  // the days taken this week, and today's place in it
  const day = s.ready ? s.day : weekDay(d.streak)
  const past = s.ready ? s.day - 1 : d.streak >= 1 ? day : 0
  const week: DayView[] = Array.from({ length: WEEK }, (_, i) => {
    const n = i + 1
    const state = n <= past ? 'past' : s.ready && n === s.day ? 'today' : 'next'
    const got = state === 'past' && !(s.ready && s.broke) ? (d.week[i]?.length ? d.week[i] : null) : null
    return { day: n, state, got, peek: peekDay(n, level) }
  })
  const streak = s.ready ? s.streak : d.streak
  return {
    ready: s.ready,
    day,
    was: s.ready ? (s.broke || s.first ? 0 : d.streak) : d.streak,
    streak,
    kept: s.ready && s.kept,
    broke: s.ready && s.broke,
    first: s.ready && s.first,
    week,
    tomorrow: weekDay(streak + 1),
    opensIn: now === undefined ? null : Math.max(0, (dayStart(Math.max(today, d.last) + 1) - now) / 1000),
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const whole = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi

/**
 * The daily gift as saved, read safe on `today`. Missing (a farm from before it): never claimed. Broken where it says
 * which day was taken: today counts as taken (no gift twice), its streak kept when it can be read. The week holds what
 * its days taken gave (never more days than the streak's place in its week; a day that cannot be read is taken, what
 * it gave not known).
 */
export function sanitizeDaily(raw: unknown, today: number): Daily {
  if (raw === undefined) return dailyFresh()
  if (!isObj(raw)) return { last: today, streak: 0, offered: -1, week: [] }
  const last = whole(raw.last, -1, LAST_DAY) ? raw.last : today
  const streak = last >= 0 && whole(raw.streak, 0, Number.MAX_SAFE_INTEGER) ? raw.streak : 0
  const offered = whole(raw.offered, -1, LAST_DAY) ? raw.offered : -1
  const days = streak >= 1 ? weekDay(streak) : 0
  const saved: unknown[] = Array.isArray(raw.week) ? raw.week.slice(0, days) : []
  const week = saved.map((e) => {
    const list = Array.isArray(e) ? e.slice(0, 3).map(savedPrize) : []
    return list.every((p) => p !== null) ? (list as Prize[]) : []
  })
  return { last, streak, offered, week }
}
