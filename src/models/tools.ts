import { Group, Mesh } from 'three'
import { loft, merge, noise3, rgb, Shape, smoothstep, sculptMaterial, spin, subtract, tube, type SculptMaterialOptions, type V3 } from '../lib/sculpt'
import { FOLD, NEST, PASTURE, RUN } from '../farm/data'
import type { PlaceId } from '../farm/layout'
import { lump } from './decor'
import { mix, partGeometry, type Structure, type StructurePart } from './structures'

// The animals' tools (plans/animal-tools.md), each at its place at its animal's fence: the coop (a nest for each hen,
// where the nest box is today), the milk bucket (by the pasture's gate post) and the shears with their wool basket (by
// the fold's gate post). Three families of the three, one style each, for the user to choose in the design lab
// (lab/boards/tools-3d):
//
//   a  little red houses: the hen house's own red boards and battens, white trim and shingles (structures.ts
//      `coopModel`); each tool under a roof of its own, a place that reads from across the farm
//   b  tin and blue enamel: galvanised metal with a blue band, each tool a size bigger and bold (a nest bank with
//      round holes and a slanted lid, a big pail on an iron hook beside a churn, big shears in a tub of wool)
//   c  wicker and plain wood: round wicker nests on two planks, a wooden pail on a peg over a milking stool, a wicker
//      basket of wool with the shears on a post; low, the fence's own browns, as if it had always been there
//
// Each model is built in its own frame: its back against the fence at z = 0, its front (+z) where the player stands,
// along the fence in x, the ground at y = 0; TOOL_PLACES puts it in its place's frame. Each is a few pieces in the
// order they go up (`toolPieces`: the film's prop `tool` raises them one after another as its `open` goes 0 → 1,
// `toolProp`), and the game draws them merged, one draw per material (`toolModel`). What waits to be collected (the
// milk, the wool) is the part `goods`, drawn while something waits; the eggs are the crops' crowd, on `nestSpots`.
// Each draws at most TOOL_WEIGHT triangles (src/models/weights.test.ts).

export type ToolLook = 'nests' | 'pail' | 'shears'
export type ToolStyle = 'a' | 'b' | 'c'
export const TOOL_LOOKS: readonly ToolLook[] = ['nests', 'pail', 'shears']
export const TOOL_STYLES: readonly ToolStyle[] = ['a', 'b', 'c']

/** The most triangles a tool's model may draw. */
export const TOOL_WEIGHT = 800

/** The part with what waits to be collected (the milk in the pail, the wool in the basket). */
export const GOODS_PART = 'goods'

/** Where each tool stands in its place's frame (src/farm/data.ts: the run, the pasture, the fold), and the numbers its
 *  row follows: where you stand to use it and what you look at. `turn` faces its front out of the fence. */
export const TOOL_PLACES: Record<ToolLook, { place: PlaceId; at: V3; turn: number; stand: V3; aim: V3 }> = {
  // where the nest box is, its back against the run's west fence (the nest box goes: the coop is its nests)
  nests: { place: 'hens', at: [RUN.minX - 0.05, 0, NEST.z], turn: -Math.PI / 2, stand: [RUN.minX - 0.65, 0.9, NEST.z], aim: [RUN.minX - 0.25, 0.7, NEST.z] },
  // outside the pasture's west fence, between its last post and the gate's: its right side at the gate post
  pail: { place: 'cows', at: [PASTURE.minX - 0.06, 0, PASTURE.gateZ - PASTURE.gateWidth / 2 - 0.6], turn: -Math.PI / 2, stand: [PASTURE.minX - 0.75, 1, 1.2], aim: [PASTURE.minX - 0.3, 0.75, 1.2] },
  // outside the fold's south fence, east of the gate: its left side at the gate post
  shears: { place: 'sheep', at: [FOLD.gateX + FOLD.gateWidth / 2 + 0.71, 0, FOLD.maxZ + 0.06], turn: 0, stand: [1.36, 0.7, FOLD.maxZ + 0.75], aim: [1.36, 0.6, FOLD.maxZ + 0.3] },
}

// ───────────────────────────── colours and materials ─────────────────────────────

const WOOD = rgb(0x8a6440)
const WOOD_DARK = rgb(0x5e4630)
const WOOD_LIGHT = rgb(0xa47c52)
const RED = rgb(0xb5523a)
const BATTEN = rgb(0x8d3f2c)
const TRIM = rgb(0xe9e2d2)
const SHINGLE = rgb(0x46494c)
const DARK = rgb(0x2a1d16)
const IRON = rgb(0x2e3532)
const ZINC = rgb(0xb3bcc1)
const ZINC_DARK = rgb(0x858f95)
const BLUE = rgb(0x4d7fa8)
const BLUE_DARK = rgb(0x2f5677)
const STRAW = rgb(0xd9bd7a)
const STRAW_DARK = rgb(0xa98a4c)
const WICKER = rgb(0xc69a5a)
const WICKER_DARK = rgb(0x8c6534)
const WOOL = rgb(0xf4efe3)
const MILK = rgb(0xf6f3ea)
const ROPE = rgb(0xb89a68)

/** What each part is made of: the same roles in every style. */
type Mat = 'wood' | 'paint' | 'trim' | 'roof' | 'metal' | 'enamel' | 'straw' | 'wicker' | 'goods'

const MATERIALS: Record<Exclude<Mat, 'goods'>, SculptMaterialOptions> = {
  wood: { roughness: 0.85 },
  // the hen house's red board-and-batten walls (structures.ts coopModel), its shingles
  paint: { roughness: 0.8, surface: { kind: 'boards', size: 0.56, turn: true, tone: 0.4 } },
  trim: { roughness: 0.75 },
  roof: { roughness: 0.7, surface: { kind: 'shingle', size: 0.6, tone: 0.55 } },
  // galvanised tin (the sky in it, as the lamps' iron), and blue enamel over it
  metal: { roughness: 0.36, metalness: 0.55 },
  enamel: { roughness: 0.4, metalness: 0.08 },
  straw: { roughness: 1, detail: { scale: 46, bump: 0.02, shade: 0.35 } },
  // wicker: rows of weave (small shingles), and the canes' bumps
  wicker: { roughness: 0.9, surface: { kind: 'shingle', size: 0.12, tone: 0.3, bump: 0.8 }, detail: { scale: 70, bump: 0.004, shade: 0.18 } },
}
const MILK_MATERIAL: SculptMaterialOptions = { roughness: 0.28 }
/** Wool as the sheep wear it (src/models/sheep.ts). */
const WOOL_MATERIAL: SculptMaterialOptions = { roughness: 0.97, detail: { scale: 38, bump: 0.012, shade: 0.34 } }

// ───────────────────────────── shapes ─────────────────────────────

/** A prism along x, from x0 to x1, its cross-section a convex polygon in (z, y): every face flat (boards, blocks, a
 *  lid), 2·(n − 2) + 2·n triangles. */
export function prism(section: [number, number][], x0: number, x1: number): Shape {
  const s = new Shape()
  const n = section.length
  let cz = 0
  let cy = 0
  for (const [z, y] of section) {
    cz += z / n
    cy += y / n
  }
  const cx = (x0 + x1) / 2
  // a flat face of its own vertices, wound so it faces out from the middle
  const face = (pts: V3[]) => {
    const base = s.count
    for (const p of pts) s.vertex(p[0], p[1], p[2])
    for (let k = 1; k < pts.length - 1; k++) {
      const [a, b, c] = [pts[0], pts[k], pts[k + 1]]
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const nx = u[1] * v[2] - u[2] * v[1]
      const ny = u[2] * v[0] - u[0] * v[2]
      const nz = u[0] * v[1] - u[1] * v[0]
      const out = nx * ((a[0] + b[0] + c[0]) / 3 - cx) + ny * ((a[1] + b[1] + c[1]) / 3 - cy) + nz * ((a[2] + b[2] + c[2]) / 3 - cz)
      if (out >= 0) s.tri(base, base + k, base + k + 1)
      else s.tri(base, base + k + 1, base + k)
    }
  }
  face(section.map(([z, y]): V3 => [x0, y, z]))
  face(section.map(([z, y]): V3 => [x1, y, z]))
  for (let k = 0; k < n; k++) {
    const [z0, y0] = section[k]
    const [z1, y1] = section[(k + 1) % n]
    face([
      [x0, y0, z0],
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y0, z0],
    ])
  }
  return s
}

/** A box from one corner to the other, its faces flat: 12 triangles (a leg, a slat, a board). */
export const box = (min: V3, max: V3) =>
  prism(
    [
      [min[2], min[1]],
      [max[2], min[1]],
      [max[2], max[1]],
      [min[2], max[1]],
    ],
    min[0],
    max[0],
  )

/** Round about the vertical axis from a profile of [radius, height] round the outside of its cross-section, every ring
 *  in one frame (a pail's wall goes up outside and back down inside: `spin`, not `lathe`, whose rings turn with it). */
const turned = (profile: [number, number][], seg: number) => spin(profile, seg)

/** A ridge round a vessel (a hoop): a closed ring, its inner side inside the vessel's wall. */
const hoop = (rIn: number, rOut: number, y0: number, y1: number, seg: number) =>
  turned(
    [
      [rIn, y0],
      [rOut, (y0 + y1) / 2],
      [rIn, y1],
      [rIn, y0],
    ],
    seg,
  )

/** A cushion of straw in a nest: a low dome, a little tufted round its edge (its foot's middle at `at`, `rx` across,
 *  `rz` deep, `h` high): 48 triangles. */
function strawBed(at: V3, rx: number, rz: number, h: number, seed: number): Shape {
  return spin(
    [
      [0, 0],
      [1, 0],
      [0.92, 0.45],
      [0.55, 0.85],
      [0, 1],
    ],
    8,
    { ring: (i, a) => (i === 2 || i === 3 ? 1 + 0.1 * Math.sin(a * 3 + seed * 1.7 + i) : 1) },
  )
    .paint((x, y, z) => mix(STRAW_DARK, STRAW, 0.45 + 0.55 * smoothstep(0, 0.9, y) * (0.7 + 0.3 * noise3(x * 9, z * 9, 0.5, seed))), 0)
    .place([0, 0, 0], [0, 0, 0], [rx, h, rz])
    .place(at)
}

/** Wood with its grain along y: streaks of a darker brown. */
const grainy =
  (base: V3, seed: number) =>
  (x: number, y: number, z: number): V3 =>
    mix(base, WOOD_DARK, 0.12 + 0.35 * (0.5 + 0.5 * noise3(x * 40 + z * 23, y * 2.5, 0.3, seed)))

/** Blade shears hanging bow up (their tips at the origin, `len` tall, flat in x–y): two blades and their shanks
 *  joined by the spring bow over the top (Sheffield's hand shears). */
function shears(len: number, r = 0.0085): Shape {
  const L = len
  const blade = (side: 1 | -1) =>
    loft(
      [
        { c: [side * 0.004, 0, 0], rx: 0, ry: 0 },
        { c: [side * 0.012, 0.24 * L, 0], rx: 0.021 * (L / 0.42), ry: 0.0045 },
        { c: [side * 0.017, 0.46 * L, 0], rx: 0.024 * (L / 0.42), ry: 0.005 },
      ],
      { seg: 4, steps: 1, up: [0, 0, 1], caps: [false, true] },
    )
  const shank = (side: 1 | -1) =>
    tube(
      [
        [side * 0.017, 0.44 * L, 0],
        [side * 0.032 * (L / 0.42), 0.8 * L, 0],
      ],
      r,
      { seg: 5, steps: 1, caps: [true, true] },
    )
  const w = 0.032 * (L / 0.42)
  const bow = tube(
    [
      [-w, 0.79 * L, 0],
      [-w * 1.45, 0.88 * L, 0],
      [-w * 1.2, 0.96 * L, 0],
      [0, L, 0],
      [w * 1.2, 0.96 * L, 0],
      [w * 1.45, 0.88 * L, 0],
      [w, 0.79 * L, 0],
    ],
    r,
    { seg: 5, steps: 1, caps: [true, true] },
  )
  return merge(blade(1), blade(-1), shank(1), shank(-1), bow)
}

// ───────────────────────────── pieces ─────────────────────────────

type Shapes = Partial<Record<Mat, Shape>>
interface Raw {
  id: string
  shapes: Shapes
}

/** A piece of a tool: what goes up into place in one go in the film. */
export interface ToolPiece {
  id: string
  /** its parts, one shape per material */
  parts: Structure
  /** where it waits before it rises into place: an offset from its place, in the model's frame (under the ground and
   *  out in front of the fence: the film may give its own) */
  from: V3
}

const FROM: V3 = [0, -0.55, 0.3]

function partOf(m: Mat, shape: Shape, look: ToolLook): StructurePart {
  if (m === 'goods') return { shape, material: look === 'pail' ? MILK_MATERIAL : WOOL_MATERIAL, castShadow: look !== 'pail' }
  return { shape, material: MATERIALS[m], castShadow: m !== 'straw' }
}

// ───────────────────────────── a · little red houses ─────────────────────────────

/** A shingled roof sloping down to the front: its underside on the line from (z0, y0) to (z1, y1), `t` thick, `half`
 *  across. */
function pentRoof(z0: number, y0: number, z1: number, y1: number, half: number, t = 0.04, over = 0.12): Shape {
  const k = (y1 - y0) / (z1 - z0)
  const zb = z0 - 0.05
  const zf = z1 + over
  const yb = y0 + k * (zb - z0)
  const yf = y0 + k * (zf - z0)
  return prism(
    [
      [zb, yb],
      [zf, yf],
      [zf, yf + t],
      [zb, yb + t],
    ],
    -half,
    half,
  ).paint(() => SHINGLE, 0)
}

/** The underside of a roof from (z0, y0) to (z1, y1): its height at z. */
const under = (z0: number, y0: number, z1: number, y1: number) => (z: number) => y0 + ((y1 - y0) * (z - z0)) / (z1 - z0)

/** A red board panel at the back, from y0 up to the roof's underside, `half` across, z0 to z1 deep. */
const panel = (half: number, y0: number, z0: number, z1: number, roof: (z: number) => number) =>
  prism(
    [
      [z0, y0],
      [z1, y0],
      [z1, roof(z1)],
      [z0, roof(z0)],
    ],
    -half,
    half,
  ).paint(() => RED, 0)

/** Battens over the board joints of a panel facing +z (at z), from y0 to y1. */
const battens = (xs: number[], y0: number, y1: number, z: number) => merge(...xs.map((x) => box([x - 0.02, y0, z - 0.005], [x + 0.02, y1, z + 0.014]))).paint(() => BATTEN, 0)

/** The nest house: six nests in two rows of three in a red box on legs, a slanting shingled roof, white trim, straw
 *  spilling over each nest's lip, a perch rail along the front. */
const NESTS_A = { W: 0.48, D: 0.32, y0: 0.4, top: 0.98, back: 1.1, cols: [-0.31, 0, 0.31], rows: [0.45, 0.72], tall: 0.21, half: 0.125 }

function nestsA(): Raw[] {
  const { W, D, y0, top, back, cols, rows, tall, half } = NESTS_A
  const slope = (z: number) => back + ((top - back) * z) / D
  const inPocket = (x: number, y: number, z: number) => z > 0.03 && cols.some((c) => Math.abs(x - c) < half + 0.002) && rows.some((r) => y > r - 0.002 && y < r + tall + 0.002)
  const body = subtract(
    prism(
      [
        [0, y0],
        [D, y0],
        [D, top],
        [0, back],
      ],
      -W,
      W,
    ),
    ...rows.flatMap((r) => cols.map((c) => box([c - half, r, 0.045], [c + half, r + tall, D + 0.05]))),
  )
    // dark deep in each nest, the red outside
    .paint((x, y, z) => (inPocket(x, y, z) ? mix(RED, DARK, 0.75 * smoothstep(D - 0.004, 0.08, z)) : RED), 0)
    .surface((x, y, z) => (inPocket(x, y, z) ? 0.4 : 1))
  const sides = merge(
    ...[-1, 1].map((s) =>
      merge(
        ...[0.08, 0.22].map((z) =>
          prism(
            [
              [z - 0.02, y0 + 0.02],
              [z + 0.02, y0 + 0.02],
              [z + 0.02, slope(z + 0.02) - 0.02],
              [z - 0.02, slope(z - 0.02) - 0.02],
            ],
            s > 0 ? W - 0.004 : -W - 0.014,
            s > 0 ? W + 0.014 : -W + 0.004,
          ),
        ),
      ),
    ),
  ).paint(() => BATTEN, 0)
  const legs = merge(...[-1, 1].flatMap((s) => [0.05, D - 0.05].map((z) => box([s * (W - 0.06) - 0.03, 0, z - 0.03], [s * (W - 0.06) + 0.03, y0 + 0.01, z + 0.03])))).paint(grainy(WOOD, 3), 0)
  const arms = merge(...[-1, 1].map((s) => box([s * (W - 0.06) - 0.02, 0.35, D - 0.07], [s * (W - 0.06) + 0.02, 0.39, D + 0.13]))).paint(grainy(WOOD, 5), 0)
  const rail = tube(
    [
      [-W - 0.02, 0.37, D + 0.1],
      [W + 0.02, 0.37, D + 0.1],
    ],
    0.02,
    { seg: 6, steps: 1, caps: [true, true] },
  ).paint(() => WOOD_LIGHT, 0)
  // a cushion of straw in each nest, over its lip and a little out of it
  const straw = merge(...rows.flatMap((r, i) => cols.map((c, j) => strawBed([c, r - 0.003, D - 0.12], 0.118, 0.13, 0.085, 7 + i * 3 + j)))).surface(0)
  const trim = merge(
    ...[-1, 1].map((s) => box([s > 0 ? W - 0.045 : -W - 0.005, y0 - 0.005, D - 0.01], [s > 0 ? W + 0.005 : -W + 0.045, top + 0.005, D + 0.016])),
    ...rows.map((r) => box([-W + 0.04, r - 0.012, D - 0.006], [W - 0.04, r + 0.036, D + 0.014])),
    // a white board under the roof's front edge, as the hen house's eaves
    box([-W - 0.04, top - 0.055, D + 0.02], [W + 0.04, top - 0.012, D + 0.045]),
  ).paint(() => TRIM, 0)
  return [
    { id: 'legs', shapes: { wood: merge(legs, arms, rail) } },
    { id: 'house', shapes: { paint: merge(body, sides.surface(0)) } },
    { id: 'straw', shapes: { straw } },
    { id: 'trim', shapes: { trim } },
    { id: 'roof', shapes: { roof: pentRoof(0, back, D, top, W + 0.04, 0.04, 0.05) } },
  ]
}

/** A galvanised pail with a bail: its outside from r0 at the bottom to r1 at the rim, h tall (its foot at `at`); the
 *  milk a little under the rim (the part `goods`). Band: a blue band round its top (pattern). */
function pail(at: V3, r0: number, r1: number, h: number, seg: number, o: { band?: V3; bail?: 'up' | 'hook'; color?: V3; dark?: V3 } = {}) {
  const rim = r1 + 0.008
  const level = 0.72
  const rAt = (f: number) => r0 + (r1 - r0) * f
  const body = turned(
    [
      [0, 0],
      [r0, 0],
      [rAt(0.6), 0.6 * h],
      [rAt(0.68), 0.68 * h],
      [r1, h - 0.012],
      [rim, h - 0.004],
      [r1 - 0.012, h],
      [rAt(level) - 0.012, level * h - 0.02],
      [0, level * h - 0.02],
    ],
    seg,
  )
    .paint((_x, y) => mix(o.dark ?? ZINC_DARK, o.color ?? ZINC, smoothstep(0, h * 0.5, y)), 0)
    .place(at)
  if (o.band) body.pattern((x, y, z) => (y - at[1] > 0.64 * h && Math.hypot(x - at[0], z - at[2]) > rAt(0.66) - 0.004 ? 1 : 0), o.band)
  const milk = turned(
    [
      [0, level * h - 0.026],
      [rAt(level) - 0.008, level * h - 0.026],
      [rAt(level) - 0.008, level * h - 0.004],
      [0, level * h - 0.004],
    ],
    seg,
  )
    .paint(() => MILK, 0)
    .place(at)
  // the bail: up over the middle, or turned to hang from a hook
  const up = o.bail === 'hook' ? 0.2 * r1 : 0.55 * r1
  const bail = tube(
    [
      [-r1 + 0.004, h - 0.03, 0],
      [-r1 * 0.85, h + up * 0.6, 0],
      [0, h + up, 0],
      [r1 * 0.85, h + up * 0.6, 0],
      [r1 - 0.004, h - 0.03, 0],
    ],
    0.006,
    { seg: 4, steps: 1, caps: [true, true] },
  )
    .paint(() => IRON, 0)
    .place(at)
  return { body, milk, bail }
}

/** A milk churn: a tall can with a shoulder, a neck and a lid, two handles at the shoulder. */
function churn(at: V3, r: number, h: number, seg: number, band?: V3) {
  const can = turned(
    [
      [0, 0],
      [r * 0.96, 0],
      [r, 0.04 * h],
      [r, 0.62 * h],
      [r * 0.62, 0.8 * h],
      [r * 0.44, 0.86 * h],
      [r * 0.44, 0.93 * h],
      [r * 0.58, 0.95 * h],
      [r * 0.5, h],
      [0, h],
    ],
    seg,
  )
    .paint((_x, y) => mix(ZINC_DARK, ZINC, smoothstep(0, 0.4 * h, y)), 0)
    .place(at)
  if (band) can.pattern((_x, y) => (y - at[1] > 0.3 * h && y - at[1] < 0.5 * h ? 1 : 0), band)
  const handles = merge(
    ...[-1, 1].map((s) =>
      tube(
        [
          [s * r * 0.8, 0.68 * h, 0],
          [s * (r + 0.035), 0.74 * h, 0],
          [s * (r + 0.035), 0.82 * h, 0],
          [s * r * 0.46, 0.86 * h, 0],
        ],
        0.008,
        { seg: 4, steps: 1, caps: [true, true] },
      ),
    ),
  )
    .paint(() => ZINC_DARK, 0)
    .place(at)
  return { can, handles }
}

/** The milk stand: a red stand by the gate, a platform at a cart's height under a little shingled roof, the pail and a
 *  churn on it (the roadside stands where the farm's churns waited for the milk cart). */
function pailA(): Raw[] {
  const W = 0.45
  const D = 0.4
  const deck = 0.52
  const top = 1.24
  const posts = merge(
    ...[-1, 1].map((s) => box([s * (W - 0.05) - 0.035, 0, 0.03], [s * (W - 0.05) + 0.035, top + 0.04, 0.1])),
    ...[-1, 1].map((s) => box([s * (W - 0.05) - 0.03, 0, D - 0.09], [s * (W - 0.05) + 0.03, deck + 0.005, D - 0.03])),
  ).paint(grainy(WOOD, 11), 0)
  const platform = box([-W, deck, 0], [W, deck + 0.045, D]).paint(() => RED, 0)
  const roof = under(0.06, top + 0.04, D, top - 0.06)
  const back = merge(panel(W - 0.02, deck + 0.04, 0, 0.03, roof), battens([-0.22, 0, 0.22], deck + 0.06, top, 0.03).surface(0))
  const trim = merge(box([-W - 0.005, deck - 0.004, D - 0.004], [W + 0.005, deck + 0.05, D + 0.016]), box([-W - 0.04, top - 0.07, 0.42], [W + 0.04, top - 0.04, 0.44])).paint(() => TRIM, 0)
  const p = pail([-0.17, deck + 0.045, D * 0.55], 0.1, 0.13, 0.25, 12)
  const c = churn([0.17, deck + 0.045, D * 0.45], 0.12, 0.5, 12)
  return [
    { id: 'stand', shapes: { wood: posts, paint: platform } },
    { id: 'back', shapes: { paint: back } },
    { id: 'roof', shapes: { roof: pentRoof(0.06, top + 0.04, D, top - 0.06, W + 0.04, 0.04, 0.05), trim } },
    { id: 'churn', shapes: { metal: merge(c.can, c.handles) } },
    { id: 'pail', shapes: { metal: merge(p.body, p.bail) } },
    { id: 'milk', shapes: { goods: p.milk } },
  ]
}

/** A basket of wicker: an oval tub, a rolled rim, a handle at each end (its foot at `at`, `sx` its stretch in x). */
function basket(at: V3, r0: number, r1: number, h: number, sx: number, seg: number, handles = true) {
  const body = turned(
    [
      [0, 0],
      [r0, 0],
      [r0 + (r1 - r0) * 0.5, h * 0.5],
      [r1, h - 0.015],
      [r1 + 0.012, h],
      [r1 - 0.02, h + 0.012],
      [0, h - 0.03],
    ],
    seg,
  )
    .paint((_x, y) => mix(WICKER_DARK, WICKER, smoothstep(0, h, y)), 0)
    .place(at, [0, 0, 0], [sx, 1, 1])
  const ends = handles
    ? merge(
        ...[-1, 1].map((s) =>
          tube(
            [
              [s * (r1 * sx - 0.02), h - 0.005, -0.06],
              [s * (r1 * sx + 0.03), h + 0.05, -0.04],
              [s * (r1 * sx + 0.03), h + 0.05, 0.04],
              [s * (r1 * sx - 0.02), h - 0.005, 0.06],
            ],
            0.012,
            { seg: 4, steps: 1, caps: [true, true] },
          ),
        ),
      )
        .paint(() => WICKER_DARK, 0)
        .place(at)
    : null
  return { body, ends }
}

/** A heap of wool, washed white, a little cream deep down. */
const woolHeap = (lumps: { r: number; at: V3; squash: V3 }[], seed: number) =>
  merge(...lumps.map((l, i) => lump(l.r, l.at, seed + i, l.squash, 2))).paint((x, y, z) => mix(rgb(0xe2d6c0), WOOL, 0.55 + 0.45 * smoothstep(0.2, 0.8, noise3(x * 9, y * 9, z * 9, seed))), 0)

/** The shearing rack: a red board on two posts under a shingled roof, the shears on a peg, a wicker basket of wool on
 *  a red bench under them. */
function shearsA(): Raw[] {
  const W = 0.42
  const top = 1.26
  const bench = 0.36
  const posts = merge(...[-1, 1].map((s) => box([s * (W - 0.05) - 0.035, 0, 0.03], [s * (W - 0.05) + 0.035, top + 0.04, 0.1])))
    .paint(grainy(WOOD, 13), 0)
    .add(merge(...[-1, 1].map((s) => box([s * (W - 0.07) - 0.025, 0, 0.33], [s * (W - 0.07) + 0.025, bench + 0.005, 0.38]))).paint(grainy(WOOD, 17), 0))
  const seat = box([-W + 0.02, bench, 0.02], [W - 0.02, bench + 0.04, 0.4]).paint(() => RED, 0)
  const roof = under(0.06, top + 0.04, 0.36, top - 0.04)
  const board = merge(panel(W - 0.02, bench + 0.04, 0, 0.03, roof), battens([-0.2, 0.2], bench + 0.06, top + 0.02, 0.03).surface(0))
  const peg = tube(
    [
      [-0.12, 1.02, 0.03],
      [-0.12, 1.035, 0.13],
    ],
    0.014,
    { seg: 5, steps: 1, caps: [true, true] },
  ).paint(() => WOOD_DARK, 0)
  const s = shears(0.42).place([-0.12, 1.035 + 0.008 - 0.42, 0.11])
  const b = basket([0.13, bench + 0.04, 0.2], 0.12, 0.15, 0.17, 1.3, 12)
  const wool = woolHeap(
    [
      { r: 0.17, at: [0.13, bench + 0.04 + 0.19, 0.2], squash: [1.25, 0.55, 0.85] },
      { r: 0.1, at: [0.2, bench + 0.04 + 0.255, 0.2], squash: [1, 0.7, 1] },
    ],
    31,
  )
  const trim = box([-W - 0.04, top - 0.07, 0.36], [W + 0.04, top - 0.04, 0.38]).paint(() => TRIM, 0)
  return [
    { id: 'posts', shapes: { wood: posts, paint: seat } },
    { id: 'board', shapes: { paint: board, wood: peg } },
    { id: 'roof', shapes: { roof: pentRoof(0.06, top + 0.04, 0.36, top - 0.04, W + 0.04, 0.04, 0.02), trim } },
    { id: 'basket', shapes: { wicker: b.body.add(b.ends!) } },
    { id: 'wool', shapes: { goods: wool } },
    { id: 'shears', shapes: { metal: s.paint(() => mix(ZINC, rgb(0xdfe4e6), 0.4), 0) } },
  ]
}

// ───────────────────────────── b · tin and blue enamel ─────────────────────────────

/** The nest bank: a blue tin box on galvanised legs, six round holes in two rows, a slanted galvanised lid (no hen
 *  roosts on it), straw at each hole's sill. */
const NESTS_B = { W: 0.5, D: 0.3, y0: 0.42, front: 1.0, back: 1.2, cols: [-0.32, 0, 0.32], rows: [0.575, 0.835], r: 0.095 }

function nestsB(): Raw[] {
  const { W, D, y0, front, back, cols, rows, r } = NESTS_B
  const hole = (x: number, y: number) =>
    tube(
      [
        [x, y, 0.05],
        [x, y, D + 0.05],
      ],
      r,
      { seg: 12, steps: 1, caps: [true, true] },
    )
  const inHole = (x: number, y: number, z: number) => z < D - 0.002 && z > 0.03 && cols.some((c) => rows.some((rr) => Math.hypot(x - c, y - rr) < r + 0.003))
  const body = subtract(
    prism(
      [
        [0, y0],
        [D, y0],
        [D, front],
        [0, back],
      ],
      -W,
      W,
    ),
    ...rows.flatMap((y) => cols.map((x) => hole(x, y))),
  ).paint((x, y, z) => (inHole(x, y, z) ? (z < 0.06 ? rgb(0x17120e) : mix(BLUE_DARK, DARK, 0.45 + 0.5 * smoothstep(D - 0.01, 0.1, z))) : BLUE), 0)
  // the lid: a galvanised sheet on the slant, over the edges
  const k = (front - back) / D
  const lid = prism(
    [
      [-0.02, back - 0.02 * k],
      [D + 0.05, front + 0.05 * k],
      [D + 0.05, front + 0.05 * k + 0.025],
      [-0.02, back - 0.02 * k + 0.025],
    ],
    -W - 0.03,
    W + 0.03,
  )
  const sill = box([-W - 0.01, y0 - 0.01, D - 0.004], [W + 0.01, y0 + 0.05, D + 0.018])
  const legs = merge(...[-1, 1].flatMap((s) => [0.04, D - 0.04].map((z) => box([s * (W - 0.05) - 0.025, 0, z - 0.025], [s * (W - 0.05) + 0.025, y0 + 0.01, z + 0.025]))))
  // straw in the bottom of each hole, to its sill
  const straw = merge(...rows.flatMap((y, i) => cols.map((x, j) => strawBed([x, y - r + 0.012, D - 0.11], 0.075, 0.13, 0.06, 11 + i * 3 + j)))).surface(0)
  return [
    { id: 'legs', shapes: { metal: legs.paint((_x, y) => mix(ZINC_DARK, ZINC, smoothstep(0, 0.6, y)), 0) } },
    { id: 'box', shapes: { enamel: body } },
    { id: 'straw', shapes: { straw } },
    { id: 'lid', shapes: { enamel: lid.paint(() => mix(BLUE, BLUE_DARK, 0.45), 0), metal: sill.paint(() => ZINC, 0) } },
  ]
}

/** The milk post: a big pail hanging from an iron hook on a blue post by the gate, a big churn at its foot. */
function pailB(): Raw[] {
  const post = merge(
    box([0.26, 0, 0.03], [0.38, 1.25, 0.15]),
    // a pointed cap, its foot in the post's top
    turned(
      [
        [0, 1.24],
        [0.092, 1.24],
        [0.092, 1.268],
        [0, 1.3],
      ],
      4,
    ).place([0.32, 0, 0.09], [0, Math.PI / 4, 0]),
  ).paint((_x, y) => mix(BLUE_DARK, BLUE, smoothstep(0, 0.5, y)), 0)
  // an iron arm out of the post, curling down and back up at its end: the pail's bail rests in the curl
  const hook = tube(
    [
      [0.32, 1.12, 0.12],
      [0.32, 1.12, 0.3],
      [0.32, 1.07, 0.38],
      [0.32, 1.02, 0.35],
      [0.32, 1.05, 0.31],
    ],
    0.011,
    { seg: 5, steps: 1, caps: [true, true] },
  ).paint(() => IRON, 0)
  const h = 0.32
  const r1 = 0.175
  // the bail's top (h + 0.55·r1 over the pail's foot) on the curl's lowest point
  const p = pail([0.32, 1.02 + 0.015 - h - 0.55 * r1, 0.35], 0.13, r1, h, 14, { band: BLUE, bail: 'up' })
  const c = churn([-0.17, 0, 0.21], 0.18, 0.74, 14, BLUE)
  return [
    { id: 'post', shapes: { enamel: post } },
    { id: 'hook', shapes: { metal: hook } },
    { id: 'churn', shapes: { metal: merge(c.can, c.handles) } },
    { id: 'pail', shapes: { metal: merge(p.body, p.bail) } },
    { id: 'milk', shapes: { goods: p.milk } },
  ]
}

/** A galvanised tub with a blue band heaped with wool, big blade shears stuck in the heap, on a round of wood. */
function shearsB(): Raw[] {
  const base = turned(
    [
      [0, 0],
      [0.3, 0],
      [0.3, 0.05],
      [0, 0.05],
    ],
    12,
  )
    .paint(grainy(WOOD, 23), 0)
    .place([0, 0, 0.31])
  const r0 = 0.22
  const r1 = 0.26
  const h = 0.28
  const tub = turned(
    [
      [0, 0],
      [r0, 0],
      [r0 + (r1 - r0) * 0.55, 0.55 * h],
      [r0 + (r1 - r0) * 0.63, 0.63 * h],
      [r1, h - 0.012],
      [r1 + 0.012, h - 0.002],
      [r1 - 0.014, h + 0.004],
      [0, h - 0.04],
    ],
    14,
  )
    .paint((_x, y) => mix(ZINC_DARK, ZINC, smoothstep(0, 0.5 * h, y)), 0)
    .pattern((x, y, z) => (y > 0.6 * h && Math.hypot(x, z) > r0 + (r1 - r0) * 0.6 - 0.006 ? 1 : 0), BLUE)
    .place([0, 0.05, 0.31])
  const ears = merge(
    ...[-1, 1].map((s) =>
      tube(
        [
          [s * (r1 - 0.01), 0.05 + h - 0.03, 0.31 - 0.05],
          [s * (r1 + 0.04), 0.05 + h - 0.01, 0.31 - 0.035],
          [s * (r1 + 0.04), 0.05 + h - 0.01, 0.31 + 0.035],
          [s * (r1 - 0.01), 0.05 + h - 0.03, 0.31 + 0.05],
        ],
        0.011,
        { seg: 4, steps: 1, caps: [true, true] },
      ),
    ),
  ).paint(() => ZINC_DARK, 0)
  const top = 0.05 + h
  const wool = woolHeap(
    [
      { r: 0.27, at: [0, top + 0.02, 0.31], squash: [1, 0.5, 1] },
      { r: 0.15, at: [-0.08, top + 0.13, 0.31], squash: [1, 0.75, 1] },
    ],
    41,
  )
  // the shears, point first in the heap, leaning out towards the player
  const s = shears(0.62, 0.012)
    .place([0, 0, 0], [0.3, 0, -0.32])
    .place([0.09, top + 0.06, 0.31])
    .paint(() => mix(ZINC, rgb(0xe3e8ea), 0.5), 0)
  return [
    { id: 'base', shapes: { wood: base } },
    { id: 'tub', shapes: { metal: merge(tub, ears) } },
    { id: 'wool', shapes: { goods: wool } },
    { id: 'shears', shapes: { metal: s } },
  ]
}

// ───────────────────────────── c · wicker and plain wood ─────────────────────────────

/** A round wicker nest tipped a little forwards, straw inside (its foot's middle at `at`). */
function wickerNest(at: V3, seed: number) {
  const r0 = 0.1
  const r1 = 0.14
  const h = 0.13
  return (
    turned(
      [
        [0, 0],
        [r0, 0],
        [r0 + (r1 - r0) * 0.7, h * 0.55],
        [r1, h - 0.012],
        [r1 + 0.012, h],
        [r1 - 0.02, h + 0.01],
        [0, h - 0.035],
      ],
      10,
    )
      .paint((_x, y) => mix(WICKER_DARK, WICKER, smoothstep(0, h, y)), 0)
      // the straw inside: the pattern rises from the rim's inner edge (0.3) to the middle (1), crossing ½ well inside it
      .pattern(
        (x, y, z) => (Math.hypot(x, z) < 0.01 && y > h / 2 ? 1 : y > h + 0.005 ? 0.3 : 0),
        (x, _y, z) => mix(STRAW_DARK, STRAW, 0.5 + 0.5 * noise3(x * 40, z * 40, 0.5, seed)),
      )
      .surface((x, y, z) => (Math.hypot(x, z) < 0.01 && y > h / 2 ? 0 : 1))
      .place(at, [0.22, 0, 0])
  )
}

/** Six wicker nests on two planks between two posts, against the fence: no roof, the wood as it grew. */
const NESTS_C = { W: 0.52, D: 0.3, shelves: [0.42, 0.76], cols: [-0.33, 0, 0.33] }

function nestsC(): Raw[] {
  const { W, D, shelves, cols } = NESTS_C
  const posts = merge(...[-1, 1].map((s) => box([s * (W - 0.03) - 0.04, 0, 0.0], [s * (W - 0.03) + 0.04, 1.06, 0.08])))
  const planks = merge(...shelves.map((y) => box([-W - 0.04, y - 0.04, 0.0], [W + 0.04, y, D])))
  const cleats = merge(...[-1, 1].flatMap((s) => shelves.map((y) => box([s * (W - 0.03) - 0.04, y - 0.12, 0.08], [s * (W - 0.03) + 0.04, y - 0.04, D - 0.02]))))
  const nests = merge(...shelves.flatMap((y, i) => cols.map((x, j) => wickerNest([x, y - 0.012, D * 0.5], 5 + i * 3 + j))))
  return [
    { id: 'posts', shapes: { wood: posts.paint(grainy(WOOD_LIGHT, 29), 0) } },
    { id: 'planks', shapes: { wood: merge(planks, cleats).paint(grainy(WOOD_LIGHT, 37), 0) } },
    { id: 'nests', shapes: { wicker: nests } },
  ]
}

/** A wooden pail of staves and iron hoops on a peg of a short post, a three-legged milking stool at its foot. */
function pailC(): Raw[] {
  const post = box([0.24, 0, 0.0], [0.33, 1.08, 0.09]).paint(grainy(WOOD, 43), 0)
  const peg = tube(
    [
      [0.285, 0.95, 0.08],
      [0.285, 0.985, 0.3],
    ],
    0.016,
    { seg: 5, steps: 1, caps: [true, true] },
  ).paint(() => WOOD_DARK, 0)
  const r0 = 0.13
  const r1 = 0.165
  const h = 0.3
  const at: V3 = [0.285, 0.515, 0.265]
  const rAt = (f: number) => r0 + (r1 - r0) * f
  const level = 0.74
  const staves = turned(
    [
      [0, 0],
      [r0, 0],
      [r1, h],
      [r1 - 0.016, h],
      [rAt(level) - 0.016, level * h - 0.02],
      [0, level * h - 0.02],
    ],
    12,
  )
    .paint(grainy(WOOD_LIGHT, 47), 0)
    .place(at)
  const hoops = merge(hoop(rAt(0.14) - 0.004, rAt(0.14) + 0.009, 0.1 * h, 0.18 * h, 12), hoop(rAt(0.8) - 0.004, rAt(0.8) + 0.009, 0.76 * h, 0.84 * h, 12))
    .paint(() => IRON, 0)
    .place(at)
  const milk = turned(
    [
      [0, level * h - 0.026],
      [rAt(level) - 0.01, level * h - 0.026],
      [rAt(level) - 0.01, level * h - 0.004],
      [0, level * h - 0.004],
    ],
    12,
  )
    .paint(() => MILK, 0)
    .place(at)
  // a rope over the peg down to two holes in the rim
  const rope = tube(
    [
      [at[0] - r1 + 0.012, at[1] + h - 0.02, at[2]],
      [at[0] - 0.06, at[1] + h + 0.11, at[2] - 0.01],
      [at[0], 0.993, 0.25],
      [at[0] + 0.06, at[1] + h + 0.11, at[2] - 0.01],
      [at[0] + r1 - 0.012, at[1] + h - 0.02, at[2]],
    ],
    0.008,
    { seg: 4, steps: 1, caps: [true, true] },
  ).paint(() => ROPE, 0)
  // the stool: a round seat on three splayed legs
  const sAt: V3 = [-0.18, 0, 0.26]
  const seat = turned(
    [
      [0, 0.3],
      [0.15, 0.3],
      [0.155, 0.335],
      [0, 0.34],
    ],
    10,
  )
    .paint(grainy(WOOD, 53), 0)
    .place(sAt)
  const legs = merge(
    ...[0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2 + 0.4
      return tube(
        [
          [Math.cos(a) * 0.07, 0.31, Math.sin(a) * 0.07],
          [Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15],
        ],
        0.017,
        { seg: 5, steps: 1, caps: [true, true] },
      )
    }),
  )
    .paint(() => WOOD_DARK, 0)
    .place(sAt)
  return [
    { id: 'post', shapes: { wood: merge(post, peg) } },
    { id: 'stool', shapes: { wood: merge(seat, legs) } },
    { id: 'pail', shapes: { wood: merge(staves, rope), metal: hoops } },
    { id: 'milk', shapes: { goods: milk } },
  ]
}

/** An oval wicker basket of wool on the ground by the gate post, the shears hanging from a nail on a post beside it. */
function shearsC(): Raw[] {
  const post = box([-0.36, 0, 0.0], [-0.27, 1.02, 0.09]).paint(grainy(WOOD, 59), 0)
  const nail = tube(
    [
      [-0.315, 0.86, 0.08],
      [-0.315, 0.865, 0.13],
    ],
    0.007,
    { seg: 4, steps: 1, caps: [true, true] },
  ).paint(() => IRON, 0)
  const s = shears(0.4)
    .place([-0.315, 0.865 + 0.007 - 0.4, 0.115])
    .paint(() => mix(ZINC_DARK, ZINC, 0.6), 0)
  const b = basket([0.12, 0, 0.24], 0.15, 0.19, 0.24, 1.35, 12)
  const wool = woolHeap(
    [
      { r: 0.21, at: [0.12, 0.27, 0.24], squash: [1.3, 0.5, 0.95] },
      { r: 0.12, at: [0.05, 0.34, 0.25], squash: [1, 0.7, 1] },
    ],
    61,
  )
  return [
    { id: 'post', shapes: { wood: merge(post), metal: nail } },
    { id: 'basket', shapes: { wicker: merge(b.body, b.ends!) } },
    { id: 'wool', shapes: { goods: wool } },
    { id: 'shears', shapes: { metal: s } },
  ]
}

// ───────────────────────────── the models ─────────────────────────────

const MAKERS: Record<ToolStyle, Record<ToolLook, () => Raw[]>> = {
  a: { nests: nestsA, pail: pailA, shears: shearsA },
  b: { nests: nestsB, pail: pailB, shears: shearsB },
  c: { nests: nestsC, pail: pailC, shears: shearsC },
}

/** A tool's pieces, in the order they go up into place (made afresh each call). */
export function toolPieces(look: ToolLook, style: ToolStyle): ToolPiece[] {
  return MAKERS[style][look]().map((raw) => ({
    id: raw.id,
    parts: Object.fromEntries((Object.entries(raw.shapes) as [Mat, Shape][]).map(([m, shape]) => [m === 'goods' ? GOODS_PART : m, partOf(m, shape, look)])),
    from: FROM,
  }))
}

/** A tool as the game draws it: its pieces merged, one part per material (made afresh each call). */
export function toolModel(look: ToolLook, style: ToolStyle): Structure {
  const out: Structure = {}
  for (const piece of toolPieces(look, style))
    for (const [k, part] of Object.entries(piece.parts)) {
      const have = out[k]
      out[k] = have ? { ...have, shape: merge(have.shape, part.shape) } : part
    }
  return out
}

/** Where each hen's eggs lie in the coop of a style (its model's frame: the straw they lie on, under the middle of the
 *  nest; `putEgg`'s floor): one nest a hen, six. */
export function nestSpots(style: ToolStyle): V3[] {
  if (style === 'a') return NESTS_A.rows.flatMap((r) => NESTS_A.cols.map((c): V3 => [c, r + 0.07, NESTS_A.D - 0.11]))
  if (style === 'b') return NESTS_B.rows.flatMap((y) => NESTS_B.cols.map((c): V3 => [c, y - NESTS_B.r + 0.06, NESTS_B.D - 0.1]))
  return NESTS_C.shelves.flatMap((y) => NESTS_C.cols.map((c): V3 => [c, y + 0.083, NESTS_C.D * 0.5 + 0.02]))
}

// ───────────────────────────── going up: the film's `open` ─────────────────────────────

/** How far piece k of n is into place as `open` goes 0 → 1: one after another, each starting while the one before
 *  is still on its way. */
export function pieceOpen(open: number, k: number, n: number): number {
  const share = 1 / (1 + (n - 1) * 0.55)
  return Math.max(0, Math.min(1, (open - k * 0.55 * share) / share))
}

/** Out of `from` and up into place with a little overshoot as it lands (p: 0 → 1). */
export function pieceOffset(from: V3, p: number): V3 {
  const c = 1.6
  const e = p >= 1 ? 1 : 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2)
  const hop = Math.sin(Math.min(1, p) * Math.PI) * 0.12
  return [from[0] * (1 - e), from[1] * (1 - e) + hop, from[2] * (1 - e)]
}

/** A tool as a prop that goes up piece by piece (the films', and the lab's): a group per piece, `open(t)` puts them. */
export interface ToolProp {
  group: Group
  pieces: { id: string; group: Group; from: V3 }[]
  open(t: number): void
  dispose(): void
}

export function toolProp(look: ToolLook, style: ToolStyle): ToolProp {
  const group = new Group()
  group.name = `tool-${look}-${style}`
  const pieces = toolPieces(look, style).map((piece) => {
    const g = new Group()
    g.name = `${group.name}-${piece.id}`
    for (const [k, part] of Object.entries(piece.parts)) {
      const mesh = new Mesh(partGeometry(part), sculptMaterial(part.material))
      mesh.name = `${g.name}-${k}`
      mesh.castShadow = part.castShadow ?? true
      mesh.receiveShadow = part.receiveShadow ?? true
      g.add(mesh)
    }
    group.add(g)
    return { id: piece.id, group: g, from: piece.from }
  })
  return {
    group,
    pieces,
    open(t) {
      pieces.forEach((piece, k) => {
        const p = pieceOpen(t, k, pieces.length)
        piece.group.visible = p > 0
        piece.group.position.set(...pieceOffset(piece.from, p))
      })
    },
    dispose() {
      group.traverse((o) => (o as Mesh).geometry?.dispose())
    },
  }
}
