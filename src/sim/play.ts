// The pace simulation: a new farm played by the good player of ./policy.ts, with no screen — the farm's own `tick` at
// a fixed step, the game's own functions for every press, its dice and the buyers' on a fixed seed. Walking from one
// place to another takes time (as far as a player runs, round what stands in the way), and so does each press. What it
// keeps: the minute each level is reached, the coins as play goes on, what was bought and when, and every stretch with
// nothing useful to do. Events are off (they are under Vitest); the levels' locks are on, as in play (src/farm/unlocks.ts:
// what a level has not opened is not bought, planted or queued); the first steps run (src/farm/firstSteps.ts: their
// coins are paid as the player does them, and the daily gift waits for them); the daily gift is claimed as it opens
// and each level's gift boxes are opened as they are reached, as a player would. The farm shop's tools for the animals
// and the two remotes are for sale as in play (plans/animal-tools.md; `tools: false` plays without them, to compare).
// Run it under happy-dom (the farm keeps its save).

import { LADDERS, LADDER_IDS, LEVELS, TOOL_KINDS, mostAnimals, toolLadder, type LadderId, type ToolKind } from '../farm/data'
import { animals, farm, quietSteps, resetFarm, setDailyClock, setEventClock, setRandom, tick, unlockAll } from '../farm/state'
import { levelOf } from '../farm/xp'
import { nextMove, onTheWay, sellTools, type Spot } from './policy'

/** The farm's clock moves on in steps this long (a buyer walks at most a quarter of a second a step). */
export const STEP = 0.25
/** How fast the player gets from one place to another (m/s: between a walk and a run), how much farther than the
 *  straight line the way round things is, the seconds a press takes (looking, pressing, a tap on its panel), and the
 *  seconds of each tap on an animal's tool's panel, once it is open (one good a tap, more with its ladder). */
export const WALK = { speed: 3, detour: 1.3, press: 2, tap: 0.3 } as const
/** A stretch with nothing useful to do longer than this is a gap (seconds). */
export const GAP = 120
/** The daily gift's calendar day: one fixed day (the simulation plays within it). */
const DAY = Date.UTC(2026, 0, 5, 12)

export interface Gap {
  /** seconds of play it began and ended */
  from: number
  to: number
  /** what was on its way as it began (./policy.ts onTheWay), and the move that ended it */
  waiting: string
  ended: string
}

export interface SimRun {
  seed: number
  /** played with everything open whatever the level (src/farm/unlocks.ts), not locked by it */
  open: boolean
  minutes: number
  /** the minute of play each level was reached (index: the level; level 1 at 0; none: not reached) */
  levelAt: (number | undefined)[]
  /** every `every` minutes: the coins, the level and the XP */
  samples: { minute: number; coins: number; level: number; xp: number }[]
  gaps: Gap[]
  /** the longest stretch with nothing useful to do (seconds), and the minute it began */
  longest: { seconds: number; minute: number }
  /** what was bought, and the minute */
  bought: { minute: number; what: string }[]
  /** how many moves of each kind were made, and the XP they gave */
  moves: Record<string, { n: number; xp: number }>
  /** played with the farm shop's tools and remotes for sale (as in play) */
  tools: boolean
  /** the minute each herd was full (every animal the shop sells) and each of its tool's steps was bought */
  herdFull: Partial<Record<ToolKind, number>>
  /** the minute of each step of the farm shop's ladders (the tools, their upgrades, the remotes): one a step */
  shop: Partial<Record<LadderId, number[]>>
}

/** The farm shop's ladders: each animal's tool and its two upgrades, and the two remotes. */
const SHOP_ROWS = LADDER_IDS.filter((id) => LADDERS[id].at === 'shop')

/** A small, fast generator of numbers in [0, 1) from a seed (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Plays a new farm for `minutes` of play (or, with `until`, until that level is reached and `minutes` have passed, at
 * most `most` minutes). Samples coins every `every` minutes. With `open`, everything is open whatever the level (the
 * farm before its locks: to compare); with `tools: false`, the farm shop sells no tools and no remotes (the farm
 * before them: to compare).
 */
export function simulate(opts: { minutes: number; seed?: number; until?: number; most?: number; every?: number; open?: boolean; tools?: boolean }): SimRun {
  const seed = opts.seed ?? 1
  const every = opts.every ?? 10
  const end = Math.max(opts.minutes, opts.most ?? 0) * 60
  const random = Math.random
  // the farm's dice (surprises, orders, looks) and the buyers' (what they ask, what they offer: Math.random)
  setRandom(seeded(seed))
  Math.random = seeded(seed * 7919 + 13)
  setEventClock(null)
  setDailyClock(() => DAY)
  unlockAll(opts.open ?? false)
  quietSteps(false)
  sellTools(opts.tools ?? true)
  try {
    resetFarm()
    const run: SimRun = {
      seed,
      open: opts.open ?? false,
      minutes: 0,
      levelAt: [undefined, 0],
      samples: [],
      gaps: [],
      longest: { seconds: 0, minute: 0 },
      bought: [],
      moves: {},
      tools: opts.tools ?? true,
      herdFull: {},
      shop: {},
    }
    let t = 0
    // the player starts on the path among the first beds
    let at: Spot = { x: -1.2, z: 8 }
    let idle: { from: number; waiting: string } | null = null
    const sample = () => {
      while (t >= run.samples.length * every * 60) run.samples.push({ minute: run.samples.length * every, coins: farm.coins, level: levelOf(farm.xp.points), xp: farm.xp.points })
    }
    const advance = (seconds: number) => {
      for (let left = seconds; left > 1e-9; left -= STEP) {
        tick(Math.min(STEP, left))
        t += Math.min(STEP, left)
        sample()
      }
    }
    /** A stretch with nothing to do is over (`ended`: the move that ended it). */
    const waited = (ended: string) => {
      if (!idle) return
      const seconds = t - idle.from
      if (seconds > run.longest.seconds) run.longest = { seconds, minute: idle.from / 60 }
      if (seconds > GAP) run.gaps.push({ ...idle, to: t, ended })
      idle = null
    }
    sample()
    const reached = () => {
      const level = levelOf(farm.xp.points)
      for (let l = 2; l <= Math.min(level, LEVELS.max); l++) run.levelAt[l] ??= t / 60
      // a herd full, a step of the farm shop's ladders bought
      for (const kind of TOOL_KINDS) if (animals(kind) >= mostAnimals(kind)) run.herdFull[kind] ??= t / 60
      for (const id of SHOP_ROWS) {
        const steps = (run.shop[id] ??= [])
        while (steps.length < farm.ladders[id]) steps.push(t / 60)
      }
    }
    const done = () => t >= end || (opts.until !== undefined && t >= opts.minutes * 60 && levelOf(farm.xp.points) >= opts.until)
    while (!done()) {
      const move = nextMove()
      if (!move) {
        idle ??= { from: t, waiting: onTheWay() }
        advance(1)
        continue
      }
      waited(move.what)
      const xp = farm.xp.points
      move.run()
      const m = (run.moves[move.rule] ??= { n: 0, xp: 0 })
      m.n++
      m.xp += farm.xp.points - xp
      if (move.rule === 'buy') run.bought.push({ minute: t / 60, what: move.what })
      reached()
      // it is done as it is chosen, and then the time it took passes: the way there from the last move, the press (an
      // animal's tool: the press opens its panel), and each tap on that panel
      const walk = move.at ? (Math.hypot(move.at.x - at.x, move.at.z - at.z) * WALK.detour) / WALK.speed : 0
      if (move.at) at = move.at
      advance(walk + WALK.press + (move.taps?.() ?? 0) * WALK.tap)
      reached()
    }
    waited('(the end)')
    run.minutes = t / 60
    return run
  } finally {
    Math.random = random
    setRandom(null)
    setDailyClock(null)
    // (everything open again, the steps quiet, the tools for sale: the tests' default)
    unlockAll(true)
    quietSteps(true)
    sellTools(true)
  }
}

/** The minute a tool was bought (none: not in the run), and the minutes since its herd was full. */
export function toolBoughtAt(run: SimRun, kind: ToolKind): { at?: number; after?: number } {
  const at = run.shop[toolLadder(kind, 'tool')]?.[0]
  const full = run.herdFull[kind]
  return { at, after: at !== undefined && full !== undefined ? at - full : undefined }
}
