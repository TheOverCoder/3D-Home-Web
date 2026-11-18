import {
  BUYER_OFFERS,
  CONTRACTOR,
  CROPS,
  ITEM_ODDS,
  MACHINES,
  MACHINE_IDS,
  ORDERS,
  PRODUCE,
  SELLABLE,
  SHOP,
  XP_FOR,
  arrivalEvery,
  buyerMean,
  isItem,
  storeOf,
  type CropId,
  type MachineId,
  type ProduceId,
  type StoreId,
} from '../data'
import { FRUIT, FRUIT_KINDS, type FruitKind } from '../decor'
import { activeAt, priceFactor, speedAt, type Boost, type EventId } from '../events'
import { LEDGER_DAYS, perUnit, type Channel, type Ledger } from '../ledger'
import { buyChance, managerPct, placesOpen, shopperEvery, shoppersAtOnce, unitPrice } from '../market'
import { piecePrice } from '../contractor'
import { machineLevel } from '../machineView'
import { makerOf, priceAt } from '../prices'
import type { FarmData } from '../state'
import { unlockLevel, recipeUnlock, type UnlockId } from '../unlocks'
import { levelOf } from '../xp'

// What the house's computer knows about every good (its Market app draws it): what it is worth now and why, what each
// place that buys it pays a unit — a buyer at the gate, an order, the market's manager or your own shelves, the
// contractor for a material — with the XP, the surprises and the wait that go with it, where it pays most and where it
// sells soonest, what the line and the orders want of it now, its price over the last week and tomorrow, and the
// vegetable index. Worked out from a farm given to it by the game's own rules (src/farm/prices.ts priceAt, the market's,
// the contractor's, the events'), so it never disagrees with a sale. Pure: the same farm and moment, the same view.

/** The parts of the farm it reads (the farm's save is one), and its sales book once the farm keeps one. */
export type MarketFarm = Pick<FarmData, 'inv' | 'machines' | 'ladders' | 'market' | 'visitors' | 'orders' | 'events' | 'xp' | 'producers' | 'compost' | 'paceLevel' | 'planted' | 'made'> & {
  ledger?: Ledger
}

export interface MarketNow {
  /** the moment the week's events are judged at (eventTime() in src/farm/state.ts); null while they are off */
  at: number | null
  /** today, on the device's calendar (calendarDay() in src/farm/state.ts) */
  day: number
  /** what a market mood multiplies a good's price by on a day (none: 1). Never a building material's. */
  mood?: (good: ProduceId, day: number) => number
  /** everything open whatever the level (as on a ?debug page) */
  allOpen?: boolean
}

/** Something that makes a good dearer (or cheaper) today: the level of the machine that makes it, the lucky draw, the
 *  market's mood. `times`: what it multiplies the price by. */
export type Why = { kind: 'machine'; machine: MachineId; level: number; times: number } | { kind: 'draw'; times: number } | { kind: 'mood'; times: number }

/** One place a good can be sold, as things stand. */
export interface ChannelView {
  id: Channel
  /** coins a unit (a buyer: the mean of their offers; an order: one coming now; the shop: at the shelf's price, or its
   *  starting price on no shelf) */
  per: number
  /** the least and the most a unit can bring there (a buyer's offers; the shop's lowest and highest price) */
  low: number
  high: number
  /** XP a unit (a sale's XP is a fifth of its coins), and what a sale there gives once more (an order's own) */
  xp: number
  bonusXp: number
  /** the chance a sale there brings a surprise, and how many it brings today (two on gift day) */
  gift: number
  gifts: number
  /** seconds until a unit sells there: 0 at once (the manager, the contractor, a buyer in line or an order that wants
   *  it); the shop's wait for a shopper to take one; null while nobody there asks for it */
  wait: number | null
}

/** A place on your shelves that holds the good: its price, and a shopper's chance and the wait for a unit to sell. */
export interface ShelfOffer {
  place: number
  pct: number
  units: number
  per: number
  chance: number
  wait: number
}

/** The shop's price against its wait, a step at a time from its lowest price to its highest. */
export interface CurvePoint {
  pct: number
  per: number
  chance: number
  wait: number
}

export interface GoodMarket {
  id: ProduceId
  /** a building material (only the contractor buys it) */
  material: boolean
  store: StoreId
  have: number
  /** the farm grows or makes it: buyers and orders ask for it (a material: always) */
  known: boolean
  /** not open yet at the farm's level: the level it opens at */
  locked: number | null
  /** its fair price (the tables'; a material's: what the contractor pays), and what it is worth now */
  base: number
  now: number
  /** now against fair, in percent (8: 8 % more) */
  move: number
  /** what makes the difference today, only what does */
  why: Why[]
  /** every place it can be sold now: the gate, an order, the manager (the shop not yours) or your shop (yours); a
   *  material: the contractor */
  channels: ChannelView[]
  /** the place that pays most a unit (the soonest of those alike), and the one that sells soonest (the dearest of
   *  those alike); null: none */
  best: Channel | null
  soonest: Channel | null
  /** the buyers on their way or in line who want it: how many, the units they want, the best they offer a unit (0:
   *  none); and the seconds between buyers today */
  line: { buyers: number; units: number; best: number; every: number }
  /** the open orders that still want it: how many, the units still to put in, and what they pay a unit (their pay by
   *  its share, as fixed when each came) */
  orders: { orders: number; want: number; per: number }
  /** your shelves that hold it, and the shop's curve (none while the shop is not yours) */
  shelves: ShelfOffer[]
  curve: CurvePoint[]
  /** the most of it one buyer, and one order, may ask for */
  asks: { buyer: number; order: number }
  /** what the contractor sells one for (a material; null for a good) */
  buyFor: number | null
  /** what it was worth on each of the last seven days (today last; the draw counts on its own day only) and tomorrow,
   *  and where it is heading: tomorrow against now */
  trend: { days: number[]; tomorrow: number; dir: 'up' | 'down' | 'flat'; pct: number }
  /** what you got for a unit on each of the sales book's days (null: none sold, or no book yet) */
  yours: (number | null)[]
}

/** The vegetable index: the market's mood over every crop, ×100 (100: as fair). */
export interface IndexView {
  now: number
  /** the last LEDGER_DAYS days, today last */
  days: number[]
  tomorrow: number
  basket: CropId[]
}

export interface MarketView {
  level: number
  /** the week's events on now, and what each kind of boost multiplies */
  events: EventId[]
  speeds: Record<Boost, number>
  goods: GoodMarket[]
  index: IndexView
}

const BOOSTS: readonly Boost[] = ['draw', 'gifts', 'buyers', 'crops', 'machines']
const noMood = () => 1
/** Within this many percent a price holds (it is not heading anywhere). */
const STILL = 0.5

/** The mood of a good on a day (a material's: never moved). */
const moodOf = (now: MarketNow, good: ProduceId, day: number) => (isItem(good) ? 1 : (now.mood ?? noMood)(good, day))

/** What a machine's level adds to the price of what it makes (0.2: a fifth). */
const moreFor = (f: MarketFarm, good: ProduceId) => {
  const maker = makerOf(good)
  return maker ? machineLevel(f.machines[maker].worked).boost.coins : 0
}

/** Every good's price now, as a sale today would take it: the parts priceOf takes from the farm, from this one. */
export function pricesNow(f: MarketFarm, now: MarketNow): Record<ProduceId, number> {
  return Object.fromEntries(PRODUCE.map((p) => [p.id, priceAt(p.id, moreFor(f, p.id), priceFactor(p.id, f.events, now.at) * moodOf(now, p.id, now.day))])) as Record<ProduceId, number>
}

/** The fruit tree or bush a fruit grows on. */
const plantOf = (good: ProduceId): FruitKind | undefined => FRUIT_KINDS.find((k) => FRUIT[k].fruit === good)

/** The level a good can first be had at: a crop's seeds, the first recipe that makes it, the tree or bush it grows on;
 *  what a new farm's tree and animals give, and the materials, from the start. */
export function goodOpensAt(good: ProduceId): number {
  if (CROPS.some((c) => c.id === good)) return unlockLevel(`crop:${good}` as UnlockId)
  const made = MACHINE_IDS.flatMap((m) => MACHINES[m].recipes.filter((r) => r.makes === good).map((r) => unlockLevel(recipeUnlock(m, r.id))))
  if (made.length) return Math.min(...made)
  const plant = plantOf(good)
  return plant ? unlockLevel(`decor:${plant}` as UnlockId) : 1
}

/** What buyers and orders ask for: what the farm grows and makes, and what every farm has (src/farm/state.ts,
 *  knownGoods). */
function knownGoods(f: MarketFarm): Set<ProduceId> {
  const fruit = FRUIT_KINDS.filter((k) => f.producers[k].animals > 0).map((k) => FRUIT[k].fruit)
  const every: ProduceId[] = ['lemon', 'egg', 'milk']
  return new Set([...f.planted, ...f.made, ...every, ...fruit].filter((g) => SELLABLE.includes(g)))
}

/** The seconds a shop's unit waits for a shopper to take it, at a shopper's chance `p`: a visit every `every` seconds
 *  brings `group` shoppers, each taking it with the chance. */
const shopWait = (p: number, every: number, group: number) => every / (1 - (1 - p) ** group)

/** The channel that pays most a unit (the soonest of those alike), or sells soonest (the dearest of those alike). */
function pick(channels: ChannelView[], by: 'per' | 'wait'): Channel | null {
  const waitOf = (c: ChannelView) => c.wait ?? Infinity
  const list = by === 'wait' ? channels.filter((c) => c.wait !== null) : channels
  const sorted = [...list].sort((a, b) => (by === 'per' ? b.per - a.per || waitOf(a) - waitOf(b) : waitOf(a) - waitOf(b) || b.per - a.per))
  return sorted[0]?.id ?? null
}

/** Everything the computer's Market shows, worked out from the farm `f` at `now`. */
export function marketView(f: MarketFarm, now: MarketNow): MarketView {
  const level = levelOf(f.xp.points)
  const speeds = Object.fromEntries(BOOSTS.map((b) => [b, speedAt(b, now.at)])) as Record<Boost, number>
  const prices = pricesNow(f, now)
  const known = knownGoods(f)
  const owned = f.market.owned
  const open = owned ? placesOpen(f.ladders.places) : 0
  const every = shopperEvery(f.ladders.pace)
  const group = shoppersAtOnce(f.ladders.group)
  const buyerEvery = arrivalEvery(f.paceLevel) / speeds.buyers
  const lowest = Math.min(...BUYER_OFFERS.map((o) => o.factor))
  const highest = Math.max(...BUYER_OFFERS.map((o) => o.factor))
  const orders = f.orders.flatMap((slot) => ('order' in slot ? [slot.order] : []))
  const line = f.visitors.filter((v) => v.phase !== 'leaving')

  const goods = PRODUCE.map((p): GoodMarket => {
    const id = p.id
    const material = isItem(id)
    const more = moreFor(f, id)
    const draw = priceFactor(id, f.events, now.at)
    const mood = moodOf(now, id, now.day)
    const nowPrice = material ? CONTRACTOR.buys : prices[id]
    const base = material ? CONTRACTOR.buys : p.price
    const why: Why[] = []
    const maker = makerOf(id)
    if (maker && more > 0) why.push({ kind: 'machine', machine: maker, level: machineLevel(f.machines[maker].worked).n, times: 1 + more })
    if (draw !== 1) why.push({ kind: 'draw', times: draw })
    if (mood !== 1) why.push({ kind: 'mood', times: mood })

    // the line: buyers on their way or in line who want it (one standing in line can be sold to at once)
    const wanting = line.filter((v) => v.want === id)
    const lineView = { buyers: wanting.length, units: wanting.reduce((n, v) => n + v.qty, 0), best: Math.max(0, ...wanting.map((v) => v.offer / Math.max(1, v.qty))), every: buyerEvery }
    // the open orders that still want it, and what they pay a unit of it: each order's pay by this good's share of it
    let orderWant = 0
    let orderPay = 0
    let orderCount = 0
    for (const o of orders) {
      const all = o.lines.reduce((n, l) => n + prices[l.good] * l.want, 0)
      for (const l of o.lines) {
        if (l.good !== id || l.have >= l.want) continue
        orderCount++
        orderWant += l.want - l.have
        if (all > 0) orderPay += (o.coins * (prices[id] * l.want)) / all
      }
    }
    const orderUnits = orders.reduce((n, o) => n + o.lines.filter((l) => l.good === id && l.have < l.want).reduce((m, l) => m + l.want, 0), 0)
    const ordersView = { orders: orderCount, want: orderWant, per: orderUnits > 0 ? orderPay / orderUnits : 0 }

    // your shelves that hold it, and the shop's curve from its lowest price to its highest
    const shelves: ShelfOffer[] = owned
      ? f.market.shelves.slice(0, open).flatMap((s, place) => {
          if (s.good !== id) return []
          const chance = buyChance(s.pct)
          return [{ place, pct: s.pct, units: s.units, per: unitPrice(nowPrice, s.pct), chance, wait: shopWait(chance, every, group) }]
        })
      : []
    const curve: CurvePoint[] = []
    if (owned && !material)
      for (let pct = SHOP.pct.min; pct <= SHOP.pct.max; pct += SHOP.pct.step) {
        const chance = buyChance(pct)
        curve.push({ pct, per: unitPrice(nowPrice, pct), chance, wait: shopWait(chance, every, group) })
      }

    const xpOf = (per: number) => per / 5
    const channels: ChannelView[] = []
    if (material) channels.push({ id: 'contractor', per: CONTRACTOR.buys, low: CONTRACTOR.buys, high: CONTRACTOR.buys, xp: xpOf(CONTRACTOR.buys), bonusXp: 0, gift: 0, gifts: 0, wait: 0 })
    else {
      const gate = nowPrice * buyerMean()
      const standing = wanting.some((v) => v.phase === 'queued')
      channels.push({ id: 'gate', per: gate, low: nowPrice * lowest, high: nowPrice * highest, xp: xpOf(gate), bonusXp: 0, gift: ITEM_ODDS.buyer, gifts: speeds.gifts, wait: standing ? 0 : null })
      const order = nowPrice * ORDERS.markup
      channels.push({ id: 'order', per: order, low: order, high: order, xp: xpOf(order), bonusXp: XP_FOR.order, gift: ITEM_ODDS.order, gifts: speeds.gifts, wait: orderWant > 0 ? 0 : null })
      if (!owned) {
        const per = (nowPrice * managerPct(f.ladders.rate)) / 100
        channels.push({ id: 'manager', per, low: per, high: per, xp: xpOf(per), bonusXp: 0, gift: 0, gifts: 0, wait: 0 })
      } else {
        const pct = shelves[0]?.pct ?? SHOP.pct.start
        const per = unitPrice(nowPrice, pct)
        channels.push({
          id: 'shop',
          per,
          low: unitPrice(nowPrice, SHOP.pct.min),
          high: unitPrice(nowPrice, SHOP.pct.max),
          xp: xpOf(per),
          bonusXp: 0,
          gift: 0,
          gifts: 0,
          wait: shopWait(buyChance(pct), every, group),
        })
      }
    }

    // the last seven days and tomorrow: its machine's level as it is now, each day's mood, the draw on today's alone
    const at = (day: number) => (material ? CONTRACTOR.buys : priceAt(id, more, moodOf(now, id, day)))
    const days = Array.from({ length: 7 }, (_, k) => (k === 6 ? nowPrice : at(now.day - 6 + k)))
    const tomorrow = at(now.day + 1)
    const pct = nowPrice > 0 ? (tomorrow / nowPrice - 1) * 100 : 0

    return {
      id,
      material,
      store: storeOf(id),
      have: f.inv[id] ?? 0,
      known: material || known.has(id),
      locked: !now.allOpen && goodOpensAt(id) > level ? goodOpensAt(id) : null,
      base,
      now: nowPrice,
      move: base > 0 ? (nowPrice / base - 1) * 100 : 0,
      why,
      channels,
      best: pick(channels, 'per'),
      soonest: pick(channels, 'wait'),
      line: lineView,
      orders: ordersView,
      shelves,
      curve,
      asks: { buyer: p.maxAsk, order: material ? 0 : Math.max(1, Math.round(p.maxAsk * 1.5)) },
      buyFor: material ? piecePrice(f.ladders.discount) : null,
      trend: { days, tomorrow, dir: pct > STILL ? 'up' : pct < -STILL ? 'down' : 'flat', pct },
      yours: f.ledger ? perUnit(f.ledger, id, now.day) : Array.from({ length: LEDGER_DAYS }, () => null),
    }
  })

  // the vegetable index: the mood of every crop, the mean, ×100
  const basket = CROPS.map((c) => c.id)
  const indexOn = (day: number) => (100 * basket.reduce((n, c) => n + moodOf(now, c, day), 0)) / basket.length
  const days = Array.from({ length: LEDGER_DAYS }, (_, k) => indexOn(now.day - (LEDGER_DAYS - 1) + k))
  return {
    level,
    events: now.at === null ? [] : activeAt(now.at).map((o) => o.id),
    speeds,
    goods,
    index: { now: days[days.length - 1], days, tomorrow: indexOn(now.day + 1), basket },
  }
}
