// The goals board (src/farm/GoalsPanel.tsx): a row for each thing the farm does — harvest, collect from each animal
// and the trees, make at each machine, sell, earn, send orders, find surprises — each a ladder of counts to reach. A
// count reached is claimed for its reward: coins, and the building material the next level of the silo or the barn is
// shortest of (so a reward is always a step on). Past its last listed count, each next count is twice the one before:
// the ladders never end. Each row says what it counts as data (src/farm/measure.ts), so a new ladder is a row. Pure:
// everything here reads the farm's numbers, nothing changes them (state.ts claims).

import type { ArtId } from '../ui/art'
import { PRODUCERS, STORE_IDS, type ProduceId } from './data'
import { countOf, GOODS, type Count } from './measure'
import { nearest, stops, type Nearest, type Road } from './road'
import { nextLevel } from './storage'
import type { FarmData } from './state'
import type { Target } from './walkTargets'

export type GoalId = 'harvest' | 'lemons' | 'eggs' | 'milk' | 'wool' | 'mill' | 'cloth' | 'cakes' | 'sell' | 'earn' | 'orders' | 'surprises' | 'fruit'

export interface GoalDef {
  id: GoalId
  /** its picture: one of the farm's goods (its model), or a piece of interface art */
  pic: { item: ProduceId } | { art: ArtId }
  /** the words for a count: "Harvest 30 crops" */
  say: (n: number) => string
  /** what it counts (src/farm/measure.ts) */
  count: Count
  /** how far the farm has got: its count, read on a farm (the first steps read it too) */
  measure: (f: FarmData) => number
  /** the counts to reach, one after another (then each twice the one before) */
  steps: number[]
  /** coins for each one counted (rounded; at least 1) */
  coinsPer: number
  /** where a tap walks you to count more (src/farm/walkTargets.ts; the welcome back's Go there): none where there is no
   *  one place for it (coins, surprises) */
  go?: Target
}

/** The goals as rows: what each counts, its words and picture, its ladder and its coins. */
const ROWS: Omit<GoalDef, 'measure'>[] = [
  {
    id: 'harvest',
    pic: { art: 'seedling' },
    say: (n) => `Harvest ${n} crops`,
    count: { got: 'crops' },
    steps: [10, 30, 75, 150, 300],
    coinsPer: 0.5,
    go: { bed: ['ripe', 'thirsty', 'growing', 'empty'] },
  },
  { id: 'eggs', pic: { item: 'egg' }, say: (n) => `Collect ${n} eggs`, count: { got: [PRODUCERS.hens.good] }, steps: [10, 30, 75, 150], coinsPer: 0.5, go: { good: PRODUCERS.hens.good } },
  { id: 'milk', pic: { item: 'milk' }, say: (n) => `Milk ${n} bottles`, count: { got: [PRODUCERS.cows.good] }, steps: [5, 15, 40, 100], coinsPer: 1, go: { good: PRODUCERS.cows.good } },
  { id: 'wool', pic: { item: 'wool' }, say: (n) => `Shear ${n} fleeces`, count: { got: [PRODUCERS.sheep.good] }, steps: [5, 15, 40, 100], coinsPer: 1, go: { good: PRODUCERS.sheep.good } },
  { id: 'lemons', pic: { item: 'lemon' }, say: (n) => `Pick ${n} lemons`, count: { got: [PRODUCERS.tree.good] }, steps: [10, 30, 75, 150], coinsPer: 0.5, go: { good: PRODUCERS.tree.good } },
  { id: 'mill', pic: { item: 'flour' }, say: (n) => `Mill ${n} sacks`, count: { made: 'mill' }, steps: [5, 15, 40, 100], coinsPer: 1, go: { good: 'flour' } },
  { id: 'cloth', pic: { item: 'cloth' }, say: (n) => `Weave ${n} cloths`, count: { made: 'loom' }, steps: [3, 10, 25, 60], coinsPer: 2, go: { good: 'cloth' } },
  { id: 'cakes', pic: { art: 'shortcake' }, say: (n) => `Bake ${n} cakes`, count: { made: 'oven' }, steps: [2, 6, 15, 40], coinsPer: 4, go: { id: 'farm-oven' } },
  { id: 'sell', pic: { art: 'shopping-bags' }, say: (n) => `Sell ${n} goods`, count: { stat: 'sold' }, steps: [20, 60, 150, 400], coinsPer: 0.25, go: { id: 'farm-queue' } },
  { id: 'earn', pic: { art: 'coin' }, say: (n) => `Earn ${n} coins`, count: { stat: 'earned' }, steps: [100, 300, 1000, 3000], coinsPer: 0.05 },
  { id: 'orders', pic: { art: 'tractor' }, say: (n) => `Send ${n} ${n === 1 ? 'order' : 'orders'}`, count: { stat: 'sent' }, steps: [1, 3, 8, 20], coinsPer: 8, go: { id: 'farm-office' } },
  { id: 'surprises', pic: { art: 'wrapped-gift' }, say: (n) => `Find ${n} surprises`, count: { got: 'materials' }, steps: [3, 10, 25, 60], coinsPer: 2 },
  // the fruit of the trees and bushes bought from the edit mode's shop (the lemons have their own)
  { id: 'fruit', pic: { item: 'apple' }, say: (n) => `Pick ${n} fruit`, count: { got: 'fruit' }, steps: [10, 30, 75, 150, 300], coinsPer: 0.5 },
]
export const GOALS: GoalDef[] = ROWS.map((row) => ({ ...row, measure: (f: FarmData) => countOf(f, row.count) }))
export const GOAL_IDS = GOALS.map((g) => g.id)
export const goalById = (id: GoalId) => GOALS.find((g) => g.id === id)!

/** The most steps a ladder is ever climbed (past this its counts are past any number a save keeps). */
export const MOST_STEPS = 60

/** The count to reach at a step of a ladder (0: the first). */
export function goalTarget(def: GoalDef, step: number) {
  const s = def.steps
  if (step < s.length) return s[step]
  return s[s.length - 1] * 2 ** (step - s.length + 1)
}

/** The step a farm from before the goals starts at: the first count it has not reached yet (what it did before is
 *  not paid for again). */
export function startStep(def: GoalDef, f: FarmData) {
  const have = def.measure(f)
  let step = 0
  while (step < MOST_STEPS && goalTarget(def, step) <= have) step++
  return step
}

/** What reaching a step gives: coins for the count, and the building material the next level of the silo or the barn
 *  is shortest of (the one first in line when none is short), more of it the higher the step. */
export function goalReward(def: GoalDef, step: number, f: FarmData): { coins: number; item: ProduceId; count: number } {
  const coins = Math.max(1, Math.round(goalTarget(def, step) * def.coinsPer))
  let item: ProduceId = GOODS.materials[0]
  let short = -Infinity
  for (const store of STORE_IDS)
    for (const need of nextLevel(store, f.storage[store]).needs) {
      const s = need.count - (f.inv[need.item] ?? 0)
      if (s > short) {
        short = s
        item = need.item
      }
    }
  return { coins, item, count: 1 + Math.floor(step / 2) }
}

export interface GoalNow {
  def: GoalDef
  step: number
  target: number
  have: number
  done: boolean
}

/** Each goal as it stands: the step it is on, its count to reach, how far the farm has got. */
export const goalsNow = (f: FarmData): GoalNow[] =>
  GOALS.map((def) => {
    const step = f.goals[def.id] ?? 0
    const target = goalTarget(def, step)
    const have = def.measure(f)
    return { def, step, target, have, done: have >= target }
  })

/** The goals shown on the board: those reached first, then those nearest to done (the share of the way from the step
 *  before), at most `most`. */
export function boardGoals(f: FarmData, most = 6): GoalNow[] {
  const share = (g: GoalNow) => {
    const from = g.step > 0 ? goalTarget(g.def, g.step - 1) : 0
    return Math.max(0, (g.have - from) / Math.max(1, g.target - from))
  }
  return goalsNow(f)
    .sort((a, b) => Number(b.done) - Number(a.done) || share(b) - share(a) || GOAL_IDS.indexOf(a.def.id) - GOAL_IDS.indexOf(b.def.id))
    .slice(0, most)
}

/** How many goals are reached and wait to be claimed. */
export const goalsReady = (f: FarmData) => goalsNow(f).filter((g) => g.done).length

/** A goal's counts as a road (src/farm/road.ts), from its first up to the one it is on: how near that one is. */
export const goalRoad = (def: GoalDef, step: number): Road => stops(step + 1, (k) => goalTarget(def, k - 1))

/** How near a goal is to its count: the share of the way from the count before, what is left, almost there. Null once
 *  it is reached. */
export const goalNear = (g: GoalNow): Nearest | null => nearest(goalRoad(g.def, g.step), g.have)

/** The goal nearest to its next count and not reached yet: the most of the way there from its count before (the
 *  first row breaks a tie). Null when none is on its way (each reached, waiting to be claimed). */
export function nearestGoal(f: FarmData): GoalNow | null {
  let best: { g: GoalNow; share: number } | null = null
  for (const g of goalsNow(f)) {
    const near = goalNear(g)
    if (near && (!best || near.share > best.share)) best = { g, share: near.share }
  }
  return best?.g ?? null
}
