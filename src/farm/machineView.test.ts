import { describe, expect, it } from 'vitest'
import { MACHINE_LEVELS, QUEUE, machineLevel, queuePrice } from './machineView'

describe("a machine's level and its queue's places", () => {
  it('level 1 to start; 60 minutes worked is level 1 with 300 to go; level 2 after six hours: +20 % XP and coins', () => {
    expect(machineLevel(0).n).toBe(1)
    const sixty = machineLevel(60 * 60)
    expect([sixty.n, sixty.minutes, sixty.next]).toEqual([1, 60, 360])
    expect(sixty.next! - sixty.minutes).toBe(300)
    const two = machineLevel(360 * 60)
    expect(two.n).toBe(2)
    expect(two.boost).toEqual({ xp: 0.2, coins: 0.2, speed: 0 })
  })
  it('the top level has no next; a broken time is no work', () => {
    const top = machineLevel(1e12)
    expect([top.n, top.next, top.nextBoost, top.progress]).toEqual([MACHINE_LEVELS.length, null, null, 1])
    expect(machineLevel(Number.NaN).n).toBe(1)
    expect(machineLevel(-5).minutes).toBe(0)
  })
  it('three places to start, up to twelve, each dearer than the last', () => {
    let last = 0
    for (let c = QUEUE.start + 1; c <= QUEUE.max; c++) {
      const p = queuePrice(c)!
      expect(p).toBeGreaterThan(last)
      last = p
    }
    expect(queuePrice(QUEUE.max + 1)).toBeNull()
  })
})
