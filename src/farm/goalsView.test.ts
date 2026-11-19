// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { GOALS, boardGoals, goalById, goalReward, goalTarget } from './goals'
import { ALMOST } from './road'
import { goalsView, howFar, ON_BOARD, onBoard } from './goalsView'
import { claimGoal, farm, resetFarm } from './state'

// What the goals board shows (src/farm/goalsView.ts, drawn by GoalsCard.tsx): every goal in the board's order, with the
// count its step began from, and the six on the board keeping the goal in the hand after a claim sorts it away.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
})

describe('the goals board as it is shown', () => {
  it('every goal, in the board order: the first six are the board, each with its count, its reward and where its step began', () => {
    farm.got.egg = 10
    farm.got.milk = 3
    const v = goalsView(farm)
    expect(v.goals.map((g) => g.id).sort()).toEqual(GOALS.map((g) => g.id).sort())
    expect(v.goals.slice(0, ON_BOARD).map((g) => g.id)).toEqual(boardGoals(farm).map((g) => g.def.id))
    const eggs = v.goals[0]
    expect(eggs).toMatchObject({ id: 'eggs', step: 0, target: 10, from: 0, have: 10, done: true, part: 1, words: 'Collect 10 eggs' })
    expect(eggs.reward).toEqual(goalReward(goalById('eggs'), 0, farm))
    expect(v.ready).toBe(1)
    expect(v.won).toBe(0)
  })

  it('a claim: the goal on its next step, begun from the count just reached, and one medal won', () => {
    farm.got.egg = 10
    claimGoal('eggs')
    const v = goalsView(farm)
    const eggs = v.goals.find((g) => g.id === 'eggs')!
    expect(eggs).toMatchObject({ step: 1, target: goalTarget(goalById('eggs'), 1), from: 10, done: false })
    expect(eggs.part).toBeCloseTo(10 / 30)
    expect(v.won).toBe(1)
    expect(v.ready).toBe(0)
  })

  it('the board keeps the goal in the hand in its last place when a claim has sorted it past the six', () => {
    const v = goalsView(farm)
    const last = v.goals[v.goals.length - 1]
    const shown = onBoard(v.goals, last.id)
    expect(shown).toHaveLength(ON_BOARD)
    expect(shown[ON_BOARD - 1].id).toBe(last.id)
    expect(shown.slice(0, ON_BOARD - 1)).toEqual(v.goals.slice(0, ON_BOARD - 1))
    // one already on the board, or none in the hand: the six as they are
    expect(onBoard(v.goals, v.goals[2].id)).toEqual(v.goals.slice(0, ON_BOARD))
    expect(onBoard(v.goals, null)).toEqual(v.goals.slice(0, ON_BOARD))
  })
})

describe('how far, in kind words, and almost there', () => {
  it('what is done while under half the way, then what is left; never “only”', () => {
    expect(howFar({ done: false, have: 4, target: 10, part: 0.4, left: 6 })).toBe('4 of 10')
    expect(howFar({ done: false, have: 5, target: 10, part: 0.5, left: 5 })).toBe('5 to go')
    expect(howFar({ done: false, have: 9, target: 10, part: 0.9, left: 1 })).toBe('1 to go')
    expect(howFar({ done: true, have: 12, target: 10, part: 1, left: 0 })).toBe('Reached!')
  })

  it('a goal in the last stretch of its step (from the count before) looks almost there; reached, it does not', () => {
    // eggs: the first count is 10, so the last 15 % begins at 8.5
    farm.got.egg = 8
    expect(goalsView(farm).goals.find((g) => g.id === 'eggs')).toMatchObject({ left: 2, almost: false })
    farm.got.egg = 9
    expect(goalsView(farm).goals.find((g) => g.id === 'eggs')).toMatchObject({ left: 1, almost: true })
    farm.got.egg = 10
    expect(goalsView(farm).goals.find((g) => g.id === 'eggs')).toMatchObject({ left: 0, almost: false, done: true })
    // on its next step (10 to 30), the stretch is counted from 10: almost from 27
    claimGoal('eggs')
    farm.got.egg = 26
    expect(goalsView(farm).goals.find((g) => g.id === 'eggs')?.almost).toBe(false)
    farm.got.egg = Math.ceil(10 + ALMOST * 20)
    expect(goalsView(farm).goals.find((g) => g.id === 'eggs')?.almost).toBe(true)
  })
})
