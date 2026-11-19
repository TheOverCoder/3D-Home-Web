import type { NeighbourId } from '../data/people'
import { ITEM_ODDS, ORDERS, SELLABLE, produceById, type ProduceId } from './data'
import type { ChapterId } from './people/chapters'
import { priceOf } from './prices'

// The orders that come in on the office's computer, as data: what one asks for, what it pays, and how many crates it
// fills on the tractor. src/farm/state.ts keeps the board (`farm.orders`) and moves the goods; this only makes and
// reads orders, so the tests reach it without a farm.

/** One good an order asks for: how many it wants, and how many have been put in so far (they have left the silo or
 *  the barn, and go back there if the order is declined). */
export interface OrderLine {
  good: ProduceId
  want: number
  have: number
}

export interface Order {
  /** its key while the page is open (not saved) */
  id: number
  lines: OrderLine[]
  /** what it pays as it is sent */
  coins: number
  /** it brings a surprise (a building material) as it is sent */
  surprise: boolean
  /** a neighbour's (src/data/people.ts): their portrait and name at its head, and their friendship grows as it is sent;
   *  none: a stranger's */
  from?: NeighbourId
  /** a chapter's request (src/farm/people/chapters.ts): pinned above the board's places, with no clock and no ×; never
   *  in a place of the board */
  chapter?: ChapterId
}

/** A place on the board: an order, or the seconds until a new one comes (after one was declined). */
export type OrderSlot = { order: Order } | { wait: number }

let seq = 0
/** A key for an order, new each time. */
export const orderKey = () => ++seq

/** How many of a good an order may ask for: up to half as many again as a buyer would. */
export const mostAsked = (good: ProduceId) => Math.max(1, Math.round(produceById(good).maxAsk * 1.5))

/** What an order of these goods pays: a quarter over their fair price (src/farm/prices.ts: more for what a machine of
 *  a higher level makes). */
export const orderPay = (lines: { good: ProduceId; want: number }[]) => Math.max(1, Math.round(lines.reduce((sum, l) => sum + priceOf(l.good) * l.want, 0) * ORDERS.markup))

/** How many kinds of goods an order may ask for grows with the farm's level (farm-games.md P5a): `from` at first, one
 *  more every `every` levels, never more than ORDERS.kinds (nine). */
export const ORDER_KINDS = { from: 3, every: 6 } as const
export const orderKinds = (level: number) => Math.min(ORDERS.kinds, ORDER_KINDS.from + Math.floor(Math.max(1, level) / ORDER_KINDS.every))

/**
 * A new order, from the goods the farm grows and makes (`known`, never a building material): one to as many kinds of
 * them as the farm's level allows (orderKinds; mostly a few), each a few at a time; one in two brings a surprise.
 */
export function makeOrder(known: ProduceId[], random: () => number, level = Infinity): Order {
  const pool = [...new Set(known)]
  const most = Math.max(1, Math.min(orderKinds(level), pool.length))
  // fewer kinds are likelier than many: one to three most of the time, up to all nine now and then
  const kinds = Math.min(most, 1 + Math.floor(random() ** 1.7 * most))
  const goods: ProduceId[] = []
  while (goods.length < kinds && pool.length) goods.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  const lines = goods.map((good) => ({ good, want: 1 + Math.floor(random() * mostAsked(good)), have: 0 }))
  return { id: orderKey(), lines, coins: orderPay(lines), surprise: random() < ITEM_ODDS.order }
}

/** The most kinds a quick order asks for. */
export const QUICK_KINDS = 2

/** An order the silo and the barn could fill now, all of it: it can go at once. */
export const canGoNow = (o: Order, inv: Partial<Record<ProduceId, number>>) => o.lines.every((l) => l.want - l.have <= (inv[l.good] ?? 0))

/**
 * A quick order (farm-games.md P5a: the board always holds one that can go at once): one or two kinds of what the silo
 * and the barn hold now, never more of each than they hold, paid as any order is. Null when they hold nothing an order
 * may ask for.
 */
export function makeQuick(inv: Partial<Record<ProduceId, number>>, random: () => number): Order | null {
  const pool = SELLABLE.filter((g) => (inv[g] ?? 0) > 0)
  if (!pool.length) return null
  const kinds = Math.min(pool.length, 1 + Math.floor(random() * QUICK_KINDS))
  const goods: ProduceId[] = []
  while (goods.length < kinds) goods.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  const lines = goods.map((good) => ({ good, want: 1 + Math.floor(random() * Math.min(inv[good]!, mostAsked(good))), have: 0 }))
  return { id: orderKey(), lines, coins: orderPay(lines), surprise: random() < ITEM_ODDS.order }
}

/** Everything it asks for is in: it can be sent. */
export const isComplete = (o: Order) => o.lines.every((l) => l.have >= l.want)

/** How many goods it asks for, and how many are in. */
export const orderUnits = (o: Order) => ({ want: o.lines.reduce((n, l) => n + l.want, 0), have: o.lines.reduce((n, l) => n + l.have, 0) })

/** How many crates an order fills on the tractor: one for every dozen goods, one to three. */
export const cratesFor = (o: Order) => Math.min(3, Math.max(1, Math.ceil(orderUnits(o).want / 12)))

/** A chapter's request (src/farm/people/chapters.ts): what its writer asks, as an order pinned above the board, paid as
 *  any order is (a quarter over the goods' fair price), with no surprise. */
export function makeRequest(c: { id: ChapterId; who: NeighbourId; ask: readonly { good: ProduceId; n: number }[] }): Order {
  const lines = c.ask.map((a) => ({ good: a.good, want: a.n, have: 0 }))
  return { id: orderKey(), lines, coins: orderPay(lines), surprise: false, from: c.who, chapter: c.id }
}
