import { Vector3, type BufferGeometry } from 'three'
import { ellipsoid, fbm3, lathe, loft, merge, mixRgb, Parts, rgb, shadowPart, smoothstep, squircle, tube, type PartDef, type Shape, type V3 } from '../lib/sculpt'

// A dairy cow, about 2 m from nose to tail and 1.45 m at the withers, facing +z, standing on y = 0. She is five
// moving parts — the body (with the udder), the head and neck, a front leg and a hind leg (each drawn twice), the
// tail — each built round the joint it turns about, so a herd is posed with one matrix per part. Three coats:
// black-and-white, a fawn Jersey, white with brown patches; the patterns are painted into the vertices.

export const COW_PIVOTS = {
  /** where the neck leaves the chest: the head lowers to graze about this point */
  neck: [0, 1.17, 0.58] as V3,
  /** shoulder and hip joints, front left, front right, hind left, hind right (left is +x: she faces +z) */
  legs: [
    [0.2, 0.98, 0.42],
    [-0.2, 0.98, 0.42],
    [0.19, 0.985, -0.6],
    [-0.19, 0.985, -0.6],
  ] as V3[],
  /** the root of the tail, on top of the rump */
  tail: [0, 1.22, -0.9] as V3,
}

/** How far the head hangs at rest (radians, nose down). */
const REST_PITCH = 0.28

export interface Coat {
  name: string
  base: number
  patch: number
  /** muzzle, udder, inside of the ears */
  skin: number
  /** how much of the coat is patched (0 none … 1 nearly all) */
  patches: number
  seed: number
  /** a pale stripe down the face */
  blaze: boolean
  /** legs pale below the knee */
  socks: boolean
  /** darker face and legs and a pale ring round the muzzle, as on a Jersey */
  jersey: boolean
}

export const COATS: Coat[] = [
  { name: 'black and white', base: 0xf4f1ea, patch: 0x1d1b1a, skin: 0xe7a99c, patches: 0.5, seed: 3, blaze: true, socks: true, jersey: false },
  { name: 'Jersey', base: 0xb47a48, patch: 0x7a4f2c, skin: 0x3b302a, patches: 0, seed: 5, blaze: false, socks: false, jersey: true },
  { name: 'white and brown', base: 0xf1ece2, patch: 0x8a5232, skin: 0xe2a497, patches: 0.36, seed: 11, blaze: true, socks: true, jersey: false },
]

const HOOF = rgb(0x2a2523)
const HORN = rgb(0xe9dfc6)
const HORN_TIP = rgb(0x4a3d32)
const EYE = rgb(0x120f0e)
const NOSTRIL = rgb(0x2a1d1b)

/** The coat's pattern at a point of the cow (in her own frame): a patch where it is above 0.5. The noise is 3D,
 *  so patches wrap round the body as real ones do, and the head, legs and tail (built in frames of their own) look
 *  up the same pattern where they join the body. */
function patchAt(coat: Coat, x: number, y: number, z: number): number {
  if (coat.patches <= 0) return 0
  const n = fbm3(x * 2.1 + 7, y * 2.1, z * 2.1, coat.seed, 3)
  return 0.5 + (n - (0.5 - coat.patches * 0.1)) * 4
}

/** Paints a part in the coat: the base colour, and the patches as a crisp pattern. `frame` takes a point of the
 *  part to the same point of the cow standing at rest. */
function coatPart(shape: Shape, coat: Coat, frame: (x: number, y: number, z: number) => V3) {
  const base = rgb(coat.base)
  shape.paint(() => base, 1)
  if (coat.patches > 0) shape.pattern((x, y, z) => patchAt(coat, ...frame(x, y, z)), rgb(coat.patch))
  return shape
}

/** A point of the head (built round the neck joint) on the cow at rest, with her head hanging at REST_PITCH. */
const headFrame = (x: number, y: number, z: number): V3 => {
  const c = Math.cos(REST_PITCH)
  const s = Math.sin(REST_PITCH)
  return [x + COW_PIVOTS.neck[0], y * c - z * s + COW_PIVOTS.neck[1], y * s + z * c + COW_PIVOTS.neck[2]]
}

const darken = (c: V3, k: number): V3 => [c[0] * k, c[1] * k, c[2] * k]

/** Darker underneath: the sky lights her back, her own body shades her belly. */
const undershade = (low: number, high: number, depth: number) => (_x: number, y: number) => 1 - depth * (1 - smoothstep(low, high, y))

function body(coat: Coat): Shape {
  const torso = loft(
    [
      { c: [0, 1.11, -0.78], rx: 0.33, ry: 0.36 },
      { c: [0, 1.03, -0.52], rx: 0.37, ry: 0.42 },
      { c: [0, 0.99, -0.18], rx: 0.41, ry: 0.45 },
      { c: [0, 1.0, 0.15], rx: 0.4, ry: 0.45 },
      { c: [0, 1.04, 0.42], rx: 0.33, ry: 0.42 },
      { c: [0, 1.1, 0.6], rx: 0.25, ry: 0.34 },
    ],
    {
      seg: 18,
      steps: 4,
      // a rounded rump behind, the chest in front (mostly hidden by the neck)
      round: [0.17, 0.13],
      shape: (a, t) => {
        const up = Math.sin(a)
        const side = Math.abs(Math.cos(a))
        // a squarish rump and a rounder barrel
        let m = squircle(a, 2.15 + 0.8 * (1 - smoothstep(0, 0.35, t)))
        // the rump narrows below, between the thighs
        m *= 1 - 0.14 * Math.max(0, -up) * (1 - smoothstep(0, 0.3, t))
        // hip bones (hooks) standing out at the top corners of the rump, and the spine along the back
        m += 0.05 * Math.exp(-(((t - 0.2) / 0.08) ** 2)) * Math.exp(-(((up - 0.62) / 0.22) ** 2)) * smoothstep(0.2, 0.5, side)
        m += 0.02 * Math.max(0, up) ** 12 * smoothstep(0.1, 0.25, t)
        // the belly hangs a little in the middle
        m += 0.05 * Math.max(0, -up) * Math.exp(-(((t - 0.55) / 0.22) ** 2))
        return m
      },
    },
  )
  coatPart(torso, coat, (x, y, z) => [x, y, z])
  torso.shade(undershade(0.6, 1.1, 0.3))

  // the udder, with four teats
  const skin = rgb(coat.jersey ? 0xd9a08f : coat.skin)
  const udder = merge(
    lathe(
      [
        [0.0, 0.0],
        [0.09, 0.01],
        [0.13, 0.03],
        [0.16, 0.1],
        [0.15, 0.17],
        [0.06, 0.22],
      ],
      { seg: 12, steps: 1 },
    ).place([0, 0.57, -0.5], [0, 0, 0], [1, 1, 1.15]),
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) =>
        tube(
          [
            [sx * 0.06, 0.62, -0.5 + sz * 0.07],
            [sx * 0.065, 0.55, -0.5 + sz * 0.075],
            [sx * 0.065, 0.5, -0.5 + sz * 0.075],
          ],
          [0.022, 0.017, 0.012],
          { seg: 6, steps: 1, caps: [false, true] },
        ),
      ),
    ),
  ).fill(skin, 0)
  udder.shade(undershade(0.5, 0.75, 0.2))
  return merge(torso, udder)
}

function head(coat: Coat): Shape {
  const neck = loft(
    [
      { c: [0, -0.01, -0.12], rx: 0.21, ry: 0.28 },
      { c: [0, 0.02, 0.07], rx: 0.2, ry: 0.27 },
      { c: [0, 0.07, 0.25], rx: 0.16, ry: 0.22 },
      { c: [0, 0.12, 0.38], rx: 0.13, ry: 0.16 },
    ],
    {
      seg: 12,
      steps: 2,
      // closed at both ends: in the chest and in the skull, however far the head turns
      round: [0.08, 0.05],
      // the dewlap: loose skin hanging under the throat
      shape: (a, t) => 1 + 0.2 * Math.max(0, -Math.sin(a)) ** 3 * Math.sin(Math.PI * Math.min(1, t * 1.15)),
    },
  )
  const skull = loft(
    [
      { c: [0, 0.19, 0.33], rx: 0.1, ry: 0.09 },
      { c: [0, 0.2, 0.41], rx: 0.165, ry: 0.13 },
      { c: [0, 0.14, 0.52], rx: 0.165, ry: 0.14 },
      { c: [0, 0.05, 0.62], rx: 0.125, ry: 0.115 },
      { c: [0, -0.02, 0.7], rx: 0.12, ry: 0.105 },
      { c: [0, -0.06, 0.765], rx: 0.145, ry: 0.105 },
      { c: [0, -0.08, 0.81], rx: 0.115, ry: 0.08 },
      { c: [0, -0.085, 0.828], rx: 0, ry: 0 },
    ],
    {
      seg: 14,
      steps: 2,
      // full cheeks below the eyes; a broad, flat-fronted muzzle
      shape: (a, t) => squircle(a, 2 + 0.8 * smoothstep(0.6, 0.85, t)) * (1 + 0.1 * Math.max(0, -Math.sin(a)) * Math.exp(-(((t - 0.38) / 0.16) ** 2))),
    },
  )
  const face = coatPart(merge(neck, skull), coat, headFrame)
  if (coat.blaze) face.blend(rgb(0xf6f3ec), (x, _y, z) => smoothstep(0.012, 0, Math.abs(x) - 0.045 - (0.75 - z) * 0.06) * smoothstep(0.38, 0.45, z))
  if (coat.jersey) {
    face.shade((_x, _y, z) => 1 - 0.42 * smoothstep(0.4, 0.72, z))
    // a Jersey's pale ring round the muzzle
    face.blend(rgb(0xe8dcc6), (_x, _y, z) => smoothstep(0.66, 0.71, z) * (1 - smoothstep(0.74, 0.76, z)))
  }
  face.blend(rgb(coat.skin), (_x, _y, z) => smoothstep(0.735, 0.775, z))
  face.shade((x, y, z) => undershade(0.85, 1.2, 0.16)(0, headFrame(x, y, z)[1]))

  const parts: Shape[] = [face]
  for (const sx of [-1, 1]) {
    // eyes, set wide on the sides of the forehead
    parts.push(ellipsoid(0.03, 0.026, 0.032, 8, 4).place([sx * 0.15, 0.16, 0.5]).fill(EYE, 0))
    // ears: flat, cupped, out to the side and a little down, pale inside
    const ear = loft(
      [
        { c: [0, 0, 0], rx: 0.035, ry: 0.02 },
        { c: [0, 0, 0.07], rx: 0.062, ry: 0.016 },
        { c: [0, -0.005, 0.15], rx: 0.042, ry: 0.012 },
        { c: [0, -0.01, 0.19], rx: 0, ry: 0 },
      ],
      { seg: 8, steps: 1 },
    )
    const outside = rgb(patchAt(coat, sx * 0.3, 1.38, 1.0) > 0.5 ? coat.patch : coat.base)
    ear.paint((_x, y) => (y > 0.004 ? rgb(coat.jersey ? 0xb98a6a : 0xe9b0a4) : coat.jersey ? darken(outside, 0.7) : outside), 0)
    parts.push(ear.place([sx * 0.15, 0.21, 0.43], [0.3, sx * Math.PI * 0.5, sx * 0.35]))
    // horns: short, curving out and forward
    const horn = tube(
      [
        [0, 0, 0],
        [sx * 0.05, 0.03, 0.01],
        [sx * 0.08, 0.07, 0.04],
        [sx * 0.085, 0.1, 0.075],
      ],
      [0.024, 0.019, 0.012, 0],
      { seg: 6, steps: 1 },
    )
    horn.paint((x) => mixRgb(HORN, HORN_TIP, smoothstep(0.05, 0.085, Math.abs(x))), 0)
    parts.push(horn.place([sx * 0.1, 0.25, 0.4]))
    // nostrils
    parts.push(ellipsoid(0.024, 0.016, 0.01, 6, 3).place([sx * 0.05, -0.07, 0.817], [0, sx * 0.45, 0]).fill(NOSTRIL, 0))
  }
  // a tuft of hair on the poll
  parts.push(coatPart(ellipsoid(0.08, 0.04, 0.06, 8, 4).place([0, 0.25, 0.38]), coat, headFrame))
  return merge(...parts)
}

/** A leg from its joint at the origin to the ground at y = −0.98 (the hind leg bends back at the hock). */
function leg(coat: Coat, hind: boolean): Shape {
  const rings = hind
    ? [
        { c: [0, 0.08, 0.02], rx: 0.13, ry: 0.2 },
        { c: [0, -0.2, -0.04], rx: 0.1, ry: 0.17 },
        { c: [0, -0.4, -0.1], rx: 0.068, ry: 0.1 },
        { c: [0, -0.5, -0.125], rx: 0.055, ry: 0.075 },
        { c: [0, -0.62, -0.095], rx: 0.045, ry: 0.052 },
        { c: [0, -0.8, -0.025], rx: 0.05, ry: 0.056 },
        { c: [0, -0.875, 0.01], rx: 0.047, ry: 0.05 },
        { c: [0, -0.905, 0.02], rx: 0.058, ry: 0.066 },
        { c: [0, -0.98, 0.035], rx: 0.064, ry: 0.074 },
        { c: [0, -0.985, 0.035], rx: 0, ry: 0 },
      ]
    : [
        { c: [0, 0.08, 0], rx: 0.11, ry: 0.15 },
        { c: [0, -0.2, 0.01], rx: 0.09, ry: 0.11 },
        { c: [0, -0.44, 0], rx: 0.064, ry: 0.07 },
        { c: [0, -0.54, 0], rx: 0.058, ry: 0.066 },
        { c: [0, -0.66, 0], rx: 0.045, ry: 0.05 },
        { c: [0, -0.8, 0.012], rx: 0.05, ry: 0.056 },
        { c: [0, -0.875, 0.035], rx: 0.047, ry: 0.05 },
        { c: [0, -0.905, 0.045], rx: 0.058, ry: 0.066 },
        { c: [0, -0.98, 0.06], rx: 0.064, ry: 0.074 },
        { c: [0, -0.985, 0.06], rx: 0, ry: 0 },
      ]
  // the top closed with a dome in the body (it shows as the leg swings), the hoof's sole at a point
  const l = loft(rings as { c: V3; rx: number; ry: number }[], { seg: 8, steps: 1, up: [0, 0, 1], round: [0.06, 0] })
  const top = hind ? COW_PIVOTS.legs[2] : COW_PIVOTS.legs[0]
  coatPart(l, coat, (x, y, z) => [x + top[0], y + top[1], z + top[2]])
  if (coat.socks) l.blend(rgb(coat.base), (_x, y) => smoothstep(-0.48, -0.56, y))
  if (coat.jersey) l.shade((_x, y) => 1 - 0.5 * smoothstep(-0.3, -0.8, y))
  l.paint((_x, y) => (y < -0.885 ? HOOF : null), 0)
  l.shade(undershade(-0.98, -0.3, 0.22))
  return l
}

function tail(coat: Coat): Shape {
  const t = tube(
    [
      [0, 0.02, 0.1],
      [0, 0.02, 0],
      [0, -0.06, -0.07],
      [0, -0.3, -0.095],
      [0, -0.55, -0.07],
      [0, -0.66, -0.06],
    ],
    [0.04, 0.036, 0.024, 0.016, 0.013, 0.012],
    { seg: 6, steps: 2, caps: [true, false] },
  )
  coatPart(t, coat, (x, y, z) => [x, y + COW_PIVOTS.tail[1], z + COW_PIVOTS.tail[2]])
  // the switch: a long tuft of hair at the end
  const sw = loft(
    [
      { c: [0, -0.6, -0.06], rx: 0, ry: 0 },
      { c: [0, -0.68, -0.06], rx: 0.05, ry: 0.045 },
      { c: [0, -0.78, -0.06], rx: 0.045, ry: 0.04 },
      { c: [0, -0.87, -0.06], rx: 0, ry: 0 },
    ],
    { seg: 8, steps: 1, up: [0, 0, 1], shape: (a) => 1 + 0.15 * Math.sin(a * 5) },
  ).fill(rgb(coat.patches > 0.4 ? coat.patch : coat.jersey ? 0x2c211b : coat.base), 0)
  return merge(t, sw)
}

export interface CowGeometries {
  body: BufferGeometry
  head: BufferGeometry
  front: BufferGeometry
  hind: BufferGeometry
  tail: BufferGeometry
}

const made = new Map<number, CowGeometries>()

/** The parts of a cow in one of the coats (built once, then shared). */
export function cowGeometries(variant: number): CowGeometries {
  const k = variant % COATS.length
  let g = made.get(k)
  if (!g) {
    const coat = COATS[k]
    g = { body: body(coat).geometry(), head: head(coat).geometry(), front: leg(coat, false).geometry(), hind: leg(coat, true).geometry(), tail: tail(coat).geometry() }
    made.set(k, g)
  }
  return g
}

// ───────────────────────────── drawing and posing ─────────────────────────────

/** Instanced draws for a herd: every part in every coat (up to `perCoat` cows wearing each), and their shadows. */
export function cowParts(perCoat: number): Parts {
  const defs: Record<string, PartDef> = { shadow: shadowPart(perCoat * COATS.length) }
  COATS.forEach((_, k) => {
    const g = cowGeometries(k)
    defs[`body${k}`] = { geometry: g.body, max: perCoat }
    defs[`head${k}`] = { geometry: g.head, max: perCoat }
    defs[`front${k}`] = { geometry: g.front, max: perCoat * 2 }
    defs[`hind${k}`] = { geometry: g.hind, max: perCoat * 2 }
    defs[`tail${k}`] = { geometry: g.tail, max: perCoat }
  })
  return new Parts(defs, 'cows')
}

export interface CowPose {
  /** walk cycle, radians (a full stride per 2π) */
  phase: number
  /** 0 standing … 1 walking */
  stride: number
  /** 0 head up … 1 muzzle in the grass */
  graze: number
  /** tail swish, radians of its own cycle */
  tail: number
  /** head turned to the side, radians (positive: to her left) */
  look?: number
  /** chewing (a little nod while grazing), radians of its own cycle */
  chew?: number
}

const SHADOW_SIZE = new Vector3(0.62, 1, 1.15)

/** Puts one cow (in coat `coat`) at x, z facing `heading`, in a pose. */
export function putCow(parts: Parts, coat: number, x: number, z: number, heading: number, p: CowPose) {
  const k = coat % COATS.length
  const s = p.stride
  const bob = Math.abs(Math.sin(p.phase)) * 0.025 * s
  parts.at(x, 0, z, heading)
  // the body rolls a little with each step
  parts.put(`body${k}`, 0, bob, 0, 0, 0, Math.sin(p.phase) * 0.018 * s)
  // the head: lowered from the shoulders to graze (the neck slides down into the chest as it goes), nodding with
  // the walk or while she chews
  const g = p.graze
  const nod = Math.sin(p.phase * 2) * 0.04 * s + (p.chew !== undefined ? Math.sin(p.chew) * 0.03 * g : 0)
  const [nx, ny, nz] = COW_PIVOTS.neck
  parts.put(`head${k}`, nx, ny + bob - 0.12 * g, nz + 0.04 * g, REST_PITCH + (1.14 - REST_PITCH) * g + nod, (p.look ?? 0) * (1 - g * 0.6), 0)
  // legs: diagonal pairs swing together (a walk), the hind legs half a beat behind the front ones
  COW_PIVOTS.legs.forEach(([lx, ly, lz], j) => {
    const offset = j === 0 || j === 3 ? 0 : Math.PI
    const swing = Math.sin(p.phase + offset + (j >= 2 ? 0.5 : 0)) * 0.32 * s
    parts.put(j < 2 ? `front${k}` : `hind${k}`, lx, ly + bob, lz, swing)
  })
  const [tx, ty, tz] = COW_PIVOTS.tail
  parts.put(`tail${k}`, tx, ty + bob, tz, 0.1 + Math.sin(p.tail * 0.5) * 0.06, 0, Math.sin(p.tail) * 0.28)
  parts.put('shadow', 0, 0.012, -0.05, 0, 0, 0, SHADOW_SIZE)
}
