// Levels (src/farm/state.ts gainXp, src/farm/XpChip.tsx): every thing you do on the farm is worth some XP
// (XP_FOR in ./data), and XP makes levels. From level L to the next takes LEVELS.step · L up to level KNEE, and from
// there a little more each level (`cost`: the plain step times 1 + GROW · ln(L − KNEE + 1), so it bends up smoothly,
// never in a jump): the first day's levels as they always were (level 2 at 30, 5 at 300, 10 at 1,350), the long game
// spread over the month the content is laid out for (JOURNEY.md: level 20 on day 7, 29 on day 14, 44 on day 30).
// Reaching level L pays LEVELS.reward · L coins, claimed in the level's card (the level chip opens it); every fifth
// level brings a garment too (./outfit.ts). Pure: everything here reads numbers, nothing changes the farm.

import { MOST, isObject, num } from '../lib/saved'
import { LEVELS } from './data'

/** The saved XP: every point ever gained, and the highest level already paid for. */
export interface Xp {
  points: number
  paid: number
}

/** The level from which each level takes a little more than the plain step, and how fast that grows. */
export const KNEE = 9
export const GROW = 0.92

/** The points level L takes to the next on today's curve. */
const cost = (level: number) => Math.round(LEVELS.step * level * (level <= KNEE ? 1 : 1 + GROW * Math.log(level - KNEE + 1)))

/** Today's curve: the XP at which each level begins (index L; level 1 at 0), up to the top level. */
const AT: readonly number[] = (() => {
  const at = [0, 0]
  for (let level = 1; level < LEVELS.max; level++) at.push(at[level] + cost(level))
  return at
})()

/** The mark a save carries for today's curve (`curve` in its XP); a number there is the step of an older, plain one. */
export const CURVE = 'bend-9'

/** The XP at which level L begins on a plain curve of `step` (level 1 at 0): the curves before today's. */
const xpOn = (level: number, step: number) => (step * level * (level - 1)) / 2

/** The XP at which level L begins (level 1 at 0). */
export const xpAt = (level: number) => AT[Math.max(1, Math.min(LEVELS.max, Math.floor(level)))]

/** Points as a whole number from 0 to the most a number holds exactly (NaN is none, past that is that). */
const wholePoints = (points: number) => (points > 0 ? Math.min(Math.floor(points), Number.MAX_SAFE_INTEGER) : 0)

/** The level for this many points on a plain curve of `step`: the largest L with xpOn(L) ≤ points (closed form, then
 *  put right by one either way where floating point rounds the root), at most the top level. */
function levelOn(points: number, step: number): number {
  const p = wholePoints(points)
  let level = Math.min(LEVELS.max, Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * p) / step)) / 2)))
  while (level > 1 && xpOn(level, step) > p) level--
  while (level < LEVELS.max && xpOn(level + 1, step) <= p) level++
  return level
}

/** The level for this many points: the largest L with xpAt(L) ≤ points, at most the top level. Points are taken whole
 *  and at most Number.MAX_SAFE_INTEGER. */
export function levelOf(points: number): number {
  const p = wholePoints(points)
  let lo = 1
  let hi = LEVELS.max
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (AT[mid] <= p) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** The plain curve's step before a save marked the curve it was made under (LEVELS.step was 15): a save without the
 *  mark counted its XP on it. */
export const FIRST_STEP = 15
/** The steepest plain curve a save's mark may name (past it, a mark is not one). */
const MOST_STEP = 1000

/**
 * XP counted on a plain curve of `step`, counted on today's: the same level, and the same share of the way to the next
 * one, rounded up (every gift box it had reached is still reached) but never into the next level. Past the top level,
 * as far past it. Points are taken whole.
 */
export function onToday(points: number, step: number): number {
  const p = wholePoints(points)
  const level = levelOn(p, step)
  const from = xpOn(level, step)
  if (level >= LEVELS.max) return Math.min(Number.MAX_SAFE_INTEGER, xpAt(level) + (p - from))
  const need = xpOn(level + 1, step) - from
  const now = xpAt(level + 1) - xpAt(level)
  return xpAt(level) + Math.min(now - 1, Math.ceil(((p - from) * now) / need))
}

/**
 * The XP of a save as counted on today's curve. The game marks each save with the curve it was made under (`curve` in
 * its XP: CURVE for today's, a number for an older plain one, its step); a save without the mark was made under the
 * first one (FIRST_STEP). Points made under another curve are moved onto today's (onToday), so the save keeps its level
 * and its share of the way to the next. A mark that cannot be read is taken as today's (a hand-edited save gains
 * nothing by it). Only the points change: what was paid stays as saved.
 */
export function savedOnToday(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || typeof (raw as Partial<Xp>).points !== 'number') return raw
  const r = raw as Record<string, unknown>
  const mark = r.curve
  if (mark === CURVE) return raw
  const step = mark === undefined ? FIRST_STEP : Number.isInteger(mark) && (mark as number) >= 1 && (mark as number) <= MOST_STEP ? (mark as number) : null
  return step === null ? raw : { ...r, points: onToday(r.points as number, step) }
}

/** Where a level stands: the points into it, the points it takes to the next, and whether it is the top one (whose
 *  bar is full: there is no next). */
export function levelProgress(points: number): { level: number; into: number; need: number; top: boolean } {
  const level = levelOf(points)
  const top = level >= LEVELS.max
  const need = top ? 1 : xpAt(level + 1) - xpAt(level)
  return { level, into: top ? need : wholePoints(points) - xpAt(level), need, top }
}

/** The coins for reaching a level. */
export const levelReward = (level: number) => LEVELS.reward * level

/** The coins waiting to be claimed: every level above the one paid (level 1 is where everyone starts: never paid), up
 *  to the one reached. A sum of LEVELS.reward · L over those levels, in closed form. */
export function unpaidCoins(xp: Xp): number {
  const from = Math.max(1, Number.isFinite(xp.paid) ? Math.floor(xp.paid) : 1) + 1
  const to = levelOf(xp.points)
  return to < from ? 0 : LEVELS.reward * (((from + to) * (to - from + 1)) / 2)
}

/** A sale is worth its coins: one XP for every five, at least one. */
export const xpForSale = (coins: number) => Math.max(1, Math.ceil(coins / 5) || 0)

/** A farm from before levels starts with XP for what it did (its levels are not paid again). */
export function seedXp(stats: { harvested?: number; baked?: number; earned?: number; sent?: number }): number {
  const n = (v: number | undefined) => (Number.isFinite(v) && (v as number) > 0 ? Math.floor(v as number) : 0)
  return n(stats.harvested) + 2 * n(stats.baked) + Math.ceil(n(stats.earned) / 5) + 10 * n(stats.sent)
}

/** The saved XP read back: whole numbers, never paid past the level reached; missing (a save from before levels),
 *  seeded from what the farm did. */
export function sanitizeXp(raw: unknown, seed: number): Xp {
  const r = (raw ?? null) as Partial<Xp> | null
  // a count from 0, its whole part (not a number, or below 0: `d`)
  const int = (v: unknown, d: number) => (num(v, -1) >= 0 ? Math.min(Math.floor(v as number), MOST) : d)
  if (!isObject(r) || typeof r.points !== 'number') {
    const points = wholePoints(seed)
    return { points, paid: levelOf(points) }
  }
  const points = int(r.points, 0)
  return { points, paid: Math.max(1, Math.min(int(r.paid, 1), levelOf(points))) }
}
