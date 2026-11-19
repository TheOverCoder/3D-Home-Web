// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PLANT_PRODUCERS, PRODUCERS, storeOf } from './data'
import { DECOR } from './decor'
import { mostOf } from './layout'
import { buyDecor, collect, decorForSale, farm, freezeDay, placeDecor, plantOf, resetFarm, setRandom, stockOf, storeDecor, tick } from './state'
import { savedNow, startFrom } from './testSaves'

// The beehive (update-v1/missions/01-loop-economy.md c8): a piece of the edit mode's shop that gives, as a fruit tree
// does (PRODUCERS.beehive, its "animals" the hives standing), its honey kept in the barn (`bears` in src/farm/decor.ts:
// storeOf reads it); three at most; not counted as fruit (the goals' "Pick fruit").

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
  setRandom(() => 0.99)
})
afterEach(() => {
  freezeDay(false)
  setRandom(null)
})

const at = (x: number, z: number) => ({ x, z, rot: 0 })

describe('the beehive', () => {
  it('each hive put down is one more of the hives, filling with honey on its own clock up to its most', () => {
    farm.coins = 100_000
    expect(buyDecor('beehive')).toBe(true)
    const id = placeDecor('beehive', at(2, 0)).id!
    expect(farm.producers.beehive).toEqual({ animals: 1, stock: [0], timer: [0] })
    expect(plantOf(id)).toEqual({ kind: 'beehive', index: 0 })
    tick(PRODUCERS.beehive.every * 2 + 1)
    expect(stockOf('beehive', 0)).toBe(2)
    tick(PRODUCERS.beehive.every * 100)
    expect(stockOf('beehive', 0)).toBe(PRODUCERS.beehive.max)
  })

  it('its honey goes into the barn, and is no fruit', () => {
    farm.coins = 100_000
    buyDecor('beehive')
    placeDecor('beehive', at(2, 0))
    farm.producers.beehive.stock[0] = 4
    expect(storeOf('honey')).toBe(DECOR.beehive.bears!.store)
    expect(storeOf('honey')).toBe('barn')
    expect(collect('beehive', 0)).toBe(4)
    expect([farm.inv.honey, farm.got.honey]).toEqual([4, 4])
    expect(PLANT_PRODUCERS).not.toContain('beehive')
  })

  it('three at most, standing or stored; put away, its honey is taken first', () => {
    farm.coins = 1_000_000
    expect(mostOf('beehive')).toBe(3)
    for (let k = 0; k < 3; k++) expect(buyDecor('beehive')).toBe(true)
    expect(decorForSale('beehive')).toBe(false)
    expect(buyDecor('beehive')).toBe(false)
    const id = placeDecor('beehive', at(2, 0)).id!
    farm.producers.beehive.stock[0] = 3
    expect(storeDecor(id).ok).toBe(true)
    expect(farm.inv.honey).toBe(3)
    expect(farm.producers.beehive.animals).toBe(0)
  })

  it('kept in the save: the hives standing and the honey in each', () => {
    farm.coins = 100_000
    buyDecor('beehive')
    buyDecor('beehive')
    placeDecor('beehive', at(2, 0))
    placeDecor('beehive', at(4, 0))
    farm.producers.beehive.stock = [5, 2]
    startFrom(savedNow())
    expect(farm.producers.beehive.animals).toBe(2)
    expect(farm.producers.beehive.stock).toEqual([5, 2])
  })
})
