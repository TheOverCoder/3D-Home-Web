// @vitest-environment happy-dom
// `npm run sim` (vitest.sim.config.ts): plays a new farm for three hours and prints the report (./report.ts). Not a
// test: src/sim/pace.test.ts holds the pace to PACE. SIM_SEED picks the dice; SIM_LOCKS=off plays with everything open
// whatever the level (the farm before its locks, src/farm/unlocks.ts), to compare; SIM_TOOLS=off without the animals'
// tools and the remotes for sale (the farm before them, plans/animal-tools.md), to compare. SIM_JOURNEY=daily or light
// prints the journey instead (./journey.ts, update-v1/JOURNEY.md): that player's visits for SIM_DAYS days (30), at a
// real player's pace (SIM_PACE=good: the good player's), with what each brought and the bounds of JOURNEY it breaks.
import { it } from 'vitest'
import { journey, journeyReport } from './journey'
import { simulate } from './play'
import { report } from './report'
import { PACES, type PaceId, type ProfileId } from './sessions'
import { SESSIONS } from './targets'

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
  console.log(`\n${report(simulate({ minutes: 180, seed, open, tools }))}\n`)
})
