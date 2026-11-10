import { DOOR, DOORWAYS, HOUSE, LAMPS, ROOMS, SPAWN, WINDOWS, roomAt, type RoomId } from '../data/layout'
import { SCREENS } from '../data/screens'
import { carry, rectToWorld, type Fit, type Placement, type Rect } from '../farm/layout'
import { PIECES, isPieceType, type PieceType } from './catalogue'

// Where the house's furniture stands, and the rules for moving it (pure, like src/farm/layout.ts): every piece is a
// rectangle on the floor in quarter turns; a spot is fine when the piece is inside one room clear of its walls, the
// room is not full (what its pieces draw stays within ROOM_WEIGHT), on nothing of its own layer (rugs lie under
// furniture), off the doorways, the door's swing and the hologram stands, not over a window's sill if taller, and when
// every doorway, screen and lamp can still be walked to from where you come in. The default is exactly where the house
// has always had it, so old saves and every test keep their house.

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
}

const piece = (id: string, type: PieceType, x: number, z: number, rot = 0): HomePiece => ({ id, type, x, z, rot })

/** The house as it has always been furnished (the coordinates of src/scene/Furnishings.tsx). */
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
    ],
    stored: [],
    next: 1,
  }
}

const DEFAULT = new Map(defaultHome().pieces.map((p) => [p.id, p]))

/** What stands on a piece of today's house and goes where it goes (lamps and things to pick up; the small things on
 *  tables and shelves are in src/scene/Dressing.tsx): its id → the piece's id. */
export const HOSTED: Record<string, string> = { 'lamp-desk': 'desk', 'lamp-bedside': 'nightstand', 'item-book': 'desk', 'item-gift': 'bed' }

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

/** A piece's own rectangle (centred on its middle, at no turn). */
export function localRect(type: PieceType): Rect {
  const [w, , d] = PIECES[type].size
  return { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 }
}

/** The floor a piece covers where it stands. */
export const footprint = (p: Pick<HomePiece, 'type' | 'x' | 'z' | 'rot'>) => rectToWorld(p, localRect(p.type))

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): Rect => ({ minX, maxX, minZ, maxZ })
const overlaps = (a: Rect, b: Rect, gap = 0) => a.minX < b.maxX + gap && a.maxX > b.minX - gap && a.minZ < b.maxZ + gap && a.maxZ > b.minZ - gap
const inside = (a: Rect, b: Rect) => a.minX >= b.minX - 1e-6 && a.maxX <= b.maxX + 1e-6 && a.minZ >= b.minZ - 1e-6 && a.maxZ <= b.maxZ + 1e-6

/** Half of the walls' thickness: a room's floor ends this far in from its bounds. */
const WALL = HOUSE.wallThickness / 2
const roomFloor = (id: RoomId) => {
  const b = ROOMS[id].bounds
  return rect(b.minX + WALL, b.maxX - WALL, b.minZ + WALL, b.maxZ - WALL)
}

// ───────────────────────────── what must stay clear ─────────────────────────────

/** The floor in front of each doorway, on both sides (0.9 m deep): floor pieces keep off it. */
const DOOR_STRIPS: { rect: Rect; to: string }[] = [
  ...Object.entries(DOORWAYS).map(([key, d]) => {
    const half = d.width / 2
    const r = d.axis === 'x' ? rect(d.centre - half, d.centre + half, d.at - 0.9, d.at + 0.9) : rect(d.at - 0.9, d.at + 0.9, d.centre - half, d.centre + half)
    const to: Record<string, string> = { livingOffice: 'the studio', kitchenBedroom: 'the bedroom', officeKitchen: 'the kitchen', livingBedroom: 'the bedroom' }
    return { rect: r, to: to[key] ?? 'the next room' }
  }),
  // the glass door to the garden
  ...WINDOWS.filter((w) => w.door).map((w) => ({ rect: rect(w.centre - w.width / 2, w.centre + w.width / 2, w.at - 0.9, w.at), to: 'the garden' })),
]

/** The quarter the hinged door sweeps as it opens into the bedroom. */
const DOOR_SWING = rect(DOOR.hinge[0], DOOR.hinge[0] + DOOR.width, DOOR.hinge[2], DOOR.hinge[2] + DOOR.width)

/** The hologram stands in front of the screens, the radiator under the bedroom's south window, and the standing lamp
 *  (a lamp on a piece of furniture goes where the piece goes). */
const FIXED: { rect: Rect; name: string }[] = [
  ...SCREENS.map((s) => ({ rect: rect(s.holo[0] - 0.35, s.holo[0] + 0.35, s.holo[2] - 0.35, s.holo[2] + 0.35), name: 'the hologram stand' })),
  { rect: rect(1.18, 2.22, 5.83, 5.92), name: 'the radiator' },
  ...LAMPS.filter((l) => l.kind === 'floor').map((l) => ({ rect: rect(l.position[0] - 0.32, l.position[0] + 0.32, l.position[2] - 0.32, l.position[2] + 0.32), name: 'the lamp' })),
]

/** Within this far of a window, nothing taller than its sill. */
const WINDOW_CLEAR = 0.25
const windowZones = WINDOWS.filter((w) => !w.door).map((w) => {
  const half = w.width / 2
  const d = WALL + WINDOW_CLEAR
  const r = w.axis === 'x' ? rect(w.centre - half, w.centre + half, w.at - d, w.at + d) : rect(w.at - d, w.at + d, w.centre - half, w.centre + half)
  return { rect: r, sill: w.sill }
})

// ───────────────────────────── what a room may draw ─────────────────────────────

/**
 * The most a room's furniture may draw: the sum of its pieces' weights (their triangles, src/home/catalogue.ts).
 * Walls hide nothing from the renderer, so a view also draws the rooms it looks towards: measured with the heaviest
 * piece (the easy chair) filling a room to this, the worst room view (the kitchen's, towards the bedroom) drew 194k
 * triangles, and 204k with all four rooms full: under the 250k a view may draw (tests/e2e/05-budget) with room to
 * spare for the farm outside. Today's house: living room 34.2k, bedroom 12.7k, studio 6.3k, kitchen 2.6k.
 */
export const ROOM_WEIGHT = 60_000

/** What a room's pieces draw (their weights), leaving one piece out (the one being moved). */
export function roomWeight(layout: HomeLayout, room: RoomId, except?: string): number {
  let sum = 0
  for (const p of layout.pieces) if (p.id !== except && roomAt(p.x, p.z) === room) sum += PIECES[p.type].weight
  return sum
}

/** Whether one more piece of this kind would put a room over ROOM_WEIGHT. */
export const roomFull = (layout: HomeLayout, room: RoomId, type: PieceType) => roomWeight(layout, room) + PIECES[type].weight > ROOM_WEIGHT

// ───────────────────────────── can it go there ─────────────────────────────

const lowerName = (t: PieceType) => PIECES[t].name[0].toLowerCase() + PIECES[t].name.slice(1)

/** Whether a piece fits where it is put (the rest of the layout as it stands), and if not, why in a few words. */
export function canPlacePiece(layout: HomeLayout, p: HomePiece): Fit {
  const def = PIECES[p.type]
  const fp = footprint(p)
  const room = roomAt(p.x, p.z)
  if (!room || !inside(fp, roomFloor(room))) return { ok: false, reason: 'Through the wall' }
  if (roomWeight(layout, room, p.id) + def.weight > ROOM_WEIGHT) return { ok: false, reason: 'This room is full' }
  for (const other of layout.pieces) {
    if (other.id === p.id || PIECES[other.type].layer !== def.layer) continue
    if (overlaps(fp, footprint(other), -0.005)) return { ok: false, reason: `On the ${lowerName(other.type)}` }
  }
  if (def.layer === 'floor') {
    for (const s of DOOR_STRIPS) if (overlaps(fp, s.rect, -0.005)) return { ok: false, reason: `Blocks the way to ${s.to}` }
    if (overlaps(fp, DOOR_SWING, -0.005)) return { ok: false, reason: "In the door's swing" }
    for (const f of FIXED) if (overlaps(fp, f.rect, -0.005)) return { ok: false, reason: `On ${f.name}` }
    for (const w of windowZones) if (def.size[1] > w.sill && overlaps(fp, w.rect, -0.005)) return { ok: false, reason: 'Covers the window' }
    const blocked = unreachable({ ...layout, pieces: layout.pieces.map((o) => (o.id === p.id ? p : o)).concat(layout.pieces.some((o) => o.id === p.id) ? [] : [p]) })
    if (blocked) return { ok: false, reason: `Blocks the way to ${blocked}` }
  }
  return { ok: true }
}

// ───────────────────────────── can everything still be walked to ─────────────────────────────

const CELL = 0.15
const BODY = 0.33 // the player's capsule radius and a little room
const GX = Math.round((HOUSE.maxX - HOUSE.minX) / CELL)
const GZ = Math.round((HOUSE.maxZ - HOUSE.minZ) / CELL)
const cellOf = (x: number, z: number) => [Math.floor((x - HOUSE.minX) / CELL), Math.floor((z - HOUSE.minZ) / CELL)] as const

/** Walls inside the house, with their doorways left open (rectangles, grown by the body when used). */
const INNER_WALLS: Rect[] = (() => {
  const out: Rect[] = []
  const gaps = (axis: 'x' | 'z') =>
    Object.values(DOORWAYS)
      .filter((d) => d.axis === axis)
      .map((d) => [d.centre - d.width / 2, d.centre + d.width / 2] as const)
      .sort((a, b) => a[0] - b[0])
  // the wall at z = 0, along x
  let from: number = HOUSE.minX
  for (const [a, b] of gaps('x')) {
    out.push(rect(from, a, -WALL, WALL))
    from = b
  }
  out.push(rect(from, HOUSE.maxX, -WALL, WALL))
  // the wall at x = 0, along z
  from = HOUSE.minZ
  for (const [a, b] of gaps('z')) {
    out.push(rect(-WALL, WALL, from, a))
    from = b
  }
  out.push(rect(-WALL, WALL, from, HOUSE.maxZ))
  return out
})()

/** What must stay reachable: the doorways, the floor near each screen's stand point and near each lamp. */
const GOALS: { x: number; z: number; within: number; name: string }[] = [
  ...Object.entries(DOORWAYS).map(([key, d]) => {
    const name: Record<string, string> = { livingOffice: 'the studio', kitchenBedroom: 'the bedroom', officeKitchen: 'the kitchen', livingBedroom: 'the bedroom' }
    return d.axis === 'x' ? { x: d.centre, z: d.at, within: 0.3, name: name[key] } : { x: d.at, z: d.centre, within: 0.3, name: name[key] }
  }),
  ...WINDOWS.filter((w) => w.door).map((w) => ({ x: w.centre, z: w.at - 0.5, within: 0.4, name: 'the garden' })),
  ...SCREENS.map((s) => {
    const a = s.rotationY
    return { x: s.position[0] + Math.sin(a) * 1.1, z: s.position[2] + Math.cos(a) * 1.1, within: 1.3, name: 'the screen' }
  }),
]
/** The lamps: one on a piece goes where the piece goes (and needs no reaching while it is put away). */
const lampGoals = (layout: HomeLayout) =>
  LAMPS.flatMap((l) => {
    const host = HOSTED[l.id]
    const at = host ? onHost(layout, host, l.position[0], l.position[2]) : [l.position[0], l.position[2]]
    return at ? [{ x: at[0], z: at[1], within: 1.2, name: 'the lamp' }] : []
  })

/** Whether, with this layout, something must-reach can no longer be walked to from where you come in: its name, or null. */
export function unreachable(layout: HomeLayout): string | null {
  const blocked = new Uint8Array(GX * GZ)
  const mark = (r: Rect) => {
    const [x0, z0] = cellOf(r.minX - BODY, r.minZ - BODY)
    const [x1, z1] = cellOf(r.maxX + BODY, r.maxZ + BODY)
    for (let z = Math.max(0, z0); z <= Math.min(GZ - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(GX - 1, x1); x++) blocked[z * GX + x] = 1
  }
  for (const p of layout.pieces) if (PIECES[p.type].layer === 'floor') mark(footprint(p))
  for (const w of INNER_WALLS) mark(w)
  for (const f of FIXED) mark(f.rect)
  // the outer walls
  for (let x = 0; x < GX; x++)
    for (let z = 0; z < GZ; z++) {
      const cx = HOUSE.minX + (x + 0.5) * CELL
      const cz = HOUSE.minZ + (z + 0.5) * CELL
      if (cx < HOUSE.minX + WALL + BODY || cx > HOUSE.maxX - WALL - BODY || cz < HOUSE.minZ + WALL + BODY || cz > HOUSE.maxZ - WALL - BODY) blocked[z * GX + x] = 1
    }
  // flood from where you come in
  const seen = new Uint8Array(GX * GZ)
  const [sx, sz] = cellOf(SPAWN[0], SPAWN[2])
  const queue: number[] = []
  const push = (x: number, z: number) => {
    if (x < 0 || z < 0 || x >= GX || z >= GZ) return
    const k = z * GX + x
    if (seen[k] || blocked[k]) return
    seen[k] = 1
    queue.push(k)
  }
  push(sx, sz)
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i]
    const x = k % GX
    const z = (k - x) / GX
    push(x + 1, z)
    push(x - 1, z)
    push(x, z + 1)
    push(x, z - 1)
  }
  for (const g of [...GOALS, ...lampGoals(layout)]) {
    const r = Math.ceil(g.within / CELL)
    const [gx, gz] = cellOf(g.x, g.z)
    let ok = false
    for (let z = gz - r; z <= gz + r && !ok; z++)
      for (let x = gx - r; x <= gx + r && !ok; x++) {
        if (x < 0 || z < 0 || x >= GX || z >= GZ || !seen[z * GX + x]) continue
        const cx = HOUSE.minX + (x + 0.5) * CELL
        const cz = HOUSE.minZ + (z + 0.5) * CELL
        if (Math.hypot(cx - g.x, cz - g.z) <= g.within) ok = true
      }
    if (!ok) return g.name
  }
  return null
}

// ───────────────────────────── snapping, free spots, saves ─────────────────────────────

/** Where a piece lands for a point the finger puts it at: on a 0.25 m grid, and flush with a wall it comes within 0.3 m of. */
export function snapPiece(p: HomePiece, x: number, z: number): HomePiece {
  const q = { ...p, x: Math.round(x * 4) / 4, z: Math.round(z * 4) / 4 }
  const room = roomAt(q.x, q.z)
  if (!room) return q
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

/** A free spot for a new piece in a room (nearest the room's middle first), or null when there is none (or the room
 *  is full: `roomFull`). */
export function findFreeSpot(layout: HomeLayout, type: PieceType, room: RoomId, id = 'new'): HomePiece | null {
  if (roomFull(layout, room, type)) return null
  const b = roomFloor(room)
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  const spots: [number, number][] = []
  for (let x = b.minX; x <= b.maxX; x += 0.25) for (let z = b.minZ; z <= b.maxZ; z += 0.25) spots.push([x, z])
  spots.sort((a, c) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(c[0] - cx, c[1] - cz))
  for (const rot of [0, 1])
    for (const [x, z] of spots) {
      const p = snapPiece({ id, type, x, z, rot }, x, z)
      if (roomAt(p.x, p.z) === room && canPlacePiece(layout, p).ok) return p
    }
  return null
}

/** A saved house, checked: unknown pieces dropped, pieces that no longer fit put away (never lost). */
export function sanitizeHome(raw: unknown): HomeLayout {
  const base = defaultHome()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<HomeLayout>
  const out: HomeLayout = { pieces: [], stored: Array.isArray(r.stored) ? r.stored.filter(isPieceType) : [], next: typeof r.next === 'number' && r.next > 0 ? Math.floor(r.next) : 1 }
  if (!Array.isArray(r.pieces)) return base
  const seen = new Set<string>()
  for (const p of r.pieces as Partial<HomePiece>[]) {
    if (!p || typeof p.id !== 'string' || seen.has(p.id) || !isPieceType(p.type)) continue
    if (![p.x, p.z, p.rot].every((v) => typeof v === 'number' && Number.isFinite(v))) continue
    const q = { id: p.id, type: p.type, x: p.x!, z: p.z!, rot: ((Math.round(p.rot!) % 4) + 4) % 4 }
    seen.add(q.id)
    // fitted pieces always stand where they were built
    const home = base.pieces.find((d) => d.id === q.id)
    if (PIECES[q.type].fitted) {
      if (home) out.pieces.push(home)
      continue
    }
    out.pieces.push(q)
  }
  // a fitted piece missing from the save comes back
  for (const d of base.pieces) if (PIECES[d.type].fitted && !out.pieces.some((p) => p.id === d.id)) out.pieces.push(d)
  // a room over what it may draw (a save from before the limit) puts away its newest pieces first (bought pieces come
  // last in the list), so the furniture it always had stays
  for (const p of [...out.pieces].reverse()) {
    const room = roomAt(p.x, p.z)
    if (PIECES[p.type].fitted || !room || roomWeight(out, room) <= ROOM_WEIGHT) continue
    out.pieces = out.pieces.filter((o) => o.id !== p.id)
    out.stored.push(p.type)
  }
  // whatever does not fit any more goes into storage, one by one
  for (const p of [...out.pieces]) {
    if (PIECES[p.type].fitted) continue
    if (!canPlacePiece(out, p).ok) {
      out.pieces = out.pieces.filter((o) => o.id !== p.id)
      out.stored.push(p.type)
    }
  }
  return out
}
