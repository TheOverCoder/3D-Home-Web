import type { ProduceId } from '../../../src/farm/data'
import { levelReward } from '../../../src/farm/xp'

// SAMPLE DATA for a feature the game does not have yet (the level's board, F): a small box at every quarter of a
// level — at 25 %, 50 %, 75 % and 100 % of its bar — each a small random prize sized to the level (a few coins, a
// building material, a few of a good), opened by the player with a tap; a box not opened waits, from any level, and a
// gift button opens all that wait at once. Apart from them, what a level brings on being reached (its coins, a garment
// every fifth level, and a small random extra) comes in by itself, with no Claim. The prizes here are made up for the
// lab from the level (a seeded roll, so a box shows the same prize every time); the game would need a rule for them,
// its own dice for the roll, and a record of the boxes not yet opened (kept until opened: a box never rots).

export type Prize = { coins: number } | { item: ProduceId; n: number }

/** A box: the level it belongs to and its quarter (0 at 25 %, 3 at 100 %, which comes as the level is reached). */
export interface Box {
  level: number
  q: 0 | 1 | 2 | 3
}

/** The boxes as the card shows them (sample): which of this level's are opened, and those still waiting from the
 *  levels before (the 100 % box of the last level always among them until it is opened). */
export interface Boxes {
  opened: number[]
  missed: Box[]
  /** the level was reached just now (by play): what it brought came in by itself */
  reached?: boolean
}

const GOODS: ProduceId[] = ['plank', 'nail', 'brick', 'egg', 'wheat', 'milk']

/** A seeded roll (0–1) for a box: the same box, the same prize. */
const roll = (level: number, q: number) => {
  const x = Math.sin(level * 12.9898 + q * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** A box's prize: mostly coins (a tenth of the level's own, more for the later quarters: the last stretch pays most),
 *  sometimes a material or a few of a good. */
export function boxPrize(b: Box): Prize {
  const r = roll(b.level, b.q)
  const coins = Math.max(3, Math.round((levelReward(b.level + 1) / 10) * (1 + b.q * 0.5)))
  if (r < 0.55) return { coins }
  const item = GOODS[Math.floor(roll(b.level + 7, b.q) * GOODS.length)]
  return { item, n: item === 'plank' || item === 'nail' || item === 'brick' ? 1 + b.q : 2 + b.q }
}

/** The small random extra a level brings with its coins as it is reached (the coins and the garment are the game's):
 *  a good or a material more often than coins (the coins already come), rolled on dice of its own. */
export function levelExtra(level: number): Prize {
  const item = GOODS[Math.floor(roll(level + 31, 5) * GOODS.length)]
  return { item, n: item === 'plank' || item === 'nail' || item === 'brick' ? 2 : 3 }
}

/** The sample boxes of each of the board's states. */
export const BOXES: Record<string, Boxes> = {
  // level 4, two thirds in: the 25 % box opened, the 50 % one waiting, and level 3's last box never opened
  gift: { opened: [0], missed: [{ level: 3, q: 3 }] },
  // level 9, nearly there: the three boxes so far opened; the last one comes with level 10
  almost: { opened: [0, 1, 2], missed: [] },
  // level 7, just reached: its coins and extra came in by themselves; level 6's last box waits to be opened
  fresh: { opened: [], missed: [{ level: 6, q: 3 }], reached: true },
  // level 6, a third in: its first box and two of level 5's wait
  later: {
    opened: [],
    missed: [
      { level: 5, q: 2 },
      { level: 5, q: 3 },
    ],
  },
  top: { opened: [0, 1, 2], missed: [] },
  // back after a while: four boxes of this level's and earlier ones never opened
  many: {
    opened: [],
    missed: [
      { level: 10, q: 3 },
      { level: 11, q: 2 },
      { level: 11, q: 3 },
    ],
  },
}
