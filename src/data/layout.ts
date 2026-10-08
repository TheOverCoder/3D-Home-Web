// Single source of truth for the floor plan, spawn point, lamps, doors and pickups.
// Units are metres. +x is east, +z is south, -z is the back (north) wall.
// When a real `house.glb` is added, tune the coordinates here to match it.

export type RoomId = 'living' | 'office' | 'kitchen' | 'bedroom'
export type FloorKind = 'wood' | 'tile' | 'carpet'
export type Vec3 = [number, number, number]

export interface Mood {
  ceiling: number // intensity of the room's downlight (candela)
  color: string // its colour temperature
}

export interface RoomDef {
  id: RoomId
  name: string
  mood: Mood
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  floor: FloorKind
  floorTint: string
  wall: string
}

export const HOUSE = {
  minX: -7,
  maxX: 7,
  minZ: -6,
  maxZ: 6,
  wallHeight: 2.9,
  wallThickness: 0.16,
  doorHeight: 2.1,
} as const

export const ROOMS: Record<RoomId, RoomDef> = {
  office: {
    id: 'office',
    name: 'Studio',
    mood: { ceiling: 9, color: '#eef1ff' }, // cooler, brighter: a place to work
    bounds: { minX: -7, maxX: 0, minZ: -6, maxZ: 0 },
    floor: 'wood',
    floorTint: '#b99872',
    wall: '#e2dccf',
  },
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen',
    mood: { ceiling: 11, color: '#fff3df' },
    bounds: { minX: 0, maxX: 7, minZ: -6, maxZ: 0 },
    floor: 'tile',
    floorTint: '#d9dcd8',
    wall: '#eef0ea',
  },
  living: {
    id: 'living',
    name: 'Living room',
    mood: { ceiling: 5, color: '#ffd7a6' }, // warm and low, the lamps do the work
    bounds: { minX: -7, maxX: 0, minZ: 0, maxZ: 6 },
    floor: 'wood',
    floorTint: '#a8825a',
    wall: '#e0d8c9',
  },
  bedroom: {
    id: 'bedroom',
    name: 'Bedroom',
    mood: { ceiling: 4, color: '#ffcf98' },
    bounds: { minX: 0, maxX: 7, minZ: 0, maxZ: 6 },
    floor: 'carpet',
    floorTint: '#8d8a86',
    wall: '#d9dfe4',
  },
}

/** Rooms that share a doorway: their light bleeds into each other. */
export const ADJACENT: [RoomId, RoomId][] = [
  ['living', 'office'],
  ['office', 'kitchen'],
  ['kitchen', 'bedroom'],
  ['living', 'bedroom'],
]

export function roomAt(x: number, z: number): RoomId | null {
  for (const room of Object.values(ROOMS)) {
    const b = room.bounds
    if (x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ) return room.id
  }
  return null
}

export interface WindowDef {
  id: string
  axis: 'x' | 'z' // the wall runs along this axis (x: wall at z = at, z: wall at x = at)
  at: number
  centre: number
  width: number
  sill: number
  top: number
}

// Windows sit in exterior walls only. The sun comes from the south-east, so the south and east walls
// let direct light in; the others give soft daylight.
export const WINDOWS: WindowDef[] = [
  { id: 'win-living-south', axis: 'x', at: 6, centre: -1.2, width: 1.5, sill: 0.9, top: 2.2 },
  { id: 'win-living-west', axis: 'z', at: -7, centre: 1.9, width: 1.4, sill: 0.9, top: 2.2 },
  { id: 'win-bedroom-south', axis: 'x', at: 6, centre: 1.7, width: 1.4, sill: 0.9, top: 2.2 },
  { id: 'win-bedroom-east', axis: 'z', at: 7, centre: 5.0, width: 1.3, sill: 0.9, top: 2.2 },
  { id: 'win-kitchen-east', axis: 'z', at: 7, centre: -2.6, width: 1.6, sill: 0.9, top: 2.2 },
  { id: 'win-kitchen-north', axis: 'x', at: -6, centre: 5.0, width: 0.9, sill: 1.2, top: 2.2 },
  { id: 'win-office-north', axis: 'x', at: -6, centre: -5.6, width: 1.2, sill: 1.0, top: 2.2 },
  { id: 'win-office-west', axis: 'z', at: -7, centre: -4.9, width: 1.3, sill: 0.9, top: 2.2 },
]

/** Direction of the sun (towards it). Drives both the light and the sky. */
export const SUN: Vec3 = [12, 9, 10]

export const SPAWN: Vec3 = [-3.5, 1.4, 1.3]

// Doorways: [centre, width]. Gaps are cut into the interior walls.
export const DOORWAYS = {
  // wall z = 0 (runs along x)
  livingOffice: { axis: 'x', at: 0, centre: -3.5, width: 1.6 },
  kitchenBedroom: { axis: 'x', at: 0, centre: 3.5, width: 1.6 },
  // wall x = 0 (runs along z)
  officeKitchen: { axis: 'z', at: 0, centre: -3, width: 1.6 },
  livingBedroom: { axis: 'z', at: 0, centre: 3, width: 1.6 },
} as const

// The one animated door (kitchen <-> bedroom). Hinge is on the west jamb.
export const DOOR = {
  id: 'door-kitchen-bedroom',
  hinge: [2.7, 0, 0] as Vec3,
  width: 1.6,
  height: 2.1,
  thickness: 0.06,
  openAngle: Math.PI / 2, // swings into the bedroom (towards +z)
}

export interface LampDef {
  id: string
  room: RoomId
  position: Vec3 // where the light sits
  kind: 'floor' | 'desk' | 'bedside' | 'counter'
}

export const LAMPS: LampDef[] = [
  { id: 'lamp-floor', room: 'living', position: [-6.3, 1.55, 0.9], kind: 'floor' },
  { id: 'lamp-desk', room: 'office', position: [-4.3, 1.1, -5.35], kind: 'desk' },
  { id: 'lamp-counter', room: 'kitchen', position: [1.5, 1.25, -5.58], kind: 'counter' },
  { id: 'lamp-bedside', room: 'bedroom', position: [3.35, 0.95, 5.6], kind: 'bedside' },
]

export interface PickupDef {
  id: string
  name: string
  kind: 'mug' | 'book' | 'gift'
  position: Vec3
}

export const PICKUPS: PickupDef[] = [
  { id: 'item-mug', name: 'coffee mug', kind: 'mug', position: [3.9, 1.0, -2.4] },
  { id: 'item-book', name: 'notebook', kind: 'book', position: [-2.9, 0.82, -5.2] },
  { id: 'item-gift', name: 'gift box', kind: 'gift', position: [4.6, 0.75, 4.2] },
]
