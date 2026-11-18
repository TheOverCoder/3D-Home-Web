import { TIERS, tierRank, type RewardKind, type Tier } from '../lib/tier'
import { lessMotion } from '../ui/still'

// How a reward is shown, by its tier (update-v1/CONTRACTS.md §1.11): the number that pops up where it was paid, how long
// the moment holds, and confetti — only for a real reward (decision 15: `CONFETTI_FROM`, the one floor). The tier is
// worked out from what the reward holds (src/farm/worth.ts) and counted where it is paid (`rewarded`,
// src/farm/state/rewards.ts), which also queues here the show of a reward paid at a place in the world. No three.js and
// no DOM: the effects (src/fx/FarmFx.tsx) and the cards read it.

/** A burst of confetti (canvas-confetti, through src/ui/burst.ts): how many, how wide, how hard. */
export interface Confetti {
  count: number
  spread: number
  power: number
}

/** A tier's show: how big its number pops (a share of the small one's), how long the moment holds (ms), its confetti
 *  (null: none). */
export interface Show {
  pop: number
  holdMs: number
  confetti: Confetti | null
}

/** The least tier that throws confetti: a modest reward keeps its stamp and its count, and no more (decision 15). */
export const CONFETTI_FROM: Tier = 'big'

/** Each tier's number, hold and confetti, whether it throws it or not: under `CONFETTI_FROM` its confetti is never
 *  thrown (it is here so that the floor is the one thing to change). */
const ROWS: Readonly<Record<Tier, { pop: number; holdMs: number; confetti: Confetti }>> = {
  small: { pop: 1, holdMs: 60, confetti: { count: 16, spread: 60, power: 20 } },
  medium: { pop: 1.15, holdMs: 80, confetti: { count: 26, spread: 70, power: 23 } },
  big: { pop: 1.3, holdMs: 100, confetti: { count: 44, spread: 80, power: 26 } },
  huge: { pop: 1.5, holdMs: 140, confetti: { count: 100, spread: 100, power: 34 } },
}

/** How each tier is shown: confetti only from `CONFETTI_FROM` up. */
export const SHOW: Readonly<Record<Tier, Readonly<Show>>> = Object.fromEntries(
  TIERS.map((t) => [t, { ...ROWS[t], confetti: tierRank(t) >= tierRank(CONFETTI_FROM) ? ROWS[t].confetti : null }]),
) as Record<Tier, Show>

/** A reward paid at a place in the world, to be shown there: its kind, its tier, the point, and when it was paid
 *  (performance.now()). */
export interface RewardShow {
  kind: RewardKind
  tier: Tier
  x: number
  y: number
  z: number
  at: number
}

/** The most shows that wait: a pile nobody plays (no effects on the screen) keeps only the latest. */
export const MOST_SHOWS = 16
const shows: RewardShow[] = []

/** Queues a reward's show at a point in the world (from `rewarded` only). Nothing under less motion: the counts still
 *  change. */
export function showReward(kind: RewardKind, tier: Tier, p: { x: number; y: number; z: number }) {
  if (lessMotion()) return
  shows.push({ kind, tier, x: p.x, y: p.y, z: p.z, at: typeof performance === 'undefined' ? 0 : performance.now() })
  if (shows.length > MOST_SHOWS) shows.shift()
}

/** Every show queued since the last frame, oldest first, taken once (the effects play them). */
export const takeRewardShows = (): RewardShow[] => shows.splice(0)
