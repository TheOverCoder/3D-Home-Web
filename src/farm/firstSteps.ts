// The first ten minutes (plans/first-hour.md, Part C): a short row of steps a new farm is walked through, one at a
// time — its words in the hint under the compass, a tap there walks you to its target, a small reward as it is done.
// Each step is read from the farm's own numbers (the goals board's measures where one counts it, src/farm/goals.ts),
// so a step the farm has done already is passed the moment it comes. A future step is a row of FIRST_STEPS. Pure:
// the farm keeps the record and pays (src/farm/state.ts), the hint draws it.

import { isObject, num } from '../lib/saved'
import type { ArtId } from '../ui/art'
import type { ProduceId } from './data'
import type { Prize } from './gifts'
import { goalById, type GoalId } from './goals'
import type { BedStage, FarmData } from './state'
import type { UnlockId } from './unlocks'
import { levelOf } from './xp'

export type StepId = 'plant' | 'eggs' | 'water' | 'harvest' | 'sell' | 'shear' | 'weave' | 'order'

/** How the farmer feels as he says a line: his face (`farmer-<mood>` in src/ui/art.ts, made by
 *  scripts/render-farmer-faces.mjs) and how he moves as it comes (src/farm/FarmerFace.tsx). */
export type FarmerMood = 'cheerful' | 'proud' | 'excited' | 'curious' | 'encouraging' | 'surprised' | 'laughing' | 'winking' | 'sighing'
export const FARMER_MOODS: readonly FarmerMood[] = ['cheerful', 'proud', 'excited', 'curious', 'encouraging', 'surprised', 'laughing', 'winking', 'sighing']

/** The hint's moments besides a step's own line: a step just done (its tick), the walk a tap started, the skip
 *  question, the last card ("All set!"), and a tap with nowhere to walk to yet. */
export type Moment = 'passed' | 'walk' | 'ask' | 'final' | 'nowhere'
export const MOMENT_MOODS: Readonly<Record<Moment, FarmerMood>> = {
  // well done: he beams and hops
  passed: 'proud',
  // off you go: a nod, that way
  walk: 'encouraging',
  // "Skip the tips?": a kind nod, either way is fine (never a plea to stay)
  ask: 'encouraging',
  // every step done: stars in his eyes
  final: 'excited',
  // nothing to walk to yet (no bed at that stage, no egg laid): a sigh, and the bubble shakes
  nowhere: 'sighing',
}

/** Where a tap on the hint walks you (src/lib/route/walking.ts, walkTo): an interactable by its id; where a good
 *  comes from (`placeFor` beside the order board's "Show me": the nearest with it ready, else the nearest); or the
 *  nearest bed at the first of these stages the farm has one at. */
export type StepTarget = { id: string } | { good: ProduceId } | { bed: readonly BedStage[] }

export interface StepDef {
  id: StepId
  /** the hint's words: a few, telling what to do, in the farmer's voice */
  say: string
  /** how he says them (his face and his move match the words) */
  mood: FarmerMood
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
 *  (both there on a new farm), and the first order sent — every lesson of the farm's loop, on what a new farm has.
 *  Each line is the farmer's, said as he feels it: hello and off we go (cheerful), the hens have laid (surprised),
 *  go on, water them (encouraging), the first crop is ripe (excited, stars in his eyes), a word in your ear about the
 *  buyers (winking), a sheep's haircut (laughing), what the loom makes (curious), the last one (proud). */
export const FIRST_STEPS: readonly StepDef[] = [
  {
    id: 'plant',
    say: "Let's plant some seeds!",
    mood: 'cheerful',
    pic: { art: 'seedling' },
    done: (f) => f.planted.length > 0,
    target: { bed: ['empty'] },
    reward: { coins: 10 },
    needs: ['crop:lettuce'],
  },
  { id: 'eggs', say: 'Ooh, eggs! Collect them', mood: 'surprised', pic: { item: 'egg' }, done: reached('eggs'), target: { good: 'egg' }, reward: { coins: 5 } },
  // (beds watered by the player: `stats.watered`; sprinklers water by themselves; a crop harvested was watered)
  {
    id: 'water',
    say: 'Now water your seedlings',
    mood: 'encouraging',
    pic: { art: 'droplet' },
    done: (f) => f.stats.watered > 0 || f.sprinkler || reached('harvest')(f),
    target: { bed: ['thirsty', 'growing'] },
    reward: { coins: 5 },
  },
  { id: 'harvest', say: 'Ripe! Harvest your crop', mood: 'excited', pic: { art: 'basket' }, done: reached('harvest'), target: { bed: ['ripe', 'thirsty', 'growing'] }, reward: { coins: 10 } },
  { id: 'sell', say: 'Psst… sell at the gate', mood: 'winking', pic: { art: 'people-queue' }, done: reached('sell'), target: { id: 'farm-queue' }, reward: { coins: 10 } },
  { id: 'shear', say: 'Haircut! Shear a sheep', mood: 'laughing', pic: { item: 'wool' }, done: reached('wool'), target: { good: 'wool' }, reward: { coins: 5 } },
  {
    id: 'weave',
    say: 'Weave cloth at the loom?',
    mood: 'curious',
    pic: { item: 'cloth' },
    done: reached('cloth'),
    target: { good: 'cloth' },
    reward: { coins: 10 },
    needs: ['recipe:loom:wool'],
  },
  { id: 'order', say: 'Last one: send an order!', mood: 'proud', pic: { art: 'tractor' }, done: reached('orders'), target: { id: 'farm-office' }, reward: { coins: 25 } },
]

/** How the farmer feels now: a step's line as he says it (its own mood), or one of the hint's moments. */
export const moodFor = (step: StepDef | null, moment: Moment | null): FarmerMood => (moment ? MOMENT_MOODS[moment] : (step?.mood ?? 'cheerful'))

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
  if (!isObject(raw)) return { step: FIRST_STEPS.length, over: true }
  const r = raw as Partial<Record<keyof StepsRecord, unknown>>
  const step = Math.min(FIRST_STEPS.length, Math.max(0, Math.floor(num(r.step, 0))))
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
