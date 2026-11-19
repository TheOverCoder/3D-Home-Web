import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeEngine } from './engine'
import { FakeContext, notesOf, type PlayedNote } from './fakeAudio'
import { play, type FarmSound } from './farmSounds'
import { CLIMB_STEPS, KEY, climb, hz, note, offKey } from './palette'
import { SOUNDS } from './sounds'
import { TRACKS } from './music'

// The one key (./palette.ts): C major pentatonic. Every note of every sting that tells news or pays (the cues, the
// rewards, the coins, the "no"), as the recording fake hears it, lies within a cent of the key; a bell's overtone off
// the key is a colour under its note, never a note of its own (under a quarter as loud).

// (the rattle before a box opens is its lid's knocks alone: noise, with no note to clash: ./stings.test.ts)
const STINGS = (Object.keys(SOUNDS) as FarmSound[]).filter((k) => ['reward', 'cue', 'coins', 'no', 'landing'].includes(SOUNDS[k].family) && k !== 'rattle')

/** What a sting plays, on the fake (its dice fixed: only when it is played may change). */
function heard(kind: FarmSound): PlayedNote[] {
  const ctx = new FakeContext()
  play(makeEngine(ctx.audio), kind, { at: 1 })
  return notesOf(ctx)
}

afterEach(() => vi.restoreAllMocks())

describe('the key', () => {
  it('is C D E G A, from C in any octave: middle C, A4 at 440, the steps wrapping into the octaves around', () => {
    expect(KEY).toEqual([0, 2, 4, 7, 9])
    expect(note(0, 4)).toBeCloseTo(261.626, 3)
    expect(note(4, 4)).toBeCloseTo(440, 9)
    expect(note(5, 4)).toBeCloseTo(note(0, 5), 9)
    expect(note(-1, 4)).toBeCloseTo(hz(57), 9)
    for (let step = -10; step < 20; step++) expect(offKey(note(step, 5)), String(step)).toBeLessThan(1e-6)
    // a semitone off, a quarter tone off: told
    expect(offKey(hz(61))).toBeCloseTo(100, 6)
    expect(offKey(hz(64.5))).toBeCloseTo(50, 6)
  })

  it('lies in every one of the music’s scales, so no sting clashes with a track', () => {
    for (const track of TRACKS) {
      const scale = new Set(track.scale.map((n) => (((track.root + n) % 12) + 12) % 12))
      for (const k of KEY) expect(scale.has(k), track.name).toBe(true)
    }
  })
})

describe('every sting in the key', () => {
  it('has its notes within a cent of the key, an overtone off it under a quarter of its note', () => {
    expect(STINGS.length).toBeGreaterThanOrEqual(10)
    for (const kind of STINGS) {
      const notes = heard(kind)
      expect(notes.length, kind).toBeGreaterThan(0)
      for (const n of notes) {
        if (n.f1 !== null) expect(offKey(n.f1), `${kind} glides off the key`).toBeLessThanOrEqual(1)
        if (offKey(n.f) <= 1) continue
        // an overtone: a note of the key sounding with it, at least four times as loud
        const under = notes.filter((m) => Math.abs(m.t - n.t) < 0.01 && offKey(m.f) <= 1 && m.f < n.f)
        expect(under.length, `${kind}: ${n.f.toFixed(1)} Hz is off the key`).toBeGreaterThan(0)
        expect(n.gain, `${kind}: ${n.f.toFixed(1)} Hz is a note, not a colour`).toBeLessThan(Math.max(...under.map((m) => m.gain)) / 4)
      }
    }
  })

  it('climbs the crystals up the key a step each when they land close together, and holds the top', () => {
    let clock = 1e9
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const tinks: number[] = []
    for (let i = 0; i < 10; i++) {
      clock += 200
      tinks.push(heard('xp')[0].f)
    }
    for (const f of tinks) expect(offKey(f)).toBeLessThanOrEqual(1)
    expect(tinks[0]).toBeCloseTo(note(4, 6), 6)
    for (let i = 1; i < 8; i++) expect(tinks[i], String(i)).toBeCloseTo(note(4 + i, 6), 6)
    expect(tinks[8]).toBe(tinks[7])
    expect(tinks[9]).toBe(tinks[7])
    // a pause: from the bottom again
    clock += 1000
    expect(heard('xp')[0].f).toBeCloseTo(note(4, 6), 6)
  })
})

describe('a streak', () => {
  it('climbs a step each press within its gap, holds at the top, and starts again after a pause', () => {
    const steps: number[] = []
    for (let i = 0; i < CLIMB_STEPS + 3; i++) steps.push(climb('test-a', 1000, 5000 + i * 999))
    expect(CLIMB_STEPS).toBe(8)
    expect(steps).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 7, 7, 7])
    // a gap of its own length or more: from the bottom
    expect(climb('test-a', 1000, 5000 + 10 * 999 + 1000)).toBe(0)
    expect(climb('test-a', 1000, 5000 + 10 * 999 + 1500)).toBe(1)
  })

  it('climbs each streak on its own', () => {
    expect(climb('test-b', 450, 0)).toBe(0)
    expect(climb('test-c', 450, 10)).toBe(0)
    expect(climb('test-b', 450, 200)).toBe(1)
    expect(climb('test-b', 450, 400)).toBe(2)
    expect(climb('test-c', 450, 420)).toBe(1)
    // one streak's pause leaves the other where it is
    expect(climb('test-b', 450, 2000)).toBe(0)
    expect(climb('test-c', 450, 600)).toBe(2)
  })
})
