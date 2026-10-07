// Single source of truth for the floor plan, spawn point, lamps, doors and pickups.
// Units are metres. +x is east, +z is south, -z is the back (north) wall.
// When a real `house.glb` is added, tune the coordinates here to match it.

export type RoomId = 'living' | 'office' | 'kitchen' | 'bedroom'
export type FloorKind = 'wood' | 'tile' | 'carpet'
export type Vec3 = [number, number, number]

export interface RoomDef {
  id: RoomId
  name: string
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
    bounds: { minX: -7, maxX: 0, minZ: -6, maxZ: 0 },
    floor: 'wood',
    floorTint: '#b99872',
    wall: '#d8d2c8',
  },
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen',
    bounds: { minX: 0, maxX: 7, minZ: -6, maxZ: 0 },
    floor: 'tile',
    floorTint: '#d9dcd8',
    wall: '#e4e7e2',
  },
  living: {
    id: 'living',
    name: 'Living room',
    bounds: { minX: -7, maxX: 0, minZ: 0, maxZ: 6 },
    floor: 'wood',
    floorTint: '#a8825a',
    wall: '#cfc9bf',
  },
  bedroom: {
    id: 'bedroom',
    name: 'Bedroom',
    bounds: { minX: 0, maxX: 7, minZ: 0, maxZ: 6 },
    floor: 'carpet',
    floorTint: '#8d8a86',
    wall: '#c9ced3',
  },
}

export function roomAt(x: number, z: number): RoomId | null {
  for (const room of Object.values(ROOMS)) {
    const b = room.bounds
    if (x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ) return room.id
  }
  return null
}

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
