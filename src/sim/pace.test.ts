// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest'
import { simulate, type SimRun } from './play'
import { mmss } from './report'
import { PACE } from './targets'

// The pace of a new farm (PACE in ./targets.ts), played by the good player of ./policy.ts on three rolls of the dice:
// each level from 2 to 15 is reached within its band, and the first hour has no stretch with nothing useful to do
// longer than its most. `npm run sim` prints the whole of a run.

const LEVELS = Object.keys(PACE.levels).map(Number)
const TOP = Math.max(...LEVELS)
const SEEDS = [1, 2, 3]

let runs: SimRun[] = []
beforeAll(() => {
  // as long as the first hour and the top band take (a little past its end, to see a level that is late)
  runs = SEEDS.map((seed) => simulate({ seed, minutes: PACE.idle.within, until: TOP, most: PACE.levels[TOP][1] + 5 }))
})

describe('the pace of a new farm', () => {
  it.each(LEVELS)('level %i is reached within its band', (level) => {
    const [soonest, latest] = PACE.levels[level]
    for (const run of runs) {
      const at = run.levelAt[level]
      expect(typeof at, `seed ${run.seed}: level ${level} not reached in ${Math.round(run.minutes)} minutes`).toBe('number')
      expect(at, `seed ${run.seed}: level ${level} at ${mmss(at!)}, before ${soonest} min`).toBeGreaterThanOrEqual(soonest)
      expect(at, `seed ${run.seed}: level ${level} at ${mmss(at!)}, after ${latest} min`).toBeLessThanOrEqual(latest)
    }
  })

  it('in the first hour there is always something useful to do: no wait longer than its most', () => {
    for (const run of runs) {
      const long = run.gaps.filter((g) => g.from < PACE.idle.within * 60 && g.to - g.from > PACE.idle.most * 60)
      expect(long.map((g) => `seed ${run.seed}: ${mmss(g.from / 60)} – ${mmss(g.to / 60)}, waiting for ${g.waiting}`)).toEqual([])
    }
  })
})
