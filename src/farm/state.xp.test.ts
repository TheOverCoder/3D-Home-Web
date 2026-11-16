// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { takeFx } from '../fx/fx'
import { useHome } from '../store'
import { BEDS, LEVELS, MACHINES, OFFICE_SCREEN, XP_FOR, cropById } from './data'
import { goalById, goalTarget } from './goals'
import {
  acceptOffer,
  addJob,
  buildBed,
  buy,
  buyLand,
  buyOffice,
  buyPiece,
  cameBack,
  claimGoal,
  claimLevel,
  collect,
  collectMachine,
  declineOffer,
  declineOrder,
  emptyPlace,
  farm,
  fillOrder,
  fillPlace,
  fixBed,
  gainXp,
  harvestBeds,
  importSlot,
  marketFill,
  moveJob,
  movePlace,
  orderAt,
  plantBeds,
  removeJob,
  resetFarm,
  sellAll,
  sendOrder,
  setPlacePrice,
  setRandom,
  spawnVisitor,
  sawWardrobe,
  switchSlot,
  tick,
  upgradeStore,
  waterBeds,
  wearGarment,
  xpEventCount,
  xpNow,
} from './state'
import { DEFAULT_OUTFIT, garmentAt } from './outfit'
import { OLD_SAVE, justSaved, savedNow, startFrom } from './testSaves'
import { levelOf, levelReward, xpAt, xpForSale } from './xp'

// Levels (src/farm/xp.ts; gainXp in src/farm/state.ts): every thing the player does is worth XP, counted once in the one
// function every way to do it goes through — a press on many beds is that many beds' XP, never more — and nothing the
// farm does by itself (time, time away, a load) is worth any.

/** Nothing ever comes up on the farm's dice (no surprises). */
const never = () => 0.99

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  setRandom(never)
  takeFx()
})
afterEach(() => setRandom(null))

/** The XP and the level-up show's events an action brings. */
function gained(action: () => unknown) {
  const points = farm.xp.points
  const events = xpEventCount()
  action()
  return { xp: farm.xp.points - points, events: xpEventCount() - events }
}

/** Beds built on a new farm (none on land to buy). */
const built = () => farm.beds.flatMap((b, i) => (b.built && !BEDS[i].expansion ? [i] : []))
const ripe = (i: number) => Object.assign(farm.beds[i], { built: true, crop: 'lettuce', growth: cropById('lettuce').growSeconds, water: 0 })

describe('XP for each thing done, once, however many at a press', () => {
  it('planting three beds at a press is three plantings; watering only beds that needed it (under half their water)', () => {
    const beds = built().slice(0, 3)
    expect(beds.length).toBe(3)
    expect(gained(() => plantBeds(beds, 'lettuce'))).toEqual({ xp: 3 * XP_FOR.plant, events: 3 })
    // just planted: a good soak, so watering them gives nothing
    expect(gained(() => waterBeds(beds)).xp).toBe(0)
    const full = farm.beds[beds[0]].water
    farm.beds[beds[0]].water = 0
    farm.beds[beds[1]].water = full / 2 - 0.01
    farm.beds[beds[2]].water = full / 2
    expect(gained(() => waterBeds(beds))).toEqual({ xp: 2 * XP_FOR.water, events: 2 })
  })

  it('three beds harvested at a press: three harvests (not the crops in them)', () => {
    const beds = built().slice(0, 3)
    beds.forEach(ripe)
    expect(gained(() => harvestBeds(beds))).toEqual({ xp: 3 * XP_FOR.harvest, events: 3 })
  })

  it('collecting gives XP for each good taken; a machine none for a job put in (it can come out again), its XP for each job taken out', () => {
    farm.producers.hens.stock[0] = 5
    expect(gained(() => collect('hens')).xp).toBe(5 * XP_FOR.collect)
    farm.inv.wheat = 8
    expect(gained(() => [0, 1, 2].map(() => addJob('mill', 'wheat')))).toEqual({ xp: 0, events: 0 })
    tick(60)
    expect(gained(() => collectMachine('mill'))).toEqual({ xp: 3 * XP_FOR.make, events: 1 })
  })

  it('a sale is worth its coins: three buyers sold to at a press, each sale on its own', () => {
    farm.inv.egg = 10
    const offers = [4, 12, 31]
    for (const offer of offers) spawnVisitor({ want: 'egg', qty: 1, offer, queued: true })
    expect(gained(() => sellAll())).toEqual({ xp: offers.reduce((n, c) => n + xpForSale(c), 0), events: 3 })
    const v = spawnVisitor({ want: 'egg', qty: 1, offer: 7, queued: true })
    expect(gained(() => acceptOffer(v.id)).xp).toBe(xpForSale(7))
  })

  it('an order sent: an order, and a sale of what it pays', () => {
    tick(0.01)
    const o = orderAt(0)!
    for (const l of o.lines) farm.inv[l.good] = l.want
    fillOrder(0)
    expect(gained(() => sendOrder(0)).xp).toBe(XP_FOR.order + xpForSale(o.coins))
  })

  it('building and buying for the farm: a bed, an upgrade, a field, the office, a bigger barn — each a build', () => {
    farm.coins = 10_000
    const staked = BEDS.findIndex((b, i) => !b.expansion && !farm.beds[i].built)
    for (const act of [() => buildBed(staked), () => buy('sprinkler'), () => buyLand('north'), () => buyOffice('slots')]) expect(gained(act).xp).toBe(XP_FOR.build)
    Object.assign(farm.inv, { brick: 1, plank: 1, nail: 1 })
    expect(gained(() => upgradeStore('barn')).xp).toBe(XP_FOR.build)
  })

  it('a goal claimed', () => {
    farm.got.egg = goalTarget(goalById('eggs'), 0)
    expect(gained(() => claimGoal('eggs')).xp).toBe(XP_FOR.goal)
  })

  it('nothing for what can be undone for free or is turned down: furniture, moving a place, a bed set, the shelves, prices, declining', () => {
    farm.coins = 10_000
    farm.inv.egg = 4
    marketFill('egg')
    const v = spawnVisitor({ want: 'egg', qty: 1, offer: 3, queued: true })
    tick(0.01)
    const none = [
      () => buyPiece('stool'),
      () => movePlace('hens', { ...farm.layout.places.hens }),
      () => fixBed(0, 'carrot'),
      () => emptyPlace(0),
      () => fillPlace(0, 'egg', 2),
      () => setPlacePrice(1, 200),
      () => declineOffer(v.id),
      () => declineOrder(0),
      // a job into a machine's queue, moved, taken out again
      () => addJob('loom', 'wool'),
      () => addJob('loom', 'wool'),
      () => moveJob('loom', 1, 1),
      () => removeJob('loom', 1),
    ]
    farm.inv.wool = 2
    for (const act of none) expect(gained(act)).toEqual({ xp: 0, events: 0 })
    expect(farm.machines.loom.jobs).toEqual(['wool'])
  })

  it('nothing for time passing, in play or away: what grows, fills, finishes, comes and buys by itself', () => {
    farm.coins = 10_000
    farm.started = true
    for (const i of built()) ripe(i)
    farm.inv.wheat = 8
    for (let k = 0; k < 3; k++) addJob('mill', 'wheat')
    marketFill('egg')
    setRandom(() => 0)
    expect(
      gained(() => {
        for (let t = 0; t < 300; t += 0.5) tick(0.5)
        cameBack(3600)
      }),
    ).toEqual({ xp: 0, events: 0 })
    // the shop did sell (its till took coins) and the line did come
    expect(farm.market.till.coins).toBeGreaterThan(0)
  })
})

describe('gainXp, the level and its coins', () => {
  it('a sale gives one XP for every five coins, at least one; nothing for nothing', () => {
    expect(gained(() => gainXp('sale', 23)).xp).toBe(5)
    expect(gained(() => gainXp('sale', 1)).xp).toBe(1)
    expect(gained(() => gainXp('sale', 0))).toEqual({ xp: 0, events: 0 })
    expect(gained(() => gainXp('plant', 0))).toEqual({ xp: 0, events: 0 })
    expect(gained(() => gainXp('build', 2)).xp).toBe(2 * XP_FOR.build)
  })

  it('the crystals fly from the point given (a bed, a machine, the office), with the XP they bring', () => {
    takeFx()
    gainXp('order', 1, OFFICE_SCREEN)
    expect(takeFx()).toContainEqual(expect.objectContaining({ kind: 'xp', x: OFFICE_SCREEN.x, y: OFFICE_SCREEN.y, z: OFFICE_SCREEN.z, xp: XP_FOR.order }))
    const bed = built()[0]
    plantBeds([bed], 'carrot')
    expect(takeFx()).toContainEqual(expect.objectContaining({ kind: 'xp', x: BEDS[bed].x, y: 0.7, z: BEDS[bed].z }))
    farm.inv.wool = 1
    addJob('loom', 'wool')
    tick(10)
    collectMachine('loom')
    const loom = MACHINES.loom
    expect(takeFx()).toContainEqual(expect.objectContaining({ kind: 'xp', x: loom.x + loom.sparkle[0], y: loom.sparkle[1], z: loom.z + loom.sparkle[2] }))
    // with no point to name (a claim, a panel's sale), they still fly: from low in the middle of the screen (src/fx/xp.ts
    // takes a point that is not a number so)
    gainXp('goal')
    const [noPoint] = takeFx()
    expect(noPoint).toMatchObject({ kind: 'xp', xp: XP_FOR.goal })
    expect([noPoint.x, noPoint.y, noPoint.z].every(Number.isNaN)).toBe(true)
  })

  it('xpNow: the level, how far into it, and no coins waiting (a level reached paid its own)', () => {
    gainXp('build', 40) // 200 XP: level 3 (90) passed, level 4 at 180
    const now = xpNow()
    expect(now.level).toBe(levelOf(200))
    expect(now.level).toBe(4)
    expect([now.points, now.into, now.need]).toEqual([200, 200 - xpAt(4), xpAt(5) - xpAt(4)])
    expect(now.unpaid).toBe(0)
  })

  it('a level reached by play pays its coins by itself, every level once (three at once: all three), and no XP for them', () => {
    const coins = farm.coins
    const before = gained(() => gainXp('build', 40))
    expect(before).toEqual({ xp: 40 * XP_FOR.build, events: 1 })
    const due = (2 + 3 + 4) * LEVELS.reward
    expect(farm.coins).toBe(coins + due)
    expect(farm.xp.paid).toBe(4)
    expect(farm.gifts.came.map((c) => [c.level, c.coins])).toEqual([
      [2, levelReward(2)],
      [3, levelReward(3)],
      [4, levelReward(4)],
    ])
    // nothing more to claim, and more XP within the level pays nothing
    expect(claimLevel()).toBe(0)
    gainXp('build')
    expect(farm.coins).toBe(coins + due)
    // the next level (305 XP: level 5), its own coins only
    gainXp('build', 20)
    expect(levelOf(farm.xp.points)).toBe(5)
    expect(farm.coins).toBe(coins + due + levelReward(5))
  })

  it('claiming pays coins still waiting (set by hand: play pays its own), up to the level given, once', () => {
    gainXp('build', 40) // level 4 reached, paid
    farm.xp.paid = 1
    const coins = farm.coins
    expect(xpNow().unpaid).toBe(levelReward(2) + levelReward(3) + levelReward(4))
    expect(claimLevel(3)).toBe(levelReward(2) + levelReward(3))
    expect([farm.xp.paid, farm.coins - coins, xpNow().unpaid]).toEqual([3, levelReward(2) + levelReward(3), levelReward(4)])
    expect(claimLevel(3)).toBe(0)
    expect(claimLevel(2)).toBe(0)
    // past the level reached: only up to it; not a number: nothing
    expect(claimLevel(NaN)).toBe(0)
    expect(claimLevel(99)).toBe(levelReward(4))
    expect([farm.xp.paid, xpNow().unpaid]).toEqual([4, 0])
    expect(useHome.getState().toast?.text).toBe(`Level 4 · + ${levelReward(4)} coins`)
  })

  it('a farm saved with levels reached and their coins not claimed (from when they waited for a Claim) is paid them as it loads, once', () => {
    gainXp('build', 40)
    const saved = savedNow()
    const coins = farm.coins
    // as such a farm was saved: level 4, paid up to level 1
    const owed = { ...saved, xp: { points: (saved.xp as { points: number }).points, paid: 1 } }
    const events = xpEventCount()
    try {
      startFrom(justSaved(owed))
      expect(farm.coins).toBe(coins + levelReward(2) + levelReward(3) + levelReward(4))
      expect([farm.xp.paid, xpNow().unpaid]).toEqual([4, 0])
      // saved and loaded again: not paid twice
      startFrom(justSaved(savedNow()))
      expect(farm.coins).toBe(coins + levelReward(2) + levelReward(3) + levelReward(4))
      // and no level-up show for it (a load is not play)
      expect(xpEventCount()).toBe(events)
    } finally {
      switchSlot(1)
    }
  })

  it('time away reaches no level (XP comes only from what the player does): nothing paid twice, every level reached paid', () => {
    gainXp('build', 20)
    const xp = farm.xp.points
    const came = farm.gifts.came.length
    cameBack(3 * 3600)
    expect([farm.xp.points, farm.xp.paid, farm.gifts.came.length]).toEqual([xp, levelOf(xp), came])
  })

  it('only play raises the events the level-up show listens to: not a reset, a load, a switch, an import or an old farm seeded', () => {
    gainXp('build', 30)
    const events = xpEventCount()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 10, 10, 12))
    try {
      startFrom(justSaved(OLD_SAVE))
      // a farm from before levels: XP for what it did, its levels paid already
      expect(farm.xp.points).toBeGreaterThan(0)
      expect(farm.xp.paid).toBe(levelOf(farm.xp.points))
      switchSlot(1)
      expect(importSlot(2, JSON.stringify({ kind: '3d-home-farm-save', version: 1, slot: 2, save: justSaved(OLD_SAVE) }))).toEqual({ ok: true })
      resetFarm()
      expect(xpEventCount()).toBe(events)
    } finally {
      switchSlot(1)
      vi.useRealTimers()
    }
  })
})

describe('the wardrobe', () => {
  it('a garment the level has goes on, is saved and loads back; one not reached, and clothes, give nothing', () => {
    expect(farm.outfit).toEqual(DEFAULT_OUTFIT)
    const later = garmentAt(5)!
    const before = gained(() => expect(wearGarment(later.id)).toBe(false))
    expect(farm.outfit.shirt).toBe(DEFAULT_OUTFIT.shirt)
    expect(before).toEqual({ xp: 0, events: 0 })
    expect(wearGarment('cap-navy')).toBe(true)
    expect(wearGarment('shirt-rust')).toBe(true)
    const saved = savedNow()
    expect(saved.outfit).toMatchObject({ shirt: 'shirt-rust', hat: 'cap-navy' })
    try {
      // the save loaded into another slot: the same clothes
      resetFarm()
      startFrom(saved)
      expect(farm.outfit).toMatchObject({ shirt: 'shirt-rust', trousers: 'trousers-charcoal', hat: 'cap-navy' })
      // the level that brings it: then it goes on
      gainXp('build', Math.ceil(xpAt(5) / 5))
      expect(levelOf(farm.xp.points)).toBeGreaterThanOrEqual(5)
      expect(wearGarment(later.id)).toBe(true)
      expect(farm.outfit.shirt).toBe(later.id)
    } finally {
      switchSlot(1)
    }
  })

  it('what is new is what came since the wardrobe was last open; a farm from before the wardrobe wears what it always wore', () => {
    gainXp('build', Math.ceil(xpAt(12) / 5))
    expect(farm.outfit.seen).toBe(1)
    sawWardrobe()
    expect(farm.outfit.seen).toBe(levelOf(farm.xp.points))
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 10, 10, 12))
    try {
      startFrom(justSaved(OLD_SAVE))
      expect(farm.outfit).toEqual(DEFAULT_OUTFIT)
    } finally {
      switchSlot(1)
      vi.useRealTimers()
    }
  })
})
