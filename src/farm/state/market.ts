import { farmSound } from '../../audio/sound'
import { coinsFx } from '../../fx/fx'
import { count, LADDERS, MANAGER, SELLABLE, SHED, SHOP, VISITOR, WALK_Z, type LadderId, type ProduceId } from '../data'
import { priceOf } from '../prices'
import { managerPay, managerPct, placesOpen, rollShopper, SHOP_LADDERS, shopperEvery, shoppersAtOnce, snapPct } from '../market'
import { dailyOffers, offersPerDay } from '../contractor'
import { MANAGER_LOOK, rollLook } from '../../models/look'
import { BROWSE_SPOTS, LOT, MANAGER_SPOT, SCREEN, TILL } from '../../data/market'
import { hallStands, laneEnd, managerLeaves, payPlace, scriptSeconds, secondsLeft, shopperIn, shopperOut, shopperPay, stepScript, walker, type Pose } from '../script'
import { randomItem } from '../storage'
import { needsMet } from '../tools'
import { bump, farm, isSellable, putBack, random, save, steadyLook, toast, type At, type Person, type Place, type Walking } from './core'
import { gainXp } from './levels'
import { ladderMaxed, ladderNextPrice } from './ladders'
import { toolBought } from './producers'
import { AT_CONTRACTOR, contractorDay, contractorHere, forgetContractorWalk } from './contractor'
import { setLastPhase } from './day'

// The supermarket: selling to the manager, buying his shop, the ladders, your shelves and till, and its people (the
// shoppers, the manager walking out).

/** Where the crystals and the coins fly from: the farm shop's shed, the manager, the computer, the till, the
 *  contractor. */
const AT_SHED: At = { x: SHED.x, y: 1.6, z: SHED.z }
const AT_MANAGER: At = { x: MANAGER_SPOT.x, y: 1.6, z: MANAGER_SPOT.z }
const AT_SCREEN: At = { x: SCREEN.x, y: SCREEN.y, z: SCREEN.z }
const AT_TILL: At = { x: TILL.x, y: TILL.y, z: TILL.z }

/** What the manager pays for the whole stack of a good now (0: he does not buy it, or it comes to nothing). */
export function managerPays(item: ProduceId): number {
  if (farm.market.owned || !isSellable(item)) return 0
  return managerPay(priceOf(item), farm.inv[item], managerPct(farm.ladders.rate))
}

/** Sells him a good's whole stack, without a word: the coins (0: nothing sold). */
function sellManager(item: ProduceId): number {
  const coins = managerPays(item)
  if (!(coins > 0)) return 0
  const qty = farm.inv[item]
  farm.inv[item] = 0
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + coins)
  farm.stats.sold += qty
  farm.stats.earned += coins
  gainXp('sale', coins, AT_MANAGER)
  return coins
}

/** Sells the whole stack of a good to the manager (before the shop is yours); the coins paid, 0 when it pays nothing. */
export function sellToManager(item: ProduceId): number {
  const qty = farm.inv[item] ?? 0
  const coins = sellManager(item)
  if (!coins) return 0
  coinsFx(AT_MANAGER.x, AT_MANAGER.z, coins)
  toast(`+ ${coins} coins · ${count(item, qty)}`, item)
  farmSound('coins')
  bump()
  save()
  return coins
}

/** Sells him every good he pays for; the coins. */
export function sellAllToManager(): number {
  let coins = 0
  let goods = 0
  for (const id of SELLABLE) {
    const qty = farm.inv[id]
    const c = sellManager(id)
    if (c) goods += qty
    coins += c
  }
  if (!coins) return 0
  coinsFx(AT_MANAGER.x, AT_MANAGER.z, coins)
  toast(`+ ${coins} coins · ${goods} ${goods === 1 ? 'good' : 'goods'} to the manager`, 'coin')
  farmSound('coins')
  bump()
  save()
  return coins
}

/** The shop is for sale: the manager's rate is at its top and it is not yours yet. */
export const marketForSale = () => !farm.market.owned && ladderMaxed('rate')

/** Drives to the other map (the farm, or the house once it is yours); whether you went. The scene follows
 *  `farm.place`: it shows that map and puts you out of the car there (src/data/maps.ts, ARRIVE). */
export function driveTo(to: Place): boolean {
  if (to === farm.place || (to === 'home' && !farm.apartment.owned)) return false
  farm.place = to
  bump()
  save()
  return true
}

/** Buys the shop from the manager (his rate at its top, MANAGER.shopPrice); whether it was bought. He waves and walks
 *  out, and the computer is yours: the shelves, the till and the shop's own ladders. */
export function buyMarket(): boolean {
  if (!marketForSale() || farm.coins < MANAGER.shopPrice) return false
  farm.coins -= MANAGER.shopPrice
  farm.market.owned = true
  farm.market.nextIn = Math.min(farm.market.nextIn, shopperEvery(farm.ladders.pace))
  leaving = { ...managerStanding(), ...walker(MANAGER_SPOT.x, MANAGER_SPOT.z, MANAGER_SPOT.heading, managerLeaves()), id: MANAGER_ID }
  gainXp('shop', 1, AT_SCREEN)
  toast('The shop is yours', 'convenience-store')
  farmSound('coins')
  bump()
  save()
  return true
}

/** Whether a ladder's next step can be bought now (its place is open, not at its top): the farm shop's once what it
 *  waits for is there (a tool its herd full, a tool's upgrades the tool, the animals' remote a tool; src/farm/tools.ts),
 *  the manager's rate while the shop is not yours, the shop's own once it is, the contractor's while he is there. */
export function ladderOpen(id: LadderId): boolean {
  if (ladderMaxed(id)) return false
  if (LADDERS[id].at === 'shop') return needsMet(LADDERS[id].needs, farm)
  if (id === 'rate') return !farm.market.owned
  if (SHOP_LADDERS.includes(id)) return farm.market.owned
  return contractorHere()
}

/** Where the crystals of a ladder's step fly from: the one you bought it from (the farm shop's: its shed). */
const ladderAt = (id: LadderId) => (LADDERS[id].at === 'shop' ? AT_SHED : id === 'rate' ? AT_MANAGER : SHOP_LADDERS.includes(id) ? AT_SCREEN : AT_CONTRACTOR)

/** Buys a ladder's next step (its card asked first); whether it was bought. It works at once: a busier shop's next
 *  visit comes no later than the new wait, more pieces bring one more today, a better deal is the price from now on. */
export function buyLadder(id: LadderId): boolean {
  const price = ladderNextPrice(id)
  if (!ladderOpen(id) || farm.coins < price) return false
  // today's pieces as they were before this step (one more is added to them below)
  if (id === 'stock') contractorDay()
  farm.coins -= price
  farm.ladders[id] += 1
  if (LADDERS[id].tool?.part === 'tool') toolBought(LADDERS[id].tool.kind)
  if (id === 'pace') farm.market.nextIn = Math.min(farm.market.nextIn, shopperEvery(farm.ladders.pace))
  if (id === 'stock') {
    // the piece most wanted that he has not brought today (or any)
    const offered = farm.contractor.offers.map((o) => o.item)
    farm.contractor.offers.push({ item: dailyOffers(farm, offersPerDay(farm.ladders.stock), random).find((m) => !offered.includes(m)) ?? randomItem(random), sold: false })
  }
  gainXp('build', 1, ladderAt(id))
  toast(`${LADDERS[id].name}: ${LADDERS[id].say(farm.ladders[id])}`)
  bump()
  save()
  return true
}

/** How many places on the shelves are open now. */
export const placesNow = () => placesOpen(farm.ladders.places)
/** A place of your shop that is open (the shop yours, the place one of those its ladder opened). */
const openPlace = (k: number) => farm.market.owned && Number.isInteger(k) && k >= 0 && k < placesNow()
/** Nothing on any shelf. */
export const shelvesEmpty = () => farm.market.shelves.every((s) => s.units <= 0)

/** Puts up to `units` of a good from the silo or the barn on a place (a place's good changes only when it is empty;
 *  a place holds SHOP.units at most); how many went up. */
export function fillPlace(k: number, item: ProduceId, units: number): number {
  if (!openPlace(k) || !isSellable(item)) return 0
  const s = farm.market.shelves[k]
  if (s.units > 0 && s.good !== item) return 0
  const n = Math.min(Math.floor(units) || 0, SHOP.units - s.units, farm.inv[item])
  if (!(n > 0)) return 0
  farm.inv[item] -= n
  s.good = item
  s.units += n
  bump()
  save()
  return n
}

/** Refills the given places that are not full (sold out, or partly) with their own good, from the silo or the barn,
 *  in turn as far as it goes; how many units went up. */
export function restockPlaces(ks: number[]): number {
  let n = 0
  for (const k of new Set(ks)) {
    const s = openPlace(k) ? farm.market.shelves[k] : null
    if (s?.good) n += fillPlace(k, s.good, SHOP.units - s.units)
  }
  return n
}

/** Takes a place's units back into the silo or the barn (even past full: they were the farm's), and leaves the place
 *  free for another good; how many. */
export function emptyPlace(k: number): number {
  if (!openPlace(k)) return 0
  const s = farm.market.shelves[k]
  const n = s.good ? s.units : 0
  if (s.good && n) putBack(s.good, n)
  if (!s.good && !s.units) return 0
  s.good = null
  s.units = 0
  bump()
  save()
  return n
}

/** Sets a place's price (percent of the fair price, snapped to its range and step). */
export function setPlacePrice(k: number, pct: number) {
  if (!openPlace(k)) return
  farm.market.shelves[k].pct = snapPct(pct)
  bump()
  save()
}

/** The till on the compass: its coins, once it holds SHOP.readyAt or the shelves are empty (nothing more comes in). */
export function tillReady(): { item: 'coin'; count: number } | null {
  const coins = farm.market.till.coins
  return farm.market.owned && coins > 0 && (coins >= SHOP.readyAt || shelvesEmpty()) ? { item: 'coin', count: coins } : null
}

/** Takes the coins in the till; how many. They count as sold and earned, as at the gate. */
export function takeTill(): number {
  const { coins, goods } = farm.market.till
  if (!farm.market.owned || !(coins > 0)) return 0
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + coins)
  farm.stats.sold += goods
  farm.stats.earned += coins
  farm.market.till = { coins: 0, goods: 0 }
  gainXp('sale', coins, AT_TILL)
  coinsFx(AT_TILL.x, AT_TILL.z, coins)
  toast(`+ ${coins} coins from the till`, 'coin')
  farmSound('till')
  bump()
  save()
  return coins
}

/** Weighs goods for drawing (triangles of one unit each): set by the scene (goodsTriangles, registered in
 *  src/farm/Market.tsx), asked only by marketFill's `mixed`, once; with none set, `mixed` takes the first ten goods
 *  that sell. */
let weigher: ((ids: readonly ProduceId[]) => Record<string, number>) | null = null
let heaviest: ProduceId[] | null = null
export function weighGoods(fn: (ids: readonly ProduceId[]) => Record<string, number>) {
  weigher = fn
  heaviest = null
}
/** The goods that sell, the heaviest to draw first (as they are when nothing weighs them). */
function heaviestGoods(): ProduceId[] {
  if (heaviest) return heaviest
  if (!weigher) return SELLABLE
  const w = weigher(SELLABLE)
  heaviest = SELLABLE.map((id, k) => ({ id, k, n: w[id] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.k - b.k)
    .map((g) => g.id)
  return heaviest
}

/** Tests: the shop yours, every place open and full of `item` (the heaviest good to draw by default). `mixed`: each
 *  place a different good instead, the heaviest ten. `shoppers`: MOST_SHOPPERS people standing still, as many inside
 *  as ever are in play (MOST_INSIDE: at the browse spots, at the counter and in its line, then on the ways in) and the
 *  rest on the lane in front, until a marketFill without it (the market at its fullest, for measuring what it draws).
 *  `quiet`: nobody about and no visit coming, until a marketFill without it (views elsewhere, measured the same every
 *  time: a shopper in the doorway would let what is inside be seen). */
export function marketFill(item: ProduceId = 'corn', opts: { shoppers?: boolean; mixed?: boolean; quiet?: boolean } = {}) {
  if (!isSellable(item)) return
  farm.market.owned = true
  farm.ladders.places = LADDERS.places.levels
  const goods = opts.mixed ? heaviestGoods() : []
  farm.market.shelves.forEach((s, k) => Object.assign(s, { good: goods[k] ?? item, units: SHOP.units }))
  if (opts.shoppers) standShoppers()
  else if (opts.quiet) {
    // nobody about and nobody coming: a view of the farm is the same however long it is measured
    shoppers = []
    standing = true
  } else if (standing) {
    shoppers = []
    standing = false
  }
  bump()
  save()
}

/** The most shoppers about at a time, in the shop and on the lane (the crowd's guest places: GUEST_SLOTS in
 *  src/farm/Visitors.tsx, less the contractor's, the estate agent's and the tractor driver's; the manager walks out in
 *  one of these). As
 *  many as the top of both ladders has about at once (group 3, pace 4: up to 14), so the shop keeps the ladders' pace. */
export const MOST_SHOPPERS = 14
/** The most of them ever inside the market at once (its rooms and its doorway), at the top of both ladders: measured by
 *  playing the shop for hours (src/farm/state.market.test.ts); the rest of those about are on the lane. */
export const MOST_INSIDE = 6
/** The lane in front of the market, where those about but not inside stand when the shop is filled for measuring. */
const LANE_IN_FRONT = { x0: 0, x1: LOT[0].x1 } as const
/** Two shoppers never browse at one spot at once: the one coming is there this long after the one before has gone. */
const SPOT_GAP = 1
/** Ids of their own (the buyers at the gate count up from 1). */
const MANAGER_ID = -1

let shopperSeq = 0

/** A shopper: on their way in and browsing, on their way to pay and paying, or on their way out. */
interface Shopper extends Person {
  phase: 'in' | 'pay' | 'out'
  spot: number
  side: 0 | 1
}
/** Not saved: on a reload the shoppers are gone (what they bought is in the till already). */
let shoppers: Shopper[] = []
/** The manager walking out of the shop you bought (gone once at the lane's end, and on a reload). */
let leaving: Person | null = null

const MANAGER_DRESS = steadyLook(1723, MANAGER_LOOK)

const managerStanding = (): Person => ({ id: MANAGER_ID, ...walker(MANAGER_SPOT.x, MANAGER_SPOT.z, MANAGER_SPOT.heading, []), look: MANAGER_DRESS })
const standingManager = managerStanding()

/** The shoppers in the shop and on their way, as the scene draws them. */
export function shoppersNow(): readonly Walking[] {
  return shoppers
}
/** The manager: behind his desk until the shop is yours, then walking out (null once he has gone). */
export function managerNow(): Walking | null {
  return farm.market.owned ? leaving : standingManager
}

/** The shoppers stand still where marketFill put them (they neither walk nor come). */
let standing = false
/** MOST_SHOPPERS people standing still, the fullest the shop ever is in play: MOST_INSIDE inside — one at each browse
 *  spot, browsing; one paying at the counter and the line behind; then on the ways in, facing the way they go — and the
 *  rest walking the lane in front of it. */
function standShoppers() {
  const at: { x: number; z: number; heading: number; pose: Pose; spot: number }[] = []
  BROWSE_SPOTS.forEach((b, spot) => at.push({ ...b, pose: 'browse', spot }))
  for (let k = 0; k < BROWSE_SPOTS.length; k++) at.push({ ...payPlace(k), pose: k ? 'stand' : 'pay', spot: k })
  for (const p of hallStands(MOST_INSIDE - at.length, at)) at.push({ ...p, pose: 'stand', spot: 0 })
  const inside = at.slice(0, MOST_INSIDE)
  const lane = MOST_SHOPPERS - inside.length
  const { x0, x1 } = LANE_IN_FRONT
  for (let k = 0; k < lane; k++) inside.push({ x: x0 + ((x1 - x0) * (k + 0.5)) / lane, z: WALK_Z, heading: k % 2 ? -Math.PI / 2 : Math.PI / 2, pose: 'stand', spot: 0 })
  shoppers = inside.map((p) => ({
    ...walker(p.x, p.z, p.heading, []),
    pose: p.pose,
    id: -(100 + ++shopperSeq),
    look: rollLook(random),
    phase: 'in' as const,
    spot: p.spot,
    side: 1 as const,
  }))
  standing = true
}

/** Whether a shopper setting off now would find browse spot `spot` free when they get there (from the nearer lane
 *  end, the soonest they can): everyone on their way to it before them has browsed and gone by then. */
function spotFree(spot: number) {
  const there = Math.min(...([0, 1] as const).map((side) => scriptSeconds(laneEnd(side).x, laneEnd(side).z, shopperIn(spot), VISITOR.speed))) - SHOP.browse
  return shoppers.every((s) => s.phase !== 'in' || s.spot !== spot || secondsLeft(s, VISITOR.speed) + SPOT_GAP <= there)
}

/** A browse spot for each of a visit's group (null: no room for all of them yet): a spot nobody else will be browsing
 *  at when they get there, and a place among all about (the manager, while he walks out, takes one). */
function visitSpots(): number[] | null {
  const group = shoppersAtOnce(farm.ladders.group)
  if (shoppers.length + group + (leaving ? 1 : 0) > MOST_SHOPPERS) return null
  const spots = BROWSE_SPOTS.map((_, i) => i).filter(spotFree)
  return spots.length >= group ? spots.slice(0, group) : null
}

/** A visit: the group walks in from the lane ends (each rolled on the farm's dice), each to their browse spot. */
function visit(spots: number[]) {
  for (const spot of spots) {
    const side: 0 | 1 = random() < 0.5 ? 0 : 1
    const end = laneEnd(side)
    shoppers.push({ ...walker(end.x, end.z, side ? -Math.PI / 2 : Math.PI / 2, shopperIn(spot)), walking: true, id: -(100 + ++shopperSeq), look: rollLook(random), phase: 'in', spot, side })
  }
}

/** What one shopper buys, on the farm's dice: the units off the shelves, their coins (and how many) into the till, in
 *  the same step. How many units. */
function shopperBuys(): number {
  const m = farm.market
  if (!m.owned) return 0
  const r = rollShopper(m.shelves, placesNow(), random)
  r.taken.forEach((n, k) => (m.shelves[k].units -= n))
  m.till.coins = Math.min(Number.MAX_SAFE_INTEGER, m.till.coins + r.coins)
  m.till.goods = Math.min(Number.MAX_SAFE_INTEGER, m.till.goods + r.units)
  return r.units
}

/** A walker setting off on new steps. */
const setOff = { at: 0, waited: 0, walking: true, pose: 'stand' } as const

/** The shoppers walk on: one who has browsed takes what they want (and goes to pay), or nothing (and goes); one who has
 *  paid goes; one at the lane's end is gone. */
function moveShoppers(dt: number) {
  for (const s of standing ? [] : shoppers.slice()) {
    if (!stepScript(s, dt, VISITOR.speed)) continue
    if (s.phase === 'in') {
      const bought = shopperBuys() > 0
      const ahead = shoppers.filter((o) => o.phase === 'pay').length
      Object.assign(s, { phase: bought ? 'pay' : 'out', steps: bought ? shopperPay(s.spot, ahead) : shopperOut(s.spot, false, s.side), ...setOff })
    } else if (s.phase === 'pay') Object.assign(s, { phase: 'out', steps: shopperOut(s.spot, true, s.side), ...setOff })
    else shoppers.splice(shoppers.indexOf(s), 1)
  }
  if (leaving && stepScript(leaving, dt, VISITOR.speed)) leaving = null
}

/** Another farm (loaded, switched to, started again): no one of this one's is left walking, and its first frame tells
 *  no morning. */
export function forgetWalkers() {
  shoppers = []
  standing = false
  held = 0
  leaving = null
  forgetContractorWalk()
  setLastPhase(null)
}

/** Your shop in play: the countdown to the next visit (it holds at 0 while the shelves are empty, and while the
 *  shop has no room for the whole group), the visits, and the shoppers walking. */
export function runShop(dt: number) {
  moveShoppers(dt)
  const m = farm.market
  // filled for measuring (marketFill): those standing stay as they are, and no one comes
  if (!m.owned || standing) return
  const late = Math.max(0, dt - m.nextIn)
  m.nextIn = Math.max(0, m.nextIn - dt)
  if (m.nextIn > 0 || shelvesEmpty()) {
    held = 0
    return
  }
  // due, but no room yet for the whole group: it comes as soon as there is, and the next one no later than it would
  // have (the shop keeps its pace)
  held += late
  const spots = visitSpots()
  if (!spots) return
  m.nextIn = Math.max(0, shopperEvery(farm.ladders.pace) - held)
  held = 0
  visit(spots)
}

/** Seconds a visit due has waited for room (not saved: a reload starts its count again). */
let held = 0

/** The shop while you are away: no one is seen, the visits come all the same and buy as they would have. */
export function shopAway(dt: number) {
  moveShoppers(dt)
  const m = farm.market
  if (!m.owned) return
  m.nextIn -= dt
  if (m.nextIn > 0) return
  if (shelvesEmpty()) {
    m.nextIn = 0
    return
  }
  for (let k = 0; k < shoppersAtOnce(farm.ladders.group); k++) shopperBuys()
  m.nextIn = Math.max(0, Math.min(shopperEvery(farm.ladders.pace), m.nextIn + shopperEvery(farm.ladders.pace)))
}
