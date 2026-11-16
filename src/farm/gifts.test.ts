import { describe, expect, it } from 'vitest'
import { ITEMS, LEVELS, isItem, type ProduceId } from './data'
import {
  BOX_COUNT,
  CAME_KEPT,
  GIFT_ODDS,
  PER_LEVEL,
  boxAt,
  boxCoins,
  boxOf,
  boxXp,
  boxesReached,
  giftsFor,
  isOpen,
  rollArrival,
  rollBox,
  sanitizeGifts,
  settle,
  waitingBoxes,
  type Gifts,
} from './gifts'
import { levelOf, xpAt } from './xp'

// The level's gifts as rules (src/farm/gifts.ts): four boxes on each level's bar, at its quarters; what a box and a
// level reached hold, rolled on dice given; the record as saved, read back safe.

/** Dice that give these numbers in turn (the last one after that). */
const dice = (...n: number[]) => {
  let k = 0
  return () => n[Math.min(k++, n.length - 1)]
}

describe('the boxes on a level’s bar', () => {
  it('four a level, at 25 %, 50 %, 75 % and 100 % of its XP: the last one comes with the next level', () => {
    for (let level = 1; level < 60; level++) {
      const from = xpAt(level)
      const need = xpAt(level + 1) - from
      expect(boxesReached(from), `level ${level} begun`).toBe((level - 1) * PER_LEVEL)
      for (let q = 0; q < PER_LEVEL; q++) {
        const at = from + Math.ceil(((q + 1) * need) / PER_LEVEL)
        expect(boxXp(boxAt(level, q))).toBe(at)
        // one XP short of it: not reached; at it: reached
        expect(boxesReached(at - 1), `level ${level}, quarter ${q}, one short`).toBe(boxAt(level, q))
        expect(boxesReached(at), `level ${level}, quarter ${q}`).toBe(boxAt(level, q) + 1)
      }
      expect(levelOf(boxXp(boxAt(level, 3)))).toBe(level + 1)
    }
  })

  it('a box is its level and quarter; every box there is comes with the top level, and none past it', () => {
    for (const k of [0, 1, 3, 4, 7, 123, BOX_COUNT - 1]) expect(boxAt(boxOf(k).level, boxOf(k).q)).toBe(k)
    expect(boxOf(BOX_COUNT - 1)).toEqual({ level: LEVELS.max - 1, q: 3 })
    expect(boxesReached(xpAt(LEVELS.max) - 1)).toBe(BOX_COUNT - 1)
    expect(boxesReached(xpAt(LEVELS.max))).toBe(BOX_COUNT)
    expect(boxesReached(Number.MAX_SAFE_INTEGER)).toBe(BOX_COUNT)
    expect(boxesReached(0)).toBe(0)
    expect(boxesReached(NaN)).toBe(0)
  })

  it('those waiting: every box reached and not opened, oldest first, this level’s and the levels’ before', () => {
    const g: Gifts = { open: 2, also: [5], gave: [], came: [], seen: 1 }
    const points = boxXp(boxAt(2, 2)) // level 2, its third box: boxes 0 to 6 reached
    expect(waitingBoxes(g, points)).toEqual([2, 3, 4, 6])
    expect([0, 1, 5].every((k) => isOpen(g, k))).toBe(true)
    expect([2, 6, 7].some((k) => isOpen(g, k))).toBe(false)
  })

  it('settled: the boxes opened in turn move the count on, those out of turn stay in order, each once', () => {
    expect(settle(2, [3, 2, 5, 5, 1])).toEqual({ open: 4, also: [5] })
    expect(settle(0, [])).toEqual({ open: 0, also: [] })
    expect(settle(0, [0, 1, 2])).toEqual({ open: 3, also: [] })
    expect(settle(4, [9, 7])).toEqual({ open: 4, also: [7, 9] })
  })
})

describe('what a gift holds (the dice given)', () => {
  const made: ProduceId[] = ['lettuce', 'egg', 'flour']
  it('a box: coins under their odds, sized to the level and more for the later quarters; else a material; else a few of a good the farm makes', () => {
    expect(rollBox(boxAt(1, 0), made, dice(0))).toEqual({ coins: boxCoins(1, 0) })
    expect(boxCoins(1, 0)).toBe(3)
    expect(boxCoins(10, 0)).toBe(11)
    expect(boxCoins(10, 3)).toBe(28)
    for (let q = 1; q < 4; q++) expect(boxCoins(20, q)).toBeGreaterThan(boxCoins(20, q - 1))
    // at the odds: a material (the dice's next number picks which of the six)
    expect(rollBox(boxAt(3, 0), made, dice(GIFT_ODDS.coins, 0))).toEqual({ item: ITEMS[0], n: 1 })
    expect(rollBox(boxAt(3, 3), made, dice(GIFT_ODDS.coins, 0.99))).toEqual({ item: ITEMS[5], n: 2 })
    expect(rollBox(boxAt(60, 0), made, dice(0.6, 0))).toEqual({ item: ITEMS[0], n: 3 })
    // past both: a few of a good the farm has made (never a building material)
    expect(rollBox(boxAt(3, 0), made, dice(0.9, 0))).toEqual({ item: 'lettuce', n: 2 })
    expect(rollBox(boxAt(3, 2), made, dice(0.9, 0.99))).toEqual({ item: 'flour', n: 4 })
    expect(rollBox(boxAt(3, 2), ['brick', 'egg'], dice(0.9, 0))).toEqual({ item: 'egg', n: 4 })
    // a farm that has made nothing yet: a material instead
    expect(rollBox(boxAt(3, 0), [], dice(0.9, 0))).toEqual({ item: ITEMS[0], n: 1 })
  })

  it('every prize small and real: coins from 3, goods from 1 to 10, materials from 1 to 5, at any level', () => {
    let seed = 7
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    for (let k = 0; k < BOX_COUNT; k += 7) {
      const p = rollBox(k, made, random)
      if ('coins' in p) {
        expect(p.coins).toBeGreaterThanOrEqual(3)
        continue
      }
      expect(p.n).toBeGreaterThanOrEqual(1)
      expect(p.n).toBeLessThanOrEqual(isItem(p.item) ? 5 : 10)
      if (!isItem(p.item)) expect(made).toContain(p.item)
    }
  })

  it('a level reached: a few of one building material, more at the higher levels (2 up to 6)', () => {
    expect(rollArrival(2, dice(0))).toEqual({ item: ITEMS[0], n: 2 })
    expect(rollArrival(15, dice(0.99))).toEqual({ item: ITEMS[5], n: 3 })
    expect(rollArrival(LEVELS.max, dice(0.5))).toEqual({ item: ITEMS[3], n: 6 })
  })
})

describe('the record as saved', () => {
  const points = boxXp(boxAt(6, 1)) + 3 // level 6, its first two boxes reached
  const level = levelOf(points)
  const good: Gifts = {
    open: 18,
    also: [21],
    gave: [{ box: 21, prize: { coins: 9 } }],
    came: [
      { level: 5, prize: { item: 'brick', n: 2 } },
      { level: 6, prize: { item: 'log', n: 2 } },
    ],
    seen: 5,
  }

  it('a farm from before them: the boxes of the levels before count as opened, its own level’s reached so far wait', () => {
    expect(level).toBe(6)
    const g = sanitizeGifts(undefined, points)
    expect(g).toEqual(giftsFor(points))
    expect(g).toEqual({ open: boxAt(6, 0), also: [], gave: [], came: [], seen: 6 })
    expect(waitingBoxes(g, points)).toEqual([boxAt(6, 0), boxAt(6, 1)])
    expect(sanitizeGifts(null, 0)).toEqual({ open: 0, also: [], gave: [], came: [], seen: 1 })
  })

  it('as saved, it loads as it is (twice the same)', () => {
    expect(sanitizeGifts(good, points)).toEqual(good)
    expect(sanitizeGifts(JSON.parse(JSON.stringify(sanitizeGifts(good, points))), points)).toEqual(good)
  })

  it('broken: nothing given twice — a count it cannot read is every box reached, none opened past those reached', () => {
    const reached = boxesReached(points)
    expect(sanitizeGifts({ ...good, open: 'x' }, points).open).toBe(reached)
    expect(sanitizeGifts({ ...good, open: -1 }, points).open).toBe(reached)
    expect(sanitizeGifts({ ...good, open: 2.5 }, points).open).toBe(reached)
    expect(sanitizeGifts({ ...good, open: 9999 }, points).open).toBe(reached)
    // out of turn: only boxes reached and past the count, once each and in order (one next to the count moves it on)
    expect(sanitizeGifts({ ...good, also: [99, 21, 21, 3, 'x', 18.5] }, points)).toMatchObject({ open: 18, also: [21] })
    expect(sanitizeGifts({ ...good, also: [19, 18] }, points)).toMatchObject({ open: 20, also: [] })
    expect(sanitizeGifts({ ...good, also: 'all' }, points)).toMatchObject({ open: 18, also: [] })
  })

  it('broken: what the boxes gave only for this level’s boxes opened, the levels reached up to this one, the card told up to it', () => {
    const gave = [{ box: 21, prize: { coins: 9 } }, { box: 22, prize: { coins: 9 } }, { box: 3, prize: { coins: 9 } }, { box: 21, prize: { coins: 1 } }, { box: 18, prize: { item: 'egg', n: 0 } }, 'x']
    expect(sanitizeGifts({ ...good, gave }, points).gave).toEqual([{ box: 21, prize: { coins: 9 } }])
    expect(sanitizeGifts({ ...good, gave: [{ box: 20, prize: { item: 'moon', n: 2 } }] }, points).gave).toEqual([])
    const came = [{ level: 7, prize: { item: 'log', n: 2 } }, { level: 1, prize: { item: 'log', n: 2 } }, ...good.came, { level: 6, prize: { coins: 3 } }]
    expect(sanitizeGifts({ ...good, came }, points).came).toEqual(good.came)
    const many = Array.from({ length: 9 }, (_, k) => ({ level: 2 + k, prize: { item: 'nail', n: 2 } }))
    expect(sanitizeGifts({ ...good, came: many }, xpAt(20)).came.map((c) => c.level)).toEqual([6, 7, 8, 9, 10])
    expect(CAME_KEPT).toBe(5)
    expect(sanitizeGifts({ ...good, seen: 99 }, points).seen).toBe(level)
    expect(sanitizeGifts({ ...good, seen: 0 }, points).seen).toBe(level)
  })
})
