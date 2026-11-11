import { Vector3 } from 'three'
import { Parts, ellipsoid, lathe, loft, merge, rgb, shadowPart, smoothstep, squircle, tube, type PartDef, type Shape, type V3 } from '../lib/sculpt'
import { crateShape } from './buildings'
import { PersonRig, type PersonLook } from './person'
import { mix, slab } from './structures'

// The farm's tractor, sculpted with the kit: a small green tractor with yellow wheels, a sunshade on four posts, a
// tall exhaust, and a carrier behind for the crates of the orders (two by two). It faces +z in its own frame, the
// ground under its rear axle at the origin. Its wheels turn as it rolls (a part each size, built round its axle);
// the crates are a part of their own (on the carrier, on the pallet, and hopping between them). Its driver is one of
// the farm's people (src/models/person.ts), seated (seatDriver), drawn with the buyers' crowd.

const GREEN = rgb(0x3e8a3a)
const GREEN_DARK = rgb(0x2c6a2c)
const YELLOW = rgb(0xf2c230)
const BLACK = rgb(0x2a2c2f)
const RUBBER = rgb(0x26282a)
const SHADE = rgb(0xf1ead8)
const LAMP = rgb(0xfff2c0)

/** Where its wheels are (centres: x either side, height, z), how big, and where its seat and carrier are. */
export const TRACTOR_SHAPE = {
  rear: { x: 0.6, r: 0.52, z: 0, w: 0.16 },
  front: { x: 0.5, r: 0.3, z: 1.45, w: 0.1 },
  seat: { y: 1.04, z: -0.28 },
  /** the carrier's floor: its height and its middle; a crate's places on it */
  carrier: { y: 0.6, z: -1.38, slots: [-0.25, 0.25].flatMap((x) => [-1.18, -1.58].map((z) => [x, z] as [number, number])) },
  /** its body, half its size each way round its middle (for its collider), from its carrier to its nose */
  body: { half: [0.72, 0.85, 1.82] as V3, y: 0.85, z: 0.02 },
} as const

/** A box with soft edges round (x, y, z). */
const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number, soft = 8, seg = 16) => slab(hx, hz, y - hy, y + hy, soft, seg).place([x, 0, z])

/** A straight piece from a to b: rx across, ry along `up`, its ends closed flat. */
const beam = (a: V3, b: V3, rx: number, ry: number, up: V3 = [0, 1, 0], soft = 8) =>
  loft(
    [
      { c: a, rx, ry },
      { c: b, rx, ry },
    ],
    { seg: 8, steps: 1, up, shape: (t) => squircle(t, soft), caps: [true, true] },
  )

/** A wheel round its axle (along x, at the origin): a lugged tyre on a yellow rim with a dark hub. */
function wheel(r: number, w: number): Shape {
  const rim = r * 0.6
  const s = lathe(
    [
      [0, -w * 0.62],
      [rim * 0.5, -w * 0.62],
      [rim, -w * 0.7],
      [rim * 1.04, -w],
      [r * 0.92, -w * 1.02],
      [r, -w * 0.8],
      [r, w * 0.8],
      [r * 0.92, w * 1.02],
      [rim * 1.04, w],
      [rim, w * 0.7],
      [rim * 0.5, w * 0.62],
      [0, w * 0.62],
    ],
    { seg: 40, steps: 1 },
  )
  return s
    .paint((x, _y, z) => {
      const d = Math.hypot(x, z)
      return d > rim * 1.02 ? RUBBER : d > rim * 0.35 ? YELLOW : mix(YELLOW, BLACK, 0.6)
    }, 0)
    .pattern((x, y, z) => (Math.hypot(x, z) > r * 0.97 ? 0.5 + 0.6 * Math.sin(Math.atan2(z, x) * 18 + Math.abs(y) * (8 / w)) : 0), rgb(0x141516))
    .place([0, 0, 0], [0, 0, Math.PI / 2])
}

/** The tractor's body: everything but its wheels. */
function body(): Shape {
  const { rear, front, seat, carrier } = TRACTOR_SHAPE
  // the hood over the engine, from the dash to a rounded nose with the grille, two lamps
  const hood = loft(
    [
      { c: [0, 0.88, 0.42], rx: 0.27, ry: 0.22 },
      { c: [0, 0.86, 1.1], rx: 0.26, ry: 0.21 },
      { c: [0, 0.82, 1.75], rx: 0.24, ry: 0.19 },
    ],
    { seg: 20, steps: 2, up: [0, 1, 0], shape: (a) => squircle(a, 3.2), round: [0, 0.08], caps: [true, false] },
  )
    .paint((_x, y, z) => (z > 1.72 ? BLACK : mix(GREEN, GREEN_DARK, smoothstep(0.86, 0.68, y) * 0.5)), 0)
    .pattern((x, y, z) => (z > 1.7 && Math.abs(x) < 0.18 && y > 0.7 && y < 0.96 ? 0.5 + 0.6 * Math.sin(y * 120) : 0), rgb(0x55585c))
  const lamps = merge(...[-1, 1].map((sx) => ellipsoid(0.045, 0.045, 0.03, 10, 6).place([sx * 0.17, 0.95, 1.8]))).paint(() => LAMP, 0)
  // under the hood the engine and the front axle; behind it the footplate, the body under the seat, and the
  // housing over the rear axle that the carrier's arms hang from
  const chassis = merge(
    box(0, 0.5, 1.1, 0.2, 0.16, 0.75, 8),
    beam([-front.x, front.r, front.z], [front.x, front.r, front.z], 0.06, 0.06, [0, 1, 0], 4),
    box(0, 0.56, 0.1, 0.33, 0.1, 0.45, 8),
    box(0, 0.83, -0.42, 0.3, 0.14, 0.3, 8),
    box(0, 0.62, -0.45, 0.3, 0.14, 0.3, 8),
    beam([-rear.x, rear.r, rear.z], [rear.x, rear.r, rear.z], 0.08, 0.08, [0, 1, 0], 4),
  ).paint((_x, y) => mix(GREEN_DARK, BLACK, smoothstep(0.75, 0.4, y) * 0.6), 0)
  // a fender over each rear wheel, and the plate that holds it to the body
  const fender = (sx: number) => {
    const rings = []
    for (let k = 0; k <= 10; k++) {
      const a = 0.25 + (k / 10) * 2.55
      rings.push({ c: [sx * rear.x, rear.r + Math.sin(a) * (rear.r + 0.09), rear.z + Math.cos(a) * (rear.r + 0.09)] as V3, rx: 0.2, ry: 0.018 })
    }
    return merge(loft(rings, { seg: 8, steps: 1, up: [0, 1, 0], shape: (t) => squircle(t, 8), caps: [true, true] }), box(sx * 0.38, 0.88, rear.z - 0.05, 0.06, 0.22, 0.45, 8)).paint(() => GREEN, 0)
  }
  // the seat and its back, the dash and the steering wheel on its column
  const wheelAt: V3 = [0, 1.34, 0.22]
  const steering = merge(
    tube(
      Array.from({ length: 25 }, (_, k): V3 => {
        const a = (k / 24) * Math.PI * 2
        return [Math.cos(a) * 0.16, Math.sin(a) * 0.16 * 0.55, Math.sin(a) * 0.16 * 0.83]
      }),
      0.016,
      { seg: 6, steps: 1, caps: [true, true] },
    ).place(wheelAt),
    beam([wheelAt[0], wheelAt[1], wheelAt[2]], [0, 1.02, 0.4], 0.022, 0.022, [0, 0, 1], 2),
    beam([-0.15, wheelAt[1], wheelAt[2]], [0.15, wheelAt[1], wheelAt[2]], 0.012, 0.012, [0, 1, 0], 2),
  ).paint(() => BLACK, 0)
  const cab = merge(box(0, seat.y - 0.04, seat.z, 0.21, 0.05, 0.2, 8), box(0, seat.y + 0.22, seat.z - 0.2, 0.2, 0.22, 0.04, 8), box(0, 1.0, 0.42, 0.24, 0.13, 0.06, 8)).paint(() => BLACK, 0)
  // the exhaust up the right side of the hood, with its cap
  const exhaust = merge(
    tube(
      [
        [0.15, 0.95, 1.15],
        [0.15, 1.82, 1.15],
      ],
      0.035,
      { seg: 10, caps: [true, false] },
    ),
    lathe(
      [
        [0.0, 1.8],
        [0.05, 1.8],
        [0.05, 1.86],
        [0.0, 1.9],
      ],
      { seg: 10, steps: 1 },
    ).place([0.15, 0, 1.15]),
  ).paint(() => BLACK, 0)
  // the sunshade on four posts
  const posts = [
    beam([-0.3, 0.9, -0.62], [-0.3, 2.06, -0.62], 0.022, 0.022, [0, 0, 1], 3),
    beam([0.3, 0.9, -0.62], [0.3, 2.06, -0.62], 0.022, 0.022, [0, 0, 1], 3),
    beam([-0.22, 1.0, 0.42], [-0.3, 2.06, 0.5], 0.022, 0.022, [0, 0, 1], 3),
    beam([0.22, 1.0, 0.42], [0.3, 2.06, 0.5], 0.022, 0.022, [0, 0, 1], 3),
  ]
  const shade = merge(
    ...posts.map((p) => p.paint(() => BLACK, 0)),
    box(0, 2.08, -0.06, 0.6, 0.035, 0.66, 10).paint(() => SHADE, 0),
  )
  // the carrier behind: a floor, low boards round three sides, two arms to the body
  const cz = carrier.z
  const crateRail = merge(
    box(0, carrier.y - 0.03, cz, 0.62, 0.03, 0.42, 8),
    box(-0.6, carrier.y + 0.08, cz, 0.02, 0.1, 0.42, 6, 8),
    box(0.6, carrier.y + 0.08, cz, 0.02, 0.1, 0.42, 6, 8),
    box(0, carrier.y + 0.08, cz - 0.4, 0.62, 0.1, 0.02, 6, 8),
    beam([-0.25, carrier.y - 0.02, cz + 0.4], [-0.22, 0.62, -0.62], 0.03, 0.03, [0, 1, 0], 4),
    beam([0.25, carrier.y - 0.02, cz + 0.4], [0.22, 0.62, -0.62], 0.03, 0.03, [0, 1, 0], 4),
  ).paint((_x, y) => (y > carrier.y ? YELLOW : mix(GREEN_DARK, BLACK, 0.4)), 0)
  return merge(hood, lamps, chassis, fender(-1), fender(1), steering, cab, exhaust, shade, crateRail)
}

export type TractorPart = 'body' | 'wheelRear' | 'wheelFront' | 'crate' | 'shadow'

let made: Record<'body' | 'wheelRear' | 'wheelFront' | 'crate', ReturnType<Shape['geometry']>> | null = null

/** The tractor's geometries (built once). */
export function tractorGeometries() {
  const { rear, front } = TRACTOR_SHAPE
  made ??= {
    body: body().geometry(),
    wheelRear: wheel(rear.r, rear.w).geometry(),
    wheelFront: wheel(front.r, front.w).geometry(),
    crate: crateShape().geometry(),
  }
  return made
}

/** Instanced draws for the tractor and up to `crates` crates (on it, on the pallet, hopping). */
export function tractorParts(crates: number): Parts<TractorPart> {
  const g = tractorGeometries()
  const defs: Record<TractorPart, PartDef> = {
    body: { geometry: g.body, max: 1, material: { roughness: 0.5, metalness: 0.15 }, castShadow: true },
    wheelRear: { geometry: g.wheelRear, max: 2, material: { roughness: 0.8 }, castShadow: true },
    wheelFront: { geometry: g.wheelFront, max: 2, material: { roughness: 0.8 }, castShadow: true },
    crate: { geometry: g.crate, max: crates, material: { roughness: 0.85, surface: { kind: 'boards', size: 0.36, tone: 0.3 } }, castShadow: true },
    shadow: shadowPart(1, 0.3),
  }
  return new Parts<TractorPart>(defs, 'tractor')
}

/**
 * The tractor at (x, z) facing `heading`, its wheels turned for having rolled `roll` metres, and the crates on its
 * carrier (`aboard`, up to four). The parts must be begun by the caller (the crates elsewhere are put after).
 */
export function putTractor(parts: Parts<TractorPart>, x: number, z: number, heading: number, roll: number, aboard: number) {
  const { rear, front, carrier } = TRACTOR_SHAPE
  parts.at(x, 0, z, heading)
  parts.put('body', 0, 0, 0)
  for (const sx of [-1, 1]) {
    parts.put('wheelRear', sx * rear.x, rear.r, rear.z, roll / rear.r)
    parts.put('wheelFront', sx * front.x, front.r, front.z, roll / front.r)
  }
  for (let k = 0; k < Math.min(aboard, carrier.slots.length); k++) {
    const [cx, cz] = carrier.slots[k]
    parts.put('crate', cx, carrier.y, cz, 0, k % 2 ? 0.06 : -0.04)
  }
  parts.put('shadow', 0, 0.012, 0.02, 0, 0, 0, SHADOW)
}
/** The soft shadow under it: its footprint. */
const SHADOW = new Vector3(0.9, 1, 2.0)

/** Where a crate on the carrier's k-th place is, in the tractor's frame (for a crate hopping on). */
export const carrierSlot = (k: number): V3 => {
  const { carrier } = TRACTOR_SHAPE
  const [cx, cz] = carrier.slots[Math.min(k, carrier.slots.length - 1)]
  return [cx, carrier.y, cz]
}

/** The driver: a farmer in a straw hat (no basket: both hands on the wheel). */
export const DRIVER: PersonLook = { shirt: '#3f6fa3', trousers: '#3d4a5c', skin: '#e0ac87', hair: '#5a3a22', hairStyle: 0, hat: true, height: 1, basket: false, seated: true }

/** Sits a person on the tractor's seat (in the tractor's frame, its root at the tractor's origin): thighs along the
 *  seat, shins down to the footwell, hands on the wheel; `look` turns the head (backing up, they look behind). */
export function seatDriver(rig: PersonRig, look = 0) {
  const { seat } = TRACTOR_SHAPE
  rig.hips.position.set(0, seat.y + 0.075, seat.z + 0.02)
  rig.hips.rotation.set(0, 0, 0)
  rig.thighL.rotation.set(-1.45, 0, 0.06)
  rig.thighR.rotation.set(-1.45, 0, -0.06)
  rig.kneeL.rotation.set(1.3, 0, 0)
  rig.kneeR.rotation.set(1.3, 0, 0)
  rig.armL.rotation.set(-1.05, 0, 0.18)
  rig.armR.rotation.set(-1.05, 0, -0.18)
  rig.elbowL.rotation.set(-0.55, 0, 0)
  rig.elbowR.rotation.set(-0.55, 0, 0)
  rig.head.rotation.set(0, look, 0)
}
