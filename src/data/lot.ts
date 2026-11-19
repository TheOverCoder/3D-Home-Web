import type { Rect } from './buildings'
import { LANE_SOUTH } from './estate'

// The lot beyond the garden's gate, as rows: the ground outside the garden you can walk on, each piece of it named —
// the lane's strip from the parking lot west of the gate past the buildings' fronts, the market's forecourt before its
// hall, and the contractor's corner beside his cabin. Everything that asks where the lot is reads these rows: the action
// button's spaces (`spaceAt`, src/data/buildings.ts), the ground the camera and the walk-to may use (`reachRects`) and
// the invisible walls round it (`lotEdges`, src/farm/layout.ts), the woods' clearing (src/farm/landGeometry.ts). A new
// piece of ground on the lot is a row here.
//
// The buildings stand on the rows' edges: the fronts on the lane's south edge, the market's hall behind its forecourt,
// the contractor's cabin in his corner. The lines of the market's walls the rows meet are written out here and named
// (the market's row reads its lot from this file, so this one cannot read the market's): src/data/lot.test.ts holds them
// to its walls. Units are metres; z grows to the south, away from the lane.

export { LANE_SOUTH }

/** The lane's north edge, as far as you walk on it: the garden fence's collider along its south side. */
export const LANE_NORTH = 13
/** The lot's east end: past the contractor's corner, to the car dealer's west wall's outer face. */
export const LOT_EAST = 19.25
/** The market's hall's walls where the lot meets them, their outer faces (src/data/market.ts, HALL less or more the
 *  walls' 0.15 m): its west wall (the estate office's east wall stands against it), its front (the north wall, its door
 *  in it) and its east wall (the cabin's side). */
export const MARKET_FACES = { west: 5.9, front: 17.0, east: 16.6 } as const
/** How far south the contractor's corner reaches: past his cabin's south side, where its window looks east. */
export const CORNER_SOUTH = 19.0

/** The car park west of the estate office along the lane's south edge (update-v1/missions/11-buildings.md c7), wholly
 *  outside the farm's sun box: its bays and stages are src/farm/park.ts. Walkable from the start (grass where nothing
 *  is built yet). */
export const PARK_AREA: Rect = { x0: -26, x1: -7.2, z0: LANE_SOUTH, z1: 30.5 }

/** The lot's rows by name. */
export type LotRowId = 'lane' | 'forecourt' | 'corner' | 'park'

export const LOT_ROWS: Readonly<Record<LotRowId, Rect>> = {
  /** the lane's strip outside the garden's fence: from the parking lot's west end past every front to the lot's east
   *  end (the buyers' line stands on it, people walk past along it, shoppers stand about at its east end) */
  lane: { x0: PARK_AREA.x0, x1: LOT_EAST, z0: LANE_NORTH, z1: LANE_SOUTH },
  /** the market's forecourt: from the lane's edge to the hall's front, west to east from its west wall */
  forecourt: { x0: MARKET_FACES.west, x1: LOT_EAST, z0: LANE_SOUTH, z1: MARKET_FACES.front },
  /** the contractor's corner, east of the hall: his cabin against its wall, the way to his window */
  corner: { x0: MARKET_FACES.east, x1: LOT_EAST, z0: MARKET_FACES.front, z1: CORNER_SOUTH },
  /** the car park beyond the lane, west of the office */
  park: PARK_AREA,
}

/** The rows as a list, the lane first (its east end: where shoppers stand about). */
export const LOT: readonly Rect[] = [LOT_ROWS.lane, LOT_ROWS.forecourt, LOT_ROWS.corner, LOT_ROWS.park]

const inRect = (r: Rect, x: number, z: number, margin = 0) => x >= r.x0 - margin && x <= r.x1 + margin && z >= r.z0 - margin && z <= r.z1 + margin

/** The row a point of the ground is on (its edges count), or null off the lot. */
export function lotRowAt(x: number, z: number): LotRowId | null {
  for (const id of Object.keys(LOT_ROWS) as LotRowId[]) if (inRect(LOT_ROWS[id], x, z)) return id
  return null
}

/** Whether a point is on the lot (within `margin` metres of a row). */
export const onLot = (x: number, z: number, margin = 0) => LOT.some((r) => inRect(r, x, z, margin))
