import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeProfile } from '../lib/profile'
import { HOLD_MOST_MS, goodsHeld, holdGoods, letGoodsGo, onGoodsHeld } from '../ui/fly'
import { setMotionPref } from '../ui/still'
import { coinsFx, coinsToFly, farmFx, goodsFx, takeFx } from './fx'

// what the game asks of the effects (src/fx/fx.ts): the rules that do not need a browser
describe('farm effects', () => {
  beforeEach(() => {
    takeFx()
  })

  it('a sale sends a few coins, more for a bigger one, never a swarm', () => {
    expect(coinsToFly(3)).toBe(3)
    expect(coinsToFly(12)).toBe(4)
    expect(coinsToFly(48)).toBe(7)
    expect(coinsToFly(500)).toBe(7)
  })

  it('what is asked waits for the next frame, in order, and is taken once', () => {
    farmFx('water', 1, 0.4, 2)
    farmFx('harvest', 1, 0.5, 2, { good: 'tomato' })
    coinsFx(5.6, 13.8, 12)
    const asked = takeFx()
    expect(asked.map((r) => r.kind)).toEqual(['water', 'harvest', 'coins'])
    expect(asked[1]).toMatchObject({ good: 'tomato', x: 1, z: 2 })
    expect(asked[2]).toMatchObject({ coins: 12, x: 5.6, z: 13.8 })
    expect(takeFx()).toEqual([])
  })

  it('every device draws the particles, the light graphics half of them', () => {
    expect(makeProfile('phone', false, false).particles).toBe(1)
    expect(makeProfile('desktop', false, false).particles).toBe(1)
    expect(makeProfile('phone', true, true).particles).toBe(0.5)
  })

  it('a pile of requests nobody plays keeps only the latest few', () => {
    for (let i = 0; i < 100; i++) farmFx('dust', i, 0, 0)
    const asked = takeFx()
    expect(asked.length).toBe(48)
    expect(asked[asked.length - 1].x).toBe(99)
  })

  it('goods collected ask for one picture with how many; none under less motion (the count changes all the same)', () => {
    goodsFx(1, 0.7, 2, 'lettuce', 16)
    goodsFx(1, 0.7, 2, 'lettuce', 0)
    expect(takeFx()).toEqual([expect.objectContaining({ kind: 'goods', good: 'lettuce', count: 16, x: 1, z: 2 })])
    setMotionPref('less')
    goodsFx(1, 0.7, 2, 'egg', 3)
    setMotionPref('device')
    expect(takeFx()).toEqual([])
  })
})

// a store's gauge holds goods back while their pictures fly to it (src/ui/fly.ts): never below none, let go as they
// land, as a flight is cancelled, or by itself after a while at the latest
describe('the gauge holds goods in the air', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    letGoodsGo()
  })
  afterEach(() => {
    letGoodsGo()
    vi.useRealTimers()
  })

  it('held until landed (once: a second letting go takes nothing more), each store its own', () => {
    let told = 0
    const stop = onGoodsHeld(() => told++)
    const a = holdGoods('silo', 16)
    const b = holdGoods('silo', 4)
    holdGoods('barn', 2)
    expect([goodsHeld('silo'), goodsHeld('barn')]).toEqual([20, 2])
    a()
    a()
    expect(goodsHeld('silo')).toBe(4)
    b()
    expect(goodsHeld('silo')).toBe(0)
    expect(told).toBe(5)
    stop()
  })

  it('a flight cancelled or never landing lets go by itself; nothing held is ever below none', () => {
    holdGoods('barn', 3)
    const long = holdGoods('barn', 2, HOLD_MOST_MS + 1000)
    vi.advanceTimersByTime(HOLD_MOST_MS - 1)
    expect(goodsHeld('barn')).toBe(5)
    vi.advanceTimersByTime(1)
    expect(goodsHeld('barn')).toBe(2)
    vi.advanceTimersByTime(1000)
    expect(goodsHeld('barn')).toBe(0)
    long()
    expect(goodsHeld('barn')).toBe(0)
    expect(holdGoods('barn', -4)).toBeTypeOf('function')
    expect(goodsHeld('barn')).toBe(0)
  })

  it('another farm lets everything go: a hold from before takes nothing off the next', () => {
    const old = holdGoods('silo', 5)
    letGoodsGo()
    holdGoods('silo', 2)
    old()
    expect(goodsHeld('silo')).toBe(2)
  })
})
