import { APRON, insideHouse, roomAt, type FloorKind, type RoomId } from '../data/layout'
import { floorOf } from '../home/shell'
import { DRIVE, PLOT } from '../data/home'
import { spaceAt, walkInRoomAt, type WalkIn, type WalkInRoom } from '../data/buildings'
import { reachRects, type Rect } from '../farm/layout'
import { farm, type Place } from '../farm/state'
import { useHome } from '../store'

// The map in the scene and what only one of the two has (src/scene/Maps.tsx shows one at a time, src/data/maps.ts): the
// house — its rooms, its walls, the plot round it — is on the home map only; the walk-in buildings, the lot and the land
// you own on the farm only. Anything that asks where you are (a room, outdoors, the space the action button reaches in,
// what is underfoot, the ground the camera and the walk-to keep to) asks here.

/** The map in the scene now (the farm until the scene has started: a new farm starts there). */
export const mapNow = (): Place => useHome.getState().map ?? 'farm'

/** The house is in the scene (the home map). */
export const houseHere = () => mapNow() === 'home'

/** Inside the house's walls (with `margin` metres round them), on the home map; never on the farm. */
export const inHouse = (x: number, z: number, margin = 0) => houseHere() && insideHouse(x, z, margin)

/** The house's room at a point, on the home map; never one on the farm. */
export const roomHere = (x: number, z: number): RoomId | null => (houseHere() ? roomAt(x, z) : null)

/** Which space a point is in, for the action button (src/lib/interaction.ts): at home a room of the house ('house' in
 *  its walls) or 'out' (its garden); on the farm a walk-in's room, the lane, or 'out' (the garden and the farm). */
export function spaceHere(x: number, z: number): string {
  if (houseHere()) return insideHouse(x, z) ? (roomAt(x, z) ?? 'house') : 'out'
  // (on the farm the house's ground is lawn like the rest)
  return insideHouse(x, z) ? 'out' : spaceAt(x, z)
}

/** A walk-in building's room at a point: on the farm only (the home map has none). */
export const walkInHere = (x: number, z: number): { walkIn: WalkIn; room: WalkInRoom } | null => (houseHere() ? null : walkInRoomAt(x, z))

const inArea = (a: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number) => x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ

/** What a walk-in building's floor sounds like underfoot. */
const WALK_IN_FLOOR: Record<WalkIn['floor'], FloorKind> = { tile: 'tile', boards: 'wood' }

/** What is underfoot: a room's floor, the paving round the house and the driveway, a walk-in's floor, or grass. */
export function floorHere(x: number, z: number): FloorKind {
  if (houseHere()) {
    const room = roomAt(x, z)
    if (room) return floorOf(farm.home.shell, room).kind
    return insideHouse(x, z, APRON) || inArea(DRIVE, x, z) ? 'tile' : 'grass'
  }
  const inside = walkInRoomAt(x, z)
  return inside ? WALK_IN_FLOOR[inside.walkIn.floor] : 'grass'
}

/** The ground you can be on, on the map in the scene: at home the plot inside its fence (the house on it); on the farm
 *  the land you own, the lot beyond the gate and the walk-in buildings (src/farm/layout.ts, reachRects). For the camera,
 *  the safety net and walking to a mark (src/scene/Player.tsx, src/lib/route). */
export const groundRects = (): Rect[] => (houseHere() ? [{ ...PLOT }] : reachRects(farm.layout))

/** All of it as one box. */
export function groundBounds(): Rect {
  const rs = groundRects()
  return { minX: Math.min(...rs.map((r) => r.minX)), maxX: Math.max(...rs.map((r) => r.maxX)), minZ: Math.min(...rs.map((r) => r.minZ)), maxZ: Math.max(...rs.map((r) => r.maxZ)) }
}

/** A key for the ground of the map in the scene: it changes when the map or the land you own does. */
export const groundKey = () => (houseHere() ? 'home' : `farm|${farm.layout.land.join(',')}`)
