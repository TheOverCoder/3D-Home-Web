// What is next for this farm, in one line (update-v1/missions/04-first-session.md, Foundation 4; JOURNEY.md fix 7): the
// welcome back's Next row and its Go there, and whatever else asks "what now?" (the goals' nearest reward reads it too).
// Never empty. Each kind of thing that can be next is a row of NEXT_SOURCES (a mission's new kind is a row): the step a
// new farm is on comes first, then a request that can be filled now, then a goal reached and waiting to be claimed;
// else, of the rest, the nearest in minutes of play left (src/farm/economy.ts, incomeAt: coins a minute at the farm's
// level): the goal nearest its count, the next level that opens something, the next big thing to save for. Pure: it
// reads the farm it is given.

import { incomeAt, nextSaving } from './economy'
import { LEVELS, produceById, type ProduceId } from './data'
import { currentStep, lineFor, type Pic } from './firstSteps'
import { goalNear, goalsNow, type GoalDef } from './goals'
import { GOODS, madeBy, type Count } from './measure'
import type { FarmData } from './state'
import { opensAt, unlockName } from './unlocks'
import type { Target } from './walkTargets'
import { levelOf, xpAt } from './xp'

export type { Pic }

/** What is next: its picture, its words, how far along (have of of), where Go there takes you (a walk; the goals
 *  board; 02's album or season road), and how many minutes of play it is away (0: now). */
export interface NextItem {
  pic: Pic
  words: string
  have?: number
  of?: number
  go?: Target | 'goals' | 'album' | 'road'
  minutes: number
}

export type NextSourceId = 'step' | 'request' | 'claim' | 'goal' | 'road' | 'album' | 'unlock' | 'saving'

/** The kinds that come first whenever they have something, in this order (the step, a request to fill, a goal to
 *  claim); the rest are ranked by their minutes. */
const FIRST: readonly NextSourceId[] = ['step', 'request', 'claim']

/** A goal's unit in coins, to tell its minutes of play: a good counted is worth its price (a group, their mean), a sale
 *  a few coins, an order sent a few dozen, a coin itself. */
function unitCoins(c: Count): number {
  const mean = (ids: readonly ProduceId[]) => ids.reduce((n, id) => n + produceById(id).price, 0) / Math.max(1, ids.length)
  if ('got' in c) return Math.max(1, mean(typeof c.got === 'string' ? GOODS[c.got] : c.got))
  if ('made' in c) return Math.max(1, mean(madeBy(c.made)))
  if ('stat' in c) return c.stat === 'earned' ? 1 : c.stat === 'sent' ? ORDER_COINS : SALE_COINS
  return SALE_COINS
}
/** About what one sale brings, and one order sent (for a goal's minutes only: never a price). */
const SALE_COINS = 3
const ORDER_COINS = 30
/** XP a minute of play at a level, about (a sale's XP is a fifth of its coins, and the work round it as much again):
 *  for the next level's minutes only. */
const xpPerMinute = (level: number) => incomeAt(level) / 2.5

/** Minutes of play to earn `coins` at the farm's level. */
const minutesFor = (f: FarmData, coins: number) => Math.max(0, coins) / Math.max(1, incomeAt(levelOf(f.xp.points)))

/** A goal as a Next row: its picture and words, how far along, and its way there. */
const goalItem = (def: GoalDef & { go?: Target }, have: number, of: number, minutes: number, go?: NextItem['go']): NextItem => ({
  pic: def.pic,
  words: def.say(of),
  have: Math.min(have, of),
  of,
  go: go ?? def.go,
  minutes,
})

/** Each kind of thing that can be next, and what it is for a farm now (null: nothing of that kind). */
export const NEXT_SOURCES: readonly { id: NextSourceId; next: (f: FarmData) => NextItem | null }[] = [
  {
    // the step a new farm is on, as the farmer says it now (its turns), and where a tap on him walks you
    id: 'step',
    next: (f) => {
      const step = currentStep(f.firstSteps)
      if (!step) return null
      const line = lineFor(step, f)
      return { pic: line.pic, words: line.say, go: line.target, minutes: 0 }
    },
  },
  {
    // a goal reached and waiting: the board opens to claim it
    id: 'claim',
    next: (f) => {
      const g = goalsNow(f).find((x) => x.done)
      return g ? goalItem(g.def, g.target, g.target, 0, 'goals') : null
    },
  },
  {
    // the goal nearest its count, in minutes of play
    id: 'goal',
    next: (f) => {
      let best: NextItem | null = null
      for (const g of goalsNow(f)) {
        if (!goalNear(g)) continue
        const minutes = minutesFor(f, (g.target - g.have) * unitCoins(g.def.count))
        if (!best || minutes < best.minutes) best = goalItem(g.def, g.have, g.target, minutes)
      }
      return best
    },
  },
  {
    // the next level that opens something, and the first thing it opens
    id: 'unlock',
    next: (f) => {
      const now = levelOf(f.xp.points)
      for (let level = now + 1; level <= LEVELS.max; level++) {
        const opens = opensAt(level)
        if (!opens.length) continue
        return {
          pic: { art: 'glowing-star' },
          words: `Level ${level}: ${unlockName(opens[0])}`,
          minutes: Math.max(0, xpAt(level) - f.xp.points) / Math.max(1, xpPerMinute(now)),
        }
      }
      return null
    },
  },
  {
    // the next big thing the coins are saved for (the market, the house)
    id: 'saving',
    next: (f) => {
      const s = nextSaving(f)
      return s ? { pic: { art: s.art }, words: `Save for the ${s.name.toLowerCase()}`, have: s.have, of: s.of, minutes: minutesFor(f, s.of - s.have) } : null
    },
  },
]

/** When there is nothing at all (never, while goals' ladders never end): plant something. */
const ANYTHING: NextItem = { pic: { art: 'seedling' }, words: 'Plant something new', go: { bed: ['empty'] }, minutes: 0 }

/** What is next for a farm, and which kind of row it is (the welcome back's Go there follows the step's walk). */
export function pickNext(f: FarmData, o: { steps?: boolean } = {}): { id: NextSourceId | null; item: NextItem } {
  const steps = o.steps ?? true
  const found = NEXT_SOURCES.filter((s) => steps || s.id !== 'step').map((s) => ({ id: s.id, item: s.next(f) }))
  for (const id of FIRST) {
    const hit = found.find((x) => x.id === id && x.item)
    if (hit?.item) return { id, item: hit.item }
  }
  let best: { id: NextSourceId; item: NextItem } | null = null
  for (const x of found) if (x.item && !FIRST.includes(x.id) && (!best || x.item.minutes < best.item.minutes)) best = { id: x.id, item: x.item }
  return best ?? { id: null, item: ANYTHING }
}

/**
 * What is next for a farm: the step it is on (`steps`: whether they run on this page; quiet where the game is tested),
 * else a request that can be filled now, else a goal to claim; else the nearest of the rest in minutes of play. Never
 * empty.
 */
export const nextUp = (f: FarmData, o: { steps?: boolean } = {}): NextItem => pickNext(f, o).item
