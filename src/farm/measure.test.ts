// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { CROPS, MACHINES, PRODUCE, PRODUCERS } from './data'
import { GARMENTS } from './outfit'
import { GOODS, countOf, madeBy } from './measure'
import { buyDecor, buyPiece, buySkin, farm, placeDecor, resetFarm } from './state'
import { levelOf, xpAt } from './xp'

// The farm's counts as data (src/farm/measure.ts): each kind of count read from the farm by one function.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
})

describe('the farm’s counts', () => {
  it('the goods got: named, or a group (the beds’ crops, the trees’ and bushes’ fruit, the building materials)', () => {
    Object.assign(farm.got, { lettuce: 4, wheat: 3, apple: 2, raspberry: 5, lemon: 7, brick: 1, log: 2, egg: 6 })
    expect(countOf(farm, { got: ['egg', 'lemon'] })).toBe(13)
    expect(countOf(farm, { got: 'crops' })).toBe(7)
    expect(countOf(farm, { got: 'fruit' })).toBe(7)
    expect(countOf(farm, { got: 'materials' })).toBe(3)
    // the groups: every crop of the beds; the fruit of every tree and bush, never the lemons; every material
    expect(GOODS.crops).toEqual(CROPS.map((c) => c.id))
    expect([...GOODS.fruit].sort()).toEqual(['apple', 'blueberry', 'cherry', 'orange', 'raspberry'])
    expect(GOODS.materials).toEqual(PRODUCE.filter((p) => p.material).map((p) => p.id))
  })

  it('a stat, what a machine made, a herd', () => {
    farm.stats.sold = 12
    expect(countOf(farm, { stat: 'sold' })).toBe(12)
    Object.assign(farm.got, { flour: 3, sugar: 2, cloth: 9 })
    expect(madeBy('mill').sort()).toEqual([...new Set(MACHINES.mill.recipes.map((r) => r.makes))].sort())
    expect(countOf(farm, { made: 'mill' })).toBe(5)
    expect(countOf(farm, { herd: 'hens' })).toBe(PRODUCERS.hens.herd!.start)
  })

  it('pieces of decoration (standing and stored), of the house’s furniture, a skin owned', () => {
    farm.coins = 1e6
    buyDecor('lamp')
    buyDecor('lamp')
    expect(countOf(farm, { decor: 'lamp' })).toBe(2)
    placeDecor('lamp', { x: 1, z: -1, rot: 0 })
    expect(countOf(farm, { decor: 'lamp' })).toBe(2)
    // (no piece wears a look yet: 02's paint)
    expect(countOf(farm, { decor: 'lamp', look: 'red' })).toBe(0)
    const stools = countOf(farm, { piece: 'stool' })
    buyPiece('stool')
    expect(countOf(farm, { piece: 'stool' })).toBe(stools + 1)
    expect(countOf(farm, { skin: ['cows', 'b'] })).toBe(0)
    farm.ladders['cows-tool'] = 1
    buySkin('cows', 'b')
    expect(countOf(farm, { skin: ['cows', 'b'] })).toBe(1)
  })

  it('a garment once it is in the wardrobe; the level', () => {
    const later = GARMENTS.find((g) => g.level > 1)!
    expect(countOf(farm, { garment: later.id })).toBe(0)
    expect(countOf(farm, { level: true })).toBe(1)
    farm.xp.points = xpAt(later.level)
    expect(countOf(farm, { garment: later.id })).toBe(1)
    expect(countOf(farm, { level: true })).toBe(levelOf(farm.xp.points))
    expect(countOf(farm, { garment: 'nothing' })).toBe(0)
  })
})
