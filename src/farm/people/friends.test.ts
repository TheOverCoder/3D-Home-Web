import { describe, expect, it } from 'vitest'
import { NEIGHBOUR_IDS } from '../../data/people'
import { MOST } from '../../lib/saved'
import { FRIENDS, MOST_HEARTS, befriend, heartsOf, sanitizeFriends, type Friends } from './friends'

// Friendship with the neighbours (./friends.ts): points that only grow, hearts at their thresholds, and the saved
// record made safe.

describe('friendship', () => {
  it('a heart at each threshold, none before the first, all five from the last on', () => {
    expect(heartsOf(0)).toBe(0)
    FRIENDS.hearts.forEach((at, k) => {
      expect(heartsOf(at - 1), `${at - 1} points`).toBe(k)
      expect(heartsOf(at), `${at} points`).toBe(k + 1)
    })
    expect(heartsOf(MOST)).toBe(MOST_HEARTS)
    // each heart further than the one before
    const gaps = FRIENDS.hearts.map((h, k) => h - (k ? FRIENDS.hearts[k - 1] : 0))
    expect(gaps.every((g, k) => k === 0 || g > gaps[k - 1])).toBe(true)
  })

  it('every deed makes a neighbour fonder, by its worth; a liked good more than a sale, a chapter most', () => {
    expect(FRIENDS.liked).toBeGreaterThan(FRIENDS.sale)
    expect(FRIENDS.order).toBeGreaterThan(FRIENDS.liked)
    expect(FRIENDS.chapter).toBeGreaterThan(FRIENDS.order)
    let f: Friends = {}
    for (const why of ['sale', 'liked', 'order', 'chapter'] as const) {
      const was = f.baker?.points ?? 0
      f = befriend(f, 'baker', why)
      expect(f.baker!.points).toBe(was + FRIENDS[why])
    }
    // the others are not touched, nor the record given
    const before: Friends = { teacher: { points: 4, told: 1 } }
    const after = befriend(before, 'child', 'sale')
    expect(before).toEqual({ teacher: { points: 4, told: 1 } })
    expect(after).toEqual({ teacher: { points: 4, told: 1 }, child: { points: 1, told: 0 } })
  })

  it('points only grow: never past a count, and the hearts told stay', () => {
    let f: Friends = { knitter: { points: MOST - 1, told: 5 } }
    f = befriend(f, 'knitter', 'chapter')
    expect(f.knitter).toEqual({ points: MOST, told: 5 })
    for (let i = 0; i < 50; i++) {
      const before = f.knitter!.points
      f = befriend(f, 'knitter', 'sale')
      expect(f.knitter!.points).toBeGreaterThanOrEqual(before)
    }
  })

  it('a save made safe: a farm from before met no one; only neighbours met, a count of points, hearts told no more than reached', () => {
    for (const raw of [undefined, null, 7, 'friends', [], [{ points: 3 }]]) expect(sanitizeFriends(raw, NEIGHBOUR_IDS), JSON.stringify(raw)).toEqual({})
    expect(
      sanitizeFriends(
        {
          baker: { points: 9, told: 1 },
          teacher: { points: -4, told: 3 },
          knitter: { points: 2.6, told: 'x' },
          beekeeper: { points: 'lots' },
          child: 'best friends',
          manager: { points: 50, told: 2 },
          nobody: { points: 3, told: 0 },
        },
        NEIGHBOUR_IDS,
      ),
    ).toEqual({ baker: { points: 9, told: 1 }, teacher: { points: 0, told: 0 }, knitter: { points: 3, told: 0 }, beekeeper: { points: 0, told: 0 } })
    // hearts told past those reached: as many as reached
    expect(sanitizeFriends({ baker: { points: 9, told: 5 } }, NEIGHBOUR_IDS)).toEqual({ baker: { points: 9, told: heartsOf(9) } })
    // someone not met yet is nobody's friend yet
    expect(sanitizeFriends({ baker: { points: 9, told: 1 }, child: { points: 3, told: 1 } }, ['child'])).toEqual({ child: { points: 3, told: 1 } })
  })
})
