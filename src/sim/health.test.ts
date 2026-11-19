// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest'
import { BEDS, MACHINE_IDS, MACHINES } from '../farm/data'
import { AWAY_MOST, farm, resetFarm } from '../farm/state'
import { DRY_FROM, HEALTH_LEVELS, REWARDS, allBusy, health, someBusy, type Health } from './health'
import { visitsOf } from './sessions'

// The health table's own rules (./health.ts, on the session runner ./sessions.ts): what it counts, and that it counts
// the same on the same dice. Its numbers are the game's, not bounded here: PACE and JOURNEY (./targets.ts) hold those.

const DAYS = 3
let three: Health
beforeAll(() => {
  three = health({ profile: 'daily', days: DAYS })
})

describe('the health table', () => {
  it('counts every visit of the schedule, and the minutes played in them', () => {
    expect(three.visits).toBe(visitsOf('daily', DAYS).length)
    expect(three.minutes).toBeGreaterThanOrEqual(visitsOf('daily', DAYS).reduce((s, v) => s + v.minutes, 0))
    expect(three.busy.of).toBe(three.visits)
    expect(three.busy.n).toBeLessThanOrEqual(three.busy.some)
  })

  it('tells when each level and the house were first reached, in order', () => {
    expect(three.reached.map((r) => r.what)).toEqual([...HEALTH_LEVELS.map((l) => `level ${l}`), 'the house'])
    const levels = three.reached.slice(0, HEALTH_LEVELS.length)
    // a new farm reaches level 5 in its first sitting
    expect(levels[0].visit).toBe(1)
    expect(levels[0].day).toBe(1)
    for (let i = 1; i < levels.length; i++) {
      if (levels[i].minutes === null) continue
      expect(levels[i].minutes!).toBeGreaterThanOrEqual(levels[i - 1].minutes!)
      expect(levels[i].visit!).toBeGreaterThanOrEqual(levels[i - 1].visit!)
    }
    for (const r of three.reached) if (r.visit !== null) expect(visitsOf('daily', DAYS)[r.visit - 1].day).toBe(r.day)
  })

  it('counts the rewards a visit brings, each kind once a visit at most among the visits with one', () => {
    expect(three.rewards.map((r) => r.kind)).toEqual([...REWARDS])
    const levels = three.rewards.find((r) => r.kind === 'level')!
    expect(levels.total).toBe(three.level - 1)
    // the daily gift: one a day of play
    expect(three.rewards.find((r) => r.kind === 'daily gift')!.total).toBe(DAYS)
    for (const r of three.rewards) {
      expect(r.visits).toBeGreaterThanOrEqual(0)
      expect(r.visits).toBeLessThanOrEqual(1)
      expect(r.visits * three.visits).toBeLessThanOrEqual(r.total)
    }
  })

  it('measures the longest stretch with no reward only from a level reached', () => {
    expect(three.dry.map((d) => d.from)).toEqual([...DRY_FROM])
    for (const d of three.dry) {
      const reached = three.level >= d.from
      expect(d.minutes === null, `level ${d.from}`).toBe(!reached)
      if (d.minutes !== null) expect(d.minutes).toBeLessThanOrEqual(three.minutes)
    }
  })

  it('tells what each kind of return found, its time away through the game’s own cameBack (counted to AWAY_MOST)', () => {
    const labels = new Set(
      visitsOf('daily', DAYS)
        .slice(1)
        .map((v) => v.label),
    )
    expect(new Set(three.returns.map((r) => r.label))).toEqual(labels)
    expect(three.returns.reduce((s, r) => s + r.n, 0)).toBe(three.visits - 1)
    for (const r of three.returns) {
      expect(r.counted, r.label).toBeLessThanOrEqual(Math.min(r.away, AWAY_MOST) + 1e-6)
      expect(r.worth, r.label).toBeGreaterThanOrEqual(0)
    }
    // the night is the longest time away, and the farm went on for less of it than the hour's return
    const night = three.returns.find((r) => r.label === 'morning')!
    const hour = three.returns.find((r) => r.label === 'back within the hour')!
    expect(night.away).toBeGreaterThan(hour.away)
    expect(night.counted / night.away).toBeLessThanOrEqual(hour.counted / hour.away)
  })

  it('repeats a run on the same seed, and plays another on another', () => {
    expect(health({ profile: 'daily', days: 1, seed: 3 })).toEqual(health({ profile: 'daily', days: 1, seed: 3 }))
    expect(health({ profile: 'daily', days: 1, seed: 4 })).not.toEqual(health({ profile: 'daily', days: 1, seed: 3 }))
  })
})

describe('everything busy', () => {
  it('is every built bed growing and every open machine working', () => {
    resetFarm()
    expect(allBusy()).toBe(false)
    expect(someBusy()).toBe(false)
    BEDS.forEach((_, i) => {
      const b = farm.beds[i]
      if (!b.built) return
      Object.assign(b, { crop: 'wheat', growth: 0, water: 1e6 })
    })
    expect(someBusy()).toBe(true)
    // (under Vitest every machine is open: each needs a job under way)
    expect(allBusy()).toBe(false)
    for (const id of MACHINE_IDS) farm.machines[id] = { ...farm.machines[id], jobs: [MACHINES[id].recipes[0].id], done: 0, progress: 0 }
    expect(allBusy()).toBe(true)
    // a bed ripe: not everything is busy any more
    const ripe = farm.beds.findIndex((b) => b.built)
    farm.beds[ripe].growth = 1e9
    expect(allBusy()).toBe(false)
    resetFarm()
  })
})
