import { DOOR, DOORWAYS, HOUSE, ROOMS, WINDOWS, type FloorKind, type RoomId, type Vec3, type WindowDef } from '../data/layout'
import { isObject, isRecord } from '../lib/saved'

// The house's shell as the save has it (pure numbers, like src/home/layout.ts): where each doorway, window and the
// garden door is along its wall, which are closed (wall where they were), each room's paint and its floor. Nothing is
// added or taken away: the house always has the same four doorways, seven windows and the garden door, so what any view
// can draw stays what 05-budget measured. The default is the house as it was always built (src/data/layout.ts), so old
// saves and every test keep their house. Everything that was built from the constants follows this: the walls and their
// colliders (wallSegments), the doors, the light through the windows, the drawing pass's portals, the camera's limits,
// the way the walk-to finds, the furniture's rules.

const { wallHeight: H, wallThickness: T, doorHeight: DH } = HOUSE
const E = T / 2

// ───────────────────────────── the walls ─────────────────────────────

export type RunId = 'n-office' | 'n-kitchen' | 's-living' | 's-bedroom' | 'w-office' | 'w-living' | 'e-kitchen' | 'e-bedroom' | 'mid-w' | 'mid-e' | 'mid-n' | 'mid-s'

/** A stretch of wall between two corners or junctions: one room's side of an outer wall, or the wall between two rooms.
 *  `axis` 'x': the wall runs along x at z = at; 'z': along z at x = at. `sides`: the room on its lower side (z or x less
 *  than `at`) and on its higher side; null is outdoors. */
export interface WallRun {
  id: RunId
  axis: 'x' | 'z'
  at: number
  from: number
  to: number
  sides: [RoomId | null, RoomId | null]
}

const { minX, maxX, minZ, maxZ } = HOUSE
export const RUNS: readonly WallRun[] = [
  { id: 'n-office', axis: 'x', at: minZ, from: minX, to: 0, sides: [null, 'office'] },
  { id: 'n-kitchen', axis: 'x', at: minZ, from: 0, to: maxX, sides: [null, 'kitchen'] },
  { id: 's-living', axis: 'x', at: maxZ, from: minX, to: 0, sides: ['living', null] },
  { id: 's-bedroom', axis: 'x', at: maxZ, from: 0, to: maxX, sides: ['bedroom', null] },
  { id: 'w-office', axis: 'z', at: minX, from: minZ, to: 0, sides: [null, 'office'] },
  { id: 'w-living', axis: 'z', at: minX, from: 0, to: maxZ, sides: [null, 'living'] },
  { id: 'e-kitchen', axis: 'z', at: maxX, from: minZ, to: 0, sides: ['kitchen', null] },
  { id: 'e-bedroom', axis: 'z', at: maxX, from: 0, to: maxZ, sides: ['bedroom', null] },
  { id: 'mid-w', axis: 'x', at: 0, from: minX, to: 0, sides: ['office', 'living'] },
  { id: 'mid-e', axis: 'x', at: 0, from: 0, to: maxX, sides: ['kitchen', 'bedroom'] },
  { id: 'mid-n', axis: 'z', at: 0, from: minZ, to: 0, sides: ['office', 'kitchen'] },
  { id: 'mid-s', axis: 'z', at: 0, from: 0, to: maxZ, sides: ['living', 'bedroom'] },
]
export const runById = (id: string): WallRun | undefined => RUNS.find((r) => r.id === id)
export const isRunId = (id: unknown): id is RunId => typeof id === 'string' && RUNS.some((r) => r.id === id)
/** Where a run's faces are, along it: between the walls across its ends (their faces). */
export const faceSpan = (r: WallRun): [number, number] => [r.from + E, r.to - E]
const outer = (r: WallRun) => r.sides[0] === null || r.sides[1] === null
/** The room inside an outer wall. */
const roomOfRun = (r: WallRun) => (r.sides[0] ?? r.sides[1])!

// ───────────────────────────── the openings ─────────────────────────────

export type OpeningKind = 'doorway' | 'window' | 'garden'

/** One opening as it is built (its size never changes) and where it may go: along one of `runs`. */
export interface OpeningDef {
  id: string
  kind: OpeningKind
  width: number
  sill: number
  top: number
  /** the runs it may stand in: a doorway its own (between its two rooms), a window and the garden door any outer wall of
   *  their room */
  runs: RunId[]
  /** where it is built */
  run: RunId
  centre: number
  /** the doorway with the kitchen's hinged door in it */
  hinged?: boolean
}

/** How far past an opening's edges along its wall it needs room: a doorway its jambs, a window its curtains, the garden
 *  door the leaves that slide into the wall. Two openings in one wall keep these apart, and an opening keeps this far
 *  from the walls across its run's ends (the garden door: its curtains, while its leaves may slide on into the wall past
 *  a wall between two rooms, never past the house's corner). */
export const CLEAR: Record<OpeningKind, number> = { doorway: 0.12, window: 0.25, garden: 0.7 }
const END_CLEAR: Record<OpeningKind, number> = { doorway: 0.12, window: 0.25, garden: 0.3 }

const runAt = (axis: 'x' | 'z', at: number, along: number) => RUNS.find((r) => r.axis === axis && r.at === at && along > r.from && along < r.to)!

export const OPENINGS: readonly OpeningDef[] = [
  ...Object.entries(DOORWAYS).map(([id, d]): OpeningDef => {
    const run = runAt(d.axis, d.at, d.centre)
    return { id, kind: 'doorway', width: d.width, sill: 0, top: DH, runs: [run.id], run: run.id, centre: d.centre, hinged: id === 'kitchenBedroom' }
  }),
  ...WINDOWS.map((w): OpeningDef => {
    const run = runAt(w.axis, w.at, w.centre)
    const room = roomOfRun(run)
    const runs = RUNS.filter((r) => outer(r) && roomOfRun(r) === room).map((r) => r.id)
    return { id: w.id, kind: w.door ? 'garden' : 'window', width: w.width, sill: w.sill, top: w.top, runs, run: run.id, centre: w.centre }
  }),
]
export const openingById = (id: string) => OPENINGS.find((o) => o.id === id)
export const GARDEN_ID = OPENINGS.find((o) => o.kind === 'garden')!.id
export const HINGED_ID = OPENINGS.find((o) => o.hinged)!.id

// ───────────────────────────── paint and floors ─────────────────────────────

/** The paints for a room's walls (its own side of each of them): soft, as the house always was, and a few deeper ones. */
export const PAINTS: readonly { id: string; name: string; hex: string }[] = [
  { id: 'linen', name: 'Linen', hex: '#e2dccf' },
  { id: 'chalk', name: 'Chalk', hex: '#eef0ea' },
  { id: 'oat', name: 'Oat', hex: '#e0d8c9' },
  { id: 'mist', name: 'Mist', hex: '#d9dfe4' },
  { id: 'butter', name: 'Butter', hex: '#f1e4b8' },
  { id: 'apricot', name: 'Apricot', hex: '#f0d2b4' },
  { id: 'blush', name: 'Blush', hex: '#ecd0cb' },
  { id: 'lavender', name: 'Lavender', hex: '#d9d0e6' },
  { id: 'sky', name: 'Sky', hex: '#c7dbea' },
  { id: 'mint', name: 'Mint', hex: '#cfe5d6' },
  { id: 'sage', name: 'Sage', hex: '#b9cbb0' },
  { id: 'clay', name: 'Clay', hex: '#d3ab92' },
  { id: 'slate', name: 'Slate', hex: '#9eacb8' },
]
export const paintById = (id: unknown) => PAINTS.find((p) => p.id === id)

/** The floors a room can have: a surface (its texture and its footsteps) and a tint. */
export const FLOORS: readonly { id: string; name: string; kind: FloorKind; tint: string }[] = [
  { id: 'oak', name: 'Oak', kind: 'wood', tint: '#b99872' },
  { id: 'honey', name: 'Honey oak', kind: 'wood', tint: '#a8825a' },
  { id: 'ash', name: 'Ash', kind: 'wood', tint: '#d4c09e' },
  { id: 'walnut', name: 'Walnut', kind: 'wood', tint: '#7c5a40' },
  { id: 'pale-tile', name: 'Pale tiles', kind: 'tile', tint: '#d9dcd8' },
  { id: 'terracotta', name: 'Terracotta', kind: 'tile', tint: '#c98a6a' },
  { id: 'grey-carpet', name: 'Grey carpet', kind: 'carpet', tint: '#8d8a86' },
  { id: 'blue-carpet', name: 'Blue carpet', kind: 'carpet', tint: '#6f7f96' },
  { id: 'rose-carpet', name: 'Rose carpet', kind: 'carpet', tint: '#b08f8b' },
  { id: 'limestone', name: 'Limestone', kind: 'stone', tint: '#cfc8bb' },
  { id: 'slate-stone', name: 'Slate', kind: 'stone', tint: '#7e8388' },
]
export const floorById = (id: unknown) => FLOORS.find((f) => f.id === id)

/** Each room's floor as it was always built. */
const BUILT_FLOOR: Record<RoomId, string> = { office: 'oak', kitchen: 'pale-tile', living: 'honey', bedroom: 'grey-carpet' }

// ───────────────────────────── the save ─────────────────────────────

export interface OpeningAt {
  run: RunId
  centre: number
  closed: boolean
}

export interface HomeShell {
  openings: Record<string, OpeningAt>
  /** a room's paint (null: as it was built — its own colour on its outer walls, the plaster grey on the walls inside) */
  paint: Record<RoomId, string | null>
  floors: Record<RoomId, string>
}

export const ROOM_IDS: readonly RoomId[] = ['living', 'office', 'kitchen', 'bedroom']

export function defaultShell(): HomeShell {
  return {
    openings: Object.fromEntries(OPENINGS.map((o) => [o.id, { run: o.run, centre: o.centre, closed: false }])),
    paint: { living: null, office: null, kitchen: null, bedroom: null },
    floors: { ...BUILT_FLOOR },
  }
}

/** An opening where the shell has it, with its wall worked out. */
export interface PlacedOpening extends OpeningDef {
  axis: 'x' | 'z'
  at: number
  closed: boolean
  lo: number
  hi: number
  /** the room on each side (null outdoors) */
  sides: [RoomId | null, RoomId | null]
}

const placedCache = new WeakMap<HomeShell, PlacedOpening[]>()
/** Every opening of the shell where it stands (closed ones too), in the order of OPENINGS. */
export function openingsOf(shell: HomeShell): PlacedOpening[] {
  let out = placedCache.get(shell)
  if (out) return out
  out = OPENINGS.map((o) => {
    const at = shell.openings[o.id] ?? { run: o.run, centre: o.centre, closed: false }
    const run = runById(at.run)!
    return { ...o, run: run.id, centre: at.centre, axis: run.axis, at: run.at, closed: at.closed, lo: at.centre - o.width / 2, hi: at.centre + o.width / 2, sides: run.sides }
  })
  placedCache.set(shell, out)
  return out
}

/** The windows and the garden door as the walls and the light cut them (open ones only), in the shape of WINDOWS. */
export function windowsOf(shell: HomeShell): WindowDef[] {
  return openingsOf(shell)
    .filter((o) => o.kind !== 'doorway' && !o.closed)
    .map((o) => ({ id: o.id, axis: o.axis, at: o.at, centre: o.centre, width: o.width, sill: o.sill, top: o.top, door: o.kind === 'garden' || undefined }))
}

/** The open doorways between rooms. */
export const doorwaysOf = (shell: HomeShell) => openingsOf(shell).filter((o) => o.kind === 'doorway' && !o.closed)

/** The garden door (it can move, never close: it is the way in). */
export function gardenDoorOf(shell: HomeShell): WindowDef {
  const o = openingsOf(shell).find((q) => q.kind === 'garden')!
  return { id: o.id, axis: o.axis, at: o.at, centre: o.centre, width: o.width, sill: o.sill, top: o.top, door: true }
}

export interface HingedDoor {
  id: string
  /** the hinge, on the doorway's lower jamb; the leaf swings a quarter turn into the room on the wall's higher side */
  hinge: Vec3
  axis: 'x' | 'z'
  width: number
  height: number
  thickness: number
  openAngle: number
}

/** The kitchen's hinged door in its doorway (null: the doorway is closed, and the door with it). */
export function hingedDoorOf(shell: HomeShell): HingedDoor | null {
  const o = openingsOf(shell).find((q) => q.hinged)!
  if (o.closed) return null
  const hinge: Vec3 = o.axis === 'x' ? [o.lo, 0, o.at] : [o.at, 0, o.lo]
  return { id: DOOR.id, hinge, axis: o.axis, width: DOOR.width, height: DOOR.height, thickness: DOOR.thickness, openAngle: DOOR.openAngle }
}

/** The rooms that share an open doorway (their light bleeds into each other). */
export function adjacentOf(shell: HomeShell): [RoomId, RoomId][] {
  let out = adjacentCache.get(shell)
  if (!out) adjacentCache.set(shell, (out = doorwaysOf(shell).map((d): [RoomId, RoomId] => [d.sides[0]!, d.sides[1]!])))
  return out
}
const adjacentCache = new WeakMap<HomeShell, [RoomId, RoomId][]>()

/** A room's floor as the shell has it. */
export const floorOf = (shell: HomeShell, room: RoomId) => floorById(shell.floors[room]) ?? floorById(BUILT_FLOOR[room])!

/** A key that changes whenever anything of the shell does (what the walls are built from). */
export const shellKey = (shell: HomeShell) => JSON.stringify([OPENINGS.map((o) => shell.openings[o.id]), ROOM_IDS.map((r) => shell.paint[r]), ROOM_IDS.map((r) => shell.floors[r])])

// ───────────────────────────── where an opening may go ─────────────────────────────

/** Why an opening cannot stand there along its wall (null: it can) — the walls only; what stands in the rooms is
 *  src/home/layout.ts's to judge. */
export function openingProblem(shell: HomeShell, id: string, at: OpeningAt): string | null {
  const def = openingById(id)
  if (!def) return 'Not in the house'
  if (!def.runs.includes(at.run)) return 'Not on that wall'
  if (def.kind === 'garden' && at.closed) return 'The way in stays open'
  const run = runById(at.run)!
  if (!Number.isFinite(at.centre)) return 'Not on that wall'
  const [a, b] = faceSpan(run)
  const half = def.width / 2
  const end = END_CLEAR[def.kind]
  if (at.centre - half < a + end - 1e-6 || at.centre + half > b - end + 1e-6) return 'Too near the corner'
  if (def.kind === 'garden') {
    // its leaves slide on into the wall: never past the house's corner
    const lineLo = run.axis === 'x' ? minX + E : minZ + E
    const lineHi = run.axis === 'x' ? maxX - E : maxZ - E
    if (at.centre - half - CLEAR.garden < lineLo - 1e-6 || at.centre + half + CLEAR.garden > lineHi + 1e-6) return 'Too near the corner'
  }
  if (at.closed) return null
  // apart from every other open opening along the same wall line (the runs on either side of a junction are one wall)
  for (const o of openingsOf(shell)) {
    if (o.id === id || o.closed || o.axis !== run.axis || o.at !== run.at) continue
    const gap = Math.max(CLEAR[def.kind], CLEAR[o.kind])
    if (at.centre - half < o.hi + gap - 1e-6 && at.centre + half > o.lo - gap + 1e-6) return o.kind === 'doorway' ? 'On the doorway' : o.kind === 'garden' ? 'On the garden door' : 'On the window'
  }
  return null
}

/** The shell with one opening put somewhere else (or closed, or opened). */
export const withOpening = (shell: HomeShell, id: string, at: OpeningAt): HomeShell => ({ ...shell, openings: { ...shell.openings, [id]: at } })

/** Where an opening may slide along a run: its middle from lo to hi (empty when lo > hi). */
export function openingRange(id: string, run: WallRun): [number, number] {
  const def = openingById(id)!
  const [a, b] = faceSpan(run)
  let lo = a + END_CLEAR[def.kind] + def.width / 2
  let hi = b - END_CLEAR[def.kind] - def.width / 2
  if (def.kind === 'garden') {
    lo = Math.max(lo, (run.axis === 'x' ? minX : minZ) + E + CLEAR.garden + def.width / 2)
    hi = Math.min(hi, (run.axis === 'x' ? maxX : maxZ) - E - CLEAR.garden - def.width / 2)
  }
  return [lo, hi]
}

/** Snapping along a wall: 0.1 m. */
export const snapAlong = (v: number) => Math.round(v * 10) / 10

/** The point on a run nearest a point on the floor, for an opening slid there: its middle along the run, snapped and kept
 *  in the run's range; and how far the point is from the run. */
export function slideOnRun(id: string, run: WallRun, x: number, z: number) {
  const [lo, hi] = openingRange(id, run)
  const along = run.axis === 'x' ? x : z
  const across = run.axis === 'x' ? z : x
  const c = Math.min(Math.max(snapAlong(along), Math.ceil(lo * 10 - 1e-6) / 10), Math.floor(hi * 10 + 1e-6) / 10)
  const dAlong = Math.max(0, run.from - along, along - run.to)
  return { centre: Math.round(c * 1000) / 1000, distance: Math.hypot(dAlong, across - run.at) }
}

/** A saved shell, checked: an opening saved on a wall it may not be on, off its wall, over another or as garbage stands
 *  where it was built; an unknown paint is as built, an unknown floor the room's own. Never throws. */
export function sanitizeShell(raw: unknown): HomeShell {
  const base = defaultShell()
  if (!isObject(raw)) return base
  const r = raw as Partial<Record<keyof HomeShell, unknown>>
  const out = defaultShell()
  const rec = (v: unknown) => (isRecord(v) ? v : {})
  const paint = rec(r.paint)
  const floors = rec(r.floors)
  for (const room of ROOM_IDS) {
    const p = Object.hasOwn(paint, room) ? paint[room] : null
    out.paint[room] = paintById(p) ? (p as string) : null
    const f = Object.hasOwn(floors, room) ? floors[room] : null
    out.floors[room] = floorById(f) ? (f as string) : BUILT_FLOOR[room]
  }
  const saved = rec(r.openings)
  const wanted: Record<string, OpeningAt> = {}
  for (const o of OPENINGS) {
    const s = Object.hasOwn(saved, o.id) ? rec(saved[o.id]) : {}
    const centre = typeof s.centre === 'number' && Number.isFinite(s.centre) ? Math.round(s.centre * 1000) / 1000 : NaN
    if (isRunId(s.run) && o.runs.includes(s.run) && Number.isFinite(centre)) wanted[o.id] = { run: s.run, centre, closed: s.closed === true && o.kind !== 'garden' }
  }
  // all of them as saved; then, while one does not fit, a moved one that does not goes back where it was built (or, when
  // only openings where they were built are in the way of each other, every moved one in that wall); if even that fails,
  // today's house
  out.openings = { ...base.openings, ...wanted }
  const moved = (id: string) => JSON.stringify(out.openings[id]) !== JSON.stringify(base.openings[id])
  for (let round = 0; round <= OPENINGS.length; round++) {
    const bad = OPENINGS.filter((o) => openingProblem(withOpening(out, o.id, out.openings[o.id]), o.id, out.openings[o.id]))
    if (!bad.length) return { ...out }
    const back = bad.find((o) => moved(o.id))
    if (back) out.openings = { ...out.openings, [back.id]: base.openings[back.id] }
    else {
      const run = runById(out.openings[bad[0].id].run)!
      for (const o of OPENINGS) {
        const r = runById(out.openings[o.id].run)!
        if (moved(o.id) && r.axis === run.axis && r.at === run.at) out.openings = { ...out.openings, [o.id]: base.openings[o.id] }
      }
    }
  }
  // (a new object each time: what is worked out from a shell is kept by the shell object, so it is never changed after)
  const tried = { ...out }
  return OPENINGS.some((o) => openingProblem(tried, o.id, tried.openings[o.id])) ? { ...out, openings: base.openings } : { ...out }
}

// ───────────────────────────── the pieces the walls are built of ─────────────────────────────

export type SegKind = 'wall' | 'trim' | 'glass' | 'fabric' | 'dark'

export interface Seg {
  key: string
  center: Vec3
  size: Vec3
  /** a wall's two faces each in its room's paint (lower side, higher side); everything else one colour */
  color: string
  faces?: [string, string]
  kind: SegKind
  axis: 'x' | 'z' // direction the piece runs along
  solid: boolean // gets a collider
  bottom?: boolean // wall piece that touches the floor → baseboard
  top?: boolean // wall piece that touches the ceiling → crown moulding
}

/** The walls between rooms, as built: one plaster grey on both sides. */
export const INTERIOR = '#d6d2ca'
export const TRIM = '#f4f2ee'

/** A room's side of a wall: its paint, or as built (an outer wall the room's own colour, a wall inside the plaster grey). */
export function faceColour(shell: HomeShell, room: RoomId, outerWall: boolean) {
  const p = paintById(shell.paint[room])
  return p ? p.hex : outerWall ? ROOMS[room].wall : INTERIOR
}

interface Gap {
  centre: number
  width: number
  y0?: number // bottom of the opening (windows); default floor
  y1?: number // top of the opening; default door height
}

/** A straight wall run, cut by openings. Pieces above/below an opening are generated too. */
function run(axis: 'x' | 'z', at: number, from: number, to: number, gaps: Gap[], faces: [string, string], tag: string): Seg[] {
  const out: Seg[] = []
  const add = (a: number, b: number, y0: number, y1: number, solid: boolean, suffix: string) => {
    const len = b - a
    if (len < 1e-3) return
    const mid = (a + b) / 2
    const cy = (y0 + y1) / 2
    const hh = y1 - y0
    out.push({
      key: `${tag}-${suffix}`,
      center: axis === 'x' ? [mid, cy, at] : [at, cy, mid],
      size: axis === 'x' ? [len, hh, T] : [T, hh, len],
      color: faces[0],
      faces,
      kind: 'wall',
      axis,
      solid,
      bottom: y0 === 0,
      top: y1 === H,
    })
  }
  let cursor = from
  gaps
    .filter((g) => g.centre - g.width / 2 >= from - 1e-6 && g.centre + g.width / 2 <= to + 1e-6)
    .sort((a, b) => a.centre - b.centre)
    .forEach((g, i) => {
      const a = g.centre - g.width / 2
      const b = g.centre + g.width / 2
      const y0 = g.y0 ?? 0
      const y1 = g.y1 ?? DH
      add(cursor, a, 0, H, true, `wall${i}`)
      if (y0 > 0) add(a, b, 0, y0, true, `sill${i}`)
      add(a, b, y1, H, false, `lintel${i}`)
      cursor = b
    })
  add(cursor, to, 0, H, true, 'end')
  return out
}

/** A box placed relative to a wall: `along` the wall, `off` out of it (towards +normal), world y. */
function piece(axis: 'x' | 'z', at: number, along: number, y: number, off: number, len: number, height: number, depth: number, rest: Pick<Seg, 'key' | 'color' | 'kind' | 'solid'>): Seg {
  return {
    ...rest,
    axis,
    center: axis === 'x' ? [along, y, at + off] : [at + off, y, along],
    size: axis === 'x' ? [len, height, depth] : [depth, height, len],
  }
}

function doorFrame(d: { axis: 'x' | 'z'; at: number; centre: number; width: number }, tag: string): Seg[] {
  const depth = T + 0.05
  const jamb = 0.07
  const rest = (k: string) => ({ key: `${tag}-${k}`, color: TRIM, kind: 'trim' as const, solid: false })
  const lo = d.centre - d.width / 2
  const hi = d.centre + d.width / 2
  // Inside the opening: their outer faces touch the wall back-to-back (never coplanar, same direction),
  // and they stand proud of both wall faces by the extra depth.
  return [
    piece(d.axis, d.at, lo + jamb / 2, (DH - jamb) / 2, 0, jamb, DH - jamb, depth, rest('l')),
    piece(d.axis, d.at, hi - jamb / 2, (DH - jamb) / 2, 0, jamb, DH - jamb, depth, rest('r')),
    piece(d.axis, d.at, d.centre, DH - jamb / 2, 0, d.width, jamb, depth, rest('h')),
  ]
}

/** The curtains hang this far out past a window's sides; their rod reaches a little further. */
export const CURTAIN_REACH = 0.37

function windowPieces(w: WindowDef): Seg[] {
  const n = w.at > 0 ? -1 : 1 // towards the inside of the house
  const h = w.top - w.sill
  const mid = (w.sill + w.top) / 2
  const bar = 0.05
  const depth = T + 0.04
  const r = (k: string, kind: SegKind, solid = false, color = TRIM) => ({ key: `${w.id}-${k}`, color, kind, solid })
  const lo = w.centre - w.width / 2
  const hi = w.centre + w.width / 2
  const P = (k: string, along: number, y: number, off: number, len: number, height: number, d: number, kind: SegKind, solid = false, color = TRIM) =>
    piece(w.axis, w.at, along, y, off, len, height, d, r(k, kind, solid, color))
  const curtains = [
    P('cl', lo - 0.2, 1.33, n * 0.15, 0.34, 2.4, 0.08, 'fabric', true, '#c9bfae'),
    P('cr', hi + 0.2, 1.33, n * 0.15, 0.34, 2.4, 0.08, 'fabric', true, '#c9bfae'),
    P('rod', w.centre, 2.58, n * 0.15, w.width + 0.95, 0.03, 0.03, 'dark', false, '#2b2d30'),
  ]
  if (w.door) {
    // a garden door: jambs, a head and a flush threshold; its glass leaves slide into the wall (<GardenDoor />)
    return [
      P('fl', lo + bar / 2, w.top / 2, 0, bar, w.top, depth, 'trim'),
      P('fr', hi - bar / 2, w.top / 2, 0, bar, w.top, depth, 'trim'),
      P('ft', w.centre, w.top - bar / 2, 0, w.width, bar, depth, 'trim'),
      P('sill', w.centre, 0.006, 0, w.width, 0.012, depth + 0.06, 'dark', false, '#6d6a66'),
      ...curtains,
    ]
  }
  return [
    P('fl', lo + bar / 2, mid, 0, bar, h, depth, 'trim'),
    P('fr', hi - bar / 2, mid, 0, bar, h, depth, 'trim'),
    P('ft', w.centre, w.top - bar / 2, 0, w.width, bar, depth, 'trim'),
    P('fb', w.centre, w.sill + bar / 2, 0, w.width, bar, depth, 'trim'),
    P('mv', w.centre, mid, 0, 0.03, h - bar * 2, 0.06, 'trim'),
    P('mh', w.centre, mid + h * 0.12, 0, w.width - bar * 2, 0.03, 0.06, 'trim'),
    // the pane doubles as an invisible barrier so nothing walks or jumps out through the opening
    P('glass', w.centre, mid, 0, w.width - bar * 2, h - bar * 2, 0.012, 'glass', true, '#cfe3f2'),
    P('board', w.centre, w.sill - 0.016, n * 0.12, w.width + 0.16, 0.04, 0.26, 'trim'),
    // curtains: two panels and a rod
    ...curtains,
  ]
}

const segCache = new WeakMap<HomeShell, Seg[]>()

/** Every piece of the house's walls for a shell: the runs cut by its open openings, their frames, glass and curtains. */
export function wallSegments(shell: HomeShell): Seg[] {
  const cached = segCache.get(shell)
  if (cached) return cached
  const windows = windowsOf(shell)
  const doorways = doorwaysOf(shell)
  const gapsOn = (axis: 'x' | 'z', at: number): Gap[] => [
    ...windows.filter((w) => w.axis === axis && w.at === at).map((w) => ({ centre: w.centre, width: w.width, y0: w.sill, y1: w.top })),
    ...doorways.filter((d) => d.axis === axis && d.at === at).map((d) => ({ centre: d.centre, width: d.width })),
  ]
  // an outer wall: the outside as it was built (the room's own colour), the inside the room's paint
  const outerFaces = (room: RoomId, insideHigh: boolean): [string, string] => (insideHigh ? [ROOMS[room].wall, faceColour(shell, room, true)] : [faceColour(shell, room, true), ROOMS[room].wall])
  const inner = (low: RoomId, high: RoomId): [string, string] => [faceColour(shell, low, false), faceColour(shell, high, false)]
  // Every junction is built so that no two pieces overlap: north/south walls own the corners, west/east walls stop at
  // their inner faces, the z = 0 wall owns the central crossing (its two halves meet in it), the x = 0 wall stops at it.
  const segs = [
    ...run('x', minZ, minX - E, 0, gapsOn('x', minZ), outerFaces('office', true), 'n-office'),
    ...run('x', minZ, 0, maxX + E, gapsOn('x', minZ), outerFaces('kitchen', true), 'n-kitchen'),
    ...run('x', maxZ, minX - E, 0, gapsOn('x', maxZ), outerFaces('living', false), 's-living'),
    ...run('x', maxZ, 0, maxX + E, gapsOn('x', maxZ), outerFaces('bedroom', false), 's-bedroom'),
    ...run('z', minX, minZ + E, 0, gapsOn('z', minX), outerFaces('office', true), 'w-office'),
    ...run('z', minX, 0, maxZ - E, gapsOn('z', minX), outerFaces('living', true), 'w-living'),
    ...run('z', maxX, minZ + E, 0, gapsOn('z', maxX), outerFaces('kitchen', false), 'e-kitchen'),
    ...run('z', maxX, 0, maxZ - E, gapsOn('z', maxX), outerFaces('bedroom', false), 'e-bedroom'),
    // the walls between rooms, with their doorways
    ...run('x', 0, minX + E, 0, gapsOn('x', 0), inner('office', 'living'), 'mid-z-w'),
    ...run('x', 0, 0, maxX - E, gapsOn('x', 0), inner('kitchen', 'bedroom'), 'mid-z-e'),
    ...run('z', 0, minZ + E, -E, gapsOn('z', 0), inner('office', 'kitchen'), 'mid-x-n'),
    ...run('z', 0, E, maxZ - E, gapsOn('z', 0), inner('living', 'bedroom'), 'mid-x-s'),
    ...doorways.flatMap((d) => doorFrame(d, `door-${d.id}`)),
    ...windows.flatMap(windowPieces),
  ]
  segCache.set(shell, segs)
  return segs
}

/** A box in the world: min x, y, z, max x, y, z. */
export type Box = [number, number, number, number, number, number]
const segBox = (s: Seg): Box => [
  s.center[0] - s.size[0] / 2,
  s.center[1] - s.size[1] / 2,
  s.center[2] - s.size[2] / 2,
  s.center[0] + s.size[0] / 2,
  s.center[1] + s.size[1] / 2,
  s.center[2] + s.size[2] / 2,
]

const solidCache = new WeakMap<HomeShell, Box[]>()
/** What nothing in the house may stand in: the walls (open only at the doorways), the windows' panes and boards and the
 *  garden door's opening (its leaves shut it). */
export function shellSolids(shell: HomeShell): Box[] {
  let out = solidCache.get(shell)
  if (out) return out
  out = wallSegments(shell)
    .filter((s) => s.kind === 'wall' || s.kind === 'glass' || s.key.endsWith('-board'))
    .map(segBox)
  const g = gardenDoorOf(shell)
  out.push(g.axis === 'x' ? [g.centre - g.width / 2, 0, g.at - E, g.centre + g.width / 2, g.top, g.at + E] : [g.at - E, 0, g.centre - g.width / 2, g.at + E, g.top, g.centre + g.width / 2])
  solidCache.set(shell, out)
  return out
}

/** Whether two boxes overlap (by more than `gap`). */
export const boxesMeet = (a: Box, b: Box, gap = 0.005) => a[0] < b[3] - gap && a[3] > b[0] + gap && a[1] < b[4] - gap && a[4] > b[1] + gap && a[2] < b[5] - gap && a[5] > b[2] + gap
