import { describe, expect, it } from 'vitest'
import type { Rect } from '../data/buildings'
import { BAYS } from '../data/estate'
import { LANE_SOUTH, PARK_AREA } from '../data/lotPlan'
import { CAR_SPOT } from '../data/maps'
import { FARM_SUN_BOX, inBox } from '../data/sunBox'
import { CAR_SHAPE } from '../models/car'
import { LADDERS, PACE_LEVELS, QUEUE_LEVELS } from './data'
import { BY_CAR, CAR_COLOURS, MOST_CARS, PARK_BAYS, PARK_STAGES, TRAFFIC_MOST, YOUR_BAY, baysAt, byCar, carColour, parkCars, parkStage, trafficSteps, visitorBays, type Traffic } from './park'

// The car park's stages and bays (./park.ts, update-v1/missions/11-buildings.md): stages that only add, today's two bays
// first, a stage from the farm's own traffic, bays that hold a car each, outside the farm's sun box, and whose
// car is whose on dice of its own.

const EPS = 1e-9
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS
const within = (r: Rect, o: Rect) => r.x0 >= o.x0 - EPS && r.x1 <= o.x1 + EPS && r.z0 >= o.z0 - EPS && r.z1 <= o.z1 + EPS

/** A new farm's traffic, changed by `t`. */
const traffic = (t: Partial<Traffic> & { places?: number; group?: number; pace?: number; owned?: boolean } = {}): Traffic => ({
  queueLevel: t.queueLevel ?? 0,
  paceLevel: t.paceLevel ?? 0,
  ladders: { places: t.places ?? 0, group: t.group ?? 0, pace: t.pace ?? 0 },
  market: { owned: t.owned ?? false },
})
const TOP = traffic({ queueLevel: QUEUE_LEVELS, paceLevel: PACE_LEVELS, places: LADDERS.places.levels, group: LADDERS.group.levels, pace: LADDERS.pace.levels, owned: true })

describe('the stages', () => {
  it("stage 0 is today's: the two bays by the gate, your car in the east one", () => {
    expect(PARK_STAGES[0].bays).toEqual(BAYS)
    expect(baysAt(0)).toEqual(BAYS)
    const car = CAR_SPOT.farm
    const east = BAYS[1]
    expect(car.x > east.x0 && car.x < east.x1 && car.z > east.z0 && car.z < east.z1).toBe(true)
  })

  it('each stage only adds, and the last brings what the car park holds at its fullest', () => {
    for (let k = 1; k < PARK_STAGES.length; k++) {
      expect(baysAt(k).slice(0, baysAt(k - 1).length)).toEqual(baysAt(k - 1))
      expect(PARK_STAGES[k].bays.length + PARK_STAGES[k].adds.length, `stage ${k} adds something`).toBeGreaterThan(0)
    }
    expect(baysAt(PARK_STAGES.length - 1)).toEqual(PARK_BAYS)
    // as many bays beyond today's two as cars at once, and some to spare
    expect(PARK_BAYS.length - BAYS.length).toBeGreaterThanOrEqual(MOST_CARS)
    expect(new Set(PARK_STAGES.flatMap((s) => s.adds)).size, 'each piece added once').toBe(PARK_STAGES.flatMap((s) => s.adds).length)
  })

  it('a new farm is at stage 0; the shop yours at stage 2 or more; every ladder at its top the last stage', () => {
    expect(trafficSteps(traffic())).toBe(0)
    expect(parkStage(traffic())).toBe(0)
    expect(parkStage(traffic({ queueLevel: 6 }))).toBe(1)
    expect(parkStage(traffic({ owned: true }))).toBeGreaterThanOrEqual(2)
    // the shop's ladders count only once it is yours
    expect(trafficSteps(traffic({ places: 5, group: 2 }))).toBe(0)
    expect(trafficSteps(TOP)).toBe(TRAFFIC_MOST)
    expect(parkStage(TOP)).toBe(PARK_STAGES.length - 1)
    // every stage is reachable, and the stage never falls as the steps grow
    let last = 0
    for (let q = 0; q <= QUEUE_LEVELS; q++)
      for (let p = 0; p <= PACE_LEVELS; p++) {
        const s = parkStage(traffic({ queueLevel: q, paceLevel: p, owned: true, places: LADDERS.places.levels }))
        expect(s).toBeGreaterThanOrEqual(2)
        last = Math.max(last, s)
      }
    expect(last).toBe(PARK_STAGES.length - 1)
    for (let q = 0; q < QUEUE_LEVELS; q++) expect(parkStage(traffic({ queueLevel: q + 1 }))).toBeGreaterThanOrEqual(parkStage(traffic({ queueLevel: q })))
  })
})

describe('the bays', () => {
  it('none overlaps another', () => {
    for (let i = 0; i < PARK_BAYS.length; i++) for (let j = i + 1; j < PARK_BAYS.length; j++) expect(overlaps(PARK_BAYS[i], PARK_BAYS[j]), `bays ${i} and ${j}`).toBe(false)
  })

  it('each new one holds a car with 0.3 m to spare round it, in the car park, south of the lane', () => {
    for (const bay of PARK_BAYS.slice(BAYS.length)) {
      const long = Math.max(bay.x1 - bay.x0, bay.z1 - bay.z0)
      const short = Math.min(bay.x1 - bay.x0, bay.z1 - bay.z0)
      expect(long).toBeGreaterThanOrEqual(CAR_SHAPE.length + 0.6)
      expect(short).toBeGreaterThanOrEqual(CAR_SHAPE.width + 0.6)
      expect(within(bay, PARK_AREA), JSON.stringify(bay)).toBe(true)
      expect(bay.z0).toBeGreaterThanOrEqual(LANE_SOUTH)
    }
  })

  it('each new one lies outside the farm’s sun box, up to a car’s roof (a car there casts nothing)', () => {
    for (const bay of PARK_BAYS.slice(BAYS.length))
      for (const x of [bay.x0, bay.x1]) for (const z of [bay.z0, bay.z1]) for (const y of [0, CAR_SHAPE.height]) expect(inBox(x, y, z, FARM_SUN_BOX), `${x}, ${y}, ${z}`).toBe(false)
  })
})

describe('who came by car', () => {
  it('the same answer for an id every time, the ids of shoppers (below 0) and buyers alike', () => {
    for (const id of [1, 2, 3, 77, 1234, -101, -102, -9999]) for (const share of [0.25, 0.5]) expect(byCar(id, share)).toBe(byCar(id, share))
  })

  it('about its share of ids, and none or all at the ends', () => {
    for (const share of [BY_CAR.visit, BY_CAR.buyer, 0.3]) {
      let n = 0
      for (let id = 1; id <= 10_000; id++) if (byCar(id, share)) n++
      expect(Math.abs(n / 10_000 - share), `share ${share}`).toBeLessThan(0.02)
      // shoppers' ids count down from -101
      let m = 0
      for (let id = -101; id > -10_101; id--) if (byCar(id, share)) m++
      expect(Math.abs(m / 10_000 - share), `share ${share}, shoppers`).toBeLessThan(0.02)
    }
    for (let id = 1; id <= 100; id++) {
      expect(byCar(id, 0)).toBe(false)
      expect(byCar(id, 1)).toBe(true)
    }
  })

  it('a share is not a run: neighbouring ids do not all come by car, nor all on foot', () => {
    let longest = 0
    let run = 0
    let prev: boolean | null = null
    for (let id = 1; id <= 2000; id++) {
      const c = byCar(id, 0.5)
      run = c === prev ? run + 1 : 1
      prev = c
      longest = Math.max(longest, run)
    }
    expect(longest).toBeLessThan(20)
  })
})

describe('the cars of people about (mission 11 c8)', () => {
  const free = visitorBays(PARK_STAGES.length - 1)
  const never = () => false

  it('never your bay, never two cars in one bay, never more than MOST_CARS', () => {
    expect(free).not.toContain(YOUR_BAY)
    const many = Array.from({ length: 40 }, (_, k) => k + 1)
    const cars = parkCars(new Map(), many, free, never)
    expect(cars.size).toBe(Math.min(MOST_CARS, free.length))
    expect(new Set(cars.values()).size).toBe(cars.size)
    // the first to come take the first bays, in order
    expect([...cars.keys()].slice(0, 3)).toEqual([1, 2, 3])
    expect(cars.get(1)).toBe(free[0])
  })

  it('a car comes only to a bay out of view, and goes only from one out of view; each keeps its bay', () => {
    const seen = new Set([free[0]])
    const inView = (b: number) => seen.has(b)
    // the bay in view is passed over: the first comes to the next
    const one = parkCars(new Map(), [7], free, inView)
    expect(one.get(7)).toBe(free[1])
    // its person gone while its bay is in view: it stays; once out of view, it goes
    const stays = parkCars(new Map([[7, free[0]]]), [], free, inView)
    expect(stays.get(7)).toBe(free[0])
    expect(parkCars(new Map([[7, free[0]]]), [], free, never).size).toBe(0)
    // someone still about keeps their bay, whoever else comes
    const kept = parkCars(new Map([[9, free[3]]]), [5, 9], free, never)
    expect(kept.get(9)).toBe(free[3])
    expect(kept.get(5)).toBe(free[0])
  })

  it('a bay closed (a smaller stage) holds no car; colours come from the person', () => {
    expect(visitorBays(0)).toEqual([])
    const small = visitorBays(1)
    expect(parkCars(new Map([[3, free[free.length - 1]]]), [3], small, never).get(3)).toBe(small[0])
    for (let id = -50; id < 50; id++) expect(CAR_COLOURS).toContain(carColour(id))
    expect(carColour(12)).toBe(carColour(12))
  })
})
