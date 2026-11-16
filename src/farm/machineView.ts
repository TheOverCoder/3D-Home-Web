import type { MachineId, ProduceId } from './data'

// What a machine's panel shows and what it can do: a queue of jobs (one good each), a level from how long the machine
// has worked, and a queue that grows by upgrades. The farm's state makes the view (`machineView` in ./state) and does
// the actions (`machineActions`); the panel only draws the view and calls the actions.

/** One place in the queue: waiting (its ingredients already in), working (the first), or done (waiting to be
 *  collected; it keeps its place until it is). */
export interface QueueSlot {
  recipe: string
  makes: ProduceId
  state: 'waiting' | 'working' | 'done'
  /** seconds this job takes at the machine's level, and those left (0 when done) */
  seconds: number
  left: number
}

export interface RecipeView {
  id: string
  makes: ProduceId
  needs: Partial<Record<ProduceId, number>>
  /** how many of each the farm has now */
  have: Partial<Record<ProduceId, number>>
  seconds: number
  /** it is open, its ingredients are in store and a place is free */
  can: boolean
  /** not open yet at the farm's level: the level it opens at (src/farm/unlocks.ts) */
  locked?: number
}

export interface LevelView {
  n: number
  /** minutes the machine has worked, and those its next level needs (null at the top) */
  minutes: number
  next: number | null
  /** 0–1 of the way from this level to the next */
  progress: number
  boost: LevelBoost
  /** what the next level brings (null at the top) */
  nextBoost: LevelBoost | null
}

export interface MachineView {
  id: MachineId
  name: string
  level: LevelView
  /** places in the queue now (3 to 12) */
  capacity: number
  slots: QueueSlot[]
  recipes: RecipeView[]
  /** the next place's price, or null at 12 */
  upgrade: { capacity: number; price: number } | null
}

export interface MachineActions {
  /** a job into the queue (its ingredients taken now), at the end or at a place among the waiting ones */
  add(recipe: string, at?: number): boolean
  /** a waiting job taken out (its ingredients given back) */
  remove(index: number): boolean
  /** a waiting job moved to another waiting place (the working one and the done ones stay) */
  move(from: number, to: number): boolean
  /** every done job collected (as many as fit in the store; the rest stay); how many */
  collect(): number
  /** one more place, for its price */
  buySlot(): boolean
}

/** A machine level's boost: more XP for each job, more coins for what it makes wherever it is sold, faster jobs. */
export interface LevelBoost {
  /** +0.2 = 20 % more XP for each job it finishes */
  xp: number
  /** +0.2 = its goods sell for 20 % more (buyers, orders, the market) */
  coins: number
  /** 0.1 = each job takes 10 % less time */
  speed: number
}

/** The levels: minutes of work each needs (from the start), and what it gives. Level 2 after six hours of work. */
export const MACHINE_LEVELS: { minutes: number; boost: LevelBoost }[] = [
  { minutes: 0, boost: { xp: 0, coins: 0, speed: 0 } },
  { minutes: 360, boost: { xp: 0.2, coins: 0.2, speed: 0 } },
  { minutes: 1080, boost: { xp: 0.4, coins: 0.4, speed: 0.05 } },
  { minutes: 2520, boost: { xp: 0.6, coins: 0.6, speed: 0.1 } },
  { minutes: 5400, boost: { xp: 0.8, coins: 0.8, speed: 0.15 } },
  { minutes: 11160, boost: { xp: 1, coins: 1, speed: 0.2 } },
]

/** The level a machine is at after `seconds` of work. */
export function machineLevel(seconds: number): LevelView {
  const minutes = Math.max(0, Number.isFinite(seconds) ? seconds / 60 : 0)
  let i = 0
  while (i + 1 < MACHINE_LEVELS.length && minutes >= MACHINE_LEVELS[i + 1].minutes) i++
  const here = MACHINE_LEVELS[i]
  const up = MACHINE_LEVELS[i + 1]
  return {
    n: i + 1,
    minutes: Math.floor(minutes),
    next: up ? up.minutes : null,
    progress: up ? (minutes - here.minutes) / (up.minutes - here.minutes) : 1,
    boost: here.boost,
    nextBoost: up ? up.boost : null,
  }
}

/** The queue: three places to start with, up to twelve, each next one dearer than the last. */
export const QUEUE = { start: 3, max: 12 } as const
/** The price of the place that makes the queue `capacity` long (4 … 12). */
export const QUEUE_PRICES: Record<number, number> = { 4: 300, 5: 450, 6: 700, 7: 1000, 8: 1500, 9: 2200, 10: 3200, 11: 4500, 12: 6500 }
export const queuePrice = (capacity: number): number | null => QUEUE_PRICES[capacity] ?? null
