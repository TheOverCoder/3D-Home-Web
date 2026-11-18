// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeContext, type FakeParam } from './fakeAudio'
import { BUSES, MAIN_TOP, SCREEN_DUCK, busesNow, createMixer, curve, duck, duckOn, gainOf, hold, holdOn, setLevels, setLiveMixer, type Bus, type Mixer } from './mix'

// The mixer (./mix.ts) on the recording fake (./fakeAudio.ts): three buses, each with the player's volume on the
// perceptual curve under the main one, and steps back that let go on their own, the deepest winning.

const LEVELS = { on: true, main: 0.7, sfx: 0.5, amb: 0.8, music: 0.3 }
const param = (p: AudioParam) => p as unknown as FakeParam
/** What a node goes into. */
const into = (n: AudioNode) => (n as unknown as { to: unknown[] }).to[0]
/** A bus's step back at audio time t, as a gain. */
const ducked = (m: Mixer, bus: Bus, t: number) => param(m.ducker[bus].gain).at(t)

function mixer() {
  const ctx = new FakeContext()
  const m = createMixer(ctx.audio)
  return { ctx, m }
}

afterEach(() => setLiveMixer(null))

describe('the three volumes', () => {
  it('each bus at its slider’s square under the main one (a little under full at the top), nothing while sound is off', () => {
    const { m } = mixer()
    expect(param(m.master.gain).at(1)).toBe(0) // silent until the settings come
    setLevels(m, LEVELS)
    expect(param(m.master.gain).at(2)).toBeCloseTo(0.49 * MAIN_TOP, 6)
    for (const b of BUSES) expect(param(m.user[b].gain).at(2), b).toBeCloseTo(LEVELS[b] ** 2, 6)
    // every bus goes through its volume and its step back into the main volume
    for (const b of BUSES) {
      expect(into(m.input[b]), b).toBe(m.user[b])
      expect(into(m.user[b]), b).toBe(m.ducker[b])
      expect(into(m.ducker[b]), b).toBe(m.master)
    }
    setLevels(m, { ...LEVELS, on: false })
    expect(param(m.master.gain).at(4)).toBeCloseTo(0, 6)
  })

  it('keeps a slider between 0 and 1 (anything else full), and 100 % at 1 on the curve', () => {
    expect(curve(1)).toBe(1)
    expect(curve(0)).toBe(0)
    expect(curve(2)).toBe(1)
    expect(curve(-1)).toBe(0)
    expect(curve(Number.NaN)).toBe(1)
    const { m } = mixer()
    setLevels(m, { ...LEVELS, sfx: 3, amb: -2 })
    expect(param(m.user.sfx.gain).at(2)).toBeCloseTo(1, 6)
    expect(param(m.user.amb.gain).at(2)).toBeCloseTo(0, 6)
    expect(busesNow(m).sfx).toEqual({ volume: 1, gain: 1, duck: 0 })
  })
})

describe('a step back (duck)', () => {
  it('steps the bus back by its decibels, and lets it come again after its hold', () => {
    const { m } = mixer()
    duckOn(m, 'music', -6, 800, 0.01)
    expect(ducked(m, 'music', 0.5)).toBeCloseTo(gainOf(-6), 4)
    expect(ducked(m, 'music', 1.2)).toBeCloseTo(1, 4)
    // the others are not touched
    expect(ducked(m, 'sfx', 0.5)).toBe(1)
    expect(ducked(m, 'amb', 0.5)).toBe(1)
  })

  it('takes the deepest of several at once, each letting go at its own end', () => {
    const { m } = mixer()
    duckOn(m, 'amb', -6, 2000, 0.01)
    duckOn(m, 'amb', -12, 1000, 0.01)
    expect(ducked(m, 'amb', 0.5)).toBeCloseTo(gainOf(-12), 4)
    expect(ducked(m, 'amb', 1.5)).toBeCloseTo(gainOf(-6), 4)
    expect(ducked(m, 'amb', 2.5)).toBeCloseTo(1, 4)
    // a shallower one after a deeper changes nothing while the deeper holds
    const { m: n } = mixer()
    duckOn(n, 'sfx', -12, 2000, 0.01)
    duckOn(n, 'sfx', -3, 500, 0.01)
    expect(ducked(n, 'sfx', 0.4)).toBeCloseTo(gainOf(-12), 4)
    expect(ducked(n, 'sfx', 1)).toBeCloseTo(gainOf(-12), 4)
    expect(ducked(n, 'sfx', 2.5)).toBeCloseTo(1, 4)
  })

  it('steps all three back at once', () => {
    const { m } = mixer()
    duckOn(m, 'all', -6, 1000, 0.01)
    for (const b of BUSES) expect(ducked(m, b, 0.5), b).toBeCloseTo(gainOf(-6), 4)
  })

  it('is held under its key until the same key lets go; one letting go never lifts another’s', () => {
    const { ctx, m } = mixer()
    holdOn(m, 'screen', 'amb', SCREEN_DUCK, 0.01)
    holdOn(m, 'film', 'amb', -12, 0.01)
    expect(ducked(m, 'amb', 100)).toBeCloseTo(gainOf(-12), 4)
    ctx.currentTime = 100
    holdOn(m, 'film', 'amb', null, 0.01)
    expect(ducked(m, 'amb', 101)).toBeCloseTo(gainOf(SCREEN_DUCK), 4)
    expect(busesNow(m).amb.duck).toBe(SCREEN_DUCK)
    ctx.currentTime = 102
    holdOn(m, 'screen', 'amb', null, 0.01)
    expect(ducked(m, 'amb', 103)).toBeCloseTo(1, 4)
    expect(busesNow(m).amb.duck).toBe(0)
  })

  it('on the live mixer: nothing before it is made; a held one kept for it, and let go there', () => {
    expect(() => duck('all', -6, 500)).not.toThrow()
    hold('test', 'music', -9, 0.01)
    const { ctx, m } = mixer()
    setLiveMixer(m)
    expect(ducked(m, 'music', 1)).toBeCloseTo(gainOf(-9), 4)
    duck('sfx', -6, 500, 0.01)
    expect(ducked(m, 'sfx', 0.3)).toBeCloseTo(gainOf(-6), 4)
    ctx.currentTime = 2
    hold('test', 'music', null, 0.01)
    expect(ducked(m, 'music', 3)).toBeCloseTo(1, 4)
  })
})

describe('the live engine on the mixer', () => {
  it('follows the settings into the buses, reports them, and steps the room tone back for a screen and a film apart', async () => {
    vi.resetModules()
    Object.assign(window, { AudioContext: FakeContext })
    const { useSettings } = await import('../settings')
    const sound = await import('./sound')
    sound.setSoundPrefs({ ...useSettings.getState(), volume: 0.6, effectsVolume: 0.4, ambienceVolume: 0.9, musicVolume: 0.2 })
    expect(sound.audioStatus()).toBeNull() // nothing before the first gesture
    sound.unlockAudio()
    const status = sound.audioStatus()!
    expect(status.enabled).toBe(true)
    expect(status.volume).toBeCloseTo(0.6, 9)
    expect(status.buses.sfx).toEqual({ volume: 0.4, gain: 0.4 ** 2, duck: 0 })
    expect(status.buses.amb.volume).toBe(0.9)
    expect(status.buses.music.volume).toBe(0.2)
    // the music and the films' and the drive's sound have their ways in
    const g = sound.audioGraph()!
    expect(g.music).not.toBe(g.master)
    sound.duckAmbient(true)
    sound.duckAmbient(true, 'film')
    sound.duckAmbient(false)
    expect(sound.audioStatus()!.buses.amb.duck).toBe(SCREEN_DUCK) // the film still holds it
    sound.duckAmbient(false, 'film')
    expect(sound.audioStatus()!.buses.amb.duck).toBe(0)
  })
})
