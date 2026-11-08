// The farm around the house: what grows, what it makes, what it sells for, and where everything stands.
// Units are metres and seconds (real time: crops keep growing while you are inside or away).
import { GATE, GARDEN, GARDEN_DOOR, LANE } from '../data/layout'

export type CropId = 'lettuce' | 'carrot' | 'strawberry' | 'tomato' | 'corn' | 'pumpkin' | 'wheat' | 'sugarcane'
export type CakeId = 'lemon_cake' | 'strawberry_cake' | 'carrot_cake' | 'pumpkin_pie'
export type ProduceId = CropId | 'lemon' | 'egg' | 'milk' | 'wool' | 'sugar' | 'flour' | 'cloth' | CakeId

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
  { id: 'wheat', name: 'sheaf of wheat', plural: 'sheaves of wheat', seedCost: 2, growSeconds: 80, yield: 5, price: 2 },
  { id: 'sugarcane', name: 'sugar cane', plural: 'sugar canes', seedCost: 4, growSeconds: 140, yield: 6, price: 2 },
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
  { id: 'milk', name: 'bottle of milk', plural: 'bottles of milk', price: 4, maxAsk: 4 },
  { id: 'wool', name: 'fleece', plural: 'fleeces', price: 5, maxAsk: 3 },
  { id: 'sugar', name: 'bag of sugar', plural: 'bags of sugar', price: 5, maxAsk: 4 },
  { id: 'flour', name: 'bag of flour', plural: 'bags of flour', price: 4, maxAsk: 4 },
  { id: 'cloth', name: 'roll of cloth', plural: 'rolls of cloth', price: 15, maxAsk: 2 },
  { id: 'lemon_cake', name: 'lemon cake', plural: 'lemon cakes', price: 42, maxAsk: 1 },
  { id: 'strawberry_cake', name: 'strawberry cake', plural: 'strawberry cakes', price: 48, maxAsk: 1 },
  { id: 'carrot_cake', name: 'carrot cake', plural: 'carrot cakes', price: 40, maxAsk: 1 },
  { id: 'pumpkin_pie', name: 'pumpkin pie', plural: 'pumpkin pies', price: 50, maxAsk: 1 },
]
export const produceById = (id: ProduceId) => PRODUCE.find((p) => p.id === id)!
export const count = (id: ProduceId, n: number) => `${n} ${n === 1 ? produceById(id).name : produceById(id).plural}`

/** Water lasts this share of a crop's growing time: plant (and water) once, water once more halfway. */
export const WATER_SHARE = 0.55

// ───────────────────────────── the kitchen of the farm ─────────────────────────────

/** The mill presses sugar cane into sugar and grinds wheat into flour, one batch at a time. */
export const MILLABLE = { sugarcane: 'sugar', wheat: 'flour' } as const
export type MillInput = keyof typeof MILLABLE
export type MillOutput = (typeof MILLABLE)[MillInput]

export interface Recipe {
  id: CakeId
  name: string
  needs: Partial<Record<ProduceId, number>>
  seconds: number
}

/** What the oven bakes: worth about twice what goes into it. */
export const RECIPES: Recipe[] = [
  { id: 'lemon_cake', name: 'Lemon cake', needs: { flour: 1, sugar: 1, egg: 2, milk: 1, lemon: 2 }, seconds: 30 },
  { id: 'strawberry_cake', name: 'Strawberry cake', needs: { flour: 1, sugar: 1, egg: 2, milk: 1, strawberry: 4 }, seconds: 35 },
  { id: 'carrot_cake', name: 'Carrot cake', needs: { flour: 1, sugar: 1, egg: 2, carrot: 3 }, seconds: 35 },
  { id: 'pumpkin_pie', name: 'Pumpkin pie', needs: { flour: 1, sugar: 1, egg: 1, milk: 1, pumpkin: 1 }, seconds: 40 },
]
export const recipeById = (id: CakeId) => RECIPES.find((r) => r.id === id)!

// ───────────────────────────── the yard ─────────────────────────────

/** The path runs straight out of the garden door; the beds line both sides of it. */
export const PATH_X = GARDEN_DOOR.centre
export const BED = { w: 1.7, d: 0.85, h: 0.36 } as const
const COL_W = PATH_X - 0.75 - BED.w / 2 // west column
const COL_E = PATH_X + 0.75 + BED.w / 2 // east column
const COL_E2 = COL_E + BED.w + 0.9 // the east expansion, a narrow path further on
const ROWS = [9.0, 10.3, 11.6]

export type Expansion = 'east' | 'west'

export interface BedDef {
  index: number
  x: number
  z: number
  side: -1 | 1 // which side of its path it is on (the path is where you stand)
  price: number // a staked-out plot you build for this much (0: ready from the start)
  expansion?: Expansion // part of a piece of land you buy first
}

export const BEDS: BedDef[] = [
  ...ROWS.flatMap((z, row) => [
    { index: row * 2, x: COL_W, z, side: -1 as const, price: row === 2 ? 30 : 0 },
    { index: row * 2 + 1, x: COL_E, z, side: 1 as const, price: row === 2 ? 30 : 0 },
  ]),
  // more land: three beds east of the first ones, and a field in the west yard (seen from the living room)
  ...ROWS.map((z, row) => ({ index: 6 + row, x: COL_E2, z, side: 1 as const, price: 0, expansion: 'east' as const })),
  ...[2.8, 4.4].flatMap((z, row) => [
    { index: 9 + row * 2, x: -12.3, z, side: -1 as const, price: 0, expansion: 'west' as const },
    { index: 10 + row * 2, x: -9.6, z, side: 1 as const, price: 0, expansion: 'west' as const },
  ]),
]

export const EXPANSIONS: Record<Expansion, { name: string; blurb: string; price: number }> = {
  east: { name: 'East beds', blurb: 'Three more raised beds beside the first ones.', price: 60 },
  west: { name: 'West field', blurb: 'Four beds in the west yard, by the living-room window.', price: 120 },
}

export const START_COINS = 20

// The lemon tree, the hen run, the pasture and the sheep fold are movable (the edit mode): where each stands is
// in the farm's layout (src/farm/layout.ts), and what is inside them is given here in their own frame, round
// their middle (x across, z along; the frame turns with them). On a new farm they stand where they always have.

export const LEMON_TREE = { every: 30, max: 8 } as const

/** The coop sits in a fenced run (on a new farm, in the east yard); its nest box sticks out through the run's west fence. */
export const RUN = { minX: -1.8, maxX: 1.8, minZ: -2.3, maxZ: 2.3 } as const
export const COOP = { x: -1.0, z: -1.0 } as const
export const NEST = { x: RUN.minX - 0.12, z: COOP.z } as const
export const EGG = { every: 40, max: 6, startHens: 2, maxHens: 6 } as const

/** The cows' pasture (on a new farm along the east side of the house, north of the coop); its gate is on the west side. */
export const PASTURE = { minX: -2.15, maxX: 2.15, minZ: -6.5, maxZ: 6.5, gateZ: 2.5, gateWidth: 1.4 } as const
/** The pasture's water trough and hay rack, along its east side. */
export const TROUGH = { x: 1.65, z: 0.9 } as const
export const HAY_RACK = { x: 1.65, z: 4.5 } as const
export const COW = { every: 45, max: 3, startCows: 1, maxCows: 3, names: ['Bella', 'Mazal', 'Daisy'] } as const

/** The farm kitchen in the south-east corner: an outdoor brick oven and the mill, both facing the yard. */
export const OVEN = { x: 9.9, z: 11.75 } as const
export const MILL = { x: 12.3, z: 10.6, perItem: 4, capacity: 6 } as const

/** The sheep fold (on a new farm in the north yard, behind the house, where the office and kitchen windows look out on
 *  it); its gate is in the south fence, facing the house. */
export const FOLD = { minX: -4.3, maxX: 4.3, minZ: -1.85, maxZ: 1.85, gateX: 0, gateWidth: 1.3 } as const
export const SHEEP = { every: 60, max: 2, startSheep: 2, maxSheep: 4, names: ['Dolly', 'Pnina', 'Lulu', 'Tzipi'] } as const
/** The loom stands beside the fold, facing the house: fleeces go in, cloth comes out. */
export const LOOM = { x: 4.9, z: -10.3, perItem: 6, capacity: 4 } as const

export const SHED = { x: -9.0, z: 11.3 } as const
export const STAND = { x: GATE.x + 1.7, z: GARDEN.maxZ - 0.75 } as const

/** Buyers walk the lane and queue along the fence outside the gate; the first in line stands at the gate. */
export const GATE_SPOT = { x: GATE.x, z: GARDEN.maxZ + 0.85 } as const
export const LANE_Z = LANE.z
export const WALK_Z = LANE.z + 0.45 // the far side of the lane, where people walk past the queue
export const LANE_ENDS = [-34, 34] as const
export const VISITOR = { firstAfter: 20, speed: 1.25 } as const

/** The queue: five places and a new buyer every two minutes to begin with; up to fifteen places, and one every thirty seconds. */
export const QUEUE = { places: 5, maxPlaces: 15, every: 120, fastest: 30, step: 15, spacing: 0.85 } as const
export const QUEUE_LEVELS = QUEUE.maxPlaces - QUEUE.places
export const PACE_LEVELS = (QUEUE.every - QUEUE.fastest) / QUEUE.step
export const queuePlaces = (level: number) => QUEUE.places + level
export const arrivalEvery = (level: number) => QUEUE.every - QUEUE.step * level
/** Where the k-th in line stands, and which way they face (the first faces the gate, the rest look up the line). */
export function queueSpot(k: number) {
  return k === 0 ? { x: GATE_SPOT.x, z: GATE_SPOT.z, heading: Math.PI } : { x: GATE_SPOT.x + 0.25 + k * QUEUE.spacing, z: GATE_SPOT.z + 0.1, heading: -Math.PI / 2 - 0.35 }
}

export type UpgradeId = 'sprinkler' | 'compost' | 'hen' | 'cow' | 'sheep' | 'queue' | 'pace' | Expansion

export interface Upgrade {
  id: UpgradeId
  name: string
  blurb: string
  price: number // the first step, for upgrades bought one step at a time
  levels?: number // bought one step at a time, this many steps
  priceStep?: number // each step costs this much more than the one before
}

export const UPGRADES: Upgrade[] = [
  { id: 'east', name: EXPANSIONS.east.name, blurb: EXPANSIONS.east.blurb, price: EXPANSIONS.east.price },
  { id: 'west', name: EXPANSIONS.west.name, blurb: EXPANSIONS.west.blurb, price: EXPANSIONS.west.price },
  { id: 'queue', name: 'A longer queue', blurb: 'One more place in the line at the gate.', price: 30, levels: QUEUE_LEVELS, priceStep: 12 },
  { id: 'pace', name: 'A busier lane', blurb: 'Buyers come by more often.', price: 50, levels: PACE_LEVELS, priceStep: 25 },
  { id: 'cow', name: 'Another cow', blurb: 'More milk (up to three cows).', price: 70 },
  { id: 'sheep', name: 'Another sheep', blurb: 'More wool (up to four sheep).', price: 55 },
  { id: 'hen', name: 'Another hen', blurb: 'More eggs (up to six hens).', price: 25 },
  { id: 'sprinkler', name: 'Sprinklers', blurb: 'Every bed waters itself.', price: 60 },
  { id: 'compost', name: 'Compost bin', blurb: 'Half as much again from every harvest.', price: 45 },
]

export const NAMES = ['Maya', 'Noa', 'Daniel', 'Yael', 'Omer', 'Tamar', 'Eitan', 'Shira', 'Avi', 'Lior', 'Ruth', 'Yoni', 'Michal', 'Gal']
