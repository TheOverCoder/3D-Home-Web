import type { Place } from '../farm/state'
import { BAYS } from './estate'

// The two maps: the farm (the land, the beds, the animals, the lane and the market) and the house you buy, each a
// world of its own round the origin; only the one you are on is in the scene. The car takes you from one to the other:
// it is parked at its spot on each map, and you get out where `ARRIVE` says (heading in radians, as the player's yaw:
// 0 looks along −z, north). The car's spot on the farm is in the market's parking lot, past the fence.

export interface Spot {
  x: number
  z: number
  heading: number
}

/** The parking lot's east bay on the farm (src/data/estate.ts), where the car stands. */
const BAY = BAYS[1]

/** Where the car stands on each map: the middle of its footprint, and the way its bonnet points (on the farm west,
 *  along the fence: it pulled in from the market's side). */
export const CAR_SPOT: Record<Place, Spot> = {
  farm: { x: (BAY.x0 + BAY.x1) / 2, z: (BAY.z0 + BAY.z1) / 2, heading: Math.PI / 2 },
  home: { x: 2.6, z: 9.2, heading: -Math.PI / 2 },
}

/** Where you stand when a drive ends, beside the car. */
export const ARRIVE: Record<Place, Spot> = {
  // on the lane by the driver's door, looking past the car's boot to the garden's gate
  farm: { x: (BAY.x0 + BAY.x1) / 2 - 0.4, z: 15.8, heading: -0.9 },
  home: { x: -1.2, z: 8.2, heading: 0 },
}

/** Where a new farm starts: on the farm, on the path among the beds, looking south to the gate. */
export const FARM_START: Spot = { x: -1.2, z: 6.8, heading: Math.PI }
