import { describe, expect, it } from 'vitest'
import { HAPTICS } from '../lib/device'
import { REWARD_KIND_IDS, TIERS } from '../lib/tier'
import { SOUNDS, rewardFeel } from './sounds'

// The table of the farm's sounds (update-v1/CONTRACTS.md §1.12). Each row's touch must be the one sound.ts gives that
// sound today (its private FEEL, written out here as it stands), until 06 moves sound.ts onto the table.
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
}

describe('the table of sounds', () => {
  it('has a row for each of the farm’s 26 sounds', () => {
    expect(Object.keys(SOUNDS)).toHaveLength(26)
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
