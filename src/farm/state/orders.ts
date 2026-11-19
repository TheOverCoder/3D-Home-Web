import { farmSound } from '../../audio/sound'
import { rewardSound } from '../../audio/rewardSound'
import { clock } from '../../lib/time'
import { OFFICE_SCREEN, OFFICE_UPGRADES, ORDERS, orderSlots, orderWait, TRACTOR, type OfficeUpgradeId } from '../data'
import { isFirstOrder } from '../firstSteps'
import { canGoNow, cratesFor, isComplete, makeOrder, makeQuick, orderKey, orderPay, type Order, type OrderSlot } from '../orders'
import { levelOf } from '../xp'
import { tripSeconds } from '../tractorRoute'
import { boundary, type FarmLayout } from '../layout'
import { bump, farm, putBack, random, save, toast, type FarmData } from './core'
import { gainXp } from './levels'
import { foundPrizes, rewarded } from './rewards'
import { gainItems, rollGifts, surpriseWords } from './stores'
import { knownGoods } from './buyers'
import { orderShares, sold } from './ledger'
import { befriend, orderFrom, requestSent } from './neighbours'

// The order board on the office's computer, the office's upgrades, and the tractor that takes the crates away.

/** Where the tractor's track crosses the farm's west edge (the gate in the hedge): the garden's own, or the west
 *  meadow's once it is bought. */
export function gateX(layout: FarmLayout = farm.layout): number {
  const key = layout.land.join(',')
  if (gateCache?.key === key) return gateCache.x
  const edge = boundary(layout).find((e) => e.axis === 'z' && e.out === 'west' && e.from <= TRACTOR.z && e.to >= TRACTOR.z && e.at < 0)
  gateCache = { key, x: edge?.at ?? -14 }
  return gateCache.x
}
let gateCache: { key: string; x: number } | null = null

/** The most crates that wait on the pallet. */
export const MOST_CRATES = 999

/** A new farm's starter order (ORDERS.first): what the first steps taught, eggs and the cloth woven at the loom, paid
 *  as any order is (a quarter over their fair price), with no surprise. */
export function firstOrder(): Order {
  const lines = ORDERS.first.map((l) => ({ good: l.good, want: l.want, have: 0 }))
  return { id: orderKey(), lines, coins: orderPay(lines), surprise: false }
}

/** A new farm's board: the starter order in its first place, a new order coming in each of the others straight away. */
export const firstBoard = (places: number): OrderSlot[] => [{ order: firstOrder() }, ...Array.from({ length: places - 1 }, () => ({ wait: 0 }))]

/** A saved farm still on its first steps that has sent no order gets the starter order once (a save from before it):
 *  in the first place with nothing put in (an order, or one on its way), so nothing put in is lost. A board that has
 *  it already, a farm that has sent one or is past the steps, or a board where every order has something in keeps its
 *  board. */
export function starterOrderIn(data: FarmData) {
  if (data.firstSteps.over || data.stats.sent > 0) return
  if (data.orders.some((slot) => 'order' in slot && isFirstOrder(slot.order))) return
  const k = data.orders.findIndex((slot) => !('order' in slot) || slot.order.lines.every((l) => !l.have))
  if (k >= 0) data.orders[k] = { order: firstOrder() }
}

/** The quick orders on the board this visit (by key: not saved; one read back from a save is an order like any). */
const quick = new Set<number>()

/** A new order for place `k` of the board: as many kinds as the farm's level allows (orderKinds); a quick one — what
 *  the silo and the barn hold now, to go at once — when no other order on the board could go now, so the board holds
 *  one whenever the farm holds something. Not in the place of a quick order just sent (`after`): the next quick one
 *  comes as another order is sent or a wait ends, so it is something to do, never a till that sells the stores. */
export function newOrder(k: number, after?: Order): Order {
  const one = farm.orders.some((slot, j) => j !== k && 'order' in slot && canGoNow(slot.order, farm.inv))
  const made = !one && !(after && quick.has(after.id)) ? makeQuick(farm.inv, random) : null
  if (after) quick.delete(after.id)
  if (made) quick.add(made.id)
  const o = made ?? makeOrder(knownGoods(), random, levelOf(farm.xp.points))
  // now and then a neighbour met who likes a good it asks for sends it (src/farm/state/neighbours.ts): their portrait
  // and name at its head
  const from = orderFrom(o)
  return from ? { ...o, from } : o
}

/** How many orders the board holds at a time, and how long a new one takes after one is declined. */
export const orderPlaces = () => orderSlots(farm.office.slots)
export const orderWaitSeconds = () => orderWait(farm.office.wait)

/** The order in a place on the board (null while a new one is on its way). */
export const orderAt = (k: number): Order | null => {
  const slot = farm.orders[k]
  return slot && 'order' in slot ? slot.order : null
}

/** How many of each good of an order could go in now, from the silo and the barn. */
export const canFill = (k: number) => {
  const o = orderAt(k)
  return !!o && o.lines.some((l) => l.have < l.want && farm.inv[l.good] > 0)
}

/** Puts into an order what the silo and the barn have of what it asks for (all of it, or what there is: the rest can
 *  follow later); they leave the buildings and wait in the order. How many went in. */
export function fillOrder(k: number) {
  const o = orderAt(k)
  if (!o) return 0
  let n = 0
  for (const l of o.lines) {
    const put = Math.min(l.want - l.have, farm.inv[l.good])
    if (put <= 0) continue
    farm.inv[l.good] -= put
    l.have += put
    n += put
  }
  if (!n) return 0
  bump()
  save()
  return n
}

/** Puts into an order what the silo and the barn have of what it asks for. How many went in. */
function fill(o: Order) {
  let n = 0
  for (const l of o.lines) {
    const put = Math.min(l.want - l.have, farm.inv[l.good])
    if (put <= 0) continue
    farm.inv[l.good] -= put
    l.have += put
    n += put
  }
  if (!n) return 0
  bump()
  save()
  return n
}

/** A chapter's request pinned above the board (src/farm/state/neighbours.ts; none: null). */
export const requestAt = (i: number): Order | null => farm.requests[i] ?? null

/** Puts into a chapter's request what the silo and the barn have of what it asks for, as into an order. How many went
 *  in. */
export const fillRequest = (i: number) => {
  const o = requestAt(i)
  return o ? fill(o) : 0
}

/** Sends a chapter's request once all of it is in: paid as an order is (its crates on the pallet), and its writer
 *  grows fonder; it leaves the board, and their thank-you letter, with the chapter's gift, comes a frame later. */
export function sendRequest(i: number) {
  const o = requestAt(i)
  if (!o || !isComplete(o)) return false
  requestSent()
  return ship(o)
}

/** An order going: paid at once (with its surprise, if it has one), its crates to the pallet for the tractor. */
function ship(o: Order) {
  farm.coins += o.coins
  farm.stats.earned += o.coins
  farm.stats.sold += o.lines.reduce((n, l) => n + l.want, 0)
  farm.stats.sent += 1
  const items = o.surprise ? rollGifts() : []
  gainItems(items, OFFICE_SCREEN)
  gainXp('order', 1, OFFICE_SCREEN)
  gainXp('sale', o.coins, OFFICE_SCREEN)
  farm.dispatch.waiting = Math.min(MOST_CRATES, farm.dispatch.waiting + cratesFor(o))
  const tier = rewarded('order', [{ coins: o.coins }, ...foundPrizes(items)], OFFICE_SCREEN)
  for (const l of orderShares(o)) sold('order', l.good, l.units, l.coins)
  befriend(o)
  toast(`${o.chapter ? 'Sent' : 'Order sent'} · + ${o.coins} coins${surpriseWords(items)}`, items[0] ?? 'coin')
  rewardSound('order', tier)
  bump()
  save()
  return true
}

/** Sends a full order: it is paid at once (and brings its surprise, if it has one), its crates go to the pallet for
 *  the tractor, and a new order takes its place straight away. */
export function sendOrder(k: number) {
  const o = orderAt(k)
  if (!o || !isComplete(o)) return false
  farm.coins += o.coins
  farm.stats.earned += o.coins
  farm.stats.sold += o.lines.reduce((n, l) => n + l.want, 0)
  farm.stats.sent += 1
  const items = o.surprise ? rollGifts() : []
  gainItems(items, OFFICE_SCREEN)
  gainXp('order', 1, OFFICE_SCREEN)
  gainXp('sale', o.coins, OFFICE_SCREEN)
  farm.dispatch.waiting = Math.min(MOST_CRATES, farm.dispatch.waiting + cratesFor(o))
  farm.orders[k] = { order: newOrder(k, o) }
  const tier = rewarded('order', [{ coins: o.coins }, ...foundPrizes(items)], OFFICE_SCREEN)
  for (const l of orderShares(o)) sold('order', l.good, l.units, l.coins)
  befriend(o)
  toast(`Order sent · + ${o.coins} coins${surpriseWords(items)}`, items[0] ?? 'coin')
  rewardSound('order', tier)
  bump()
  save()
  return true
}

/** Declines an order (or cancels one half filled): what was put into it goes back to the silo and the barn (even past
 *  full: it was the farm's already), and a new order comes after the wait. */
export function declineOrder(k: number) {
  const o = orderAt(k)
  if (!o) return false
  for (const l of o.lines) if (l.have) putBack(l.good, l.have)
  farm.orders[k] = { wait: orderWaitSeconds() }
  const back = o.lines.reduce((n, l) => n + l.have, 0)
  toast(back ? `Order declined · ${back} back in store` : 'Order declined', back ? o.lines.find((l) => l.have)!.good : undefined)
  farmSound('decline')
  bump()
  save()
  return true
}

/** Steps bought of an office upgrade, its next price, and whether it is all bought. */
export const officeLevel = (id: OfficeUpgradeId) => farm.office[id]
export const officePrice = (id: OfficeUpgradeId) => OFFICE_UPGRADES[id].price + OFFICE_UPGRADES[id].priceStep * farm.office[id]
export const officeMaxed = (id: OfficeUpgradeId) => farm.office[id] >= OFFICE_UPGRADES[id].levels

/** Buys the next step of an office upgrade (its card asked first): one more place on the board (a new order comes in
 *  it straight away), or a minute off the wait (and off every wait already running). */
export function buyOffice(id: OfficeUpgradeId) {
  const price = officePrice(id)
  if (officeMaxed(id) || farm.coins < price) return false
  farm.coins -= price
  farm.office = { ...farm.office, [id]: farm.office[id] + 1 }
  gainXp('build', 1, OFFICE_SCREEN)
  if (id === 'slots') {
    farm.orders.push({ order: newOrder(farm.orders.length) })
    toast(`The board holds ${orderPlaces()} orders`)
  } else {
    const wait = orderWaitSeconds()
    farm.orders = farm.orders.map((slot) => ('wait' in slot ? { wait: Math.min(slot.wait, wait) } : slot))
    toast(`A new order every ${clock(wait)}`)
  }
  bump()
  save()
  return true
}

/** Orders on their way come in once their wait is over. */
export function growOrders(dt: number) {
  farm.orders.forEach((slot, k) => {
    if (!('wait' in slot)) return
    slot.wait = Math.max(0, slot.wait - dt)
    if (slot.wait <= 0) farm.orders[k] = { order: newOrder(k) }
  })
}

/** The tractor: once at home with crates on the pallet it takes up to four on a trip; the trip runs its course. */
export function growDispatch(dt: number) {
  const d = farm.dispatch
  let left = dt
  for (let guard = 0; guard < 64 && left > 0; guard++) {
    if (d.trip < 0) {
      if (!d.waiting) return
      d.aboard = Math.min(TRACTOR.load, d.waiting)
      d.waiting -= d.aboard
      d.trip = 0
    }
    const total = tripSeconds(d.aboard, gateX())
    const step = Math.min(left, total - d.trip)
    d.trip += step
    left -= step
    if (d.trip >= total) {
      d.trip = -1
      d.aboard = 0
    }
  }
}
