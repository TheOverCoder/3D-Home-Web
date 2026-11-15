import { describe, expect, it } from 'vitest'
import type { QueueSlot, RecipeView } from '../machineView'
import { cells, clock, dropOf, nextKeys, nextTarget, queueLeft, timesCan, workTime, type Payload } from './queue'

const job = (recipe: string, state: QueueSlot['state'], left = 30): QueueSlot => ({ recipe, makes: 'lemon_cake', state, seconds: 30, left: state === 'done' ? 0 : left })
// two done, one working, three waiting, in a queue of eight
const slots = [job('a', 'done'), job('b', 'done'), job('c', 'working', 12), job('d', 'waiting'), job('e', 'waiting'), job('f', 'waiting')]
const keys = ['ka', 'kb', 'kc', 'kd', 'ke', 'kf']

describe("the machine panel's queue", () => {
  it('writes times as the clock does, and work as hours and minutes', () => {
    expect([clock(0), clock(4.2), clock(65), clock(3725)]).toEqual(['0:00', '0:05', '1:05', '1:02:05'])
    expect([workTime(45), workTime(360), workTime(400)]).toEqual(['45 min', '6 h', '6 h 40 min'])
  })
  it('the time left of the whole queue is the working job and every waiting one', () => {
    expect(queueLeft(slots)).toBe(12 + 30 * 3)
  })
  it('how many times a recipe can be made is its scarcest ingredient', () => {
    const r: RecipeView = { id: 'x', makes: 'lemon_cake', needs: { egg: 2, flour: 1 }, have: { egg: 7, flour: 5 }, seconds: 30, can: true }
    expect(timesCan(r)).toBe(3)
    expect(timesCan({ ...r, have: { egg: 1, flour: 5 } })).toBe(0)
  })
  it('draws the jobs, then the empty places up to the capacity', () => {
    const c = cells(slots, keys, 8)
    expect(c.map((x) => x.kind)).toEqual(['done', 'done', 'working', 'waiting', 'waiting', 'waiting', 'empty', 'empty'])
  })
  it('a recipe dragged over a waiting job makes room there; over the rest of the queue it lands at the end', () => {
    const p: Payload = { kind: 'recipe', recipe: 'z' }
    const over = nextTarget(null, { cell: 'waiting', index: 4 }, p, slots)
    expect(over).toEqual({ at: 4 })
    const c = cells(slots, keys, 8, { payload: p, target: over })
    expect(c.map((x) => x.key)).toEqual(['ka', 'kb', 'kc', 'kd', 'new', 'ke', 'kf', 'empty-7'])
    expect(dropOf(p, over, slots)).toEqual({ add: 'z', at: 4 })
    // over the hole it stays where it was
    expect(nextTarget(over, { cell: 'hole', index: 4 }, p, slots)).toEqual({ at: 4 })
    for (const hit of [{ cell: 'done' as const, index: 0 }, { cell: 'working' as const, index: 2 }, { cell: 'empty' as const, index: 7 }, { queue: true as const }])
      expect(dropOf(p, nextTarget(null, hit, p, slots), slots)).toEqual({ add: 'z' })
    // outside the queue it goes back
    expect(dropOf(p, nextTarget(over, null, p, slots), slots)).toBeNull()
  })
  it('a waiting job dragged among the waiting ones moves; out of the queue it is taken out', () => {
    const p: Payload = { kind: 'job', index: 5 }
    const over = nextTarget(null, { cell: 'waiting', index: 3 }, p, slots)
    expect(cells(slots, keys, 8, { payload: p, target: over }).map((x) => x.kind)).toEqual(['done', 'done', 'working', 'hole', 'waiting', 'waiting', 'empty', 'empty'])
    expect(dropOf(p, over, slots)).toEqual({ move: [5, 3] })
    // onto the working one: the front of the waiting ones; onto an empty place: the end
    expect(dropOf(p, nextTarget(null, { cell: 'working', index: 2 }, p, slots), slots)).toEqual({ move: [5, 3] })
    expect(dropOf({ kind: 'job', index: 3 }, nextTarget(null, { cell: 'empty', index: 7 }, { kind: 'job', index: 3 }, slots), slots)).toEqual({ move: [3, 5] })
    // where it was: nothing
    expect(dropOf(p, { at: 5 }, slots)).toBeNull()
    expect(dropOf(p, nextTarget(over, null, p, slots), slots)).toEqual({ remove: 5 })
  })
  it("each job keeps its key through the panel's own changes, and through others by its recipe", () => {
    let n = 0
    const fresh = () => `new${n++}`
    const before = slots
    // added in the middle
    const added = [...slots.slice(0, 4), job('z', 'waiting'), ...slots.slice(4)]
    expect(nextKeys(keys, before, added, { add: 4 }, fresh)).toEqual(['ka', 'kb', 'kc', 'kd', 'new0', 'ke', 'kf'])
    // moved
    const moved = [slots[0], slots[1], slots[2], slots[5], slots[3], slots[4]]
    expect(nextKeys(keys, before, moved, { move: [5, 3] }, fresh)).toEqual(['ka', 'kb', 'kc', 'kf', 'kd', 'ke'])
    // collected: the done ones leave from the front
    expect(nextKeys(keys, before, slots.slice(2), { collect: 2 }, fresh)).toEqual(['kc', 'kd', 'ke', 'kf'])
    // a change it did not ask for: matched by recipe
    expect(nextKeys(keys, before, [...slots.slice(1), job('g', 'waiting')], null, fresh)).toEqual(['kb', 'kc', 'kd', 'ke', 'kf', 'new1'])
  })
})
