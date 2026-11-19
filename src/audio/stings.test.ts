import { afterEach, describe, expect, it, vi } from 'vitest'
import { REWARD_KIND_IDS, TIERS, rewardKind, type RewardKind, type Tier } from '../lib/tier'
import { makeEngine } from './engine'
import { FakeContext, filtersOf, notesOf, type PlayedNote } from './fakeAudio'
import { CLIMB_STEPS, note, offKey } from './palette'
import { STING_TIERS, knocksOf, landNote, playLanding, playRattle, playSting, stingFamily } from './stings'

// A reward's sound by its size (./stings.ts, mission 06 c7), as the recording fake hears it: every kind of reward at
// every tier has its sting, all in the one key; each tier longer, with more notes and a wider range than the one below;
// each family in a voice of its own. The rattle before a box opens speeds up to its opening; the coins landing climb
// the key a step each.

afterEach(() => vi.restoreAllMocks())

/** What a sting writes into the fake (its dice held: the coins' tumble), from audio time 1: its notes, its noise's
 *  filters, how long it says it rings, and the last moment any of its envelopes is still sounding (s after 1). */
function heard(kind: RewardKind, tier: Tier) {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const ctx = new FakeContext()
  const seconds = playSting(makeEngine(ctx.audio), kind, tier, 1)
  vi.restoreAllMocks()
  const notes = notesOf(ctx)
  const ends = ctx.oscillators().map((o) => Math.max(...o.stops) - 0.05 - 1)
  return { notes, filters: filtersOf(ctx), seconds, rings: Math.max(0, ...ends) }
}

/** The kinds each family sounds in (one of each). */
const ONE_A_FAMILY: RewardKind[] = ['sale', 'daily', 'level', 'garment', 'keys']

/** Every note within a cent of the key, or a colour over one sounding with it (under a quarter as loud). */
function inKey(kind: string, notes: PlayedNote[]) {
  for (const n of notes) {
    if (n.f1 !== null) expect(offKey(n.f1), `${kind} glides off the key`).toBeLessThanOrEqual(1)
    if (offKey(n.f) <= 1) continue
    const under = notes.filter((m) => Math.abs(m.t - n.t) < 0.01 && offKey(m.f) <= 1 && m.f < n.f)
    expect(under.length, `${kind}: ${n.f.toFixed(1)} Hz is off the key`).toBeGreaterThan(0)
    expect(n.gain, `${kind}: ${n.f.toFixed(1)} Hz is a note, not a colour`).toBeLessThan(Math.max(...under.map((m) => m.gain)) / 4)
  }
}

/** How far a sting's notes reach, top over bottom (a ratio of frequencies): its notes, not its colours (a partial,
 *  a clink, a shimmer: under a quarter of its loudest). */
const range = (notes: PlayedNote[]) => {
  const loudest = Math.max(...notes.map((n) => n.gain))
  const fs = notes.filter((n) => offKey(n.f) <= 1 && n.gain >= loudest / 4).map((n) => n.f)
  return Math.max(...fs) / Math.min(...fs)
}

describe('a reward’s sting', () => {
  it('exists for every kind at every tier, in the key; goods collected have none (the press made its sound)', () => {
    for (const kind of REWARD_KIND_IDS)
      for (const tier of TIERS) {
        const h = heard(kind, tier)
        if (rewardKind(kind).family === 'work') {
          expect(stingFamily(kind), kind).toBeNull()
          expect(h.notes, `${kind} ${tier}`).toEqual([])
          continue
        }
        expect(h.notes.length, `${kind} ${tier}`).toBeGreaterThan(1)
        inKey(`${kind} ${tier}`, h.notes)
      }
  })

  it('is longer, with more notes and a wider range, at each tier than at the one below, in every family', () => {
    for (const kind of ONE_A_FAMILY) {
      const by = TIERS.map((t) => heard(kind, t))
      for (let i = 1; i < TIERS.length; i++) {
        const [lo, hi] = [by[i - 1], by[i]]
        const name = `${kind}: ${TIERS[i]} over ${TIERS[i - 1]}`
        expect(hi.seconds, name).toBeGreaterThan(lo.seconds)
        expect(hi.rings, name).toBeGreaterThan(lo.rings)
        expect(hi.notes.length, name).toBeGreaterThan(lo.notes.length)
        expect(range(hi.notes), name).toBeGreaterThan(range(lo.notes) + 0.01)
      }
    }
  })

  it('follows the table: small G6–C7, medium E6–C7 with a clink, big C6–C7 under a chord, huge from a C5 body to E7', () => {
    const lowest = (t: Tier) => Math.min(...heard('daily', t).notes.map((n) => n.f))
    const run = (t: Tier) => STING_TIERS[t].run
    expect(run('small')).toEqual(['G6', 'C7'])
    expect(run('medium')).toEqual(['E6', 'G6', 'C7'])
    expect(run('big')).toEqual(['C6', 'E6', 'G6', 'C7'])
    expect(run('huge')).toEqual(['C6', 'E6', 'G6', 'C7', 'E7'])
    expect(lowest('small')).toBeCloseTo(note(3, 6), 6)
    expect(lowest('medium')).toBeCloseTo(note(2, 6), 6)
    expect(lowest('big')).toBeCloseTo(note(0, 6), 6)
    expect(lowest('huge')).toBeCloseTo(note(0, 5), 6)
    expect(TIERS.map((t) => STING_TIERS[t].seconds)).toEqual([0.35, 0.7, 1.2, 1.8])
    // it rings about as long as its row says (the till's drawer before its coins)
    for (const t of TIERS) expect(heard('daily', t).rings, t).toBeCloseTo(STING_TIERS[t].seconds, 0)
    expect(heard('till', 'small').seconds).toBeGreaterThan(heard('sale', 'small').seconds)
  })

  it('steps the music back only when big or huge: −6 dB for its length', () => {
    expect(STING_TIERS.small.stepBack).toBeNull()
    expect(STING_TIERS.medium.stepBack).toBeNull()
    expect(STING_TIERS.big.stepBack).toEqual({ dB: -6, ms: 800 })
    expect(STING_TIERS.huge.stepBack).toEqual({ dB: -6, ms: 1800 })
  })

  it('sounds each family in a voice of its own: no two alike at one tier', () => {
    const r = (x: number) => Math.round(x * 100) / 100
    for (const tier of TIERS) {
      const seen = new Map<string, RewardKind>()
      for (const kind of ONE_A_FAMILY) {
        const h = heard(kind, tier)
        const print = JSON.stringify({ notes: h.notes.map((n) => [r(n.t), r(n.f), r(n.gain * 1000)]), filters: h.filters.map(r) })
        expect(seen.get(print), `${kind} sounds like ${seen.get(print)} at ${tier}`).toBeUndefined()
        seen.set(print, kind)
      }
    }
  })

  it('writes nothing but at the moment asked (an offline render, the fake: no live engine needed)', () => {
    const ctx = new FakeContext()
    ctx.currentTime = 5
    playSting(makeEngine(ctx.audio), 'order', 'big')
    expect(Math.min(...notesOf(ctx).map((n) => n.t))).toBeGreaterThanOrEqual(5)
  })
})

describe('the rattle', () => {
  it('knocks faster and faster from its start to just before the box opens', () => {
    for (const [ms, delay] of [
      [680, 0],
      [480, 320],
    ]) {
      const k = knocksOf(ms, delay)
      expect(k[0]).toBeCloseTo(delay / 1000, 9)
      expect(k.at(-1)!).toBeLessThan((delay + ms) / 1000)
      expect(k.at(-1)!).toBeGreaterThan((delay + ms) / 1000 - 0.06)
      const gaps = k.slice(1).map((t, i) => t - k[i])
      for (let i = 1; i < gaps.length; i++) expect(gaps[i], `${ms}: gap ${i}`).toBeLessThan(gaps[i - 1])
      expect(gaps[0] / gaps.at(-1)!).toBeGreaterThan(2.5)
    }
    // a longer shake, more knocks
    expect(knocksOf(820).length).toBeGreaterThan(knocksOf(480).length)
  })

  it('is the lid’s knocks alone (noise, no note to clash with the key), louder towards the opening', () => {
    const ctx = new FakeContext()
    playRattle(makeEngine(ctx.audio), 680, 0, 1)
    expect(ctx.oscillators()).toEqual([])
    const sources = ctx.nodes.filter((n) => n.kind === 'source') as unknown as { starts: number[] }[]
    expect(sources.length).toBe(knocksOf(680).length * 3)
    const gains = ctx.nodes
      .filter((n) => n.kind === 'gain')
      .map((g) => (g as unknown as { gain: { events: unknown[]; peak: number } }).gain)
      .filter((g) => g.events.length)
      .map((g) => g.peak)
    // each knock's first burst, its lid on the box: the last the loudest
    const knocks = gains.filter((_, i) => i % 3 === 0)
    expect(knocks.length).toBe(knocksOf(680).length)
    for (let i = 1; i < knocks.length; i++) expect(knocks[i], String(i)).toBeGreaterThan(knocks[i - 1])
  })
})

describe('the coins landing', () => {
  it('climb the key a step a coin from G6, and hold the top', () => {
    const tinks = Array.from({ length: CLIMB_STEPS + 3 }, (_, i) => {
      const ctx = new FakeContext()
      playLanding(makeEngine(ctx.audio), i, 1)
      return notesOf(ctx)[0].f
    })
    for (let i = 0; i < CLIMB_STEPS; i++) expect(tinks[i], String(i)).toBeCloseTo(note(3 + i, 6), 6)
    for (let i = CLIMB_STEPS; i < tinks.length; i++) expect(tinks[i]).toBe(tinks[CLIMB_STEPS - 1])
    for (const f of tinks) expect(offKey(f)).toBeLessThanOrEqual(1)
    expect(landNote(-2)).toBe(landNote(0))
  })
})
