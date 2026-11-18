import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { PRODUCE, type ProduceId } from './data'
import { CHANNELS, LEDGER_DAYS, bookDays, freshLedger, noteSale, perUnit, sanitizeLedger, shareOut, soldAt, trimLedger, type Channel, type Ledger } from './ledger'

// The farm's sales book (src/farm/ledger.ts): a sale goes to its day, the book keeps two weeks up to today, and a book
// saved broken or by hand loads made safe.

const TODAY = 20_410

/** A book with these sales written in, in order: [days before today, channel, good, units, coins]. */
const book = (...sales: [number, Channel, ProduceId, number, number][]) => sales.reduce((b: Ledger, [back, ch, good, u, c]) => noteSale(b, TODAY - back, ch, good, u, c), freshLedger())

/** The rules every book keeps on `today`. */
function holds(b: Ledger, today: number) {
  const days = b.days.map((d) => d.day)
  expect([...days].sort((x, y) => x - y)).toEqual(days)
  expect(new Set(days).size).toBe(days.length)
  for (const d of b.days) {
    expect(Number.isInteger(d.day) && d.day <= today && d.day > today - LEDGER_DAYS).toBe(true)
    expect(Object.keys(d.sold).length).toBeGreaterThan(0)
    for (const [good, places] of Object.entries(d.sold)) {
      expect(PRODUCE.some((p) => p.id === good)).toBe(true)
      for (const [ch, t] of Object.entries(places ?? {})) {
        expect(CHANNELS).toContain(ch)
        expect(soldAt(good as ProduceId, ch as Channel)).toBe(true)
        expect(t).toHaveLength(2)
        for (const n of t as number[]) expect(Number.isSafeInteger(n) && n >= 0).toBe(true)
        expect((t as number[])[0] + (t as number[])[1]).toBeGreaterThan(0)
      }
    }
  }
}

describe('a sale written in', () => {
  it("goes to today's day, adding up with what was sold there the same day", () => {
    const b = book([0, 'gate', 'tomato', 4, 14], [0, 'gate', 'tomato', 2, 6], [0, 'order', 'tomato', 3, 11], [0, 'gate', 'egg', 1, 2])
    expect(b.days).toEqual([{ day: TODAY, sold: { tomato: { gate: [6, 20], order: [3, 11] }, egg: { gate: [1, 2] } } }])
  })

  it('starts a new day, the oldest kept first, and the book keeps two weeks up to the day of the sale', () => {
    const b = book([LEDGER_DAYS, 'gate', 'carrot', 1, 2], [LEDGER_DAYS - 1, 'manager', 'carrot', 10, 4], [3, 'shop', 'lemon_cake', 1, 63], [0, 'contractor', 'brick', 2, 20])
    // the sale of fourteen days ago went as the next one came: it is out of the two weeks
    expect(b.days.map((d) => TODAY - d.day)).toEqual([LEDGER_DAYS - 1, 3, 0])
    // and the next day the one of thirteen days ago goes too
    expect(noteSale(b, TODAY + 1, 'gate', 'egg', 1, 2).days.map((d) => TODAY + 1 - d.day)).toEqual([4, 1, 0])
  })

  it('on a day before the newest (a clock moved back) goes on its own day, and the days after it are left out', () => {
    const b = book([5, 'gate', 'egg', 1, 2], [1, 'gate', 'egg', 1, 2])
    expect(noteSale(b, TODAY - 3, 'gate', 'milk', 1, 4).days.map((d) => TODAY - d.day)).toEqual([5, 3])
  })

  it('writes nothing for a sale of nothing, of no good, on no day, or where it cannot happen', () => {
    const b = book([0, 'gate', 'egg', 1, 2])
    expect(noteSale(b, TODAY, 'gate', 'egg', 0, 0)).toBe(b)
    expect(noteSale(b, TODAY, 'gate', 'brick', 1, 10)).toBe(b)
    expect(noteSale(b, TODAY, 'contractor', 'egg', 1, 10)).toBe(b)
    expect(noteSale(b, TODAY, 'gate', 'gold' as ProduceId, 1, 10)).toBe(b)
    expect(noteSale(b, TODAY, 'post' as Channel, 'egg', 1, 10)).toBe(b)
    expect(noteSale(b, TODAY + 0.5, 'gate', 'egg', 1, 10)).toBe(b)
    expect(noteSale(b, NaN, 'gate', 'egg', 1, 10)).toBe(b)
  })

  it('counts whole numbers from 0 only, up to the last that still counts, and leaves the book it was given as it was', () => {
    const b = book([0, 'gate', 'egg', 2.7, -3], [0, 'gate', 'egg', NaN, 5])
    expect(b.days[0].sold.egg).toEqual({ gate: [2, 5] })
    const big = noteSale(noteSale(freshLedger(), TODAY, 'order', 'cloth', Number.MAX_SAFE_INTEGER, 1e300), TODAY, 'order', 'cloth', 5, 5)
    expect(big.days[0].sold.cloth).toEqual({ order: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER] })
    const before = JSON.stringify(b)
    noteSale(b, TODAY, 'gate', 'egg', 1, 1)
    expect(JSON.stringify(b)).toBe(before)
  })
})

describe('the book on a day', () => {
  it('is the same book when nothing is too old, and leaves out what is', () => {
    const b = book([10, 'gate', 'egg', 1, 2], [0, 'gate', 'egg', 1, 2])
    expect(trimLedger(b, TODAY)).toBe(b)
    expect(trimLedger(b, TODAY + 4).days.map((d) => d.day)).toEqual([TODAY])
    expect(trimLedger(b, TODAY - 1).days.map((d) => d.day)).toEqual([TODAY - 10])
  })

  it('is two weeks, the oldest first and today last, the days with nothing sold empty, and what a unit brought on each', () => {
    const b = book([3, 'gate', 'tomato', 4, 14], [3, 'order', 'tomato', 2, 8], [0, 'gate', 'egg', 1, 2])
    const days = bookDays(b, TODAY)
    expect(days.map((d) => d.day)).toEqual(Array.from({ length: LEDGER_DAYS }, (_, k) => TODAY - LEDGER_DAYS + 1 + k))
    expect(days[LEDGER_DAYS - 4].sold.tomato).toEqual({ gate: [4, 14], order: [2, 8] })
    expect(days[0].sold).toEqual({})
    const tomato = perUnit(b, 'tomato', TODAY)
    expect(tomato[LEDGER_DAYS - 4]).toBeCloseTo(22 / 6)
    expect(tomato.filter((n) => n !== null)).toHaveLength(1)
  })
})

describe('the book as saved', () => {
  it('loads as it was, and a farm from before the book, or garbage, has an empty one', () => {
    const b = book([12, 'manager', 'carrot', 10, 4], [3, 'shop', 'lemon_cake', 1, 63], [0, 'contractor', 'brick', 2, 20], [0, 'gate', 'egg', 1, 2])
    expect(sanitizeLedger(JSON.parse(JSON.stringify(b)), TODAY)).toEqual(b)
    for (const raw of [undefined, null, 'book', 42, [], {}, { days: 'x' }, { days: {} }]) expect(sanitizeLedger(raw, TODAY)).toEqual(freshLedger())
  })

  it('keeps only known goods where they can be sold, whole counts, the two weeks, each day once, the oldest first', () => {
    const raw = {
      days: [
        { day: TODAY, sold: { egg: { gate: [2, 4], post: [1, 1] }, gold: { gate: [1, 9] }, brick: { gate: [1, 10], contractor: [1, 10] }, tomato: { order: [2.9, -4] } } },
        // (as a save reads them: "__proto__" and "constructor" are keys of the day's own, never its prototype)
        { day: TODAY - 2, sold: JSON.parse('{"__proto__": {"gate": [1, 1]}, "constructor": {"gate": [1, 1]}, "milk": {"gate": [1, 4], "shop": "lots", "manager": [0, 0]}}') },
        { day: TODAY, sold: { egg: { gate: [1, 2] } } },
        { day: TODAY + 1, sold: { egg: { gate: [1, 2] } } },
        { day: TODAY - LEDGER_DAYS, sold: { egg: { gate: [1, 2] } } },
        { day: 'today', sold: { egg: { gate: [1, 2] } } },
        { day: TODAY - 1.5, sold: { egg: { gate: [1, 2] } } },
        { day: TODAY - 4, sold: { egg: { gate: [Infinity, NaN] }, milk: { order: [-1e308, '3'] } } },
        { day: TODAY - 5, sold: [] },
        null,
      ],
    }
    expect(sanitizeLedger(raw, TODAY)).toEqual({
      days: [
        { day: TODAY - 2, sold: { milk: { gate: [1, 4] } } },
        { day: TODAY, sold: { egg: { gate: [3, 6] }, brick: { contractor: [1, 10] }, tomato: { order: [2, 0] } } },
      ],
    })
  })

  it('keeps every rule whatever was saved, and reads its own book back the same (fast-check)', () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const b = sanitizeLedger({ days: [raw, { day: TODAY, sold: raw }, { day: TODAY - 1, sold: { egg: raw } }] }, TODAY)
        holds(b, TODAY)
        expect(sanitizeLedger(JSON.parse(JSON.stringify(b)), TODAY)).toEqual(b)
      }),
      { numRuns: 300 },
    )
  })
})

describe("coins shared out by weight (an order's pay, good by good)", () => {
  it('gives each part its share in whole coins, adding up to the whole', () => {
    expect(shareOut(30, [12, 4])).toEqual([23, 7])
    expect(shareOut(31, [12, 8, 42])).toEqual([6, 4, 21])
    expect(shareOut(10, [1, 1, 1])).toEqual([3, 4, 3])
    expect(shareOut(0, [5, 2])).toEqual([0, 0])
    expect(shareOut(7, [3])).toEqual([7])
    // a weight of nothing (or not a number) shares nothing; none above 0, alike
    expect(shareOut(9, [0, 3, -1, NaN])).toEqual([0, 9, 0, 0])
    expect(shareOut(9, [0, 0, 0])).toEqual([3, 3, 3])
  })

  it('never loses or makes a coin, and each part is within a coin of its share (fast-check)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99_999 }), fc.array(fc.double({ min: 0.01, max: 1e4, noNaN: true }), { minLength: 1, maxLength: 9 }), (total, weights) => {
        const parts = shareOut(total, weights)
        const all = weights.reduce((n, w) => n + w, 0)
        expect(parts.reduce((n, p) => n + p, 0)).toBe(total)
        parts.forEach((p, k) => {
          expect(Number.isInteger(p) && p >= 0).toBe(true)
          expect(Math.abs(p - (total * weights[k]) / all)).toBeLessThan(1 + 1e-9)
        })
      }),
      { numRuns: 500 },
    )
  })
})
