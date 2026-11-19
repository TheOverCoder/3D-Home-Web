import type { ProduceId } from '../data'
import { noteSale, shareOut, trimLedger, type Channel, type Ledger } from '../ledger'
import { unitPrice, type Shelf } from '../market'
import type { Order } from '../orders'
import { priceOf } from '../prices'
import { dayNumber } from '../daily'
import { calendarDay, calendarTime, farm } from './core'

// The farm's sales book (src/farm/ledger.ts holds its rules): every sale writes itself in, once, in the module that
// pays it — a buyer at the gate (buyers.ts), an order sent (orders.ts), the manager and your shop's shelves
// (market.ts), the contractor (contractor.ts) — on the day of the device's calendar it is made. A decline writes
// nothing. The book decides nothing in the game; the house's computer reads it (src/farm/computer/bookView.ts).

declare module './core' {
  interface FarmData {
    /** the sales book (src/farm/ledger.ts): what was sold on each of the last two weeks' days, where, and for how much */
    ledger: Ledger
  }
}

/** A sale written into the book: `units` of `good` sold at `channel` for `coins`, today (a time away's step: on its own
 *  day). The book keeps only the two weeks up to the device's today, so a sale of a time away older than that is not
 *  kept (a save from long ago, its shop selling while away). */
export function sold(channel: Channel, good: ProduceId, units: number, coins: number) {
  farm.ledger = trimLedger(noteSale(farm.ledger, calendarDay(), channel, good, units, coins), dayNumber(calendarTime()))
}

/** The book as it stands today: the days it keeps (two weeks up to today). */
export const ledgerNow = (): Ledger => trimLedger(farm.ledger, calendarDay())

/** An order's pay as the book takes it, line by line: each good, its units and its share of the coins by what the
 *  line is worth now (as the lucky draw shares out a raise, src/farm/state/day.ts), whole coins that add up to the
 *  pay. */
export function orderShares(o: Order): { good: ProduceId; units: number; coins: number }[] {
  const coins = shareOut(
    o.coins,
    o.lines.map((l) => priceOf(l.good) * l.want),
  )
  return o.lines.map((l, k) => ({ good: l.good, units: l.want, coins: coins[k] }))
}

/** What a shopper took off your shelves (`taken`: how many from each place, as rollShopper gives it), as the book
 *  takes it: each place's good, the units and their coins at its price — together what they paid into the till. */
export function shelfSales(shelves: readonly Shelf[], taken: readonly number[]): { good: ProduceId; units: number; coins: number }[] {
  return shelves.flatMap((s, k) => (taken[k] > 0 && s.good ? [{ good: s.good, units: taken[k], coins: taken[k] * unitPrice(priceOf(s.good), s.pct) }] : []))
}
