import { describe, expect, it } from 'vitest'
import { LEVELS } from './data'
import { levelView } from './levelView'
import { opensAt } from './unlocks'
import { colsSideways, colsUpright } from './Unlocked'
import { xpAt } from './xp'

// "Unlocked!" and the level card's row (src/farm/Unlocked.tsx, src/farm/levelView.ts): the cards' rows fit a phone,
// and the level card carries what the next level opens.

describe('what a level opens, shown', () => {
  it('rows of cards: three at most upright (four as two and two), up to six sideways', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(colsUpright)).toEqual([1, 2, 3, 2, 3, 3, 4])
    expect([1, 2, 6, 7, 9].map(colsSideways)).toEqual([1, 2, 6, 6, 6])
    // every level of the table fits in two rows upright and one sideways
    for (let level = 2; level <= LEVELS.max; level++) {
      const n = opensAt(level).length
      if (!n) continue
      expect(Math.ceil(n / colsUpright(n)), `level ${level}`).toBeLessThanOrEqual(2)
      expect(Math.ceil(n / colsSideways(n)), `level ${level}`).toBe(1)
    }
  })

  it('the level card carries what the next level opens; none at the top', () => {
    expect(levelView(xpAt(2), 2, undefined, { opens: opensAt(3) }).opens).toEqual(opensAt(3))
    expect(levelView(xpAt(2), 2).opens).toEqual([])
    expect(levelView(xpAt(LEVELS.max), LEVELS.max, undefined, { opens: opensAt(3) }).opens).toEqual([])
  })
})
