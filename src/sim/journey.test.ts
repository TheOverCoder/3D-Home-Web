// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest'
import { AWAY_MOST, lockOf, stepNow } from '../farm/state'
import { holes, journey, type Bound, type VisitNews } from './journey'
import { playVisits, visitStart, visitsOf, type Visit } from './sessions'
import { JOURNEY } from './targets'

// The journey a new farm's player makes (update-v1/JOURNEY.md), on the one session runner (./sessions.ts): the daily
// player's first week, at a real player's pace, on one roll of the dice. Each bound of JOURNEY (./targets.ts) the farm
// keeps today is held here. Each it breaks today is a listed debt, as 05-budget keeps its debts: the case is expected
// to fail and names the mission whose change pays it, so it can neither pass silently nor be forgotten. When that
// change lands the case fails, and its debt leaves the list. `SIM_JOURNEY=daily npm run sim` prints 30 days.

const DAYS = 7

/** The bounds today's farm breaks, and the mission that pays each (update-v1/JOURNEY.md §3 names the fix). */
const DEBTS: Partial<Record<Bound, string>> = {
  quiet: 'mission 01 pays it: nothing opens after level 13, reached on day 3 (its unlock rows from level 14, change 7)',
  burst: 'missions 04 and 02 pay it: gift boxes and goals come one on another (fixes 3 and 10)',
  pull: 'mission 01 pays it: every timer is short, so the farm is ripe within minutes of leaving (long crops, fix 1)',
}

/** Bounds a week cannot judge, with where they are measured and the mission that pays them. */
const LONGER: Partial<Record<Bound, string>> = {
  quietDays: 'needs days 8 to 30 (SIM_JOURNEY=daily npm run sim); mission 01 pays it: rows every 2 levels from 31 (fix 8)',
}

let week: VisitNews[] = []
let broken: ReturnType<typeof holes>
beforeAll(() => {
  week = journey({ profile: 'daily', days: DAYS })
  broken = holes(week)
})

describe('the session runner', () => {
  it('plays every visit of the schedule, each for its minutes', () => {
    expect(week.map((v) => `${v.day} ${v.label}`)).toEqual(visitsOf('daily', DAYS).map((v) => `${v.day} ${v.label}`))
    for (const v of week) expect(v.seconds, `${v.day} ${v.label}`).toBeGreaterThanOrEqual(v.minutes * 60)
  })

  it('passes the time away through the game’s own cameBack, counted to its most', () => {
    const seen: { visit: Visit; away: number | null; counted: number | null }[] = []
    const ended: number[] = []
    playVisits(
      { profile: 'light', days: 6 },
      { begin: (visit, back) => seen.push({ visit, away: back?.seconds ?? null, counted: back?.counted ?? null }), end: (visit, played) => ended.push(visitStart(visit) + played * 1000) },
    )
    expect(seen[0].away).toBeNull()
    for (let i = 1; i < seen.length; i++) {
      const away = (visitStart(seen[i].visit) - ended[i - 1]) / 1000
      expect(seen[i].away).toBeCloseTo(away, 6)
      expect(seen[i].counted).toBeCloseTo(Math.min(away, AWAY_MOST), 6)
    }
    // the light player rests on days 4 and 5: a time away of over two days
    expect(Math.max(...seen.map((s) => s.away ?? 0))).toBeGreaterThan(48 * 3600)
  })

  it('repeats a run on the same seed, and plays another on another', () => {
    const a = journey({ profile: 'daily', days: 2, seed: 3 })
    expect(journey({ profile: 'daily', days: 2, seed: 3 })).toEqual(a)
    expect(journey({ profile: 'daily', days: 2, seed: 4 })).not.toEqual(a)
  })

  it('leaves the farm’s switches as the tests have them', () => {
    const random = Math.random
    playVisits({ profile: 'daily', days: 1 })
    expect(Math.random).toBe(random)
    expect(stepNow()).toBeNull()
    expect(lockOf('crop:pumpkin')).toBeNull()
  })
})

describe('the journey of the first week', () => {
  it('tells what each visit brought: the first steps, levels and their unlocks, the daily gift', () => {
    const first = week[0]
    expect(first.back).toBeNull()
    expect(first.beats.some((b) => b.what === 'the first steps done')).toBe(true)
    expect(first.beats.some((b) => b.what.startsWith('level 2: '))).toBe(true)
    expect(week.filter((v) => v.beats.some((b) => b.source === 'daily gift')).map((v) => v.day)).toEqual([1, 2, 3, 4, 5, 6, 7])
    // the welcome back opens by itself on a return with something to tell
    expect(week.slice(1).some((v) => v.auto[0] === 'welcome back')).toBe(true)
  })

  for (const bound of Object.keys(JOURNEY) as Bound[]) {
    const longer = LONGER[bound]
    if (longer) {
      it.skip(`${bound}: a listed debt, not judged on a week (${longer})`, () => {})
      continue
    }
    const debt = DEBTS[bound]
    const check = () => {
      expect(broken[bound], `${bound} cannot be judged on this run`).not.toBeNull()
      expect(broken[bound]).toEqual([])
    }
    if (debt) it.fails(`${bound}: a listed debt, broken today (${debt})`, check)
    else it(`${bound}: kept`, check)
  }
})
