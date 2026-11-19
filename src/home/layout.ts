import { HOUSE, LAMPS, ROOMS, roomAt, type RoomId } from '../data/layout'
import { SCREENS, type ScreenDef } from '../data/screens'
import { carry, rectToWorld, type Fit, type Placement, type Rect } from '../farm/layout'
import { debugFlag } from '../lib/debug'
import { isObject } from '../lib/saved'
import { PIECES, isPieceType, onWall, type PieceType } from './catalogue'
import {
  RUNS,
  boxesMeet,
  defaultShell,
  faceSpan,
  gardenDoorOf,
  hingedDoorOf,
  openingById,
  openingProblem,
  openingsOf,
  sanitizeShell,
  shellSolids,
  windowsOf,
  withOpening,
  type Box,
  type HomeShell,
  type OpeningAt,
  type WallRun,
} from './shell'

// Where the house's furniture stands, and the rules for moving it (pure, like src/farm/layout.ts): every piece is a
// rectangle on the floor in quarter turns, or hangs on a wall (a picture, the mirror, a switch, a screen: src/home/
// catalogue.ts). A spot is fine when the piece is in the house clear of its walls (a doorway's opening is floor), the
// room is not full (what its pieces draw stays within ROOM_WEIGHT), it meets nothing else that stands or hangs (rugs lie
// under furniture), keeps out of the kitchen door's way and, if taller than a window's sill, out of its frame; a piece on
// a wall hangs on one room's side of it clear of its corners and openings. Blocking the way is the player's choice: a
// piece that leaves a doorway, a screen or a lamp out of reach fits all the same, with a word (`warn`). The house's shell
// — its openings, its paint and its floors — is part of the layout (src/home/shell.ts). The default is exactly where the
// house has always had everything, so old saves and every test keep their house.

export interface HomePiece extends Placement {
  id: string
  type: PieceType
}

export interface HomeLayout {
  pieces: HomePiece[]
  /** bought or put away, waiting to be placed */
  stored: PieceType[]
  /** for ids of pieces bought later */
  next: number
  /** the walls' openings, paint and floors */
  shell: HomeShell
}

/** Whether a piece fits, and if it fits but blocks the way, what it blocks (a word, never a refusal). */
export type HomeFit = Fit & { warn?: string }

const piece = (id: string, type: PieceType, x: number, z: number, rot = 0): HomePiece => ({ id, type, x, z, rot })
const E = HOUSE.wallThickness / 2

/** The screens as pieces on their walls: the point of the wall's face behind each, facing the way it faces. */
const SCREEN_OUT = 0.04 // the panel's middle stands this far out from the wall
const turnOfScreen = (s: ScreenDef) => (((Math.round(s.rotationY / (Math.PI / 2)) % 4) + 4) % 4) as 0 | 1 | 2 | 3
const facing = (rot: number): [number, number] => {
  const r = ((Math.round(rot) % 4) + 4) % 4
  return r === 0 ? [0, 1] : r === 1 ? [1, 0] : r === 2 ? [0, -1] : [-1, 0]
}
const screenPiece = (s: ScreenDef): HomePiece => {
  const rot = turnOfScreen(s)
  const [nx, nz] = facing(rot)
  return piece(s.id, 'screen', Math.round((s.position[0] - nx * SCREEN_OUT) * 1000) / 1000, Math.round((s.position[2] - nz * SCREEN_OUT) * 1000) / 1000, rot)
}

/** How high a piece on the wall hangs (its bottom), where today's house has it otherwise than its kind. */
const HANG: Record<string, number> = {
  'outlet-kitchen': 0.96,
  ...Object.fromEntries(SCREENS.map((s) => [s.id, Math.round((s.position[1] - 0.49) * 1000) / 1000])),
}
export const hangOf = (p: Pick<HomePiece, 'id' | 'type'>) => HANG[p.id] ?? PIECES[p.type].hang ?? 0

/** The house as it has always been furnished (the coordinates of src/scene/Furnishings.tsx and Dressing.tsx). */
export function defaultHome(): HomeLayout {
  return {
    pieces: [
      // living room
      piece('sofa', 'sofa', -3.5, 2.5),
      piece('coffee-table', 'coffee-table', -3.5, 3.95),
      piece('tv-console', 'tv-console', -3.5, 5.65),
      piece('plant-living', 'plant-tall', -6.35, 5.35),
      piece('armchair', 'armchair', -5.85, 3.4, 1),
      piece('pouf', 'pouf', -4.95, 3.35),
      piece('rug-living', 'rug-living', -3.5, 3.5),
      // studio
      piece('desk', 'desk', -3.5, -5.45),
      piece('chair', 'chair', -3.5, -4.45, 2),
      piece('bookshelf', 'bookshelf', -6.7, -3, 1),
      piece('plant-studio', 'plant', -0.6, -5.4),
      piece('rug-studio', 'rug-studio', -1.8, -3.2),
      // kitchen
      piece('counter', 'counter', 3.3, -5.58),
      piece('fridge', 'fridge', 6.3, -5.5),
      piece('island', 'island', 3.4, -2.4),
      piece('stool-a', 'stool', 2.9, -1.55),
      piece('stool-b', 'stool', 3.9, -1.55),
      // bedroom
      piece('bed', 'bed', 4.6, 4.85),
      piece('nightstand', 'nightstand', 3.35, 5.6),
      piece('wardrobe', 'wardrobe', 5.8, 0.45),
      piece('accent-chair', 'accent-chair', 0.62, 1.25, 1),
      piece('rug-bedroom', 'rug-bedroom', 4.6, 4.4),
      ...WALL_THINGS(),
    ],
    stored: [],
    next: 1,
    shell: defaultShell(),
  }
}

/** The standing lamp and what hangs on the walls of today's house: the pieces a save from before they could move did
 *  not have (it gets them where they always were). */
function WALL_THINGS(): HomePiece[] {
  const w = E
  return [
    piece('floor-lamp', 'floor-lamp', -6.3, 0.9),
    // pictures, the mirror and the clock
    piece('picture-living-wide', 'picture-wide', -7 + w, 3.4, 1),
    piece('picture-living-tall', 'picture-tall', -7 + w, 4.7, 1),
    piece('picture-bedroom', 'picture-small', 3.5, 6 - w, 2),
    piece('mirror', 'mirror', w, 1.3, 1),
    piece('wall-clock', 'wall-clock', -w, 1.15, 3),
    // a radiator under the bedroom's south window (the living room's became the garden door)
    piece('radiator', 'radiator', 1.7, 6 - w, 2),
    // switches at the doorways (the light side of each wall), a few sockets near the floor and one over the counter
    piece('switch-living', 'switch', -2.35, w, 0),
    piece('switch-living-east', 'switch', -w, 4.05, 3),
    piece('switch-kitchen', 'switch', w, -2.0, 1),
    piece('switch-bedroom', 'switch', 2.35, w, 0),
    piece('outlet-living', 'outlet', -5.2, 6 - w, 2),
    piece('outlet-studio', 'outlet', -7 + w, -1.4, 1),
    piece('outlet-bedroom', 'outlet', 7 - w, 3.0, 3),
    piece('outlet-kitchen', 'outlet', 5.6, -6 + w, 0),
    // the screens, each telling its room's story
    ...SCREENS.map(screenPiece),
  ]
}
const NEWER_IDS = new Set(WALL_THINGS().map((p) => p.id))

const DEFAULT = new Map(defaultHome().pieces.map((p) => [p.id, p]))

/** What stands on a piece of today's house and goes where it goes (lamps and things to pick up; the small things on
 *  tables and shelves are in src/scene/Dressing.tsx): its id → the piece's id. The standing lamp's light is its piece's. */
export const HOSTED: Record<string, string> = { 'lamp-desk': 'desk', 'lamp-bedside': 'nightstand', 'lamp-floor': 'floor-lamp', 'item-book': 'desk', 'item-gift': 'bed' }

/** Where a piece of today's house stands now, and where it stood (null: it is not in the house, or never was). */
export function hostMove(layout: HomeLayout, hostId: string): { from: HomePiece; to: HomePiece } | null {
  const from = DEFAULT.get(hostId)
  const to = layout.pieces.find((p) => p.id === hostId)
  return from && to ? { from, to } : null
}

/** A point that stood on a piece of today's house, carried to where the piece is now (null: the piece is put away). */
export function onHost(layout: HomeLayout, hostId: string, x: number, z: number): [number, number] | null {
  const m = hostMove(layout, hostId)
  return m ? carry(m.from, m.to, x, z) : null
}

/** A piece's own rectangle (centred on its middle, at no turn; on the wall: from its face out). */
export function localRect(type: PieceType): Rect {
  const [w, , d] = PIECES[type].size
  return onWall(type) ? { minX: -w / 2, maxX: w / 2, minZ: 0, maxZ: d } : { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 }
}

/** The floor a piece covers where it stands (one on the wall: the floor under it, out from the wall). */
export const footprint = (p: Pick<HomePiece, 'type' | 'x' | 'z' | 'rot'>) => rectToWorld(p, localRect(p.type))

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): Rect => ({ minX, maxX, minZ, maxZ })
const overlaps = (a: Rect, b: Rect, gap = 0) => a.minX < b.maxX + gap && a.maxX > b.minX - gap && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap
const inside = (a: Rect, b: Rect) => a.minX >= b.minX - 1e-6 && a.maxX <= b.maxX + 1e-6 && a.minZ >= b.minZ - 1e-6 && a.maxZ <= b.maxZ + 1e-6

/** Half of the walls' thickness: a room's floor ends this far in from its bounds. */
const WALL = E
const roomFloor = (id: RoomId) => {
  const b = ROOMS[id].bounds
  return rect(b.minX + WALL, b.maxX - WALL, b.minZ + WALL, b.maxZ - WALL)
}
const HOUSE_FLOOR = rect(HOUSE.minX + WALL, HOUSE.maxX - WALL, HOUSE.minZ + WALL, HOUSE.maxZ - WALL)

// ───────────────────────────── on the walls ─────────────────────────────

/** The wall a piece hangs on: its run, the side it hangs on (0 the lower, 1 the higher), how far along, and the room. */
export function wallFace(p: Pick<HomePiece, 'x' | 'z' | 'rot'>): { run: WallRun; side: 0 | 1; along: number; room: RoomId } | null {
  const rot = ((Math.round(p.rot) % 4) + 4) % 4
  const axis = rot % 2 === 0 ? 'x' : 'z'
  const side: 0 | 1 = rot === 0 || rot === 1 ? 1 : 0
  const across = axis === 'x' ? p.z : p.x
  const along = axis === 'x' ? p.x : p.z
  const at = across - (side ? E : -E)
  for (const r of RUNS) {
    const room = r.sides[side]
    if (r.axis === axis && room && Math.abs(r.at - at) < 1e-3 && along >= r.from && along <= r.to) return { run: r, side, along, room }
  }
  return null
}

/** The screens' hologram stands, carried with their screens. */
const STAND = 0.35
const standOf = (p: HomePiece): Rect | null => {
  if (p.type !== 'screen') return null
  const def = SCREENS.find((s) => s.id === p.id)
  const from = DEFAULT.get(p.id)
  if (!def || !from) return null
  const [x, z] = carry(from, p, def.holo[0], def.holo[2])
  return rect(x - STAND, x + STAND, z - STAND, z + STAND)
}

/** A screen where its piece hangs: its panel's middle, its turn and its hologram's stand (src/scene/Screens.tsx). */
export function placedScreen(layout: HomeLayout, def: ScreenDef): ScreenDef {
  const p = layout.pieces.find((q) => q.id === def.id)
  if (!p) return def
  const [nx, nz] = facing(p.rot)
  const stand = standOf(p)!
  return {
    ...def,
    position: [p.x + nx * SCREEN_OUT, hangOf(p) + 0.49, p.z + nz * SCREEN_OUT],
    rotationY: (p.rot * Math.PI) / 2,
    holo: [(stand.minX + stand.maxX) / 2, 0, (stand.minZ + stand.maxZ) / 2],
  }
}

/** Everything a piece takes up, as boxes in the world: a standing piece from the floor to its height, one on the wall
 *  out from its face (a screen with its hologram's stand). A rug takes up nothing (it lies under the rest). */
export function pieceBoxes(p: HomePiece): Box[] {
  const def = PIECES[p.type]
  if (def.layer === 'rug') return []
  const r = footprint(p)
  const y0 = def.layer === 'wall' ? hangOf(p) : 0
  const out: Box[] = [[r.minX, y0, r.minZ, r.maxX, y0 + def.size[1], r.maxZ]]
  const s = standOf(p)
  if (s) out.push([s.minX, 0, s.minZ, s.maxX, 0.9, s.maxZ])
  return out
}

/** The room a piece is in: a standing piece's middle, a hanging one's side of its wall (null: neither). */
export function pieceRoom(p: HomePiece): RoomId | null {
  return onWall(p.type) ? (wallFace(p)?.room ?? null) : roomAt(p.x, p.z)
}

/** What a piece on a wall must keep clear of in an opening on that wall: its frame (a window's curtains are soft: they
 *  may hang in front of a picture's edge, as they always did in the living room). */
function openingKeepOut(shell: HomeShell, run: WallRun): { box: [number, number, number, number]; name: string }[] {
  const out: { box: [number, number, number, number]; name: string }[] = []
  for (const o of openingsOf(shell)) {
    if (o.closed || o.axis !== run.axis || o.at !== run.at) continue
    if (o.kind === 'doorway') out.push({ box: [o.lo - 0.04, o.hi + 0.04, 0, o.top + 0.04], name: 'the doorway' })
    else out.push({ box: [o.lo - 0.06, o.hi + 0.06, o.sill - 0.07, o.top + 0.05], name: o.kind === 'garden' ? 'the garden door' : 'the window' })
  }
  return out
}

// ───────────────────────────── what a room may draw ─────────────────────────────

/**
 * The most a room's furniture may draw: the sum of its pieces' weights (their triangles, src/home/catalogue.ts).
 * Measured with the heaviest piece (the easy chair) filling every room to this (tests/e2e/05-budget, 2026-11-18, the
 * pieces from files drawn from their far copies and cast as one mesh each: src/lib/sculpt/sun.ts): the camera's pass
 * draws at most 124k triangles in any view of the house (decorating), but the sun's pass in third person and
 * decorating, where the ceilings go and the sun reaches all four rooms, draws 139.6k–142.3k of the 150k it may: one more
 * easy chair a room (2.8k triangles each in the sun's map) would pass it, so the limit stays. Today's house: living room
 * 34.2k, bedroom 12.7k, studio 6.3k, kitchen 2.6k (and what hangs on their walls). A limit for speed only (a debt,
 * CLAUDE.md): `?debug&nocap` lifts it, to measure rooms filled until nothing more fits (05-budget's ten times the farm).
 */
export const ROOM_WEIGHT = debugFlag('nocap') !== null ? Infinity : 60_000

/** What a room's pieces draw (their weights), leaving one piece out (the one being moved). */
export function roomWeight(layout: HomeLayout, room: RoomId, except?: string): number {
  let sum = 0
  for (const p of layout.pieces) if (p.id !== except && pieceRoom(p) === room) sum += PIECES[p.type].weight
  return sum
}

/** More pieces than any house holds: a room's pieces draw up to ROOM_WEIGHT (288 stools, the lightest; rugs may not lie
 *  on each other). A save with more stands this many and puts the rest into storage, so checking it stays quick (every
 *  piece is weighed against the others: thirty thousand took over a minute, at every start). */
const MOST_PIECES = 1500

/** Whether one more piece of this kind would put a room over ROOM_WEIGHT. */
export const roomFull = (layout: HomeLayout, room: RoomId, type: PieceType) => roomWeight(layout, room) + PIECES[type].weight > ROOM_WEIGHT

// ───────────────────────────── can it go there ─────────────────────────────

const lowerName = (t: PieceType) => PIECES[t].name[0].toLowerCase() + PIECES[t].name.slice(1)

/** Within this far of a window, nothing taller than its sill. */
const WINDOW_CLEAR = 0.25

/** The floor the kitchen's door takes up, shut (across its doorway) and as it swings open into the bedroom. */
function doorWay(shell: HomeShell): Rect[] {
  const d = hingedDoorOf(shell)
  if (!d) return []
  const [hx, , hz] = d.hinge
  return d.axis === 'x' ? [rect(hx, hx + d.width, hz - E, hz + d.width)] : [rect(hx - E, hx + d.width, hz, hz + d.width)]
}

/** Why a piece cannot stand where it is in a house with these walls (null: it can) — the walls, the openings and the
 *  kitchen's door, not the other pieces. */
export function shellProblem(shell: HomeShell, p: HomePiece): string | null {
  const def = PIECES[p.type]
  if (def.layer === 'wall') {
    const face = wallFace(p)
    if (!face) return 'Not on a wall'
    const [a, b] = faceSpan(face.run)
    const w = def.size[0] / 2
    if (face.along - w < a + 0.02 - 1e-6 || face.along + w > b - 0.02 + 1e-6) return 'Round the corner'
    const y0 = hangOf(p)
    const y1 = y0 + def.size[1]
    for (const k of openingKeepOut(shell, face.run)) {
      const [lo, hi, k0, k1] = k.box
      if (face.along - w < hi && face.along + w > lo && y0 < k1 && y1 > k0) return `On ${k.name}`
    }
    const s = standOf(p)
    if (s && !inside(s, HOUSE_FLOOR)) return 'Its stand is through the wall'
    if (s) for (const box of shellSolids(shell)) if (boxesMeet([s.minX, 0, s.minZ, s.maxX, 0.9, s.maxZ], box)) return 'Its stand is through the wall'
    if (s) for (const r of doorWay(shell)) if (overlaps(s, r, -0.005)) return "Its stand is in the door's way"
    return null
  }
  const fp = footprint(p)
  if (!inside(fp, HOUSE_FLOOR)) return 'Through the wall'
  const h = def.layer === 'rug' ? 0.01 : def.size[1]
  if (def.layer === 'floor')
    for (const w of windowsOf(shell)) {
      if (w.door || h <= w.sill) continue
      const half = w.width / 2
      const d = WALL + WINDOW_CLEAR
      const zone = w.axis === 'x' ? rect(w.centre - half, w.centre + half, w.at - d, w.at + d) : rect(w.at - d, w.at + d, w.centre - half, w.centre + half)
      if (overlaps(fp, zone, -0.005)) return 'Covers the window'
    }
  const box: Box = [fp.minX, 0, fp.minZ, fp.maxX, h, fp.maxZ]
  for (const s of shellSolids(shell)) if (boxesMeet(box, s)) return 'Through the wall'
  if (def.layer === 'floor') for (const r of doorWay(shell)) if (overlaps(fp, r, -0.005)) return "In the door's way"
  return null
}

/** Whether a piece fits where it is put (the rest of the layout as it stands), and if not, why in a few words; one that
 *  fits but leaves something out of reach says so (`warn`). */
export function canPlacePiece(layout: HomeLayout, p: HomePiece): HomeFit {
  const def = PIECES[p.type]
  const problem = shellProblem(layout.shell, p)
  if (problem) return { ok: false, reason: problem }
  const room = pieceRoom(p)
  if (!room) return { ok: false, reason: 'Through the wall' }
  if (roomWeight(layout, room, p.id) + def.weight > ROOM_WEIGHT) return { ok: false, reason: 'This room is full' }
  const fp = footprint(p)
  const mine = pieceBoxes(p)
  for (const other of layout.pieces) {
    if (other.id === p.id) continue
    const od = PIECES[other.type]
    if (def.layer === 'rug' || od.layer === 'rug') {
      if (def.layer === od.layer && overlaps(fp, footprint(other), -0.005)) return { ok: false, reason: `On the ${lowerName(other.type)}` }
      continue
    }
    const theirs = pieceBoxes(other)
    if (mine.some((a) => theirs.some((b) => boxesMeet(a, b))))
      return { ok: false, reason: def.layer === 'wall' || od.layer !== 'wall' ? `On the ${lowerName(other.type)}` : `Under the ${lowerName(other.type)}` }
  }
  // what stands on the floor (or a screen's stand) may block the way: allowed, with a word
  if (def.layer === 'floor' || p.type === 'screen') {
    const blocked = unreachable({ ...layout, pieces: layout.pieces.map((o) => (o.id === p.id ? p : o)).concat(layout.pieces.some((o) => o.id === p.id) ? [] : [p]) })
    if (blocked) return { ok: true, warn: `Blocks the way to ${blocked}` }
  }
  return { ok: true }
}

// ───────────────────────────── the doors and windows ─────────────────────────────

/** Whether an opening can go there (slid along a wall, closed or opened) with the house as it stands: its wall must have
 *  room for it, and nothing may stand or hang where it would be. One that leaves somewhere out of reach goes all the
 *  same, with a word. */
export function canMoveOpening(layout: HomeLayout, id: string, at: OpeningAt): HomeFit {
  const def = openingById(id)
  if (!def) return { ok: false, reason: 'Not in the house' }
  const problem = openingProblem(layout.shell, id, at)
  if (problem) return { ok: false, reason: problem }
  const shell = withOpening(layout.shell, id, at)
  for (const p of layout.pieces) {
    if (shellProblem(layout.shell, p)) continue // already as it was (a save from before: put away as it loads)
    const why = shellProblem(shell, p)
    if (why) return { ok: false, reason: `The ${lowerName(p.type)} is in the way` }
  }
  const blocked = unreachable({ ...layout, shell })
  return blocked ? { ok: true, warn: `${at.closed ? 'Shuts' : 'Blocks'} the way to ${blocked}` } : { ok: true }
}

// ───────────────────────────── can everything still be walked to ─────────────────────────────

const CELL = 0.15
const BODY = 0.33 // the player's capsule radius and a little room
const GX = Math.round((HOUSE.maxX - HOUSE.minX) / CELL)
const GZ = Math.round((HOUSE.maxZ - HOUSE.minZ) / CELL)
const cellOf = (x: number, z: number) => [Math.floor((x - HOUSE.minX) / CELL), Math.floor((z - HOUSE.minZ) / CELL)] as const

const ROOM_NAME: Record<RoomId, string> = { living: 'the living room', office: 'the studio', kitchen: 'the kitchen', bedroom: 'the bedroom' }

/** What must stay reachable besides the rooms and their doorways (unreachable): the floor near each screen's stand and
 *  each lamp. */
function goals(layout: HomeLayout): { x: number; z: number; within: number; name: string }[] {
  const out: { x: number; z: number; within: number; name: string }[] = []
  for (const s of SCREENS) {
    const def = placedScreen(layout, s)
    const a = def.rotationY
    out.push({ x: def.position[0] + Math.sin(a) * 1.1, z: def.position[2] + Math.cos(a) * 1.1, within: 1.3, name: 'the screen' })
  }
  // the lamps: one on a piece goes where the piece goes (and needs no reaching while it is put away)
  for (const l of LAMPS) {
    const host = HOSTED[l.id]
    const at = host ? onHost(layout, host, l.position[0], l.position[2]) : [l.position[0], l.position[2]]
    if (at) out.push({ x: at[0], z: at[1], within: 1.2, name: 'the lamp' })
  }
  return out
}

/** Whether, with this layout, something must-reach can no longer be walked to from where you come in: its name, or null. */
export function unreachable(layout: HomeLayout): string | null {
  const blocked = new Uint8Array(GX * GZ)
  const mark = (r: Rect) => {
    const [x0, z0] = cellOf(r.minX - BODY, r.minZ - BODY)
    const [x1, z1] = cellOf(r.maxX + BODY, r.maxZ + BODY)
    for (let z = Math.max(0, z0); z <= Math.min(GZ - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(GX - 1, x1); x++) blocked[z * GX + x] = 1
  }
  for (const p of layout.pieces) {
    if (PIECES[p.type].layer === 'floor') mark(footprint(p))
    const s = standOf(p)
    if (s) mark(s)
  }
  // the walls down to the floor (a doorway's opening is open; the garden door's leaves shut it)
  for (const b of shellSolids(layout.shell)) if (b[1] < 0.5) mark(rect(b[0], b[3], b[2], b[5]))
  // the outer walls
  for (let x = 0; x < GX; x++)
    for (let z = 0; z < GZ; z++) {
      const cx = HOUSE.minX + (x + 0.5) * CELL
      const cz = HOUSE.minZ + (z + 0.5) * CELL
      if (cx < HOUSE.minX + WALL + BODY || cx > HOUSE.maxX - WALL - BODY || cz < HOUSE.minZ + WALL + BODY || cz > HOUSE.maxZ - WALL - BODY) blocked[z * GX + x] = 1
    }
  /** The cells reached from these, by steps between free cells (only within `box`: min and max cell x and z). */
  const flood = (seeds: number[], box = [0, 0, GX - 1, GZ - 1]) => {
    const seen = new Uint8Array(GX * GZ)
    const queue: number[] = []
    const push = (x: number, z: number) => {
      if (x < box[0] || z < box[1] || x > box[2] || z > box[3]) return
      const k = z * GX + x
      if (seen[k] || blocked[k]) return
      seen[k] = 1
      queue.push(k)
    }
    for (const k of seeds) push(k % GX, Math.floor(k / GX))
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i]
      const x = k % GX
      const z = (k - x) / GX
      push(x + 1, z)
      push(x - 1, z)
      push(x, z + 1)
      push(x, z - 1)
    }
    return { seen, queue }
  }
  /** The cells of `seen` within `within` of a point (only the house's cells round it: counting from the cell of a lamp
   *  carried far off with its piece never ended — from −∞, or past 2^53, one more is the same number). */
  const near = (seen: Uint8Array, px: number, pz: number, within: number) => {
    const out: number[] = []
    const r = Math.ceil(within / CELL)
    const [gx, gz] = cellOf(px, pz)
    for (let z = Math.max(0, gz - r); z <= Math.min(GZ - 1, gz + r); z++)
      for (let x = Math.max(0, gx - r); x <= Math.min(GX - 1, gx + r); x++) {
        if (!seen[z * GX + x]) continue
        if (Math.hypot(HOUSE.minX + (x + 0.5) * CELL - px, HOUSE.minZ + (z + 0.5) * CELL - pz) <= within) out.push(z * GX + x)
      }
    return out
  }
  // flood from where you come in: just inside the garden door
  const g = gardenDoorOf(layout.shell)
  const inward = g.at > 0 ? -0.5 : 0.5
  const [sx, sz] = g.axis === 'x' ? cellOf(g.centre, g.at + inward) : cellOf(g.at + inward, g.centre)
  const everywhere = flood(near(new Uint8Array(GX * GZ).fill(1), g.axis === 'x' ? g.centre : g.at + inward, g.axis === 'x' ? g.at + inward : g.centre, 0.4))
  if (!everywhere.queue.length || !Number.isFinite(sx + sz)) return 'the garden'
  const { seen } = everywhere
  // a whole room shut away (its doorways closed or blocked) is said as the room
  const reached = new Set<RoomId>()
  for (const k of everywhere.queue) reached.add(roomAt(HOUSE.minX + ((k % GX) + 0.5) * CELL, HOUSE.minZ + (Math.floor(k / GX) + 0.5) * CELL)!)
  for (const room of Object.keys(ROOM_NAME) as RoomId[]) if (!reached.has(room)) return ROOM_NAME[room]
  // each open doorway can be walked up to from both sides, and through (a lamp in its opening, a sofa across it)
  for (const o of openingsOf(layout.shell)) {
    if (o.kind !== 'doorway' || o.closed) continue
    const side = (s: 0 | 1): [number, number] => {
      const off = s ? 0.45 : -0.45
      return o.axis === 'x' ? [o.centre, o.at + off] : [o.at + off, o.centre]
    }
    for (const s of [0, 1] as const) if (!near(seen, ...side(s), 0.45).length) return ROOM_NAME[o.sides[1 - s]!]
    const [ax, az] = cellOf(...side(0))
    const span = Math.ceil(1.3 / CELL)
    const through = flood(near(seen, ...side(0), 0.45), [ax - span, az - span, ax + span, az + span])
    if (!near(through.seen, ...side(1), 0.45).length) return ROOM_NAME[o.sides[1] === 'living' ? o.sides[0]! : o.sides[1]!]
  }
  for (const goal of goals(layout)) if (!near(seen, goal.x, goal.z, goal.within).length) return goal.name
  return null
}

// ───────────────────────────── snapping, free spots, saves ─────────────────────────────

/** Where a piece on the wall goes for a point on the floor the finger puts it at: on the nearest wall of the room the
 *  point is in (`room`: only that room's walls), 5 cm steps along it. */
export function snapWall(p: HomePiece, x: number, z: number, room?: RoomId): HomePiece {
  const at = roomAt(Math.min(HOUSE.maxX - 0.01, Math.max(HOUSE.minX + 0.01, x)), Math.min(HOUSE.maxZ - 0.01, Math.max(HOUSE.minZ + 0.01, z)))
  const want = room ?? at ?? 'living'
  const half = PIECES[p.type].size[0] / 2
  let best: { d: number; q: HomePiece } | null = null
  for (const r of RUNS)
    for (const side of [0, 1] as const) {
      if (r.sides[side] !== want) continue
      const [a, b] = faceSpan(r)
      const lo = a + half + 0.02
      const hi = b - half - 0.02
      if (lo > hi) continue
      const face = r.at + (side ? E : -E)
      const alongRaw = r.axis === 'x' ? x : z
      const along = Math.min(hi, Math.max(lo, Math.round(alongRaw * 20) / 20))
      const across = r.axis === 'x' ? z : x
      const d = Math.hypot(alongRaw - along, across - face)
      const rot = r.axis === 'x' ? (side ? 0 : 2) : side ? 1 : 3
      const q: HomePiece = { ...p, rot, x: Math.round((r.axis === 'x' ? along : face) * 1000) / 1000, z: Math.round((r.axis === 'x' ? face : along) * 1000) / 1000 }
      if (!best || d < best.d) best = { d, q }
    }
  return best?.q ?? p
}

/** Where a piece lands for a point the finger puts it at: on a 0.25 m grid, and flush with a wall it comes within 0.3 m
 *  of (one that hangs: on the nearest wall) — but where it stands in a doorway's opening, clear of its walls (`shell`:
 *  the house's), it stays there. */
export function snapPiece(p: HomePiece, x: number, z: number, shell?: HomeShell): HomePiece {
  if (onWall(p.type)) return snapWall(p, x, z, PIECES[p.type].keep ? (pieceRoom(p) ?? undefined) : undefined)
  const q = { ...p, x: Math.round(x * 4) / 4, z: Math.round(z * 4) / 4 }
  const room = roomAt(q.x, q.z)
  if (!room) return q
  if (shell && !inside(footprint(q), roomFloor(room)) && !shellProblem(shell, q)) return q
  const f = roomFloor(room)
  const r = footprint(q)
  const gw = r.minX - f.minX
  const ge = f.maxX - r.maxX
  const gn = r.minZ - f.minZ
  const gs = f.maxZ - r.maxZ
  if (gw < 0.3 && gw <= ge) q.x += 0.01 - gw
  else if (ge < 0.3) q.x += ge - 0.01
  if (gn < 0.3 && gn <= gs) q.z += 0.01 - gn
  else if (gs < 0.3) q.z += gs - 0.01
  q.x = Math.round(q.x * 1000) / 1000
  q.z = Math.round(q.z * 1000) / 1000
  return q
}

/** A free spot for a new piece in a room (nearest the room's middle first, and where it blocks nothing), or null when
 *  there is none (or the room is full: `roomFull`). One for the wall: a free stretch of one of the room's walls. */
export function findFreeSpot(layout: HomeLayout, type: PieceType, room: RoomId, id = 'new'): HomePiece | null {
  if (roomFull(layout, room, type)) return null
  const b = roomFloor(room)
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  const spots: [number, number][] = []
  if (onWall(type)) {
    for (const r of RUNS)
      for (const side of [0, 1] as const) {
        if (r.sides[side] !== room) continue
        const [a, c] = faceSpan(r)
        const face = r.at + (side ? E : -E) * 0.5
        for (let t = a; t <= c; t += 0.1) spots.push(r.axis === 'x' ? [t, face] : [face, t])
      }
    spots.sort((a, c) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(c[0] - cx, c[1] - cz))
    for (const [x, z] of spots) {
      const p = snapWall({ id, type, x, z, rot: 0 }, x, z, room)
      const fit = canPlacePiece(layout, p)
      if (pieceRoom(p) === room && fit.ok) return p
    }
    return null
  }
  for (let x = b.minX; x <= b.maxX; x += 0.25) for (let z = b.minZ; z <= b.maxZ; z += 0.25) spots.push([x, z])
  spots.sort((a, c) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(c[0] - cx, c[1] - cz))
  let blocking: HomePiece | null = null
  for (const rot of [0, 1])
    for (const [x, z] of spots) {
      const p = snapPiece({ id, type, x, z, rot }, x, z)
      if (roomAt(p.x, p.z) !== room) continue
      const fit = canPlacePiece(layout, p)
      if (!fit.ok) continue
      if (!fit.warn) return p
      blocking ??= p
    }
  return blocking
}

/** A saved house, checked: the shell first (src/home/shell.ts: openings off their walls or over each other where they
 *  were built), then unknown pieces dropped, pieces that no longer fit put away (never lost). A save from before the
 *  walls' things could move (no shell) has them where they always were. */
export function sanitizeHome(raw: unknown): HomeLayout {
  const base = defaultHome()
  if (!isObject(raw)) return base
  const r = raw as Partial<HomeLayout>
  const shell = sanitizeShell(r.shell)
  // `next` numbers the pieces taken out of storage from now on: a whole number from 1 that still counts up
  const next = typeof r.next === 'number' && Number.isFinite(r.next) && r.next >= 1 ? Math.min(Math.floor(r.next), Number.MAX_SAFE_INTEGER) : 1
  const out: HomeLayout = { pieces: [], stored: Array.isArray(r.stored) ? r.stored.filter(isPieceType) : [], next, shell }
  // with no list of pieces, today's furniture stands; what waits in storage is kept
  if (!Array.isArray(r.pieces)) return { ...base, stored: out.stored, next, shell }
  // a save from before the walls' things moved: they come where they always were, after its own pieces are checked
  const older = !isObject(r.shell)
  const seen = new Set<string>()
  for (const p of r.pieces as Partial<HomePiece>[]) {
    if (!p || typeof p.id !== 'string' || seen.has(p.id) || !isPieceType(p.type)) continue
    if (![p.x, p.z, p.rot].every((v) => typeof v === 'number' && Number.isFinite(v))) continue
    // within the house: a piece saved far off goes into storage below, and no huge number reaches the checks
    const x = Math.min(HOUSE.maxX, Math.max(HOUSE.minX, p.x!))
    const z = Math.min(HOUSE.maxZ, Math.max(HOUSE.minZ, p.z!))
    const q = { id: p.id, type: p.type, x, z, rot: ((Math.round(p.rot!) % 4) + 4) % 4 }
    seen.add(q.id)
    // fitted pieces always stand where they were built, known by their id whatever kind they were saved as (saved as a
    // wardrobe, the counter stood as one and never came back, and it cannot be bought); a screen is always its own kind
    const home = base.pieces.find((d) => d.id === q.id)
    if (PIECES[q.type].fitted || (home && PIECES[home.type].fitted)) {
      if (home) out.pieces.push(home)
      continue
    }
    if ((home?.type === 'screen') !== (q.type === 'screen')) {
      if (home?.type === 'screen') out.pieces.push(home)
      continue
    }
    if (out.pieces.length < MOST_PIECES) out.pieces.push(q)
    else out.stored.push(q.type)
  }
  // a fitted piece (or a screen) missing from the save comes back (a save from before the screens moved: with the rest, below)
  for (const d of base.pieces) if ((PIECES[d.type].fitted || (PIECES[d.type].keep && !older)) && !out.pieces.some((p) => p.id === d.id)) out.pieces.push(d)
  // the next piece taken out of storage is numbered past every id there is (`stool-1`): with `next` lost or edited, a
  // second stool-1 came, and putting one away put both away
  for (const p of out.pieces) {
    const n = /-(\d+)$/.exec(p.id)
    if (n) out.next = Math.min(Number.MAX_SAFE_INTEGER, Math.max(out.next, Number(n[1]) + 1))
  }
  const stays = (p: HomePiece) => PIECES[p.type].fitted || PIECES[p.type].keep
  // a screen stays in its own room, on a wall that has room for it, clear of what always stands (the kitchen's counter):
  // saved anywhere else, it hangs where it was built
  out.pieces = out.pieces.map((p) => {
    if (!PIECES[p.type].keep) return p
    const d = base.pieces.find((b) => b.id === p.id)!
    const standing = { ...out, pieces: out.pieces.filter(stays) }
    return pieceRoom(p) !== pieceRoom(d) || shellProblem(shell, p) || !canPlacePiece(standing, p).ok ? d : p
  })
  // what stands through a wall (saved far off) is put away first: it can never stay, and while the rest are checked it
  // would stand in their way (a desk at the wall before the screen made the sofa block the way to it)
  const through = new Set(out.pieces.filter((p) => !stays(p) && (!pieceRoom(p) || shellProblem(shell, p))))
  out.pieces = out.pieces.filter((p) => !through.has(p))
  for (const p of through) out.stored.push(p.type)
  // a room over what it may draw (a save from before the limit) puts away its newest pieces first (bought pieces come
  // last in the list), so the furniture it always had stays
  for (const p of [...out.pieces].reverse()) {
    const room = pieceRoom(p)
    if (stays(p) || !room || roomWeight(out, room) <= ROOM_WEIGHT) continue
    out.pieces = out.pieces.filter((o) => o.id !== p.id)
    out.stored.push(p.type)
  }
  // whatever does not fit any more goes into storage, one by one (the loop walks the list as it was: putting a piece
  // away makes a new one)
  for (const p of out.pieces) {
    if (stays(p)) continue
    if (!canPlacePiece(out, p).ok) {
      out.pieces = out.pieces.filter((o) => o.id !== p.id)
      out.stored.push(p.type)
    }
  }
  // the walls' things of a save from before them, where they always were (into storage where its own furniture stands)
  if (older)
    for (const d of base.pieces) {
      if (!NEWER_IDS.has(d.id) || seen.has(d.id) || out.pieces.some((p) => p.id === d.id)) continue
      if (canPlacePiece(out, d).ok || stays(d)) out.pieces.push(d)
      else out.stored.push(d.type)
    }
  return out
}
