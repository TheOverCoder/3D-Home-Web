// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { playVisits } from '../../sim/sessions'
import { PACE } from '../../sim/targets'
import { levelOf } from '../xp'
import { farm, quietNeighbours, stepsBusy } from '../state'
import { CHAPTERS, chapterById, type ChapterId } from './chapters'
import { heartsOf } from './friends'

// The story's pace on the session runner (src/sim/sessions.ts: the daily player's visits, the farm's own `tick` and
// `cameBack`, the sim's player at a real player's pace), with the neighbours on as in play: the first neighbour is met by
// level 5, in the visit after the first steps end (update-v1/JOURNEY.md fix 3); one chapter begins a visit at most, no
// sooner than its level, and in the first visit its level and the story allow (fix 6); their first heart comes soon
// after, and act 1's first chapters are sent within days of beginning (PACE.story). A few seconds.

afterEach(() => quietNeighbours(true))

interface Seen {
  day: number
  /** the visit's number, from 0 */
  visit: number
  level: number
  /** minutes of play so far (every visit's, to this moment) */
  minutes: number
}

/** Plays the daily player's first `days` days with the neighbours on: when each chapter began and was sent, when the
 *  first steps ended, when the first heart came, and each visit's beginning. */
function story(days: number, seed: number) {
  quietNeighbours(false)
  const begun = new Map<ChapterId, Seen>()
  const sent = new Map<ChapterId, Seen>()
  const visits: Seen[] = []
  const at: { steps: Seen | null; heart: Seen | null } = { steps: null, heart: null }
  let played = 0
  let visit = -1
  let day = 0
  const look = (t: number) => {
    const now: Seen = { day, visit, level: levelOf(farm.xp.points), minutes: (played + t) / 60 }
    const s = farm.story
    for (const id of [...s.done, ...(s.on ? [s.on] : [])]) if (!begun.has(id)) begun.set(id, now)
    for (const id of [...s.done, ...(s.on && s.sent ? [s.on] : [])]) if (!sent.has(id)) sent.set(id, now)
    if (!at.steps && !stepsBusy()) at.steps = now
    if (!at.heart && Object.values(farm.friends).some((f) => !!f && heartsOf(f.points) > 0)) at.heart = now
  }
  playVisits(
    { profile: 'daily', days, seed },
    {
      begin: (v) => {
        visit++
        day = v.day
        visits.push({ day, visit, level: levelOf(farm.xp.points), minutes: played / 60 })
        look(0)
      },
      moved: (_, __, t) => look(t),
      end: (_, t) => {
        look(t)
        played += t
      },
    },
  )
  return { begun, sent, visits, ...at }
}

describe("the story's pace, on the daily player's visits", () => {
  for (const seed of [1, 2])
    it(`seed ${seed}: the first neighbour by level 5, the visit after the first steps end; a chapter a visit, as soon as its level allows`, () => {
      const r = story(8, seed)
      const first = r.begun.get(CHAPTERS[0].id)
      expect(r.steps, 'the first steps end').not.toBeNull()
      expect(first, 'the first chapter').toBeDefined()
      expect(first!.level).toBeGreaterThanOrEqual(PACE.story.met)
      expect(first!.visit, 'the visit after the steps end').toBe(r.steps!.visit + 1)
      // in the table's order; never two in one visit, never before its level; each in the first visit that may have it
      // (its level reached, the chapter before it sent in a visit before)
      const order = [...r.begun.entries()]
      expect(order.map(([id]) => id)).toEqual(CHAPTERS.slice(0, order.length).map((c) => c.id))
      for (let k = 1; k < order.length; k++) {
        const [id, b] = order[k]
        const before = r.sent.get(order[k - 1][0])!
        expect(b.level, id).toBeGreaterThanOrEqual(chapterById(id).level)
        expect(b.visit, `${id} after ${order[k - 1][0]}`).toBeGreaterThan(order[k - 1][1].visit)
        // (the chapter before it finished a frame after it was sent, in that visit; the level may come within a visit:
        // then that visit, or the next)
        const may = r.visits.find((v) => v.visit >= Math.max(order[k - 1][1].visit + 1, before.visit) && v.level >= chapterById(id).level)
        expect(b.visit, `${id} as soon as it may`).toBeLessThanOrEqual((may?.visit ?? Infinity) + 1)
      }
    })

  it("the first heart comes soon after meeting; act 1's first chapters are sent within days of beginning", () => {
    const r = story(8, 1)
    const met = r.begun.get(CHAPTERS[0].id)!
    expect(r.heart, 'a first heart').not.toBeNull()
    expect(r.heart!.minutes - met.minutes, 'minutes of play from meeting to the first heart').toBeLessThanOrEqual(PACE.story.heart)
    for (const c of CHAPTERS.slice(0, PACE.story.sent.chapters)) {
      const b = r.begun.get(c.id)
      const s = r.sent.get(c.id)
      expect(b && s, `${c.id} begun and sent`).toBeTruthy()
      expect(s!.day - b!.day, `${c.id}: days of play to send it`).toBeLessThanOrEqual(PACE.story.sent.days)
    }
  })
})
