// The kitchen garden in the south yard: what grows, what it sells for, and where everything stands.
// Units are metres and seconds (real time: crops keep growing while you are inside or away).
import { GATE, GARDEN, GARDEN_DOOR, LANE } from '../data/layout'

export type CropId = 'lettuce' | 'carrot' | 'strawberry' | 'tomato' | 'corn' | 'pumpkin'
export type ProduceId = CropId | 'lemon' | 'egg'

export interface CropDef {
  id: CropId
  name: string // singular, for "1 tomato"
  plural: string
  seedCost: number
  growSeconds: number
  yield: number // produce per harvest
  price: number // a fair price per piece; buyers offer around it
}

export const CROPS: CropDef[] = [
  { id: 'lettuce', name: 'lettuce', plural: 'lettuces', seedCost: 2, growSeconds: 45, yield: 4, price: 3 },
  { id: 'carrot', name: 'carrot', plural: 'carrots', seedCost: 2, growSeconds: 70, yield: 6, price: 2 },
  { id: 'strawberry', name: 'strawberry', plural: 'strawberries', seedCost: 4, growSeconds: 90, yield: 8, price: 2 },
  { id: 'tomato', name: 'tomato', plural: 'tomatoes', seedCost: 5, growSeconds: 120, yield: 8, price: 3 },
  { id: 'corn', name: 'corn cob', plural: 'corn cobs', seedCost: 5, growSeconds: 150, yield: 4, price: 6 },
  { id: 'pumpkin', name: 'pumpkin', plural: 'pumpkins', seedCost: 8, growSeconds: 200, yield: 2, price: 16 },
]
export const cropById = (id: CropId) => CROPS.find((c) => c.id === id)!

export interface ProduceDef {
  id: ProduceId
  name: string
  plural: string
  price: number
  maxAsk: number // the most a single buyer asks for
}

export const PRODUCE: ProduceDef[] = [
  ...CROPS.map((c) => ({ id: c.id, name: c.name, plural: c.plural, price: c.price, maxAsk: Math.max(2, Math.min(6, c.yield)) })),
  { id: 'lemon', name: 'lemon', plural: 'lemons', price: 2, maxAsk: 6 },
  { id: 'egg', name: 'egg', plural: 'eggs', price: 2, maxAsk: 6 },
]
export const produceById = (id: ProduceId) => PRODUCE.find((p) => p.id === id)!
export const count = (id: ProduceId, n: number) => `${n} ${n === 1 ? produceById(id).name : produceById(id).plural}`

/** Water lasts this share of a crop's growing time: plant (and water) once, water once more halfway. */
export const WATER_SHARE = 0.55

// ───────────────────────────── the yard ─────────────────────────────

/** The path runs straight out of the garden door; the beds line both sides of it. */
export const PATH_X = GARDEN_DOOR.centre
export const BED = { w: 1.7, d: 0.85, h: 0.36 } as const
const COL_W = PATH_X - 0.75 - BED.w / 2 // west column
const COL_E = PATH_X + 0.75 + BED.w / 2 // east column
const ROWS = [9.0, 10.3, 11.6]

export interface BedDef {
  index: number
  x: number
  z: number
  side: -1 | 1 // which side of the path it is on (the path is where you stand)
  price: number // 0: yours from the start; otherwise it has to be built
}

export const BEDS: BedDef[] = ROWS.flatMap((z, row) => [
  { index: row * 2, x: COL_W, z, side: -1 as const, price: row === 2 ? 30 : 0 },
  { index: row * 2 + 1, x: COL_E, z, side: 1 as const, price: row === 2 ? 30 : 0 },
])

export const START_COINS = 20

export const LEMON_TREE = { x: -6.1, z: 10.3, every: 30, max: 8 } as const

/** The coop sits in a fenced run in the east yard; its nest box sticks out through the run's west fence. */
export const RUN = { minX: 9.8, maxX: 13.4, minZ: 4.4, maxZ: 9.0 } as const
export const COOP = { x: 10.6, z: 5.7 } as const
export const NEST = { x: RUN.minX - 0.12, z: COOP.z } as const
export const EGG = { every: 40, max: 6, startHens: 2, maxHens: 4 } as const

export const SHED = { x: -9.0, z: 11.3 } as const
export const STAND = { x: GATE.x + 1.7, z: GARDEN.maxZ - 0.75 } as const

/** Buyers walk the lane, step up to the gate (outside it) and wait there. */
export const GATE_SPOT = { x: GATE.x, z: GARDEN.maxZ + 0.85 } as const
export const LANE_Z = LANE.z
export const LANE_ENDS = [-34, 34] as const
export const VISITOR = { firstAfter: 20, every: [35, 70] as [number, number], patience: 75, speed: 1.25 } as const

export interface Upgrade {
  id: 'sprinkler' | 'compost' | 'hen'
  name: string
  blurb: string
  price: number
}

export const UPGRADES: Upgrade[] = [
  { id: 'sprinkler', name: 'Sprinklers', blurb: 'Every bed waters itself.', price: 60 },
  { id: 'compost', name: 'Compost bin', blurb: 'Half as much again from every harvest.', price: 45 },
  { id: 'hen', name: 'Another hen', blurb: 'More eggs (up to four hens).', price: 25 },
]

export const NAMES = ['Maya', 'Noa', 'Daniel', 'Yael', 'Omer', 'Tamar', 'Eitan', 'Shira', 'Avi', 'Lior', 'Ruth', 'Yoni', 'Michal', 'Gal']
