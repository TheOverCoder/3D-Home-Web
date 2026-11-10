import { APRON, GARDEN, GATE, HOUSE } from '../data/layout'
import { SHRUB_SPOTS, CORNER_TREES } from '../data/garden'
import { BED, BEDS, MACHINES, PATH_X, SHED, STAND } from './data'

// Where the farm's movable things stand, and the land they may stand on. A "place" is a whole thing moved in one
// go in the edit mode (the hen run with its coop, the cows' pasture, the sheep fold, the lemon tree, the big
// trees): its footprint is a rectangle in its own frame, turned in quarter turns. Land is the home garden plus
// fields for sale round it; a place fits where it is on owned land and clear of the house, the beds, the paths, the
// workshop and the other places. Everything here is plain data and arithmetic (no scene, no state), so the scene,
// the farm's save and the tests share it.

export type PlaceId = 'hens' | 'cows' | 'sheep' | 'lemon' | 'tree0' | 'tree1' | 'tree2'
export type ParcelId = 'north' | 'east' | 'west' | 'northEast' | 'northWest'

export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Where a place stands: its middle, and how many quarter turns (0..3) it is turned (anticlockwise seen from above). */
export interface Placement {
  x: number
  z: number
  rot: number
}

export interface FarmLayout {
  places: Record<PlaceId, Placement>
  land: ParcelId[]
}

export interface PlaceDef {
  id: PlaceId
  name: string
  /** the footprint in its own frame (x across, z along), round its middle */
  local: Rect
  /** where you go in or reach in (a gate, the nest box): ground in front of it that must stay walkable */
  door?: Rect
  /** where it stands on a new farm */
  home: Placement
}

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): Rect => ({ minX, maxX, minZ, maxZ })

/** The movable places: footprints and where they start (the farm as it has always been laid out). */
export const PLACES: Record<PlaceId, PlaceDef> = {
  // the hen run, 3.6 × 4.6 m, its nest box sticking out of the west fence (you collect the eggs from outside)
  hens: { id: 'hens', name: 'Hen run and coop', local: rect(-2.2, 1.85, -2.35, 2.35), door: rect(-2.9, -2.2, -1.6, -0.4), home: { x: 11.6, z: 6.7, rot: 0 } },
  // the cows' pasture, 4.3 × 13 m, its gate in the west fence
  cows: { id: 'cows', name: "Cows' pasture", local: rect(-2.2, 2.2, -6.55, 6.55), door: rect(-3.0, -2.2, 1.7, 3.3), home: { x: 11.35, z: -2.9, rot: 0 } },
  // the sheep fold, 8.6 × 3.7 m, its gate in the south fence
  sheep: { id: 'sheep', name: 'Sheep fold', local: rect(-4.35, 4.35, -1.9, 1.9), door: rect(-0.9, 0.9, 1.9, 2.7), home: { x: -2.1, z: -10.45, rot: 0 } },
  lemon: { id: 'lemon', name: 'Lemon tree', local: rect(-1.0, 1.0, -1.0, 1.0), home: { x: -6.1, z: 10.3, rot: 0 } },
  ...(Object.fromEntries(CORNER_TREES.map(([x, z], i) => [`tree${i}`, { id: `tree${i}`, name: 'Tree', local: rect(-0.9, 0.9, -0.9, 0.9), home: { x, z, rot: 0 } }])) as Record<
    'tree0' | 'tree1' | 'tree2',
    PlaceDef
  >),
}

export const PLACE_IDS = Object.keys(PLACES) as PlaceId[]

export interface ParcelDef {
  id: ParcelId
  name: string
  price: number
  rect: Rect
  /** bought only next to land you have: one of these first */
  after?: ParcelId[]
}

/** The home garden, and the meadows round it you can buy (the lane runs along the south side: no land there). */
export const HOME_LAND: Rect = { ...GARDEN }
export const PARCELS: Record<ParcelId, ParcelDef> = {
  north: { id: 'north', name: 'North meadow', price: 150, rect: rect(GARDEN.minX, GARDEN.maxX, GARDEN.minZ - 12, GARDEN.minZ) },
  east: { id: 'east', name: 'East meadow', price: 150, rect: rect(GARDEN.maxX, GARDEN.maxX + 12, GARDEN.minZ, GARDEN.maxZ) },
  west: { id: 'west', name: 'West meadow', price: 150, rect: rect(GARDEN.minX - 12, GARDEN.minX, GARDEN.minZ, GARDEN.maxZ) },
  northEast: { id: 'northEast', name: 'North-east meadow', price: 200, rect: rect(GARDEN.maxX, GARDEN.maxX + 12, GARDEN.minZ - 12, GARDEN.minZ), after: ['north', 'east'] },
  northWest: { id: 'northWest', name: 'North-west meadow', price: 200, rect: rect(GARDEN.minX - 12, GARDEN.minX, GARDEN.minZ - 12, GARDEN.minZ), after: ['north', 'west'] },
}
export const PARCEL_IDS = Object.keys(PARCELS) as ParcelId[]

export function defaultLayout(): FarmLayout {
  return { places: Object.fromEntries(PLACE_IDS.map((id) => [id, { ...PLACES[id].home }])) as Record<PlaceId, Placement>, land: [] }
}

// ───────────────────────────── frames ─────────────────────────────

/** The turn of a placement, radians (what a group's rotation.y takes). */
export const turnOf = (p: Placement) => (((p.rot % 4) + 4) % 4) * (Math.PI / 2)

/** A point of a place's own frame, in the world. */
export function toWorld(p: Placement, lx: number, lz: number): [number, number] {
  const a = turnOf(p)
  const c = Math.round(Math.cos(a))
  const s = Math.round(Math.sin(a))
  return [p.x + lx * c + lz * s, p.z - lx * s + lz * c]
}

/** A world point, in a place's own frame. */
export function toLocal(p: Placement, x: number, z: number): [number, number] {
  const a = turnOf(p)
  const c = Math.round(Math.cos(a))
  const s = Math.round(Math.sin(a))
  const dx = x - p.x
  const dz = z - p.z
  return [dx * c - dz * s, dx * s + dz * c]
}

/** A rectangle of a place's own frame, in the world (quarter turns keep it a rectangle). */
export function rectToWorld(p: Placement, r: Rect): Rect {
  const [x0, z0] = toWorld(p, r.minX, r.minZ)
  const [x1, z1] = toWorld(p, r.maxX, r.maxZ)
  return rect(Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1))
}

export const footprint = (id: PlaceId, p: Placement) => rectToWorld(p, PLACES[id].local)
/** The ground in front of a place's way in, in the world (none for a tree). */
export const doorway = (id: PlaceId, p: Placement) => (PLACES[id].door ? rectToWorld(p, PLACES[id].door!) : null)

/** A point kept in world coordinates, carried along with its place when the place moves from `from` to `to`. */
export function carry(from: Placement, to: Placement, x: number, z: number): [number, number] {
  const [lx, lz] = toLocal(from, x, z)
  return toWorld(to, lx, lz)
}
export const samePlacement = (a: Placement, b: Placement) => a.x === b.x && a.z === b.z && a.rot === b.rot

const overlaps = (a: Rect, b: Rect, gap = 0) => a.minX < b.maxX + gap && a.maxX > b.minX - gap && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap
const grow = (r: Rect, d: number) => rect(r.minX - d, r.maxX + d, r.minZ - d, r.maxZ + d)
const around = (x: number, z: number, hx: number, hz: number) => rect(x - hx, x + hx, z - hz, z + hz)

// ───────────────────────────── land ─────────────────────────────

/** The land you have: the home garden and the fields bought. */
export const ownedRects = (layout: FarmLayout): Rect[] => [HOME_LAND, ...layout.land.map((id) => PARCELS[id].rect)]

/** Everything you have, as one box (for the camera, the edit view and the safety net). */
export function landBounds(layout: FarmLayout): Rect {
  const rs = ownedRects(layout)
  return rect(Math.min(...rs.map((r) => r.minX)), Math.max(...rs.map((r) => r.maxX)), Math.min(...rs.map((r) => r.minZ)), Math.max(...rs.map((r) => r.maxZ)))
}

/** Can this field be bought now (not yet yours, and next to land you have)? */
export function canBuyParcel(layout: FarmLayout, id: ParcelId): boolean {
  if (layout.land.includes(id)) return false
  const after = PARCELS[id].after
  return !after || after.some((a) => layout.land.includes(a))
}

const insideLand = (layout: FarmLayout, r: Rect, margin: number) => {
  // every point of the footprint (sampled every half metre) must be on owned land, a little in from its edge
  const rs = ownedRects(layout).map((o) => grow(o, -margin))
  const on = (x: number, z: number) => rs.some((o) => x >= o.minX && x <= o.maxX && z >= o.minZ && z <= o.maxZ)
  const nx = Math.max(1, Math.ceil((r.maxX - r.minX) / 0.5))
  const nz = Math.max(1, Math.ceil((r.maxZ - r.minZ) / 0.5))
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) if (!on(r.minX + ((r.maxX - r.minX) * i) / nx, r.minZ + ((r.maxZ - r.minZ) * j) / nz)) return false
  return true
}

// ───────────────────────────── what is in the way ─────────────────────────────

export interface Blocker {
  name: string
  rect: Rect
  /** you can walk on it (the paving, a path): nothing may stand there, but a gate may open onto it */
  walkable?: boolean
}

/** What never moves: the house and its paving, the beds and their paths, the shed, the stand, the gate, the
 *  workshop (oven, mill, loom) and the shrubs. */
export const BLOCKERS: Blocker[] = [
  { name: 'the house', rect: rect(HOUSE.minX, HOUSE.maxX, HOUSE.minZ, HOUSE.maxZ) },
  { name: 'the paving round the house', rect: rect(HOUSE.minX - APRON, HOUSE.maxX + APRON, HOUSE.minZ - APRON, HOUSE.maxZ + APRON), walkable: true },
  ...BEDS.map((b) => ({ name: 'a garden bed', rect: around(b.x, b.z, BED.w / 2 + 0.35, BED.d / 2 + 0.35) })),
  { name: 'the path', rect: rect(PATH_X - 0.75, PATH_X + 0.75, HOUSE.maxZ, GARDEN.maxZ), walkable: true },
  { name: 'the path', rect: rect(PATH_X, GATE.x + 0.8, 11.95, GARDEN.maxZ), walkable: true },
  { name: 'the shed', rect: rect(SHED.x - 1.2, SHED.x + 1.8, SHED.z - 1.45, SHED.z + 0.95) },
  { name: 'the farm stand', rect: around(STAND.x, STAND.z, 0.85, 0.55) },
  { name: 'the gate', rect: around(GATE.x, GARDEN.maxZ - 0.4, GATE.width / 2 + 0.6, 0.8), walkable: true },
  { name: 'the oven', rect: rect(MACHINES.oven.x - 1.3, MACHINES.oven.x + 1.2, MACHINES.oven.z - 1.45, MACHINES.oven.z + 0.7) },
  { name: 'the mill', rect: around(MACHINES.mill.x, MACHINES.mill.z, 0.95, 0.85) },
  { name: 'the loom', rect: around(MACHINES.loom.x, MACHINES.loom.z, 1.0, 0.85) },
  ...SHRUB_SPOTS.map(([x, z]) => ({ name: 'a shrub', rect: around(x, z, 0.45, 0.45) })),
]

export interface Fit {
  ok: boolean
  /** why not, in a few words ("on the path", "off your land") */
  reason?: string
}

const lower = (id: PlaceId) => PLACES[id].name[0].toLowerCase() + PLACES[id].name.slice(1)

/** Does a place fit at a placement: on your land, clear of everything else, and its way in open? */
export function canPlace(layout: FarmLayout, id: PlaceId, p: Placement): Fit {
  const r = footprint(id, p)
  const door = doorway(id, p)
  if (!insideLand(layout, r, 0.3)) return { ok: false, reason: 'Off your land' }
  for (const b of BLOCKERS) if (overlaps(r, b.rect)) return { ok: false, reason: `On ${b.name}` }
  for (const other of PLACE_IDS) {
    if (other === id) continue
    const at = layout.places[other]
    if (overlaps(r, footprint(other, at), 0.1)) return { ok: false, reason: `On the ${lower(other)}` }
    const theirs = doorway(other, at)
    if (theirs && overlaps(r, theirs)) return { ok: false, reason: `In the way into the ${lower(other)}` }
    if (door && overlaps(door, footprint(other, at))) return { ok: false, reason: `Its way in is blocked by the ${lower(other)}` }
  }
  if (door) {
    if (!insideLand(layout, door, 0)) return { ok: false, reason: 'Its way in faces off your land' }
    for (const b of BLOCKERS) if (!b.walkable && overlaps(door, b.rect)) return { ok: false, reason: `Its way in is blocked by ${b.name}` }
  }
  return { ok: true }
}

// ───────────────────────────── the boundary ─────────────────────────────

/** A straight run of the land's boundary: along x (at z = `at`) or along z (at x = `at`), and which way is out. */
export interface Edge {
  axis: 'x' | 'z'
  at: number
  from: number
  to: number
  out: 'north' | 'south' | 'east' | 'west'
}

/** The outline of the land you have, as straight runs (shared edges between fields drop out). */
export function boundary(layout: FarmLayout): Edge[] {
  const rs = ownedRects(layout)
  const owned = (x: number, z: number) => rs.some((o) => x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ)
  const xs = [...new Set(rs.flatMap((r) => [r.minX, r.maxX]))].sort((a, b) => a - b)
  const zs = [...new Set(rs.flatMap((r) => [r.minZ, r.maxZ]))].sort((a, b) => a - b)
  const out: Edge[] = []
  const add = (e: Edge) => {
    // join with the run before it when they meet in a straight line
    const last = out[out.length - 1]
    if (last && last.axis === e.axis && last.at === e.at && last.out === e.out && Math.abs(last.to - e.from) < 1e-6) last.to = e.to
    else out.push(e)
  }
  const E = 0.01
  // runs along x: between consecutive xs, at every z line, where one side is yours and the other is not
  for (const z of zs)
    for (let i = 0; i + 1 < xs.length; i++) {
      const mx = (xs[i] + xs[i + 1]) / 2
      const n = owned(mx, z - E)
      const s = owned(mx, z + E)
      if (n !== s) add({ axis: 'x', at: z, from: xs[i], to: xs[i + 1], out: n ? 'south' : 'north' })
    }
  for (const x of xs)
    for (let j = 0; j + 1 < zs.length; j++) {
      const mz = (zs[j] + zs[j + 1]) / 2
      const w = owned(x - E, mz)
      const e = owned(x + E, mz)
      if (w !== e) add({ axis: 'z', at: x, from: zs[j], to: zs[j + 1], out: w ? 'east' : 'west' })
    }
  return out
}

/** Is the line from a to b (a side of something) closed off by the land's own hedge or fence, running alongside
 *  within `within` metres all the way? (The pasture's fence leaves out a side the garden fence already closes.) */
export function alongBoundary(layout: FarmLayout, a: [number, number], b: [number, number], within = 0.7): boolean {
  const alongX = Math.abs(a[1] - b[1]) < 1e-6
  const lo = Math.min(alongX ? a[0] : a[1], alongX ? b[0] : b[1])
  const hi = Math.max(alongX ? a[0] : a[1], alongX ? b[0] : b[1])
  const line = alongX ? a[1] : a[0]
  return boundary(layout).some((e) => e.axis === (alongX ? 'x' : 'z') && Math.abs(e.at - line) <= within && e.from <= lo + 1e-6 && e.to >= hi - 1e-6)
}

/** Snaps a point to the half-metre grid the edit mode moves things on. */
export const snap = (v: number) => Math.round(v * 2) / 2

/** A layout read from a save: anything missing, misplaced or unknown goes back to where it starts. */
export function sanitizeLayout(raw: unknown): FarmLayout {
  const out = defaultLayout()
  if (!raw || typeof raw !== 'object') return out
  const r = raw as { places?: Record<string, unknown>; land?: unknown }
  if (Array.isArray(r.land)) for (const id of PARCEL_IDS) if (r.land.includes(id) && !out.land.includes(id)) out.land.push(id)
  // fields bought out of order are dropped
  out.land = out.land.filter((id) => !PARCELS[id].after || PARCELS[id].after!.some((a) => out.land.includes(a)))
  const saved = r.places ?? {}
  for (const id of PLACE_IDS) {
    const p = saved[id] as Partial<Placement> | undefined
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.rot)) continue
    out.places[id] = { x: p.x!, z: p.z!, rot: ((Math.round(p.rot!) % 4) + 4) % 4 }
  }
  // each must still fit (a bad save, or a farm from before a change): otherwise it goes home; and should one sent
  // home now clash with another, the whole farm goes back to how it started
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const id of PLACE_IDS) {
      if (canPlace(out, id, out.places[id]).ok || samePlacement(out.places[id], PLACES[id].home)) continue
      out.places[id] = { ...PLACES[id].home }
      moved = true
    }
    if (!moved) break
  }
  if (PLACE_IDS.some((id) => !canPlace(out, id, out.places[id]).ok)) out.places = defaultLayout().places
  return out
}
