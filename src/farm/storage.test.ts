import { describe, expect, it } from 'vitest'
import { CROPS, ITEMS, PRODUCE, STORES, storeCapacity, storeOf, upgradeCost, type ProduceId } from './data'
import { STORE_GOODS, canUpgrade, nextLevel, roomIn, usedIn } from './storage'

// The silo and the barn as numbers (src/farm/storage.ts, src/farm/data.ts): which good goes where, what each holds,
// what its next level costs.

const inv = (goods: Partial<Record<ProduceId, number>> = {}) => Object.fromEntries(PRODUCE.map((p) => [p.id, goods[p.id] ?? 0])) as Record<ProduceId, number>

describe('the silo and the barn', () => {
  it('the silo keeps what grows (every crop, the lemons); the barn what the animals and the machines give, and the building materials', () => {
    for (const c of CROPS) expect(storeOf(c.id), c.id).toBe('silo')
    expect(storeOf('lemon')).toBe('silo')
    for (const id of ['egg', 'milk', 'wool', 'sugar', 'flour', 'cloth', 'lemon_cake', 'strawberry_cake', 'carrot_cake', 'pumpkin_pie'] as ProduceId[]) expect(storeOf(id), id).toBe('barn')
    for (const id of ITEMS) expect(storeOf(id), id).toBe('barn')
    // every good is in exactly one of them
    expect([...STORE_GOODS.silo, ...STORE_GOODS.barn].sort()).toEqual(PRODUCE.map((p) => p.id).sort())
  })

  it('each holds 50 goods a level, from 50 at level 1', () => {
    expect([1, 2, 3, 10].map(storeCapacity)).toEqual([50, 100, 150, 500])
  })

  it('counts what it holds by its own goods only', () => {
    const goods = inv({ lettuce: 10, lemon: 5, egg: 7, flour: 2, brick: 3 })
    expect(usedIn(goods, 'silo')).toBe(15)
    expect(usedIn(goods, 'barn')).toBe(12)
    const levels = { silo: 1, barn: 1 }
    expect(roomIn(goods, levels, 'silo')).toBe(35)
    expect(roomIn(goods, levels, 'barn')).toBe(38)
    expect(roomIn(goods, { silo: 2, barn: 1 }, 'silo')).toBe(85)
  })

  it('over what it holds (a save from before it), it has no room: nothing is taken away, nothing more goes in', () => {
    const goods = inv({ wheat: 70, milk: 60 })
    const levels = { silo: 1, barn: 1 }
    expect(usedIn(goods, 'silo')).toBe(70)
    expect(roomIn(goods, levels, 'silo')).toBe(0)
    expect(roomIn(goods, levels, 'barn')).toBe(0)
  })

  it('the next level costs as many of each of its three materials as the level it is at, for 50 more', () => {
    expect(STORES.barn.materials).toEqual(['brick', 'plank', 'nail'])
    expect(STORES.silo.materials).toEqual(['iron', 'bolt', 'log'])
    // six materials, all different
    expect(new Set([...STORES.barn.materials, ...STORES.silo.materials]).size).toBe(6)
    expect(nextLevel('barn', 1)).toEqual({
      level: 2,
      capacity: 100,
      needs: [
        { item: 'brick', count: 1 },
        { item: 'plank', count: 1 },
        { item: 'nail', count: 1 },
      ],
    })
    expect(nextLevel('silo', 2)).toEqual({
      level: 3,
      capacity: 150,
      needs: [
        { item: 'iron', count: 2 },
        { item: 'bolt', count: 2 },
        { item: 'log', count: 2 },
      ],
    })
    // and on, with no end
    expect(nextLevel('barn', 40).needs.map((n) => n.count)).toEqual([40, 40, 40])
    expect(nextLevel('barn', 40).capacity).toBe(2050)
    expect([1, 2, 3, 7].map(upgradeCost)).toEqual([1, 2, 3, 7])
  })

  it('upgrades only with enough of every material', () => {
    expect(canUpgrade(inv({ brick: 1, plank: 1, nail: 1 }), 'barn', 1)).toBe(true)
    expect(canUpgrade(inv({ brick: 1, plank: 1 }), 'barn', 1)).toBe(false)
    expect(canUpgrade(inv({ brick: 1, plank: 1, nail: 1 }), 'barn', 2)).toBe(false)
    expect(canUpgrade(inv({ iron: 2, bolt: 2, log: 2 }), 'silo', 2)).toBe(true)
    // the barn's materials do not make the silo bigger
    expect(canUpgrade(inv({ brick: 5, plank: 5, nail: 5 }), 'silo', 1)).toBe(false)
  })
})
