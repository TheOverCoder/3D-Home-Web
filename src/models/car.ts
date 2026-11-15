import { Vector3 } from 'three'
import { Parts, ellipsoid, lathe, loft, merge, rgb, shadowPart, squircle, tube, type PartDef, type Ring, type Shape, type V3 } from '../lib/sculpt'
import { mix, slab } from './structures'

// The car that drives you between the farm and the house (src/data/maps.ts): a small red hatchback, sculpted with the
// kit, in the game's toy-like style. It faces +z in its own frame, the middle of its footprint on the ground at the
// origin. Its body is one loft along it (the same rounded section from the boot to the bonnet, which slopes down to
// the grille), its cabin another, up from the beltline (each ring a rounded oblong in plan, smaller towards the roof:
// the windscreen raked, the hatch steep), the windows a band round it with the pillars left in red, and the wheel
// arches dark round each wheel (each pattern's edge crisp). The bumpers, the grille, the lamps, the mirrors and the
// number plates are pieces of their own pressed into it; the wheels stand a little proud of its sides on their axles.
// One part — it stands still, its wheels in it: one draw, casting — and a soft shadow under it.

const RED = rgb(0xd4402f)
const PLASTIC = rgb(0x2b2e31)
const GLASS = rgb(0x1d2a35)
const GLASS_TOP = rgb(0x4a6a82)
const RUBBER = rgb(0x1e2022)
const RIM = rgb(0xc9ccd0)
const HUB = rgb(0x6c7176)
const LAMP = rgb(0xfff4c8)
const TAIL = rgb(0xc8241c)
const PLATE = rgb(0xf2f0e8)

/** Its size: length, width, how high; where its wheels are (centres: across, along) and how big. */
export const CAR_SHAPE = {
  length: 3.5,
  width: 1.62,
  height: 1.45,
  wheel: { x: 0.74, z: 1.14, r: 0.3, w: 0.18 },
  /** the beltline (where the windows begin) and the top of the lower body */
  belt: 0.9,
} as const

const { wheel: W, belt: BELT } = CAR_SHAPE
const HALF_L = CAR_SHAPE.length / 2
const HALF_W = CAR_SHAPE.width / 2
/** The wheel arches: dark round each wheel, this much bigger than it. */
const ARCH = W.r + 0.07
/** The body's underside. */
const SILL = 0.26

/** The lower body: one section from the boot to the grille (the bonnet sloping down at the front, the boot rounded at
 *  the back), its sills dark, a dark arch round each wheel. */
function lowerBody(): Shape {
  const end = HALF_L - 0.12
  const zs = [-end, -end + 0.14, -0.6, 0, 0.62, 0.95, 1.25, end - 0.12, end]
  // rings round each arch, so its edge is round
  for (const az of [-W.z, W.z]) for (const t of [-1.05, -0.85, -0.6, -0.3, 0, 0.3, 0.6, 0.85, 1.05]) zs.push(az + t * ARCH)
  const top = (z: number) => (z > 0.62 ? BELT - 0.12 * Math.min(1, (z - 0.62) / (end - 0.62)) ** 1.4 : z < -end + 0.14 ? BELT - 0.04 : BELT)
  const rings: Ring[] = [...new Set(zs.map((z) => +z.toFixed(4)))]
    .sort((a, b) => a - b)
    .map((z) => {
      const hi = top(z)
      const narrow = Math.max(0, Math.abs(z) - (end - 0.3)) / 0.3
      return { c: [0, (SILL + hi) / 2, z] as V3, rx: HALF_W - 0.05 * narrow * narrow, ry: (hi - SILL) / 2 }
    })
  return loft(rings, { seg: 18, steps: 1, up: [0, 1, 0], shape: (a) => squircle(a, 4.5), round: [0.12, 0.12] })
    .paint(() => RED, 0)
    .pattern((x, y, z) => {
      const sill = 0.5 + (0.34 - y) * 30
      const arch = Math.max(...[-W.z, W.z].map((az) => 0.5 + (ARCH - Math.hypot(y - W.r, z - az)) * 30))
      return Math.abs(x) > HALF_W - 0.3 ? Math.max(sill, arch) : sill
    }, PLASTIC)
}

/** The cabin, up from the beltline (along: 0 there, 1 at the roof): half its width, and how far its front (the
 *  windscreen, raked back) and its back (the hatch, nearly upright) come, as shares of its length at the beltline. */
const CABIN = {
  y0: BELT - 0.04,
  y1: 1.43,
  zc: -0.45,
  half: 1.2,
  width: (along: number) => HALF_W - 0.08 - 0.13 * along ** 1.5,
  front: (along: number) => 1 - 0.58 * along ** 1.1,
  back: (along: number) => 1 - 0.13 * along ** 2,
}
/** The windows: a band round the cabin from just over the beltline to just under the roof. */
const GLASS_Y = [BELT + 0.07, 1.33] as const

/** The cabin over the beltline, its roof rounded over: the rings level (its spine upright), each a rounded oblong in
 *  plan whose front draws back as it rises; the windows a band round it, a pillar between the doors on each side. */
function cabin(): Shape {
  const C = CABIN
  const n = 7
  const rings: Ring[] = Array.from({ length: n + 1 }, (_, k) => {
    const along = k / n
    return { c: [0, C.y0 + (C.y1 - C.y0) * along, C.zc] as V3, rx: C.width(along), ry: C.half }
  })
  const s = loft(rings, {
    seg: 28,
    steps: 1,
    up: [0, 0, 1],
    // (the ring's +z half is the front: it draws back with height; the back half barely)
    shape: (a, along) => squircle(a, 3.6) * (1 - (1 - C.front(along)) * Math.max(0, Math.sin(a)) ** 1.6 - (1 - C.back(along)) * Math.max(0, -Math.sin(a)) ** 1.6),
    round: [0, 0.035],
  })
  const glass = s
    .paint(() => RED, 0)
    .pattern(
      (_x, y) => Math.min(0.5 + (y - GLASS_Y[0]) * 40, 0.5 + (GLASS_Y[1] - y) * 40),
      (_x, y) => mix(GLASS, GLASS_TOP, Math.min(1, Math.max(0, (y - 1.0) / 0.3))),
    )
  // the pillars between the front and the back windows, on the cabin's sides (leaning in with them)
  const along = (y: number) => (y - C.y0) / (C.y1 - C.y0)
  const pillars = [-1, 1].map((sx) => {
    const at = (y: number): V3 => [sx * (C.width(along(y)) + 0.004), y, -0.3]
    return loft(
      [
        { c: at(GLASS_Y[0] - 0.03), rx: 0.012, ry: 0.05 },
        { c: at(GLASS_Y[1] + 0.03), rx: 0.012, ry: 0.05 },
      ],
      { seg: 4, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, 8), caps: [true, true] },
    ).fill(RED, 0)
  })
  return merge(glass, ...pillars)
}

/** A wheel round its axle (along x, at the origin): a tyre on a silver rim with a darker hub. */
function wheel(): Shape {
  const r = W.r
  const w = W.w / 2
  const rim = r * 0.6
  return lathe(
    [
      [0, -w * 0.7],
      [rim, -w * 0.8],
      [r * 0.9, -w],
      [r, -w * 0.7],
      [r, w * 0.7],
      [r * 0.9, w],
      [rim, w * 0.8],
      [0, w * 0.7],
    ],
    { seg: 16, steps: 1 },
  )
    .paint((x, _y, z) => {
      const d = Math.hypot(x, z)
      return d > rim * 1.05 ? RUBBER : d > rim * 0.35 ? RIM : HUB
    }, 0)
    .place([0, 0, 0], [0, 0, Math.PI / 2])
}

/** The running gear under the body: an axle through each pair of wheels, and a strut from it up into the body. */
function axles(): Shape {
  const parts: Shape[] = []
  for (const z of [-W.z, W.z]) {
    parts.push(tube([[-W.x, W.r, z] as V3, [W.x, W.r, z] as V3], 0.035, { seg: 6, steps: 1, caps: [true, true] }))
    parts.push(tube([[0, W.r, z] as V3, [0, SILL + 0.1, z] as V3], 0.05, { seg: 6, steps: 1, caps: [true, true] }))
  }
  return merge(...parts).fill(PLASTIC, 0)
}

/** The bumpers across each end, the grille, the lamps, a mirror on each door, the number plates. */
function fittings(): Shape {
  const bumper = (z: number, dir: number) =>
    loft(
      [
        { c: [-HALF_W + 0.04, 0.38, z - dir * 0.2] as V3, rx: 0.07, ry: 0.09 },
        { c: [-HALF_W + 0.22, 0.38, z - dir * 0.02] as V3, rx: 0.07, ry: 0.09 },
        { c: [HALF_W - 0.22, 0.38, z - dir * 0.02] as V3, rx: 0.07, ry: 0.09 },
        { c: [HALF_W - 0.04, 0.38, z - dir * 0.2] as V3, rx: 0.07, ry: 0.09 },
      ],
      { seg: 8, steps: 2, up: [0, 1, 0], shape: (a) => squircle(a, 3), round: [0.04, 0.04] },
    ).fill(PLASTIC, 0)
  const front = HALF_L - 0.05
  const bumpers = [bumper(front + 0.02, 1), bumper(-front - 0.02, -1)]
  // the grille and the lamps half in the body's rounded ends, half out
  const grille = slab(0.3, 0.05, 0.48, 0.64, 6, 12)
    .place([0, 0, front + 0.01])
    .fill(PLASTIC, 0)
  const lamps = [-1, 1].flatMap((sx) => [
    ellipsoid(0.14, 0.07, 0.07, 10, 4)
      .place([sx * 0.52, 0.64, front - 0.04])
      .fill(LAMP, 0),
    ellipsoid(0.1, 0.08, 0.07, 10, 4)
      .place([sx * 0.58, 0.7, -front + 0.02])
      .fill(TAIL, 0),
  ])
  // the mirrors stand on the body's top just ahead of the doors, out past its sides
  const mirrors = [-1, 1].map((sx) =>
    merge(
      tube([[sx * (HALF_W - 0.2), BELT - 0.08, 0.46] as V3, [sx * (HALF_W + 0.02), BELT + 0.06, 0.46] as V3], 0.022, { seg: 6, steps: 1, caps: [true, true] }),
      ellipsoid(0.06, 0.055, 0.085, 8, 4).place([sx * (HALF_W + 0.05), BELT + 0.07, 0.44]),
    ).fill(PLASTIC, 0),
  )
  // the plates on the bumpers' faces, their backs in them
  const plates = [front + 0.1, -front - 0.1].map((z) => slab(0.18, 0.02, 0.33, 0.43, 8, 12).place([0, 0, z]).fill(PLATE, 0))
  return merge(...bumpers, grille, ...lamps, ...mirrors, ...plates)
}

let made: ReturnType<Shape['geometry']> | null = null

/** The car in one piece: its body, its cabin, its fittings, its axles and its four wheels. */
export function carShape(): Shape {
  const wheels = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => wheel().place([sx * W.x, W.r, sz * W.z])))
  return merge(lowerBody(), cabin(), fittings(), axles(), ...wheels)
}

/** Its geometry (built once). */
export function carGeometry() {
  made ??= carShape().geometry()
  return made
}

export type CarPart = 'car' | 'shadow'

/** The car's draws: the car (one part, casting) and the soft shadow under it, for up to `max` cars. */
export function carParts(max = 1): Parts<CarPart> {
  const defs: Record<CarPart, PartDef> = {
    car: { geometry: carGeometry(), max, material: { roughness: 0.38, metalness: 0.1 }, castShadow: true },
    shadow: shadowPart(max, 0.32),
  }
  return new Parts<CarPart>(defs, 'car')
}

/** The soft shadow under it: its footprint. */
const SHADOW = new Vector3(0.95, 1, 1.95)

/** Puts the car at (x, z), its bonnet pointing `yaw` the way the player's yaw does (0 north, along −z; π/2 west). */
export function putCar(parts: Parts<CarPart>, x: number, z: number, yaw: number) {
  // the kit turns a model facing +z by its heading (0 south): the player's yaw points the other way
  parts.at(x, 0, z, yaw + Math.PI)
  parts.put('car', 0, 0, 0)
  parts.put('shadow', 0, 0.012, 0, 0, 0, 0, SHADOW)
}

/** Its footprint round its middle, half its size each way, turned to `yaw` (only a quarter turn or none: x and z). */
export function carHalf(yaw: number): { x: number; z: number } {
  const across = Math.abs(Math.sin(yaw)) > 0.5
  return across ? { x: HALF_L, z: HALF_W } : { x: HALF_W, z: HALF_L }
}
