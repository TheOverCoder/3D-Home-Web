import { describe, expect, it } from 'vitest'
import { frameDue, loopFor } from './frameRate'

// The frame rate's pacing (./frameRate.ts): 60 draws every frame of the screen; 30 asks for every other one.

describe('the frame rate', () => {
  it('60 runs the loop always, 30 on demand', () => {
    expect(loopFor(60)).toBe('always')
    expect(loopFor(30)).toBe('demand')
  })
  it('at 30 on a 60 Hz screen, every other frame is due (a few ms early counts)', () => {
    const frames = Array.from({ length: 13 }, (_, k) => k * (1000 / 60))
    let last = -1000
    const drawn: number[] = []
    for (const t of frames)
      if (frameDue(t, last, 30)) {
        drawn.push(t)
        last = t
      }
    expect(drawn.length).toBe(7)
    for (let k = 1; k < drawn.length; k++) expect(drawn[k] - drawn[k - 1]).toBeCloseTo(1000 / 30, 6)
  })
  it('at 30 on a 120 Hz screen, every fourth', () => {
    const frames = Array.from({ length: 25 }, (_, k) => k * (1000 / 120))
    let last = -1000
    let n = 0
    for (const t of frames)
      if (frameDue(t, last, 30)) {
        n++
        last = t
      }
    expect(n).toBe(7)
  })
})
