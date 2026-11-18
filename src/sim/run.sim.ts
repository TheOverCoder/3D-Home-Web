// @vitest-environment happy-dom
// `npm run sim` (vitest.sim.config.ts): plays a new farm as far as PACE's last level and prints the report
// (./report.ts), then PACE's other rules on every seed: the good player's income and rewards, and each seed's first two
// weeks on the session runner (the first sitting, the nights, full stores). Not a test: src/sim/pace.test.ts holds the
// pace to PACE (one seed's first week on the runner). SIM_SEED picks the dice; SIM_LOCKS=off plays with everything open
// whatever the level (the farm before its locks, src/farm/unlocks.ts), to compare; SIM_TOOLS=off without the animals'
// tools and the remotes for sale (the farm before them, plans/animal-tools.md), to compare. SIM_JOURNEY=daily or light
// prints the journey instead (./journey.ts, update-v1/JOURNEY.md): that player's visits for SIM_DAYS days (30), at a
// real player's pace (SIM_PACE=good: the good player's), with what each brought and the bounds of JOURNEY it breaks.
import { it } from 'vitest'
import { journey, journeyReport } from './journey'
import { simulate } from './play'
import { paceReport, report } from './report'
import { PACES, type PaceId, type ProfileId } from './sessions'
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
  // as far as the last level PACE bands, as pace.test.ts plays it
  const top = Math.max(...Object.keys(PACE.levels).map(Number))
  const play = (s: number) => simulate({ minutes: PACE.idle.within, until: top, most: PACE.levels[top][1] + 5, seed: s, open, tools })
  console.log(`\n${report(play(seed))}\n`)
  if (open || !tools) return
  const runs = SEEDS.map(play)
  const journeys = SEEDS.map((s) => ({ seed: s, news: journey({ profile: 'daily', days: PACE_DAYS, seed: s }) }))
  console.log(`${paceReport(runs, journeys)}\n`)
})
