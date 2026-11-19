import { describe, expect, it } from 'vitest'
import { WALK_INS, bounds, spaceAt, type Rect } from './buildings'
import { ESTATE_DOOR } from './estate'
import { LANE } from './layout'
import { CORNER_SOUTH, LANE_NORTH, LANE_SOUTH, LOT, LOT_EAST, LOT_ROWS, MARKET_FACES, PARK_AREA, lotRowAt, onLot, type LotRowId } from './lot'
import { CABIN, CONTRACTOR_STAND, FRONT_DOOR, HALL, LOT as MARKET_LOT, MARKET_PATH, MARKET_WALKIN } from './market'
import { ARRIVE, CAR_SPOT } from './maps'

// The lot as rows (./lot.ts): the ground outside the garden you can walk on, each piece named, as it was before it had
// names; the lines it meets the market's walls on are the market's walls; one piece of ground, every outer door of a
// walk-in opening onto it, no row on a room's floor.

const EPS = 1e-9
const inRect = (r: Rect, x: number, z: number) => x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS
const touches = (a: Rect, b: Rect) => a.x0 <= b.x1 + EPS && a.x1 >= b.x0 - EPS && a.z0 <= b.z1 + EPS && a.z1 >= b.z0 - EPS
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS

describe('the lot’s rows', () => {
  it('are the ground the lot always was: the lane’s strip, the market’s forecourt, the contractor’s corner', () => {
    // (the market's bigger hall, mission 11 c4: its east wall and the cabin further east, the lot to the dealer's wall)
    // (the lane reaches the car park's west end, mission 11 c7)
    expect(LOT_ROWS.lane).toEqual({ x0: PARK_AREA.x0, x1: 19.25, z0: 13, z1: 16.3 })
    expect(LOT_ROWS.forecourt).toEqual({ x0: 5.9, x1: 19.25, z0: 16.3, z1: 17.0 })
    expect(LOT_ROWS.corner).toEqual({ x0: 16.6, x1: 19.25, z0: 17.0, z1: 19.0 })
    expect(LOT_ROWS.park).toEqual({ x0: -26, x1: -7.2, z0: 16.3, z1: 30.5 })
    expect(LOT).toEqual([LOT_ROWS.lane, LOT_ROWS.forecourt, LOT_ROWS.corner, LOT_ROWS.park])
    // the market's readers get the same rows
    expect(MARKET_LOT).toBe(LOT)
  })

  it("meet the market's walls where they stand, and the lane where it is", () => {
    const T = 0.15
    expect(MARKET_FACES.west).toBeCloseTo(HALL.x0 - T, 9)
    expect(MARKET_FACES.front).toBeCloseTo(HALL.z0 - T, 9)
    expect(MARKET_FACES.front).toBeCloseTo(FRONT_DOOR.z0, 9)
    expect(MARKET_FACES.east).toBeCloseTo(HALL.x1 + T, 9)
    // the hall's west wall's outer face is the market's westmost, its front the northmost
    expect(bounds(MARKET_WALKIN).x0).toBeCloseTo(MARKET_FACES.west, 9)
    expect(bounds(MARKET_WALKIN).z0).toBeCloseTo(MARKET_FACES.front, 9)
    expect(LANE_SOUTH).toBeCloseTo(LANE.z + LANE.width / 2, 9)
    expect(ESTATE_DOOR.z0).toBe(LANE_SOUTH)
    expect(LANE_NORTH).toBeLessThan(LANE.z - LANE.width / 2 + 0.5)
    // the corner holds the cabin, its east end the lot's
    expect(CABIN.x0).toBeGreaterThanOrEqual(MARKET_FACES.east)
    expect(CABIN.x1).toBeLessThan(LOT_EAST)
    expect(CABIN.z1).toBeLessThan(CORNER_SOUTH)
  })

  it('are one piece of ground: each touches the lane or another row; none lies on a walk-in’s floor', () => {
    const ids = Object.keys(LOT_ROWS) as LotRowId[]
    for (const id of ids)
      if (id !== 'lane')
        expect(
          ids.some((o) => o !== id && touches(LOT_ROWS[id], LOT_ROWS[o])),
          id,
        ).toBe(true)
    for (const w of WALK_INS) for (const room of w.rooms) for (const id of ids) expect(overlaps(LOT_ROWS[id], room), `${id} on ${room.space}`).toBe(false)
  })

  it('every walk-in’s outer door opens onto it, and the ways in, the car and the contractor’s window are on it', () => {
    for (const w of WALK_INS)
      for (const d of w.doors) {
        const x = (d.x0 + d.x1) / 2
        // a door in a wall along x: just outside it, on the side with no room
        const outside = [d.z0 - 0.05, d.z1 + 0.05].filter((z) => !w.rooms.some((r) => inRect(r, x, z)))
        for (const z of outside) expect(onLot(x, z), `${w.id}: outside its door at ${x}, ${z}`).toBe(true)
      }
    for (const p of [MARKET_PATH[0], MARKET_PATH[1], CONTRACTOR_STAND, CAR_SPOT.farm, ARRIVE.farm]) expect(onLot(p.x, p.z), `${p.x}, ${p.z}`).toBe(true)
  })

  it('names the row a point is on, and the action button calls all of them the lane', () => {
    expect(lotRowAt(0, 14)).toBe('lane')
    expect(lotRowAt(10, 16.6)).toBe('forecourt')
    expect(lotRowAt(18.3, 17.9)).toBe('corner')
    expect(lotRowAt(-15, 22)).toBe('park')
    expect(lotRowAt(0, 0)).toBeNull()
    expect(lotRowAt(-30, 14)).toBeNull()
    for (const r of LOT) {
      const x = (r.x0 + r.x1) / 2
      const z = (r.z0 + r.z1) / 2
      expect(onLot(x, z)).toBe(true)
      expect(spaceAt(x, z)).toBe('lane')
    }
    expect(onLot(PARK_AREA.x0 - 0.05, 14)).toBe(false)
    expect(onLot(PARK_AREA.x0 - 0.05, 14, 0.1)).toBe(true)
  })
})
