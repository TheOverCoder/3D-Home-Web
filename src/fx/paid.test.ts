// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { farm, give, resetFarm, resetRewardCounts, setRandom } from '../farm/state'
import { rewardTier } from '../farm/worth'
import { levelOf, levelReward, xpAt } from '../farm/xp'
import { paying } from './paid'

// A card's show is as big as the tier its payout was counted at (`paying`, src/fx/paid.ts): read from the counts round
// the press, never worked out twice; a payout refused shows nothing, and a sample's (the design lab: nothing paid) the
// tier of what it gives.

const LEVEL = 10

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  setRandom(() => 0.5)
  farm.xp = { points: xpAt(LEVEL) + 1, paid: LEVEL }
  resetRewardCounts()
})
afterEach(() => setRandom(null))

describe('paying', () => {
  it('a claim: what it gave back, and the tier the farm counted it at', () => {
    const big = [{ coins: levelReward(LEVEL + 1) * 2 }]
    const r = paying('goal', () => (give(big, 'goal'), 'given'))
    expect(r).toEqual({ got: 'given', tier: 'big' })
    expect(paying('daily', () => give([{ coins: 1 }], 'daily')).tier).toBe('small')
  })

  it('refused (nothing counted): no tier; a sample that counted nothing: the tier of what it gives at the farm’s level', () => {
    const none = () => null
    const refused = () => false
    expect(paying('order', refused).tier).toBeNull()
    expect(paying('order', refused, none).tier).toBeNull()
    const prizes = [{ coins: levelReward(LEVEL + 1) * 4 }]
    const sample = () => prizes
    const tier = paying('box', sample, sample).tier
    expect(tier).toBe(rewardTier(prizes, levelOf(farm.xp.points)))
    expect(tier).toBe('huge')
  })
})
