import { farmSound } from '../../audio/sound'
import { xpFx } from '../../fx/fx'
import { count, XP_FOR, type XpAction } from '../data'
import { levelOf, levelReward, unpaidCoins, xpAt, xpForSale } from '../xp'
import { boxesReached, boxOf, CAME_KEPT, isOpen as giftOpen, rollArrival, rollBox, settle, waitingBoxes, type Opened } from '../gifts'
import { GARMENTS, garmentById, putOn } from '../outfit'
import { goalById, goalReward, goalTarget, MOST_STEPS, type GoalId } from '../goals'
import type { Prize } from '../prize'
import { bump, farm, random, save, toast, type At } from './core'
import { give, rewarded } from './rewards'
import { feedRoad } from './seasonRoad'

// Levels: the XP every action gives, what a level reached brings by itself, the gift boxes on its bar, the goals board
// and the wardrobe.

/** Counts every gain of XP from play (never a load, a slot switch or the old-save seed): the level-up show listens to it. */
let xpEvents = 0
export const xpEventCount = () => xpEvents

/** XP for something the player did: `n` times the action's worth (XP_FOR), or for a sale `n` coins (xpForSale); `more`
 *  a share more (a machine's level: 0.2 is a fifth more, rounded up so that it is never lost to rounding). `at` is
 *  where the crystals fly up from. Only from a player's action: never in tick, goOn or cameBack. The XP gained. */
export function gainXp(action: XpAction | 'sale', n = 1, at?: At, more = 0): number {
  // (a hair under, so that 2 · 5 · 1.2 = 12.000000000000002 is 12)
  const boosted = (xp: number) => (more > 0 ? Math.ceil(xp * (1 + more) - 1e-9) : xp)
  const xp = action === 'sale' ? (n > 0 ? xpForSale(n) : 0) : n > 0 ? boosted(XP_FOR[action] * n) : 0
  if (!(xp > 0)) return 0
  const was = levelOf(farm.xp.points)
  farm.xp.points = Math.min(Number.MAX_SAFE_INTEGER, farm.xp.points + xp)
  xpEvents++
  const now = levelOf(farm.xp.points)
  if (now > was) arrive(was, now)
  // the season road takes the same XP: its stops reached come in by themselves (src/farm/state/seasonRoad.ts)
  feedRoad(xp)
  // the crystals fly up from where it happened; with no place to name (a panel's sale), from low in the middle
  xpFx(at?.x ?? NaN, at?.y ?? NaN, at?.z ?? NaN, xp)
  bump()
  save()
  return xp
}

/** The level now: the level, the points into it and needed for the next, all the points, the coins waiting. */
export function xpNow() {
  const level = levelOf(farm.xp.points)
  return { level, into: farm.xp.points - xpAt(level), need: xpAt(level + 1) - xpAt(level), points: farm.xp.points, unpaid: unpaidCoins(farm.xp) }
}

/**
 * A level reached by play (`was` to `now`): what it brings comes in by itself, with no Claim — its coins (LEVELS: every
 * level reached and not yet paid, once: `xp.paid` moves to it) and a small gift rolled on the farm's dice
 * (src/farm/gifts.ts: a few of a building material, into the barn even past full, as surprises go) — remembered for the
 * level-up show and the level's card, which tell it; the boxes on the new level's bar start empty. No XP: a reward is
 * not something the player did.
 */
function arrive(was: number, now: number) {
  const coins = unpaidCoins({ points: xpAt(now), paid: farm.xp.paid })
  farm.xp.paid = Math.max(farm.xp.paid, now)
  const came = farm.gifts.came.filter((c) => c.level <= was)
  const prizes: Prize[] = coins > 0 ? [{ coins }] : []
  for (let level = was + 1; level <= now; level++) {
    const prize = rollArrival(level, random)
    prizes.push(prize)
    came.push({ level, coins: levelReward(level), prize })
  }
  // (its coins and its gifts: one reward, however many levels at once)
  give(prizes, 'level')
  farm.gifts = { ...farm.gifts, gave: [], came: came.slice(-CAME_KEPT) }
  for (const g of GARMENTS) if (g.level > was && g.level <= now) rewarded('garment', [{ garment: g.id }])
}

/** The boxes reached and waiting to be opened, oldest first: this level's and every level's before. */
export const giftsWaiting = () => waitingBoxes(farm.gifts, farm.xp.points)

/**
 * Opens gift boxes (`boxes`, or every one waiting): each one reached and not yet open is rolled on the farm's dice and
 * given at once (coins, or goods into their building even past full); a box already open, or not reached, gives
 * nothing — none is ever given twice. What each gave, oldest first. No XP: a reward is not something done.
 */
export function openGifts(boxes?: readonly number[]): Opened[] {
  const g = farm.gifts
  const reached = boxesReached(farm.xp.points)
  const level = levelOf(farm.xp.points)
  const list = [...new Set(boxes ?? giftsWaiting())].filter((k) => Number.isInteger(k) && k >= 0 && k < reached && !giftOpen(g, k)).sort((a, b) => a - b)
  if (!list.length) return []
  const out = list.map((box): Opened => ({ box, prize: rollBox(box, farm.made, random) }))
  give(
    out.map((o) => o.prize),
    'box',
  )
  const { open, also } = settle(g.open, [...g.also, ...list])
  // what this level's boxes gave stays on its bar (an older level's is gone from view)
  const gave = [...g.gave, ...out].filter((o) => boxOf(o.box).level === level).sort((a, b) => a.box - b.box)
  farm.gifts = { open, also, gave, came: g.came, seen: g.seen }
  // (its sound, and its touch, come as it bursts open in the level's card)
  bump()
  save()
  return out
}

/** The level's card has told the level reached (what it brought by itself): not again. */
export function sawLevel() {
  const level = levelOf(farm.xp.points)
  if (farm.gifts.seen >= level) return
  farm.gifts = { ...farm.gifts, seen: level }
  bump()
  save()
}

/** Claims the coins of every level reached and not yet paid, up to level `upTo` (the level the chip shows: XP still
 *  flying to it as crystals is not claimed yet); returns them (0 when none wait). */
export function claimLevel(upTo?: number): number {
  const reached = levelOf(farm.xp.points)
  const level = upTo === undefined ? reached : Math.min(reached, Math.floor(upTo))
  if (!(level > farm.xp.paid)) return 0
  const coins = unpaidCoins({ points: xpAt(level), paid: farm.xp.paid })
  if (!(coins > 0)) return 0
  give([{ coins }], 'level')
  farm.xp.paid = level
  toast(`Level ${level} · + ${coins} coins`, 'coin')
  farmSound('coins')
  bump()
  save()
  return coins
}

/** Claims a goal reached (src/farm/goals.ts): its coins, and the building material the silo or the barn is shortest of
 *  (into the barn even past full, as surprises do); the goal moves on to its next count. What it gave, or null. */
export function claimGoal(id: GoalId) {
  const def = goalById(id)
  const step = farm.goals[id]
  if (!def || step >= MOST_STEPS || def.measure(farm) < goalTarget(def, step)) return null
  const reward = goalReward(def, step, farm)
  farm.goals[id] = step + 1
  give([{ coins: reward.coins }, { item: reward.item, n: reward.count }], 'goal')
  gainXp('goal')
  toast(`${def.say(goalTarget(def, step))} · + ${reward.coins} coins, + ${count(reward.item, reward.count)}`, reward.item)
  farmSound('coins')
  bump()
  save()
  return reward
}

/** Puts on a garment from the wardrobe (one the level has; a hat worn already comes off). True when what is worn
 *  changed. Nothing is paid and nothing is gained: it is only clothes. */
export function wearGarment(id: string): boolean {
  const next = putOn(farm.outfit, id, levelOf(farm.xp.points))
  if (next === farm.outfit || (next.shirt === farm.outfit.shirt && next.trousers === farm.outfit.trousers && next.hat === farm.outfit.hat)) return false
  farm.outfit = next
  if (garmentById(id)) farmSound('dress')
  bump()
  save()
  return true
}

/** The wardrobe has shown every garment up to the level reached: none is marked new any more. */
export function sawWardrobe() {
  const level = levelOf(farm.xp.points)
  if (farm.outfit.seen >= level) return
  farm.outfit = { ...farm.outfit, seen: level }
  bump()
  save()
}
