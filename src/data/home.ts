// The house's own plot: the home map round the house (src/scene/Exterior.tsx). A lawn inside a slatted timber fence, the
// paving along the walls with the shrubs by them, a gravel driveway where the car stands (src/data/maps.ts,
// CAR_SPOT.home) out through a gate in the east fence to a country lane, and round it all a quiet countryside drawn far
// off and light: a few trees, fields and low hills. The house stands at the origin, as it always has.

export interface Area {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Inside the fence: the ground you can be on (the camera, the safety net, walking to a mark: src/lib/world.ts). */
export const PLOT: Area = { minX: -11, maxX: 11, minZ: -10, maxZ: 14.5 }

/** The country lane outside the gate, running north and south. */
export const COUNTRY_LANE = { x: 14.2, width: 3.2 } as const

/** The driveway: from beside the house, past the car, through the gate in the east fence to the lane. */
export const DRIVE: Area = { minX: -2.4, maxX: COUNTRY_LANE.x - COUNTRY_LANE.width / 2, minZ: 9.0, maxZ: 11.4 }

/** A tree in the plot's south-west corner (x, z, height). */
export const GARDEN_TREE: [number, number, number] = [-8.4, 12.2, 5.6]

/** The countryside's trees round the plot (x, z, height): none on the lane, none in the way of a window's view of the
 *  hills. They throw no shadow (the sun is low in the south-east and must keep reaching the windows). */
export const COUNTRY_TREES: [number, number, number][] = [
  [-17, -6, 8.5],
  [-21, 3, 9.5],
  [-16.5, 10, 7.5],
  [-24, -14, 10],
  [-8, -17, 8],
  [2, -21, 9],
  [9, -16.5, 7.5],
  [20, -8, 9],
  [22, 6, 8.5],
  [-4, 21, 8],
  [7, 24, 9.5],
  [19, 19, 8],
]

/** Low hills far off all round (x, z, their radius along x and z, height, colour): the horizon. */
export const HILLS: [number, number, number, number, number, string][] = [
  [-150, -60, 90, 60, 18, '#7b9658'],
  [-60, -170, 110, 50, 22, '#6f8c52'],
  [80, -160, 90, 60, 16, '#86a061'],
  [170, -20, 70, 90, 20, '#728d55'],
  [120, 140, 100, 60, 18, '#7f9a5b'],
  [-40, 170, 120, 50, 15, '#86a061'],
  [-170, 90, 80, 70, 24, '#6f8c52'],
]

/** Fields between the plot and the hills (x, z, width, depth, turn, colour). */
export const FIELDS: [number, number, number, number, number, string][] = [
  [-45, -30, 40, 25, 0.2, '#c4b36c'],
  [40, -45, 35, 30, -0.3, '#93a85c'],
  [-35, 52, 45, 28, 0.1, '#a9b46b'],
  [55, 40, 30, 40, 0.4, '#bfa860'],
]
