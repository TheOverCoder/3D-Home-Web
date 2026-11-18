import { PRODUCE, SELLABLE, isItem, type ProduceId } from './data'

// The farm's sales book: what was sold on each of the last LEDGER_DAYS days of the device's calendar (a day number of
// src/farm/daily.ts), good by good and place by place — how many, and for how many coins. It is a record only: no rule
// of the game reads it to decide anything; the house's computer shows it (src/farm/computer/bookView.ts). Pure: a book
// in, a new book out.

/** Where a good was sold: to a buyer at the gate, in an order, to the market's manager, off your shop's shelves, or to
 *  the contractor (who buys only the building materials). */
export type Channel = 'gate' | 'order' | 'manager' | 'shop' | 'contractor'
export const CHANNELS: readonly Channel[] = ['gate', 'order', 'manager', 'shop', 'contractor']

/** How many days the book keeps, today among them: two weeks, so a week can be set against the week before. */
export const LEDGER_DAYS = 14

/** Units sold, and the coins they brought. */
export type Tally = [units: number, coins: number]

/** One day: its calendar day, and for each good sold on it what each place took. */
export interface LedgerDay {
  day: number
  sold: Partial<Record<ProduceId, Partial<Record<Channel, Tally>>>>
}

/** The book: its days, the oldest first, each once and none of them empty. */
export interface Ledger {
  days: LedgerDay[]
}

export const freshLedger = (): Ledger => ({ days: [] })

const GOODS: readonly string[] = PRODUCE.map((p) => p.id)
const isGood = (v: unknown): v is ProduceId => typeof v === 'string' && GOODS.includes(v)
const isChannel = (v: unknown): v is Channel => typeof v === 'string' && (CHANNELS as readonly string[]).includes(v)
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** A good can be sold there: a building material only to the contractor, every other good anywhere but to him. */
export const soldAt = (good: ProduceId, channel: Channel) => (channel === 'contractor' ? isItem(good) : SELLABLE.includes(good))

/** A day the book keeps on `today`: today, or one of the LEDGER_DAYS − 1 before it. */
const kept = (day: number, today: number) => day <= today && day > today - LEDGER_DAYS

const MOST = Number.MAX_SAFE_INTEGER
/** A count as the book keeps it: a whole number from 0 (anything else: 0), up to the last one that still counts. */
const whole = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(MOST, Math.floor(v)) : 0)

/** The book on `today`: the days too old for it left out, and any after today (a clock moved back). The same book
 *  when nothing goes. */
export function trimLedger(book: Ledger, today: number): Ledger {
  const days = book.days.filter((d) => kept(d.day, today))
  return days.length === book.days.length ? book : { days }
}

/** Adds a tally into a day being built (it is the caller's own). */
function addInto(d: LedgerDay, good: ProduceId, channel: Channel, units: number, coins: number) {
  const places = (d.sold[good] ??= {})
  const [u, c] = places[channel] ?? [0, 0]
  places[channel] = [Math.min(MOST, u + units), Math.min(MOST, c + coins)]
}

/** A copy of a day, its tallies its own. */
const copyDay = (d: LedgerDay): LedgerDay => ({
  day: d.day,
  sold: Object.fromEntries(Object.entries(d.sold).map(([good, places]) => [good, Object.fromEntries(Object.entries(places ?? {}).map(([ch, t]) => [ch, [...(t as Tally)]]))])),
})

/**
 * A sale written in: `units` of `good` sold at `channel` for `coins` on `day` (the device's calendar day: today). The
 * book is kept to that day (the oldest days go). The same book for a sale of nothing, of a good that is not one, on a
 * day that is not a whole number, or one that cannot happen there (a material at the gate, a crop to the contractor).
 */
export function noteSale(book: Ledger, day: number, channel: Channel, good: ProduceId, units: number, coins: number): Ledger {
  const u = whole(units)
  const c = whole(coins)
  if (!Number.isInteger(day) || !isChannel(channel) || !isGood(good) || !soldAt(good, channel) || (u === 0 && c === 0)) return book
  const days = trimLedger(book, day).days.slice()
  const at = days.findIndex((d) => d.day === day)
  const next = at >= 0 ? copyDay(days[at]) : { day, sold: {} }
  addInto(next, good, channel, u, c)
  if (at >= 0) days[at] = next
  else {
    days.push(next)
    days.sort((a, b) => a.day - b.day)
  }
  return { days }
}

/**
 * The book as saved, made safe on `today`: only the days it keeps (see trimLedger), each once (a day saved twice adds
 * up); only known goods, at places they can be sold, each tally two whole numbers from 0; a day with nothing sold left
 * out. Missing or unreadable (a farm from before the book): an empty book.
 */
export function sanitizeLedger(raw: unknown, today: number): Ledger {
  if (!isObj(raw) || !Array.isArray(raw.days) || !Number.isInteger(today)) return freshLedger()
  const byDay = new Map<number, LedgerDay>()
  for (const d of raw.days) {
    if (!isObj(d) || !Number.isInteger(d.day) || !kept(d.day as number, today) || !isObj(d.sold)) continue
    for (const good of Object.keys(d.sold)) {
      const places = d.sold[good]
      if (!isGood(good) || !isObj(places)) continue
      for (const channel of CHANNELS) {
        const t = Object.hasOwn(places, channel) ? places[channel] : undefined
        if (!soldAt(good, channel) || !Array.isArray(t)) continue
        const u = whole(t[0])
        const c = whole(t[1])
        if (u === 0 && c === 0) continue
        const day = d.day as number
        const into = byDay.get(day) ?? { day, sold: {} }
        byDay.set(day, into)
        addInto(into, good, channel, u, c)
      }
    }
  }
  return { days: [...byDay.values()].sort((a, b) => a.day - b.day) }
}

/** Every day the book keeps on `today`, the oldest first and today last: LEDGER_DAYS of them, those with nothing sold
 *  empty. */
export function bookDays(book: Ledger, today: number): LedgerDay[] {
  const have = new Map(book.days.map((d) => [d.day, d]))
  return Array.from({ length: LEDGER_DAYS }, (_, k) => {
    const day = today - (LEDGER_DAYS - 1) + k
    return have.get(day) ?? { day, sold: {} }
  })
}

/** What a good brought a unit on each of the book's days (bookDays), wherever it was sold; null on a day it was not. */
export function perUnit(book: Ledger, good: ProduceId, today: number): (number | null)[] {
  return bookDays(book, today).map((d) => {
    let units = 0
    let coins = 0
    for (const t of Object.values(d.sold[good] ?? {})) {
      units += t[0]
      coins += t[1]
    }
    return units > 0 ? coins / units : null
  })
}
