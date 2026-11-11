import { ITEM_ODDS, ORDERS, produceById, type ProduceId } from './data'

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
}

/** A place on the board: an order, or the seconds until a new one comes (after one was declined). */
export type OrderSlot = { order: Order } | { wait: number }

let seq = 0
/** A key for an order, new each time. */
export const orderKey = () => ++seq

/** How many of a good an order may ask for: up to half as many again as a buyer would. */
export const mostAsked = (good: ProduceId) => Math.max(1, Math.round(produceById(good).maxAsk * 1.5))

/** What an order of these goods pays: a quarter over their fair price. */
export const orderPay = (lines: { good: ProduceId; want: number }[]) => Math.max(1, Math.round(lines.reduce((sum, l) => sum + produceById(l.good).price * l.want, 0) * ORDERS.markup))

/**
 * A new order, from the goods the farm grows and makes (`known`, never a building material): one to nine kinds of them
 * (mostly a few), each a few at a time; one in two brings a surprise.
 */
export function makeOrder(known: ProduceId[], random: () => number): Order {
  const pool = [...new Set(known)]
  const most = Math.max(1, Math.min(ORDERS.kinds, pool.length))
  // fewer kinds are likelier than many: one to three most of the time, up to all nine now and then
  const kinds = Math.min(most, 1 + Math.floor(random() ** 1.7 * most))
  const goods: ProduceId[] = []
  while (goods.length < kinds && pool.length) goods.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  const lines = goods.map((good) => ({ good, want: 1 + Math.floor(random() * mostAsked(good)), have: 0 }))
  return { id: orderKey(), lines, coins: orderPay(lines), surprise: random() < ITEM_ODDS.order }
}

/** Everything it asks for is in: it can be sent. */
export const isComplete = (o: Order) => o.lines.every((l) => l.have >= l.want)

/** How many goods it asks for, and how many are in. */
export const orderUnits = (o: Order) => ({ want: o.lines.reduce((n, l) => n + l.want, 0), have: o.lines.reduce((n, l) => n + l.have, 0) })

/** How many crates an order fills on the tractor: one for every dozen goods, one to three. */
export const cratesFor = (o: Order) => Math.min(3, Math.max(1, Math.ceil(orderUnits(o).want / 12)))
