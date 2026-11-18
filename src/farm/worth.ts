// How big a reward is, from what it holds (update-v1/CONTRACTS.md §1.11): its worth in coins against the next level's
// own coins — the same yardstick every prize's coins are sized from (src/farm/prize.ts, `sized`) — so that a tier means
// as much at level 4 as at 400. The amount decides, never dice. The tiers' names and the kinds of reward are
// src/lib/tier.ts's; this is the one place a tier is worked out. Pure (Node, the sim); not yet used by the game.

import { atLeast, type Tier } from '../lib/tier'
import { CONTRACTOR, isItem, produceById } from './data'
import { SHOP, type ShopDef } from './decor'
import type { Prize } from './prize'
import { levelReward } from './xp'

/** Where each tier begins, as a share of the next level's coins (tuned with `npm run sim`). */
export const TIER_AT = { medium: 0.25, big: 1, huge: 3 } as const

/** What a piece of decoration is worth: its shop row's first price; one not sold (02's banner: `forSale: false`)
 *  nothing. */
const pieceWorth = (row: ShopDef & { forSale?: boolean }) => (row.forSale === false ? 0 : row.price)

/** What prizes are worth in coins: the coins; a good at its fair price (PRODUCE: never an event's, a machine level's or
 *  the market's mood); a building material at what the contractor pays for one; a piece at its shop row's first price;
 *  a garment nothing (its kind's floor carries it: src/lib/tier.ts). */
export function worthOf(prizes: readonly Prize[]): number {
  let coins = 0
  for (const p of prizes) {
    if ('coins' in p) coins += p.coins
    else if ('item' in p) coins += p.n * (isItem(p.item) ? CONTRACTOR.buys : produceById(p.item).price)
    else if ('decor' in p) coins += pieceWorth(SHOP[p.decor])
  }
  return coins
}

/** The tier of a reward at a level: what it holds against the next level's coins, never under `least`. */
export function rewardTier(prizes: readonly Prize[], level: number, least?: Tier): Tier {
  const share = worthOf(prizes) / levelReward(Math.max(1, Math.floor(level)) + 1)
  const tier: Tier = share >= TIER_AT.huge ? 'huge' : share >= TIER_AT.big ? 'big' : share >= TIER_AT.medium ? 'medium' : 'small'
  return atLeast(tier, least)
}
