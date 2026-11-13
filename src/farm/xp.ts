// Levels (src/farm/state.ts gainXp, src/farm/XpChip.tsx): every thing you do on the farm is worth some XP
// (XP_FOR in ./data), and XP makes levels. From level L to the next takes LEVELS.step · L, so each level takes longer
// than the one before: level 2 comes at 15, level 5 at 150, level 10 at 675, the top level (LEVELS.max, 500) at
// 1,871,250. Reaching level L pays LEVELS.reward · L coins, claimed in the level's card (the level chip opens it);
// every fifth level brings a garment too (./outfit.ts). Pure: everything here reads numbers, nothing changes the farm.

import { LEVELS } from './data'

/** The saved XP: every point ever gained, and the highest level already paid for. */
export interface Xp {
  points: number
  paid: number
}

/** The XP at which level L begins (level 1 at 0). */
export const xpAt = (level: number) => (LEVELS.step * level * (level - 1)) / 2

/** Points as a whole number from 0 to the most a number holds exactly (NaN is none, past that is that). */
const wholePoints = (points: number) => (points > 0 ? Math.min(Math.floor(points), Number.MAX_SAFE_INTEGER) : 0)

/** The level for this many points: the largest L with xpAt(L) ≤ points (closed form, then put right by one either
 *  way where floating point rounds the root), at most the top level. Points are taken whole and at most
 *  Number.MAX_SAFE_INTEGER. */
export function levelOf(points: number): number {
  const p = wholePoints(points)
  let level = Math.min(LEVELS.max, Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * p) / LEVELS.step)) / 2)))
  while (level > 1 && xpAt(level) > p) level--
  while (level < LEVELS.max && xpAt(level + 1) <= p) level++
  return level
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
  const int = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), Number.MAX_SAFE_INTEGER) : d)
  if (!r || typeof r !== 'object' || typeof r.points !== 'number') {
    const points = wholePoints(seed)
    return { points, paid: levelOf(points) }
  }
  const points = int(r.points, 0)
  return { points, paid: Math.max(1, Math.min(int(r.paid, 1), levelOf(points))) }
}
