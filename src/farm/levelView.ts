import type { ProduceId } from './data'
import { PER_LEVEL, boxAt, boxOf, boxXp, boxesReached, isOpen, waitingBoxes, type Gifts, type Prize } from './gifts'
import { garmentAt, nextGarment, type Garment } from './outfit'
import { levelProgress, levelReward, unpaidCoins } from './xp'

// What the level's card shows (./LevelCard.tsx draws it), from the XP and the gifts' record alone: pure, so the design
// lab (lab/) makes its states from numbers, as the game does from the farm's.

/** A box on the level's bar: locked (how many XP away), ready (a tap opens it), or open (what it gave, when known). */
export interface BoxView {
  box: number
  /** its quarter: 0 at 25 %, 3 at 100 % (that one comes with the next level) */
  q: number
  state: 'locked' | 'ready' | 'open'
  prize?: Prize
  /** locked: the XP still to go to it */
  xp?: number
}

/** What waits on the farm now, and the XP collecting it brings (the bar's ghost: the next press, and how far). */
export interface Ready {
  id: ProduceId
  n: number
  xp: number
}

export interface LevelView {
  level: number
  /** the XP into this level, and what the next one takes (at the top: a full bar) */
  into: number
  need: number
  top: boolean
  /** the next level's coins, and the garment it brings (every fifth level) */
  nextCoins: number
  gift?: Garment
  /** when the next level brings none: the next garment, and the level it comes with */
  later?: Garment
  /** the coins of the levels reached and not yet paid (none in play: a level's coins come in as it is reached) */
  unpaid: number
  /** the four boxes on this level's bar */
  boxes: BoxView[]
  /** every box reached and not opened, oldest first (this level's and the levels' before) */
  waiting: number[]
  /** how many of those are from the levels before */
  earlier: number
  /** the level was just reached by play: what it brought by itself, its coins and its gift (until the card has told it) */
  arrived?: { coins: number; prize: Prize }
  /** XP gained since the card was last open (the bar lights that part) */
  gain: number
  /** what is ready on the farm now */
  ready?: Ready
}

/** The card for this many XP points, the levels up to `paid` already claimed; `gifts` the boxes' record (none: every box
 *  reached counts as opened); `more` what the farm adds (the XP gained since the card was last open, what is ready). */
export function levelView(points: number, paid: number, gifts?: Gifts, more: { gain?: number; ready?: Ready | null } = {}): LevelView {
  const { level, into, need, top } = levelProgress(points)
  const gift = top ? undefined : garmentAt(level + 1)
  const reached = boxesReached(points)
  const g: Gifts = gifts ?? { open: reached, also: [], gave: [], came: [], seen: level }
  const boxes = Array.from({ length: PER_LEVEL }, (_, q): BoxView => {
    const box = boxAt(level, q)
    if (top || isOpen(g, box)) return { box, q, state: 'open', prize: g.gave.find((o) => o.box === box)?.prize }
    if (box < reached) return { box, q, state: 'ready' }
    return { box, q, state: 'locked', xp: Math.max(0, boxXp(box) - Math.floor(points)) }
  })
  const waiting = waitingBoxes(g, points)
  const came = g.seen < level ? g.came.find((c) => c.level === level) : undefined
  const arrived = came && { coins: came.coins, prize: came.prize }
  return {
    level,
    into,
    need,
    top,
    nextCoins: levelReward(level + 1),
    gift,
    later: gift ? undefined : nextGarment(level),
    unpaid: unpaidCoins({ points, paid }),
    boxes,
    waiting,
    earlier: waiting.filter((k) => boxOf(k).level < level).length,
    arrived,
    gain: Math.max(0, Math.floor(more.gain ?? 0)),
    ready: top ? undefined : (more.ready ?? undefined),
  }
}
