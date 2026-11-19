import { afterEach, describe, expect, it, vi } from 'vitest'
import { MACHINES, MACHINE_IDS, PRODUCERS, PRODUCER_IDS } from '../farm/data'
import { HAPTICS } from '../lib/device'
import { REWARD_KIND_IDS, TIERS } from '../lib/tier'
import { makeEngine } from './engine'
import { FakeContext, filtersOf, notesOf } from './fakeAudio'
import { play, type FarmSound } from './farmSounds'
import { VARY_LEVEL, keyStep, note, vary } from './palette'
import { SOUNDS, rewardFeel } from './sounds'

// The table of the farm's sounds (update-v1/CONTRACTS.md §1.12), and the sounds played by it (./farmSounds.ts) into the
// recording fake (./fakeAudio.ts). Each row's touch is the one each sound had before the table (sound.ts's FEEL, written
// out here as it stood): the table changed where the touches are kept, not what is felt; and each action's own sound
// (mission 06 c5) its touch from the haptics map (src/lib/device.ts).
const FEEL_TODAY: Record<string, string> = {
  plant: 'tick',
  water: 'tick',
  harvest: 'tick',
  milk: 'tick',
  shear: 'tick',
  decline: 'tick',
  dress: 'tick',
  coins: 'sale',
  till: 'sale',
  build: 'buy',
  surprise: 'gift',
  level: 'level',
  keys: 'level',
  pick: 'tick',
  sack: 'tick',
  bolt: 'tick',
  tray: 'tick',
  crock: 'tick',
  crate: 'tick',
  shelf: 'tick',
  pay: 'buy',
  lift: 'lift',
  thud: 'drop',
}

describe('the table of sounds', () => {
  it('has a row for each of the farm’s 38 sounds', () => {
    expect(Object.keys(SOUNDS)).toHaveLength(38)
  })

  it('gives each the touch it has today', () => {
    for (const [name, row] of Object.entries(SOUNDS)) expect(row.feel, name).toBe(FEEL_TODAY[name] ?? null)
  })

  it('keeps every cue and every "no" the same each time', () => {
    for (const [name, row] of Object.entries(SOUNDS)) if (row.family === 'cue' || row.family === 'no') expect(row.vary, name).toBe(0)
  })

  it('tells everything but ambience some other way too', () => {
    for (const [name, row] of Object.entries(SOUNDS)) if (row.twin === 'none') expect(row.family, name).toBe('world')
  })
})

const KINDS = Object.keys(SOUNDS) as FarmSound[]
const SEMITONE = 2 ** (1 / 12)

afterEach(() => vi.restoreAllMocks())

describe('playing a sound into an engine', () => {
  it('writes every sound into any engine (here the fake), starting something and throwing nothing', () => {
    for (const kind of KINDS) {
      const ctx = new FakeContext()
      const from = ctx.nodes.length
      play(makeEngine(ctx.audio), kind, { pan: 0.4, near: 0.5 })
      const started = ctx.nodes.slice(from).filter((n) => (n as { starts?: number[] }).starts?.length)
      expect(started.length, kind).toBeGreaterThan(0)
    }
  })

  it('varies a sound that may (work, coins, build) by up to its semitones and a tenth of its loudness; a cue never', () => {
    expect(vary(SOUNDS.ding)).toEqual({ pitch: 1, level: 1 })
    expect(vary(SOUNDS.decline, () => 0)).toEqual({ pitch: 1, level: 1 })
    for (const kind of ['plant', 'harvest', 'build', 'coins'] as const) {
      expect(SOUNDS[kind].vary, kind).toBe(1)
      const low = vary(SOUNDS[kind], () => 0)
      const high = vary(SOUNDS[kind], () => 1)
      expect(low.pitch).toBeCloseTo(1 / SEMITONE, 9)
      expect(high.pitch).toBeCloseTo(SEMITONE, 9)
      expect(low.level).toBeCloseTo(1 - VARY_LEVEL, 9)
      expect(high.level).toBeCloseTo(1 + VARY_LEVEL, 9)
      for (let i = 0; i < 50; i++) {
        const { pitch, level } = vary(SOUNDS[kind])
        expect(pitch).toBeGreaterThanOrEqual(1 / SEMITONE)
        expect(pitch).toBeLessThanOrEqual(SEMITONE)
        expect(Math.abs(level - 1)).toBeLessThanOrEqual(VARY_LEVEL)
      }
    }
  })

  it('moves every frequency of a varied sound by its pitch, but the notes of the key, which stay in tune', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const heard = (kind: FarmSound, pitch: number) => {
      const ctx = new FakeContext()
      play(makeEngine(ctx.audio), kind, { pitch, at: 1 })
      return { notes: notesOf(ctx), filters: filtersOf(ctx) }
    }
    for (const kind of ['plant', 'harvest', 'build', 'coins', 'till'] as const) {
      const a = heard(kind, 1)
      const b = heard(kind, SEMITONE)
      expect(b.filters.length, kind).toBe(a.filters.length)
      b.filters.forEach((f, i) => expect(f / a.filters[i], kind).toBeCloseTo(SEMITONE, 9))
      b.notes.forEach((n, i) => expect(n.f / a.notes[i].f, kind).toBeCloseTo(kind === 'coins' || kind === 'till' ? 1 : SEMITONE, 9))
    }
  })

  it('plays a cue and a "no" on the same notes every time, through its row (the dice left free)', () => {
    const freqs = (kind: FarmSound) => {
      const ctx = new FakeContext()
      play(makeEngine(ctx.audio), kind, { at: 1, ...vary(SOUNDS[kind]) })
      return [...notesOf(ctx).map((n) => n.f), ...filtersOf(ctx)]
    }
    const cues = KINDS.filter((k) => SOUNDS[k].family === 'cue' || SOUNDS[k].family === 'no')
    expect(cues.length).toBeGreaterThanOrEqual(6)
    for (const kind of cues) expect(freqs(kind), kind).toEqual(freqs(kind))
  })

  it('plays a sound as loud as its row lets it vary, and as near as it is (a quarter at least)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const loudest = (o: Parameters<typeof play>[2]) => {
      const ctx = new FakeContext()
      play(makeEngine(ctx.audio), 'harvest', o)
      return Math.max(...notesOf(ctx).map((n) => n.gain))
    }
    expect(loudest({ level: 1.1 }) / loudest({})).toBeCloseTo(1.1, 6)
    expect(loudest({ near: 0.5 }) / loudest({})).toBeCloseTo(0.5, 6)
    expect(loudest({ near: 0 }) / loudest({})).toBeCloseTo(0.25, 6)
  })
})

describe('a reward’s touch', () => {
  it('is one of the phone’s patterns (or 06’s stronger double)', () => {
    for (const kind of REWARD_KIND_IDS) for (const tier of TIERS) expect([...Object.keys(HAPTICS), 'sale+']).toContain(rewardFeel(kind, tier))
  })

  it('changes with the tier only in strength: coins in are a double, stronger when big', () => {
    for (const kind of REWARD_KIND_IDS) {
      const feels = TIERS.map((t) => rewardFeel(kind, t))
      if (feels.includes('sale')) expect(feels, kind).toEqual(['sale', 'sale', 'sale+', 'sale+'])
      else expect(new Set(feels).size, kind).toBe(1)
    }
  })

  it('by family: a gift a roll, a level the strongest, goods collected a tick', () => {
    expect(rewardFeel('daily', 'huge')).toBe('gift')
    expect(rewardFeel('page', 'big')).toBe('gift')
    expect(rewardFeel('level', 'big')).toBe('level')
    expect(rewardFeel('keys', 'huge')).toBe('level')
    expect(rewardFeel('harvest', 'medium')).toBe('tick')
    expect(rewardFeel('order', 'small')).toBe('sale')
    expect(rewardFeel('order', 'huge')).toBe('sale+')
  })
})

/** What a sound writes into the fake, its dice held (the noise's start, the animals' voices): its notes and its
 *  filters, rounded to a hundredth of a hertz, as a fingerprint. */
function fingerprint(kind: FarmSound, o: Parameters<typeof play>[2] = {}) {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const ctx = new FakeContext()
  play(makeEngine(ctx.audio), kind, { at: 1, ...o })
  vi.restoreAllMocks()
  const r = (x: number) => Math.round(x * 100) / 100
  return JSON.stringify({ notes: notesOf(ctx).map((n) => [r(n.t), r(n.f), n.f1 && r(n.f1)]), filters: filtersOf(ctx).map(r) })
}

describe('each action its own sound (mission 06 c5)', () => {
  it('renders no two kinds alike', () => {
    const seen = new Map<string, FarmSound>()
    for (const kind of KINDS) {
      const f = fingerprint(kind)
      expect(seen.get(f), `${kind} sounds like ${seen.get(f)}`).toBeUndefined()
      seen.set(f, kind)
    }
  })

  it('gives every machine its own ding, on a note of the key, and its own sound as its goods are taken out', () => {
    const dings = new Set<string>()
    const collects = new Set<FarmSound>()
    for (const id of MACHINE_IDS) {
      const s = MACHINES[id].sounds
      expect(s.done, id).toBeTruthy()
      expect(s.collect, id).toBeTruthy()
      expect(SOUNDS[s.collect].family, id).toBe('work')
      expect(s.collect, id).not.toBe('harvest')
      dings.add(s.done)
      collects.add(s.collect)
      // the ding rings on its own note: that note first, two steps of the key over it after
      const ctx = new FakeContext()
      play(makeEngine(ctx.audio), 'ding', { at: 1, note: s.done })
      const { step, octave } = keyStep(s.done)
      expect(notesOf(ctx)[0].f, id).toBeCloseTo(note(step, octave), 6)
      expect(notesOf(ctx).at(-1)!.f, id).toBeCloseTo(note(step + 2, octave), 6)
    }
    expect(dings.size).toBe(MACHINE_IDS.length)
    expect(collects.size).toBe(MACHINE_IDS.length)
    // the oven's as the ding always was
    expect(fingerprint('ding', { note: MACHINES.oven.sounds.done })).toBe(fingerprint('ding'))
  })

  it('picks fruit with a sound of its own, not the crops’ harvest', () => {
    for (const id of PRODUCER_IDS) if (id === 'tree' || PRODUCERS[id].plant) expect(PRODUCERS[id].sound, id).toBe('pick')
  })

  it('plays a sound its row’s phone-mix trim louder or softer (dB), its synth as written', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const ctx = new FakeContext()
    play(makeEngine(ctx.audio), 'water', { at: 1 })
    // the drops' tones, written at 0.025
    expect(SOUNDS.water.mix).toBeLessThan(0)
    expect(Math.max(...notesOf(ctx).map((n) => n.gain))).toBeCloseTo(0.025 * 10 ** (SOUNDS.water.mix! / 20), 9)
  })

  it('puts a thing down with a thud by its size: deeper and louder the bigger', () => {
    const thud = (size: number) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const ctx = new FakeContext()
      play(makeEngine(ctx.audio), 'thud', { at: 1, size })
      vi.restoreAllMocks()
      return notesOf(ctx)[0]
    }
    const [stool, chair, sofa] = [0.4, 1, 2.2].map(thud)
    expect(stool.f).toBeGreaterThan(chair.f)
    expect(chair.f).toBeGreaterThan(sofa.f)
    expect(sofa.gain).toBeGreaterThan(chair.gain)
    expect(chair.gain).toBeGreaterThan(stool.gain)
  })
})
