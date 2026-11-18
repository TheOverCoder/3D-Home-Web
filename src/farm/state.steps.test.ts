// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FIRST_STEPS, STEPS_UNTIL_LEVEL, longestOpen, type StepId } from './firstSteps'
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
  resumeSteps,
  sendOrder,
  setDailyClock,
  setRandom,
  skipSteps,
  spawnVisitor,
  stepNow,
  stepsBusy,
  stepsResumable,
  takePassed,
  tick,
  water,
  xpEventCount,
} from './state'
import { OLD_SAVE, justSaved, savedNow, startFrom } from './testSaves'
import { xpAt } from './xp'
import { ORDERS, SELLABLE, XP_FOR, type ProduceId } from './data'
import { orderPay } from './orders'

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
  // the longest crop open, sown in a free bed for the time away
  long: () => {
    const i = farm.beds.findIndex((b) => b.built && !b.crop)
    expect(plant(i, longestOpen(farm))).toBe(true)
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

  it('quiet (the tests’ default, and a ?debug page’s): nothing shown, passed or paid', () => {
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

  it('skipped, they can come back (Show the tips again): on the step they left, what was done meanwhile paid once', () => {
    expect(stepsResumable()).toBe(false)
    PLAY.plant()
    frame()
    skipSteps()
    expect(stepsResumable()).toBe(true)
    PLAY.eggs()
    expect(frame().coins).toBe(0)
    expect(resumeSteps()).toBe(true)
    expect(farm.firstSteps).toEqual({ step: 1, over: false })
    // the eggs collected meanwhile pass now, paid once; the plant step's coins were paid before and are not again
    expect(frame().coins).toBe(reward('eggs'))
    expect(takePassed().map((p) => p.id)).toEqual(['plant', 'eggs'])
    expect(frame().coins).toBe(0)
    expect(stepNow()?.id).toBe('water')
    expect(resumeSteps()).toBe(false)
    // all done, or grown past them: they do not come back
    skipSteps()
    gainXp('goal', Math.ceil((xpAt(STEPS_UNTIL_LEVEL) - farm.xp.points) / XP_FOR.goal))
    expect(stepsResumable()).toBe(false)
    expect(resumeSteps()).toBe(false)
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

describe('the starter order (ORDERS.first)', () => {
  const ask = () => farm.orders.map((slot) => ('order' in slot ? slot.order.lines.map((l) => `${l.good} ${l.have}/${l.want}`).join(', ') : 'wait'))
  const STARTER = 'egg 0/3, cloth 0/1'
  /** A place on the board holding an order of one good, so many of it put in so far. */
  const order = (good: ProduceId, want: number, have = 0) => ({ order: { id: 0, lines: [{ good, want, have }], coins: 9, surprise: false } })

  it('a new farm’s board has it in its first place: what the steps taught, paid as any order, and the rest come in', () => {
    expect(ask()[0]).toBe(STARTER)
    const o = orderAt(0)!
    expect(o.coins).toBe(orderPay(o.lines))
    expect(o.coins).toBe(26)
    expect(o.surprise).toBe(false)
    tick(0.1)
    expect(ask()[0]).toBe(STARTER)
    expect(farm.orders.every((slot) => 'order' in slot)).toBe(true)
    // what it asks for a new farm makes (the eggs' and the weave's steps), and none of it is a building material
    for (const l of ORDERS.first) expect(SELLABLE).toContain(l.good)
  })

  it('a farm saved on its steps before it gets it once, in the first place with nothing put in: nothing in is lost', () => {
    farm.firstSteps = { step: 3, over: false }
    farm.orders = [order('lettuce', 4, 2), order('wool', 2), order('carrot', 3)]
    startFrom(justSaved(savedNow()))
    expect(ask()).toEqual(['lettuce 2/4', STARTER, 'carrot 0/3'])
    // once: saved and loaded again, the same board
    startFrom(justSaved(savedNow()))
    expect(ask()).toEqual(['lettuce 2/4', STARTER, 'carrot 0/3'])
    // a board saved before its first frame (every place waiting): in the first place
    farm.orders = [{ wait: 0 }, { wait: 0 }, { wait: 0 }]
    startFrom(justSaved(savedNow()))
    expect(ask()[0]).toBe(STARTER)
    // every order with something in: the board as it was
    farm.orders = [order('lettuce', 4, 2), order('wool', 2, 1), order('carrot', 3, 3)]
    startFrom(justSaved(savedNow()))
    expect(ask()).toEqual(['lettuce 2/4', 'wool 1/2', 'carrot 3/3'])
  })

  it('a farm that has sent an order, or is past its steps, keeps its board; so does one from before the steps', () => {
    farm.orders = [order('lettuce', 4), order('wool', 2), order('carrot', 3)]
    farm.firstSteps = { step: 7, over: false }
    farm.stats.sent = 1
    startFrom(justSaved(savedNow()))
    expect(ask()).toEqual(['lettuce 0/4', 'wool 0/2', 'carrot 0/3'])
    farm.stats.sent = 0
    farm.firstSteps = { step: 2, over: true }
    startFrom(justSaved(savedNow()))
    expect(ask()).toEqual(['lettuce 0/4', 'wool 0/2', 'carrot 0/3'])
    startFrom(justSaved(OLD_SAVE))
    expect(ask()).not.toContain(STARTER)
  })
})
