import { describe, expect, it } from 'vitest'
import { CROPS, LEVELS, MACHINES, MACHINE_IDS, PRODUCERS, PRODUCER_IDS, START_COINS, UPGRADES, fullHerd, type ProduceId } from './data'
import { SHOP } from './decor'
import { PARCELS, PARCEL_IDS } from './layout'
import { UNLOCKS, UNLOCK_IDS, herdSteps, herdUnlock, lockedAt, machineOpensAt, openedBetween, opensAt, recipeUnlock, unlockLevel, unlockName, type UnlockId } from './unlocks'

// What each level opens (src/farm/unlocks.ts): one row for every thing a farm buys, plants or puts into a machine,
// nothing open before what it needs, and the first hour opening something at every level.

/** Every thing the table must hold, from the tables it comes from: a new row there needs a row in UNLOCKS. */
const EVERY: string[] = [
  'bed',
  ...CROPS.map((c) => `crop:${c.id}`),
  ...UPGRADES.map((u) => `upgrade:${u.id}`),
  ...MACHINE_IDS.flatMap((m) => MACHINES[m].recipes.map((r) => `recipe:${m}:${r.id}`)),
  ...Object.keys(SHOP).map((k) => `decor:${k}`),
  ...PARCEL_IDS.map((p) => `parcel:${p}`),
  ...PRODUCER_IDS.flatMap((p) => herdSteps(p).map((n) => herdUnlock(p, n))),
]

/** The level a good can first be had at: a crop's seeds, what a machine makes (its first recipe that makes it), what a
 *  new farm's tree and animals give (from the start). */
function goodOpensAt(good: ProduceId): number {
  if (CROPS.some((c) => c.id === good)) return unlockLevel(`crop:${good}` as UnlockId)
  const made = MACHINE_IDS.flatMap((m) => MACHINES[m].recipes.filter((r) => r.makes === good).map((r) => unlockLevel(recipeUnlock(m, r.id))))
  if (made.length) return Math.min(...made)
  if (Object.values(PRODUCERS).some((p) => p.good === good && !p.plant)) return 1
  // a fruit tree's or bush's (or the hive's): as its kind opens in the edit mode's shop
  const plants = Object.values(PRODUCERS).filter((p) => p.good === good && p.plant)
  if (plants.length) return Math.min(...plants.map((p) => unlockLevel(`decor:${p.plant!}`)))
  throw new Error(`${good}: nowhere to get it`)
}

describe('what each level opens', () => {
  it('holds every thing bought, planted or put into a machine, once, each at a whole level from 1 to the top', () => {
    expect([...UNLOCK_IDS].sort()).toEqual([...EVERY].sort())
    for (const id of UNLOCK_IDS) expect(Number.isInteger(UNLOCKS[id]) && UNLOCKS[id] >= 1 && UNLOCKS[id] <= LEVELS.max, id).toBe(true)
  })

  it('opens nothing before what it needs: a recipe after its ingredients, a field after the land it lies beyond', () => {
    for (const m of MACHINE_IDS)
      for (const r of MACHINES[m].recipes)
        for (const good of Object.keys(r.needs) as ProduceId[]) expect(goodOpensAt(good), `${m}:${r.id} needs ${good}`).toBeLessThanOrEqual(unlockLevel(recipeUnlock(m, r.id)))
    for (const p of PARCEL_IDS) {
      const after = PARCELS[p].after
      if (after) expect(Math.min(...after.map((a) => unlockLevel(`parcel:${a}`))), p).toBeLessThanOrEqual(unlockLevel(`parcel:${p}`))
    }
    // the west field comes after the east beds (the shop lists them so)
    expect(unlockLevel('upgrade:east')).toBeLessThanOrEqual(unlockLevel('upgrade:west'))
    // an animal past the herd full after the one before it, and after its herd's upgrade
    for (const p of PRODUCER_IDS) {
      const up = UPGRADES.find((u) => u.herd === p)
      let before = up ? unlockLevel(`upgrade:${up.id}`) : 1
      for (const n of herdSteps(p)) {
        expect(unlockLevel(herdUnlock(p, n)), `${p}'s ${n}`).toBeGreaterThan(before)
        before = unlockLevel(herdUnlock(p, n))
      }
      expect(herdSteps(p).length, p).toBe(PRODUCERS[p].herd ? PRODUCERS[p].herd!.max - fullHerd(p) : 0)
    }
  })

  it('a new farm can start: seeds it can pay for and a bed to build open at level 1', () => {
    const crops = CROPS.filter((c) => lockedAt(`crop:${c.id}`, 1) === null)
    expect(crops.length).toBeGreaterThan(0)
    expect(Math.min(...crops.map((c) => c.seedCost))).toBeLessThanOrEqual(START_COINS)
    expect(lockedAt('bed', 1)).toBeNull()
  })

  // the cadence (update-v1/missions/01-loop-economy.md, Foundation 6; JOURNEY.md fix 8): something new at every level
  // from 2 to 30, then at least every second level up to 45, and past it no gap over three levels
  it('every level from 2 to 30 opens something, then every second level at least to 45, then every third; each thing at exactly one level', () => {
    const top = Math.max(...Object.values(UNLOCKS))
    expect(top, 'the rows reach 45').toBeGreaterThanOrEqual(45)
    for (let level = 2; level <= 30; level++) expect(opensAt(level).length, `level ${level}`).toBeGreaterThan(0)
    const rows = Array.from({ length: top - 29 }, (_, k) => 30 + k).filter((level) => opensAt(level).length > 0)
    for (let k = 1; k < rows.length; k++) expect(rows[k] - rows[k - 1], `from level ${rows[k - 1]} to ${rows[k]}`).toBeLessThanOrEqual(rows[k] <= 45 ? 2 : 3)
    const all = Array.from({ length: top }, (_, k) => opensAt(k + 1)).flat()
    expect(all.length).toBe(UNLOCK_IDS.length)
    expect(new Set(all).size).toBe(UNLOCK_IDS.length)
  })

  it('locked says the level it opens at, until that level; a machine opens with its first recipe', () => {
    expect(lockedAt('crop:wheat', 1)).toBe(UNLOCKS['crop:wheat'])
    expect(lockedAt('crop:wheat', UNLOCKS['crop:wheat'])).toBeNull()
    expect(lockedAt('crop:lettuce', 1)).toBeNull()
    for (const m of MACHINE_IDS) expect(machineOpensAt(m)).toBe(Math.min(...MACHINES[m].recipes.map((r) => UNLOCKS[recipeUnlock(m, r.id)])))
  })

  it('what levels reached together opened, one reveal for each level that opened something', () => {
    expect(openedBetween(1, 2)).toEqual([{ level: 2, opens: opensAt(2) }])
    expect(openedBetween(1, 4).map((o) => o.level)).toEqual([2, 3, 4])
    expect(openedBetween(3, 3)).toEqual([])
    // past the table's last row nothing more; and with everything open (the farm's answer then), nothing at all
    const last = Math.max(...Object.values(UNLOCKS))
    expect(openedBetween(last, last + 5)).toEqual([])
    expect(openedBetween(1, 6, () => [])).toEqual([])
  })

  it('names each thing in a few words', () => {
    for (const id of UNLOCK_IDS) expect(unlockName(id).length, id).toBeGreaterThan(0)
    expect(unlockName('crop:wheat')).toBe('Wheat')
    expect(unlockName('recipe:mill:wheat')).toBe('Flour')
    expect(unlockName('recipe:oven:lemon_cake')).toBe('Lemon cake')
    expect(unlockName('upgrade:cow')).toBe('Another cow')
    expect(unlockName('decor:path')).toBe('Stone path')
    expect(unlockName('parcel:north')).toBe('North meadow')
    expect(unlockName('herd:cows:4')).toBe('Another cow')
    expect(unlockName('upgrade:north')).toBe('North beds')
  })
})
