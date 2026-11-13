// Walk-in buildings: one row each, and everything about one comes from its row — the walls you see (src/models),
// the walls you bump into and the walls that hide what is behind them (src/scene/WalkIn.tsx), where the camera may
// be (src/scene/Player.tsx), which room you are in for the action button (src/lib/interaction.ts), what is
// underfoot, the walk-to's goal test, the woods' clearing, and the poses the pixel guard draws (tests/e2e/16-view).
// A new building is a row here and a model; nothing else names it.
//
// Every room's floor, and the inner faces of the walls that face the sun (west and north: the sun is to the south-east),
// must lie inside the sun's shadow box (SUN_SHADOW in ./layout): outside it a surface is drawn as if nothing shaded it,
// and a room would look roofless. src/data/buildings.test.ts checks every row.

import { LOT, MARKET_WALKIN } from './market'
import { insideHouse, roomAt } from './layout'

/** A box in world metres: x and z on the ground, y up. */
export interface Box {
  x0: number
  x1: number
  z0: number
  z1: number
  y0: number
  y1: number
}

/** A rectangle on the ground. */
export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

export interface WalkInRoom extends Rect {
  /** the room's own space for the action button: a thing in it is in reach only from inside it (`spaceAt`) */
  space: string
  /** the highest the camera may be (under the roof slab) */
  top: number
}

export interface WalkInLight {
  x: number
  y: number
  z: number
  color: string
  intensity: number
  distance: number
}

/** A pair of automatic sliding doors in a doorway: the opening (in the wall's thickness, where its leaves meet), how high
 *  it is, the leaves' thickness, and how far each slides into the wall at its side to open (src/scene/WalkIn.tsx). Shut,
 *  they close the doorway to the eye; open, they are inside the wall. */
export interface AutoDoor extends Rect {
  height: number
  thick: number
  travel: number
}

export interface WalkIn {
  id: string
  /** the walls as closed boxes: a doorway is a gap between two boxes (and a lintel box above it) */
  walls: Box[]
  /** the flat roof: a slab over every room, from y up by `thick` (the walls rise past it as a parapet) */
  roof: { y: number; thick: number }
  /** the floors: the camera stays inside the room your body is in (or the doorway between two) */
  rooms: WalkInRoom[]
  /** the openings you walk through: the front door and the doorways between rooms (the wall's thickness) */
  doors: Rect[]
  /** what is underfoot inside */
  floor: 'tile' | 'boards'
  /** a light in each room, there from the start (no shader is compiled again when you walk in); no shadow */
  lights: WalkInLight[]
  /** sliding doors in a doorway of its outer wall, opening by themselves for whoever comes near */
  autoDoor?: AutoDoor
}

export const WALK_INS: readonly WalkIn[] = [MARKET_WALKIN]

/** The whole walk-in's extent on the ground (walls included). */
export function bounds(w: WalkIn): Rect {
  return {
    x0: Math.min(...w.walls.map((b) => b.x0)),
    x1: Math.max(...w.walls.map((b) => b.x1)),
    z0: Math.min(...w.walls.map((b) => b.z0)),
    z1: Math.max(...w.walls.map((b) => b.z1)),
  }
}

const inRect = (r: Rect, x: number, z: number, margin = 0) => x >= r.x0 - margin && x <= r.x1 + margin && z >= r.z0 - margin && z <= r.z1 + margin

/** The walk-in room at a point: inside its floor, or in the thickness of a doorway, where the room is the one the
 *  doorway opens into from outside (a door in the outer wall belongs to its room; a doorway between two rooms to the
 *  one it is nearer the middle of). */
export function walkInRoomAt(x: number, z: number): { walkIn: WalkIn; room: WalkInRoom } | null {
  for (const w of WALK_INS) {
    for (const room of w.rooms) if (inRect(room, x, z)) return { walkIn: w, room }
    for (const d of w.doors) {
      if (!inRect(d, x, z)) continue
      let best: WalkInRoom | null = null
      let bestD = Infinity
      for (const room of w.rooms) {
        const dx = Math.max(room.x0 - x, 0, x - room.x1)
        const dz = Math.max(room.z0 - z, 0, z - room.z1)
        const dd = Math.hypot(dx, dz)
        if (dd < bestD) {
          bestD = dd
          best = room
        }
      }
      if (best) return { walkIn: w, room: best }
    }
  }
  return null
}

/** The walk-in whose walls' extent holds the point (with `margin` metres round it), or null. */
export function insideWalkIn(x: number, z: number, margin = 0): WalkIn | null {
  for (const w of WALK_INS) if (inRect(bounds(w), x, z, margin)) return w
  return null
}

/** The lane outside the garden's fence (the lot before the market and the contractor's corner): a space of its own, so
 *  nothing in the garden is in reach from it over the fence, nor the other way. */
export const LANE = 'lane'

/** Which space a point is in, for the action button (src/lib/interaction.ts): a room of the house (or 'house' in its
 *  walls), a walk-in's room, the lane, or 'out' (the garden and the farm). */
export function spaceAt(x: number, z: number): string {
  if (insideHouse(x, z)) return roomAt(x, z) ?? 'house'
  const walkIn = walkInRoomAt(x, z)
  if (walkIn) return walkIn.room.space
  return LOT.some((r) => inRect(r, x, z)) ? LANE : 'out'
}

/** Is this space a walk-in's room? */
export const isWalkInSpace = (space: string) => WALK_INS.some((w) => w.rooms.some((r) => r.space === space))
