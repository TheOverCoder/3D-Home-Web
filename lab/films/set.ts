import { BACK, BAYS, DESK, FRONT_DOOR, HALL, INNER_DOOR, MANAGER_SPOT, MANAGER_STAND, MARKET_PATH, SCREEN, SHELF_RUN, TILL } from '../../src/data/market'
import { managerLeaves, shopperIn, type Step } from '../../src/farm/script'
import { MARKET_SIGN } from '../../src/models/market'
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
