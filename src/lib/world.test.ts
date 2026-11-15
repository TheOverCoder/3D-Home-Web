// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { HALL, BACK, FRONT_DOOR } from '../data/market'
import { DRIVE, PLOT } from '../data/home'
import { HOUSE, ROOMS } from '../data/layout'
import { reachRects } from '../farm/layout'
import { farm } from '../farm/state'
import { useHome } from '../store'
import { floorHere, groundBounds, groundKey, groundRects, houseHere, inHouse, mapNow, roomHere, spaceHere, walkInHere } from './world'

// The two maps' own rules (src/lib/world.ts): the house, its rooms and its plot are the home map's; the walk-in
// buildings, the lane and the land you own the farm's. Each map has the other's ground as nothing at all.

const on = (map: 'farm' | 'home' | null) => useHome.setState({ map })
const mid = (r: { minX: number; maxX: number; minZ: number; maxZ: number }) => [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2] as const

afterEach(() => on(null))

describe('the map in the scene', () => {
  it('is the farm until the scene says (a new farm starts there)', () => {
    on(null)
    expect(mapNow()).toBe('farm')
    expect(houseHere()).toBe(false)
    on('home')
    expect(houseHere()).toBe(true)
  })
})

describe('at home', () => {
  it('the house: each room its own space; the plot round it outdoors', () => {
    on('home')
    for (const room of Object.values(ROOMS)) {
      const [x, z] = mid(room.bounds)
      expect(spaceHere(x, z), room.id).toBe(room.id)
      expect(roomHere(x, z)).toBe(room.id)
      expect(inHouse(x, z)).toBe(true)
      expect(floorHere(x, z)).toBe(room.floor)
    }
    expect(spaceHere(-1.2, 9)).toBe('out')
    expect(roomHere(-1.2, 9)).toBeNull()
  })

  it('no walk-in, no lane: the farm’s buildings are not here, whatever stands at their place', () => {
    on('home')
    for (const [x, z] of [mid({ minX: HALL.x0, maxX: HALL.x1, minZ: HALL.z0, maxZ: HALL.z1 }), mid({ minX: BACK.x0, maxX: BACK.x1, minZ: BACK.z0, maxZ: BACK.z1 }), [7, 15]] as const) {
      expect(walkInHere(x, z)).toBeNull()
      expect(spaceHere(x, z)).toBe('out')
    }
  })

  it('underfoot: the paving round the walls and the driveway are hard, the lawn grass', () => {
    on('home')
    expect(floorHere(-1.2, 7)).toBe('tile')
    expect(floorHere(...mid(DRIVE))).toBe('tile')
    expect(floorHere(-9.5, 12.5)).toBe('grass')
  })

  it('the ground you can be on is the plot inside its fence, the house on it', () => {
    on('home')
    expect(groundRects()).toEqual([PLOT])
    expect(groundBounds()).toEqual(PLOT)
    const b = groundBounds()
    expect(b.minX < HOUSE.minX && b.maxX > HOUSE.maxX && b.minZ < HOUSE.minZ && b.maxZ > HOUSE.maxZ).toBe(true)
    expect(groundKey()).toBe('home')
  })
})

describe('on the farm', () => {
  it('no house: where it stood is the farm’s ground, outdoors, never a room', () => {
    on('farm')
    for (const room of Object.values(ROOMS)) {
      const [x, z] = mid(room.bounds)
      expect(spaceHere(x, z), room.id).toBe('out')
      expect(roomHere(x, z)).toBeNull()
      expect(inHouse(x, z)).toBe(false)
      expect(floorHere(x, z)).toBe('grass')
    }
  })

  it('its walk-ins and the lane are spaces of their own', () => {
    on('farm')
    expect(spaceHere((HALL.x0 + HALL.x1) / 2, (HALL.z0 + HALL.z1) / 2)).toBe('market')
    expect(spaceHere((BACK.x0 + BACK.x1) / 2, (BACK.z0 + BACK.z1) / 2)).toBe('market-office')
    expect(walkInHere((HALL.x0 + HALL.x1) / 2, (HALL.z0 + HALL.z1) / 2)?.room.space).toBe('market')
    expect(spaceHere((FRONT_DOOR.x0 + FRONT_DOOR.x1) / 2, FRONT_DOOR.z0 - 0.05)).toBe('lane')
    expect(spaceHere(5.6, 12.4)).toBe('out')
  })

  it('the ground you can be on is the land you own, the lot and the walk-ins; it moves with the land', () => {
    on('farm')
    expect(groundRects()).toEqual(reachRects(farm.layout))
    const before = groundKey()
    const land = farm.layout.land
    farm.layout.land = [...land, 'east']
    try {
      expect(groundKey()).not.toBe(before)
    } finally {
      farm.layout.land = land
    }
  })
})
