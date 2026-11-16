import { Group, Matrix4, Quaternion, Vector3, type Object3D } from 'three'
import { blade, ellipsoid, fbm3, loft, merge, mixRgb, noise3, rgb, smoothstep, squircle, tube, type Shape, type V3 } from '../../../../src/lib/sculpt'
import { CLOTH, HAT } from '../../../../src/models/person'
import { checkModel, modelGroup, trianglesOf, type LabModel } from '../../../three/model'
import { spin } from '../../../three/spin'

// Nine scarecrows for the beds (the board: ../index.tsx), three matching ones in each of three styles that farmers
// really made, each built with the kit as the game's farm things are — a post with its cross-stick, stuffed clothes
// with straw out of the cuffs, a head and a hat:
//
//   A  the American farm (the farm photographs of the 1930s; the Pennsylvania Germans' scarecrow and his wife): a
//      burlap sack for a head with a stitched face, a straw hat, a red work shirt and denim overalls; the wife in a
//      long dress, an apron and a sunbonnet; a child in dungarees, a neckerchief and a cap
//   B  the English and Scottish fields (the tattie bogle, the hodmedod, Worzel Gummidge): a carved turnip or a
//      mangel-wurzel for a head, cast-off clothes — the squire's top hat and tailcoat, the ploughman's smock frock and
//      wide-awake hat, the bogle's bowler, tweed jacket and long scarf, one arm up with a bird-scarer's clapper
//   C  the Japanese rice field (kakashi): one bamboo leg, a cloth face with the drawn face every child knows
//      (henohenomoheji), the farmer in a conical sedge hat and a straw rain cape, a woman in a kimono with an obi and
//      a headscarf, a child in a happi coat and a headband, arms up
//
// Each stands in its own frame facing +z, the ground under its post at the origin. Five parts each, one per material:
// the wood, the clothes, the head (with its face), the hat, and the straw (open blades, drawn from both sides).

// ───────────────────────────── colours ─────────────────────────────

const POLE = rgb(0x6e5238)
const POLE_LIGHT = rgb(0x8d6c4b)
const POLE_GREY = rgb(0x7a7166)
const BAMBOO = rgb(0xb7ad6a)
const BAMBOO_NODE = rgb(0x7e7440)
const STRAW = rgb(0xe0c06a)
const STRAW_DARK = rgb(0xb9933e)
const BURLAP = rgb(0xc8a46c)
const BURLAP_DARK = rgb(0xa98652)
const THREAD = rgb(0x3b2a1e)
const TWINE = rgb(0x7a5a32)
const BUTTON = rgb(0x2a1d16)
const INK = rgb(0x1e1a1c)
const BAND = rgb(0x8a4b3a) // the people engine's hat band (src/models/person.ts HAT_BAND)

// the American farm: barn red, denim, mustard and cream
const BARN = rgb(0xb5523a)
const DENIM = rgb(0x41658f)
const DENIM_LIGHT = rgb(0x6283ad)
const MUSTARD = rgb(0xd9a441)
const CREAM = rgb(0xf0e6cf)
const DRESS = rgb(0x6f8fbf)
// the English fields: soot black, crimson, linen, corduroy, tweed
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
// the rice field: indigo, vermilion, sedge, cloth white, gold
const INDIGO = rgb(0x2f4a7a)
const VERMILION = rgb(0xc8452f)
const KIMONO = rgb(0xa8384a)
const GOLD = rgb(0xd9a441)
const CLOTH_WHITE = rgb(0xf2ede0)
const MINO = rgb(0xcaa862)
const MINO_DARK = rgb(0x8a6a35)
const SEDGE = rgb(0xcdb177)
const SEDGE_DARK = rgb(0xa88a52)

export type ScarecrowPart = 'wood' | 'cloth' | 'head' | 'hat' | 'straw'

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

/** The post (from the ground up into the head) and the arms' sticks, plain wood, grey weathered wood or bamboo. */
function frame(top: number, arms: Arm[], kind: 'wood' | 'grey' | 'bamboo'): Shape {
  if (kind === 'bamboo') {
    // a bamboo pole with its nodes (a darker, fatter ring every so often), and one straight cross-stick through it
    const nodes = [0.24, 0.5, 0.76]
    const pts: V3[] = [[0, -0.02, 0]]
    const radii: number[] = [0.03]
    for (const n of nodes) {
      pts.push([0, n - 0.025, 0], [0, n, 0], [0, n + 0.025, 0])
      radii.push(0.03, 0.035, 0.03)
    }
    pts.push([0, top, 0])
    radii.push(0.028)
    const pole = tube(pts, radii, { seg: 7, steps: 1, caps: [true, true] })
    const sticks = arms.map((a) => tube([a.at(0.02), a.at(0.5), a.at(0.7)], 0.02, { seg: 6, steps: 1, caps: [false, true] }))
    const node = (y: number) => nodes.some((n) => Math.abs(y - n) < 0.004)
    return merge(pole, ...sticks).paint((x, y, z) => (node(y) ? BAMBOO_NODE : mixRgb(BAMBOO, BAMBOO_NODE, 0.15 * noise3(x * 30, y * 3, z * 30, 5))), 0)
  }
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
  const [dark, light] = kind === 'grey' ? [POLE_GREY, mixRgb(POLE_GREY, CREAM, 0.3)] : [POLE, POLE_LIGHT]
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

/** A kimono's sleeve: deep and square, hanging from the arm, its opening dark. */
function kimonoSleeve(a: Arm, colour: V3, deep: number, to = 0.5): Shape {
  const s = loft(
    [
      { c: a.at(0.03), rx: 0.05, ry: deep * 0.55 },
      { c: a.at((0.03 + to) / 2), rx: 0.065, ry: deep },
      { c: a.at(to), rx: 0.065, ry: deep },
    ],
    { seg: 10, steps: 1, up: [0, 1, 0], caps: [false, true], shape: (q) => squircle(q, 4) },
  )
  const ends = s.ends!
  // hangs below the arm: the stick runs through its top
  return s.warp((x, y, z) => [x, y - deep * 0.62 + 0.02, z]).paint((_x, _y, _z, k) => (k >= ends ? mixRgb(colour, BUTTON, 0.7) : colour), 1)
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

/** A flat band laid along points (a collar's edge, a strap): wide across, thin out of the surface, closed at its ends. */
function band(points: V3[], wide: number, thick = 0.006): Shape {
  return loft(
    points.map((c, k) => (k === 0 || k === points.length - 1 ? { c, rx: 0, ry: 0 } : { c, rx: wide, ry: thick })),
    { seg: 6, steps: 1, up: [0, 0, 1] },
  )
}

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

/** A panel laid down the front of a body (an apron, a bib), following its surface from `top` to `bottom`. */
function panel(surface: Shape, top: number, bottom: number, w: [number, number], colour: V3, x = 0): Shape {
  const rings = [0, 0.5, 1].map((t) => {
    const y = top + (bottom - top) * t
    const hit = onto(surface, [x, y, 0.6])
    return { c: [x, y, hit.point[2] + 0.004] as V3, rx: w[0] + (w[1] - w[0]) * t, ry: 0.009 }
  })
  return loft(rings, { seg: 8, steps: 1, up: [0, 0, 1], caps: [true, true], shape: (a) => squircle(a, 4) }).fill(colour, 0)
}

/** Two straps from a bib's top over the shoulders, their ends tucked into the body. */
function straps(S: number, front: number, colour: V3): Shape[] {
  return ([-1, 1] as const).map((side) =>
    tube(
      [
        [side * 0.085, S - 0.12, front - 0.03],
        [side * 0.1, S - 0.06, front + 0.008],
        [side * 0.115, S + 0.05, 0.085],
        [side * 0.11, S + 0.07, 0.0],
      ],
      0.016,
      { seg: 5, steps: 1 },
    ).fill(colour, 1),
  )
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

// ───────────────────────────── heads and faces ─────────────────────────────

/** A burlap sack stuffed round the post's top and tied at the neck, its face stitched on. */
function sackHead(H: number, face: 'smile' | 'sweet' | 'grin' | 'zigzag', seed: number): Shape {
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
  if (face === 'sweet') head.blend(rgb(0xd77a6a), (x, y, z) => (z > 0 ? 0.55 * (1 - smoothstep(0.0, 0.035, Math.hypot(Math.abs(x) - 0.085, y - (H - 0.035)))) : 0))
  const parts: Shape[] = [head]
  // button eyes (the bogle's two of different sizes)
  for (const side of [-1, 1]) {
    const big = face === 'zigzag' && side > 0 ? 1.3 : 1
    const eye = onto(sack, [side * 0.058, H + 0.01, 0.5])
    parts.push(
      ellipsoid(0.024 * big, 0.024 * big, 0.01, 8, 4)
        .place([eye.point[0], eye.point[1], eye.point[2] - 0.002], [0, side * 0.32, 0])
        .fill(BUTTON, 0),
    )
  }
  // the mouth: a stitched line laid on the sack, its ends tapering into it
  const n = face === 'zigzag' ? 7 : 6
  const wide = face === 'grin' ? 0.085 : face === 'sweet' ? 0.05 : 0.07
  const mouth: V3[] = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const a = Math.PI * (1.15 + t * 0.7)
    const u = Math.cos(a) * wide
    const v = face === 'zigzag' ? -0.035 + (k % 2 ? 0.012 : -0.006) : Math.sin(a) * (face === 'grin' ? 0.06 : 0.045) + 0.01
    const hit = onto(sack, [u, H - 0.02 + v, 0.5])
    mouth.push([hit.point[0], hit.point[1], hit.point[2] + 0.001])
  }
  const r = face === 'grin' ? 0.009 : 0.007
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

/** A cloth stuffed into a ball and tied at the neck (the kakashi's face), the face drawn on it in ink: へのへのもへじ
 *  (he-no-he-no-mo-he-ji) — two へ the brows, two の the eyes, も the nose, へ the mouth, じ the cheek and chin. */
function clothHead(H: number, scale = 1): Shape {
  const k = scale
  const ball = spin(
    [
      [0, H - 0.23 * k],
      [0.04 * k, H - 0.2 * k],
      [0.05 * k, H - 0.17 * k],
      [0.12 * k, H - 0.13 * k],
      [0.16 * k, H - 0.05 * k],
      [0.163 * k, H + 0.03 * k],
      [0.14 * k, H + 0.1 * k],
      [0.08 * k, H + 0.145 * k],
      [0, H + 0.16 * k],
    ],
    14,
  ).paint((x, y, z) => {
    // the gather tied at the neck a little darker, the cloth's folds faint
    const tie = 1 - smoothstep(0.0, 0.02 * k, Math.abs(y - (H - 0.17 * k)))
    return mixRgb(mixRgb(CLOTH_WHITE, rgb(0xd8cfbb), 0.5 * fbm3(x * 14, y * 14, z * 14, 2)), TWINE, tie * 0.8)
  }, 0)
  // a stroke of ink through points in the face's plane (u across, v up, metres for a head of scale 1)
  const stroke = (pts: [number, number][], r = 0.0068) => {
    const on = pts.map(([u, v]): V3 => {
      const hit = onto(ball, [u * k, H + v * k, 0.6])
      return [hit.point[0], hit.point[1], hit.point[2] + 0.0015]
    })
    return tube(on, [0, ...on.slice(1, -1).map(() => r * k), 0], { seg: 4, steps: 1 })
  }
  const he = (u: number, v: number, w: number, h: number): [number, number][] => [
    [u - w, v - h],
    [u - w * 0.35, v + h * 0.7],
    [u + w, v - h * 0.8],
  ]
  const no = (u: number, v: number, r: number): [number, number][] => {
    const pts: [number, number][] = [
      [u + 0.004, v + 0.012],
      [u - 0.002, v - 0.003],
      [u - 0.009, v - 0.015],
    ]
    for (const deg of [215, 175, 130, 85, 40, -5, -50, -85]) pts.push([u + Math.cos((deg * Math.PI) / 180) * r, v + Math.sin((deg * Math.PI) / 180) * r * 0.95])
    return pts
  }
  const ink = [
    stroke(he(-0.062, 0.062, 0.028, 0.01)),
    stroke(he(0.052, 0.062, 0.028, 0.01)),
    stroke(no(-0.06, 0.012, 0.022)),
    stroke(no(0.05, 0.012, 0.022)),
    // も: a hook down the middle and two bars across it
    stroke([
      [-0.003, 0.03],
      [-0.006, 0.0],
      [-0.004, -0.022],
      [0.008, -0.03],
      [0.016, -0.018],
    ]),
    stroke([
      [-0.017, 0.012],
      [-0.002, 0.014],
      [0.014, 0.015],
    ]),
    stroke([
      [-0.019, -0.004],
      [-0.003, -0.002],
      [0.016, -0.001],
    ]),
    // the mouth, a wide へ
    stroke(he(0.0, -0.072, 0.045, 0.012), 0.0075),
    // じ round the right cheek to the chin, and its two marks
    stroke([
      [0.1, 0.06],
      [0.108, 0.01],
      [0.104, -0.04],
      [0.086, -0.085],
      [0.05, -0.112],
      [0.018, -0.118],
    ]),
    stroke([
      [0.112, 0.092],
      [0.117, 0.085],
      [0.121, 0.077],
    ]),
    stroke([
      [0.124, 0.098],
      [0.129, 0.09],
      [0.132, 0.082],
    ]),
  ]
  return merge(ball, merge(...ink).fill(INK, 0))
}

// ───────────────────────────── hats ─────────────────────────────

/** The game's straw sun hat, round the head at `y` (its brim's height). */
function strawHat(y: number, brim = 0.3): Shape {
  return spin(
    [
      [0, y + 0.03],
      [0.13, y - 0.012],
      [brim * 0.8, y - 0.02],
      [brim, y - 0.036],
      [brim + 0.004, y - 0.026],
      [brim * 0.8, y - 0.008],
      [0.135, y + 0.0],
      [0.133, y + 0.022],
      [0.13, y + 0.08],
      [0.11, y + 0.128],
      [0, y + 0.138],
    ],
    16,
  )
    .paint(() => STRAW, 0)
    .pattern((x, yy, z) => 0.5 + 0.5 * Math.sin(Math.hypot(x, z) * 160 + yy * 160), STRAW_DARK)
    .blend(BAND, (x, yy, z) => (Math.hypot(x, z) < 0.14 && yy > y + 0.015 && yy < y + 0.03 ? 1 : 0))
}

/** A sunbonnet: a deep brim standing round the face, a crown over the back of the head, a frill over the neck. */
function bonnet(H: number, colour: V3): Shape {
  const ring: V3[] = []
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI * (-0.14 + (k / 8) * 1.28)
    ring.push([Math.cos(a) * 0.185, H + 0.0 + Math.sin(a) * 0.19, 0.075])
  }
  const brim = tube(ring, 0.07, { seg: 8, steps: 1, round: [0.012, 0.012], up: [0, 0, 1] })
    // the ring's section: thin across, deep from front to back
    .warp((x, y, z) => {
      const dx = x
      const dy = y - H
      const l = Math.hypot(dx, dy) || 1
      const radial = l - 0.185
      const s = 0.2
      return [x - (dx / l) * radial * (1 - s), y - (dy / l) * radial * (1 - s), z]
    })
  const crown = ellipsoid(0.18, 0.175, 0.17, 12, 6).place([0, H + 0.03, -0.035])
  const frill = ellipsoid(0.17, 0.07, 0.11, 10, 4).place([0, H - 0.13, -0.09], [0.35, 0, 0])
  return merge(brim, crown, frill).fill(colour, 0)
}

/** A cap with a peak, turned a little to one side. */
function cap(y: number, colour: V3, turn = 0.35): Shape {
  const crown = spin(
    [
      [0, y - 0.01],
      [0.15, y - 0.005],
      [0.152, y + 0.04],
      [0.12, y + 0.1],
      [0.05, y + 0.125],
      [0, y + 0.128],
    ],
    14,
  )
  const peak = loft(
    [
      { c: [0, y + 0.012, 0.1], rx: 0.11, ry: 0.009 },
      { c: [0, y + 0.0, 0.2], rx: 0.1, ry: 0.008 },
      { c: [0, y - 0.012, 0.25], rx: 0.07, ry: 0.007 },
    ],
    { seg: 8, steps: 1, up: [0, 1, 0], caps: [true, true], shape: (a) => squircle(a, 3) },
  )
  return merge(crown, peak).fill(colour, 0).place([0, 0, 0], [0, turn, 0])
}

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

/** A sugegasa: the wide flat cone of woven sedge the rice farmer wears, its rings of weave light and dark. */
function sugegasa(y: number): Shape {
  const profile: [number, number][] = [
    [0, y + 0.07],
    [0.31, y - 0.004],
    [0.325, y + 0.006],
    [0.24, y + 0.05],
    [0.16, y + 0.093],
    [0.08, y + 0.135],
    [0, y + 0.175],
  ]
  return spin(profile, 20, { paint: (i) => (i >= 2 && i % 2 === 1 ? SEDGE_DARK : SEDGE) })
}

/** A headscarf tied over the head (a tenugui): a cloth over the top and back, its knot on top. */
function headscarf(H: number, colour: V3): Shape {
  // a cap of cloth a little bigger than the head, tilted back round the head's middle: high over the brow, low behind
  const tilt = 0.45
  const cloth = spin(
    [
      [0, H + 0.02],
      [0.172, H + 0.02],
      [0.176, H + 0.055],
      [0.15, H + 0.118],
      [0.088, H + 0.162],
      [0, H + 0.177],
    ],
    14,
  ).warp((x, y, z) => [x, H + (y - H) * Math.cos(tilt) + z * Math.sin(tilt), -(y - H) * Math.sin(tilt) + z * Math.cos(tilt)])
  const knot = merge(
    ellipsoid(0.038, 0.03, 0.034, 8, 4).place([0.0, H + 0.16, 0.035]),
    ellipsoid(0.052, 0.016, 0.03, 8, 3).place([0.045, H + 0.165, 0.045], [0, 0, -0.5]),
    ellipsoid(0.052, 0.016, 0.03, 8, 3).place([-0.045, H + 0.165, 0.045], [0, 0, 0.5]),
  )
  // a cream band along its edge (measured in the cap's own frame, before the tilt)
  const edge = (y: number, z: number) => (y - H) * Math.cos(tilt) - z * Math.sin(tilt)
  return merge(cloth, knot)
    .fill(colour, 0)
    .pattern((_x, y, z) => inside(Math.min(edge(y, z) - 0.01, 0.045 - edge(y, z))), CREAM)
}

/** A headband (a hachimaki) round the brow, its knot's ends out at the side. */
function hachimaki(H: number, scale: number): Shape {
  const k = scale
  const ring = spin(
    [
      [0.13 * k, H + 0.072 * k],
      [0.155 * k, H + 0.07 * k],
      [0.138 * k, H + 0.118 * k],
      [0.112 * k, H + 0.12 * k],
    ],
    16,
  )
  const ends = [0.5, -0.1].map((tilt, i) =>
    loft(
      [
        { c: [0.12 * k, H + 0.095 * k, -0.06 * k], rx: 0.02, ry: 0.006 },
        { c: [0.19 * k, H + (0.1 - i * 0.03) * k, -0.12 * k], rx: 0.022, ry: 0.006 },
        { c: [0.23 * k, H + (0.07 - i * 0.07) * k, -0.16 * k], rx: 0, ry: 0 },
      ],
      { seg: 6, steps: 1, up: [Math.sin(tilt), Math.cos(tilt), 0] },
    ),
  )
  return merge(ring, ...ends).fill(CLOTH_WHITE, 0)
}

// ───────────────────────────── the nine ─────────────────────────────

export type SetId = 'a' | 'b' | 'c'

export interface Scarecrow {
  id: string
  /** its name in the board, in Hebrew */
  name: string
  model: () => LabModel<ScarecrowPart>
}

type Model = LabModel<ScarecrowPart>
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

// ── A: the American farm

function farmer(): Model {
  const T = 1.84
  const S = T - 0.32
  const H = T - 0.02
  const hip = T - 0.76
  const arms = [arm(-1, 0, S), arm(1, 0, S)]
  const shirt = body(torso(hip, S))
  // overalls: the lower body and the bib painted denim, over the red shirt (the shirt's own rings, no more)
  const overalls = (x: number, y: number, z: number) => Math.max(hip + 0.2 - y, Math.min(z - 0.04, 0.12 - Math.abs(x), S - 0.1 - y))
  const top = shirt.paint(() => BARN, 1).pattern((x, y, z) => inside(overalls(x, y, z)), DENIM)
  const front = onto(shirt, [0, S - 0.12, 0.6]).point[2]
  const leg = legs(hip, hip - 0.5)
  const knee = onto(leg[1], [0.1, hip - 0.25, 0.6])
  const sleeves = arms.map((a) => sleeve(a).fill(BARN, 1))
  const elbow = onto(sleeves[0], [-0.4, S + 0.2, 0], [0, -1, 0])
  return {
    wood: wood(frame(T, arms, 'wood')),
    cloth: cloth(top, ...sleeves, ...leg.map((l) => l.fill(DENIM, 1)), ...straps(S, front, DENIM), patch(knee.point, knee.normal, 0.045, MUSTARD), patch(elbow.point, elbow.normal, 0.035, CREAM, 0.6)),
    head: { shape: sackHead(H, 'smile', 0), material: sackMaterial },
    hat: { shape: strawHat(H + 0.075), material: HAT },
    straw: strawOf(arms, 0.56, hip - 0.5, H - 0.17, 3),
  }
}

function farmWife(): Model {
  const T = 1.74
  const S = T - 0.32
  const H = T - 0.02
  const arms = [arm(-1, -0.12, S), arm(1, -0.12, S)]
  const hem = 0.5
  const dress = body([
    [hem, 0.3, 0.24],
    [hem + 0.1, 0.275, 0.215],
    [0.92, 0.205, 0.155],
    [S - 0.3, 0.165, 0.115],
    [S - 0.12, 0.19, 0.125],
    [S - 0.03, 0.21, 0.125],
    [S + 0.07, 0.155, 0.1],
    [S + 0.12, 0.07, 0.06],
  ]).fill(DRESS, 1)
  const apron = panel(dress, S - 0.29, hem + 0.1, [0.13, 0.2], CREAM)
  // a pocket on the apron
  const pocket = onto(apron, [0.07, S - 0.52, 0.6])
  const sleeves = arms.map((a) => sleeve(a, [0.08, 0.075, 0.07]).fill(DRESS, 1))
  // yarn braids from under the bonnet, tied with red bows
  const braids = ([-1, 1] as const).map((side) =>
    tube(
      [
        [side * 0.12, H - 0.04, -0.02],
        [side * 0.15, H - 0.14, 0.02],
        [side * 0.14, H - 0.25, 0.08],
        [side * 0.13, H - 0.3, 0.1],
      ],
      [0.03, 0.028, 0.025, 0],
      { seg: 6, steps: 1 },
    )
      .paint(() => STRAW, 0)
      .pattern((_x, y) => 0.5 + 0.5 * Math.sin(y * 140), STRAW_DARK),
  )
  const bows = ([-1, 1] as const).map((side) =>
    ellipsoid(0.03, 0.018, 0.016, 8, 3)
      .place([side * 0.142, H - 0.22, 0.066], [0.4, 0, 0])
      .fill(BARN, 0),
  )
  return {
    wood: wood(frame(T, arms, 'wood')),
    cloth: cloth(dress, apron, patch(pocket.point, pocket.normal, 0.04, DENIM_LIGHT, 0), ...sleeves),
    head: { shape: merge(sackHead(H, 'sweet', 2), ...braids, ...bows), material: sackMaterial },
    hat: { shape: bonnet(H, BARN), material: CLOTH },
    // straw out of the cuffs and from under the hem, round the post
    straw: strawOf(arms, 0.56, null, H - 0.17, 11, [tuft([0, hem + 0.03, 0], [0, -1, 0], 4, 7, 0.14)]),
  }
}

function farmChild(): Model {
  const T = 1.42
  const S = T - 0.27
  const H = T - 0.01
  const hip = T - 0.62
  const arms = [arm(-1, 0.3, S), arm(1, 0.55, S)]
  const shirt = body(torso(hip, S, 0.86).map(([y, rx, rz]) => [y, rx, rz * 0.9] as [number, number, number]))
  const dungarees = (x: number, y: number, z: number) => Math.max(hip + 0.16 - y, Math.min(z - 0.04, 0.1 - Math.abs(x), S - 0.09 - y))
  const top = shirt.paint(() => MUSTARD, 1).pattern((x, y, z) => inside(dungarees(x, y, z)), DENIM_LIGHT)
  const front = onto(shirt, [0, S - 0.11, 0.6]).point[2]
  const ankle = hip - 0.42
  // rolled-up cuffs: the legs' ends a lighter turn of denim
  const leg = legs(hip, ankle, [0.075, 0.07, 0.07]).map((l) => l.paint((_x, y) => (y < ankle + 0.06 ? mixRgb(DENIM_LIGHT, CREAM, 0.45) : DENIM_LIGHT), 1))
  const knee = onto(leg[0], [-0.1, hip - 0.2, 0.6])
  const sleeves = arms.map((a) => sleeve(a, [0.072, 0.068, 0.064], 0.46).fill(MUSTARD, 1))
  const scale = 0.88
  const head = sackHead(0, 'grin', 5).place([0, H, 0], [0, 0, 0], scale)
  return {
    wood: wood(frame(T, arms, 'wood')),
    cloth: cloth(top, ...sleeves, ...leg, ...straps(S + 0.01, front, DENIM_LIGHT), patch(knee.point, knee.normal, 0.04, BARN, -0.3), kerchief(S - 0.01, BARN)),
    head: { shape: head, material: sackMaterial },
    hat: { shape: cap(H + 0.05, BARN), material: CLOTH },
    straw: strawOf(arms, 0.46, ankle, H - 0.17 * scale, 21),
  }
}

// ── B: the English fields

function squire(): Model {
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
    wood: wood(frame(T, arms, 'grey')),
    cloth: cloth(top, ...tails, collar, ...arms.map((a) => sleeve(a).fill(SOOT, 1)), ...leg, patch(knee.point, knee.normal, 0.042, TWEED, 0.5)),
    head: { shape: rootHead(H, 'turnip'), material: { roughness: 0.6 } },
    hat: { shape: topHat(H + 0.09), material: { roughness: 0.75 } },
    straw: strawOf(arms, 0.56, hip - 0.52, H - 0.2, 31),
  }
}

function ploughman(): Model {
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
    wood: wood(frame(T, arms, 'grey')),
    cloth: cloth(smock, collar, ...sleeves, ...leg, kerchief(S, CRIMSON)),
    head: { shape: rootHead(H, 'mangel'), material: { roughness: 0.55 } },
    hat: { shape: wideAwake(H + 0.1), material: { roughness: 0.9, detail: { scale: 260, bump: 0.0015, shade: 0.07 } } },
    straw: strawOf(arms, 0.56, ankle, H - 0.2, 41),
  }
}

function bogle(): Model {
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
    wood: wood(merge(frame(T, arms, 'grey'), clapper)),
    cloth: cloth(jacket, ...sleeves, ...leg, scarf, patch(knee.point, knee.normal, 0.045, TARTAN_RED, 0.3)),
    head: { shape: sackHead(H, 'zigzag', 9), material: sackMaterial },
    hat: { shape: bowler(H + 0.085), material: { roughness: 0.7 } },
    straw: strawOf(arms, 0.56, hip - 0.5, H - 0.17, 51),
  }
}

// ── C: the rice field

/** The straw rain cape (a mino): two tiers of straw from the neck down to the knees, their edges ragged. */
function mino(S: number, hem: number): Shape {
  const mid = (S + hem) / 2 + 0.05
  const ragged = (i: number, a: number) => (i === 1 || i === 2 || i === 5 || i === 6 ? 1 + 0.08 * Math.sin(a * 11) + 0.06 * Math.sin(a * 23 + 1) : 1)
  return spin(
    [
      [0, hem + 0.12],
      [0.2, hem + 0.02],
      [0.31, hem - 0.01],
      [0.3, hem + 0.06],
      [0.25, mid - 0.06],
      [0.22, mid],
      [0.29, mid - 0.02],
      [0.28, mid + 0.06],
      [0.24, S + 0.02],
      [0.13, S + 0.12],
      [0, S + 0.16],
    ],
    22,
    {
      ring: ragged,
      lift: (i, a) => (i === 2 || i === 6 ? -0.025 * (0.5 + 0.5 * Math.sin(a * 11)) : 0),
      // streaks of straw down it: every other vertex round a ring lighter
      paint: (i, a) => mixRgb(MINO_DARK, MINO, (Math.round((a / (Math.PI * 2)) * 22) % 2 ? 0.9 : 0.25) * (i >= 2 ? 1 : 0.5)),
    },
  ).warp((x, y, z) => [x, y, z * 0.82])
}

function kakashi(): Model {
  const T = 1.7
  const S = T - 0.3
  const H = T - 0.01
  const arms = [arm(-1, 0, S), arm(1, 0, S)]
  return {
    wood: wood(frame(T, arms, 'bamboo')),
    cloth: cloth(...arms.map((a) => kimonoSleeve(a, INDIGO, 0.13, 0.5))),
    head: { shape: clothHead(H), material: CLOTH },
    hat: { shape: merge(sugegasa(H + 0.08), mino(S, 0.62)), material: { roughness: 0.9, detail: { scale: 180, bump: 0.003, shade: 0.12 } } },
    straw: strawPart(...arms.map((a, k) => tuft(a.at(0.5), a.dir, 61 + k, 5, 0.12))),
  }
}

function kakashiWoman(): Model {
  const T = 1.66
  const S = T - 0.3
  const H = T - 0.01
  const arms = [arm(-1, -0.05, S), arm(1, -0.05, S)]
  const hem = 0.5
  const kimono = body([
    [hem, 0.21, 0.17],
    [hem + 0.12, 0.195, 0.16],
    [0.95, 0.175, 0.135],
    [S - 0.24, 0.175, 0.125],
    [S - 0.04, 0.2, 0.125],
    [S + 0.07, 0.15, 0.1],
    [S + 0.12, 0.07, 0.06],
  ]).fill(KIMONO, 1)
  const obiY = S - 0.27
  // the obi: a wide sash round the waist (its inner edges inside the kimono), its knot a box on the back
  const obi = spin(
    [
      [0.16, obiY - 0.08],
      [0.188, obiY - 0.075],
      [0.192, obiY + 0.075],
      [0.16, obiY + 0.08],
    ],
    14,
  ).warp((x, y, z) => [x, y, z * 0.72])
  const bow = loft(
    [
      { c: [0, obiY + 0.02, -0.12], rx: 0.13, ry: 0.03 },
      { c: [0, obiY + 0.02, -0.19], rx: 0.15, ry: 0.035 },
    ],
    { seg: 8, steps: 1, up: [0, 0, 1], caps: [true, true], shape: (q) => squircle(q, 4) },
  ).warp((x, y, z) => [x, y + (z < -0.15 ? 0.06 : 0), z])
  // the white under-collar, crossing left over right at the throat, its ends tucked into the kimono
  const v = ([-1, 1] as const).map((side) =>
    band(
      [0.12, 0.08, 0.03, -0.015].map((d, k): V3 => {
        const x = side * [0.065, 0.05, 0.022, -0.004][k]
        const y = S + d
        const lift = side < 0 ? 0.008 : 0.004
        return [x, y, onto(kimono, [x, y, 0.6]).point[2] + (k === 0 || k === 3 ? -0.02 : lift)]
      }),
      0.02,
    ),
  )
  return {
    wood: wood(frame(T, arms, 'bamboo')),
    cloth: cloth(kimono, merge(obi, bow).fill(GOLD, 0), merge(...v).fill(CLOTH_WHITE, 0), ...arms.map((a) => kimonoSleeve(a, KIMONO, 0.17, 0.48))),
    head: { shape: clothHead(H), material: CLOTH },
    hat: { shape: headscarf(H, INDIGO), material: CLOTH },
    straw: strawPart(...arms.map((a, k) => tuft(a.at(0.48), a.dir, 71 + k, 5, 0.1)), tuft([0, hem + 0.02, 0], [0, -1, 0], 7, 7, 0.12)),
  }
}

function kakashiChild(): Model {
  const T = 1.38
  const S = T - 0.26
  const H = T - 0.01
  const arms = [arm(-1, 0.55, S), arm(1, 0.55, S)]
  const hem = 0.66
  const happi = body(torso(hem, S, 0.9).map(([y, rx, rz]) => [y, rx, rz * 0.9] as [number, number, number])).paint(() => VERMILION, 1)
  // the happi's collar band, white, down both edges of its front
  const bands = ([-1, 1] as const).map((side) => {
    const pts = [S + 0.1, S + 0.05, S - 0.06, hem + 0.2, hem + 0.06, hem + 0.0].map((y, k): V3 => {
      const x = side * [0.075, 0.062, 0.036, 0.034, 0.034, 0.034][k]
      const hit = onto(happi, [x, y, 0.6])
      // its ends tucked in: at the neck, and under the hem
      return [x, y, hit.point[2] + (k === 0 || k === 5 ? -0.02 : 0.004)]
    })
    return band(pts, 0.022)
  })
  const scale = 0.85
  return {
    wood: wood(frame(T, arms, 'bamboo')),
    cloth: cloth(happi, merge(...bands).fill(CLOTH_WHITE, 0), ...arms.map((a) => kimonoSleeve(a, VERMILION, 0.1, 0.4))),
    head: { shape: clothHead(H, scale), material: CLOTH },
    hat: { shape: hachimaki(H, scale), material: CLOTH },
    straw: strawPart(...arms.map((a, k) => tuft(a.at(0.4), a.dir, 81 + k, 5, 0.1)), tuft([0, hem + 0.02, 0], [0, -1, 0], 8, 6, 0.12)),
  }
}

export const SETS: Record<SetId, Scarecrow[]> = {
  a: [
    { id: 'a1', name: 'האיכר', model: farmer },
    { id: 'a2', name: 'אשת האיכר', model: farmWife },
    { id: 'a3', name: 'הילד', model: farmChild },
  ],
  b: [
    { id: 'b1', name: 'האדון בכובע צילינדר', model: squire },
    { id: 'b2', name: 'החורש בחלוק', model: ploughman },
    { id: 'b3', name: 'הבוגל עם הרעשן', model: bogle },
  ],
  c: [
    { id: 'c1', name: 'קקאשי עם כובע קש וגלימת קש', model: kakashi },
    { id: 'c2', name: 'קקאשי בקימונו', model: kakashiWoman },
    { id: 'c3', name: 'קקאשי ילד בהאפי', model: kakashiChild },
  ],
}

/** The most a scarecrow may draw: about the decoration's tree (1,328) and a third more — a figure with a face, a hat
 *  and straw — and under the first round's (2,266–3,024). */
export const SCARECROW_WEIGHT = 1800

/** A scarecrow as meshes, facing +z in its own frame. */
export function scarecrowObject(s: Scarecrow): Object3D {
  const g = new Group()
  g.add(modelGroup(s.model(), `scarecrow-${s.id}`))
  return g
}

export const scarecrowTriangles = (s: Scarecrow) => trianglesOf(s.model())
export const setTriangles = (set: SetId) => SETS[set].map(scarecrowTriangles)
export const setChecks = (set: SetId) => SETS[set].flatMap((s) => checkModel(`scarecrow ${s.id}`, s.model()))
