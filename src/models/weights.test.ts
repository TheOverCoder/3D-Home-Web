import { beforeAll, describe, expect, it } from 'vitest'
import { loadSolids } from '../lib/sculpt'
import { GOODS, type GoodsId } from './goods'

// The budget engine's first guard: the triangles each good's model draws, and the most it may (its weight). A good
// stands on the market's shelves up to thirty times in one view, so a model that grows past its weight fails here,
// in seconds, instead of in the budget walk (tests/e2e/05) twenty minutes later. A weight changes only with the model,
// measured again: lower it when a model gets lighter. The heaviest good is the one the budget fills the shelves with.

const WEIGHT: Record<GoodsId, number> = {
  lettuce: 3040,
  carrot: 1592,
  strawberry: 1328,
  tomato: 1564,
  corn: 7240,
  pumpkin: 2486,
  wheat: 2876,
  sugarcane: 4044,
  lemon: 1364,
  egg: 2176,
  milk: 1080,
  wool: 2444,
  sugar: 1416,
  flour: 2358,
  cloth: 144,
  lemon_cake: 1208,
  strawberry_cake: 1760,
  carrot_cake: 1082,
  pumpkin_pie: 1616,
  brick: 480,
  plank: 528,
  nail: 438,
  iron: 320,
  bolt: 166,
  log: 120,
}

/** The good the budget measures the market full of (marketFill's default and tests/e2e/05's `fillShelves`). */
const MEASURED_FULL_OF: GoodsId = 'corn'

describe("the goods' weights", () => {
  beforeAll(async () => {
    await loadSolids()
  })

  const drawn = (id: GoodsId) => Object.values(GOODS[id]()).reduce((n, p) => n + p.shape.i.length / 3, 0)

  it('every good has a weight, and only goods do', () => {
    expect(Object.keys(WEIGHT).sort()).toEqual(Object.keys(GOODS).sort())
  })

  it.each(Object.keys(GOODS) as GoodsId[])('%s draws no more triangles than its weight', (id) => {
    expect(drawn(id), `${id}: grown past its weight — measure the budget (tests/e2e/05) and set its weight here`).toBeLessThanOrEqual(WEIGHT[id])
  })

  it('the budget fills the shelves with the heaviest good', () => {
    const heaviest = (Object.keys(WEIGHT) as GoodsId[]).reduce((a, b) => (WEIGHT[b] > WEIGHT[a] ? b : a))
    expect(heaviest, 'the heaviest good changed: fill the shelves with it in marketFill and tests/e2e/05').toBe(MEASURED_FULL_OF)
  })
})
