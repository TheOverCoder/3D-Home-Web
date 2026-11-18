import { describe, expect, it } from 'vitest'
import { REWARD_KIND_IDS, TIERS, atLeast, rewardKind, tierRank } from './tier'

// The words of a reward (update-v1/CONTRACTS.md §1.11).

describe('the reward tiers', () => {
  it('rise from small to huge', () => {
    expect(TIERS).toEqual(['small', 'medium', 'big', 'huge'])
    expect(TIERS.map(tierRank)).toEqual([0, 1, 2, 3])
  })

  it('a tier is never under its floor, and a floor never lowers one', () => {
    for (const t of TIERS) {
      expect(atLeast(t)).toBe(t)
      for (const least of TIERS) expect(atLeast(t, least)).toBe(TIERS[Math.max(tierRank(t), tierRank(least))])
    }
  })
})

describe('the kinds of reward', () => {
  it('each has a family', () => {
    for (const kind of REWARD_KIND_IDS) expect(['coins', 'gift', 'level', 'garment', 'keys', 'work']).toContain(rewardKind(kind).family)
  })

  it('only a level, a garment (an album page among them) and the keys have a floor: the rest are as big as what they hold', () => {
    const floors = Object.fromEntries(REWARD_KIND_IDS.filter((k) => rewardKind(k).least).map((k) => [k, rewardKind(k).least]))
    expect(floors).toEqual({ level: 'big', page: 'big', garment: 'big', keys: 'huge' })
  })
})
