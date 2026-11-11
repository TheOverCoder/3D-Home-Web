// The supermarket across the lane, behind the buyers' line, and the contractor's cabin beside it: where everything
// stands. Units are metres; a heading is the people's (atan2(dx, dz): 0 faces +z, the south; π faces the north and
// the lane; π/2 faces +x, the east).
//
// Its shape is two rectangles — the hall, and the manager's room behind it — fitted to the sun's shadow box, which on
// the ground is a diamond with its south tip here (src/data/buildings.ts says why every floor must be inside it).

import type { Box, Rect, WalkIn } from './buildings'

const H = 3.4 // the walls' tops: a parapet round the flat roof
const T = 0.15 // the walls' thickness
const DOOR_H = 2.2

/** The hall's floor (the shop) and the manager's room's floor, behind the hall's south wall. */
export const HALL: Rect = { x0: 6.05, x1: 13.9, z0: 17.15, z1: 20.5 }
export const BACK: Rect = { x0: 8.5, x1: 12.25, z0: HALL.z1 + T, z1: 22.45 }
/** The front door in the hall's north wall (facing the lane), and the doorway from the hall into the manager's room. */
export const FRONT_DOOR: Rect = { x0: 6.5, x1: 7.6, z0: HALL.z0 - T, z1: HALL.z0 }
export const INNER_DOOR: Rect = { x0: 10.4, x1: 11.4, z0: HALL.z1, z1: BACK.z0 }

const box = (x0: number, x1: number, z0: number, z1: number, y0 = 0, y1 = H): Box => ({ x0, x1, z0, z1, y0, y1 })

/** A wall along x (at z0..z1) from xa to xb, with an opening from o.x0 to o.x1 up to DOOR_H (and a lintel over it). */
function wallX(xa: number, xb: number, z0: number, z1: number, o?: Rect): Box[] {
  if (!o) return [box(xa, xb, z0, z1)]
  return [box(xa, o.x0, z0, z1), box(o.x1, xb, z0, z1), box(o.x0, o.x1, z0, z1, DOOR_H, H)]
}

export const MARKET_WALKIN: WalkIn = {
  id: 'market',
  walls: [
    // the hall: north (with the front door), south (with the doorway to the back), west and east
    ...wallX(HALL.x0 - T, HALL.x1 + T, HALL.z0 - T, HALL.z0, FRONT_DOOR),
    ...wallX(HALL.x0 - T, HALL.x1 + T, HALL.z1, HALL.z1 + T, INNER_DOOR),
    box(HALL.x0 - T, HALL.x0, HALL.z0, HALL.z1),
    box(HALL.x1, HALL.x1 + T, HALL.z0, HALL.z1),
    // the manager's room: west, east and south (its north side is the hall's south wall)
    box(BACK.x0 - T, BACK.x0, BACK.z0, BACK.z1 + T),
    box(BACK.x1, BACK.x1 + T, BACK.z0, BACK.z1 + T),
    box(BACK.x0, BACK.x1, BACK.z1, BACK.z1 + T),
  ],
  roof: { y: 3.0, thick: 0.15 },
  rooms: [
    { space: 'market', ...HALL, top: 2.88 },
    { space: 'market-office', ...BACK, top: 2.88 },
  ],
  doors: [FRONT_DOOR, INNER_DOOR],
  floor: 'tile',
  lights: [
    { x: 10.0, y: 2.7, z: 18.85, color: '#fff1dc', intensity: 6, distance: 8 },
    { x: 10.4, y: 2.7, z: 21.55, color: '#fff1dc', intensity: 4, distance: 5 },
  ],
  // the front door's two leaves, 4 cm thick, each sliding 0.57 m into the wall at its side (from 1 cm past the middle
  // to 1 cm inside the jamb)
  autoDoor: { ...FRONT_DOOR, height: DOOR_H, thick: 0.04, travel: 0.57 },
}

// ───────────────────────────── inside the hall ─────────────────────────────

/** The way in from the lane: on the lane, outside the door, inside the door. */
export const MARKET_PATH = [
  { x: 7.05, z: 15.9 },
  { x: 7.05, z: 16.55 },
  { x: 7.05, z: 17.6 },
] as const

/** The counter along the north wall beside the door, and the till on it. Shoppers pay standing at PAY_SPOT, facing
 *  the counter; those waiting stand behind them to the east, PAY_STEP apart. */
export const COUNTER: Box = box(8.0, 9.4, HALL.z0, HALL.z0 + 0.5, 0, 0.95)
export const TILL = { x: 9.0, y: 0.95, z: 17.4 } as const
export const PAY_SPOT = { x: 8.7, z: 18.05, heading: Math.PI } as const
export const PAY_STEP = 0.7

/** A bay: one place on the shelves, 0.6 m wide, three shelves with one unit on each. `x`, `z`: the middle of its
 *  front; `heading`: the way it faces (where you stand to see it). */
export interface Bay {
  x: number
  z: number
  heading: number
}
export const BAY_WIDTH = 0.6
export const SHELF_YS = [0.45, 0.9, 1.35] as const
/** The shelving along the hall's south wall (bays 0–5) and the island, back to back with an opaque middle panel 1.7 m
 *  tall (bays 6–9): what stands on one face is never seen from the other's aisle (it is a hiding piece). */
export const SHELF_RUN: Box = box(6.3, 9.9, 20.08, HALL.z1, 0, 1.8)
export const ISLAND: Box = box(11.4, 12.6, 18.35, 19.15, 0, 1.8)
export const ISLAND_PANEL: Box = box(11.4, 12.6, 18.72, 18.78, 0, 1.7)
/** The places, in the order they open (the first three face the door). */
export const BAYS: readonly Bay[] = [
  { x: 7.2, z: SHELF_RUN.z0, heading: Math.PI },
  { x: 7.8, z: SHELF_RUN.z0, heading: Math.PI },
  { x: 8.4, z: SHELF_RUN.z0, heading: Math.PI },
  { x: 6.6, z: SHELF_RUN.z0, heading: Math.PI },
  { x: 9.0, z: SHELF_RUN.z0, heading: Math.PI },
  { x: 9.6, z: SHELF_RUN.z0, heading: Math.PI },
  { x: 11.7, z: ISLAND.z0, heading: Math.PI },
  { x: 12.3, z: ISLAND.z0, heading: Math.PI },
  { x: 11.7, z: ISLAND.z1, heading: 0 },
  { x: 12.3, z: ISLAND.z1, heading: 0 },
]
/** Where a shopper stands to look along the shelves (one each, up to four), facing them. */
export const BROWSE_SPOTS = [
  { x: 7.5, z: 19.45, heading: 0 },
  { x: 9.3, z: 19.45, heading: 0 },
  { x: 12.0, z: 17.85, heading: 0 },
  { x: 12.0, z: 19.75, heading: Math.PI },
] as const

// ───────────────────────────── the manager's room ─────────────────────────────

/** The desk across the room, its computer's screen facing the doorway; the manager stands behind it. You stand in
 *  front: at DESK_STAND for the computer, at MANAGER_STAND to talk to him. */
export const DESK: Box = box(9.2, 10.8, 21.45, 21.9, 0, 0.75)
export const SCREEN = { x: 9.55, y: 1.12, z: 21.5, heading: Math.PI } as const
export const MANAGER_SPOT = { x: 10.4, z: 22.17, heading: Math.PI } as const
export const DESK_STAND = { x: 9.55, z: 20.95 } as const
export const MANAGER_STAND = { x: 10.4, z: 20.95 } as const

// ───────────────────────────── the contractor's corner ─────────────────────────────

/** The contractor's site cabin against the hall's east wall, as far back as the sun's box allows, hidden from the gate
 *  by the hall. He stands inside at its counter window (in its east side); you stand outside in front of it. */
export const CABIN: Box = box(14.4, 15.5, 17.35, 18.5, 0, 2.4)
export const CONTRACTOR_SPOT = { x: 15.15, z: 17.92, heading: Math.PI / 2 } as const
export const CONTRACTOR_STAND = { x: 15.95, z: 17.92 } as const

// ───────────────────────────── the lot ─────────────────────────────

/** The ground you can walk on outside the garden: the strip of lane in front of the market, and the corner by the
 *  cabin. Invisible walls close it where the hall's walls do not (src/farm/Land.tsx). */
export const LOT: readonly Rect[] = [
  { x0: 4.3, x1: 16.3, z0: 13, z1: 17 },
  { x0: HALL.x1 + T, x1: 16.3, z0: 17, z1: 18.6 },
]
