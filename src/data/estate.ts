// The estate office and the parking lot, in the market's lot across the lane (src/data/market.ts): where everything
// stands. Units are metres; a heading is the people's (atan2(dx, dz): 0 faces +z, the south; π faces the north and the
// lane). Nothing here imports the market's row (it imports this one, for the lot): the numbers it shares are written
// out and named.
//
// The office is a walk-in building of one room (its row: ESTATE_WALKIN), against the market's west wall, its door in
// its north wall facing the lane. Its floor is fitted to the sun's shadow box as the market's is — the box's south-west
// side runs diagonally across this corner of the lot, so the room is as deep as the box allows at its west wall
// (src/data/buildings.test.ts checks it). The estate agent sits behind his desk across the room, facing the door; the
// house for sale hangs on the west wall (a board, with its price tag). He keeps the office's hours (HOURS.estate in
// src/farm/data.ts): out of them its door stays shut.
//
// The parking lot is the strip of lane west of the garden's gate, between the fence and the walkers' line (z 15.45:
// people walk past it, and the buyers' line stands east of the gate): asphalt with two parallel bays and a kerb along
// the fence, and the car in the east one (src/data/maps.ts, CAR_SPOT).

import type { Box, Rect, WalkIn } from './buildings'

const H = 2.9 // the walls' tops: a low parapet round the flat roof
const T = 0.15 // the walls' thickness
const DOOR_H = 2.1

/** The market's west wall's outer face (its hall's west wall, x 6.05 less its 0.15): the office stands against it. */
const MARKET_WEST = 5.9
/** The lane's south edge (src/data/layout.ts, LANE: z 15 ± 1.3): the office's front stands on it. */
const LANE_SOUTH = 16.3

/** The office's room: from its front wall on the lane's edge to as deep as the sun's shadow box allows at its west
 *  wall (2.2 m by 2 m), and its east wall against the market's. */
export const ESTATE_ROOM: Rect = { x0: 3.55, x1: MARKET_WEST - T, z0: LANE_SOUTH + T, z1: 18.42 }
/** The front door in its north wall, in the middle of its front (the sliding leaves go into the wall either side). */
export const ESTATE_DOOR: Rect = { x0: 4.2, x1: 5.1, z0: LANE_SOUTH, z1: ESTATE_ROOM.z0 }

const box = (x0: number, x1: number, z0: number, z1: number, y0 = 0, y1 = H): Box => ({ x0, x1, z0, z1, y0, y1 })
const R = ESTATE_ROOM
const D = ESTATE_DOOR

export const ESTATE_WALKIN: WalkIn = {
  id: 'estate',
  walls: [
    // north (round the door, and the lintel over it), south, west, east (against the market)
    box(R.x0 - T, D.x0, D.z0, D.z1),
    box(D.x1, R.x1 + T, D.z0, D.z1),
    box(D.x0, D.x1, D.z0, D.z1, DOOR_H, H),
    box(R.x0 - T, R.x1 + T, R.z1, R.z1 + T),
    box(R.x0 - T, R.x0, R.z0, R.z1),
    box(R.x1, R.x1 + T, R.z0, R.z1),
  ],
  roof: { y: 2.55, thick: 0.12 },
  rooms: [{ space: 'estate', ...R, top: 2.43 }],
  doors: [D],
  floor: 'boards',
  look: 'boards',
  lights: [{ x: (R.x0 + R.x1) / 2, y: 2.3, z: (R.z0 + R.z1) / 2, color: '#fff1dc', intensity: 3, distance: 4.5 }],
  // two navy leaves, each sliding 0.45 m into the wall at its side
  autoDoor: { ...D, height: DOOR_H, thick: 0.04, travel: 0.46, color: '#22344f' },
}

// ───────────────────────────── inside ─────────────────────────────

/** The agent's desk across the room in front of the south wall, a panel down its front (the side you stand at). */
export const ESTATE_DESK: Box = { x0: 4.05, x1: 5.25, z0: 17.5, z1: 17.98, y0: 0, y1: 0.74 }
/** Where the agent sits (his chair behind the desk, facing the door), and where you stand to talk to him. */
export const AGENT_SEAT = { x: (ESTATE_DESK.x0 + ESTATE_DESK.x1) / 2, z: 18.17, heading: Math.PI } as const
export const AGENT_STAND = { x: AGENT_SEAT.x, z: 17.0 } as const
/** His chair's seat, the height he sits at. */
export const SEAT_Y = 0.47
/** The house for sale: a board on the west wall's inside (its face's middle, half its size, facing east into the room).
 *  It carries the house's price tag. */
export const SALE_BOARD = { x: R.x0 + 0.025, y: 1.45, z: 17.35, half: [0.4, 0.3] as [number, number], heading: Math.PI / 2 } as const
/** A filing cabinet in the corner behind the board, and a plant in the corner by the door. */
export const CABINET: Box = { x0: R.x0, x1: R.x0 + 0.42, z0: R.z1 - 0.5, z1: R.z1, y0: 0, y1: 1.0 }
export const PLANT = { x: R.x1 - 0.24, z: R.z0 + 0.26 } as const

// ───────────────────────────── outside ─────────────────────────────

/** The front: its sign over the door (the logo, a house and a key, and the words), the plaque with the opening hours
 *  beside the door, and the window east of it with the house for sale in it — each a face's middle and half its size,
 *  on the wall's outer face (z LANE_SOUTH), facing the lane. The scene draws them from one picture (src/farm/Estate.tsx). */
export const ESTATE_SIGN = { x: (R.x0 - T + R.x1 + T) / 2, y: 2.56, z: LANE_SOUTH, half: [1.15, 0.27] as [number, number] } as const
export const ESTATE_HOURS = { x: (R.x0 - T + D.x0) / 2, y: 1.45, z: LANE_SOUTH, half: [0.3, 0.22] as [number, number] } as const
export const ESTATE_WINDOW = { x: (D.x1 + R.x1 + T) / 2, y: 1.35, z: LANE_SOUTH, half: [0.3, 0.5] as [number, number] } as const

/** The way in from the lane, for the agent: on the lane in front of the door, outside it, inside it. */
export const ESTATE_PATH = [
  { x: (D.x0 + D.x1) / 2, z: 15.45 },
  { x: (D.x0 + D.x1) / 2, z: LANE_SOUTH - 0.45 },
  { x: (D.x0 + D.x1) / 2, z: ESTATE_ROOM.z0 + 0.35 },
] as const

// ───────────────────────────── the parking lot ─────────────────────────────

/** The parking lot's asphalt: west of the gate (its post at x 4.95), from the fence's collider (z 13.15) to the
 *  walkers' line, less a body's width (z 15.25). */
export const PARKING: Rect = { x0: -3.6, x1: 4.4, z0: 13.15, z1: 15.25 }
/** Its kerb along the fence and at its west end: how wide and how high. */
export const KERB = { w: 0.12, h: 0.1 } as const
/** Two parallel bays, side by side along the fence (west to east), from the kerb to a line along the lot's lane side. */
export const BAYS: readonly Rect[] = [
  { x0: PARKING.x0 + KERB.w, x1: 0.4, z0: PARKING.z0 + KERB.w, z1: PARKING.z1 - 0.08 },
  { x0: 0.4, x1: PARKING.x1, z0: PARKING.z0 + KERB.w, z1: PARKING.z1 - 0.08 },
]
/** The parking sign at the lot's west end (a blue plate with a P on a post): its post, and its plate's face (facing
 *  east along the lane, the way you come from the gate). */
export const PARKING_SIGN = { x: PARKING.x0 + 0.3, z: PARKING.z0 + 0.45, y: 1.95, half: [0.22, 0.22] as [number, number] } as const
