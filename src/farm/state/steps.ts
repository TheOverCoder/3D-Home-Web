import { FIRST_STEPS, STEPS_UNTIL_LEVEL, advance, currentStep, skipped, type StepDef } from '../firstSteps'
import { levelOf } from '../xp'
import { onHere } from '../../lib/quiet'
import { bump, farm, save } from './core'
import { give } from './rewards'

// A new farm's first steps (src/farm/firstSteps.ts): passed and paid a frame after the farm does them.

/** The first steps (src/farm/firstSteps.ts) run on the game's own pages; under Vitest and on a ?debug page unless it says
 *  &steps=on they are quiet — nothing shown, passed or paid — until a test turns them on. */
let stepsQuiet = true
/** The steps as this page has them (src/lib/quiet.ts): once, from start(). */
export function stepsByPage() {
  stepsQuiet = !onHere('steps')
}

/** For the tests and the simulation: the steps quiet (true), or running as on a new farm's own pages (false). */
export function quietSteps(on: boolean) {
  stepsQuiet = on
  bump()
}
/** The step to show now (null: over, or quiet). */
export const stepNow = () => (stepsQuiet ? null : currentStep(farm.firstSteps))
/** They are running: the daily gift waits for them. */
export const stepsBusy = () => !stepsQuiet && !farm.firstSteps.over
/** The steps passed and not shown yet (the hint's ✓ takes them). */
const passedNow: StepDef[] = []
export const takePassed = () => passedNow.splice(0)
/** The steps passed and not taken yet, left where they are (the hint shows the last of them until it takes them). */
export const passedWaiting = (): readonly StepDef[] => passedNow
/** Skipped from the hint: over, nothing more paid. */
export function skipSteps() {
  farm.firstSteps = skipped(farm.firstSteps)
  bump()
  save()
}
/** The tips can come back (Settings, *Show the tips again*): skipped with steps left, on a farm still below the level
 *  they end at. */
export const stepsResumable = () => farm.firstSteps.over && farm.firstSteps.step < FIRST_STEPS.length && levelOf(farm.xp.points) < STEPS_UNTIL_LEVEL
/** The tips back on the step they were skipped at: each step the farm has done meanwhile passes a frame later and is
 *  paid then, once (a skipped step was never paid); nothing passed before is paid again. */
export function resumeSteps() {
  if (!stepsResumable()) return false
  farm.firstSteps = { step: farm.firstSteps.step, over: false }
  bump()
  save()
  return true
}
/** Passes the steps the farm has done, paying each one's reward (coins, or goods into their building past full; no XP:
 *  a reward is not something done). Each frame, from `tick`: whatever function changed the farm's numbers, they are
 *  read a frame later. The record is saved as it pays, so a step is never paid twice. */
export function stepsOn() {
  if (stepsQuiet || farm.firstSteps.over) return
  const { rec, passed } = advance(farm.firstSteps, farm)
  if (rec === farm.firstSteps) return
  for (const step of passed) give([step.reward], 'step')
  farm.firstSteps = rec
  passedNow.push(...passed)
  bump()
  save()
}
