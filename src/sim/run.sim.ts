// @vitest-environment happy-dom
// `npm run sim` (vitest.sim.config.ts): plays a new farm for three hours and prints the report (./report.ts). Not a
// test: src/sim/pace.test.ts holds the pace to PACE. SIM_SEED picks the dice; SIM_LOCKS=off plays with everything open
// whatever the level (the farm before its locks, src/farm/unlocks.ts), to compare.
import { it } from 'vitest'
import { simulate } from './play'
import { report } from './report'

it('plays a new farm for three hours', () => {
  const seed = Number(process.env.SIM_SEED ?? 1)
  const open = process.env.SIM_LOCKS === 'off'
  console.log(`\n${report(simulate({ minutes: 180, seed, open }))}\n`)
})
