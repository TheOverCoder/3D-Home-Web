import { farmSound } from '../../audio/sound'
import { rewardSound } from '../../audio/rewardSound'
import { goodsFx, itemFx } from '../../fx/fx'
import { count, isItem, storeCapacity, storeOf, STORES, type ItemId, type ProduceId, type StoreId } from '../data'
import { priceOf } from '../prices'
import { canUpgrade, nextLevel, randomItem, roomIn, STORE_GOODS, usedIn } from '../storage'
import { bump, eventSpeed, farm, isSellable, putBack, random, save, toast, type At } from './core'
import { gainXp } from './levels'
import { sold } from './ledger'
import { rewarded } from './rewards'
import { waitingFor } from './ready'

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
 * fit is never thrown away: the caller leaves it where it was (on the animal, in the bed, in the machine). Collected
 * at a place in the world (`at`), what went in flies from there to its building's chip, one picture with how many
 * (src/fx/fx.ts, goodsFx).
 */
export function store(id: ProduceId, n: number, at?: At) {
  const k = Math.max(0, Math.min(n, roomFor(id)))
  farm.inv[id] += k
  if (k) remember(id)
  if (k && at) goodsFx(at.x, at.y, at.z, id, k)
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

// ───────────────────────────── Make room ─────────────────────────────
// A full silo or barn never stands between the player and what waits (update-v1/JOURNEY.md fix 5, farm-games.md P7):
// one press sells, at its fair price, the surplus no buyer in the line and no order wants, just as much as lets what
// waits go in. Nothing is lost for being away, and the first press of a morning is never a refusal.

/** How many of a good the line at the gate and the orders on the board still want. */
function wanted(good: ProduceId): number {
  let n = 0
  for (const v of farm.visitors) if (v.phase !== 'leaving' && v.want === good) n += v.qty
  for (const slot of farm.orders) if ('order' in slot) for (const l of slot.order.lines) if (l.good === good) n += l.want - l.have
  return n
}

/** What Make room would sell now in a building: the surplus nobody wants, the biggest first, as much as lets what waits
 *  go in (none while it fits already: ./ready.ts, waitingFor). Each good with how many and what it pays, and the coins:
 *  whole coins, each good's rounded as every sale rounds (a price may carry a share more: a machine's level, the day's
 *  factor), and at least one. */
export function makeRoomPreview(id: StoreId): { goods: { item: ProduceId; count: number; coins: number }[]; coins: number } {
  let need = waitingFor(id) - room(id)
  const goods: { item: ProduceId; count: number; coins: number }[] = []
  if (need <= 0) return { goods, coins: 0 }
  const spare = STORE_GOODS[id]
    .filter((g) => isSellable(g))
    .map((g) => ({ g, n: farm.inv[g] - wanted(g) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
  for (const { g, n } of spare) {
    if (need <= 0) break
    const k = Math.min(n, need)
    goods.push({ item: g, count: k, coins: Math.round(k * priceOf(g)) })
    need -= k
  }
  return {
    goods,
    coins: goods.length
      ? Math.max(
          1,
          goods.reduce((sum, x) => sum + x.coins, 0),
        )
      : 0,
  }
}

/** Make room: sells at fair price, in one press, the surplus of a building that no buyer or order wants, until what
 *  waits fits (makeRoomPreview). A sale like any other: XP for its coins, counted once, in the sales book. The coins. */
export function makeRoom(id: StoreId, at?: At): number {
  const { goods, coins } = makeRoomPreview(id)
  if (!goods.length) return 0
  for (const g of goods) farm.inv[g.item] -= g.count
  const units = goods.reduce((n, g) => n + g.count, 0)
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + coins)
  farm.stats.sold += units
  farm.stats.earned += coins
  // a sale like every sale: worth its coins in XP, and the toast says so (what went, the coins, the XP)
  const xp = gainXp('sale', coins, at)
  const tier = rewarded('sale', [{ coins }], at)
  for (const g of goods) sold('manager', g.item, g.count, g.coins)
  const went = goods.map((g) => count(g.item, g.count)).join(', ')
  toast(`${STORES[id].name}: sold ${went} to make room · +${coins} coins${xp ? ` · +${xp} XP` : ''}`, goods[0].item)
  rewardSound('sale', tier)
  bump()
  save()
  return coins
}
