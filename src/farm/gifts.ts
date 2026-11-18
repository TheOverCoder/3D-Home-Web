// The level's gifts (the level's card, src/farm/LevelCard.tsx): a box at every quarter of each level's bar — at 25 %,
// 50 %, 75 % and 100 % of the XP from level L to level L + 1 — from level BOXES_FROM on, and one box on the full bar of
// each level before it, coming with the next level (the first levels come every minute or two: a box at each quarter was
// always almost there, update-v1/JOURNEY.md fix 10). Each is a small prize the player opens with a tap, rolled on
// the farm's dice as it opens: coins sized to the level, a building material, or a few of a good the farm makes. A box
// reached waits until it is opened, from any level (none is ever lost, none is given twice). Apart from them, a level
// reached by play brings by itself a small gift of its own, a few of a building material (`rollArrival`); its coins
// (LEVELS) are claimed in the card as before. Pure: the rules and the record kept in the save; src/farm/state.ts gives
// what they say. None of it is XP: a reward is not something the player did.

import { field, intIn, isObject, list } from '../lib/saved'
import { LEVELS, SELLABLE, type ProduceId } from './data'
import { savedPrize as anyPrize, sized, type Prize as AnyPrize } from './prize'
import { randomItem } from './storage'
import { levelOf, levelProgress, xpAt } from './xp'

export { prizeWords } from './prize'

/** The places for boxes on each level's bar: one at each quarter. */
export const PER_LEVEL = 4
/** [JOURNEY.md fix 10] From this level on, a box at each quarter; before it, one a level, at ONE_AT. */
export const BOXES_FROM = 5
/** The quarter of a level before BOXES_FROM that has its one box: its full bar, with the next level (0 is 25 %, 3 is
 *  100 %; held by the sim's pace: the half bar's leaves the early farm too poor for PACE.income and JOURNEY.full). */
export const ONE_AT = 3
/** Every box there is: the last is level LEVELS.max − 1's at 100 %, reached with the top level (whose bar is full). */
export const BOX_COUNT = (LEVELS.max - 1) * PER_LEVEL
/** The odds of what a box holds: coins, else a building material, else a few of a good the farm makes (a material
 *  when it makes none yet). */
export const GIFT_ODDS = { coins: 0.55, material: 0.3 } as const
/** How many levels reached by play are remembered with what they brought (the level-up show and the card tell it). */
export const CAME_KEPT = 5

/** A gift's prize: coins, or `n` of a good (a building material, or a good the farm makes): the two kinds of
 *  src/farm/prize.ts's prizes a box, a level's arrival, the daily gift or a first step holds (their records keep no
 *  other). */
export type Prize = Extract<AnyPrize, { coins: number } | { item: ProduceId; n: number }>

/** A box opened, and what it gave. */
export interface Opened {
  box: number
  prize: Prize
}

/** What a level reached by play brought by itself: its coins and its gift. */
export interface Came {
  level: number
  coins: number
  prize: Prize
}

/** The gifts as saved. A box is a number: level L's quarter q is box (L − 1) · 4 + q. */
export interface Gifts {
  /** every box below this one is open */
  open: number
  /** the boxes past `open` opened out of turn (a level's own, tapped on its bar while older ones wait) */
  also: number[]
  /** what the boxes of the level now gave, to show in their places on its bar */
  gave: Opened[]
  /** the last levels reached by play and what they brought by themselves (CAME_KEPT at most) */
  came: Came[]
  /** the highest level whose arrival the level's card has told */
  seen: number
}

/** Box k: its level and its quarter (0 at 25 %, 3 at 100 %). */
export const boxOf = (k: number) => ({ level: Math.floor(k / PER_LEVEL) + 1, q: k % PER_LEVEL })
/** The box at level `level`'s quarter `q`. */
export const boxAt = (level: number, q: number) => (level - 1) * PER_LEVEL + q

/** The quarters of a level's bar that have a box: all four from BOXES_FROM on, ONE_AT's alone before it. */
export const quartersOf = (level: number): number[] => (level >= BOXES_FROM ? [0, 1, 2, 3] : [ONE_AT])
/** Whether box k is one (a quarter of a level before BOXES_FROM has none: it counts as opened, and never waits). */
export const isBox = (k: number) => Number.isInteger(k) && k >= 0 && quartersOf(boxOf(k).level).includes(boxOf(k).q)

/** How many boxes this many XP points have reached (the boxes below it): every box of the levels before, and the
 *  quarters of this one's bar filled; at the top level, all of them. */
export function boxesReached(points: number): number {
  const { level, into, need, top } = levelProgress(points)
  if (top) return BOX_COUNT
  return boxAt(level, 0) + Math.min(PER_LEVEL - 1, Math.floor((PER_LEVEL * into) / need))
}

/** The XP at which box k is reached (its quarter of its level's bar: the last one with the next level). */
export function boxXp(k: number): number {
  const { level, q } = boxOf(k)
  const need = xpAt(level + 1) - xpAt(level)
  return xpAt(level) + Math.ceil(((q + 1) * need) / PER_LEVEL)
}

/** Whether box k has been opened (a place with no box counts as opened). */
export const isOpen = (g: Gifts, k: number) => !isBox(k) || k < g.open || g.also.includes(k)

/** The boxes reached and not opened, oldest first (this level's and every level's before). */
export function waitingBoxes(g: Gifts, points: number): number[] {
  const out: number[] = []
  const reached = boxesReached(points)
  for (let k = g.open; k < reached; k++) if (isBox(k) && !g.also.includes(k)) out.push(k)
  return out
}

/** `open` moved past every box opened in turn (and past the places with no box on the way to one opened): the list of
 *  those out of turn holds only the ones past a box not open. */
export function settle(open: number, also: readonly number[]): { open: number; also: number[] } {
  const rest = [...new Set(also)].filter((k) => k >= open).sort((a, b) => a - b)
  let at = open
  while (rest.length && (rest[0] === at || !isBox(at))) {
    if (rest[0] === at) rest.shift()
    at++
  }
  return { open: at, also: rest.filter((k) => k > at) }
}

/** The coins of a box: about a tenth of the next level's own (`sized`), more for the later quarters (the last stretch
 *  pays most), at least 3. */
export const boxCoins = (level: number, q: number) => sized((1 + q / 2) / 10, level, 3)

/** The goods a gift may hold: those the farm has made (never a building material: those come as materials). */
const goodsOf = (made: readonly ProduceId[]) => made.filter((id) => SELLABLE.includes(id))
const pick = <T>(list: readonly T[], random: () => number) => list[Math.min(list.length - 1, Math.floor(random() * list.length))]

/** What box k holds, rolled on `random` (the farm's dice) as it opens: coins, a building material (more for the later
 *  quarters and the higher levels), or a few of a good the farm makes. */
export function rollBox(k: number, made: readonly ProduceId[], random: () => number): Prize {
  const { level, q } = boxOf(k)
  const r = random()
  if (r < GIFT_ODDS.coins) return { coins: boxCoins(level, q) }
  const goods = goodsOf(made)
  if (r < GIFT_ODDS.coins + GIFT_ODDS.material || !goods.length) return { item: randomItem(random), n: Math.min(5, 1 + (q >= 2 ? 1 : 0) + Math.floor(level / 25)) }
  return { item: pick(goods, random), n: Math.min(10, 2 + q + Math.floor(level / 20)) }
}

/** The small gift a level brings by itself as it is reached, rolled on `random`: a few of one building material (any
 *  of the six alike), more at the higher levels (2, up to 6). */
export const rollArrival = (level: number, random: () => number): Prize => ({ item: randomItem(random), n: Math.min(6, 2 + Math.floor(level / 15)) })

/** The gifts of a farm with this many XP points from before them: the boxes of the levels before count as opened (what
 *  was reached before is not given again); its own level's boxes reached so far wait for it. */
export function giftsFor(points: number): Gifts {
  const level = levelOf(points)
  return { open: Math.min(boxesReached(points), boxAt(level, 0)), also: [], gave: [], came: [], seen: level }
}

/** A gift's prize as saved, or null: read as any prize is (src/farm/prize.ts: coins from 1, a known good from 1 to 99),
 *  and only coins or goods (a gift's record holds no other kind). */
export function savedPrize(raw: unknown): Prize | null {
  const p = anyPrize(raw)
  return p && ('coins' in p || 'item' in p) ? p : null
}

/**
 * The gifts as saved, for a farm with this many XP points: never a box opened past those reached, the list of those
 * out of turn settled, what the level's boxes gave only for boxes of the level now that are open, the levels reached
 * up to this one (the last CAME_KEPT), and what the card told up to it. Missing (a farm from before them): `giftsFor`.
 * A count that cannot be read counts every box reached as opened: nothing is given twice.
 */
export function sanitizeGifts(raw: unknown, points: number): Gifts {
  if (!isObject(raw)) return giftsFor(points)
  const reached = boxesReached(points)
  const level = levelOf(points)
  const first = intIn(raw.open, 0, reached) ? raw.open : reached
  const { open, also } = settle(
    first,
    list(raw.also).filter((k): k is number => intIn(k, 0, reached - 1) && isBox(k)),
  )
  const done = (k: number) => k < open || also.includes(k)
  const gave: Opened[] = []
  for (const e of list(raw.gave)) {
    const prize = savedPrize(field(e, 'prize'))
    const box = field(e, 'box')
    if (prize && intIn(box, 0, reached - 1) && isBox(box) && done(box) && boxOf(box).level === level && !gave.some((x) => x.box === box)) gave.push({ box, prize })
  }
  gave.sort((a, b) => a.box - b.box)
  const came: Came[] = []
  for (const e of list(raw.came)) {
    const prize = savedPrize(field(e, 'prize'))
    const at = field(e, 'level')
    const coins = field(e, 'coins')
    if (prize && intIn(at, 2, level) && intIn(coins, 0, Number.MAX_SAFE_INTEGER) && !came.some((x) => x.level === at)) came.push({ level: at, coins, prize })
  }
  came.sort((a, b) => a.level - b.level)
  return { open, also, gave, came: came.slice(-CAME_KEPT), seen: intIn(raw.seen, 1, level) ? raw.seen : level }
}
