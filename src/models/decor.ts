import { Matrix4, Quaternion, Vector3 } from 'three'
import { blob, ellipsoid, fbm3, lathe, loft, merge, noise3, random, rgb, Shape, smoothstep, squircle, tube, type Ring, type SculptMaterialOptions, type V3 } from '../lib/sculpt'
import type { DecorKind } from '../farm/decor'
import { bogleScarecrow, ploughmanScarecrow, squireScarecrow } from './scarecrows'
import { grain, mix, slab, type Structure } from './structures'

// The farm's decoration (src/farm/decor.ts), sculpted with the kit in the farm's own look: soft shapes, painted
// vertices, the material's surfaces for stone and shingles, leaves as lumps with fine bumps. Each model stands in its
// own frame, the ground under its middle at the origin, its front towards +z, and is a handful of parts, one per
// material (a crowd draws each part once for every one placed). A few hundred triangles each; the trees and the
// scarecrows up to ~1.8k.
//
//   lamp      a yard lamp: a dark green iron post with a crossbar, a lantern of four glass panes under a little roof
//   lantern   a path lantern hanging from a shepherd's crook
//   fence     a white picket fence, one 2 m section along x: a post at each end, centred on it (x = ±1), so two
//             sections end to end share one post, drawn twice in one place (plain paint, square: the same however a
//             section is turned)
//   hedge     a trimmed box hedge, one 2 m section along x (its ends' middles at x = ±1): full and flat to there, its
//             lumps the same at both ends (they repeat every 2 m), so a run is one hedge; past each end a rounded end a
//             little thinner than the hedge, hidden inside the next section in a run, closing a corner and rounding off
//             the end of a run
//   path      a stone path tile, 1.2 m square: four flagstones in a staggered bond, the gaps between tiles the same as
//             between stones, so tiles laid edge to edge are one path
//   stones    three stepping stones in a row along z (about 1.4 m)
//   bench     a garden bench: wooden slats on curled iron sides
//   tree      a shade tree, about 4.6 m: a stout trunk and limbs under a big crown of leafy lumps
//   pine      a pine, about 4.2 m: six drooping tiers of needles, lobed where the branches end, on a short trunk
//   bush      a round bush
//   roses     a rose bush with pink-red blooms
//   flowers   a patch of flowers: a low leafy mound with heads of five colours and three tall spikes
//   planter   a wooden planter box with greens and flowers
//   birdbath  a stone bird bath, water in its bowl and a blue tit on its rim
//   well      a wishing well: a round stone wall, two posts under a shingled roof, a crank and a bucket on its rope
//   scarecrow-squire, -ploughman, -bogle
//             three scarecrows of the English and Scottish fields, about 1.9 m tall (src/models/scarecrows.ts)
//
// The lamp's and the lantern's glass is a part of its own, `glass` (DECOR_GLOW), on a glowing material: it shows its
// pale glass by day and glows warm at the level `setSculptGlow` (src/lib/sculpt) sets for every glowing part at once
// — 0 by day, 1 at night. No light of its own.

// ───────────────────────────── colours and materials ─────────────────────────────

const WOOD = rgb(0x8a6440)
const WOOD_DARK = rgb(0x5e4630)
const BARK = rgb(0x5a4434)
const BARK_LIGHT = rgb(0x7a6450)
const STONE = rgb(0x9c958a)
const STONE_DARK = rgb(0x77716a)
const MORTAR = rgb(0xd9cbb4)
const SHINGLE = rgb(0x46494c)
const IRON = rgb(0x26332c)
const IRON_LIGHT = rgb(0x3b4a41)
const GLASS = rgb(0xffc56a)
const PAINT = rgb(0xf2ede2)
const ROPE = rgb(0xb89a68)
const SOIL = rgb(0x4a3526)
const WATER = rgb(0x3d6f8a)

/** Leaves: fine bumps finer than any vertex (the lemon tree's crown wears the same). */
export const LEAVES: SculptMaterialOptions = { roughness: 0.85, detail: { scale: 9, bump: 0.3, shade: 0.1 } }
const IRON_MAT: SculptMaterialOptions = { roughness: 0.45, metalness: 0.35 }
/** The lamps' glass: the warm glow it gives at night, this many times its own colour (see setSculptGlow). */
const GLASS_MAT: SculptMaterialOptions = { roughness: 0.3, glow: 2.2 }
const BARK_MAT: SculptMaterialOptions = { roughness: 0.95, surface: { kind: 'bark', size: 0.45 } }
const WATER_MAT: SculptMaterialOptions = { roughness: 0.06, metalness: 0.1 }

/** The decorations whose part `glass` gives light. */
export const DECOR_GLOW: DecorKind[] = ['lamp', 'lantern']

// ───────────────────────────── helpers ─────────────────────────────

/** A lump of leaves: a ball pushed about by noise, squashed a little (crowns, bushes, hedges of lumps). */
export function lump(r: number, at: V3, seed: number, squash: V3 = [1, 0.86, 1], detail = 2): Shape {
  return blob(r, detail, (x, y, z) => 0.13 * (fbm3(x * 1.8 + seed, y * 1.8, z * 1.8, seed) - 0.5) + 0.03 * Math.sin(x * 6 + y * 5 + seed)).place(at, [0, seed, 0], squash)
}

/** Leaves painted in two greens by noise, darker deep underneath (from `low` up to `high`), lighter on top. */
export function leafy(s: Shape, dark: V3, light: V3, low: number, high: number, seed: number): Shape {
  return s.paint((x, y, z) => mix(dark, light, smoothstep(0.3, 0.75, fbm3(x * 2.5, y * 2.5, z * 2.5, seed))), 0).shade((_x, y) => 0.82 + 0.26 * smoothstep(low, high, y))
}

/** Bark: dark brown, streaked lighter. */
export const barked = (s: Shape, seed: number, light: V3 = BARK_LIGHT, dark: V3 = BARK) => s.paint((x, y, z) => mix(dark, light, 0.3 + 0.35 * noise3(x * 20, y * 6, z * 20, seed)), 0)

/** A limb from a fork up into the crown, thinning, its end rounded (buried in the leaves). */
export const limb = (from: V3, mid: V3, to: V3, r: number) => tube([from, mid, to], [r, r * 0.8, r * 0.6], { seg: 6, steps: 2, round: [0, 0.03] })

const UP = new Vector3(0, 1, 0)
/** Turns a shape built facing up (+y) to face along `normal`, spun about its own axis first, and moves it to `at`. */
export function facing(s: Shape, at: V3, normal: V3, spin = 0): Shape {
  const q = new Quaternion().setFromUnitVectors(UP, new Vector3(...normal).normalize()).multiply(new Quaternion().setFromAxisAngle(UP, spin))
  return s.transform(new Matrix4().compose(new Vector3(...at), q, new Vector3(1, 1, 1)))
}

/** Sets a structure down: its lowest point `sink` under the ground (a bush's leaves touch the soil). */
export function settle<K extends string>(s: Structure<K>, sink = 0.01): Structure<K> {
  const parts = Object.values(s) as Structure[string][]
  let low = Infinity
  for (const p of parts) for (let k = 1; k < p.shape.p.length; k += 3) low = Math.min(low, p.shape.p[k])
  for (const p of parts) p.shape.place([0, -low - sink, 0])
  return s
}

/** Where a ray from outside, aimed at `centre` from `dir` (out from it), meets a shape: the point and its outward normal. */
export function onSurface(s: Shape, centre: V3, dir: V3, far = 4): { point: V3; normal: V3 } | null {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1
  const origin: V3 = [centre[0] + (dir[0] / l) * far, centre[1] + (dir[1] / l) * far, centre[2] + (dir[2] / l) * far]
  const hit = s.raycast(origin, [-dir[0], -dir[1], -dir[2]])
  return hit ? { point: hit.point, normal: hit.normal } : null
}

/** A box along x, from x0 to x1: half-sizes hz (across, z) and hy (up), soft edges, closed ends. */
function beam(x0: number, x1: number, y: number, z: number, hz: number, hy: number, soft = 6, seg = 8): Shape {
  return loft(
    [
      { c: [x0, y, z], rx: hz, ry: hy },
      { c: [x1, y, z], rx: hz, ry: hy },
    ],
    { seg, steps: 1, up: [0, 1, 0], shape: (a) => squircle(a, soft), caps: [true, true] },
  )
}

/** A soft square pyramid (a lamp's roof, a post's cap): its base half-width `half` at y0, its tip at y1 (`seg` 8 for a
 *  small one: its corners on the diagonals all the same). */
function pyramid(half: number, y0: number, y1: number, rim = 0.02, seg = 16): Shape {
  return lathe(
    [
      [0, y0],
      [half, y0],
      [half, y0 + rim],
      [half * 0.12, y1 - (y1 - y0) * 0.08],
      [0, y1],
    ],
    { seg, steps: 1, shape: (a) => squircle(a, 6) },
  )
}

/** A flower's head: a shallow dome of petals (`petal`) round a centre (`eye`), facing up, its foot a centimetre under. */
function flowerHead(r: number, petal: V3, eye: V3): Shape {
  return lathe(
    [
      [0, -0.012],
      [r, 0.004],
      [r * 0.72, 0.016],
      [0, 0.02],
    ],
    { seg: 6, steps: 1 },
  )
    .paint(() => petal, 0)
    .pattern((x, _y, z) => smoothstep(r * 0.62, r * 0.4, Math.hypot(x, z)), eye)
}

const FLOWER_COLOURS: [V3, V3][] = [
  [rgb(0xf3c53a), rgb(0x9a5a1e)], // yellow, a brown eye
  [rgb(0x8c5cc8), rgb(0xf0d060)], // violet
  [rgb(0xf5f1e6), rgb(0xf0c030)], // white, a yellow eye
  [rgb(0xee7aa6), rgb(0xf6e08a)], // pink
  [rgb(0xf08a3a), rgb(0x7a3a18)], // orange
]

// ───────────────────────────── light ─────────────────────────────

function lamp(): Structure<'iron' | 'glass'> {
  // the post: a flared foot, a slim shaft, a collar under the lantern
  const post = lathe(
    [
      [0.15, 0],
      [0.15, 0.06],
      [0.12, 0.09],
      [0.075, 0.16],
      [0.055, 0.32],
      [0.042, 0.52],
      [0.04, 1.9],
      [0.056, 1.94],
      [0.07, 1.985],
      [0.0, 2.02],
    ],
    { seg: 10, steps: 1 },
  )
  // the crossbar a ladder rests on, a ball at each end
  const bar = merge(
    tube(
      [
        [-0.24, 1.64, 0],
        [0.24, 1.64, 0],
      ],
      0.016,
      { seg: 6, caps: [true, true] },
    ),
    ellipsoid(0.03, 0.03, 0.03, 6, 4).place([-0.24, 1.64, 0]),
    ellipsoid(0.03, 0.03, 0.03, 6, 4).place([0.24, 1.64, 0]),
  )
  // the lantern: a base plate, four corner rods along the panes, a soft pyramid of a roof and its knob
  const plate = slab(0.12, 0.12, 2.0, 2.045, 6, 12)
  const rods: Shape[] = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rods.push(tube([[sx * 0.088, 2.03, sz * 0.088] as V3, [sx * 0.114, 2.33, sz * 0.114] as V3], 0.011, { seg: 5, caps: [true, true] }))
  const roof = pyramid(0.16, 2.315, 2.47)
  const knob = lathe(
    [
      [0, 2.45],
      [0.024, 2.465],
      [0.032, 2.5],
      [0.018, 2.54],
      [0, 2.55],
    ],
    { seg: 8, steps: 1 },
  )
  const iron = merge(post, bar, plate, ...rods, roof, knob).paint((_x, y) => mix(IRON, IRON_LIGHT, 0.4 * smoothstep(2.3, 2.5, y)), 0)
  // the glass: four panes wider at the top, warm and pale (its glow at night)
  const glass = loft(
    [
      { c: [0, 2.04, 0], rx: 0.088, ry: 0.088 },
      { c: [0, 2.325, 0], rx: 0.112, ry: 0.112 },
    ],
    { seg: 16, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, 8), caps: [true, true] },
  ).paint((_x, y) => mix(GLASS, rgb(0xffe4b0), smoothstep(2.08, 2.2, y) * 0.5), 0)
  return { iron: { shape: iron, material: IRON_MAT }, glass: { shape: glass, material: GLASS_MAT, castShadow: false } }
}

function lantern(): Structure<'iron' | 'glass'> {
  // the crook: up out of the ground and over, its tip where the lantern hangs
  const crook = tube(
    [
      [0, -0.02, 0],
      [0, 0.55, 0],
      [0, 1.02, 0],
      [0.02, 1.13, 0],
      [0.09, 1.19, 0],
      [0.17, 1.18, 0],
      [0.215, 1.13, 0],
      [0.22, 1.08, 0],
    ],
    0.013,
    { seg: 6, steps: 2, round: [0, 0.012] },
  )
  const hx = 0.22
  // the lantern on a short link: a little roof, a base, rods at the corners of its panes
  const link = tube(
    [
      [hx, 1.085, 0],
      [hx, 0.975, 0],
    ],
    0.006,
    { seg: 4, caps: [true, true] },
  )
  const roof = pyramid(0.078, 0.925, 0.99, 0.012).place([hx, 0, 0])
  const base = slab(0.068, 0.068, 0.76, 0.785, 6, 12).place([hx, 0, 0])
  const rods: Shape[] = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rods.push(tube([[hx + sx * 0.056, 0.775, sz * 0.056] as V3, [hx + sx * 0.062, 0.935, sz * 0.062] as V3], 0.007, { seg: 4, caps: [true, true] }))
  const iron = merge(crook, link, roof, base, ...rods).paint(() => IRON, 0)
  const glass = loft(
    [
      { c: [hx, 0.78, 0], rx: 0.055, ry: 0.055 },
      { c: [hx, 0.93, 0], rx: 0.061, ry: 0.061 },
    ],
    { seg: 16, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, 8), caps: [true, true] },
  ).paint((_x, y) => mix(GLASS, rgb(0xffe4b0), smoothstep(0.8, 0.88, y) * 0.5), 0)
  return { iron: { shape: iron, material: IRON_MAT }, glass: { shape: glass, material: GLASS_MAT, castShadow: false } }
}

// ───────────────────────────── fences and paths ─────────────────────────────

/** Half the length of a fence's or a hedge's section (they are laid end to end every 2 m). */
export const SECTION_HALF = 1

function fence(): Structure<'paint'> {
  const post = (x: number) => merge(slab(0.045, 0.045, -0.02, 0.97, 6, 8).place([x, 0, 0]), pyramid(0.062, 0.955, 1.045, 0.018, 8).place([x, 0, 0]))
  const rails = [0.26, 0.66].map((y) => beam(-SECTION_HALF, SECTION_HALF, y, -0.02, 0.012, 0.035))
  // nine pickets, pointed, nailed on the front of the rails
  const pickets: Shape[] = []
  for (let k = 0; k < 9; k++) {
    const x = -0.8 + k * 0.2
    pickets.push(
      loft(
        [
          { c: [x, 0.05, 0], rx: 0.04, ry: 0.011 },
          { c: [x, 0.8, 0], rx: 0.04, ry: 0.011 },
          { c: [x, 0.875, 0], rx: 0, ry: 0 },
        ],
        { seg: 8, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, 5), caps: [true, false] },
      ),
    )
  }
  // white paint, a little grubby near the ground (the same at both ends: posts drawn twice match)
  const all = merge(post(-SECTION_HALF), post(SECTION_HALF), ...rails, ...pickets)
    .paint(() => PAINT, 0)
    .shade((_x, y) => 0.8 + 0.2 * smoothstep(0.0, 0.32, y))
  return { paint: { shape: all, material: { roughness: 0.7 } } }
}

/** Noise that repeats every 2 m along x (a section's length): x goes round a circle, so x = −1 and x = +1 are one. */
function loopNoise(x: number, y: number, z: number, f: number, seed: number) {
  const r = f / Math.PI
  return fbm3(Math.cos(Math.PI * x) * r + y * f * 0.6, Math.sin(Math.PI * x) * r, z * f + y * f * 0.6, seed)
}

const HEDGE = { half: 0.31, height: 0.95 } as const

function hedge(): Structure<'leaves'> {
  const { half, height } = HEDGE
  const y = height / 2 - 0.015
  const rings: Ring[] = []
  const xs = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]
  // a step in at each end: the rounded end past it is a little thinner, so in a run it stays inside the next section
  rings.push({ c: [-SECTION_HALF - 0.005, y, 0], rx: half * 0.93, ry: (height / 2) * 0.93 })
  for (const x of xs) rings.push({ c: [x * SECTION_HALF, y, 0], rx: half, ry: height / 2 })
  rings.push({ c: [SECTION_HALF + 0.005, y, 0], rx: half * 0.93, ry: (height / 2) * 0.93 })
  const body = loft(rings, { seg: 12, steps: 1, up: [0, 1, 0], shape: (a) => squircle(a, 3.2), round: [0.27, 0.27] })
    // clipped lumps; none at the foot (it stands on the ground) nor at the ends (the next section meets it there)
    .displace((x, yy, z) => 0.035 * (loopNoise(x, yy, z, 2.2, 5) - 0.5) * smoothstep(0.0, 0.15, yy) * smoothstep(SECTION_HALF, SECTION_HALF - 0.2, Math.abs(x)))
    .paint((x, yy, z) => mix(rgb(0x355f2e), rgb(0x55823f), smoothstep(0.3, 0.75, loopNoise(x, yy, z, 3.5, 9))), 0)
    .shade((_x, yy) => 0.78 + 0.3 * smoothstep(0.05, height, yy))
  return { leaves: { shape: body, material: { roughness: 0.85, detail: { scale: 13, bump: 0.3, shade: 0.12 } } } }
}

/** Half the side of a path tile: tiles laid every 1.2 m join into one path. */
export const PATH_HALF = 0.6

function path(): Structure<'stones'> {
  const r = random(31)
  const H = PATH_HALF
  // [x0, x1, z0, z1]: two rows, the long stone first in one and last in the other
  const cells: [number, number, number, number][] = [
    [-H, 0.1, -H, 0],
    [0.1, H, -H, 0],
    [-H, -0.1, 0, H],
    [-0.1, H, 0, H],
  ]
  const gap = 0.024
  const stones = cells.map(([x0, x1, z0, z1], k) => {
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    // an uneven outline, kept inside its cell
    const wob = (a: number) => 0.955 + 0.025 * Math.sin(a * 3 + k * 1.7) + 0.02 * Math.sin(a * 5 + k)
    const hx = (x1 - x0) / 2 - gap
    const hz = (z1 - z0) / 2 - gap
    const top = 0.034 + 0.012 * r()
    const tone = r()
    const warm = r()
    const s = loft(
      [
        { c: [cx, -0.02, cz], rx: hx, ry: hz },
        { c: [cx, top - 0.014, cz], rx: hx, ry: hz },
        { c: [cx, top, cz], rx: hx - 0.016, ry: hz - 0.016 },
      ],
      { seg: 12, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, 5) * wob(a), caps: [false, true] },
    )
    const base = mix(mix(STONE, rgb(0xa89a86), warm * 0.7), STONE_DARK, 0.15 + tone * 0.45)
    return s.paint((x, y, z) => mix(base, STONE_DARK, 0.35 * smoothstep(0.35, 0.8, fbm3(x * 6, y * 6, z * 6, 40 + k))), 0).shade((_x, y) => 0.78 + 0.22 * smoothstep(0, top, y))
  })
  return { stones: { shape: merge(...stones), material: { roughness: 0.9, detail: { scale: 16, bump: 0.2, shade: 0.12 } }, castShadow: false } }
}

function steppingStones(): Structure<'stones'> {
  const r = random(57)
  const spots: [number, number, number][] = [
    [-0.05, -0.47, 0.22],
    [0.07, 0.0, 0.19],
    [-0.04, 0.47, 0.21],
  ]
  const stones = spots.map(([x, z, rad], k) => {
    const top = 0.04 + 0.012 * r()
    const seed = k * 2.3 + 1
    const s = loft(
      [
        { c: [0, -0.02, 0], rx: rad, ry: rad * 0.82 },
        { c: [0, top - 0.016, 0], rx: rad, ry: rad * 0.82 },
        { c: [0, top, 0], rx: rad * 0.86, ry: rad * 0.82 * 0.86 },
      ],
      { seg: 12, steps: 1, up: [0, 0, 1], shape: (a) => 1 + 0.07 * Math.sin(a * 2 + seed) + 0.04 * Math.sin(a * 3 + seed * 2), caps: [false, true] },
    ).place([x, 0, z], [0, r() * 3, 0])
    const base = mix(STONE, STONE_DARK, 0.1 + 0.5 * r())
    return s.paint((xx, y, zz) => mix(base, STONE_DARK, 0.4 * smoothstep(0.35, 0.8, fbm3(xx * 6, y * 6, zz * 6, 70 + k))), 0).shade((_x, y) => 0.78 + 0.22 * smoothstep(0, top, y))
  })
  return { stones: { shape: merge(...stones), material: { roughness: 0.9, detail: { scale: 16, bump: 0.2, shade: 0.12 } }, castShadow: false } }
}

// ───────────────────────────── a seat ─────────────────────────────

function bench(): Structure<'wood' | 'iron'> {
  // three seat slats (front +z) and two back slats leaning back on the sides' back legs
  const slats = [-0.12, 0.02, 0.16].map((z, k) => beam(-0.72, 0.72, 0.44, z, 0.058, 0.019).paint(grain(0, 11 + k), 0))
  const backLeg = (x: number): V3[] => [
    [x, -0.01, -0.14],
    [x, 0.2, -0.16],
    [x, 0.44, -0.2],
    [x, 0.66, -0.25],
    [x, 0.9, -0.305],
  ]
  // the back slats sit in front of the back legs, at the legs' slope
  const lean = Math.atan2(0.105, 0.46)
  const back = [0.62, 0.8].map((y, k) => {
    const z = -0.2 - (y - 0.44) * (0.105 / 0.46) + 0.03
    return beam(-0.72, 0.72, 0, 0, 0.016, 0.055)
      .paint(grain(0, 21 + k), 0)
      .place([0, 0, 0], [-lean, 0, 0])
      .place([0, y, z])
  })
  const wood = merge(...slats, ...back)
  const sides: Shape[] = []
  for (const x of [-0.62, 0.62]) {
    sides.push(tube(backLeg(x), 0.022, { seg: 5, steps: 2, round: [0, 0.02] }))
    // the front leg rising into the arm, curling back to the back leg
    sides.push(
      tube(
        [
          [x, -0.01, 0.17],
          [x, 0.42, 0.2],
          [x, 0.6, 0.19],
          [x, 0.645, 0.06],
          [x, 0.63, -0.23],
        ],
        0.022,
        { seg: 5, steps: 2, round: [0, 0.02] },
      ),
    )
    // the rail the slats rest on
    sides.push(
      tube(
        [
          [x, 0.41, -0.2],
          [x, 0.41, 0.2],
        ],
        0.018,
        { seg: 6, caps: [true, true] },
      ),
    )
  }
  const iron = merge(...sides).paint(() => IRON, 0)
  return { wood: { shape: wood, material: { roughness: 0.8 } }, iron: { shape: iron, material: IRON_MAT } }
}

// ───────────────────────────── trees ─────────────────────────────

function shadeTree(): Structure<'wood' | 'crown'> {
  // a trunk flaring at its foot into the ground, and four limbs up into the crown
  const trunk = tube(
    [
      [0, -0.012, 0],
      [0.0, 0.25, 0.0],
      [0.03, 1.2, 0.02],
      [0.06, 2.65, 0.03],
    ],
    [0.27, 0.19, 0.15, 0.1],
    { seg: 10, steps: 2, caps: [false, false] },
  )
  const wood = barked(
    merge(
      trunk,
      limb([0.04, 1.75, 0.02], [0.45, 2.2, 0.15], [0.8, 2.75, 0.3], 0.085),
      limb([0.04, 1.85, 0.02], [-0.4, 2.3, -0.2], [-0.75, 2.8, -0.35], 0.08),
      limb([0.05, 1.95, 0.03], [0.15, 2.45, -0.5], [0.25, 2.9, -0.8], 0.07),
      limb([0.06, 2.0, 0.03], [-0.15, 2.6, 0.45], [-0.3, 3.1, 0.75], 0.07),
    ),
    41,
  )
  const crown = leafy(
    merge(
      lump(1.3, [0, 3.35, 0], 1),
      lump(0.95, [0.95, 2.95, 0.35], 2),
      lump(0.95, [-0.9, 3.0, -0.3], 3),
      lump(0.85, [0.2, 2.9, -1.0], 4),
      lump(0.85, [-0.35, 2.95, 1.0], 5),
      lump(0.9, [0.15, 4.1, 0.1], 6),
      lump(0.75, [0.7, 3.75, -0.55], 7),
    ),
    rgb(0x3d6a33),
    rgb(0x62904a),
    2.1,
    4.6,
    23,
  )
  return { wood: { shape: wood, material: BARK_MAT }, crown: { shape: crown, material: LEAVES } }
}

function pine(): Structure<'wood' | 'needles'> {
  const trunk = barked(
    tube(
      [
        [0, -0.025, 0],
        [0, 0.6, 0],
        [0, 1.6, 0],
      ],
      [0.15, 0.11, 0.08],
      { seg: 8, steps: 1, round: [0, 0.05] },
    ),
    43,
    rgb(0x7a5a44),
    rgb(0x553a2c),
  )
  // tiers from the bottom: where its rim droops to, how wide, how tall the cone above it is
  const tiers: [number, number, number][] = [
    [0.55, 1.25, 1.2],
    [1.1, 1.05, 1.1],
    [1.65, 0.86, 1.0],
    [2.2, 0.66, 0.92],
    [2.72, 0.46, 0.85],
    [3.18, 0.27, 0.98],
  ]
  // each tier sweeps out from the trunk and droops at its rim, lobed where the branches end
  const cones = tiers.map(([y, r, h], k) =>
    lathe(
      [
        [0, y + 0.3],
        [r * 0.9, y - 0.07],
        [r, y - 0.03],
        [r * 0.8, y + 0.1],
        [r * 0.42, y + h * 0.5],
        [0, y + h],
      ],
      { seg: 16, steps: 1, shape: (a) => 1 + 0.11 * Math.sin(a * 8 + k * 1.3) + 0.05 * Math.sin(a * 3 + k) },
    ),
  )
  const needles = merge(...cones)
    .paint((x, y, z) => mix(rgb(0x264b33), rgb(0x41704a), smoothstep(0.35, 0.75, fbm3(x * 3, y * 3, z * 3, 61))), 0)
    // the rims lighter, the hollows under each tier darker
    .shade((x, y, z) => {
      const tier = tiers.reduce((best, t) => (Math.abs(y - t[0]) < Math.abs(y - best[0]) ? t : best))
      const out = Math.hypot(x, z) / tier[1]
      return 0.78 + 0.32 * smoothstep(0.4, 1, out) + 0.08 * smoothstep(1, 4, y)
    })
  return { wood: { shape: trunk, material: BARK_MAT }, needles: { shape: needles, material: { roughness: 0.9, detail: { scale: 14, bump: 0.25, shade: 0.14 } } } }
}

// ───────────────────────────── bushes and flowers ─────────────────────────────

function bush(): Structure<'leaves'> {
  const leaves = leafy(merge(lump(0.5, [0, 0.47, 0], 11, [1, 0.9, 1]), lump(0.36, [0.3, 0.32, 0.14], 12), lump(0.36, [-0.27, 0.33, -0.12], 13)), rgb(0x3f6e33), rgb(0x6a9a46), 0.05, 0.9, 25)
  return settle({ leaves: { shape: leaves, material: LEAVES } })
}

/** A rose: a cup of petals facing up, dark in its heart, its rim lighter; about 11 cm across. */
function rose(): Shape {
  return lathe(
    [
      [0, -0.02],
      [0.04, -0.008],
      [0.056, 0.02],
      [0.048, 0.042],
      [0.022, 0.052],
      [0, 0.044],
    ],
    { seg: 10, steps: 1, shape: (a, t) => 1 + (0.06 + 0.1 * t) * (Math.abs(Math.cos(a * 2.5)) - 0.5) },
  ).paint((x, y, z) => mix(rgb(0x9a1a34), rgb(0xee6c86), 0.3 + 0.7 * smoothstep(0.012, 0.045, Math.hypot(x, z)) * smoothstep(-0.015, 0.035, y)), 0)
}

function roses(): Structure<'leaves' | 'blooms'> {
  const body = merge(lump(0.42, [0, 0.46, 0], 14, [1, 1.05, 1]), lump(0.32, [0.26, 0.3, 0.12], 15), lump(0.33, [-0.24, 0.33, -0.1], 16))
  const leaves = leafy(body, rgb(0x2f5a2c), rgb(0x4f7d3c), 0.05, 0.9, 27)
  const centre: V3 = [0, 0.42, 0]
  const blooms: Shape[] = []
  for (let k = 0; k < 7; k++) {
    const a = k * 2.4 + 0.3
    const up = 0.15 + (k % 3) * 0.3
    const hit = onSurface(body, centre, [Math.cos(a), up, Math.sin(a)])
    if (!hit) continue
    // a centimetre into the leaves, facing out and a little up
    const n = hit.normal
    const at: V3 = [hit.point[0] - n[0] * 0.012, hit.point[1] - n[1] * 0.012, hit.point[2] - n[2] * 0.012]
    blooms.push(facing(rose(), at, [n[0], n[1] + 0.6, n[2]], k))
  }
  return settle({ leaves: { shape: leaves, material: LEAVES }, blooms: { shape: merge(...blooms), material: { roughness: 0.6 } } })
}

/** Flower heads over a mound of leaves: each looked for straight down onto it and set a centimetre in. */
function headsOn(mound: Shape, spots: [number, number][], size: number, seed: number): Shape {
  const r = random(seed)
  const heads: Shape[] = []
  spots.forEach(([x, z], k) => {
    const hit = mound.raycast([x, 3, z], [0, -1, 0])
    if (!hit) return
    const [petal, eye] = FLOWER_COLOURS[k % FLOWER_COLOURS.length]
    heads.push(facing(flowerHead(size * (0.85 + 0.3 * r()), petal, eye), [hit.point[0], hit.point[1] + 0.004, hit.point[2]], [hit.normal[0] * 0.5, 1, hit.normal[2] * 0.5], r() * 6))
  })
  return merge(...heads)
}

function flowers(): Structure<'leaves' | 'petals'> {
  const mound = merge(lump(0.36, [-0.2, 0.06, 0.02], 17, [1.15, 0.45, 1]), lump(0.34, [0.22, 0.05, -0.04], 18, [1.1, 0.45, 1]))
  const leaves = leafy(mound, rgb(0x3d6c30), rgb(0x6a9c48), -0.05, 0.2, 29)
  const spots: [number, number][] = [
    [-0.45, 0.05],
    [-0.3, -0.18],
    [-0.28, 0.2],
    [-0.12, 0.0],
    [-0.05, -0.22],
    [0.02, 0.2],
    [0.14, -0.05],
    [0.28, 0.16],
    [0.3, -0.22],
    [0.45, 0.0],
    [-0.15, 0.32],
    [0.15, -0.3],
  ]
  const heads = headsOn(mound, spots, 0.05, 81)
  // three tall spikes (lupins), out of the mound
  const spikes = (
    [
      [-0.1, -0.08, rgb(0x7a5cc4), 0.5],
      [0.08, 0.1, rgb(0xe56a9a), 0.42],
      [0.24, -0.1, rgb(0x6a6ad0), 0.46],
    ] as [number, number, V3, number][]
  ).map(([x, z, c, h]) =>
    lathe(
      [
        [0.028, 0.04],
        [0.042, 0.1 + h * 0.3],
        [0.032, 0.1 + h * 0.75],
        [0, 0.1 + h],
      ],
      { seg: 6, steps: 1 },
    )
      .paint((_x, y) => mix(mix(c, [0, 0, 0], 0.2), mix(c, [1, 1, 1], 0.35), smoothstep(0.1, 0.1 + h, y)), 0)
      .place([x, 0, z]),
  )
  return settle({ leaves: { shape: leaves, material: LEAVES }, petals: { shape: merge(heads, ...spikes), material: { roughness: 0.65 } } })
}

function planter(): Structure<'wood' | 'leaves' | 'petals'> {
  const box = slab(0.45, 0.2, 0.05, 0.4, 8, 16).paint(grain(0, 33), 0)
  const trim = merge(
    slab(0.48, 0.03, 0.39, 0.44, 6, 8).place([0, 0, 0.2]),
    slab(0.48, 0.03, 0.39, 0.44, 6, 8).place([0, 0, -0.2]),
    slab(0.03, 0.2, 0.39, 0.44, 6, 8).place([0.45, 0, 0]),
    slab(0.03, 0.2, 0.39, 0.44, 6, 8).place([-0.45, 0, 0]),
  )
    .paint(() => mix(WOOD, WOOD_DARK, 0.45), 0)
    .surface(0)
  const feet = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => slab(0.035, 0.035, 0, 0.07, 6, 8).place([sx * 0.4, 0, sz * 0.15]))).map((f) => f.paint(() => WOOD_DARK, 0).surface(0))
  const soil = slab(0.43, 0.18, 0.38, 0.425, 8, 12)
    .paint(() => SOIL, 0)
    .surface(0)
  const greens = merge(lump(0.17, [-0.2, 0.5, 0], 19, [1.45, 0.85, 0.95]), lump(0.17, [0.2, 0.5, 0.01], 20, [1.45, 0.85, 0.95]))
  const leaves = leafy(greens, rgb(0x3f6e33), rgb(0x6a9a46), 0.4, 0.62, 31)
  const heads = headsOn(
    greens,
    [
      [-0.36, 0.02],
      [-0.24, -0.08],
      [-0.12, 0.07],
      [0.02, -0.05],
      [0.14, 0.08],
      [0.26, -0.06],
      [0.37, 0.03],
    ],
    0.045,
    83,
  )
  return {
    wood: { shape: merge(box, trim, ...feet, soil), material: { roughness: 0.85, surface: { kind: 'boards', size: 0.4, tone: 0.4 } } },
    leaves: { shape: leaves, material: LEAVES },
    petals: { shape: heads, material: { roughness: 0.65 } },
  }
}

// ───────────────────────────── stone and water ─────────────────────────────

/** A blue tit, about 11 cm, perched facing +z (its feet at the origin). */
function blueTit(): Shape {
  const body = ellipsoid(0.032, 0.03, 0.05, 8, 5)
    .place([0, 0.032, 0], [-0.25, 0, 0])
    .paint((_x, y) => (y < 0.032 ? rgb(0xf0c63e) : rgb(0x6f9a6a)), 0)
  const head = ellipsoid(0.024, 0.024, 0.024, 8, 4)
    .place([0, 0.07, 0.04])
    .paint((_x, y) => (y > 0.078 ? rgb(0x3a74c4) : rgb(0xf6f4ee)), 0)
    .pattern((_x, y) => (y < 0.064 ? 0.8 : 0.2), rgb(0x1e2430))
  const beak = tube(
    [
      [0, 0.068, 0.058],
      [0, 0.066, 0.076],
    ],
    [0.006, 0],
    { seg: 4, steps: 1 },
  ).paint(() => rgb(0x2a2420), 0)
  const tail = loft(
    [
      { c: [0, 0.03, -0.035], rx: 0.016, ry: 0.006 },
      { c: [0, 0.018, -0.085], rx: 0.02, ry: 0.003 },
    ],
    { seg: 6, steps: 1, caps: [false, true] },
  ).paint(() => rgb(0x3a6a9a), 0)
  return merge(body, head, beak, tail)
}

function birdbath(): Structure<'stone' | 'water'> {
  const bowl = lathe(
    [
      [0.2, 0],
      [0.2, 0.05],
      [0.15, 0.08],
      [0.095, 0.14],
      [0.075, 0.42],
      [0.088, 0.6],
      [0.13, 0.67],
      [0.3, 0.755],
      [0.36, 0.795],
      [0.36, 0.83],
      [0.33, 0.842],
      [0.31, 0.805],
      [0, 0.78],
    ],
    { seg: 16, steps: 1 },
  )
    .paint((x, y, z) => mix(rgb(0xbab3a6), rgb(0x8f877b), 0.5 * smoothstep(0.35, 0.8, fbm3(x * 5, y * 5, z * 5, 91))), 0)
    // weathered darker and mossy low down
    .blend(rgb(0x5f6e43), (_x, y) => 0.5 * smoothstep(0.2, 0.0, y))
    .shade((_x, y) => 0.85 + 0.15 * smoothstep(0.1, 0.6, y))
  const bird = blueTit().place([0, 0, 0], [0, -1.2, 0]).place([0.33, 0.836, 0.06])
  const water = lathe(
    [
      [0, 0.79],
      [0.318, 0.79],
      [0.318, 0.806],
      [0, 0.806],
    ],
    { seg: 16, steps: 1 },
  ).paint((x, _y, z) => mix(rgb(0x5d8fa6), WATER, smoothstep(0.0, 0.3, Math.hypot(x, z))), 0)
  return {
    stone: { shape: merge(bowl, bird), material: { roughness: 0.9, detail: { scale: 14, bump: 0.15, shade: 0.07 } } },
    water: { shape: water, material: WATER_MAT, castShadow: false },
  }
}

function well(): Structure<'stone' | 'wood' | 'roof' | 'water'> {
  // the wall: courses of stone round a shaft, a rim of flat stones on top; dark down the shaft
  const stone = lathe(
    [
      [0.6, 0],
      [0.6, 0.6],
      [0.63, 0.625],
      [0.63, 0.69],
      [0.6, 0.715],
      [0.47, 0.715],
      [0.45, 0.69],
      [0.45, 0.3],
      [0, 0.3],
    ],
    { seg: 20, steps: 1 },
  )
    .paint((x, y, z) => {
      const r = Math.hypot(x, z)
      const inside = r < 0.455 && y < 0.7
      const c = mix(STONE, STONE_DARK, 0.6 * smoothstep(0.35, 0.75, fbm3(x * 5, y * 5, z * 5, 7)))
      return inside ? mix(c, rgb(0x1c1a18), 0.35 + 0.6 * smoothstep(0.65, 0.3, y)) : c
    }, 0)
    .shade((_x, y) => 0.82 + 0.18 * smoothstep(0, 0.25, y))
  const water = lathe(
    [
      [0, 0.29],
      [0.462, 0.29],
      [0.462, 0.33],
      [0, 0.33],
    ],
    { seg: 16, steps: 1 },
  ).paint(() => rgb(0x1f3a48), 0)
  // two posts in the wall up to the ridge, a beam along it, the axle with its winding of rope and a crank
  const posts = [-0.54, 0.54].map((x) => slab(0.05, 0.05, 0.6, 1.9, 6, 8).place([x, 0, 0]).paint(grain(1, 51), 0))
  const ridgeBeam = beam(-0.72, 0.72, 1.86, 0, 0.04, 0.04, 4, 8).paint(() => WOOD_DARK, 0)
  const axle = beam(-0.6, 0.7, 1.22, 0, 0.035, 0.035, 2, 8).paint(() => WOOD_DARK, 0)
  const winding = beam(-0.17, 0.17, 1.22, 0, 0.062, 0.062, 2, 10)
    .paint(() => ROPE, 0)
    .pattern((x) => 0.5 + 0.5 * Math.sin(x * 160), mix(ROPE, WOOD_DARK, 0.35))
  const crank = merge(
    tube(
      [
        [0.66, 1.22, 0],
        [0.66, 1.1, 0.08],
      ],
      0.016,
      { seg: 5, caps: [true, true] },
    ),
    tube(
      [
        [0.65, 1.1, 0.08],
        [0.78, 1.1, 0.08],
      ],
      0.018,
      { seg: 5, caps: [true, true] },
    ),
  ).paint(() => IRON, 0)
  // the bucket hanging on its rope above the shaft: staves with two iron hoops, a bail
  const bz = 0.055
  const bucket = lathe(
    [
      [0, 0.79],
      [0.08, 0.79],
      [0.098, 0.96],
      [0.088, 0.965],
      [0.072, 0.815],
      [0, 0.815],
    ],
    { seg: 12, steps: 1 },
  )
    .paint((_x, y) => (y < 0.82 ? mix(WOOD, WOOD_DARK, 0.6) : WOOD), 0)
    .pattern((_x, y) => (Math.abs(y - 0.83) < 0.012 || Math.abs(y - 0.935) < 0.012 ? 1 : 0), IRON)
    .place([0, 0, bz])
  const bail = tube(
    [
      [-0.095, 0.95, bz],
      [-0.06, 1.01, bz],
      [0, 1.03, bz],
      [0.06, 1.01, bz],
      [0.095, 0.95, bz],
    ],
    0.006,
    { seg: 4, steps: 2, caps: [true, true] },
  ).paint(() => IRON, 0)
  const rope = tube(
    [
      [0, 1.2, bz],
      [0, 1.025, bz],
    ],
    0.009,
    { seg: 5, caps: [true, true] },
  ).paint(() => ROPE, 0)
  const wood = merge(...posts, ridgeBeam, axle, winding, crank, bucket, bail, rope).surface(0)
  // the roof: two shingled slopes from the ridge, and a cap along it
  const slope = (side: 1 | -1) => {
    const run = 0.6
    const drop = 0.4
    const len = Math.hypot(run, drop) + 0.05
    const tilt = Math.atan2(drop, run)
    return slab(0.74, len / 2, -0.022, 0.022, 10, 12)
      .place([0, 0, 0], [side * tilt, 0, 0])
      .place([0, 1.9 - drop / 2, (side * run) / 2])
  }
  const cap = beam(-0.75, 0.75, 1.915, 0, 0.04, 0.035, 2, 8)
    .paint(() => mix(SHINGLE, rgb(0x2c2e30), 0.6), 0)
    .surface(0)
  const roof = merge(
    merge(slope(1), slope(-1)).paint(() => SHINGLE, 0),
    cap,
  )
  return {
    stone: { shape: stone, material: { roughness: 0.95, surface: { kind: 'stone', size: 0.54, joint: MORTAR, tone: 0.6 } } },
    wood: { shape: wood, material: { roughness: 0.85 } },
    roof: { shape: roof, material: { roughness: 0.7, surface: { kind: 'shingle', size: 0.6, tone: 0.55 } } },
    water: { shape: water, material: WATER_MAT, castShadow: false },
  }
}

// ───────────────────────────── the catalogue's models ─────────────────────────────

const MAKERS: Record<DecorKind, () => Structure> = {
  lamp,
  lantern,
  fence,
  hedge,
  path,
  stones: steppingStones,
  bench,
  tree: shadeTree,
  pine,
  bush,
  roses,
  flowers,
  planter,
  birdbath,
  well,
  'scarecrow-squire': squireScarecrow,
  'scarecrow-ploughman': ploughmanScarecrow,
  'scarecrow-bogle': bogleScarecrow,
}

/** One decoration's model (made afresh each call: build it once per kind and share it). */
export function decorModel(kind: DecorKind): Structure<string> {
  return MAKERS[kind]()
}
