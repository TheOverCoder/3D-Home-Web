import { TIERS, rewardKind, type RewardKind, type Tier } from '../lib/tier'
import { farm, rewardCounts } from '../farm/state'
import type { Prize } from '../farm/prize'
import { rewardTier } from '../farm/worth'
import { levelOf } from '../farm/xp'

// The tier a card's payout was counted at, for its show (update-v1/CONTRACTS.md §1.11: "a card payout's UI calls
// `celebrate` with the tier the action returns"). A claim gives back what it gave, not its tier; the farm counted the
// payout once with its tier as it paid (`rewarded`, src/farm/state/rewards.ts), so the tier is read from the counts
// round the press: the show is exactly the tier counted, never worked out twice.

/**
 * Runs a payout of `kind` (`pay`: a claim, a gift opened, an order sent) and tells the tier it was counted at. A payout
 * that counted nothing (refused; or a sample's in the design lab, where nothing is paid): the tier of what it gives
 * (`prizes`, from what `pay` gave back) at the farm's level, or null with nothing given.
 */
export function paying<T>(kind: RewardKind, pay: () => T, prizes?: (got: T) => readonly Prize[] | null | undefined): { got: T; tier: Tier | null } {
  const before = rewardCounts()[kind]
  const level = farm.xp ? levelOf(farm.xp.points) : 1
  const got = pay()
  const after = rewardCounts()[kind]
  for (let k = TIERS.length - 1; k >= 0; k--) if (after[TIERS[k]] > before[TIERS[k]]) return { got, tier: TIERS[k] }
  const p = prizes?.(got)
  return { got, tier: p?.length ? rewardTier(p, level, rewardKind(kind).least) : null }
}
