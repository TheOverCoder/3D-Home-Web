import type { Box, Rect, WalkIn } from './buildings'
import { ESTATE_ROOM, ESTATE_WALKIN } from './estate'
import { PARK_AREA } from './lot'
import { DEALER_DOOR, DEALER_FORECOURT, DEALER_ROOM, DEALER_WALKIN, DISPLAY_BAYS } from './dealer'
import { BACK, CABIN, HALL, INNER_DOOR, MARKET_WALKIN } from './market'

// The lot beyond the lane as update-v1/missions/11-buildings.md planned it, now built: a bigger supermarket and estate
// office, a car dealer, the contractor's cabin moved against the hall's new east wall, the car park, and the lot's
// walkable ground. Each row is the built one's (src/data/market.ts, estate.ts, dealer.ts, lot.ts), named as planned:
// src/data/lotPlan.test.ts holds them to the rules the first rows kept, against
// the farm's sun box (src/data/sunBox.ts, FARM_SUN_BOX): every floor, and the inside of every wall the
// sun shines at, inside it; the car park wholly outside it (its cars cast nothing and keep their soft shadows).
//
// What stays where it is: the market's front door and the way in to it (MARKET_PATH), the estate office's door and its
// front on the lane's edge, the parking lot by the gate with your car in its east bay (CAR_SPOT, ARRIVE). Units are
// metres; z grows to the south, away from the lane.

const T = 0.15 // the walls' thickness, as today's
/** The lane's south edge (src/data/layout.ts, LANE: z 15 ± 1.3): the fronts stand on it. */
export const LANE_SOUTH = 16.3

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

/** Built: the showroom and its forecourt (src/data/dealer.ts). */
export const DEALER_ROOM_PLANNED: Rect = DEALER_ROOM
export const DEALER_DOOR_PLANNED: Rect = DEALER_DOOR
const DR = DEALER_ROOM_PLANNED
export const DEALER_PLANNED: WalkIn = DEALER_WALKIN
export const DEALER_FORECOURT_PLANNED: Rect = DEALER_FORECOURT
export const DISPLAY_BAYS_PLANNED: readonly Rect[] = DISPLAY_BAYS

// ───────────────────────────── the car park and the lot ─────────────────────────────

/** The car park, west of the estate office along the lane's south edge, wholly outside the farm's sun box. Its bays and
 *  stages: src/farm/park.ts. */
export { PARK_AREA }

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
