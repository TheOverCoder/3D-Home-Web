import { Color, Euler, Vector3, type BufferGeometry } from 'three'
import { blob, ellipsoid, loft, merge, noise3, Parts, rgb, shadowPart, smoothstep, squircle, tube, type PartDef, type Shape, type V3 } from '../lib/sculpt'

// A sheep, about 1.2 m long and 0.9 m to the top of her head, facing +z, standing on y = 0. Her fleece grows and
// comes off: under it is a slim, shorn body, and the fleece is a part of its own, drawn bigger the more wool she
// has (at no wool it shrinks inside the shorn body). Her face and legs take her own colour (a black face, a white
// one…) through the tint mask; the wool takes the colour of its length.
//
// Parts: body (the shorn body), fleece, head (neck, face, ears), headwool (the wool on her neck and the top-knot,
// which grows with the fleece), front and hind legs, and a shadow.

export const SHEEP_PIVOTS = {
  /** where the neck leaves the chest: the head lowers to graze about this point */
  neck: [0, 0.6, 0.22] as V3,
  legs: [
    [0.1, 0.5, 0.2],
    [-0.1, 0.5, 0.2],
    [0.1, 0.5, -0.27],
    [-0.1, 0.5, -0.27],
  ] as V3[],
  /** the fleece grows out from here */
  fleece: [0, 0.64, -0.08] as V3,
}

/** Wool colours: just shorn, and at full length. */
export const WOOL = { shorn: new Color('#e3d5c2'), full: new Color('#f4efe3') }
/** Face and leg colours, one per sheep in turn. */
export const FACES = [0x2b2624, 0xefe6d6, 0x3a302b, 0xe9dccb]

const SKIN_SHORN = rgb(0xe2d3bf)
const EYE = rgb(0x17120f)
const HOOF = rgb(0x2b2420)

/** Wool: a lumpy surface (lumps of locks, deeper creases between them, a little darker in the creases). */
function wool(shape: Shape, depth: number, seed: number) {
  const lump = (x: number, y: number, z: number) => noise3(x * 7 + 3, y * 7, z * 7, seed) * 0.65 + noise3(x * 16, y * 16 + 5, z * 16, seed + 9) * 0.35
  shape.displace((x, y, z) => (lump(x, y, z) - 0.45) * depth)
  shape.shade((x, y, z) => 0.8 + 0.28 * smoothstep(0.25, 0.75, lump(x, y, z)))
  return shape
}

function body(): Shape {
  const core = loft(
    [
      { c: [0, 0.63, -0.4], rx: 0.17, ry: 0.19 },
      { c: [0, 0.6, -0.22], rx: 0.2, ry: 0.22 },
      { c: [0, 0.58, 0.0], rx: 0.21, ry: 0.24 },
      { c: [0, 0.6, 0.18], rx: 0.18, ry: 0.23 },
    ],
    // a lean, shorn body: hip bones, a tucked belly behind a deep chest
    {
      seg: 14,
      steps: 2,
      round: [0.09, 0.06],
      shape: (a, t) => squircle(a, 2.3) * (1 + 0.06 * Math.exp(-(((t - 0.15) / 0.12) ** 2)) * Math.max(0, Math.sin(a)) - 0.08 * Math.max(0, -Math.sin(a)) * (1 - t)),
    },
  ).fill(SKIN_SHORN, 0)
  // a short tail
  const tail = tube(
    [
      [0, 0.66, -0.45],
      [0, 0.63, -0.51],
      [0, 0.56, -0.53],
    ],
    [0.035, 0.03, 0.026],
    { seg: 6, steps: 2, caps: [false, true] },
  ).fill(SKIN_SHORN, 0)
  return merge(core, tail).shade((_x, y) => 0.78 + 0.22 * smoothstep(0.42, 0.75, y))
}

/** The fleece at full length, built round SHEEP_PIVOTS.fleece (it is scaled about that point as it grows). */
function fleece(): Shape {
  const [fx, fy, fz] = SHEEP_PIVOTS.fleece
  const f = loft(
    [
      { c: [0, 0.67, -0.4], rx: 0.27, ry: 0.27 },
      { c: [0, 0.65, -0.18], rx: 0.33, ry: 0.31 },
      { c: [0, 0.65, 0.06], rx: 0.33, ry: 0.31 },
      { c: [0, 0.68, 0.24], rx: 0.26, ry: 0.28 },
    ],
    {
      seg: 22,
      steps: 4,
      round: [0.13, 0.08],
      // a boxy fleece, flatter underneath
      shape: (a) => squircle(a, 2.5) * (1 - 0.1 * Math.max(0, -Math.sin(a))),
    },
  )
  wool(f, 0.06, 4)
  // the tail's wool
  const t = wool(blob(0.075, 2).place([0, 0.6, -0.56], [0, 0, 0], [1, 1.2, 0.9]), 0.025, 6)
  return merge(f, t)
    .shade((_x, y) => 0.82 + 0.18 * smoothstep(0.38, 0.8, y))
    .place([-fx, -fy, -fz])
}

/** The head and neck, round the neck joint: the face and legs are painted white and take her colour by tint. */
function head(): Shape {
  // the neck (shorn), up and forward to the back of the head
  const neck = tube(
    [
      [0, -0.04, -0.08],
      [0, 0.06, 0.06],
      [0, 0.17, 0.18],
      [0, 0.21, 0.23],
    ],
    [0.105, 0.088, 0.072, 0.064],
    // its foot closed with a dome in the chest (it shows as she grazes)
    { seg: 10, steps: 2, round: [0.06, 0] },
  ).fill(SKIN_SHORN, 0)
  // the skull, nose down at the end of the neck: a long face with a gently arched nose
  const skull = loft(
    [
      { c: [0, 0.0, -0.04], rx: 0.065, ry: 0.075 },
      { c: [0, 0.02, 0.03], rx: 0.08, ry: 0.085 },
      { c: [0, 0.0, 0.11], rx: 0.064, ry: 0.072 },
      { c: [0, -0.025, 0.17], rx: 0.05, ry: 0.058 },
      { c: [0, -0.038, 0.21], rx: 0.045, ry: 0.049 },
    ],
    { seg: 12, steps: 2, round: [0.02, 0.028] },
  ).fill([0.92, 0.92, 0.92], 1)
  // the muzzle a shade darker, the nostrils and mouth darker still
  skull.shade((_x, _y, z) => 1 - 0.18 * smoothstep(0.17, 0.25, z))
  const parts: Shape[] = [skull]
  for (const sx of [-1, 1]) {
    parts.push(
      ellipsoid(0.016, 0.014, 0.016, 8, 5)
        .place([sx * 0.066, 0.03, 0.055])
        .fill(EYE, 0),
    )
    // ears: flat and long, out to the side and drooping a little, pale pink inside
    const ear = loft(
      [
        { c: [0, 0, 0], rx: 0.022, ry: 0.012 },
        { c: [0, 0, 0.06], rx: 0.036, ry: 0.01 },
        { c: [0, -0.004, 0.115], rx: 0.024, ry: 0.008 },
        { c: [0, -0.008, 0.14], rx: 0, ry: 0 },
      ],
      { seg: 8, steps: 2 },
    )
    ear.paint(
      (_x, y) => (y > 0.002 ? [0.95, 0.74, 0.7] : [0.92, 0.92, 0.92]),
      (_x, y) => (y > 0.002 ? 0.3 : 1),
    )
    parts.push(
      ear
        .place([0, 0, 0], [0, sx * (Math.PI / 2 + 0.3), 0])
        .place([0, 0, 0], [0, 0, -sx * 0.45])
        .place([sx * 0.06, 0.045, 0.0]),
    )
    parts.push(
      ellipsoid(0.012, 0.007, 0.006, 6, 4)
        .place([sx * 0.019, -0.028, 0.232], [0, sx * 0.5, 0])
        .fill(rgb(0x2a201c), 0),
    )
  }
  return merge(neck, merge(...parts).place(HEAD_AT, [HEAD_PITCH, 0, 0]))
}

/** Where the skull sits on the neck (round the neck joint), and how far it hangs nose down. */
const HEAD_AT: V3 = [0, 0.22, 0.24]
const HEAD_PITCH = 0.55

/** The wool on her neck and the top-knot. It turns with the head, and grows about a point in the middle of the
 *  neck (HEADWOOL_AT, round the neck joint), so at no wool it shrinks inside the shorn neck. */
function headwool(): Shape {
  const neck = loft(
    [
      { c: [0, -0.06, -0.12], rx: 0.16, ry: 0.17 },
      { c: [0, 0.04, 0.03], rx: 0.15, ry: 0.15 },
      { c: [0, 0.15, 0.16], rx: 0.12, ry: 0.12 },
      { c: [0, 0.2, 0.2], rx: 0.1, ry: 0.1 },
    ],
    { seg: 14, steps: 2, round: [0.06, 0.06] },
  )
  wool(neck, 0.045, 8)
  // the top-knot sits on the poll, between the ears
  const knot = wool(blob(0.065, 2).place([0, 0.07, -0.005], [0, 0, 0], [1.1, 0.8, 1.1]), 0.03, 12).place(HEAD_AT, [HEAD_PITCH, 0, 0])
  const [cx, cy, cz] = HEADWOOL_AT
  return merge(neck, knot).place([-cx, -cy, -cz])
}

export const HEADWOOL_AT: V3 = [0, 0.07, 0.04]

/** A leg from its joint at the origin to the ground at y = −0.5; the hind leg bends back at the hock. */
function leg(hind: boolean): Shape {
  const rings = hind
    ? [
        { c: [0, 0.05, 0.01], rx: 0.055, ry: 0.08 },
        { c: [0, -0.14, -0.03], rx: 0.045, ry: 0.065 },
        { c: [0, -0.25, -0.065], rx: 0.03, ry: 0.04 },
        { c: [0, -0.31, -0.055], rx: 0.024, ry: 0.028 },
        { c: [0, -0.43, -0.01], rx: 0.024, ry: 0.026 },
        { c: [0, -0.465, 0.005], rx: 0.03, ry: 0.034 },
        { c: [0, -0.5, 0.015], rx: 0.033, ry: 0.04 },
      ]
    : [
        { c: [0, 0.05, 0], rx: 0.05, ry: 0.06 },
        { c: [0, -0.16, 0.005], rx: 0.038, ry: 0.044 },
        { c: [0, -0.27, 0], rx: 0.032, ry: 0.034 },
        { c: [0, -0.4, 0.004], rx: 0.023, ry: 0.025 },
        { c: [0, -0.445, 0.01], rx: 0.026, ry: 0.028 },
        { c: [0, -0.468, 0.018], rx: 0.03, ry: 0.034 },
        { c: [0, -0.5, 0.028], rx: 0.033, ry: 0.04 },
      ]
  // the top closed with a dome in the body (it shows on a shorn sheep), the sole flat
  return loft(rings as { c: V3; rx: number; ry: number }[], { seg: 7, steps: 1, up: [0, 0, 1], caps: [false, true], round: [0.035, 0] })
    .fill([0.92, 0.92, 0.92], 1)
    .paint((_x, y) => (y < -0.462 ? HOOF : null), 0)
}

export interface SheepGeometries {
  body: BufferGeometry
  fleece: BufferGeometry
  head: BufferGeometry
  headwool: BufferGeometry
  front: BufferGeometry
  hind: BufferGeometry
}

let made: SheepGeometries | null = null

export function sheepGeometries(): SheepGeometries {
  made ??= { body: body().geometry(), fleece: fleece().geometry(), head: head().geometry(), headwool: headwool().geometry(), front: leg(false).geometry(), hind: leg(true).geometry() }
  return made
}

// ───────────────────────────── drawing and posing ─────────────────────────────

/** Wool: matte, with curls finer than any vertex (see the kit's material `detail`). */
const WOOL_MATERIAL = { roughness: 0.97, detail: { scale: 38, bump: 0.012, shade: 0.34 } }
/** The shorn body: a fine stubble of wool. */
const STUBBLE_MATERIAL = { roughness: 0.95, detail: { scale: 70, bump: 0.004, shade: 0.16 } }

/** Instanced draws for a flock of up to `max` sheep. */
export function sheepParts(max: number): Parts {
  const g = sheepGeometries()
  const defs: Record<string, PartDef> = {
    body: { geometry: g.body, max, material: STUBBLE_MATERIAL },
    fleece: { geometry: g.fleece, max, material: WOOL_MATERIAL },
    head: { geometry: g.head, max, material: { roughness: 0.85 } },
    headwool: { geometry: g.headwool, max, material: WOOL_MATERIAL },
    front: { geometry: g.front, max: max * 2 },
    hind: { geometry: g.hind, max: max * 2 },
    shadow: shadowPart(max),
  }
  return new Parts(defs, 'sheep')
}

export interface SheepPose {
  phase: number
  stride: number
  graze: number
  /** 0 just shorn … 1 a full fleece */
  wool: number
  /** chewing, radians of its own cycle */
  chew?: number
  look?: number
}

const face = new Color()
const woolColor = new Color()
const fleeceScale = new Vector3()
const shadowSize = new Vector3()
const at = new Vector3()
const turn = new Euler()

/** Puts one sheep at x, z facing `heading`; `variant` picks her face colour. */
export function putSheep(parts: Parts, variant: number, x: number, z: number, heading: number, p: SheepPose) {
  const s = p.stride
  const w = p.wool
  const bob = Math.abs(Math.sin(p.phase)) * 0.018 * s
  face.setHex(FACES[variant % FACES.length])
  woolColor.copy(WOOL.shorn).lerp(WOOL.full, w)
  parts.at(x, 0, z, heading)
  parts.put('body', 0, bob, 0, 0, 0, Math.sin(p.phase) * 0.02 * s)
  // the fleece: inside the shorn body when there is no wool, full and round at full length
  const [fx, fy, fz] = SHEEP_PIVOTS.fleece
  const k = 0.4 + 0.6 * w
  parts.put('fleece', fx, fy + bob, fz, 0, 0, Math.sin(p.phase) * 0.02 * s, fleeceScale.set(k, k, 0.65 + 0.35 * w), woolColor)
  const g = p.graze
  const nod = Math.sin(p.phase * 2) * 0.03 * s + (p.chew !== undefined ? Math.sin(p.chew) * 0.025 * g : 0)
  const [nx, ny, nz] = SHEEP_PIVOTS.neck
  const pitch = 1.25 * g + nod
  const yaw = (p.look ?? 0) * (1 - 0.6 * g)
  parts.put('head', nx, ny + bob - 0.12 * g, nz + 0.05 * g, pitch, yaw, 0, 1, face)
  const hw = 0.55 + 0.45 * w
  at.set(...HEADWOOL_AT).applyEuler(turn.set(pitch, yaw, 0, 'YXZ'))
  parts.put('headwool', nx + at.x, ny + bob - 0.12 * g + at.y, nz + 0.05 * g + at.z, pitch, yaw, 0, hw, woolColor)
  SHEEP_PIVOTS.legs.forEach(([lx, ly, lz], j) => {
    const offset = j === 0 || j === 3 ? 0 : Math.PI
    const swing = Math.sin(p.phase + offset + (j >= 2 ? 0.5 : 0)) * 0.4 * s
    parts.put(j < 2 ? 'front' : 'hind', lx, ly + bob, lz, swing, 0, 0, 1, face)
  })
  parts.put('shadow', 0, 0.012, -0.06, 0, 0, 0, shadowSize.set(0.36 + 0.08 * w, 1, 0.62))
}
