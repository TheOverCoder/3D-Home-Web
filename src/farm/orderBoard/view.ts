import type { ArtId } from '../../ui/art'
import { OFFICE_UPGRADES, orderSlots, orderWait, produceById, type OfficeUpgradeId, type ProduceId } from '../data'
import type { Order, OrderSlot } from '../orders'

// What the order board draws (./OrdersBoard.tsx), with nothing of the farm in it: the game fills it from the farm
// (src/farm/OrdersPanel.tsx), the design lab from sample data (lab/boards/orders). The few sums the board makes from it
// — what Put in would move now, an office upgrade's now → next — are here, pure.

/** The board as it stands. */
export interface OrdersView {
  /** its places: an order, or the seconds to a new one */
  slots: OrderSlot[]
  /** what the silo and the barn hold (of what the orders ask, at least) */
  inv: Partial<Record<ProduceId, number>>
  /** how long a place waits for a new order after a decline, in seconds (its ring runs down from it) */
  wait: number
  /** the office's two upgrades */
  office: OfficeRow[]
  coins: number
}

/** What the board's presses do; each says whether it did anything (Put in: how many went in). */
export interface OrdersActions {
  put: (k: number) => number
  send: (k: number) => boolean
  decline: (k: number) => boolean
  buy: (id: OfficeUpgradeId) => boolean
  /** "Show me": the board closes and you walk to where a good is made (the walk-to of the compass marks); only where the
   *  game gives it (on the farm), and only for a good that has such a place now (`canShow`) */
  show?: (good: ProduceId) => void
  canShow?: (good: ProduceId) => boolean
}

/** An office upgrade as its row shows it: its level, what it changes now → after the next step, its price. */
export interface OfficeRow {
  id: OfficeUpgradeId
  pic: ArtId
  name: string
  blurb: string
  /** steps bought */
  level: number
  max: boolean
  now: string
  next: string
  price: number
}

/** m:ss */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** A good's name, one or many. */
export const nameOf = (good: ProduceId, n: number) => (n === 1 ? produceById(good).name : produceById(good).plural)

/** The office's upgrades at these levels (the game's officeLevel, officePrice, officeMaxed: each step dearer). */
export const officeRows = (levels: Record<OfficeUpgradeId, number>): OfficeRow[] =>
  (['slots', 'wait'] as const).map((id) => {
    const def = OFFICE_UPGRADES[id]
    const level = levels[id]
    const show = (l: number) => (id === 'slots' ? `${orderSlots(l)} at a time` : clock(orderWait(l)))
    return {
      id,
      pic: id === 'slots' ? 'clipboard' : 'hourglass-done',
      name: def.name,
      blurb: def.blurb,
      level,
      max: level >= def.levels,
      now: show(level),
      next: show(level + 1),
      price: def.price + def.priceStep * level,
    }
  })

/** What Put in would move into an order now, good by good (the pegs it would fill: the next press seen before it is
 *  made). The game's fillOrder moves the same. */
export const goingIn = (inv: Partial<Record<ProduceId, number>>, o: Order): [ProduceId, number][] =>
  o.lines.map((l) => [l.good, Math.min(Math.max(0, l.want - l.have), inv[l.good] ?? 0)] as [ProduceId, number]).filter(([, n]) => n > 0)

/** How many goods Put in would move now. */
export const canPut = (inv: Partial<Record<ProduceId, number>>, o: Order) => goingIn(inv, o).reduce((n, [, k]) => n + k, 0)
