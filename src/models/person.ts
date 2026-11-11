import { BufferAttribute, Color, Group, Object3D, type BufferGeometry } from 'three'
import { blob, ellipsoid, fbm3, lathe, loft, merge, Parts, rgb, shadowPart, smoothstep, squircle, tube, type PartDef, type Shape, type V3 } from '../lib/sculpt'

// A person, in the proportions of the player's own body (1 m of "height" units: the rig scales them to each
// person's height). Each part is built round the joint it hangs from — hips, shoulder, elbow, hip joint, knee,
// neck — and takes its colour from the person through the tint mask: shirts, trousers, skin and hair are painted
// white and coloured per person, so a crowd shares one set of geometry; a hat (the straw hat's band, a cap, a
// beanie) takes the person's hat colour the same way, and the irises the head's second colour, the eyes'. Brows,
// mouth, shoes, the straw and the basket keep their own colours.

/** Where the joints are, in the rig's units (the hips are at 0.885 above the ground, the rest relative to them). */
export const PERSON = {
  hipsY: 0.885,
  hipX: 0.09,
  kneeY: -0.42,
  shoulder: [0.215, 0.5] as [number, number],
  elbowY: -0.29,
  headY: 0.79,
}

/** the eyes' colour when a look has none of its own (as every person had before looks had eyes) */
export const EYES = '#1b1714'
const PUPIL = rgb(0x0e0b0a)
const WHITE = rgb(0xf2eee8)
const BROW = rgb(0x3a2a22)
const LIPS = rgb(0x9a5a50)
const SHOE = rgb(0x2a2522)
const SOLE = rgb(0x5a4a3e)
const STRAW = rgb(0xd9c18a)
const STRAW_DARK = rgb(0xb89a5c)
const TIE = rgb(0x7a2635)
const WICKER = rgb(0xb88a52)
const WICKER_DARK = rgb(0x8a6236)

/** A vertical loft (rings along y, ry front to back). */
const column = (rings: [number, number, number, number?][], o: { seg?: number; steps?: number; round?: [number, number]; shape?: (a: number, t: number) => number; caps?: [boolean, boolean] } = {}) =>
  loft(
    rings.map(([y, rx, ry, z]) => ({ c: [0, y, z ?? 0] as V3, rx, ry })),
    { seg: o.seg ?? 8, steps: o.steps ?? 1, up: [0, 0, 1], round: o.round, shape: o.shape, caps: o.caps },
  )

/** Hips: the seat of the trousers, up to the waist (under the shirt). */
function pelvis(): Shape {
  return column(
    [
      [-0.07, 0.12, 0.085],
      [-0.03, 0.16, 0.105],
      [0.05, 0.166, 0.11],
      [0.12, 0.152, 0.102],
    ],
    { seg: 12, round: [0.03, 0], shape: (a) => squircle(a, 2.4) },
  ).shade((_x, y) => 0.85 + 0.15 * smoothstep(-0.1, 0.05, y))
}

/** The shirt: from the waist to the shoulders, a fuller chest, square shoulders. */
function torso(): Shape {
  return column(
    [
      [0.03, 0.15, 0.1, 0.0],
      [0.18, 0.156, 0.102, 0.002],
      [0.32, 0.172, 0.112, 0.006],
      [0.45, 0.19, 0.112, 0.0],
      [0.53, 0.2, 0.098, -0.005],
      [0.585, 0.12, 0.075, -0.01],
    ],
    {
      seg: 12,
      round: [0, 0.035],
      shape: (a, t) => squircle(a, 2.5 + t) * (1 + 0.04 * Math.max(0, Math.sin(a)) * Math.sin(Math.PI * t)),
    },
  )
    .shade((_x, y) => 0.86 + 0.14 * smoothstep(0.0, 0.3, y))
    .pattern((_x, y) => 0.5 + (0.06 - y) * 40, [0.82, 0.82, 0.82]) // a hem along the bottom
}

/** The sleeve: shoulder (at the origin) to the elbow. */
function upperArm(): Shape {
  return column(
    [
      [0.0, 0.058, 0.06],
      [-0.06, 0.06, 0.062],
      [-0.17, 0.054, 0.056],
      [-0.28, 0.054, 0.056],
    ],
    // closed at the elbow round the arm: the forearm comes out of it in every pose
    { seg: 8, round: [0.035, 0.035] },
  ).shade((_x, y) => 0.9 + 0.1 * smoothstep(-0.25, 0, y))
}

/** Forearm and hand, from the elbow (at the origin); `side` 1 is the left arm (+x), −1 the right. */
function forearm(side: 1 | -1, basket: boolean): Shape {
  // forearm, wrist and hand in one piece, the hand flatter and wider, closing round the fingertips
  const arm = column(
    [
      [0.02, 0.043, 0.043],
      [-0.1, 0.04, 0.042],
      [-0.2, 0.031, 0.029],
      [-0.235, 0.031, 0.025],
      [-0.27, 0.042, 0.023],
      [-0.3, 0.045, 0.024],
      [-0.335, 0.038, 0.02],
    ],
    { seg: 8, round: [0, 0.03] },
  )
  const thumb = tube(
    [
      [-side * 0.026, -0.255, 0.01],
      [-side * 0.034, -0.285, 0.024],
      [-side * 0.032, -0.31, 0.03],
    ],
    [0.012, 0.01, 0.008],
    { seg: 6, steps: 1, caps: [false, true], round: [0.008, 0] },
  )
  const parts: Shape[] = [merge(arm, thumb).shade((_x, y) => 0.92 + 0.08 * smoothstep(-0.3, 0, y))]
  if (basket) {
    // a wicker basket hanging from the hand: woven sides, a rim and a handle through the hand
    const body = lathe(
      [
        [0.085, -0.49],
        [0.1, -0.485],
        [0.115, -0.43],
        [0.122, -0.37],
        [0.13, -0.355],
        // over the rim and down the inside to its floor
        [0.118, -0.358],
        [0.106, -0.43],
        [0.09, -0.475],
        [0.0, -0.475],
      ],
      { seg: 12, steps: 2, caps: [true, false] },
    )
    // woven bands round the sides
    body.paint(() => WICKER, 0).pattern((_x, y) => 0.5 + 0.6 * Math.sin(y * 130), WICKER_DARK)
    const rim = tube(
      Array.from({ length: 17 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2
        return [Math.cos(a) * 0.13, -0.355, 0.02 + Math.sin(a) * 0.13] as V3
      }),
      0.012,
      // round on itself: its two ends meet, each closed
      { seg: 4, steps: 1, caps: [true, true] },
    ).fill(WICKER_DARK, 0)
    const handle = tube(
      Array.from({ length: 7 }, (_, k) => {
        const a = (k / 6) * Math.PI
        return [Math.cos(a) * 0.125, -0.355 + Math.sin(a) * 0.09, 0.02] as V3
      }),
      0.01,
      { seg: 5, steps: 1 },
    ).fill(WICKER, 0)
    parts.push(merge(body.place([0, 0, 0.02]), rim, handle))
  }
  return merge(...parts)
}

/** Thigh: hip joint (at the origin) to the knee. */
/** The thigh, from the hip joint (at the origin) to the knee; `closed`: its ends closed too (seated, the hip and the
 *  knee bend far enough to bring them out of the pelvis and the shin). */
function thigh(closed = false): Shape {
  return column(
    [
      [0.04, 0.086, 0.088],
      [-0.1, 0.08, 0.086],
      [-0.26, 0.068, 0.07],
      [-0.44, 0.058, 0.06],
    ],
    { seg: 9, round: closed ? [0.05, 0.05] : undefined },
  ).shade((_x, y) => 0.9 + 0.1 * smoothstep(-0.4, 0, y))
}

/** Shin and shoe: knee (at the origin) to the ground at −0.465 (`closed`: the knee's end rounded off, for a bent
 *  knee). */
function shin(closed = false): Shape {
  const leg = column(
    [
      [0.02, 0.058, 0.06],
      [-0.12, 0.055, 0.064, -0.006],
      [-0.28, 0.047, 0.05],
      [-0.39, 0.05, 0.052],
      [-0.425, 0.042, 0.044],
    ],
    // (the last ring is inside the shoe: the leg goes into it)
    { seg: 9, round: closed ? [0.05, 0] : undefined },
  ).shade((_x, y) => 0.88 + 0.12 * smoothstep(-0.38, 0, y))
  // the shoe: its flattened sole on the ground (0.465 under the knee, as the rig's legs are long)
  const shoe = loft(
    [
      { c: [0, -0.438, -0.06], rx: 0.042, ry: 0.036 },
      { c: [0, -0.44, 0.01], rx: 0.049, ry: 0.038 },
      { c: [0, -0.446, 0.09], rx: 0.051, ry: 0.03 },
      { c: [0, -0.451, 0.15], rx: 0.043, ry: 0.022 },
    ],
    // flat underneath (the sole)
    { seg: 10, steps: 1, round: [0.02, 0.025], shape: (a) => (Math.sin(a) < 0 ? 1 - 0.35 * Math.sin(a) ** 2 : 1) },
  )
    .paint(() => SHOE, 0)
    .pattern((_x, y) => 0.5 + (-0.462 - y) * 60, SOLE)
  return merge(leg, shoe)
}

/** The head and neck, round the head joint: a face with eyes, brows, nose, mouth and ears. `eyes` is the irises' mask
 *  for the head's second colour (the eyes' own, per person): 1 on their vertices, 0 elsewhere. */
function head(): { shape: Shape; eyes: number[] } {
  const neck = column(
    [
      [-0.2, 0.062, 0.06],
      [-0.12, 0.058, 0.056, 0.0],
      [-0.06, 0.06, 0.056, -0.01],
    ],
    { seg: 10, round: [0.03, 0] },
  ).shade(() => 0.88)
  const skull = column(
    [
      [-0.1, 0.06, 0.068, 0.012],
      [-0.065, 0.085, 0.094, 0.004],
      [-0.01, 0.097, 0.108, 0.0],
      [0.055, 0.1, 0.112, -0.004],
      [0.11, 0.084, 0.095, -0.01],
    ],
    {
      seg: 14,
      steps: 2,
      round: [0.03, 0.045],
      // a flatter face, a narrower chin
      shape: (a, t) => (1 - 0.07 * Math.max(0, Math.sin(a)) ** 4) * (1 - 0.12 * (1 - smoothstep(0, 0.35, t)) * Math.abs(Math.cos(a))),
    },
  )
  // the face catches a little more light than the jaw and the back of the head
  skull.shade((_x, y, z) => 0.94 + 0.06 * smoothstep(-0.02, 0.08, z) + 0.04 * smoothstep(-0.12, -0.05, y))
  const nose = tube(
    [
      [0, 0.01, 0.1],
      [0, -0.02, 0.118],
      [0, -0.036, 0.122],
    ],
    [0.012, 0.016, 0.013],
    { seg: 6, steps: 2, caps: [false, true], round: [0.01, 0] },
  ).shade(() => 0.97)
  // eyes, brows and lips sit on the face: where a ray from in front meets the skull, set a little into it — so
  // they hold on to it whatever shape the head has
  const onFace = (x: number, y: number, into: number): V3 => {
    const hit = skull.raycast([x, y, 0.4], [0, 0, -1])
    return [x, y, (hit ? hit.point[2] : 0.1) - into]
  }
  const parts: Shape[] = [neck, skull, nose]
  const irises: Shape[] = []
  for (const sx of [-1, 1]) {
    // eyes: a white half sunk into the face, an iris on it — painted white, it takes the person's eye colour (the
    // head's second colour), with a dark pupil in its middle
    parts.push(
      ellipsoid(0.016, 0.011, 0.008, 7, 3)
        .place(onFace(sx * 0.036, 0.016, 0.004))
        .fill(WHITE, 0),
    )
    const iris = ellipsoid(0.009, 0.0095, 0.006, 7, 3)
      .fill([1, 1, 1], 0)
      .pattern((_x, _y, z) => 0.5 + (z / 0.006 - 0.75) * 4, PUPIL)
      .place(onFace(sx * 0.036, 0.016, -0.0035))
    irises.push(iris)
    parts.push(iris)
    parts.push(tube([onFace(sx * 0.018, 0.04, 0.0015), onFace(sx * 0.037, 0.046, 0.0015), onFace(sx * 0.055, 0.042, 0.0015)], 0.0045, { seg: 5, steps: 1, round: [0.004, 0.004] }).fill(BROW, 0))
    // ears
    parts.push(
      ellipsoid(0.013, 0.03, 0.022, 6, 3)
        .place([sx * 0.098, 0.0, -0.005], [0, sx * 0.25, 0])
        .shade(() => 0.93),
    )
  }
  parts.push(tube([onFace(-0.024, -0.058, 0.002), onFace(0, -0.062, 0.002), onFace(0.024, -0.058, 0.002)], 0.005, { seg: 5, steps: 2, round: [0.004, 0.004] }).fill(LIPS, 0))
  return { shape: merge(...parts), eyes: parts.flatMap((p) => Array<number>(p.count).fill(irises.includes(p) ? 1 : 0)) }
}

/** How far a point is above the hair-line (higher at the brow, lower at the nape): the hair covers where it is > 0. */
const aboveHairline = (x: number, y: number, z: number) => Math.max(y - (0.05 + 0.28 * Math.max(0, z) - 0.6 * Math.max(0, -z) * (Math.abs(x) < 0.07 ? 1 : 0.3)), z < -0.02 ? y + 0.07 : -1)

/** The hair over the top and back of the skull, close to the scalp, its edge tucked into it at the hair-line. */
function hairCap(): Shape {
  return column(
    [
      [-0.07, 0.088, 0.098, -0.002],
      [-0.01, 0.1, 0.112, -0.002],
      [0.055, 0.103, 0.116, -0.006],
      [0.11, 0.087, 0.099, -0.012],
    ],
    { seg: 14, steps: 2, round: [0, 0.05] },
  )
    .keep((x, y, z) => aboveHairline(x, y, z) > 0)
    .warp((x, y, z) => {
      // within 1.5 cm of the hair-line the hair dips towards the scalp, so its edge meets the skin
      const tuck = 1 - Math.min(1, aboveHairline(x, y, z) / 0.015)
      const k = 1 - 0.07 * Math.max(0, tuck)
      return [x * k, y, (z + 0.004) * k - 0.004]
    })
}

function hairShort(): Shape {
  return hairCap().shade((_x, y) => 0.85 + 0.15 * smoothstep(-0.05, 0.12, y))
}

function hairLong(): Shape {
  const back = column(
    [
      [0.06, 0.1, 0.07, -0.05],
      [-0.08, 0.108, 0.06, -0.07],
      [-0.2, 0.1, 0.045, -0.08],
      [-0.25, 0.08, 0.03, -0.07],
    ],
    { seg: 10, round: [0, 0.02] },
  )
  return merge(hairCap(), back).shade((_x, y) => 0.82 + 0.18 * smoothstep(-0.2, 0.12, y))
}

function hairBun(): Shape {
  const bun = blob(0.05, 2, (x, y, z) => 0.06 * Math.sin(x * 9 + z * 7) * Math.cos(y * 8)).place([0, 0.1, -0.1])
  return merge(hairCap(), bun).shade((_x, y) => 0.85 + 0.15 * smoothstep(-0.05, 0.15, y))
}

/** Where the curls are: lumps about 3 cm across (0..1). */
const curl = (x: number, y: number, z: number) => fbm3(x * 30, y * 30, z * 30, 11, 2)

/** Curly hair: a fuller crop of curls over the top, back and sides, its edge tucked into the scalp at the hair-line as
 *  the others are (the curls flatten out towards it). */
function hairCurly(): Shape {
  const hair = column(
    [
      [-0.07, 0.1, 0.11, -0.004],
      [-0.01, 0.114, 0.126, -0.004],
      [0.055, 0.118, 0.13, -0.008],
      [0.115, 0.1, 0.112, -0.014],
    ],
    { seg: 20, steps: 2, round: [0, 0.06] },
  ).keep((x, y, z) => aboveHairline(x, y, z) > 0)
  // how far each vertex is from the cut edge (the hair-line as the triangles left it)
  const edge = fromEdge(hair)
  const n = hair.normals()
  for (let k = 0; k < hair.count; k++) {
    const o = k * 3
    const [x, y, z] = [hair.p[o], hair.p[o + 1], hair.p[o + 2]]
    const near = 1 - Math.min(1, edge[k] / 0.03)
    // the curls: lumps a few centimetres across, smoothing out towards the edge…
    const d = (0.026 * (curl(x, y, z) - 0.45) + 0.004) * (1 - near)
    // …which comes in towards the middle of the head, into the scalp
    const k2 = 1 - 0.22 * near
    hair.p[o] = (x + n[o] * d) * k2
    hair.p[o + 1] = y + n[o + 1] * d
    hair.p[o + 2] = (z + n[o + 2] * d + 0.006) * k2 - 0.006
  }
  // darker between the curls
  return hair.shade((x, y, z) => (0.85 + 0.15 * smoothstep(-0.05, 0.14, y)) * (0.68 + 0.32 * smoothstep(0.32, 0.62, curl(x, y, z))))
}

/** How far each vertex of a shape is from its open edge (the vertices on an edge only one triangle has), in metres. */
function fromEdge(s: Shape): number[] {
  const uses = new Map<string, number>()
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)
  for (let k = 0; k < s.i.length; k += 3)
    for (let e = 0; e < 3; e++) {
      const id = key(s.i[k + e], s.i[k + ((e + 1) % 3)])
      uses.set(id, (uses.get(id) ?? 0) + 1)
    }
  const rim = new Set<number>()
  for (const [id, n] of uses) if (n === 1) for (const v of id.split(',')) rim.add(Number(v))
  const p = s.p
  return Array.from({ length: s.count }, (_, k) => {
    let best = Infinity
    for (const r of rim) best = Math.min(best, Math.hypot(p[k * 3] - p[r * 3], p[k * 3 + 1] - p[r * 3 + 1], p[k * 3 + 2] - p[r * 3 + 2]))
    return best
  })
}

/** A ponytail: the hair drawn back over the skull and tied at the back of the head, the tail hanging down the neck. */
function hairPony(): Shape {
  const tie: V3 = [0, 0.035, -0.126]
  const tail = tube([[0, 0.04, -0.098], tie, [0, 0.005, -0.152], [0, -0.065, -0.158], [0, -0.135, -0.146], [0, -0.2, -0.124]], [0.022, 0.015, 0.03, 0.028, 0.02, 0], {
    seg: 8,
    steps: 1,
    round: [0.012, 0],
  })
    // the band round it, a darker shade of the hair
    .pattern((_x, y, z) => 0.5 + (0.007 - Math.hypot(y - tie[1], z - tie[2])) * 160, [0.45, 0.45, 0.45])
  return merge(hairCap(), tail).shade((_x, y) => 0.82 + 0.18 * smoothstep(-0.2, 0.12, y))
}

/** A straw sun hat: a wide brim, a round crown and a band (painted white: it takes the person's hat colour). */
function hat(): Shape {
  const brim = lathe(
    [
      [0.1, 0.095],
      [0.15, 0.093],
      [0.21, 0.086],
      [0.215, 0.082],
      [0.205, 0.08],
      [0.15, 0.085],
      [0.1, 0.088],
    ],
    { seg: 18, steps: 1 },
  )
  const crown = lathe(
    [
      [0.11, 0.09],
      [0.114, 0.15],
      [0.1, 0.19],
      [0.06, 0.205],
      [0.0, 0.21],
    ],
    { seg: 14, steps: 1 },
  )
  const straw = merge(brim, crown)
    .paint(() => STRAW, 0)
    .pattern((x, y, z) => 0.5 + 0.5 * Math.sin(Math.hypot(x, z) * 300 + y * 200), STRAW_DARK)
  // the band, tight round the crown
  const band = lathe(
    [
      [0.1125, 0.098],
      [0.1145, 0.125],
    ],
    { seg: 14, steps: 1 },
  ).fill([1, 1, 1], 1)
  return merge(straw, band)
}

/** A hat's edge sits higher over the brow than at the nape: the rings low on the crown rise towards the front. */
const overTheBrow =
  (rise: number) =>
  (x: number, y: number, z: number): V3 => [x, y + rise * smoothstep(-0.04, 0.1, z) * (1 - smoothstep(0.06, 0.13, y)), z]
/** The face is flatter than the back of the head: a hat's crown follows it (as the skull's rings do). */
const faceFlat = (a: number) => 1 - 0.07 * Math.max(0, Math.sin(a)) ** 4

/** A cap: a snug crown and a peak over the brow, all in the person's hat colour (the contractor's yellow one is his
 *  hard hat). Its lower edge comes in under itself, into the head, so no gap shows under it. */
function cap(): Shape {
  const crown = column(
    [
      [0.022, 0.093, 0.103, -0.006],
      [0.045, 0.11, 0.123, -0.006],
      [0.11, 0.095, 0.107, -0.01],
    ],
    { seg: 14, steps: 2, round: [0, 0.058], shape: faceFlat },
  ).warp(overTheBrow(0.035))
  const peak = loft(
    [
      { c: [0, 0.086, 0.07], rx: 0.088, ry: 0.006 },
      { c: [0, 0.082, 0.145], rx: 0.082, ry: 0.006 },
      { c: [0, 0.07, 0.2], rx: 0.05, ry: 0.005 },
    ],
    { seg: 12, steps: 2, up: [0, 1, 0], shape: (a) => squircle(a, 5), caps: [true, true] },
  )
    // curved down at its sides
    .warp((x, y, z) => [x, y - 2.4 * x * x, z])
    .shade(() => 0.86)
  return merge(crown, peak)
}

/** A knitted beanie: a dome over the head down to the tops of the ears, a turned-up cuff, ribs, a pompom; in the
 *  person's hat colour (the ribs a darker shade of it). */
function beanie(): Shape {
  const RIB = [0.78, 0.78, 0.78] as V3
  const body = column(
    [
      [0.004, 0.091, 0.101, -0.006],
      [0.02, 0.109, 0.122, -0.006],
      [0.068, 0.112, 0.125, -0.008],
      [0.078, 0.105, 0.118, -0.008],
      [0.13, 0.098, 0.11, -0.012],
      [0.17, 0.068, 0.078, -0.016],
    ],
    { seg: 16, round: [0, 0.032], shape: faceFlat },
  )
    // a rib every two of its sixteen sides
    .pattern((x, _y, z) => 0.5 + 0.7 * Math.sin(Math.atan2(x, z + 0.01) * 8), RIB)
    .shade((_x, y) => (y < 0.072 ? 1 : 0.93))
    .warp(overTheBrow(0.045))
  const pompom = blob(0.032, 1, (x, y, z) => 0.12 * Math.sin(x * 40) * Math.sin(y * 37 + z * 29)).place([0, 0.198, -0.016])
  return merge(body, pompom)
}

/** The manager's tie, down the front of his shirt: a knot under the collar and its blade, lying on the shirt (found
 *  where a ray from in front meets the torso, as the face's features are). */
function tie(): Shape {
  const shirt = torso()
  const front = (y: number, out: number): V3 => {
    const hit = shirt.raycast([0, y, 0.4], [0, 0, -1])
    return [0, y, (hit ? hit.point[2] : 0.1) + out]
  }
  const knot = ellipsoid(0.014, 0.016, 0.01, 8, 4).place(front(0.548, 0.002))
  const ys = [0.535, 0.47, 0.4, 0.33, 0.27, 0.235]
  const widths = [0.01, 0.013, 0.018, 0.023, 0.026, 0]
  const blade = loft(
    ys.map((y, k) => ({ c: front(y, 0.003), rx: widths[k], ry: k === ys.length - 1 ? 0 : 0.0035 })),
    { seg: 6, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, 4), caps: [true, false] },
  )
  return merge(
    knot.shade(() => 0.85),
    blade,
  ).paint(() => TIE, 0)
}

export type PersonPart =
  | 'pelvis'
  | 'torso'
  | 'upperArm'
  | 'forearmL'
  | 'forearmR'
  | 'forearmRBare'
  | 'thigh'
  | 'shin'
  | 'thighSeated'
  | 'shinSeated'
  | 'head'
  | 'hairShort'
  | 'hairLong'
  | 'hairBun'
  | 'hairCurly'
  | 'hairPony'
  | 'hat'
  | 'cap'
  | 'beanie'
  | 'tie'

let made: Record<PersonPart, BufferGeometry> | null = null

/** Every part of a person (built once, then shared by the crowd). */
export function personGeometries(): Record<PersonPart, BufferGeometry> {
  if (made) return made
  const h = head()
  const headGeometry = h.shape.geometry()
  // where the head's second colour (the eyes') applies
  headGeometry.setAttribute('tint2', new BufferAttribute(new Float32Array(h.eyes), 1))
  made = {
    pelvis: pelvis().geometry(),
    torso: torso().geometry(),
    upperArm: upperArm().geometry(),
    forearmL: forearm(1, false).geometry(),
    forearmR: forearm(-1, true).geometry(),
    // the right hand with no basket (the tractor's driver: both hands on the wheel)
    forearmRBare: forearm(-1, false).geometry(),
    thigh: thigh().geometry(),
    shin: shin().geometry(),
    // a seated person's legs (the tractor's driver), their ends rounded off
    thighSeated: thigh(true).geometry(),
    shinSeated: shin(true).geometry(),
    head: headGeometry,
    hairShort: hairShort().geometry(),
    hairLong: hairLong().geometry(),
    hairBun: hairBun().geometry(),
    hairCurly: hairCurly().geometry(),
    hairPony: hairPony().geometry(),
    hat: hat().geometry(),
    cap: cap().geometry(),
    beanie: beanie().geometry(),
    tie: tie().geometry(),
  }
  return made
}

/** The hair styles, in the order of a look's `hairStyle`: short, long, a bun, curly, a ponytail. */
export const HAIR_PARTS: PersonPart[] = ['hairShort', 'hairLong', 'hairBun', 'hairCurly', 'hairPony']

// ───────────────────────────── drawing and posing ─────────────────────────────

const CLOTH = { roughness: 0.88, detail: { scale: 260, bump: 0.0015, shade: 0.07 } }
const SKIN = { roughness: 0.6 }
const HAIR = { roughness: 0.55, detail: { scale: 160, bump: 0.0025, shade: 0.16 } }

/** Instanced draws for a crowd of up to `max` people. A part nobody in view wears (a hair style, a hat, the tie) is
 *  not drawn. */
export function personParts(max: number): Parts {
  const g = personGeometries()
  const defs: Record<string, PartDef> = {
    pelvis: { geometry: g.pelvis, max, material: CLOTH },
    torso: { geometry: g.torso, max, material: CLOTH },
    upperArm: { geometry: g.upperArm, max: max * 2, material: CLOTH },
    forearmL: { geometry: g.forearmL, max, material: SKIN },
    forearmR: { geometry: g.forearmR, max, material: SKIN },
    // a right hand with no basket: the tractor's driver, the manager, the contractor (anyone the crowd draws may be one)
    forearmRBare: { geometry: g.forearmRBare, max, material: SKIN },
    thigh: { geometry: g.thigh, max: max * 2, material: CLOTH },
    shin: { geometry: g.shin, max: max * 2, material: CLOTH },
    thighSeated: { geometry: g.thighSeated, max: 2, material: CLOTH },
    shinSeated: { geometry: g.shinSeated, max: 2, material: CLOTH },
    // the skin is the head's colour, the eyes its second
    head: { geometry: g.head, max, material: { ...SKIN, tint2: true } },
    hairShort: { geometry: g.hairShort, max, material: HAIR },
    hairLong: { geometry: g.hairLong, max, material: HAIR },
    hairBun: { geometry: g.hairBun, max, material: HAIR },
    hairCurly: { geometry: g.hairCurly, max, material: HAIR },
    hairPony: { geometry: g.hairPony, max, material: HAIR },
    hat: { geometry: g.hat, max, material: { roughness: 0.9 } },
    cap: { geometry: g.cap, max, material: { roughness: 0.9 } },
    beanie: { geometry: g.beanie, max, material: CLOTH },
    tie: { geometry: g.tie, max, material: SKIN },
    shadow: shadowPart(max, 0.24),
  }
  return new Parts(defs, 'people')
}

/** A hat, and which: `true` is the straw hat (as saves from before kept it), `false` none. */
export type HatKind = 'straw' | 'cap' | 'beanie'

/** How a person looks. The first fields are what every save has; the rest are the people engine's
 *  (src/models/look.ts: rollLook makes them, sanitizeLook fills in what an older save lacks) and each has a default. */
export interface PersonLook {
  shirt: Color | number | string
  trousers: Color | number | string
  skin: Color | number | string
  hair: Color | number | string
  /** 0 short, 1 long, 2 a bun, 3 curly, 4 a ponytail */
  hairStyle: number
  hat: boolean | HatKind
  /** 1 is the player's own size */
  height: number
  /** a basket on the right arm (the buyers'; the tractor's driver has none) */
  basket?: boolean
  /** sits (the tractor's driver): legs whose ends are closed, for knees and hips bent far */
  seated?: boolean
  /** the body's build: 'f' a little narrower at the shoulders and wider at the hips */
  sex?: 'f' | 'm'
  /** the shoulders', the hips' and the head's size against the built one (1) */
  shoulders?: number
  hips?: number
  head?: number
  /** the eyes' colour */
  eyes?: Color | number | string
  /** the hat's colour: the straw hat's band, the whole of a cap or a beanie */
  hatBand?: Color | number | string
  /** something worn for work: the manager's tie */
  extra?: 'tie'
}

/** The hat's colour when a look has none of its own (the straw hat's band, as it always was). */
export const HAT_BAND = '#8a4b3a'
/** Over curls a hat sits a size up. */
const OVER_CURLS = 1.08

/** One person's joints (posed by turning them) and the parts that hang from them. The look's sizes are the joints'
 *  scales: the height scales the whole body from the hips; `hips` widens the pelvis and spreads the legs (the hip
 *  joints, thighs and shins scaled across, so they keep fitting it); `shoulders` widens the shirt and sets the arms
 *  further out; `head` scales the head, its hair and its hat. */
export class PersonRig {
  readonly root = new Group()
  readonly hips: Group
  readonly head: Group
  readonly thighL: Group
  readonly thighR: Group
  readonly kneeL: Group
  readonly kneeR: Group
  readonly armL: Group
  readonly armR: Group
  readonly elbowL: Group
  readonly elbowR: Group
  private pieces: { node: Object3D; part: string; color?: Color; color2?: Color }[] = []

  constructor(look: PersonLook) {
    const shirt = new Color(look.shirt)
    const trousers = new Color(look.trousers)
    const skin = new Color(look.skin)
    const hair = new Color(look.hair)
    const eyes = new Color(look.eyes ?? EYES)
    const wide = { hips: look.hips ?? 1, shoulders: look.shoulders ?? 1, head: look.head ?? 1 }
    const joint = (parent: Object3D, x: number, y: number, z: number) => {
      const g = new Group()
      g.position.set(x, y, z)
      parent.add(g)
      return g
    }
    const piece = (node: Object3D, part: string, color?: Color, color2?: Color) => this.pieces.push({ node, part, color, color2 })
    this.hips = joint(this.root, 0, PERSON.hipsY * look.height, 0)
    this.hips.scale.setScalar(look.height)
    const seat = joint(this.hips, 0, 0, 0)
    seat.scale.x = wide.hips
    piece(seat, 'pelvis', trousers)
    const chest = joint(this.hips, 0, 0, 0)
    chest.scale.x = wide.shoulders
    piece(chest, 'torso', shirt)
    if (look.extra === 'tie') piece(chest, 'tie')
    const leg = (side: 1 | -1) => {
      const thigh = joint(this.hips, side * PERSON.hipX * wide.hips, 0, 0)
      // (across only: the thigh turns about x, so the knee and the shin under it stay in proportion)
      thigh.scale.x = wide.hips
      piece(thigh, look.seated ? 'thighSeated' : 'thigh', trousers)
      const knee = joint(thigh, 0, PERSON.kneeY, 0)
      piece(knee, look.seated ? 'shinSeated' : 'shin', trousers)
      return [thigh, knee]
    }
    ;[this.thighL, this.kneeL] = leg(1)
    ;[this.thighR, this.kneeR] = leg(-1)
    const arm = (side: 1 | -1) => {
      const shoulder = joint(this.hips, side * PERSON.shoulder[0] * wide.shoulders, PERSON.shoulder[1], 0)
      piece(shoulder, 'upperArm', shirt)
      const elbow = joint(shoulder, 0, PERSON.elbowY, 0)
      piece(elbow, side > 0 ? 'forearmL' : look.basket === false ? 'forearmRBare' : 'forearmR', skin)
      return [shoulder, elbow]
    }
    ;[this.armL, this.elbowL] = arm(1)
    ;[this.armR, this.elbowR] = arm(-1)
    this.head = joint(this.hips, 0, PERSON.headY, 0)
    this.head.scale.setScalar(wide.head)
    piece(this.head, 'head', skin, eyes)
    const style = HAIR_PARTS[look.hairStyle % HAIR_PARTS.length]
    piece(this.head, style, hair)
    const hat = look.hat === 'cap' || look.hat === 'beanie' ? look.hat : look.hat ? 'hat' : null
    if (hat) {
      const crown = joint(this.head, 0, 0, 0)
      if (style === 'hairCurly') crown.scale.setScalar(OVER_CURLS)
      piece(crown, hat, new Color(look.hatBand ?? HAT_BAND))
    }
    // a soft shadow on the ground (people do not draw into the sun's shadow map: it would redraw every frame)
    const shadow = joint(this.root, 0, 0.006, 0)
    shadow.scale.set(0.3, 1, 0.26)
    piece(shadow, 'shadow')
  }

  /** Copies the posed parts into the crowd's draws. */
  write(parts: Parts) {
    this.root.updateMatrixWorld(true)
    parts.at(0, 0, 0)
    for (const p of this.pieces) parts.putMatrix(p.part, p.node.matrixWorld, p.color, p.color2)
  }
}
