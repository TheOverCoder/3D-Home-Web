import { REWARD_KIND_IDS, TIERS, rewardKind, type RewardKind, type Tier } from '../../lib/tier'
import { showReward } from '../../fx/reward'
import type { ItemId } from '../data'
import { mostOf } from '../layout'
import type { Prize } from '../prize'
import { rewardTier, worthOf } from '../worth'
import { levelOf } from '../xp'
import { farm, putBack, type At } from './core'

// Every prize into the farm, through one door (update-v1/CONTRACTS.md §1.9): coins, goods, a piece of decoration, a
// garment, each where it lives. And every payout counted once, with its tier (§1.11): a sale, an order, the till, a
// claim, a level, goods collected; a claim's or a gift's through `give`, the rest where they are paid.

/**
 * Every prize goes into the farm here, and nowhere else: a claim's or a gift's (the daily gift, a level's coins and the
 * gift it brings, the level's boxes, the goals, the first steps). A sale is no prize: it pays its coins with XP and
 * counts itself (`rewarded`). Coins go into the purse; goods into their building even past full (as surprises go:
 * refused, they would be lost); a piece of the edit mode's shop into the farm's store, free to put down (a kind the farm
 * owns the most of already: its worth in coins instead, so nothing is lost); a garment into the wardrobe. All of them
 * are one reward of `kind`, counted once (`rewarded`, its show queued at `at`, a place in the world): its tier. No XP: a
 * reward is not something done.
 */
export function give(prizes: readonly Prize[], kind: RewardKind, at?: At): Tier {
  for (const p of prizes) into(p)
  return rewarded(kind, prizes, at)
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

/** Every reward paid since the counts began (the page opened, or `resetRewardCounts`): how many of each kind at each
 *  tier. Not the save's: the simulation and the tests read it (`rewardCounts`). */
const counts = Object.fromEntries(REWARD_KIND_IDS.map((k) => [k, Object.fromEntries(TIERS.map((t) => [t, 0]))])) as Record<RewardKind, Record<Tier, number>>

/**
 * A payout, counted once: its tier is what it holds against the next level's coins at the level now (src/farm/worth.ts),
 * never under its kind's floor (src/lib/tier.ts); paid at a place in the world (`at`), its show is queued there
 * (src/fx/reward.ts). Called once in every payout, where it is paid — a whole line sold is one — and never for a
 * decline, a cancel, a refund or a store too full to take anything. Its tier.
 */
export function rewarded(kind: RewardKind, prizes: readonly Prize[], at?: At): Tier {
  const tier = rewardTier(prizes, levelOf(farm.xp.points), rewardKind(kind).least)
  counts[kind][tier]++
  if (at) showReward(kind, tier, at)
  return tier
}

/** The surprises found with a payout (building materials, one each), as its prizes. */
export const foundPrizes = (items: readonly ItemId[]): Prize[] => items.map((item) => ({ item, n: 1 }))

/** How many rewards of each kind were paid at each tier, as they stand now (the simulation; `__home.reward`). */
export const rewardCounts = (): Readonly<Record<RewardKind, Readonly<Record<Tier, number>>>> =>
  Object.fromEntries(REWARD_KIND_IDS.map((k) => [k, { ...counts[k] }])) as Record<RewardKind, Record<Tier, number>>

/** The counts from nothing again (a simulation's new farm, a test). */
export function resetRewardCounts() {
  for (const k of REWARD_KIND_IDS) for (const t of TIERS) counts[k][t] = 0
}
