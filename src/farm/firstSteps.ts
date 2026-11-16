// The first ten minutes (plans/first-hour.md, Part C): a short row of steps a new farm is walked through, one at a
// time — its words in the hint under the compass, a tap there walks you to its target, a small reward as it is done.
// Each step is read from the farm's own numbers (the goals board's measures where one counts it, src/farm/goals.ts),
// so a step the farm has done already is passed the moment it comes. A future step is a row of FIRST_STEPS. Pure:
// the farm keeps the record and pays (src/farm/state.ts), the hint draws it.

import type { ArtId } from '../ui/art'
import type { ProduceId } from './data'
import type { Prize } from './gifts'
import { goalById, type GoalId } from './goals'
import type { BedStage, FarmData } from './state'
import type { UnlockId } from './unlocks'
import { levelOf } from './xp'

export type StepId = 'plant' | 'eggs' | 'water' | 'harvest' | 'sell' | 'shear' | 'weave' | 'order'

/** Where a tap on the hint walks you (src/lib/route/walking.ts, walkTo): an interactable by its id; where a good
 *  comes from (`placeFor` beside the order board's "Show me": the nearest with it ready, else the nearest); or the
 *  nearest bed at the first of these stages the farm has one at. */
export type StepTarget = { id: string } | { good: ProduceId } | { bed: readonly BedStage[] }

export interface StepDef {
  id: StepId
  /** the hint's words: a few, telling what to do */
  say: string
  /** its picture: one of the farm's goods (its model), or a piece of interface art */
  pic: { item: ProduceId } | { art: ArtId }
  /** done: the farm's numbers show it (never a count that can go down again) */
  done: (f: FarmData) => boolean
  target: StepTarget
  /** what doing it gives: coins, or goods into their building past full (as surprises go); never XP */
  reward: Prize
  /** what it needs open at level 1 (src/farm/unlocks.ts; the test holds the table to it) */
  needs?: readonly UnlockId[]
}

/** The farm reached a goal's count (the goals board's own measure). */
const reached =
  (goal: GoalId, n = 1) =>
  (f: FarmData) =>
    goalById(goal).measure(f) >= n

/** The steps, in order: a crop from seed to sale with an egg collected while it grows, a fleece woven at the loom
 *  (both there on a new farm), and the first order sent — every lesson of the farm's loop, on what a new farm has. */
export const FIRST_STEPS: readonly StepDef[] = [
  { id: 'plant', say: 'Plant some seeds', pic: { art: 'seedling' }, done: (f) => f.planted.length > 0, target: { bed: ['empty'] }, reward: { coins: 10 }, needs: ['crop:lettuce'] },
  { id: 'eggs', say: 'Collect the eggs', pic: { item: 'egg' }, done: reached('eggs'), target: { good: 'egg' }, reward: { coins: 5 } },
  // (beds watered by the player: `stats.watered`; sprinklers water by themselves; a crop harvested was watered)
  {
    id: 'water',
    say: 'Water your seedlings',
    pic: { art: 'droplet' },
    done: (f) => f.stats.watered > 0 || f.sprinkler || reached('harvest')(f),
    target: { bed: ['thirsty', 'growing'] },
    reward: { coins: 5 },
  },
  { id: 'harvest', say: 'Harvest your crop', pic: { art: 'basket' }, done: reached('harvest'), target: { bed: ['ripe', 'thirsty', 'growing'] }, reward: { coins: 10 } },
  { id: 'sell', say: 'Sell at the gate', pic: { art: 'people-queue' }, done: reached('sell'), target: { id: 'farm-queue' }, reward: { coins: 10 } },
  { id: 'shear', say: 'Shear a sheep', pic: { item: 'wool' }, done: reached('wool'), target: { good: 'wool' }, reward: { coins: 5 } },
  { id: 'weave', say: 'Weave cloth at the loom', pic: { item: 'cloth' }, done: reached('cloth'), target: { good: 'cloth' }, reward: { coins: 10 }, needs: ['recipe:loom:wool'] },
  { id: 'order', say: 'Send an order', pic: { art: 'tractor' }, done: reached('orders'), target: { id: 'farm-office' }, reward: { coins: 25 } },
]

/** The steps end by themselves on a farm this far on: they are for a new farm (and the daily gift, which waits for
 *  them, never waits on one that has grown past them). */
export const STEPS_UNTIL_LEVEL = 5

/** The farm's record (`farm.firstSteps`): the step it is on (FIRST_STEPS' index), and whether they are over (all
 *  done, skipped, or grown past). */
export interface StepsRecord {
  step: number
  over: boolean
}

/** A new farm's record: the first step. */
export const stepsFresh = (): StepsRecord => ({ step: 0, over: false })

/** The record as saved, made safe. A farm from before the steps (nothing saved) has done them: it never sees them. */
export function sanitizeSteps(raw: unknown): StepsRecord {
  if (!raw || typeof raw !== 'object') return { step: FIRST_STEPS.length, over: true }
  const r = raw as Partial<Record<keyof StepsRecord, unknown>>
  const step = typeof r.step === 'number' && Number.isFinite(r.step) ? Math.min(FIRST_STEPS.length, Math.max(0, Math.floor(r.step))) : 0
  return { step, over: r.over === true || step >= FIRST_STEPS.length }
}

/** The step to show now, or null once they are over. */
export const currentStep = (rec: StepsRecord): StepDef | null => (rec.over ? null : (FIRST_STEPS[rec.step] ?? null))

/**
 * Where the record goes from here: each step the farm has done is passed in turn (one done already as it comes is
 * passed with it), up to the first not done; past the last, or with the farm grown past them (STEPS_UNTIL_LEVEL),
 * they are over. The steps passed (the farm pays each one's reward), and the record after them. Never back: a record
 * over stays over.
 */
export function advance(rec: StepsRecord, f: FarmData): { rec: StepsRecord; passed: StepDef[] } {
  if (rec.over) return { rec, passed: [] }
  const passed: StepDef[] = []
  let step = rec.step
  while (step < FIRST_STEPS.length && FIRST_STEPS[step].done(f)) passed.push(FIRST_STEPS[step++])
  const over = step >= FIRST_STEPS.length || levelOf(f.xp.points) >= STEPS_UNTIL_LEVEL
  return { rec: passed.length || over ? { step, over } : rec, passed }
}

/** Skipped from the hint: over, nothing more paid. */
export const skipped = (rec: StepsRecord): StepsRecord => ({ step: rec.step, over: true })
