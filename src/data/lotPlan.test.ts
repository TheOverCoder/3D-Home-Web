import { describe, expect, it } from 'vitest'
import { bounds, type Rect, type WalkIn } from './buildings'
import { ESTATE_DOOR, ESTATE_PATH, ESTATE_WALKIN } from './estate'
import { BACK, FRONT_DOOR, HALL, MARKET_PATH, MARKET_WALKIN } from './market'
import { ARRIVE, CAR_SPOT } from './maps'
import {
  BACK_PLANNED,
  CABIN_PLANNED,
  DEALER_FORECOURT_PLANNED,
  DISPLAY_BAYS_PLANNED,
  ESTATE_PLANNED,
  ESTATE_ROOM_PLANNED,
  HALL_PLANNED,
  LANE_SOUTH,
  LOT_PLANNED,
  MARKET_PLANNED,
  PARK_AREA,
  WALK_INS_PLANNED,
} from './lotPlan'
import { FARM_SUN_BOX, inBox } from './sunBox'
import { SUN_MARGIN, cornerMargins, roomMargins } from './sunCheck'
import { QUEUE, WALK_Z, queueSpot } from '../farm/data'
import { CAR_SHAPE, carHalf } from '../models/car'

// The lot as update-v1/missions/11-buildings.md plans it (src/data/lotPlan.ts), held to the rules today's rows keep before
// any of it is drawn: against the farm's sun box every floor and every sunward wall's inside up to its roof, the
// cabin and the cars for sale inside it, the car park wholly outside it; nothing overlapping; today's doors, ways in and
// car where they are; each walk-in a building its poses can be made from (one outer door, every room reached).

const BOX = FARM_SUN_BOX
const EPS = 1e-9
const area = (r: Rect) => (r.x1 - r.x0) * (r.z1 - r.z0)
const inRect = (r: Rect, x: number, z: number) => x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS
/** Overlapping, not only touching. */
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS
const touches = (a: Rect, b: Rect) => a.x0 <= b.x1 + EPS && a.x1 >= b.x0 - EPS && a.z0 <= b.z1 + EPS && a.z1 >= b.z0 - EPS
const onLot = (x: number, z: number) => LOT_PLANNED.some((r) => inRect(r, x, z))
const inAnyRoom = (x: number, z: number) => WALK_INS_PLANNED.some((w) => w.rooms.some((r) => inRect(r, x, z)))
/** Points every half metre over a rectangle, its edges included. */
function grid(r: Rect): [number, number][] {
  const out: [number, number][] = []
  const nx = Math.ceil((r.x1 - r.x0) / 0.5)
  const nz = Math.ceil((r.z1 - r.z0) / 0.5)
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) out.push([r.x0 + ((r.x1 - r.x0) * i) / nx, r.z0 + ((r.z1 - r.z0) * j) / nz])
  return out
}

describe('the planned lot against the farm’s sun box', () => {
  for (const w of WALK_INS_PLANNED)
    for (const room of w.rooms)
      it(`${w.id}, ${room.space}: its floor, and the inside of its west and north walls up to its roof`, () => {
        for (const p of roomMargins(room, w.roof.y, BOX)) expect(p.margin, `${room.space} ${p.what} at ${p.x}, ${p.y}, ${p.z}: ${p.margin.toFixed(3)} m inside`).toBeGreaterThanOrEqual(SUN_MARGIN)
      })

  it("the contractor's cabin and the dealer's cars for sale: their footprints on the ground and at their tops", () => {
    for (const p of cornerMargins(CABIN_PLANNED, [0, CABIN_PLANNED.y1], BOX)) expect(p.margin, `cabin ${p.x}, ${p.y}, ${p.z}`).toBeGreaterThanOrEqual(SUN_MARGIN)
    for (const bay of DISPLAY_BAYS_PLANNED) for (const p of cornerMargins(bay, [0, CAR_SHAPE.height], BOX)) expect(p.margin, `bay ${p.x}, ${p.y}, ${p.z}`).toBeGreaterThanOrEqual(SUN_MARGIN)
  })

  it('the car park lies wholly outside it, half a metre clear, up to a car’s roof (its cars cast nothing)', () => {
    for (const [x, z] of grid(PARK_AREA)) for (const y of [0, CAR_SHAPE.height]) expect(inBox(x, y, z, BOX, -0.5), `${x}, ${y}, ${z}`).toBe(false)
  })

  it('your car in its bay by the gate is inside it, as it is in today’s', () => {
    const c = CAR_SPOT.farm
    const h = carHalf(c.heading)
    for (const p of cornerMargins({ x0: c.x - h.x, x1: c.x + h.x, z0: c.z - h.z, z1: c.z + h.z }, [0, CAR_SHAPE.height], BOX)) expect(p.margin).toBeGreaterThanOrEqual(SUN_MARGIN)
  })
})

describe('the planned lot on the ground', () => {
  const standing: { name: string; r: Rect }[] = [
    ...WALK_INS_PLANNED.map((w) => ({ name: w.id, r: bounds(w) })),
    { name: 'the cabin', r: CABIN_PLANNED },
    { name: 'the car park', r: PARK_AREA },
    { name: "the dealer's forecourt", r: DEALER_FORECOURT_PLANNED },
  ]

  it('nothing overlaps anything else', () => {
    for (let i = 0; i < standing.length; i++) for (let j = i + 1; j < standing.length; j++) expect(overlaps(standing[i].r, standing[j].r), `${standing[i].name} and ${standing[j].name}`).toBe(false)
  })

  it('the buildings, the cabin and the car park stand south of the lane; the forecourt between the fence and the walkers', () => {
    for (const s of standing.filter((s) => s.name !== "the dealer's forecourt")) expect(s.r.z0, s.name).toBeGreaterThanOrEqual(LANE_SOUTH - EPS)
    expect(DEALER_FORECOURT_PLANNED.z1).toBeLessThanOrEqual(WALK_Z - 0.2 + EPS)
    // east of the buyers' line at its longest
    expect(DEALER_FORECOURT_PLANNED.x0).toBeGreaterThan(queueSpot(QUEUE.maxPlaces - 1).x + 0.5)
    for (const bay of DISPLAY_BAYS_PLANNED) {
      expect(touches(bay, DEALER_FORECOURT_PLANNED) && bay.x0 >= DEALER_FORECOURT_PLANNED.x0 && bay.x1 <= DEALER_FORECOURT_PLANNED.x1).toBe(true)
      // a car lengthwise along it, with room round it
      expect(bay.x1 - bay.x0).toBeGreaterThanOrEqual(CAR_SHAPE.length + 0.4)
      expect(bay.z1 - bay.z0).toBeGreaterThanOrEqual(CAR_SHAPE.width + 0.2)
    }
  })

  it('no wall stands on a room’s floor, and every wall is closed (a box of some size)', () => {
    for (const w of WALK_INS_PLANNED)
      for (const b of w.walls) {
        expect(b.x1 > b.x0 && b.z1 > b.z0 && b.y1 > b.y0, `${w.id} wall ${JSON.stringify(b)}`).toBe(true)
        for (const room of w.rooms) expect(overlaps(b, room), `${w.id}: a wall on ${room.space}`).toBe(false)
      }
  })

  it('each walk-in has one outer door, every room is reached through a door, and the spaces are today’s names and one new', () => {
    for (const w of WALK_INS_PLANNED) {
      let outer = 0
      const reached = new Set<string>()
      for (const d of w.doors) {
        const x = (d.x0 + d.x1) / 2
        const z = (d.z0 + d.z1) / 2
        const [nx, nz] = d.x1 - d.x0 >= d.z1 - d.z0 ? [0, 1] : [1, 0]
        const sides = [1, -1].map((s) => w.rooms.find((r) => inRect(r, x + nx * s * 0.5, z + nz * s * 0.5)))
        for (const r of sides) if (r) reached.add(r.space)
        if (sides.filter(Boolean).length === 1) outer++
      }
      expect(outer, `${w.id}: outer doors`).toBe(1)
      expect([...reached].sort(), `${w.id}: rooms reached`).toEqual(w.rooms.map((r) => r.space).sort())
    }
    const spaces = WALK_INS_PLANNED.flatMap((w) => w.rooms.map((r) => r.space))
    expect(new Set(spaces).size).toBe(spaces.length)
    expect(spaces).toEqual(expect.arrayContaining([...MARKET_WALKIN.rooms, ...ESTATE_WALKIN.rooms].map((r) => r.space)))
    expect(WALK_INS_PLANNED.map((w) => w.id)).toEqual(expect.arrayContaining([MARKET_WALKIN.id, ESTATE_WALKIN.id]))
  })

  it("today's doors, ways in and car are where they are", () => {
    expect(MARKET_PLANNED.doors).toContainEqual(FRONT_DOOR)
    expect(MARKET_PLANNED.autoDoor).toEqual(MARKET_WALKIN.autoDoor)
    expect(ESTATE_PLANNED.doors).toContainEqual(ESTATE_DOOR)
    expect(ESTATE_PLANNED.autoDoor).toEqual(ESTATE_WALKIN.autoDoor)
    // the way in: on the lot outside, in the room inside
    for (const [path, room] of [
      [MARKET_PATH, HALL_PLANNED],
      [ESTATE_PATH, ESTATE_ROOM_PLANNED],
    ] as const) {
      expect(onLot(path[0].x, path[0].z) && !inAnyRoom(path[0].x, path[0].z)).toBe(true)
      expect(onLot(path[1].x, path[1].z) && !inAnyRoom(path[1].x, path[1].z)).toBe(true)
      expect(inRect(room, path[2].x, path[2].z)).toBe(true)
    }
    for (const s of [CAR_SPOT.farm, ARRIVE.farm]) {
      expect(onLot(s.x, s.z), `${s.x}, ${s.z} on the lot`).toBe(true)
      for (const w of WALK_INS_PLANNED) expect(inRect(bounds(w), s.x, s.z), `${s.x}, ${s.z} clear of ${w.id}`).toBe(false)
    }
  })

  it('the lot is one piece: every part of it touches the lane or another part; the car park and the forecourts are on it', () => {
    const [lane, ...rest] = LOT_PLANNED
    for (const r of rest) expect(touches(r, lane) || rest.some((o) => o !== r && touches(r, o))).toBe(true)
    expect(LOT_PLANNED).toContainEqual(PARK_AREA)
    expect(inRect(lane, DEALER_FORECOURT_PLANNED.x0, DEALER_FORECOURT_PLANNED.z0) && inRect(lane, DEALER_FORECOURT_PLANNED.x1, DEALER_FORECOURT_PLANNED.z1)).toBe(true)
    // the cabin stands in the contractor's corner, open on the side of its window (east)
    expect(LOT_PLANNED.some((r) => inRect(r, CABIN_PLANNED.x1 + 0.45, (CABIN_PLANNED.z0 + CABIN_PLANNED.z1) / 2))).toBe(true)
  })

  it('bigger with room to spare: the market over twice today’s floor, the office over four times; at most 4 lights in all', () => {
    const floor = (w: WalkIn) => w.rooms.reduce((a, r) => a + area(r), 0)
    expect(floor(MARKET_PLANNED)).toBeGreaterThan(2 * (area(HALL) + area(BACK)))
    expect(area(BACK_PLANNED)).toBeGreaterThan(2 * area(BACK))
    // (the office is built: its room before, 2.2 m by 1.97 m)
    expect(area(ESTATE_ROOM_PLANNED)).toBeGreaterThan(4 * 2.2 * 1.97)
    expect(WALK_INS_PLANNED.reduce((n, w) => n + w.lights.length, 0)).toBeLessThanOrEqual(4)
    for (const w of WALK_INS_PLANNED)
      for (const l of w.lights) {
        expect(inRect(bounds(w), l.x, l.z), `${w.id}: its light in it`).toBe(true)
        expect(l.y).toBeLessThan(w.roof.y)
      }
  })
})
