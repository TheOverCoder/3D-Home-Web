// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MACHINES, XP_FOR, type MachineId } from './data'
import {
  addJob,
  animals,
  buildBed,
  buy,
  buyDecor,
  buyLand,
  buyMachine,
  buySlot,
  canAddJob,
  collect,
  collectMachine,
  farm,
  fixBed,
  freezeDay,
  gainXp,
  harvestBeds,
  isUnlocked,
  lockOf,
  machineLock,
  machineView,
  opensOn,
  placeDecor,
  plant,
  resetFarm,
  setRandom,
  shopView,
  tick,
  unlockAll,
} from './state'
import { savedNow, startFrom } from './testSaves'
import { UNLOCKS, UNLOCK_IDS, machineOpensAt, opensAt, unlockLevel, type UnlockId } from './unlocks'
import { levelOf, xpAt } from './xp'

// What each level opens, on the farm (src/farm/unlocks.ts; the gates in src/farm/state.ts): a thing not open yet is
// refused where it is bought, planted or put into a machine, and nothing is spent; the level it opens at opens it; what
// the farm has already stays and works (only buying is locked); and with the locks off — the tests' default, and a
// ?debug page's — everything is open whatever the level.

/** Everything was open as the farm loaded, before any test turned the locks on. */
const openAtFirst = UNLOCK_IDS.every((id) => lockOf(id) === null)

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
  setRandom(() => 0.99)
  unlockAll(false)
})
afterEach(() => {
  unlockAll(true)
  freezeDay(false)
  setRandom(null)
})

/** XP up to a level (the level's own coins and gift come in as it is reached, as in play). */
function reach(level: number) {
  const need = xpAt(level) - farm.xp.points
  if (need > 0) gainXp('goal', Math.ceil(need / XP_FOR.goal))
}

/** Each thing the plan names, with the one press that buys, plants or queues it: true when it was done. */
const TRIES: { id: UnlockId; what: string; try: () => boolean }[] = [
  { id: 'crop:wheat', what: 'wheat seeds', try: () => plant(0, 'wheat') },
  { id: 'crop:wheat', what: 'a bed set to wheat', try: () => fixBed(1, 'wheat') },
  { id: 'upgrade:cow', what: 'another cow', try: () => buy('cow') },
  { id: 'upgrade:east', what: 'the East beds', try: () => buy('east') },
  { id: 'decor:lamp', what: 'a yard lamp', try: () => buyDecor('lamp') },
  { id: 'parcel:north', what: 'the north meadow', try: () => buyLand('north') },
  // (the mill bought before its flour goes in, the oven before a place in its queue: a machine is bought first)
  { id: 'machine:mill', what: 'the mill', try: () => buyMachine('mill') },
  { id: 'recipe:mill:wheat', what: 'flour at the mill', try: () => addJob('mill', 'wheat') },
  { id: 'machine:oven', what: 'the oven', try: () => buyMachine('oven') },
]

/** A machine's queue place: open with the machine (no row of its own). */
const ovenSlot = { machine: 'oven' as MachineId, what: 'a queue place at the oven', try: () => buySlot('oven') }

describe('the locks, at level 1', () => {
  it('what is locked is refused and nothing is spent: coins and farm unchanged', () => {
    farm.coins = 5000
    farm.inv.wheat = 5
    expect(levelOf(farm.xp.points)).toBe(1)
    const before = JSON.stringify(farm)
    for (const t of TRIES) {
      expect(lockOf(t.id), t.what).toBe(unlockLevel(t.id))
      expect(isUnlocked(t.id), t.what).toBe(false)
      expect(t.try(), t.what).toBe(false)
    }
    expect(machineLock('oven')).toBe(machineOpensAt('oven'))
    expect(ovenSlot.try(), ovenSlot.what).toBe(false)
    expect(JSON.stringify(farm)).toBe(before)
    // a bed not set to anything stays allowed, and so do the crops open at level 1
    expect(fixBed(1, null)).toBe(true)
    expect(fixBed(1, 'lettuce')).toBe(true)
    expect(plant(0, 'lettuce')).toBe(true)
    expect(buildBed(4)).toBe(true)
  })

  it('the views carry the lock, so the panels only draw it', () => {
    farm.coins = 5000
    farm.inv.wheat = 5
    const lamp = shopView().find((v) => v.kind === 'lamp')!
    expect(lamp).toMatchObject({ locked: UNLOCKS['decor:lamp'], can: false })
    const flour = machineView('mill').recipes.find((r) => r.id === 'wheat')!
    expect(flour).toMatchObject({ locked: UNLOCKS['recipe:mill:wheat'], can: false })
    expect(
      canAddJob(
        'mill',
        MACHINES.mill.recipes.find((r) => r.id === 'wheat')!,
      ),
    ).toBe(false)
    // a machine not open yet sells no place in its queue; one open does
    expect(machineView('oven').upgrade).toBeNull()
    expect(machineView('loom').upgrade).not.toBeNull()
    // what is open has no lock
    expect(machineView('loom').recipes[0].locked).toBeUndefined()
    expect(shopView().filter((v) => unlockLevel(`decor:${v.kind}`) === 1 && v.locked !== undefined)).toEqual([])
  })

  it('a level reached opens each: the level-up tells what it opened', () => {
    farm.coins = 50_000
    farm.inv.wheat = 5
    const steps = [...TRIES.map((t) => ({ ...t, level: unlockLevel(t.id) })), { ...ovenSlot, level: machineOpensAt('oven') }].sort((a, b) => a.level - b.level)
    for (const s of steps) {
      if (levelOf(farm.xp.points) < s.level) {
        expect(s.try(), `${s.what} before level ${s.level}`).toBe(false)
        reach(s.level)
      }
      expect(s.try(), `${s.what} at level ${s.level}`).toBe(true)
    }
    expect(opensOn(2)).toEqual(opensAt(2))
    expect(opensOn(2).length).toBeGreaterThan(0)
  })
})

describe('what the farm has stays', () => {
  it('a farm at level 1 owning what its level locks loads with all of it, and all of it works', () => {
    // played with the locks off (as every farm before them was): wheat growing, two cows, sprinklers, a lamp in the
    // store, flour queued at the mill
    unlockAll(true)
    farm.coins = 5000
    expect(buy('cow')).toBe(true)
    expect(buy('sprinkler')).toBe(true)
    expect(plant(0, 'wheat')).toBe(true)
    expect(buyDecor('lamp')).toBe(true)
    farm.inv.wheat = 1
    expect(addJob('mill', 'wheat')).toBe(true)
    expect(levelOf(farm.xp.points)).toBe(1)
    const save = savedNow()

    unlockAll(false)
    startFrom(save)
    expect(levelOf(farm.xp.points)).toBe(1)
    expect(farm.beds[0].crop).toBe('wheat')
    expect(animals('cows')).toBe(2)
    expect(farm.sprinkler).toBe(true)
    expect(farm.layout.stored.lamp).toBe(1)
    expect(farm.machines.mill.jobs).toEqual(['wheat'])

    // the wheat ripens (the sprinklers water it) and is harvested, the flour comes out, the second cow is milked, the
    // lamp is put down
    for (let k = 0; k < 90; k++) tick(1)
    expect(harvestBeds([0])).toBeGreaterThan(0)
    expect(collectMachine('mill')).toBe(1)
    expect(farm.inv.flour).toBe(1)
    expect(collect('cows', 1)).toBeGreaterThan(0)
    expect(placeDecor('lamp', { x: 2, z: 0, rot: 0 }).ok).toBe(true)
    // more of it is not bought: wheat again, flour again, a third cow
    farm.inv.wheat = 5
    expect(plant(0, 'wheat')).toBe(false)
    expect(addJob('mill', 'wheat')).toBe(false)
    expect(buy('cow')).toBe(false)
  })
})

describe('the locks off', () => {
  it('everything is open whatever the level: the tests’ default', () => {
    expect(openAtFirst).toBe(true)
    unlockAll(true)
    farm.coins = 50_000
    farm.inv.wheat = 5
    expect(levelOf(farm.xp.points)).toBe(1)
    for (const id of UNLOCK_IDS) expect(lockOf(id), id).toBeNull()
    for (const t of TRIES) expect(t.try(), t.what).toBe(true)
    expect(machineLock('oven')).toBeNull()
    expect(ovenSlot.try()).toBe(true)
    expect(opensOn(2)).toEqual([])
    expect(shopView().filter((v) => v.locked !== undefined)).toEqual([])
    expect(machineView('oven').recipes.filter((r) => r.locked !== undefined)).toEqual([])
  })
})
