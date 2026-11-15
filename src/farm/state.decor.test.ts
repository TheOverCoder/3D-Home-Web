// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BEDS, PRODUCERS, XP_FOR, storeOf } from './data'
import { FRUIT_KINDS, SHOP, nextPrice } from './decor'
import { PLACES, bedHome, canPlace } from './layout'
import {
  bedSpot,
  bedsNear,
  buyDecor,
  collect,
  decorOwned,
  decorPrice,
  farm,
  freezeDay,
  machinePoint,
  moveBed,
  moveDecor,
  movePlace,
  placeDecor,
  plant,
  plantOf,
  resetFarm,
  setRandom,
  shopView,
  spawnVisitor,
  stockOf,
  storeDecor,
  tick,
  xpNow,
} from './state'
import { savedNow, startFrom } from './testSaves'

// The edit mode's shop and what it sells (src/farm/decor.ts, the rules in src/farm/layout.ts): bought for its price,
// each one dearer than the last; put down, moved, put away into the farm's store and down again for nothing; a fruit
// tree or bush a producer of its own (PRODUCERS), its fruit kept in the silo; the beds and the kitchen moved; all of it
// kept in the save.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
  setRandom(() => 0.99)
})
afterEach(() => {
  freezeDay(false)
  setRandom(null)
})

const at = (x: number, z: number, rot = 0) => ({ x, z, rot })

describe('buying', () => {
  it('a yard lamp costs 200, the next 240, 280, 320: counted from what the farm has, standing or stored', () => {
    farm.coins = 10_000
    const paid: number[] = []
    for (let k = 0; k < 4; k++) {
      const before = farm.coins
      expect(buyDecor('lamp')).toBe(true)
      paid.push(before - farm.coins)
    }
    expect(paid).toEqual([200, 240, 280, 320])
    expect(farm.layout.stored.lamp).toBe(4)
    // two put down: still four owned, the next is the fifth's price
    expect(placeDecor('lamp', at(2, 0)).ok).toBe(true)
    expect(placeDecor('lamp', at(4, 0)).ok).toBe(true)
    expect(decorOwned('lamp')).toBe(4)
    expect(decorPrice('lamp')).toBe(360)
    expect(shopView().find((v) => v.kind === 'lamp')).toMatchObject({ owned: 4, price: 360, tab: 'decor', can: true })
  })

  it('not without the coins, nor a kind the shop does not sell; each purchase is worth XP as a build', () => {
    farm.coins = 199
    expect(buyDecor('lamp')).toBe(false)
    expect(buyDecor('teapot' as never)).toBe(false)
    expect(buyDecor('constructor' as never)).toBe(false)
    expect(farm.coins).toBe(199)
    farm.coins = 200
    const xp = xpNow().points
    expect(buyDecor('lamp')).toBe(true)
    expect(farm.coins).toBe(0)
    expect(xpNow().points - xp).toBe(XP_FOR.build)
  })

  it('every kind of both tabs is for sale at its first price', () => {
    const view = shopView()
    expect(view.map((v) => v.kind).sort()).toEqual(Object.keys(SHOP).sort())
    for (const v of view) expect(v.price, v.kind).toBe(SHOP[v.kind].price)
    expect(view.filter((v) => v.tab === 'fruit').map((v) => v.fruit)).toEqual(['apple', 'orange', 'cherry', 'blueberry', 'raspberry'])
  })
})

describe('putting down, moving, putting away', () => {
  it('put down from the store where it fits; moved and turned; put away and down again for nothing', () => {
    farm.coins = 1000
    buyDecor('bench')
    expect(placeDecor('bench', at(-1.2, 9.5)).ok).toBe(false)
    const put = placeDecor('bench', at(2, 0))
    expect(put).toMatchObject({ ok: true })
    const id = put.id!
    expect(farm.layout.stored.bench).toBe(0)
    expect(moveDecor(id, at(3, -2, 1))).toEqual({ ok: true })
    expect(farm.layout.decor.find((d) => d.id === id)).toMatchObject({ x: 3, z: -2, rot: 1 })
    expect(moveDecor(id, at(-1.2, 9.5)).ok).toBe(false)
    const coins = farm.coins
    expect(storeDecor(id)).toEqual({ ok: true })
    expect(farm.layout.decor).toEqual([])
    expect(farm.layout.stored.bench).toBe(1)
    expect(placeDecor('bench', at(5, 3)).ok).toBe(true)
    expect(farm.coins).toBe(coins)
    expect(placeDecor('bench', at(6, 3)).ok).toBe(false)
  })

  it('a fence put down near the end of another joins it', () => {
    farm.coins = 1000
    buyDecor('fence')
    buyDecor('fence')
    placeDecor('fence', at(2, 0))
    const second = placeDecor('fence', at(4.5, 0))
    expect(second.ok).toBe(true)
    expect(farm.layout.decor.find((d) => d.id === second.id)).toMatchObject({ x: 4, z: 0 })
  })

  it("nothing put down where a place stands, and a place not moved onto a piece; a piece keeps a place's way in open", () => {
    farm.coins = 1000
    buyDecor('bush')
    const hens = PLACES.hens.home
    expect(placeDecor('bush', at(hens.x, hens.z)).ok).toBe(false)
    const bush = placeDecor('bush', at(2, 0)).id!
    expect(movePlace('lemon', at(2, 0)).ok).toBe(false)
    expect(farm.layout.decor.find((d) => d.id === bush)).toMatchObject({ x: 2, z: 0 })
  })
})

describe('the fruit trees and bushes', () => {
  it('each plant put down is one more of its producer, bare at first; its fruit come on its clock', () => {
    farm.coins = 10_000
    buyDecor('apple-tree')
    buyDecor('apple-tree')
    expect(farm.producers['apple-tree'].animals).toBe(0)
    const a = placeDecor('apple-tree', at(2, 0)).id!
    const b = placeDecor('apple-tree', at(6, -3)).id!
    expect(farm.producers['apple-tree']).toEqual({ animals: 2, stock: [0, 0], timer: [0, 0] })
    expect(plantOf(a)).toEqual({ kind: 'apple-tree', index: 0 })
    expect(plantOf(b)).toEqual({ kind: 'apple-tree', index: 1 })
    tick(PRODUCERS['apple-tree'].every * 3 + 1)
    expect([stockOf('apple-tree', 0), stockOf('apple-tree', 1)]).toEqual([3, 3])
    // never more than the most it bears
    tick(PRODUCERS['apple-tree'].every * 100)
    expect(stockOf('apple-tree', 0)).toBe(PRODUCERS['apple-tree'].max)
  })

  it('picked into the silo (the lemon tree’s rules), counted as got; buyers ask for the fruit once a plant stands', () => {
    farm.coins = 10_000
    buyDecor('cherry-tree')
    placeDecor('cherry-tree', at(2, 0))
    farm.producers['cherry-tree'].stock[0] = 5
    expect(storeOf('cherry')).toBe('silo')
    expect(collect('cherry-tree', 0)).toBe(5)
    expect(farm.inv.cherry).toBe(5)
    expect(farm.got.cherry).toBe(5)
    expect(stockOf('cherry-tree', 0)).toBe(0)
    // the line: what the farm grows, cherries among it (with nothing in stock: what it knows)
    farm.inv.cherry = 0
    const wants = new Set<string>()
    for (let k = 0; k < 120; k++) wants.add(spawnVisitor()?.want ?? '')
    expect(wants.has('cherry')).toBe(true)
  })

  it('put away, its fruit is picked first; the others keep theirs, in their order', () => {
    farm.coins = 10_000
    for (let k = 0; k < 3; k++) buyDecor('blueberry-bush')
    const ids = [at(2, 0), at(4, 0), at(6, 0)].map((p) => placeDecor('blueberry-bush', p).id!)
    farm.producers['blueberry-bush'].stock = [1, 2, 3]
    expect(storeDecor(ids[1])).toEqual({ ok: true })
    expect(farm.inv.blueberry).toBe(2)
    expect(farm.producers['blueberry-bush']).toMatchObject({ animals: 2, stock: [1, 3] })
    expect(plantOf(ids[2])).toEqual({ kind: 'blueberry-bush', index: 1 })
    // the silo full: it stays, with its fruit
    farm.inv.wheat = 50 - farm.inv.blueberry
    expect(storeDecor(ids[2])).toEqual({ ok: false, reason: 'The silo is full: its fruit has nowhere to go' })
    expect(farm.producers['blueberry-bush'].animals).toBe(2)
  })

  it('every fruit kind is a producer of its own, its plants none on a new farm', () => {
    for (const k of FRUIT_KINDS) expect(farm.producers[k]).toEqual({ animals: 0, stock: [], timer: [] })
  })
})

describe('the beds and the kitchen move', () => {
  it('a built bed moves with what grows in it; one not built stays where it was staked out', () => {
    farm.coins = 100
    expect(plant(0, 'lettuce')).toBe(true)
    expect(moveBed(0, at(2, 0, 1))).toEqual({ ok: true })
    expect(bedSpot(0)).toEqual(at(2, 0, 1))
    expect(farm.beds[0].crop).toBe('lettuce')
    const staked = BEDS.findIndex((b) => b.price > 0)
    expect(moveBed(staked, at(4, 0)).ok).toBe(false)
    expect(bedSpot(staked)).toEqual(bedHome(staked))
    // the beds near you are where they stand now: from beside its new spot, the bed is in reach
    expect(bedsNear(0, 'growing', 2, 1.6)).toEqual([0])
  })

  it('the oven moves, turned, and what you do at it comes along (where you stand, where its sparkles pop)', () => {
    expect(movePlace('oven', at(2, 0, 1))).toEqual({ ok: true })
    const stand = machinePoint('oven', [-1.15, 1, 0])
    // a quarter turn: its west side faces south
    expect(stand.x).toBeCloseTo(2)
    expect(stand.z).toBeCloseTo(1.15)
    expect(canPlace(farm.layout, 'oven', PLACES.oven.home).ok).toBe(true)
  })
})

describe('the save', () => {
  it('what stands, what is stored, the beds and the kitchen where they were moved, and the fruit on each plant, as they were', () => {
    farm.coins = 10_000
    buyDecor('lamp')
    buyDecor('lamp')
    buyDecor('raspberry-bush')
    placeDecor('lamp', at(2, 0))
    placeDecor('raspberry-bush', at(4, 2))
    farm.producers['raspberry-bush'].stock[0] = 4
    movePlace('loom', at(-4, -3, 2))
    moveBed(1, at(6, -4, 1))
    const save = savedNow()
    resetFarm()
    expect(farm.layout.decor).toEqual([])
    startFrom(save)
    expect(farm.layout.decor.map((d) => [d.kind, d.x, d.z])).toEqual([
      ['lamp', 2, 0],
      ['raspberry-bush', 4, 2],
    ])
    expect(farm.layout.stored.lamp).toBe(1)
    expect(farm.layout.places.loom).toEqual(at(-4, -3, 2))
    expect(farm.layout.beds[1]).toEqual(at(6, -4, 1))
    expect(farm.producers['raspberry-bush'].stock).toEqual([4])
  })

  it('a farm from before the decoration: none of it, the kitchen and the beds where they always stood', () => {
    const save = savedNow()
    const { layout, ...rest } = save as { layout: Record<string, unknown> }
    startFrom({ ...rest, layout: { places: { hens: layout.places && (layout.places as Record<string, unknown>).hens }, land: [] } })
    expect(farm.layout.decor).toEqual([])
    expect(farm.layout.places.oven).toEqual(PLACES.oven.home)
    expect(farm.layout.beds).toEqual(BEDS.map((_, i) => bedHome(i)))
    for (const k of FRUIT_KINDS) expect(farm.producers[k].animals).toBe(0)
  })

  it('more plants of a kind saved on its producer than stand: as many as stand; fewer: the rest bare', () => {
    farm.coins = 10_000
    buyDecor('orange-tree')
    placeDecor('orange-tree', at(2, 0))
    const save = savedNow() as { producers: Record<string, unknown> }
    startFrom({ ...save, producers: { ...save.producers, 'orange-tree': { animals: 3, stock: [2, 5, 7], timer: [1, 2, 3] } } })
    // (its clock a moment on: the time since it was saved)
    expect(farm.producers['orange-tree']).toMatchObject({ animals: 1, stock: [2] })
    expect(farm.producers['orange-tree'].timer[0]).toBeCloseTo(1, 0)
    startFrom({ ...save, producers: { ...save.producers, 'orange-tree': { animals: 0, stock: [], timer: [] } } })
    expect(farm.producers['orange-tree']).toMatchObject({ animals: 1, stock: [0] })
  })
})

it('the first price of each kind fits the rule', () => {
  for (const kind of Object.keys(SHOP) as (keyof typeof SHOP)[]) expect(nextPrice(SHOP[kind].price, 0)).toBe(SHOP[kind].price)
})
