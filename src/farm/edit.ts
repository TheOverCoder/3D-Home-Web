import { create } from 'zustand'
import { playerState } from '../lib/playerState'
import { canPlaceThing, placementOf, snap, thingDoor, thingRect, type Fit, type ParcelId, type PlaceId, type Placement, type Rect, type Thing } from './layout'
import { decorLanding, farm, moveBed, moveDecor, movePlace, useFarm } from './state'

// The edit mode's state: what is picked (a place, a bed or a piece of decoration to move, a field to buy) and where the
// thing being dragged is shown. While a thing is dragged it is drawn where the finger is (a place with its animals, a
// bed with what grows in it), and only goes there when let go where it fits; the farm's layout itself only ever holds
// placements that fit.

export type Pick = { kind: 'place'; id: PlaceId } | { kind: 'parcel'; id: ParcelId } | { kind: 'bed'; index: number } | { kind: 'decor'; id: number }

/** A thing's key: a place's own id ('hens'), a bed's ('bed-3'), a piece of decoration's ('decor-17'). */
export const keyOf = (t: Thing) => (t.kind === 'place' ? t.id : t.kind === 'bed' ? `bed-${t.index}` : `decor-${t.id}`)

/** The thing a pick is about (none for a field). */
export const thingOf = (p: Pick | null): Thing | null =>
  !p || p.kind === 'parcel' ? null : p.kind === 'place' ? { kind: 'place', id: p.id } : p.kind === 'bed' ? { kind: 'bed', index: p.index } : { kind: 'decor', id: p.id }

export interface Drag {
  /** the thing's key (keyOf): a place's own id */
  id: string
  thing: Thing
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

/** Where any thing is drawn right now (null: it is not on the farm). */
export function shownAt(t: Thing): Placement | null {
  const d = useEdit.getState().drag
  return d && d.id === keyOf(t) ? d.at : placementOf(farm.layout, t)
}

/** The same, for a component: re-renders when the place moves or is dragged. */
export function useShownPlacement(id: PlaceId): Placement {
  const committed = useFarm(() => farm.layout.places[id])
  const dragged = useEdit((s) => (s.drag && s.drag.id === id ? s.drag.at : null))
  return dragged ?? committed
}

/** Where a place stands (not where it is dragged): what colliders and interactions follow. */
export const usePlacement = (id: PlaceId) => useFarm(() => farm.layout.places[id])

const asThing = (t: Thing | PlaceId): Thing => (typeof t === 'string' ? { kind: 'place', id: t } : t)

/** Where a thing dragged to (x, z) would land: on the half-metre grid (a fence or hedge joined to a run's end near it). */
function landingFor(t: Thing, x: number, z: number, rot: number): Placement {
  const at = { x: snap(x), z: snap(z), rot }
  return t.kind === 'decor' ? decorLanding(t.id, at) : at
}

/** Shows a thing being dragged at a spot (snapped to the half-metre grid), and whether it would fit there. A place may
 *  be given by its id. */
export function dragTo(thing: Thing | PlaceId, x: number, z: number, rot?: number): Drag | null {
  const t = asThing(thing)
  const now = placementOf(farm.layout, t)
  if (!now) return null
  const at = landingFor(t, x, z, rot ?? now.rot)
  const d: Drag = { id: keyOf(t), thing: t, at, fit: canPlaceThing(farm.layout, t, at) }
  useEdit.getState().setDrag(d)
  return d
}

/** Moves a thing where it fits (the farm's own rules for each: src/farm/state.ts). */
export function moveThing(t: Thing, to: Placement): Fit {
  if (t.kind === 'place') return movePlace(t.id, to)
  if (t.kind === 'bed') return moveBed(t.index, to)
  return moveDecor(t.id, to)
}

const inside = (r: Rect, x: number, z: number, m = 0) => x > r.minX - m && x < r.maxX + m && z > r.minZ - m && z < r.maxZ + m

/** Puts a thing where it was dragged to, if it fits there; otherwise it goes back and says why. */
export function drop(): Fit | null {
  const e = useEdit.getState()
  const d = e.drag
  if (!d) return null
  const fit = moveThing(d.thing, d.at)
  e.setDrag(null)
  e.setNote(fit.ok ? null : (fit.reason ?? null))
  if (fit.ok) keepPlayerClear(d.thing)
  return fit
}

/** Turns a thing a quarter turn where it stands (if it fits turned). A place may be given by its id. */
export function turn(thing: Thing | PlaceId): Fit {
  const t = asThing(thing)
  const p = placementOf(farm.layout, t)
  if (!p) return { ok: false, reason: 'Not on the farm' }
  const fit = moveThing(t, { ...p, rot: (p.rot + 1) % 4 })
  useEdit.getState().setNote(fit.ok ? null : (fit.reason ?? null))
  if (fit.ok) keepPlayerClear(t)
  return fit
}

/** Something just went up where you stand: step out of it (to its way in, or just beside it). Flat things (a path) are
 *  walked on. */
export function keepPlayerClear(t: Thing) {
  const p = placementOf(farm.layout, t)
  const r = p ? thingRect(farm.layout, t, p) : null
  if (!p || !r) return
  if (t.kind === 'decor') {
    const d = farm.layout.decor.find((x) => x.id === t.id)
    if (d && (d.kind === 'path' || d.kind === 'stones' || d.kind === 'flowers')) return
  }
  const me = playerState.position
  if (!inside(r, me.x, me.z, 0.45)) return
  const door = thingDoor(farm.layout, t, p)
  if (door) {
    playerState.moveTo = { x: (door.minX + door.maxX) / 2, y: me.y + 0.2, z: (door.minZ + door.maxZ) / 2 }
    return
  }
  // to the nearest side
  const d = [me.x - r.minX, r.maxX - me.x, me.z - r.minZ, r.maxZ - me.z]
  const m = Math.min(...d)
  const x = m === d[0] ? r.minX - 0.6 : m === d[1] ? r.maxX + 0.6 : me.x
  const z = m === d[2] ? r.minZ - 0.6 : m === d[3] ? r.maxZ + 0.6 : me.z
  playerState.moveTo = { x, y: me.y + 0.2, z }
}
