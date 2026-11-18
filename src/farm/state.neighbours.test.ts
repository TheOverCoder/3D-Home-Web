// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FRIENDS } from './people/friends'
import { acceptOffer, befriend, farm, fillOrder, orderAt, resetFarm, sellAll, sendOrder, setRandom, spawnVisitor, tick } from './state'

// The neighbours on the farm (src/farm/state/neighbours.ts): a sale at the gate or an order sent for one makes them
// fonder, by its worth (src/farm/people/friends.ts); a stranger's, nobody. Friendship gives no XP, and never falls.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  setRandom(() => 0.5)
})
afterEach(() => setRandom(null))

/** A buyer standing in line for `qty` of `want`, the farm holding enough; `who` a neighbour (none: a stranger). */
function buyer(want: 'egg' | 'milk' | 'lettuce', who?: string) {
  farm.inv[want] = 20
  const v = spawnVisitor({ want, qty: 2, offer: 9, gift: false, queued: true })
  if (who) Object.assign(v, { who })
  return v
}

/** An order on the board for `from`, filled. */
function filledOrder(from?: string, chapter?: string) {
  // (a new farm's board fills as the farm first ticks)
  if (!orderAt(0)) tick(0.01)
  const o = orderAt(0)!
  Object.assign(o, { from, chapter })
  for (const l of o.lines) farm.inv[l.good] = l.want
  fillOrder(0)
  return o
}

describe('friendship on the farm', () => {
  it('a new farm has met no one', () => {
    expect(farm.friends).toEqual({})
  })

  it('a sale to a neighbour at the gate makes them fonder, more for a good they like; to a stranger, nothing', () => {
    acceptOffer(buyer('egg').id)
    expect(farm.friends).toEqual({})
    // the child likes milk and eggs; lettuce is a plain sale
    acceptOffer(buyer('lettuce', 'child').id)
    expect(farm.friends.child).toEqual({ points: FRIENDS.sale, told: 0 })
    acceptOffer(buyer('milk', 'child').id)
    expect(farm.friends.child).toEqual({ points: FRIENDS.sale + FRIENDS.liked, told: 0 })
    // selling to everyone in line counts each
    buyer('egg', 'baker')
    buyer('egg', 'teacher')
    expect(sellAll()).toBe(2)
    expect(farm.friends).toMatchObject({ baker: { points: FRIENDS.liked }, teacher: { points: FRIENDS.sale } })
  })

  it('an order sent for a neighbour: an order’s worth, a chapter’s request more; for nobody, nothing', () => {
    filledOrder()
    expect(sendOrder(0)).toBe(true)
    expect(farm.friends).toEqual({})
    filledOrder('knitter')
    expect(sendOrder(0)).toBe(true)
    expect(farm.friends.knitter).toEqual({ points: FRIENDS.order, told: 0 })
    filledOrder('knitter', 'act1-1')
    expect(sendOrder(0)).toBe(true)
    expect(farm.friends.knitter).toEqual({ points: FRIENDS.order + FRIENDS.chapter, told: 0 })
  })

  it('gives no XP of its own, and only the sale and send paths call it; it never falls', () => {
    const xp = farm.xp.points
    befriend({ who: 'beekeeper', want: 'sugar' })
    befriend({ from: 'beekeeper', lines: [] })
    expect(farm.xp.points).toBe(xp)
    expect(farm.friends.beekeeper).toEqual({ points: FRIENDS.liked + FRIENDS.order, told: 0 })
    // the staff are nobody's neighbours
    befriend({ who: 'manager', want: 'egg' })
    expect(Object.keys(farm.friends)).toEqual(['beekeeper'])
  })
})
