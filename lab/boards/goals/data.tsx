import { m } from 'motion/react'
import type { ProduceId } from '../../../src/farm/data'
import { boardGoals, goalReward, goalsReady, goalTarget, GOAL_IDS, type GoalId } from '../../../src/farm/goals'
import type { FarmData } from '../../../src/farm/state'
import { flyCoins } from '../../../src/fx/coins'
import { coinsToFly } from '../../../src/fx/fx'
import { art, type ArtId } from '../../../src/ui/art'
import { burst } from '../../../src/ui/burst'
import { ItemPic } from '../../../src/ui/ItemPic'
import { EASE } from '../../../src/ui/motion'
import type { Act } from '../../board'

// The goals board's data, made by the game's own pure code (src/farm/goals.ts: boardGoals, goalTarget, goalReward)
// from the few numbers of a farm the goals read (what it got, what it sold and earned, the step each goal is on, its
// silo and barn): so every count, target and reward here is one the game makes. A claim puts the goal on its next
// step, as claimGoal does in the game.

/** The part of a farm the goals read. */
export interface Farmish {
  got: Partial<Record<ProduceId, number>>
  stats: { sold: number; earned: number; sent: number }
  goals: Partial<Record<GoalId, number>>
  storage: { silo: number; barn: number }
  inv: Partial<Record<ProduceId, number>>
}

export interface GoalRow {
  id: GoalId
  pic: { item: ProduceId } | { art: ArtId }
  /** "Harvest 30 crops" */
  words: string
  step: number
  target: number
  /** the count this step began from (the step before's target): the part of the bar already yours when it began */
  from: number
  have: number
  done: boolean
  /** how far, 0..1, of the whole count (have / target, as the game's bar) */
  part: number
  /** how far, 0..1, of this step's own way (from → target) */
  stepPart: number
  reward: { coins: number; item: ProduceId; count: number }
  /** the step after this one: its count and how much of it is already there (endowed progress after a claim) */
  after: { target: number; part: number }
}

export interface GoalsState {
  farm: Farmish
  rows: GoalRow[]
  ready: number
}

const asFarm = (f: Farmish) => ({ ...f, stats: { harvested: 0, declined: 0, baked: 0, ...f.stats } }) as unknown as FarmData

export function goalsState(farm: Farmish): GoalsState {
  const f = asFarm({ ...farm, goals: Object.fromEntries(GOAL_IDS.map((id) => [id, farm.goals[id] ?? 0])) })
  const rows = boardGoals(f).map((g): GoalRow => {
    const from = g.step > 0 ? goalTarget(g.def, g.step - 1) : 0
    const next = goalTarget(g.def, g.step + 1)
    return {
      id: g.def.id,
      pic: g.def.pic,
      words: g.def.say(g.target),
      step: g.step,
      target: g.target,
      from,
      have: g.have,
      done: g.done,
      part: Math.min(1, g.have / g.target),
      stepPart: Math.max(0, Math.min(1, (g.have - from) / Math.max(1, g.target - from))),
      reward: goalReward(g.def, g.step, f),
      after: { target: next, part: Math.min(1, g.have / next) },
    }
  })
  return { farm, rows, ready: goalsReady(f) }
}

/** A goal claimed: on to its next step (claimGoal in the game). */
export const claimed = (s: GoalsState, id: GoalId): GoalsState => goalsState({ ...s.farm, goals: { ...s.farm.goals, [id]: (s.farm.goals[id] ?? 0) + 1 } })

/** Every goal reached claimed at once, a step each (SAMPLE for "Claim all", E: in the game a claimGoal for each). */
export const claimedAll = (s: GoalsState): GoalsState => {
  const goals = { ...s.farm.goals }
  for (const r of s.rows) if (r.done) goals[r.id] = (goals[r.id] ?? 0) + 1
  return goalsState({ ...s.farm, goals })
}

/** The medal of a step (F): bronze, silver, gold, platinum, then diamond with a star for each step past it. The step
 *  is the game's; the metal is how F pictures it. */
export const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const
export const tierOf = (step: number) => TIERS[Math.min(step, TIERS.length - 1)]
export const starsOf = (step: number) => Math.max(0, step - (TIERS.length - 1))

/** What a claim does on the screen, as the game's would: the coins fly from where it was pressed to the coin chip, one
 *  burst from it, and the state moves on. */
export function claim(s: GoalsState, act: Act<GoalsState>, row: GoalRow, el: HTMLElement, after = 0) {
  const r = el.getBoundingClientRect()
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    flyCoins(r.left + r.width / 2, r.top + r.height / 2, coinsToFly(row.reward.coins))
    burst(el, { count: 46, spread: 70, power: 26 })
  }
  setTimeout(() => act.set(claimed(s, row.id)), after)
}

/** A goal's picture: the good it is about (its model), or a piece of interface art. */
export const GoalPic = ({ row, className = '' }: { row: GoalRow; className?: string }) =>
  'item' in row.pic ? (
    <ItemPic id={row.pic.item} className={className} />
  ) : (
    <span className={`item-pic ${className}`}>
      <img className="art" src={art(row.pic.art)} alt="" draggable={false} />
    </span>
  )

/** A ring round a picture that fills as far as the goal has come; its last quarter warms; done, it is the leaf's. */
export function Ring({ part, done, size = 64, stroke = 6, delay = 0.15 }: { part: number; done: boolean; size?: number; stroke?: number; delay?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg className={`goal-ring${done ? ' done' : part >= 0.75 ? ' warm' : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="goal-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      <m.circle
        className="goal-ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.max(0.02, part)) }}
        transition={{ delay, duration: 0.8, ease: EASE.out }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

/** What a goal gives: its coins, and the building material with its count. */
export const Reward = ({ row, className = '' }: { row: GoalRow; className?: string }) => (
  <span className={`goal-reward ${className}`} aria-label={`Gives ${row.reward.coins} coins and ${row.reward.count} ${row.reward.item}`}>
    <span className="farm-coins">
      <img src={art('coin')} alt="" />
      {row.reward.coins}
    </span>
    <ItemPic id={row.reward.item} count={row.reward.count} />
  </span>
)

/** The words for how far, by the small-area rule (lab/CRAFT.md): under half what is done, past it what is left. */
export function howFar(row: GoalRow) {
  if (row.done) return 'Reached!'
  const left = row.target - row.have
  if (row.part >= 0.75) return `Only ${left} more!`
  if (row.part >= 0.5) return `${left} to go`
  return `${row.have} of ${row.target}`
}

// ── states: a farm's own numbers at four moments ──

const H = (n: number) => ({ lettuce: n })

/** The first minutes: a few things done, every goal on its first step. */
export const START = goalsState({ got: { ...H(4), egg: 2 }, stats: { sold: 6, earned: 40, sent: 0 }, goals: {}, storage: { silo: 1, barn: 1 }, inv: {} })
/** Several close to their count. */
export const CLOSE = goalsState({
  got: { lettuce: 15, carrot: 12, egg: 9, milk: 3 },
  stats: { sold: 18, earned: 262, sent: 0 },
  goals: { harvest: 1, earn: 1 },
  storage: { silo: 1, barn: 1 },
  inv: { plank: 1 },
})
/** Two reached and waiting to be claimed. */
export const READY = goalsState({
  got: { lettuce: 16, tomato: 15, egg: 12, milk: 6, flour: 1 },
  stats: { sold: 44, earned: 520, sent: 0 },
  goals: { harvest: 1, sell: 1, earn: 2, milk: 1 },
  storage: { silo: 1, barn: 1 },
  inv: {},
})
/** Far on: goals deep on their ladders, big counts. */
export const LATER = goalsState({
  got: { lettuce: 160, corn: 140, pumpkin: 112, egg: 140, milk: 88, wool: 70, flour: 60, cloth: 22, strawberry_cake: 13 },
  stats: { sold: 300, earned: 2400, sent: 15 },
  goals: { harvest: 5, eggs: 3, milk: 3, wool: 3, mill: 3, cloth: 2, cakes: 2, sell: 3, earn: 3, orders: 3 },
  storage: { silo: 3, barn: 2 },
  inv: {},
})
