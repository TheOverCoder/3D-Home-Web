// Things the player buys for the farm in the edit mode (B, from above): decoration, and fruit trees and bushes that
// bear fruit. Each kind's price rises with every one bought (`nextPrice`). Placing, the save and the drawing are in
// the farm's layout and scene; the models in src/models/decor.ts and src/models/fruit.ts.

/** The edit mode shop's two tabs. */
export type DecorTab = 'decor' | 'fruit'

export type DecorKind = 'lamp' | 'lantern' | 'fence' | 'hedge' | 'path' | 'stones' | 'bench' | 'tree' | 'pine' | 'bush' | 'roses' | 'flowers' | 'planter' | 'birdbath' | 'well'
export type FruitKind = 'apple-tree' | 'orange-tree' | 'cherry-tree' | 'blueberry-bush' | 'raspberry-bush'
export type ShopKind = DecorKind | FruitKind

/** The fruit the new trees and bushes bear: goods of the farm (kept in the silo, like the lemons). */
export type FruitId = 'apple' | 'orange' | 'cherry' | 'blueberry' | 'raspberry'

export interface ShopDef {
  id: ShopKind
  tab: DecorTab
  name: string
  /** the first one's price; each next one costs more (`nextPrice`) */
  price: number
}

/** Decoration: light, fences and paths, seats, trees, bushes and flowers. */
export const DECOR: Record<DecorKind, ShopDef> = {
  lamp: { id: 'lamp', tab: 'decor', name: 'Yard lamp', price: 200 },
  lantern: { id: 'lantern', tab: 'decor', name: 'Path lantern', price: 90 },
  fence: { id: 'fence', tab: 'decor', name: 'Picket fence', price: 40 },
  hedge: { id: 'hedge', tab: 'decor', name: 'Trimmed hedge', price: 80 },
  path: { id: 'path', tab: 'decor', name: 'Stone path', price: 20 },
  stones: { id: 'stones', tab: 'decor', name: 'Stepping stones', price: 25 },
  bench: { id: 'bench', tab: 'decor', name: 'Bench', price: 150 },
  tree: { id: 'tree', tab: 'decor', name: 'Shade tree', price: 250 },
  pine: { id: 'pine', tab: 'decor', name: 'Pine', price: 220 },
  bush: { id: 'bush', tab: 'decor', name: 'Round bush', price: 60 },
  roses: { id: 'roses', tab: 'decor', name: 'Rose bush', price: 110 },
  flowers: { id: 'flowers', tab: 'decor', name: 'Flower patch', price: 70 },
  planter: { id: 'planter', tab: 'decor', name: 'Planter', price: 90 },
  birdbath: { id: 'birdbath', tab: 'decor', name: 'Bird bath', price: 180 },
  well: { id: 'well', tab: 'decor', name: 'Wishing well', price: 400 },
}

/** Fruit trees and bushes: each bears its fruit (a producer of the farm, as the lemon tree is). */
export const FRUIT: Record<FruitKind, ShopDef & { fruit: FruitId }> = {
  'apple-tree': { id: 'apple-tree', tab: 'fruit', name: 'Apple tree', price: 600, fruit: 'apple' },
  'orange-tree': { id: 'orange-tree', tab: 'fruit', name: 'Orange tree', price: 700, fruit: 'orange' },
  'cherry-tree': { id: 'cherry-tree', tab: 'fruit', name: 'Cherry tree', price: 800, fruit: 'cherry' },
  'blueberry-bush': { id: 'blueberry-bush', tab: 'fruit', name: 'Blueberry bush', price: 300, fruit: 'blueberry' },
  'raspberry-bush': { id: 'raspberry-bush', tab: 'fruit', name: 'Raspberry bush', price: 350, fruit: 'raspberry' },
}

export const SHOP: Record<ShopKind, ShopDef> = { ...DECOR, ...FRUIT }
export const DECOR_KINDS = Object.keys(DECOR) as DecorKind[]
export const FRUIT_KINDS = Object.keys(FRUIT) as FruitKind[]

/** The price of the next one of a kind, `owned` bought already. Each one after the first costs a fifth of the first
 *  more than the one before; every ten, that rise doubles: 200 → 240, 280, … 600 for the eleventh, then 680, 760, …
 *  1400 for the twenty-first, then 1560 (a rise of 160), and so on. Whole coins. */
export function nextPrice(base: number, owned: number): number {
  let price = base
  for (let j = 0; j < Math.max(0, Math.floor(owned)); j++) price += 0.2 * base * 2 ** Math.floor(j / 10)
  return Math.round(price)
}

/** Whether a good is one of the new fruit. */
export const isFruit = (id: string): id is FruitId => Object.values(FRUIT).some((f) => f.fruit === id)

/** One kind as the edit mode's shop shows it: how many the farm has (placed or stored) and the next one's price. */
export interface ShopItemView {
  kind: ShopKind
  tab: DecorTab
  name: string
  owned: number
  price: number
  /** the farm has the coins for it */
  can: boolean
  /** a fruit plant: the fruit it bears */
  fruit?: FruitId
}

/** What the edit mode's shop does: buy one (it is then placed by the player, as a place is moved), or put one placed
 *  away into the farm's store of decoration (placed again later for nothing). */
export interface ShopActions {
  buy(kind: ShopKind): boolean
}
