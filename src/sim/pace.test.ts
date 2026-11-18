// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest'
import { TOOL_KINDS } from '../farm/data'
import { incomeAt } from '../farm/economy'
import { journey, type VisitNews } from './journey'
import { incomeOver, simulate, toolBoughtAt, type SimRun } from './play'
import { mmss, nightOf } from './report'
import { PACE } from './targets'

// The pace of a new farm (PACE in ./targets.ts). Played by the good player of ./policy.ts on three rolls of the dice,
// with the levels' locks on as in play (src/farm/unlocks.ts: the levels in UNLOCKS are set so that this holds): each
// level from 2 to 30 is reached within its band, the first hour has no stretch with nothing useful to do longer than
// its most, each animal's tool (for sale as in play) is bought within its minutes of its herd being full, the first
// hour's rewards are mostly small and now and then big, and play pays more as the levels go up. On the session runner
// (./journey.ts: the daily player's first week at a real player's pace, one roll of the dice, so `npm run check` stays
// quick; `npm run sim` prints every seed and two weeks): the first sitting ends by setting something long, and a
// night pays. A rule today's farm breaks is a listed debt, as in ./journey.test.ts: expected to fail, naming who pays
// it, so it can neither pass silently nor be forgotten.

const LEVELS = Object.keys(PACE.levels).map(Number)
const TOP = Math.max(...LEVELS)
const SEEDS = [1, 2, 3]
const DAYS = 7

/** The rules today's farm breaks, and who pays each. */
const DEBTS: Partial<Record<'first' | 'night' | 'income', string>> = {
  first: 'mission 04 pays it: the first steps end on "Plant something long before you go" (04b, JOURNEY.md fix 1)',
  night: 'mission 01 pays it: every timer is short, so a night is worth what a break is (the long crops, 01a, change 5)',
  income: 'mission 01’s waves pay it: new recipes, beds and animals from level 14 (01b, changes 7 and 8)',
}

let runs: SimRun[] = []
let week: VisitNews[] = []
beforeAll(() => {
  // as long as the first hour and the top band take (a little past its end, to see a level that is late)
  runs = SEEDS.map((seed) => simulate({ seed, minutes: PACE.idle.within, until: TOP, most: PACE.levels[TOP][1] + 5, open: false }))
  week = journey({ profile: 'daily', days: DAYS })
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

  it.each(TOOL_KINDS)("the %s' tool is bought within its minutes of the herd being full", (kind) => {
    for (const run of runs) {
      const full = run.herdFull[kind]
      // (a herd full too late in the run to tell is not judged; every one so far is full well within it)
      expect(full, `seed ${run.seed}: the ${kind} never full`).toBeDefined()
      if (full! + PACE.tools.within > run.minutes) continue
      const { at, after } = toolBoughtAt(run, kind)
      expect(at, `seed ${run.seed}: the ${kind}' tool not bought (herd full at ${mmss(full!)})`).toBeDefined()
      expect(after, `seed ${run.seed}: the ${kind}' tool at ${mmss(at!)}, ${mmss(after!)} after the herd`).toBeLessThanOrEqual(PACE.tools.within)
    }
  })

  it("the first hour's rewards are mostly small, and now and then big or huge", () => {
    const { within, small, big } = PACE.rewards
    for (const run of runs) {
      const r = run.samples.find((s) => s.minute === within)!.rewards
      const all = r.small + r.medium + r.big + r.huge
      expect(r.small / all, `seed ${run.seed}: ${r.small} small of ${all}`).toBeGreaterThanOrEqual(small[0])
      expect(r.small / all, `seed ${run.seed}: ${r.small} small of ${all}`).toBeLessThanOrEqual(small[1])
      expect((r.big + r.huge) / all, `seed ${run.seed}: ${r.big + r.huge} big or huge of ${all}`).toBeGreaterThanOrEqual(big[0])
      expect((r.big + r.huge) / all, `seed ${run.seed}: ${r.big + r.huge} big or huge of ${all}`).toBeLessThanOrEqual(big[1])
    }
  })

  it('a minute of play earns about what incomeAt says, on the way up and once the farm is grown (src/farm/economy.ts)', () => {
    for (const span of [
      [7, 10],
      [10, 15],
      [15, 30],
    ] as const) {
      const sim = incomeOver(runs, span)
      let law = 0
      for (let l = span[0]; l < span[1]; l++) law += incomeAt(l + 0.5) / (span[1] - span[0])
      expect(Math.abs(sim / law - 1), `levels ${span[0]}–${span[1]}: ${sim.toFixed(1)} a minute, incomeAt ${law.toFixed(1)}`).toBeLessThanOrEqual(0.35)
    }
  })

  const income = () => {
    const { low, high, times } = PACE.income
    expect(incomeOver(runs, high), `${incomeOver(runs, high).toFixed(1)} a minute over ${high.join('–')}, ${incomeOver(runs, low).toFixed(1)} over ${low.join('–')}`).toBeGreaterThanOrEqual(
      times * incomeOver(runs, low),
    )
  }
  if (DEBTS.income) it.fails(`play pays more as it goes on: a listed debt, broken today (${DEBTS.income})`, income)
  else it('play pays more as it goes on', income)
})

describe('a session ends by setting something long, and a night pays (the daily player’s first week)', () => {
  const first = () => {
    const pull = week[0].pull
    expect(pull?.seconds ?? 0, `the first sitting ends with ${pull ? `${pull.what} in ${mmss(pull.seconds / 60)}` : 'nothing'} on its way`).toBeGreaterThanOrEqual(PACE.first.seconds)
  }
  if (DEBTS.first) it.fails(`the first sitting ends with something long on its way: a listed debt, broken today (${DEBTS.first})`, first)
  else it('the first sitting ends with something long on its way', first)

  const mornings = PACE.night.days.filter((d) => d <= DAYS)
  const night = (day: number) => {
    const n = nightOf(week, day)!
    const [least, most] = PACE.night.minutes
    expect(n.minutes, `day ${day}: ${Math.round(n.worth)} coins at level ${n.level}`).toBeGreaterThanOrEqual(least)
    expect(n.minutes, `day ${day}: ${Math.round(n.worth)} coins at level ${n.level}`).toBeLessThanOrEqual(most)
    // and the evening before set the night, not a break
    expect(n.within, `day ${day - 1}'s evening: ${Math.round(n.within)} coins on its way through the night, ${Math.round(n.brk)} within a break`).toBeGreaterThanOrEqual(PACE.night.break.times * n.brk)
  }
  if (DEBTS.night) it.fails.each(mornings)(`the night before day %i pays its minutes of play: a listed debt, broken today (${DEBTS.night})`, night)
  else it.each(mornings)('the night before day %i pays its minutes of play', night)
})
