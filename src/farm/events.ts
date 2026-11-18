// The farm's week (the farm news, src/farm/news): events that come back on the same days every week, by the device's
// own calendar — the weekday each falls on and its hours, local time. Each is a row of EVENTS (as the hours of who keeps
// hours are rows of HOURS): its name, what it does, its picture, its days and hours, and what it changes. The farm asks
// here what is on at a moment (`activeAt`), and each rule asks what that changes then: the lucky draw's two goods sell for
// double wherever they are sold (src/farm/prices.ts), a buyer's or an order's gift comes twice, buyers come to the gate
// twice as often, crops grow and machines work twice as fast. The one a player does is the lucky draw: one draw on its
// day, two goods on the farm's dice, kept in the save with the events the news has shown (`EventsRecord`). None gives XP.
// Pure: src/farm/state.ts keeps the record, judges each moment (each step of a time away its own) and gives what it says.

import type { ArtId } from '../ui/art'
import { isObject } from '../lib/saved'
import { SELLABLE, type ProduceId } from './data'

export type EventId = 'market' | 'harvest' | 'gifts' | 'rush' | 'lucky'
/** What an event changes: the drawn goods' price, the gifts a sale brings, how often buyers come, how fast crops grow,
 *  how fast machines work. */
export type Boost = 'draw' | 'gifts' | 'buyers' | 'crops' | 'machines'

export interface EventDef {
  name: string
  /** what it does, in one line */
  say: string
  /** the same in a few words, on a chip */
  chip: string
  art: ArtId
  /** the weekdays it falls on, by the device's calendar: 0 Sunday … 6 Saturday */
  days: readonly number[]
  /** its hours on those days, local time, whole hours: from 0–23 to 1–24 (24: midnight), within the day */
  from: number
  to: number
  boost: Boost
  /** how much it multiplies */
  times: number
}

/** The week: Monday's and Sunday's market, Wednesday's harvest festival, Thursday's gifts, Friday evening's machine
 *  rush, Saturday's lucky draw (Tuesday is a quiet day: the news tells what is coming). */
export const EVENTS = {
  market: { name: 'Market day', say: 'Buyers come to the gate twice as often.', chip: '×2 buyers', art: 'people-queue', days: [1, 0], from: 8, to: 20, boost: 'buyers', times: 2 },
  harvest: { name: 'Harvest festival', say: 'Every crop grows twice as fast.', chip: '×2 growth', art: 'ear-of-corn', days: [3], from: 0, to: 24, boost: 'crops', times: 2 },
  gifts: { name: 'Gift day', say: 'Every gift a buyer or an order brings comes twice.', chip: '×2 gifts', art: 'wrapped-gift', days: [4], from: 0, to: 24, boost: 'gifts', times: 2 },
  rush: { name: 'Machine rush', say: 'The mill, the loom and the oven work twice as fast.', chip: '×2 machines', art: 'high-voltage', days: [5], from: 16, to: 24, boost: 'machines', times: 2 },
  lucky: { name: 'Lucky draw', say: 'Draw two goods: they sell for double all day.', chip: '×2 prices', art: 'four-leaf-clover', days: [6], from: 0, to: 24, boost: 'draw', times: 2 },
} as const satisfies Record<EventId, EventDef>
export const EVENT_IDS = Object.keys(EVENTS) as EventId[]
export const eventById = (id: EventId): EventDef => EVENTS[id]

/** How many goods a lucky draw gives. */
export const LUCKY_GOODS = 2
/** How many events the news remembers having shown (a week's are fewer). */
export const SEEN_KEPT = 16

/** One time an event is on: from `start` to `end` (ms), its key the event and the date it begins. */
export interface Occurrence {
  id: EventId
  key: string
  start: number
  end: number
}

const pad = (n: number) => String(n).padStart(2, '0')
/** The device's local date of a moment: "2026-11-21". */
export const dateKey = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The event's time on the local day `k` days after the one of `ms`, or null when it does not fall on that weekday. (The
 *  day is counted from its noon: a day of a clock change is still one day.) */
export function occurrenceOn(id: EventId, ms: number, k = 0): Occurrence | null {
  const base = new Date(ms)
  const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + k, 12)
  const def = EVENTS[id]
  if (!(def.days as readonly number[]).includes(day.getDay())) return null
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), def.from).getTime()
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), def.to).getTime()
  return { id, key: `${id}@${dateKey(start)}`, start, end }
}

// the edges are on whole hours: what is on is the same for a whole minute (asked every frame)
let memo: { minute: number; list: Occurrence[] } | null = null

/** The events on at a moment (ms, the device's clock), in the order of EVENTS. */
export function activeAt(ms: number): Occurrence[] {
  const minute = Math.floor(ms / 60_000)
  if (memo?.minute === minute) return memo.list
  const list: Occurrence[] = []
  for (const id of EVENT_IDS) {
    const o = occurrenceOn(id, ms)
    if (o && ms >= o.start && ms < o.end) list.push(o)
  }
  memo = { minute, list }
  return list
}

/** The next time of each event that is not on now, within the week ahead, the soonest first. */
export function upcoming(ms: number): Occurrence[] {
  const out: Occurrence[] = []
  for (const id of EVENT_IDS) {
    for (let k = 0; k <= 7; k++) {
      const o = occurrenceOn(id, ms, k)
      if (o && o.start > ms) {
        out.push(o)
        break
      }
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/** How much the events on at `ms` multiply something (1 with none on; null: the events are off). */
export function speedAt(boost: Boost, ms: number | null): number {
  if (ms === null) return 1
  let k = 1
  for (const o of activeAt(ms)) if (EVENTS[o.id].boost === boost) k *= EVENTS[o.id].times
  return k
}

/** What the farm keeps of its events: the lucky draw of its day (the day it was drawn on, and the goods), and the
 *  events the news has shown (their keys, the last SEEN_KEPT). */
export interface EventsRecord {
  draw: { day: string; goods: ProduceId[] } | null
  seen: string[]
}
export const freshEvents = (): EventsRecord => ({ draw: null, seen: [] })

/** The lucky draw's time on now, or null. */
export const luckyNow = (ms: number | null) => (ms === null ? null : (activeAt(ms).find((o) => o.id === 'lucky') ?? null))

/** The goods the lucky draw makes dearer at `ms`: those drawn on this lucky day, while it lasts. */
export function luckyGoods(rec: EventsRecord, ms: number | null): ProduceId[] {
  const o = luckyNow(ms)
  return o && rec.draw && rec.draw.day === dateKey(o.start) ? rec.draw.goods : []
}

/** What a good's price is multiplied by at `ms`: double for a good of the day's lucky draw. */
export const priceFactor = (good: ProduceId, rec: EventsRecord, ms: number | null) => (luckyGoods(rec, ms).includes(good) ? EVENTS.lucky.times : 1)

/** A draw can be made: it is the lucky draw's day, and nothing was drawn on it yet. */
export function canDraw(rec: EventsRecord, ms: number | null): boolean {
  const o = luckyNow(ms)
  return !!o && rec.draw?.day !== dateKey(o.start)
}

/** The goods a draw picks from: those of the pool a buyer could ask for, in the game's order (so the same dice pick the
 *  same goods). */
export const drawPool = (pool: readonly ProduceId[]) => SELLABLE.filter((g) => pool.includes(g))

/** Two goods of the pool (all of it when it has fewer), each once, on `random` (the farm's dice). */
export function drawGoods(pool: readonly ProduceId[], random: () => number): ProduceId[] {
  const left = drawPool(pool)
  const out: ProduceId[] = []
  while (out.length < LUCKY_GOODS && left.length) out.push(left.splice(Math.min(left.length - 1, Math.floor(random() * left.length)), 1)[0])
  return out
}

/** The events on at `ms` marked as shown (the news was open): the keys kept, the newest last. */
export function markSeen(rec: EventsRecord, ms: number | null): string[] {
  if (ms === null) return rec.seen
  const add = activeAt(ms)
    .map((o) => o.key)
    .filter((k) => !rec.seen.includes(k))
  return add.length ? [...rec.seen, ...add].slice(-SEEN_KEPT) : rec.seen
}

/** What waits in the news (the badge on its button): each event on that it has not shown, and the lucky draw while it
 *  has not been drawn (once, shown or not). */
export function newsWaiting(rec: EventsRecord, ms: number | null): number {
  if (ms === null) return 0
  const keys = new Set(
    activeAt(ms)
      .map((o) => o.key)
      .filter((k) => !rec.seen.includes(k)),
  )
  const lucky = luckyNow(ms)
  if (lucky && canDraw(rec, ms)) keys.add(lucky.key)
  return keys.size
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const KEY = new RegExp(`^(${EVENT_IDS.join('|')})@\\d{4}-\\d{2}-\\d{2}$`)

/** The record as saved, made safe: a draw on a date of one or two different goods a buyer could ask for (others left
 *  out); the keys of events shown (each once, the last SEEN_KEPT). Missing or unreadable (a farm from before the
 *  events): nothing drawn, nothing shown. */
export function sanitizeEvents(raw: unknown): EventsRecord {
  if (!isObject(raw)) return freshEvents()
  const d = raw.draw
  let draw: EventsRecord['draw'] = null
  if (isObject(d) && typeof d.day === 'string' && DAY.test(d.day) && Array.isArray(d.goods)) {
    const goods = [...new Set(d.goods)].filter((g): g is ProduceId => SELLABLE.includes(g as ProduceId)).slice(0, LUCKY_GOODS)
    if (goods.length) draw = { day: d.day, goods }
  }
  const seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((k): k is string => typeof k === 'string' && KEY.test(k)))].slice(-SEEN_KEPT) : []
  return { draw, seen }
}
