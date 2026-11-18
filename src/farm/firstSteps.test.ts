// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { art } from '../ui/art'
import { MOOD_MOVES } from './FarmerFace'
import { FARMER_MOODS, FIRST_STEPS, MOMENT_MOODS, STEPS_UNTIL_LEVEL, advance, currentStep, moodFor, sanitizeSteps, skipped, stepsFresh, type StepId } from './firstSteps'
import { farm, resetFarm, type FarmData } from './state'
import { lockedAt } from './unlocks'
import { xpAt } from './xp'

// The first ten minutes (src/farm/firstSteps.ts): each step read from the farm's own numbers, passed in order (one done
// already as it comes is passed with it), over at the end, when skipped or on a farm grown past them; a record as
// saved made safe, a farm from before them never seeing them; the farmer says each line in a mood his face shows.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
})

/** What doing each step leaves in the farm's numbers (a new step needs one: the first test says so). */
const DOING: Record<StepId, (f: FarmData) => void> = {
  plant: (f) => void f.planted.push('lettuce'),
  eggs: (f) => void (f.got.egg = 1),
  water: (f) => void (f.stats.watered = 1),
  harvest: (f) => void (f.got.lettuce = 4),
  sell: (f) => void (f.stats.sold = 4),
  shear: (f) => void (f.got.wool = 1),
  weave: (f) => void (f.got.cloth = 1),
  order: (f) => void (f.stats.sent = 1),
}

describe('the first steps', () => {
  it('each step is not done on a new farm, and done once the farm has done it', () => {
    expect(Object.keys(DOING).sort()).toEqual(FIRST_STEPS.map((s) => s.id).sort())
    for (const s of FIRST_STEPS) {
      resetFarm()
      expect(s.done(farm), `${s.id} on a new farm`).toBe(false)
      DOING[s.id](farm)
      expect(s.done(farm), `${s.id} done`).toBe(true)
    }
  })

  it('passes each step done in turn, one done already as it comes with it, and is over after the last', () => {
    let rec = stepsFresh()
    expect(currentStep(rec)?.id).toBe('plant')
    expect(advance(rec, farm).passed).toEqual([])
    DOING.plant(farm)
    ;({ rec } = advance(rec, farm))
    expect(currentStep(rec)?.id).toBe('eggs')
    // done out of turn: nothing passes until the step on comes
    DOING.sell(farm)
    DOING.shear(farm)
    expect(advance(rec, farm).passed).toEqual([])
    DOING.eggs(farm)
    DOING.harvest(farm) // (a crop harvested was watered)
    const r = advance(rec, farm)
    expect(r.passed.map((s) => s.id)).toEqual(['eggs', 'water', 'harvest', 'sell', 'shear'])
    rec = r.rec
    expect(currentStep(rec)?.id).toBe('weave')
    DOING.weave(farm)
    DOING.order(farm)
    ;({ rec } = advance(rec, farm))
    expect(rec).toEqual({ step: FIRST_STEPS.length, over: true })
    expect(currentStep(rec)).toBeNull()
    expect(advance(rec, farm).passed).toEqual([])
  })

  it('end by themselves on a farm grown past them, paying nothing more; skipped, they are over', () => {
    farm.xp.points = xpAt(STEPS_UNTIL_LEVEL)
    const r = advance(stepsFresh(), farm)
    expect(r.passed).toEqual([])
    expect(r.rec.over).toBe(true)
    expect(skipped({ step: 3, over: false })).toEqual({ step: 3, over: true })
  })

  it('a record as saved is made safe; a farm from before the steps has done them', () => {
    expect(sanitizeSteps(undefined)).toEqual({ step: FIRST_STEPS.length, over: true })
    expect(sanitizeSteps(null)).toEqual({ step: FIRST_STEPS.length, over: true })
    expect(sanitizeSteps({ step: 3, over: false })).toEqual({ step: 3, over: false })
    expect(sanitizeSteps({ step: -4, over: 'yes' })).toEqual({ step: 0, over: false })
    expect(sanitizeSteps({ step: 2.7 })).toEqual({ step: 2, over: false })
    expect(sanitizeSteps({ step: 1e9, over: false })).toEqual({ step: FIRST_STEPS.length, over: true })
    expect(sanitizeSteps({ step: Number.NaN })).toEqual({ step: 0, over: false })
    expect(sanitizeSteps(JSON.parse(JSON.stringify(stepsFresh())))).toEqual(stepsFresh())
  })

  it('what each step needs is open at level 1, and each gives something', () => {
    for (const s of FIRST_STEPS) {
      for (const id of s.needs ?? []) expect(lockedAt(id, 1), `${s.id} needs ${id}`).toBeNull()
      expect('coins' in s.reward ? s.reward.coins : s.reward.n, s.id).toBeGreaterThan(0)
    }
  })

  it('the farmer says each line, and each moment of the hint, in a mood he has a face and a move for; every face is said', () => {
    const said = [...FIRST_STEPS.map((s) => s.mood), ...Object.values(MOMENT_MOODS)]
    for (const mood of said) expect(FARMER_MOODS, mood).toContain(mood)
    expect([...new Set(said)].sort()).toEqual([...FARMER_MOODS].sort())
    for (const mood of FARMER_MOODS) {
      expect(art(`farmer-${mood}` as const), `the face for ${mood} (node scripts/render-farmer-faces.mjs)`).toBeTruthy()
      expect(MOOD_MOVES[mood], `how he moves when ${mood}`).toBeDefined()
    }
    // "Skip the tips?" is asked kindly: a nod, never a plea to stay (no face pleads)
    expect(MOMENT_MOODS.ask).toBe('encouraging')
    expect(FARMER_MOODS as readonly string[]).not.toContain('pleading')
    // a moment wins over the line he is on
    expect(moodFor(FIRST_STEPS[0], null)).toBe(FIRST_STEPS[0].mood)
    expect(moodFor(FIRST_STEPS[0], 'ask')).toBe(MOMENT_MOODS.ask)
    expect(moodFor(null, 'final')).toBe(MOMENT_MOODS.final)
  })

  it('each line is a few words: two lines of the bubble on a narrow phone', () => {
    for (const s of FIRST_STEPS) expect(s.say.length, s.say).toBeLessThanOrEqual(26)
  })
})
