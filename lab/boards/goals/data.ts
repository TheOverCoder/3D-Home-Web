import type { ProduceId } from '../../../src/farm/data'
import { GOAL_IDS, type GoalId } from '../../../src/farm/goals'
import type { FarmData } from '../../../src/farm/state'

// The goals board's states: the few numbers of a farm the goals read (what it got, what it sold and earned, the step
// each goal is on, its silo and barn), made into the board by the game's own pure code (goalsView, src/farm/goalsView.ts):
// so every count, target and reward here is one the game makes. A claim puts the goal on its next step, as claimGoal
// does in the game.

/** The part of a farm the goals read. */
export interface GoalsState {
  got: Partial<Record<ProduceId, number>>
  stats: { sold: number; earned: number; sent: number }
  goals: Partial<Record<GoalId, number>>
  storage: { silo: number; barn: number }
  inv: Partial<Record<ProduceId, number>>
}

/** The state as a farm, for the game's pure code (it reads only these numbers). */
export const asFarm = (s: GoalsState) =>
  ({ ...s, goals: Object.fromEntries(GOAL_IDS.map((id) => [id, s.goals[id] ?? 0])), stats: { harvested: 0, declined: 0, baked: 0, ...s.stats } }) as unknown as FarmData

/** A goal claimed: on to its next step (claimGoal in the game). */
export const claimed = (s: GoalsState, id: GoalId): GoalsState => ({ ...s, goals: { ...s.goals, [id]: (s.goals[id] ?? 0) + 1 } })

const H = (n: number) => ({ lettuce: n })

/** The first minutes: a few things done, every goal on its first step. */
export const START: GoalsState = { got: { ...H(4), egg: 2 }, stats: { sold: 6, earned: 40, sent: 0 }, goals: {}, storage: { silo: 1, barn: 1 }, inv: {} }
/** Several close to their count. */
export const CLOSE: GoalsState = {
  got: { lettuce: 15, carrot: 12, egg: 9, milk: 3 },
  stats: { sold: 18, earned: 262, sent: 0 },
  goals: { harvest: 1, earn: 1 },
  storage: { silo: 1, barn: 1 },
  inv: { plank: 1 },
}
/** Two reached and waiting to be claimed. */
export const READY: GoalsState = {
  got: { lettuce: 16, tomato: 15, egg: 12, milk: 6, flour: 1 },
  stats: { sold: 44, earned: 520, sent: 0 },
  goals: { harvest: 1, sell: 1, earn: 2, milk: 1 },
  storage: { silo: 1, barn: 1 },
  inv: {},
}
/** Far on: goals deep on their ladders, big counts. */
export const LATER: GoalsState = {
  got: { lettuce: 160, corn: 140, pumpkin: 112, egg: 140, milk: 88, wool: 70, flour: 60, cloth: 22, strawberry_cake: 13 },
  stats: { sold: 300, earned: 2400, sent: 15 },
  goals: { harvest: 5, eggs: 3, milk: 3, wool: 3, mill: 3, cloth: 2, cakes: 2, sell: 3, earn: 3, orders: 3 },
  storage: { silo: 3, barn: 2 },
  inv: {},
}
