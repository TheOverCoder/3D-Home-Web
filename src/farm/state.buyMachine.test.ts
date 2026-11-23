// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BOUGHT_MACHINES, MACHINES, MACHINE_IDS, XP_FOR } from './data'
import { PLACES, canPlaceNew, samePlacement, sanitizeLayout, standingPlaces } from './layout'
import {
  addJob,
  buyDecor,
  buyMachine,
  canAddJob,
  farm,
  gainXp,
  machineLock,
  machineOwned,
  machineProblem,
  machineShopView,
  movePlace,
  placeDecor,
  placesAway,
  resetFarm,
  setRandom,
  unlockAll,
} from './state'
import { savedNow, startFrom } from './testSaves'
import { machineOpensAt } from './unlocks'
import { levelOf, xpAt } from './xp'

// The machines bought in the edit mode's shop (its Machines tab: src/farm/DecorShop.tsx; MACHINES' `price` in
// src/farm/data.ts): a new farm has the loom; the mill, the oven, the dairy and the jam kettle are sold each from the level
// its first recipe opens at, once, for its price, and until bought it is not on the farm — it works nothing, takes no
// ground and is moved nowhere. Bought, it stands where it stands on a new farm (or the free spot nearest that). A farm
// from before they were bought keeps every machine its level had opened, or that had worked; and where the game is
// tested (the locks off) every machine stands, as before.

/** XP up to a level (its coins and gift come in as it is reached, as in play). */
function reach(level: number) {
  const need = xpAt(level) - farm.xp.points
  if (need > 0) gainXp('goal', Math.ceil(need / XP_FOR.goal))
}

beforeEach(() => {
  localStorage.clear()
  unlockAll(false)
  resetFarm()
  setRandom(() => 0.99)
})
afterEach(() => {
  unlockAll(true)
  setRandom(null)
})

describe('a new farm', () => {
  it('has the loom; the others are sold in the shop, and until then are not on the farm', () => {
    expect(BOUGHT_MACHINES).toEqual(['mill', 'oven', 'dairy', 'kettle'])
    expect(MACHINE_IDS.filter((id) => farm.machines[id].owned)).toEqual(['loom'])
    expect(MACHINE_IDS.filter(machineOwned)).toEqual(['loom'])
    expect(placesAway()).toEqual(['mill', 'oven', 'dairy', 'kettle'])
    expect(standingPlaces()).not.toContain('oven')
    // every price is a whole number of coins, dearer the later the machine opens
    const prices = BOUGHT_MACHINES.map((id) => MACHINES[id].price!)
    expect(prices.every((p) => Number.isInteger(p) && p > 0)).toBe(true)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
  })

  it('a machine not bought works nothing, even once its level is reached: no job, no place in its queue, no move', () => {
    reach(machineOpensAt('mill'))
    farm.coins = 5000
    farm.inv.wheat = 5
    const wheat = MACHINES.mill.recipes.find((r) => r.id === 'wheat')!
    expect(machineLock('mill')).toBe(machineOpensAt('mill'))
    expect(canAddJob('mill', wheat)).toBe(false)
    expect(addJob('mill', 'wheat')).toBe(false)
    expect(farm.inv.wheat).toBe(5)
    expect(movePlace('mill', { x: 2, z: 0, rot: 0 })).toEqual({ ok: false, reason: 'Not on the farm' })
    // the loom, the farm's from the start, works at level 1 as ever
    expect(machineLock('loom')).toBeNull()
  })

  it('its ground is free: decoration may stand where a machine not bought would', () => {
    const home = PLACES.oven.home
    expect(canPlaceNew(farm.layout, 'lamp', { x: home.x, z: home.z, rot: 0 }).ok).toBe(true)
    // (with every machine standing, as where the game is tested, it is the oven's)
    unlockAll(true)
    expect(canPlaceNew(farm.layout, 'lamp', { x: home.x, z: home.z, rot: 0 }).ok).toBe(false)
  })
})

describe('buying one', () => {
  it('locked below its level: nothing spent', () => {
    farm.coins = 5000
    for (const id of BOUGHT_MACHINES) {
      expect(machineProblem(id), id).toBe('locked')
      expect(buyMachine(id), id).toBe(false)
    }
    expect(farm.coins).toBe(5000)
    expect(machineShopView().map((m) => [m.id, m.locked, m.owned, m.can])).toEqual(BOUGHT_MACHINES.map((id) => [id, machineOpensAt(id), false, false]))
  })

  it('at its level, not without its price', () => {
    reach(machineOpensAt('oven'))
    farm.coins = MACHINES.oven.price! - 1
    expect(machineProblem('oven')).toBe('coins')
    expect(buyMachine('oven')).toBe(false)
    expect(farm.coins).toBe(MACHINES.oven.price! - 1)
    expect(machineOwned('oven')).toBe(false)
    expect(machineShopView().find((m) => m.id === 'oven')).toMatchObject({ owned: false, can: false, price: MACHINES.oven.price })
  })

  it('at its level with the coins: it is the farm’s, at its own place, for its price and a build’s XP; once', () => {
    reach(machineOpensAt('oven'))
    farm.coins = 5000
    const xp = farm.xp.points
    expect(machineShopView().find((m) => m.id === 'oven')).toMatchObject({ owned: false, can: true })
    expect(buyMachine('oven')).toBe(true)
    expect(farm.coins).toBe(5000 - MACHINES.oven.price!)
    expect(farm.xp.points - xp).toBe(XP_FOR.build)
    expect(farm.machines.oven.owned).toBe(true)
    expect(machineOwned('oven')).toBe(true)
    expect(placesAway()).not.toContain('oven')
    expect(samePlacement(farm.layout.places.oven, PLACES.oven.home)).toBe(true)
    // it works: a lemon cake goes in
    Object.assign(farm.inv, { flour: 1, sugar: 1, egg: 2, milk: 1, lemon: 2 })
    expect(machineLock('oven')).toBeNull()
    expect(addJob('oven', 'lemon_cake')).toBe(true)
    // and is not bought again
    expect(machineProblem('oven')).toBe('owned')
    expect(buyMachine('oven')).toBe(false)
    expect(machineShopView().find((m) => m.id === 'oven')).toMatchObject({ owned: true, can: false })
    // the loom is never sold
    expect(buyMachine('loom')).toBe(false)
  })

  it('where a decoration stands on its place, it comes to the free spot nearest it', () => {
    reach(machineOpensAt('oven'))
    farm.coins = 5000
    const home = PLACES.oven.home
    expect(buyDecor('bush')).toBe(true)
    expect(placeDecor('bush', { x: home.x, z: home.z, rot: 0 }).ok).toBe(true)
    expect(buyMachine('oven')).toBe(true)
    const at = farm.layout.places.oven
    expect(samePlacement(at, home)).toBe(false)
    expect(at.rot).toBe(home.rot)
    expect(Math.hypot(at.x - home.x, at.z - home.z)).toBeLessThan(4)
    // where it fits: clear of the bush, its way in open
    expect(movePlace('oven', at).ok).toBe(true)
  })
})

describe('the save', () => {
  it('keeps which machines are the farm’s, and the ground of one not bought stays free across a reload', () => {
    reach(machineOpensAt('oven'))
    farm.coins = 5000
    expect(buyMachine('mill')).toBe(true)
    // a bush where the oven, not bought, would stand
    const home = PLACES.oven.home
    expect(buyDecor('bush')).toBe(true)
    expect(placeDecor('bush', { x: home.x, z: home.z, rot: 0 }).ok).toBe(true)
    startFrom(savedNow())
    expect(MACHINE_IDS.filter((id) => farm.machines[id].owned)).toEqual(['mill', 'loom'])
    expect(farm.layout.decor.map((d) => d.kind)).toEqual(['bush'])
  })

  it('a farm from before machines were bought owns each its level had opened, and each that had worked', () => {
    reach(machineOpensAt('oven'))
    const save = savedNow()
    const machines = save.machines as Record<string, Record<string, unknown>>
    for (const id of MACHINE_IDS) delete machines[id].owned
    // the dairy (level 21) had worked once, with the locks off
    machines.dairy.worked = 60
    startFrom(save)
    expect(levelOf(farm.xp.points)).toBe(machineOpensAt('oven'))
    expect(MACHINE_IDS.filter((id) => farm.machines[id].owned)).toEqual(['mill', 'loom', 'oven', 'dairy'])
    expect(machineLock('mill')).toBeNull()
    expect(machineLock('kettle')).toBe(machineOpensAt('kettle'))
  })

  it('one that holds jobs is the farm’s whatever the save says; the loom always is', () => {
    const save = savedNow()
    const machines = save.machines as Record<string, Record<string, unknown>>
    machines.mill = { ...machines.mill, owned: false, jobs: ['wheat'], done: 1 }
    machines.loom = { ...machines.loom, owned: false }
    machines.oven = { ...machines.oven, owned: 'yes' }
    startFrom(save)
    expect(farm.machines.mill).toMatchObject({ owned: true, jobs: ['wheat'] })
    expect(farm.machines.loom.owned).toBe(true)
    // (a word that is no answer, on a farm at level 1: as a farm from before them, by its level)
    expect(farm.machines.oven.owned).toBe(false)
  })

  it('the layout keeps a machine not bought where it was saved, in nothing’s way', () => {
    const layout = sanitizeLayout(
      {
        places: { oven: { x: 3, z: 0, rot: 0 } },
        decor: [{ id: 1, kind: 'lamp', x: 3, z: 0, rot: 0 }],
      },
      [],
      ['oven'],
    )
    expect(layout.places.oven).toEqual({ x: 3, z: 0, rot: 0 })
    expect(layout.decor.map((d) => d.kind)).toEqual(['lamp'])
  })
})

describe('the locks off (the tests’ default, a ?debug page)', () => {
  it('every machine stands and works, as before machines were bought; buying one still records it', () => {
    unlockAll(true)
    expect(MACHINE_IDS.every(machineOwned)).toBe(true)
    expect(placesAway()).toEqual([])
    expect(MACHINE_IDS.every((id) => machineLock(id) === null)).toBe(true)
    expect(machineShopView().every((m) => m.owned && !m.can && m.locked === undefined)).toBe(true)
    farm.coins = 5000
    expect(buyMachine('dairy')).toBe(true)
    expect(farm.machines.dairy.owned).toBe(true)
  })
})
