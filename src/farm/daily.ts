// The daily gift (its card: src/farm/DailyCard.tsx): a gift for each day the farm is played, on a week of seven that
// grow — coins, a building material, more coins, a few of a good the farm makes, more coins, more materials — and the
// seventh the big one: coins, materials and goods together.
//
// The week is the season's week (update-v1/DECISIONS.md, N2; CONTRACTS.md §1.10): its day N is the season's day N,
// counted in days played (src/farm/calendar.ts, the long clock), so it waits through any absence and day 7's big gift
// is the season's last day. Nothing is lost by being away: a day played whose gift was not claimed joins the next claim
// (the road skips no day), and a return after two whole days or more brings a small welcome-back gift with the next one
// (BACK_GIFT: day 1's coins, the same however long the absence, so playing daily always pays more). The clock moved back
// gives nothing: days played never fall, and no day is claimed twice. Pure: the rules and the record kept in the save;
// src/farm/state/daily.ts gives what they say, on the farm's own dice. None of it is XP: a gift is not something done.

import { field, intIn, isObject, list, MOST } from '../lib/saved'
import { ITEMS, SELLABLE, produceById, type ProduceId } from './data'
import { dayStart } from './calendar'
import { GIFT_ODDS, savedPrize, type Prize } from './gifts'
import { sized } from './prize'
import { SEASON_DAYS, seasonAt } from './season'
import { randomItem } from './storage'

// (the calendar's days, from their home: src/farm/calendar.ts)
export { dayNumber, dayStart } from './calendar'

/** Days in a week of gifts: the season's days. */
export const WEEK = SEASON_DAYS
/** What each day of the week holds: coins, a building material, a few of a good the farm makes, or the big one. */
export const WEEK_GIFTS = ['coins', 'material', 'coins', 'goods', 'coins', 'material', 'big'] as const
export type DayKind = (typeof WEEK_GIFTS)[number]

/** The welcome-back gift (decision 8): a return this many calendar days after the day last played (two whole days or
 *  more missed) brings it, once, with the next claim; its coins are this share of the next level's (day 1's), never
 *  more for a longer absence. */
export const BACK_GIFT = { away: 3, share: 0.5 } as const

/** The most days played without a claim whose gifts join the next one (a week's days before today): nothing of the
 *  week is skipped, and a forgotten season does not pile up. */
export const OWED_MOST = WEEK - 1

/** The furthest calendar day a save may name (the year 10000): past it, a number is not a day. */
const LAST_DAY = 2_932_897

/** The daily gift as saved. `last` and `offered` are calendar days of the device (`dayNumber`); `at` is a day played
 *  (the farm's `played.days`, src/farm/calendar.ts). */
export interface Daily {
  /** the calendar day of the last gift claimed (-1: none yet; not `played`'s `last`, the day last played) */
  last: number
  /** the calendar day the gift last opened by itself (it does not again that day; -1: never) */
  offered: number
  /** the day played the last gift was claimed on (0: none, or not known: a farm from before the season's week) */
  at: number
  /** what each day of that claim's season week gave, from its day 1 (an empty list: taken, what it gave not known) */
  week: Prize[][]
  /** a welcome-back gift waits for the next claim */
  back: boolean
}

/** A farm that has never claimed one. */
export const dailyFresh = (): Daily => ({ last: -1, offered: -1, at: 0, week: [], back: false })

/** Where the long clock stands today, for the week: the day played today is (days played, today counted), the day
 *  played the farm's seasons began on (`farm.season.from`), and today's calendar day. */
export interface WeekClock {
  played: number
  from: number
  today: number
}

/**
 * [review, update-v1/CONTRACTS.md "If the user decides otherwise"] The week's day on a day played: the season's day and
 * which season it is (src/farm/season.ts). The one place the week's clock is chosen: counting the gifts claimed again
 * is a change here.
 */
export const dailyDay = (played: number, from: number): { day: number; ordinal: number; left: number } => {
  const s = seasonAt(played, from)
  return { day: s.day, ordinal: s.ordinal, left: s.left }
}

/** A wait as a digital clock shows it, counting down: hours, minutes and seconds, two digits each ("07:42:05"), and
 *  the whole days before them past a day ("2d 03:00:00"). A part of a second counts as a whole one (it is not over). */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-9))
  const days = Math.floor(s / 86_400)
  const hms = [Math.floor((s % 86_400) / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')
  return days ? `${days}d ${hms}` : hms
}

/** The day played of the last claim is known: a farm from before the season's week has none, and one naming a day not
 *  played yet (a save from elsewhere) is not believed. */
const known = (d: Daily, c: WeekClock) => d.at > 0 && d.at <= c.played

/** Whether today's gift is taken: claimed on today's day played, or on a calendar day no earlier than today. */
const taken = (d: Daily, c: WeekClock) => (known(d, c) && d.at >= c.played) || d.last >= c.today

/** The days played before today whose gifts were not claimed: from the season's first day or the day after the last
 *  claim, whichever is later, to yesterday's day played; the last OWED_MOST of them. None after a claim whose day
 *  played is not known (a farm from before the season's week, a save from elsewhere): nothing is given twice. */
export function owedDays(d: Daily, c: WeekClock): number[] {
  if (taken(d, c) || (d.last >= 0 && !known(d, c))) return []
  const first = Math.max(d.at + 1, Math.floor(c.from), c.played - OWED_MOST)
  const out: number[] = []
  for (let p = Math.max(1, first); p < c.played; p++) out.push(p)
  return out
}

/** The week record's season is today's: the last claim was on a day of this season. */
const sameSeason = (d: Daily, c: WeekClock) => known(d, c) && d.at >= c.from && dailyDay(d.at, c.from).ordinal === dailyDay(c.played, c.from).ordinal

/** Where the gift stands today: waiting (the week's day it is, the days played before it whose gifts join it, whether a
 *  welcome-back gift comes with it, whether it is the very first), or taken. */
export type DailyStatus = { ready: true; day: number; owed: number[]; back: boolean; first: boolean } | { ready: false }

export function dailyStatus(d: Daily, c: WeekClock): DailyStatus {
  if (taken(d, c)) return { ready: false }
  return { ready: true, day: dailyDay(c.played, c.from).day, owed: owedDays(d, c), back: d.back, first: d.last < 0 }
}

/** What one claim gives: today's gift, each day's that joins it (its day played and its week's day), and the
 *  welcome-back gift (none: empty). */
export interface ClaimPrizes {
  today: Prize[]
  owed: { played: number; day: number; prizes: Prize[] }[]
  back: Prize[]
}

/** Every prize of a claim, in one list: the days that waited, today's, the welcome-back gift. */
export const allPrizes = (p: ClaimPrizes): Prize[] => [...p.owed.flatMap((o) => o.prizes), ...p.today, ...p.back]

/** The record once today's gift is claimed (with the days that joined it), or null when there is none to claim today.
 *  The week holds this season's days: a claim in a new season starts it again (what the days before it of the season
 *  gave, joined to this claim, in their places). */
export function claimed(d: Daily, c: WeekClock, got: ClaimPrizes): Daily | null {
  const s = dailyStatus(d, c)
  if (!s.ready) return null
  const now = dailyDay(c.played, c.from).ordinal
  const week: Prize[][] = sameSeason(d, c) ? d.week.slice(0, WEEK) : []
  while (week.length < s.day) week.push([])
  for (const o of got.owed) if (dailyDay(o.played, c.from).ordinal === now) week[o.day - 1] = o.prizes
  week[s.day - 1] = got.today
  return { last: c.today, offered: d.offered, at: c.played, week: week.slice(0, s.day), back: false }
}

/** The record after a day played came after an absence of `away` calendar days: the welcome-back gift waits, on a farm
 *  that has claimed a gift before (a first gift has no week that waited). */
export const cameBackTo = (d: Daily, away: number): Daily => (away >= BACK_GIFT.away && d.last >= 0 && !d.back ? { ...d, back: true } : d)

/** The coins of a coin day (1, 3, 5: half the next level's coins, three quarters, all of them) and of the big one (7:
 *  twice): sized from the next level's own (src/farm/prize.ts), so a gift means as much at level 40 as at 4. */
export function dayCoins(day: number, level: number): number {
  const share = day === 1 ? 0.5 : day === 3 ? 0.75 : day === 5 ? 1 : day === WEEK ? 2 : 0
  return sized(share, level, 5)
}
/** The welcome-back gift's coins: BACK_GIFT's share of the next level's (day 1's). */
export const backCoins = (level: number) => sized(BACK_GIFT.share, level, 5)
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

const kindOf = (day: number): DayKind => WEEK_GIFTS[(Math.max(1, Math.floor(day)) - 1) % WEEK]

export function peekDay(day: number, level: number): Peek {
  const kind = kindOf(day)
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
  const kind = kindOf(day)
  const goods = goodsOf(made)
  const material = (): Prize => ({ item: randomItem(random), n: dayMaterials(day, level) })
  const good = (): Prize => (goods.length ? { item: pick(goods, random), n: dayGoods(day, level) } : material())
  if (kind === 'coins') return [{ coins: dayCoins(day, level) }]
  if (kind === 'material') return [material()]
  if (kind === 'goods') return [good()]
  return [{ coins: dayCoins(day, level) }, material(), good()]
}

/** Everything a claim today gives, rolled on `random` in a fixed order (the days that waited, oldest first; today's;
 *  the welcome-back gift's coins, which are not rolled), or null when there is none to claim. */
export function rollClaim(d: Daily, c: WeekClock, level: number, made: readonly ProduceId[], random: () => number): ClaimPrizes | null {
  const s = dailyStatus(d, c)
  if (!s.ready) return null
  const owed = s.owed.map((played) => {
    const day = dailyDay(played, c.from).day
    return { played, day, prizes: rollDay(day, level, made, random) }
  })
  return { today: rollDay(s.day, level, made, random), owed, back: s.back ? [{ coins: backCoins(level) }] : [] }
}

/** Many prizes as few: the coins together, each good together (several days' gifts in one claim). */
export function merged(prizes: readonly Prize[]): Prize[] {
  const out: Prize[] = []
  for (const p of prizes) {
    if ('coins' in p) {
      const c = out.find((q): q is { coins: number } => 'coins' in q)
      if (c) c.coins += p.coins
      else out.push({ coins: p.coins })
    } else if ('item' in p) {
      const g = out.find((q): q is { item: ProduceId; n: number } => 'item' in q && q.item === p.item)
      if (g) g.n += p.n
      else out.push({ item: p.item, n: p.n })
    } else out.push(p)
  }
  return out
}

// ───────────────────────────── the odds, on screen ─────────────────────────────

/** One thing a gift may hold, and how likely it is (1: always). */
export interface Chance {
  what: string
  share: number
}

/** A chance in words: "Always", "1 in 6", "55 %". */
export function chanceWords(share: number): string {
  if (!(share > 0)) return 'Never'
  if (share >= 1 - 1e-9) return 'Always'
  const one = 1 / share
  if (Math.abs(one - Math.round(one)) < 1e-6 && Math.round(one) > 2) return `1 in ${Math.round(one)}`
  return `${Math.round(share * 100)} %`
}

/** Each building material alike (src/farm/storage.ts, randomItem). */
const eachMaterial = (): Chance => ({ what: `Which material: each of ${ITEMS.length} alike`, share: 1 / ITEMS.length })
/** Each good the farm has made alike (a material while it has made none). */
const eachGood = (made: readonly ProduceId[]): Chance => {
  const goods = goodsOf(made)
  return goods.length
    ? { what: goods.length === 1 ? `Which good: your ${produceById(goods[0]).name.toLowerCase()}` : `Which good: each of your ${goods.length} alike`, share: 1 / goods.length }
    : eachMaterial()
}

/** What a day of the week holds and how likely each part is: its kind is the day's (always), only which material or
 *  which good is on the dice, each alike. */
export function dayOdds(day: number, level: number, made: readonly ProduceId[]): Chance[] {
  const kind = kindOf(day)
  const coins: Chance = { what: `${dayCoins(day, level).toLocaleString('en-US')} coins`, share: 1 }
  const material: Chance = { what: `${dayMaterials(day, level)} of a building material`, share: 1 }
  const good: Chance = goodsOf(made).length ? { what: `${dayGoods(day, level)} of a good your farm makes`, share: 1 } : material
  if (kind === 'coins') return [coins]
  if (kind === 'material') return [material, eachMaterial()]
  if (kind === 'goods') return [good, eachGood(made)]
  return [coins, material, eachMaterial(), good, eachGood(made)]
}

/** What a level's gift box holds and how likely (src/farm/gifts.ts, GIFT_ODDS): coins, a building material, or goods the
 *  farm makes (a material while it makes none: with `made` given and empty, the materials' share holds both). */
export function boxOdds(made?: readonly ProduceId[]): Chance[] {
  const goods = !made || goodsOf(made).length > 0
  const rest = 1 - GIFT_ODDS.coins - GIFT_ODDS.material
  return [{ what: 'Coins', share: GIFT_ODDS.coins }, { what: 'A building material', share: GIFT_ODDS.material + (goods ? 0 : rest) }, ...(goods ? [{ what: 'Goods from your farm', share: rest }] : [])]
}

// ───────────────────────────── the card ─────────────────────────────

/** One day of the week's road on the card: taken (what it gave), one whose gift waited and joins today's, today's, or
 *  still to come (what it will be). */
export interface DayView {
  day: number
  state: 'past' | 'owed' | 'today' | 'next'
  /** what it gave (past; null when not known) */
  got: Prize[] | null
  peek: Peek
}

/** What the daily gift's card shows (./DailyCard.tsx). */
export interface DailyView {
  /** today's gift waits to be claimed */
  ready: boolean
  /** the week's day of today's gift (the season's day) */
  day: number
  /** days played, today counted ("Day 23 on the farm"): it never falls */
  days: number
  /** never claimed before */
  first: boolean
  /** the welcome-back gift's coins, waiting to come with today's (null: none) */
  back: number | null
  /** how many days played before today had gifts not claimed, which join today's */
  owed: number
  /** the days of the week after today (0: today is its last, the big gift's) */
  left: number
  /** the seven days of this week */
  week: DayView[]
  /** the week's day of the next day played's gift */
  tomorrow: number
  /** what today's gift holds and how likely (the "?" on the card) */
  odds: Chance[]
  /** the seconds (with their fraction) until the next gift opens: the start of the calendar day after today (today's
   *  waiting or taken) or, the clock moved back, after the last day claimed. Null: the view was made without the
   *  moment. */
  opensIn: number | null
}

/** The card's view of a record on today's clock, at the farm's level, for a farm that has made `made`; `now` (the
 *  device's clock at that moment, whose calendar day is `c.today`) gives how long until the next gift opens. */
export function dailyView(d: Daily, c: WeekClock, level: number, made: readonly ProduceId[] = [], now?: number): DailyView {
  const s = dailyStatus(d, c)
  const { day, left } = dailyDay(c.played, c.from)
  const owed = s.ready ? s.owed : []
  const ownWeek = sameSeason(d, c)
  const week: DayView[] = Array.from({ length: WEEK }, (_, i) => {
    const n = i + 1
    const peek = peekDay(n, level)
    if (n > day) return { day: n, state: 'next', got: null, peek }
    if (n === day && s.ready) return { day: n, state: 'today', got: null, peek }
    const played = c.played - (day - n)
    if (s.ready && owed.includes(played)) return { day: n, state: 'owed', got: null, peek }
    const gave = ownWeek ? d.week[i] : undefined
    return { day: n, state: 'past', got: gave?.length ? gave : null, peek }
  })
  return {
    ready: s.ready,
    day,
    days: Math.max(1, Math.floor(c.played)),
    first: s.ready && s.first,
    back: s.ready && s.back ? backCoins(level) : null,
    owed: owed.length,
    left,
    week,
    tomorrow: (day % WEEK) + 1,
    odds: dayOdds(day, level, made),
    opensIn: now === undefined ? null : Math.max(0, (dayStart(Math.max(c.today, d.last) + 1) - now) / 1000),
  }
}

/**
 * The daily gift as saved, read safe on `today` (a calendar day). Missing (a farm from before it): never claimed. Broken
 * where it says which day was taken: today counts as taken (no gift twice). A farm from before the season's week (its
 * record has no `at`): its last claim's day played is not known, so no day before today joins the next claim, and its
 * week starts again with the season. The week holds what its days taken gave (a day that cannot be read is taken, what
 * it gave not known).
 */
export function sanitizeDaily(raw: unknown, today: number): Daily {
  if (raw === undefined) return dailyFresh()
  if (!isObject(raw)) return { last: today, offered: -1, at: 0, week: [], back: false }
  const last = intIn(raw.last, -1, LAST_DAY) ? raw.last : today
  const offered = intIn(raw.offered, -1, LAST_DAY) ? raw.offered : -1
  const at = last >= 0 && intIn(raw.at, 1, MOST) ? raw.at : 0
  const week = at
    ? list(raw.week)
        .slice(0, WEEK)
        .map((e) => {
          const prizes = list(e).slice(0, 3).map(savedPrize)
          return prizes.every((p) => p !== null) ? (prizes as Prize[]) : []
        })
    : []
  return { last, offered, at, week, back: last >= 0 && field(raw, 'back') === true }
}
