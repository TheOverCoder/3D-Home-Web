import { defineConfig } from 'vitest/config'

// `npm run sim`: the pace simulation (src/sim/run.sim.ts) plays a new farm for three hours and prints its report as it
// is (no test of its own: src/sim/pace.test.ts, in `npm test`, holds the pace to PACE).
export default defineConfig({ test: { include: ['src/sim/run.sim.ts'], environment: 'node', disableConsoleIntercept: true, testTimeout: 120_000 } })
