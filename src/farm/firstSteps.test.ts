// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { art } from '../ui/art'
import { MOOD_MOVES } from './FarmerFace'
import { BEDS, SELLABLE, cropById, produceById, type CropId } from './data'
import {
  FARMER_MOODS,
  FIRST_STEPS,
  MOMENT_MOODS,
  STEPS_UNTIL_LEVEL,
  advance,
  currentStep,
  fetchTarget,
  lineFor,
  moodFor,
  orderToFollow,
  sanitizeSteps,
  skipped,
  sourceOf,
  stageOf,
  stepsFresh,
  type StepId,
} from './firstSteps'
import { bedStage, farm, newVisitor, orderAt, resetFarm, type FarmData } from './state'
import { lockedAt } from './unlocks'
import { xpAt } from './xp'

// The first ten minutes (src/farm/firstSteps.ts): each step read from the farm's own numbers, passed in order (one done
// already as it comes is passed with it), over at the end, when skipped or on a farm grown past them; a record as
// saved made safe, a farm from before them never seeing them; the farmer says each line in a mood his face shows; and
// each step's turns, each in the state it names, so the line always says something a player can do now.

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
    const said = [...FIRST_STEPS.flatMap((s) => [s.mood, ...(s.turns ?? []).flatMap((t) => (t.mood ? [t.mood] : []))]), ...Object.values(MOMENT_MOODS)]
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

  it('each line is a few words: two lines of the bubble on a narrow phone, each turn’s too, for every good it may name', () => {
    for (const s of FIRST_STEPS) {
      expect(s.say.length, s.say).toBeLessThanOrEqual(26)
      for (const t of s.turns ?? []) if (typeof t.say === 'string') expect(t.say.length, t.say).toBeLessThanOrEqual(26)
    }
    // the lines that name a good ("They want eggs", "Now fetch rolls of cloth"): every good a buyer or an order may ask for
    for (const good of SELLABLE) {
      resetFarm()
      for (const g of SELLABLE) farm.inv[g] = g === good ? 0 : 99
      farm.visitors = [{ ...newVisitor(good, 1, 1, 1, false), phase: 'queued' }]
      farm.orders = [{ order: { id: 1, lines: [{ good, want: 1, have: 0 }], coins: 1, surprise: false } }]
      for (const id of ['sell', 'order'] as const) {
        const line = lineFor(step(id), farm)
        expect(line.say, `${id}, ${good}`).toContain(produceById(good).plural)
        expect(line.say.length, line.say).toBeLessThanOrEqual(26)
      }
    }
  })
})

/** A step by its id. */
const step = (id: StepId) => FIRST_STEPS.find((s) => s.id === id)!
/** What the farmer says now for a step, its walk too. */
const says = (id: StepId) => {
  const l = lineFor(step(id), farm)
  return { say: l.say, target: l.target }
}
/** A bed of a new farm, built: its crop, how far grown (a share of its time) and how wet (seconds). */
function sow(i: number, crop: CropId | null, grown = 0, water = 10) {
  Object.assign(farm.beds[i], { built: true, crop, growth: crop ? cropById(crop).growSeconds * grown : 0, water: crop ? water : 0 })
}

describe('the steps’ turns: the line follows the farm, so each step can always be done', () => {
  it('a bed’s stage read from a farm given is the farm’s own (state/beds.ts, bedStage)', () => {
    sow(0, 'lettuce', 0.2)
    sow(1, 'carrot', 0.6, 0)
    sow(2, 'lettuce', 1)
    farm.beds[3].built = false
    for (const sprinkler of [false, true]) {
      farm.sprinkler = sprinkler
      BEDS.forEach((_, i) => expect(stageOf(farm, i), `bed ${i}`).toBe(bedStage(i)))
    }
  })

  it('water: plant first; while the soak lasts, water it once it is dry; dry, water it; ripe already (rain, sprinklers), harvest it', () => {
    expect(says('water')).toEqual({ say: 'Plant some seeds first', target: { bed: ['empty'] } })
    sow(0, 'lettuce', 0.2)
    expect(says('water')).toEqual({ say: "Water it once it's dry", target: { bed: ['growing'] } })
    farm.beds[0].water = 0
    expect(says('water')).toEqual({ say: step('water').say, target: step('water').target })
    sow(0, 'lettuce', 1)
    expect(says('water')).toEqual({ say: 'Ripe already! Harvest it', target: { bed: ['ripe'] } })
  })

  it('harvest: ripe, harvest it; thirsty again, water it; growing, wait for it; nothing in, plant first', () => {
    expect(says('harvest').say).toBe('Plant some seeds first')
    sow(0, 'lettuce', 0.6, 0)
    expect(says('harvest')).toEqual({ say: 'Thirsty again! Water it', target: { bed: ['thirsty'] } })
    farm.beds[0].water = 10
    expect(says('harvest')).toEqual({ say: 'Growing… wait till ripe', target: { bed: ['growing'] } })
    sow(1, 'lettuce', 1)
    expect(says('harvest')).toEqual({ say: step('harvest').say, target: step('harvest').target })
  })

  it('sell: nobody yet, buyers come; nobody the barn can serve, fetch what they want (or what it is made from)', () => {
    expect(says('sell')).toEqual({ say: 'Buyers come to the gate', target: { id: 'farm-queue' } })
    farm.visitors = [{ ...newVisitor('egg', 3, 6, 1, false), phase: 'arriving' }]
    expect(says('sell').say).toBe('Buyers come to the gate')
    farm.visitors[0].phase = 'queued'
    farm.inv.egg = 1
    expect(says('sell')).toEqual({ say: 'They want eggs', target: { good: 'egg' } })
    farm.inv.egg = 3
    expect(says('sell')).toEqual({ say: step('sell').say, target: { id: 'farm-queue' } })
    // cloth with no fleece to weave it from: the fleeces, at the sheep
    farm.visitors = [{ ...newVisitor('cloth', 1, 15, 1, false), phase: 'queued' }]
    expect(says('sell')).toEqual({ say: 'They want fleeces', target: { good: 'wool' } })
  })

  it('weave: no fleece, shear one; one in the barn, weave it; at work, then take it; done, take it', () => {
    expect(says('weave')).toEqual({ say: 'Shear a sheep for wool', target: { good: 'wool' } })
    farm.inv.wool = 1
    expect(says('weave')).toEqual({ say: step('weave').say, target: { good: 'cloth' } })
    farm.machines.loom.jobs = ['wool']
    expect(says('weave')).toEqual({ say: 'Weaving… then take it', target: { good: 'cloth' } })
    farm.machines.loom.done = 1
    expect(says('weave')).toEqual({ say: 'Done! Take your cloth', target: { good: 'cloth' } })
  })

  it('order: the starter order, fetch what it lacks (down to the fleece for the cloth), put it in, send it', () => {
    // (the other places still on their way: no order the dice made can be nearer)
    farm.orders = farm.orders.map((slot, k) => (k ? { wait: 600 } : slot))
    expect(orderToFollow(farm)).toBe(0)
    expect(says('order')).toEqual({ say: 'Now fetch eggs', target: { good: 'egg' } })
    farm.inv.egg = 3
    expect(says('order')).toEqual({ say: 'Now fetch fleeces', target: { good: 'wool' } })
    farm.machines.loom.jobs = ['wool']
    expect(says('order')).toEqual({ say: 'Now fetch rolls of cloth', target: { good: 'cloth' } })
    farm.machines.loom.jobs = []
    farm.inv.cloth = 1
    expect(says('order')).toEqual({ say: 'Put the goods in', target: { id: 'farm-office' } })
    for (const l of orderAt(0)!.lines) l.have = l.want
    expect(says('order')).toEqual({ say: 'All in! Now send it', target: { id: 'farm-office' } })
    // one the barn can fill now is followed before the starter; else the starter before one nearer to done; none on
    // the board: the step's own line
    for (const l of orderAt(0)!.lines) l.have = 0
    farm.inv.egg = farm.inv.cloth = 0
    farm.orders[1] = { order: { id: 8, lines: [{ good: 'lemon', want: 2, have: 0 }], coins: 6, surprise: false } }
    farm.orders[2] = { order: { id: 9, lines: [{ good: 'lemon', want: 1, have: 1 }], coins: 3, surprise: false } }
    expect(orderToFollow(farm)).toBe(2)
    farm.orders[2] = { wait: 60 }
    expect(orderToFollow(farm)).toBe(0)
    farm.orders[0] = { wait: 60 }
    expect(orderToFollow(farm)).toBe(1)
    farm.orders = farm.orders.map(() => ({ wait: 60 }))
    expect(orderToFollow(farm)).toBe(-1)
    expect(says('order')).toEqual({ say: step('order').say, target: { id: 'farm-office' } })
  })

  it('a crop to fetch with no bed growing it and none empty: a bed to empty first', () => {
    for (let i = 0; i < farm.beds.length; i++) if (farm.beds[i].built) sow(i, 'lettuce', 0.5)
    expect(fetchTarget(farm, 'carrot')).toEqual({ bed: ['ripe', 'thirsty', 'growing'] })
    expect(fetchTarget(farm, 'lettuce')).toEqual({ good: 'lettuce' })
    expect(sourceOf(farm, 'egg')).toBe('egg')
  })
})
