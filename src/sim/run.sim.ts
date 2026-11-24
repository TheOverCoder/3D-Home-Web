// @vitest-environment happy-dom
// `npm run sim` (vitest.sim.config.ts): plays a new farm as far as PACE's last level and prints the report
// (./report.ts), then PACE's other rules on every seed: the good player's income and rewards, and each seed's first two
// weeks on the session runner (the first sitting, the nights, full stores). Not a test: src/sim/pace.test.ts holds the
// pace to PACE (one seed's first week on the runner). SIM_SEED picks the dice; SIM_LOCKS=off plays with everything open
// whatever the level (the farm before its locks, src/farm/unlocks.ts), to compare; SIM_TOOLS=off without the animals'
// tools and the remotes for sale (the farm before them, plans/animal-tools.md), to compare; SIM_JAM=on with a player who
// plans for the jam kettle (./policy.ts, planJam). SIM_JOURNEY=daily or light
// prints the journey instead (./journey.ts, update-v1/JOURNEY.md): that player's visits for SIM_DAYS days (30), at a
// real player's pace (SIM_PACE=good: the good player's), with what each brought and the bounds of JOURNEY it breaks.
// Last, the game's health (./health.ts): the daily player's first 30 days, as a table.
import { it } from 'vitest'
import { health, healthReport } from './health'
import { journey, journeyReport } from './journey'
import { simulate } from './play'
import { paceReport, report } from './report'
import { PACES, type PaceId, type ProfileId, type Weekday } from './sessions'
import { PACE, SESSIONS } from './targets'

/** The seeds PACE is held on, and the days of each seed's journey the report plays. */
const SEEDS = [1, 2, 3]
const PACE_DAYS = 14

it('plays a new farm for three hours', () => {
  const seed = Number(process.env.SIM_SEED ?? 1)
  const profile = process.env.SIM_JOURNEY
  if (profile) {
    if (!(profile in SESSIONS)) throw new Error(`SIM_JOURNEY: one of ${Object.keys(SESSIONS).join(', ')}`)
    const pace = (process.env.SIM_PACE ?? 'real') as PaceId
    if (!(pace in PACES)) throw new Error(`SIM_PACE: one of ${Object.keys(PACES).join(', ')}`)
    const days = Number(process.env.SIM_DAYS ?? 30)
    console.log(`\nThe ${profile} player's first ${days} days, at a ${pace} pace (seed ${seed})\n\n${journeyReport(journey({ profile: profile as ProfileId, days, pace, seed }))}\n`)
    return
  }
  const open = process.env.SIM_LOCKS === 'off'
  const tools = process.env.SIM_TOOLS !== 'off'
  // SIM_JAM=on: a player who plans for the jam kettle (./policy.ts, planJam)
  const jam = process.env.SIM_JAM === 'on'
  // as far as the last level PACE bands, as pace.test.ts plays it
  const top = Math.max(...Object.keys(PACE.levels).map(Number))
  const play = (s: number) => simulate({ minutes: PACE.idle.within, until: top, most: PACE.levels[top][1] + 5, seed: s, open, tools, jam })
  console.log(`\n${report(play(seed))}\n`)
  if (open || !tools) return
  const runs = SEEDS.map(play)
  const journeys = SEEDS.map((s) => ({ seed: s, news: journey({ profile: 'daily', days: PACE_DAYS, seed: s }) }))
  console.log(`${paceReport(runs, journeys)}\n`)
  // the game's health over a player's first days (./health.ts): SIM_HEALTH names the player (daily, light; off for none),
  // SIM_HEALTH_DAYS the days (30), SIM_WEEKDAY the weekday of the first (1 Monday … 7 Sunday), SIM_EVENTS=on with the
  // week's events
  const who = process.env.SIM_HEALTH ?? 'daily'
  if (who === 'off') return
  if (!(who in SESSIONS)) throw new Error(`SIM_HEALTH: one of ${Object.keys(SESSIONS).join(', ')}, or off`)
  const weekday = Number(process.env.SIM_WEEKDAY ?? 1)
  if (!(weekday >= 1 && weekday <= 7 && Number.isInteger(weekday))) throw new Error('SIM_WEEKDAY: 1 (Monday) to 7 (Sunday)')
  const t0 = performance.now()
  const h = health({ profile: who as ProfileId, days: Number(process.env.SIM_HEALTH_DAYS ?? 30), seed, weekday: weekday as Weekday, events: process.env.SIM_EVENTS === 'on' })
  console.log(`${healthReport(h)}\n(played in ${((performance.now() - t0) / 1000).toFixed(1)} s)\n`)
})
