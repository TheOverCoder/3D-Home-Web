import { garmentAt, nextGarment, type Garment } from './outfit'
import { levelProgress, levelReward, unpaidCoins } from './xp'

// What the level's card shows (./LevelCard.tsx draws it), from the XP alone: pure, so the design lab (lab/) makes its
// states from numbers, as the game does from the farm's.

export interface LevelView {
  level: number
  /** the XP into this level, and what the next one takes (at the top: a full bar) */
  into: number
  need: number
  top: boolean
  /** the next level's coins, and the garment it brings (every fifth level) */
  nextCoins: number
  gift?: Garment
  /** when the next level brings none: the next garment, and the level it comes with */
  later?: Garment
  /** the coins of the levels reached, waiting to be claimed */
  unpaid: number
}

/** The card for this many XP points, the levels up to `paid` already claimed. */
export function levelView(points: number, paid: number): LevelView {
  const { level, into, need, top } = levelProgress(points)
  const gift = top ? undefined : garmentAt(level + 1)
  return { level, into, need, top, nextCoins: levelReward(level + 1), gift, later: gift ? undefined : nextGarment(level), unpaid: unpaidCoins({ points, paid }) }
}
