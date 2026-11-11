import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LEVELS } from './data'
import { levelOf, levelReward, sanitizeXp, seedXp, unpaidCoins, xpAt, xpForSale, type Xp } from './xp'

// Levels (src/farm/xp.ts): the curve and its inverse, the rewards waiting to be claimed, what a sale is worth, the XP a
// farm from before levels starts with, and the saved XP read back. Pure: no farm, no page.

const RUNS = Number(process.env.FC_RUNS) || 300
const MAX = Number.MAX_SAFE_INTEGER

/** The highest level whose XP a number still holds exactly (xpAt(L) ≤ 2^53). */
function topLevel() {
  let L = Math.floor(Math.sqrt((2 * 2 ** 53) / LEVELS.step))
  while (xpAt(L) > 2 ** 53) L--
  while (xpAt(L + 1) <= 2 ** 53) L++
  return L
}

/** A saved XP that the game can use: whole points from 0, paid a whole level from 1 up to the one reached. */
function valid(xp: Xp) {
  return Number.isInteger(xp.points) && xp.points >= 0 && xp.points <= MAX && Number.isInteger(xp.paid) && xp.paid >= 1 && xp.paid <= levelOf(xp.points) && Object.keys(xp).length === 2
}

describe('the curve', () => {
  it('level 1 at 0, and from level L to the next takes LEVELS.step · L', () => {
    expect(xpAt(1)).toBe(0)
    expect(xpAt(2)).toBe(15)
    expect(xpAt(5)).toBe(150)
    expect(xpAt(10)).toBe(675)
    for (let L = 1; L < 200; L++) expect(xpAt(L + 1) - xpAt(L)).toBe(LEVELS.step * L)
  })

  it('levelOf is its inverse: xpAt(L) is level L, one point less is L − 1, for every level a number holds exactly (to 2^53)', () => {
    const top = topLevel()
    expect(xpAt(top)).toBeLessThanOrEqual(2 ** 53)
    expect(xpAt(top + 1)).toBeGreaterThan(2 ** 53)
    const levels = new Set<number>()
    for (let L = 1; L <= 3000; L++) levels.add(L)
    // every 1000th level, then each level near the top, then a spread in between
    for (let L = 3000; L <= top; L += 1000) levels.add(L)
    for (let L = top - 3000; L <= top; L++) levels.add(L)
    for (let L = 3000; L < top; L = Math.ceil(L * 1.01)) levels.add(L)
    for (const L of levels) {
      expect(levelOf(xpAt(L)), `level ${L} at ${xpAt(L)}`).toBe(L)
      if (L > 1) expect(levelOf(xpAt(L) - 1), `just before level ${L}`).toBe(L - 1)
    }
  })

  it('any number of points sits between its level and the next', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX }), (p) => {
        const L = levelOf(p)
        return Number.isInteger(L) && L >= 1 && xpAt(L) <= p && p < xpAt(L + 1)
      }),
      { numRuns: RUNS },
    )
  })

  it('never hangs and never gives a level that is not one: NaN, negatives, fractions, Infinity and numbers past 2^53', () => {
    const t0 = performance.now()
    expect(levelOf(NaN)).toBe(1)
    expect(levelOf(-1)).toBe(1)
    expect(levelOf(-Infinity)).toBe(1)
    expect(levelOf(14.99)).toBe(1)
    expect(levelOf(15.5)).toBe(2)
    const top = levelOf(MAX)
    expect(top).toBe(topLevel())
    for (const p of [2 ** 53, 2 ** 60, 1e300, Number.MAX_VALUE, Infinity]) expect(levelOf(p), String(p)).toBe(top)
    expect(performance.now() - t0).toBeLessThan(1000)
  })
})

describe('the rewards', () => {
  it('reaching level L pays LEVELS.reward · L', () => {
    expect(levelReward(2)).toBe(20)
    expect(levelReward(10)).toBe(100)
    for (let L = 1; L < 50; L++) expect(levelReward(L)).toBe(LEVELS.reward * L)
  })

  it('the coins waiting are every level above the one paid up to the one reached, and nothing once paid', () => {
    expect(unpaidCoins({ points: 0, paid: 1 })).toBe(0)
    expect(unpaidCoins({ points: xpAt(2) - 1, paid: 1 })).toBe(0)
    expect(unpaidCoins({ points: xpAt(2), paid: 1 })).toBe(20)
    expect(unpaidCoins({ points: xpAt(5), paid: 1 })).toBe(20 + 30 + 40 + 50)
    expect(unpaidCoins({ points: xpAt(5), paid: 3 })).toBe(40 + 50)
    expect(unpaidCoins({ points: xpAt(5), paid: 5 })).toBe(0)
    expect(unpaidCoins({ points: xpAt(5), paid: 9 }), 'paid past the level reached').toBe(0)
    // the closed form against adding level by level
    for (let paid = 1; paid < 30; paid++)
      for (let level = 1; level < 40; level++) {
        let sum = 0
        for (let L = paid + 1; L <= level; L++) sum += levelReward(L)
        expect(unpaidCoins({ points: xpAt(level), paid })).toBe(sum)
      }
  })

  it('level 1 is never paid (everyone starts there), and a broken paid counts as 1', () => {
    expect(unpaidCoins({ points: xpAt(3), paid: 0 })).toBe(20 + 30)
    expect(unpaidCoins({ points: xpAt(3), paid: -4 })).toBe(20 + 30)
    expect(unpaidCoins({ points: xpAt(3), paid: NaN })).toBe(20 + 30)
  })

  it('is quick and finite at the top of the curve', () => {
    const coins = unpaidCoins({ points: MAX, paid: 1 })
    expect(Number.isFinite(coins) && coins > 0).toBe(true)
  })
})

describe('a sale', () => {
  it('is worth one XP for every five coins, at least one', () => {
    expect(xpForSale(1)).toBe(1)
    expect(xpForSale(5)).toBe(1)
    expect(xpForSale(6)).toBe(2)
    expect(xpForSale(10)).toBe(2)
    expect(xpForSale(1500)).toBe(300)
    expect(xpForSale(0)).toBe(1)
    expect(xpForSale(NaN)).toBe(1)
  })
})

describe('a farm from before levels', () => {
  it('starts with XP for what it did: a harvest 1, a cake 2, five coins earned 1, an order sent 10', () => {
    expect(seedXp({ harvested: 0, baked: 0, earned: 0, sent: 0 })).toBe(0)
    expect(seedXp({ harvested: 40, baked: 3, earned: 123, sent: 2 })).toBe(40 + 6 + 25 + 20)
    expect(seedXp({ harvested: 1200, baked: 50, earned: 9000, sent: 31 })).toBe(1200 + 100 + 1800 + 310)
    expect(seedXp({ harvested: 0, baked: 0, earned: 1, sent: 0 })).toBe(1)
  })

  it('counts a missing or broken number as none', () => {
    expect(seedXp({})).toBe(0)
    expect(seedXp({ harvested: 10 })).toBe(10)
    expect(seedXp({ harvested: -5, baked: NaN, earned: Infinity, sent: 2.9 })).toBe(20)
    expect(seedXp({ harvested: 7.8, earned: 4.2 })).toBe(7 + 1)
  })

  it('is seeded with its levels already paid (no reward for what was done before)', () => {
    const seed = seedXp({ harvested: 400, baked: 20, earned: 3000, sent: 5 })
    const xp = sanitizeXp(undefined, seed)
    expect(xp).toEqual({ points: seed, paid: levelOf(seed) })
    expect(unpaidCoins(xp)).toBe(0)
  })
})

describe('the saved XP read back', () => {
  it('keeps a good save as it is', () => {
    expect(sanitizeXp({ points: 0, paid: 1 }, 99)).toEqual({ points: 0, paid: 1 })
    expect(sanitizeXp({ points: xpAt(6) + 3, paid: 4 }, 99)).toEqual({ points: xpAt(6) + 3, paid: 4 })
    expect(sanitizeXp({ points: xpAt(6), paid: 6 }, 99)).toEqual({ points: xpAt(6), paid: 6 })
  })

  it('seeds a save from before levels (nothing there, or no points)', () => {
    for (const raw of [undefined, null, 'xp', 7, true, [], {}, { paid: 3 }, { points: '50', paid: 1 }]) expect(sanitizeXp(raw, 200), JSON.stringify(raw)).toEqual({ points: 200, paid: levelOf(200) })
    for (const seed of [NaN, -3, Infinity, 2.5]) expect(valid(sanitizeXp(undefined, seed)), String(seed)).toBe(true)
  })

  it('puts broken numbers right: points whole and from 0, paid from 1 and never past the level reached', () => {
    expect(sanitizeXp({ points: -10, paid: 1 }, 0)).toEqual({ points: 0, paid: 1 })
    expect(sanitizeXp({ points: NaN, paid: 1 }, 0)).toEqual({ points: 0, paid: 1 })
    expect(sanitizeXp({ points: Infinity, paid: 1 }, 0)).toEqual({ points: 0, paid: 1 })
    expect(sanitizeXp({ points: 1e300, paid: 1 }, 0)).toEqual({ points: MAX, paid: 1 })
    expect(sanitizeXp({ points: 20.7, paid: 1.9 }, 0)).toEqual({ points: 20, paid: 1 })
    expect(sanitizeXp({ points: xpAt(3), paid: 9 }, 0)).toEqual({ points: xpAt(3), paid: 3 })
    expect(sanitizeXp({ points: xpAt(3), paid: 0 }, 0)).toEqual({ points: xpAt(3), paid: 1 })
    expect(sanitizeXp({ points: xpAt(3), paid: 'all' }, 0)).toEqual({ points: xpAt(3), paid: 1 })
    expect(sanitizeXp({ points: xpAt(3), paid: 2, extra: 'x' }, 0)).toEqual({ points: xpAt(3), paid: 2 })
  })

  it('whatever was saved, reads back as a valid XP', () => {
    const num = fc.oneof(fc.double(), fc.integer(), fc.constantFrom(NaN, Infinity, -Infinity, -0, 2 ** 53, 1e300))
    const raw = fc.oneof(fc.anything(), fc.record({ points: fc.oneof(num, fc.anything()), paid: fc.oneof(num, fc.anything()) }, { requiredKeys: [] }))
    fc.assert(
      fc.property(raw, num, (r, seed) => valid(sanitizeXp(r, seed))),
      { numRuns: RUNS },
    )
  })
})
