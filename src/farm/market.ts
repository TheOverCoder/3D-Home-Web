// The supermarket's rules (MANAGER, SHOP and LADDERS in ./data; state in src/farm/state.ts): what the manager pays,
// what a place on your shelves sells for, how likely a shopper is to take each unit, and the saved market read back.
// Pure: nothing here changes the farm.

import { LADDERS, LADDER_IDS, MANAGER, SELLABLE, SHOP, produceById, type LadderId, type ProduceId } from './data'

/** One place on the shelves: its good (kept when it sells out, as a bed keeps its crop), how many units, its price in
 *  percent of the good's fair price. */
export interface Shelf {
  good: ProduceId | null
  units: number
  pct: number
}
/** The market in the save: whether the shop is yours, its shelves (all ten; those past the places open hold nothing),
 *  the till (what shoppers paid, waiting at the counter), and the seconds to the next visit. */
export interface Market {
  owned: boolean
  shelves: Shelf[]
  till: { coins: number; goods: number }
  nextIn: number
}
export const MAX_PLACES = SHOP.places + LADDERS.places.levels

/** What the manager pays, in percent, after `rate` steps of his ladder. */
export const managerPct = (rate: number) => MANAGER.pct + MANAGER.pctStep * rate
/** What he pays for `qty` of a good worth `price` each, at `pct`%: rounded down (a sale of nothing is not offered). */
export const managerPay = (price: number, qty: number, pct: number) => Math.floor((price * qty * pct) / 100)

/** What step `k` of a ladder costs (the first step is k = 0). */
export const ladderPrice = (id: LadderId, k: number) => LADDERS[id].price[0] + LADDERS[id].price[1] * k
/** The ladders of your own shop: none can be climbed before the shop is yours. */
export const SHOP_LADDERS: readonly LadderId[] = ['places', 'group', 'pace']
/** Saved ladder levels read back: whole numbers from 0 to each ladder's top. Given `owned: false` (the shop is not
 *  yours), the shop's own ladders are 0 too. */
export function clampLevels(raw: unknown, owned?: boolean): Record<LadderId, number> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = {} as Record<LadderId, number>
  for (const id of LADDER_IDS) {
    const v = r[id]
    out[id] = typeof v === 'number' && Number.isFinite(v) && !(owned === false && SHOP_LADDERS.includes(id)) ? Math.max(0, Math.min(LADDERS[id].levels, Math.floor(v))) : 0
  }
  return out
}

/** How many places are open, after `places` steps of that ladder. */
export const placesOpen = (places: number) => SHOP.places + places
/** A unit's price on the shelf, at `pct`% of its fair price `price` (at least one coin). */
export const unitPrice = (price: number, pct: number) => Math.max(1, Math.round((price * pct) / 100))
/** A shopper's chance to take a unit priced at `pct`%: SHOP.chance.atMin at the lowest price, falling the same share
 *  for every step up, to SHOP.chance.atMax at the highest. */
export const buyChance = (pct: number) => {
  const { min, max } = SHOP.pct
  const { atMin, atMax } = SHOP.chance
  const s = Math.max(0, Math.min(1, (pct - min) / (max - min))) || 0
  return atMin * (atMax / atMin) ** s
}
/** Seconds between visits after `pace` steps; how many shoppers a visit brings after `group` steps. */
export const shopperEvery = (pace: number) => SHOP.every - SHOP.faster * pace
export const shoppersAtOnce = (group: number) => 1 + group
/** A price in range, on its step. */
export const snapPct = (pct: number) => {
  const { min, max, step, start } = SHOP.pct
  if (!Number.isFinite(pct)) return start
  return Math.max(min, Math.min(max, min + Math.round((pct - min) / step) * step))
}

/** What one shopper buys: every unit on the open places is looked at once and taken with its chance (the farm's dice,
 *  so tests can decide). Returns each place's units taken and the coins they pay. The shelves are not changed here. */
export function rollShopper(shelves: readonly Shelf[], open: number, rand: () => number): { taken: number[]; coins: number; units: number } {
  const taken = shelves.map(() => 0)
  let coins = 0
  let units = 0
  for (let k = 0; k < Math.min(open, shelves.length); k++) {
    const s = shelves[k]
    if (!s.good || s.units <= 0) continue
    const p = buyChance(s.pct)
    for (let u = 0; u < s.units; u++)
      if (rand() < p) {
        taken[k]++
        units++
        coins += unitPrice(produceById(s.good).price, s.pct)
      }
  }
  return { taken, coins, units }
}

const emptyShelf = (): Shelf => ({ good: null, units: 0, pct: SHOP.pct.start })
export const freshMarket = (): Market => ({ owned: false, shelves: Array.from({ length: MAX_PLACES }, emptyShelf), till: { coins: 0, goods: 0 }, nextIn: SHOP.every })

/** The saved market read back: every number whole and in range; ten shelves; a closed place holds nothing; a shop not
 *  yours has empty shelves and an empty till; only goods that sell go on a shelf; an open place keeps its good and
 *  price when sold out. */
export function sanitizeMarket(raw: unknown, ladders: Record<LadderId, number>): Market {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Market>
  const int = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), Number.MAX_SAFE_INTEGER) : d)
  const owned = r.owned === true
  const levels = clampLevels(ladders)
  const open = owned ? placesOpen(levels.places) : 0
  const saved = Array.isArray(r.shelves) ? r.shelves : []
  const shelves = Array.from({ length: MAX_PLACES }, (_, k): Shelf => {
    const s = (saved[k] ?? {}) as Partial<Shelf>
    if (k >= open) return emptyShelf()
    const good = typeof s.good === 'string' && SELLABLE.includes(s.good) ? s.good : null
    return { good, units: good ? Math.min(SHOP.units, int(s.units)) : 0, pct: snapPct(typeof s.pct === 'number' ? s.pct : SHOP.pct.start) }
  })
  const till = owned ? { coins: int(r.till?.coins), goods: int(r.till?.goods) } : { coins: 0, goods: 0 }
  const every = shopperEvery(levels.pace)
  return { owned, shelves, till, nextIn: Math.min(every, int(r.nextIn, every)) }
}
