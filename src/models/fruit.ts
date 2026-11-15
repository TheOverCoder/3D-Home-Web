import { Color } from 'three'
import { lathe, merge, Parts, rgb, smoothstep, tube, type PartDef, type SculptMaterialOptions, type Shape, type V3 } from '../lib/sculpt'
import type { FruitId, FruitKind } from '../farm/decor'
import { barked, LEAVES, leafy, limb, lump, onSurface } from './decor'
import { grain, mix, slab, type Structure } from './structures'

// The farm's fruit trees and bushes (src/farm/decor.ts: FRUIT), sculpted as the lemon tree is, and the fruit that
// hangs on them. Each plant stands in its own frame (the ground under its middle at the origin) as two parts: its wood
// and its leaves. Each kind is told apart without its fruit too, by its shape and its green:
//
//   apple-tree      a broad, flat-topped crown on a short trunk that forks into spreading limbs; mid green
//   orange-tree     a dense ball of dark, glossy leaves on a straight trunk, whitewashed at its foot
//   cherry-tree     tall and upright, a fresh light green, on a red-brown trunk
//   blueberry-bush  a low, wide dome of blue-green leaves on red stems
//   raspberry-bush  a tall, loose clump of canes in bright green, tied to a stake
//
// The fruit hangs from where `fruitSpots` says: each spot the end of a stalk, straight above a fruit that sits in the
// outside of the leaves, two thirds of it out — all round the crown, from under its rim up to its shoulders, where it is
// seen from the ground and from above. The k-th spot is the same whatever the number asked for, so a plant with more
// fruit only adds spots. The fruit is a crowd's part each (`fruitParts`, `putFruit`), like the lemons: an apple, an
// orange, three cherries, a bunch of five blueberries, two raspberries — each FRUIT_SCALE times life size, so it reads
// on a phone among the leaves; its stalk's end at its origin and the fruit hanging below it, the same whichever way
// its plant is turned. (The goods' models, src/models/goods.ts, are the same fruit seen big, for the pictures: a few
// times heavier, too heavy to hang by the dozen.)

const LIME = rgb(0xf0ece0)
const STALK = rgb(0x6b5a32)
const CALYX = rgb(0x4a7a2e)

/** A glossy leaf for the orange tree (its own shine; the same fine bumps). */
const GLOSSY: SculptMaterialOptions = { roughness: 0.62, detail: { scale: 9, bump: 0.3, shade: 0.1 } }
const BARK_MAT: SculptMaterialOptions = { roughness: 0.95, surface: { kind: 'bark', size: 0.45 } }

interface Plant {
  /** the trunk, limbs, canes (one shape) */
  wood: () => Shape
  /** the leaves: made once (fruitSpots looks for the fruit's places on it) */
  leaves: () => Shape
  leafMaterial: SculptMaterialOptions
  /** where the fruit is looked for from: the crown's middle, and the range of heights round it (radians up from level) */
  centre: V3
  low: number
  high: number
}

// ───────────────────────────── the plants ─────────────────────────────

function appleWood(): Shape {
  const trunk = tube(
    [
      [0, -0.012, 0],
      [0.02, 0.5, 0.01],
      [0.05, 1.05, 0.03],
      [0.06, 1.7, 0.03],
    ],
    [0.17, 0.12, 0.1, 0.075],
    { seg: 9, steps: 2 },
  )
  return barked(
    merge(
      trunk,
      limb([0.04, 0.95, 0.02], [0.45, 1.3, 0.14], [0.85, 1.7, 0.24], 0.065),
      limb([0.04, 1.0, 0.02], [-0.42, 1.34, -0.16], [-0.78, 1.74, -0.28], 0.06),
      limb([0.05, 1.08, 0.03], [0.12, 1.42, 0.45], [0.16, 1.72, 0.78], 0.055),
      limb([0.05, 1.12, 0.03], [-0.1, 1.46, -0.42], [-0.2, 1.76, -0.72], 0.055),
    ),
    101,
  )
}

function appleLeaves(): Shape {
  return leafy(
    merge(
      lump(0.95, [0, 2.05, 0], 31, [1, 0.8, 1]),
      lump(0.66, [0.8, 1.82, 0.22], 32),
      lump(0.66, [-0.74, 1.86, -0.25], 33),
      lump(0.62, [0.12, 1.8, 0.82], 34),
      lump(0.62, [-0.2, 1.84, -0.8], 35),
      lump(0.62, [0.25, 2.45, -0.1], 36),
    ),
    rgb(0x41702f),
    rgb(0x6b9a44),
    1.3,
    2.9,
    37,
  )
}

function orangeWood(): Shape {
  const trunk = tube(
    [
      [0, -0.012, 0],
      [0, 0.6, 0],
      [0.01, 1.4, 0],
    ],
    [0.13, 0.1, 0.08],
    { seg: 9, steps: 2 },
  )
  const wood = barked(
    merge(
      trunk,
      limb([0.01, 1.1, 0], [0.3, 1.35, 0.12], [0.52, 1.6, 0.2], 0.05),
      limb([0.01, 1.15, 0], [-0.28, 1.4, -0.1], [-0.48, 1.62, -0.2], 0.05),
      limb([0.01, 1.2, 0], [0.05, 1.5, -0.3], [0.1, 1.7, -0.5], 0.045),
    ),
    103,
  )
  // whitewashed up to knee height, its top edge uneven
  return wood.paint((x, y, z, k) => {
    const edge = 0.55 + 0.03 * Math.sin(Math.atan2(z, x) * 3)
    const c: V3 = [wood.c[k * 3], wood.c[k * 3 + 1], wood.c[k * 3 + 2]]
    return y < edge ? mix(LIME, c, 0.12) : c
  }, 0)
}

function orangeLeaves(): Shape {
  return leafy(
    merge(lump(0.92, [0, 1.88, 0], 41, [1, 0.92, 1]), lump(0.55, [0.56, 1.62, 0.24], 42), lump(0.55, [-0.53, 1.65, -0.22], 43), lump(0.52, [0.16, 1.6, -0.56], 44), lump(0.52, [-0.2, 1.62, 0.56], 45)),
    rgb(0x2a5528),
    rgb(0x467a36),
    1.15,
    2.7,
    47,
  )
}

function cherryWood(): Shape {
  const trunk = tube(
    [
      [0, -0.012, 0],
      [0.02, 0.7, 0.0],
      [0.0, 1.4, 0.02],
      [0.02, 2.2, 0.0],
    ],
    [0.15, 0.115, 0.095, 0.07],
    { seg: 9, steps: 2 },
  )
  return barked(
    merge(
      trunk,
      limb([0.0, 1.45, 0.02], [0.35, 1.8, 0.18], [0.58, 2.1, 0.3], 0.055),
      limb([0.0, 1.5, 0.02], [-0.32, 1.85, -0.18], [-0.56, 2.15, -0.3], 0.055),
      limb([0.01, 1.55, 0.02], [0.12, 1.9, -0.38], [0.2, 2.2, -0.6], 0.05),
      limb([0.01, 1.6, 0.02], [-0.1, 1.95, 0.38], [-0.22, 2.2, 0.6], 0.05),
    ),
    107,
    rgb(0x8c4c3a),
    rgb(0x5e2e24),
  )
}

function cherryLeaves(): Shape {
  return leafy(
    merge(
      lump(0.85, [0, 2.4, 0], 51),
      lump(0.6, [0.56, 2.08, 0.3], 52),
      lump(0.6, [-0.55, 2.12, -0.3], 53),
      lump(0.56, [0.2, 2.14, -0.6], 54),
      lump(0.56, [-0.25, 2.12, 0.6], 55),
      lump(0.68, [0.05, 3.02, 0.05], 56),
    ),
    rgb(0x4a8034),
    rgb(0x7cae50),
    1.6,
    3.5,
    57,
  )
}

function blueberryWood(): Shape {
  // red stems from the ground up into the leaves
  const stems = [0.4, 2.2, 4.2].map((a, k) =>
    tube(
      [
        [Math.cos(a) * 0.06, -0.012, Math.sin(a) * 0.06],
        [Math.cos(a) * 0.18, 0.18, Math.sin(a) * 0.18],
        [Math.cos(a) * 0.26 + 0.02 * k, 0.36, Math.sin(a) * 0.26],
      ],
      [0.03, 0.024, 0.02],
      { seg: 5, steps: 1, round: [0, 0.02] },
    ),
  )
  return merge(...stems).paint((_x, y) => mix(rgb(0x6e3a2c), rgb(0x9a4a36), smoothstep(0, 0.3, y)), 0)
}

function blueberryLeaves(): Shape {
  return leafy(
    merge(lump(0.48, [0, 0.56, 0], 61, [1.05, 0.9, 1.05]), lump(0.37, [0.42, 0.4, 0.1], 62), lump(0.37, [-0.4, 0.42, -0.12], 63), lump(0.35, [0.04, 0.4, 0.42], 64)),
    rgb(0x355e46),
    rgb(0x67977a),
    0.05,
    1.0,
    67,
  ).blend(rgb(0x7a4a3a), (_x, y) => 0.25 * smoothstep(0.3, 0.05, y))
}

function raspberryWood(): Shape {
  // canes out of the ground, arching up and out (their tips past the leaves), and a stake they are tied to
  const canes = (
    [
      [0.3, 0.08, 0.95, 1.3],
      [1.6, 0.1, 0.9, 1.2],
      [2.8, 0.06, 0.85, 1.4],
      [4.0, 0.1, 1.0, 1.25],
      [5.2, 0.08, 0.9, 1.35],
    ] as [number, number, number, number][]
  ).map(([a, r0, lean, h]) =>
    tube(
      [
        [Math.cos(a) * r0, -0.012, Math.sin(a) * r0],
        [Math.cos(a) * (r0 + 0.08), h * 0.55, Math.sin(a) * (r0 + 0.08)],
        [Math.cos(a) * (r0 + 0.32 * lean), h, Math.sin(a) * (r0 + 0.32 * lean)],
      ],
      [0.016, 0.013, 0.009],
      { seg: 5, steps: 2, round: [0, 0.01] },
    ),
  )
  const cane = merge(...canes).paint((_x, y) => mix(rgb(0x7a5a3a), rgb(0x8a8a48), smoothstep(0.1, 1.0, y)), 0)
  const stake = slab(0.022, 0.022, -0.012, 1.42, 6, 8).place([0.02, 0, -0.04]).paint(grain(1, 109), 0)
  return merge(cane, stake)
}

function raspberryLeaves(): Shape {
  return leafy(
    merge(
      lump(0.4, [0, 0.98, 0], 71, [0.95, 1.2, 0.95]),
      lump(0.34, [0.32, 0.74, 0.12], 72, [0.9, 1.25, 0.9]),
      lump(0.34, [-0.3, 0.76, -0.1], 73, [0.9, 1.25, 0.9]),
      lump(0.3, [0.05, 0.62, 0.32], 74, [0.9, 1.25, 0.9]),
    ),
    rgb(0x46803a),
    rgb(0x82b656),
    0.3,
    1.4,
    77,
  )
}

const PLANTS: Record<FruitKind, Plant> = {
  'apple-tree': { wood: appleWood, leaves: appleLeaves, leafMaterial: LEAVES, centre: [0, 1.95, 0], low: -0.45, high: 0.6 },
  'orange-tree': { wood: orangeWood, leaves: orangeLeaves, leafMaterial: GLOSSY, centre: [0, 1.85, 0], low: -0.45, high: 0.65 },
  'cherry-tree': { wood: cherryWood, leaves: cherryLeaves, leafMaterial: LEAVES, centre: [0, 2.35, 0], low: -0.5, high: 0.6 },
  'blueberry-bush': { wood: blueberryWood, leaves: blueberryLeaves, leafMaterial: LEAVES, centre: [0, 0.45, 0], low: -0.25, high: 0.75 },
  'raspberry-bush': { wood: raspberryWood, leaves: raspberryLeaves, leafMaterial: LEAVES, centre: [0, 0.85, 0], low: -0.3, high: 0.65 },
}

const leavesMade = new Map<FruitKind, Shape>()
/** A plant's leaves, made once (the model draws a copy; the fruit's places are found on this one). */
function leavesOf(kind: FruitKind): Shape {
  let s = leavesMade.get(kind)
  if (!s) leavesMade.set(kind, (s = PLANTS[kind].leaves()))
  return s
}

export type FruitPlantPart = 'wood' | 'leaves'

/** A fruit tree or bush without its fruit (the fruit hangs at `fruitSpots`, drawn with `fruitParts`). */
export function fruitPlantModel(kind: FruitKind): Structure<FruitPlantPart> {
  const p = PLANTS[kind]
  return { wood: { shape: p.wood(), material: BARK_MAT }, leaves: { shape: leavesOf(kind).clone(), material: p.leafMaterial } }
}

const spotsMade = new Map<FruitKind, V3[]>()

/** Where `n` fruit hang on a plant (in its frame): each the end of its stalk, placed so the fruit hanging under it
 *  sits in the outside of the leaves, two thirds of it out — all the way round, from under the crown's rim up to
 *  its shoulders, where it is seen from the ground and from above. The k-th is the same for any `n`. */
export function fruitSpots(kind: FruitKind, n: number): V3[] {
  const known = spotsMade.get(kind) ?? []
  const p = PLANTS[kind]
  const fruit = measure(FRUIT_OF[kind])
  const leaves = leavesOf(kind)
  for (let k = known.length; k < n; k++) {
    // round the crown by the golden angle; up and down through the range in a sequence that never repeats
    const a = k * 2.39996 + 0.6
    const t = (k * 0.618034 + 0.31) % 1
    const e = p.low + (p.high - p.low) * t
    const hit = onSurface(leaves, p.centre, [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)])
    const [x, y, z] = hit ? hit.point : p.centre
    const [nx, ny, nz] = hit ? hit.normal : [0, 1, 0]
    // the fruit's middle a third of its size out of the leaves; its stalk's end straight above that
    const out = fruit.size / 3
    known.push([x + nx * out, y + ny * out + fruit.hang, z + nz * out])
  }
  spotsMade.set(kind, known)
  return known.slice(0, n)
}

// ───────────────────────────── the fruit ─────────────────────────────

/** A stalk from inside the fruit up to its end at the origin, a little crooked. */
const stalk = (from: V3, r = 0.0045) => tube([from, [from[0] * 0.5 + 0.003, from[1] * 0.5, from[2] * 0.5], [0, 0, 0]], [r, r * 0.9, r * 0.8], { seg: 4, steps: 1, round: [0, r] }).fill(STALK, 0)

/** An apple, about 9 cm: red, a yellow blush on one side, dimpled at both ends. */
function apple(): Shape {
  const top = -0.034
  const body = lathe(
    [
      [0, -0.112],
      [0.02, -0.116],
      [0.038, -0.104],
      [0.047, -0.08],
      [0.045, -0.055],
      [0.033, -0.039],
      [0.012, -0.038],
      [0, -0.044],
    ],
    { seg: 10, steps: 1 },
  )
    .paint((_x, y) => mix(rgb(0x9a1c1e), rgb(0xd8342a), smoothstep(-0.11, -0.05, y)), 1)
    .blend(rgb(0xe8b84a), (x, y) => 0.75 * smoothstep(-0.01, -0.045, x) * smoothstep(-0.115, -0.07, y))
  return merge(body, stalk([0, top - 0.012, 0]))
}

/** An orange, about 9.5 cm, a green star where its stalk holds on. */
function orange(): Shape {
  const body = lathe(
    [
      [0, -0.126],
      [0.03, -0.121],
      [0.046, -0.098],
      [0.048, -0.075],
      [0.038, -0.05],
      [0.016, -0.038],
      [0, -0.036],
    ],
    { seg: 10, steps: 1 },
  ).paint((_x, y) => mix(rgb(0xd8651a), rgb(0xf5961e), smoothstep(-0.125, -0.06, y)), 1)
  const calyx = lathe(
    [
      [0, -0.041],
      [0.012, -0.038],
      [0, -0.032],
    ],
    { seg: 5, steps: 1 },
  ).fill(CALYX, 0)
  return merge(body, calyx, stalk([0, -0.042, 0]))
}

/** Three cherries, each about 4.4 cm, on their stalks from one point. */
function cherries(): Shape {
  const one = (dx: number, dz: number, drop: number) => {
    const at: V3 = [dx, -drop, dz]
    const berry = lathe(
      [
        [0, -0.021],
        [0.016, -0.016],
        [0.022, 0.0],
        [0.017, 0.015],
        [0.006, 0.02],
        [0, 0.017],
      ],
      { seg: 8, steps: 1 },
    )
      .paint((_x, y) => mix(rgb(0x6e0a1a), rgb(0xc81e34), smoothstep(-0.02, 0.016, y)), 1)
      .place(at)
    const st = tube(
      [
        [0, 0.004, 0],
        [dx * 0.4, -drop * 0.45, dz * 0.4],
        [dx, -drop + 0.014, dz],
      ],
      [0.0035, 0.003, 0.003],
      { seg: 3, steps: 1 },
    ).fill(STALK, 0)
    return merge(berry, st)
  }
  return merge(one(0.026, 0.008, 0.07), one(-0.024, 0.01, 0.078), one(0.0, -0.026, 0.074))
}

/** A bunch of five blueberries, each about 3 cm, dusty blue. */
function blueberries(): Shape {
  const berry = (at: V3) =>
    lathe(
      [
        [0, -0.013],
        [0.013, -0.009],
        [0.015, 0.003],
        [0.01, 0.013],
        [0, 0.011],
      ],
      { seg: 6, steps: 1 },
    )
      .paint((_x, y) => mix(rgb(0x2e3f78), rgb(0x6f82b8), smoothstep(-0.013, 0.013, y)), 1)
      .place(at)
  return merge(berry([0, -0.03, 0]), berry([0.022, -0.042, 0.006]), berry([-0.018, -0.044, 0.014]), berry([0.002, -0.048, -0.021]), berry([0.0, -0.064, 0.002]), stalk([0, -0.024, 0], 0.003))
}

/** Two raspberries, each about 3.6 cm: round cones of drupelets under green calyxes, on stalks from one point. */
function raspberries(): Shape {
  const one = (at: V3, turn: number) => {
    const b = raspberry().place([0, 0, 0], [0, 0, turn]).place(at)
    const st = tube(
      [
        [0, 0, 0],
        [at[0] * 0.5, at[1] * 0.4, at[2] * 0.5],
        [at[0], at[1] - 0.024, at[2]],
      ],
      [0.003, 0.0028, 0.0026],
      { seg: 3, steps: 1, round: [0.003, 0] },
    ).fill(STALK, 0)
    return merge(b, st)
  }
  return merge(one([0.016, 0, 0.004], -0.25), one([-0.016, -0.012, -0.004], 0.25))
}

/** One raspberry, hanging from its calyx at the origin. */
function raspberry(): Shape {
  const body = lathe(
    [
      [0, -0.062],
      [0.01, -0.06],
      [0.016, -0.052],
      [0.018, -0.04],
      [0.016, -0.03],
      [0.009, -0.026],
      [0, -0.025],
    ],
    { seg: 10, steps: 1, shape: (a, t) => 1 + 0.07 * Math.abs(Math.sin(a * 5)) * Math.abs(Math.sin(t * Math.PI * 3)) },
  ).paint((_x, y) => mix(rgb(0xa8183a), rgb(0xe23e5a), smoothstep(-0.062, -0.03, y)), 1)
  const calyx = lathe(
    [
      [0, -0.03],
      [0.016, -0.025],
      [0, -0.021],
    ],
    { seg: 5, steps: 1, shape: (a) => 0.6 + 0.4 * Math.abs(Math.cos(a * 2.5)) },
  ).fill(CALYX, 0)
  return merge(body, calyx).place([0, 0.024, 0])
}

/** How much bigger than life the fruit hangs on the plants (enough to read among the leaves on a phone). */
export const FRUIT_SCALE = 1.4

const bigger = (make: () => Shape) => () => make().place([0, 0, 0], [0, 0, 0], FRUIT_SCALE)

const HANGING: Record<FruitId, { make: () => Shape; material: SculptMaterialOptions }> = {
  apple: { make: bigger(apple), material: { roughness: 0.35 } },
  orange: { make: bigger(orange), material: { roughness: 0.5 } },
  cherry: { make: bigger(cherries), material: { roughness: 0.25 } },
  blueberry: { make: bigger(blueberries), material: { roughness: 0.6 } },
  raspberry: { make: bigger(raspberries), material: { roughness: 0.55 } },
}

const measured = new Map<FruitId, { hang: number; size: number }>()
/** How far a fruit's middle hangs under its stalk's end, and how big it is (the bigger of its width and its depth). */
function measure(fruit: FruitId) {
  let m = measured.get(fruit)
  if (!m) {
    const p = HANGING[fruit].make().p
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (let k = 0; k < p.length; k++) {
      lo[k % 3] = Math.min(lo[k % 3], p[k])
      hi[k % 3] = Math.max(hi[k % 3], p[k])
    }
    measured.set(fruit, (m = { hang: -(lo[1] + Math.min(hi[1], lo[1] + Math.max(hi[0] - lo[0], hi[2] - lo[2]))) / 2, size: Math.max(hi[0] - lo[0], hi[2] - lo[2]) }))
  }
  return m
}

const FRUIT_OF: Record<FruitKind, FruitId> = { 'apple-tree': 'apple', 'orange-tree': 'orange', 'cherry-tree': 'cherry', 'blueberry-bush': 'blueberry', 'raspberry-bush': 'raspberry' }

/** One fruit as it hangs: its stalk's end at the origin, the fruit below (a crowd's part, drawn with `fruitParts`). */
export const hangingFruit = (fruit: FruitId): Shape => HANGING[fruit].make()

/** The fruit on every fruit plant: one instanced draw per fruit, up to `max` of each at once. Nothing casts a shadow. */
export function fruitParts(max = 64): Parts<FruitId> {
  const defs = {} as Record<FruitId, PartDef>
  for (const id of Object.keys(HANGING) as FruitId[]) defs[id] = { geometry: hangingFruit(id).geometry(), max, material: HANGING[id].material }
  return new Parts<FruitId>(defs, 'fruit')
}

const tone = new Color()

/** A fruit hanging from (x, y, z) — a spot of `fruitSpots`, in the frame `parts.at` set — the k-th on its plant:
 *  swinging a little off the vertical, each its own way, a shade lighter or darker than the next. */
export function putFruit(parts: Parts<FruitId>, fruit: FruitId, x: number, y: number, z: number, k: number) {
  const rx = 0.04 + (k % 3) * 0.03
  const ry = k * 1.7
  tone.setScalar(0.9 + 0.1 * ((k * 0.618034) % 1))
  parts.put(fruit, x, y, z, rx, ry, 0, 1, tone)
}
