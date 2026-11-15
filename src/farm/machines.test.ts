import { describe, expect, it } from 'vitest'
import { MACHINES } from './data'
import { MACHINE_LEVELS, QUEUE } from './machineView'
import { firstWaiting, freshMachine, insertJob, jobSeconds, moveWaiting, runQueue, secondsLeft, takeDone, takeWaiting, type MachineState } from './machines'

// A machine's queue as rules (src/farm/machines.ts): jobs one after another, a done one keeping its place, what may be
// added, taken out and moved where, and the level its work brings making its jobs quicker.

const oven = (jobs: string[], more: Partial<MachineState> = {}): MachineState => ({ ...freshMachine(), jobs, ...more })
const seconds = (recipe: string) => MACHINES.oven.recipes.find((r) => r.id === recipe)!.seconds

describe("a machine's queue", () => {
  it('works through its jobs in order, one after another, each starting as the one before is done', () => {
    const m = oven(['lemon_cake', 'carrot_cake', 'pumpkin_pie'])
    expect(secondsLeft('oven', m)).toBe(30 + 35 + 40)
    expect(runQueue('oven', m, 29)).toBe(0)
    expect([m.done, m.progress]).toEqual([0, 29])
    // the lemon cake done at 30 s, the carrot cake under way 4 s
    expect(runQueue('oven', m, 5)).toBe(1)
    expect([m.done, m.progress]).toEqual([1, 4])
    // one long step finishes the rest in it, and no more time is counted than they took
    expect(runQueue('oven', m, 1000)).toBe(2)
    expect([m.done, m.progress, m.worked]).toEqual([3, 0, 105])
    expect(secondsLeft('oven', m)).toBe(0)
    // nothing left to do: time goes by and nothing is worked
    expect(runQueue('oven', m, 60)).toBe(0)
    expect(m.worked).toBe(105)
  })

  it('in small steps as in one: the same jobs done at the same time', () => {
    const steps = oven(['lemon_cake', 'carrot_cake', 'pumpkin_pie'])
    for (let t = 0; t < 70; t += 0.25) runQueue('oven', steps, 0.25)
    const once = oven(['lemon_cake', 'carrot_cake', 'pumpkin_pie'])
    runQueue('oven', once, 70)
    expect(steps.done).toBe(once.done)
    expect(steps.progress).toBeCloseTo(once.progress, 6)
    expect(steps.worked).toBeCloseTo(70, 6)
  })

  it('a level reached on the way makes the jobs after it quicker (level 3: 5 % less time)', () => {
    const three = MACHINE_LEVELS[2]
    // a minute short of level 3: the first cake at the old pace, the next at the new
    const m = oven(['lemon_cake', 'lemon_cake'], { worked: three.minutes * 60 - 30 })
    expect(runQueue('oven', m, 30)).toBe(1)
    expect(jobSeconds(MACHINES.oven.recipes[0], three.boost)).toBeCloseTo(30 * 0.95, 9)
    expect(runQueue('oven', m, 28.4)).toBe(0)
    expect(runQueue('oven', m, 0.1)).toBe(1)
    // a job under way past its new length is done in the next step, however small
    const past = oven(['lemon_cake'], { worked: three.minutes * 60, progress: 29.9 })
    expect(runQueue('oven', past, 0.0001)).toBe(1)
  })

  it('a job goes in at the end or among the waiting ones, never before the one under way, and only into a free place', () => {
    const m = oven(['lemon_cake', 'carrot_cake'], { progress: 3 })
    expect(firstWaiting(m)).toBe(1)
    expect(insertJob(m, 'pumpkin_pie', 0)).toBe(false) // before the one under way
    expect(insertJob(m, 'pumpkin_pie', 1)).toBe(true)
    expect(m.jobs).toEqual(['lemon_cake', 'pumpkin_pie', 'carrot_cake'])
    expect(m.progress).toBe(3) // the lemon cake goes on
    expect(insertJob(m, 'lemon_cake')).toBe(false) // three places, all taken
    m.capacity = 4
    expect(insertJob(m, 'lemon_cake', 9)).toBe(false)
    expect(insertJob(m, 'lemon_cake', 1.5)).toBe(false)
    expect(insertJob(m, 'lemon_cake')).toBe(true)
    // into an empty queue, or one with only done jobs: it is the one under way, from the start
    const idle = oven(['carrot_cake'], { done: 1 })
    expect(firstWaiting(idle)).toBe(1)
    expect(insertJob(idle, 'pumpkin_pie', 0)).toBe(false)
    expect(insertJob(idle, 'pumpkin_pie')).toBe(true)
    expect([idle.done, idle.progress]).toEqual([1, 0])
  })

  it('only a waiting job is taken out or moved, and only among the waiting ones', () => {
    const m = oven(['strawberry_cake', 'lemon_cake', 'carrot_cake', 'pumpkin_pie'], { done: 1, capacity: 4 })
    // done: the strawberry cake; under way: the lemon cake; waiting: the carrot cake and the pie
    expect([takeWaiting(m, 0), takeWaiting(m, 1), takeWaiting(m, 4), takeWaiting(m, -1)]).toEqual([null, null, null, null])
    expect(moveWaiting(m, 3, 1)).toBe(false)
    expect(moveWaiting(m, 1, 3)).toBe(false)
    expect(moveWaiting(m, 3, 2)).toBe(true)
    expect(m.jobs).toEqual(['strawberry_cake', 'lemon_cake', 'pumpkin_pie', 'carrot_cake'])
    expect(takeWaiting(m, 3)).toBe('carrot_cake')
    expect(m.jobs).toEqual(['strawberry_cake', 'lemon_cake', 'pumpkin_pie'])
  })

  it('the done jobs come out as far as they fit; the others keep their places at the front, still done', () => {
    const m = oven(['lemon_cake', 'carrot_cake', 'lemon_cake', 'pumpkin_pie'], { done: 3, progress: 7, capacity: 4 })
    // room for the lemon cakes only
    expect(takeDone(m, (job) => job === 'lemon_cake')).toEqual(['lemon_cake', 'lemon_cake'])
    expect(m).toMatchObject({ jobs: ['carrot_cake', 'pumpkin_pie'], done: 1, progress: 7 })
    expect(takeDone(m, () => false)).toEqual([])
    expect(m.jobs).toEqual(['carrot_cake', 'pumpkin_pie'])
  })

  it('three places to start with, and the most is twelve', () => {
    expect(freshMachine()).toEqual({ jobs: [], done: 0, progress: 0, capacity: QUEUE.start, worked: 0 })
    expect([QUEUE.start, QUEUE.max]).toEqual([3, 12])
  })

  it('a job takes its recipe’s time, less at a level that makes it quicker', () => {
    expect(seconds('pumpkin_pie')).toBe(40)
    expect(jobSeconds(MACHINES.oven.recipes[3], MACHINE_LEVELS[5].boost)).toBeCloseTo(32, 9)
  })
})
