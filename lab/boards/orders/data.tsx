import { orderSlots, orderWait, type OfficeUpgradeId, type ProduceId } from '../../../src/farm/data'
import { orderPay, type Order } from '../../../src/farm/orders'
import { officeRows, type OrdersView } from '../../../src/farm/orderBoard/view'

// The order board's sample data, by the game's own pure code (src/farm/orders.ts: orderPay; data.ts: orderSlots,
// orderWait, OFFICE_UPGRADES through officeRows): orders asking what a farm makes, no more of a good than an order may
// ask (mostAsked), paying what orderPay says; what the silo and the barn hold to put in. The presses do what the game's
// do (src/farm/state.ts: fillOrder, sendOrder, declineOrder, buyOffice): Put in moves what there is, Send pays and the
// place takes the next order, × declines and the place counts down to a new one, the office's upgrades are bought.

export interface OrdersState {
  /** the board's places: an order, or the seconds to a new one */
  slots: ({ order: Order } | { wait: number })[]
  /** what the silo and the barn hold of what the orders ask */
  inv: Partial<Record<ProduceId, number>>
  /** the office's two ladders */
  office: { slots: number; wait: number }
  coins: number
}

let key = 100
/** An order of these goods, paying what the game's orderPay says. */
export const order = (lines: [ProduceId, number, number?][], surprise = false): Order => {
  const l = lines.map(([good, want, have = 0]) => ({ good, want, have }))
  return { id: ++key, lines: l, coins: orderPay(l), surprise }
}

/** The board as the game's OrdersPanel makes it from a farm (ordersView). */
export const viewOf = (s: OrdersState): OrdersView => ({ slots: s.slots, inv: s.inv, wait: orderWait(s.office.wait), office: officeRows(s.office), coins: s.coins })

/** Put in: what there is of each good it still wants goes in (fillOrder). How many. */
export function putIn(s: OrdersState, k: number): [OrdersState, number] {
  const slot = s.slots[k]
  if (!('order' in slot)) return [s, 0]
  const inv = { ...s.inv }
  let n = 0
  const lines = slot.order.lines.map((l) => {
    const put = Math.min(Math.max(0, l.want - l.have), inv[l.good] ?? 0)
    inv[l.good] = (inv[l.good] ?? 0) - put
    n += put
    return { ...l, have: l.have + put }
  })
  return [{ ...s, inv, slots: s.slots.map((x, i) => (i === k ? { order: { ...slot.order, lines } } : x)) }, n]
}

/** Send: it pays, and the place takes the next order (sendOrder). */
export function send(s: OrdersState, k: number): OrdersState {
  const slot = s.slots[k]
  if (!('order' in slot) || slot.order.lines.some((l) => l.have < l.want)) return s
  const next = { ...NEXT[(slot.order.id + k) % NEXT.length], id: ++key }
  return { ...s, coins: s.coins + slot.order.coins, slots: s.slots.map((x, i) => (i === k ? { order: next } : x)) }
}

/** ×: what was put in goes back, and the place counts down to a new order (declineOrder). */
export function decline(s: OrdersState, k: number): OrdersState {
  const slot = s.slots[k]
  if (!('order' in slot)) return s
  const inv = { ...s.inv }
  for (const l of slot.order.lines) inv[l.good] = (inv[l.good] ?? 0) + l.have
  return { ...s, inv, slots: s.slots.map((x, i) => (i === k ? { wait: orderWait(s.office.wait) } : x)) }
}

/** An office upgrade bought (buyOffice): its price paid, its level one up; a new place comes with an order on it at
 *  once, and a faster office never lets a place wait longer than the new wait. */
export function buyOffice(s: OrdersState, id: OfficeUpgradeId): OrdersState {
  const r = officeRows(s.office).find((x) => x.id === id)!
  if (r.max || s.coins < r.price) return s
  const office = { ...s.office, [id]: s.office[id] + 1 }
  const slots =
    id === 'slots' ? [...s.slots, { order: { ...NEXT[s.slots.length % NEXT.length], id: ++key } }] : s.slots.map((x) => ('wait' in x ? { wait: Math.min(x.wait, orderWait(office.wait)) } : x))
  return { ...s, coins: s.coins - r.price, office, slots }
}

/** How many places the office's level gives (the board holds as many). */
export const placesOf = (s: OrdersState) => orderSlots(s.office.slots)

/** The next orders a place takes after a send (what a farm like this makes). */
export const NEXT: Order[] = [
  order(
    [
      ['strawberry', 4],
      ['milk', 2],
    ],
    true,
  ),
  order([['flour', 3]]),
  order([
    ['corn', 6],
    ['egg', 5],
    ['wool', 2],
  ]),
]

// ── states ──

/** Three new orders, nothing in yet; the silo and the barn hold some of what they ask. */
export const FRESH: OrdersState = {
  slots: [
    {
      order: order(
        [
          ['tomato', 6],
          ['egg', 4],
        ],
        true,
      ),
    },
    { order: order([['lettuce', 5]]) },
    {
      order: order([
        ['milk', 3],
        ['wool', 2],
        ['carrot', 6],
      ]),
    },
  ],
  inv: { tomato: 9, egg: 6, lettuce: 2, milk: 1, wool: 2, carrot: 8 },
  office: { slots: 0, wait: 0 },
  coins: 284,
}
/** Filling: one all in and ready to send, one half in, one waiting for a new order after a decline. */
export const FILLING: OrdersState = {
  slots: [
    {
      order: order(
        [
          ['tomato', 6, 6],
          ['egg', 4, 4],
        ],
        true,
      ),
    },
    { order: order([['lettuce', 5, 2]]) },
    { wait: 412 },
  ],
  inv: { lettuce: 1, milk: 1 },
  office: { slots: 0, wait: 0 },
  coins: 284,
}
/** A bigger office: five places, a long order among them. */
export const BIG: OrdersState = {
  slots: [
    {
      order: order(
        [
          ['pumpkin', 3, 3],
          ['corn', 6, 6],
          ['cloth', 2, 2],
        ],
        true,
      ),
    },
    {
      order: order([
        ['flour', 4, 1],
        ['sugar', 3],
        ['egg', 6, 6],
        ['strawberry_cake', 1],
      ]),
    },
    { order: order([['lemon', 6, 6]]) },
    {
      order: order([
        ['wool', 3],
        ['milk', 4, 2],
      ]),
    },
    { order: order([['wheat', 5]], true) },
  ],
  inv: { flour: 3, sugar: 1, wool: 3, milk: 1, wheat: 2 },
  office: { slots: 2, wait: 1 },
  coins: 1180,
}
/** A long order: the game's orders ask one to nine kinds of goods (makeOrder); this one eight, beside two short ones. */
export const LONG: OrdersState = {
  slots: [
    { order: order([['carrot', 4]]) },
    {
      order: order(
        [
          ['lettuce', 5, 5],
          ['tomato', 4, 1],
          ['corn', 6],
          ['egg', 6, 2],
          ['milk', 3],
          ['wool', 2, 2],
          ['flour', 2],
          ['lemon', 5],
        ],
        true,
      ),
    },
    { order: order([['pumpkin', 2, 1]]) },
  ],
  inv: { carrot: 1, tomato: 3, corn: 6, egg: 2, milk: 1, flour: 2, pumpkin: 4 },
  office: { slots: 0, wait: 0 },
  coins: 640,
}
