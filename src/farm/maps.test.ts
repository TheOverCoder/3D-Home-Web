// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
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
