import { Matrix4, Quaternion, Vector3 } from 'three'
import { ellipsoid, fbm3, loft, merge, mixRgb, noise3, rgb, smoothstep, spin, squircle, tube, blade, type Shape, type V3 } from '../lib/sculpt'
import { CLOTH } from './person'
import type { Structure } from './structures'

// Three scarecrows for the farm's decoration (src/farm/decor.ts), from the English and Scottish fields — the tattie
// bogle, the hodmedod, Worzel Gummidge: a carved root or a stuffed sack for a head and cast-off clothes, chosen in the
// design lab (lab/boards/scarecrow, B). Each built with the kit as the game's farm things are: a post with its
// cross-stick, stuffed clothes with straw out of the cuffs, a head and a hat:
//
//   squire     a carved turnip for a head, a battered top hat, a black tailcoat with tails over a crimson waistcoat
//   ploughman  a carved mangel-wurzel, a wide-awake hat, the long smock frock of the English farm worker, corduroys
//   bogle      a stitched sack, a bowler, a tweed jacket and a long tartan scarf, one arm up with a bird-scarer's
//              clapper
//
// Each stands in its own frame facing +z, the ground under its post at the origin, about 1.8 to 1.95 m tall and 1.5 m
// across its arms. Five parts each, one per material: the wood, the clothes, the head (with its face), the hat, and the
// straw (open blades, drawn from both sides). 1,352 to 1,755 triangles each.

// ───────────────────────────── colours ─────────────────────────────

const POLE_GREY = rgb(0x7a7166)
const STRAW = rgb(0xe0c06a)
const STRAW_DARK = rgb(0xb9933e)
const BURLAP = rgb(0xc8a46c)
const BURLAP_DARK = rgb(0xa98652)
const THREAD = rgb(0x3b2a1e)
const TWINE = rgb(0x7a5a32)
const BUTTON = rgb(0x2a1d16)
const CREAM = rgb(0xf0e6cf)
// soot black, crimson, linen, the smock's drab, corduroy, tweed
const SOOT = rgb(0x2e3330)
const CRIMSON = rgb(0x9c3330)
const LINEN = rgb(0xe6dcc3)
const DRAB = rgb(0xa89a6c) // the smock frock's commonest colour, a light olive-brown
const DRAB_DARK = rgb(0x857852)
const CORDUROY = rgb(0x6b5440)
const TWEED = rgb(0x6e6a48)
const TWEED_DARK = rgb(0x55513a)
const GREY = rgb(0x5f5c58)
const FELT = rgb(0x6b4f3a)
const TURNIP = rgb(0xefe6d2)
const TURNIP_TOP = rgb(0x8e4a8a)
const MANGEL = rgb(0xc8562e)
const MANGEL_LIGHT = rgb(0xe0b060)
const CARVED = rgb(0x3a2418)
const TARTAN_RED = rgb(0xb0362c)
const TARTAN_GREEN = rgb(0x2f5a3a)

export type ScarecrowPart = 'wood' | 'cloth' | 'head' | 'hat' | 'straw'
type Model = Structure<ScarecrowPart>

// ───────────────────────────── the frame ─────────────────────────────

/** Where an arm's stick reaches, for an arm raised by `up` (side −1 left, 1 right) from the height `y`. */
function arm(side: -1 | 1, up: number, y: number) {
  const dir: V3 = [side * Math.cos(up), Math.sin(up), 0]
  const at = (d: number): V3 => [side * 0.02 + dir[0] * d, y + dir[1] * d, 0]
  return { dir, at, side }
}
type Arm = ReturnType<typeof arm>

const Z = new Vector3(0, 0, 1)
/** Turns a shape made along +z to point along `dir`, and moves it to `at`. */
function aim(s: Shape, at: V3, dir: V3) {
  const q = new Quaternion().setFromUnitVectors(Z, new Vector3(...dir).normalize())
  return s.transform(new Matrix4().compose(new Vector3(...at), q, new Vector3(1, 1, 1)))
}

/** Where a ray from `from` along `dir` first meets a surface (and its normal): features laid on a shape. */
function onto(surface: Shape, from: V3, dir: V3 = [0, 0, -1]) {
  const hit = surface.raycast(from, dir)
  if (!hit) throw new Error(`the ray from ${from.join(', ')} missed the surface`)
  return hit
}

/** The post (from the ground up into the head) and the arms' sticks, of grey weathered wood. */
function frame(top: number, arms: Arm[]): Shape {
  const post = tube(
    [
      [0, -0.02, 0],
      [0, top * 0.5, 0],
      [0, top, 0],
    ],
    0.035,
    { seg: 7, steps: 1, caps: [true, true] },
  )
  // each stick ends in a sharpened point past the cuff
  const sticks = arms.map((a) => tube([a.at(0.02), a.at(0.6), a.at(0.68)], [0.023, 0.021, 0], { seg: 6, steps: 1 }))
  const [dark, light] = [POLE_GREY, mixRgb(POLE_GREY, CREAM, 0.3)]
  return merge(post, ...sticks).paint((x, y, z) => mixRgb(dark, light, 0.3 + 0.5 * noise3(x * 30, y * 6, z * 30, 3)), 0)
}

/** A tuft of straw sticking out of an opening at `at`, along `dir`, fanned out a little. */
function tuft(at: V3, dir: V3, seed: number, n = 5, length = 0.15): Shape {
  const out: Shape[] = []
  for (let k = 0; k < n; k++) {
    const spread = ((k / (n - 1)) * 2 - 1) * 0.5
    const l = length * (0.75 + 0.5 * noise3(k * 3.1, seed, 1, 5))
    // each straw starts a little inside the opening, so it holds on there
    const straw = blade({ length: l, width: 0.03, fold: 0.3, bend: -0.5, segL: 2, segW: 1 }).place([0, 0, -0.03], [spread * Math.cos(k * 2.3 + seed), spread * Math.sin(k * 1.7 + seed), k * 1.3])
    out.push(aim(straw, at, dir))
  }
  return merge(...out).paint((x, y, z) => mixRgb(STRAW, STRAW_DARK, noise3(x * 40, y * 40, z * 40, seed)), 0)
}

// ───────────────────────────── clothes ─────────────────────────────

/** A stuffed body round the post, from its hem up to its neck: rings [height, half-width, half-depth], closed flat at
 *  the hem and rounded at the neck. */
function body(rings: [number, number, number][], seg = 12): Shape {
  return loft(
    rings.map(([y, rx, rz]) => ({ c: [0, y, 0] as V3, rx, ry: rz })),
    { seg, steps: 1, up: [0, 0, 1], caps: [true, false], round: [0, 0.04], shape: (a) => squircle(a, 2.6) },
  )
}

/** A shirt's or a coat's body, from the hem at `hem` to the neck over the arms at `S`, `w` as wide. */
const torso = (hem: number, S: number, w = 1): [number, number, number][] => [
  [hem, 0.205 * w, 0.13],
  [hem + 0.08, 0.19 * w, 0.125],
  [S - 0.24, 0.185 * w, 0.12],
  [S - 0.04, 0.215 * w, 0.125],
  [S + 0.07, 0.16 * w, 0.105],
  [S + 0.12, 0.07, 0.06],
]

/** A sleeve stuffed round an arm's stick, sagging a little, from inside the body to its cuff (closed: straw comes out
 *  of it). */
function sleeve(a: Arm, r: [number, number, number] = [0.085, 0.078, 0.072], to = 0.56): Shape {
  return tube([a.at(0.06), a.at((0.06 + to) / 2), a.at(to)], r, { seg: 9, steps: 1, caps: [false, true] }).warp((x, y, z) => [x, y - 0.022 * smoothstep(0.1, 0.6, Math.abs(x)), z])
}

/** Two trouser legs hanging from inside the body at `hip`, down to the ankles at `ankle`. */
function legs(hip: number, ankle: number, r: [number, number, number] = [0.085, 0.08, 0.075]): Shape[] {
  return ([-1, 1] as const).map((side) =>
    tube(
      [
        [side * 0.09, hip + 0.12, 0],
        [side * 0.1, (hip + ankle) / 2, 0.015],
        [side * 0.105, ankle, 0.03],
      ],
      r,
      { seg: 9, steps: 1, caps: [false, true] },
    ),
  )
}
const ankleOf = (side: -1 | 1, ankle: number): V3 => [side * 0.105, ankle, 0.03]

/** A second colour's region with a crisp edge from a signed distance (metres, positive inside): the pattern layer
 *  draws its edge where the distance, interpolated across each triangle, crosses 0 — so it lands where it should
 *  between rings far apart (overalls painted over a shirt, a waistcoat between a coat's lapels). */
const inside = (d: number) => 0.5 + 25 * d

/** A thin cushion laid on a surface at `at`, facing `normal`: a patch, a pocket. */
function patch(at: V3, normal: V3, size: number, colour: V3, turn = 0.2): Shape {
  const pad = loft(
    [
      { c: [0, 0, -0.005], rx: size, ry: size },
      { c: [0, 0, 0.004], rx: size, ry: size },
    ],
    { seg: 8, steps: 1, caps: [true, true], shape: (a) => squircle(a, 5) },
  ).place([0, 0, 0], [0, 0, turn])
  return aim(pad, at, normal).fill(colour, 0)
}

/** A neckerchief: a collar round the neck and its knotted point down the chest. */
function kerchief(S: number, colour: V3): Shape {
  const collar = spin(
    [
      [0.07, S + 0.05],
      [0.125, S + 0.06],
      [0.12, S + 0.11],
      [0.065, S + 0.12],
    ],
    12,
  )
  const point = loft(
    [
      { c: [0, S + 0.08, 0.1], rx: 0.07, ry: 0.016 },
      { c: [0, S - 0.01, 0.135], rx: 0.035, ry: 0.012 },
      { c: [0, S - 0.07, 0.14], rx: 0, ry: 0 },
    ],
    { seg: 6, steps: 1, up: [0, 0, 1] },
  )
  return merge(collar, point).fill(colour, 0)
}

// ───────────────────────────── heads ─────────────────────────────

/** A burlap sack stuffed round the post's top and tied at the neck, its face stitched on: two button eyes, one bigger
 *  than the other, and a zigzag of stitches for a mouth. */
function sackHead(H: number, seed: number): Shape {
  const sack = loft(
    [
      { c: [0, H - 0.17, 0], rx: 0.055, ry: 0.055 },
      { c: [0, H - 0.14, 0], rx: 0.12, ry: 0.115 },
      { c: [0, H - 0.05, 0], rx: 0.17, ry: 0.16 },
      { c: [0, H + 0.05, 0], rx: 0.165, ry: 0.155 },
      { c: [0, H + 0.13, 0], rx: 0.115, ry: 0.11 },
    ],
    { seg: 12, steps: 2, up: [0, 0, 1], round: [0, 0.05], shape: (a, along) => 1 + 0.045 * Math.sin(a * 3 + along * 4 + seed) },
  )
  const head = sack
    .paint((x, y, z) => mixRgb(BURLAP, BURLAP_DARK, smoothstep(0.35, 0.75, fbm3(x * 9, y * 9, z * 9, 7 + seed))), 0)
    // the twine round the gather
    .pattern((_x, y) => 1 - smoothstep(0.006, 0.012, Math.abs(y - (H - 0.14))), TWINE)
  const parts: Shape[] = [head]
  // button eyes, of two sizes
  for (const side of [-1, 1]) {
    const big = side > 0 ? 1.3 : 1
    const eye = onto(sack, [side * 0.058, H + 0.01, 0.5])
    parts.push(
      ellipsoid(0.024 * big, 0.024 * big, 0.01, 8, 4)
        .place([eye.point[0], eye.point[1], eye.point[2] - 0.002], [0, side * 0.32, 0])
        .fill(BUTTON, 0),
    )
  }
  // the mouth: a stitched zigzag laid on the sack, its ends tapering into it
  const n = 7
  const wide = 0.07
  const mouth: V3[] = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const a = Math.PI * (1.15 + t * 0.7)
    const u = Math.cos(a) * wide
    const v = -0.035 + (k % 2 ? 0.012 : -0.006)
    const hit = onto(sack, [u, H - 0.02 + v, 0.5])
    mouth.push([hit.point[0], hit.point[1], hit.point[2] + 0.001])
  }
  const r = 0.007
  parts.push(tube(mouth, [0, ...mouth.slice(1, -1).map(() => r), 0], { seg: 4, steps: 1 }).fill(THREAD, 0))
  return merge(...parts)
}

/** A root carved into a face: a turnip (white, purple on top) or a mangel-wurzel (long, red-orange), with its root's
 *  tail down into the collar. */
function rootHead(H: number, kind: 'turnip' | 'mangel'): Shape {
  const t = kind === 'turnip'
  const profile: [number, number][] = t
    ? [
        [0, H - 0.27],
        [0.025, H - 0.2],
        [0.1, H - 0.14],
        [0.165, H - 0.05],
        [0.17, H + 0.03],
        [0.13, H + 0.1],
        [0.06, H + 0.125],
        [0, H + 0.13],
      ]
    : [
        [0, H - 0.29],
        [0.035, H - 0.22],
        [0.115, H - 0.13],
        [0.15, H - 0.02],
        [0.145, H + 0.07],
        [0.11, H + 0.14],
        [0.05, H + 0.17],
        [0, H + 0.175],
      ]
  const root = spin(profile, 16, { ring: (_i, a) => 1 + 0.025 * Math.sin(a * 3 + 1) })
  const skin = t
    ? root.paint((x, y, z) => mixRgb(TURNIP, TURNIP_TOP, smoothstep(H - 0.02, H + 0.07, y + 0.03 * (noise3(x * 12, 0, z * 12, 3) - 0.5))), 0)
    : root.paint((x, y, z) => mixRgb(MANGEL_LIGHT, MANGEL, smoothstep(H - 0.2, H + 0.02, y + 0.04 * (noise3(x * 10, y * 4, z * 10, 4) - 0.5))), 0)
  const parts: Shape[] = [skin]
  // carved: dark hollows laid into the skin — the turnip's triangle eyes and grin, the mangel's round eyes and an O
  const hollow = (u: number, v: number, rx: number, ry: number, seg: number, turn: number) => {
    const hit = onto(root, [u, H + v, 0.5])
    const pit = loft(
      [
        { c: [0, 0, -0.012], rx, ry },
        { c: [0, 0, 0.003], rx, ry },
      ],
      { seg, steps: 1, caps: [true, true] },
    ).place([0, 0, 0], [0, 0, turn])
    return aim(pit, hit.point, hit.normal).fill(CARVED, 0)
  }
  if (t) {
    for (const side of [-1, 1]) parts.push(hollow(side * 0.06, 0.02, 0.032, 0.032, 3, Math.PI / 2 + side * 0.15))
    parts.push(hollow(0, -0.022, 0.016, 0.016, 3, -Math.PI / 2))
    // the grin: a carved crescent with teeth
    const grin: V3[] = []
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI * (1.12 + (k / 6) * 0.76)
      const hit = onto(root, [Math.cos(a) * 0.085, H - 0.03 + Math.sin(a) * 0.05 + (k % 2 ? 0.006 : 0), 0.5])
      grin.push([hit.point[0], hit.point[1], hit.point[2] + 0.001])
    }
    parts.push(tube(grin, [0, 0.013, 0.015, 0.016, 0.015, 0.013, 0], { seg: 5, steps: 1 }).fill(CARVED, 0))
  } else {
    for (const side of [-1, 1]) parts.push(hollow(side * 0.055, 0.04, 0.022, 0.026, 8, 0))
    // a lopsided grin
    const grin: V3[] = []
    for (let k = 0; k <= 5; k++) {
      const a = Math.PI * (1.1 + (k / 5) * 0.8)
      const hit = onto(root, [Math.cos(a) * 0.075 + 0.008, H - 0.035 + Math.sin(a) * 0.04 + (k / 5) * 0.012, 0.5])
      grin.push([hit.point[0], hit.point[1], hit.point[2] + 0.001])
    }
    parts.push(tube(grin, [0, 0.011, 0.013, 0.013, 0.011, 0], { seg: 5, steps: 1 }).fill(CARVED, 0))
  }
  return merge(...parts)
}

// ───────────────────────────── hats ─────────────────────────────

/** A battered top hat, its band crimson, tilted on the head at `y`. */
function topHat(y: number): Shape {
  return spin(
    [
      [0, y - 0.004],
      [0.17, y - 0.008],
      [0.185, y + 0.006],
      [0.12, y + 0.014],
      [0.119, y + 0.042],
      [0.118, y + 0.12],
      [0.126, y + 0.25],
      [0.12, y + 0.262],
      [0, y + 0.266],
    ],
    16,
    { ring: (i, a) => (i >= 6 ? 1 + 0.06 * Math.sin(a * 2 + 0.6) : 1), lift: (i, a) => (i === 1 || i === 2 ? 0.02 * Math.pow(Math.cos(a), 4) : i >= 6 ? -0.012 * (0.5 + 0.5 * Math.cos(a - 0.8)) : 0) },
  )
    .paint(() => SOOT, 0)
    .pattern((_x, yy) => inside(Math.min(yy - y - 0.022, y + 0.064 - yy)), CRIMSON)
    .place([0, -y, 0])
    .place([0, y, 0], [0.04, 0, -0.12])
}

/** A wide-awake: a low round felt crown and a wide brim drooping at the edge. */
function wideAwake(y: number): Shape {
  return spin(
    [
      [0, y + 0.02],
      [0.15, y - 0.012],
      [0.26, y - 0.04],
      [0.285, y - 0.055],
      [0.29, y - 0.044],
      [0.26, y - 0.026],
      [0.14, y + 0.002],
      [0.136, y + 0.018],
      [0.13, y + 0.065],
      [0.09, y + 0.098],
      [0, y + 0.105],
    ],
    16,
    { lift: (i, a) => (i >= 2 && i <= 5 ? 0.03 * Math.max(0, Math.sin(a)) : 0) },
  )
    .paint(() => FELT, 0)
    .pattern((_x, yy) => inside(Math.min(yy - y - 0.006, y + 0.03 - yy)), mixRgb(FELT, BUTTON, 0.6))
}

/** A bowler: a round crown and a narrow brim curled up at the sides. */
function bowler(y: number): Shape {
  return spin(
    [
      [0, y - 0.004],
      [0.15, y - 0.008],
      [0.172, y + 0.0],
      [0.168, y + 0.012],
      [0.125, y + 0.012],
      [0.128, y + 0.024],
      [0.13, y + 0.06],
      [0.11, y + 0.11],
      [0.06, y + 0.132],
      [0, y + 0.136],
    ],
    16,
    { lift: (i, a) => (i >= 1 && i <= 3 ? 0.028 * Math.pow(Math.cos(a), 2) : 0) },
  )
    .paint(() => rgb(0x2f2622), 0)
    .pattern((_x, yy) => inside(Math.min(yy - y - 0.014, y + 0.034 - yy)), rgb(0x5a3028))
}

// ───────────────────────────── the three ─────────────────────────────

const wood = (shape: Shape) => ({ shape, material: { roughness: 0.9 } })
const cloth = (...shapes: Shape[]) => ({ shape: merge(...shapes), material: CLOTH })
const sackMaterial = { roughness: 0.95, detail: { scale: 220, bump: 0.003, shade: 0.16 } }
const strawPart = (...shapes: Shape[]) => ({ shape: merge(...shapes), material: { roughness: 0.8, doubleSided: true, leaf: true } })

/** Straw out of both cuffs, both ankles (when there are) and the neck. */
function strawOf(arms: Arm[], cuff: number, ankles: number | null, neck: number, seed: number, extra: Shape[] = []) {
  return strawPart(
    ...arms.map((a, k) => tuft(a.at(cuff), a.dir, seed + k)),
    ...(ankles === null ? [] : ([-1, 1] as const).map((s, k) => tuft(ankleOf(s, ankles), [0, -1, 0.15], seed + 5 + k, 5, 0.12))),
    tuft([0, neck, 0.02], [0, -0.6, 0.8], seed + 9, 5, 0.09),
    ...extra,
  )
}

/** The squire: a carved turnip under a battered top hat, a black tailcoat over a crimson waistcoat, grey trousers. */
export function squireScarecrow(): Model {
  const T = 1.92
  const S = T - 0.32
  const H = T - 0.03
  const hip = T - 0.8
  const arms = [arm(-1, 0, S), arm(1, 0, S)]
  const coat = body(torso(hip, S, 1.04))
  // the waistcoat and the shirt's front showing between the coat's lapels
  // (the lapels' V: wide over the chest, closing at the waist's button, the coat cut away below it)
  const opening = (x: number, y: number, z: number) => Math.min(z - 0.05, 0.025 + 0.3 * (y - hip - 0.08) - Math.abs(x), y - hip - 0.06)
  const top = coat.paint(() => SOOT, 1).pattern((x, y, z) => inside(opening(x, y, z)), CRIMSON)
  // the coat's tails, hanging behind the legs
  const tails = ([-1, 1] as const).map((side) =>
    loft(
      [
        { c: [side * 0.075, hip + 0.12, -0.085], rx: 0.075, ry: 0.016 },
        { c: [side * 0.085, hip - 0.12, -0.13], rx: 0.07, ry: 0.014 },
        { c: [side * 0.095, hip - 0.42, -0.15], rx: 0.05, ry: 0.012 },
      ],
      { seg: 6, steps: 1, up: [0, 0, 1], caps: [true, true], shape: (a) => squircle(a, 3) },
    ).fill(SOOT, 1),
  )
  const collar = spin(
    [
      [0.07, S + 0.05],
      [0.115, S + 0.06],
      [0.105, S + 0.135],
      [0.06, S + 0.14],
    ],
    12,
  ).fill(CREAM, 0)
  const leg = legs(hip, hip - 0.52).map((l) => l.fill(GREY, 1))
  const knee = onto(leg[0], [-0.1, hip - 0.28, 0.6])
  return {
    wood: wood(frame(T, arms)),
    cloth: cloth(top, ...tails, collar, ...arms.map((a) => sleeve(a).fill(SOOT, 1)), ...leg, patch(knee.point, knee.normal, 0.042, TWEED, 0.5)),
    head: { shape: rootHead(H, 'turnip'), material: { roughness: 0.6 } },
    hat: { shape: topHat(H + 0.09), material: { roughness: 0.75 } },
    straw: strawOf(arms, 0.56, hip - 0.52, H - 0.2, 31),
  }
}

/** The ploughman: a mangel-wurzel under a wide-awake hat, a long olive smock frock with its broad collar, corduroys and
 *  a red neckerchief, his arms hanging. */
export function ploughmanScarecrow(): Model {
  const T = 1.84
  const S = T - 0.32
  const H = T - 0.03
  const arms = [arm(-1, -0.24, S), arm(1, -0.18, S)]
  const hem = 0.66
  const smock = body([
    [hem, 0.27, 0.2],
    [hem + 0.1, 0.255, 0.19],
    [1.06, 0.215, 0.15],
    [S - 0.24, 0.195, 0.13],
    [S - 0.04, 0.22, 0.13],
    [S + 0.07, 0.16, 0.105],
    [S + 0.12, 0.07, 0.06],
  ])
    .paint(() => DRAB, 1)
    // the smocking: a panel of gathered stitches across the chest
    .pattern((x, y, z) => inside(Math.min(z - 0.02, 0.12 - Math.abs(x), y - S + 0.27, S - 0.05 - y)), DRAB_DARK)
  // its broad collar, lying over the shoulders
  const collar = spin(
    [
      [0.07, S + 0.09],
      [0.235, S + 0.0],
      [0.24, S + 0.014],
      [0.075, S + 0.11],
    ],
    14,
  )
    .warp((x, y, z) => [x, y, z * 0.6])
    .fill(mixRgb(DRAB, LINEN, 0.45), 1)
  const ankle = 0.48
  const leg = legs(1.0, ankle, [0.085, 0.082, 0.078]).map((l) => l.fill(CORDUROY, 1))
  const sleeves = arms.map((a) => sleeve(a, [0.09, 0.09, 0.078]).fill(DRAB, 1))
  return {
    wood: wood(frame(T, arms)),
    cloth: cloth(smock, collar, ...sleeves, ...leg, kerchief(S, CRIMSON)),
    head: { shape: rootHead(H, 'mangel'), material: { roughness: 0.55 } },
    hat: { shape: wideAwake(H + 0.1), material: { roughness: 0.9, detail: { scale: 260, bump: 0.0015, shade: 0.07 } } },
    straw: strawOf(arms, 0.56, ankle, H - 0.2, 41),
  }
}

/** The tattie bogle: a sack head under a bowler, a tweed jacket and a long tartan scarf blowing out behind, one arm
 *  up with a bird-scarer's clapper. */
export function bogleScarecrow(): Model {
  const T = 1.8
  const S = T - 0.32
  const H = T - 0.02
  const hip = T - 0.76
  const arms = [arm(-1, -0.15, S), arm(1, 0.95, S)]
  const jacket = body(torso(hip - 0.06, S, 1.02)).paint((x, y, z) => mixRgb(TWEED, TWEED_DARK, smoothstep(0.4, 0.7, fbm3(x * 20, y * 20, z * 20, 13))), 1)
  const leg = legs(hip, hip - 0.5).map((l) => l.fill(rgb(0x4c3b2e), 1))
  const knee = onto(leg[1], [0.1, hip - 0.25, 0.6])
  const sleeves = arms.map((a) => sleeve(a).paint((x, y, z) => mixRgb(TWEED, TWEED_DARK, smoothstep(0.4, 0.7, fbm3(x * 20, y * 20, z * 20, 13))), 1))
  // the long knitted scarf: round the neck, one end down the front and one blowing out behind
  const collar = spin(
    [
      [0.075, S + 0.04],
      [0.13, S + 0.05],
      [0.135, S + 0.12],
      [0.07, S + 0.13],
    ],
    12,
  )
  const hanging = loft(
    [
      { c: [0.06, S + 0.08, 0.1], rx: 0.045, ry: 0.014 },
      { c: [0.075, S - 0.1, 0.14], rx: 0.044, ry: 0.013 },
      { c: [0.085, S - 0.32, 0.135], rx: 0.042, ry: 0.012 },
    ],
    { seg: 8, steps: 3, up: [0, 0, 1], caps: [true, true], shape: (q) => squircle(q, 4) },
  )
  const flying = loft(
    [
      { c: [-0.08, S + 0.09, -0.08], rx: 0.044, ry: 0.013 },
      { c: [-0.22, S + 0.05, -0.2], rx: 0.044, ry: 0.013 },
      { c: [-0.38, S - 0.04, -0.27], rx: 0.042, ry: 0.012 },
    ],
    { seg: 8, steps: 3, up: [0, 1, 0.3], caps: [true, true], shape: (q) => squircle(q, 4) },
  )
  const scarf = merge(collar, hanging, flying)
    .paint(() => TARTAN_RED, 0)
    .pattern((x, y, z) => 0.5 + 0.5 * Math.sin((y * 1.0 - x * 0.7 - z * 0.7) * 55), TARTAN_GREEN)
  // the bird-scarer's clapper in the raised hand: a handle and two boards
  const hand = arms[1].at(0.64)
  const clapper = merge(
    tube([arms[1].at(0.5), hand, [hand[0] + 0.02, hand[1] + 0.1, 0.0]], 0.014, { seg: 5, steps: 1, round: [0, 0.01] }),
    ...[0.017, -0.017].map((dz) =>
      loft(
        [
          { c: [hand[0] + 0.025, hand[1] + 0.08, dz], rx: 0.045, ry: 0.009 },
          { c: [hand[0] + 0.04, hand[1] + 0.22, dz], rx: 0.045, ry: 0.009 },
        ],
        { seg: 4, steps: 1, up: [0, 0, 1], caps: [true, true], shape: (q) => squircle(q, 6) },
      ),
    ),
  ).paint((x, y, z) => mixRgb(POLE_GREY, CREAM, 0.2 + 0.3 * noise3(x * 30, y * 30, z * 30, 2)), 0)
  return {
    wood: wood(merge(frame(T, arms), clapper)),
    cloth: cloth(jacket, ...sleeves, ...leg, scarf, patch(knee.point, knee.normal, 0.045, TARTAN_RED, 0.3)),
    head: { shape: sackHead(H, 9), material: sackMaterial },
    hat: { shape: bowler(H + 0.085), material: { roughness: 0.7 } },
    straw: strawOf(arms, 0.56, hip - 0.5, H - 0.17, 51),
  }
}
