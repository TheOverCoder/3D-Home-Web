import type { Rect } from './buildings'
import { boxMargin, type SunBox } from './sunBox'

// The rule every walk-in building's rooms keep (src/data/buildings.test.ts, and the planned rows' src/data/lotPlan.test.ts):
// outside the sun's shadow box three lights a surface as if nothing shaded it, so every room's floor, and the inside of
// every wall the sun shines at, must stand inside the box. The sun is to the south-east: the walls it shines at from
// inside are the west wall (its inside faces +x) and the north wall (its inside faces +z). Each is checked from the
// floor up to the roof's underside, at each end and the middle: across a straight wall a box's sides change evenly, so
// a wall inside at its ends and at the floor and the roof is inside all over.

/** How far inside the box every point checked must be, metres. */
export const SUN_MARGIN = 0.1

/** The heights a wall is checked at: every metre up to 3 m (the rule as it began), and on up to the roof. */
export function wallHeights(roof: number): number[] {
  const heights = [0, 1, 2, 3]
  for (let y = 4; y < roof; y++) heights.push(y)
  if (!heights.includes(roof)) heights.push(roof)
  return heights
}

/** A point checked, what it is, and how far inside the box it is (below 0: outside). */
export interface SunPoint {
  what: string
  x: number
  y: number
  z: number
  margin: number
}

const along = (a: number, b: number) => [a, (a + b) / 2, b]
const point = (what: string, x: number, y: number, z: number, box: SunBox): SunPoint => ({ what, x, y, z, margin: boxMargin(x, y, z, box) })

/** A room's floor: its four corners. */
export function floorMargins(room: Rect, box: SunBox): SunPoint[] {
  const out: SunPoint[] = []
  for (const x of [room.x0, room.x1]) for (const z of [room.z0, room.z1]) out.push(point('floor corner', x, 0, z, box))
  return out
}

/** The insides of a room's west and north walls, from the floor up to `roof`. */
export function wallMargins(room: Rect, roof: number, box: SunBox): SunPoint[] {
  const out: SunPoint[] = []
  for (const y of wallHeights(roof)) {
    for (const z of along(room.z0, room.z1)) out.push(point("west wall's inside", room.x0, y, z, box))
    for (const x of along(room.x0, room.x1)) out.push(point("north wall's inside", x, y, room.z0, box))
  }
  return out
}

/** A room's floor and its sunward walls' insides together. */
export const roomMargins = (room: Rect, roof: number, box: SunBox): SunPoint[] => [...floorMargins(room, box), ...wallMargins(room, roof, box)]

/** A footprint's corners at each height (something standing outdoors that casts: the car, the contractor's cabin). */
export function cornerMargins(r: Rect, heights: readonly number[], box: SunBox): SunPoint[] {
  const out: SunPoint[] = []
  for (const y of heights) for (const x of [r.x0, r.x1]) for (const z of [r.z0, r.z1]) out.push(point('corner', x, y, z, box))
  return out
}

/** The least margin of a list of points (Infinity for none). */
export const worst = (points: readonly SunPoint[]) => Math.min(...points.map((p) => p.margin))
