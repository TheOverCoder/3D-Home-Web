// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeContext } from './fakeAudio'
import { AUTO_TRACKS, OPEN_AIR, autoTrack, wantedTrack, type MusicMood } from './music'

// The music that follows the farm (mission 06 c10, c11; decision 16): on Auto, the track the time of day and the place
// ask for; a track picked stays; where the music is heard steps it back with a panel open and turns its layers; and
// off, it stays silent. On the game's own engine and mixer (here the recording fake as the browser's audio).

describe('Auto', () => {
  it('plays Morning on the farm in the morning, Slow afternoon at noon, Evening lights in the evening and at night, Market day at the market', () => {
    expect(AUTO_TRACKS).toEqual({ morning: 0, noon: 1, evening: 3, night: 3, market: 2 })
    expect(autoTrack(OPEN_AIR)).toBe(0)
    expect(autoTrack({ ...OPEN_AIR, phase: 'noon' })).toBe(1)
    expect(autoTrack({ ...OPEN_AIR, phase: 'evening' })).toBe(3)
    expect(autoTrack({ ...OPEN_AIR, phase: 'night', indoors: true })).toBe(3)
    expect(autoTrack({ ...OPEN_AIR, phase: 'night', market: true })).toBe(2)
  })

  it('a track picked stays whatever the hour and the place', () => {
    const night: MusicMood = { phase: 'night', indoors: true, panel: true, market: true }
    for (const pick of [0, 1, 2, 3]) {
      expect(wantedTrack(pick, OPEN_AIR)).toBe(pick)
      expect(wantedTrack(pick, night)).toBe(pick)
    }
    expect(wantedTrack(5, OPEN_AIR)).toBe(1)
    expect(wantedTrack('auto', night)).toBe(2)
  })
})

type Front = typeof import('./music')
type Composer = typeof import('./composer')
type Sound = typeof import('./sound')
type Settings = typeof import('../settings')
let front: Front
let composer: Composer
let sound: Sound
let settings: Settings
let ctx: FakeContext

beforeAll(async () => {
  vi.resetModules()
  Object.assign(window, { AudioContext: FakeContext })
  settings = await import('../settings')
  sound = await import('./sound')
  front = await import('./music')
  composer = await front.loadComposer()
  sound.setSoundPrefs({ ...settings.useSettings.getState(), sound: true })
  sound.unlockAudio()
  ctx = sound.audioGraph()!.ac as unknown as FakeContext
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  front.pauseMusic(false)
  vi.useRealTimers()
})

/** Plays the music on for `seconds` of the audio clock (its scheduler ticking as it would), back at the end. */
function playFor(seconds: number) {
  for (let t = 0; t < seconds; t += 0.09) {
    ctx.currentTime += 0.09
    vi.advanceTimersByTime(90)
  }
}

describe('the music, live', () => {
  it('on Auto starts on the track the day asks for, and moves to another on its two bars when the day moves on', () => {
    settings.useSettings.getState().update({ music: true, musicTrack: 'auto' })
    front.setMusicMood({ ...OPEN_AIR, phase: 'noon' })
    front.playMusic()
    expect(front.useMusic.getState()).toMatchObject({ playing: true, track: 1 })
    front.setMusicMood({ phase: 'evening' })
    // the track waits for its two bars (Slow afternoon: 16 eighths at 64 a minute, 7.5 s)
    expect(front.useMusic.getState().track).toBe(1)
    playFor(9)
    expect(front.useMusic.getState().track).toBe(3)
  })

  it('a track picked stays as the day moves on; Auto again follows it', () => {
    settings.useSettings.getState().update({ music: true, musicTrack: 'auto' })
    front.setMusicMood({ ...OPEN_AIR, phase: 'morning' })
    front.playMusic()
    front.nextTrack(1)
    expect(settings.useSettings.getState().musicTrack).toBe(1)
    expect(front.useMusic.getState().track).toBe(1)
    front.setMusicMood({ phase: 'night' })
    playFor(12)
    expect(front.useMusic.getState().track).toBe(1)
    front.autoMusic()
    expect(settings.useSettings.getState().musicTrack).toBe('auto')
    playFor(12)
    expect(front.useMusic.getState().track).toBe(3)
  })

  it('steps back 4 dB with a panel open, and comes again as it closes', () => {
    front.setMusicMood({ ...OPEN_AIR, panel: true })
    expect(sound.audioStatus()!.buses.music.duck).toBe(-4)
    front.setMusicMood({ panel: false })
    expect(sound.audioStatus()!.buses.music.duck).toBe(0)
  })

  it('off, stays silent: nothing more is written, and its level glides to nothing', () => {
    settings.useSettings.getState().update({ music: true })
    front.playMusic()
    playFor(2)
    front.pauseMusic()
    expect(settings.useSettings.getState().music).toBe(false)
    const from = ctx.nodes.length
    playFor(6)
    expect(ctx.oscillators(from)).toEqual([])
    // the first tap of a page with the music off starts nothing
    const stop = front.wireMusic()
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(10)
    expect(front.useMusic.getState().playing).toBe(false)
    stop()
    expect(composer.heard()).toBe(true)
  })
})
