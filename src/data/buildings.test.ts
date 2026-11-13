import { OrthographicCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { WALK_INS, insideWalkIn, isWalkInSpace, spaceAt } from './buildings'
import { ROOMS, SUN, SUN_SHADOW } from './layout'
import { BACK, CABIN, CONTRACTOR_STAND, FRONT_DOOR, HALL, INNER_DOOR, MARKET_PATH } from './market'

// Walk-in buildings (src/data/buildings.ts) against the sun's shadow box: outside the box three lights a surface as if
// nothing shaded it, so every floor, and the inside of every wall the sun shines at, must stand inside it (and the
// contractor's cabin too); and which space a point is in, for the action button.

const MARGIN = 0.1

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

const HEIGHTS = [0, 1, 2, 3]
const along = (a: number, b: number) => [a, (a + b) / 2, b]

describe('the shadow box', () => {
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
})

describe('every walk-in stands in the sun’s shadow box', () => {
  for (const w of WALK_INS)
    for (const room of w.rooms) {
      it(`${w.id}, ${room.space}: the floor's corners`, () => {
        for (const x of [room.x0, room.x1])
          for (const z of [room.z0, room.z1]) {
            const m = inside(x, 0, z)
            expect(m, `${room.space} floor corner ${x}, ${z}: ${m.toFixed(3)} m inside`).toBeGreaterThanOrEqual(MARGIN)
          }
      })

      it(`${w.id}, ${room.space}: the inside of the walls the sun shines at (facing +x: the west wall; facing +z: the north), up to 3 m`, () => {
        for (const y of HEIGHTS) {
          for (const z of along(room.z0, room.z1)) {
            const m = inside(room.x0, y, z)
            expect(m, `${room.space} west wall's inside at y ${y}, z ${z}: ${m.toFixed(3)} m inside`).toBeGreaterThanOrEqual(MARGIN)
          }
          for (const x of along(room.x0, room.x1)) {
            const m = inside(x, y, room.z0)
            expect(m, `${room.space} north wall's inside at y ${y}, x ${x}: ${m.toFixed(3)} m inside`).toBeGreaterThanOrEqual(MARGIN)
          }
        }
      })
    }

  it("the contractor's cabin: its footprint on the ground and at its top", () => {
    for (const y of [0, CABIN.y1])
      for (const x of [CABIN.x0, CABIN.x1])
        for (const z of [CABIN.z0, CABIN.z1]) {
          const m = inside(x, y, z)
          expect(m, `cabin corner ${x}, ${y}, ${z}: ${m.toFixed(3)} m inside`).toBeGreaterThanOrEqual(MARGIN)
        }
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

  it('in the house: its room', () => {
    for (const room of Object.values(ROOMS)) {
      const b = room.bounds
      expect(spaceAt((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2), room.id).toBe(room.id)
      expect(isWalkInSpace(room.id)).toBe(false)
    }
  })
})
