// Things the player buys for the farm in the edit mode (B, from above): decoration, and fruit trees and bushes that
// bear fruit. Each kind's price rises with every one bought (`nextPrice`). Placing, the save and the drawing are in
// the farm's layout and scene; the models in src/models/decor.ts and src/models/fruit.ts.

/** The edit mode shop's two tabs. */
export type DecorTab = 'decor' | 'fruit'

import { Color } from 'three'
import type { ArtId } from '../ui/art'
import type { SeasonId } from './season'

export type DecorKind =
  | 'lamp'
  | 'lantern'
  | 'fence'
  | 'hedge'
  | 'path'
  | 'stones'
  | 'bench'
  | 'tree'
  | 'pine'
  | 'bush'
  | 'roses'
  | 'flowers'
  | 'planter'
  | 'birdbath'
  | 'well'
  | 'scarecrow-farmer'
  | 'scarecrow-haymaker'
  | 'scarecrow-sunflower'
  | 'scarecrow-pumpkin'
  | 'scarecrow-witch'
  | 'scarecrow-crows'
  | 'scarecrow-ribbons'
  | 'scarecrow-pinwheel'
  | 'scarecrow-jingle'
  | 'beehive'
  | 'flower-arch'
  | 'parasol'
  | 'hay-bales'
  | 'snowman'
  | 'banner'
export type FruitKind = 'apple-tree' | 'orange-tree' | 'cherry-tree' | 'blueberry-bush' | 'raspberry-bush'
export type ShopKind = DecorKind | FruitKind
/** The pieces of the shop that give a good as it fills (each a producer of the farm, its "animals" the pieces standing):
 *  the fruit trees and bushes, and the beehive. */
export type BearerKind = FruitKind | 'beehive'

/** The fruit the new trees and bushes bear: goods of the farm (kept in the silo, like the lemons). */
export type FruitId = 'apple' | 'orange' | 'cherry' | 'blueberry' | 'raspberry'

/** The sets the shop groups its kinds in (mission 02 c5): each kind is in one. */
export type SetId = 'lights' | 'paths' | 'yard' | 'plants' | 'straw' | 'harvest' | 'ribbons' | 'year' | 'orchard'

/** A set as the shop heads it: its name and picture, in the shop's order. */
export const SETS: Readonly<Record<SetId, { name: string; art: ArtId }>> = {
  lights: { name: 'Lights', art: 'light-bulb' },
  paths: { name: 'Paths & fences', art: 'house-with-garden' },
  yard: { name: 'The yard', art: 'house' },
  plants: { name: 'Trees & flowers', art: 'four-leaf-clover' },
  straw: { name: 'Straw scarecrows', art: 'sheaf-of-rice' },
  harvest: { name: 'Harvest scarecrows', art: 'fallen-leaf' },
  ribbons: { name: 'Ribbon scarecrows', art: 'sparkles' },
  year: { name: 'The year', art: 'cherry-blossom' },
  orchard: { name: 'The orchard', art: 'basket' },
}
export const SET_IDS = Object.keys(SETS) as SetId[]

export interface ShopDef {
  id: ShopKind
  tab: DecorTab
  name: string
  /** the set the shop shows it in */
  set: SetId
  /** the first one's price; each next one costs more (`nextPrice`) */
  price: number
  /** a producing piece that is no plant (the beehive, update v1): the good it gives, the building that good is kept in,
   *  and the most the farm may own */
  bears?: { good: 'honey'; store: 'silo' | 'barn'; most: number }
  /** a season's piece (mission 10 c8, src/farm/season.ts `decor`): sold only in its season, standing all year once
   *  bought */
  season?: SeasonId
  /** the looks a piece of it may wear (mission 02 F5: ids of `DECOR_PAINTS`, or the banner's seasons), kept on the
   *  piece (`DecorPiece.look`) and drawn as its instance colour (`lookColours`): no new draw */
  tints?: readonly string[]
  /** the part of its model a paint covers (a painted kind: mission 02 c9) */
  paint?: string
  /** not sold: it is given (the season banner, by the season road) */
  given?: true
}

/** The paints for the farm's decoration (mission 02 c9): the house's soft colours (src/home/shell.ts, PAINTS) and a
 *  few deeper ones for outdoors. Free to change, with an undo: never XP. */
export const DECOR_PAINTS: readonly { id: string; name: string; hex: string }[] = [
  { id: 'chalk', name: 'Chalk', hex: '#eef0ea' },
  { id: 'butter', name: 'Butter', hex: '#f1e4b8' },
  { id: 'sky', name: 'Sky', hex: '#c7dbea' },
  { id: 'mint', name: 'Mint', hex: '#cfe5d6' },
  { id: 'sage', name: 'Sage', hex: '#b9cbb0' },
  { id: 'clay', name: 'Clay', hex: '#d3ab92' },
  { id: 'slate', name: 'Slate', hex: '#9eacb8' },
  { id: 'barn', name: 'Barn red', hex: '#a5523a' },
  { id: 'navy', name: 'Navy', hex: '#3b5f8a' },
  { id: 'meadow', name: 'Meadow', hex: '#6d8f3a' },
]
const PAINT_IDS = DECOR_PAINTS.map((p) => p.id)
export const paintOf = (id: string | undefined) => DECOR_PAINTS.find((p) => p.id === id)

/** The season banner's looks: each season's two colours, its pennant's two halves (mission 02 c8). */
export const BANNER_LOOKS: Readonly<Record<SeasonId, readonly [string, string]>> = {
  spring: ['#f2a7bd', '#7cc576'],
  summer: ['#f5d142', '#2aa7a0'],
  autumn: ['#c4532d', '#e9b824'],
  winter: ['#9fc4de', '#e8eef5'],
}
/** The banner's two halves, as its model names them. */
export const BANNER_PARTS = ['clothA', 'clothB'] as const

/** Decoration: light, fences and paths, seats, trees, bushes and flowers, and nine scarecrows for the beds in three
 *  styles (src/models/scarecrows.ts): straw and patches, the harvest, ribbons and shine. */
export const DECOR: Record<DecorKind, ShopDef> = {
  lamp: { id: 'lamp', tab: 'decor', set: 'lights', name: 'Yard lamp', price: 200, paint: 'iron', tints: PAINT_IDS },
  lantern: { id: 'lantern', tab: 'decor', set: 'lights', name: 'Path lantern', price: 90 },
  fence: { id: 'fence', tab: 'decor', set: 'paths', name: 'Picket fence', price: 40, paint: 'paint', tints: PAINT_IDS },
  hedge: { id: 'hedge', tab: 'decor', set: 'paths', name: 'Trimmed hedge', price: 80 },
  path: { id: 'path', tab: 'decor', set: 'paths', name: 'Stone path', price: 20 },
  stones: { id: 'stones', tab: 'decor', set: 'paths', name: 'Stepping stones', price: 25 },
  bench: { id: 'bench', tab: 'decor', set: 'yard', name: 'Bench', price: 150, paint: 'wood', tints: PAINT_IDS },
  tree: { id: 'tree', tab: 'decor', set: 'plants', name: 'Shade tree', price: 250 },
  pine: { id: 'pine', tab: 'decor', set: 'plants', name: 'Pine', price: 220 },
  bush: { id: 'bush', tab: 'decor', set: 'plants', name: 'Round bush', price: 60 },
  roses: { id: 'roses', tab: 'decor', set: 'plants', name: 'Rose bush', price: 110 },
  flowers: { id: 'flowers', tab: 'decor', set: 'plants', name: 'Flower patch', price: 70 },
  planter: { id: 'planter', tab: 'decor', set: 'yard', name: 'Planter', price: 90, paint: 'wood', tints: PAINT_IDS },
  birdbath: { id: 'birdbath', tab: 'decor', set: 'yard', name: 'Bird bath', price: 180, paint: 'stone', tints: PAINT_IDS },
  well: { id: 'well', tab: 'decor', set: 'yard', name: 'Wishing well', price: 400, paint: 'roof', tints: PAINT_IDS },
  'scarecrow-farmer': { id: 'scarecrow-farmer', tab: 'decor', set: 'straw', name: 'Farmer scarecrow', price: 160 },
  'scarecrow-haymaker': { id: 'scarecrow-haymaker', tab: 'decor', set: 'straw', name: 'Haymaker scarecrow', price: 180 },
  'scarecrow-sunflower': { id: 'scarecrow-sunflower', tab: 'decor', set: 'straw', name: 'Sunflower scarecrow', price: 150 },
  'scarecrow-pumpkin': { id: 'scarecrow-pumpkin', tab: 'decor', set: 'harvest', name: 'Pumpkin scarecrow', price: 180 },
  'scarecrow-witch': { id: 'scarecrow-witch', tab: 'decor', set: 'harvest', name: 'Witch scarecrow', price: 200 },
  'scarecrow-crows': { id: 'scarecrow-crows', tab: 'decor', set: 'harvest', name: 'Crows scarecrow', price: 190 },
  'scarecrow-ribbons': { id: 'scarecrow-ribbons', tab: 'decor', set: 'ribbons', name: 'Ribbon scarecrow', price: 200 },
  'scarecrow-pinwheel': { id: 'scarecrow-pinwheel', tab: 'decor', set: 'ribbons', name: 'Pinwheel scarecrow', price: 190 },
  'scarecrow-jingle': { id: 'scarecrow-jingle', tab: 'decor', set: 'ribbons', name: 'Jingle scarecrow', price: 210 },
  // update v1 (update-v1/missions/01-loop-economy.md c8): a hive of bees, a piece that gives (its honey kept in the
  // barn); three at most
  beehive: { id: 'beehive', tab: 'decor', set: 'yard', name: 'Beehive', price: 650, bears: { good: 'honey', store: 'barn', most: 3 } },
  // update v1 (update-v1/missions/10-seasons-weather.md c8): a piece for each season, sold in it, kept all year
  'flower-arch': { id: 'flower-arch', tab: 'decor', set: 'year', name: 'Flower arch', price: 320, season: 'spring' },
  parasol: { id: 'parasol', tab: 'decor', set: 'year', name: 'Parasol', price: 280, season: 'summer' },
  'hay-bales': { id: 'hay-bales', tab: 'decor', set: 'year', name: 'Hay bales', price: 240, season: 'autumn' },
  snowman: { id: 'snowman', tab: 'decor', set: 'year', name: 'Snowman', price: 260, season: 'winter' },
  // update v1 (update-v1/missions/02-meta-collections.md c8): a pennant on a pole in a season's two colours, given by
  // the season road (its price only what it is worth when the farm has its most)
  banner: { id: 'banner', tab: 'decor', set: 'year', name: 'Season banner', price: 300, given: true, tints: ['spring', 'summer', 'autumn', 'winter'] },
}

/** Fruit trees and bushes: each bears its fruit (a producer of the farm, as the lemon tree is). */
export const FRUIT: Record<FruitKind, ShopDef & { fruit: FruitId }> = {
  'apple-tree': { id: 'apple-tree', tab: 'fruit', set: 'orchard', name: 'Apple tree', price: 600, fruit: 'apple' },
  'orange-tree': { id: 'orange-tree', tab: 'fruit', set: 'orchard', name: 'Orange tree', price: 700, fruit: 'orange' },
  'cherry-tree': { id: 'cherry-tree', tab: 'fruit', set: 'orchard', name: 'Cherry tree', price: 800, fruit: 'cherry' },
  'blueberry-bush': { id: 'blueberry-bush', tab: 'fruit', set: 'orchard', name: 'Blueberry bush', price: 300, fruit: 'blueberry' },
  'raspberry-bush': { id: 'raspberry-bush', tab: 'fruit', set: 'orchard', name: 'Raspberry bush', price: 350, fruit: 'raspberry' },
}

export const SHOP: Record<ShopKind, ShopDef> = { ...DECOR, ...FRUIT }
export const DECOR_KINDS = Object.keys(DECOR) as DecorKind[]
export const FRUIT_KINDS = Object.keys(FRUIT) as FruitKind[]

/** The kinds the shop sells (every one but those given). */
export const SOLD_KINDS = (Object.keys(SHOP) as ShopKind[]).filter((k) => !SHOP[k].given)

/** Whether `look` is one a piece of `kind` may wear. */
export const isLookOf = (kind: ShopKind, look: unknown): look is string => typeof look === 'string' && (SHOP[kind].tints ?? []).includes(look)

/** A colour in the drawing's linear space, from a hex code ('#rrggbb'). */
function linear(hex: string): [number, number, number] {
  const c = new Color(hex)
  return [c.r, c.g, c.b]
}

/** The instance colour of each part a look tints (mission 02 F5), in the linear space the vertex colours are in: a
 *  paint over its kind's painted part — its colour over that part's mean colour `base`, so the part's mean becomes the
 *  paint and its grain and shading stay —, a banner's season over its two halves. None: as it was made. */
export function lookTints(kind: ShopKind, look: string | undefined, base: readonly [number, number, number] | null): Record<string, [number, number, number]> {
  if (!isLookOf(kind, look)) return {}
  const def = SHOP[kind]
  if (kind === 'banner') {
    const [a, b] = BANNER_LOOKS[look as SeasonId]
    return { [BANNER_PARTS[0]]: linear(a), [BANNER_PARTS[1]]: linear(b) }
  }
  const paint = paintOf(look)
  if (!def.paint || !paint || !base) return {}
  const [r, g, b] = linear(paint.hex)
  return { [def.paint]: [r / Math.max(1e-4, base[0]), g / Math.max(1e-4, base[1]), b / Math.max(1e-4, base[2])] }
}

/** The price of the next one of a kind, `owned` bought already. Each one after the first costs a fifth of the first
 *  more than the one before; every ten, that rise doubles: 200 → 240, 280, … 600 for the eleventh, then 680, 760, …
 *  1400 for the twenty-first, then 1560 (a rise of 160), and so on. Whole coins. */
export function nextPrice(base: number, owned: number): number {
  let price = base
  for (let j = 0; j < Math.max(0, Math.floor(owned)); j++) price += 0.2 * base * 2 ** Math.floor(j / 10)
  return Math.round(price)
}

/** The kinds that bear: the fruit trees and bushes, and every piece that gives a good (the beehive). */
export const BEARER_KINDS: readonly BearerKind[] = [...FRUIT_KINDS, ...DECOR_KINDS.filter((k): k is 'beehive' => !!DECOR[k].bears)]

/** Whether a good is one of the new fruit. */
export const isFruit = (id: string): id is FruitId => Object.values(FRUIT).some((f) => f.fruit === id)

/** One kind as the edit mode's shop shows it: how many the farm has (placed or stored) and the next one's price. */
export interface ShopItemView {
  kind: ShopKind
  tab: DecorTab
  name: string
  set: SetId
  owned: number
  price: number
  /** it can be bought now: open, not at its most, and the farm has the coins for it */
  can: boolean
  /** a fruit plant: the fruit it bears */
  fruit?: FruitId
  /** not open yet at the farm's level: the level it opens at (src/farm/unlocks.ts) */
  locked?: number
  /** a season's piece (mission 10 c8): its season's name and picture, and whether it is that season now (sold, first
   *  in the shop with its ribbon) or not (faded, "Back in spring") */
  season?: { name: string; pic: string; now: boolean }
}

/** A set as the shop shows it: its kinds (as given), and how many of them the farm has one of at least. */
export interface SetView {
  id: SetId
  name: string
  art: ArtId
  got: number
  of: number
  items: ShopItemView[]
}

/** The shop's kinds grouped by set, in `SETS`' order but the year's first (the season's own piece leads the shop:
 *  mission 10 c8), each set's kinds in the order given. */
export function setsOf(items: readonly ShopItemView[]): SetView[] {
  const order: SetId[] = ['year', ...SET_IDS.filter((id) => id !== 'year')]
  return order
    .map((id) => {
      const mine = items.filter((i) => i.set === id)
      return { id, ...SETS[id], got: mine.filter((i) => i.owned > 0).length, of: mine.length, items: mine }
    })
    .filter((v) => v.of > 0)
}

/** What the edit mode's shop does: buy one (it is then placed by the player, as a place is moved), or put one placed
 *  away into the farm's store of decoration (placed again later for nothing). */
export interface ShopActions {
  buy(kind: ShopKind): boolean
}
