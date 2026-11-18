import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { MOST, amount, cycle, field, floorCount, int, intIn, isObject, isRecord, list, namesOf, num, oneOf, seconds } from './saved'

// The save readers (update-v1/CONTRACTS.md §1.2). Each must read exactly as the copy it replaces does today, so that
// moving a sanitizer onto it changes no save; those copies are private to their files, so they are written out here
// as they stand (src/farm/state.ts, src/farm/ledger.ts, src/farm/gifts.ts), until the move deletes them.
const today = {
  num: (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d),
  int: (v: unknown, d: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(today.num(v, d)))),
  amount: (v: unknown, d: number) => today.int(v, d, 0, Number.MAX_SAFE_INTEGER),
  span: (v: unknown, most: number) => Math.min(most, Math.max(0, today.num(v, 0))),
  clock: (v: unknown, every: number) => {
    const t = today.num(v, 0)
    return t > 0 && t < every ? t : 0
  },
  ledgerWhole: (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(v)) : 0),
  giftsWhole: (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi,
}

const ODD = [0, -0, 1, -1, 0.5, 2.6, -2.5, 1e-300, 2 ** 53, 2 ** 53 + 2, 1e20, -1e20, 1e308, Infinity, -Infinity, NaN, '3', '', null, undefined, true, [], {}, [4]]
const anything = fc.oneof(fc.constantFrom(...ODD), fc.double(), fc.integer(), fc.anything())
const same = (a: number, b: number) => Object.is(a, b) || a === b

describe('the save readers', () => {
  it('read exactly as the copies they replace', () => {
    fc.assert(
      fc.property(anything, fc.integer({ min: -5, max: 5 }), fc.integer({ min: 0, max: 99 }), (v, d, hi) => {
        expect(same(num(v, d), today.num(v, d))).toBe(true)
        expect(same(int(v, d, -3, hi), today.int(v, d, -3, hi))).toBe(true)
        expect(same(amount(v, d), today.amount(v, d))).toBe(true)
        expect(same(seconds(v, hi), today.span(v, hi))).toBe(true)
        expect(same(cycle(v, hi + 1), today.clock(v, hi + 1))).toBe(true)
        expect(floorCount(v)).toBe(today.ledgerWhole(v))
        expect(intIn(v, -3, hi)).toBe(today.giftsWhole(v, -3, hi))
      }),
      { numRuns: 1000 },
    )
  })

  it('keep their ranges whatever was saved', () => {
    fc.assert(
      fc.property(anything, (v) => {
        expect(Number.isFinite(num(v, 7))).toBe(true)
        const n = amount(v, 0)
        expect(Number.isInteger(n) && n >= 0 && n <= MOST).toBe(true)
        const c = floorCount(v)
        expect(Number.isInteger(c) && c >= 0 && c <= MOST).toBe(true)
        const s = seconds(v, 40)
        expect(s >= 0 && s <= 40).toBe(true)
        const t = cycle(v, 40)
        expect(t >= 0 && t < 40).toBe(true)
        expect(Array.isArray(list(v))).toBe(true)
      }),
      { numRuns: 1000 },
    )
  })

  it('tell an object from a record, and read a part of either', () => {
    expect(isObject([1])).toBe(true)
    expect(isRecord([1])).toBe(false)
    expect(isRecord({ a: 1 })).toBe(true)
    for (const v of [null, undefined, 0, 'x', true]) expect(isObject(v) || isRecord(v)).toBe(false)
    expect(field({ a: 1 }, 'a')).toBe(1)
    expect(field([5, 6], 1)).toBe(6)
    expect(field('ab', 0)).toBeUndefined()
    expect(field(null, 'a')).toBeUndefined()
  })

  it('read a name, or names, only from those given', () => {
    const NAMES = ['red', 'blue', 'green'] as const
    expect(oneOf('blue', NAMES)).toBe('blue')
    for (const v of ['Blue', 'constructor', '__proto__', 1, null, ['blue']]) expect(oneOf(v, NAMES)).toBeNull()
    expect(namesOf(['green', 'x', 'red', 'green', 3, 'blue'], NAMES)).toEqual(['green', 'red', 'blue'])
    expect(namesOf('red', NAMES)).toEqual([])
  })
})
