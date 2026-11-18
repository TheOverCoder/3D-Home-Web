// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { REWARD_KIND_IDS, rewardKind, tierRank } from '../lib/tier'
import { MOST_PLANTS } from './data'
import { SHOP } from './decor'
import { rewardTier } from './worth'
import { capacity, farm, give, resetFarm, resetRewardCounts, rewardCounts, used, xpEventCount } from './state'
import { levelOf } from './xp'

// Every prize into the farm through one door (src/farm/state/rewards.ts, give): coins, goods past full, a piece of
// decoration into the farm's store, each where it lives, counted once as one reward with its tier; never XP.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
})

describe('give', () => {
  it('coins into the purse, goods into their building even past full', () => {
    const coins = farm.coins
    farm.inv.egg = capacity('barn')
    give([{ coins: 12 }, { item: 'egg', n: 3 }, { item: 'brick', n: 2 }], 'daily')
    expect(farm.coins).toBe(coins + 12)
    expect(farm.inv.egg).toBe(capacity('barn') + 3)
    expect(farm.inv.brick).toBe(2)
    expect(used('barn')).toBeGreaterThan(capacity('barn'))
  })

  it('a piece of decoration into the farm’s store, free to put down; a kind owned to its most: its worth in coins', () => {
    give([{ decor: 'lamp' }, { decor: 'lamp' }], 'stop')
    expect(farm.layout.stored.lamp).toBe(2)
    farm.layout = { ...farm.layout, stored: { ...farm.layout.stored, 'apple-tree': MOST_PLANTS } }
    const coins = farm.coins
    give([{ decor: 'apple-tree' }], 'stop')
    expect(farm.layout.stored['apple-tree']).toBe(MOST_PLANTS)
    expect(farm.coins).toBe(coins + SHOP['apple-tree'].price)
  })

  it('one reward: its tier by what it is worth at the farm’s level, never under its kind’s least', () => {
    farm.xp.points = 4000
    farm.xp.paid = levelOf(4000)
    const prizes = [{ coins: 3 }]
    const level = levelOf(farm.xp.points)
    for (const kind of REWARD_KIND_IDS) {
      const tier = give(prizes, kind)
      expect(tier, kind).toBe(rewardTier(prizes, level, rewardKind(kind).least))
      expect(tierRank(tier), kind).toBeGreaterThanOrEqual(tierRank(rewardKind(kind).least ?? 'small'))
    }
    expect(give([{ coins: 3 }], 'daily')).toBe('small')
    expect(give([{ coins: 3 }], 'level')).toBe('big')
  })

  it('counted once, as its kind at its tier (rewarded): however many prizes it holds', () => {
    resetRewardCounts()
    const tier = give([{ coins: 4 }, { item: 'egg', n: 2 }, { decor: 'lamp' }], 'stop')
    const counts = rewardCounts()
    expect(counts.stop[tier]).toBe(1)
    expect(Object.values(counts).reduce((n, byTier) => n + Object.values(byTier).reduce((a, b) => a + b, 0), 0)).toBe(1)
  })

  it('no XP: a reward is not something done', () => {
    const [points, events] = [farm.xp.points, xpEventCount()]
    give([{ coins: 500 }, { item: 'egg', n: 4 }, { decor: 'bench' }], 'box')
    expect([farm.xp.points, xpEventCount()]).toEqual([points, events])
  })
})
