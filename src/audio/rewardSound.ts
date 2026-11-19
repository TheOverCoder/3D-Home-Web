// A reward heard at its size, live (mission 06 c7; update-v1/CONTRACTS.md §1.12): its sting by its kind and tier
// (./stings.ts), the rattle of a box shaking before it opens, and the coins' tinks as they land on their chip. A big or
// huge reward steps the music and the ambience back while it rings (./mix.ts, duck: −6 dB), so it rings in the clear; a
// box that holds one, from its rattle's first knock (the tier is known as the gift is claimed: CONTRACTS C4). The touch
// is the caller's (`rewardFeel`, ./sounds.ts: the fan-out, src/fx/reward.ts). With less motion the sounds are the same.
import type { RewardKind, Tier } from '../lib/tier'
import { live } from './engine'
import { play } from './farmSounds'
import { duck } from './mix'
import { STING_TC, STING_TIERS, playSting, stingFamily } from './stings'

/** The music and the ambience stepped back by `dB` for `ms` (the effects, the sting among them, are not). */
function stepBack(dB: number, ms: number) {
  duck('music', dB, ms, STING_TC)
  duck('amb', dB, ms, STING_TC)
}

/** A reward's sting where it can be heard, by its kind and its tier (nothing for goods collected: the press made its
 *  work's sound): longer and richer the bigger, a big or huge one with the music and the ambience stepped back. */
export function rewardSound(kind: RewardKind, tier: Tier) {
  if (!stingFamily(kind)) return
  const back = STING_TIERS[tier].stepBack
  if (back) stepBack(back.dB, back.ms)
  const e = live()
  if (e) playSting(e, kind, tier)
}

/** A box rattling as it shakes (the daily gift's, a level's gift boxes': the cards' `onShake`), for `ms` after `delayMs`,
 *  before it opens on its tier's sting. A big or huge one steps the music and the ambience back from its first knock
 *  until its sting has rung. */
export function rattle(tier: Tier, ms: number, delayMs = 0) {
  const back = STING_TIERS[tier].stepBack
  if (back) stepBack(back.dB, delayMs + ms + back.ms)
  const e = live()
  if (e) play(e, 'rattle', { ms, delay: delayMs })
}

/** The `i`-th coin landing on the coin chip (src/fx/coins.ts, as each arrives): a quiet tink a step higher each, in
 *  time with the count. No touch: the sale's was at the press. */
export function coinLand(i: number) {
  const e = live()
  if (e) play(e, 'tink', { step: i })
}
