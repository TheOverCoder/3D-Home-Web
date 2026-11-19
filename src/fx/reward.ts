import { farmSound, type FarmSound } from '../audio/sound'
import { rewardFeel } from '../audio/sounds'
import { TIERS, rewardKind, tierRank, type Family, type RewardKind, type Tier } from '../lib/tier'
import { art } from '../ui/art'
import { burst } from '../ui/burst'
import { lessMotion } from '../ui/still'
import { popNumber } from './pop'

// How a reward is shown, by its tier (update-v1/CONTRACTS.md §1.11): the number that pops up where it was paid, how long
// the moment holds, and confetti — only for a real reward (decision 15: `CONFETTI_FROM`, the one floor). The tier is
// worked out from what the reward holds (src/farm/worth.ts) and counted where it is paid (`rewarded`,
// src/farm/state/rewards.ts), which also queues here the show of a reward paid at a place in the world. One fan-out,
// `celebrate`: its sting and its touch, its number and its confetti — the cards call it as their gift opens, the effects
// (src/fx/FarmFx.tsx) over the place in the world a reward was paid. No three.js.

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

/** At most one confetti in this long (ms): two rewards close together (a gift box's and a level's, an order's card and
 *  the world's show of it) throw one. */
export const CONFETTI_GAP_MS = 1500
let lastConfetti = -Infinity

/** Whether confetti may be thrown at `now` (ms): none was in the last `CONFETTI_GAP_MS`. Taken if so. */
export function confettiNow(now: number = typeof performance === 'undefined' ? Date.now() : performance.now()): boolean {
  if (now - lastConfetti < CONFETTI_GAP_MS) return false
  lastConfetti = now
  return true
}

/** For the tests: confetti may be thrown at once again. */
export function resetConfetti() {
  lastConfetti = -Infinity
}

/** Each family's sting: today's sounds (src/audio/farmSounds.ts) until 06's stings by tier. Goods collected have none
 *  here: the press made its work's sound, with its touch. */
const STING: Readonly<Record<Family, FarmSound | null>> = { coins: 'coins', gift: 'surprise', level: 'level', garment: 'garment', keys: 'keys', work: null }

/** A reward's sting, and its touch (06's map: its family picks the pattern, its tier how strong; src/audio/sounds.ts). */
function sting(kind: RewardKind, tier: Tier) {
  const sound = kind === 'till' ? 'till' : STING[rewardKind(kind).family]
  if (sound) farmSound(sound, 0, 1, rewardFeel(kind, tier))
}

/** A point on the screen: an element's middle (null while it is not laid out), or the point itself. */
function pointOf(at: Element | { x: number; y: number }): { x: number; y: number } | null {
  if (!('getBoundingClientRect' in at)) return at
  const r = at.getBoundingClientRect()
  return r.width || r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
}

/**
 * A reward celebrated by its tier, the one fan-out: its sting and its touch (`sound: false` where the farm played them
 * already as it paid: a sale's, an order's, a goal's own line, 06's), and at `at` (a point on the screen, or an element's
 * middle) its number popping up — `coins`, with a coin, sized and held by the tier (the toast keeps the words) — and
 * confetti from `CONFETTI_FROM` up, at most one every `CONFETTI_GAP_MS`. Goods collected throw none: their show is their
 * flight to the store. Under less motion, the sting and the touch only: the counts change all the same.
 */
export function celebrate(kind: RewardKind, tier: Tier, at: Element | { x: number; y: number } | null, o: { coins?: number; sound?: boolean } = {}) {
  if (o.sound !== false) sting(kind, tier)
  if (!at || typeof document === 'undefined' || lessMotion()) return
  const p = pointOf(at)
  if (!p) return
  const show = SHOW[tier]
  if (o.coins && o.coins > 0) popNumber(p.x, p.y, `+${o.coins}`, { scale: show.pop, holdMs: show.holdMs, pic: art('coin') })
  if (show.confetti && rewardKind(kind).family !== 'work' && confettiNow()) burst(p, show.confetti)
}
