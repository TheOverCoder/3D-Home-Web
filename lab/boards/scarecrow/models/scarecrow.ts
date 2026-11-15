import { Group, Matrix4, Quaternion, Vector3, type Object3D } from 'three'
import { blade, ellipsoid, fbm3, lathe, loft, merge, mixRgb, noise3, rgb, smoothstep, squircle, tube, type Shape, type V3 } from '../../../../src/lib/sculpt'
import { CLOTH, HAT } from '../../../../src/models/person'
import { checkModel, modelGroup, trianglesOf, type LabModel } from '../../../three/model'

// A scarecrow for the beds (the board: ./index.tsx), made with the kit as the game's farm things are: a post and its
// cross-stick, stuffed clothes with straw out of the cuffs and the ankles, a head and a hat. One maker, three looks:
//
//   A  the classic: a sack head with a stitched smile and button eyes, the straw hat, a red shirt, blue
//      trousers with a patch, arms straight out (a T against the sky)
//   B  a pumpkin from the beds as its head, a striped scarf, overalls, arms a little down, and a crow on its arm that
//      looks round and pecks (the crow moves)
//   C  tall and thin in a long green coat, its head on one side and one arm up as if it waves, with ribbons in the
//      game's colours that flutter from that hand (the ribbons move); a red bucket hat
//
// It stands in its own frame facing +z (the ground under the post at the origin); the board puts it at the end of the
// west beds, facing the garden door.

// ───────────────────────────── colours ─────────────────────────────

const POLE = rgb(0x6e5238)
const POLE_LIGHT = rgb(0x8d6c4b)
const STRAW = rgb(0xe0c06a)
const STRAW_DARK = rgb(0xb9933e)
const BURLAP = rgb(0xc8a46c)
const BURLAP_DARK = rgb(0xa98652)
const THREAD = rgb(0x3b2a1e)
const TWINE = rgb(0x7a5a32)
const BUTTON = rgb(0x2a1d16)
const PUMPKIN = rgb(0xe0802a)
const PUMPKIN_DARK = rgb(0xb85e1c)
const STEM = rgb(0x6b5a2a)
const CROW = rgb(0x22262c)
const BEAK = rgb(0x3a3630)
const BAND = rgb(0x8a4b3a) // the people engine's hat band (src/models/person.ts HAT_BAND)

export interface ScarecrowLook {
  head: 'sack' | 'pumpkin'
  hat: 'straw' | 'bucket'
  /** the shirt (or the coat), the trousers, a patch's colour */
  shirt: V3
  trousers: V3
  patch: V3
  /** a coat down to the knees instead of a shirt */
  coat?: boolean
  /** overalls' bib over the shirt, in the trousers' colour */
  bib?: boolean
  /** how far each arm is raised from level (radians; up is +), left (−x) and right (+x) */
  arms: [number, number]
  /** how far the head leans to one side (radians) */
  tilt: number
  /** a hat's colour (the bucket hat) */
  hatColour?: V3
  /** a scarf's two stripes */
  scarf?: [V3, V3]
  /** how tall: the post's top, inside the head */
  tall: number
}

export type ScarecrowPart = 'wood' | 'cloth' | 'head' | 'hat' | 'straw'
/** The parts that move: the crow's body and its head, and the ribbons. */
export type MovingPart = 'crow' | 'crowHead' | 'ribbons'

/** Where an arm's stick reaches, and its sleeve's cuff, for an arm raised by `up` (side −1 left, 1 right). */
function arm(side: -1 | 1, up: number, y: number) {
  const dir: V3 = [side * Math.cos(up), Math.sin(up), 0]
  const at = (d: number): V3 => [side * 0.02 + dir[0] * d, y + dir[1] * d, 0]
  return { dir, at }
}

const Z = new Vector3(0, 0, 1)
/** Turns a shape made along +z to point along `dir`, and moves it to `at`. */
function aim(s: Shape, at: V3, dir: V3) {
  const q = new Quaternion().setFromUnitVectors(Z, new Vector3(...dir).normalize())
  return s.transform(new Matrix4().compose(new Vector3(...at), q, new Vector3(1, 1, 1)))
}

/** A tuft of straw sticking out of an opening at `at`, along `dir`, fanned out a little. */
function tuft(at: V3, dir: V3, seed: number, n = 7, length = 0.16): Shape {
  const out: Shape[] = []
  for (let k = 0; k < n; k++) {
    const spread = ((k / (n - 1)) * 2 - 1) * 0.5
    const l = length * (0.75 + 0.5 * noise3(k * 3.1, seed, 1, 5))
    // each straw starts a little inside the opening, so it holds on there
    const straw = blade({ length: l, width: 0.026, fold: 0.3, bend: -0.5, segL: 3, segW: 1 }).place([0, 0, -0.03], [spread * Math.cos(k * 2.3 + seed), spread * Math.sin(k * 1.7 + seed), k * 1.3])
    out.push(aim(straw, at, dir))
  }
  return merge(...out).paint((x, y, z) => mixRgb(STRAW, STRAW_DARK, noise3(x * 40, y * 40, z * 40, seed)), 0)
}

/** A patch stitched on a garment: a thin square cushion laid on its surface at `at`, facing `normal`. */
function patch(at: V3, normal: V3, size: number, colour: V3): Shape {
  const pad = loft(
    [
      { c: [0, 0, -0.004], rx: size, ry: size },
      { c: [0, 0, 0.004], rx: size, ry: size },
    ],
    { seg: 8, steps: 1, caps: [true, true], shape: (a) => squircle(a, 5) },
  ).place([0, 0, 0], [0, 0, 0.2])
  return aim(pad, at, normal).fill(colour, 0)
}

/** Lays a shape's features on a surface: where a ray from `from` along `dir` meets it (and its normal). */
function onto(surface: Shape, from: V3, dir: V3) {
  const hit = surface.raycast(from, dir)
  if (!hit) throw new Error('the ray missed the surface')
  return hit
}

/** The scarecrow, standing still. */
export function scarecrowModel(look: ScarecrowLook): LabModel<ScarecrowPart> {
  const T = look.tall
  const armY = T - 0.32
  const hipY = look.coat ? T - 1.0 : T - 0.76
  const headY = T - 0.04
  // ── the post and the arms' sticks
  const post = tube(
    [
      [0, -0.02, 0],
      [0, T * 0.5, 0],
      [0, T, 0],
    ],
    0.035,
    { seg: 7, steps: 1, caps: [true, true] },
  )
  const arms = ([-1, 1] as const).map((side) => arm(side, look.arms[side < 0 ? 0 : 1], armY))
  const sticks = arms.map((a) => tube([a.at(0.02), a.at(0.4), a.at(0.66)], 0.024, { seg: 6, steps: 1, round: [0, 0.02] }))
  const wood = merge(post, ...sticks).paint((x, y, z) => mixRgb(POLE, POLE_LIGHT, 0.3 + 0.5 * noise3(x * 30, y * 6, z * 30, 3)), 0)

  // ── the shirt or the coat: stuffed round the post, from the hem up to the neck
  const hem = look.coat ? T - 1.3 : hipY + 0.02
  const body = loft(
    [
      { c: [0, hem, 0], rx: look.coat ? 0.25 : 0.205, ry: look.coat ? 0.15 : 0.13 },
      { c: [0, hem + 0.08, 0], rx: look.coat ? 0.22 : 0.19, ry: 0.125 },
      { c: [0, armY - 0.24, 0], rx: 0.185, ry: 0.12 },
      { c: [0, armY - 0.04, 0], rx: 0.215, ry: 0.125 },
      { c: [0, armY + 0.07, 0], rx: 0.16, ry: 0.105 },
      { c: [0, armY + 0.12, 0], rx: 0.07, ry: 0.06 },
    ],
    { seg: 14, steps: 2, up: [0, 0, 1], caps: [true, false], round: [0, 0.04], shape: (a) => squircle(a, 2.6) },
  )
  const sleeves = arms.map((a) =>
    tube([a.at(0.06), a.at(0.3), a.at(0.56)], [0.085, 0.078, 0.072], { seg: 10, steps: 2, caps: [false, true] }).warp((x, y, z) => [x, y - 0.025 * smoothstep(0.1, 0.6, Math.abs(x)), z]),
  )
  const shirt = merge(body, ...sleeves)
    .paint(() => look.shirt, 1)
    .shade((_x, y) => 0.88 + 0.12 * smoothstep(hem, armY, y))
  // ── the trousers: two legs hanging from inside the shirt, straw out of the ankles
  const legEnd = (side: -1 | 1): V3 => [side * 0.105, look.coat ? T - 1.62 : hipY - 0.5, 0.03]
  const legs = ([-1, 1] as const).map((side) => tube([[side * 0.09, hipY + 0.12, 0], [side * 0.1, hipY - 0.2, 0.015], legEnd(side)], [0.085, 0.08, 0.075], { seg: 10, steps: 2, caps: [false, true] }))
  const trousers = merge(...legs).paint(() => look.trousers, 1)
  const cloth: Shape[] = [shirt, trousers]
  // the bib of the overalls, over the shirt's front, with its two straps
  if (look.bib) {
    const front = loft(
      [
        { c: [0, hipY + 0.02, 0.124], rx: 0.15, ry: 0.012 },
        { c: [0, armY - 0.12, 0.126], rx: 0.13, ry: 0.012 },
      ],
      { seg: 8, steps: 1, up: [0, 0, 1], caps: [true, true], shape: (a) => squircle(a, 4) },
    ).fill(look.trousers, 1)
    const straps = ([-1, 1] as const).map((side) =>
      tube(
        [
          [side * 0.1, armY - 0.13, 0.128],
          [side * 0.12, armY + 0.02, 0.13],
          [side * 0.11, armY + 0.075, 0.03],
        ],
        0.016,
        { seg: 5, steps: 1, round: [0.01, 0.01] },
      ).fill(look.trousers, 1),
    )
    cloth.push(front, ...straps)
  }
  // patches: one on a knee, one on the shirt's front (laid on their surfaces)
  const knee = onto(legs[1], [0.1, hipY - 0.26, 0.5], [0, 0, -1])
  cloth.push(patch(knee.point, knee.normal, 0.045, look.patch))
  const chest = onto(body, [-0.09, armY - 0.18, 0.5], [0, 0, -1])
  if (!look.bib) cloth.push(patch(chest.point, chest.normal, 0.04, look.patch))
  // a scarf: a collar round the neck and its end hanging down the front, striped
  if (look.scarf) {
    const [a, b] = look.scarf
    const collar = lathe(
      [
        [0.075, armY + 0.04],
        [0.13, armY + 0.05],
        [0.135, armY + 0.12],
        [0.07, armY + 0.13],
      ],
      { seg: 16, steps: 1 },
    )
    const end = loft(
      [
        { c: [0.06, armY + 0.08, 0.1], rx: 0.045, ry: 0.014 },
        { c: [0.075, armY - 0.06, 0.14], rx: 0.044, ry: 0.013 },
        { c: [0.085, armY - 0.2, 0.135], rx: 0.042, ry: 0.012 },
      ],
      { seg: 8, steps: 2, up: [0, 0, 1], caps: [true, true], shape: (q) => squircle(q, 4) },
    )
    cloth.push(
      merge(collar, end)
        .paint(() => a, 0)
        .pattern((x, y) => 0.5 + 0.5 * Math.sin(y * 70 + Math.atan2(x, 1) * 2), b),
    )
  }

  // ── the head: a stuffed sack tied at the neck, or a pumpkin; a face
  let head: Shape
  const face: Shape[] = []
  if (look.head === 'sack') {
    const sack = loft(
      [
        { c: [0, headY - 0.17, 0], rx: 0.055, ry: 0.055 },
        { c: [0, headY - 0.14, 0], rx: 0.12, ry: 0.115 },
        { c: [0, headY - 0.05, 0], rx: 0.17, ry: 0.16 },
        { c: [0, headY + 0.05, 0], rx: 0.165, ry: 0.155 },
        { c: [0, headY + 0.13, 0], rx: 0.115, ry: 0.11 },
      ],
      { seg: 14, steps: 2, up: [0, 0, 1], round: [0, 0.05], shape: (a, along) => 1 + 0.045 * Math.sin(a * 3 + along * 4) },
    )
    head = sack
      .paint((x, y, z) => mixRgb(BURLAP, BURLAP_DARK, smoothstep(0.35, 0.75, fbm3(x * 9, y * 9, z * 9, 7))), 0)
      // the twine round the gather
      .pattern((_x, y) => 1 - smoothstep(0.006, 0.012, Math.abs(y - (headY - 0.14))), TWINE)
    // button eyes and a stitched smile, laid on the sack's face
    for (const side of [-1, 1]) {
      const eye = onto(sack, [side * 0.058, headY + 0.01, 0.5], [0, 0, -1])
      face.push(
        ellipsoid(0.024, 0.024, 0.01, 10, 4)
          .place([eye.point[0], eye.point[1], eye.point[2] - 0.002], [0, side * 0.32, 0])
          .fill(BUTTON, 0),
      )
    }
    const smile: V3[] = []
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI * (1.15 + (k / 6) * 0.7)
      const hit = onto(sack, [Math.cos(a) * 0.075, headY - 0.02 + Math.sin(a) * 0.05 + 0.03, 0.5], [0, 0, -1])
      smile.push([hit.point[0], hit.point[1], hit.point[2] - 0.003])
    }
    face.push(tube(smile, 0.008, { seg: 5, steps: 2, round: [0.008, 0.008] }).fill(THREAD, 0))
  } else {
    const ribs = (a: number) => 1 - 0.075 * Math.pow(Math.abs(Math.cos(a * 4)), 3)
    const pumpkin = lathe(
      [
        [0.0, headY - 0.13],
        [0.1, headY - 0.125],
        [0.165, headY - 0.07],
        [0.185, headY],
        [0.165, headY + 0.07],
        [0.1, headY + 0.115],
        [0.0, headY + 0.11],
      ],
      { seg: 24, steps: 1, shape: ribs },
    )
    head = pumpkin.paint((x, _y, z) => mixRgb(PUMPKIN, PUMPKIN_DARK, smoothstep(0.85, 0.97, Math.abs(Math.cos(Math.atan2(z, x) * 4)))), 0)
    face.push(
      tube(
        [
          [0.0, headY + 0.1, 0],
          [0.005, headY + 0.16, 0],
          [0.025, headY + 0.19, 0.005],
        ],
        [0.022, 0.018, 0.015],
        { seg: 6, steps: 2, round: [0, 0.01] },
      ).fill(STEM, 0),
    )
    // a painted face: two round eyes and a wide smile
    for (const side of [-1, 1]) {
      const eye = onto(pumpkin, [side * 0.065, headY + 0.03, 0.5], [0, 0, -1])
      face.push(
        ellipsoid(0.028, 0.03, 0.01, 10, 4)
          .place([eye.point[0], eye.point[1], eye.point[2] - 0.003], [0, side * 0.35, 0])
          .fill(BUTTON, 0),
      )
    }
    const smile: V3[] = []
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI * (1.12 + (k / 6) * 0.76)
      const hit = onto(pumpkin, [Math.cos(a) * 0.09, headY + 0.02 + Math.sin(a) * 0.065, 0.5], [0, 0, -1])
      smile.push([hit.point[0], hit.point[1], hit.point[2] - 0.004])
    }
    face.push(tube(smile, 0.011, { seg: 5, steps: 2, round: [0.011, 0.011] }).fill(BUTTON, 0))
  }

  // ── the hat: the straw sun hat (the people engine's shape, scaled), or a red bucket hat with a drooping brim
  const hatY = look.head === 'sack' ? headY + 0.075 : headY + 0.07
  const hat =
    look.hat === 'straw'
      ? merge(
          lathe(
            [
              [0.1, hatY - 0.005],
              [0.2, hatY - 0.008],
              [0.29, hatY - 0.022],
              [0.295, hatY - 0.03],
              [0.28, hatY - 0.03],
              [0.2, hatY - 0.017],
              [0.1, hatY - 0.012],
            ],
            { seg: 18, steps: 1 },
          ),
          lathe(
            [
              [0.125, hatY - 0.02],
              [0.13, hatY + 0.07],
              [0.112, hatY + 0.12],
              [0.07, hatY + 0.138],
              [0.0, hatY + 0.142],
            ],
            { seg: 14, steps: 1 },
          ),
        )
          .paint(() => STRAW, 0)
          .pattern((x, y, z) => 0.5 + 0.5 * Math.sin(Math.hypot(x, z) * 200 + y * 160), STRAW_DARK)
          .blend(BAND, (x, y, z) => (Math.hypot(x, z) < 0.14 && y > hatY + 0.005 && y < hatY + 0.04 ? 1 : 0))
      : lathe(
          [
            [0.1, hatY - 0.03],
            [0.23, hatY - 0.07],
            [0.24, hatY - 0.058],
            [0.15, hatY + 0.0],
            [0.135, hatY + 0.09],
            [0.1, hatY + 0.12],
            [0.0, hatY + 0.125],
          ],
          { seg: 16, steps: 1 },
        ).paint(() => look.hatColour ?? BAND, 0)
  // the head and the hat lean together, round the top of the post
  const lean = (s: Shape) => s.warp((x, y, z) => turnZ(x, y, z, look.tilt, headY - 0.17))
  const neck = tuft([0, headY - 0.17, 0.02], [0, -0.6, 0.8], 11, 6, 0.09)
  const straw = merge(...arms.map((a, k) => tuft(a.at(0.56), a.dir, 3 + k)), ...([-1, 1] as const).map((side, k) => tuft(legEnd(side), [0, -1, 0.15], 7 + k, 6, 0.12)), lean(neck))
  return {
    wood: { shape: wood, material: { roughness: 0.9 } },
    cloth: { shape: merge(...cloth), material: CLOTH },
    head: { shape: lean(merge(head, ...face)), material: look.head === 'sack' ? { roughness: 0.95, detail: { scale: 220, bump: 0.003, shade: 0.16 } } : { roughness: 0.55 } },
    hat: { shape: lean(hat), material: HAT },
    straw: { shape: straw, material: { roughness: 0.8, doubleSided: true, leaf: true } },
  }
}

/** A point turned round the z axis by `a` about the height `y0` (the head leaning to one side). */
function turnZ(x: number, y: number, z: number, a: number, y0: number): V3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c - (y - y0) * s, y0 + x * s + (y - y0) * c, z]
}

// ───────────────────────────── what moves ─────────────────────────────

/** A crow, built round its feet (the body) and its neck (the head), facing +z. */
export function crowModel(): LabModel<'crow' | 'crowHead'> {
  const body = loft(
    [
      { c: [0, 0.07, -0.1], rx: 0.012, ry: 0.006 },
      { c: [0, 0.075, -0.05], rx: 0.04, ry: 0.035 },
      { c: [0, 0.08, 0.01], rx: 0.048, ry: 0.048 },
      { c: [0, 0.1, 0.055], rx: 0.036, ry: 0.038 },
    ],
    { seg: 10, steps: 2, round: [0.03, 0.02] },
  )
  const tail = loft(
    [
      { c: [0, 0.075, -0.09], rx: 0.02, ry: 0.006 },
      { c: [0, 0.06, -0.17], rx: 0.035, ry: 0.005 },
    ],
    { seg: 6, steps: 1, caps: [false, true] },
  )
  const feet = ([-1, 1] as const).map((s) =>
    tube(
      [
        [s * 0.018, 0.06, 0.0],
        [s * 0.02, 0.025, 0.005],
        [s * 0.02, 0.0, 0.02],
      ],
      0.005,
      { seg: 4, steps: 1, round: [0, 0.005] },
    ),
  )
  const head = merge(
    ellipsoid(0.032, 0.03, 0.036, 10, 5).place([0, 0.035, 0.012]).fill(CROW, 0),
    lathe(
      [
        [0.012, 0],
        [0.009, 0.025],
        [0.0, 0.045],
      ],
      { seg: 6, steps: 1 },
    )
      .place([0, 0.03, 0.035], [Math.PI / 2 - 0.15, 0, 0])
      .fill(BEAK, 0),
  )
  return {
    // (what moves throws no shadow: the sun's shadow map is kept while nothing that casts one moves)
    crow: { shape: merge(body, tail, ...feet).paint(() => CROW, 0), material: { roughness: 0.45, metalness: 0.1 }, castShadow: false },
    crowHead: { shape: head, material: { roughness: 0.45, metalness: 0.1 }, castShadow: false },
  }
}

/** Ribbons tied at a hand, hanging along −y from their knot at the origin: red, cream and sun-yellow (the game's colours). */
export function ribbonsModel(): LabModel<'ribbons'> {
  const colours = [rgb(0xd2452f), rgb(0xf3ead8), rgb(0xffc93c)]
  return {
    ribbons: {
      shape: merge(
        ...colours.map((c, k) =>
          blade({ length: 0.46 - k * 0.05, width: 0.045, fold: 0.05, bend: 0.3, frill: 0.4, waves: 3, segL: 6, segW: 1 })
            .place([0, 0, -0.02], [Math.PI / 2, 0, 0])
            .place([0, 0, 0], [0, (k - 1) * 0.7, (k - 1) * 0.25])
            .fill(c, 0),
        ),
      ),
      material: { roughness: 0.6, doubleSided: true, leaf: true },
      castShadow: false,
    },
  }
}

// ───────────────────────────── the three looks ─────────────────────────────

export type ScarecrowVariant = 'a' | 'b' | 'c'

export const LOOKS: Record<ScarecrowVariant, ScarecrowLook> = {
  a: { head: 'sack', hat: 'straw', shirt: rgb(0xb5523a), trousers: rgb(0x3f5f8a), patch: rgb(0xc9a66b), arms: [0, 0], tilt: 0.06, tall: 1.82 },
  b: {
    head: 'pumpkin',
    hat: 'straw',
    shirt: rgb(0xe9c75a),
    trousers: rgb(0x4a6f9a),
    patch: rgb(0xb5523a),
    bib: true,
    arms: [-0.16, -0.1],
    tilt: -0.08,
    scarf: [rgb(0x2c8540), rgb(0xf3ead8)],
    tall: 1.78,
  },
  c: { head: 'sack', hat: 'bucket', hatColour: rgb(0xd2452f), shirt: rgb(0x5f7f4f), trousers: rgb(0x6b5a48), patch: rgb(0xc9a66b), coat: true, arms: [-0.22, 0.85], tilt: 0.2, tall: 1.98 },
}

/** Where the moving parts hang on the scarecrow, in its frame. */
export function movingAt(v: ScarecrowVariant) {
  const L = LOOKS[v]
  const armY = L.tall - 0.32
  if (v === 'b') {
    // on the left arm, half way out, on the sleeve's top
    const a = arm(-1, L.arms[0], armY)
    const p = a.at(0.36)
    return { crow: [p[0], p[1] + 0.072 - 0.025 * smoothstep(0.1, 0.6, Math.abs(p[0])), p[2] - 0.01] as V3, heading: -Math.PI / 2 }
  }
  if (v === 'c') {
    const a = arm(1, L.arms[1], armY)
    return { ribbons: a.at(0.6) }
  }
  return {}
}

/** The scarecrow of a look as meshes, with its moving parts posed by `tick` (t in seconds). */
export function scarecrowObject(v: ScarecrowVariant): { root: Object3D; tick?: (t: number) => void } {
  const root = new Group()
  root.add(modelGroup(scarecrowModel(LOOKS[v]), `scarecrow-${v}`))
  const at = movingAt(v)
  if (at.crow) {
    const crow = modelGroup(crowModel(), 'crow')
    const head = crow.children.find((c) => c.name === 'crow-crowHead')!
    head.position.set(0, 0.1, 0.06)
    crow.position.set(...at.crow)
    crow.rotation.y = at.heading!
    root.add(crow)
    return {
      root,
      tick: (t) => {
        // it looks one way and the other, and now and then pecks at the sleeve
        const peck = Math.max(0, Math.sin(t * 1.3) - 0.8) * 5
        head.rotation.set(peck * 0.9, Math.sin(t * 0.8) * 0.9 + Math.sin(t * 2.3) * 0.15, 0)
      },
    }
  }
  if (at.ribbons) {
    const g = modelGroup(ribbonsModel(), 'ribbons')
    g.position.set(...at.ribbons)
    root.add(g)
    return {
      root,
      tick: (t) => {
        g.rotation.set(Math.sin(t * 2.1) * 0.35 + 0.2, Math.sin(t * 1.4) * 0.5, Math.sin(t * 2.7) * 0.25)
      },
    }
  }
  return { root }
}

/** Every part a look draws, to count and check: the scarecrow and what moves on it, put where it hangs. */
export function scarecrowParts(v: ScarecrowVariant): LabModel {
  const all: LabModel = { ...scarecrowModel(LOOKS[v]) }
  const at = movingAt(v)
  if (at.crow) {
    const c = crowModel()
    all.crow = { ...c.crow, shape: c.crow.shape.clone().place([0, 0, 0], [0, at.heading!, 0]).place(at.crow) }
    all.crowHead = { ...c.crowHead, shape: c.crowHead.shape.clone().place([0, 0.1, 0.06]).place([0, 0, 0], [0, at.heading!, 0]).place(at.crow) }
  }
  if (at.ribbons) {
    const r = ribbonsModel()
    all.ribbons = { ...r.ribbons, shape: r.ribbons.shape.clone().place(at.ribbons) }
  }
  return all
}

export const scarecrowTriangles = (v: ScarecrowVariant) => trianglesOf(scarecrowParts(v))
export const scarecrowChecks = (v: ScarecrowVariant) => checkModel(`scarecrow ${v.toUpperCase()}`, scarecrowParts(v))
