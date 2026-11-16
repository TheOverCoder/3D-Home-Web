import { CROPS, MACHINES, PRODUCERS, type MachineId, type ProduceId, type ProducerId } from './data'
import type { BedState } from './state'

// "Show me" on the order board (src/farm/orderBoard): where a good an order asks for is made, as the interactables the
// walk-to takes you to (src/lib/route/walking.ts, walkTo) — the same places the compass marks. A crop grows in a bed,
// an animal's good is on the animal (each cow, each sheep), a fruit on its tree or bush (each one standing), the lemons
// on the lemon tree, the eggs in the nest, what a machine makes at the machine. Only what is there now counts (the ids
// registered on the map you are on), so a good of the farm has no place while you are in the house.

const isCrop = (good: ProduceId) => CROPS.some((c) => c.id === good)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The interactables a good comes from, among `ids` (those registered now). A crop: the built beds growing it; with
 * none, the empty ones set to always grow it; with none, every empty built bed (where it can be planted). A
 * producer's good: its place, or each of its animals or plants. A machine's good: the machine. None: [].
 */
export function placesOf(good: ProduceId, beds: readonly BedState[], ids: readonly string[]): string[] {
  const has = new Set(ids)
  if (isCrop(good)) {
    const bedsWhere = (ok: (b: BedState) => boolean) => beds.flatMap((b, i) => (b.built && ok(b) && has.has(`farm-bed-${i}`) ? [`farm-bed-${i}`] : []))
    for (const group of [bedsWhere((b) => b.crop === good), bedsWhere((b) => !b.crop && b.fixed === good), bedsWhere((b) => !b.crop)]) if (group.length) return group
    return []
  }
  for (const [, p] of Object.entries(PRODUCERS) as [ProducerId, (typeof PRODUCERS)[ProducerId]][]) {
    if (p.good !== good) continue
    // the place itself (the nest, the lemon tree), or one of its animals or plants (farm-cow-0, farm-apple-tree-2)
    const one = new RegExp(`^${escape(p.action)}(-\\d+)?$`)
    return ids.filter((id) => one.test(id))
  }
  for (const [id, m] of Object.entries(MACHINES) as [MachineId, (typeof MACHINES)[MachineId]][]) if (m.recipes.some((r) => r.makes === good)) return has.has(`farm-${id}`) ? [`farm-${id}`] : []
  return []
}

/** Of the places a good comes from, the one to go to: the nearest of those with it ready to take, else the nearest. */
export function nearestPlace(places: readonly { id: string; ready: boolean; d: number }[]): string | null {
  const ready = places.filter((p) => p.ready)
  const pool = ready.length ? ready : places
  let best: { id: string; d: number } | null = null
  for (const p of pool) if (!best || p.d < best.d) best = p
  return best?.id ?? null
}
