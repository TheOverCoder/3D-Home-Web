import type { ProduceId } from '../../../src/farm/data'
import { levelReward } from '../../../src/farm/xp'

// SAMPLE DATA for a feature the game does not have yet (variant E of the level's board): a small gift on each quarter
// of a level's bar — a few coins, or a building material — opened with a tap once the bar has passed it (near goals
// on the way to the far one, each with its own small reward: lab/CRAFT.md, The feeling of progress). The amounts here
// are made up for the lab, scaled to the game's own level coins (levelReward); the game would need a rule for them,
// and a record of which quarters of the current level were opened (kept until opened: a gift never rots).

export interface QuarterGift {
  /** where on the bar it sits: 0.25, 0.5, 0.75 */
  at: number
  coins?: number
  item?: ProduceId
}

const MATERIALS: ProduceId[] = ['plank', 'nail', 'brick']

/** The three gifts of a level's bar (sample): coins at the first quarter, a material at the half, more coins at the
 *  last quarter (the last stretch is the hottest: its gift is the biggest). */
export function quarterGifts(level: number): QuarterGift[] {
  const c = Math.max(2, Math.round(levelReward(level + 1) / 10))
  return [
    { at: 0.25, coins: c },
    { at: 0.5, item: MATERIALS[level % MATERIALS.length] },
    { at: 0.75, coins: c * 2 },
  ]
}
