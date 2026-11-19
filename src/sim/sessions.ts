// The session runner, and the only one: mission 08's (update-v1/missions/08-engines-stability.md, change 11), written
// first for the journey (./journey.ts, update-v1/JOURNEY.md). 08's health table and every later measure of visits
// watch this runner through its observer; none plays sessions of its own.
//
// It plays the pace simulation's good player (./policy.ts) through a player's visits (SESSIONS in ./targets.ts): within
// a visit, the farm's own `tick` and the game's own functions for every press, with the time each walk and press takes
// (as ./play.ts does); between visits, the game's own `cameBack`, as when the page comes back. The daily gift's
// calendar moves with the visits. The first day is a Monday unless told another weekday; the week's events are off, as
// under Vitest, unless told on (then judged by the visits' own clock, as the device's: src/farm/events.ts). Run it
// under happy-dom (the farm keeps its save). Nothing in the game imports it.

import { cameBack, quietSteps, resetFarm, setDailyClock, setEventClock, setRandom, tick, unlockAll, type AwayReport } from '../farm/state'
import { STEP, WALK, seeded } from './play'
import { nextMove, sellTools, type Spot } from './policy'
import { SESSIONS, type VisitRow } from './targets'

/** How a player gets about: the good player's pace (./play.ts), and a real player's, slower on the way and at each
 *  press: about 0.6 of the good player's XP a minute (level 5 at about 15 minutes of play, against level 7). */
export const PACES = {
  good: WALK,
  real: { speed: 1.5, detour: 1.4, press: 4, tap: 0.5 },
} as const

export type ProfileId = keyof typeof SESSIONS
export type PaceId = keyof typeof PACES

/** A visit on a day of play (the first day is 1). */
export interface Visit extends VisitRow {
  day: number
}

/** What a visit's observer hears. */
export interface VisitEvents {
  /** a visit begins, after what came while away (null on the first) */
  begin?(visit: Visit, back: AwayReport | null): void
  /** a move was made, `at` seconds into the visit (the time it takes has not passed yet) */
  moved?(visit: Visit, move: { rule: string; what: string }, at: number): void
  /** the visit ends after `played` seconds */
  end?(visit: Visit, played: number): void
}

/** The day of play the first visit is on: a Monday, at local midnight (each visit's hour counts from its day's), unless a
 *  run starts on another weekday. */
const FIRST_DAY = new Date(2026, 0, 5).getTime()
const HOUR = 3_600_000
/** The weekdays a run may start on: 1 Monday … 7 Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
/** Where each visit begins: the farm's start, on the path among the first beds (as ./play.ts begins). */
const START: Spot = { x: -1.2, z: 8 }

/** The visits of a profile's first `days` days, in order. */
export function visitsOf(profile: ProfileId, days: number): Visit[] {
  const p = SESSIONS[profile]
  const out: Visit[] = []
  for (let day = 1; day <= days; day++) {
    if (day > 1 && (p.rest as readonly number[]).includes(((day - 1) % 7) + 1)) continue
    for (const row of day === 1 ? p.first : p.days) out.push({ ...row, day })
  }
  return out
}

/** When a visit begins (ms), the first day being `weekday` (a Monday unless told). */
export const visitStart = (v: Visit, weekday: Weekday = 1) => FIRST_DAY + ((weekday - 1 + v.day - 1) * 24 + v.hour) * HOUR

/**
 * Plays a new farm through a profile's first `days` days of visits, at a pace (a real player's, unless told), on a
 * seed (the farm's dice and the buyers'), from a weekday (a Monday unless told), with the week's events or without (as
 * the tests have them, unless told), telling the observer each visit's beginning, moves and end. The farm's levels are
 * locked as in play and its first steps run. Every clock and switch it sets is put back as the tests have them,
 * however it ends.
 */
export function playVisits(opts: { profile: ProfileId; days: number; pace?: PaceId; seed?: number; weekday?: Weekday; events?: boolean }, on: VisitEvents = {}): void {
  const walk = PACES[opts.pace ?? 'real']
  const seed = opts.seed ?? 1
  const weekday = opts.weekday ?? 1
  const random = Math.random
  let wall = FIRST_DAY
  /** the wall clock moves: the events (when they are on) are judged at it */
  const clock = (t: number) => {
    wall = t
    if (opts.events) setEventClock(t)
  }
  setRandom(seeded(seed))
  Math.random = seeded(seed * 7919 + 13)
  setEventClock(null)
  setDailyClock(() => wall)
  unlockAll(false)
  quietSteps(false)
  sellTools(true)
  try {
    resetFarm()
    /** when the last visit ended (ms; null before the first) */
    let left: number | null = null
    for (const visit of visitsOf(opts.profile, opts.days)) {
      const start = visitStart(visit, weekday)
      clock(start)
      const back = left === null ? null : cameBack((start - left) / 1000)
      on.begin?.(visit, back)
      let at = START
      let t = 0
      const pass = (seconds: number) => {
        for (let rest = seconds; rest > 1e-9; rest -= STEP) tick(Math.min(STEP, rest))
        t += seconds
        clock(start + t * 1000)
      }
      while (t < visit.minutes * 60) {
        const move = nextMove()
        if (!move) {
          pass(1)
          continue
        }
        move.run()
        on.moved?.(visit, { rule: move.rule, what: move.what }, t)
        // the way there from the last move, the press, and each tap on the panel it opened
        const way = move.at ? (Math.hypot(move.at.x - at.x, move.at.z - at.z) * walk.detour) / walk.speed : 0
        if (move.at) at = move.at
        pass(way + walk.press + (move.taps?.() ?? 0) * walk.tap)
      }
      left = start + t * 1000
      on.end?.(visit, t)
    }
  } finally {
    Math.random = random
    setRandom(null)
    setDailyClock(null)
    setEventClock(null)
    // (everything open again, the steps quiet, the tools for sale: the tests' default)
    unlockAll(true)
    quietSteps(true)
    sellTools(true)
  }
}
