// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { MACHINES, PRODUCE, PRODUCERS, STORES, type ProduceId, type ProducerId } from './data'
import { GOALS, GOAL_IDS, MOST_STEPS, boardGoals, goalById, goalNear, goalReward, goalTarget, goalsNow, goalsReady, nearestGoal, startStep, type GoalId } from './goals'
import { capacity, claimGoal, collect, farm, resetFarm, room, type FarmData } from './state'
import { OLD_SAVE, OLD_SAVE_2, playedSave, savedNow, seeded, startFrom } from './testSaves'

// The goals board (src/farm/goals.ts, GoalsPanel.tsx): ladders of counts that never end, each count reached claimed
// once for coins and the building material the silo or the barn is shortest of.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
})

describe('the goals', () => {
  it('each ladder climbs: every count higher than the one before, twice the last past its list, for as many steps as a save keeps', () => {
    for (const def of GOALS) {
      let last = 0
      for (let step = 0; step < MOST_STEPS; step++) {
        const t = goalTarget(def, step)
        expect(Number.isFinite(t) && t > last, `${def.id} step ${step}: ${t}`).toBe(true)
        last = t
      }
      expect(goalTarget(def, def.steps.length)).toBe(def.steps[def.steps.length - 1] * 2)
    }
  })

  it('a new farm starts every goal at its first count; a reached one is claimed once, for its coins and a material, and moves on', () => {
    expect(Object.values(farm.goals).every((s) => s === 0)).toBe(true)
    expect(claimGoal('eggs'), 'not reached yet').toBeNull()
    const def = goalById('eggs')
    farm.got.egg = goalTarget(def, 0)
    expect(goalsReady(farm)).toBe(1)
    const coins = farm.coins
    const reward = goalReward(def, 0, farm)
    const before = farm.inv[reward.item]
    expect(claimGoal('eggs')).toEqual(reward)
    expect(farm.coins).toBe(coins + reward.coins)
    expect(farm.inv[reward.item]).toBe(before + reward.count)
    expect(farm.goals.eggs).toBe(1)
    expect(claimGoal('eggs'), 'claimed: the next count is higher').toBeNull()
    expect(goalsReady(farm)).toBe(0)
  })

  it('the reward is the material the next level of the silo or the barn is shortest of, and goes in even past full', () => {
    // the barn's next level wants a brick, a plank and a nail: with planks and nails, bricks are short
    for (const m of [...STORES.barn.materials, ...STORES.silo.materials]) farm.inv[m] = 5
    farm.inv.brick = 0
    expect(goalReward(goalById('harvest'), 0, farm).item).toBe('brick')
    // the barn full: the material still goes in
    farm.inv.egg = capacity('barn')
    expect(room('barn')).toBeLessThanOrEqual(0)
    farm.got.lettuce = goalTarget(goalById('harvest'), 0)
    const r = claimGoal('harvest')!
    expect(r.item).toBe('brick')
    expect(farm.inv.brick).toBe(r.count)
    // higher steps give more of it
    expect(goalReward(goalById('harvest'), 4, farm).count).toBeGreaterThan(goalReward(goalById('harvest'), 0, farm).count)
  })

  it('a farm from before the goals starts each at the first count it has not reached: what it did before is not paid again', () => {
    startFrom({ ...OLD_SAVE, stats: { harvested: 500, sold: 130, earned: 2200, declined: 1, baked: 3 }, time: Date.now() })
    expect(farm.goals.sell).toBe(startStep(goalById('sell'), farm))
    expect(goalTarget(goalById('sell'), farm.goals.sell)).toBeGreaterThan(130)
    expect(goalTarget(goalById('earn'), farm.goals.earn)).toBeGreaterThan(2200)
    expect(goalsReady(farm)).toBe(0)
    // and kept as saved from then on
    farm.goals.sell = 0
    startFrom({ ...savedNow(), time: Date.now() })
    expect(farm.goals.sell).toBe(0)
  })

  it('the counts follow the farm: a harvest, what an animal gives, a surprise', () => {
    const p = farm.producers.hens
    p.stock = p.stock.map(() => 3)
    const n = collect('hens')
    expect(n).toBeGreaterThan(0)
    expect(farm.got[PRODUCERS.hens.good]).toBe(n)
    expect(goalById('eggs').measure(farm)).toBe(n)
  })

  it('the board shows the goals reached first, then those nearest to done, at most six', () => {
    farm.got.egg = goalTarget(goalById('eggs'), 0)
    farm.got.milk = goalTarget(goalById('milk'), 0) - 1
    const board = boardGoals(farm)
    expect(board.length).toBeLessThanOrEqual(6)
    expect(board[0].def.id).toBe('eggs')
    expect(board[0].done).toBe(true)
    expect(board[1].def.id).toBe('milk')
    expect(new Set(board.map((g) => g.def.id)).size).toBe(board.length)
    expect(board.every((g) => GOAL_IDS.includes(g.def.id))).toBe(true)
  })
})

/** What each goal counted before its rows said it as data (the closures it had), to hold the counts the same. */
const CROP_IDS = PRODUCE.filter((p) => !p.material && !Object.values(PRODUCERS).some((d) => d.good === p.id) && !Object.values(MACHINES).some((m) => m.recipes.some((r) => r.makes === p.id))).map(
  (p) => p.id,
)
const MATERIALS = PRODUCE.filter((p) => p.material).map((p) => p.id)
const madeBy = (machine: keyof typeof MACHINES) => [...new Set(MACHINES[machine].recipes.map((r) => r.makes))]
const sum = (f: FarmData, ids: readonly ProduceId[]) => ids.reduce((n, id) => n + (f.got[id] ?? 0), 0)
const fromAnimal = (id: ProducerId) => (f: FarmData) => f.got[PRODUCERS[id].good] ?? 0
const BEFORE: Record<Exclude<GoalId, 'fruit'>, (f: FarmData) => number> = {
  harvest: (f) => sum(f, CROP_IDS),
  eggs: fromAnimal('hens'),
  milk: fromAnimal('cows'),
  wool: fromAnimal('sheep'),
  lemons: fromAnimal('tree'),
  mill: (f) => sum(f, madeBy('mill')),
  cloth: (f) => sum(f, madeBy('loom')),
  cakes: (f) => sum(f, madeBy('oven')),
  sell: (f) => f.stats.sold,
  earn: (f) => f.stats.earned,
  orders: (f) => f.stats.sent,
  surprises: (f) => sum(f, MATERIALS),
}

describe('the goals as rows', () => {
  it('each counts what it always did: the same numbers on today’s farms', () => {
    const random = seeded(3)
    const farms: [string, () => void][] = [
      ['new', () => resetFarm()],
      ['played', () => startFrom({ ...playedSave(), time: Date.now() })],
      ['old', () => startFrom({ ...OLD_SAVE, time: Date.now() })],
      ['old 2', () => startFrom({ ...OLD_SAVE_2, time: Date.now() })],
      [
        'every good got',
        () => {
          resetFarm()
          for (const id of Object.keys(farm.got) as ProduceId[]) farm.got[id] = Math.floor(random() * 500)
          for (const k of Object.keys(farm.stats) as (keyof FarmData['stats'])[]) farm.stats[k] = Math.floor(random() * 5000)
        },
      ],
    ]
    for (const [name, start] of farms) {
      start()
      for (const [id, before] of Object.entries(BEFORE)) expect(goalById(id as GoalId).measure(farm), `${id} on ${name}`).toBe(before(farm))
      // and the first steps' reading of a goal is the same count
      for (const g of goalsNow(farm)) expect(g.have).toBe(g.def.measure(farm))
    }
  })

  it('Pick fruit: the fruit of the trees and bushes bought, never the lemons', () => {
    Object.assign(farm.got, { apple: 4, cherry: 3, raspberry: 2, lemon: 30 })
    expect(goalById('fruit').measure(farm)).toBe(9)
    farm.got.apple = goalTarget(goalById('fruit'), 0)
    expect(goalsNow(farm).find((g) => g.def.id === 'fruit')!.done).toBe(true)
    expect(claimGoal('fruit')).not.toBeNull()
    expect(farm.goals.fruit).toBe(1)
  })

  it('a new farm’s board shows what it can do first: the fruit comes last of the rows', () => {
    expect(GOAL_IDS[GOAL_IDS.length - 1]).toBe('fruit')
    expect(boardGoals(farm).map((g) => g.def.id)).not.toContain('fruit')
  })
})

describe('the nearest goal', () => {
  it('the one most of the way to its next count, not reached; how near it is, and almost there in its last stretch', () => {
    farm.got.egg = 9
    farm.got.milk = 3
    expect(nearestGoal(farm)?.def.id).toBe('eggs')
    const eggs = goalsNow(farm).find((g) => g.def.id === 'eggs')!
    expect(goalNear(eggs)).toEqual({ stop: 1, at: 10, left: 1, share: 0.9, almost: true })
    // reached, it waits to be claimed: the next nearest
    farm.got.egg = 10
    expect(goalNear(goalsNow(farm).find((g) => g.def.id === 'eggs')!)).toBeNull()
    expect(nearestGoal(farm)?.def.id).toBe('milk')
    // claimed, it is on its next count, from the one before
    claimGoal('eggs')
    const next = goalsNow(farm).find((g) => g.def.id === 'eggs')!
    expect(goalNear(next)).toMatchObject({ stop: 2, at: 30, left: 20, share: 0, almost: false })
  })
})
