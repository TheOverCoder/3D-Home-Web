// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { BAYS, ESTATE_ROOM, PARKING } from '../data/estate'
import { ARRIVE, CAR_SPOT } from '../data/maps'
import { LOT } from '../data/market'
import { BODY } from '../lib/playerState'
import { carHalf } from '../models/car'
import { driveTo, farm } from './state'
import { playedSave, startFrom } from './testSaves'

describe('the two maps: the car drives between the farm and the house', () => {
  it('drives to the house only once it is yours, and back to the farm; the same map again is no drive', () => {
    startFrom({ ...playedSave(), apartment: { owned: false }, place: 'farm' })
    expect(driveTo('home')).toBe(false)
    expect(farm.place).toBe('farm')
    expect(driveTo('farm')).toBe(false)
    farm.apartment.owned = true
    expect(driveTo('home')).toBe(true)
    expect(farm.place).toBe('home')
    expect(driveTo('farm')).toBe(true)
    expect(farm.place).toBe('farm')
  })
})

describe('the car on the farm', () => {
  const car = CAR_SPOT.farm
  const half = carHalf(car.heading)
  const within = (r: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number, m = 0) => x - m >= r.x0 && x + m <= r.x1 && z - m >= r.z0 && z + m <= r.z1

  it('stands in the parking lot’s east bay, inside its lines, out of the walkers’ way (z 15.45, a body either side)', () => {
    const bay = BAYS[1]
    for (const [x, z] of [
      [car.x - half.x, car.z - half.z],
      [car.x + half.x, car.z + half.z],
    ])
      expect(within(bay, x, z), `${x}, ${z} in the bay`).toBe(true)
    expect(within(PARKING, car.x, car.z)).toBe(true)
    expect(car.z + half.z).toBeLessThan(15.45 - 0.25)
  })

  it('you get out beside it on the lot, clear of it and of the estate office', () => {
    const a = ARRIVE.farm
    expect(LOT.some((r) => within(r, a.x, a.z, BODY.radius))).toBe(true)
    const gap = Math.hypot(Math.max(0, Math.abs(a.x - car.x) - half.x), Math.max(0, Math.abs(a.z - car.z) - half.z))
    expect(gap).toBeGreaterThan(BODY.radius + 0.1)
    expect(gap).toBeLessThan(1.2)
    expect(a.z + BODY.radius).toBeLessThan(ESTATE_ROOM.z0 - 0.15)
  })
})
