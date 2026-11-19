import type { AutoDoor, Box, Rect, WalkIn } from './buildings'
import { PARKING } from './estate'
import { LANE_SOUTH } from './lot'

// The car dealer east of the contractor's cabin (update-v1/missions/11-buildings.md c9; held to the farm's sun box by
// src/data/lotPlan.test.ts): one showroom, its front on the lane's edge, its door in the middle of the front, sliding
// open for whoever comes near in its hours (HOURS.dealer). In it the seller behind a desk by the door, a wall of the
// paints for your car along the back, and a car on a turntable; on its forecourt across the walkers' line, two cars for
// sale facing the lane. Units are metres; z grows to the south, away from the lane.

const T = 0.15
const H = 3.2
const DOOR_H = 2.2

/** The showroom's floor, and its door in the front wall. */
export const DEALER_ROOM: Rect = { x0: 19.4, x1: 24.0, z0: LANE_SOUTH + T, z1: 20.5 }
export const DEALER_DOOR: Rect = { x0: 20.6, x1: 21.8, z0: LANE_SOUTH, z1: LANE_SOUTH + T }
const R = DEALER_ROOM

const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Box => ({ x0, x1, z0, z1, y0, y1 })

/** Its two leaves, each sliding into the wall at its side (half the opening, from 1 cm past the middle to 1 cm inside
 *  the jamb, as the market's and the office's). */
const AUTO_DOOR: AutoDoor = { ...DEALER_DOOR, height: DOOR_H, thick: 0.04, travel: (DEALER_DOOR.x1 - DEALER_DOOR.x0) / 2 + 0.02, color: '#3a3f45' }

export const DEALER_WALKIN: WalkIn = {
  id: 'dealer',
  walls: [
    // the front (its door in it, a lintel over), the back, the west and the east
    box(R.x0 - T, DEALER_DOOR.x0, DEALER_DOOR.z0, DEALER_DOOR.z1, 0, H),
    box(DEALER_DOOR.x1, R.x1 + T, DEALER_DOOR.z0, DEALER_DOOR.z1, 0, H),
    box(DEALER_DOOR.x0, DEALER_DOOR.x1, DEALER_DOOR.z0, DEALER_DOOR.z1, DOOR_H, H),
    box(R.x0 - T, R.x1 + T, R.z1, R.z1 + T, 0, H),
    box(R.x0 - T, R.x0, R.z0, R.z1, 0, H),
    box(R.x1, R.x1 + T, R.z0, R.z1, 0, H),
  ],
  roof: { y: 2.8, thick: 0.12 },
  rooms: [{ space: 'dealer', ...R, top: 2.68 }],
  doors: [DEALER_DOOR],
  floor: 'tile',
  look: 'boards',
  lights: [{ x: (R.x0 + R.x1) / 2, y: 2.55, z: (R.z0 + R.z1) / 2, color: '#fff6e8', intensity: 4, distance: 6.5 }],
  autoDoor: AUTO_DOOR,
}

/** The way in from the lane: on the lane, outside the door, inside it. */
export const DEALER_PATH = [
  { x: (DEALER_DOOR.x0 + DEALER_DOOR.x1) / 2, z: 15.9 },
  { x: (DEALER_DOOR.x0 + DEALER_DOOR.x1) / 2, z: LANE_SOUTH - 0.3 },
  { x: (DEALER_DOOR.x0 + DEALER_DOOR.x1) / 2, z: R.z0 + 0.5 },
] as const

/** The seller's desk in the showroom's west half, across from the door; the seller behind it facing the door, you in
 *  front of it. */
export const DEALER_DESK: Box = box(19.75, 21.05, 17.55, 18.05, 0, 0.75)
export const SELLER_SPOT = { x: 20.4, z: 18.35, heading: Math.PI } as const
export const SELLER_STAND = { x: 20.4, z: 17.15 } as const

/** The car on its turntable in the showroom's east half (a disc on the floor, the car turning on it). */
export const TURNTABLE = { x: 22.6, z: 18.7, r: 1.95 } as const

/** The wall of the paints along the back wall: a swatch panel for each paint, side by side (src/farm/carPaints.ts). */
export const PAINT_WALL = { x0: 19.6, x1: 21.6, y0: 1.0, y1: 1.9, z: R.z1 } as const

/** The dealer's forecourt across the walkers' line from its door, between the fence's collider and that line as the
 *  parking lot by the gate is (src/data/estate.ts, PARKING): two cars for sale in parallel bays. Inside the sun's box:
 *  they cast, with your own car. */
export const DEALER_FORECOURT: Rect = { x0: 19.4, x1: 27.6, z0: PARKING.z0, z1: PARKING.z1 }
export const DISPLAY_BAYS: readonly Rect[] = [
  { x0: 19.5, x1: 23.5, z0: PARKING.z0 + 0.12, z1: PARKING.z1 - 0.08 },
  { x0: 23.5, x1: 27.5, z0: PARKING.z0 + 0.12, z1: PARKING.z1 - 0.08 },
]
