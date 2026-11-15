import { create } from 'zustand'
import { HOUSE, ROOMS, roomAt, type RoomId } from '../data/layout'
import { buyPiece, farm, floorRoom, moveOpening, paintRoom, placeStored, restoreHome } from '../farm/state'
import { farmFx } from '../fx/fx'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { movePieceTo, putAway, turnPiece } from './actions'
import { PIECES, onWall, type PieceType } from './catalogue'
import { canMoveOpening, canPlacePiece, findFreeSpot, footprint, roomFull, snapPiece, type HomeFit, type HomePiece } from './layout'
import { openingById, openingsOf, runById, shellSolids, slideOnRun, type OpeningAt } from './shell'

// The house's decorate mode, its state (the scene is src/home/DecorateMode.tsx, the controls DecoratePanel.tsx):
// what is picked — a piece of furniture, a thing on a wall, or a doorway, a window or the garden door (`opening:<id>`)
// — the one being dragged and whether it fits where it is, why the last move did not happen (or, when it went but
// blocks the way, a word about it), the room in view, which of its sides the card shows (its things, its walls'
// paint, its floor), and what undo goes back to. The layout itself only ever holds placements that fit: a drag is drawn
// where the finger is, and only lands where it is green (or amber: it fits, and blocks something).

export interface PieceDrag {
  id: string
  /** where the piece would go */
  at?: HomePiece
  /** or where the opening would go */
  open?: OpeningAt
  fit: HomeFit
}

export type DecorateTab = 'things' | 'walls' | 'floor'

interface DecorateState {
  picked: string | null
  drag: PieceDrag | null
  /** why the last move or turn did not happen ("On the sofa — it went back"), or what the last one blocks */
  note: string | null
  /** the note is a word of warning (it happened), not a refusal */
  warn: boolean
  room: RoomId
  tab: DecorateTab
  /** the house as it was before each change, newest last (this visit only); going back past a purchase refunds it */
  undo: { home: typeof farm.home; refund?: number }[]
  pick: (id: string | null) => void
  setDrag: (drag: PieceDrag | null) => void
  setNote: (note: string | null, warn?: boolean) => void
  setRoom: (room: RoomId) => void
}

export const useDecorate = create<DecorateState>()((set) => ({
  picked: null,
  drag: null,
  note: null,
  warn: false,
  room: 'living',
  tab: 'things',
  undo: [],
  pick: (picked) => set({ picked, note: null, warn: false }),
  setDrag: (drag) => set({ drag }),
  setNote: (note, warn = false) => set({ note, warn }),
  setRoom: (room) => set({ room }),
}))

/** The middle of the decorate view on the floor (src/home/DecorateMode.tsx keeps it): the walls between it and the
 *  camera fade (src/scene/Walls.tsx). */
export const decorateFocus = { x: 0, z: 0 }
/** Where the decorate view's camera is (it moves after the walls have looked: they go by this, a frame behind). */
export const decorateEye = { x: 0, y: 0, z: 0 }

const pieceById = (id: string) => farm.home.pieces.find((p) => p.id === id)

/** A picked or dragged opening's id (`opening:<id>`), or null for a piece. */
export const OPENING = 'opening:'
export const openingOf = (id: string | null | undefined) => (id && id.startsWith(OPENING) ? id.slice(OPENING.length) : null)

/** A puff of dust round a piece just put down, from the edge of its footprint. */
function dustUnder(id: string) {
  const p = pieceById(id)
  if (!p) return
  const r = footprint(p)
  farmFx('dust', (r.minX + r.maxX) / 2, 0.03, (r.minZ + r.maxZ) / 2, { half: { x: (r.maxX - r.minX) / 2, z: (r.maxZ - r.minZ) / 2 } })
}
/** A puff of plaster dust along a wall where an opening was moved to (or closed). */
function dustAt(id: string) {
  const o = openingsOf(farm.home.shell).find((q) => q.id === id)
  if (!o) return
  const x = o.axis === 'x' ? o.centre : o.at
  const z = o.axis === 'x' ? o.at : o.centre
  farmFx('dust', x, 0.03, z, { half: o.axis === 'x' ? { x: o.width / 2, z: 0.3 } : { x: 0.3, z: o.width / 2 } })
}
const remember = (refund?: number) => useDecorate.setState((s) => ({ undo: [...s.undo.slice(-29), { home: farm.home, refund }] }))
const forget = () => useDecorate.setState((s) => ({ undo: s.undo.slice(0, -1) }))
/** What a move that went says: nothing, or what it blocks. */
const said = (fit: HomeFit) => useDecorate.getState().setNote(fit.warn ?? null, !!fit.warn)

/** Opens the decorate mode over the room you are in. */
export function startDecorating() {
  const room = roomAt(playerState.position.x, playerState.position.z) ?? 'living'
  useDecorate.setState({ picked: null, drag: null, note: null, warn: false, room, tab: 'things', undo: [] })
  useHome.getState().setDecorating(true)
}

/** Which edit mode there is where you are: on the farm the farm's, in the house decorating it; none in its garden. */
export const editHere = (s: { map: 'farm' | 'home' | null; outdoors: boolean }): 'farm' | 'house' | null => (s.map === 'home' ? (s.outdoors ? null : 'house') : 'farm')

/** The edit mode for where you are (the ✥ button, B): on the farm the farm's, in the house this one. */
export function openEdit() {
  const s = useHome.getState()
  const mode = editHere(s)
  if (mode === 'farm') s.setEditing(true)
  else if (mode === 'house') startDecorating()
}

/** Leaves it: you step out of anything that now stands where you were (a piece, or a wall where a doorway was). */
export function stopDecorating() {
  useDecorate.setState({ picked: null, drag: null, note: null, warn: false, undo: [] })
  useHome.getState().setDecorating(false)
  keepPlayerClear()
}

/** Whether a piece can be picked up at all (the kitchen is built in); every opening slides. */
export const movable = (id: string) => {
  if (openingOf(id)) return !!openingById(openingOf(id)!)
  const p = pieceById(id)
  return !!p && !PIECES[p.type].fitted
}

/** Where a dragged piece goes for a point on the floor (snapped to the grid and to walls; one on the wall to the nearest
 *  wall), and whether it fits there. */
export function dragPiece(id: string, x: number, z: number) {
  if (openingOf(id)) return dragOpening(openingOf(id)!, x, z)
  const p = pieceById(id)
  if (!p) return
  const at = snapPiece(p, x, z, farm.home.shell)
  const last = useDecorate.getState().drag
  if (last && last.id === id && last.at && last.at.x === at.x && last.at.z === at.z && last.at.rot === at.rot) return
  useDecorate.getState().setDrag({ id, at, fit: canPlacePiece(farm.home, at) })
}

/** Where a dragged opening goes for a point on the floor: along the nearest of the walls it may be in (a window round the
 *  corner of its room), snapped, and whether it fits there. */
export function dragOpening(id: string, x: number, z: number) {
  const def = openingById(id)
  const now = farm.home.shell.openings[id]
  if (!def || !now) return
  let best: { d: number; at: OpeningAt } | null = null
  for (const r of def.runs) {
    const run = runById(r)!
    const s = slideOnRun(id, run, x, z)
    if (!best || s.distance < best.d - 0.25 || (s.distance < best.d + 0.25 && r === now.run && best.at.run !== now.run))
      best = { d: s.distance, at: { run: run.id, centre: s.centre, closed: now.closed } }
  }
  if (!best) return
  const last = useDecorate.getState().drag
  const key = `${OPENING}${id}`
  if (last && last.id === key && last.open && last.open.run === best.at.run && last.open.centre === best.at.centre) return
  useDecorate.getState().setDrag({ id: key, open: best.at, fit: canMoveOpening(farm.home, id, best.at) })
}

/** Lets go of the dragged piece or opening: it stays where it fits, and goes back (saying why) where it does not. */
export function dropPiece(): HomeFit | null {
  const { drag } = useDecorate.getState()
  if (!drag) return null
  useDecorate.setState({ drag: null })
  const opening = openingOf(drag.id)
  if (opening) {
    const now = farm.home.shell.openings[opening]
    if (!drag.open || (now.run === drag.open.run && now.centre === drag.open.centre)) return { ok: true }
    if (!drag.fit.ok) {
      useDecorate.getState().setNote(`${drag.fit.reason} — it went back`)
      return drag.fit
    }
    return shiftOpening(opening, drag.open)
  }
  const p = pieceById(drag.id)
  if (!p || !drag.at || (p.x === drag.at.x && p.z === drag.at.z && p.rot === drag.at.rot)) return { ok: true }
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
    said(fit)
    dustUnder(drag.id)
  }
  return fit
}

/** Puts an opening somewhere else along its walls, or closes or opens it, if it fits (undo goes back). */
export function shiftOpening(id: string, at: OpeningAt): HomeFit {
  remember()
  const fit = moveOpening(id, at)
  if (!fit.ok) {
    forget()
    useDecorate.getState().setNote(`${fit.reason} — it went back`)
    return fit
  }
  said(fit)
  dustAt(id)
  return fit
}

/** Closes the picked doorway or window (it becomes wall), or opens it again. */
export function toggleOpening(id: string): HomeFit | null {
  const now = farm.home.shell.openings[id]
  const def = openingById(id)
  if (!now || !def || def.kind === 'garden') return null
  const fit = canMoveOpening(farm.home, id, { ...now, closed: !now.closed })
  if (!fit.ok) {
    useDecorate.getState().setNote(fit.reason ?? null)
    return fit
  }
  return shiftOpening(id, { ...now, closed: !now.closed })
}

/** Slides the picked opening a step along its wall (−1 towards the start of its wall, 1 the other way): the nearest
 *  place that fits, up to a metre and a half on. */
export function nudgeOpening(id: string, dir: 1 | -1): HomeFit | null {
  const now = farm.home.shell.openings[id]
  if (!now) return null
  let first: HomeFit | null = null
  for (let k = 1; k <= 15; k++) {
    const at = { ...now, centre: Math.round((now.centre + dir * 0.1 * k) * 1000) / 1000 }
    const fit = canMoveOpening(farm.home, id, at)
    first ??= fit
    if (fit.ok) return shiftOpening(id, at)
  }
  useDecorate.getState().setNote(first?.reason ?? null)
  return first
}

/** Turns the picked piece a quarter turn where it stands (if it fits turned; what hangs on a wall faces out of it). */
export function turnPicked(by: 1 | -1 = 1): HomeFit | null {
  const id = useDecorate.getState().picked
  if (!id || !movable(id) || openingOf(id) || onWall(pieceById(id)!.type)) return null
  remember()
  const fit = turnPiece(id, by)
  if (!fit.ok) forget()
  if (fit.ok) said(fit)
  else useDecorate.getState().setNote(fit.reason ?? null)
  return fit
}

/** Whether the picked piece can be put away (what is built in stays, and the screens). */
export const storable = (id: string) => {
  const p = pieceById(id)
  return !!p && !PIECES[p.type].fitted && !PIECES[p.type].keep
}

/** Puts the picked piece away into storage (and what stood on it down on the floor). */
export function putAwayPicked() {
  const id = useDecorate.getState().picked
  if (!id || !storable(id)) return false
  remember()
  if (!putAway(id)) {
    forget()
    return false
  }
  useDecorate.setState({ picked: null, note: null, warn: false })
  return true
}

/** Stands a piece from storage at the free spot nearest the middle of the room in view (one for the wall on a free
 *  stretch of its walls), picked so a drag moves it. */
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
  useDecorate.setState({ picked: r.id, note: null, warn: false })
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

/** Paints the room in view (null: as it was built). Free, and undo goes back. */
export function paintRoomInView(paint: string | null) {
  const room = useDecorate.getState().room
  if (farm.home.shell.paint[room] === paint) return false
  remember()
  if (!paintRoom(room, paint)) {
    forget()
    return false
  }
  return true
}

/** Lays another floor in the room in view. Free, and undo goes back. */
export function floorRoomInView(floor: string) {
  const room = useDecorate.getState().room
  if (farm.home.shell.floors[room] === floor) return false
  remember()
  if (!floorRoom(room, floor)) {
    forget()
    return false
  }
  const b = ROOMS[room].bounds
  farmFx('dust', (b.minX + b.maxX) / 2, 0.03, (b.minZ + b.maxZ) / 2, { half: { x: (b.maxX - b.minX) / 2 - 0.3, z: (b.maxZ - b.minZ) / 2 - 0.3 } })
  return true
}

/** Back one step (a move, a turn, a put-away, a placing, a purchase: its coins come back; a door, a window, paint, a
 *  floor). */
export function undo() {
  const { undo: stack } = useDecorate.getState()
  const last = stack[stack.length - 1]
  if (!last) return false
  useDecorate.setState({ undo: stack.slice(0, -1), drag: null, note: null, warn: false })
  restoreHome(last.home, last.refund)
  const picked = useDecorate.getState().picked
  if (picked && !openingOf(picked) && !pieceById(picked)) useDecorate.setState({ picked: null })
  return true
}

/** After decorating: if a piece now stands where you are, or a wall (a doorway closed or moved), step to the nearest
 *  free floor beside it, in the house. */
export function keepPlayerClear() {
  const me = playerState.position
  const BODY = 0.4
  const solids = shellSolids(farm.home.shell)
  const inHouse = me.x > HOUSE.minX && me.x < HOUSE.maxX && me.z > HOUSE.minZ && me.z < HOUSE.maxZ
  const blocked = (x: number, z: number) =>
    farm.home.pieces.some((p) => {
      if (PIECES[p.type].layer !== 'floor') return false
      const r = footprint(p)
      return x > r.minX - BODY && x < r.maxX + BODY && z > r.minZ - BODY && z < r.maxZ + BODY
    }) ||
    (inHouse &&
      (x < HOUSE.minX + 0.45 ||
        x > HOUSE.maxX - 0.45 ||
        z < HOUSE.minZ + 0.45 ||
        z > HOUSE.maxZ - 0.45 ||
        solids.some((b) => b[1] < 0.5 && x > b[0] - BODY && x < b[3] + BODY && z > b[2] - BODY && z < b[5] + BODY)))
  if (!blocked(me.x, me.z)) return
  for (let d = 0.25; d <= 4; d += 0.25)
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const x = me.x + Math.cos(a) * d
      const z = me.z + Math.sin(a) * d
      if (!blocked(x, z)) {
        playerState.moveTo = { x, y: me.y + 0.2, z }
        return
      }
    }
}
