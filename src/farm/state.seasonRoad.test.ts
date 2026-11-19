// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useHome } from '../store'
import { seasonGarment } from './outfit'
import { roadEnd, roadOf } from './seasonRoad'
import { SEASON_DAYS } from './season'
import { farm, gainXp, quietRoad, resetFarm, resetRewardCounts, rewardCounts, roadNow, setRandom, tick, xpEventCount } from './state'
import { OLD_SAVE, justSaved, savedNow, startFrom } from './testSaves'

// The season road on the farm (src/farm/seasonRoad.ts, src/farm/state/seasonRoad.ts): fed by the XP gained, from the day
// the farm's year begins; each stop reached comes in by itself through give (a stop reward; the garment its own), with a
// toast, and gives no XP; quiet where the game is tested; kept in the save, a farm from before starting on the season
// now's road.

/** XP from play: the goal claim's worth, `n` times (gainXp, as any action). */
const play = (xp: number) => {
  let left = xp
  while (left > 0) left -= gainXp('goal') || 1
}
const count = (k: 'stop') => Object.values(rewardCounts()[k]).reduce((n, c) => n + c, 0)

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  farm.season = { from: 1, told: 0 }
  setRandom(() => 0)
  resetRewardCounts()
  quietRoad(false)
})
afterEach(() => {
  quietRoad(true)
  setRandom(null)
})

describe('fed by the XP gained', () => {
  it('each stop reached comes in by itself, once, through give, with a toast; no XP of its own', () => {
    const coins = farm.coins
    const before = xpEventCount()
    play(roadOf(0)[0])
    expect(farm.seasonRoad).toMatchObject({ on: 0, paid: 1 })
    expect(count('stop')).toBe(1)
    expect(farm.coins).toBeGreaterThan(coins)
    expect(useHome.getState().toast?.text).toMatch(/^Season road, stop 1 · \d+ coins$/)
    // the XP it took was play's own: no more events than the gains
    expect(xpEventCount() - before).toBeGreaterThan(0)
    const points = farm.xp.points
    tick(1)
    expect(farm.xp.points).toBe(points)
    expect(count('stop')).toBe(1)
  })

  it('the last stop: the season’s garment into the wardrobe (a garment reward) and a big gift; then the road takes no more', () => {
    play(roadEnd(0))
    expect(farm.seasonRoad).toMatchObject({ on: 0, paid: 10 })
    // (the levels reached on the way bring their own garments: a garment reward each, beside this one)
    expect(farm.outfit.owned).toEqual([seasonGarment(0)!.id])
    expect(count('stop')).toBe(10)
    expect(useHome.getState().toast?.text).toMatch(/^Spring’s road done · /)
    expect(roadNow()).toMatchObject({ done: true, opens: { name: 'Summer' } })
    play(500)
    expect(count('stop')).toBe(10)
  })

  it('not before the farm’s year begins (a new farm’s first steps), and not while quiet (as where the game is tested)', () => {
    farm.season = { from: 1, told: -1 }
    play(roadOf(0)[2])
    expect(farm.seasonRoad).toEqual({ on: 0, xp: 0, paid: 0 })
    farm.season = { from: 1, told: 0 }
    quietRoad(true)
    play(roadOf(0)[2])
    expect(farm.seasonRoad).toEqual({ on: 0, xp: 0, paid: 0 })
  })

  it('a new season: a finished road gives way to its road; one not finished carries on', () => {
    play(roadEnd(0))
    farm.played = { days: 1 + SEASON_DAYS, last: farm.played.last }
    tick(0.1)
    expect(farm.seasonRoad).toEqual({ on: 1, xp: 0, paid: 0 })
    expect(roadNow()).toMatchObject({ on: 1, name: 'Summer', current: true })
    play(roadOf(1)[0])
    farm.played = { days: 1 + 2 * SEASON_DAYS, last: farm.played.last }
    tick(0.1)
    expect(farm.seasonRoad.on).toBe(1)
    expect(roadNow()).toMatchObject({ on: 1, current: false })
  })
})

describe('kept in the save', () => {
  it('saved and loaded as it was; nothing given twice', () => {
    play(roadOf(0)[3])
    const road = { ...farm.seasonRoad }
    startFrom(justSaved(savedNow()))
    expect(farm.seasonRoad).toEqual(road)
  })

  it('a farm from before it: the season now’s road, from its start', () => {
    startFrom(justSaved(OLD_SAVE))
    expect(farm.seasonRoad).toEqual({ on: 0, xp: 0, paid: 0 })
    const s = { ...savedNow(), played: { days: 20, last: farm.played.last }, season: { from: 1, told: 2 } }
    delete (s as Record<string, unknown>).seasonRoad
    startFrom(justSaved(s))
    expect(farm.seasonRoad).toEqual({ on: 2, xp: 0, paid: 0 })
  })
})
