import type { Rect } from '../data/buildings'
import { BAYS } from '../data/estate'
import { PARK_AREA } from '../data/lot'
import { LADDERS, PACE_LEVELS, QUEUE_LEVELS } from './data'

// The car park beyond the lane (update-v1/missions/11-buildings.md c7, c8): it grows in stages with the farm's
// traffic — the steps bought for the line at the gate and for your shop — and the people about who came by car have
// their cars in its bays. Pure: nothing here is saved (a stage is worked out from the farm's own numbers, and whose car
// stands where is the scene's, from the people about: src/farm/Park.tsx).

/** A bay's size in the car park's rows (a car is 3.5 × 1.62 m: src/models/car.ts, CAR_SHAPE). */
export const BAY = { width: 2.4, depth: 4.5 } as const
/** How many bays a row holds, along the lane from the car park's west end (a walkway left at its east end). */
const PER_ROW = 7
/** The car park's two rows across one aisle: the first along the lane (a kerb's width in from its edge), the second
 *  along the car park's far side. */
const KERB = 0.3
const ROW_A_Z = PARK_AREA.z0 + KERB
const ROW_B_Z = PARK_AREA.z1 - BAY.depth

const row = (z0: number): Rect[] => Array.from({ length: PER_ROW }, (_, k) => ({ x0: PARK_AREA.x0 + k * BAY.width, x1: PARK_AREA.x0 + (k + 1) * BAY.width, z0, z1: z0 + BAY.depth }))

/** What a stage adds to the car park's look (the model draws each). */
export type ParkPiece = 'asphalt' | 'kerbs' | 'sign' | 'lamps' | 'planters' | 'shelter' | 'crossing'

/** A stage: when it is reached (`steps` of traffic, or the shop being yours), the bays it adds and what else. */
export interface ParkStage {
  from: { steps: number } | { shop: true }
  bays: readonly Rect[]
  adds: readonly ParkPiece[]
}

/** The stages, in order; each adds to all before it. Stage 0 is today's: the two bays by the gate, your car in the east
 *  one (src/data/maps.ts, CAR_SPOT). */
export const PARK_STAGES: readonly ParkStage[] = [
  { from: { steps: 0 }, bays: BAYS, adds: [] },
  { from: { steps: 6 }, bays: row(ROW_A_Z), adds: ['asphalt', 'kerbs', 'sign'] },
  { from: { shop: true }, bays: row(ROW_B_Z), adds: ['lamps'] },
  { from: { steps: 24 }, bays: [], adds: ['planters', 'shelter', 'crossing'] },
]

/** Every bay, in the order the stages add them (a person by car takes the first free one). */
export const PARK_BAYS: readonly Rect[] = PARK_STAGES.flatMap((s) => s.bays)

/** The most cars of people about at once (shoppers' visits and buyers in the line who came by car), as play can reach
 *  it: to be measured by playing for hours once the cars come (as MOST_INSIDE is), never more than the bays beyond
 *  today's two. */
export const MOST_CARS = 12

/** The share of the shop's visits that come by car (one car a visit), and of the line's buyers. */
export const BY_CAR = { visit: 0.5, buyer: 0.5 } as const

/** What the car park's stage is worked out from: the line's places and pace bought, and your shop with its ladders. */
export interface Traffic {
  queueLevel: number
  paceLevel: number
  ladders: { places: number; group: number; pace: number }
  market: { owned: boolean }
}

/** Owning the shop counts as this many steps. */
const SHOP_STEPS = 4

/** The steps of traffic: each bought on the line's `queue` and `pace` and the shop's `places`, `group` and `pace`
 *  ladders (the shop's only once it is yours), and the shop itself. */
export const trafficSteps = (t: Traffic): number => t.queueLevel + t.paceLevel + (t.market.owned ? SHOP_STEPS + t.ladders.places + t.ladders.group + t.ladders.pace : 0)

/** The most steps there are (every ladder at its top). */
export const TRAFFIC_MOST = QUEUE_LEVELS + PACE_LEVELS + SHOP_STEPS + LADDERS.places.levels + LADDERS.group.levels + LADDERS.pace.levels

const reached = (s: ParkStage, t: Traffic) => ('shop' in s.from ? t.market.owned : trafficSteps(t) >= s.from.steps)

/** The car park's stage: the last one reached (a later one reached first brings those before it). */
export function parkStage(t: Traffic): number {
  let stage = 0
  PARK_STAGES.forEach((s, k) => {
    if (reached(s, t)) stage = k
  })
  return stage
}

/** The bays there are at a stage. */
export const baysAt = (stage: number): readonly Rect[] => PARK_STAGES.slice(0, Math.max(0, stage) + 1).flatMap((s) => s.bays)

/** Whether the person with this id came by car, on dice of its own (the same answer for an id every time, so a
 *  reload of the line keeps whose car is whose, and nothing is saved): true for about `share` of ids. */
export function byCar(id: number, share: number): boolean {
  // an integer hash of the id (a few rounds of multiply and xor-shift), as a number in [0, 1)
  let h = Math.imul(id | 0, 0x9e3779b1) ^ 0x85ebca6b
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296 < share
}

// ───────────────────────────── the cars of people about ─────────────────────────────

/** The bay your own car stands in (the gate's east bay): never a visitor's. */
export const YOUR_BAY = 1

/** The bays a visitor's car may stand in at a stage, by their index in PARK_BAYS: the car park's (the gate's two are
 *  yours and kept free; the car park lies outside the sun's box, so a visitor's car casts nothing there and keeps its
 *  soft shadow). */
export const visitorBays = (stage: number): number[] =>
  baysAt(stage)
    .map((_, k) => k)
    .filter((k) => k >= PARK_STAGES[0].bays.length && k !== YOUR_BAY)

/**
 * Which bay each car stands in, from the last frame's (`prev`: a person's id → a bay's index): the people about who
 * came by car (`wanted`, in the order they came) each keep theirs; one newly come takes the first free bay of `free`
 * (in order) while it is out of the camera's view, else walks from the lane's end as everyone did before; a car whose
 * person has gone stays until its bay is out of view. Never two cars in one bay, never more than MOST_CARS, and nothing
 * comes or goes where it can be seen.
 */
export function parkCars(prev: ReadonlyMap<number, number>, wanted: readonly number[], free: readonly number[], inView: (bay: number) => boolean): Map<number, number> {
  const want = new Set(wanted)
  const out = new Map<number, number>()
  for (const [id, bay] of prev) if (free.includes(bay) && (want.has(id) || inView(bay))) out.set(id, bay)
  const used = new Set(out.values())
  for (const id of wanted) {
    if (out.size >= MOST_CARS) break
    if (out.has(id)) continue
    const bay = free.find((b) => !used.has(b) && !inView(b))
    if (bay === undefined) continue
    out.set(id, bay)
    used.add(bay)
  }
  return out
}

/** The colours people's cars come in (a car's colour is its person's, by their id). */
export const CAR_COLOURS = ['#d4402f', '#3b5f8a', '#e8eef5', '#2f3b33', '#e9b824', '#6d8f3a', '#9eacb8', '#7a3b52'] as const
export const carColour = (id: number) => CAR_COLOURS[Math.abs(Math.imul(id | 0, 0x9e3779b1) >>> 7) % CAR_COLOURS.length]
