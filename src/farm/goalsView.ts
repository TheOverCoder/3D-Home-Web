import type { ArtId } from '../ui/art'
import type { ProduceId } from './data'
import { boardGoals, GOALS, goalReward, goalsReady, goalTarget, type GoalId } from './goals'
import type { FarmData } from './state'

// What the goals board shows (./GoalsCard.tsx draws it), from the farm's numbers alone: pure, so the design lab (lab/)
// makes its states from a few numbers, as the game does from the farm (./GoalsPanel.tsx).

/** A goal as the board shows it: its picture, its words, the step it is on, how far, and what reaching it gives. */
export interface GoalView {
  id: GoalId
  pic: { item: ProduceId } | { art: ArtId }
  /** "Collect 10 eggs" */
  words: string
  /** the step it is on (0: its first count); each step reached is a gold medal won */
  step: number
  target: number
  /** the count this step began from (the step before's target): already yours when it began */
  from: number
  have: number
  done: boolean
  /** how far, 0..1, of the whole count (have / target) */
  part: number
  reward: { coins: number; item: ProduceId; count: number }
}

export interface GoalsView {
  /** every goal, in the board's order: those reached first, then those nearest to done */
  goals: GoalView[]
  /** how many are reached and wait to be claimed */
  ready: number
  /** the medals won: every step reached, of every goal */
  won: number
}

/** How many goals the board shows at once (boardGoals). */
export const ON_BOARD = 6

export function goalsView(f: FarmData): GoalsView {
  const goals = boardGoals(f, GOALS.length).map((g): GoalView => {
    const have = g.have
    return {
      id: g.def.id,
      pic: g.def.pic,
      words: g.def.say(g.target),
      step: g.step,
      target: g.target,
      from: g.step > 0 ? goalTarget(g.def, g.step - 1) : 0,
      have,
      done: g.done,
      part: Math.min(1, have / g.target),
      reward: goalReward(g.def, g.step, f),
    }
  })
  return { goals, ready: goalsReady(f), won: Object.values(f.goals).reduce((n, k) => n + (k ?? 0), 0) }
}

/** The goals on the board: the first six, and the one in the hand (`keep`) in the last place when a claim has sorted it
 *  past them, so a medal just claimed stays where it is. */
export function onBoard(goals: GoalView[], keep?: GoalId | null): GoalView[] {
  const top = goals.slice(0, ON_BOARD)
  if (!keep || top.some((g) => g.id === keep)) return top
  const held = goals.find((g) => g.id === keep)
  return held ? [...top.slice(0, ON_BOARD - 1), held] : top
}
