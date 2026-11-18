// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { newVisit, stepsEndedThisVisit } from '../ui/cardQueue'
import { STEPS_UNTIL_LEVEL } from './firstSteps'
import { ARRIVE_GAP_MS, REVEAL, REVEAL_PARTS, arriveDelay, reveals, type RevealPart } from './reveal'
import { XP_FOR } from './data'
import { bedStage, collect, farm, freezeDay, gainXp, harvestBeds, holdReveal, plant, quietDaily, quietSteps, resetFarm, setDailyClock, setRandom, shows, skipSteps, tick } from './state'
import { OLD_SAVE, justSaved, startFrom } from './testSaves'
import { xpAt } from './xp'

// What the top of the screen holds back on a new farm (src/farm/reveal.ts) and the farm's answer (`shows`,
// src/farm/state/steps.ts): while the first steps run, each part waits for its row (the tanks for their first good, the
// line for the first planting, the rest for the steps' end); once they are over — done, skipped, grown past — or quiet,
// as on every test page, everything shows, as it does on any farm from before (nothing is saved).

const NOON = new Date(2026, 10, 2, 12).getTime()
/** Ticks until a bed is at a stage (at most `most` seconds), watering it when it is dry. */
function until(stage: ReturnType<typeof bedStage>, i = 0, most = 300) {
  for (let t = 0; t < most && bedStage(i) !== stage; t++) {
    if (bedStage(i) === 'thirsty') farm.beds[i].water = 999
    tick(1)
  }
}
const all = () => Object.fromEntries(REVEAL_PARTS.map((p) => [p, shows(p)])) as Record<RevealPart, boolean>
const none = Object.fromEntries(REVEAL_PARTS.map((p) => [p, false]))
const every = Object.fromEntries(REVEAL_PARTS.map((p) => [p, true]))

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
  setRandom(() => 0.5)
  setDailyClock(() => NOON)
  newVisit()
  quietSteps(false)
})
afterEach(() => {
  holdReveal(false)
  newVisit()
  quietSteps(true)
  quietDaily(false)
  setDailyClock(null)
  setRandom(null)
  freezeDay(false)
})

describe('the parts held back while the steps run', () => {
  it('a new farm shows none of them on its first frame', () => {
    expect(all()).toEqual(none)
  })

  it('the line comes in with the first planting, the silo with the first harvest, the barn with the first eggs', () => {
    plant(0, 'lettuce')
    expect(all()).toEqual({ ...none, line: true })
    farm.producers.hens.stock[0] = 2
    collect('hens', 0)
    expect(shows('barn')).toBe(true)
    expect(shows('silo')).toBe(false)
    until('ripe', 0)
    harvestBeds([0])
    expect(shows('silo')).toBe(true)
    // the rest wait for the steps' end
    for (const p of ['goals', 'gifts', 'news', 'gear', 'stickTools'] as const) expect(shows(p), p).toBe(false)
  })

  it('each row reads only the farm it is given', () => {
    const f = structuredClone(farm)
    expect(REVEAL.silo(f)).toBe(false)
    f.got.lettuce = 1
    expect(REVEAL.silo(f)).toBe(true)
    expect(REVEAL.barn(f)).toBe(false)
    f.got.cloth = 1
    expect(REVEAL.barn(f)).toBe(true)
    expect(reveals('goals', f, true)).toBe(false)
    expect(reveals('goals', f, false)).toBe(true)
  })
})

describe('everything shows once the steps are not running', () => {
  it('quiet, as every test page has them', () => {
    quietSteps(true)
    expect(all()).toEqual(every)
  })

  it('skipped: at once', () => {
    skipSteps()
    expect(all()).toEqual(every)
  })

  it('grown past (the steps end at their level)', () => {
    gainXp('harvest', Math.ceil((xpAt(STEPS_UNTIL_LEVEL) - farm.xp.points) / XP_FOR.harvest))
    tick(0.1)
    expect(farm.firstSteps.over).toBe(true)
    expect(all()).toEqual(every)
  })

  it('a farm from before the steps sees everything (nothing saved)', () => {
    startFrom(justSaved(OLD_SAVE))
    expect(farm.firstSteps.over).toBe(true)
    expect(all()).toEqual(every)
  })

  it('while the steps’ last card shows, what they held waits for it to go; then one part after another', () => {
    skipSteps()
    holdReveal(true)
    expect(shows('goals')).toBe(false)
    holdReveal(false)
    expect(shows('goals')).toBe(true)
    const held = REVEAL_PARTS.filter((p) => arriveDelay(p) > 0 || p === 'goals')
    expect(held.map(arriveDelay)).toEqual(held.map((_, k) => k * ARRIVE_GAP_MS))
    expect(arriveDelay('silo')).toBe(0)
  })

  it('the news waits one visit more when the steps ended in this one', () => {
    skipSteps()
    stepsEndedThisVisit()
    expect(shows('news')).toBe(false)
    expect(shows('goals')).toBe(true)
    newVisit()
    expect(shows('news')).toBe(true)
  })
})
