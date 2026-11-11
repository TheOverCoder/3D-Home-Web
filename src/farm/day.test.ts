import { describe, expect, it } from 'vitest'
import { DAY, HOURS, type DayPhase } from './data'
import { dayOf, hourOf, isOpen, moodAt, phaseDef, phaseOf, untilPhase } from './day'

// The farm's day (src/farm/day.ts): the hour from the seconds since the farm began, the phases and their edges, the
// day's number (a new day at the morning, not at midnight), the seconds to a phase, the light (never darker than
// DAY.minLight, blended over each phase's first half hour), and who keeps hours. Pure.

const HOUR = DAY.length / 24
const PHASES = DAY.phases.map((p) => p.id)
const DAYS = [0, 1, 7, 365, 10000]

/** The first second at `hour` on or after the farm's start, `k` days on. */
const at = (hour: number, k = 0) => ((((hour - DAY.start) % 24) + 24) % 24) * HOUR + k * DAY.length

/** Each phase with its first second and the second its next phase begins, `k` days on. */
function edges(k: number) {
  return DAY.phases.map((p, i) => {
    const next = DAY.phases[(i + 1) % DAY.phases.length]
    const prev = DAY.phases[(i + DAY.phases.length - 1) % DAY.phases.length]
    const start = at(p.from, k)
    return { id: p.id, prev: prev.id, next: next.id, start, end: start + ((((next.from - p.from) % 24) + 24) % 24) * HOUR }
  })
}

describe('the hour', () => {
  it('a new farm starts at DAY.start; a farm hour is DAY.length / 24 seconds; always 0 to 24', () => {
    expect(hourOf(0)).toBe(DAY.start)
    expect(hourOf(HOUR)).toBe(DAY.start + 1)
    expect(hourOf(DAY.length)).toBe(DAY.start)
    expect(hourOf(at(0))).toBe(0)
    for (const t of [-1e6, -1, 0, 0.5, 799.99, 1e7, 1e12]) {
      const h = hourOf(t)
      expect(h >= 0 && h < 24, `${t}: ${h}`).toBe(true)
    }
    expect(hourOf(NaN)).toBe(DAY.start)
    expect(hourOf(Infinity)).toBe(DAY.start)
  })
})

describe('the phases', () => {
  it('morning, noon, evening and night, in order, each from its hour', () => {
    expect(PHASES).toEqual(['morning', 'noon', 'evening', 'night'])
    expect(phaseOf(0)).toBe('morning')
    for (const p of DAY.phases) expect(phaseDef(p.id)).toBe(p)
  })

  it('each phase holds from its first second to its last, on the first day and every day after (night past midnight)', () => {
    for (const k of DAYS)
      for (const e of edges(k)) {
        const say = `${e.id}, day ${k}`
        expect(phaseOf(e.start), `${say}: first second`).toBe(e.id)
        expect(phaseOf(e.start + 1), say).toBe(e.id)
        expect(phaseOf((e.start + e.end) / 2), say).toBe(e.id)
        expect(phaseOf(e.end - 1), `${say}: last second`).toBe(e.id)
        expect(phaseOf(e.end - 0.01), `${say}: its last moment`).toBe(e.id)
        expect(phaseOf(e.end), `${say}: the next begins`).toBe(e.next)
        if (e.start > 0) expect(phaseOf(e.start - 0.01), `${say}: just before`).toBe(e.prev)
      }
    // the night runs past midnight into the small hours
    expect(phaseOf(at(23.5))).toBe('night')
    expect(phaseOf(at(0))).toBe('night')
    expect(phaseOf(at(4.9))).toBe('night')
  })
})

describe("the day's number", () => {
  it('a new farm is on day 0; a new day begins at the morning, not at midnight', () => {
    expect(dayOf(0)).toBe(0)
    for (const k of DAYS) {
      const midnight = at(0, k)
      expect(dayOf(midnight - 1), `day ${k}: before midnight`).toBe(k)
      expect(dayOf(midnight), `day ${k}: midnight`).toBe(k)
      expect(dayOf(midnight + 1), `day ${k}: after midnight`).toBe(k)
      const morning = at(DAY.phases[0].from, k)
      expect(dayOf(morning - 0.01), `day ${k}: the night's last moment`).toBe(k)
      expect(dayOf(morning), `day ${k}: the morning`).toBe(k + 1)
    }
  })

  it('goes up by one exactly where the night turns to morning, and nowhere else', () => {
    let day = dayOf(0)
    let phase = phaseOf(0)
    for (let t = 0.25; t < 5 * DAY.length; t += 0.25) {
      const d = dayOf(t)
      const p = phaseOf(t)
      expect(d, `t ${t}`).toBe(phase === 'night' && p === 'morning' ? day + 1 : day)
      day = d
      phase = p
    }
    expect(day).toBe(5)
  })
})

describe('the seconds to a phase', () => {
  it('from a new farm: noon in 3 hours, the morning the next day; a phase beginning now is 0', () => {
    expect(untilPhase(0, 'noon')).toBe(3 * HOUR)
    expect(untilPhase(0, 'night')).toBe(13 * HOUR)
    expect(untilPhase(0, 'morning')).toBe(21 * HOUR)
    for (const k of DAYS) for (const e of edges(k)) expect(untilPhase(e.start, e.id), `${e.id}, day ${k}`).toBe(0)
  })

  it('lands on the phase’s first moment, within a day, with no earlier start between', () => {
    for (let t = 0; t < 2 * DAY.length; t += 7.3)
      for (const id of PHASES) {
        const u = untilPhase(t, id)
        expect(u >= 0 && u < DAY.length, `${id} from ${t}: ${u}`).toBe(true)
        const d = (((hourOf(t + u) - phaseDef(id).from) % 24) + 24) % 24
        expect(Math.min(d, 24 - d), `${id} from ${t}`).toBeLessThan(1e-6)
        if (u > 0.05) expect(phaseOf(t + u - 0.02), `${id} from ${t}: not begun yet`).not.toBe(id)
      }
  })
})

describe('the light', () => {
  const keys = ['sun', 'warm', 'sky'] as const

  it('is never darker than DAY.minLight, at any moment, whatever the time given', () => {
    for (let t = -600; t < 2 * DAY.length; t += 0.5) {
      const m = moodAt(t)
      expect(m.sun >= DAY.minLight && m.sky >= DAY.minLight, `t ${t}: ${JSON.stringify(m)}`).toBe(true)
      expect(keys.every((key) => Number.isFinite(m[key]))).toBe(true)
    }
    for (const t of [NaN, Infinity, -Infinity, 1e12]) {
      const m = moodAt(t)
      expect(m.sun >= DAY.minLight && m.sky >= DAY.minLight && Number.isFinite(m.warm), String(t)).toBe(true)
    }
  })

  it("is each phase's own after its first half hour, and blends in from the one before over that half hour", () => {
    for (const e of edges(1)) {
      const own = phaseDef(e.id).mood
      const before = phaseDef(e.prev).mood
      expect(moodAt(e.start), `${e.id} begins as the ${e.prev}`).toEqual(before)
      expect(moodAt(e.start + HOUR / 2), `${e.id} after half an hour`).toEqual(own)
      expect(moodAt((e.start + e.end) / 2)).toEqual(own)
      const half = moodAt(e.start + HOUR / 4)
      for (const key of keys) expect(half[key], `${e.id} a quarter hour in: ${key}`).toBeCloseTo((own[key] + before[key]) / 2, 9)
    }
  })

  it('never jumps: half a second changes it by little', () => {
    let last = moodAt(0)
    for (let t = 0.5; t < 2 * DAY.length; t += 0.5) {
      const m = moodAt(t)
      for (const key of keys) expect(Math.abs(m[key] - last[key]), `t ${t}: ${key}`).toBeLessThan(0.05)
      last = m
    }
  })
})

describe('who keeps hours', () => {
  it('the contractor is there in the morning, at noon and in the evening, never at night', () => {
    expect(HOURS.contractor).toEqual(['morning', 'noon', 'evening'])
    for (const k of DAYS)
      for (const e of edges(k)) {
        const there = e.id !== 'night'
        for (const t of [e.start, (e.start + e.end) / 2, e.end - 0.01]) expect(isOpen('contractor', t), `${e.id} at ${t}`).toBe(there)
      }
    for (let t = 0; t < 2 * DAY.length; t += 3.7) expect(isOpen('contractor', t)).toBe((HOURS.contractor as readonly DayPhase[]).includes(phaseOf(t)))
  })
})
