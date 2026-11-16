import type { ArtId } from '../../ui/art'
import type { ProduceId } from '../data'
import { EVENTS, activeAt, canDraw, luckyGoods, upcoming, type EventId, type EventsRecord, type Occurrence } from '../events'

// What the farm news shows (./NewsCard.tsx draws it; ../NewsPanel.tsx makes it from the farm, the lab's board from
// sample records): the date, the events on now with how long they have left, the lucky draw (to draw, or its two
// goods), and the next time of every other event with its day and hours. Pure: the same moment and record, the same
// words.

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
  /** how long it has left: "5 h 12 min left" */
  left: string
  /** the share of its time still to come (1 as it begins) */
  share: number
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

/** The time left, to the minute: "5 h 12 min", "40 min", "1 min". */
export function leftWords(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
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

const item = (o: Occurrence): NewsItem => {
  const e = EVENTS[o.id]
  return { id: o.id, key: o.key, name: e.name, say: e.say, chip: e.chip, art: e.art, hours: hoursOf(o.id) }
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
export function newsView(ms: number | null, rec: EventsRecord, pool: ProduceId[], seenBefore: readonly string[] = rec.seen): NewsView {
  if (ms === null) return { on: false, date: dateWords(Date.now()), now: [], soon: [], lucky: null }
  const on = activeAt(ms)
  const now = on
    .map((o): NowItem => ({
      ...item(o),
      until: `Until ${hourWords(EVENTS[o.id].to)}`,
      left: `${leftWords(o.end - ms)} left`,
      share: Math.min(1, Math.max(0, (o.end - ms) / (o.end - o.start))),
      fresh: !seenBefore.includes(o.key),
    }))
    .sort((a, b) => (a.id === 'lucky' ? -1 : b.id === 'lucky' ? 1 : 0))
  const soon = upcoming(ms)
    .filter((o) => !on.some((x) => x.id === o.id))
    .map((o): SoonItem => {
      const d = new Date(o.start)
      return { ...item(o), day: dayWords(ms, o.start), weekday: DAYS[d.getDay()].slice(0, 3), date: d.getDate() }
    })
  const lucky = on.some((o) => o.id === 'lucky') ? { goods: canDraw(rec, ms) ? null : luckyGoods(rec, ms), pool, until: hourWords(EVENTS.lucky.to) } : null
  return { on: true, date: dateWords(ms), now, soon, lucky }
}
