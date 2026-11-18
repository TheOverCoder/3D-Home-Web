import { describe, expect, it } from 'vitest'
import { MIX_TARGETS, MIX_WITHIN, PEAK_MOST, PHONE_BAND, PHONE_SHARE, bandShare, measureSamples, mixFaults } from './measure'
import { PLAYER_SOUNDS, SOUNDS } from './sounds'

// The phone mix's measure (./measure.ts) on signals made here (Node has no Web Audio: the sounds themselves are rendered
// and held to it in a browser, by 03-settings). Its spectrum, peak and loudness read known signals right, and it says
// what is wrong in words.

const RATE = 48_000

/** `seconds` of sines (Hz, amplitude) added together, 48 kHz. */
function sines(seconds: number, ...parts: [number, number][]) {
  const x = new Float32Array(Math.round(seconds * RATE))
  for (let i = 0; i < x.length; i++) for (const [f, a] of parts) x[i] += a * Math.sin((2 * Math.PI * f * i) / RATE)
  return x
}

describe('the phone mix’s measure', () => {
  it('finds a sound’s energy where it is: on a phone’s speaker (0.5–4 kHz) or under or over it', () => {
    expect(PHONE_BAND).toEqual([500, 4000])
    expect(bandShare(sines(0.5, [1000, 0.5]), RATE, 500, 4000)).toBeGreaterThan(0.99)
    expect(bandShare(sines(0.5, [120, 0.5]), RATE, 500, 4000)).toBeLessThan(0.01)
    expect(bandShare(sines(0.5, [8000, 0.5]), RATE, 500, 4000)).toBeLessThan(0.01)
    // a low thump with its knock at the same strength: half
    expect(bandShare(sines(0.5, [120, 0.5], [1000, 0.5]), RATE, 500, 4000)).toBeCloseTo(0.5, 1)
  })

  it('reads a peak in dBFS, a loudness in LUFS (a full-scale 1 kHz sine is −3.01) and how long a sound sounds', () => {
    const m = measureSamples(sines(1, [1000, 1]))
    expect(m.peak).toBeCloseTo(0, 2)
    expect(m.loud).toBeCloseTo(-3.01, 1)
    expect(m.seconds).toBeCloseTo(1, 2)
    // half as loud: 6 dB down, both
    const h = measureSamples(sines(1, [1000, 0.5]))
    expect(h.peak).toBeCloseTo(-6.02, 1)
    expect(h.loud).toBeCloseTo(-9.03, 1)
    // the K-weighting hears a low hum quieter than its peak says, a high one louder
    expect(measureSamples(sines(1, [60, 1])).loud).toBeLessThan(-4)
    expect(measureSamples(sines(1, [3000, 1])).loud).toBeGreaterThan(-1)
  })

  it('takes a short sound’s loudness from its loudest fifth of a second, its silence after it not counted', () => {
    const blip = new Float32Array(RATE * 2)
    blip.set(sines(0.2, [1000, 1]), RATE / 2)
    expect(measureSamples(blip).loud).toBeCloseTo(-3.01, 0)
    expect(measureSamples(blip).seconds).toBeCloseTo(0.2, 2)
    expect(measureSamples(new Float32Array(100))).toMatchObject({ seconds: 0 })
  })

  it('says what is wrong in words: too little on a phone, a peak too high, too far from its family', () => {
    const target = MIX_TARGETS.work
    expect(mixFaults('work', { peak: -12, loud: target, band: 0.6 })).toEqual([])
    expect(mixFaults('work', { peak: -12, loud: target + MIX_WITHIN, band: PHONE_SHARE })).toEqual([])
    const all = mixFaults('work', { peak: PEAK_MOST + 0.5, loud: target - MIX_WITHIN - 1, band: 0.2 })
    expect(all).toEqual(['only 20 % in 500–4000 Hz', 'peaks at -0.5 dBFS', `-${MIX_WITHIN + 1}.0 dB off its family's ${target} LUFS`])
  })

  it('holds every sound the player causes, and no one else’s: not the farm’s news nor what it does by itself', () => {
    const theirs = 'plant harvest pick sack crate shelf build coins pay decline nope level keys surprise xp dress lift thud cluck oven'
    for (const k of theirs.split(' ')) expect(PLAYER_SOUNDS, k).toContain(k)
    for (const k of ['moo', 'baa', 'crow', 'chug', 'bell', 'ding', 'chime'] as const) expect(PLAYER_SOUNDS, k).not.toContain(k)
    // every family a player sound is in has its loudness
    for (const k of PLAYER_SOUNDS) expect(MIX_TARGETS[SOUNDS[k].family], k).toBeTypeOf('number')
  })
})
