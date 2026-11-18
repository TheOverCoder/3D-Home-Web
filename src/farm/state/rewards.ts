import type { Prize as GiftPrize } from '../gifts'
import { REWARD_KIND_IDS, TIERS, rewardKind, type RewardKind, type Tier } from '../../lib/tier'
import { showReward } from '../../fx/reward'
import type { ItemId } from '../data'
import type { Prize } from '../prize'
import { rewardTier } from '../worth'
import { levelOf } from '../xp'
import { farm, putBack, type At } from './core'

// A reward into the farm: coins, or goods into their building even past full. And every payout counted once, with its
// tier (update-v1/CONTRACTS.md §1.11): a sale, an order, the till, a claim, a level, goods collected.

/** A prize into the farm: coins, or goods into their building even past full (as surprises go: refused, they would
 *  be lost). */
export function give(p: GiftPrize) {
  if ('coins' in p) farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + p.coins)
  else putBack(p.item, p.n)
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
