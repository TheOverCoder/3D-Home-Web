import { allInteractables, groundDistance, interactable } from '../lib/interaction'
import { playerState } from '../lib/playerState'
import type { ProduceId } from './data'
import { nearestPlace, placesOf } from './orderPlace'
import { bedBox, bedSpot, bedStage, contractorHere, farm, type BedStage } from './state'

// Where a tap walks you (src/lib/route/walking.ts, walkTo, as a compass mark tapped does): to where a good comes from
// (the order board's "Show me"), and to a new farm's next step and each of its turns (the step hint, ./FirstSteps.tsx).
// Each answers an interactable's id among those registered now (the map you are on), or null when there is none.

/** Where a tap walks you, as data: an interactable by its id; where a good comes from (`placeFor` beside the order
 *  board's "Show me": the nearest with it ready, else the nearest); or the nearest bed at the first of these stages the
 *  farm has one at. One type for every walk a tap starts (a step, a turn of one, a goal's way there). */
export type Target = { id: string } | { good: ProduceId } | { bed: readonly BedStage[] }

/** Where to walk to for a good: the nearest place it is made with it ready to take, else the nearest (null: none on
 *  this map; a building material: the contractor, while he is in). */
export function placeFor(good: ProduceId): string | null {
  const from = playerState.position
  return nearestPlace(
    placesOf(
      good,
      farm.beds,
      allInteractables().map((d) => d.id),
      contractorHere(),
    ).map((id) => {
      const def = interactable(id)!
      const r = def.ready?.()
      return { id, ready: !!r && r.item === good, d: groundDistance(from.x, from.z, def.position, def.box) }
    }),
  )
}

/** The nearest bed (from `from`) at the first of these stages the farm has one at, among the beds on the map. */
export function nearestBed(stages: readonly BedStage[], from: { x: number; z: number }): string | null {
  for (const stage of stages) {
    let best: { id: string; d: number } | null = null
    for (let i = 0; i < farm.beds.length; i++) {
      if (bedStage(i) !== stage || !interactable(`farm-bed-${i}`)) continue
      const d = groundDistance(from.x, from.z, bedSpot(i), bedBox(i))
      if (!best || d < best.d) best = { id: `farm-bed-${i}`, d }
    }
    if (best) return best.id
  }
  return null
}

/** Where a tap walks you (Target): its interactable while it is there, where its good comes from, or the nearest bed at
 *  the first of its stages the farm has; null with none (the hint shakes). */
export function walkTarget(t: Target): string | null {
  if ('id' in t) return interactable(t.id) ? t.id : null
  if ('good' in t) return placeFor(t.good)
  return nearestBed(t.bed, playerState.position)
}
