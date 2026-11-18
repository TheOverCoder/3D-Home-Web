import { farmSound } from '../../audio/sound'
import { itemFx } from '../../fx/fx'
import { count, isItem, storeCapacity, storeOf, STORES, type ItemId, type ProduceId, type StoreId } from '../data'
import { canUpgrade, nextLevel, randomItem, roomIn, usedIn } from '../storage'
import { bump, eventSpeed, farm, putBack, random, save, toast } from './core'
import { gainXp } from './levels'

// The silo and the barn: how full each is, goods going in while there is room, surprises (always taken in), and
// making a building bigger.

/** A building's level (1: 50 goods). */
export const storeLevel = (id: StoreId) => farm.storage[id]
/** How many goods a building holds at its level. */
export const capacity = (id: StoreId) => storeCapacity(farm.storage[id])
/** How many it holds now. */
export const used = (id: StoreId) => usedIn(farm.inv, id)
/** How many more it takes (none once full). */
export const room = (id: StoreId) => roomIn(farm.inv, farm.storage, id)
/** Room for a good where it is kept. */
export const roomFor = (good: ProduceId) => room(storeOf(good))
/** A building is full. */
export const isFull = (id: StoreId) => room(id) <= 0

const remember = (id: ProduceId) => {
  if (!farm.made.includes(id) && !isItem(id)) farm.made.push(id)
}

/**
 * Puts goods that were collected into their building, as many as it has room for: how many went in. What does not
 * fit is never thrown away: the caller leaves it where it was (on the animal, in the bed, in the machine).
 */
export function store(id: ProduceId, n: number) {
  const k = Math.max(0, Math.min(n, roomFor(id)))
  farm.inv[id] += k
  if (k) remember(id)
  return k
}

/** What the toast says about surprises, after what else it says ("· Surprise: a brick"). */
export const surpriseWords = (items: ItemId[]) => (items.length ? ` · Surprise: ${[...new Set(items)].map((i) => count(i, items.filter((x) => x === i).length)).join(', ')}` : '')

/** Surprises into the barn (always: they are what makes it bigger), each flying up from where it was found to the
 *  barn's chip at the top. */
export function gainItems(items: ItemId[], at?: { x: number; y: number; z: number }) {
  for (const item of items) {
    putBack(item, 1)
    farm.got[item] += 1
  }
  if (!items.length) return
  if (at) items.forEach((item, k) => itemFx(at.x, at.y, at.z, item, k))
  farmSound('surprise')
}

/** The gifts a buyer or an order brings with it, each a building material on the farm's dice: one, two on gift day. */
export const rollGifts = () => Array.from({ length: eventSpeed('gifts') }, () => randomItem(random))

/** The next level of a building: as many of each of its three materials as its level now, for 50 more goods. */
export const nextStoreLevel = (id: StoreId) => nextLevel(id, farm.storage[id])
export const canUpgradeStore = (id: StoreId) => canUpgrade(farm.inv, id, farm.storage[id])

/** Makes a building bigger with its materials (its card asked first): true when it was. */
export function upgradeStore(id: StoreId) {
  if (!canUpgradeStore(id)) return false
  const next = nextStoreLevel(id)
  for (const n of next.needs) farm.inv[n.item] -= n.count
  farm.storage[id] = next.level
  const place = farm.layout.places[STORES[id].place]
  gainXp('build', 1, { x: place.x, y: 3, z: place.z })
  toast(`${STORES[id].name}: level ${next.level} · room for ${next.capacity}`)
  bump()
  save()
  return true
}
