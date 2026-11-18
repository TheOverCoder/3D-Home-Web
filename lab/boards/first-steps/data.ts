import type { ProduceId } from '../../../src/farm/data'
import { FIRST_STEPS, type StepDef, type StepId } from '../../../src/farm/firstSteps'
import { iconUrl } from '../../../src/farm/icons'
import { xpAt } from '../../../src/farm/xp'
import { art } from '../../../src/ui/art'
import { atHour, type TopState } from '../top/parts'

// What the "first-steps" board shows: the game's own steps (src/farm/firstSteps.ts, FIRST_STEPS: their words, pictures,
// rewards and order) on a new farm. The farm's coins at each step are what a new farm would have there (20 to begin
// with, seeds bought, the steps' rewards and a first sale in). What the game does not have is marked SAMPLE: the lab's
// words for where a tap walks you (the game walks there: walkTo(stepTarget(step.target))) and for its stand-in of the
// action that does a step.

export interface StepsState {
  /** the step shown (FIRST_STEPS' index) */
  step: number
  /** the farm's coins as it opens */
  coins: number
  /** the farm's level */
  level: number
  /** what plays as it opens: the walk under way (the hint tapped), the step passing by itself, the skip question, the
   *  top column full (a toast, the level's show and the first hint over the step) */
  play?: 'walk' | 'pass' | 'skip' | 'full'
}

export const STEPS = FIRST_STEPS

/** A step's picture: one of the farm's goods (its model), or a piece of interface art. */
export const picOf = (s: StepDef) => ('item' in s.pic ? iconUrl(s.pic.item) : art(s.pic.art))

/** What doing a step pays: coins, or goods (none of today's rows). */
export const rewardOf = (s: StepDef): { coins: number } | { item: ProduceId; n: number } => s.reward
export const coinsOf = (s: StepDef) => ('coins' in s.reward ? s.reward.coins : 0)
/** Every step's coins together (the last card's sum). */
export const ALL_COINS = FIRST_STEPS.reduce((n, s) => n + coinsOf(s), 0)

/** SAMPLE (the lab's note): where a tap on the hint walks you, in words (the game walks you there). */
export const WALKS_TO: Record<StepId, string> = {
  plant: 'לערוגה הריקה הקרובה',
  eggs: 'לקן של התרנגולות',
  water: 'לערוגה שצמאה למים',
  harvest: 'לערוגה שהבשילה',
  sell: 'לתור בשער',
  shear: 'לכבשה הקרובה',
  weave: 'לנול',
  order: 'למשרד, להזמנות',
  long: 'לערוגה פנויה',
}

/** SAMPLE (the lab's stand-in for the action button): what doing the step is, in words. */
export const DOES: Record<StepId, string> = {
  plant: 'לשתול',
  eggs: 'לאסוף ביצים',
  water: 'להשקות',
  harvest: 'לקצור',
  sell: 'למכור בשער',
  shear: 'לגזוז כבשה',
  weave: 'לארוג בד',
  order: 'לשלוח הזמנה',
  long: 'לזרוע יבול ארוך',
}

/** The dashboard behind (lab/boards/top, D: the game's top today) for a new farm at this step. */
export function topFor(s: StepsState): TopState {
  const started = s.step > 0
  return {
    coins: s.coins,
    xp: xpAt(s.level) + (s.level > 1 ? 4 : s.step * 3),
    paid: s.level,
    line: s.step >= 4 ? { n: 2, level: 0 } : started ? { n: 0, level: 0 } : null,
    silo: { n: s.step >= 4 ? 8 : 0, level: 1 },
    barn: { n: s.step >= 2 ? 3 : 0, level: 1 },
    goals: 0,
    t: atHour(11),
    heading: 154,
    marks: s.step === 1 ? [{ item: 'egg', count: 2, deg: 196 }] : [],
    hud: 'all',
  }
}
