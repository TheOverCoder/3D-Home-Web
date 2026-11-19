import { describe, expect, it } from 'vitest'
import { BIRDS, CALM, callOf, toneOf, type Phase, type Sky } from './ambience'

// The open air by the time of day (./ambience.ts, BIRDS; mission 06 c10): a chorus of birds in the morning, as it always
// was by day, fewer in the evening with a first cricket, only crickets at night.

const PHASES: Phase[] = ['morning', 'noon', 'evening', 'night']
/** How often a call comes, on average (ms between two). */
const every = (p: Phase) => (BIRDS[p].gap[0] + BIRDS[p].gap[1]) / 2

/** What calls over many times at `p` under `sky`, by evenly spread dice: how many of each. */
function calls(p: Phase, sky: Sky = CALM) {
  const n: Record<string, number> = { song: 0, dove: 0, cricket: 0, none: 0 }
  for (let i = 0; i < 400; i++) {
    let k = 0
    const dice = [(((i * 0.6180339887) % 1) + 1) % 1, (((i * 0.7548776662) % 1) + 1) % 1]
    n[callOf(p, () => dice[k++ % 2], sky) ?? 'none']++
  }
  return n
}

describe('the birds by the time of day', () => {
  it('have a row for each phase', () => {
    expect(Object.keys(BIRDS).sort()).toEqual([...PHASES].sort())
  })

  it('call most in the morning, as they always did by day, less in the evening', () => {
    expect(every('morning')).toBeLessThan(every('noon'))
    expect(every('evening')).toBeGreaterThan(every('noon'))
    const birds = (p: Phase) => {
      const c = calls(p)
      return (c.song + c.dove) / every(p)
    }
    expect(birds('morning')).toBeGreaterThan(birds('noon'))
    expect(birds('noon')).toBeGreaterThan(birds('evening'))
    expect(BIRDS.noon).toMatchObject({ gap: [900, 3800], bird: 1, dove: 0.18 })
  })

  it('leave the night to the crickets, and the evening its first', () => {
    const night = calls('night')
    expect(night.song + night.dove).toBe(0)
    expect(night.cricket).toBeGreaterThan(0)
    expect(calls('evening').cricket).toBeGreaterThan(0)
    expect(calls('morning').cricket + calls('noon').cricket).toBe(0)
  })
})

describe('the weather heard (mission 10 c9)', () => {
  const winter: Sky = { rain: 0, wind: 0, winter: true }
  const rain: Sky = { rain: 1, wind: 0.4, winter: false }
  const birds = (p: Phase, sky?: Sky) => {
    const c = calls(p, sky)
    return c.song + c.dove
  }

  it('fewer birds in winter, fewer still in the rain, and no crickets in either', () => {
    expect(birds('noon', winter)).toBeLessThan(birds('noon') * 0.5)
    expect(birds('noon', rain)).toBeLessThan(birds('noon', winter))
    expect(birds('noon', rain)).toBeGreaterThan(0)
    expect(calls('evening', winter).cricket + calls('night', rain).cricket).toBe(0)
    // a clear day is as it always was
    expect(calls('noon', CALM)).toEqual(calls('noon'))
  })

  it('rain in the open air is bright and plain; under a roof soft and low; none when it is dry', () => {
    const open = toneOf('open', null, rain)
    const roof = toneOf('roof', 'living', rain)
    expect(open.rain).toBeGreaterThan(roof.rain * 2)
    expect(roof.rainCutoff).toBeLessThan(open.rainCutoff / 4)
    expect(toneOf('open', null, CALM).rain).toBe(0)
  })

  it('the wind lifts the open air, and is not heard indoors', () => {
    const windy: Sky = { rain: 0, wind: 1, winter: false }
    expect(toneOf('open', null, windy).level).toBeGreaterThan(toneOf('open', null, CALM).level * 2)
    expect(toneOf('open', null, windy).cutoff).toBeGreaterThan(toneOf('open', null, CALM).cutoff)
    expect(toneOf('roof', 'kitchen', windy)).toEqual(toneOf('roof', 'kitchen', CALM))
  })
})
