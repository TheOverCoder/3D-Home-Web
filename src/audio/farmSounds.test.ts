// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { FakeContext, notesOf } from './fakeAudio'
import { CLIMB_STEPS, WORK_GAP, offKey } from './palette'

// Streaks that climb (mission 06 c6), as the game plays them (`farmSound`, on the live engine: here the recording fake as
// the browser's audio). A press of work carries a soft pip of the key that climbs a step each quick press and holds at
// the top; one press over many beds sounds once a bed, 60 ms apart, climbing as it goes; the farm's own sounds (no
// touch) never climb.

type Sound = typeof import('./sound')
let sound: Sound
let pipNote: (step: number) => number
let ctx: FakeContext
let clock = 1e9

beforeAll(async () => {
  vi.resetModules()
  Object.assign(window, { AudioContext: FakeContext })
  const { useSettings } = await import('../settings')
  sound = await import('./sound')
  pipNote = (await import('./farmSounds')).pipNote
  sound.setSoundPrefs({ ...useSettings.getState(), sound: true })
  sound.unlockAudio()
  ctx = sound.audioGraph()!.ac as unknown as FakeContext
})

afterEach(() => vi.restoreAllMocks())

/** What one call of farmSound writes, at `clock` (ms, the streaks' clock), its pitch and loudness held: its pips, each
 *  its frequency and how long after the call it starts. */
function pressed(...args: Parameters<Sound['farmSound']>) {
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const from = ctx.nodes.length
  ctx.currentTime += 10
  const t0 = ctx.currentTime
  sound.farmSound(...args)
  vi.restoreAllMocks()
  // a pip is a note of the key with its octave at the same moment, at 2/7 of its loudness (the sounds' own notes lie off
  // the key, or are not so paired)
  const notes = notesOf(ctx, from).filter((n) => offKey(n.f) <= 1)
  const paired = (n: (typeof notes)[number]) => notes.some((m) => m.t === n.t && Math.abs(m.f / n.f - 2) < 1e-9 && Math.abs(m.gain / n.gain - 2 / 7) < 1e-6)
  return notes.filter(paired).map((n) => ({ f: n.f, after: n.t - t0 }))
}

/** The pip `step` steps up the streak. */
const pip = (step: number) => pipNote(step)

describe('a streak of work', () => {
  it('climbs a step each press that comes within 2.5 s, holds at the top, and starts again after a pause', () => {
    clock += 60_000
    const steps: number[] = []
    for (let i = 0; i < CLIMB_STEPS + 3; i++) {
      clock += 900
      const [p] = pressed('harvest')
      steps.push(p.f)
    }
    for (let i = 0; i < CLIMB_STEPS; i++) expect(steps[i], String(i)).toBeCloseTo(pip(i), 6)
    for (let i = CLIMB_STEPS; i < steps.length; i++) expect(steps[i], String(i)).toBeCloseTo(pip(CLIMB_STEPS - 1), 6)
    clock += WORK_GAP + 1
    expect(pressed('plant')[0].f).toBeCloseTo(pip(0), 6)
    // another kind of work goes on up the same streak
    clock += 300
    expect(pressed('pick')[0].f).toBeCloseTo(pip(1), 6)
  })

  it('sounds once a bed for a press over many (six at most, 60 ms apart), each a step higher', () => {
    clock += 60_000
    const pips = pressed('water', 0, 1, undefined, { times: 9 })
    expect(pips).toHaveLength(6)
    pips.forEach((p, i) => {
      expect(p.f, String(i)).toBeCloseTo(pip(i), 6)
      expect(p.after, String(i)).toBeCloseTo(0.004 + i * 0.06 + 0.02, 6)
    })
    // and the next press goes on from there
    clock += 500
    expect(pressed('harvest', 0, 1, undefined, { times: 2 }).map((p) => p.f)).toEqual([pip(6), pip(7)])
  })

  it('leaves the farm’s own sounds out: a hen heard, a machine at work; the same sound pressed climbs', () => {
    clock += 60_000
    expect(pressed('cluck')).toEqual([])
    expect(pressed('creak', 0, 1)).toEqual([])
    expect(pressed('cluck', 0, 1, 'tick')[0].f).toBeCloseTo(pip(0), 6)
    expect(pressed('oven', 0, 1, 'tick')[0].f).toBeCloseTo(pip(1), 6)
    // and what is not work never: coins, a "no", a cue
    expect(pressed('coins')).toEqual([])
    expect(pressed('nope')).toEqual([])
    expect(pressed('ding')).toEqual([])
  })
})
