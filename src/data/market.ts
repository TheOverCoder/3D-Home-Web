// The supermarket across the lane, behind the buyers' line, and the contractor's cabin beside it: where everything
// stands. Units are metres; a heading is the people's (atan2(dx, dz): 0 faces +z, the south; π faces the north and
// the lane; π/2 faces +x, the east).
//
// Its shape is two rectangles — the hall, and the manager's room behind it — inside the farm's sun box
// (src/data/sunBox.ts; src/data/buildings.ts says why every floor must be inside it), as update-v1/missions/11-buildings.md
// planned them (src/data/lotPlan.ts holds them to it): the hall 2.3 times the first one, from the same front door south
// and east, rising to 4 m; in it two gondolas of shelves running north–south (16 places, each gondola an opaque panel
// between its faces: a hiding piece), two checkouts by the door, and a café corner in the north-east.

import type { Box, Rect, WalkIn } from './buildings'

const H = 4.0 // the walls' tops: a parapet round the flat roof
const T = 0.15 // the walls' thickness
const DOOR_H = 2.2

/** The hall's floor (the shop) and the manager's room's floor, behind the hall's south wall. */
export const HALL: Rect = { x0: 6.05, x1: 16.45, z0: 17.15, z1: 22.9 }
export const BACK: Rect = { x0: 8.5, x1: 14.0, z0: HALL.z1 + T, z1: 25.6 }
/** The front door in the hall's north wall (facing the lane), and the doorway from the hall into the manager's room. */
export const FRONT_DOOR: Rect = { x0: 6.5, x1: 7.6, z0: HALL.z0 - T, z1: HALL.z0 }
export const INNER_DOOR: Rect = { x0: 10.75, x1: 11.75, z0: HALL.z1, z1: BACK.z0 }

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
  roof: { y: 3.6, thick: 0.15 },
  rooms: [
    { space: 'market', ...HALL, top: 3.48 },
    { space: 'market-office', ...BACK, top: 3.48 },
  ],
  doors: [FRONT_DOOR, INNER_DOOR],
  floor: 'tile',
  lights: [
    { x: (HALL.x0 + HALL.x1) / 2, y: 3.3, z: (HALL.z0 + HALL.z1) / 2, color: '#fff1dc', intensity: 8, distance: 10 },
    { x: (BACK.x0 + BACK.x1) / 2, y: 3.3, z: (BACK.z0 + BACK.z1) / 2, color: '#fff1dc', intensity: 4, distance: 6 },
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

/** The two checkouts along the north wall east of the door, each a counter with its till; shoppers pay standing at
 *  their checkout's pay spot, facing the counter, those waiting behind to the east, PAY_STEP apart. The second opens
 *  once two or more come at a time (the shop's `group` ladder at 2: `checkoutsOpen`). */
export const COUNTERS: readonly Box[] = [box(8.0, 9.4, HALL.z0, HALL.z0 + 0.5, 0, 0.95), box(10.6, 12.0, HALL.z0, HALL.z0 + 0.5, 0, 0.95)]
export const TILLS = [
  { x: 9.0, y: 0.95, z: 17.4 },
  { x: 11.6, y: 0.95, z: 17.4 },
] as const
export const PAY_SPOTS = [
  { x: 8.7, z: 18.05, heading: Math.PI },
  { x: 11.3, z: 18.05, heading: Math.PI },
] as const
/** The first checkout (the one open from the start). */
export const COUNTER = COUNTERS[0]
export const TILL = TILLS[0]
export const PAY_SPOT = PAY_SPOTS[0]
export const PAY_STEP = 0.7
/** The checkouts open with `group` steps bought on the shop's ladder (the second from 2). */
export const checkoutsOpen = (group: number) => (group >= 2 ? 2 : 1)

/** A bay: one place on the shelves, 0.6 m wide, three shelves with one unit on each. `x`, `z`: the middle of its
 *  front; `heading`: the way it faces (where you stand to see it). */
export interface Bay {
  x: number
  z: number
  heading: number
}
export const BAY_WIDTH = 0.6
export const SHELF_YS = [0.45, 0.9, 1.35] as const
/** The shelves' top (their canopy). */
export const SHELF_TOP = 1.8
/** The two gondolas, running north–south from a passage's width south of the pay line, each two faces of four bays
 *  back to back with an opaque middle panel 1.7 m tall (GONDOLA_PANELS): what stands on one face is never seen from
 *  the other's aisle (it is a hiding piece). The doorway to the back opens on the aisle between them. */
export const GONDOLAS: readonly Box[] = [box(8.6, 9.4, 19.6, 22.0, 0, SHELF_TOP), box(11.9, 12.7, 19.6, 22.0, 0, SHELF_TOP)]
export const GONDOLA_PANELS: readonly Box[] = GONDOLAS.map((g) => box((g.x0 + g.x1) / 2 - 0.03, (g.x0 + g.x1) / 2 + 0.03, g.z0, g.z1, 0, 1.7))
/** A bay's depth, from its front to the panel. */
export const BAY_DEPTH = GONDOLA_PANELS[0].x0 - GONDOLAS[0].x0
const faces = (g: Box): Bay[][] => [
  [0, 1, 2, 3].map((k) => ({ x: g.x0, z: g.z0 + BAY_WIDTH * (k + 0.5), heading: -Math.PI / 2 })),
  [0, 1, 2, 3].map((k) => ({ x: g.x1, z: g.z0 + BAY_WIDTH * (k + 0.5), heading: Math.PI / 2 })),
]
/** The places, in the order they open: the first gondola's west face first (it faces the door's side), then its east
 *  face, then the second gondola's west and east faces, each north to south. */
export const BAYS: readonly Bay[] = [...faces(GONDOLAS[0]), ...faces(GONDOLAS[1])].flat()
/** Where a shopper stands to look along the shelves (one each, up to eight), facing a face, in the order they are
 *  taken: each face's north spot, then each's south one. */
const browse = (z: number) => [
  { x: GONDOLAS[0].x0 - 0.6, z, heading: Math.PI / 2 },
  { x: GONDOLAS[0].x1 + 0.6, z, heading: -Math.PI / 2 },
  { x: GONDOLAS[1].x0 - 0.6, z, heading: Math.PI / 2 },
  { x: GONDOLAS[1].x1 + 0.6, z, heading: -Math.PI / 2 },
]
export const BROWSE_SPOTS = [...browse(20.2), ...browse(21.4)] as const
/** The cross aisle between the pay line and the gondolas' north ends: the way from the door to each aisle. */
export const CROSS_Z = 18.9

/** The café corner in the north-east: a coffee counter along the east wall, two round tables, two seats at each
 *  (a shopper who has paid sits a while now and then: src/farm/state/market.ts). */
export const CAFE_COUNTER: Box = box(15.75, HALL.x1, 17.4, 18.9, 0, 1.0)
export const CAFE_TABLES = [
  { x: 14.4, z: 18.0, r: 0.35 },
  { x: 14.4, z: 19.3, r: 0.35 },
] as const
export const CAFE_SEATS = CAFE_TABLES.flatMap((t) => [
  { x: t.x - 0.55, z: t.z, heading: Math.PI / 2 },
  { x: t.x + 0.55, z: t.z, heading: -Math.PI / 2 },
])
/** The café's ground: what is in it (the counter, the tables and their seats) is walked round. */
export const CAFE: Rect = { x0: 13.5, x1: HALL.x1, z0: HALL.z0, z1: 19.8 }

// ───────────────────────────── the manager's room ─────────────────────────────

/** The desk across the room near the doorway (as near as in the first, smaller room: the walk to him is no longer),
 *  its computer's screen facing the doorway; the manager stands behind it, his stock behind him. You stand in front:
 *  at DESK_STAND for the computer, at MANAGER_STAND to talk to him. */
export const DESK: Box = box(9.55, 11.15, 23.85, 24.3, 0, 0.75)
export const SCREEN = { x: 9.9, y: 1.12, z: 23.9, heading: Math.PI } as const
export const MANAGER_SPOT = { x: 10.75, z: 24.57, heading: Math.PI } as const
export const DESK_STAND = { x: 9.9, z: 23.35 } as const
export const MANAGER_STAND = { x: 10.75, z: 23.35 } as const

// ───────────────────────────── the contractor's corner ─────────────────────────────

/** The contractor's site cabin against the hall's east wall (a step clear of it), hidden from the gate by the hall.
 *  He stands inside at its counter window (in its east side); you stand outside in front of it. */
export const CABIN: Box = box(HALL.x1 + T + 0.15, HALL.x1 + T + 1.25, 17.35, 18.5, 0, 2.4)
export const CONTRACTOR_SPOT = { x: CABIN.x0 + 0.75, z: 17.92, heading: Math.PI / 2 } as const
export const CONTRACTOR_STAND = { x: CABIN.x1 + 0.45, z: 17.92 } as const

// ───────────────────────────── the lot ─────────────────────────────

/** The ground you can walk on outside the garden: the lot's rows (src/data/lot.ts), the lane first. */
export { LOT } from './lot'
