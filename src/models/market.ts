import { Parts, Shape, lathe, merge, rgb, tube, type PartDef, type V3 } from '../lib/sculpt'
import type { Box, Rect, WalkIn } from '../data/buildings'
import { BAYS, BAY_WIDTH, CABIN, CONTRACTOR_SPOT, COUNTER, DESK, FRONT_DOOR, HALL, ISLAND, ISLAND_PANEL, MARKET_WALKIN, SCREEN, SHELF_RUN, SHELF_YS, TILL } from '../data/market'
import { grain, mix, structureParts, type Structure } from './structures'

// The supermarket and the contractor's cabin, sculpted from their rows (src/data/market.ts), in world metres: put them
// at the origin.
//
//   shell     every wall box and the roof slab of a walk-in building (src/data/buildings.ts) as closed boxes, and
//             what stands with it (the market's: the contractor's site cabin) — one part, one material, the one
//             part that casts: brick outside (the material's surface), plain plaster inside, the roof, the parapet's
//             coping and the cabin kept plain by the per-vertex surface amount
//   fittings  what stands in it, none of which casts (the shell shades all of it): a bay of shelves (one model, put
//             at each of the ten bays), the island's middle panel, the counter with the till, the manager's desk with
//             the computer (its screen drawn by the scene at MARKET_SCREEN), the shop front over the door (the sign,
//             drawn by the scene at MARKET_SIGN, an awning, a shop window) and the cabin's counter window
//
// Every piece is a box with flat faces (its own four corners each), so the light and the brick lie flat on it and a
// wall costs twelve triangles; the colours change only from face to face, or at a line across a face (a plinth, a
// dado: a pattern linear in height, exact between any two corners).

const BRICK = rgb(0xa65a42)
const BRICK_LOW = rgb(0x7d4535)
const MORTAR = rgb(0xd9cbb4)
const PLASTER = rgb(0xede6d8)
const DADO = rgb(0x8fae8a)
const COPING = rgb(0xe6dfcf)
const ROOFING = rgb(0x6f7378)
const CEILING = rgb(0xf3eee4)
const CABIN_SIDE = rgb(0x5b7a96)
const CABIN_LOW = rgb(0x3f566b)
const CABIN_IN = rgb(0x48525c)
const CABIN_ROOF = rgb(0x8a9096)
const TRIM = rgb(0xece5d6)
const SHOP_GREEN = rgb(0x3f7d4a)
const SHOP_GREEN_DARK = rgb(0x2c5c36)
const SHELF = rgb(0xdfe2e0)
const SHELF_BACK = rgb(0xb7c9b0)
const KICK = rgb(0x5a5f63)
const TICKET = rgb(0xf2d68a)
const STEEL = rgb(0x9aa2a8)
const BLACK = rgb(0x2a2c2f)
const GLASS = rgb(0x26394a)
const GLASS_TOP = rgb(0x5f7f96)

// ───────────────────────────── boxes ─────────────────────────────

/** How a face of a box is painted: its colour, below `band.y` another (a plinth, a dado), and how much of the
 *  material's surface pattern shows on it (0 plain, the default; 1 the brick). */
interface Paint {
  color: V3
  band?: { y: number; color: V3 }
  surface?: number
}

/** The six faces of a box, each its outward normal and its corners in order round it (counter-clockwise seen from
 *  outside). */
const FACES: { n: V3; corners: (b: Box) => V3[] }[] = [
  {
    n: [1, 0, 0],
    corners: (b) => [
      [b.x1, b.y0, b.z1],
      [b.x1, b.y0, b.z0],
      [b.x1, b.y1, b.z0],
      [b.x1, b.y1, b.z1],
    ],
  },
  {
    n: [-1, 0, 0],
    corners: (b) => [
      [b.x0, b.y0, b.z0],
      [b.x0, b.y0, b.z1],
      [b.x0, b.y1, b.z1],
      [b.x0, b.y1, b.z0],
    ],
  },
  {
    n: [0, 1, 0],
    corners: (b) => [
      [b.x0, b.y1, b.z0],
      [b.x0, b.y1, b.z1],
      [b.x1, b.y1, b.z1],
      [b.x1, b.y1, b.z0],
    ],
  },
  {
    n: [0, -1, 0],
    corners: (b) => [
      [b.x0, b.y0, b.z0],
      [b.x1, b.y0, b.z0],
      [b.x1, b.y0, b.z1],
      [b.x0, b.y0, b.z1],
    ],
  },
  {
    n: [0, 0, 1],
    corners: (b) => [
      [b.x0, b.y0, b.z1],
      [b.x1, b.y0, b.z1],
      [b.x1, b.y1, b.z1],
      [b.x0, b.y1, b.z1],
    ],
  },
  {
    n: [0, 0, -1],
    corners: (b) => [
      [b.x1, b.y0, b.z0],
      [b.x0, b.y0, b.z0],
      [b.x0, b.y1, b.z0],
      [b.x1, b.y1, b.z0],
    ],
  },
]

/** A closed box with flat faces, each painted by `paint` (from its outward normal and its middle). */
function cuboid(b: Box, paint: Paint | ((n: V3, middle: V3) => Paint), hidden?: (corners: V3[], n: V3) => boolean): Shape {
  const s = new Shape()
  for (const f of FACES) {
    const corners = f.corners(b)
    if (hidden?.(corners, f.n)) continue
    const middle: V3 = [(b.x0 + b.x1) / 2 + (f.n[0] * (b.x1 - b.x0)) / 2, (b.y0 + b.y1) / 2 + (f.n[1] * (b.y1 - b.y0)) / 2, (b.z0 + b.z1) / 2 + (f.n[2] * (b.z1 - b.z0)) / 2]
    const p = typeof paint === 'function' ? paint(f.n, middle) : paint
    const first = s.count
    for (const [x, y, z] of corners) {
      const k = s.vertex(x, y, z, p.color, 0)
      if (p.band) {
        // the band's colour shows below its line: the pattern crosses 0.5 there, exactly, whatever the face's size
        s.m[k] = 0.5 + (p.band.y - y) * 50
        s.c2[k * 3] = p.band.color[0]
        s.c2[k * 3 + 1] = p.band.color[1]
        s.c2[k * 3 + 2] = p.band.color[2]
      }
      s.s[k] = p.surface ?? 0
    }
    s.tri(first, first + 1, first + 2)
    s.tri(first, first + 2, first + 3)
  }
  return s
}

/** A box from its two corners, x y z each. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({ x0, x1, y0, y1, z0, z1 })
/** A box round a middle point, by half-sizes. */
const around = (x: number, y: number, z: number, hx: number, hy: number, hz: number): Box => box(x - hx, x + hx, y - hy, y + hy, z - hz, z + hz)

const inRect = (r: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1

// ───────────────────────────── the shell ─────────────────────────────

/** Brick outside (with a darker plinth), plaster inside (with a dado): a face is inside when just in front of it is a
 *  room, or a doorway between two rooms, under the roof. */
function wallPaint(def: WalkIn) {
  const near = (a: Rect, b: Rect) => a.x0 <= b.x1 + 0.2 && a.x1 >= b.x0 - 0.2 && a.z0 <= b.z1 + 0.2 && a.z1 >= b.z0 - 0.2
  const within = [...def.rooms, ...def.doors.filter((d) => def.rooms.filter((r) => near(r, d)).length > 1)]
  return (n: V3, m: V3): Paint => {
    const x = m[0] + n[0] * 0.05
    const z = m[2] + n[2] * 0.05
    const inside = n[1] <= 0 && m[1] + n[1] * 0.05 > 0 && m[1] < def.roof.y && within.some((r) => inRect(r, x, z))
    return inside ? { color: PLASTER, band: { y: 0.9, color: DADO } } : { color: BRICK, band: { y: 0.32, color: BRICK_LOW }, surface: 1 }
  }
}

/** A box cut across wherever a room's edge crosses it (so each of its faces is all inside or all outside), and at `y`. */
function cut(b: Box, xs: number[], zs: number[], y: number): Box[] {
  const at = (lo: number, hi: number, cuts: number[]) => [lo, ...cuts.filter((c) => c > lo + 1e-6 && c < hi - 1e-6).sort((p, q) => p - q), hi]
  const out: Box[] = []
  const X = at(b.x0, b.x1, xs)
  const Z = at(b.z0, b.z1, zs)
  const Y = at(b.y0, b.y1, [y])
  for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Z.length - 1; j++) for (let k = 0; k < Y.length - 1; k++) out.push(box(X[i], X[i + 1], Y[k], Y[k + 1], Z[j], Z[j + 1]))
  return out
}

/**
 * A walk-in building's shell from its row: every wall box (cut where a room's edge crosses it, and where the roof's top
 * meets it, so the parapet above is brick on both sides), a coping along the parapet's top, the roof's slab over every
 * room (into the walls round it, so no light leaks at its edges), and `also` (shapes of their own, merged in: the
 * market's cabin). One part, one material: the only part of the building that casts.
 */
export function shellModel(def: WalkIn, also: Shape[] = []): Structure<'shell'> {
  const top = def.roof.y + def.roof.thick
  const paint = wallPaint(def)
  const xs = [...def.rooms, ...def.walls].flatMap((r) => [r.x0, r.x1])
  const zs = [...def.rooms, ...def.walls].flatMap((r) => [r.z0, r.z1])
  const walls = def.walls.flatMap((w) => cut(w, xs, zs, top))
  // the coping, a little proud of the wall on both sides (where walls meet, copings overlap: the same colour, flush)
  const pad = 0.03
  const copings = def.walls
    .filter((w) => w.y1 > top)
    .map((w) => {
      const along = w.x1 - w.x0 >= w.z1 - w.z0
      return box(w.x0 - (along ? 0 : pad), w.x1 + (along ? 0 : pad), w.y1, w.y1 + 0.06, w.z0 - (along ? pad : 0), w.z1 + (along ? pad : 0))
    })
  const into = 0.05
  const roofs = def.rooms.map((r) => box(r.x0 - into, r.x1 + into, def.roof.y, top, r.z0 - into, r.z1 + into))
  // where two boxes meet face to face (a wall cut in two, two walls at a corner), neither face is drawn: nothing is left
  // in the joint to flicker through the corner, and the boxes together stay closed
  const all = [...walls, ...copings, ...roofs]
  const faceKey = (corners: V3[]) =>
    corners
      .map((p) => p.map((v) => Math.round(v * 1e4)).join(','))
      .sort()
      .join(' ')
  const seen = new Map<string, number>()
  for (const b of all) for (const f of FACES) seen.set(faceKey(f.corners(b)), (seen.get(faceKey(f.corners(b))) ?? 0) + 1)
  const joint = (corners: V3[]) => (seen.get(faceKey(corners)) ?? 0) > 1
  const pieces = [
    ...walls.map((b) => cuboid(b, paint, joint)),
    ...copings.map((b) => cuboid(b, { color: COPING }, joint)),
    ...roofs.map((b) => cuboid(b, (n) => ({ color: n[1] > 0 ? ROOFING : CEILING }), joint)),
  ]
  return { shell: { shape: merge(...pieces, ...also), material: { roughness: 0.9, surface: { kind: 'brick', size: 0.9, joint: MORTAR, tone: 0.45 } }, castShadow: true } }
}

/** The contractor's cabin: a doorway in its north side (the way he comes and goes, about x 15.15: src/farm/script.ts),
 *  a counter window in its east side (CABIN_WINDOW: he stands inside at it, you outside), walls of painted panels, a
 *  flat roof a little over them. */
export const CABIN_WALL = 0.07
export const CABIN_WINDOW = { x: CABIN.x1, y: 1.4, z: CONTRACTOR_SPOT.z, half: [0.375, 0.45] as [number, number], heading: Math.PI / 2 } as const
/** The doorway in the cabin's north wall (z CABIN.z0): 0.8 m wide up to the east wall's inner face, 2.0 m high. */
export const CABIN_DOOR = { x0: CABIN.x1 - CABIN_WALL - 0.8, x1: CABIN.x1 - CABIN_WALL, y1: 2.0 } as const

export function cabinShape(): Shape {
  const { x0, x1, z0, z1, y0, y1 } = CABIN
  const t = CABIN_WALL
  const w = CABIN_WINDOW
  const outside = (n: V3, m: V3): Paint => {
    const inside = n[1] === 0 && inRect(CABIN, m[0] + n[0] * 0.03, m[2] + n[2] * 0.03)
    return inside ? { color: CABIN_IN } : { color: CABIN_SIDE, band: { y: 0.18, color: CABIN_LOW } }
  }
  const wz0 = w.z - w.half[0]
  const wz1 = w.z + w.half[0]
  const wy0 = w.y - w.half[1]
  const wy1 = w.y + w.half[1]
  const walls = [
    // north, round the door
    box(x0, CABIN_DOOR.x0, y0, y1, z0, z0 + t),
    box(CABIN_DOOR.x1, x1, y0, y1, z0, z0 + t),
    box(CABIN_DOOR.x0, CABIN_DOOR.x1, CABIN_DOOR.y1, y1, z0, z0 + t),
    // south, west
    box(x0, x1, y0, y1, z1 - t, z1),
    box(x0, x0 + t, y0, y1, z0 + t, z1 - t),
    // east, round the window
    box(x1 - t, x1, y0, wy0, z0 + t, z1 - t),
    box(x1 - t, x1, wy1, y1, z0 + t, z1 - t),
    box(x1 - t, x1, wy0, wy1, z0 + t, wz0),
    box(x1 - t, x1, wy0, wy1, wz1, z1 - t),
  ].map((b) => cuboid(b, outside))
  const roof = cuboid(box(x0 - 0.06, x1 + 0.06, y1, y1 + 0.07, z0 - 0.06, z1 + 0.06), (n) => ({ color: n[1] < 0 ? CABIN_IN : CABIN_ROOF }))
  return merge(...walls, roof)
}

/** A walk-in's shell with what stands with it (by its id: the market's cabin), as the one casting part. */
const SHELL_EXTRAS: Record<string, () => Shape[]> = { market: () => [cabinShape()] }

export function walkInShellModel(def: WalkIn): Structure<'shell'> {
  return shellModel(def, SHELL_EXTRAS[def.id]?.() ?? [])
}

/** The shell drawn: one instanced draw that casts, put at the origin (it is in world metres). */
export function walkInShellParts(def: WalkIn): Parts<'shell'> {
  return structureParts(walkInShellModel(def), `walk-in-${def.id}`)
}

/** The market's shell and the contractor's cabin. */
export const marketShellParts = () => walkInShellParts(MARKET_WALKIN)

// ───────────────────────────── the fittings ─────────────────────────────

/** A bay of shelves in its own frame: the middle of its front edge on the ground at the origin, facing +z (where you
 *  stand), its back BAY_DEPTH behind; the goods stand on its shelves at SHELF_YS. Put at each bay with its heading. */
export const BAY_DEPTH = ISLAND_PANEL.z0 - ISLAND.z0

function bayShape(): Shape {
  const h = BAY_WIDTH / 2
  const d = BAY_DEPTH
  const side = 0.015
  const top = SHELF_RUN.y1
  const parts = [
    // the sides, the back, the plinth and the canopy over the top shelf
    cuboid(box(-h, -h + side, 0, top, -d, 0), { color: SHELF }),
    cuboid(box(h - side, h, 0, top, -d, 0), { color: SHELF }),
    cuboid(box(-h + side, h - side, 0.1, top - 0.04, -d, -d + 0.02), { color: SHELF_BACK }),
    cuboid(box(-h + side, h - side, 0, 0.12, -d + 0.02, -0.015), { color: KICK }),
    cuboid(box(-h, h, top - 0.04, top, -d, 0.02), { color: SHELF }),
  ]
  for (const y of SHELF_YS) {
    // a shelf, its top where the goods stand, and the price strip along its front edge
    parts.push(cuboid(box(-h + side, h - side, y - 0.025, y, -d + 0.02, -0.005), { color: SHELF }))
    parts.push(cuboid(box(-h + side, h - side, y - 0.05, y - 0.008, -0.005, 0.004), { color: TICKET }))
  }
  return merge(...parts)
}

/** The island's middle: its opaque panel between the two faces' bays (ISLAND_PANEL), up to their canopy. */
function islandShape(): Shape {
  const p = ISLAND_PANEL
  return cuboid(box(p.x0, p.x1, 0, SHELF_RUN.y1, p.z0, p.z1), { color: SHELF_BACK })
}

/** The counter along the north wall by the door (COUNTER), the till on it (TILL), facing the shoppers who pay. */
function counterShape(): Shape {
  const c = COUNTER
  const top = c.y1
  const body = cuboid(box(c.x0, c.x1, 0.08, top - 0.03, c.z0, c.z1 - 0.03), (n) => ({ color: n[2] > 0 ? SHOP_GREEN : SHOP_GREEN_DARK, band: { y: 0.2, color: SHOP_GREEN_DARK } }))
  const kick = cuboid(box(c.x0 + 0.03, c.x1 - 0.03, 0, 0.08, c.z0, c.z1 - 0.06), { color: KICK })
  const board = cuboid(box(c.x0 - 0.02, c.x1 + 0.02, top - 0.03, top, c.z0, c.z1 + 0.02), (n, m) => ({ color: grain(0, 7)(m[0], m[1], m[2] + n[2]) }))
  // the till: a base with its drawer, the body with its keys sloping to the shopper, a display on a stalk
  const t = TILL
  const till = [
    cuboid(box(t.x - 0.18, t.x + 0.18, top, top + 0.08, t.z - 0.14, t.z + 0.14), (n) => ({ color: n[2] > 0 ? STEEL : BLACK })),
    cuboid(around(t.x, top + 0.04, t.z + 0.142, 0.15, 0.025, 0.003), { color: rgb(0x55595e) }),
    cuboid(box(t.x - 0.15, t.x + 0.15, top + 0.08, top + 0.13, t.z - 0.13, t.z + 0.06), { color: BLACK }),
    cuboid(around(t.x, top + 0.145, t.z + 0.0, 0.13, 0.016, 0.06), { color: rgb(0xd6d2c4) }),
    cuboid(around(t.x + 0.1, top + 0.2, t.z - 0.09, 0.015, 0.08, 0.015), { color: BLACK }),
    cuboid(around(t.x + 0.1, top + 0.3, t.z - 0.08, 0.07, 0.04, 0.012), (n) => ({ color: n[2] > 0 ? rgb(0x7fd38f) : BLACK })),
  ]
  return merge(body, kick, board, ...till)
}

/** Where the computer's screen is (its middle, half its size, and the way it faces: north, to the doorway): the scene
 *  draws the screen there, a plane just in front of the monitor. */
export const MARKET_SCREEN = { x: SCREEN.x, y: SCREEN.y, z: SCREEN.z - 0.003, half: [0.25, 0.15] as [number, number], heading: SCREEN.heading } as const

/** The manager's desk (DESK) across his room, the computer on it at SCREEN facing the doorway, a keyboard, a mug, and
 *  a chair tucked behind it. */
function deskShape(): Shape {
  const d = DESK
  const top = d.y1
  const wood = (n: V3, m: V3): Paint => ({ color: grain(0, 61)(m[0] + n[0] * 0.3, m[1], m[2]) })
  const desk = [
    cuboid(box(d.x0, d.x1, top - 0.03, top, d.z0, d.z1), wood),
    // a pedestal of drawers on the west, a leg panel on the east, a modesty panel across the front
    cuboid(box(d.x0 + 0.02, d.x0 + 0.42, 0, top - 0.03, d.z0 + 0.03, d.z1 - 0.02), wood),
    cuboid(box(d.x1 - 0.05, d.x1 - 0.02, 0, top - 0.03, d.z0 + 0.03, d.z1 - 0.02), wood),
    cuboid(box(d.x0 + 0.42, d.x1 - 0.05, 0.18, top - 0.03, d.z0 + 0.03, d.z0 + 0.05), wood),
    ...[0.18, 0.4, 0.6].map((y) => cuboid(around(d.x0 + 0.22, y, d.z1 - 0.018, 0.17, 0.08, 0.004), { color: mix(grain(0, 61)(0, y, 0), [0, 0, 0], 0.15) })),
  ]
  // the computer: a flat monitor (its face at SCREEN, its bezel round MARKET_SCREEN) on a stand, a keyboard beside it
  const s = MARKET_SCREEN
  const computer = [
    cuboid(box(s.x - s.half[0] - 0.02, s.x + s.half[0] + 0.02, s.y - s.half[1] - 0.02, s.y + s.half[1] + 0.02, SCREEN.z, SCREEN.z + 0.035), { color: BLACK }),
    cuboid(box(s.x - 0.03, s.x + 0.03, top, s.y - s.half[1], SCREEN.z + 0.035, SCREEN.z + 0.055), { color: rgb(0x3a3d42) }),
    cuboid(box(s.x - 0.11, s.x + 0.11, top, top + 0.012, SCREEN.z + 0.0, SCREEN.z + 0.14), { color: rgb(0x3a3d42) }),
    cuboid(box(s.x + 0.36, s.x + 0.8, top, top + 0.02, d.z0 + 0.06, d.z0 + 0.2), (n) => ({ color: n[1] > 0 ? rgb(0x4a4e54) : BLACK })),
  ]
  const mug = lathe(
    [
      [0, top - 0.002],
      [0.035, top - 0.002],
      [0.038, top + 0.09],
      [0.03, top + 0.09],
      [0.0, top + 0.02],
    ],
    { seg: 12, steps: 1 },
  )
    .place([d.x1 - 0.2, 0, d.z0 + 0.22])
    .fill(rgb(0xe9e2d2), 0)
  // the chair, behind the computer (the manager stands by it)
  const cx = s.x
  const cz = d.z1 + 0.28
  const seat = 0.46
  const chair = [
    cuboid(around(cx, seat - 0.02, cz, 0.21, 0.025, 0.21), wood),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cuboid(around(cx + sx * 0.17, (seat - 0.045) / 2, cz + sz * 0.17, 0.02, (seat - 0.045) / 2, 0.02), wood))),
    ...[-1, 1].map((sx) => cuboid(box(cx + sx * 0.17 - 0.02, cx + sx * 0.17 + 0.02, seat, seat + 0.42, cz + 0.15, cz + 0.19), wood)),
    cuboid(box(cx - 0.2, cx + 0.2, seat + 0.26, seat + 0.42, cz + 0.15, cz + 0.17), wood),
  ]
  return merge(...desk, ...computer, mug, ...chair)
}

/** Where the shop's sign is, over the door and the shop window (its face's middle, half its size, the way it faces):
 *  the scene draws the sign there, a plane just in front of its board. */
const FRONT = FRONT_DOOR.z0 // the hall's north wall's outer face
export const MARKET_SIGN = { x: 7.95, y: 2.93, z: FRONT - 0.062, half: [1.5, 0.26] as [number, number], heading: Math.PI } as const

/** The shop front on the north wall: the sign's board, an awning of green and cream stripes over the door and the shop
 *  window (on two arms), and the window itself (dark glass in a frame: the wall behind it is whole). */
function frontShape(): Shape {
  const sg = MARKET_SIGN
  const sign = [
    cuboid(box(sg.x - sg.half[0] - 0.05, sg.x + sg.half[0] + 0.05, sg.y - sg.half[1] - 0.05, sg.y + sg.half[1] + 0.05, FRONT - 0.04, FRONT), { color: SHOP_GREEN_DARK }),
    cuboid(box(sg.x - sg.half[0], sg.x + sg.half[0], sg.y - sg.half[1], sg.y + sg.half[1], FRONT - 0.06, FRONT - 0.04), { color: TRIM }),
  ]
  // the awning: from the wall at 2.55 m down to 2.3 m, 0.55 m out, in ten stripes, a valance along its front
  const x0 = 6.3
  const stripes = 10
  const w = 0.4
  const out = 0.55
  const rise = 0.25
  const slope = Math.atan2(rise, out)
  const len = Math.hypot(rise, out)
  const awning: Shape[] = []
  for (let k = 0; k < stripes; k++) {
    const color = k % 2 ? TRIM : SHOP_GREEN
    const cx = x0 + (k + 0.5) * w
    awning.push(
      cuboid(around(0, 0, 0, w / 2, 0.008, len / 2 + 0.01), { color }).place([cx, 2.3 + rise / 2, FRONT - out / 2], [-slope, 0, 0]),
      cuboid(box(cx - w / 2, cx + w / 2, 2.17, 2.3, FRONT - out - 0.012, FRONT - out + 0.004), { color }),
    )
  }
  for (const x of [x0 + 0.05, x0 + stripes * w - 0.05])
    awning.push(
      tube(
        [
          [x, 1.95, FRONT + 0.02],
          [x, 2.3, FRONT - out + 0.02],
        ],
        0.012,
        { seg: 6, steps: 1, caps: [true, true] },
      ).fill(BLACK, 0),
    )
  // the shop window east of the door: dark glass, lighter at the top (the sky in it), a frame and a bar down its middle
  const wx0 = 8.2
  const wx1 = 10.2
  const wy0 = 0.7
  const wy1 = 2.05
  const glass = cuboid(box(wx0, wx1, wy0, wy1, FRONT - 0.012, FRONT + 0.01), { color: GLASS_TOP, band: { y: 1.55, color: GLASS } })
  const frame = [
    cuboid(box(wx0 - 0.06, wx1 + 0.06, wy0 - 0.08, wy0, FRONT - 0.05, FRONT), { color: TRIM }),
    cuboid(box(wx0 - 0.06, wx1 + 0.06, wy1, wy1 + 0.06, FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(wx0 - 0.06, wx0, wy0, wy1, FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(wx1, wx1 + 0.06, wy0, wy1, FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box((wx0 + wx1) / 2 - 0.025, (wx0 + wx1) / 2 + 0.025, wy0, wy1, FRONT - 0.025, FRONT - 0.005), { color: TRIM }),
  ]
  return merge(...sign, ...awning, glass, ...frame)
}

/** The cabin's counter window: a frame round it, a counter board across it, inside and out, on two brackets. */
function windowShape(): Shape {
  const w = CABIN_WINDOW
  const x = w.x
  const z0 = w.z - w.half[0]
  const z1 = w.z + w.half[0]
  const y0 = w.y - w.half[1]
  const y1 = w.y + w.half[1]
  const f = 0.04
  const counter = (n: V3, m: V3): Paint => ({ color: grain(2, 17)(m[0], m[1] + n[1] * 0.2, m[2]) })
  return merge(
    cuboid(box(x - 0.005, x + 0.025, y1, y1 + f, z0 - f, z1 + f), { color: TRIM }),
    cuboid(box(x - 0.005, x + 0.025, y0, y1, z0 - f, z0), { color: TRIM }),
    cuboid(box(x - 0.005, x + 0.025, y0, y1, z1, z1 + f), { color: TRIM }),
    cuboid(box(x - CABIN_WALL - 0.12, x + 0.26, y0 - 0.04, y0, z0 - f, z1 + f), counter),
    ...[z0 + 0.08, z1 - 0.08].map((z) =>
      tube(
        [
          [x, y0 - 0.3, z],
          [x + 0.2, y0 - 0.03, z],
        ],
        0.014,
        { seg: 6, steps: 1, caps: [true, true] },
      ).fill(BLACK, 0),
    ),
  )
}

export type FittingPart = 'bay' | 'island' | 'counter' | 'desk' | 'front' | 'window'

let made: Record<FittingPart, Shape> | null = null

/** Every fitting's shape (built once). */
export function fittingShapes(): Record<FittingPart, Shape> {
  made ??= { bay: bayShape(), island: islandShape(), counter: counterShape(), desk: deskShape(), front: frontShape(), window: windowShape() }
  return made
}

/** Puts the fittings, each its own model (so the drawing pass leaves out each one nobody can see): a bay at each of
 *  the ten bays, the rest where they stand (they are in world metres). */
export function putMarketFittings(parts: Parts<FittingPart>) {
  parts.begin()
  for (const b of BAYS) {
    parts.at(b.x, 0, b.z, b.heading)
    parts.put('bay', 0, 0, 0)
  }
  for (const k of ['island', 'counter', 'desk', 'front', 'window'] as const) {
    parts.at(0, 0, 0)
    parts.put(k, 0, 0, 0)
  }
  parts.end()
}

/** The fittings drawn: one instanced draw a kind, none of them casting (the shell shades all of it), put at the
 *  origin. */
export function marketFittingsParts(): Parts<FittingPart> {
  const shapes = fittingShapes()
  const defs = {} as Record<FittingPart, PartDef>
  for (const k of Object.keys(shapes) as FittingPart[])
    defs[k] = { geometry: shapes[k].geometry(), max: k === 'bay' ? BAYS.length : 1, material: { roughness: 0.7 }, castShadow: false, receiveShadow: true }
  const parts = new Parts<FittingPart>(defs, 'market-fittings')
  putMarketFittings(parts)
  return parts
}

/** Where the hall is, for framing it (the gallery). */
export const MARKET_MIDDLE = { x: (HALL.x0 + Math.max(HALL.x1, CABIN.x1)) / 2, z: (HALL.z0 + HALL.z1) / 2 + 0.6 }
