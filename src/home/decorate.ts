import { create } from 'zustand'
import { ROOMS, roomAt, type RoomId } from '../data/layout'
import type { Fit } from '../farm/layout'
import { buyPiece, farm, placeStored, restoreHome } from '../farm/state'
import { farmFx } from '../fx/fx'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { movePieceTo, putAway, turnPiece } from './actions'
import { PIECES, type PieceType } from './catalogue'
import { canPlacePiece, findFreeSpot, footprint, roomFull, snapPiece, type HomeLayout, type HomePiece } from './layout'

// The house's decorate mode, its state (the scene is src/home/DecorateMode.tsx, the controls DecoratePanel.tsx):
// which piece is picked, the one being dragged and whether it fits where it is, why the last move did not happen,
// the room in view, and what undo goes back to. The layout itself only ever holds placements that fit: a drag is
// drawn where the finger is, and only lands where it is green.

export interface PieceDrag {
  id: string
  at: HomePiece
  fit: Fit
}

interface DecorateState {
  picked: string | null
  drag: PieceDrag | null
  /** why the last move or turn did not happen ("On the sofa — it went back") */
  note: string | null
  room: RoomId
  /** the house as it was before each change, newest last (this visit only); going back past a purchase refunds it */
  undo: { home: HomeLayout; refund?: number }[]
  pick: (id: string | null) => void
  setDrag: (drag: PieceDrag | null) => void
  setNote: (note: string | null) => void
  setRoom: (room: RoomId) => void
}

export const useDecorate = create<DecorateState>()((set) => ({
  picked: null,
  drag: null,
  note: null,
  room: 'living',
  undo: [],
  pick: (picked) => set({ picked, note: null }),
  setDrag: (drag) => set({ drag }),
  setNote: (note) => set({ note }),
  setRoom: (room) => set({ room }),
}))

/** The middle of the decorate view on the floor (src/home/DecorateMode.tsx keeps it): the walls between it and the
 *  camera fade (src/scene/Walls.tsx). */
export const decorateFocus = { x: 0, z: 0 }
/** Where the decorate view's camera is (it moves after the walls have looked: they go by this, a frame behind). */
export const decorateEye = { x: 0, y: 0, z: 0 }

const pieceById = (id: string) => farm.home.pieces.find((p) => p.id === id)

/** A puff of dust round a piece just put down, from the edge of its footprint. */
function dustUnder(id: string) {
  const p = pieceById(id)
  if (!p) return
  const r = footprint(p)
  farmFx('dust', (r.minX + r.maxX) / 2, 0.03, (r.minZ + r.maxZ) / 2, { half: { x: (r.maxX - r.minX) / 2, z: (r.maxZ - r.minZ) / 2 } })
}
const remember = (refund?: number) => useDecorate.setState((s) => ({ undo: [...s.undo.slice(-29), { home: farm.home, refund }] }))
const forget = () => useDecorate.setState((s) => ({ undo: s.undo.slice(0, -1) }))

/** Opens the decorate mode over the room you are in. */
export function startDecorating() {
  const room = roomAt(playerState.position.x, playerState.position.z) ?? 'living'
  useDecorate.setState({ picked: null, drag: null, note: null, room, undo: [] })
  useHome.getState().setDecorating(true)
}

/** The edit mode for where you are (the ✥ button, B): indoors this one, outdoors the farm's. */
export function openEdit() {
  if (useHome.getState().outdoors) useHome.getState().setEditing(true)
  else startDecorating()
}

/** Leaves it: you step out of anything that now stands where you were. */
export function stopDecorating() {
  useDecorate.setState({ picked: null, drag: null, note: null, undo: [] })
  useHome.getState().setDecorating(false)
  keepPlayerClear()
}

/** Whether a piece can be picked up at all (the kitchen is built in). */
export const movable = (id: string) => {
  const p = pieceById(id)
  return !!p && !PIECES[p.type].fitted
}

/** Where a dragged piece goes for a point on the floor (snapped to the grid and to walls), and whether it fits there. */
export function dragPiece(id: string, x: number, z: number) {
  const p = pieceById(id)
  if (!p) return
  const at = snapPiece(p, x, z)
  const last = useDecorate.getState().drag
  if (last && last.id === id && last.at.x === at.x && last.at.z === at.z && last.at.rot === at.rot) return
  useDecorate.getState().setDrag({ id, at, fit: canPlacePiece(farm.home, at) })
}

/** Lets go of the dragged piece: it stays where it is green, and goes back (saying why) where it is red. */
export function dropPiece(): Fit | null {
  const { drag } = useDecorate.getState()
  if (!drag) return null
  useDecorate.setState({ drag: null })
  const p = pieceById(drag.id)
  if (!p || (p.x === drag.at.x && p.z === drag.at.z && p.rot === drag.at.rot)) return { ok: true }
  if (!drag.fit.ok) {
    useDecorate.getState().setNote(`${drag.fit.reason} — it went back`)
    return drag.fit
  }
  remember()
  const fit = movePieceTo(drag.id, drag.at)
  if (!fit.ok) {
    forget()
    useDecorate.getState().setNote(`${fit.reason} — it went back`)
  } else {
    useDecorate.getState().setNote(null)
    dustUnder(drag.id)
  }
  return fit
}

/** Turns the picked piece a quarter turn where it stands (if it fits turned). */
export function turnPicked(by: 1 | -1 = 1): Fit | null {
  const id = useDecorate.getState().picked
  if (!id || !movable(id)) return null
  remember()
  const fit = turnPiece(id, by)
  if (!fit.ok) forget()
  useDecorate.getState().setNote(fit.ok ? null : (fit.reason ?? null))
  return fit
}

/** Puts the picked piece away into storage (and what stood on it down on the floor). */
export function putAwayPicked() {
  const id = useDecorate.getState().picked
  if (!id || !movable(id)) return false
  remember()
  if (!putAway(id)) {
    forget()
    return false
  }
  useDecorate.setState({ picked: null, note: null })
  return true
}

/** Stands a piece from storage at the free spot nearest the middle of the room in view, picked so a drag moves it. */
export function placeFromStorage(type: PieceType): boolean {
  const room = useDecorate.getState().room
  const spot = findFreeSpot(farm.home, type, room)
  if (!spot) {
    useDecorate.getState().setNote(roomFull(farm.home, room, type) ? 'This room is full' : `No room for the ${PIECES[type].name.toLowerCase()} in the ${ROOMS[room].name.toLowerCase()}`)
    return false
  }
  remember()
  const r = placeStored(type, spot)
  if (!r.ok || !r.id) {
    forget()
    useDecorate.getState().setNote(r.reason ?? null)
    return false
  }
  useDecorate.setState({ picked: r.id, note: null })
  dustUnder(r.id)
  return true
}

/** Buys a piece (the shop's Buy, after its card) and stands it in the room in view, picked; with no room it waits in
 *  storage. Undo takes it back to the shop, coins and all, until you leave. */
export function buyFurniture(type: PieceType): boolean {
  const price = PIECES[type].price
  remember(price)
  if (!buyPiece(type)) {
    forget()
    return false
  }
  if (!placeFromStorage(type)) useDecorate.getState().setNote(`Bought — it is in storage: ${roomFull(farm.home, useDecorate.getState().room, type) ? 'this room is full' : 'no room for it here'}`)
  return true
}

/** Back one step (a move, a turn, a put-away, a placing, a purchase: its coins come back). */
export function undo() {
  const { undo: stack } = useDecorate.getState()
  const last = stack[stack.length - 1]
  if (!last) return false
  useDecorate.setState({ undo: stack.slice(0, -1), drag: null, note: null })
  restoreHome(last.home, last.refund)
  if (useDecorate.getState().picked && !pieceById(useDecorate.getState().picked!)) useDecorate.setState({ picked: null })
  return true
}

/** After decorating: if a piece now stands where you are, step to the nearest free floor beside it. */
function keepPlayerClear() {
  const me = playerState.position
  const BODY = 0.4
  const blocked = (x: number, z: number) =>
    farm.home.pieces.some((p) => {
      if (PIECES[p.type].layer !== 'floor') return false
      const r = footprint(p)
      return x > r.minX - BODY && x < r.maxX + BODY && z > r.minZ - BODY && z < r.maxZ + BODY
    })
  if (!blocked(me.x, me.z)) return
  const room = roomAt(me.x, me.z)
  for (let d = 0.25; d <= 4; d += 0.25)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const x = me.x + Math.cos(a) * d
      const z = me.z + Math.sin(a) * d
      const b = room ? ROOMS[room].bounds : null
      if (b && (x < b.minX + 0.45 || x > b.maxX - 0.45 || z < b.minZ + 0.45 || z > b.maxZ - 0.45)) continue
      if (!blocked(x, z)) {
        playerState.moveTo = { x, y: me.y + 0.2, z }
        return
      }
    }
}
