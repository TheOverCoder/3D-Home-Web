import { OrthographicCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { WALK_INS, insideWalkIn, isWalkInSpace, spaceAt } from './buildings'
import { ROOMS, SUN, SUN_SHADOW, inSunShadow } from './layout'
import { BACK, CABIN, CONTRACTOR_STAND, FRONT_DOOR, HALL, INNER_DOOR, MARKET_PATH } from './market'
import { AGENT_STAND, ESTATE_DOOR, ESTATE_PATH, ESTATE_ROOM, PARKING } from './estate'
import { ARRIVE, CAR_SPOT } from './maps'
import { CAR_SHAPE, carHalf } from '../models/car'
import { SUN_BOXES, boxMargin } from './sunBox'
import { SUN_MARGIN, cornerMargins, floorMargins, wallMargins } from './sunCheck'

// Walk-in buildings (src/data/buildings.ts) against the sun's shadow box: outside the box three lights a surface as if
// nothing shaded it, so every floor, and the inside of every wall the sun shines at, must stand inside it (and the
// contractor's cabin too: the rule is src/data/sunCheck.ts, on the farm's box); and which space a point is in, for the
// action button.

/** The farm's sun box (src/data/sunBox.ts): the walk-ins stand on the farm. */
const BOX = SUN_BOXES.farm

// the sun's shadow camera, made as src/scene/Lighting.tsx makes it: three's directional light shadow camera stands at
// the light's position and looks at its target (the origin), with three's own up
const cam = new OrthographicCamera(-SUN_SHADOW.half, SUN_SHADOW.half, SUN_SHADOW.half, -SUN_SHADOW.half, SUN_SHADOW.near, SUN_SHADOW.far)
cam.position.set(SUN[0] * SUN_SHADOW.scale, SUN[1] * SUN_SHADOW.scale, SUN[2] * SUN_SHADOW.scale)
cam.lookAt(0, 0, 0)
cam.updateMatrixWorld(true)

/** How far a world point is inside the shadow box, in metres (below 0: outside), in the light's view. */
function inside(x: number, y: number, z: number) {
  const v = new Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse)
  const depth = -v.z
  return Math.min(SUN_SHADOW.half - Math.abs(v.x), SUN_SHADOW.half - Math.abs(v.y), depth - SUN_SHADOW.near, SUN_SHADOW.far - depth)
}

const along = (a: number, b: number) => [a, (a + b) / 2, b]

describe('the shadow box', () => {
  it('inSunShadow says what the shadow camera sees, its margin in from the sides', () => {
    for (let k = 0; k < 400; k++) {
      const x = -30 + ((k * 37) % 60) + 0.31
      const z = -30 + ((k * 53) % 60) + 0.17
      const y = (k % 7) * 0.8
      const sides = (m: number) => {
        const v = new Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse)
        return Math.max(Math.abs(v.x), Math.abs(v.y)) <= SUN_SHADOW.half - m
      }
      expect(inSunShadow(x, y, z), `${x}, ${y}, ${z}`).toBe(sides(0))
      expect(inSunShadow(x, y, z, 1.5), `${x}, ${y}, ${z}`).toBe(sides(1.5))
    }
  })

  it('is the one the plan measured: its target inside, its corners on the ground where the diamond has them', () => {
    expect(inside(0, 0, 0)).toBeGreaterThan(1)
    for (const [x, z] of [
      [10.78, 24.61],
      [26.15, 6.17],
      [-10.78, -24.61],
      [-26.15, -6.17],
    ])
      expect(Math.abs(inside(x, 0, z)), `${x}, ${z}`).toBeLessThan(0.05)
    expect(inside(30, 0, 30)).toBeLessThan(0)
  })

  it("is the farm's box, and the rule's margin is this camera's (src/data/sunCheck.ts measures with it)", () => {
    expect(BOX).toEqual({ left: -SUN_SHADOW.half, right: SUN_SHADOW.half, bottom: -SUN_SHADOW.half, top: SUN_SHADOW.half })
    for (let k = 0; k < 200; k++) {
      const x = -20 + ((k * 37) % 45) + 0.31
      const z = -20 + ((k * 53) % 45) + 0.17
      const y = (k % 5) * 0.9
      expect(boxMargin(x, y, z, BOX), `${x}, ${y}, ${z}`).toBeCloseTo(inside(x, y, z), 9)
    }
  })
})

describe('every walk-in stands in the sun’s shadow box', () => {
  for (const w of WALK_INS)
    for (const room of w.rooms) {
      it(`${w.id}, ${room.space}: the floor's corners`, () => {
        for (const p of floorMargins(room, BOX)) expect(p.margin, `${room.space} ${p.what} ${p.x}, ${p.z}: ${p.margin.toFixed(3)} m inside`).toBeGreaterThanOrEqual(SUN_MARGIN)
      })

      it(`${w.id}, ${room.space}: the inside of the walls the sun shines at (facing +x: the west wall; facing +z: the north), up to its roof`, () => {
        for (const p of wallMargins(room, w.roof.y, BOX))
          expect(p.margin, `${room.space} ${p.what} at y ${p.y}, x ${p.x}, z ${p.z}: ${p.margin.toFixed(3)} m inside`).toBeGreaterThanOrEqual(SUN_MARGIN)
      })
    }

  it('the car in its bay on the farm: its footprint on the ground and at its roof (its shadow falls where it is drawn)', () => {
    const c = CAR_SPOT.farm
    const h = carHalf(c.heading)
    for (const p of cornerMargins({ x0: c.x - h.x, x1: c.x + h.x, z0: c.z - h.z, z1: c.z + h.z }, [0, CAR_SHAPE.height], BOX))
      expect(p.margin, `car corner ${p.x}, ${p.y}, ${p.z}: ${p.margin.toFixed(3)} m inside`).toBeGreaterThanOrEqual(SUN_MARGIN)
  })

  it("the contractor's cabin: its footprint on the ground and at its top", () => {
    for (const p of cornerMargins(CABIN, [0, CABIN.y1], BOX)) expect(p.margin, `cabin corner ${p.x}, ${p.y}, ${p.z}: ${p.margin.toFixed(3)} m inside`).toBeGreaterThanOrEqual(SUN_MARGIN)
  })
})

describe('which space a point is in', () => {
  it("each walk-in room's floor is its own space", () => {
    for (const w of WALK_INS)
      for (const room of w.rooms) {
        expect(isWalkInSpace(room.space)).toBe(true)
        for (const x of [room.x0 + 0.05, (room.x0 + room.x1) / 2, room.x1 - 0.05])
          for (const z of [room.z0 + 0.05, (room.z0 + room.z1) / 2, room.z1 - 0.05]) expect(spaceAt(x, z), `${room.space} at ${x}, ${z}`).toBe(room.space)
        expect(insideWalkIn((room.x0 + room.x1) / 2, (room.z0 + room.z1) / 2)).toBe(w)
      }
  })

  it('the hall is the market, the room behind it the manager’s', () => {
    expect(spaceAt((HALL.x0 + HALL.x1) / 2, (HALL.z0 + HALL.z1) / 2)).toBe('market')
    expect(spaceAt(HALL.x0 + 0.3, HALL.z1 - 0.3)).toBe('market')
    expect(spaceAt((BACK.x0 + BACK.x1) / 2, (BACK.z0 + BACK.z1) / 2)).toBe('market-office')
    expect(spaceAt(BACK.x1 - 0.3, BACK.z1 - 0.3)).toBe('market-office')
    expect(spaceAt(MARKET_PATH[2].x, MARKET_PATH[2].z), 'inside the front door').toBe('market')
  })

  it('in the thickness of a doorway you are in a room, never out: the front door in the hall, the inner one in the room you are nearer', () => {
    for (const x of along(FRONT_DOOR.x0 + 0.01, FRONT_DOOR.x1 - 0.01))
      for (const z of along(FRONT_DOOR.z0 + 0.01, FRONT_DOOR.z1 - 0.01)) expect(spaceAt(x, z), `front door at ${x}, ${z}`).toBe('market')
    for (const x of along(INNER_DOOR.x0 + 0.01, INNER_DOOR.x1 - 0.01)) {
      for (const z of along(INNER_DOOR.z0 + 0.01, INNER_DOOR.z1 - 0.01)) expect(['market', 'market-office'], `inner door at ${x}, ${z}`).toContain(spaceAt(x, z))
      expect(spaceAt(x, INNER_DOOR.z0 + 0.02), 'the hall’s side').toBe('market')
      expect(spaceAt(x, INNER_DOOR.z1 - 0.02), 'the back room’s side').toBe('market-office')
    }
  })

  it('outside is out: the lane, the way in before the door, the contractor’s window', () => {
    // the lane outside the garden's fence is a space of its own (nothing in the garden in reach over the fence)
    expect(spaceAt(7, 15)).toBe('lane')
    expect(spaceAt(MARKET_PATH[0].x, MARKET_PATH[0].z)).toBe('lane')
    expect(spaceAt(MARKET_PATH[1].x, MARKET_PATH[1].z)).toBe('lane')
    expect(spaceAt((FRONT_DOOR.x0 + FRONT_DOOR.x1) / 2, FRONT_DOOR.z0 - 0.05)).toBe('lane')
    expect(spaceAt(CONTRACTOR_STAND.x, CONTRACTOR_STAND.z)).toBe('lane')
    // and the garden inside it is outdoors, as the farm is
    expect(spaceAt(5.6, 12.4)).toBe('out')
    expect(insideWalkIn(7, 15)).toBeNull()
  })

  it('no walk-in shares a space with the house (the home map: src/lib/world.test.ts)', () => {
    for (const room of Object.values(ROOMS)) expect(isWalkInSpace(room.id)).toBe(false)
  })

  it('the estate office is its own space, its doorway in it; the way in, its front and the parking lot are the lane', () => {
    expect(spaceAt((ESTATE_ROOM.x0 + ESTATE_ROOM.x1) / 2, (ESTATE_ROOM.z0 + ESTATE_ROOM.z1) / 2)).toBe('estate')
    expect(spaceAt(AGENT_STAND.x, AGENT_STAND.z)).toBe('estate')
    expect(spaceAt(ESTATE_PATH[2].x, ESTATE_PATH[2].z), 'inside its door').toBe('estate')
    for (const x of along(ESTATE_DOOR.x0 + 0.01, ESTATE_DOOR.x1 - 0.01))
      for (const z of along(ESTATE_DOOR.z0 + 0.01, ESTATE_DOOR.z1 - 0.01)) expect(spaceAt(x, z), `its door at ${x}, ${z}`).toBe('estate')
    expect(spaceAt(ESTATE_PATH[1].x, ESTATE_PATH[1].z), 'outside its door').toBe('lane')
    expect(spaceAt(ESTATE_PATH[0].x, ESTATE_PATH[0].z), 'on the lane').toBe('lane')
    for (const x of along(PARKING.x0 + 0.05, PARKING.x1 - 0.05)) for (const z of along(PARKING.z0 + 0.05, PARKING.z1 - 0.05)) expect(spaceAt(x, z), `the parking lot at ${x}, ${z}`).toBe('lane')
    expect(spaceAt(CAR_SPOT.farm.x, CAR_SPOT.farm.z), 'the car').toBe('lane')
    expect(spaceAt(ARRIVE.farm.x, ARRIVE.farm.z), 'where the drive ends').toBe('lane')
    expect(insideWalkIn(ARRIVE.farm.x, ARRIVE.farm.z)).toBeNull()
  })
})
