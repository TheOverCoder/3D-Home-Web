// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setMotionPref } from '../ui/still'
import { CONFETTI_GAP_MS, SHOW, celebrate, confettiNow, resetConfetti } from './reward'

// The one fan-out of a reward (`celebrate`, src/fx/reward.ts): its sting and its touch by its family and tier, its
// number where it was paid, and confetti only from the floor up (decision 15), at most one every 1.5 s — and under less
// motion the sting and the touch alone.

const sounds = vi.hoisted(() => [] as { kind: string; feel: unknown }[])
const bursts = vi.hoisted(() => [] as { count?: number }[])
const pops = vi.hoisted(() => [] as { text: string; scale?: number; holdMs?: number }[])
vi.mock('../audio/sound', () => ({ farmSound: (kind: string, _pan: number, _near: number, feel: unknown) => sounds.push({ kind, feel }) }))
vi.mock('../ui/burst', () => ({ burst: (_at: unknown, o: { count?: number }) => bursts.push(o) }))
vi.mock('./pop', () => ({ popNumber: (_x: number, _y: number, text: string, o: { scale?: number; holdMs?: number }) => pops.push({ text, ...o }) }))

const AT = { x: 100, y: 200 }

beforeEach(() => {
  sounds.length = bursts.length = pops.length = 0
  resetConfetti()
})
afterEach(() => setMotionPref('device'))

describe('the confetti gate', () => {
  it('one every 1.5 s at most: a second close behind is not thrown, one after the gap is', () => {
    expect(confettiNow(10_000)).toBe(true)
    expect(confettiNow(10_000 + CONFETTI_GAP_MS - 1)).toBe(false)
    expect(confettiNow(10_000 + CONFETTI_GAP_MS)).toBe(true)
    expect(confettiNow(10_000 + CONFETTI_GAP_MS + 10)).toBe(false)
  })
})

describe('celebrate', () => {
  it('a small sale: its coins sound with the plain touch, its number at the small size, no confetti', () => {
    celebrate('sale', 'small', AT, { coins: 12 })
    expect(sounds).toEqual([{ kind: 'coins', feel: 'sale' }])
    expect(pops).toEqual([{ text: '+12', scale: SHOW.small.pop, holdMs: SHOW.small.holdMs, pic: expect.any(String) }])
    expect(bursts).toEqual([])
  })

  it('a big order: the stronger touch, a bigger number, confetti by its tier — and only one of two close together', () => {
    celebrate('order', 'big', AT, { coins: 400 })
    expect(sounds).toEqual([{ kind: 'coins', feel: 'sale+' }])
    expect(pops[0]).toMatchObject({ text: '+400', scale: SHOW.big.pop })
    expect(bursts).toEqual([SHOW.big.confetti])
    celebrate('goal', 'huge', AT)
    expect(bursts.length).toBe(1)
  })

  it('each family its own sting and touch: a gift, a level, a garment, the keys; goods collected none (the press had them)', () => {
    celebrate('daily', 'medium', null)
    celebrate('level', 'big', null)
    celebrate('garment', 'big', null)
    celebrate('keys', 'huge', null)
    celebrate('till', 'small', null)
    celebrate('harvest', 'big', AT)
    expect(sounds).toEqual([
      { kind: 'surprise', feel: 'gift' },
      { kind: 'level', feel: 'level' },
      { kind: 'garment', feel: 'gift' },
      { kind: 'keys', feel: 'level' },
      { kind: 'till', feel: 'sale' },
    ])
    // (and goods collected throw no confetti: their show is their flight)
    expect(bursts).toEqual([])
  })

  it('a modest reward throws no confetti; with its sound already played where it was paid, none again', () => {
    celebrate('goal', 'medium', AT, { sound: false })
    expect(sounds).toEqual([])
    expect(bursts).toEqual([])
  })

  it('under less motion: the sting and the touch only, no number and no confetti', () => {
    setMotionPref('less')
    celebrate('order', 'huge', AT, { coins: 900 })
    expect(sounds).toEqual([{ kind: 'coins', feel: 'sale+' }])
    expect(pops).toEqual([])
    expect(bursts).toEqual([])
  })
})
