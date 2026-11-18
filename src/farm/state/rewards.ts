import { rewardKind, type RewardKind, type Tier } from '../../lib/tier'
import { mostOf } from '../layout'
import type { Prize } from '../prize'
import { rewardTier, worthOf } from '../worth'
import { levelOf } from '../xp'
import { farm, putBack, type At } from './core'

// Every prize into the farm, through one door (update-v1/CONTRACTS.md §1.9): coins, goods, a piece of decoration, a
// garment, each where it lives; the reward counted with its size (its tier, src/farm/worth.ts).

/**
 * Every prize goes into the farm here, and nowhere else: a claim's or a gift's (the daily gift, the level's boxes and
 * the gift a level brings, the goals, the first steps). A sale is no prize: it pays its coins with XP. Coins go into
 * the purse; goods into their building even past full (as surprises go: refused, they would be lost); a piece of the
 * edit mode's shop into the farm's store, free to put down (a kind the farm owns the most of already: its worth in
 * coins instead, so nothing is lost); a garment into the wardrobe. All of them are one reward of `kind`: its tier, from
 * what they are worth at the farm's level (never under the kind's least). No XP: a reward is not something done. `at`:
 * where in the world it came from, for its show there.
 */
export function give(prizes: readonly Prize[], kind: RewardKind, at?: At): Tier
/** One prize of no kind named: given the same, its tier by its worth alone (the level's gifts and the first steps call
 *  it so until they name theirs). */
export function give(prize: Prize): Tier
export function give(what: Prize | readonly Prize[], kind?: RewardKind): Tier {
  const prizes = Array.isArray(what) ? (what as readonly Prize[]) : [what as Prize]
  for (const p of prizes) into(p)
  return rewardTier(prizes, levelOf(farm.xp.points), kind && rewardKind(kind).least)
}

/** One prize into the farm, where it lives. */
function into(p: Prize) {
  if ('coins' in p) {
    farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + p.coins)
    return
  }
  if ('item' in p) {
    putBack(p.item, p.n)
    return
  }
  if ('decor' in p) {
    const { decor, stored } = farm.layout
    const owned = decor.filter((d) => d.kind === p.decor).length + stored[p.decor]
    // (its look is kept once the store keeps looks: 02's layout.storedLooks)
    if (owned < mostOf(p.decor)) farm.layout = { ...farm.layout, stored: { ...stored, [p.decor]: stored[p.decor] + 1 } }
    else into({ coins: worthOf([p]) })
    return
  }
  // a garment into the wardrobe: outfit.owned, with the garments that come from somewhere other than a level (02's
  // album and season road). None comes yet: every garment comes with its level, so none is a prize (isGiftGarment).
}
