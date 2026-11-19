// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { personById } from '../data/people'
import { DAY } from './data'
import { FRIENDS } from './people/friends'
import { xpAt } from './xp'
import {
  acceptOffer,
  befriend,
  befriendNow,
  fairPrice,
  farm,
  fillOrder,
  fillRequest,
  firstLetterDue,
  inLine,
  lettersWaiting,
  metNeighbours,
  neighbourComes,
  newNeighbourVisit,
  orderAt,
  quietNeighbours,
  quietSteps,
  readLetter,
  resetFarm,
  sellAll,
  sendOrder,
  sendRequest,
  setDailyClock,
  setRandom,
  spawnVisitor,
  tick,
} from './state'

// The neighbours on the farm (src/farm/state/neighbours.ts): a sale at the gate or an order sent for one makes them
// fonder, by its worth (src/farm/people/friends.ts); a stranger's, nobody. Friendship gives no XP, and never falls. The
// story begins a frame after its level, one chapter a visit, never while the first steps run; its request is paid as an
// order and its thank-you letter brings its gift; a heart and a birthday bring a letter; a neighbour met comes to the
// gate as themselves, and now and then sends an order.

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

/** The farm at `level` (its XP; its coins paid, as in play). */
function atLevel(level: number) {
  farm.xp = { points: xpAt(level), paid: level }
}

describe('the story, the letters and the neighbours on the farm', () => {
  beforeEach(() => {
    setDailyClock(() => Date.UTC(2026, 10, 18, 12))
    quietNeighbours(false)
    newNeighbourVisit()
  })
  afterEach(() => {
    quietNeighbours(true)
    setDailyClock(null)
    vi.restoreAllMocks()
  })

  it('quiet where the game is tested: nothing begins by itself until a test turns them on', () => {
    quietNeighbours(true)
    atLevel(30)
    tick(0.1)
    expect(farm.story).toEqual({ done: [], on: null, sent: false })
    expect(lettersWaiting()).toEqual([])
    expect(neighbourComes()).toBeNull()
  })

  it('the first chapter begins at level 5, a frame after: its letter in the mailbox, its request pinned above the board', () => {
    atLevel(4)
    tick(0.1)
    expect(farm.story.on).toBeNull()
    atLevel(5)
    tick(0.1)
    expect(farm.story).toEqual({ done: [], on: 'bread', sent: false })
    expect(metNeighbours()).toEqual(['baker'])
    expect(lettersWaiting().map((l) => l.id)).toEqual(['chapter:bread'])
    expect(farm.requests.map((o) => [o.chapter, o.from, o.lines.map((l) => `${l.good} ${l.have}/${l.want}`)])).toEqual([['bread', 'baker', ['flour 0/4', 'egg 0/6']]])
    // the very first letter is the one that opens by itself; read, it goes with those read, and the next does not
    expect(firstLetterDue()).toBe(true)
    expect(readLetter('chapter:bread')).toBeNull()
    expect(farm.mail).toEqual({ waiting: [], read: [{ id: 'chapter:bread', from: 'baker' }] })
    expect(firstLetterDue()).toBe(false)
  })

  it('the request sent: paid as an order, the writer fonder; the thank-you with its gift a frame later; the next chapter the next visit', () => {
    atLevel(12)
    tick(0.1)
    const coins = farm.coins
    farm.inv.flour = 10
    farm.inv.egg = 10
    expect(fillRequest(0)).toBe(10)
    expect(sendRequest(0)).toBe(true)
    expect(farm.coins).toBeGreaterThan(coins)
    expect(farm.requests).toEqual([])
    expect(farm.story).toEqual({ done: [], on: 'bread', sent: true })
    expect(farm.friends.baker?.points).toBe(FRIENDS.chapter)
    tick(0.1)
    expect(farm.story).toEqual({ done: ['bread'], on: null, sent: false })
    expect(lettersWaiting().map((l) => l.id)).toEqual(['chapter:bread', 'thanks:bread'])
    // one chapter a visit: the next waits, whatever the level
    tick(0.1)
    expect(farm.story.on).toBeNull()
    newNeighbourVisit()
    tick(0.1)
    expect(farm.story.on).toBe('class')
    // the thank-you's gift, a bench, into the farm's store; no XP
    const xp = farm.xp.points
    const benches = farm.layout.stored.bench
    readLetter('chapter:bread')
    readLetter('thanks:bread')
    expect(farm.layout.stored.bench).toBe(benches + 1)
    expect(farm.xp.points).toBe(xp)
  })

  it('no chapter while the first steps run, nor in the visit they ended in', () => {
    quietSteps(false)
    try {
      farm.firstSteps = { step: 0, over: false }
      atLevel(6)
      tick(0.1)
      expect(farm.story.on).toBeNull()
      farm.firstSteps = { step: 0, over: true }
      tick(0.1)
      expect(farm.story.on).toBeNull()
      newNeighbourVisit()
      tick(0.1)
      expect(farm.story.on).toBe('bread')
    } finally {
      quietSteps(true)
    }
  })

  it('a heart reached brings its letter, with a gift; a birthday a slice of cake, once, in the week after the date', () => {
    atLevel(10)
    tick(0.1)
    befriendNow('baker', 'order')
    tick(0.1)
    expect(farm.friends.baker).toEqual({ points: FRIENDS.order, told: 1 })
    const heart = lettersWaiting().find((l) => l.id === 'heart:baker:1')!
    expect(heart.prize && 'coins' in heart.prize).toBe(true)
    const coins = farm.coins
    readLetter('heart:baker:1')
    expect(farm.coins).toBe(coins + (heart.prize as { coins: number }).coins)
    // the baker's birthday is 14 March: three days after it, the letter waits; once a year
    setDailyClock(() => new Date(2027, 2, 17, 12).getTime())
    tick(0.1)
    expect(lettersWaiting().map((l) => l.id)).toContain('birthday:baker:2027')
    readLetter('birthday:baker:2027')
    setDailyClock(() => new Date(2027, 2, 19, 12).getTime())
    tick(0.1)
    expect(lettersWaiting().filter((l) => l.id.startsWith('birthday'))).toEqual([])
    // the teacher, not met yet, sends none (her birthday is 1 September)
    setDailyClock(() => new Date(2027, 8, 2, 12).getTime())
    tick(0.1)
    expect(lettersWaiting().filter((l) => l.id.startsWith('birthday'))).toEqual([])
  })

  it('a neighbour met comes to the gate as themselves, asking for what they like at a fair or generous price; no two in line share a name', () => {
    atLevel(5)
    tick(0.1)
    // nine in the morning: the baker's hours
    farm.day.t = 1 * (DAY.length / 24)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const v = spawnVisitor({ queued: true })
    expect([v.who, v.name]).toEqual(['baker', 'Moshe'])
    expect(personById('baker').likes).toContain(v.want)
    expect(v.offer).toBeGreaterThanOrEqual(fairPrice(v.want, v.qty) - 1)
    // in line already: strangers come instead, with names nobody in line has
    for (let i = 0; i < 6; i++) spawnVisitor({ queued: true })
    vi.restoreAllMocks()
    expect(inLine().filter((w) => w.who === 'baker').length).toBe(1)
    const names = inLine().map((w) => w.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('a new order now and then comes from a neighbour met who likes a good it asks for', () => {
    atLevel(5)
    tick(0.1)
    // the farm's dice low: a neighbour sends it when one likes a good on it (the baker: flour and eggs)
    setRandom(() => 0)
    farm.inv.egg = 50
    farm.orders = [{ wait: 0 }]
    tick(0.1)
    const o = orderAt(0)!
    expect(o.from).toBe(o.lines.some((l) => l.good === 'egg' || l.good === 'flour') ? 'baker' : undefined)
  })
})
