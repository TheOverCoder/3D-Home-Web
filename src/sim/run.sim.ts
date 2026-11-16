// @vitest-environment happy-dom
// `npm run sim` (vitest.sim.config.ts): plays a new farm for three hours and prints the report (./report.ts). Not a
// test: src/sim/pace.test.ts holds the pace to PACE.
import { it } from 'vitest'
import { simulate } from './play'
import { report } from './report'

it('plays a new farm for three hours', () => {
  const seed = Number(process.env.SIM_SEED ?? 1)
  console.log(`\n${report(simulate({ minutes: 180, seed }))}\n`)
})
