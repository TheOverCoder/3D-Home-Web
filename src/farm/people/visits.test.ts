import { describe, expect, it } from 'vitest'
import { personById } from '../../data/people'
import { BUYER_OFFERS, DAY, PEOPLE_ODDS, produceById } from '../data'
import { isOpen } from '../day'
import { keeperOf, kindFactor, neighbourAsk, whoComes } from './visits'

// The neighbours at the gate (src/farm/people/visits.ts): only one met, in their hours, not on the lane already, now
// and then; asking for a good they like, as many as a buyer would; at a fair or a generous price, never a low one.

/** A farm moment (seconds) at an hour of the farm's day. */
const at = (hour: number) => ((hour - DAY.start + 24) % 24) * (DAY.length / 24)

/** Dice that throw these, then 0.5. */
const dice =
  (...rolls: number[]) =>
  () =>
    rolls.shift() ?? 0.5

describe('the neighbours at the gate', () => {
  it('each keeps hours of their own (a row of HOURS)', () => {
    expect(keeperOf('baker')).toBe('baker')
    // the baker comes in the morning and at noon, not at night; the teacher after school
    expect(isOpen(keeperOf('baker'), at(9))).toBe(true)
    expect(isOpen(keeperOf('baker'), at(23))).toBe(false)
    expect(isOpen(keeperOf('teacher'), at(15))).toBe(true)
    expect(isOpen(keeperOf('teacher'), at(10))).toBe(false)
  })

  it('only one met, in their hours, not in line; and only now and then (PEOPLE_ODDS.visit)', () => {
    const noon = at(12)
    // nobody met: nobody
    expect(whoComes([], noon, [], dice(0))).toBeNull()
    expect(whoComes(['baker'], noon, [], dice(0))).toBe('baker')
    // past the odds: a stranger comes
    expect(whoComes(['baker'], noon, [], dice(PEOPLE_ODDS.visit))).toBeNull()
    // in line already: not again
    expect(whoComes(['baker'], noon, [undefined, 'baker'], dice(0))).toBeNull()
    // out of their hours: not now (the teacher comes after school)
    expect(whoComes(['teacher'], noon, [], dice(0))).toBeNull()
    expect(whoComes(['teacher'], at(15), [], dice(0))).toBe('teacher')
    // of two free, by the second throw
    expect(whoComes(['baker', 'knitter'], noon, [], dice(0, 0.99))).toBe('knitter')
    expect(whoComes(['baker', 'knitter'], noon, [], dice(0, 0))).toBe('baker')
  })

  it('a good they like: one in store first, else one the farm makes; as many as a buyer asks', () => {
    // the baker likes flour and eggs
    expect(personById('baker').likes).toEqual(['flour', 'egg'])
    expect(neighbourAsk('baker', ['egg', 'flour'], { egg: 10 }, dice(0.99, 0.5)).want).toBe('egg')
    expect(neighbourAsk('baker', ['flour'], {}, dice(0.99, 0.5)).want).toBe('flour')
    expect(neighbourAsk('baker', [], {}, dice(0.99, 0.5)).want).toBe('flour')
    for (let r = 0; r < 1; r += 0.05) {
      const a = neighbourAsk('child', ['milk', 'egg'], { milk: r * 40 }, dice(r, r, r))
      expect(['milk', 'egg']).toContain(a.want)
      expect(a.qty >= 1 && a.qty <= produceById(a.want).maxAsk, `${r}`).toBe(true)
    }
  })

  it('a fair or a generous price, in the odds of the buyers who offer one', () => {
    const fair = BUYER_OFFERS.filter((o) => o.factor >= 1).map((o) => o.factor)
    for (let r = 0; r < 1; r += 0.01) expect(fair, `${r}`).toContain(kindFactor(r))
    expect(kindFactor(0)).toBe(1)
    expect(kindFactor(0.9999)).toBe(Math.max(...fair))
  })
})
