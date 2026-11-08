import { blob, fbm3, lathe, loft, merge, noise3, Parts, piecesOf, random, rgb, Shape, smoothstep, squircle, tube, type SculptMaterialOptions, type V3 } from '../lib/sculpt'

// The farm's buildings and fittings, sculpted with the kit: built once, in their own frame (the ground under their
// middle at the origin), each drawn as a handful of parts — one per material. They are checked like the animals
// (src/models/checks.ts): every piece holds on to the rest and the whole stands on the ground.
//
//   oven     a wood-fired clay oven on a stone plinth: an arched mouth (facing −x) with brick voussoirs and a
//            glowing hearth inside, a chimney pot, a stack of firewood behind and a peel leaning on the plinth
//   trough   a water trough of boards (along z), with water in it
//   coop     a hen house on legs, plank walls, a shingled roof, a ramp and a pop-hole
//   lemon    a lemon tree: a trunk forking into three limbs, a crown of leafy lumps; the lemons (crops.ts) hang
//            under it from stalks that reach up into the leaves (lemonSpots)

export interface StructurePart {
  shape: Shape
  material?: SculptMaterialOptions
  castShadow?: boolean
  /** off for the insides of things (the sun's shadow map would stripe them), which are shaded dark anyway */
  receiveShadow?: boolean
}
export type Structure<K extends string = string> = Record<K, StructurePart>

/** The pieces of a structure, for the kit's checks (src/lib/sculpt/check.ts). */
export const structurePieces = (s: Structure) => Object.entries(s).flatMap(([k, p]) => piecesOf(k, p.shape.geometry()))

/** A structure drawn with the kit: one instanced draw per part, put once where it stands. */
export function structureParts<K extends string>(s: Structure<K>, name: string): Parts<K> {
  const defs = {} as Record<K, { geometry: ReturnType<Shape['geometry']>; max: number; material?: SculptMaterialOptions; castShadow?: boolean; receiveShadow?: boolean }>
  for (const k of Object.keys(s) as K[]) defs[k] = { geometry: s[k].shape.geometry(), max: 1, material: s[k].material, castShadow: s[k].castShadow ?? true, receiveShadow: s[k].receiveShadow ?? true }
  const parts = new Parts<K>(defs, name)
  putStructure(parts)
  return parts
}

/** Puts every part of a structure at its own origin (the structure's frame). */
export function putStructure<K extends string>(parts: Parts<K>) {
  parts.begin()
  parts.at(0, 0, 0)
  for (const k of Object.keys(parts.meshes) as K[]) parts.put(k, 0, 0, 0)
  parts.end()
}

// ───────────────────────────── colours ─────────────────────────────

const CLAY = rgb(0xb8653e)
const CLAY_LIGHT = rgb(0xd08a5c)
const SOOT = rgb(0x2a201c)
const BRICK = rgb(0x9a4630)
const MORTAR = rgb(0xd9cbb4)
const STONE = rgb(0x9c958a)
const STONE_DARK = rgb(0x77716a)
const WOOD = rgb(0x8a6440)
const WOOD_DARK = rgb(0x5e4630)
const END_GRAIN = rgb(0xd6b07a)
const BARK = rgb(0x5a4434)

const mix = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** A box with soft edges: a squared loft along y, from y0 to y1, half-sizes hx (x) and hz (z). */
function slab(hx: number, hz: number, y0: number, y1: number, soft = 5, seg = 20): Shape {
  const s = loft(
    [
      { c: [0, y0, 0], rx: hx, ry: hz },
      { c: [0, y1, 0], rx: hx, ry: hz },
    ],
    { seg, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, soft), caps: [true, true] },
  )
  return s
}

/** A log lying along z: bark round it, light end grain with rings at both ends. */
function log(radius: number, length: number, seed: number): Shape {
  const s = loft(
    [
      { c: [0, 0, -length / 2], rx: radius, ry: radius },
      { c: [0, 0, length / 2], rx: radius, ry: radius },
    ],
    { seg: 10, steps: 1, caps: [true, true] },
  )
  return s.paint((x, y, z) => {
    const end = Math.abs(Math.abs(z) - length / 2) < 0.002
    if (!end) return mix(BARK, WOOD_DARK, 0.3 + 0.4 * noise3(x * 30, y * 30, z * 6, seed))
    // the cut end: pale wood, darker towards the bark
    const d = Math.hypot(x, y) / radius
    return mix(END_GRAIN, WOOD, smoothstep(0.55, 1, d))
  }, 0)
}

/** A stack of logs (along z) in rows, each row resting in the grooves of the one under it: bottom row first,
 *  centres across x. The rows sit a little into each other, so the stack holds together. */
function woodpile(rows: { xs: number[]; r: number }[], length: number, seed: number): Shape {
  const logs: Shape[] = []
  let y = 0
  rows.forEach((row, k) => {
    if (k === 0) y = row.r - 0.004
    else {
      // resting on two logs below, each half a spacing away
      const below = rows[k - 1]
      const dx = Math.abs(row.xs[0] - below.xs[0])
      y += Math.sqrt(Math.max(0, (row.r + below.r - 0.012) ** 2 - dx * dx))
    }
    row.xs.forEach((x) => logs.push(log(row.r, length, seed++).place([x, y, 0])))
  })
  return merge(...logs)
}

// ───────────────────────────── the oven ─────────────────────────────

/** The oven's mouth (an arch, facing −x): spring line, half-width, where its floor (the hearth) is and how deep
 *  it goes. */
export const OVEN_MOUTH = { y: 0.9, half: 0.19, floor: 0.75, depth: -0.3 } as const
const MOUTH_FACE = 0.29 // the vault's outer half-width: the bricks fill the face between it and the opening
const MOUTH_FRONT = -0.76 // how far the vault comes out of the dome
const DOME = { base: 0.72, r: 0.6, top: 1.28 } as const

/** An arch-shaped ring's radius multiplier (for a loft along x, `up` +y): a half circle above the spring line,
 *  straight sides down to a flat floor `below` under it. */
const archRing = (below: number) => (a: number) => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  if (s >= 0) return 1
  return Math.min(1 / Math.max(1e-3, Math.abs(c)), below / Math.max(1e-3, Math.abs(s)))
}

export type OvenPart = 'plinth' | 'dome' | 'mouth' | 'arch' | 'chimney' | 'wood' | 'peel'

export function ovenModel(): Structure<OvenPart> {
  const { y: sy, half, floor } = OVEN_MOUTH

  // the plinth: courses of rough stone, a little wider at the foot, a lip under the dome (a ring at every joint,
  // so the joints run straight)
  const joints = [0.18, 0.36, 0.54]
  const ys = [0, 0.06, ...joints.flatMap((j) => [j - 0.014, j - 0.006, j + 0.006, j + 0.014]), 0.62, 0.67, DOME.base + 0.02]
  const width = (y: number) => (y < 0.06 ? 0.69 - y * 0.33 : y < 0.62 ? 0.67 - (y - 0.06) * 0.045 : y < 0.67 ? 0.665 : 0.655)
  const plinth = loft(
    ys.map((y) => ({ c: [0, y, 0] as V3, rx: width(y), ry: width(y) - 0.06 })),
    { seg: 28, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, 5), caps: [true, true] },
  )
    .displace((x, y, z) => 0.005 * (fbm3(x * 9, y * 9, z * 9, 3) - 0.5))
    .paint((x, y, z) => {
      // each course its own stone, and the stone mottled
      const course = Math.floor(y / 0.18)
      const tone = 0.88 + 0.16 * noise3(course * 3.1, 0.5, 0.2, 9)
      const c = mix(STONE, STONE_DARK, smoothstep(0.35, 0.75, fbm3(x * 5, y * 5, z * 5, 7)))
      return [c[0] * tone, c[1] * tone, c[2] * tone]
    }, 0)
    .pattern((_x, y) => (joints.some((j) => Math.abs(y - j) < 0.01) ? 1 : 0), MORTAR)
    .shade((_x, y) => 0.82 + 0.18 * smoothstep(0, 0.25, y))

  // the dome: hand-laid clay, rough to the touch, sooty above the mouth; the mouth's hole cut out of it
  const dome = lathe(
    [
      [DOME.r, DOME.base],
      [DOME.r + 0.012, DOME.base + 0.08],
      [DOME.r, 0.9],
      [0.565, 1.01],
      [0.48, 1.12],
      [0.355, 1.2],
      [0.19, 1.255],
      [0.0, DOME.top],
    ],
    { seg: 30, steps: 3 },
  )
    .displace((x, y, z) => 0.01 * (fbm3(x * 7, y * 7, z * 7, 11) - 0.5))
    .paint((x, y, z) => mix(CLAY, CLAY_LIGHT, smoothstep(0.35, 0.8, fbm3(x * 4, y * 6, z * 4, 5))), 0)
    // smoke from the mouth darkens the clay over it
    .blend(SOOT, (x, y, z) => smoothstep(-0.3, -0.58, x) * smoothstep(0.0, 0.25, half + 0.22 - Math.abs(z) + (y - sy) * 0.3) * smoothstep(sy + 0.2, sy + 0.36, y) * 0.65)

  // the mouth: a vaulted entry out of the dome's front — clay outside, a face of mortar for the bricks, sooty
  // inside and open at the back (the fire's glow is drawn there). Three pieces, each a loft running one way.
  const outer = MOUTH_FACE
  const front = MOUTH_FRONT
  const belowIn = (sy - floor) / half
  const belowOut = (sy - (DOME.base + 0.02)) / outer
  const SEG = 24
  const tunnel = loft(
    [
      { c: [front, sy, 0], rx: half, ry: half },
      { c: [OVEN_MOUTH.depth, sy, 0], rx: half, ry: half },
    ],
    { seg: SEG, steps: 1, up: [0, 1, 0], shape: archRing(belowIn) },
  )
    .paint(() => SOOT, 0)
    .shade((x) => 0.5 + 0.5 * smoothstep(-0.35, front, x))
  const vault = loft(
    [
      { c: [front, sy, 0], rx: outer, ry: outer },
      { c: [-0.42, sy, 0], rx: outer, ry: outer },
    ],
    { seg: SEG, steps: 1, up: [0, 1, 0], shape: archRing(belowOut) },
  ).paint((x, y, z) => mix(CLAY, CLAY_LIGHT, 0.25 + 0.3 * fbm3(x * 5, y * 5, z * 5, 13)), 0)
  // the face round the opening, between the two arches (the same angles as the lofts', so the edges meet)
  const face = new Shape()
  for (let k = 0; k < SEG; k++) {
    const a = (k / SEG) * Math.PI * 2
    const ri = half * archRing(belowIn)(a)
    const ro = outer * archRing(belowOut)(a)
    face.vertex(front, sy + Math.sin(a) * ri, Math.cos(a) * ri, MORTAR, 0)
    face.vertex(front, sy + Math.sin(a) * ro, Math.cos(a) * ro, MORTAR, 0)
  }
  for (let k = 0; k < SEG; k++) {
    const i0 = 2 * k
    const i1 = 2 * ((k + 1) % SEG)
    face.tri(i0, i0 + 1, i1 + 1)
    face.tri(i0, i1 + 1, i1)
  }
  const mouth = merge(tunnel, vault, face)

  // brick voussoirs round the arch on that face, and a jamb of bricks down each side
  const bricks: Shape[] = []
  const brick = (y: number, z: number, along: number, hz: number, hy: number, seed: number) => {
    const r = random(seed)
    const hx = 0.03
    const b = loft(
      [
        { c: [0, -hy, 0], rx: hz, ry: hx },
        { c: [0, hy, 0], rx: hz, ry: hx },
      ],
      { seg: 8, steps: 1, up: [1, 0, 0], shape: (a) => squircle(a, 6), caps: [true, true] },
    )
    const tone = 0.85 + r() * 0.25
    b.paint(() => [BRICK[0] * tone, BRICK[1] * tone, BRICK[2] * tone], 0)
    // a centimetre proud of the face, the rest of it in
    return b.place([front - 0.01 + hx - 0.02, y, z], [along, 0, 0])
  }
  const mid = (half + outer) / 2
  const n = 7
  for (let k = 0; k < n; k++) {
    const a = (k / (n - 1)) * Math.PI // right to left over the top
    // each brick points at the arch's centre: its long side along the radius
    bricks.push(brick(sy + Math.sin(a) * mid, Math.cos(a) * mid, Math.PI / 2 - a, 0.044, (outer - half) / 2 - 0.004, 20 + k))
  }
  for (const side of [-1, 1]) for (let k = 0; k < 2; k++) bricks.push(brick(floor + 0.037 + k * 0.074, side * mid, 0, (outer - half) / 2 - 0.004, 0.033, 40 + k + side * 3))
  const arch = merge(...bricks)

  // the chimney pot, through the dome towards the back
  const chimney = lathe(
    [
      [0.07, 1.1],
      [0.08, 1.3],
      [0.074, 1.42],
      [0.092, 1.45],
      [0.092, 1.5],
      [0.062, 1.5],
      [0.06, 1.44],
    ],
    { seg: 14, steps: 1 },
  )
    .paint((_x, y) => mix(CLAY, SOOT, smoothstep(1.36, 1.5, y) * 0.8), 0)
    .place([0.24, 0, 0])

  // firewood stacked behind the oven: three, two and one
  const wood = woodpile(
    [
      { xs: [0.77, 0.915, 1.06], r: 0.074 },
      { xs: [0.8425, 0.9875], r: 0.07 },
      { xs: [0.915], r: 0.066 },
    ],
    0.82,
    60,
  )

  // the peel: its paddle on the ground, the handle leaning on the plinth's front
  const foot: V3 = [-0.97, 0, 0.36]
  const rest: V3 = [-0.635, 0.62, 0.36]
  const lean = Math.atan2(rest[0] - foot[0], rest[1] - foot[1])
  const L = Math.hypot(rest[0] - foot[0], rest[1] - foot[1])
  const paddle = loft(
    [
      { c: [0, 0, 0], rx: 0.12, ry: 0.009 },
      { c: [0, 0.16, 0], rx: 0.14, ry: 0.011 },
      { c: [0, 0.28, 0], rx: 0.045, ry: 0.014 },
    ],
    { seg: 10, steps: 2, up: [1, 0, 0], shape: (a) => squircle(a, 4), caps: [true, true] },
  )
  const handle = tube(
    [
      [0, 0.25, 0],
      [0, L + 0.025, 0],
    ],
    0.016,
    { seg: 7, caps: [true, true] },
  )
  const peel = merge(paddle, handle)
    .paint((_x, y) => mix(WOOD, WOOD_DARK, smoothstep(0.3, 0.0, y) * 0.35), 0)
    .place([0, 0, 0], [0, 0, -lean])
    .place(foot)

  return {
    plinth: { shape: plinth, material: { roughness: 0.95 } },
    dome: { shape: dome, material: { roughness: 0.9 } },
    mouth: { shape: mouth, material: { roughness: 0.95, doubleSided: true }, receiveShadow: false },
    arch: { shape: arch, material: { roughness: 0.85 } },
    chimney: { shape: chimney, material: { roughness: 0.85 } },
    wood: { shape: wood, material: { roughness: 0.9 } },
    peel: { shape: peel, material: { roughness: 0.8 } },
  }
}

// ───────────────────────────── troughs ─────────────────────────────

/** Wood with a grain along one axis: streaks of a darker brown. */
const grain =
  (axis: 0 | 1 | 2, seed: number) =>
  (x: number, y: number, z: number): V3 => {
    const p = [x, y, z]
    const across = axis === 0 ? y * 40 + z * 23 : axis === 1 ? x * 40 + z * 23 : x * 40 + y * 23
    const k = 0.5 + 0.5 * noise3(across, p[axis] * 2.5, 0.3, seed)
    return mix(WOOD, WOOD_DARK, 0.15 + 0.45 * k)
  }

export type TroughPart = 'boards' | 'water'

/** A water trough of boards, `length` along z, `width` across, `height` tall; water a few centimetres under the rim. */
export function troughModel(length: number, width: number, height: number): Structure<TroughPart> {
  const t = 0.035 // board thickness
  const hl = length / 2
  const hw = width / 2
  const board = (hx: number, hz: number, y0: number, y1: number, at: V3) => slab(hx, hz, y0, y1, 8, 12).place(at)
  const boards = merge(
    // the bottom, on two sleepers
    board(hw, hl, 0.06, 0.06 + t, [0, 0, 0]),
    board(hw + 0.02, 0.04, 0, 0.065, [0, 0, -hl + 0.12]),
    board(hw + 0.02, 0.04, 0, 0.065, [0, 0, hl - 0.12]),
    // the sides and the ends
    board(t / 2, hl, 0.06, height, [-hw + t / 2, 0, 0]),
    board(t / 2, hl, 0.06, height, [hw - t / 2, 0, 0]),
    board(hw - t, t / 2, 0.06, height, [0, 0, -hl + t / 2]),
    board(hw - t, t / 2, 0.06, height, [0, 0, hl - t / 2]),
  ).paint(grain(2, 17), 0)
  const water = slab(hw - t + 0.002, hl - t + 0.002, 0.06 + t, height - 0.035, 16, 24).paint(() => rgb(0x3d6f8a), 0)
  return {
    boards: { shape: boards, material: { roughness: 0.85 } },
    water: { shape: water, material: { roughness: 0.06, metalness: 0.1 }, castShadow: false },
  }
}

// ───────────────────────────── the coop ─────────────────────────────

const BARN_RED = rgb(0xb5523a)
const BATTEN = rgb(0x8d3f2c)
const TRIM = rgb(0xe9e2d2)
const SHINGLE = rgb(0x46494c)
const DARK = rgb(0x2a1d16)

export type CoopPart = 'frame' | 'walls' | 'roof' | 'trim'

/** The hen house: on four legs, red board-and-batten walls with white corners, a shingled roof (its ridge along x),
 *  an arched pop-hole in the south wall (+z) with a slatted ramp down to the run. */
export function coopModel(): Structure<CoopPart> {
  const W = 0.65 // half-width (x)
  const D = 0.5 // half-depth (z)
  const y0 = 0.49 // the floor
  const y1 = 1.27 // the eaves
  const ridge = 1.62
  const eave: V3 = [0, 1.25, D + 0.09]

  // legs and the ramp: weathered wood
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => slab(0.035, 0.035, 0, y0 + 0.04, 6, 8).place([sx * (W - 0.07), 0, sz * (D - 0.07)])))
  const door = { x: 0.3, y: 0.6, half: 0.12 }
  const rampTop: V3 = [door.x, y0 + 0.02, D + 0.01]
  const rampFoot: V3 = [door.x, 0.0, D + 0.66]
  const rampLen = Math.hypot(rampFoot[1] - rampTop[1], rampFoot[2] - rampTop[2])
  const tilt = Math.atan2(rampTop[1] - rampFoot[1], rampFoot[2] - rampTop[2])
  const ramp = merge(slab(0.16, rampLen / 2, -0.012, 0.012, 10, 20), ...[0.2, 0.4, 0.6, 0.8].map((f) => slab(0.15, 0.012, 0.0, 0.03, 6, 8).place([0, 0, -rampLen / 2 + f * rampLen])))
    .place([0, 0, 0], [tilt, 0, 0])
    .place([(rampTop[0] + rampFoot[0]) / 2, (rampTop[1] + rampFoot[1]) / 2 + 0.012, (rampTop[2] + rampFoot[2]) / 2])
  const frame = merge(...legs, ramp).paint(grain(1, 23), 0)

  // the walls: a red box, with battens down the long walls and a gable at each end
  const box = slab(W, D, y0, y1, 9, 28).paint(() => BARN_RED, 0)
  const battens: Shape[] = []
  for (const sz of [-1, 1])
    for (const x of [-0.42, -0.14, 0.14, 0.42]) if (!(sz > 0 && Math.abs(x - door.x) < 0.2)) battens.push(slab(0.022, 0.012, y0 + 0.02, y1 - 0.01, 6, 8).place([x, 0, sz * (D + 0.006)]))
  for (const sx of [-1, 1]) for (const z of [-0.2, 0.2]) battens.push(slab(0.012, 0.022, y0 + 0.02, y1 - 0.01, 6, 8).place([sx * (W + 0.006), 0, z]))
  const gables = new Shape()
  for (const sx of [-1, 1]) {
    const a = gables.vertex(sx * W, y1 - 0.03, -D - 0.02, BARN_RED, 0)
    const b = gables.vertex(sx * W, y1 - 0.03, D + 0.02, BARN_RED, 0)
    const c = gables.vertex(sx * W, ridge + 0.02, 0, BARN_RED, 0)
    gables.tri(a, b, c)
    gables.tri(a, c, b)
  }
  const walls = merge(
    box,
    merge(...battens).paint(() => BATTEN, 0),
    gables,
  )

  // the roof: two slopes of overlapping shingle rows meeting at the ridge, a cap along it
  const slope = (side: 1 | -1) => {
    const top: V3 = [0, ridge, 0]
    const bottom: V3 = [0, eave[1], side * eave[2]]
    const len = Math.hypot(bottom[1] - top[1], bottom[2] - top[2])
    const dir = [0, (bottom[1] - top[1]) / len, (bottom[2] - top[2]) / len]
    const up: V3 = [0, -dir[2] * side * -1, dir[1] * side * -1]
    const rows = 5
    const rings = []
    for (let k = 0; k < rows; k++) {
      const a = (k / rows) * len
      const b = ((k + 1) / rows) * len - 0.002
      for (const [d, th] of [
        [a + 0.001, 0.014],
        [b, 0.032],
      ] as [number, number][])
        rings.push({ c: [0, top[1] + dir[1] * d, top[2] + dir[2] * d] as V3, rx: W + 0.1, ry: th })
    }
    const r = random(side > 0 ? 3 : 4)
    const tones = Array.from({ length: rows }, () => 0.85 + r() * 0.3)
    return loft(rings, { seg: 8, steps: 1, up: [0, Math.abs(up[1]), up[2]], shape: (a) => squircle(a, 8), caps: [true, true] }).paint((_x, y, z) => {
      const along = Math.hypot(y - top[1], z - top[2]) / len
      const tone = tones[Math.min(rows - 1, Math.floor(along * rows))]
      return [SHINGLE[0] * tone, SHINGLE[1] * tone, SHINGLE[2] * tone]
    }, 0)
  }
  const cap = tube(
    [
      [-W - 0.1, ridge + 0.01, 0],
      [W + 0.1, ridge + 0.01, 0],
    ],
    0.034,
    { seg: 8, caps: [true, true] },
  ).paint(() => mix(SHINGLE, rgb(0x2c2e30), 0.6), 0)
  const roof = merge(slope(1), slope(-1), cap)

  // white corner boards, and the pop-hole: a white arch round a dark opening
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => slab(0.035, 0.035, y0 - 0.005, y1 + 0.005, 6, 8).place([sx * (W - 0.02), 0, sz * (D - 0.02)])))
  const arch = (half: number, z: number, depth: number, color: V3) =>
    loft(
      [
        { c: [door.x, door.y + 0.1, z], rx: half, ry: half },
        { c: [door.x, door.y + 0.1, z + depth], rx: half, ry: half },
      ],
      { seg: 16, steps: 1, up: [0, 1, 0], shape: archRing(0.1 / half + 0.62), caps: [false, true] },
    ).paint(() => color, 0)
  const trim = merge(
    merge(...corners).paint(() => TRIM, 0),
    arch(door.half + 0.035, D - 0.01, 0.022, TRIM),
    arch(door.half, D - 0.005, 0.024, DARK),
  )

  return {
    frame: { shape: frame, material: { roughness: 0.9 } },
    walls: { shape: walls, material: { roughness: 0.8, doubleSided: false } },
    roof: { shape: roof, material: { roughness: 0.7 } },
    trim: { shape: trim, material: { roughness: 0.75 } },
  }
}

// ───────────────────────────── the lemon tree ─────────────────────────────

/** The crown's lumps of leaves: where each is and how big (the trunk at the origin). */
const CROWN: { at: V3; r: number; seed: number }[] = [
  { at: [0, 2.05, 0], r: 0.85, seed: 1 },
  { at: [0.45, 1.75, 0.25], r: 0.62, seed: 2 },
  { at: [-0.4, 1.8, -0.3], r: 0.58, seed: 3 },
  { at: [-0.2, 2.45, 0.35], r: 0.55, seed: 4 },
]
const LEAF_GREEN = rgb(0x3f6a35)
const LEAF_LIGHT = rgb(0x5a8a44)

let crownShape: Shape | null = null
/** The crown (made once: the tree draws it, and the lemons are hung from its underside). */
function crown(): Shape {
  if (crownShape) return crownShape
  const lumps = CROWN.map((c) =>
    blob(c.r, 3, (x, y, z) => 0.1 * (fbm3(x * 3.2 + c.seed, y * 3.2, z * 3.2, c.seed) - 0.5) + 0.035 * Math.sin(x * 11 + y * 9 + c.seed)).place(c.at, [0, c.seed, 0], [1, 0.86, 1]),
  )
  crownShape = merge(...lumps)
    .paint((x, y, z) => mix(LEAF_GREEN, LEAF_LIGHT, smoothstep(0.3, 0.75, fbm3(x * 2.5, y * 2.5, z * 2.5, 21))), 0)
    // the sun-lit top a little lighter, deep under the crown darker
    .shade((_x, y) => 0.86 + 0.22 * smoothstep(1.4, 2.6, y))
  return crownShape
}

export type LemonTreePart = 'wood' | 'crown'

export function lemonTreeModel(): Structure<LemonTreePart> {
  const trunk = tube(
    [
      [0, -0.02, 0],
      [0.02, 0.7, 0.01],
      [0.05, 1.42, 0.02],
    ],
    [0.13, 0.095, 0.075],
    { seg: 10, steps: 2, caps: [true, false] },
  )
  // three limbs from the top of the trunk, reaching into the crown
  const limb = (from: V3, mid: V3, to: V3, r: number) => tube([from, mid, to], [r, r * 0.8, r * 0.6], { seg: 7, steps: 2, round: [0, 0.03] })
  const wood = merge(
    trunk,
    limb([0.03, 1.15, 0.01], [0.25, 1.45, 0.08], [0.42, 1.7, 0.2], 0.05),
    limb([0.03, 1.25, 0.0], [-0.2, 1.5, -0.15], [-0.36, 1.74, -0.28], 0.046),
    limb([0.05, 1.36, 0.02], [-0.06, 1.85, 0.18], [-0.16, 2.3, 0.3], 0.044),
  ).paint((x, y, z) => mix(BARK, rgb(0x7a6450), 0.35 + 0.4 * noise3(x * 20, y * 6, z * 20, 31)), 0)
  return {
    wood: { shape: wood, material: { roughness: 0.95 } },
    crown: { shape: crown(), material: { roughness: 0.85, detail: { scale: 9, bump: 0.3, shade: 0.1 } } },
  }
}

/** Where the lemons hang (each stalk's end, a few centimetres up into the leaves, round the crown's underside):
 *  found by looking straight up from under the crown, so a lemon always holds on to it. */
export function lemonSpots(n: number): V3[] {
  const c = crown()
  const out: V3[] = []
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.4
    const r = 0.62 + (k % 3) * 0.07
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const hit = c.raycast([x, 0.3, z], [0, 1, 0])
    out.push([x, hit ? hit.point[1] + 0.035 : 1.7, z])
  }
  return out
}

/** The hearth's glow, seen through the mouth: an arch-shaped patch at the back of the tunnel (its own material, so
 *  it can flicker). Made as plain positions for a mesh of its own. */
export function mouthGlowShape(): Shape {
  const { y: sy, half, floor, depth } = OVEN_MOUTH
  return loft(
    [
      { c: [depth - 0.01, sy, 0], rx: half * 0.95, ry: half * 0.95 },
      { c: [depth - 0.02, sy, 0], rx: half * 0.95, ry: half * 0.95 },
    ],
    { seg: 20, steps: 1, up: [0, 1, 0], shape: archRing((sy - floor) / (half * 0.95)), caps: [true, false] },
  ).fill([1, 1, 1], 0)
}
