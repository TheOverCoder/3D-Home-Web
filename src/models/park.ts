import { merge, rgb, tube, type Shape, type V3 } from '../lib/sculpt'
import { PARK_AREA } from '../data/lot'
import { FRONT_DOOR } from '../data/market'
import { baysAt, PARK_STAGES, type ParkPiece } from '../farm/park'
import { box, cuboid } from './boxes'
import { mix, type Structure } from './structures'

// The car park beyond the lane (src/farm/park.ts: its stages; src/data/lot.ts: its area), in world metres: put it at the
// origin. What a stage has built is one shape on the ground (the asphalt, each bay's lines, the kerbs; the crossing over
// the lane to the market's door) and one of things standing (the P sign, the trolley shelter): two draws, none casting
// (the car park lies outside the sun's box). Its lamps and planters are the decoration's own models (src/farm/Park.tsx).

const ASPHALT = rgb(0x45484c)
const LINE = rgb(0xeeeeea)
const CONCRETE = rgb(0xb9b5ab)
const STEEL = rgb(0x9aa3ab)
const SIGN_BLUE = rgb(0x2f5fa8)
const ROOF = rgb(0x5f7f6a)

const A = PARK_AREA
/** The kerb's width and height. */
export const PARK_KERB = { w: 0.3, h: 0.12 } as const
/** The walkway left at the car park's east end, from the lane to the aisle (no kerb across it). */
const WALKWAY = 1.6

/** What the car park has at `stage`: each piece any stage up to it adds. */
export const piecesAt = (stage: number): Set<ParkPiece> => new Set(PARK_STAGES.slice(0, Math.max(0, stage) + 1).flatMap((s) => s.adds))

/** Where the P sign stands (by the walkway at the lane), and where the lamps, the planters and the trolley shelter stand. */
export const PARK_SIGN = { x: A.x1 - WALKWAY - 0.35, z: A.z0 + 0.15 } as const
export const PARK_LAMPS = [
  { x: (A.x0 + A.x1) / 2 - 4.5, z: (A.z0 + A.z1) / 2 + 0.4 },
  { x: (A.x0 + A.x1) / 2 + 4.5, z: (A.z0 + A.z1) / 2 + 0.4 },
] as const
export const PARK_PLANTERS = [
  { x: A.x0 + 0.9, z: (A.z0 + A.z1) / 2 + 0.4 },
  { x: A.x1 - 0.9, z: (A.z0 + A.z1) / 2 + 0.4 },
  { x: (A.x0 + A.x1) / 2, z: (A.z0 + A.z1) / 2 - 0.9 },
  { x: (A.x0 + A.x1) / 2, z: (A.z0 + A.z1) / 2 + 1.7 },
] as const
export const PARK_SHELTER = { x0: A.x1 - WALKWAY + 0.1, x1: A.x1 - 0.1, z0: (A.z0 + A.z1) / 2 - 1.0, z1: (A.z0 + A.z1) / 2 + 1.8, h: 2.1 } as const

const kerbPaint = (n: V3) => ({ color: n[1] > 0 ? CONCRETE : mix(CONCRETE, [0, 0, 0], 0.12) })

/** The ground at `stage`: the asphalt over the whole car park (from the first row), each bay's lines, the kerbs along
 *  the lane (open at the walkway) and the west end; and the crossing over the lane to the market's door (stage 3). */
export function parkGround(stage: number): Shape | null {
  const has = piecesAt(stage)
  if (!has.has('asphalt')) return null
  const parts: Shape[] = [cuboid(box(A.x0, A.x1, 0, 0.015, A.z0, A.z1), { color: ASPHALT })]
  // each bay's lines: one along its back, one down each side
  const lw = 0.1
  const [y0, y1] = [0.01, 0.019]
  for (const b of baysAt(stage).slice(PARK_STAGES[0].bays.length)) {
    const back = b.z0 < (A.z0 + A.z1) / 2 ? b.z0 : b.z1 - lw
    parts.push(cuboid(box(b.x0, b.x1, y0, y1, back, back + lw), { color: LINE }))
    for (const x of [b.x0, b.x1 - lw]) parts.push(cuboid(box(x, x + lw, y0, y1, b.z0, b.z1), { color: LINE }))
  }
  if (has.has('kerbs')) {
    parts.push(cuboid(box(A.x0, A.x1 - WALKWAY, 0, PARK_KERB.h, A.z0, A.z0 + PARK_KERB.w), kerbPaint))
    parts.push(cuboid(box(A.x0, A.x0 + PARK_KERB.w, 0, PARK_KERB.h, A.z0 + PARK_KERB.w, A.z1), kerbPaint))
  }
  if (has.has('crossing')) {
    // white stripes across the lane in front of the market's door, the lane's width, 0.5 m apart
    const cx = (FRONT_DOOR.x0 + FRONT_DOOR.x1) / 2
    for (let z = 13.3; z < A.z0 - 0.3; z += 0.5) parts.push(cuboid(box(cx - 1.1, cx + 1.1, 0, 0.012, z, z + 0.3), { color: LINE }))
  }
  return merge(...parts)
}

/** What stands at `stage`: the P sign by the walkway (a post, a blue plate with a white P), and the trolley shelter
 *  (stage 3: four posts, a green roof, a back panel). */
export function parkThings(stage: number): Shape | null {
  const has = piecesAt(stage)
  const parts: Shape[] = []
  if (has.has('sign')) {
    const s = PARK_SIGN
    const top = 2.3
    parts.push(
      tube(
        [
          [s.x, 0, s.z],
          [s.x, top, s.z],
        ] as V3[],
        0.03,
        { seg: 8, steps: 1, caps: [true, true] },
      ).fill(STEEL, 0),
    )
    // the plate faces the lane (north, −z); a white P on it: its stem and its bowl
    const z0 = s.z - 0.06
    parts.push(cuboid(box(s.x - 0.25, s.x + 0.25, top - 0.55, top - 0.05, z0, z0 + 0.03), (n) => ({ color: n[2] < 0 ? SIGN_BLUE : STEEL })))
    const pz = z0 - 0.004
    parts.push(cuboid(box(s.x - 0.12, s.x - 0.06, top - 0.47, top - 0.13, pz, z0), { color: LINE }))
    parts.push(cuboid(box(s.x - 0.06, s.x + 0.1, top - 0.19, top - 0.13, pz, z0), { color: LINE }))
    parts.push(cuboid(box(s.x - 0.06, s.x + 0.1, top - 0.32, top - 0.26, pz, z0), { color: LINE }))
    parts.push(cuboid(box(s.x + 0.1, s.x + 0.15, top - 0.32, top - 0.13, pz, z0), { color: LINE }))
  }
  if (has.has('shelter')) {
    const sh = PARK_SHELTER
    for (const x of [sh.x0 + 0.05, sh.x1 - 0.05]) for (const z of [sh.z0 + 0.05, sh.z1 - 0.05]) parts.push(cuboid(box(x - 0.04, x + 0.04, 0, sh.h, z - 0.04, z + 0.04), { color: STEEL }))
    parts.push(cuboid(box(sh.x0 - 0.1, sh.x1 + 0.1, sh.h, sh.h + 0.06, sh.z0 - 0.1, sh.z1 + 0.1), { color: ROOF }))
    parts.push(cuboid(box(sh.x1 - 0.06, sh.x1 - 0.02, 0.3, sh.h, sh.z0 + 0.05, sh.z1 - 0.05), { color: mix(ROOF, [1, 1, 1], 0.4) }))
  }
  return parts.length ? merge(...parts) : null
}

/** The car park at `stage` as a structure: the ground and the things standing (none of it casting). */
export function parkModel(stage: number): Structure<'ground' | 'things'> {
  const ground = parkGround(stage)
  const things = parkThings(stage)
  const out = {} as Structure<'ground' | 'things'>
  if (ground) out.ground = { shape: ground, material: { roughness: 0.95, detail: { scale: 60, bump: 0.0012, shade: 0.06 } }, castShadow: false }
  if (things) out.things = { shape: things, material: { roughness: 0.6 }, castShadow: false }
  return out
}
