import { beforeAll, describe, expect, it } from 'vitest'
import { CORNER_TREES } from '../data/garden'
import { COUNTRY_TREES, GARDEN_TREE } from '../data/home'
import { DECOR_KINDS, FRUIT_KINDS, type ShopKind } from '../farm/decor'
import { treeSpots } from '../farm/landGeometry'
import { defaultLayout } from '../farm/layout'
import { loadSolids } from '../lib/sculpt'
import { decorModel } from './decor'
import { fruitPlantModel } from './fruit'
import { GOODS, type GoodsId } from './goods'
import type { Structure } from './structures'
import { bigTreeModel, cornerTree, countryTree, gardenTree } from './trees'
import { TOOL_LOOKS, TOOL_STYLES, TOOL_WEIGHT, toolModel } from './tools'

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
  apple: 1168,
  orange: 998,
  cherry: 1188,
  blueberry: 1360,
  raspberry: 1572,
  sunflower: 1664,
  potato: 1024,
  melon: 1204,
  cotton: 2330,
  apple_pie: 1568,
  blueberry_muffins: 1584,
  cherry_tart: 1970,
  quilt: 1680,
  butter: 392,
  cheese: 300,
  bread: 704,
  honey: 844,
  strawberry_jam: 720,
  cherry_jam: 720,
  honey_cake: 1088,
  blueberry_jam: 720,
  ice_cream: 432,
  marmalade: 720,
  yogurt: 720,
  blanket: 1680,
  apple_butter: 720,
  raspberry_jam: 720,
  cheesecake: 1532,
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

// The farm's decoration and fruit plants (src/farm/decor.ts): each kind stands as many times as a farm buys it, one
// crowd of its model, and the budget walk (tests/e2e/05) measures the farm decorated with every kind. The same guard: a
// model grown past its weight fails here first.
const DECOR_WEIGHT: Record<ShopKind, number> = {
  lamp: 706,
  lantern: 566,
  fence: 512,
  hedge: 408,
  path: 240,
  stones: 180,
  bench: 676,
  tree: 1328,
  pine: 840,
  bush: 384,
  roses: 944,
  flowers: 634,
  planter: 768,
  birdbath: 566,
  well: 948,
  'scarecrow-farmer': 1714,
  'scarecrow-haymaker': 1748,
  'scarecrow-sunflower': 1747,
  'scarecrow-pumpkin': 1319,
  'scarecrow-witch': 1620,
  'scarecrow-crows': 1624,
  'scarecrow-ribbons': 1682,
  'scarecrow-pinwheel': 1542,
  'scarecrow-jingle': 1704,
  'apple-tree': 1188,
  'orange-tree': 946,
  'cherry-tree': 1188,
  'blueberry-bush': 647,
  'raspberry-bush': 869,
  beehive: 400,
  // the seasons' pieces (mission 10 c8: each under 600)
  'flower-arch': 546,
  parasol: 264,
  'hay-bales': 312,
  snowman: 588,
  // the season banner (mission 02 c8: under 300)
  banner: 217,
}

/** The big trees (src/models/trees.ts): on the farm, the woods' fourteen as a new farm has them and the garden's three
 *  corner oaks (the trees before them drew 23,956); round the house, its garden's corner oak and the countryside's
 *  twelve (before: 17,504). */
const BIG_TREES_WEIGHT = { farm: 9197, house: 6621 }

const triangles = (s: Structure) => Object.values(s).reduce((n, p) => n + p.shape.i.length / 3, 0)

describe("the farm's decoration and big trees: their weights", () => {
  const kinds = [...DECOR_KINDS, ...FRUIT_KINDS] as ShopKind[]
  const model = (kind: ShopKind) => ((FRUIT_KINDS as string[]).includes(kind) ? fruitPlantModel(kind as (typeof FRUIT_KINDS)[number]) : decorModel(kind as (typeof DECOR_KINDS)[number]))

  it('every kind of the shop has a weight, and only they do', () => {
    expect(Object.keys(DECOR_WEIGHT).sort()).toEqual([...kinds].sort())
  })

  it.each(kinds)('%s draws no more triangles than its weight', (kind) => {
    expect(triangles(model(kind)), `${kind}: grown past its weight — measure the budget (tests/e2e/05) and set its weight here`).toBeLessThanOrEqual(DECOR_WEIGHT[kind])
  })

  it("the farm's woods and its garden's corner trees draw no more than their weight", () => {
    const woods = treeSpots(defaultLayout()).map((t, index) => bigTreeModel({ height: t.height, seed: t.seed, index, corner: false }))
    const corners = CORNER_TREES.map(([, , height], index) => bigTreeModel(cornerTree(index, height)))
    expect([...woods, ...corners].reduce((n, t) => n + triangles(t), 0)).toBeLessThanOrEqual(BIG_TREES_WEIGHT.farm)
  })

  it("the house's garden tree and its countryside draw no more than their weight", () => {
    const garden = bigTreeModel(gardenTree(GARDEN_TREE[2]))
    const country = COUNTRY_TREES.map(([, , height], index) => bigTreeModel(countryTree(index, height)))
    expect([garden, ...country].reduce((n, t) => n + triangles(t), 0)).toBeLessThanOrEqual(BIG_TREES_WEIGHT.house)
  })
})

// The animals' tools (src/models/tools.ts): each stands once at its animal's fence, and the films raise it piece by
// piece; each family's three are proposals for the design lab, every one within the tool's weight.
describe("the animals' tools: their weight", () => {
  beforeAll(async () => {
    await loadSolids()
  })

  it.each(TOOL_STYLES.flatMap((style) => TOOL_LOOKS.map((look) => [style, look] as const)))('%s · %s draws no more triangles than a tool may', (style, look) => {
    expect(triangles(toolModel(look, style)), `${style} ${look}: grown past the tool's weight`).toBeLessThanOrEqual(TOOL_WEIGHT)
  })
})
