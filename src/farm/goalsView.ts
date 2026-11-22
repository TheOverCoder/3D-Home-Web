import type { ArtId } from '../ui/art'
import type { ProduceId } from './data'
import { boardGoals, GOALS, goalNear, goalReward, goalsReady, goalTarget, type GoalId } from './goals'
import type { FarmData } from './state'

// What the goals board shows (./GoalsCard.tsx draws it), from the farm's numbers alone: pure, so the design lab (lab/)
// makes its states from a few numbers, as the game does from the farm (./GoalsPanel.tsx). How far a goal has come is
// said kindly — what is done while under half the way, then what is left ("8 to go"), never "only" — and its last
// stretch (src/farm/road.ts, ALMOST: the last 15 % from the count before) has an "almost there" look.

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
  /** how many are left to its count (0 once reached) */
  left: number
  /** in the last stretch of its step, from the count before (not reached yet): the "almost there" look */
  almost: boolean
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
      left: Math.max(0, g.target - have),
      almost: !g.done && !!goalNear(g)?.almost,
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

/** After a claim, the goal to show next: the next one on the board (from the one just claimed, round to the first)
 *  that has its prize waiting; the one just claimed only when nothing else waits (it stays in the hand on its next
 *  step), and none (stay) when nothing waits at all. */
export function nextToClaim(rows: readonly Pick<GoalView, 'id' | 'done'>[], from: GoalId): GoalId | null {
  const k = rows.findIndex((g) => g.id === from)
  for (let step = 1; step <= rows.length; step++) {
    const g = rows[(Math.max(0, k) + step) % rows.length]
    if (g.done && g.id !== from) return g.id
  }
  return null
}

/** How far a goal has come, in kind words (the small-area rule): what is done while under half the way, then what is
 *  left — "4 of 10", "8 to go", "Reached!". */
export function howFar(g: Pick<GoalView, 'done' | 'have' | 'target' | 'part' | 'left'>): string {
  if (g.done) return 'Reached!'
  return g.part >= 0.5 ? `${g.left} to go` : `${g.have} of ${g.target}`
}
