import type { ArtId } from '../../ui/art'
import type { Chance } from '../daily'
import type { ProduceId } from '../data'
import { EVENTS, LUCKY_GOODS, activeAt, canDraw, drawPool, luckyGoods, occurrenceOn, upcoming, type EventId, type EventsRecord, type Occurrence } from '../events'
import { eventLook, type SeasonId, type SeasonView } from '../season'

// What the farm news shows (./NewsCard.tsx draws it; ../NewsPanel.tsx makes it from the farm, the lab's board from
// sample records): the date, the events on now with until when and when they come back (kind words: an invitation, never
// a ticking loss), the lucky draw (to draw, or its two goods, and its odds), and the next time of every other event with
// its day and hours. Pure: the same moment and record, the same words.

export interface NewsItem {
  id: EventId
  key: string
  name: string
  say: string
  chip: string
  art: ArtId
  /** its hours on its day: "All day", "16:00 – midnight" */
  hours: string
}

export interface NowItem extends NewsItem {
  /** when it ends: "Until midnight", "Until 20:00" */
  until: string
  /** when it comes again: "Back next Wednesday", "Back on Sunday", "Back tomorrow" */
  back: string
  /** not shown in the news before it opened */
  fresh: boolean
}

export interface SoonItem extends NewsItem {
  /** its day, said from today: "Today", "Tomorrow", "In 3 days" */
  day: string
  /** a calendar leaf: the weekday ("Sat") and the date (21) */
  weekday: string
  date: number
}

export interface LuckyView {
  /** the goods drawn, or null while the draw waits */
  goods: ProduceId[] | null
  /** what a draw picks from: the reels' pictures */
  pool: ProduceId[]
  /** "midnight" */
  until: string
  /** what it can draw and how likely (the "?"): two of the goods, each alike */
  odds: Chance[]
}

export interface NewsView {
  /** the events are on (off where the game is tested) */
  on: boolean
  /** the masthead's date: "Saturday 21 November" */
  date: string
  /** the events on now, the lucky draw first */
  now: NowItem[]
  /** the next time of each other event, the soonest first */
  soon: SoonItem[]
  /** the lucky draw, while it is its day */
  lucky: LuckyView | null
  /** the season the farm is in (mission 10 c7: "Spring · day 3 of 7", its crops, "Next: summer"); none while the
   *  year is quiet or waits for the first steps */
  season: SeasonView | null
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** An hour as a clock says it: 8 → "8:00", 24 → "midnight". */
export const hourWords = (h: number) => (h >= 24 ? 'midnight' : `${h}:00`)
/** An event's hours on its day. */
export const hoursOf = (id: EventId) => {
  const e = EVENTS[id]
  return e.from === 0 && e.to === 24 ? 'All day' : `${hourWords(e.from)} – ${hourWords(e.to)}`
}

/** When an event on now comes again, from the day of `ms`: "Back tomorrow", "Back on Sunday", "Back next Wednesday" (a
 *  week on). */
export function backWords(id: EventId, ms: number): string {
  for (let k = 1; k <= 7; k++) {
    const o = occurrenceOn(id, ms, k)
    if (!o) continue
    const day = DAYS[new Date(o.start).getDay()]
    return k === 1 ? 'Back tomorrow' : k === 7 ? `Back next ${day}` : `Back on ${day}`
  }
  return ''
}

/** What a lucky draw can give and how likely: two of the goods a buyer asks for (those the farm knows), each alike. */
export function luckyOdds(pool: readonly ProduceId[]): Chance[] {
  const n = drawPool(pool).length
  if (!n) return []
  return [
    { what: `${Math.min(LUCKY_GOODS, n)} of the ${n} goods a buyer asks for`, share: 1 },
    { what: 'Each good', share: Math.min(1, LUCKY_GOODS / n) },
  ]
}

/** Whole local days from the day of `a` to the day of `b`. */
const daysBetween = (a: number, b: number) => {
  const day = (ms: number) => {
    const d = new Date(ms)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
  }
  return Math.round(day(b) - day(a))
}
const dayWords = (now: number, start: number) => {
  const n = daysBetween(now, start)
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`
}

/** An event as the news tells it: under the season's own name and picture while the farm's year plays (mission 10 c7:
 *  the harvest festival is the Blossom festival in spring), else its own. */
const itemIn = (o: Occurrence, season: SeasonId | null): NewsItem => {
  const e = EVENTS[o.id]
  const look = season ? eventLook(o.id, season) : { name: e.name, pic: e.art }
  return { id: o.id, key: o.key, name: look.name, say: e.say, chip: e.chip, art: look.pic as NewsItem['art'], hours: hoursOf(o.id) }
}

/** The masthead's date of a moment. */
export function dateWords(ms: number): string {
  const d = new Date(ms)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/**
 * The news at `ms` (null: the events are off — nothing on, nothing coming) for a farm's record; `pool` the goods a draw
 * picks from, `seenBefore` the events it had shown when it opened (what is new is told as new while it is open).
 */
export function newsView(ms: number | null, rec: EventsRecord, pool: ProduceId[], seenBefore: readonly string[] = rec.seen, season: SeasonView | null = null): NewsView {
  if (ms === null) return { on: false, date: dateWords(Date.now()), now: [], soon: [], lucky: null, season }
  const item = (o: Occurrence) => itemIn(o, season?.id ?? null)
  const on = activeAt(ms)
  const now = on
    .map((o): NowItem => ({
      ...item(o),
      until: `Until ${hourWords(EVENTS[o.id].to)}`,
      back: backWords(o.id, ms),
      fresh: !seenBefore.includes(o.key),
    }))
    .sort((a, b) => (a.id === 'lucky' ? -1 : b.id === 'lucky' ? 1 : 0))
  const soon = upcoming(ms)
    .filter((o) => !on.some((x) => x.id === o.id))
    .map((o): SoonItem => {
      const d = new Date(o.start)
      return { ...item(o), day: dayWords(ms, o.start), weekday: DAYS[d.getDay()].slice(0, 3), date: d.getDate() }
    })
  const lucky = on.some((o) => o.id === 'lucky') ? { goods: canDraw(rec, ms) ? null : luckyGoods(rec, ms), pool, until: hourWords(EVENTS.lucky.to), odds: luckyOdds(pool) } : null
  return { on: true, date: dateWords(ms), now, soon, lucky, season }
}
