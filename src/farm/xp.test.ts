import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LEVELS } from './data'
import { CURVE, FIRST_STEP, GROW, KNEE, levelOf, levelProgress, levelReward, onToday, sanitizeXp, savedOnToday, seedXp, unpaidCoins, xpAt, xpForSale, type Xp } from './xp'

// Levels (src/farm/xp.ts): the curve and its inverse, the rewards waiting to be claimed, what a sale is worth, the XP a
// farm from before levels starts with, and the saved XP read back. Pure: no farm, no page.

const RUNS = Number(process.env.FC_RUNS) || 300
const MAX = Number.MAX_SAFE_INTEGER
const TOP = LEVELS.max

/** A saved XP that the game can use: whole points from 0, paid a whole level from 1 up to the one reached. */
function valid(xp: Xp) {
  return Number.isInteger(xp.points) && xp.points >= 0 && xp.points <= MAX && Number.isInteger(xp.paid) && xp.paid >= 1 && xp.paid <= levelOf(xp.points) && Object.keys(xp).length === 2
}

describe('the curve', () => {
  it('level 1 at 0; from level L to the next takes LEVELS.step · L up to KNEE (the first day as it always was), then a little more each level', () => {
    expect(xpAt(1)).toBe(0)
    expect(xpAt(2)).toBe(30)
    expect(xpAt(5)).toBe(300)
    expect(xpAt(10)).toBe(1350)
    for (let L = 1; L <= KNEE; L++) expect(xpAt(L + 1) - xpAt(L)).toBe(LEVELS.step * L)
    for (let L = KNEE + 1; L < TOP; L++) expect(xpAt(L + 1) - xpAt(L)).toBe(Math.round(LEVELS.step * L * (1 + GROW * Math.log(L - KNEE + 1))))
    // the month JOURNEY.md lays the content out over: about the XP of today's day 7, 14 and 30 (src/sim, the daily player)
    expect(xpAt(20)).toBe(13_109)
    expect(xpAt(29)).toBe(36_144)
    expect(xpAt(44)).toBe(102_106)
  })

  it('500 levels, each harder to reach than the one before; the top one at 23,300,357 XP (a whole number, far under the most a number holds)', () => {
    expect(TOP).toBe(500)
    expect(xpAt(TOP)).toBe(23_300_357)
    for (let L = 2; L < TOP; L++) expect(xpAt(L + 1) - xpAt(L)).toBeGreaterThan(xpAt(L) - xpAt(L - 1))
  })

  it('levelOf is its inverse: xpAt(L) is level L, one point less is L − 1, for every level to the top', () => {
    for (let L = 1; L <= TOP; L++) {
      expect(levelOf(xpAt(L)), `level ${L} at ${xpAt(L)}`).toBe(L)
      if (L > 1) expect(levelOf(xpAt(L) - 1), `just before level ${L}`).toBe(L - 1)
    }
  })

  it('any number of points sits between its level and the next; from the top level on, it is the top level', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX }), (p) => {
        const L = levelOf(p)
        return Number.isInteger(L) && L >= 1 && L <= TOP && xpAt(L) <= p && (L === TOP || p < xpAt(L + 1))
      }),
      { numRuns: RUNS },
    )
    expect(levelOf(xpAt(TOP) - 1)).toBe(TOP - 1)
    expect(levelOf(xpAt(TOP) * 3)).toBe(TOP)
  })

  it('the progress of a level: the points into it and to the next; at the top, a full bar and no next', () => {
    expect(levelProgress(0)).toEqual({ level: 1, into: 0, need: 30, top: false })
    expect(levelProgress(xpAt(5) + 7)).toEqual({ level: 5, into: 7, need: 150, top: false })
    expect(levelProgress(xpAt(TOP))).toEqual({ level: TOP, into: 1, need: 1, top: true })
    expect(levelProgress(MAX)).toEqual({ level: TOP, into: 1, need: 1, top: true })
  })

  it('never hangs and never gives a level that is not one: NaN, negatives, fractions, Infinity and numbers past 2^53', () => {
    const t0 = performance.now()
    expect(levelOf(NaN)).toBe(1)
    expect(levelOf(-1)).toBe(1)
    expect(levelOf(-Infinity)).toBe(1)
    expect(levelOf(29.99)).toBe(1)
    expect(levelOf(30.5)).toBe(2)
    expect(levelOf(MAX)).toBe(TOP)
    for (const p of [2 ** 53, 2 ** 60, 1e300, Number.MAX_VALUE, Infinity]) expect(levelOf(p), String(p)).toBe(TOP)
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

  it('stops at the top level: XP past it pays nothing more', () => {
    let sum = 0
    for (let L = 2; L <= TOP; L++) sum += levelReward(L)
    expect(unpaidCoins({ points: MAX, paid: 1 })).toBe(sum)
    expect(unpaidCoins({ points: xpAt(TOP) * 2, paid: TOP })).toBe(0)
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

// The curve was made steeper (LEVELS.step 15 → 30); a save marks the curve its XP was counted on, and one from before
// the mark was made under the first. Its XP is moved onto today's curve: the same level, the same share of the way.
describe('XP saved under the first curve', () => {
  /** The first curve, worked out here: where level L began, the level of some points, and the quarter of its bar. */
  const firstAt = (level: number) => (FIRST_STEP * level * (level - 1)) / 2
  const firstLevel = (p: number) => {
    let level = 1
    while (level < TOP && firstAt(level + 1) <= p) level++
    return level
  }
  const quarter = (into: number, need: number) => Math.min(3, Math.floor((4 * into) / need))

  it('every level keeps its number, from its first point to its last', () => {
    for (let L = 1; L < TOP; L++) {
      expect(levelOf(onToday(firstAt(L), FIRST_STEP)), `level ${L}`).toBe(L)
      expect(onToday(firstAt(L), FIRST_STEP), `level ${L} begins where it begins today`).toBe(xpAt(L))
      expect(levelOf(onToday(firstAt(L + 1) - 1, FIRST_STEP)), `the end of level ${L}`).toBe(L)
    }
    expect(levelOf(onToday(firstAt(TOP), FIRST_STEP))).toBe(TOP)
  })

  it('level 20 halfway to 21 is level 20 halfway', () => {
    const need = xpAt(21) - xpAt(20)
    expect(levelProgress(onToday(firstAt(20) + 150, FIRST_STEP))).toEqual({ level: 20, into: Math.ceil(need / 2), need, top: false })
  })

  it('any points: the same level, at least the same share of its bar (the same boxes reached), and more points never fewer', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: firstAt(TOP) + 10_000 }), fc.integer({ min: 0, max: 50 }), (p, more) => {
        const now = onToday(p, FIRST_STEP)
        const level = firstLevel(p)
        const was = levelProgress(now)
        if (level === TOP) return was.level === TOP && now >= xpAt(TOP)
        const share = (p - firstAt(level)) / (firstAt(level + 1) - firstAt(level))
        return (
          was.level === level &&
          was.into / was.need >= share &&
          quarter(was.into, was.need) === quarter(p - firstAt(level), firstAt(level + 1) - firstAt(level)) &&
          onToday(p + more, FIRST_STEP) >= now
        )
      }),
      { numRuns: RUNS },
    )
  })

  it('a save without the mark is moved; one marked with today’s curve, or with a mark that cannot be read, is not', () => {
    expect(savedOnToday({ points: firstAt(7) + 3, paid: 7 })).toEqual({ points: onToday(firstAt(7) + 3, FIRST_STEP), paid: 7 })
    const today = { points: firstAt(7) + 3, paid: 4, curve: CURVE }
    expect(savedOnToday(today)).toBe(today)
    // a save on the plain curve before today's (LEVELS.step 30, its mark a number) is moved too: the same level
    const plain = (L: number) => (30 * L * (L - 1)) / 2
    expect(levelOf((savedOnToday({ points: plain(25) + 10, paid: 25, curve: 30 }) as Xp).points)).toBe(25)
    for (const curve of [null, 0, -15, 2.5, 'fifteen', 1e9, NaN, {}]) expect(savedOnToday({ points: 99, paid: 1, curve }), JSON.stringify(curve)).toEqual({ points: 99, paid: 1, curve })
    // what is not an XP stays as it was (sanitizeXp reads it)
    for (const raw of [undefined, null, 7, 'xp', {}, { paid: 3 }, { points: '50' }]) expect(savedOnToday(raw)).toBe(raw)
  })
})
