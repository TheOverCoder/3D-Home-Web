import { isItem, produceById, type ProduceId } from '../data'
import { CHANNELS, bookDays, type Channel, type Ledger } from '../ledger'

// What the computer's sales book shows (src/farm/ledger.ts keeps the record): the coins of each of the book's days by
// the place they came from, this week's against the week before, your own price index, and each good sold. Pure: the
// same book and day, the same view.

export interface BookDay {
  day: number
  /** the coins each place brought that day */
  coins: Record<Channel, number>
  total: number
  units: number
  /** what that day's goods brought against their fair price, ×100 (100: fair; materials not counted); null: none */
  index: number | null
}

export interface BookGood {
  good: ProduceId
  units: number
  coins: number
  /** coins a unit, and its fair price (the tables'; a material's: none) */
  per: number
  fair: number
  /** where it was sold, the place that brought the most coins first */
  places: Channel[]
}

export interface BookView {
  /** the book's days, the oldest first, today last */
  days: BookDay[]
  /** the coins of the last seven days (today among them) by place, and in all; and of the seven before */
  week: Record<Channel, number>
  weekTotal: number
  lastWeekTotal: number
  /** the last seven days' price index (as a day's); null: nothing but materials sold */
  index: number | null
  /** every good sold in the book's days, the most coins first */
  goods: BookGood[]
}

const zero = () => Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Record<Channel, number>

/** What goods brought against their fair price, ×100 and whole (null when nothing counts). */
const indexOf = (coins: number, fair: number) => (fair > 0 ? Math.round((coins / fair) * 100) : null)

export function bookView(book: Ledger, today: number): BookView {
  const all = bookDays(book, today)
  const goods = new Map<ProduceId, { units: number; coins: number; by: Record<Channel, number> }>()
  const days = all.map((d): BookDay & { fair: number; counted: number } => {
    const coins = zero()
    let units = 0
    let fair = 0
    let counted = 0
    for (const [good, places] of Object.entries(d.sold) as [ProduceId, Partial<Record<Channel, [number, number]>>][]) {
      const g = goods.get(good) ?? { units: 0, coins: 0, by: zero() }
      goods.set(good, g)
      for (const [ch, [u, c]] of Object.entries(places) as [Channel, [number, number]][]) {
        coins[ch] += c
        units += u
        g.units += u
        g.coins += c
        g.by[ch] += c
        if (!isItem(good)) {
          fair += produceById(good).price * u
          counted += c
        }
      }
    }
    const total = CHANNELS.reduce((n, c) => n + coins[c], 0)
    return { day: d.day, coins, total, units, index: indexOf(counted, fair), fair, counted }
  })
  const last = days.slice(-7)
  const week = zero()
  for (const d of last) for (const c of CHANNELS) week[c] += d.coins[c]
  return {
    days: days.map(({ day, coins, total, units, index }) => ({ day, coins, total, units, index })),
    week,
    weekTotal: last.reduce((n, d) => n + d.total, 0),
    lastWeekTotal: days.slice(-14, -7).reduce((n, d) => n + d.total, 0),
    index: indexOf(
      last.reduce((n, d) => n + d.counted, 0),
      last.reduce((n, d) => n + d.fair, 0),
    ),
    goods: [...goods.entries()]
      .map(([good, g]) => ({
        good,
        units: g.units,
        coins: g.coins,
        per: g.units > 0 ? g.coins / g.units : 0,
        fair: produceById(good).price,
        places: CHANNELS.filter((c) => g.by[c] > 0).sort((a, b) => g.by[b] - g.by[a]),
      }))
      .sort((a, b) => b.coins - a.coins),
  }
}
