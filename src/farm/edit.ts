import { create } from 'zustand'
import { playerState } from '../lib/playerState'
import { canPlace, doorway, footprint, snap, type Fit, type ParcelId, type PlaceId, type Placement, type Rect } from './layout'
import { farm, movePlace, useFarm } from './state'

// The edit mode's state: what is picked (a place to move, a field to buy) and where the place being dragged is
// shown. While a place is dragged it is drawn where the finger is (with its animals), and only goes there when
// let go where it fits; the farm's layout itself only ever holds placements that fit.

export type Pick = { kind: 'place'; id: PlaceId } | { kind: 'parcel'; id: ParcelId }

export interface Drag {
  id: PlaceId
  at: Placement
  fit: Fit
}

interface EditState {
  picked: Pick | null
  drag: Drag | null
  /** why the last move did not happen ("On a garden bed"), shown until the next try */
  note: string | null
  pick(p: Pick | null): void
  setDrag(d: Drag | null): void
  setNote(n: string | null): void
}

export const useEdit = create<EditState>()((set) => ({
  picked: null,
  drag: null,
  note: null,
  pick: (picked) => set({ picked, note: null }),
  setDrag: (drag) => set({ drag }),
  setNote: (note) => set({ note }),
}))

/** Where a place is drawn right now: where it is being dragged, else where it stands. */
export function shownPlacement(id: PlaceId): Placement {
  const d = useEdit.getState().drag
  return d && d.id === id ? d.at : farm.layout.places[id]
}

/** The same, for a component: re-renders when the place moves or is dragged. */
export function useShownPlacement(id: PlaceId): Placement {
  const committed = useFarm(() => farm.layout.places[id])
  const dragged = useEdit((s) => (s.drag && s.drag.id === id ? s.drag.at : null))
  return dragged ?? committed
}

/** Where a place stands (not where it is dragged): what colliders and interactions follow. */
export const usePlacement = (id: PlaceId) => useFarm(() => farm.layout.places[id])

/** Shows a place being dragged at a spot (snapped to the half-metre grid), and whether it would fit there. */
export function dragTo(id: PlaceId, x: number, z: number, rot = farm.layout.places[id].rot): Drag {
  const at = { x: snap(x), z: snap(z), rot }
  const d = { id, at, fit: canPlace(farm.layout, id, at) }
  useEdit.getState().setDrag(d)
  return d
}

const inside = (r: Rect, x: number, z: number, m = 0) => x > r.minX - m && x < r.maxX + m && z > r.minZ - m && z < r.maxZ + m

/** Puts a place where it was dragged to, if it fits there; otherwise it goes back and says why. */
export function drop(): Fit | null {
  const e = useEdit.getState()
  const d = e.drag
  if (!d) return null
  const fit = movePlace(d.id, d.at)
  e.setDrag(null)
  e.setNote(fit.ok ? null : (fit.reason ?? null))
  if (fit.ok) keepPlayerClear(d.id)
  return fit
}

/** Turns a place a quarter turn where it stands (if it fits turned). */
export function turn(id: PlaceId): Fit {
  const p = farm.layout.places[id]
  const fit = movePlace(id, { ...p, rot: (p.rot + 1) % 4 })
  useEdit.getState().setNote(fit.ok ? null : (fit.reason ?? null))
  if (fit.ok) keepPlayerClear(id)
  return fit
}

/** Something just went up where you stand: step out of it (to its way in, or just beside it). */
function keepPlayerClear(id: PlaceId) {
  const p = farm.layout.places[id]
  const r = footprint(id, p)
  const me = playerState.position
  if (!inside(r, me.x, me.z, 0.45)) return
  const door = doorway(id, p)
  if (door) {
    playerState.moveTo = { x: (door.minX + door.maxX) / 2, y: me.y + 0.2, z: (door.minZ + door.maxZ) / 2 }
    return
  }
  // a tree: to the nearest side
  const d = [me.x - r.minX, r.maxX - me.x, me.z - r.minZ, r.maxZ - me.z]
  const m = Math.min(...d)
  const x = m === d[0] ? r.minX - 0.6 : m === d[1] ? r.maxX + 0.6 : me.x
  const z = m === d[2] ? r.minZ - 0.6 : m === d[3] ? r.maxZ + 0.6 : me.z
  playerState.moveTo = { x, y: me.y + 0.2, z }
}
