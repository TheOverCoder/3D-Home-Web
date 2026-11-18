import { MACHINE_IDS, PRODUCER_IDS, PRODUCERS, storeOf, XP_FOR, type CropId, type ProduceId, type StoreId } from '../data'
import { boostOf } from '../machines'
import { farm } from './core'
import { roomFor } from './stores'
import { bedStage, yieldOf } from './beds'
import { machineDone } from './machines'

// What is ready on the farm, across the beds, the producers and the machines: what waits for room in a building, and
// what collecting would give the most XP.

/** How many goods wait for room in a building: ripe in the beds and on the lemon tree (the silo); on the animals and
 *  in the machines (the barn). */
export function waitingFor(id: StoreId) {
  let n = 0
  if (id === 'silo') farm.beds.forEach((b, i) => (n += bedStage(i) === 'ripe' && b.crop ? yieldOf(b.crop) : 0))
  for (const p of PRODUCER_IDS) if (storeOf(PRODUCERS[p].good) === id) n += farm.producers[p].stock.reduce((a, b) => a + b, 0)
  for (const m of MACHINE_IDS) for (const g of machineDone(m)) if (storeOf(g.item) === id) n += g.count
  return n
}

/**
 * What waits to be collected on the farm now, the kind worth the most XP — the ripe beds of one crop (each bed's XP),
 * a tree's or an animal's goods (each good's), a machine's jobs done (each job's, more at its level) — counted only
 * where its building has room for all of it; null when nothing does. For the level's card: how far collecting it
 * takes the bar (its own numbers: XP_FOR, as collecting gives).
 */
export function readyOnFarm(): { id: ProduceId; n: number; xp: number } | null {
  let best: { id: ProduceId; n: number; xp: number } | null = null
  const consider = (id: ProduceId, n: number, xp: number) => {
    if (n > 0 && xp > 0 && roomFor(id) >= n && (!best || xp > best.xp)) best = { id, n, xp }
  }
  const beds = new Map<CropId, number>()
  farm.beds.forEach((b, i) => {
    if (b.crop && bedStage(i) === 'ripe') beds.set(b.crop, (beds.get(b.crop) ?? 0) + 1)
  })
  for (const [crop, k] of beds) consider(crop, k * yieldOf(crop), k * XP_FOR.harvest)
  for (const id of PRODUCER_IDS) {
    const n = farm.producers[id].stock.reduce((a, b) => a + b, 0)
    consider(PRODUCERS[id].good, n, n * XP_FOR.collect)
  }
  for (const id of MACHINE_IDS) {
    // a job makes one good; its XP as collecting gives it (gainXp's share more, rounded up)
    const more = boostOf(farm.machines[id]).xp
    for (const g of machineDone(id)) consider(g.item, g.count, more > 0 ? Math.ceil(XP_FOR.make * g.count * (1 + more) - 1e-9) : XP_FOR.make * g.count)
  }
  return best
}
