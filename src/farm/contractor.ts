// The contractor behind the market (CONTRACTOR, HOURS in ./data; state in src/farm/state.ts): there in the morning, at
// noon and in the evening. He buys building materials, and sells a few pieces a day — first the ones the next level
// of the silo or the barn is shortest of, so what he has is what you need. Pure.

import { CONTRACTOR, ITEMS, LADDERS, STORE_IDS, type ItemId, type ProduceId, type StoreId } from './data'
import { nextLevel, randomItem } from './storage'

/** The contractor in the save: the day his offers are for, and each offer (a material, and whether you bought it). */
export interface Contractor {
  day: number
  offers: { item: ItemId; sold: boolean }[]
}

/** Pieces a day after `stock` steps; a piece's price after `discount` steps. */
export const offersPerDay = (stock: number) => CONTRACTOR.offers + stock
export const piecePrice = (discount: number) => CONTRACTOR.sells - CONTRACTOR.discountStep * discount

/** The materials the next levels of the silo and the barn are short of, the shortest first (the same measure the
 *  goals' rewards use, src/farm/goals.ts goalReward). */
export function shortMaterials(f: { inv: Record<ProduceId, number>; storage: Record<StoreId, number> }): ItemId[] {
  const short = new Map<ItemId, number>()
  for (const store of STORE_IDS)
    for (const need of nextLevel(store, f.storage[store]).needs) {
      const s = need.count - (f.inv[need.item] ?? 0)
      if (s > 0) short.set(need.item as ItemId, Math.max(short.get(need.item as ItemId) ?? 0, s))
    }
  return [...short.entries()].sort((a, b) => b[1] - a[1]).map(([item]) => item)
}

/** A count read back: a whole number, at least 0 (not a number: 0). */
const whole = (n: number) => (n > 0 ? Math.floor(n) : 0)

/** A day's `n` offers (never more than the most a day can have): the short materials first (each once), the rest at
 *  random (the farm's dice). */
export function dailyOffers(f: { inv: Record<ProduceId, number>; storage: Record<StoreId, number> }, n: number, rand: () => number): ItemId[] {
  const count = Math.min(whole(n), offersPerDay(LADDERS.stock.levels))
  const out = shortMaterials(f).slice(0, count)
  while (out.length < count) out.push(randomItem(rand))
  return out
}

/** The saved contractor read back: a whole day (-1: none yet, so the next day seen makes its offers), only materials,
 *  never more offers than the day allows. */
export function sanitizeContractor(raw: unknown, perDay: number): Contractor {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Contractor>
  const day = typeof r.day === 'number' && Number.isFinite(r.day) ? Math.max(-1, Math.floor(r.day)) : -1
  const offers = (Array.isArray(r.offers) ? r.offers : [])
    .filter((o): o is { item: ItemId; sold: boolean } => !!o && typeof o === 'object' && (ITEMS as readonly string[]).includes((o as { item: string }).item))
    .slice(0, whole(perDay))
    .map((o) => ({ item: o.item, sold: o.sold === true }))
  return { day, offers }
}
