import { Matrix4, Quaternion, Vector3 } from 'three'
import { blade, blob, ellipsoid, fbm3, lathe, loft, merge, mixRgb, noise3, rgb, smoothstep, spin, squircle, tube, type Shape, type V3 } from '../lib/sculpt'
import { CLOTH } from './person'
import type { Structure, StructurePart } from './structures'

// Nine scarecrows for the farm's decoration (src/farm/decor.ts), three styles of three, each style one family (its
// heads, its colours, its kind of thing in the hands) and each of the three in it its own pose, clothes, hat and prop:
//
//   straw and patches — the classic field scarecrow: a stuffed sack for a head with a stitched face, patched work
//   clothes in barn red, denim and mustard, straw out of every cuff
//     farmer      a wide straw sun hat, a red shirt under blue dungarees, arms straight out in a T
//     haymaker    a green bobble hat, a mustard shirt, red braces and cords, a pitchfork upright in one hand and a
//                 straw in the corner of his grin
//     sunflower   the little one: a yellow cap, short red dungarees, straw legs, both arms up and a sunflower
//   the harvest — heads from the pumpkin patch, autumn colours, and crows that are not scared at all
//     pumpkin     a carved orange pumpkin (its face glows at night like a lantern's glass), a brown waistcoat over a
//                 rust shirt, a crow on one arm
//     witch       a white pumpkin with a carrot nose under a tall purple hat, a plum dress and a shawl, a besom broom
//     crows       a striped squash under a flat cap, a long patched coat and an orange scarf, one arm up, a crow on
//                 the hand and another on the cap
//   ribbons and shine — the bright garden scarecrow: a stuffed linen head with a painted happy face, the things that
//   flutter, spin and flash in the sun to scare birds, a painted blue post
//     ribbons     tall and slim, its head on one side, a red bucket hat and a long teal coat, one arm up with a stick
//                 of four long ribbons streaming in the wind
//     pinwheel    a yellow sou'wester and a short raincoat, green wellies, a pinwheel in each hand
//     jingle      a saucepan for a hat, a berry-pink dress and a white apron, red stockings, shiny pie tins hanging
//                 from its arms on strings
//
// Each stands in its own frame facing +z, the ground under its post at the origin, 1.55 to 2.5 m tall with
// what it holds up. Two to four parts each, one per material (each a draw, and one more in the sun's map, for every
// kind standing): the clothes, with the post and the arms' sticks, what it holds, its hat, and a linen head; a sack
// or a pumpkin head of its own, with its face (and the crows); the straw (open blades, drawn from both sides: the
// tufts, the sunflower's petals, the pinwheels' sails); and for some a part of their own: the pie tins and the
// saucepan (shiny metal), the pumpkin's carved face (it glows from the evening, as the lamps' glass does, and casts
// no shadow).

// ───────────────────────────── colours ─────────────────────────────

const CREAM = rgb(0xf0e6cf)
const STRAW = rgb(0xe3c46c)
const STRAW_DARK = rgb(0xb9933e)
const BUTTON = rgb(0x2a1d16)
const THREAD = rgb(0x3b2a1e)
const TWINE = rgb(0x7a5a32)
// the posts: weathered grey, dark brown, painted blue
const POST_GREY = rgb(0x8a8174)
const POST_BROWN = rgb(0x5e4630)
const POST_BLUE = rgb(0x4f86bf)
const IRON = rgb(0x4a4c50)
// straw and patches
const BURLAP = rgb(0xd2ae74)
const BURLAP_DARK = rgb(0xab8753)
const BARN_RED = rgb(0xc4473f)
const DENIM = rgb(0x3f6fb0)
const DENIM_LIGHT = rgb(0x6f95c8)
const MUSTARD = rgb(0xdca73c)
const CORD = rgb(0x7a5236)
const KNIT = rgb(0x4f8a4a)
const KNIT_DARK = rgb(0x3d7239)
const SKY = rgb(0x6aaee0)
const SUN = rgb(0xf6c832)
const SEEDS = rgb(0x5a3a1e)
const STALK = rgb(0x5c8a3a)
const CHEEK = rgb(0xec8f88)
const GOLD = rgb(0xe8b84a)
// the harvest
const PUMPKIN = rgb(0xe47a22)
const PUMPKIN_DARK = rgb(0xb5561a)
const LANTERN = rgb(0x9a4a12) // the carved face by day: dark amber; it glows at night
const GHOST = rgb(0xf2ead8)
const GHOST_DARK = rgb(0xd6cbb0)
const SQUASH = rgb(0xf4d77a)
const SQUASH_GREEN = rgb(0x4f7a34)
const STEM = rgb(0x6b5a2a)
const CARROT = rgb(0xe8762a)
const RUST = rgb(0xb5552c)
const VEST = rgb(0x6b4a32)
const OLIVE = rgb(0x6d7440)
const PLUM = rgb(0x7a3c74)
const WITCH = rgb(0x3e2e52)
const SHAWL = rgb(0xe08e2c)
const COAT = rgb(0x8a5a3a)
const TWEED = rgb(0x6e6048)
const NAVY = rgb(0x34405a)
const CROW = rgb(0x23262d)
const BEAK = rgb(0x4a4640)
// ribbons and shine
const LINEN = rgb(0xf5ecdc)
const INK = rgb(0x2a2422)
const MOUTH = rgb(0xb23a3a)
const TEAL = rgb(0x2f9e94)
const RED = rgb(0xd8483a)
const BERRY = rgb(0xc8466e)
const WHITE = rgb(0xf8f4ec)
const WELLY = rgb(0x3d8a4a)
const TIN = rgb(0xe4e8ec)
const HANDLE = rgb(0x2b2b2e)

export type ScarecrowPart = 'cloth' | 'head' | 'straw' | 'tin' | 'glow'
type Model = Partial<Record<ScarecrowPart, StructurePart>>

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
/** A point a little off a hit, along its normal (a stitch or a painted line laid on a surface). */
const off = (hit: { point: V3; normal: V3 }, by: number): V3 => [hit.point[0] + hit.normal[0] * by, hit.point[1] + hit.normal[1] * by, hit.point[2] + hit.normal[2] * by]

/** The post (from the ground up into the head) and the arms' sticks, each sharpened past the cuff. */
function frame(top: number, arms: Arm[], colour: V3, reach = 0.68): Shape {
  const post = tube(
    [
      [0, -0.02, 0],
      [0, top * 0.5, 0],
      [0, top, 0],
    ],
    0.035,
    { seg: 7, steps: 1, caps: [true, true] },
  )
  const sticks = arms.map((a) => tube([a.at(0.02), a.at(reach - 0.08), a.at(reach)], [0.023, 0.021, 0], { seg: 6, steps: 1 }))
  const light = mixRgb(colour, CREAM, 0.3)
  return merge(post, ...sticks).paint((x, y, z) => mixRgb(colour, light, 0.2 + 0.5 * noise3(x * 30, y * 6, z * 30, 3)), 0)
}

/** A tuft of straw sticking out of an opening at `at`, along `dir`, fanned out a little. */
function tuft(at: V3, dir: V3, seed: number, n = 5, length = 0.15, width = 0.03): Shape {
  const out: Shape[] = []
  for (let k = 0; k < n; k++) {
    const spread = ((k / (n - 1)) * 2 - 1) * 0.5
    const l = length * (0.75 + 0.5 * noise3(k * 3.1, seed, 1, 5))
    // each straw starts a little inside the opening, so it holds on there
    const straw = blade({ length: l, width, fold: 0.3, bend: -0.5, segL: 2, segW: 1 }).place([0, 0, -0.03], [spread * Math.cos(k * 2.3 + seed), spread * Math.sin(k * 1.7 + seed), k * 1.3])
    out.push(aim(straw, at, dir))
  }
  return merge(...out).paint((x, y, z) => mixRgb(STRAW, STRAW_DARK, noise3(x * 40, y * 40, z * 40, seed)), 0)
}

// ───────────────────────────── clothes ─────────────────────────────

type Rings = [number, number, number][]

/** A stuffed body round the post, from its hem up to its neck: rings [height, half-width, half-depth], closed flat at
 *  the hem and rounded at the neck. */
function body(rings: Rings, seg = 12): Shape {
  return loft(
    rings.map(([y, rx, rz]) => ({ c: [0, y, 0] as V3, rx, ry: rz })),
    { seg, steps: 1, up: [0, 0, 1], caps: [true, false], round: [0, 0.04], shape: (a) => squircle(a, 2.6) },
  )
}

/** A shirt's or a coat's body, from the hem at `hem` to the neck over the arms at `S`, `w` as wide. */
const torso = (hem: number, S: number, w = 1): Rings => [
  [hem, 0.205 * w, 0.13],
  [hem + 0.08, 0.19 * w, 0.125],
  [S - 0.24, 0.185 * w, 0.12],
  [S - 0.04, 0.215 * w, 0.125],
  [S + 0.07, 0.16 * w, 0.105],
  [S + 0.12, 0.07, 0.06],
]

/** A long coat's body, down to the knees and flaring there. */
const coatBody = (hem: number, S: number, w = 1): Rings => [
  [hem, 0.245 * w, 0.17],
  [hem + 0.22, 0.215 * w, 0.145],
  [S - 0.24, 0.19 * w, 0.125],
  [S - 0.04, 0.215 * w, 0.125],
  [S + 0.07, 0.16 * w, 0.105],
  [S + 0.12, 0.07, 0.06],
]

/** Two rings close together at each height in `cuts`, so a colour painted by height changes there with a crisp edge
 *  (a waistband, a shirt under a waistcoat) instead of fading across the rings around it. */
function cut(rings: Rings, cuts: number[]): Rings {
  const out = [...rings]
  for (const y of cuts)
    for (const yy of [y - 0.004, y + 0.004]) {
      const k = out.findIndex((r) => r[0] > yy)
      if (k <= 0) continue
      const [a, b] = [out[k - 1], out[k]]
      const t = (yy - a[0]) / (b[0] - a[0])
      out.splice(k, 0, [yy, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
    }
  return out
}

/** A second colour's region with a crisp edge from a signed distance (metres, positive inside): the pattern layer
 *  draws its edge where the distance, interpolated across each triangle, crosses 0. */
const inside = (d: number) => 0.5 + 25 * d

/** A sleeve stuffed round an arm's stick, sagging a little, from inside the body to its cuff (closed: straw comes out
 *  of it). */
function sleeve(a: Arm, r: [number, number, number] = [0.085, 0.078, 0.072], to = 0.56): Shape {
  return tube([a.at(0.06), a.at((0.06 + to) / 2), a.at(to)], r, { seg: 9, steps: 1, caps: [false, true] }).warp((x, y, z) => [x, y - 0.022 * smoothstep(0.1, 0.6, Math.abs(x)), z])
}
/** Where a sleeve's cuff is once it has sagged (straw comes out of it there, a hand holds a thing there). */
const cuffOf = (a: Arm, d: number): V3 => {
  const [x, y, z] = a.at(d)
  return [x, y - 0.022 * smoothstep(0.1, 0.6, Math.abs(x)), z]
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

/** A skirt or a dress's lower half: from inside the body at `waist` flaring to its hem, closed there, folds in it. */
function skirt(waist: number, hem: number, top: [number, number], flare: [number, number], folds = 0.06, seg = 16): Shape {
  const mid = (waist + hem) / 2
  return loft(
    [
      { c: [0, waist, 0], rx: top[0], ry: top[1] },
      { c: [0, mid, 0], rx: (top[0] + flare[0] * 2) / 3, ry: (top[1] + flare[1] * 2) / 3 },
      { c: [0, hem, 0], rx: flare[0], ry: flare[1] },
    ],
    { seg, steps: 1, up: [0, 0, 1], caps: [true, true], shape: (a, along) => 1 + folds * along * Math.sin(a * 7) },
  )
}

/** A thin cushion laid on a surface at `at`, facing `normal`: a patch, a pocket (`seg` 3: a triangle). */
function patch(at: V3, normal: V3, size: number, colour: V3, turn = 0.2, seg = 8): Shape {
  const pad = loft(
    [
      { c: [0, 0, -0.005], rx: size, ry: size },
      { c: [0, 0, 0.004], rx: size, ry: size },
    ],
    { seg, steps: 1, caps: [true, true], shape: seg > 4 ? (a) => squircle(a, 5) : undefined },
  ).place([0, 0, 0], [0, 0, turn])
  return aim(pad, at, normal).fill(colour, 0)
}

/** A patch laid on a shape where a ray from in front meets it. */
function patchOn(surface: Shape, from: V3, size: number, colour: V3, turn = 0.2) {
  const hit = onto(surface, from)
  return patch(hit.point, hit.normal, size, colour, turn)
}

/** A round button sewn on a surface (a coat's, the buttons of dungarees). */
function buttonOn(surface: Shape, from: V3, r: number, colour: V3) {
  const hit = onto(surface, from)
  return aim(ellipsoid(r, r, r * 0.45, 7, 3), off(hit, -0.002), hit.normal).fill(colour, 0)
}

/** A strap over the shoulder at `x` (braces, a dungarees' strap): from the front at height `from` up over the top of
 *  the body and down its back to `to`, laid on its surface. */
function strapOver(surface: Shape, x: number, from: number, to: number, S: number, r = 0.013): Shape {
  const front = [from, (from + S) / 2, S - 0.02].map((y) => off(onto(surface, [x, y, 0.6]), r * 0.3))
  const top = off(onto(surface, [x, S + 0.6, 0], [0, -1, 0]), r * 0.3)
  const back = [S - 0.02, (to + S) / 2, to].map((y) => off(onto(surface, [x, y, -0.6], [0, 0, 1]), r * 0.3))
  return tube([...front, top, ...back], r, { seg: 4, steps: 1, caps: [true, true] })
}

/** A neckerchief or a scarf round the neck: a collar ring and (`end`) one end hanging down the front. */
function neckwear(S: number, colour: V3, end: 'point' | 'long'): Shape {
  const collar = spin(
    [
      [0.07, S + 0.05],
      [0.125, S + 0.06],
      [0.12, S + 0.11],
      [0.065, S + 0.12],
    ],
    12,
  )
  const hang =
    end === 'point'
      ? loft(
          [
            { c: [0, S + 0.08, 0.1], rx: 0.07, ry: 0.016 },
            { c: [0, S - 0.01, 0.135], rx: 0.035, ry: 0.012 },
            { c: [0, S - 0.07, 0.14], rx: 0, ry: 0 },
          ],
          { seg: 6, steps: 1, up: [0, 0, 1] },
        )
      : loft(
          [
            { c: [0.05, S + 0.08, 0.1], rx: 0.048, ry: 0.015 },
            { c: [0.07, S - 0.12, 0.14], rx: 0.046, ry: 0.014 },
            { c: [0.085, S - 0.4, 0.15], rx: 0.044, ry: 0.013 },
          ],
          { seg: 6, steps: 1, up: [0, 0, 1], caps: [true, true], shape: (q) => squircle(q, 4) },
        )
  return merge(collar, hang).fill(colour, 0)
}

// ───────────────────────────── heads ─────────────────────────────

/** A stuffed head round the post's top, gathered and tied at the neck (a sack, or a linen bag): its centre at `H`. */
function stuffedHead(H: number, size: number, seed: number, seg = 12): Shape {
  return loft(
    [
      { c: [0, H - 0.165 * size, 0], rx: 0.05, ry: 0.05 },
      { c: [0, H - 0.135 * size, 0], rx: 0.115 * size, ry: 0.11 * size },
      { c: [0, H - 0.05 * size, 0], rx: 0.172 * size, ry: 0.162 * size },
      { c: [0, H + 0.05 * size, 0], rx: 0.168 * size, ry: 0.158 * size },
      { c: [0, H + 0.125 * size, 0], rx: 0.12 * size, ry: 0.115 * size },
    ],
    { seg, steps: 2, up: [0, 0, 1], round: [0, 0.05 * size], shape: (a, along) => 1 + 0.04 * Math.sin(a * 3 + along * 4 + seed) },
  )
}

/** A line laid on a surface through points given as [x, y] on the face (a stitched smile, a painted one), its ends
 *  tapering into the surface. */
function lineOn(surface: Shape, H: number, points: [number, number][], r: number | number[], colour: V3): Shape {
  const path = points.map(([u, v]) => off(onto(surface, [u, H + v, 0.6]), 0.001))
  return tube(path, [0, ...path.slice(1, -1).map((_, k) => (typeof r === 'number' ? r : r[k])), 0], { seg: 4, steps: 1 }).fill(colour, 0)
}

/** An arc of `n` points on a face: centre [u, v], half-width `w`, depth `d` (a smile bends down in the middle). */
const arc = (u: number, v: number, w: number, d: number, n = 6, lift = 0): [number, number][] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const t = (k / n) * 2 - 1
    return [u + t * w, v - d * (1 - t * t) + lift * t]
  })

/** A flat painted or sewn dot on a surface: an eye, a cheek. */
function dotOn(surface: Shape, H: number, u: number, v: number, rx: number, ry: number, colour: V3, depth = 0.008) {
  const hit = onto(surface, [u, H + v, 0.6])
  return aim(ellipsoid(rx, ry, depth, 8, 3), off(hit, -0.002), hit.normal).fill(colour, 0)
}

interface SackFace {
  seed: number
  /** two buttons alike, or one bigger than the other */
  eyes: 'buttons' | 'odd'
  /** a stitched smile with stitches across it, or a crooked grin */
  mouth: 'stitched' | 'grin'
  nose?: V3
  cheeks?: boolean
  /** a square patch sewn on the forehead */
  patch?: V3
  size?: number
}

/** A burlap sack stuffed round the post's top and tied with twine at the neck, its face stitched on. */
function sackHead(H: number, f: SackFace): Shape {
  const s = f.size ?? 1
  const sack = stuffedHead(H, s, f.seed)
  const head = sack
    .paint((x, y, z) => mixRgb(BURLAP, BURLAP_DARK, smoothstep(0.35, 0.75, fbm3(x * 9, y * 9, z * 9, 7 + f.seed))), 0)
    .pattern((_x, y) => 1 - smoothstep(0.006, 0.012, Math.abs(y - (H - 0.135 * s))), TWINE)
  const parts: Shape[] = [head]
  for (const side of [-1, 1]) {
    const big = f.eyes === 'odd' && side > 0 ? 1.35 : 1
    parts.push(dotOn(sack, H, side * 0.062 * s, 0.015 * s, 0.03 * big, 0.03 * big, BUTTON, 0.012))
  }
  if (f.mouth === 'stitched') {
    const smile = arc(0, -0.045 * s, 0.075 * s, 0.03 * s, 6)
    parts.push(lineOn(sack, H, smile, 0.008, THREAD))
    // stitches across it
    for (const k of [1, 3, 5]) {
      const [u, v] = smile[k]
      parts.push(
        lineOn(
          sack,
          H,
          [
            [u - 0.004, v + 0.022],
            [u, v],
            [u + 0.004, v - 0.022],
          ],
          0.006,
          THREAD,
        ),
      )
    }
  } else parts.push(lineOn(sack, H, arc(0.012 * s, -0.05 * s, 0.085 * s, 0.035 * s, 6, 0.018), 0.011, THREAD))
  if (f.nose) {
    const hit = onto(sack, [0, H - 0.01 * s, 0.6])
    parts.push(patch(off(hit, 0.002), hit.normal, 0.026, f.nose, -Math.PI / 2, 3))
  }
  if (f.cheeks) for (const side of [-1, 1]) parts.push(dotOn(sack, H, side * 0.1 * s, -0.035 * s, 0.03, 0.022, CHEEK, 0.005))
  if (f.patch) parts.push(patchOn(sack, [-0.075 * s, H + 0.085 * s, 0.6], 0.032, f.patch, 0.35))
  return merge(...parts)
}

/** A pumpkin (or a squash) round the post's top, its bottom in the collar: `r` its radius, `h` its half height, ribs
 *  round it (`ribs` of them, each `seg / ribs` vertices round), the creases painted darker; its centre at
 *  S + 0.12 + 0.95 h (returned with it). */
function gourd(S: number, r: number, h: number, base: V3, crease: V3, ribs = 8, seg = 24, sharp = 0.6) {
  const H = S + 0.12 + 0.95 * h
  const unit: [number, number][] = [
    [0, -0.95],
    [0.5, -0.92],
    [0.85, -0.65],
    [1.0, -0.12],
    [0.93, 0.42],
    [0.62, 0.8],
    [0.22, 0.9],
    [0, 0.78],
  ]
  const half = ribs / 2
  const shape = lathe(
    unit.map(([u, v]) => [u * r, H + v * h]),
    { seg, steps: 1, shape: (a) => 1 - 0.09 * Math.pow(Math.abs(Math.sin(a * half)), 0.6) },
  ).paint((x, y, z) => {
    const between = Math.pow(Math.abs(Math.sin(Math.atan2(z, x) * half)), sharp)
    return mixRgb(base, crease, 0.75 * between + 0.2 * smoothstep(H, H - h, y))
  }, 0)
  return { shape, H }
}

/** A short twisted stem on top of a pumpkin at `y`. */
function pumpkinStem(y: number): Shape {
  return tube(
    [
      [0, y - 0.03, 0],
      [0.008, y + 0.03, 0.004],
      [0.03, y + 0.07, 0.02],
    ],
    [0.03, 0.024, 0.02],
    { seg: 6, steps: 2, caps: [false, true], shape: (a) => 1 - 0.12 * Math.abs(Math.sin(a * 3)) },
  ).fill(STEM, 0)
}

/** A hollow carved into a face: a dark pit laid into the skin, a polygon of `seg` sides turned by `turn`. */
function carve(surface: Shape, H: number, u: number, v: number, rx: number, ry: number, seg: number, turn: number, colour: V3): Shape {
  const hit = onto(surface, [u, H + v, 0.6])
  const pit = loft(
    [
      { c: [0, 0, -0.012], rx, ry },
      { c: [0, 0, 0.003], rx, ry },
    ],
    { seg, steps: 1, caps: [true, true] },
  ).place([0, 0, 0], [0, 0, turn])
  return aim(pit, hit.point, hit.normal).fill(colour, 0)
}

/** A linen bag stuffed for a head, tied with a ribbon at the neck, a happy face painted on it. */
function linenHead(H: number, ribbon: V3, face: 'smile' | 'happy' | 'open', seed: number): Shape {
  const bag = stuffedHead(H, 1, seed, 12)
  const head = bag.paint((x, y, z) => mixRgb(LINEN, rgb(0xe8dcc6), 0.4 * fbm3(x * 6, y * 6, z * 6, seed)), 0).pattern((_x, y) => 1 - smoothstep(0.008, 0.014, Math.abs(y - (H - 0.135))), ribbon)
  const parts: Shape[] = [head]
  if (face === 'happy') {
    // closed, smiling eyes: two little arches
    for (const side of [-1, 1]) parts.push(lineOn(bag, H, arc(side * 0.062, 0.02, 0.028, -0.018, 4), 0.007, INK))
  } else for (const side of [-1, 1]) parts.push(dotOn(bag, H, side * 0.06, 0.018, face === 'open' ? 0.026 : 0.02, face === 'open' ? 0.026 : 0.028, INK, 0.007))
  if (face === 'open') {
    // a mouth wide open in a laugh: a half disc
    const hit = onto(bag, [0, H - 0.05, 0.6])
    const mouth = loft(
      [
        { c: [0, 0, -0.01], rx: 0.045, ry: 0.03 },
        { c: [0, 0, 0.004], rx: 0.045, ry: 0.03 },
      ],
      { seg: 10, steps: 1, caps: [true, true], shape: (a) => (Math.sin(a) > 0 ? 0.25 : 1) },
    )
    parts.push(aim(mouth, hit.point, hit.normal).fill(MOUTH, 0))
  } else parts.push(lineOn(bag, H, arc(0, -0.048, 0.06, 0.028, 6), 0.009, MOUTH))
  for (const side of [-1, 1]) parts.push(dotOn(bag, H, side * 0.105, -0.03, 0.03, 0.022, CHEEK, 0.005))
  return merge(...parts)
}

// ───────────────────────────── hats ─────────────────────────────

/** A straw sun hat with a wide wavy brim and a band, its underside at `y`. */
function strawHat(y: number, band: V3): Shape {
  return spin(
    [
      [0, y - 0.004],
      [0.14, y - 0.01],
      [0.27, y - 0.03],
      [0.31, y - 0.05],
      [0.318, y - 0.04],
      [0.29, y - 0.022],
      [0.152, y + 0.002],
      [0.144, y + 0.02],
      [0.141, y + 0.06],
      [0.136, y + 0.105],
      [0.105, y + 0.138],
      [0, y + 0.145],
    ],
    14,
    { lift: (i, a) => (i >= 2 && i <= 5 ? 0.024 * Math.sin(a * 2 + 0.7) : 0) },
  )
    .paint((x, yy, z) => mixRgb(STRAW, STRAW_DARK, 0.15 + 0.5 * noise3(x * 14, yy * 14, z * 14, 4)), 0)
    .pattern((_x, yy) => inside(Math.min(yy - y - 0.02, y + 0.062 - yy)), band)
}

/** A knitted bobble hat: a dome over the head's top from `y`, a turned-up cuff, and a bobble. */
function bobbleHat(y: number, colour: V3, cuff: V3, bobble: V3): Shape {
  const hat = lathe(
    [
      [0.15, y - 0.01],
      [0.182, y + 0.012],
      [0.186, y + 0.055],
      [0.18, y + 0.064],
      [0.176, y + 0.08],
      [0.15, y + 0.15],
      [0.09, y + 0.2],
      [0, y + 0.214],
    ],
    { seg: 14, steps: 1 },
  )
    .paint(() => colour, 0)
    .pattern((_x, yy) => inside(y + 0.06 - yy), cuff)
  const ball = blob(0.058, 1, (x, yy, z) => 0.006 * noise3(x * 60, yy * 60, z * 60, 2))
    .place([0, y + 0.235, 0])
    .fill(bobble, 0)
  return merge(hat, ball)
}

/** A cap: a snug round crown from `y` and a peak to the front. */
function cap(y: number, colour: V3): Shape {
  const crown = spin(
    [
      [0, y],
      [0.176, y],
      [0.182, y + 0.04],
      [0.164, y + 0.1],
      [0.1, y + 0.145],
      [0, y + 0.158],
    ],
    14,
  )
  const peak = loft(
    [
      { c: [0, y + 0.02, 0.12], rx: 0.12, ry: 0.008 },
      { c: [0, y + 0.016, 0.22], rx: 0.105, ry: 0.007 },
      { c: [0, y + 0.006, 0.285], rx: 0.07, ry: 0.006 },
    ],
    { seg: 8, steps: 1, caps: [true, true], shape: (a) => squircle(a, 4) },
  ).warp((x, yy, z) => [x, yy - 1.6 * x * x, z])
  return merge(crown.fill(colour, 0), peak.fill(mixRgb(colour, BUTTON, 0.15), 0))
}

/** A flat cap of tweed: a low crown pulled forward over a short peak. */
function flatCap(y: number, colour: V3): Shape {
  const crown = spin(
    [
      [0, y - 0.004],
      [0.17, y - 0.004],
      [0.19, y + 0.02],
      [0.185, y + 0.052],
      [0.13, y + 0.085],
      [0, y + 0.092],
    ],
    14,
    { ring: (i, a) => (i >= 2 && i <= 4 ? 1 + 0.12 * Math.max(0, Math.sin(a)) : 1), lift: (i, a) => (i >= 3 ? -0.025 * Math.max(0, Math.sin(a)) : 0) },
  )
  const peak = loft(
    [
      { c: [0, y + 0.012, 0.15], rx: 0.13, ry: 0.007 },
      { c: [0, y + 0.004, 0.245], rx: 0.11, ry: 0.006 },
    ],
    { seg: 8, steps: 1, caps: [true, true], shape: (a) => squircle(a, 4) },
  ).warp((x, yy, z) => [x, yy - 1.2 * x * x, z])
  return merge(crown, peak).paint((x, yy, z) => mixRgb(colour, mixRgb(colour, CREAM, 0.25), 0.5 * fbm3(x * 50, yy * 50, z * 50, 6)), 0)
}

/** A tall pointed hat with a wide brim and a band, its tip bent back. */
function pointedHat(y: number, colour: V3, band: V3): Shape {
  return spin(
    [
      [0, y - 0.004],
      [0.16, y - 0.01],
      [0.33, y - 0.036],
      [0.342, y - 0.026],
      [0.17, y + 0.008],
      [0.152, y + 0.03],
      [0.142, y + 0.07],
      [0.118, y + 0.15],
      [0.08, y + 0.26],
      [0.045, y + 0.36],
      [0, y + 0.45],
    ],
    14,
    { lift: (i, a) => (i >= 1 && i <= 4 ? 0.02 * Math.sin(a * 2 + 1.2) : 0) },
  )
    .paint(() => colour, 0)
    .pattern((_x, yy) => inside(Math.min(yy - y - 0.012, y + 0.058 - yy)), band)
    .warp((x, yy, z) => {
      const t = Math.max(0, yy - y - 0.2)
      return [x + 1.4 * t * t, yy - 0.6 * t * t, z - 2.4 * t * t]
    })
}

/** A bucket hat: a soft round crown and a brim sloping down all round. */
function bucketHat(y: number, colour: V3): Shape {
  return spin(
    [
      [0, y - 0.006],
      [0.15, y - 0.006],
      [0.235, y - 0.07],
      [0.242, y - 0.058],
      [0.16, y + 0.008],
      [0.152, y + 0.03],
      [0.148, y + 0.1],
      [0.12, y + 0.135],
      [0, y + 0.142],
    ],
    14,
  )
    .paint(() => colour, 0)
    .pattern((_x, yy) => inside(Math.min(yy - y - 0.012, y + 0.04 - yy)), mixRgb(colour, BUTTON, 0.35))
}

/** A sou'wester: a rounded crown and a brim long at the back, turned down. */
function souwester(y: number, colour: V3): Shape {
  const back = (a: number) => Math.max(0, -Math.sin(a))
  return spin(
    [
      [0, y - 0.006],
      [0.15, y - 0.006],
      [0.235, y - 0.05],
      [0.242, y - 0.038],
      [0.162, y + 0.01],
      [0.156, y + 0.06],
      [0.13, y + 0.12],
      [0.07, y + 0.15],
      [0, y + 0.156],
    ],
    14,
    { ring: (i, a) => (i >= 2 && i <= 3 ? 1 + 0.3 * back(a) : 1), lift: (i, a) => (i >= 2 && i <= 3 ? -0.06 * back(a) : 0) },
  )
    .paint(() => colour, 0)
    .pattern((_x, yy) => inside(Math.min(yy - y - 0.01, y + 0.03 - yy)), mixRgb(colour, BUTTON, 0.25))
}

/** A saucepan upside down for a hat, its handle out to the side. */
function saucepan(y: number): Shape {
  const pan = spin(
    [
      [0, y - 0.004],
      [0.16, y - 0.004],
      [0.172, y + 0.006],
      [0.158, y + 0.014],
      [0.156, y + 0.12],
      [0.14, y + 0.138],
      [0, y + 0.14],
    ],
    14,
  ).fill(TIN, 0)
  const handle = tube(
    [
      [0.14, y + 0.075, 0],
      [0.27, y + 0.09, 0.02],
      [0.37, y + 0.11, 0.035],
    ],
    [0.018, 0.017, 0.016],
    { seg: 6, steps: 1, caps: [false, false], round: [0, 0.015] },
  ).fill(HANDLE, 0)
  return merge(pan, handle).place([0, -y, 0]).place([0, y, 0], [0.06, 0, -0.1])
}

// ───────────────────────────── what they hold ─────────────────────────────

/** A pitchfork upright, its shaft at [x, z] from `y0` to `y1`, three iron tines above. */
function pitchfork(x: number, z: number, y0: number, y1: number): Shape {
  const shaft = tube(
    [
      [x, y0, z],
      [x, (y0 + y1) / 2, z],
      [x, y1 + 0.02, z],
    ],
    0.019,
    { seg: 6, steps: 1, caps: [true, true] },
  ).paint((xx, yy, zz) => mixRgb(rgb(0x9a7046), rgb(0x7a5432), noise3(xx * 20, yy * 3, zz * 20, 8)), 0)
  const bar = tube(
    [
      [x - 0.085, y1, z],
      [x, y1 + 0.012, z],
      [x + 0.085, y1, z],
    ],
    0.014,
    { seg: 5, steps: 1, round: [0.012, 0.012] },
  )
  const tines = [-0.075, 0, 0.075].map((dx) =>
    tube(
      [
        [x + dx, y1 - 0.004, z],
        [x + dx * 1.05, y1 + 0.13, z + 0.012],
        [x + dx * 1.08, y1 + 0.27, z + 0.04],
      ],
      [0.011, 0.009, 0],
      { seg: 4, steps: 1 },
    ),
  )
  return merge(shaft, merge(bar, ...tines).fill(IRON, 0))
}

/** A sunflower held up: a stalk from `from` bending up to a big yellow head facing the front. Returns the stalk and
 *  the seed disc (solid: with the clothes) and the petals and a leaf (thin: with the straw). */
function sunflower(from: V3) {
  const centre: V3 = [from[0] + 0.08, from[1] + 0.4, from[2] + 0.08]
  const stalk = tube([from, [from[0] + 0.04, from[1] + 0.22, from[2] + 0.02], centre], 0.016, { seg: 5, steps: 1, caps: [true, false] }).fill(STALK, 0)
  // the head faces the front, turned a little up and out
  const face: V3 = [0.15, 0.25, 0.96]
  const disc = aim(ellipsoid(0.075, 0.075, 0.03, 9, 3), centre, face).fill(SEEDS, 0)
  const petals: Shape[] = []
  for (let k = 0; k < 13; k++) {
    // a petal made along +z, laid out from the middle in the flower's plane, its face to the front (+z), then the
    // flower turned
    const petal = blade({ length: 0.13, width: 0.07, fold: 0.15, bend: 0.3, segL: 2, segW: 1 })
      .place([0, 0, 0.055])
      .place([0, 0, 0], [Math.PI / 2, 0, 0])
      .place([0, 0, 0], [0, 0, (k / 13) * Math.PI * 2])
    petals.push(aim(petal, centre, face))
  }
  const leaf = aim(blade({ length: 0.13, width: 0.06, fold: 0.3, bend: -0.4, segL: 2, segW: 1 }), [from[0] + 0.035, from[1] + 0.16, from[2] + 0.015], [-0.7, 0.4, 0.5])
  return {
    solid: merge(stalk, disc),
    thin: merge(
      merge(...petals).paint((x, y, z) => mixRgb(rgb(0xffd23a), rgb(0xf0a81c), 0.5 * noise3(x * 30, y * 30, z * 30, 3)), 0),
      leaf.fill(STALK, 0),
    ),
  }
}

/** A crow sitting, its feet at the origin, facing +z. */
function crow(): Shape {
  const bodyShape = loft(
    [
      { c: [0, 0.05, -0.19], rx: 0.03, ry: 0.006 },
      { c: [0, 0.045, -0.12], rx: 0.036, ry: 0.016 },
      { c: [0, 0.05, -0.06], rx: 0.048, ry: 0.042 },
      { c: [0, 0.055, 0.0], rx: 0.055, ry: 0.055 },
      { c: [0, 0.075, 0.05], rx: 0.046, ry: 0.046 },
      { c: [0, 0.11, 0.075], rx: 0.03, ry: 0.032 },
    ],
    { seg: 7, steps: 1, caps: [true, true] },
  )
  const head = ellipsoid(0.04, 0.042, 0.046, 7, 4).place([0, 0.135, 0.085])
  const beak = loft(
    [
      { c: [0, 0.13, 0.11], rx: 0.016, ry: 0.015 },
      { c: [0, 0.122, 0.17], rx: 0, ry: 0 },
    ],
    { seg: 5, steps: 1 },
  ).fill(BEAK, 0)
  return merge(
    merge(bodyShape, head).paint((x, y, z) => mixRgb(CROW, rgb(0x3a4050), 0.35 * smoothstep(0.06, 0.14, y) * noise3(x * 30, y * 30, z * 30, 2)), 0),
    beak,
  )
}

/** A crow sitting at `at`, turned by `yaw` about the vertical. */
const crowAt = (at: V3, yaw: number) => crow().place([0, 0, 0], [0, yaw, 0]).place(at)

/** A besom broom through the hand at `hand`, along `u` (down), its bristles tied on. */
function broom(hand: V3, u: V3): Shape {
  const n = new Vector3(...u).normalize()
  const p = (d: number): V3 => [hand[0] + n.x * d, hand[1] + n.y * d, hand[2] + n.z * d]
  const handle = tube([p(-0.3), p(0.25), p(0.86)], 0.017, { seg: 6, steps: 1, caps: [true, true] }).paint((x, y, z) => mixRgb(rgb(0x8a6440), rgb(0x6a4a2e), noise3(x * 20, y * 4, z * 20, 5)), 0)
  const bristles = loft(
    [
      { c: p(0.74), rx: 0.03, ry: 0.03 },
      { c: p(0.8), rx: 0.05, ry: 0.05 },
      { c: p(1.0), rx: 0.085, ry: 0.075 },
      { c: p(1.16), rx: 0.105, ry: 0.085 },
    ],
    { seg: 10, steps: 1, caps: [true, true], shape: (a, along) => 1 + 0.12 * along * Math.sin(a * 6) },
  )
    .paint((x, y, z) => mixRgb(STRAW, STRAW_DARK, 0.2 + 0.6 * noise3(x * 50, y * 50, z * 50, 9)), 0)
    .pattern((x, y, z) => {
      const d = (x - hand[0]) * n.x + (y - hand[1]) * n.y + (z - hand[2]) * n.z
      return 1 - smoothstep(0.012, 0.02, Math.abs(d - 0.8))
    }, TWINE)
  return merge(handle, bristles)
}

/** Ribbons streaming out sideways in the wind from the top of a stick at `top`, fanned out one under another: each a
 *  thin strip along a wavy path, its broad side to the front. */
function ribbons(top: V3, colours: V3[]): Shape {
  const strips = colours.map((colour, k) => {
    const L = 0.62 + 0.07 * k
    const rings = Array.from({ length: 6 }, (_, j) => {
      const t = j / 5
      const c: V3 = [top[0] + 0.02 + t * L * 0.7, top[1] - 0.02 - t * L * (0.1 + 0.13 * k) + 0.06 * Math.sin(t * Math.PI * 2.2 + k * 1.3) * t, top[2] - t * L * 0.25 + 0.03 * (k - 1.5) * t]
      return { c, rx: 0.005, ry: 0.038 * (1 - 0.3 * t) }
    })
    return loft(rings, { seg: 4, steps: 1, caps: [true, true], shape: (a, along) => 1 + 0.15 * Math.sin(a * 2 + along * 9) }).fill(colour, 0)
  })
  const knot = ellipsoid(0.026, 0.024, 0.026, 8, 4).place(top).fill(RED, 0)
  return merge(knot, ...strips)
}

/** A pinwheel facing the front at `at`, four sails round a pin. Returns the pin (solid: with the clothes) and the
 *  sails (thin: with the straw). */
function pinwheel(at: V3, colours: V3[], spin0 = 0) {
  const sails: Shape[] = []
  for (let k = 0; k < 4; k++) {
    // a sail: a triangle from the pin out, its outer corner curled forward
    const sail = blade({ length: 0.18, width: 0.17, outline: (u) => 0.9 * (1 - u) + 0.1, fold: 0, bend: 0.55, segL: 2, segW: 1 })
      .place([0.03, 0, 0.0])
      .place([0, 0, 0], [Math.PI / 2, 0, 0])
      .place([0, 0, 0], [0, 0, spin0 + (k * Math.PI) / 2])
      .place(at)
    sails.push(sail.fill(colours[k % colours.length], 0))
  }
  const pin = ellipsoid(0.026, 0.026, 0.034, 7, 3).place(at).fill(SUN, 0)
  return { pin, sails: merge(...sails) }
}

/** A shiny pie tin hanging on its string from `from`, `drop` below, turned by `yaw`. Returns the string and the tin. */
function pieTin(from: V3, drop: number, yaw: number) {
  const r = 0.095
  const rim: V3 = [from[0], from[1] - drop, from[2]]
  const tin = spin(
    [
      [0, -0.01],
      [0.075, -0.01],
      [r, 0.012],
      [0.068, 0.0],
      [0, 0.0],
    ],
    10,
  )
    // stood on its edge, facing the front, its rim's top at the string's end
    .place([0, 0, 0], [Math.PI / 2, 0, 0])
    .place([0, 0, 0], [0, yaw, 0])
    .place([rim[0], rim[1] - r + 0.012, rim[2]])
    .fill(TIN, 0)
  const string = tube([from, [rim[0], rim[1] - 0.012, rim[2]]], 0.0045, { seg: 4, steps: 1, caps: [true, true] }).fill(rgb(0xe8e0d0), 0)
  return { string, tin }
}

// ───────────────────────────── materials ─────────────────────────────

const cloth = (...shapes: Shape[]): StructurePart => ({ shape: merge(...shapes), material: CLOTH })
const thin = (...shapes: Shape[]): StructurePart => ({ shape: merge(...shapes), material: { roughness: 0.8, doubleSided: true, leaf: true } })
const sack = (shape: Shape): StructurePart => ({ shape, material: { roughness: 0.95, detail: { scale: 220, bump: 0.003, shade: 0.16 } } })
const shiny = (...shapes: Shape[]): StructurePart => ({ shape: merge(...shapes), material: { roughness: 0.3, metalness: 0.35 } })

/** Straw out of both cuffs, both ankles (when there are) and the neck, and any more. */
function strawOut(arms: Arm[], cuff: number, ankles: number | null, neck: number, seed: number, extra: Shape[] = []) {
  return [
    ...arms.map((a, k) => tuft(cuffOf(a, cuff), a.dir, seed + k)),
    ...(ankles === null ? [] : ([-1, 1] as const).map((s, k) => tuft(ankleOf(s, ankles), [0, -1, 0.15], seed + 5 + k, 5, 0.12))),
    tuft([0, neck, 0.02], [0, -0.6, 0.8], seed + 9, 4, 0.09),
    ...extra,
  ]
}

// ───────────────────────────── straw and patches ─────────────────────────────

/** The farmer: a straw sun hat, a red shirt under blue dungarees with a patched knee, arms straight out in a T. */
export function farmerScarecrow(): Model {
  const T = 1.9
  const S = T - 0.32
  const H = T - 0.03
  const hip = T - 0.8
  const ankle = hip - 0.5
  const arms = [arm(-1, 0.02, S), arm(1, 0.02, S)]
  // (the waist on the body's ring at S − 0.24: its edge crisp there without another)
  const waist = S - 0.24
  const bibTop = S - 0.08
  const shirt = body(cut(torso(hip, S), [bibTop]))
  // the dungarees: below the waist all round and the bib in front, its straps over the shoulders
  const dungarees = (x: number, y: number, z: number) => Math.max(waist - y, Math.min(z - 0.03, 0.12 - Math.abs(x), bibTop - y))
  const top = shirt.paint(() => BARN_RED, 1).pattern((x, y, z) => inside(dungarees(x, y, z)), DENIM)
  const straps = [-1, 1].map((side) => strapOver(shirt, side * 0.085, bibTop - 0.01, waist + 0.02, S).fill(DENIM, 1))
  const leg = legs(hip, ankle).map((l) => l.fill(DENIM, 1))
  // the turned-up cuffs of the trousers
  const turnUps = ([-1, 1] as const).map((side) =>
    tube(
      [
        [side * 0.104, ankle + 0.075, 0.028],
        [side * 0.105, ankle - 0.004, 0.03],
      ],
      0.092,
      { seg: 9, steps: 1, caps: [true, true] },
    ).fill(DENIM_LIGHT, 1),
  )
  const sleeves = arms.map((a) => sleeve(a).fill(BARN_RED, 1))
  const knee = patchOn(leg[0], [-0.1, hip - 0.26, 0.6], 0.048, SUN, 0.4)
  const bib = patchOn(shirt, [0.045, S - 0.2, 0.6], 0.04, BARN_RED, -0.25)
  const buttons = [-1, 1].map((side) => buttonOn(shirt, [side * 0.085, bibTop - 0.025, 0.6], 0.017, GOLD))
  return {
    cloth: cloth(frame(T, arms, POST_GREY), top, ...straps, ...sleeves, ...leg, ...turnUps, knee, bib, ...buttons, strawHat(H + 0.1, BARN_RED)),
    head: sack(sackHead(H, { seed: 3, eyes: 'buttons', mouth: 'stitched', nose: BARN_RED })),
    straw: thin(...strawOut(arms, 0.56, ankle - 0.004, H - 0.2, 11)),
  }
}

/** The haymaker: a green bobble hat, a mustard shirt with rolled sleeves, red braces and brown cords, a blue
 *  neckerchief, a pitchfork upright in his hand and a straw in the corner of his grin. */
export function haymakerScarecrow(): Model {
  const T = 1.86
  const S = T - 0.32
  const H = T - 0.03
  const hip = T - 0.8
  const ankle = hip - 0.5
  const arms = [arm(-1, 0.16, S), arm(1, -0.62, S)]
  const waist = S - 0.24
  const shirt = body(torso(hip, S))
  // the cords' top below the waist (on the body's ring there), and the braces up over the shoulders, front and back
  const top = shirt.paint(() => MUSTARD, 1).pattern((_x, y) => inside(waist - y), CORD)
  const braces = [-1, 1].map((side) => strapOver(shirt, side * 0.08, waist + 0.01, waist + 0.01, S, 0.012).fill(BARN_RED, 1))
  const leg = legs(hip, ankle).map((l) => l.fill(CORD, 1))
  const sleeves = arms.map((a) => sleeve(a, [0.085, 0.08, 0.076], 0.46).fill(MUSTARD, 1))
  // rolled up to the elbow
  const rolls = arms.map((a) =>
    tube([a.at(0.4), a.at(0.47)], 0.088, { seg: 9, steps: 1, caps: [true, true] })
      .warp((x, y, z) => [x, y - 0.022 * smoothstep(0.1, 0.6, Math.abs(x)), z])
      .fill(mixRgb(MUSTARD, CREAM, 0.3), 1),
  )
  const knee = patchOn(leg[1], [0.1, hip - 0.25, 0.6], 0.045, KNIT, -0.3)
  // the fork's shaft through the hanging hand (where the stick crosses it)
  const hand = arms[1].at(0.6)
  const fork = pitchfork(hand[0] - 0.01, 0, 0.32, T + 0.3)
  const head = sackHead(H, { seed: 7, eyes: 'odd', mouth: 'grin', patch: BARN_RED })
  // a straw in the corner of his mouth
  const corner = onto(stuffedHead(H, 1, 7), [0.09, H - 0.03, 0.6])
  const chew = aim(blade({ length: 0.16, width: 0.014, fold: 0.2, bend: -0.2, segL: 2, segW: 1 }).place([0, 0, -0.02]), corner.point, [0.75, -0.15, 0.65])
  return {
    cloth: cloth(frame(T, arms, POST_GREY, 0.66), fork, top, ...braces, ...sleeves, ...rolls, ...leg, knee, neckwear(S, DENIM, 'point'), bobbleHat(H + 0.035, KNIT, KNIT_DARK, CREAM)),
    head: sack(head),
    straw: thin(...strawOut(arms, 0.47, ankle, H - 0.2, 21), chew.fill(STRAW, 0)),
  }
}

/** The sunflower: the little one, both arms up — a yellow cap, a sky-blue shirt under short red dungarees, straw legs,
 *  rosy cheeks and a sunflower in its hand. */
export function sunflowerScarecrow(): Model {
  const T = 1.55
  const S = T - 0.32
  const H = T - 0.03
  const hip = T - 0.72
  const knee = hip - 0.24
  const arms = [arm(-1, 0.82, S), arm(1, 0.74, S)]
  const waist = S - 0.24
  const bibTop = S - 0.09
  const shirt = body(cut(torso(hip, S, 0.95), [bibTop]))
  const dungarees = (x: number, y: number, z: number) => Math.max(waist - y, Math.min(z - 0.03, 0.105 - Math.abs(x), bibTop - y))
  const top = shirt.paint(() => SKY, 1).pattern((x, y, z) => inside(dungarees(x, y, z)), BARN_RED)
  const straps = [-1, 1].map((side) => strapOver(shirt, side * 0.075, bibTop - 0.01, waist + 0.02, S, 0.012).fill(BARN_RED, 1))
  const shorts = legs(hip, knee, [0.085, 0.09, 0.092]).map((l) => l.fill(BARN_RED, 1))
  const sleeves = arms.map((a) => sleeve(a, [0.08, 0.074, 0.068], 0.44).fill(SKY, 1))
  const buttons = [-1, 1].map((side) => buttonOn(shirt, [side * 0.075, bibTop - 0.025, 0.6], 0.017, SUN))
  const pocket = patchOn(shirt, [0, S - 0.17, 0.6], 0.035, SUN, 0)
  const flower = sunflower(arms[1].at(0.5))
  return {
    cloth: cloth(frame(T, arms, POST_GREY, 0.56), flower.solid, top, ...straps, ...sleeves, ...shorts, ...buttons, pocket, cap(H + 0.075, SUN)),
    head: sack(sackHead(H, { seed: 5, eyes: 'buttons', mouth: 'stitched', cheeks: true, size: 1.06 })),
    // straw legs out of the shorts
    straw: thin(...strawOut(arms, 0.44, null, H - 0.2, 31), ...([-1, 1] as const).map((s, k) => tuft([s * 0.105, knee + 0.01, 0.03], [s * 0.1, -1, 0.1], 35 + k, 7, 0.27, 0.035)), flower.thin),
  }
}

// ───────────────────────────── the harvest ─────────────────────────────

/** The pumpkin: a carved orange pumpkin for a head (its face lit from the evening), a brown waistcoat over a rust
 *  shirt, olive trousers with a patch, and a crow sitting on one arm. */
export function pumpkinScarecrow(): Model {
  const T = 1.86
  const S = T - 0.32
  const hip = T - 0.8
  const ankle = hip - 0.5
  const arms = [arm(-1, -0.08, S), arm(1, -0.13, S)]
  const waist = hip + 0.2
  const shirt = body(cut(torso(hip, S, 1.02), [waist]))
  // the shirt shows in the waistcoat's V and below it the trousers' top
  const vee = (x: number, y: number, z: number) => Math.min(z - 0.03, 0.035 + 0.38 * (y - waist - 0.12) - Math.abs(x), y - waist - 0.1)
  const top = shirt.paint((_x, y) => (y < waist ? OLIVE : VEST), 1).pattern((x, y, z) => inside(vee(x, y, z)), RUST)
  const leg = legs(hip, ankle).map((l) => l.fill(OLIVE, 1))
  const sleeves = arms.map((a) => sleeve(a).fill(RUST, 1))
  const knee = patchOn(leg[0], [-0.1, hip - 0.24, 0.6], 0.045, MUSTARD, 0.5)
  const { shape: pumpkin, H } = gourd(S, 0.205, 0.16, PUMPKIN, PUMPKIN_DARK)
  // the jack-o'-lantern's face: triangle eyes and nose, a grin with two teeth left in it
  const face = [
    ...[-1, 1].map((side) => carve(pumpkin, H, side * 0.075, 0.035, 0.04, 0.04, 3, Math.PI / 2 + side * 0.2, LANTERN)),
    carve(pumpkin, H, 0, -0.01, 0.022, 0.022, 3, Math.PI / 2, LANTERN),
    lineOn(pumpkin, H, arc(0, -0.06, 0.1, 0.04, 8), [0.018, 0.022, 0.011, 0.024, 0.011, 0.022, 0.018], LANTERN),
  ]
  const leaf = aim(blade({ length: 0.13, width: 0.09, fold: 0.3, bend: -0.6, segL: 2, segW: 1 }), [0.02, H + 0.9 * 0.16 - 0.01, 0.0], [-0.6, 0.35, 0.7])
  const perch = cuffOf(arms[1], 0.4)
  return {
    cloth: cloth(frame(T, arms, POST_BROWN), top, ...sleeves, ...leg, knee),
    head: { shape: merge(pumpkin, pumpkinStem(H + 0.78 * 0.16), crowAt([perch[0], perch[1] + 0.06, 0.0], 0.9)), material: { roughness: 0.5 } },
    glow: { shape: merge(...face), material: { roughness: 0.6, glow: 2.4 }, castShadow: false },
    straw: thin(...strawOut(arms, 0.56, ankle, S + 0.1, 41), leaf.fill(STALK, 0)),
  }
}

/** The witch: a white pumpkin with a carrot nose under a tall purple hat, a plum dress with patches, an orange shawl,
 *  and a besom broom in one hand; straw hangs below the hem. */
export function witchScarecrow(): Model {
  const T = 1.9
  const S = T - 0.32
  const hip = T - 0.78
  const arms = [arm(-1, -0.42, S), arm(1, -0.3, S)]
  const bodice = body(torso(hip, S, 0.95)).fill(PLUM, 1)
  const dress = skirt(hip + 0.12, 0.5, [0.16, 0.105], [0.36, 0.3]).fill(PLUM, 1)
  const shawl = loft(
    [
      { c: [0, S + 0.115, 0], rx: 0.085, ry: 0.07 },
      { c: [0, S + 0.06, 0], rx: 0.2, ry: 0.14 },
      { c: [0, S - 0.05, 0.005], rx: 0.265, ry: 0.17 },
      { c: [0, S - 0.15, 0.01], rx: 0.27, ry: 0.175 },
    ],
    { seg: 14, steps: 1, up: [0, 0, 1], caps: [true, true], shape: (a) => 1 + 0.04 * Math.sin(a * 5) },
  )
    .paint(() => SHAWL, 1)
    .pattern((_x, y) => inside(S - 0.1 - y), mixRgb(SHAWL, RUST, 0.6))
  const sleeves = arms.map((a) => sleeve(a, [0.088, 0.085, 0.082]).fill(PLUM, 1))
  const patches = [patchOn(dress, [-0.12, 0.78, 0.6], 0.05, MUSTARD, 0.3), patchOn(dress, [0.15, 0.64, 0.6], 0.045, OLIVE, -0.4)]
  const { shape: pumpkin, H } = gourd(S, 0.19, 0.15, GHOST, GHOST_DARK, 8, 16)
  const face = [...[-1, 1].map((side) => dotOn(pumpkin, H, side * 0.07, 0.03, 0.024, 0.032, INK, 0.008)), lineOn(pumpkin, H, arc(0, -0.065, 0.065, 0.025, 6, -0.012), 0.009, INK)]
  // the carrot nose, pointing out of the face
  const tip = onto(pumpkin, [0, H - 0.01, 0.6])
  const nose = aim(
    loft(
      [
        { c: [0, 0, -0.03], rx: 0.03, ry: 0.03 },
        { c: [0, 0, 0.04], rx: 0.022, ry: 0.022 },
        { c: [0, 0, 0.13], rx: 0, ry: 0 },
      ],
      { seg: 7, steps: 1, caps: [true, false] },
    ),
    tip.point,
    [0.05, -0.2, 1],
  ).fill(CARROT, 0)
  const hand = cuffOf(arms[0], 0.6)
  return {
    cloth: cloth(frame(T, arms, POST_BROWN), broom(hand, [0.24, -1, 0.42]), bodice, dress, shawl, ...sleeves, ...patches, pointedHat(H + 0.62 * 0.15, WITCH, SHAWL)),
    head: { shape: merge(pumpkin, ...face, nose), material: { roughness: 0.5 } },
    straw: thin(
      ...strawOut(arms, 0.56, null, S + 0.1, 51),
      ...[-0.9, 0.5, 2.2, 3.6].map((a, k) => tuft([Math.cos(a) * 0.24, 0.52, Math.sin(a) * 0.2], [Math.cos(a) * 0.3, -1, Math.sin(a) * 0.3], 55 + k, 5, 0.14)),
    ),
  }
}

/** The crows' friend: a striped squash under a tweed flat cap, a long patched coat and an orange scarf, one arm up —
 *  a crow on that hand and another on the cap. */
export function crowsScarecrow(): Model {
  const T = 1.95
  const S = T - 0.32
  const hip = T - 0.8
  const ankle = 0.5
  const hem = 0.78
  const arms = [arm(-1, 0.62, S), arm(1, -0.06, S)]
  const coat = body(coatBody(hem, S)).fill(COAT, 1)
  const sleeves = arms.map((a) => sleeve(a, [0.09, 0.085, 0.08]).fill(COAT, 1))
  const leg = legs(hip, ankle).map((l) => l.fill(NAVY, 1))
  const patches = [patchOn(coat, [0.13, hem + 0.2, 0.6], 0.05, OLIVE, 0.3), patchOn(coat, [-0.1, S - 0.3, 0.6], 0.04, MUSTARD, -0.2)]
  const buttons = [S - 0.15, S - 0.33, S - 0.51].map((y) => buttonOn(coat, [0.03, y, 0.6], 0.017, BUTTON))
  const { shape: squash, H } = gourd(S, 0.185, 0.15, SQUASH, SQUASH_GREEN, 8, 16, 6)
  const face = [...[-1, 1].map((side) => carve(squash, H, side * 0.065, 0.03, 0.026, 0.026, 8, 0, CROW)), lineOn(squash, H, arc(0, -0.055, 0.07, 0.022, 6, 0.01), 0.011, CROW)]
  const capY = H + 0.6 * 0.15
  // the raised arm's top side faces up and in, towards the body
  const perch = cuffOf(arms[0], 0.5)
  return {
    cloth: cloth(frame(T, arms, POST_BROWN), coat, ...sleeves, ...leg, ...patches, ...buttons, neckwear(S, SHAWL, 'long'), flatCap(capY, TWEED)),
    head: {
      shape: merge(squash, ...face, crowAt([perch[0] + 0.035, perch[1] + 0.052, 0], -0.5), crowAt([0.02, capY + 0.075, -0.02], 0.6)),
      material: { roughness: 0.55 },
    },
    straw: thin(...strawOut(arms, 0.56, ankle, S + 0.1, 61)),
  }
}

// ───────────────────────────── ribbons and shine ─────────────────────────────

/** The ribbon waver: tall and slim, its head on one side, a red bucket hat and a long teal coat over yellow trousers,
 *  one arm up with a stick of four ribbons streaming in the wind. */
export function ribbonsScarecrow(): Model {
  const T = 1.98
  const S = T - 0.32
  const H = T - 0.03
  const hip = T - 0.8
  const ankle = 0.48
  const hem = 0.8
  const arms = [arm(-1, -0.28, S), arm(1, 1.0, S)]
  const coat = body(coatBody(hem, S, 0.92)).fill(TEAL, 1)
  const sleeves = arms.map((a) => sleeve(a, [0.08, 0.075, 0.07]).fill(TEAL, 1))
  const leg = legs(hip, ankle, [0.075, 0.07, 0.066]).map((l) => l.fill(SUN, 1))
  const buttons = [S - 0.14, S - 0.32, S - 0.5].map((y) => buttonOn(coat, [0, y, 0.6], 0.02, WHITE))
  const pocket = patchOn(coat, [-0.12, hem + 0.24, 0.6], 0.05, mixRgb(TEAL, BUTTON, 0.2), 0)
  // the stick in the raised hand, and the ribbons from its top
  const hand = cuffOf(arms[1], 0.58)
  const stickTop: V3 = [hand[0] - 0.1, hand[1] + 0.3, 0.03]
  const stick = tube([cuffOf(arms[1], 0.5), stickTop], [0.014, 0.012], { seg: 5, steps: 1, caps: [true, true] }).fill(WHITE, 0)
  // the head and its hat lean towards the raised arm
  const lean = (s: Shape) => s.place([0, -(S + 0.14), 0]).place([0, S + 0.14, 0], [0, 0, -0.15])
  return {
    cloth: cloth(
      frame(T, arms, POST_BLUE, 0.62),
      stick,
      coat,
      ...sleeves,
      ...leg,
      ...buttons,
      pocket,
      ribbons(stickTop, [RED, SUN, SKY, BERRY]),
      lean(bucketHat(H + 0.09, RED)),
      lean(linenHead(H, RED, 'smile', 4)),
    ),
    straw: thin(...strawOut(arms, 0.56, ankle, H - 0.2, 71)),
  }
}

/** The pinwheel: a yellow sou'wester and a short yellow raincoat, sky-blue trousers in green wellies, a pinwheel held
 *  up in each hand. */
export function pinwheelScarecrow(): Model {
  const T = 1.84
  const S = T - 0.32
  const H = T - 0.03
  const hip = T - 0.78
  const ankle = 0.52
  const arms = [arm(-1, 0.42, S), arm(1, 0.0, S)]
  const coat = body([
    [hip - 0.08, 0.235, 0.16],
    [hip + 0.05, 0.215, 0.145],
    [S - 0.24, 0.19, 0.125],
    [S - 0.04, 0.215, 0.125],
    [S + 0.07, 0.16, 0.105],
    [S + 0.12, 0.07, 0.06],
  ])
    .paint(() => SUN, 1)
    // its placket down the front
    .pattern((x, _y, z) => inside(Math.min(z - 0.05, 0.012 - Math.abs(x))), mixRgb(SUN, rgb(0xb07a10), 0.6))
  const sleeves = arms.map((a) => sleeve(a, [0.09, 0.088, 0.085]).fill(SUN, 1))
  const leg = legs(hip, ankle + 0.1, [0.08, 0.076, 0.072]).map((l) => l.fill(SKY, 1))
  // the wellies, over the trousers' ends
  const wellies = ([-1, 1] as const).flatMap((side) => [
    tube(
      [
        [side * 0.105, ankle + 0.2, 0.03],
        [side * 0.106, ankle, 0.035],
      ],
      [0.088, 0.084],
      { seg: 9, steps: 1, caps: [true, true] },
    ),
    ellipsoid(0.075, 0.055, 0.105, 9, 4).place([side * 0.106, ankle + 0.02, 0.085]),
  ])
  const pins = arms.map((a, k) => {
    const hand = cuffOf(a, 0.56)
    const at: V3 = [hand[0] + a.side * 0.04, hand[1] + 0.34, 0.06]
    return { stick: tube([cuffOf(a, 0.5), at], 0.013, { seg: 4, steps: 1, caps: [true, true] }), wheel: pinwheel(at, k ? [RED, SUN, SKY, WHITE] : [BERRY, SKY, SUN, WHITE], k * 0.4) }
  })
  return {
    cloth: cloth(
      frame(T, arms, POST_BLUE),
      ...pins.map((p) => merge(p.stick.fill(WHITE, 0), p.wheel.pin)),
      coat,
      ...sleeves,
      ...leg,
      merge(...wellies).fill(WELLY, 1),
      souwester(H + 0.085, SUN),
      linenHead(H, SKY, 'happy', 8),
    ),
    straw: thin(...strawOut(arms, 0.56, null, H - 0.2, 81), ...pins.map((p) => p.wheel.sails)),
  }
}

/** The jingle: a saucepan for a hat, a berry-pink dress with a white apron, red stockings, and shiny pie tins hanging
 *  from its arms on strings, to flash in the sun and clatter. */
export function jingleScarecrow(): Model {
  const T = 1.84
  const S = T - 0.32
  const H = T - 0.03
  const hip = T - 0.78
  const ankle = 0.44
  const arms = [arm(-1, -0.16, S), arm(1, -0.2, S)]
  // the apron's bib in front of the bodice, and its skirt in front of the dress
  const apron = (x: number, y: number, z: number) => Math.min(z - 0.04, 0.1 - Math.abs(x), S - 0.1 - y)
  const bodice = body(torso(hip, S, 0.95))
    .paint(() => BERRY, 1)
    .pattern((x, y, z) => inside(apron(x, y, z)), WHITE)
  const dress = skirt(hip + 0.12, 0.66, [0.16, 0.105], [0.32, 0.26], 0.05)
    .paint(() => BERRY, 1)
    .pattern((x, _y, z) => inside(Math.min(z - 0.08, 0.17 - Math.abs(x))), WHITE)
  const sleeves = arms.map((a) => sleeve(a, [0.088, 0.08, 0.074], 0.54).fill(BERRY, 1))
  const leg = legs(hip, ankle, [0.07, 0.065, 0.062]).map((l) => l.fill(RED, 1))
  // the pie tins: two on each arm, on strings of different lengths, turned this way and that
  const hangs = [
    { a: 0, d: 0.24, drop: 0.16, yaw: 0.3 },
    { a: 0, d: 0.47, drop: 0.24, yaw: -0.5 },
    { a: 1, d: 0.27, drop: 0.22, yaw: -0.2 },
    { a: 1, d: 0.5, drop: 0.14, yaw: 0.6 },
  ].map(({ a, d, drop, yaw }) => {
    const at = cuffOf(arms[a], d)
    return pieTin([at[0], at[1] - 0.06, 0.0], drop, yaw)
  })
  return {
    cloth: cloth(frame(T, arms, POST_BLUE), ...hangs.map((h) => h.string), bodice, dress, ...sleeves, ...leg, linenHead(H, BERRY, 'open', 12)),
    tin: shiny(saucepan(H + 0.085), ...hangs.map((h) => h.tin)),
    straw: thin(...strawOut(arms, 0.54, ankle, H - 0.2, 91)),
  }
}

/** The nine, by style: straw and patches, the harvest, ribbons and shine. */
export const SCARECROWS = {
  'scarecrow-farmer': farmerScarecrow,
  'scarecrow-haymaker': haymakerScarecrow,
  'scarecrow-sunflower': sunflowerScarecrow,
  'scarecrow-pumpkin': pumpkinScarecrow,
  'scarecrow-witch': witchScarecrow,
  'scarecrow-crows': crowsScarecrow,
  'scarecrow-ribbons': ribbonsScarecrow,
  'scarecrow-pinwheel': pinwheelScarecrow,
  'scarecrow-jingle': jingleScarecrow,
} as const satisfies Record<string, () => Model>

export type ScarecrowKind = keyof typeof SCARECROWS
export const SCARECROW_KINDS = Object.keys(SCARECROWS) as ScarecrowKind[]

/** One scarecrow's model as a structure (only the parts it has). */
export function scarecrowModel(kind: ScarecrowKind): Structure {
  const m = SCARECROWS[kind]()
  return Object.fromEntries(Object.entries(m).filter(([, p]) => p)) as Structure
}
