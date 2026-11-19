import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setMotionPref } from '../ui/still'
import { REACTIONS, cropShown, freeze, react, reacting, reaction, scaleAt, slotsShown, stopReactions, type Reaction } from './react'

// Reactions in the world (src/fx/react.ts): each row short, within 30 % of the thing's size, ending at rest or at
// nothing (a thing that leaves), eased between its moments with no overshoot; a reaction runs by the clock and is over by
// its length, starts again when asked again, holds still when frozen (the tests' frozen pose), and is never asked for
// under less motion.

const KINDS = Object.keys(REACTIONS) as Reaction[]

let clock = 1000
beforeEach(() => {
  clock = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  stopReactions()
  freeze(null)
})
afterEach(() => {
  vi.restoreAllMocks()
  setMotionPref('device')
  freeze(null)
  stopReactions()
})

describe('the rows', () => {
  it('each lasts at most 400 ms, from its first moment (0) to its last (1), in order', () => {
    for (const kind of KINDS) {
      const { ms, keys } = REACTIONS[kind]
      expect(ms, kind).toBeGreaterThan(0)
      expect(ms, kind).toBeLessThanOrEqual(400)
      expect(keys[0][0], kind).toBe(0)
      expect(keys[keys.length - 1][0], kind).toBe(1)
      for (let k = 1; k < keys.length; k++) expect(keys[k][0], `${kind} ${k}`).toBeGreaterThan(keys[k - 1][0])
    }
  })

  it('each ends at rest, or at nothing for a thing that leaves; starts at rest, or small for a thing that comes up; keeps within 30 % between', () => {
    const leaves = KINDS.filter((k) => REACTIONS[k].keys.at(-1)![1] === 0)
    const comes = KINDS.filter((k) => REACTIONS[k].keys[0][1] < 1)
    expect(leaves.sort()).toEqual(['pick', 'pluck'])
    expect(comes).toEqual(['sprout'])
    for (const kind of KINDS) {
      const keys = REACTIONS[kind].keys
      const last = keys[keys.length - 1]
      expect(
        [
          [1, 1, 1],
          [1, 0, 0],
        ],
        kind,
      ).toContainEqual([...last])
      const first = keys[0]
      if (comes.includes(kind)) expect(first[1] > 0 && first[1] < 1 && first[2] > 0 && first[2] < 1, kind).toBe(true)
      else expect([...first], kind).toEqual([0, 1, 1])
      for (const [t, xz, y] of keys.slice(1, -1)) {
        expect(Math.abs(xz - 1), `${kind} at ${t}`).toBeLessThanOrEqual(0.3)
        expect(Math.abs(y - 1), `${kind} at ${t}`).toBeLessThanOrEqual(0.3)
      }
    }
  })

  it('eased between its moments: through each, never past the two either side of it, never below nothing', () => {
    for (const kind of KINDS) {
      const keys = REACTIONS[kind].keys
      for (const [t, xz, y] of keys) expect(scaleAt(kind, t), `${kind} at ${t}`).toEqual({ xz: expect.closeTo(xz, 9), y: expect.closeTo(y, 9) })
      for (let s = 0; s <= 1; s += 1 / 200) {
        const k = Math.max(
          1,
          keys.findIndex((key) => key[0] >= s),
        )
        const [a, b] = [keys[k - 1], keys[k]]
        const v = scaleAt(kind, s)
        expect(v.xz, `${kind} at ${s}`).toBeGreaterThanOrEqual(Math.min(a[1], b[1]) - 1e-9)
        expect(v.xz, `${kind} at ${s}`).toBeLessThanOrEqual(Math.max(a[1], b[1]) + 1e-9)
        expect(v.y, `${kind} at ${s}`).toBeGreaterThanOrEqual(Math.min(a[2], b[2]) - 1e-9)
        expect(v.y, `${kind} at ${s}`).toBeLessThanOrEqual(Math.max(a[2], b[2]) + 1e-9)
        expect(Math.min(v.xz, v.y)).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('a reaction', () => {
  it('runs by the clock, with the caller’s data, and is over by its length: at rest, not reacting', () => {
    expect([reaction('plant', 3), reacting('plant')]).toEqual([null, false])
    react('plant', 3, 'perk', { crop: 'lettuce' })
    expect(reaction('plant', 3)).toEqual({ xz: 1, y: 1, kind: 'perk', data: { crop: 'lettuce' } })
    expect(reacting('plant')).toBe(true)
    clock += REACTIONS.perk.ms * 0.35
    expect(reaction('plant', 3)).toMatchObject({ xz: expect.closeTo(0.97, 9), y: expect.closeTo(1.12, 9) })
    clock = 1000 + REACTIONS.perk.ms
    expect([reaction('plant', 3), reacting('plant')]).toEqual([null, false])
  })

  it('a thing that leaves is at nothing by the end of its reaction, then over', () => {
    react('fruit', 'lemon-2', 'pick')
    clock += REACTIONS.pick.ms - 0.001
    const end = reaction('fruit', 'lemon-2')!
    expect(end.xz).toBeLessThan(0.001)
    expect(end.y).toBeLessThan(0.001)
    clock += 0.001
    expect(reaction('fruit', 'lemon-2')).toBeNull()
  })

  it('asked again, starts again; each owner keeps its own ids', () => {
    react('animal', 0, 'wiggle')
    clock += 300
    react('animal', 0, 'wiggle')
    expect(reaction('animal', 0)).toMatchObject({ xz: 1, y: 1 })
    clock += 300
    expect(reaction('animal', 0)).not.toBeNull()
    expect(reaction('thing', 0)).toBeNull()
    react('thing', 0, 'settle')
    clock += REACTIONS.wiggle.ms
    expect([reacting('animal'), reacting('thing')]).toEqual([false, false])
  })

  it('frozen: held at that moment however the clock runs, and running again from the clock once let go', () => {
    react('plant', 1, 'sprout')
    freeze(120)
    const held = scaleAt('sprout', 120 / REACTIONS.sprout.ms)
    expect(reaction('plant', 1)).toMatchObject(held)
    clock += 10_000
    expect(reaction('plant', 1)).toMatchObject(held)
    expect(reacting('plant')).toBe(true)
    freeze(null)
    expect([reaction('plant', 1), reacting('plant')]).toEqual([null, false])
  })

  it('under less motion: never asked for', () => {
    setMotionPref('less')
    react('thing', 'fence-1', 'settle')
    expect([reaction('thing', 'fence-1'), reacting('thing')]).toEqual([null, false])
  })
})

// what has left is drawn until its reaction is over, and never more than the place holds full
describe('the ghosts', () => {
  it('a bed harvested draws the crop it had, plucked away, until the pluck is over; sown again, its new crop', () => {
    expect(cropShown<string>(null, reaction('plant', 0))).toBeNull()
    react('plant', 0, 'pluck', { crop: 'pumpkin' })
    expect(cropShown<string>(null, reaction('plant', 0))).toBe('pumpkin')
    expect(cropShown('corn', reaction('plant', 0))).toBe('corn')
    // (a watering's perk or a sowing's sprout keeps no ghost)
    react('plant', 1, 'perk', { crop: 'pumpkin' })
    expect(cropShown<string>(null, reaction('plant', 1))).toBeNull()
    clock += REACTIONS.pluck.ms
    expect(cropShown<string>(null, reaction('plant', 0))).toBeNull()
  })

  it('a place picked draws what is left at rest and the ones taken popping off, up to all it holds; at rest only what is there', () => {
    expect(slotsShown(3, reaction('fruit', 'tree:0'), 8)).toEqual({ n: 3, popping: null })
    react('fruit', 'tree:0', 'pick', { from: 1, to: 5 })
    clock += 80
    const r = reaction('fruit', 'tree:0')
    expect(slotsShown(1, r, 8)).toEqual({ n: 5, popping: { xz: r!.xz, y: r!.y } })
    expect(r!.xz).toBeGreaterThan(1)
    // a nest that shows two at most: never more than two
    expect(slotsShown(0, r, 2)).toMatchObject({ n: 2 })
    // a new one laid meanwhile is at rest, not popping
    expect(slotsShown(5, r, 8)).toEqual({ n: 5, popping: null })
    clock += REACTIONS.pick.ms
    expect(slotsShown(1, reaction('fruit', 'tree:0'), 8)).toEqual({ n: 1, popping: null })
  })
})
