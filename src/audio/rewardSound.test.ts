// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { FakeContext, notesOf } from './fakeAudio'
import { landNote, STING_TIERS } from './stings'

// A reward heard live (./rewardSound.ts), on the game's own engine and mixer (here the recording fake as the browser's
// audio): its sting plays where it can be heard, a big or huge one steps the music and the ambience back while it rings
// (the effects never: the sting is one of them), a box that holds one from its rattle's first knock; the coins' tinks
// land a step up the key each.

type Sound = typeof import('./sound')
let sound: Sound
let ctx: FakeContext

beforeAll(async () => {
  vi.resetModules()
  Object.assign(window, { AudioContext: FakeContext })
  const { useSettings } = await import('../settings')
  sound = await import('./sound')
  sound.setSoundPrefs({ ...useSettings.getState(), sound: true })
  sound.unlockAudio()
  ctx = sound.audioGraph()!.ac as unknown as FakeContext
})

/** How far each bus is stepped back `after` seconds from now (dB). */
function backAt(after: number) {
  const was = ctx.currentTime
  ctx.currentTime = was + after
  const b = sound.audioStatus()!.buses
  ctx.currentTime = was
  return { sfx: b.sfx.duck, amb: b.amb.duck, music: b.music.duck }
}

/** Moves the audio clock on past every step back, so each case starts clear. */
const later = () => (ctx.currentTime += 60)

describe('a reward’s sting, live', () => {
  it('plays at its tier; small and medium leave the music and the ambience as they are', () => {
    for (const tier of ['small', 'medium'] as const) {
      later()
      const from = ctx.nodes.length
      sound.rewardSound('sale', tier)
      expect(notesOf(ctx, from).length, tier).toBeGreaterThan(1)
      expect(backAt(0.1), tier).toEqual({ sfx: 0, amb: 0, music: 0 })
    }
  })

  it('a big or huge one steps the music and the ambience back 6 dB while it rings, never the effects', () => {
    for (const tier of ['big', 'huge'] as const) {
      later()
      sound.rewardSound('order', tier)
      const ms = STING_TIERS[tier].stepBack!.ms
      expect(backAt(0.05), tier).toEqual({ sfx: 0, amb: -6, music: -6 })
      expect(backAt(ms / 1000 - 0.05), tier).toEqual({ sfx: 0, amb: -6, music: -6 })
      expect(backAt(ms / 1000 + 0.05), tier).toEqual({ sfx: 0, amb: 0, music: 0 })
    }
  })

  it('goods collected sound none here (the press had its own), and step nothing back', () => {
    later()
    const from = ctx.nodes.length
    sound.rewardSound('harvest', 'huge')
    expect(ctx.nodes.length).toBe(from)
    expect(backAt(0.1)).toEqual({ sfx: 0, amb: 0, music: 0 })
  })
})

describe('a box’s rattle', () => {
  it('knocks under the shake; holding a huge gift, steps the music back from its first knock until the sting has rung', () => {
    later()
    const from = ctx.nodes.length
    sound.rattle('huge', 480, 320)
    expect(ctx.nodes.length).toBeGreaterThan(from)
    expect(notesOf(ctx, from)).toEqual([])
    const ring = (320 + 480 + STING_TIERS.huge.stepBack!.ms) / 1000
    expect(backAt(0.02)).toEqual({ sfx: 0, amb: -6, music: -6 })
    expect(backAt(0.82)).toEqual({ sfx: 0, amb: -6, music: -6 })
    expect(backAt(ring - 0.05).music).toBe(-6)
    expect(backAt(ring + 0.05).music).toBe(0)
  })

  it('holding a small gift, steps nothing back', () => {
    later()
    sound.rattle('small', 680)
    expect(backAt(0.3)).toEqual({ sfx: 0, amb: 0, music: 0 })
  })
})

describe('coins landing', () => {
  it('tink a step up the key each', () => {
    const tinks = [0, 1, 2].map((i) => {
      later()
      const from = ctx.nodes.length
      sound.coinLand(i)
      return notesOf(ctx, from)[0].f
    })
    expect(tinks).toEqual([landNote(0), landNote(1), landNote(2)])
  })
})
