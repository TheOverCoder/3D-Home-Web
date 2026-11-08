import { Color, Vector3, type BufferGeometry } from 'three'
import { ellipsoid, loft, merge, Parts, rgb, shadowPart, smoothstep, tube, type PartDef, type Shape, type V3 } from '../lib/sculpt'

// Hens and a rooster, facing +z, standing on y = 0: a hen is about 0.4 m tall. Each is three parts — the body (with
// wings and tail), the head and neck, a leg (drawn twice) — built round their joints. A hen's feathers are painted
// white and take her own colour through the tint mask (white, red-brown, black, buff), so every hen shares one set
// of geometry; the rooster has his own colours painted in: a red-brown body, golden hackles, a dark green tail.

export const CHICKEN_PIVOTS = {
  /** the base of the neck: the head bobs and pecks about it */
  neck: [0, 0.29, 0.1] as V3,
  /** the hips */
  legs: [
    [0.045, 0.13, 0.0],
    [-0.045, 0.13, 0.0],
  ] as V3[],
  /** the body tips forward about this point to peck */
  tip: [0, 0.13, 0.0] as V3,
}

/** Hens' feather colours, one per hen in turn. */
export const HEN_COLORS = [0xf3efe6, 0xa8653a, 0x3a3433, 0xd9a441]

const RED = rgb(0xcf2f2a)
const BEAK = rgb(0xe8b23a)
const LEG = rgb(0xe0a030)
const EYE = rgb(0x1a1210)

interface Look {
  rooster: boolean
  /** feather colours (the hen's are white: her own colour comes from the tint) */
  body: V3
  neck: V3
  tail: V3
  tint: number
}

const HEN: Look = { rooster: false, body: [1, 1, 1], neck: [1, 1, 1], tail: [0.92, 0.92, 0.92], tint: 1 }
const ROOSTER: Look = { rooster: true, body: rgb(0x8a3b1f), neck: rgb(0xd9902a), tail: rgb(0x1f3a2c), tint: 0 }

/** A feather: a thin blade along +z (closed, so it shows from both sides with the usual material). */
function feather(length: number, width: number, bend = 0): Shape {
  return loft(
    [
      { c: [0, 0, 0], rx: width * 0.45, ry: 0.004 },
      { c: [0, bend * 0.3, length * 0.45], rx: width * 0.5, ry: 0.005 },
      { c: [0, bend, length * 0.92], rx: width * 0.28, ry: 0.004 },
      { c: [0, bend * 1.15, length], rx: 0.002, ry: 0.002 },
    ],
    { seg: 4, steps: 2 },
  )
}

function body(look: Look): Shape {
  const torso = loft(
    [
      { c: [0, 0.26, -0.13], rx: 0.07, ry: 0.07 },
      { c: [0, 0.22, -0.07], rx: 0.105, ry: 0.105 },
      { c: [0, 0.205, 0.0], rx: 0.12, ry: 0.115 },
      { c: [0, 0.215, 0.07], rx: 0.105, ry: 0.11 },
      { c: [0, 0.255, 0.115], rx: 0.07, ry: 0.085 },
    ],
    // a full breast and a soft, fluffy underside
    { seg: 12, steps: 2, round: [0.03, 0.04], shape: (a, t) => 1 + 0.08 * Math.max(0, -Math.sin(a)) * Math.sin(Math.PI * t) },
  ).fill(look.body, look.tint)
  torso.shade((_x, y) => 0.8 + 0.2 * smoothstep(0.1, 0.3, y))

  const parts: Shape[] = [torso]
  // folded wings on the sides, darker at the tips of the long feathers
  for (const sx of [-1, 1]) {
    const wing = loft(
      [
        { c: [0, 0.01, 0.08], rx: 0.012, ry: 0.035 },
        { c: [0, 0, 0.02], rx: 0.02, ry: 0.05 },
        { c: [0, -0.01, -0.06], rx: 0.016, ry: 0.04 },
        { c: [0, -0.005, -0.12], rx: 0.006, ry: 0.012 },
      ],
      { seg: 8, steps: 2 },
    )
      .fill(look.rooster ? rgb(0x6e2a16) : [0.9, 0.9, 0.9], look.tint)
      .pattern((_x, _y, z) => 0.5 + (-0.045 - z) * 30, look.rooster ? rgb(0x1f2a24) : [0.68, 0.68, 0.68])
    parts.push(wing.place([sx * 0.105, 0.225, -0.01], [0.1, sx * 0.08, 0]))
  }
  // the tail: a fan of feathers, up and back (the rooster's long and curving over)
  const fan = look.rooster ? 7 : 6
  for (let k = 0; k < fan; k++) {
    const u = k / (fan - 1) - 0.5
    const f = look.rooster ? feather(0.2 + 0.09 * (1 - Math.abs(u) * 2), 0.05, -0.17) : feather(0.12 + 0.02 * (1 - Math.abs(u) * 2), 0.045)
    const col = look.rooster ? look.tail : [0.95, 0.95, 0.95]
    f.fill(col as V3, look.tint).shade((_x, _y, z) => 1 - 0.3 * smoothstep(0.06, 0.16, z))
    parts.push(f.place([u * 0.05, 0.26, -0.12], [(look.rooster ? 0.75 : 1.0) + Math.abs(u) * 0.3, Math.PI + u * (look.rooster ? 0.6 : 0.9), u * 0.6]))
  }
  if (look.rooster) {
    // saddle feathers, golden, down over the sides of the tail
    for (const sx of [-1, 1]) parts.push(feather(0.1, 0.05, -0.02).fill(look.neck, 0).place([sx * 0.05, 0.27, -0.06], [-0.3, Math.PI + sx * 0.5, 0]))
  }
  // built round the hips, which it tips about to peck
  const [tx, ty, tz] = CHICKEN_PIVOTS.tip
  return merge(...parts).place([-tx, -ty, -tz])
}

function head(look: Look): Shape {
  const r = look.rooster
  // the neck rises out of a cape of hackle feathers over the shoulders, slimmer towards the head
  const neck = loft(
    [
      { c: [0, -0.07, -0.07], rx: r ? 0.095 : 0.085, ry: r ? 0.1 : 0.09 },
      { c: [0, -0.02, -0.03], rx: r ? 0.07 : 0.062, ry: r ? 0.075 : 0.066 },
      { c: [0, 0.05, 0.01], rx: 0.046, ry: 0.05 },
      { c: [0, 0.1, 0.035], rx: 0.038, ry: 0.04 },
      // on up into the head (the skull closes round it): no gap at the throat or the nape
      { c: [0, 0.128, 0.05], rx: 0.028, ry: 0.03 },
    ],
    // a little fuller at the back ("up" for these rings is forward)
    { seg: 10, steps: 2, up: [0, 0, 1], round: [0, 0.015], shape: (a) => 1 + 0.14 * Math.max(0, -Math.sin(a)) },
  ).fill(look.neck, look.tint)
  const skull = loft(
    [
      { c: [0, 0.125, 0.025], rx: 0.034, ry: 0.035 },
      { c: [0, 0.13, 0.06], rx: 0.036, ry: 0.036 },
      { c: [0, 0.126, 0.085], rx: 0.026, ry: 0.026 },
    ],
    { seg: 10, steps: 2, round: [0.02, 0.012] },
  ).fill(look.neck, look.tint)
  const parts: Shape[] = [neck, skull]
  // beak: short and curved
  parts.push(
    tube(
      [
        [0, 0.126, 0.088],
        [0, 0.122, 0.106],
        [0, 0.113, 0.122],
      ],
      [0.011, 0.007, 0.0015],
      { seg: 7, steps: 2 },
    ).fill(BEAK, 0),
  )
  // comb: a row of rounded points along the top of the head
  const points = r ? 6 : 5
  for (let k = 0; k < points; k++) {
    const u = k / (points - 1)
    const h = (r ? 0.032 : 0.016) * (0.6 + 0.4 * Math.sin(Math.PI * (0.25 + u * 0.6)))
    parts.push(ellipsoid(r ? 0.006 : 0.005, h, r ? 0.011 : 0.009, 6, 3).place([0, 0.158 + h * 0.6, 0.03 + u * 0.06], [-0.3 + u * 0.5, 0, 0]).fill(RED, 0))
  }
  for (const sx of [-1, 1]) {
    // wattles under the beak, and the eyes
    parts.push(ellipsoid(r ? 0.01 : 0.008, r ? 0.026 : 0.015, r ? 0.013 : 0.01, 6, 3).place([sx * 0.008, r ? 0.088 : 0.098, 0.093], [0.2, 0, 0]).fill(RED, 0))
    parts.push(ellipsoid(0.0075, 0.0075, 0.006, 6, 3).place([sx * 0.031, 0.137, 0.072], [0, sx * 0.4, 0]).fill(EYE, 0))
    // a little red round the eye, and the ear lobe
    parts.push(ellipsoid(0.012, 0.01, 0.006, 6, 3).place([sx * 0.03, 0.118, 0.058], [0, sx * 0.3, 0]).fill(r ? rgb(0xe8e0d0) : RED, 0))
  }
  return merge(...parts)
}

/** A leg from the hip (at the origin) to the toes on the ground at y = −0.13. */
function leg(look: Look): Shape {
  // the feathered thigh, then the bare shank and the toes
  const thigh = ellipsoid(0.034, 0.04, 0.04, 8, 4).place([0, -0.005, 0]).fill(look.body, look.tint)
  const shank = tube(
    [
      [0, -0.03, 0],
      [0, -0.08, 0.004],
      [0, -0.124, 0.006],
    ],
    [0.011, 0.009, 0.0085],
    { seg: 6, steps: 1 },
  ).fill(LEG, 0)
  const toes: Shape[] = []
  for (const a of [-0.45, 0, 0.45]) toes.push(tube([[0, -0.124, 0.006], [Math.sin(a) * 0.03, -0.128, 0.006 + Math.cos(a) * 0.03], [Math.sin(a) * 0.05, -0.129, 0.006 + Math.cos(a) * 0.05]], [0.006, 0.005, 0.003], { seg: 5, steps: 1 }).fill(LEG, 0))
  toes.push(tube([[0, -0.124, 0.006], [0, -0.128, -0.025]], [0.005, 0.003], { seg: 5, steps: 1 }).fill(LEG, 0))
  return merge(thigh, shank, ...toes)
}

export interface ChickenGeometries {
  body: BufferGeometry
  head: BufferGeometry
  leg: BufferGeometry
}

const made: Partial<Record<'hen' | 'rooster', ChickenGeometries>> = {}

export function chickenGeometries(rooster: boolean): ChickenGeometries {
  const key = rooster ? 'rooster' : 'hen'
  const look = rooster ? ROOSTER : HEN
  return (made[key] ??= { body: body(look).geometry(), head: head(look).geometry(), leg: leg(look).geometry() })
}

// ───────────────────────────── drawing and posing ─────────────────────────────

/** Instanced draws for up to `hens` hens and one rooster. */
export function chickenParts(hens: number): Parts {
  const h = chickenGeometries(false)
  const r = chickenGeometries(true)
  const feathers = { roughness: 0.85, detail: { scale: 90, bump: 0.003, shade: 0.12 } }
  const defs: Record<string, PartDef> = {
    henBody: { geometry: h.body, max: hens, material: feathers },
    henHead: { geometry: h.head, max: hens, material: { roughness: 0.75, detail: { scale: 110, bump: 0.002, shade: 0.08 } } },
    henLeg: { geometry: h.leg, max: hens * 2, material: { roughness: 0.6 } },
    roosterBody: { geometry: r.body, max: 1, material: { ...feathers, roughness: 0.6 } },
    roosterHead: { geometry: r.head, max: 1, material: { roughness: 0.75, detail: { scale: 110, bump: 0.002, shade: 0.08 } } },
    roosterLeg: { geometry: r.leg, max: 2, material: { roughness: 0.6 } },
    shadow: shadowPart(hens + 1, 0.22),
  }
  return new Parts(defs, 'chickens')
}

export interface ChickenPose {
  /** walk cycle, radians */
  phase: number
  /** 0 standing … 1 walking */
  stride: number
  /** 0 head up … 1 beak on the ground */
  peck: number
  /** head turned to the side, radians */
  look?: number
}

const color = new Color()
const shadowSize = new Vector3(0.13, 1, 0.17)
const ROOSTER_SIZE = 1.28

/** Puts a hen (or, with `rooster`, the rooster) at x, z facing `heading`; `variant` picks a hen's colour. */
export function putChicken(parts: Parts, rooster: boolean, variant: number, x: number, z: number, heading: number, p: ChickenPose) {
  const pre = rooster ? 'rooster' : 'hen'
  const tinted = rooster ? undefined : color.setHex(HEN_COLORS[variant % HEN_COLORS.length])
  const s = p.stride
  const bob = Math.abs(Math.sin(p.phase)) * 0.012 * s
  parts.at(x, 0, z, heading, rooster ? ROOSTER_SIZE : 1)
  // pecking: the body tips forward about the hips, the neck reaches down to the ground
  const tip = 0.62 * p.peck - (rooster ? 0.12 : 0)
  const [tx, ty, tz] = CHICKEN_PIVOTS.tip
  parts.put(`${pre}Body`, tx, ty + bob, tz, tip, 0, Math.sin(p.phase) * 0.06 * s, 1, tinted)
  // the head: bobs forward and back with each step; pecks down
  const [nx, ny, nz] = CHICKEN_PIVOTS.neck
  // the neck's base, carried round the hips as the body tips
  const dy = ny - ty
  const dz = nz - tz
  const by = ty + dy * Math.cos(tip) - dz * Math.sin(tip)
  const bz = tz + dy * Math.sin(tip) + dz * Math.cos(tip)
  const thrust = Math.max(0, Math.sin(p.phase * 2)) * 0.02 * s
  parts.put(`${pre}Head`, nx, by + bob, bz + thrust, tip + 0.85 * p.peck, (p.look ?? 0) * (1 - p.peck), 0, 1, tinted)
  CHICKEN_PIVOTS.legs.forEach(([lx, ly, lz], j) => {
    const swing = Math.sin(p.phase + (j ? Math.PI : 0)) * 0.5 * s
    parts.put(`${pre}Leg`, lx, ly + bob, lz, swing, 0, 0, 1, tinted)
  })
  parts.put('shadow', 0, 0.01, 0.0, 0, 0, 0, shadowSize)
}
