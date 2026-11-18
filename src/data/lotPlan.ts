import type { AutoDoor, Box, Rect, WalkIn } from './buildings'
import { ESTATE_DOOR, ESTATE_WALKIN, PARKING } from './estate'
import { FRONT_DOOR, MARKET_WALKIN } from './market'

// The lot beyond the lane as update-v1/missions/11-buildings.md plans it: a bigger supermarket and estate office, a car
// dealer, the contractor's cabin moved against the hall's new east wall, the car park, and the lot's walkable ground.
// Rows only: no game file imports this, and nothing here is drawn or walked on until the rows replace today's
// (src/data/market.ts, src/data/estate.ts). src/data/lotPlan.test.ts holds them to the rules today's rows keep, against
// the farm's planned sun box (src/data/sunBox.ts, FARM_SUN_BOX_PLANNED): every floor, and the inside of every wall the
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

/** One room, 4.4 times today's: from its front on the lane's edge as deep as the box allows at its west wall, its east
 *  wall against the market's west wall (x 5.9) as today. Its door is today's. */
export const ESTATE_ROOM_PLANNED: Rect = { x0: 0.2, x1: 5.75, z0: LANE_SOUTH + T, z1: 19.9 }
const ER = ESTATE_ROOM_PLANNED
const ESTATE_H = 2.9

export const ESTATE_PLANNED: WalkIn = {
  id: 'estate',
  walls: [
    ...wallX(ER.x0 - T, ER.x1 + T, ESTATE_DOOR.z0, ESTATE_DOOR.z1, ESTATE_H, ESTATE_DOOR, 2.1),
    box(ER.x0 - T, ER.x1 + T, ER.z1, ER.z1 + T, 0, ESTATE_H),
    box(ER.x0 - T, ER.x0, ER.z0, ER.z1, 0, ESTATE_H),
    box(ER.x1, ER.x1 + T, ER.z0, ER.z1, 0, ESTATE_H),
  ],
  roof: { y: 2.55, thick: 0.12 },
  rooms: [{ space: 'estate', ...ER, top: 2.43 }],
  doors: [ESTATE_DOOR],
  floor: 'boards',
  look: 'boards',
  lights: [{ x: (ER.x0 + ER.x1) / 2, y: 2.3, z: (ER.z0 + ER.z1) / 2, color: '#fff1dc', intensity: 4, distance: 6.5 }],
  autoDoor: ESTATE_WALKIN.autoDoor,
}

// ───────────────────────────── the supermarket ─────────────────────────────

/** The hall, 2.3 times today's, from today's front (its door where it is) south and east; it rises to 4 m. The
 *  manager's room behind it, twice today's. The doorway between them in the middle of the hall's south wall. */
export const HALL_PLANNED: Rect = { x0: 6.05, x1: 16.45, z0: FRONT_DOOR.z1, z1: 22.9 }
export const BACK_PLANNED: Rect = { x0: 8.5, x1: 14.0, z0: HALL_PLANNED.z1 + T, z1: 25.6 }
export const INNER_DOOR_PLANNED: Rect = { x0: 10.75, x1: 11.75, z0: HALL_PLANNED.z1, z1: BACK_PLANNED.z0 }
const HL = HALL_PLANNED
const BK = BACK_PLANNED
const MARKET_H = 4.0

export const MARKET_PLANNED: WalkIn = {
  id: 'market',
  walls: [
    // the hall: north (with today's front door), south (with the doorway to the back), west and east
    ...wallX(HL.x0 - T, HL.x1 + T, HL.z0 - T, HL.z0, MARKET_H, FRONT_DOOR),
    ...wallX(HL.x0 - T, HL.x1 + T, HL.z1, HL.z1 + T, MARKET_H, INNER_DOOR_PLANNED),
    box(HL.x0 - T, HL.x0, HL.z0, HL.z1, 0, MARKET_H),
    box(HL.x1, HL.x1 + T, HL.z0, HL.z1, 0, MARKET_H),
    // the manager's room: west, east and south (its north side is the hall's south wall)
    box(BK.x0 - T, BK.x0, BK.z0, BK.z1 + T, 0, MARKET_H),
    box(BK.x1, BK.x1 + T, BK.z0, BK.z1 + T, 0, MARKET_H),
    box(BK.x0, BK.x1, BK.z1, BK.z1 + T, 0, MARKET_H),
  ],
  roof: { y: 3.6, thick: 0.15 },
  rooms: [
    { space: 'market', ...HL, top: 3.48 },
    { space: 'market-office', ...BK, top: 3.48 },
  ],
  doors: [FRONT_DOOR, INNER_DOOR_PLANNED],
  floor: 'tile',
  lights: [
    { x: (HL.x0 + HL.x1) / 2, y: 3.3, z: (HL.z0 + HL.z1) / 2, color: '#fff1dc', intensity: 8, distance: 10 },
    { x: (BK.x0 + BK.x1) / 2, y: 3.3, z: (BK.z0 + BK.z1) / 2, color: '#fff1dc', intensity: 4, distance: 6 },
  ],
  autoDoor: MARKET_WALKIN.autoDoor,
}

/** The contractor's site cabin, as big as today's, against the hall's new east wall; its window still faces east. */
export const CABIN_PLANNED: Box = box(HL.x1 + T + 0.15, HL.x1 + T + 1.25, 17.35, 18.5, 0, 2.4)

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

/** The car park, west of the estate office along the lane's south edge, wholly outside the planned box. Its bays and
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
