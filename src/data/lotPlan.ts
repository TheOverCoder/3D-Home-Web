import type { AutoDoor, Box, Rect, WalkIn } from './buildings'
import { ESTATE_ROOM, ESTATE_WALKIN, PARKING } from './estate'
import { BACK, CABIN, HALL, INNER_DOOR, MARKET_WALKIN } from './market'

// The lot beyond the lane as update-v1/missions/11-buildings.md plans it: a bigger supermarket and estate office, a car
// dealer, the contractor's cabin moved against the hall's new east wall, the car park, and the lot's walkable ground.
// Rows only: no game file imports this, and nothing here is drawn or walked on until the rows replace today's
// (src/data/market.ts, src/data/estate.ts). src/data/lotPlan.test.ts holds them to the rules today's rows keep, against
// the farm's sun box (src/data/sunBox.ts, FARM_SUN_BOX): every floor, and the inside of every wall the
// sun shines at, inside it; the car park wholly outside it (its cars cast nothing and keep their soft shadows).
//
// What stays where it is: the market's front door and the way in to it (MARKET_PATH), the estate office's door and its
// front on the lane's edge, the parking lot by the gate with your car in its east bay (CAR_SPOT, ARRIVE). Units are
// metres; z grows to the south, away from the lane.

const T = 0.15 // the walls' thickness, as today's
/** The lane's south edge (src/data/layout.ts, LANE: z 15 ± 1.3): the fronts stand on it. */
export const LANE_SOUTH = 16.3

const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Box => ({ x0, x1, z0, z1, y0, y1 })

/** A wall along x (at z0..z1) from xa to xb, `high` tall, with an opening `o` up to `doorH` (and a lintel over it). */
function wallX(xa: number, xb: number, z0: number, z1: number, high: number, o?: Rect, doorH = 2.2): Box[] {
  if (!o) return [box(xa, xb, z0, z1, 0, high)]
  return [box(xa, o.x0, z0, z1, 0, high), box(o.x1, xb, z0, z1, 0, high), box(o.x0, o.x1, z0, z1, doorH, high)]
}

// ───────────────────────────── the estate office ─────────────────────────────

/** Built: the office's own row (src/data/estate.ts), one room 4.4 times the one before (4.33 m²), from its front on
 *  the lane's edge as deep as the box allows at its west wall, its east wall against the market's west wall (x 5.9). */
export const ESTATE_ROOM_PLANNED: Rect = ESTATE_ROOM
export const ESTATE_PLANNED: WalkIn = ESTATE_WALKIN

// ───────────────────────────── the supermarket ─────────────────────────────

/** Built: the hall, 2.3 times the first, from the first's front (its door where it was) south and east, rising to 4 m;
 *  the manager's room behind it, twice the first; the doorway between them in the middle of the hall's south wall; the
 *  cabin against the hall's new east wall (src/data/market.ts). */
export const HALL_PLANNED: Rect = HALL
export const BACK_PLANNED: Rect = BACK
export const INNER_DOOR_PLANNED: Rect = INNER_DOOR
const HL = HALL_PLANNED
export const MARKET_PLANNED: WalkIn = MARKET_WALKIN
export const CABIN_PLANNED: Box = CABIN

// ───────────────────────────── the car dealer ─────────────────────────────

/** Its showroom, east of the cabin (room to stand at the cabin's window between them), its front on the lane's edge
 *  and as deep as the box allows at its south-east corner; its door in the middle of its front. */
export const DEALER_ROOM_PLANNED: Rect = { x0: 19.4, x1: 24.0, z0: LANE_SOUTH + T, z1: 20.5 }
export const DEALER_DOOR_PLANNED: Rect = { x0: 20.6, x1: 21.8, z0: LANE_SOUTH, z1: LANE_SOUTH + T }
const DR = DEALER_ROOM_PLANNED
const DEALER_H = 3.2
const DEALER_DOOR_H = 2.2

/** Its two leaves, each sliding into the wall at its side (half the opening, from 1 cm past the middle to 1 cm inside
 *  the jamb, as the market's and the office's). */
const DEALER_AUTO_DOOR: AutoDoor = {
  ...DEALER_DOOR_PLANNED,
  height: DEALER_DOOR_H,
  thick: 0.04,
  travel: (DEALER_DOOR_PLANNED.x1 - DEALER_DOOR_PLANNED.x0) / 2 + 0.02,
  color: '#3a3f45',
}

export const DEALER_PLANNED: WalkIn = {
  id: 'dealer',
  walls: [
    ...wallX(DR.x0 - T, DR.x1 + T, DEALER_DOOR_PLANNED.z0, DEALER_DOOR_PLANNED.z1, DEALER_H, DEALER_DOOR_PLANNED, DEALER_DOOR_H),
    box(DR.x0 - T, DR.x1 + T, DR.z1, DR.z1 + T, 0, DEALER_H),
    box(DR.x0 - T, DR.x0, DR.z0, DR.z1, 0, DEALER_H),
    box(DR.x1, DR.x1 + T, DR.z0, DR.z1, 0, DEALER_H),
  ],
  roof: { y: 2.8, thick: 0.12 },
  rooms: [{ space: 'dealer', ...DR, top: 2.68 }],
  doors: [DEALER_DOOR_PLANNED],
  floor: 'tile',
  look: 'boards',
  lights: [{ x: (DR.x0 + DR.x1) / 2, y: 2.55, z: (DR.z0 + DR.z1) / 2, color: '#fff6e8', intensity: 4, distance: 6.5 }],
  autoDoor: DEALER_AUTO_DOOR,
}

/** The dealer's forecourt across the walkers' line from its door, between the fence's collider and that line as the
 *  parking lot by the gate is (src/data/estate.ts, PARKING), east of the buyers' line: two cars for sale in parallel
 *  bays. Inside the box: they cast, with your own car. */
export const DEALER_FORECOURT_PLANNED: Rect = { x0: 19.4, x1: 27.6, z0: PARKING.z0, z1: PARKING.z1 }
export const DISPLAY_BAYS_PLANNED: readonly Rect[] = [
  { x0: 19.5, x1: 23.5, z0: PARKING.z0 + 0.12, z1: PARKING.z1 - 0.08 },
  { x0: 23.5, x1: 27.5, z0: PARKING.z0 + 0.12, z1: PARKING.z1 - 0.08 },
]

// ───────────────────────────── the car park and the lot ─────────────────────────────

/** The car park, west of the estate office along the lane's south edge, wholly outside the farm's sun box. Its bays and
 *  stages: src/farm/park.ts. */
export const PARK_AREA: Rect = { x0: -26, x1: -7.2, z0: LANE_SOUTH, z1: 30.5 }

/** The ground you can walk on outside the garden, as planned: the lane from the car park's west end past the dealer's
 *  forecourt; the strip before the hall's front (set back from the lane's edge); the contractor's corner between the
 *  hall and the dealer; the car park. The first is the lane. */
export const LOT_PLANNED: readonly Rect[] = [
  { x0: PARK_AREA.x0, x1: 28.0, z0: 13, z1: LANE_SOUTH },
  { x0: HL.x0 - T, x1: DR.x0 - T, z0: LANE_SOUTH, z1: HL.z0 - T },
  { x0: HL.x1 + T, x1: DR.x0 - T, z0: HL.z0 - T, z1: 19.0 },
  PARK_AREA,
]

/** The planned walk-ins, west to east. */
export const WALK_INS_PLANNED: readonly WalkIn[] = [ESTATE_PLANNED, MARKET_PLANNED, DEALER_PLANNED]
