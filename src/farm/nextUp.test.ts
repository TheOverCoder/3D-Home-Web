// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIRST_STEPS, lineFor } from './firstSteps'
import { goalTarget, GOALS, goalById } from './goals'
import { nextUp, pickNext } from './nextUp'
import { farm, freezeDay, resetFarm, setDailyClock, setRandom, skipSteps } from './state'

// What is next for a farm (src/farm/nextUp.ts): the step a new farm is on first (as the farmer says it now), then a goal
// reached and waiting to be claimed (the board opens), else the nearest of the rest in minutes of play — the goal
// nearest its count, the next level that opens something, the next big thing to save for. Never empty.

const NOON = new Date(2026, 10, 2, 12).getTime()

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
  setRandom(() => 0.5)
  setDailyClock(() => NOON)
})
afterEach(() => {
  setDailyClock(null)
  setRandom(null)
  freezeDay(false)
})

describe('nextUp', () => {
  it('on a new farm: the step it is on, as the farmer says it, with its walk', () => {
    const { id, item } = pickNext(farm)
    expect(id).toBe('step')
    const line = lineFor(FIRST_STEPS[farm.firstSteps.step], farm)
    expect(item).toEqual({ pic: line.pic, words: line.say, go: line.target, minutes: 0 })
  })

  it('the step first, then a goal to claim, then the nearest to done', () => {
    // the step
    expect(pickNext(farm).id).toBe('step')
    expect(nextUp(farm).go).toEqual({ bed: ['empty'] })
    // the steps over: a goal reached waits, and the board opens for it
    skipSteps()
    const eggs = goalById('eggs')
    farm.got.egg = goalTarget(eggs, 0)
    const claim = pickNext(farm)
    expect(claim.id).toBe('claim')
    expect(claim.item).toMatchObject({ words: eggs.say(goalTarget(eggs, 0)), go: 'goals', minutes: 0 })
    // claimed: the nearest of the rest (the eggs' next count is now far; another goal nearer)
    farm.goals.eggs = 1
    const near = pickNext(farm)
    expect(['goal', 'unlock', 'saving']).toContain(near.id)
    expect(near.item.minutes).toBeGreaterThanOrEqual(0)
  })

  it('a page where the steps are quiet never names the step', () => {
    expect(pickNext(farm, { steps: false }).id).not.toBe('step')
  })

  it('names the goal nearest its count in minutes of play, with its count and its way there', () => {
    skipSteps()
    const eggs = goalById('eggs')
    farm.got.egg = goalTarget(eggs, 0) - 1
    const { id, item } = pickNext(farm)
    expect(id).toBe('goal')
    expect(item).toMatchObject({ words: eggs.say(goalTarget(eggs, 0)), have: goalTarget(eggs, 0) - 1, of: goalTarget(eggs, 0), go: { good: 'egg' } })
  })

  it('is never empty: past every goal, level and saving there is still something', () => {
    skipSteps()
    for (const g of GOALS) expect(nextUp(farm).words.length, g.id).toBeGreaterThan(0)
    expect(nextUp(farm).words).toBeTruthy()
  })
})
