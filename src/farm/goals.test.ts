// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { PRODUCERS, STORES } from './data'
import { GOALS, GOAL_IDS, MOST_STEPS, boardGoals, goalById, goalReward, goalTarget, goalsReady, startStep } from './goals'
import { capacity, claimGoal, collect, farm, resetFarm, room } from './state'
import { OLD_SAVE, savedNow, startFrom } from './testSaves'

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
