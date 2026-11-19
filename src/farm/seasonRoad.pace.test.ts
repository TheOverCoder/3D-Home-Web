// @vitest-environment happy-dom
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { playVisits } from '../sim/sessions'
import { PACE } from '../sim/targets'
import { SEASON_DAYS, seasonAt } from './season'
import { SEASON_ROAD } from './seasonRoad'
import { farm, quietRoad } from './state'

// The season road's pace (PACE.road in src/sim/targets.ts): on the one session runner (src/sim/sessions.ts), the player
// of ten minutes a day reaches each of the first seasons' last stop by the season's day `by`, in days played; the daily
// player sooner. The road is fed as in play (quietRoad(false)) and put back quiet after.

/** For each season, the day of it (days played) its road's last stop was reached on (none: not reached). */
let done: Record<number, number> = {}
let daily: Record<number, number> = {}

function play(profile: 'light' | 'daily', calendarDays: number): Record<number, number> {
  const at: Record<number, number> = {}
  playVisits(
    { profile, days: calendarDays, seed: 1 },
    {
      end: () => {
        const r = farm.seasonRoad
        const s = seasonAt(farm.played.days, farm.season.from)
        if (r.paid >= SEASON_ROAD.length && at[r.on] === undefined) at[r.on] = r.on === s.ordinal ? s.day : SEASON_DAYS + 1
      },
    },
  )
  return at
}

beforeAll(() => {
  quietRoad(false)
  // two seasons of days played, with the light player's two days of rest a week
  done = play(PACE.road.profile, Math.ceil((PACE.road.seasons * SEASON_DAYS * 7) / 5) + 1)
  daily = play('daily', PACE.road.seasons * SEASON_DAYS)
}, 120_000)
afterAll(() => quietRoad(true))

describe('the season road’s pace', () => {
  it.each(Array.from({ length: PACE.road.seasons }, (_, k) => k))(`the ten-minute player reaches season %i’s last stop by its day ${PACE.road.by}`, (k) => {
    expect(done[k], `season ${k}: ${JSON.stringify(done)}`).toBeDefined()
    expect(done[k]).toBeLessThanOrEqual(PACE.road.by)
  })

  it('the daily player sooner: the road is a stopping point inside the season, never a race against it', () => {
    for (let k = 0; k < PACE.road.seasons; k++) {
      expect(daily[k], `season ${k}: ${JSON.stringify(daily)}`).toBeDefined()
      expect(daily[k]).toBeLessThanOrEqual(done[k])
    }
  })
})
