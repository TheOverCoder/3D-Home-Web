import { OFFICE_UPGRADES, orderSlots, orderWait, produceById, type OfficeUpgradeId, type ProduceId } from '../../../src/farm/data'
import { cratesFor, isComplete, orderPay, orderUnits, type Order } from '../../../src/farm/orders'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import type { Act } from '../../board'

// The order board's data, by the game's own pure code (src/farm/orders.ts: orderPay, isComplete, orderUnits,
// cratesFor; data.ts: orderSlots, orderWait, OFFICE_UPGRADES): orders asking what a farm makes, no more of a good
// than an order may ask (mostAsked), paying what orderPay says; what the silo and the barn hold to put in. The presses
// do what the game's do: Put in moves what there is, Send pays and the place takes the next order, × declines and
// the place counts down to a new one.

export interface OrdersState {
  /** the board's places: an order, or the seconds to a new one */
  slots: ({ order: Order } | { wait: number })[]
  /** what the silo and the barn hold of what the orders ask */
  inv: Partial<Record<ProduceId, number>>
  /** the office's two ladders */
  office: { slots: number; wait: number }
  /** the tractor: in the yard, or out (back in s) */
  tractor: { back: number | null; waiting: number }
  coins: number
}

let key = 100
/** An order of these goods, paying what the game's orderPay says. */
export const order = (lines: [ProduceId, number, number?][], surprise = false): Order => {
  const l = lines.map(([good, want, have = 0]) => ({ good, want, have }))
  return { id: ++key, lines: l, coins: orderPay(l), surprise }
}

export const units = orderUnits
export const crates = cratesFor
export const complete = isComplete
export const nameOf = (good: ProduceId, n: number) => (n === 1 ? produceById(good).name : produceById(good).plural)
export const placeCount = (s: OrdersState) => orderSlots(s.office.slots)
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** How many of what it still wants the silo and the barn could put in now. */
export const canPut = (s: OrdersState, o: Order) => o.lines.reduce((n, l) => n + Math.min(Math.max(0, l.want - l.have), s.inv[l.good] ?? 0), 0)

/** What Put in would move now, good by good (the pegs it would fill: the next press seen before it is made). */
export const goingIn = (s: OrdersState, o: Order): [ProduceId, number][] =>
  o.lines.map((l) => [l.good, Math.min(Math.max(0, l.want - l.have), s.inv[l.good] ?? 0)] as [ProduceId, number]).filter(([, n]) => n > 0)

/** Put in: what there is of each good it still wants goes in. */
export function putIn(s: OrdersState, k: number): OrdersState {
  const slot = s.slots[k]
  if (!('order' in slot)) return s
  const inv = { ...s.inv }
  const lines = slot.order.lines.map((l) => {
    const n = Math.min(Math.max(0, l.want - l.have), inv[l.good] ?? 0)
    inv[l.good] = (inv[l.good] ?? 0) - n
    return { ...l, have: l.have + n }
  })
  return { ...s, inv, slots: s.slots.map((x, i) => (i === k ? { order: { ...slot.order, lines } } : x)) }
}

/** Send: it pays, its crates wait for the tractor, and the place takes the next order. */
export function send(s: OrdersState, k: number, next: Order): OrdersState {
  const slot = s.slots[k]
  if (!('order' in slot)) return s
  return { ...s, coins: s.coins + slot.order.coins, tractor: { ...s.tractor, waiting: s.tractor.waiting + cratesFor(slot.order) }, slots: s.slots.map((x, i) => (i === k ? { order: next } : x)) }
}

/** ×: what was put in goes back, and the place counts down to a new order. */
export function decline(s: OrdersState, k: number): OrdersState {
  const slot = s.slots[k]
  if (!('order' in slot)) return s
  const inv = { ...s.inv }
  for (const l of slot.order.lines) inv[l.good] = (inv[l.good] ?? 0) + l.have
  return { ...s, inv, slots: s.slots.map((x, i) => (i === k ? { wait: orderWait(s.office.wait) } : x)) }
}

/** The coins of a sent order fly from the press to the coin chip, with one burst. */
export function paid(el: HTMLElement, coins: number) {
  const r = el.getBoundingClientRect()
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  flyCoins(r.left + r.width / 2, r.top + r.height / 2, coinsToFly(coins))
  burst(el, { count: 40, spread: 70, power: 24 })
}

export type OfficeId = OfficeUpgradeId

/** The office's ladders as the shop shows them: its level, now → next, the price, and whether it is at its top (the
 *  game's officeLevel, officePrice, officeMaxed: the price grows by its step each level). */
export const officeRows = (s: OrdersState) =>
  (['slots', 'wait'] as const).map((id) => {
    const def = OFFICE_UPGRADES[id]
    const level = s.office[id]
    const show = (l: number) => (id === 'slots' ? `${orderSlots(l)} at a time` : clock(orderWait(l)))
    return {
      id,
      pic: art(id === 'slots' ? 'clipboard' : 'hourglass-done'),
      name: def.name,
      level,
      max: level >= def.levels,
      now: show(level),
      next: show(level + 1),
      price: def.price + def.priceStep * level,
    }
  })

/** An office upgrade bought, as the game's buyOffice does: its price paid, its level one up; a new place comes with an
 *  order on it at once, and a faster office never lets a place wait longer than the new wait. */
export function buyOffice(s: OrdersState, id: OfficeId): OrdersState {
  const r = officeRows(s).find((x) => x.id === id)!
  if (r.max || s.coins < r.price) return s
  const office = { ...s.office, [id]: s.office[id] + 1 }
  const slots =
    id === 'slots' ? [...s.slots, { order: { ...NEXT[s.slots.length % NEXT.length], id: ++key } }] : s.slots.map((x) => ('wait' in x ? { wait: Math.min(x.wait, orderWait(office.wait)) } : x))
  return { ...s, coins: s.coins - r.price, office, slots }
}

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

/** What sending one does on the screen and to the state. */
export function sendNow(s: OrdersState, act: Act<OrdersState>, k: number, el: HTMLElement, after = 0) {
  const slot = s.slots[k]
  if (!('order' in slot)) return
  paid(el, slot.order.coins)
  const next = NEXT[(slot.order.id + k) % NEXT.length]
  setTimeout(() => act.set(send(s, k, { ...next, id: ++key })), after)
}

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
  tractor: { back: null, waiting: 0 },
  coins: 284,
}
/** Filling: one all in and ready to send, one half in, one waiting for a new order after a decline; the tractor out. */
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
  tractor: { back: 74, waiting: 2 },
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
  tractor: { back: null, waiting: 0 },
  coins: 1180,
}
