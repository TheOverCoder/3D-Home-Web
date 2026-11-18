// The estate office and the parking lot, in the market's lot across the lane (src/data/market.ts): where everything
// stands. Units are metres; a heading is the people's (atan2(dx, dz): 0 faces +z, the south; π faces the north and the
// lane). Nothing here imports the market's row (it imports this one, for the lot): the numbers it shares are written
// out and named.
//
// The office is a walk-in building of one room (its row: ESTATE_WALKIN), against the market's west wall, its door in
// its north wall facing the lane. Its floor is fitted to the farm's sun box (src/data/sunBox.ts): from its front on the
// lane's edge west along the lane and as deep as the box allows at its west wall (src/data/buildings.test.ts checks
// it). The estate agent sits behind his desk across the room, facing the door, the house for sale on a board on the
// wall beside it (its price tag); in the west half the house itself stands as a model on a table (1:25, as the save's
// shell has it), and the farm's map hangs on the west wall with the meadows for sale on it (each its price tag); a
// bench by the front for those who wait. He keeps the office's hours (HOURS.estate in src/farm/data.ts): out of them
// its door stays shut.
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
/** The lane's south edge (src/data/layout.ts, LANE: z 15 ± 1.3): the office's front stands on it, as every front on the
 *  lot does (src/data/lot.ts). */
export const LANE_SOUTH = 16.3

/** The office's room: from its front wall on the lane's edge to as deep as the farm's sun box allows at its west wall
 *  (5.55 m by 3.45 m), and its east wall against the market's. */
export const ESTATE_ROOM: Rect = { x0: 0.2, x1: MARKET_WEST - T, z0: LANE_SOUTH + T, z1: 19.9 }
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
  lights: [{ x: (R.x0 + R.x1) / 2, y: 2.3, z: (R.z0 + R.z1) / 2, color: '#fff1dc', intensity: 4, distance: 6.5 }],
  // two navy leaves, each sliding 0.45 m into the wall at its side
  autoDoor: { ...D, height: DOOR_H, thick: 0.04, travel: 0.46, color: '#22344f' },
}

// ───────────────────────────── inside ─────────────────────────────

/** The agent's desk across the room in front of the south wall, east of the middle (across from the door), a panel down
 *  its front (the side you stand at). */
export const ESTATE_DESK: Box = { x0: 4.05, x1: 5.25, z0: 18.98, z1: 19.46, y0: 0, y1: 0.74 }
/** Where the agent sits (his chair behind the desk, facing the door), and where you stand to talk to him. */
export const AGENT_SEAT = { x: (ESTATE_DESK.x0 + ESTATE_DESK.x1) / 2, z: R.z1 - 0.25, heading: Math.PI } as const
export const AGENT_STAND = { x: AGENT_SEAT.x, z: ESTATE_DESK.z0 - 0.5 } as const
/** His chair's seat, the height he sits at. */
export const SEAT_Y = 0.47
/** The house for sale: a board on the east wall's inside, between the door and his desk (its face's middle, half its
 *  size, facing west into the room). It carries the house's price tag. */
export const SALE_BOARD = { x: R.x1 - 0.025, y: 1.45, z: 17.6, half: [0.4, 0.3] as [number, number], heading: -Math.PI / 2 } as const
/** A filing cabinet against the south wall at the desk's west end (its drawers facing him), and a plant in the corner
 *  by the door. */
export const CABINET: Box = { x0: ESTATE_DESK.x0 - 0.7, x1: ESTATE_DESK.x0 - 0.28, z0: R.z1 - 0.5, z1: R.z1, y0: 0, y1: 1.0 }
export const PLANT = { x: R.x1 - 0.24, z: R.z0 + 0.26 } as const
/** A bench along the front wall west of the door, for those who wait (its back to the wall). */
export const BENCH: Box = { x0: 0.75, x1: 2.35, z0: R.z0, z1: R.z0 + 0.46, y0: 0, y1: 0.46 }

/** The table in the west half with the house on it, and the model: the house at 1:25 (its walls, floors and openings as
 *  the save's shell has them: src/home/shell.ts), its garden side turned to the door. `x`, `z`: its middle; `y`: the
 *  table's top, where its base stands. */
export const HOUSE_TABLE: Box = { x0: 1.85, x1: 3.05, z0: 17.75, z1: 18.75, y0: 0, y1: 0.76 }
export const HOUSE_MODEL = { x: (HOUSE_TABLE.x0 + HOUSE_TABLE.x1) / 2, y: HOUSE_TABLE.y1, z: (HOUSE_TABLE.z0 + HOUSE_TABLE.z1) / 2, scale: 1 / 25, heading: Math.PI } as const

/** The farm's map on the west wall's inside (its face's middle, half its size, facing east into the room), north up: the
 *  ground it shows (in the farm's metres: the garden and every meadow round it, the lane and the lot beyond), each
 *  meadow for sale carrying its price tag where it is on the map. */
export const ESTATE_MAP = { x: R.x0 + 0.025, y: 1.45, z: 18.25, half: [0.7, 0.625] as [number, number], heading: Math.PI / 2 } as const
export const MAP_AREA: Rect = { x0: -28, x1: 28, z0: -27, z1: 23 }

/** A point of the farm (x, z, in its metres) where the map shows it, on the wall: the map's right is the farm's east
 *  (the room's north: −z), its up the farm's north. */
export function onMap(fx: number, fz: number): { x: number; y: number; z: number } {
  const s = (ESTATE_MAP.half[0] * 2) / (MAP_AREA.x1 - MAP_AREA.x0)
  const cx = (MAP_AREA.x0 + MAP_AREA.x1) / 2
  const cz = (MAP_AREA.z0 + MAP_AREA.z1) / 2
  return { x: ESTATE_MAP.x, y: ESTATE_MAP.y - (fz - cz) * s, z: ESTATE_MAP.z - (fx - cx) * s }
}

// ───────────────────────────── outside ─────────────────────────────

/** The front: its sign across the middle of it (the logo, a house and a key, and the words), the plaque with the
 *  opening hours beside the door, the window east of it with the house for sale in it and the wide window west of it
 *  with the farm's map — each a face's middle and half its size, on the wall's outer face (z LANE_SOUTH), facing the
 *  lane. The scene draws them from one picture (src/farm/Estate.tsx). */
export const ESTATE_SIGN = { x: (R.x0 - T + R.x1 + T) / 2, y: 2.56, z: LANE_SOUTH, half: [1.15, 0.27] as [number, number] } as const
export const ESTATE_HOURS = { x: D.x0 - 0.42, y: 1.45, z: LANE_SOUTH, half: [0.3, 0.22] as [number, number] } as const
export const ESTATE_WINDOW = { x: (D.x1 + R.x1 + T) / 2, y: 1.35, z: LANE_SOUTH, half: [0.3, 0.5] as [number, number] } as const
export const ESTATE_DISPLAY = { x: 1.75, y: 1.3, z: LANE_SOUTH, half: [1.05, 0.6] as [number, number] } as const

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
