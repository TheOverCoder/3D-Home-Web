import { Shape, fbm3, lathe, loft, merge, noise3, rgb, smoothstep, squircle, tube, type SculptSurface, type V3 } from '../lib/sculpt'
import { grain, mix, slab, type Structure } from './structures'

// The farm's newer buildings, sculpted like the coop and the oven (src/models/structures.ts): built once in their own
// frame (the ground under their middle at the origin, the way in facing +x), a part per material.
//
//   silo     a round silo of corrugated steel on a concrete ring, a cone roof with a vent, a ladder up its side and a
//            timber door at its foot (what grows is kept in it; it is made bigger with iron, bolts and logs)
//   barn     a red barn of upright boards under a gambrel roof of shingles, white trim, a pair of braced doors and a
//            hayloft door in its gable, a cupola on the ridge (it is made bigger with bricks, planks and nails)
//   office   a small timber office with a doorway in its front, a window each side and a shingled roof: the order
//            board's computer is on a desk inside (desk)
//   desk     a desk with the computer on it (its screen is drawn by the scene, src/farm/OrderYard.tsx), a keyboard, a mug
//            and a chair
//   crate    a slatted crate: an order on its way, on the pallet or on the tractor
//   pallet   the pallet the crates wait on in the tractor's yard
//   gate     the farm gate in the hedge the tractor goes out through: two posts and a leaf (drawn twice, swinging)

const STEEL = rgb(0xb7c0c6)
const STEEL_DARK = rgb(0x7f8a92)
const CONCRETE = rgb(0xb3ada3)
const BARN_RED = rgb(0xb5523a)
const TRIM = rgb(0xece5d6)
const SHINGLE = rgb(0x46494c)
const WOOD = rgb(0x8a6440)
const WOOD_DARK = rgb(0x5e4630)
const PINE = rgb(0xd7b07a)
const SAGE = rgb(0x6f8f6a)
const GLASS = rgb(0x2d4250)
const BLACK = rgb(0x2a2c2f)

/** A straight piece of wood or steel from a to b: rx across (sideways), ry along `up`, its ends closed flat. */
function beam(a: V3, b: V3, rx: number, ry: number, up: V3 = [0, 1, 0], soft = 8): Shape {
  return loft(
    [
      { c: a, rx, ry },
      { c: b, rx, ry },
    ],
    { seg: 8, steps: 1, up, shape: (t) => squircle(t, soft), caps: [true, true] },
  )
}

/** A box with soft edges round (x, y, z): half-sizes. */
const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number, soft = 8, seg = 16) => slab(hx, hz, y - hy, y + hy, soft, seg).place([x, 0, z])

/** A flat polygon (in the plane x = `at`), seen from both sides: a gable's fill. Points as [z, y]. */
function gable(at: number, points: [number, number][], color: V3): Shape {
  const s = new Shape()
  const cz = points.reduce((n, p) => n + p[0], 0) / points.length
  const cy = points.reduce((n, p) => n + p[1], 0) / points.length
  const c = s.vertex(at, cy, cz, color, 0)
  const vs = points.map(([z, y]) => s.vertex(at, y, z, color, 0))
  for (let k = 0; k < vs.length; k++) {
    const a = vs[k]
    const b = vs[(k + 1) % vs.length]
    s.tri(c, a, b)
    s.tri(c, b, a)
  }
  return s
}

/** A roof slope from `low` to `high` (points in the y–z plane at x = 0), `half` long each way along x, `thick` thick,
 *  a little past both ends so slopes overlap where they meet. */
function slope(low: [number, number], high: [number, number], half: number, thick: number): Shape {
  const dz = high[0] - low[0]
  const dy = high[1] - low[1]
  const len = Math.hypot(dz, dy)
  const ez = (dz / len) * 0.03
  const ey = (dy / len) * 0.03
  // the slab's "up" is square to the slope, pointing out of the roof
  const up: V3 = [0, Math.abs(dz) / len, (-Math.sign(dz) * Math.abs(dy)) / len]
  return beam([0, low[1] - ey, low[0] - ez], [0, high[1] + ey, high[0] + ez], half, thick, up, 10)
}

// ───────────────────────────── the silo ─────────────────────────────

export type SiloPart = 'base' | 'shell' | 'roof' | 'steel' | 'door'

/** The silo: 2.4 m across, 5.5 m to the top of its vent. */
export function siloModel(): Structure<SiloPart> {
  const R = 1.05
  const top = 4.55
  // the concrete ring it stands on
  const base = lathe(
    [
      [0, 0],
      [1.2, 0],
      [1.2, 0.2],
      [1.13, 0.26],
      [0, 0.26],
    ],
    { seg: 40, steps: 1 },
  ).paint((x, y, z) => mix(CONCRETE, rgb(0x8f897f), 0.5 * smoothstep(0.4, 0.8, fbm3(x * 4, y * 4, z * 4, 3))), 0)
  // the shell: sheets of corrugated steel (the material's boards, lying: a rib every 10 cm), weathered lower down
  const shell = lathe(
    [
      [0, 0.2],
      [R, 0.2],
      [R, top + 0.04],
      [0, top + 0.04],
    ],
    { seg: 40, steps: 1 },
  ).paint((x, y, z) => mix(STEEL, rgb(0x9a8f80), 0.35 * smoothstep(1.2, 0.2, y) * fbm3(x * 3, y * 3, z * 3, 7)), 0)
  // the cone roof, ribbed from the eaves to the vent, and the vent's cap
  const roof = merge(
    lathe(
      [
        [0, top - 0.02],
        [R + 0.12, top - 0.02],
        [R + 0.12, top + 0.04],
        [0.22, top + 0.74],
        [0.0, top + 0.76],
      ],
      { seg: 48, steps: 1 },
    ).pattern((x, _y, z) => 0.5 + 0.55 * Math.sin(Math.atan2(z, x) * 24), rgb(0x9ea7ad)),
    lathe(
      [
        [0.0, top + 0.7],
        [0.12, top + 0.7],
        [0.12, top + 0.86],
        [0.24, top + 0.88],
        [0.14, top + 0.98],
        [0.0, top + 1.0],
      ],
      { seg: 16, steps: 1 },
    ),
  ).paint((_x, y) => mix(STEEL, rgb(0xd6dde1), smoothstep(top, top + 0.8, y) * 0.4), 0)
  // steel hoops round the shell, a ladder up its south side (two rails, a rung every 30 cm), a frame round the door
  const hoop = (y: number) =>
    lathe(
      [
        [R - 0.02, y - 0.03],
        [R + 0.025, y - 0.03],
        [R + 0.025, y + 0.03],
        [R - 0.02, y + 0.03],
      ],
      { seg: 40, steps: 1, caps: [true, true] },
    )
  const ladder: Shape[] = []
  const lz = R + 0.16
  for (const x of [-0.19, 0.19]) ladder.push(beam([x, 0.24, lz], [x, top + 0.18, lz], 0.022, 0.022, [0, 0, 1]))
  for (let y = 0.5; y < top; y += 0.3) ladder.push(beam([-0.2, y, lz], [0.2, y, lz], 0.014, 0.014, [0, 1, 0], 2))
  // brackets from the rails back into the shell
  for (const y of [1.2, 2.6, 4.0]) for (const x of [-0.19, 0.19]) ladder.push(beam([x, y, R - 0.06], [x, y, lz], 0.016, 0.016, [0, 1, 0]))
  const steel = merge(...[0.9, 2.0, 3.1, 4.2].map(hoop), ...ladder, box(R + 0.01, 0.95, 0, 0.05, 0.78, 0.47, 10))
    .paint(() => STEEL_DARK, 0)
    .surface(0)
  // the door: upright boards of timber, two strap hinges
  const door = merge(
    box(R + 0.03, 0.95, 0, 0.05, 0.68, 0.38, 10).paint(grain(1, 41), 0),
    ...[0.55, 1.35].map((y) =>
      box(R + 0.075, y, -0.1, 0.012, 0.03, 0.26, 8)
        .paint(() => BLACK, 0)
        .surface(0),
    ),
  )
  const corrugated: SculptSurface = { kind: 'boards', size: 0.4, tone: 0.25, bump: 0.8 }
  return {
    base: { shape: base, material: { roughness: 0.95 } },
    shell: { shape: shell, material: { roughness: 0.45, metalness: 0.35, surface: corrugated } },
    roof: { shape: roof, material: { roughness: 0.4, metalness: 0.4 } },
    steel: { shape: steel, material: { roughness: 0.5, metalness: 0.45 } },
    door: { shape: door, material: { roughness: 0.85, surface: { kind: 'boards', size: 0.5, turn: true, tone: 0.4 } } },
  }
}

// ───────────────────────────── the barn ─────────────────────────────

export type BarnPart = 'base' | 'walls' | 'roof' | 'trim' | 'doors'

/** The barn: 3.7 m long (along x, its doors at +x), 3.1 m wide, its ridge at 3.7 m (the cupola to 4.3). */
export function barnModel(): Structure<BarnPart> {
  const L = 1.85
  const W = 1.55
  const eaves = 2.2
  const knee: [number, number] = [1.0, 3.08]
  const ridge = 3.68
  const base = slab(L + 0.05, W + 0.05, 0, 0.3, 6, 24).paint((x, y, z) => mix(CONCRETE, rgb(0x8a8378), 0.45 * smoothstep(0.35, 0.75, fbm3(x * 4, y * 4, z * 4, 5))), 0)
  // the walls: upright red boards (the material's boards, 20 cm wide), and the gables up to the roof
  const outline: [number, number][] = [
    [-W, eaves - 0.02],
    [-knee[0], knee[1]],
    [0, ridge],
    [knee[0], knee[1]],
    [W, eaves - 0.02],
  ]
  const walls = merge(
    slab(L, W, 0.25, eaves, 9, 28).paint(() => BARN_RED, 0),
    gable(L, outline, BARN_RED),
    gable(-L, outline, BARN_RED),
  )
  // the gambrel roof: a steep slope and a shallow one each side, shingled, a cap along the ridge
  const eave: [number, number] = [W + 0.16, eaves - 0.06]
  const roof = merge(
    slope(eave, knee, L + 0.2, 0.035),
    slope(knee, [0, ridge], L + 0.2, 0.035),
    slope([-eave[0], eave[1]], [-knee[0], knee[1]], L + 0.2, 0.035),
    slope([-knee[0], knee[1]], [0, ridge], L + 0.2, 0.035),
    tube(
      [
        [-L - 0.2, ridge + 0.03, 0],
        [L + 0.2, ridge + 0.03, 0],
      ],
      0.05,
      { seg: 8, caps: [true, true] },
    ).surface(0),
    // the cupola's little pyramid roof
    lathe(
      [
        [0, 4.02],
        [0.36, 4.02],
        [0.0, 4.36],
      ],
      { seg: 4, steps: 1 },
    )
      .place([0, 0, 0], [0, Math.PI / 4, 0])
      .surface(0),
  ).paint(() => SHINGLE, 0)
  // white trim: corner boards, the boards along the gables' edges, round the doors, and the cupola
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(sx * (L - 0.02), (eaves + 0.25) / 2, sz * (W - 0.02), 0.05, (eaves - 0.25) / 2 + 0.02, 0.05, 6, 8)))
  const edge = (sx: number, a: [number, number], b: [number, number]) => beam([sx * (L + 0.02), a[1] + 0.02, a[0]], [sx * (L + 0.02), b[1] + 0.02, b[0]], 0.035, 0.05, [1, 0, 0], 8)
  const edges = [-1, 1].flatMap((sx) => [
    edge(sx, [-W, eaves], [-knee[0], knee[1]]),
    edge(sx, [-knee[0], knee[1]], [0, ridge]),
    edge(sx, [0, ridge], [knee[0], knee[1]]),
    edge(sx, [knee[0], knee[1]], [W, eaves]),
  ])
  const doorFrame = [
    box(L + 0.03, 1.15, -0.72, 0.04, 0.88, 0.06, 6, 8),
    box(L + 0.03, 1.15, 0.72, 0.04, 0.88, 0.06, 6, 8),
    box(L + 0.03, 2.06, 0, 0.04, 0.06, 0.78, 6, 8),
    // round the hayloft door
    box(L + 0.025, 2.66, 0, 0.035, 0.36, 0.4, 6, 8),
  ]
  const cupola = box(0, 3.82, 0, 0.26, 0.24, 0.26, 8, 12)
  const trim = merge(...corners, ...edges, ...doorFrame, cupola)
    .paint(() => TRIM, 0)
    .surface(0)
  // the doors: two red leaves, each braced with a white X, and the hayloft door above them
  const leaf = (sz: number) => {
    const z = sz * 0.33
    const a: V3 = [L + 0.062, 0.4, z - 0.28]
    const b: V3 = [L + 0.062, 1.9, z + 0.28]
    return merge(
      box(L + 0.025, 1.15, z, 0.035, 0.84, 0.32, 10).paint(() => BARN_RED, 0),
      beam(a, b, 0.045, 0.014, [1, 0, 0], 6).paint(() => TRIM, 0),
      beam([a[0], a[1], b[2]], [b[0], b[1], a[2]], 0.045, 0.014, [1, 0, 0], 6).paint(() => TRIM, 0),
      box(L + 0.062, 0.42, z, 0.014, 0.04, 0.31, 6, 8).paint(() => TRIM, 0),
      box(L + 0.062, 1.88, z, 0.014, 0.04, 0.31, 6, 8).paint(() => TRIM, 0),
    )
  }
  const hayloft = box(L + 0.05, 2.66, 0, 0.03, 0.3, 0.34, 10).paint(() => mix(BARN_RED, WOOD_DARK, 0.3), 0)
  const doors = merge(leaf(-1), leaf(1), hayloft)
  return {
    base: { shape: base, material: { roughness: 0.95, surface: { kind: 'stone', size: 0.54, joint: rgb(0xd9cbb4), tone: 0.5 } } },
    walls: { shape: walls, material: { roughness: 0.8, surface: { kind: 'boards', size: 0.8, turn: true, tone: 0.4 } } },
    roof: { shape: roof, material: { roughness: 0.7, surface: { kind: 'shingle', size: 0.6, tone: 0.55 } } },
    trim: { shape: trim, material: { roughness: 0.75 } },
    doors: { shape: doors, material: { roughness: 0.8, surface: { kind: 'boards', size: 0.5, turn: true, tone: 0.3 } } },
  }
}

// ───────────────────────────── the office ─────────────────────────────

export type OfficePart = 'floor' | 'walls' | 'roof' | 'trim' | 'glass'

/** The order office: 2.1 × 1.9 m, its doorway in the front (+x), its eaves at 2.25 m and its ridge (along x) at
 *  2.85 m. Inside it is open: the desk (deskModel) stands on its floor, against the back wall. */
export const OFFICE_FLOOR = 0.14

export function officeModel(): Structure<OfficePart> {
  const W = 1.05
  const D = 0.95
  const T = 0.04 // half a wall's thickness
  const eaves = 2.25
  const ridge = 2.85
  const door = 0.45 // half the doorway's width
  const lintel = 2.02
  const floor = slab(W + 0.06, D + 0.06, 0, OFFICE_FLOOR, 8, 20).paint(grain(0, 51), 0)
  const wall = (x: number, z: number, hx: number, hz: number, y0: number, y1: number) => slab(hx, hz, y0, y1, 10, 12).place([x, 0, z])
  const walls = merge(
    // back, sides
    wall(-W + T, 0, T, D, OFFICE_FLOOR - 0.02, eaves),
    wall(0, -D + T, W, T, OFFICE_FLOOR - 0.02, eaves),
    wall(0, D - T, W, T, OFFICE_FLOOR - 0.02, eaves),
    // the front, round the doorway
    wall(W - T, -(D + door) / 2, T, (D - door) / 2, OFFICE_FLOOR - 0.02, eaves),
    wall(W - T, (D + door) / 2, T, (D - door) / 2, OFFICE_FLOOR - 0.02, eaves),
    wall(W - T, 0, T, door + 0.02, lintel, eaves),
    // the gables, front and back
    gable(
      W - T,
      [
        [-D, eaves - 0.02],
        [0, ridge],
        [D, eaves - 0.02],
      ],
      SAGE,
    ),
    gable(
      -W + T,
      [
        [-D, eaves - 0.02],
        [0, ridge],
        [D, eaves - 0.02],
      ],
      SAGE,
    ),
  ).paint(() => SAGE, 0)
  const roof = merge(slope([D + 0.18, eaves - 0.04], [0, ridge], W + 0.2, 0.03), slope([-D - 0.18, eaves - 0.04], [0, ridge], W + 0.2, 0.03)).paint(() => SHINGLE, 0)
  // white trim: corner boards, the doorway's frame, a frame round each window
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(sx * (W - 0.01), (OFFICE_FLOOR + eaves) / 2, sz * (D - 0.01), 0.04, (eaves - OFFICE_FLOOR) / 2, 0.04, 6, 8)))
  const frame = [box(W + 0.005, 1.08, -door - 0.03, 0.04, 0.95, 0.04, 6, 8), box(W + 0.005, 1.08, door + 0.03, 0.04, 0.95, 0.04, 6, 8), box(W + 0.005, lintel + 0.02, 0, 0.04, 0.04, door + 0.07, 6, 8)]
  const windowFrame = (sz: number) => {
    const z = sz * (D + 0.005)
    return [
      box(0, 1.0, z, 0.36, 0.035, 0.03, 6, 8),
      box(0, 1.62, z, 0.36, 0.035, 0.03, 6, 8),
      box(-0.33, 1.31, z, 0.035, 0.3, 0.03, 6, 8),
      box(0.33, 1.31, z, 0.035, 0.3, 0.03, 6, 8),
      box(0, 1.31, z, 0.015, 0.3, 0.025, 6, 8),
    ]
  }
  const fascia = [-1, 1].map((sz) => beam([-W - 0.2, eaves - 0.07, sz * (D + 0.17)], [W + 0.2, eaves - 0.07, sz * (D + 0.17)], 0.03, 0.05, [0, 1, 0], 6))
  const trim = merge(...corners, ...frame, ...windowFrame(-1), ...windowFrame(1), ...fascia)
    .paint(() => TRIM, 0)
    .surface(0)
  // the windows' glass (on the walls: the room is seen through the doorway)
  const glass = merge(...[-1, 1].map((sz) => box(0, 1.31, sz * (D + 0.002), 0.31, 0.28, 0.012, 6, 8))).paint((_x, y) => mix(GLASS, rgb(0x6f8ea0), smoothstep(1.05, 1.6, y) * 0.5), 0)
  return {
    floor: { shape: floor, material: { roughness: 0.85, surface: { kind: 'boards', size: 0.6, tone: 0.35 } } },
    walls: { shape: walls, material: { roughness: 0.8, surface: { kind: 'boards', size: 0.56, turn: true, tone: 0.3 } } },
    roof: { shape: roof, material: { roughness: 0.7, surface: { kind: 'shingle', size: 0.6, tone: 0.55 } } },
    trim: { shape: trim, material: { roughness: 0.75 } },
    glass: { shape: glass, material: { roughness: 0.08, metalness: 0.2 }, castShadow: false },
  }
}

export type DeskPart = 'desk' | 'computer' | 'chair'

/** Where the computer's screen is on the desk (its middle, and half its size): the scene draws the screen there. */
export const DESK_SCREEN = { x: -0.07, y: 1.1, half: [0.28, 0.16] as [number, number] }

/** The desk with the order board's computer (its screen faces +x, towards the doorway), a keyboard and a mug, and
 *  a chair; its back edge at x = -0.35, standing on y = 0. */
export function deskModel(): Structure<DeskPart> {
  const top = 0.76
  const desk = merge(
    box(0, top - 0.02, 0, 0.32, 0.02, 0.62, 10),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(sx * 0.28, (top - 0.03) / 2, sz * 0.57, 0.025, (top - 0.03) / 2 + 0.01, 0.025, 6, 8))),
    // a drawer under the right side
    box(0.04, top - 0.12, 0.38, 0.27, 0.09, 0.2, 10),
  ).paint(grain(2, 61), 0)
  // the computer: a flat screen on a stand, its keyboard in front; and a mug of tea beside it
  const screen = box(DESK_SCREEN.x - 0.03, DESK_SCREEN.y, 0, 0.025, DESK_SCREEN.half[1] + 0.025, DESK_SCREEN.half[0] + 0.025, 10)
  const computer = merge(
    screen,
    box(-0.1, top + 0.012, 0, 0.09, 0.012, 0.12, 10),
    box(-0.11, (top + DESK_SCREEN.y) / 2, 0, 0.015, (DESK_SCREEN.y - top) / 2, 0.03, 6, 8),
    box(0.12, top + 0.012, 0, 0.07, 0.012, 0.22, 10),
    lathe(
      [
        [0, top - 0.002],
        [0.035, top - 0.002],
        [0.038, top + 0.09],
        [0.03, top + 0.09],
        [0.0, top + 0.02],
      ],
      { seg: 14, steps: 1 },
    ).place([0.12, 0, -0.42]),
  ).paint((x, y, z) => (Math.hypot(x - 0.12, z + 0.42) < 0.05 ? rgb(0xe9e2d2) : mix(BLACK, rgb(0x4a4e54), y > top + 0.02 ? 0.15 : 0.35)), 0)
  // a wooden chair, turned to the desk, its back to the doorway
  const seat = 0.46
  const chair = merge(
    box(0, seat, 0, 0.21, 0.025, 0.21, 10),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(sx * 0.17, seat / 2, sz * 0.17, 0.02, seat / 2, 0.02, 6, 8))),
    ...[-1, 1].map((sz) => box(0.17, seat + 0.26, sz * 0.17, 0.02, 0.26, 0.02, 6, 8)),
    box(0.17, seat + 0.42, 0, 0.018, 0.08, 0.2, 8),
  )
    .paint(grain(1, 63), 0)
    .place([0.55, 0, 0.05], [0, 0.12, 0])
  return {
    desk: { shape: desk, material: { roughness: 0.75 } },
    computer: { shape: computer, material: { roughness: 0.4 } },
    chair: { shape: chair, material: { roughness: 0.8 } },
  }
}

// ───────────────────────────── crates, the pallet, the gate ─────────────────────────────

/** A crate's size (half of it each way): the tractor's carrier takes two by two of them. */
export const CRATE = { x: 0.24, y: 0.18, z: 0.2 } as const

/** A crate of slats round a frame of darker battens, closed. Its bottom on y = 0. */
export function crateShape(): Shape {
  const { x: hx, y: hy, z: hz } = CRATE
  const body = box(0, hy, 0, hx - 0.012, hy - 0.006, hz - 0.012, 12).paint((x, y, z) => mix(PINE, rgb(0xb98a4e), 0.3 * (0.5 + 0.5 * noise3(x * 30, y * 9, z * 30, 3))), 0)
  const battens: Shape[] = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) battens.push(box(sx * (hx - 0.02), hy, sz * (hz - 0.02), 0.024, hy, 0.024, 6, 8))
  for (const y of [0.02, 2 * hy - 0.02]) {
    for (const sz of [-1, 1]) battens.push(box(0, y, sz * (hz - 0.01), hx, 0.02, 0.014, 6, 8))
    for (const sx of [-1, 1]) battens.push(box(sx * (hx - 0.01), y, 0, 0.014, 0.02, hz, 6, 8))
  }
  return merge(
    body,
    merge(...battens).paint(() => mix(WOOD, WOOD_DARK, 0.4), 0),
  )
}

export function crateModel(): Structure<'crate'> {
  return { crate: { shape: crateShape(), material: { roughness: 0.85, surface: { kind: 'boards', size: 0.36, tone: 0.3 } } } }
}

/** How high a crate stands on the pallet. */
export const PALLET_TOP = 0.14

/** The pallet in the tractor's yard: five slats across three runners. */
export function palletModel(): Structure<'pallet'> {
  const slats = [-0.36, -0.18, 0, 0.18, 0.36].map((z) => box(0, PALLET_TOP - 0.012, z, 0.52, 0.012, 0.07, 8))
  const runners = [-0.45, 0, 0.45].map((x) => box(x, 0.06, 0, 0.05, 0.06, 0.44, 8))
  return { pallet: { shape: merge(...slats, ...runners).paint(grain(2, 81), 0), material: { roughness: 0.85 } } }
}

/** The farm gate's size: the opening between its posts (across z) and its leaves' height. */
export const FARM_GATE = { half: 1.1, height: 1.25 } as const

/** A leaf of the farm gate, hung from its hinge at the origin, reaching along +z: two rails, a stile at each end, a
 *  brace across. */
export function gateLeafShape(): Shape {
  const len = FARM_GATE.half - 0.06
  return merge(
    ...[0.25, 0.7, FARM_GATE.height - 0.05].map((y) => beam([0, y, 0.0], [0, y, len], 0.025, 0.045, [0, 1, 0], 6)),
    beam([0, 0.2, 0.04], [0, FARM_GATE.height, 0.04], 0.03, 0.045, [0, 0, 1], 6),
    beam([0, 0.2, len - 0.03], [0, FARM_GATE.height, len - 0.03], 0.03, 0.045, [0, 0, 1], 6),
    beam([0, 0.25, 0.06], [0, FARM_GATE.height - 0.05, len - 0.06], 0.022, 0.04, [1, 0, 0], 6),
  ).paint(grain(1, 91), 0)
}

/** The gate's two posts, either side of an opening across z, and the hinge pins the leaves hang from. */
export function gatePostsShape(): Shape {
  return merge(
    ...[-1, 1].map((sz) => box(0, 0.8, sz * (FARM_GATE.half + 0.06), 0.08, 0.8, 0.08, 6, 10)),
    ...[-1, 1].map((sz) =>
      lathe(
        [
          [0, 1.6],
          [0.11, 1.6],
          [0.0, 1.72],
        ],
        { seg: 4, steps: 1 },
      )
        .place([0, 0, 0], [0, Math.PI / 4, 0])
        .place([0, 0, sz * (FARM_GATE.half + 0.06)]),
    ),
  ).paint(grain(1, 93), 0)
}

export type GatePart = 'posts' | 'leaf'

/** The farm gate as a structure, its leaves shut (for the gallery and the checks). */
export function farmGateModel(): Structure<GatePart> {
  const half = FARM_GATE.half
  return {
    posts: { shape: gatePostsShape(), material: { roughness: 0.85 } },
    leaf: { shape: merge(gateLeafShape().place([0, 0, -half]), gateLeafShape().place([0, 0, 0], [0, Math.PI, 0]).place([0, 0, half])), material: { roughness: 0.85 } },
  }
}
