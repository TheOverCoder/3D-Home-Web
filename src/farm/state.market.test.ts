// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BROWSE_SPOTS, MANAGER_SPOT, PAY_SPOT } from '../data/market'
import { useHome } from '../store'
import { LADDERS, MANAGER, SHOP, XP_FOR, produceById } from './data'
import { MAX_PLACES, ladderPrice, managerPay, managerPct, shopperEvery, shoppersAtOnce, unitPrice } from './market'
import {
  MOST_SHOPPERS,
  awayNews,
  buyLadder,
  buyMarket,
  cameBack,
  emptyPlace,
  farm,
  fillPlace,
  ladderOpen,
  managerNow,
  managerPays,
  marketFill,
  resetFarm,
  restockPlaces,
  sellAllToManager,
  sellToManager,
  setPlacePrice,
  setRandom,
  shoppersNow,
  switchSlot,
  takeTill,
  tick,
  tillReady,
} from './state'
import { savedNow, seeded, startFrom } from './testSaves'
import { xpForSale } from './xp'

// The supermarket in play (src/farm/state.ts; its rules in src/farm/market.ts): the manager buys what you sell him at
// his rate until you buy the shop from him; then your shelves, the shoppers who come and buy on the farm's dice, and the
// till you take.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  setRandom(() => 0.99)
})
afterEach(() => setRandom(null))

/** The manager's rate to its top and the shop bought. */
function ownShop() {
  farm.coins = 100_000
  for (let k = 0; k < LADDERS.rate.levels; k++) expect(buyLadder('rate')).toBe(true)
  expect(buyMarket()).toBe(true)
}
/** Plays on in frames of a quarter second. */
const play = (seconds: number) => {
  for (let t = 0; t < seconds; t += 0.25) tick(0.25)
}

describe('the manager', () => {
  it('buys the whole stack of a good at his rate, rounded down, as a sale (coins, the stats, XP)', () => {
    farm.inv.lettuce = 5
    const before = { ...farm.stats, coins: farm.coins, xp: farm.xp.points }
    const pay = managerPay(produceById('lettuce').price, 5, MANAGER.pct)
    expect(pay).toBe(3)
    expect(managerPays('lettuce')).toBe(3)
    expect(sellToManager('lettuce')).toBe(3)
    expect([farm.inv.lettuce, farm.coins, farm.stats.sold, farm.stats.earned, farm.xp.points]).toEqual([0, before.coins + 3, before.sold + 5, before.earned + 3, before.xp + xpForSale(3)])
    // a sale that would pay nothing is no sale; a building material is not his
    farm.inv.carrot = 1
    expect(sellToManager('carrot')).toBe(0)
    expect(farm.inv.carrot).toBe(1)
    farm.inv.brick = 9
    expect([managerPays('brick'), sellToManager('brick'), farm.inv.brick]).toEqual([0, 0, 9])
  })

  it('sells him everything he pays for at a press: one word, each good its own sale', () => {
    Object.assign(farm.inv, { lettuce: 5, pumpkin: 3, carrot: 1, brick: 4 })
    const xp = farm.xp.points
    const each = [managerPays('lettuce'), managerPays('pumpkin')]
    const coins = each[0] + each[1]
    expect(sellAllToManager()).toBe(coins)
    expect([farm.inv.lettuce, farm.inv.pumpkin, farm.inv.carrot, farm.inv.brick]).toEqual([0, 0, 1, 4])
    expect(farm.xp.points - xp).toBe(xpForSale(each[0]) + xpForSale(each[1]))
    expect(useHome.getState().toast?.text).toBe(`+ ${coins} coins · 8 goods to the manager`)
    expect(sellAllToManager()).toBe(0)
  })

  it('his rate climbs in steps of its ladder; at its top the shop is for sale, and he walks out once it is yours', () => {
    farm.coins = 100_000
    expect(buyMarket()).toBe(false) // not for sale below his top rate
    for (let k = 0; k < LADDERS.rate.levels; k++) {
      expect(ladderOpen('rate')).toBe(true)
      const coins = farm.coins
      expect(buyLadder('rate')).toBe(true)
      expect(coins - farm.coins).toBe(ladderPrice('rate', k))
    }
    expect([ladderOpen('rate'), buyLadder('rate'), managerPct(farm.ladders.rate)]).toEqual([false, false, 40])
    // the shop's own ladders wait for the shop
    expect(['places', 'group', 'pace'].map((id) => ladderOpen(id as 'places'))).toEqual([false, false, false])
    expect(managerNow()).toMatchObject({ x: MANAGER_SPOT.x, z: MANAGER_SPOT.z, walking: false })
    const xp = farm.xp.points
    const coins = farm.coins
    expect(buyMarket()).toBe(true)
    expect([farm.market.owned, coins - farm.coins, farm.xp.points - xp]).toEqual([true, MANAGER.shopPrice, XP_FOR.shop])
    expect(buyMarket()).toBe(false)
    // he waves, then goes; he buys no more
    expect(managerNow()).toMatchObject({ pose: 'stand' })
    tick(0.5)
    expect(managerNow()?.pose).toBe('wave')
    play(4)
    expect(managerNow()?.walking).toBe(true)
    play(60)
    expect(managerNow()).toBeNull()
    farm.inv.pumpkin = 3
    expect(sellToManager('pumpkin')).toBe(0)
    expect(['places', 'group', 'pace', 'rate'].map((id) => ladderOpen(id as 'places'))).toEqual([true, true, true, false])
  })

  it('a shop bought is yours on a reload: he is gone, nobody walks', () => {
    ownShop()
    startFrom(savedNow())
    expect([farm.market.owned, managerNow(), shoppersNow().length]).toEqual([true, null, 0])
    switchSlot(1)
  })
})

describe('your shelves', () => {
  beforeEach(ownShop)

  it('a place takes up to three of one good from the silo or the barn; its good changes only once it is empty; only open places', () => {
    farm.inv.lettuce = 5
    expect(fillPlace(0, 'lettuce', 2)).toBe(2)
    expect(fillPlace(0, 'lettuce', 3)).toBe(1) // three at most
    expect(farm.inv.lettuce).toBe(2)
    farm.inv.carrot = 4
    expect(fillPlace(0, 'carrot', 1)).toBe(0)
    expect(fillPlace(SHOP.places, 'carrot', 1)).toBe(0) // not open yet
    expect(fillPlace(1, 'brick' as 'carrot', 1)).toBe(0) // not a good that sells
    expect(fillPlace(1, 'carrot', 9)).toBe(3)
    expect(farm.market.shelves.slice(0, 2)).toEqual([
      { good: 'lettuce', units: 3, pct: SHOP.pct.start },
      { good: 'carrot', units: 3, pct: SHOP.pct.start },
    ])
    expect(buyLadder('places')).toBe(true)
    expect(fillPlace(SHOP.places, 'carrot', 1)).toBe(1)
  })

  it('emptying puts the units back even past full and frees the place; a price snaps to its range and step', () => {
    farm.inv.egg = 3
    fillPlace(0, 'egg', 3)
    farm.inv.milk = 200 // the barn full
    expect(emptyPlace(0)).toBe(3)
    expect([farm.inv.egg, farm.market.shelves[0].good, farm.market.shelves[0].units]).toEqual([3, null, 0])
    for (const [pct, set] of [
      [147, 150],
      [5, SHOP.pct.min],
      [1e9, SHOP.pct.max],
      [NaN, SHOP.pct.start],
    ]) {
      setPlacePrice(0, pct)
      expect(farm.market.shelves[0].pct, String(pct)).toBe(set)
    }
  })

  it('restocking: five lettuces over three sold-out places fill three and two', () => {
    for (let k = 0; k < 3; k++) Object.assign(farm.market.shelves[k], { good: 'lettuce', units: 0 })
    farm.inv.lettuce = 5
    expect(restockPlaces([0, 1, 2])).toBe(5)
    expect(farm.market.shelves.slice(0, 3).map((s) => s.units)).toEqual([3, 2, 0])
    expect(farm.inv.lettuce).toBe(0)
    // a place never set is not restocked
    expect(restockPlaces([3, 4])).toBe(0)
  })
})

describe('shoppers and the till', () => {
  beforeEach(ownShop)

  it('the countdown holds at 0 while the shelves are empty; stocked, a visit comes at once and buys (dice 0: everything)', () => {
    play(SHOP.every + 5)
    expect([farm.market.nextIn, shoppersNow().length]).toEqual([0, 0])
    farm.inv.lettuce = 3
    fillPlace(0, 'lettuce', 3)
    setPlacePrice(0, 150)
    setRandom(() => 0)
    tick(0.1)
    expect(shoppersNow().length).toBe(shoppersAtOnce(0))
    expect(farm.market.nextIn).toBeCloseTo(shopperEvery(0), 0)
    // they walk in from a lane end to a browse spot, browse, and only then buy; what they bought is in the till as they
    // set off to pay at the counter; then they leave
    expect(shoppersNow()[0].walking).toBe(true)
    const till = { coins: 3 * unitPrice(produceById('lettuce').price, 150), goods: 3 }
    const seen = new Set<string>()
    for (let t = 0; t < 200 && shoppersNow().length; t += 0.25) {
      tick(0.25)
      const p = shoppersNow()[0]
      if (!p) break
      if (p.pose === 'browse') expect(farm.market.till.coins).toBe(0)
      if (p.pose === 'pay') {
        expect([p.x, p.z]).toEqual([PAY_SPOT.x, PAY_SPOT.z])
        expect(farm.market.till).toEqual(till)
      }
      seen.add(p.pose)
    }
    expect([...seen].sort()).toEqual(['browse', 'pay', 'stand'])
    expect(shoppersNow().length).toBe(0)
    expect(farm.market.shelves[0]).toEqual({ good: 'lettuce', units: 0, pct: 150 })
  })

  /** A long run at these ladder steps (the dice seeded, the shelves kept full): how many shoppers came, against how
   *  many the ladders say; the most about at once; whether two ever browsed at one spot at once. */
  function longRun(group: number, pace: number, seconds = 3600) {
    resetFarm()
    ownShop()
    for (let k = 0; k < group; k++) buyLadder('group')
    for (let k = 0; k < pace; k++) buyLadder('pace')
    marketFill('lettuce')
    setRandom(seeded(group * 10 + pace + 1))
    const came = new Set<number>()
    let most = 0
    let shared = false
    const spots = new Set<number>()
    for (let t = 0; t < seconds; t += 0.25) {
      tick(0.25)
      const now = shoppersNow()
      most = Math.max(most, now.length)
      const browsing = now.filter((p) => p.pose === 'browse').map((p) => BROWSE_SPOTS.findIndex((b) => Math.hypot(b.x - p.x, b.z - p.z) < 1e-6))
      if (new Set(browsing).size < browsing.length) shared = true
      for (const k of browsing) spots.add(k)
      for (const p of now) came.add(p.id)
      for (const sh of farm.market.shelves) sh.units = SHOP.units
    }
    const nominal = (seconds / shopperEvery(pace)) * shoppersAtOnce(group)
    return { share: came.size / nominal, most, shared, spots: spots.size }
  }

  it('shoppers come at the pace the ladders say, each browsing at a spot nobody else is at, never more about than the crowd has places for', () => {
    for (const [group, pace] of [
      [0, 0],
      [0, 4],
      [1, 4],
      [3, 0],
      [3, 3],
      [2, 4],
      [LADDERS.group.levels, LADDERS.pace.levels],
    ]) {
      const r = longRun(group, pace)
      const at = `group ${group}, pace ${pace}`
      expect(r.share, at).toBeGreaterThan(0.97)
      expect(r.share, at).toBeLessThan(1.03)
      expect(r.most, at).toBeLessThanOrEqual(MOST_SHOPPERS)
      expect(r.shared, at).toBe(false)
    }
  })

  it('a busier shop works at once: its next visit no later than its new wait', () => {
    farm.coins = 100_000
    expect(farm.market.nextIn).toBe(SHOP.every)
    expect(buyLadder('pace')).toBe(true)
    expect(farm.market.nextIn).toBe(shopperEvery(1))
  })

  it('the till: on the compass with its coins once it holds enough, or the shelves are empty; taking it is a sale', () => {
    expect(tillReady()).toBeNull()
    farm.inv.lettuce = 1
    fillPlace(0, 'lettuce', 1)
    farm.market.till = { coins: SHOP.readyAt - 1, goods: 20 }
    expect(tillReady()).toBeNull()
    farm.market.till.coins = SHOP.readyAt
    expect(tillReady()).toEqual({ item: 'coin', count: SHOP.readyAt })
    farm.market.till.coins = 7
    emptyPlace(0)
    expect(tillReady()).toEqual({ item: 'coin', count: 7 })
    const before = { coins: farm.coins, sold: farm.stats.sold, earned: farm.stats.earned, xp: farm.xp.points }
    expect(takeTill()).toBe(7)
    expect([farm.coins - before.coins, farm.stats.sold - before.sold, farm.stats.earned - before.earned, farm.xp.points - before.xp]).toEqual([7, 20, 7, xpForSale(7)])
    expect([farm.market.till, tillReady(), takeTill()]).toEqual([{ coins: 0, goods: 0 }, null, 0])
  })

  it('while you are away the visits go on with the same rolls: the card tells what sold and the coins in the till', () => {
    farm.coins = 100_000
    buyLadder('group')
    marketFill('pumpkin')
    farm.market.nextIn = 10
    setRandom(() => 0)
    const r = cameBack(15)!
    // one visit of two: the first takes everything
    expect(r.shop).toEqual({ goods: MAX_PLACES * SHOP.units, coins: MAX_PLACES * SHOP.units * produceById('pumpkin').price })
    expect(awayNews(r)).toBe(true)
    expect(shoppersNow().length).toBe(0)
    expect(farm.market.nextIn).toBe(shopperEvery(0) - 5)
    // nothing on the shelves: nothing sold, no line on the card, the countdown waits at 0
    const quiet = cameBack(3600)!
    expect([quiet.shop, farm.market.nextIn]).toEqual([null, 0])
  })

  it('shoppers inside are not kept: on a reload they are gone, what they bought already in the till', () => {
    marketFill('egg')
    farm.market.nextIn = 0
    setRandom(() => 0)
    tick(0.1)
    expect(shoppersNow().length).toBeGreaterThan(0)
    startFrom(savedNow())
    expect(shoppersNow().length).toBe(0)
    switchSlot(1)
  })

  it('goods on the shelves and coins in the till keep a farm from being stuck (no neighbour leaves coins)', () => {
    farm.coins = 0
    farm.inv.egg = 1
    fillPlace(0, 'egg', 1)
    tick(0.1)
    expect(farm.coins).toBe(0)
    emptyPlace(0)
    farm.inv.egg = 0
    farm.market.till = { coins: 3, goods: 1 }
    tick(0.1)
    expect(farm.coins).toBe(0)
    farm.market.till = { coins: 0, goods: 0 }
    tick(0.1)
    expect(farm.coins).toBe(6)
  })
})
