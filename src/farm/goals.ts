// The goals board (src/farm/GoalsPanel.tsx): a row for each thing the farm does — harvest, collect from each animal
// and the tree, make at each machine, sell, earn, send orders, find surprises — each a ladder of counts to reach. A
// count reached is claimed for its reward: coins, and the building material the next level of the silo or the barn is
// shortest of (so a reward is always a step on). Past its last listed count, each next count is twice the one before:
// the ladders never end. Pure: everything here reads the farm's numbers, nothing changes them (state.ts claims).

import type { ArtId } from '../ui/art'
import { MACHINES, PRODUCERS, PRODUCE, STORE_IDS, type ProduceId, type ProducerId } from './data'
import { nextLevel } from './storage'
import type { FarmData } from './state'

export type GoalId = 'harvest' | 'lemons' | 'eggs' | 'milk' | 'wool' | 'mill' | 'cloth' | 'cakes' | 'sell' | 'earn' | 'orders' | 'surprises'

export interface GoalDef {
  id: GoalId
  /** its picture: one of the farm's goods (its model), or a piece of interface art */
  pic: { item: ProduceId } | { art: ArtId }
  /** the words for a count: "Harvest 30 crops" */
  say: (n: number) => string
  /** how far the farm has got */
  measure: (f: FarmData) => number
  /** the counts to reach, one after another (then each twice the one before) */
  steps: number[]
  /** coins for each one counted (rounded; at least 1) */
  coinsPer: number
}

const CROP_IDS = PRODUCE.filter((p) => !p.material && !Object.values(PRODUCERS).some((d) => d.good === p.id) && !Object.values(MACHINES).some((m) => m.recipes.some((r) => r.makes === p.id))).map(
  (p) => p.id,
)
const MATERIALS = PRODUCE.filter((p) => p.material).map((p) => p.id)
const madeBy = (machine: keyof typeof MACHINES) => [...new Set(MACHINES[machine].recipes.map((r) => r.makes))]
const sum = (f: FarmData, ids: readonly ProduceId[]) => ids.reduce((n, id) => n + (f.got[id] ?? 0), 0)
const fromAnimal = (id: ProducerId) => (f: FarmData) => f.got[PRODUCERS[id].good] ?? 0

export const GOALS: GoalDef[] = [
  { id: 'harvest', pic: { art: 'seedling' }, say: (n) => `Harvest ${n} crops`, measure: (f) => sum(f, CROP_IDS), steps: [10, 30, 75, 150, 300], coinsPer: 0.5 },
  { id: 'eggs', pic: { item: 'egg' }, say: (n) => `Collect ${n} eggs`, measure: fromAnimal('hens'), steps: [10, 30, 75, 150], coinsPer: 0.5 },
  { id: 'milk', pic: { item: 'milk' }, say: (n) => `Milk ${n} bottles`, measure: fromAnimal('cows'), steps: [5, 15, 40, 100], coinsPer: 1 },
  { id: 'wool', pic: { item: 'wool' }, say: (n) => `Shear ${n} fleeces`, measure: fromAnimal('sheep'), steps: [5, 15, 40, 100], coinsPer: 1 },
  { id: 'lemons', pic: { item: 'lemon' }, say: (n) => `Pick ${n} lemons`, measure: fromAnimal('tree'), steps: [10, 30, 75, 150], coinsPer: 0.5 },
  { id: 'mill', pic: { item: 'flour' }, say: (n) => `Mill ${n} sacks`, measure: (f) => sum(f, madeBy('mill')), steps: [5, 15, 40, 100], coinsPer: 1 },
  { id: 'cloth', pic: { item: 'cloth' }, say: (n) => `Weave ${n} cloths`, measure: (f) => sum(f, madeBy('loom')), steps: [3, 10, 25, 60], coinsPer: 2 },
  { id: 'cakes', pic: { art: 'shortcake' }, say: (n) => `Bake ${n} cakes`, measure: (f) => sum(f, madeBy('oven')), steps: [2, 6, 15, 40], coinsPer: 4 },
  { id: 'sell', pic: { art: 'shopping-bags' }, say: (n) => `Sell ${n} goods`, measure: (f) => f.stats.sold, steps: [20, 60, 150, 400], coinsPer: 0.25 },
  { id: 'earn', pic: { art: 'coin' }, say: (n) => `Earn ${n} coins`, measure: (f) => f.stats.earned, steps: [100, 300, 1000, 3000], coinsPer: 0.05 },
  { id: 'orders', pic: { art: 'tractor' }, say: (n) => `Send ${n} ${n === 1 ? 'order' : 'orders'}`, measure: (f) => f.stats.sent, steps: [1, 3, 8, 20], coinsPer: 8 },
  { id: 'surprises', pic: { art: 'wrapped-gift' }, say: (n) => `Find ${n} surprises`, measure: (f) => sum(f, MATERIALS), steps: [3, 10, 25, 60], coinsPer: 2 },
]
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
  let item: ProduceId = MATERIALS[0]
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
