// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { takeFx } from '../fx/fx'
import { BEDS, ITEMS, XP_FOR, cropById } from './data'
import { BOXES_FROM, boxAt, boxCoins, boxXp, boxesReached, isBox, rollArrival, type Prize } from './gifts'
import { levelView } from './levelView'
import { claimLevel, farm, gainXp, giftsWaiting, openGifts, readyOnFarm, resetFarm, sawLevel, setRandom, switchSlot, xpEventCount, xpNow } from './state'
import { OLD_SAVE, justSaved, savedNow, startFrom } from './testSaves'
import { levelOf, levelReward, seedXp, xpAt } from './xp'

// The level's gifts on the farm (src/farm/gifts.ts, openGifts and gainXp in src/farm/state.ts): a box reached waits on
// its level's bar until the player opens it, one at a time or all at once (earlier levels' too), each given once and
// rolled on the farm's dice; a level reached by play brings a few materials by itself, its coins still claimed in the
// card. None of it is XP, and all of it is kept in the save.

/** Dice that always come up the same. */
const always = (n: number) => () => n
/** The farm's XP set to `points`, as a save would hold it (no gain from play: nothing given). */
const at = (points: number) => {
  farm.xp.points = points
  farm.xp.paid = levelOf(points)
}
/** Every good of the farm's, and its coins: what a gift may have changed. */
const purse = () => ({ coins: farm.coins, inv: { ...farm.inv } })
/** What a prize adds to a purse. */
const plus = (p: { coins: number; inv: Record<string, number> }, prize: Prize) =>
  'coins' in p && 'coins' in prize
    ? { ...p, coins: p.coins + prize.coins }
    : { ...p, inv: { ...p.inv, [(prize as { item: string }).item]: p.inv[(prize as { item: string }).item] + (prize as { n: number }).n } }

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  setRandom(always(0)) // coins, every time
  takeFx()
})
afterEach(() => setRandom(null))

describe('the boxes on the level’s bar', () => {
  it('a new farm has none waiting; a box reached waits, and one tap opens it once — its prize given at once, rolled on the farm’s dice', () => {
    expect(giftsWaiting()).toEqual([])
    // the first levels have one box, on the full bar: none at a quarter of level 1's
    at(boxXp(boxAt(1, 2)))
    expect(giftsWaiting()).toEqual([])
    const first = boxAt(1, 3)
    at(boxXp(first))
    expect(giftsWaiting()).toEqual([first])
    const before = purse()
    const got = openGifts([first])
    expect(got).toEqual([{ box: first, prize: { coins: boxCoins(1, 3) } }])
    expect(purse()).toEqual(plus(before, got[0].prize))
    expect(giftsWaiting()).toEqual([])
    expect(farm.gifts).toMatchObject({ open: first + 1, also: [] })
    // again, or a box not reached, or not a box: nothing
    expect(openGifts([first])).toEqual([])
    expect(openGifts([0, 1, 2, 5, -1, 0.5, NaN])).toEqual([])
    expect(openGifts()).toEqual([])
    expect(purse()).toEqual(plus(before, got[0].prize))
  })

  it(`one box a level before level ${BOXES_FROM}, four from it on: the first levels’ boxes are four, not sixteen`, () => {
    at(xpAt(BOXES_FROM))
    expect(giftsWaiting()).toEqual([boxAt(1, 3), boxAt(2, 3), boxAt(3, 3), boxAt(4, 3)])
    at(boxXp(boxAt(BOXES_FROM, 2)))
    expect(giftsWaiting().filter((k) => k >= boxAt(BOXES_FROM, 0))).toEqual([0, 1, 2].map((q) => boxAt(BOXES_FROM, q)))
  })

  it('Open all: every box waiting, this level’s and the levels’ before, each given once; afterwards none wait', () => {
    at(boxXp(boxAt(7, 1)) + 1) // level 7, half way: the four of levels 1–4, eight of 5 and 6, two of 7
    const all = Array.from({ length: boxAt(7, 2) }, (_, k) => k).filter(isBox)
    expect(all).toHaveLength(14)
    expect(giftsWaiting()).toEqual(all)
    const coins = farm.coins
    const got = openGifts()
    expect(got.map((o) => o.box)).toEqual(all)
    expect(farm.coins - coins).toBe(got.reduce((n, o) => n + ('coins' in o.prize ? o.prize.coins : 0), 0))
    expect(giftsWaiting()).toEqual([])
    expect(farm.gifts).toMatchObject({ open: boxAt(7, 2), also: [] })
    expect(openGifts()).toEqual([])
    expect(farm.coins - coins).toBe(got.reduce((n, o) => n + ('coins' in o.prize ? o.prize.coins : 0), 0))
  })

  it('out of turn: this level’s box tapped while older ones wait; what it gave stays on its bar; the older ones open later, once', () => {
    at(boxXp(boxAt(6, 2))) // level 6's third box
    const mine = boxAt(6, 2)
    const older = Array.from({ length: mine }, (_, k) => k).filter(isBox)
    expect(openGifts([mine])).toHaveLength(1)
    // (the places with no box before the first one count as opened)
    expect(farm.gifts).toMatchObject({ open: boxAt(1, 3), also: [mine], gave: [{ box: mine, prize: { coins: boxCoins(6, 2) } }] })
    expect(giftsWaiting()).toEqual(older)
    // the card: its box open with what it gave, the two before it ready, the last locked; ten waiting, eight earlier
    const v = levelView(farm.xp.points, farm.xp.paid, farm.gifts)
    expect(v.boxes.map((b) => b.state)).toEqual(['ready', 'ready', 'open', 'locked'])
    expect(v.boxes[2].prize).toEqual({ coins: boxCoins(6, 2) })
    expect(v.boxes[3].xp).toBe(xpAt(7) - farm.xp.points)
    expect([v.waiting.length, v.earlier]).toEqual([10, 8])
    expect(openGifts().map((o) => o.box)).toEqual(older)
    expect(farm.gifts).toMatchObject({ open: mine + 1, also: [] })
    expect(farm.gifts.gave.map((o) => o.box)).toEqual([boxAt(6, 0), boxAt(6, 1), mine])
  })

  it('goods go in even past full (as surprises do: refused, they would be lost); a material when the farm makes nothing yet', () => {
    farm.made.push('egg')
    farm.inv.egg = 50 // the barn full
    at(boxXp(boxAt(5, 1)))
    setRandom(always(0.99)) // a few of a good the farm makes: eggs
    expect(openGifts([boxAt(5, 1)])).toEqual([{ box: boxAt(5, 1), prize: { item: 'egg', n: 3 } }])
    expect(farm.inv.egg).toBe(53)
    farm.made.length = 0
    expect(openGifts([boxAt(5, 0)])).toEqual([{ box: boxAt(5, 0), prize: { item: ITEMS[5], n: 1 } }])
    expect(farm.inv[ITEMS[5]]).toBe(1)
  })

  it('no XP: a gift opened is not something done (no points, no level-up show)', () => {
    at(boxXp(boxAt(4, 2)))
    const { points } = farm.xp
    const events = xpEventCount()
    openGifts()
    expect([farm.xp.points, xpEventCount()]).toEqual([points, events])
    expect(takeFx().filter((f) => f.kind === 'xp')).toEqual([])
  })
})

describe('a level reached', () => {
  it('by play: its coins and a few of a building material come in by themselves (no Claim), rolled on the dice and told once', () => {
    at(xpAt(2) - 1)
    setRandom(always(0.99)) // the last of the six
    const before = purse()
    gainXp('build')
    expect(levelOf(farm.xp.points)).toBe(2)
    const gift = rollArrival(2, always(0.99))
    expect(farm.gifts.came).toEqual([{ level: 2, coins: levelReward(2), prize: gift }])
    expect(farm.inv[ITEMS[5]]).toBe(before.inv[ITEMS[5]] + (gift as { n: number }).n)
    // its coins: in, once; nothing left to claim
    expect(farm.coins).toBe(before.coins + levelReward(2))
    expect([farm.xp.paid, xpNow().unpaid, claimLevel()]).toEqual([2, 0, 0])
    gainXp('build')
    expect(farm.coins).toBe(before.coins + levelReward(2))
    // the card tells it until it has been seen
    expect(levelView(farm.xp.points, farm.xp.paid, farm.gifts).arrived).toEqual({ coins: levelReward(2), prize: gift })
    sawLevel()
    expect(farm.gifts.seen).toBe(2)
    expect(levelView(farm.xp.points, farm.xp.paid, farm.gifts).arrived).toBeUndefined()
  })

  it('several at once: a gift for each, once; the new level’s bar starts with nothing it gave', () => {
    at(xpAt(3) + 5)
    openGifts([boxAt(3, 0)].filter((k) => k < boxesReached(farm.xp.points)))
    const coins = farm.coins
    gainXp('goal', Math.ceil((xpAt(6) - farm.xp.points) / XP_FOR.goal))
    expect(levelOf(farm.xp.points)).toBe(6)
    expect(farm.gifts.came.map((c) => c.level)).toEqual([4, 5, 6])
    expect(farm.coins).toBe(coins + levelReward(4) + levelReward(5) + levelReward(6))
    expect(farm.gifts.gave).toEqual([])
    // more XP within the level: no more gifts
    gainXp('build')
    expect(farm.gifts.came.map((c) => c.level)).toEqual([4, 5, 6])
  })

  it('not by play: a level loaded, switched to or set brings nothing', () => {
    at(xpAt(7))
    const before = purse()
    expect(farm.gifts.came).toEqual([])
    startFrom(justSaved(savedNow()))
    expect(farm.gifts.came).toEqual([])
    expect(purse()).toEqual(before)
  })
})

describe('the save', () => {
  it('kept: what was opened stays opened after a load — nothing given twice — and what waits still waits', () => {
    at(boxXp(boxAt(6, 1)))
    openGifts([boxAt(6, 1)])
    const saved = savedNow()
    expect(saved.gifts).toEqual(farm.gifts)
    resetFarm()
    startFrom(justSaved(saved))
    expect(farm.gifts).toEqual(saved.gifts)
    expect(openGifts([boxAt(6, 1)])).toEqual([])
    expect(giftsWaiting()).toEqual(Array.from({ length: boxAt(6, 1) }, (_, k) => k).filter(isBox))
  })

  it('a farm from before the gifts: the boxes its level reached so far wait for it, the levels before are not given again', () => {
    try {
      startFrom(justSaved(OLD_SAVE))
      const points = seedXp(farm.stats)
      expect(farm.xp.points).toBe(points)
      const level = levelOf(points)
      expect(giftsWaiting()).toEqual(Array.from({ length: boxesReached(points) - boxAt(level, 0) }, (_, k) => boxAt(level, 0) + k).filter(isBox))
      expect(farm.gifts).toMatchObject({ open: boxAt(level, 0), came: [], seen: level })
    } finally {
      switchSlot(1)
    }
  })
})

describe('what is ready on the farm (the card’s ghost on the bar)', () => {
  it('the ripe beds of a crop: its goods and two XP a bed; nothing where its building has no room; null when nothing waits', () => {
    // a new farm: the tree's lemons are worth the most (three, one XP each)
    expect(readyOnFarm()).toEqual({ id: 'lemon', n: 3, xp: 3 * XP_FOR.collect })
    for (const p of Object.values(farm.producers)) p.stock = p.stock.map(() => 0)
    expect(readyOnFarm()).toBeNull()
    const beds = BEDS.flatMap((b, i) => (farm.beds[i].built && !b.expansion ? [i] : [])).slice(0, 3)
    for (const i of beds) Object.assign(farm.beds[i], { crop: 'lettuce', growth: cropById('lettuce').growSeconds, water: 0 })
    expect(readyOnFarm()).toEqual({ id: 'lettuce', n: beds.length * cropById('lettuce').yield, xp: beds.length * XP_FOR.harvest })
    farm.inv.wheat = 50 // the silo full
    expect(readyOnFarm()).toBeNull()
  })
})
