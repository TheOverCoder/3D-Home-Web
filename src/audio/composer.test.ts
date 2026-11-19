import { describe, expect, it } from 'vitest'
import { MUSIC_LAYERS, SWITCH_EIGHTHS, TRACK_DEFS, VOICES, createBand, layerOf, newScore, scheduleUntil, setHeard, setLayer, type Band, type Layer } from './composer'
import { FakeContext, type FakeOscillator, type FakeParam } from './fakeAudio'
import { OPEN_AIR, TRACKS } from './music'
import { hz } from './palette'

// The music as it is composed (./composer.ts), on the recording fake: each voice on a gain of its own that follows where
// the music is heard (by day all of it, at night no shaker and no bells and a softer pad, indoors only the pad and the
// pluck, darker), every change a glide, never a cut; a track changed on its two-bar boundary with no gap; and silent
// while it is off.

const param = (p: AudioParam) => p as unknown as FakeParam

function band(layer: Layer = 'day') {
  const ctx = new FakeContext()
  return { ctx, b: createBand(ctx.audio, ctx.destination as unknown as AudioNode, layer) }
}

/** The oscillators that play into one of the band's voices (through their filter and envelope). */
function voiceNotes(ctx: FakeContext, b: Band, v: (typeof VOICES)[number]): FakeOscillator[] {
  const into = (n: unknown) => (n as { to: unknown[] }).to[0]
  return ctx.oscillators().filter((o) => into(into(into(o))) === b.voices[v])
}

describe('the layers', () => {
  it('play all of it by day; drop the shaker and the bells at night and soften the pad; indoors only the pad and the pluck, darker', () => {
    const { day, evening, night, indoors } = MUSIC_LAYERS
    for (const v of VOICES) expect(day[v], v).toBe(1)
    expect([night.shaker, night.bells]).toEqual([0, 0])
    expect(night.pad).toBeLessThan(day.pad)
    expect([indoors.bass, indoors.bells, indoors.shaker]).toEqual([0, 0, 0])
    expect(indoors.pad).toBeGreaterThan(0)
    expect(indoors.pluck).toBeGreaterThan(0)
    expect(indoors.bright).toBeLessThan(day.bright)
    // the evening between the day and the night
    for (const v of VOICES) {
      expect(evening[v], v).toBeLessThanOrEqual(day[v])
      expect(evening[v], v).toBeGreaterThanOrEqual(night[v])
    }
  })

  it('follow where the music is heard: indoors whatever the hour, else the time of day', () => {
    expect(layerOf(OPEN_AIR)).toBe('day')
    expect(layerOf({ ...OPEN_AIR, phase: 'noon' })).toBe('day')
    expect(layerOf({ ...OPEN_AIR, phase: 'evening' })).toBe('evening')
    expect(layerOf({ ...OPEN_AIR, phase: 'night' })).toBe('night')
    expect(layerOf({ ...OPEN_AIR, phase: 'night', indoors: true })).toBe('indoors')
  })

  it('glide from one to the next, every voice and the brightness: never a cut', () => {
    const { ctx, b } = band('day')
    ctx.currentTime = 10
    setLayer(b, 'night')
    for (const v of VOICES) {
      const p = param(b.voices[v].gain)
      expect(
        p.events.map((e) => e.kind),
        v,
      ).toEqual(['target'])
      // a moment later it is on its way, not there yet; a few seconds later, there
      if (MUSIC_LAYERS.day[v] !== MUSIC_LAYERS.night[v]) {
        const mid = p.at(10.3)
        expect(mid, v).toBeLessThan(Math.max(MUSIC_LAYERS.day[v], MUSIC_LAYERS.night[v]))
        expect(mid, v).toBeGreaterThan(Math.min(MUSIC_LAYERS.day[v], MUSIC_LAYERS.night[v]))
      }
      expect(p.at(20), v).toBeCloseTo(MUSIC_LAYERS.night[v], 3)
    }
    expect(param(b.tone.frequency).at(20)).toBeCloseTo(MUSIC_LAYERS.night.bright, 0)
  })

  it('put each voice into its own gain: at night the bells and the shaker play into silence', () => {
    const { ctx, b } = band('night')
    const s = newScore(2, 0.1) // Market day: its shaker on every other eighth
    scheduleUntil(b, s, 8)
    expect(voiceNotes(ctx, b, 'pad').length).toBeGreaterThan(0)
    expect(voiceNotes(ctx, b, 'bass').length).toBeGreaterThan(0)
    expect(ctx.nodes.filter((n) => n.kind === 'source').every((n) => (n as unknown as { to: unknown[] }).to.length)).toBe(true)
    expect(param(b.voices.shaker.gain).value).toBe(0)
    expect(param(b.voices.bells.gain).value).toBe(0)
  })
})

describe('the track', () => {
  it('lists the same four in the shell and here, each in a key the rewards’ key lies in', () => {
    expect(TRACK_DEFS.map((t) => t.name)).toEqual(TRACKS.map((t) => t.name))
  })

  it('changes on its next two-bar boundary, the new one’s first step just where the old one’s next would be: no gap', () => {
    const { ctx, b } = band()
    const s = newScore(0, 0.1)
    const eighth0 = 30 / TRACK_DEFS[0].bpm
    expect(scheduleUntil(b, s, 3)).toBeNull()
    expect(s.step).toBeLessThan(SWITCH_EIGHTHS)
    s.pending = 1
    // not before the boundary
    expect(scheduleUntil(b, s, 0.1 + (SWITCH_EIGHTHS - 1) * eighth0)).toBeNull()
    expect(s.track).toBe(0)
    expect(scheduleUntil(b, s, 12)).toBe(1)
    expect(s.track).toBe(1)
    // the pads: the old track's at its start, the new one's on the boundary, on its own chord
    const pads = voiceNotes(ctx, b, 'pad')
    const starts = [...new Set(pads.map((o) => o.starts[0]))]
    expect(starts[0]).toBeCloseTo(0.1, 9)
    expect(starts[1]).toBeCloseTo(0.1 + SWITCH_EIGHTHS * eighth0, 9)
    const second = pads.filter((o) => Math.abs(o.starts[0] - starts[1]) < 1e-9).map((o) => o.frequency.value)
    const def = TRACK_DEFS[1]
    expect(new Set(second)).toEqual(new Set(def.chords[0].map((n) => hz(def.root + n))))
    // and on from there at its own pace
    const eighth1 = 30 / def.bpm
    expect(s.next).toBeCloseTo(starts[1] + s.step * eighth1, 9)
  })

  it('stays as it is when the change asked for is to itself', () => {
    const { b } = band()
    const s = newScore(3, 0.1)
    s.pending = 3
    expect(scheduleUntil(b, s, 20)).toBeNull()
    expect([s.track, s.pending]).toEqual([3, null])
  })
})

describe('off', () => {
  it('is silent: the band’s level glides to nothing, and comes back when it plays', () => {
    const { ctx, b } = band()
    expect(param(b.level.gain).value).toBe(0)
    ctx.currentTime = 1
    setHeard(b, true)
    expect(param(b.level.gain).at(10)).toBeGreaterThan(0.5)
    ctx.currentTime = 10
    setHeard(b, false)
    expect(param(b.level.gain).at(20)).toBeCloseTo(0, 6)
  })
})
