import { afterEach, describe, expect, it } from 'vitest'
import { TIERS, tierRank } from '../lib/tier'
import { setMotionPref } from '../ui/still'
import { CONFETTI_FROM, MOST_SHOWS, SHOW, showReward, takeRewardShows } from './reward'

// How a reward is shown by its tier (src/fx/reward.ts): a bigger tier pops bigger and holds longer, confetti only from
// the one floor up (decision 15: a modest reward throws none), and the shows of rewards paid in the world wait for the
// next frame, the latest few, none under less motion.

afterEach(() => {
  setMotionPref('device')
  takeRewardShows()
})

describe('each tier’s show', () => {
  it('as the table has it: the number 1×, 1.15×, 1.3×, 1.5×; held 60, 80, 100, 140 ms', () => {
    expect(TIERS.map((t) => SHOW[t].pop)).toEqual([1, 1.15, 1.3, 1.5])
    expect(TIERS.map((t) => SHOW[t].holdMs)).toEqual([60, 80, 100, 140])
  })

  it('confetti only for a real reward: none under the floor, big, then more for huge', () => {
    expect(CONFETTI_FROM).toBe('big')
    for (const t of TIERS) expect(SHOW[t].confetti === null, t).toBe(tierRank(t) < tierRank(CONFETTI_FROM))
    expect(SHOW.big.confetti).toEqual({ count: 44, spread: 80, power: 26 })
    expect(SHOW.huge.confetti).toEqual({ count: 100, spread: 100, power: 34 })
  })
})

describe('a reward paid in the world', () => {
  it('waits for the next frame, in order, taken once; a pile nobody plays keeps the latest', () => {
    showReward('sale', 'small', { x: 1, y: 2, z: 3 })
    showReward('order', 'big', { x: 4, y: 5, z: 6 })
    expect(takeRewardShows()).toEqual([expect.objectContaining({ kind: 'sale', tier: 'small', x: 1, y: 2, z: 3 }), expect.objectContaining({ kind: 'order', tier: 'big', x: 4 })])
    expect(takeRewardShows()).toEqual([])
    for (let k = 0; k < MOST_SHOWS + 5; k++) showReward('harvest', 'small', { x: k, y: 0, z: 0 })
    const kept = takeRewardShows()
    expect(kept.length).toBe(MOST_SHOWS)
    expect(kept[0].x).toBe(5)
  })

  it('under less motion: no show', () => {
    setMotionPref('less')
    showReward('sale', 'huge', { x: 0, y: 0, z: 0 })
    expect(takeRewardShows()).toEqual([])
  })
})
