import { PRODUCE, STORES, storeCapacity, storeOf, upgradeCost, type ProduceId, type StoreId } from './data'

// The silo and the barn as numbers: what each holds, how much room is left, what its next level costs. Plain
// arithmetic on the farm's goods (src/farm/state.ts keeps them in `farm.inv`, the one record of goods; this never
// changes them), so the tests reach it without a farm.

/** The goods each building keeps. */
export const STORE_GOODS: Record<StoreId, ProduceId[]> = {
  silo: PRODUCE.filter((p) => storeOf(p.id) === 'silo').map((p) => p.id),
  barn: PRODUCE.filter((p) => storeOf(p.id) === 'barn').map((p) => p.id),
}

/** How many goods a building holds now. */
export const usedIn = (inv: Record<ProduceId, number>, store: StoreId) => STORE_GOODS[store].reduce((n, id) => n + (inv[id] ?? 0), 0)

/** How many more it takes: none once it is full (an older save over the limit keeps what it has, and takes no more
 *  until there is room). */
export const roomIn = (inv: Record<ProduceId, number>, levels: Record<StoreId, number>, store: StoreId) => Math.max(0, storeCapacity(levels[store]) - usedIn(inv, store))

/** What the next level of a building costs: as many of each of its three materials as the level it is at. */
export function nextLevel(store: StoreId, level: number) {
  const n = upgradeCost(level)
  return { level: level + 1, capacity: storeCapacity(level + 1), needs: STORES[store].materials.map((item) => ({ item, count: n })) }
}

/** Whether there is enough of every material for the next level. */
export const canUpgrade = (inv: Record<ProduceId, number>, store: StoreId, level: number) => nextLevel(store, level).needs.every((n) => inv[n.item] >= n.count)
