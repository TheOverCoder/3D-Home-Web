import { GARDEN } from '../data/layout'
import { BACK, BAYS, DESK, FRONT_DOOR, HALL, INNER_DOOR, MANAGER_SPOT, MANAGER_STAND, MARKET_PATH, SCREEN, SHELF_RUN, TILL } from '../data/market'
import { managerLeaves, shopperIn, type Step } from '../farm/script'
import { MARKET_SIGN } from '../models/market'
import type { Spot } from './format'

// The market as a film set, every mark and thing from the game's own row (src/data/market.ts) and its people's ways
// (src/farm/script.ts): where the manager stands, where you stand to talk to him, the doorway to his room, the way in
// from the lane, the way he leaves when the shop is sold. When the game moves a desk or a door, the film follows.
// Headings are the game's: 0 faces +z (south), π the north and the lane.

export interface Mark {
  x: number
  z: number
  heading?: number
  /** a thing put here stands this high (on a desk) */
  y?: number
}

const DOOR_X = (INNER_DOOR.x0 + INNER_DOOR.x1) / 2
const [LANE, DOORSTEP, INSIDE] = MARKET_PATH

/** Named places to stand. */
export const MARKS: Record<string, Mark> = {
  /** the manager behind his desk, facing the doorway */
  boss: MANAGER_SPOT,
  /** where you stand to talk to him */
  you: { ...MANAGER_STAND, heading: 0 },
  /** just inside his room, beside you (where someone coming in stops) */
  aside: { x: DOOR_X + 0.15, z: MANAGER_STAND.z + 0.12, heading: -2.5 },
  /** the room's east corner, out of the way of the desk */
  'office-corner': { x: BACK.x1 - 0.4, z: MANAGER_STAND.z + 0.35, heading: -Math.PI / 2 },
  /** a step either side of the doorway between the hall and his room */
  'office-door': { x: DOOR_X, z: INNER_DOOR.z1 + 0.3, heading: 0 },
  'hall-door': { x: DOOR_X, z: INNER_DOOR.z0 - 0.45, heading: 0 },
  /** the hall's middle, on the way from his room to the front door */
  hall: { x: 8.6, z: 18.8, heading: Math.PI },
  /** the way out: just inside the front door, the doorstep, the lane in front */
  inside: { ...INSIDE, heading: Math.PI },
  doorstep: { ...DOORSTEP, heading: Math.PI },
  lane: { ...LANE, heading: Math.PI },
  /** on the lane, a little out from the door: where the hero stops */
  front: { x: LANE.x + 0.15, z: LANE.z - 0.55, heading: Math.PI },
  /** beside the hero on the lane, a step behind */
  'front-left': { x: LANE.x + 0.95, z: LANE.z - 0.15, heading: Math.PI },
  'front-right': { x: LANE.x - 0.85, z: LANE.z - 0.2, heading: Math.PI },
  /** on the lane a little east of the door (someone walking in from there is in the picture at once) */
  'lane-near': { x: LANE.x + 3.6, z: LANE.z - 0.45, heading: -Math.PI / 2 },
  /** the lane to the east and the west, out of the picture */
  'lane-east': { x: LANE.x + 7, z: LANE.z - 0.6, heading: Math.PI / 2 },
  'lane-west': { x: LANE.x - 7, z: LANE.z - 0.6, heading: -Math.PI / 2 },
  /** on the desk in front of the manager, on his keyboard, clear of his mug (a thing put there stands on it) */
  desk: { x: MANAGER_SPOT.x - 0.15, z: (DESK.z0 + DESK.z1) / 2, heading: Math.PI, y: DESK.y1 + 0.02 },
}

// ───────────────────────────── the pen ─────────────────────────────

/** The pen the animal tools' films play in (plans/animal-tools.md §4): a fence of the farm's own fence sections
 *  (src/models/decor.ts, 2 m each) round a patch of the lawn on the market's side of the lane, between two of the woods'
 *  trees — the same for every player, never their own farm. Its north side faces the lane, with the gate in it; the
 *  tool stands at the gate's east post, outside, facing the lane (each tool's model places itself round that post), and
 *  the herd comes to the fence behind it from inside. The camera films it from the lane's side, looking south at the
 *  woods. `x0`… are its fence lines, `gate` the gap in the north side. */
export const PEN = { x0: -6.5, x1: 1.5, z0: 21, z1: 27, gate: { x0: -2.5, x1: -0.5 } } as const

const N = Math.PI
const E = Math.PI / 2
const W = -Math.PI / 2
/** The pen's middle (the sun is aimed there while a scene plays in it). */
export const PEN_MIDDLE = { x: (PEN.x0 + PEN.x1) / 2, z: (PEN.z0 + PEN.z1) / 2 }
/** A few more of the woods' trees behind the pen and at its sides (x, z, height, seed: src/scene/flora.ts, tree), so
 *  wherever the camera looks from the lane's side there are woods behind the herd, not an empty lawn. */
export const PEN_GROVE = [
  [-3.4, 31.2, 8.4, 71],
  [1.6, 32.6, 7.6, 72],
  [-9.2, 28.8, 9.0, 73],
  [5.4, 30.0, 8.2, 74],
  [-10.8, 25.4, 7.8, 75],
] as const
const POST = { x: PEN.gate.x1, z: PEN.z0 }

/** The pen's marks: the tool's post, the gate, where the crate is put down, where people stand outside, and the herd's
 *  places inside (by the tool, in a line, out in the grass, in the corners). */
const PEN_MARKS: Record<string, Mark> = {
  /** the gate's east post: the tool stands here, outside, facing the lane */
  post: { ...POST, heading: N },
  /** the gate's middle, and a step inside it */
  gate: { x: (PEN.gate.x0 + PEN.gate.x1) / 2, z: PEN.z0, heading: N },
  'in-gate': { x: (PEN.gate.x0 + PEN.gate.x1) / 2, z: PEN.z0 + 0.9, heading: N },
  /** where the crate is put down: in front of the tool's east end (it opens and shrinks away as the tool rises) */
  drop: { x: POST.x + 1.7, z: POST.z - 0.95, heading: N },
  /** outside, east of the post, looking along the fence at what waits in front of the gate */
  barber: { x: POST.x + 1.25, z: POST.z - 0.5, heading: W },
  /** outside, west of the gate, looking at the post; and beside the post, in front of the gate */
  outside: { x: PEN.gate.x0 - 0.7, z: PEN.z0 - 0.7, heading: E },
  'by-post': { x: POST.x - 0.8, z: POST.z - 0.75, heading: E },
  /** the way in along the fence from the east (out of the picture), and where one coming that way stops, the crate in
   *  his arms over its place */
  east: { x: PEN.x1 + 3.5, z: PEN.z0 - 1.0, heading: W },
  aside: { x: POST.x + 2.1, z: POST.z - 0.95, heading: W },
  /** inside, a little west of the gate: where a cow is milked (her pail by her hind legs, the milker at her side), or a
   *  sheep grazes */
  milk: { x: PEN.gate.x0 - 1.6, z: PEN.z0 + 2.6, heading: N },
  pail: { x: PEN.gate.x0 - 2.0, z: PEN.z0 + 3.05, heading: N },
  milker: { x: PEN.gate.x0 - 2.55, z: PEN.z0 + 3.0, heading: E },
  /** behind the sheep at the milking place, creeping up */
  'creep-from': { x: PEN.gate.x0 - 1.0, z: PEN.z0 + 4.6, heading: N },
  creep: { x: PEN.gate.x0 - 1.45, z: PEN.z0 + 3.75, heading: N },
}
// the hens (out of their run, as hens are by day): in each of the coop's six nests along the fence, looking out; just in
// front of each; and a huddle at the first, all pushing towards it
for (let k = 0; k < 6; k++) {
  const x = POST.x + 0.27 + k * 0.31
  PEN_MARKS[`nest-${k}`] = { x, z: POST.z - 0.24, heading: N }
  PEN_MARKS[`front-${k}`] = { x, z: POST.z - 0.6, heading: 0 }
}
;[
  [0, -0.66, 0],
  [-0.3, -0.74, 0.4],
  [0.29, -0.78, -0.45],
  [-0.12, -1.0, 0.15],
  [0.2, -1.06, -0.2],
  [-0.42, -1.1, 0.6],
  [0.04, -1.38, 0],
].forEach(([x, z, heading], k) => (PEN_MARKS[`huddle-${k}`] = { x: POST.x + 0.27 + x, z: POST.z + z, heading }))
/** where the rooster struts to: in front of the coop, towards the lane */
PEN_MARKS.strut = { x: POST.x + 0.3, z: POST.z - 2.2, heading: N }
// the cows: side by side at the fence by the post (noses to it), and out in the grass
;[0.55, 1.5, -0.55].forEach((x, k) => (PEN_MARKS[`stall-${k}`] = { x: POST.x + x, z: PEN.z0 + 1.25, heading: N }))
// the sheep: a line along the fence's outside, from the gate westwards, each facing the one in front
for (let k = 0; k < 4; k++) PEN_MARKS[`queue-${k}`] = { x: POST.x - 0.6 - k * 1.2, z: PEN.z0 - 0.6, heading: E }
// out in the grass, and the far corners (where a herd scatters to)
;[
  [-2.6, 1.3, 1.2],
  [0.7, 0.7, -2.2],
  [2.7, 1.6, 0.8],
  [-1.2, 2.0, -0.4],
  [-3.0, -1.4, 2.4],
  [3.1, -0.6, -1.9],
  [-0.4, -1.3, 2.9],
].forEach(([x, z, heading], k) => (PEN_MARKS[`field-${k}`] = { x: PEN_MIDDLE.x + x, z: PEN_MIDDLE.z + z, heading }))
;[
  [PEN.x0 + 0.8, PEN.z1 - 0.8, -0.8],
  [PEN.x1 - 0.8, PEN.z1 - 0.9, 0.9],
  [PEN.x0 + 0.7, PEN.z0 + 1.3, -2.4],
  [PEN.x1 - 1.0, PEN.z1 - 2.3, 1.6],
].forEach(([x, z, heading], k) => (PEN_MARKS[`corner-${k}`] = { x, z, heading }))
Object.assign(MARKS, PEN_MARKS)

const points = (steps: Step[]): Mark[] => steps.flatMap((s) => ('to' in s ? [s.to] : []))

/** Named ways, a mark after a mark: the game's own scripts. */
export const PATHS: Record<string, Mark[]> = {
  /** the manager's way out once the shop is sold, to the lane's end (src/farm/script.ts, managerLeaves) — cut where the
   *  lane leaves the picture */
  'boss-out': points(managerLeaves()).slice(0, -1),
  /** a shopper's way in, to each browse spot */
  ...Object.fromEntries([0, 1, 2, 3].map((k) => [`shopper-in-${k}`, points(shopperIn(k as 0 | 1 | 2 | 3))])),
}

/** A spot, or the first mark of a path. */
export function markOf(s: Spot): Mark {
  if (typeof s !== 'string') return s
  const m = MARKS[s] ?? PATHS[s]?.[0]
  if (!m) throw new Error(`the set has no mark "${s}"`)
  return m
}

/** Where a walk goes: a named path, or the spots given one after another. */
export function pathOf(to: Spot | Spot[]): Mark[] {
  if (typeof to === 'string' && PATHS[to]) return PATHS[to]
  return [to].flat().map(markOf)
}

/** A thing the camera can frame: its middle, its size, the way its face looks. */
export interface Thing {
  x: number
  y: number
  z: number
  /** how tall and wide it is (m), for framing */
  h: number
  w: number
  heading: number
}

/** The things of the set (the case and the box are props: the player finds where they are as it plays). */
export const THINGS_AT: Record<string, Thing> = {
  /** the shop front: the hall's north face, door, window and sign */
  shop: { x: (HALL.x0 + HALL.x1) / 2, y: 1.7, z: FRONT_DOOR.z0, h: 3.4, w: HALL.x1 - HALL.x0 + 0.3, heading: Math.PI },
  sign: { x: MARKET_SIGN.x, y: MARKET_SIGN.y, z: MARKET_SIGN.z, h: MARKET_SIGN.half[1] * 2, w: MARKET_SIGN.half[0] * 2, heading: Math.PI },
  door: { x: (FRONT_DOOR.x0 + FRONT_DOOR.x1) / 2, y: 1.1, z: FRONT_DOOR.z0, h: 2.2, w: FRONT_DOOR.x1 - FRONT_DOOR.x0, heading: Math.PI },
  screen: { x: SCREEN.x, y: SCREEN.y, z: SCREEN.z, h: 0.3, w: 0.5, heading: SCREEN.heading },
  desk: { x: (DESK.x0 + DESK.x1) / 2, y: DESK.y1, z: (DESK.z0 + DESK.z1) / 2, h: 0.5, w: DESK.x1 - DESK.x0, heading: Math.PI },
  till: { x: TILL.x, y: TILL.y + 0.12, z: TILL.z, h: 0.3, w: 0.4, heading: 0 },
  /** the shop's aisle, between the shelves along the south wall and the island, seen from its west end */
  aisle: { x: (HALL.x0 + HALL.x1) / 2, y: 1.0, z: (SHELF_RUN.z0 + 19.15) / 2, h: 2.2, w: 1.4, heading: -Math.PI / 2 },
  /** the shelves along the hall's south wall: the first three places, facing the door */
  shelves: { x: (BAYS[0].x + BAYS[2].x) / 2, y: 1.0, z: SHELF_RUN.z0, h: 1.8, w: BAYS[2].x - BAYS[0].x + 0.6, heading: Math.PI },
  /** the pen, its gate and the tool's post (seen from the lane), and the run of the coop's nests along the fence */
  pen: { x: PEN_MIDDLE.x, y: 0.6, z: PEN_MIDDLE.z, h: 1.4, w: PEN.x1 - PEN.x0, heading: Math.PI },
  gate: { x: (PEN.gate.x0 + PEN.gate.x1) / 2, y: 0.5, z: PEN.z0, h: 1.0, w: PEN.gate.x1 - PEN.gate.x0 + 0.4, heading: Math.PI },
  post: { x: POST.x, y: 0.6, z: POST.z - 0.2, h: 1.2, w: 0.7, heading: Math.PI },
  nests: { x: POST.x + 1.05, y: 0.55, z: POST.z - 0.3, h: 0.9, w: 2.1, heading: Math.PI },
}

/** The walls a camera may leave out, as a film set's wild walls: each a test on a wall box of the market's row. */
export const WILD: Record<string, (b: { x0: number; x1: number; z0: number; z1: number }) => boolean> = {
  /** the manager's room's east wall */
  'office-east': (b) => b.x0 >= BACK.x1 - 0.01 && b.z1 > BACK.z0,
  /** its south wall, behind the manager */
  'office-south': (b) => b.z0 >= BACK.z1 - 0.01,
  /** its west wall */
  'office-west': (b) => b.x1 <= BACK.x0 + 0.01 && b.z1 > BACK.z0,
  /** the hall's west wall (a camera at the far end of the aisle) */
  'hall-west': (b) => b.x1 <= HALL.x0 + 0.01 && b.z0 < HALL.z1,
}

/** Whether a camera outside the market's rooms looks across the lane, north, at the farm: the player's own farm, which
 *  changes with everything they build and plant. A film never does — it films the market's side of the lane, the same
 *  on every farm — so it shows no farm that is not theirs (the lab's set has none), and needs no keeping up when the
 *  farm grows. (Inside the rooms the walls behind the subject are always there.) */
export function looksAtFarm(eye: { x: number; z: number }, dir: { x: number; y: number; z: number }) {
  const flat = Math.hypot(dir.x, dir.z)
  // looking down at the ground at one's feet, or up at the sky, sees no farm
  if (dir.y < -0.75 || dir.y > 0.6 || flat < 1e-6) return false
  // more than about 30° north of the lane's line, from this side of the garden's fence
  if (dir.z / flat > -0.5 || eye.z < GARDEN.maxZ - 1) return false
  // unless the market is in the way: a camera in its rooms, or behind a wall left out for it, looks through the
  // rooms at the walls on the far side, which are always there
  const dx = dir.x / flat
  const dz = dir.z / flat
  const hits = (r: { x0: number; x1: number; z0: number; z1: number }) => {
    let t0 = 0
    let t1 = 60
    for (const [p, d, lo, hi] of [
      [eye.x, dx, r.x0, r.x1],
      [eye.z, dz, r.z0, r.z1],
    ]) {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) return false
        continue
      }
      const a = (lo - p) / d
      const b = (hi - p) / d
      t0 = Math.max(t0, Math.min(a, b))
      t1 = Math.min(t1, Math.max(a, b))
    }
    return t0 <= t1
  }
  return ![HALL, BACK].some(hits)
}
