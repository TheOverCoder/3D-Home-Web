// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { eventTime } from '../farm/state'
import { playVisits, visitStart, visitsOf } from './sessions'

// The session runner's own rules beyond the journey's (./journey.test.ts holds the schedule, the time away through
// cameBack, the seed and the switches put back): the weekday a run starts on, and the week's events when told.

describe('the session runner', () => {
  it('starts on the weekday it is told (a Monday unless told)', () => {
    const first = visitsOf('daily', 1)[0]
    const day = (weekday?: 1 | 3 | 7) => new Date(visitStart(first, weekday)).getDay()
    // (Date's days: Sunday 0, Monday 1)
    expect([day(), day(1), day(3), day(7)]).toEqual([1, 1, 3, 0])
  })

  it('judges the week’s events by the visits’ own clock when told, and leaves them off as the tests have them', () => {
    const seen: (number | null)[] = []
    playVisits({ profile: 'daily', days: 1, weekday: 3, events: true }, { begin: () => seen.push(eventTime()), end: () => seen.push(eventTime()) })
    const visits = visitsOf('daily', 1)
    expect(seen[0]).toBe(visitStart(visits[0], 3))
    expect(seen[1]).toBeGreaterThanOrEqual(visitStart(visits[0], 3) + visits[0].minutes * 60_000)
    expect(eventTime()).toBeNull()
    seen.length = 0
    playVisits({ profile: 'daily', days: 1 }, { begin: () => seen.push(eventTime()) })
    expect(seen.every((t) => t === null)).toBe(true)
  })
})
