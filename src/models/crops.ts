import type { BufferGeometry } from 'three'
import { blade, blob, lathe, loft, merge, Parts, random, rgb, smoothstep, tube, type PartDef, type Shape, type SculptMaterialOptions, type V3 } from '../lib/sculpt'

// The garden's parts: leaves, stalks and fruit, each built once at a unit size and drawn by the hundred, scaled
// and coloured per plant. Leaves are painted pale (a lighter midrib, darker edges) and take their green from the
// plant; fruit is painted white and ripens through the plant's colour (green to red, to gold…), while calyxes,
// stems and husks keep their own colours (tint 0). Conventions, so a grower can place any of them:
//
//   leaves     the base at the origin, reaching along +z, the upper side facing +y (tilt with rx, turn with ry)
//   stems      from the origin up +y, 1 tall and 1 wide: scale (radius, height, radius)
//   fruit      round about the origin, about 1 across (a strawberry hangs from the origin down −y)

const GREEN = rgb(0x5d8f3c)
const CALYX = rgb(0x4f8a34)
const STEM_BROWN = rgb(0x6b5a32)
const SILK = rgb(0x9a6a3a)

/** Pale in the middle, darker to the edges, a light midrib: a leaf's own shading under the plant's green. */
function leafShade(shape: Shape, width: number) {
  return shape.paint((x, _y, z) => {
    const v = Math.min(1, Math.abs(x) / Math.max(0.0001, width))
    const k = 1.1 - 0.28 * v + 0.18 * smoothstep(0.08, 0.0, v) - 0.08 * smoothstep(0.2, 0, z)
    return [k, k, k]
  }, 1)
}

/** Tilts a part (rx, about its own x) and then turns it about the vertical (ry), at a point: a ring of sepals,
 *  husks round a cob. */
const around = (shape: Shape, tilt: number, turn: number, at: V3 = [0, 0, 0]) => shape.place([0, 0, 0], [tilt, 0, 0]).place(at, [0, turn, 0])

/** A checker over a lathe's or loft's vertices (`seg` round each ring): seeds on a berry, kernels on a cob. */
const checker = (seg: number) => {
  let k = 0
  return () => {
    const v = (Math.floor(k / seg) + k) % 2
    k++
    return v
  }
}

/** A small closed leaf (a thin lens), for parts on fruit and flowers that are seen from both sides. */
function leaflet(length: number, width: number, droop = 0): Shape {
  return loft(
    [
      { c: [0, 0, 0], rx: width * 0.25, ry: width * 0.06 },
      { c: [0, droop * 0.3, length * 0.45], rx: width * 0.5, ry: width * 0.07 },
      { c: [0, droop, length], rx: 0.002, ry: 0.002 },
    ],
    { seg: 3, steps: 1 },
  )
}

function lettuceLeaf(): Shape {
  const b = blade({ length: 1, width: 0.95, outline: (u) => Math.sin(Math.PI * Math.pow(u, 0.65)) * (1 - 0.15 * u), fold: 0.4, bend: 1.0, frill: 0.14, waves: 6, segL: 5, segW: 2 })
  return leafShade(b, 0.45)
}

function lettuceHeart(): Shape {
  const h = blob(0.5, 2, (x, y, z) => 0.06 * Math.sin(x * 11 + y * 5) * Math.cos(z * 9 - y * 4)).place([0, 0.0, 0], [0, 0, 0], [1, 0.82, 1])
  return h.paint((_x, y) => {
    const k = 1.05 + 0.12 * smoothstep(-0.2, 0.4, y)
    return [k, k, k]
  }, 1)
}

/** A long blade of a grass (corn, cane, wheat): narrow, drooping towards the tip. */
function grassBlade(): Shape {
  const b = blade({ length: 1, width: 0.075, outline: (u) => Math.min(1, u * 8) * Math.pow(1 - u, 0.7), fold: 0.45, bend: -1.1, segL: 6, segW: 1 })
  return leafShade(b, 0.035)
}

/** A carrot's feathery frond: a thin stem with small, finely cut leaflets on both sides. */
function frond(): Shape {
  const stem = tube(
    [
      [0, 0, 0],
      [0, 0.03, 0.5],
      [0, 0.0, 1],
    ],
    [0.018, 0.012, 0.006],
    { seg: 3, steps: 1 },
  )
  const parts: Shape[] = [stem]
  for (let k = 0; k < 5; k++) {
    const u = 0.3 + k * 0.14
    for (const sx of [-1, 1]) {
      const l = blade({ length: 0.24 * (1.1 - u * 0.5), width: 0.1, teeth: 0.5, toothCount: 3, fold: 0.3, bend: -0.4, segL: 2, segW: 1 })
      parts.push(l.place([0, 0.02, u], [0, sx * 1.0, 0]))
    }
  }
  parts.push(blade({ length: 0.18, width: 0.08, teeth: 0.5, toothCount: 3, segL: 2, segW: 1 }).place([0, 0, 0.95]))
  return leafShade(merge(...parts), 0.12)
}

/** A strawberry leaf: three serrated leaflets on a stalk. */
function trefoil(): Shape {
  const stalk = tube(
    [
      [0, 0, 0],
      [0, 0.25, 0.2],
      [0, 0.38, 0.5],
    ],
    [0.025, 0.02, 0.018],
    { seg: 3, steps: 1 },
  )
  const parts: Shape[] = [stalk.fill([0.95, 0.95, 0.95], 1)]
  for (const a of [-0.8, 0, 0.8]) {
    const l = blade({ length: 0.42, width: 0.34, outline: (u) => Math.sin(Math.PI * Math.pow(u, 0.75)), teeth: 0.12, toothCount: 7, fold: 0.35, bend: 0.25, segL: 4, segW: 1 })
    parts.push(leafShade(l, 0.17).place([0, 0.38, 0.5], [-0.25, a, 0]))
  }
  return merge(...parts)
}

/** A tomato leaf: a stalk with serrated leaflets in pairs and one at the tip. */
function tomatoLeaf(): Shape {
  const stalk = tube(
    [
      [0, 0, 0],
      [0, 0.06, 0.5],
      [0, 0.0, 1],
    ],
    [0.02, 0.015, 0.008],
    { seg: 3, steps: 1 },
  ).fill([0.95, 0.95, 0.95], 1)
  const parts: Shape[] = [stalk]
  for (const [u, len] of [
    [0.3, 0.3],
    [0.62, 0.36],
  ] as [number, number][])
    for (const sx of [-1, 1]) {
      const l = blade({ length: len, width: len * 0.55, teeth: 0.15, toothCount: 6, fold: 0.3, bend: -0.3, segL: 4, segW: 1 })
      parts.push(leafShade(l, len * 0.27).place([0, 0.05, u], [0.1, sx * 1.15, 0]))
    }
  const tip = blade({ length: 0.36, width: 0.2, teeth: 0.15, toothCount: 6, fold: 0.3, bend: -0.3, segL: 4, segW: 1 })
  parts.push(leafShade(tip, 0.1).place([0, 0.0, 0.95]))
  return merge(...parts)
}

/** A pumpkin leaf: big, rough and lobed, on a long hollow stalk. */
function pumpkinLeaf(): Shape {
  const stalk = tube(
    [
      [0, 0, 0],
      [0, 0.25, 0.25],
      [0, 0.32, 0.45],
    ],
    [0.035, 0.03, 0.025],
    { seg: 4, steps: 1 },
  ).fill([0.95, 0.95, 0.95], 1)
  const parts: Shape[] = [stalk]
  for (const a of [-1.1, -0.55, 0, 0.55, 1.1]) {
    const len = 0.55 - Math.abs(a) * 0.12
    const l = blade({ length: len, width: len * 0.85, outline: (u) => Math.sin(Math.PI * Math.pow(u, 0.6)) * (1 - 0.25 * u), teeth: 0.08, toothCount: 5, fold: 0.15, bend: 0.2, segL: 3, segW: 1 })
    parts.push(leafShade(l, len * 0.4).place([0, 0.32, 0.45], [-0.35, a, 0]))
  }
  return merge(...parts)
}

/** A tomato: round, a little flat, faintly ribbed, with a green star of a calyx on top. */
function tomato(): Shape {
  const fruit = lathe(
    [
      [0.02, -0.4],
      [0.3, -0.37],
      [0.47, -0.2],
      [0.5, 0.02],
      [0.43, 0.25],
      [0.2, 0.37],
      [0.02, 0.33],
    ],
    { seg: 10, steps: 1, shape: (a) => 1 - 0.045 * Math.abs(Math.sin(a * 3)) },
  ).paint((_x, y) => {
    const k = 1.0 + 0.08 * smoothstep(0, 0.35, y)
    return [k, k, k]
  }, 1)
  const parts: Shape[] = [fruit]
  for (let k = 0; k < 5; k++) parts.push(around(leaflet(0.28, 0.11, -0.04).fill(CALYX, 0), 0.25, (k / 5) * Math.PI * 2, [0, 0.35, 0]))
  parts.push(tube([[0, 0.33, 0], [0, 0.45, 0.02], [0.02, 0.5, 0.05]], [0.035, 0.03, 0.025], { seg: 4, steps: 1 }).fill(CALYX, 0))
  return merge(...parts)
}

/** A strawberry, hanging from the origin: a heart-shaped berry with seeds, under a ruff of green sepals. */
function strawberry(): Shape {
  const berry = loft(
    [
      { c: [0, -0.06, 0], rx: 0.4, ry: 0.4 },
      { c: [0, -0.3, 0], rx: 0.46, ry: 0.46 },
      { c: [0, -0.6, 0], rx: 0.34, ry: 0.34 },
      { c: [0, -0.85, 0], rx: 0.14, ry: 0.14 },
    ],
    { seg: 8, steps: 2, up: [0, 0, 1], round: [0.06, 0.08] },
  )
  // seeds: little pale specks in a checker over the berry
  berry.paint(() => [1, 1, 1], 1).pattern(checker(8), [1.4, 1.3, 0.6])
  const parts: Shape[] = [berry]
  for (let s = 0; s < 5; s++) parts.push(around(leaflet(0.42, 0.16, 0.05).fill(CALYX, 0), -0.2, (s / 5) * Math.PI * 2, [0, -0.02, 0]))
  parts.push(tube([[0, -0.05, 0], [0, 0.2, 0]], 0.04, { seg: 3, steps: 1 }).fill(CALYX, 0))
  return merge(...parts)
}

/** A carrot's shoulder, just showing above the soil (the rest of the root is underground). */
function carrotTop(): Shape {
  return lathe(
    [
      [0.3, -0.6],
      [0.42, -0.2],
      [0.45, 0.05],
      [0.36, 0.18],
      [0.12, 0.24],
    ],
    { seg: 8, steps: 1 },
  )
    .paint(() => [1, 1, 1], 1)
    .pattern((_x, y) => 0.5 + 0.5 * Math.sin(y * 38), [0.86, 0.86, 0.86])
}

/** A cob of corn in its husk, 1 long along +y: the green husk wrapped round it, opening at the top on kernels
 *  in rows (they ripen with the plant's colour), and the silk spilling out of the tip. */
function cob(): Shape {
  const ear = lathe(
    [
      [0.1, 0.45],
      [0.17, 0.6],
      [0.15, 0.78],
      [0.09, 0.9],
      [0.02, 0.95],
    ],
    { seg: 10, steps: 1 },
  )
  ear.paint(() => [1, 1, 1], 1).pattern(checker(10), [0.82, 0.78, 0.62])
  const husk = lathe(
    [
      [0.03, 0.0],
      [0.16, 0.05],
      [0.22, 0.25],
      [0.21, 0.5],
      [0.16, 0.66],
      [0.13, 0.7],
    ],
    // the husk's leaves: ridges round it, and the edges of the outer leaves
    { seg: 10, steps: 1, shape: (a) => 1 + 0.06 * Math.abs(Math.sin(a * 2.5)) },
  )
    .paint(() => rgb(0x86ad55), 0)
    .pattern((x, _y, z) => 0.5 + 0.6 * Math.sin(Math.atan2(z, x) * 2.5 + 0.4), rgb(0x6e9a45))
  const parts: Shape[] = [ear, husk]
  // the tips of the husk leaves, opening a little round the kernels
  for (let h = 0; h < 3; h++) parts.push(around(leaflet(0.3, 0.16, -0.03).fill(rgb(0x86ad55), 0).place([0, 0, 0], [-Math.PI / 2 + 0.35, 0, 0]), 0, (h / 3) * Math.PI * 2 + 0.3, [0, 0.62, 0]).place([0, 0, 0]))
  for (let s = 0; s < 4; s++) parts.push(tube([[0, 0.9, 0], [Math.cos(s * 1.6) * 0.08, 1.02, Math.sin(s * 1.6) * 0.08], [Math.cos(s * 1.6) * 0.15, 1.06, Math.sin(s * 1.6) * 0.15]], [0.02, 0.015, 0.01], { seg: 3, steps: 1 }).fill(SILK, 0))
  return merge(...parts)
}

/** The corn's tassel: a spray of thin spikes. */
function tassel(): Shape {
  const parts: Shape[] = []
  const r = random(7)
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2
    const out = 0.25 + r() * 0.2
    parts.push(tube([[0, 0, 0], [Math.cos(a) * out * 0.5, 0.5, Math.sin(a) * out * 0.5], [Math.cos(a) * out, 0.85 + r() * 0.15, Math.sin(a) * out]], [0.035, 0.025, 0.012], { seg: 3, steps: 0 }))
  }
  parts.push(tube([[0, 0, 0], [0, 1.1, 0]], [0.04, 0.015], { seg: 4, steps: 1 }))
  return merge(...parts).fill([1, 1, 1], 1)
}

/** An ear of wheat, 1 long along +y: two rows of plump grains in a zig-zag, and short whiskers at the tip. */
function wheatEar(): Shape {
  const ear = loft(
    [
      { c: [0, 0.0, 0], rx: 0.05, ry: 0.05 },
      { c: [0, 0.15, 0], rx: 0.13, ry: 0.09 },
      { c: [0, 0.55, 0], rx: 0.14, ry: 0.1 },
      { c: [0, 0.9, 0], rx: 0.07, ry: 0.06 },
    ],
    // the grains: bumps in two rows, alternating up the ear
    { seg: 6, steps: 3, up: [0, 0, 1], round: [0, 0.06], shape: (a, t) => 1 + 0.28 * Math.max(0, Math.sin(t * Math.PI * 7 + (Math.cos(a) > 0 ? 0 : Math.PI))) * Math.abs(Math.cos(a)) },
  )
  const parts: Shape[] = [ear]
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.5
    parts.push(tube([[Math.cos(a) * 0.05, 0.85, Math.sin(a) * 0.04], [Math.cos(a) * 0.12, 1.2, Math.sin(a) * 0.08]], [0.012, 0.004], { seg: 3, steps: 1 }))
  }
  return merge(...parts).paint((_x, y) => {
    const k = 0.9 + 0.15 * smoothstep(0, 0.6, y)
    return [k, k, k]
  }, 1)
}

/** A plain stem, 1 tall and 1 wide. */
function stem(): Shape {
  return tube(
    [
      [0, 0, 0],
      [0, 1, 0],
    ],
    1,
    { seg: 5, steps: 1, caps: [false, true] },
  ).fill([1, 1, 1], 1)
}

/** A jointed stalk (corn, cane, a bamboo stake), 1 tall and 1 wide: swollen, darker nodes every sixth. */
function stalk(): Shape {
  const node = (t: number) => {
    const f = (t * 6) % 1
    return Math.min(f, 1 - f)
  }
  const s = tube(
    [
      [0, 0, 0],
      [0, 1, 0],
    ],
    1,
    { seg: 6, steps: 12, caps: [false, true], shape: (_a, t) => 1 + 0.14 * Math.exp(-(node(t) ** 2) / 0.002) },
  )
  return s.paint(() => [1, 1, 1], 1).pattern((_x, y) => 0.5 + (0.06 - node(y)) * 14, [0.72, 0.68, 0.55])
}

/** A pumpkin: ten deep ribs, flat on top round a dimple, and a short, twisted stem. */
function pumpkin(): Shape {
  const body = lathe(
    [
      [0.02, -0.66],
      [0.5, -0.62],
      [0.85, -0.42],
      [1.0, -0.08],
      [0.92, 0.3],
      [0.62, 0.55],
      [0.2, 0.6],
      [0.04, 0.5],
    ],
    { seg: 20, steps: 1, shape: (a) => 1 - 0.1 * Math.pow(Math.abs(Math.sin(a * 5)), 0.55) },
  )
  body.paint((x, y, z) => {
    // the creases between the ribs a little darker
    const k = 0.92 + 0.12 * Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 5)), 0.5) - 0.06 * smoothstep(0.3, -0.6, y)
    return [k, k, k]
  }, 1)
  const st = tube(
    [
      [0, 0.45, 0],
      [0.02, 0.65, 0.01],
      [0.08, 0.78, 0.04],
    ],
    [0.09, 0.07, 0.06],
    { seg: 6, steps: 2, caps: [false, true], shape: (a) => 1 - 0.12 * Math.abs(Math.sin(a * 3)) },
  ).fill(STEM_BROWN, 0)
  return merge(body, st)
}

/** A lemon: an oval with a nub at each end. */
function lemon(): Shape {
  return lathe(
    [
      [0.02, -0.62],
      [0.12, -0.54],
      [0.36, -0.42],
      [0.48, -0.15],
      [0.5, 0.05],
      [0.46, 0.3],
      [0.3, 0.48],
      [0.1, 0.56],
      [0.02, 0.62],
    ],
    { seg: 12, steps: 1 },
  ).paint(() => [1, 1, 1], 1)
}

/** An egg, its pointed end up. */
function egg(): Shape {
  return lathe(
    [
      [0.02, -0.5],
      [0.3, -0.44],
      [0.48, -0.22],
      [0.5, 0.02],
      [0.42, 0.3],
      [0.24, 0.5],
      [0.02, 0.56],
    ],
    { seg: 12, steps: 1 },
  ).paint(() => [1, 1, 1], 1)
}

const LEAF: SculptMaterialOptions = { roughness: 0.62, doubleSided: true, leaf: true }
const FRUIT: SculptMaterialOptions = { roughness: 0.36 }

/** Every kind of garden part, its material and how many can be drawn at once. */
const KINDS = {
  lettuceLeaf: { make: lettuceLeaf, max: 900, material: LEAF },
  lettuceHeart: { make: lettuceHeart, max: 160, material: { roughness: 0.55 } },
  grassBlade: { make: grassBlade, max: 900, material: LEAF },
  frond: { make: frond, max: 400, material: LEAF },
  trefoil: { make: trefoil, max: 500, material: LEAF },
  tomatoLeaf: { make: tomatoLeaf, max: 400, material: LEAF },
  pumpkinLeaf: { make: pumpkinLeaf, max: 160, material: { roughness: 0.7, doubleSided: true, leaf: true } },
  tomato: { make: tomato, max: 260, material: FRUIT },
  strawberry: { make: strawberry, max: 260, material: FRUIT },
  carrotTop: { make: carrotTop, max: 160, material: { roughness: 0.6 } },
  cob: { make: cob, max: 120, material: { roughness: 0.55 } },
  tassel: { make: tassel, max: 80, material: { roughness: 0.7 } },
  wheatEar: { make: wheatEar, max: 400, material: { roughness: 0.65 } },
  stem: { make: stem, max: 400, material: { roughness: 0.7 } },
  stalk: { make: stalk, max: 400, material: { roughness: 0.6 } },
  pumpkin: { make: pumpkin, max: 40, material: { roughness: 0.5 } },
  lemon: { make: lemon, max: 16, material: { roughness: 0.42 } },
  egg: { make: egg, max: 12, material: { roughness: 0.5 } },
} satisfies Record<string, { make: () => Shape; max: number; material: SculptMaterialOptions }>

export type CropPart = keyof typeof KINDS

let made: Record<CropPart, BufferGeometry> | null = null

export function cropGeometries(): Record<CropPart, BufferGeometry> {
  if (!made) {
    const out = {} as Record<CropPart, BufferGeometry>
    for (const k of Object.keys(KINDS) as CropPart[]) out[k] = KINDS[k].make().geometry()
    made = out
  }
  return made
}

/** Instanced draws for the whole garden (each kind as many times as `KINDS` allows, times `scale`). */
export function cropParts(scale = 1): Parts<CropPart> {
  const g = cropGeometries()
  const defs = {} as Record<CropPart, PartDef>
  for (const k of Object.keys(KINDS) as CropPart[]) defs[k] = { geometry: g[k], max: Math.ceil(KINDS[k].max * scale), material: KINDS[k].material }
  return new Parts<CropPart>(defs, 'crops')
}

export const LEAF_GREEN = GREEN
export type { V3 }
