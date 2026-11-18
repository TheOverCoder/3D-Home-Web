import { describe, expect, it } from 'vitest'
import { ALMOST, nearest, reached, stops } from './road'

// The road of stops (update-v1/CONTRACTS.md §1.10).

describe('a road', () => {
  it('rises: each stop at least one past the one before, rounded up', () => {
    expect(stops(4, (k) => k * 10)).toEqual([10, 20, 30, 40])
    expect(stops(3, (k) => k * 2.5)).toEqual([3, 5, 8])
    expect(stops(4, () => 0)).toEqual([1, 2, 3, 4])
    expect(stops(3, () => NaN)).toEqual([1, 2, 3])
    expect(stops(0, (k) => k)).toEqual([])
  })

  it('counts the stops reached, at, before and after each', () => {
    const road = stops(3, (k) => k * 10)
    expect([0, 9, 10, 11, 29, 30, 99].map((have) => reached(road, have))).toEqual([0, 0, 1, 1, 2, 3, 3])
  })

  it('says how far the next stop is, and when it is almost there', () => {
    const road = stops(3, (k) => k * 100)
    expect(nearest(road, 0)).toEqual({ stop: 1, at: 100, left: 100, share: 0, almost: false })
    expect(nearest(road, 150)).toEqual({ stop: 2, at: 200, left: 50, share: 0.5, almost: false })
    expect(nearest(road, 100 + 100 * ALMOST)).toMatchObject({ stop: 2, almost: true })
    expect(nearest(road, 300)).toBeNull()
  })

  it('the daily week is a road of seven, one stop a day', () => {
    const week = stops(7, (k) => k)
    expect(week).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(reached(week, 3)).toBe(3)
    expect(nearest(week, 6)).toMatchObject({ stop: 7, left: 1 })
  })
})
