import { GARDEN, GATE } from '../data/layout'
import { isObject } from '../lib/saved'
import { FARM_SHRUBS, CORNER_TREES } from '../data/garden'
import { WALK_INS, bounds } from '../data/buildings'
import { LOT } from '../data/lot'
import { CABIN } from '../data/market'
import { BED, BEDS, MACHINES, MOST_PLANTS, OFFICE, PATH_X, SHED, STAND, TRACTOR } from './data'
import { FRUIT, SHOP, type ShopKind } from './decor'

// Where the farm's movable things stand, and the land they may stand on. A "place" is a whole thing moved in one
// go in the edit mode (the hen run with its coop, the cows' pasture, the sheep fold, the silo, the barn, the lemon
// tree, the big trees, the mill, the loom and the oven): its footprint is a rectangle in its own frame, turned in quarter
// turns. Each built bed moves too, and the decoration and fruit plants bought in the edit mode stand where they are put
// (or wait in the farm's store). Land is the home garden plus fields for sale round it; a thing fits where it is on owned
// land and clear of the paths, the shed, the other things and their ways in. Everything here is plain data and
// arithmetic (no scene, no state), so the scene, the farm's save and the tests share it.

export type PlaceId = 'hens' | 'cows' | 'sheep' | 'silo' | 'barn' | 'lemon' | 'tree0' | 'tree1' | 'tree2' | 'mill' | 'loom' | 'oven'
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

/** A piece of decoration or a fruit plant standing on the farm: which, its kind, and where (its middle, quarter turns). */
export interface DecorPiece {
  id: number
  kind: ShopKind
  x: number
  z: number
  rot: number
}

export interface FarmLayout {
  places: Record<PlaceId, Placement>
  land: ParcelId[]
  /** where each bed stands, by its index in BEDS: a built bed can be moved; one not built yet (a staked-out plot, a
   *  field's bed not bought) stands where it was staked out */
  beds: Placement[]
  /** the decoration and fruit plants standing on the farm, in the order they were put down (a fruit kind's plants are
   *  its producer's animals in this order: src/farm/state.ts) */
  decor: DecorPiece[]
  /** bought and put away: how many of each kind wait in the farm's store, to be put down again for nothing */
  stored: Record<ShopKind, number>
  /** the id the next piece put down gets */
  next: number
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
  // the cows' pasture, 4.3 × 13 m, its gate in the west fence; the footprint takes in the milk bucket outside that fence,
  // south of the gate (TOOL_PLACES in src/models/tools.ts: its deepest skin stands 0.53 m out)
  cows: { id: 'cows', name: "Cows' pasture", local: rect(-2.75, 2.2, -6.55, 6.55), door: rect(-3.0, -2.2, 1.7, 3.3), home: { x: 11.35, z: -2.9, rot: 0 } },
  // the sheep fold, 8.6 × 3.7 m, its gate in the south fence; the footprint takes in the shears and their basket outside
  // that fence, east of the gate (the deepest skin stands 0.62 m out)
  sheep: { id: 'sheep', name: 'Sheep fold', local: rect(-4.35, 4.35, -1.9, 2.55), door: rect(-0.9, 0.9, 1.9, 2.7), home: { x: -2.1, z: -10.45, rot: 0 } },
  // the silo (what grows) and the barn (what the animals and the machines give), in the west yard, their doors
  // facing the house
  silo: { id: 'silo', name: 'Silo', local: rect(-1.3, 1.3, -1.3, 1.3), door: rect(1.3, 2.0, -0.6, 0.6), home: { x: -10.7, z: 0.4, rot: 0 } },
  barn: { id: 'barn', name: 'Barn', local: rect(-2.0, 2.0, -1.8, 1.8), door: rect(2.0, 2.8, -0.9, 0.9), home: { x: -11.4, z: -5.4, rot: 0 } },
  lemon: { id: 'lemon', name: 'Lemon tree', local: rect(-1.0, 1.0, -1.0, 1.0), home: { x: -6.1, z: 10.3, rot: 0 } },
  ...(Object.fromEntries(CORNER_TREES.map(([x, z], i) => [`tree${i}`, { id: `tree${i}`, name: 'Tree', local: rect(-0.9, 0.9, -0.9, 0.9), home: { x, z, rot: 0 } }])) as Record<
    'tree0' | 'tree1' | 'tree2',
    PlaceDef
  >),
  // the farm's kitchen (src/farm/Workshop.tsx, MACHINES in data.ts), each with where you stand to use it kept walkable:
  // the mill (its feed on the west side; the way kept open is the north end of that side, clear of the oven's table
  // beside it), the loom (the weaver's bench on its south side) and the oven (its mouth facing west, its table to the
  // north, the firewood behind it)
  mill: { id: 'mill', name: 'Mill', local: rect(-0.85, 0.9, -0.75, 0.9), door: rect(-1.55, -0.85, -0.75, -0.3), home: { x: MACHINES.mill.x, z: MACHINES.mill.z, rot: 0 } },
  loom: { id: 'loom', name: 'Loom', local: rect(-1.0, 1.3, -0.6, 1.15), door: rect(-0.6, 0.6, 1.15, 1.8), home: { x: MACHINES.loom.x, z: MACHINES.loom.z, rot: 0 } },
  oven: { id: 'oven', name: 'Oven', local: rect(-0.75, 1.2, -1.4, 0.7), door: rect(-1.5, -0.75, -0.5, 0.5), home: { x: MACHINES.oven.x, z: MACHINES.oven.z, rot: 0 } },
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

/** Where each bed stands on a new farm (where it was staked out). */
export const bedHome = (i: number): Placement => ({ x: BEDS[i].x, z: BEDS[i].z, rot: 0 })

/** Nothing in the farm's store. */
export const emptyStore = () => Object.fromEntries(Object.keys(SHOP).map((k) => [k, 0])) as Record<ShopKind, number>

export function defaultLayout(): FarmLayout {
  return {
    places: Object.fromEntries(PLACE_IDS.map((id) => [id, { ...PLACES[id].home }])) as Record<PlaceId, Placement>,
    land: [],
    beds: BEDS.map((_, i) => bedHome(i)),
    decor: [],
    stored: emptyStore(),
    next: 1,
  }
}

// ───────────────────────────── the decoration's ground ─────────────────────────────

/** What a kind of decoration (or fruit plant) takes on the ground, in its own frame (src/models/decor.ts,
 *  src/models/fruit.ts): half its size across (x) and along (z). `flat`: it lies on the ground and is walked on (a path,
 *  stepping stones): it may lie in front of a way in, and up to a bed's frame. `run`: a fence or hedge section, 2 m
 *  along x (SECTION_HALF), that meets another end to end or at a corner; `ends`: how far past each end it reaches (a
 *  fence's post, a hedge's rounded end, hidden in the next section of a run). `tile`: a path tile, laid edge to edge
 *  with the next (every 1.2 m: PATH_HALF). A tree's crown spreads past its footprint, over what is round it. */
export interface DecorFoot {
  hx: number
  hz: number
  flat?: boolean
  run?: boolean
  ends?: number
  tile?: boolean
}

export const DECOR_FEET: Record<ShopKind, DecorFoot> = {
  lamp: { hx: 0.3, hz: 0.3 },
  lantern: { hx: 0.32, hz: 0.15 },
  fence: { hx: 1.0, hz: 0.1, run: true, ends: 0.06 },
  hedge: { hx: 1.0, hz: 0.32, run: true, ends: 0.27 },
  path: { hx: 0.6, hz: 0.6, flat: true, tile: true },
  stones: { hx: 0.3, hz: 0.7, flat: true },
  bench: { hx: 0.75, hz: 0.35 },
  tree: { hx: 1.2, hz: 1.2 },
  pine: { hx: 1.1, hz: 1.1 },
  bush: { hx: 0.65, hz: 0.5 },
  roses: { hx: 0.6, hz: 0.45 },
  flowers: { hx: 0.6, hz: 0.45 },
  planter: { hx: 0.5, hz: 0.26 },
  birdbath: { hx: 0.42, hz: 0.38 },
  well: { hx: 0.8, hz: 0.65 },
  // a scarecrow: its arms out to the sides, its hat's brim a little before and behind it; the witch's broom reaches
  // out in front of her, the ribbons stream out to one side
  'scarecrow-farmer': { hx: 0.7, hz: 0.32 },
  'scarecrow-haymaker': { hx: 0.7, hz: 0.3 },
  'scarecrow-sunflower': { hx: 0.62, hz: 0.3 },
  'scarecrow-pumpkin': { hx: 0.72, hz: 0.3 },
  'scarecrow-witch': { hx: 0.68, hz: 0.5 },
  'scarecrow-crows': { hx: 0.7, hz: 0.3 },
  'scarecrow-ribbons': { hx: 0.85, hz: 0.3 },
  'scarecrow-pinwheel': { hx: 0.76, hz: 0.3 },
  'scarecrow-jingle': { hx: 0.7, hz: 0.3 },
  'apple-tree': { hx: 1.2, hz: 1.2 },
  'orange-tree': { hx: 1.1, hz: 1.1 },
  'cherry-tree': { hx: 1.2, hz: 1.2 },
  'blueberry-bush': { hx: 0.8, hz: 0.8 },
  'raspberry-bush': { hx: 0.65, hz: 0.6 },
}

/** Whether a name is a kind the shop sells (never a name every object has: `constructor`, `__proto__`). */
export const isShopKind = (v: unknown): v is ShopKind => typeof v === 'string' && Object.prototype.hasOwnProperty.call(SHOP, v)

/** Kinds the shop once sold, and the kind each is now: the first three scarecrows (of the English and Scottish
 *  fields) gave way to the nine, each to the nearest of them, opening at the same level — the ploughman in his wide
 *  hat to the farmer, the sack-headed bogle with a thing held up to the haymaker, the squire in his tall hat to the
 *  witch. A save that owns one keeps it, standing where it stood or in the store, as the kind it is now. */
export const RENAMED_KINDS: Readonly<Record<string, ShopKind>> = {
  'scarecrow-ploughman': 'scarecrow-farmer',
  'scarecrow-bogle': 'scarecrow-haymaker',
  'scarecrow-squire': 'scarecrow-witch',
}
/** A kind's name as saved, as the kind it is now (a name never renamed as it was). */
export const kindNow = (v: unknown): unknown => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(RENAMED_KINDS, v) ? RENAMED_KINDS[v] : v)
/** A fruit tree or bush (a producer of the farm). */
export const isPlant = (kind: ShopKind) => Object.prototype.hasOwnProperty.call(FRUIT, kind)
/** The most of a kind the farm can own (placed and stored): a fruit kind's most plants; decoration, as many as any
 *  farm could pay for. */
export const mostOf = (kind: ShopKind) => (isPlant(kind) ? MOST_PLANTS : 999)

/** A piece's footprint, in the world (a run's ends included). */
export const decorRect = (d: { kind: ShopKind; x: number; z: number; rot: number }) => {
  const f = DECOR_FEET[d.kind]
  const e = f.ends ?? 0
  return rectToWorld(d, rect(-f.hx - e, f.hx + e, -f.hz, f.hz))
}

/** A fence or hedge section's two ends, in the world. */
export function runEnds(d: { kind: ShopKind; x: number; z: number; rot: number }): [[number, number], [number, number]] {
  const f = DECOR_FEET[d.kind]
  return [toWorld(d, -f.hx, 0), toWorld(d, f.hx, 0)]
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

/** Less than this is touching, not overlapping (sums like 0.4 − 0.85 come out a hair off the edge they make). */
const EPS = 1e-6
const overlaps = (a: Rect, b: Rect, gap = 0) => a.minX < b.maxX + gap - EPS && a.maxX > b.minX - gap + EPS && a.minZ < b.maxZ + gap - EPS && a.maxZ > b.minZ - gap + EPS
const grow = (r: Rect, d: number) => rect(r.minX - d, r.maxX + d, r.minZ - d, r.maxZ + d)
const around = (x: number, z: number, hx: number, hz: number) => rect(x - hx, x + hx, z - hz, z + hz)

// ───────────────────────────── land ─────────────────────────────

/** The land you have: the home garden and the fields bought. */
export const ownedRects = (layout: FarmLayout): Rect[] => [HOME_LAND, ...layout.land.map((id) => PARCELS[id].rect)]

/** Rectangles as one box round them all. */
const boxOf = (rs: Rect[]) => rect(Math.min(...rs.map((r) => r.minX)), Math.max(...rs.map((r) => r.maxX)), Math.min(...rs.map((r) => r.minZ)), Math.max(...rs.map((r) => r.maxZ)))

/** Everything you have, as one box (for the edit view). */
export const landBounds = (layout: FarmLayout): Rect => boxOf(ownedRects(layout))

/** A rectangle of the places' data (src/data: x0..x1, z0..z1) as one of the farm's. */
const fromData = (r: { x0: number; x1: number; z0: number; z1: number }): Rect => rect(r.x0, r.x1, r.z0, r.z1)

/** The ground you can be on: the land you have, the lot beyond the gate (its rows: src/data/lot.ts), and every walk-in
 *  building (src/data/buildings.ts) — for the camera, the safety net and walking to a mark (src/scene/Player.tsx,
 *  src/lib/route). What you may build on stays your own land. */
export const reachRects = (layout: FarmLayout): Rect[] => [...ownedRects(layout), ...LOT.map(fromData), ...WALK_INS.map((w) => fromData(bounds(w)))]

/** All the ground you can be on, as one box. */
export const reachBounds = (layout: FarmLayout): Rect => boxOf(reachRects(layout))

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

/** Where the path among the beds starts (it ran on from the house's paving when the house stood on the farm). */
const PATH_FROM = 7.6

/** What never moves: the path among the beds and the one to the gate, the shed, the stand, the gate, the order office
 *  and the tractor's track out through the west hedge (as far as the west meadow reaches), and the shrubs by the
 *  boundary. (The house is on a map of its own: where it stood is free land. The beds, the mill, the loom and the oven
 *  move: they are the layout's.) */
export const BLOCKERS: Blocker[] = [
  { name: 'the path', rect: rect(PATH_X - 0.75, PATH_X + 0.75, PATH_FROM, GARDEN.maxZ), walkable: true },
  // (from the gravel's edge: the beds' last row ends where it begins)
  { name: 'the path', rect: rect(PATH_X, GATE.x + 0.8, 12.025, GARDEN.maxZ), walkable: true },
  { name: 'the shed', rect: rect(SHED.x - 1.2, SHED.x + 1.8, SHED.z - 1.45, SHED.z + 0.95) },
  { name: 'the farm stand', rect: around(STAND.x, STAND.z, 0.85, 0.55) },
  { name: 'the gate', rect: around(GATE.x, GARDEN.maxZ - 0.4, GATE.width / 2 + 0.6, 0.8), walkable: true },
  { name: 'the order office', rect: around(OFFICE.x, OFFICE.z, OFFICE.half.x, OFFICE.half.z) },
  { name: "the tractor's track", rect: rect(GARDEN.minX - 12.5, OFFICE.x + OFFICE.half.x, TRACTOR.z - 0.75, TRACTOR.z + 0.75), walkable: true },
  ...FARM_SHRUBS.map(([x, z]) => ({ name: 'a shrub', rect: around(x, z, 0.45, 0.45) })),
]

export interface Fit {
  ok: boolean
  /** why not, in a few words ("on the path", "off your land") */
  reason?: string
}

const lower = (id: PlaceId) => PLACES[id].name[0].toLowerCase() + PLACES[id].name.slice(1)
/** "a yard lamp", "an apple tree" */
const aDecor = (kind: ShopKind) => {
  const name = SHOP[kind].name.toLowerCase()
  return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`
}

/** A bed on the ground (its soil; the frame's boards stand a little proud of it, beside the path), and the walk kept
 *  clear round it from anything solid. */
const BED_FRAME = rect(-BED.w / 2, BED.w / 2, -BED.d / 2, BED.d / 2)
const BED_WALK = 0.35
export const bedRect = (p: Placement) => rectToWorld(p, BED_FRAME)

/** Something that moves in the edit mode: a place, a bed (by its index in BEDS), or a piece of decoration (by its id). */
export type Thing = { kind: 'place'; id: PlaceId } | { kind: 'bed'; index: number } | { kind: 'decor'; id: number }

/** What a thing covers where it would stand: its footprint (`rect`), the ground kept clear round it from anything solid
 *  (`keep`: a bed's walk; the footprint for the rest), its way in, whether it lies flat on the ground, a fence or hedge
 *  section's middle (`core`: its ends may meet another's), and its name in a reason ("On the hen run"). */
interface Cover {
  thing: Thing
  rect: Rect
  keep: Rect
  door: Rect | null
  flat: boolean
  core: Rect | null
  label: string
}

export const sameThing = (a: Thing, b: Thing) =>
  a.kind === b.kind && (a.kind === 'place' ? a.id === (b as typeof a).id : a.kind === 'bed' ? a.index === (b as typeof a).index : a.id === (b as typeof a).id)

function placeCover(id: PlaceId, p: Placement): Cover {
  const r = footprint(id, p)
  return { thing: { kind: 'place', id }, rect: r, keep: r, door: doorway(id, p), flat: false, core: null, label: `the ${lower(id)}` }
}
function bedCover(index: number, p: Placement): Cover {
  const r = bedRect(p)
  return { thing: { kind: 'bed', index }, rect: r, keep: grow(r, BED_WALK), door: null, flat: false, core: null, label: 'a garden bed' }
}
function decorCover(d: DecorPiece): Cover {
  const f = DECOR_FEET[d.kind]
  const r = decorRect(d)
  // a run's middle: its footprint less its width at each end, where another may meet it
  const core = f.run ? rectToWorld(d, rect(-f.hx + f.hz, f.hx - f.hz, -f.hz, f.hz)) : null
  return { thing: { kind: 'decor', id: d.id }, rect: r, keep: r, door: null, flat: !!f.flat, core, label: aDecor(d.kind) }
}

/** Why `a` (being put down) may not stand with `b` there, or null. */
function clash(a: Cover, b: Cover): string | null {
  const places = a.thing.kind === 'place' && b.thing.kind === 'place'
  if (a.core && b.core) {
    if (overlaps(a.core, b.core)) return `On ${b.label}`
  } else {
    // a bed keeps its walk clear of a place or of something solid; flat things lie up to its frame
    const solid = (c: Cover) => c.thing.kind !== 'bed' && !c.flat
    const ra = solid(b) ? a.keep : a.rect
    const rb = solid(a) ? b.keep : b.rect
    if (overlaps(ra, rb, places ? 0.1 : 0)) return `On ${b.label}`
  }
  // a way in stays open: nothing but flat things in it
  if (b.door && !a.flat && overlaps(a.rect, b.door)) return `In the way into ${b.label}`
  if (a.door && !b.flat && overlaps(a.door, b.rect)) return `Its way in is blocked by ${b.label}`
  return null
}

/** Everything standing in a layout, as covers: the beds first (a reason names a bed before the path beside it). */
function coversOf(layout: FarmLayout): Cover[] {
  return [...layout.beds.map((p, i) => bedCover(i, p)), ...PLACE_IDS.map((id) => placeCover(id, layout.places[id])), ...layout.decor.map(decorCover)]
}

/** What a thing would cover at a placement. */
function coverAt(layout: FarmLayout, thing: Thing, p: Placement): Cover | null {
  if (thing.kind === 'place') return placeCover(thing.id, p)
  if (thing.kind === 'bed') return thing.index >= 0 && thing.index < layout.beds.length ? bedCover(thing.index, p) : null
  const d = layout.decor.find((x) => x.id === thing.id)
  return d ? decorCover({ ...d, x: p.x, z: p.z, rot: p.rot }) : null
}

/** Does a cover fit: on your land, clear of what never moves and of everything in `others` (itself left out)? */
function fits(layout: FarmLayout, a: Cover, others: readonly Cover[]): Fit {
  const land = a.thing.kind === 'decor' ? (a.flat ? 0 : 0.1) : 0.3
  if (!insideLand(layout, a.rect, land)) return { ok: false, reason: 'Off your land' }
  for (const b of others) {
    if (b.thing.kind !== 'bed' || sameThing(a.thing, b.thing)) continue
    const why = clash(a, b)
    if (why) return { ok: false, reason: why }
  }
  for (const b of BLOCKERS) if (overlaps(a.rect, b.rect)) return { ok: false, reason: `On ${b.name}` }
  for (const b of others) {
    if (b.thing.kind === 'bed' || sameThing(a.thing, b.thing)) continue
    const why = clash(a, b)
    if (why) return { ok: false, reason: why }
  }
  if (a.door) {
    if (!insideLand(layout, a.door, 0)) return { ok: false, reason: 'Its way in faces off your land' }
    for (const b of BLOCKERS) if (!b.walkable && overlaps(a.door, b.rect)) return { ok: false, reason: `Its way in is blocked by ${b.name}` }
  }
  return { ok: true }
}

/** Does a thing fit at a placement: on your land, clear of everything else, its way in open, and nothing's way in
 *  blocked by it? */
export function canPlaceThing(layout: FarmLayout, thing: Thing, p: Placement): Fit {
  const a = coverAt(layout, thing, p)
  if (!a) return { ok: false, reason: 'Not on the farm' }
  return fits(layout, a, coversOf(layout))
}

/** Does a place fit at a placement: on your land, clear of everything else, and its way in open? */
export const canPlace = (layout: FarmLayout, id: PlaceId, p: Placement): Fit => canPlaceThing(layout, { kind: 'place', id }, p)

/** Does a bed fit at a placement (its frame on your land, the walk round it clear)? */
export const canPlaceBed = (layout: FarmLayout, index: number, p: Placement): Fit => canPlaceThing(layout, { kind: 'bed', index }, p)

/** Would a new piece of a kind fit at a placement (one not on the farm yet: bought, or taken out of the store)? */
export function canPlaceNew(layout: FarmLayout, kind: ShopKind, p: Placement): Fit {
  return fits(layout, decorCover({ id: -1, kind, x: p.x, z: p.z, rot: p.rot }), coversOf(layout))
}

/** Where a thing stands now. */
export function placementOf(layout: FarmLayout, thing: Thing): Placement | null {
  if (thing.kind === 'place') return layout.places[thing.id]
  if (thing.kind === 'bed') return layout.beds[thing.index] ?? null
  const d = layout.decor.find((x) => x.id === thing.id)
  return d ? { x: d.x, z: d.z, rot: d.rot } : null
}

/** A thing's footprint at a placement, in the world (a bed's frame). */
export function thingRect(layout: FarmLayout, thing: Thing, p: Placement): Rect | null {
  return coverAt(layout, thing, p)?.rect ?? null
}

/** A thing's way in at a placement, if it has one. */
export function thingDoor(layout: FarmLayout, thing: Thing, p: Placement): Rect | null {
  return coverAt(layout, thing, p)?.door ?? null
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/** A piece put down near another it joins, moved so they meet (the grid puts most there already; this catches the near
 *  misses): a fence or hedge section with an end within `reach` metres of another's end, so the two ends are one; a path
 *  tile within `reach` of lying edge to edge with another (they are 1.2 m, the grid half a metre), so it does. */
export function joinRun(layout: FarmLayout, d: DecorPiece, reach = 0.6): DecorPiece {
  const f = DECOR_FEET[d.kind]
  let best: { dx: number; dz: number; d: number } | null = null
  const consider = (dx: number, dz: number) => {
    const dist = Math.hypot(dx, dz)
    if (dist <= reach && (!best || dist < best.d)) best = { dx, dz, d: dist }
  }
  if (f.run) {
    const mine = runEnds(d)
    for (const o of layout.decor) {
      if (o.id === d.id || !DECOR_FEET[o.kind].run) continue
      for (const [ox, oz] of runEnds(o)) for (const [mx, mz] of mine) consider(ox - mx, oz - mz)
    }
  } else if (f.tile) {
    const step = 2 * f.hx
    for (const o of layout.decor) {
      if (o.id === d.id || o.kind !== d.kind) continue
      for (const [sx, sz] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
      ])
        consider(o.x + sx - d.x, o.z + sz - d.z)
    }
  } else return d
  const b = best as { dx: number; dz: number } | null
  return b ? { ...d, x: round3(d.x + b.dx), z: round3(d.z + b.dz) } : d
}

/** A free spot for a new piece of a kind, nearest to (x, z) on the half-metre grid, on your land: its placement, or null
 *  where there is none within `most` metres. */
export function freeSpot(layout: FarmLayout, kind: ShopKind, x: number, z: number, rot = 0, most = 14): Placement | null {
  const covers = coversOf(layout)
  const cx = snap(x)
  const cz = snap(z)
  for (let ring = 0; ring <= most * 2; ring++) {
    // the grid points on the square ring this many steps out, nearest first
    const spots: [number, number][] = []
    for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) if (Math.max(Math.abs(i), Math.abs(j)) === ring) spots.push([cx + i * 0.5, cz + j * 0.5])
    spots.sort((a, b) => Math.hypot(a[0] - x, a[1] - z) - Math.hypot(b[0] - x, b[1] - z))
    for (const [sx, sz] of spots) {
      const p = { x: sx, z: sz, rot }
      if (fits(layout, decorCover({ id: -1, kind, ...p }), covers).ok) return p
    }
  }
  return null
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
export const boundary = (layout: FarmLayout): Edge[] => outline(ownedRects(layout))

/** The outline of rectangles together, as straight runs (shared edges drop out). */
function outline(rs: Rect[]): Edge[] {
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

/**
 * The edges of the lot (its rows: src/data/lot.ts) that nothing closes, where an invisible wall stands (src/farm/Land.tsx):
 * along them stands no wall of a walk-in building nor its doorway (the way in), nor the cabin, and your own land is not
 * beyond them (its fence closes that, with the gate open in it).
 */
export function lotEdges(layout: FarmLayout): Edge[] {
  const TOUCH = 0.05 // a wall this near the edge's line stands on it
  const owned = ownedRects(layout)
  const standing = [...WALK_INS.flatMap((w) => [...w.walls.filter((b) => b.y0 < 0.5), ...w.doors]), CABIN].map(fromData)
  const out: Edge[] = []
  for (const e of outline(LOT.map(fromData))) {
    const along = e.axis === 'x'
    // just outside the edge, across it
    const beyond = e.at + (e.out === 'south' || e.out === 'east' ? 0.01 : -0.01)
    const lo = (r: Rect) => (along ? r.minX : r.minZ)
    const hi = (r: Rect) => (along ? r.maxX : r.maxZ)
    const acrossLo = (r: Rect) => (along ? r.minZ : r.minX)
    const acrossHi = (r: Rect) => (along ? r.maxZ : r.maxX)
    // where along the edge something closes it
    const shut = [...standing.filter((r) => acrossLo(r) <= e.at + TOUCH && acrossHi(r) >= e.at - TOUCH), ...owned.filter((r) => acrossLo(r) < beyond && beyond < acrossHi(r))]
      .map((r) => [Math.max(e.from, lo(r)), Math.min(e.to, hi(r))] as const)
      .filter(([a, b]) => b > a)
      .sort((p, q) => p[0] - q[0])
    // and what is left open between
    let from = e.from
    for (const [a, b] of shut) {
      if (a - from > TOUCH) out.push({ ...e, from, to: a })
      from = Math.max(from, b)
    }
    if (e.to - from > TOUCH) out.push({ ...e, from, to: e.to })
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

/** All the land there is, bought or for sale, as one box. */
const ALL_LAND = landBounds({ ...defaultLayout(), land: PARCEL_IDS })

/** The most pieces that stand on the farm at once as a save is read (a hand-edited save with more puts the rest in the
 *  store: every piece is checked against every other). */
const MOST_STANDING = 1500
/** The highest id a piece may have (a count of pieces ever put down: no farm comes near it). */
const MOST_ID = 1e9

/** A placement as saved, made safe: on the land there is (one saved far off is moved onto it: no huge number reaches the
 *  checks), a quarter turn from 0 to 3; null for one that is no placement. */
function savedPlacement(v: unknown): Placement | null {
  if (!isObject(v) || !Number.isFinite(v.x) || !Number.isFinite(v.z) || !Number.isFinite(v.rot)) return null
  const x = Math.min(ALL_LAND.maxX, Math.max(ALL_LAND.minX, v.x as number))
  const z = Math.min(ALL_LAND.maxZ, Math.max(ALL_LAND.minZ, v.z as number))
  return { x, z, rot: ((Math.round(v.rot as number) % 4) + 4) % 4 }
}

/**
 * A layout read from a save: anything missing, misplaced or unknown goes back to where it starts. `built`: which beds
 * are built (src/farm/state.ts reads the beds first): only those may stand anywhere but where they were staked out.
 * The decoration that no longer fits where it was saved (a field not bought any more, a place sent home onto it) goes
 * into the farm's store, never lost; an unknown kind is dropped.
 */
export function sanitizeLayout(raw: unknown, built: readonly boolean[] = []): FarmLayout {
  const out = defaultLayout()
  if (!isObject(raw)) return out
  const r = raw as { places?: unknown; land?: unknown; beds?: unknown; decor?: unknown; stored?: unknown; next?: unknown }
  if (Array.isArray(r.land)) for (const id of PARCEL_IDS) if (r.land.includes(id) && !out.land.includes(id)) out.land.push(id)
  // fields bought out of order are dropped
  out.land = out.land.filter((id) => !PARCELS[id].after || PARCELS[id].after!.some((a) => out.land.includes(a)))
  const saved = isObject(r.places) ? r.places : {}
  for (const id of PLACE_IDS) {
    const p = savedPlacement(Object.prototype.hasOwnProperty.call(saved, id) ? saved[id] : null)
    if (p) out.places[id] = p
  }
  // a built bed where it was saved; the rest where they were staked out
  const beds: unknown[] = Array.isArray(r.beds) ? r.beds : []
  BEDS.forEach((_, i) => {
    const p = built[i] === true ? savedPlacement(beds[i]) : null
    if (p) out.beds[i] = p
  })
  // each place and bed must still fit (a bad save, or a farm from before a change): otherwise it goes home; and should
  // one sent home now clash with another, the whole farm goes back to how it started
  const things: { thing: Thing; home: Placement }[] = [
    ...PLACE_IDS.map((id) => ({ thing: { kind: 'place', id } as Thing, home: PLACES[id].home })),
    ...BEDS.map((_, i) => ({ thing: { kind: 'bed', index: i } as Thing, home: bedHome(i) })),
  ]
  const at = (t: Thing) => placementOf(out, t)!
  const put = (t: Thing, p: Placement) => {
    if (t.kind === 'place') out.places[t.id] = { ...p }
    else if (t.kind === 'bed') out.beds[t.index] = { ...p }
  }
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const { thing, home } of things) {
      if (canPlaceThing(out, thing, at(thing)).ok || samePlacement(at(thing), home)) continue
      put(thing, home)
      moved = true
    }
    if (!moved) break
  }
  if (things.some(({ thing }) => !canPlaceThing(out, thing, at(thing)).ok)) {
    out.places = defaultLayout().places
    out.beds = defaultLayout().beds
  }
  // what waits in the store: a count of each kind (one saved under a name it had once counted as the kind it is now)
  const store = isObject(r.stored) ? r.stored : {}
  const counts = new Map<ShopKind, number>()
  for (const name of Object.keys(store)) {
    const kind = kindNow(name)
    const n = store[name]
    if (isShopKind(kind) && typeof n === 'number' && Number.isFinite(n)) counts.set(kind, (counts.get(kind) ?? 0) + Math.max(0, Math.round(n)))
  }
  for (const kind of Object.keys(out.stored) as ShopKind[]) out.stored[kind] = Math.min(mostOf(kind), counts.get(kind) ?? 0)
  // the decoration, in the order it was put down: each where it was saved if it fits there (with its own id, once),
  // otherwise into the store
  const list: unknown[] = Array.isArray(r.decor) ? r.decor : []
  const covers = coversOf(out)
  const ids = new Set<number>()
  const standing = new Map<ShopKind, number>()
  const keep: DecorPiece[] = []
  const later: DecorPiece[] = []
  for (const v of list) {
    const kind = isObject(v) ? kindNow(v.kind) : null
    if (!isObject(v) || !isShopKind(kind)) continue
    const p = savedPlacement(v)
    const id = typeof v.id === 'number' && Number.isSafeInteger(v.id) && v.id >= 1 && v.id <= MOST_ID && !ids.has(v.id) ? v.id : null
    const d: DecorPiece = { id: id ?? -(later.length + 1), kind, x: p?.x ?? 0, z: p?.z ?? 0, rot: p?.rot ?? 0 }
    const fit = p && keep.length < MOST_STANDING && (standing.get(kind) ?? 0) < mostOf(kind) && fits(out, decorCover(d), covers).ok
    if (!fit) {
      out.stored[kind] = Math.min(mostOf(kind), out.stored[kind] + 1)
      continue
    }
    if (id === null) later.push(d)
    else ids.add(id)
    keep.push(d)
    covers.push(decorCover(d))
    standing.set(kind, (standing.get(kind) ?? 0) + 1)
  }
  // the next id: past every one saved (and past what the save says, while that is a count)
  const next = typeof r.next === 'number' && Number.isSafeInteger(r.next) && r.next >= 1 && r.next <= MOST_ID + 1 ? r.next : 1
  out.next = Math.max(next, ...[...ids].map((id) => id + 1))
  for (const d of later) d.id = out.next++
  // a kind owns no more than its most (placed and stored)
  for (const kind of Object.keys(out.stored) as ShopKind[]) out.stored[kind] = Math.max(0, Math.min(out.stored[kind], mostOf(kind) - (standing.get(kind) ?? 0)))
  out.decor = keep
  return out
}
