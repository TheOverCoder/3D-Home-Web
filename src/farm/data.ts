// The farm around the house: what grows, what it makes, what it sells for, and where everything stands.
// Units are metres and seconds (real time: crops keep growing while you are inside or away).
import type { FarmSound } from '../audio/sound'
import { GATE, GARDEN, GARDEN_DOOR, LANE } from '../data/layout'
import type { PlaceId } from './layout'

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

/** What a machine makes (MACHINES, below): one batch takes `needs` and makes one `makes`, in `seconds`. */
export interface Recipe {
  /** its key: in the save, and in the id of its own offer on the button (farm-mill-wheat, farm-oven-lemon_cake) */
  id: string
  needs: Partial<Record<ProduceId, number>>
  makes: ProduceId
  seconds: number
}

/** What the oven bakes, one at a time: worth about twice what goes into it. */
export const RECIPES: Recipe[] = [
  { id: 'lemon_cake', needs: { flour: 1, sugar: 1, egg: 2, milk: 1, lemon: 2 }, makes: 'lemon_cake', seconds: 30 },
  { id: 'strawberry_cake', needs: { flour: 1, sugar: 1, egg: 2, milk: 1, strawberry: 4 }, makes: 'strawberry_cake', seconds: 35 },
  { id: 'carrot_cake', needs: { flour: 1, sugar: 1, egg: 2, carrot: 3 }, makes: 'carrot_cake', seconds: 35 },
  { id: 'pumpkin_pie', needs: { flour: 1, sugar: 1, egg: 1, milk: 1, pumpkin: 1 }, makes: 'pumpkin_pie', seconds: 40 },
]
/** What a recipe takes, when it takes one good (the mill's wheat, the loom's fleece). */
export const inputOf = (r: Recipe) => Object.keys(r.needs)[0] as ProduceId

export type MachineId = 'mill' | 'loom' | 'oven'

/** What a machine's button says, about `n` batches of a recipe (`left`: the time to go, as 1:05). */
export interface MachineWords {
  /** the word on the button, and on the card that asks before anything goes in (Bake, Mill, Weave) */
  word: string
  load: (r: Recipe, n: number) => string
  working: (r: Recipe, n: number, left: string) => string
  done: (r: Recipe, n: number) => string
  /** with nothing to load (`nearest`: the recipe nearest to ready) */
  idle: (nearest: Recipe) => string
  /** pressed while it works */
  busy: (r: Recipe, left: string) => string
}

/** Something that takes ingredients, works on them a while, then has what it made to take out: the mill, the loom and
 *  the oven. src/farm/state.ts runs them all the same way and src/farm/useMachine.ts puts them on the action button;
 *  everything that differs between them is here. */
export interface MachineDef {
  /** where it stands (it never moves) */
  x: number
  z: number
  /** round where it stands: where you stand near to use it, what you look at, and where the sparkles pop as you take
   *  out what it made; and how far off it is still in reach */
  stand: [number, number, number]
  aim: [number, number, number]
  sparkle: [number, number, number]
  reach: number
  /** how many batches it takes at once: as many as it has room for and the basket gives */
  capacity: number
  /** with more than one, each has its own offer on the button (a cake, wheat or cane) */
  recipes: Recipe[]
  words: MachineWords
  /** with nothing to load, its status shows this good and what it makes from what (the mill: flour from wheat, sugar
   *  from cane); without one, the recipe nearest to ready and what it still needs (the oven) */
  picture?: ProduceId
  /** as it is loaded, and now and then while it works (every `every` seconds and up to `spread` more, the first one
   *  that long after it is loaded) if you are near. Every machine dings as it is done, and rustles as you take out
   *  what it made. */
  sounds: { load: FarmSound; work?: { sound: FarmSound; every: number; spread: number } }
  /** what the farm's stats count of it, one for each batch taken out (the cakes baked) */
  counts?: 'baked'
}

export const MACHINES: Record<MachineId, MachineDef> = {
  // the farm kitchen is in the yard's south-east corner, facing the yard: the mill presses sugar cane into sugar and
  // grinds wheat into flour (each of the two is in reach on its own side: a little short of the 2.57 m between where
  // you stand at the mill and at the oven)
  mill: {
    x: 12.3,
    z: 10.6,
    stand: [-1.25, 1.0, 0],
    aim: [-0.15, 0.95, 0],
    sparkle: [-0.15, 1.07, 0],
    reach: 2.5,
    capacity: 6,
    recipes: [
      { id: 'sugarcane', needs: { sugarcane: 1 }, makes: 'sugar', seconds: 4 },
      { id: 'wheat', needs: { wheat: 1 }, makes: 'flour', seconds: 4 },
    ],
    picture: 'flour',
    words: {
      word: 'Mill',
      load: (r, n) => `Mill ${count(inputOf(r), n)}`,
      working: (r, n, left) => `Milling ${count(inputOf(r), n)} · ${left}`,
      done: (r, n) => `Collect ${count(r.makes, n)}`,
      idle: () => 'Mill · bring wheat for flour or sugar cane for sugar',
      busy: (_r, left) => `${left} to go`,
    },
    sounds: { load: 'creak', work: { sound: 'creak', every: 1.1, spread: 0.6 } },
  },
  // the loom stands beside the sheep fold, facing the house: fleeces go in, cloth comes out
  loom: {
    x: 4.9,
    z: -10.3,
    stand: [0, 1.0, 1.25],
    aim: [0, 0.95, 0.2],
    sparkle: [0, 1.05, 0.2],
    reach: 2.5,
    capacity: 4,
    recipes: [{ id: 'wool', needs: { wool: 1 }, makes: 'cloth', seconds: 6 }],
    picture: 'cloth',
    words: {
      word: 'Weave',
      load: (r, n) => `Weave ${count(inputOf(r), n)} into cloth`,
      working: (r, n, left) => `Weaving ${count(r.makes, n)} · ${left}`,
      done: (r, n) => `Take ${count(r.makes, n)} off the loom`,
      idle: () => 'Loom · shear the sheep for fleeces to weave',
      busy: (_r, left) => `${left} to go`,
    },
    sounds: { load: 'loom', work: { sound: 'loom', every: 1.4, spread: 0.5 } },
  },
  // beside the mill, the clay oven bakes one cake at a time from the farm's flour, sugar, eggs, milk and fruit
  oven: {
    x: 9.9,
    z: 11.75,
    stand: [-1.15, 1.0, 0],
    aim: [-0.72, 0.92, 0],
    sparkle: [-0.72, 1.04, 0],
    reach: 2.4,
    capacity: 1,
    recipes: RECIPES,
    words: {
      word: 'Bake',
      load: (r) => `Bake a ${produceById(r.makes).name}`,
      working: (r, _n, left) => `Baking a ${produceById(r.makes).name} · ready in ${left}`,
      done: (r) => `Take out the ${produceById(r.makes).name}`,
      idle: (nearest) => `Oven · a ${produceById(nearest.makes).name} needs`,
      busy: (r, left) => `The ${produceById(r.makes).name} needs ${left} more`,
    },
    sounds: { load: 'oven' },
    counts: 'baked',
  },
}
export const MACHINE_IDS = Object.keys(MACHINES) as MachineId[]

// ───────────────────────────── the yard ─────────────────────────────

/** The path runs straight out of the garden door; the beds line both sides of it. */
export const PATH_X = GARDEN_DOOR.centre
export const BED = { w: 1.7, d: 0.85, h: 0.36 } as const
/** A bed's frame on the ground, half its size each way: reach to a bed is measured from its edge. */
export const BED_BOX = { x: BED.w / 2 + 0.05, z: BED.d / 2 + 0.05 } as const
/** How far from a bed's edge you can work it (and every like bed this near is done in the same press): about a step
 *  and an arm. From its side as far as before (measured from its middle, its side was 1.57 m off); from its end
 *  0.35 m farther, and from a corner 0.5 m, where a reach round its middle fell short; from the path still the two
 *  rows either side of you. */
export const BED_REACH = 1.5
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

/** The coop sits in a fenced run (on a new farm, in the east yard); its nest box sticks out through the run's west fence. */
export const RUN = { minX: -1.8, maxX: 1.8, minZ: -2.3, maxZ: 2.3 } as const
export const COOP = { x: -1.0, z: -1.0 } as const
export const NEST = { x: RUN.minX - 0.12, z: COOP.z } as const

/** The cows' pasture (on a new farm along the east side of the house, north of the coop); its gate is on the west side. */
export const PASTURE = { minX: -2.15, maxX: 2.15, minZ: -6.5, maxZ: 6.5, gateZ: 2.5, gateWidth: 1.4 } as const
/** The pasture's water trough and hay rack, along its east side. */
export const TROUGH = { x: 1.65, z: 0.9 } as const
export const HAY_RACK = { x: 1.65, z: 4.5 } as const

/** The sheep fold (on a new farm in the north yard, behind the house, where the office and kitchen windows look out on
 *  it); its gate is in the south fence, facing the house. */
export const FOLD = { minX: -4.3, maxX: 4.3, minZ: -1.85, maxZ: 1.85, gateX: 0, gateWidth: 1.3 } as const

// ───────────────────────────── what fills up, and is collected ─────────────────────────────

export type ProducerId = 'tree' | 'hens' | 'cows' | 'sheep'

/** Something that fills up over time and is collected: the lemon tree, the hens' nest, each cow, each sheep.
 *  src/farm/state.ts runs them all the same way and src/farm/useProducer.ts puts them on the action button; everything
 *  that differs between them is here. */
export interface ProducerDef {
  /** what it gives */
  good: ProduceId
  /** one more every this many seconds */
  every: number
  /** the most that waits to be collected (on the tree, in the nest, on each animal): no more come until it is */
  max: number
  /** how many wait on a new farm (on each animal) */
  fresh: number
  /** collecting it leaves the clock running (the hens lay on); picking the lemons, milking a cow or shearing a sheep
   *  starts the wait for the next one again */
  keepsClock?: boolean
  /** a full one stops growing until it is taken: its clock holds at 0 (a full fleece) */
  holdsFull?: boolean
  /** its animals: how many on a new farm and at most. `shared`: they all lay into one nest, its clock running as many
   *  times as fast as there are hens; otherwise each animal has her own, and her name (on the button, and in the
   *  shop's note: "Bella joins the herd") */
  herd?: { start: number; max: number; shared?: boolean; names?: readonly string[]; joins?: string }
  /** the movable place it is in (src/farm/layout.ts) */
  place: PlaceId
  /** the button: its id (an animal's own ends in her number: farm-cow-0), its word and its verb's picture */
  action: string
  word: string
  verb: 'pick' | 'shear'
  /** where you stand near and what you look at, in its place's frame or round the animal; how far off it is in reach */
  stand: [number, number, number]
  aim: [number, number, number]
  reach: number
  /** the sound as it is taken, and how high its sparkles pop, over what you look at */
  sound: FarmSound
  sparkle: number
}

export const PRODUCERS: Record<ProducerId, ProducerDef> = {
  // the lemon tree keeps fruiting (the lemons hang in its crown, src/farm/Plants.tsx)
  tree: {
    good: 'lemon',
    every: 30,
    max: 8,
    fresh: 3,
    place: 'lemon',
    action: 'farm-lemon-tree',
    word: 'Pick',
    verb: 'pick',
    stand: [0, 1.0, 0],
    aim: [0, 1.6, 0],
    reach: 2.6,
    sound: 'harvest',
    sparkle: 1.6,
  },
  // the hens lay into the nest box, collected from outside the run
  hens: {
    good: 'egg',
    every: 40,
    max: 6,
    fresh: 1,
    keepsClock: true,
    herd: { start: 2, max: 6, shared: true },
    place: 'hens',
    action: 'farm-nest',
    word: 'Collect',
    verb: 'pick',
    stand: [NEST.x - 0.45, 0.9, NEST.z],
    aim: [NEST.x, 0.66, NEST.z],
    reach: 2.2,
    sound: 'cluck',
    sparkle: 0.78,
  },
  // each cow gives her own milk, wherever she has wandered to in the pasture
  cows: {
    good: 'milk',
    every: 45,
    max: 3,
    fresh: 1,
    herd: { start: 1, max: 3, names: ['Bella', 'Mazal', 'Daisy'], joins: 'the herd' },
    place: 'cows',
    action: 'farm-cow',
    word: 'Milk',
    verb: 'pick',
    stand: [0, 1, 0],
    aim: [0, 0.95, 0],
    reach: 2.7,
    sound: 'milk',
    sparkle: 1.55,
  },
  // and each sheep grows her own fleece, up to two before it stops
  sheep: {
    good: 'wool',
    every: 60,
    max: 2,
    fresh: 1,
    holdsFull: true,
    herd: { start: 2, max: 4, names: ['Dolly', 'Pnina', 'Lulu', 'Tzipi'], joins: 'the flock' },
    place: 'sheep',
    action: 'farm-sheep',
    word: 'Shear',
    verb: 'shear',
    stand: [0, 0.7, 0],
    aim: [0, 0.65, 0],
    reach: 2.4,
    sound: 'shear',
    sparkle: 1.0,
  },
}
export const PRODUCER_IDS = Object.keys(PRODUCERS) as ProducerId[]
/** The most animals a producer can have (none for the tree). */
export const mostAnimals = (id: ProducerId) => PRODUCERS[id].herd?.max ?? 0

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
  herd?: ProducerId // one more animal for this producer's herd, up to its most
}

export const UPGRADES: Upgrade[] = [
  { id: 'east', name: EXPANSIONS.east.name, blurb: EXPANSIONS.east.blurb, price: EXPANSIONS.east.price },
  { id: 'west', name: EXPANSIONS.west.name, blurb: EXPANSIONS.west.blurb, price: EXPANSIONS.west.price },
  { id: 'queue', name: 'A longer queue', blurb: 'One more place in the line at the gate.', price: 30, levels: QUEUE_LEVELS, priceStep: 12 },
  { id: 'pace', name: 'A busier lane', blurb: 'Buyers come by more often.', price: 50, levels: PACE_LEVELS, priceStep: 25 },
  { id: 'cow', name: 'Another cow', blurb: 'More milk (up to three cows).', price: 70, herd: 'cows' },
  { id: 'sheep', name: 'Another sheep', blurb: 'More wool (up to four sheep).', price: 55, herd: 'sheep' },
  { id: 'hen', name: 'Another hen', blurb: 'More eggs (up to six hens).', price: 25, herd: 'hens' },
  { id: 'sprinkler', name: 'Sprinklers', blurb: 'Every bed waters itself.', price: 60 },
  { id: 'compost', name: 'Compost bin', blurb: 'Half as much again from every harvest.', price: 45 },
]

export const NAMES = ['Maya', 'Noa', 'Daniel', 'Yael', 'Omer', 'Tamar', 'Eitan', 'Shira', 'Avi', 'Lior', 'Ruth', 'Yoni', 'Michal', 'Gal']
