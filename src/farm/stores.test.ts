// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { BEDS, cropById } from './data'
import { bedsToHarvest, capacity, collect, collectMachine, farm, harvestBeds, loadMachine, resetFarm, room, tick, upgradeStore, used } from './state'
import { OLD_SAVE, justSaved, startFrom } from './testSaves'

// The silo and the barn in play (src/farm/state.ts): what is collected goes in only while there is room — what does
// not fit stays where it was — and never silently; upgrades take their materials.

/** A ripe crop in bed `i`. */
function ripe(i: number, crop: 'lettuce' | 'pumpkin' | 'wheat' = 'lettuce') {
  Object.assign(farm.beds[i], { built: true, crop, growth: cropById(crop).growSeconds, water: 0 })
}

beforeEach(() => {
  localStorage.clear()
  resetFarm()
})

describe('what is collected only goes in while there is room', () => {
  it('a new farm: the silo and the barn hold 50 each', () => {
    expect([capacity('silo'), capacity('barn'), used('silo'), used('barn')]).toEqual([50, 50, 0, 0])
  })

  it('a harvest goes in only if all of it fits: a bed that does not fit stays ripe, and the toast says the silo is full', () => {
    farm.inv.wheat = 48
    ripe(0)
    ripe(1)
    // two lettuce beds (4 each), room for 2: neither fits
    expect(bedsToHarvest(0, BEDS[0].x, BEDS[0].z)).toEqual([])
    expect(harvestBeds([0, 1])).toBe(0)
    expect(farm.beds[0].crop).toBe('lettuce')
    expect(farm.inv.lettuce).toBe(0)
    // room for 5: one bed of the two
    farm.inv.wheat = 45
    expect(bedsToHarvest(0, BEDS[0].x, BEDS[0].z)).toEqual([0])
    expect(harvestBeds([0, 1])).toBe(4)
    expect([farm.beds[0].crop, farm.beds[1].crop]).toEqual([null, 'lettuce'])
    expect(used('silo')).toBe(49)
  })

  it('milking takes as much as the barn has room for; the rest stays with the cow, her clock running only once she is empty', () => {
    farm.producers.cows.stock[0] = 3
    farm.producers.cows.timer[0] = 20
    farm.inv.egg = 49
    expect(collect('cows', 0)).toBe(1)
    expect(farm.producers.cows.stock[0]).toBe(2)
    expect(farm.producers.cows.timer[0]).toBe(20)
    // full: nothing, and she keeps it all
    expect(collect('cows', 0)).toBe(0)
    expect(farm.producers.cows.stock[0]).toBe(2)
    farm.inv.egg = 0
    expect(collect('cows', 0)).toBe(2)
    expect(farm.producers.cows.timer[0]).toBe(0)
    expect(farm.inv.milk).toBe(3)
  })

  it('a machine gives out what fits, and keeps the rest to take out later', () => {
    farm.inv.wheat = 6
    expect(loadMachine('mill', 'wheat')).toBe(6)
    tick(30)
    farm.inv.egg = 47
    expect(collectMachine('mill')).toBe(3)
    expect(farm.machines.mill.ready).toBe(3)
    expect(collectMachine('mill')).toBe(0)
    farm.inv.egg = 0
    expect(collectMachine('mill')).toBe(3)
    expect(farm.machines.mill.ready).toBe(0)
    expect(farm.inv.flour).toBe(6)
  })

  it('a farm saved before the silo and the barn keeps everything it had, even past 50, and takes no more until there is room', () => {
    startFrom(justSaved({ ...OLD_SAVE, inv: { ...OLD_SAVE.inv, wheat: 70, lettuce: 9, egg: 55 } }))
    expect([farm.inv.wheat, farm.inv.lettuce, farm.inv.egg]).toEqual([70, 9, 55])
    expect(farm.storage).toEqual({ silo: 1, barn: 1 })
    expect([room('silo'), room('barn')]).toEqual([0, 0])
    ripe(2)
    expect(harvestBeds([2])).toBe(0)
    expect(collect('hens')).toBe(0)
    // sold down under the limit: room again
    farm.inv.wheat = 30
    expect(harvestBeds([2])).toBe(4)
  })

  it('a building is made bigger with its materials: level n to n+1 takes n of each, and holds 50 more', () => {
    Object.assign(farm.inv, { brick: 3, plank: 3, nail: 2 })
    expect(upgradeStore('barn')).toBe(true)
    expect([farm.storage.barn, capacity('barn')]).toEqual([2, 100])
    expect([farm.inv.brick, farm.inv.plank, farm.inv.nail]).toEqual([2, 2, 1])
    // level 2 to 3 takes two of each: one nail short
    expect(upgradeStore('barn')).toBe(false)
    farm.inv.nail = 2
    expect(upgradeStore('barn')).toBe(true)
    expect([farm.storage.barn, capacity('barn'), farm.inv.brick, farm.inv.plank, farm.inv.nail]).toEqual([3, 150, 0, 0, 0])
    // the silo's are its own
    expect(upgradeStore('silo')).toBe(false)
  })
})
