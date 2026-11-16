// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIRST_STEPS, STEPS_UNTIL_LEVEL, type StepId } from './firstSteps'
import {
  acceptOffer,
  addJob,
  bedStage,
  collect,
  collectMachine,
  dailyWaiting,
  farm,
  fillOrder,
  freezeDay,
  gainXp,
  harvestBeds,
  orderAt,
  plant,
  quietDaily,
  quietSteps,
  resetFarm,
  sendOrder,
  setDailyClock,
  setRandom,
  skipSteps,
  spawnVisitor,
  stepNow,
  stepsBusy,
  takePassed,
  tick,
  water,
  xpEventCount,
} from './state'
import { OLD_SAVE, justSaved, savedNow, startFrom } from './testSaves'
import { xpAt } from './xp'
import { XP_FOR } from './data'

// A new farm's first steps on the farm (src/farm/firstSteps.ts; the record, the pay and the daily gift's wait in
// src/farm/state.ts): each step passed as the farm does it, a frame later, in order, its reward paid once and never
// XP; one done early passes with the one before it; skipped or grown past, they are over and pay nothing more; the
// daily gift waits while they run; the record is kept in the save, and a farm from before them never sees them.

const NOON = new Date(2026, 10, 2, 12).getTime()

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
  setRandom(() => 0.5)
  setDailyClock(() => NOON)
  quietSteps(false)
  takePassed()
})
afterEach(() => {
  quietSteps(true)
  quietDaily(false)
  setDailyClock(null)
  setRandom(null)
  freezeDay(false)
})

const reward = (id: StepId) => {
  const r = FIRST_STEPS.find((s) => s.id === id)!.reward
  return 'coins' in r ? r.coins : 0
}

/** One frame of the farm: what a step's numbers show is passed then, and paid. The coins it paid, and the XP. */
function frame() {
  const coins = farm.coins
  const xp = farm.xp.points
  const events = xpEventCount()
  tick(0.1)
  return { coins: farm.coins - coins, xp: farm.xp.points - xp, xpEvents: xpEventCount() - events }
}

/** Ticks until a bed is at a stage (at most `most` seconds). */
function until(stage: ReturnType<typeof bedStage>, i = 0, most = 300) {
  for (let t = 0; t < most && bedStage(i) !== stage; t++) tick(1)
  expect(bedStage(i)).toBe(stage)
}

/** Each step done by playing it, as the player would: the game's own functions. */
const PLAY: Record<StepId, () => void> = {
  plant: () => expect(plant(0, 'lettuce')).toBe(true),
  eggs: () => expect(collect('hens')).toBeGreaterThan(0),
  water: () => {
    until('thirsty')
    expect(water(0)).toBe(true)
  },
  harvest: () => {
    until('ripe')
    expect(harvestBeds([0])).toBeGreaterThan(0)
  },
  sell: () => expect(acceptOffer(spawnVisitor({ want: 'lettuce', qty: 2, offer: 9, queued: true }).id)).toBe(true),
  shear: () => expect(collect('sheep', 0)).toBeGreaterThan(0),
  weave: () => {
    expect(addJob('loom', 'wool')).toBe(true)
    for (let t = 0; t < 20 && !farm.machines.loom.done; t++) tick(1)
    expect(collectMachine('loom')).toBe(1)
  },
  order: () => {
    const o = orderAt(0)!
    for (const l of o.lines) farm.inv[l.good] += l.want - l.have
    fillOrder(0)
    expect(sendOrder(0)).toBe(true)
  },
}

describe('a new farm walked through its first steps', () => {
  it('is walked through every step by playing it: each reward paid once, a frame later, never XP; over after the order', () => {
    // (the order board's first orders come in on the first frame)
    tick(0.1)
    expect(orderAt(0)).not.toBeNull()
    for (const s of FIRST_STEPS) {
      expect(stepNow()?.id).toBe(s.id)
      expect(frame().coins, `${s.id} not done yet`).toBe(0)
      PLAY[s.id]()
      const paid = frame()
      expect(paid.coins, `${s.id} paid`).toBe(reward(s.id))
      expect(paid.xpEvents, `${s.id}: no XP for a reward`).toBe(0)
      expect(takePassed().map((p) => p.id)).toEqual([s.id])
      // never twice
      expect(frame().coins, `${s.id} paid once`).toBe(0)
    }
    expect(farm.firstSteps).toEqual({ step: FIRST_STEPS.length, over: true })
    expect(stepNow()).toBeNull()
    expect(stepsBusy()).toBe(false)
  })

  it('a step done early passes with the one before it, paying both', () => {
    PLAY.eggs()
    expect(frame().coins).toBe(0)
    expect(stepNow()?.id).toBe('plant')
    PLAY.plant()
    expect(frame().coins).toBe(reward('plant') + reward('eggs'))
    expect(takePassed().map((p) => p.id)).toEqual(['plant', 'eggs'])
    expect(stepNow()?.id).toBe('water')
  })

  it('quiet (the tests’ default, and the game’s until the hint shows): nothing shown, passed or paid', () => {
    quietSteps(true)
    PLAY.plant()
    PLAY.eggs()
    expect(frame().coins).toBe(0)
    expect(stepNow()).toBeNull()
    expect(stepsBusy()).toBe(false)
    expect(farm.firstSteps).toEqual({ step: 0, over: false })
    expect(takePassed()).toEqual([])
  })
})

describe('the end of the steps, and the daily gift', () => {
  beforeEach(() => quietDaily(false))

  it('skipped: over, nothing more paid; the daily gift waits while they run, and comes once they are skipped', () => {
    PLAY.plant()
    frame()
    // (a farm that has planted has begun: today's gift would wait for it)
    expect(farm.started).toBe(true)
    expect(dailyWaiting()).toBe(false)
    skipSteps()
    expect(farm.firstSteps).toEqual({ step: 1, over: true })
    expect(dailyWaiting()).toBe(true)
    expect(stepNow()).toBeNull()
    PLAY.eggs()
    expect(frame().coins).toBe(0)
    expect(farm.firstSteps).toEqual({ step: 1, over: true })
  })

  it('the daily gift comes once they are all done', () => {
    tick(0.1)
    for (const s of FIRST_STEPS) {
      expect(dailyWaiting(), `before ${s.id}`).toBe(false)
      PLAY[s.id]()
      frame()
    }
    expect(farm.firstSteps.over).toBe(true)
    expect(dailyWaiting()).toBe(true)
  })

  it('they end by themselves on a farm grown past them, paying nothing more, and the daily gift comes', () => {
    PLAY.plant()
    frame()
    expect(dailyWaiting()).toBe(false)
    gainXp('goal', Math.ceil((xpAt(STEPS_UNTIL_LEVEL) - farm.xp.points) / XP_FOR.goal))
    expect(frame().coins).toBe(0)
    expect(farm.firstSteps).toEqual({ step: 1, over: true })
    expect(dailyWaiting()).toBe(true)
    PLAY.eggs()
    expect(frame().coins).toBe(0)
    expect(takePassed().map((p) => p.id)).toEqual(['plant'])
  })
})

describe('kept in the save', () => {
  it('a farm saved mid-way loads on its step; a save without them loads over', () => {
    tick(0.1)
    for (const id of ['plant', 'eggs', 'water'] as const) {
      PLAY[id]()
      frame()
    }
    expect(farm.stats.watered).toBe(1)
    const save = savedNow()
    expect(save.firstSteps).toEqual({ step: 3, over: false })
    startFrom(justSaved(save))
    expect(farm.firstSteps).toEqual({ step: 3, over: false })
    expect(farm.stats.watered).toBe(1)
    expect(stepNow()?.id).toBe('harvest')
    // nothing passed again, nothing paid again
    expect(frame().coins).toBe(0)
    expect(takePassed()).toEqual([])

    // a save without them (a farm from before them) has done them: over, and the daily gift does not wait
    const { firstSteps: _gone, ...before } = save
    startFrom(justSaved(before))
    expect(farm.firstSteps).toEqual({ step: FIRST_STEPS.length, over: true })
    expect(stepNow()).toBeNull()
    expect(stepsBusy()).toBe(false)
    startFrom(justSaved(OLD_SAVE))
    expect(farm.firstSteps.over).toBe(true)
    expect(farm.stats.watered).toBe(0)
  })
})
