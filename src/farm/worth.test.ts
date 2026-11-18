import { describe, expect, it } from 'vitest'
import { CONTRACTOR, produceById } from './data'
import { SHOP } from './decor'
import { GARMENTS } from './outfit'
import { priceEvents } from './prices'
import { TIER_AT, rewardTier, worthOf } from './worth'
import { levelReward } from './xp'

// How big a reward is (update-v1/CONTRACTS.md §1.11).

describe('what a reward is worth', () => {
  it('counts coins, goods at their fair price, materials at the contractor’s, pieces at their first price, garments nothing', () => {
    expect(worthOf([])).toBe(0)
    expect(worthOf([{ coins: 40 }])).toBe(40)
    expect(worthOf([{ item: 'egg', n: 3 }])).toBe(3 * produceById('egg').price)
    expect(worthOf([{ item: 'brick', n: 2 }])).toBe(2 * CONTRACTOR.buys)
    expect(worthOf([{ decor: 'lamp' }])).toBe(SHOP.lamp.price)
    expect(worthOf([{ garment: GARMENTS[0].id }])).toBe(0)
    expect(worthOf([{ coins: 10 }, { item: 'egg', n: 1 }, { decor: 'lamp' }])).toBe(10 + produceById('egg').price + SHOP.lamp.price)
  })

  it('never reads an event’s price: the lucky draw doubles a sale, not a reward’s size', () => {
    priceEvents(() => 2)
    try {
      expect(worthOf([{ item: 'egg', n: 1 }])).toBe(produceById('egg').price)
    } finally {
      priceEvents(() => 1)
    }
  })
})

describe('a reward’s tier', () => {
  const level = 10
  const next = levelReward(level + 1)

  it('is its worth against the next level’s coins', () => {
    expect(rewardTier([{ coins: Math.floor(next * TIER_AT.medium) - 1 }], level)).toBe('small')
    expect(rewardTier([{ coins: Math.ceil(next * TIER_AT.medium) }], level)).toBe('medium')
    expect(rewardTier([{ coins: next * TIER_AT.big }], level)).toBe('big')
    expect(rewardTier([{ coins: next * TIER_AT.huge }], level)).toBe('huge')
    expect(rewardTier([], level)).toBe('small')
  })

  it('is never under its floor', () => {
    expect(rewardTier([{ coins: 1 }], level, 'big')).toBe('big')
    expect(rewardTier([{ coins: next * 5 }], level, 'big')).toBe('huge')
    expect(rewardTier([{ garment: GARMENTS[0].id }], level, 'big')).toBe('big')
  })

  it('shrinks as the level rises: the same sale is big at level 2 and small at level 200', () => {
    const sale = [{ coins: 60 }]
    // (the next level's coins: 30 at level 2, 100 at 9, 300 at 29)
    const tiers = [2, 9, 29, 200].map((l) => rewardTier(sale, l))
    expect(tiers).toEqual(['big', 'medium', 'small', 'small'])
  })
})
