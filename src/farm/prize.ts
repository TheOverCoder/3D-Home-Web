// A prize (update-v1/CONTRACTS.md §1.9): what a claim or a gift gives — coins, a few of a good, a piece of decoration
// for the farm's store, or a garment for the wardrobe — and the one size every prize's coins are cut to. Every prize goes
// into the farm through one door, `give()` (src/farm/state/rewards.ts), which also counts it as a reward. Pure.
//
// The type's one home. src/farm/gifts.ts reads its own records (the boxes', the daily gift's) through it, keeping only
// the two kinds a gift holds: coins and goods.

import { intIn, isObject } from '../lib/saved'
import { SELLABLE, count, isItem, type ProduceId } from './data'
import { SHOP, type ShopDef, type ShopKind } from './decor'
import { garmentById, type Garment } from './outfit'
import { levelReward } from './xp'

export type Prize =
  /** coins, into the purse */
  | { coins: number }
  /** a good or a building material: into its store, even past full (as surprises go) */
  | { item: ProduceId; n: number }
  /** one piece into the farm's store (layout.stored), free to put down; `look`: its colours, where its row has them */
  | { decor: ShopKind; look?: string }
  /** a garment into the wardrobe (outfit.owned) */
  | { garment: string }
export type PrizeKind = 'coins' | 'item' | 'decor' | 'garment'

export const prizeKind = (p: Prize): PrizeKind => ('coins' in p ? 'coins' : 'item' in p ? 'item' : 'decor' in p ? 'decor' : 'garment')

const isShopKind = (v: unknown): v is ShopKind => typeof v === 'string' && Object.hasOwn(SHOP, v)

/** The looks a kind of decoration may wear (02 gives some rows `tints`); none today. */
export const looksOf = (kind: ShopKind): readonly string[] => (SHOP[kind] as ShopDef & { tints?: readonly string[] }).tints ?? []

/** Where a garment comes from: with a level, or otherwise (an album page, the season road; 02 gives garments a `from`).
 *  Only one that does not come with a level can be a prize: a level's own comes with the level. Today every garment
 *  comes with a level. */
const fromOf = (g: Garment): string => (g as Garment & { from?: { kind?: string } }).from?.kind ?? 'level'
export const isGiftGarment = (id: unknown): id is string => {
  const g = typeof id === 'string' ? garmentById(id) : undefined
  return !!g && fromOf(g) !== 'level'
}

/** A prize as saved, or null: coins from 1 to a billion; a good buyers buy, or a building material, 1 to 99; a kind of
 *  the edit mode's shop (with a look only its row has: any other is dropped); a garment that does not come with a level. */
export function savedPrize(raw: unknown): Prize | null {
  if (!isObject(raw)) return null
  if ('coins' in raw) return intIn(raw.coins, 1, 1e9) ? { coins: raw.coins } : null
  if ('decor' in raw) {
    if (!isShopKind(raw.decor)) return null
    return typeof raw.look === 'string' && looksOf(raw.decor).includes(raw.look) ? { decor: raw.decor, look: raw.look } : { decor: raw.decor }
  }
  if ('garment' in raw) return isGiftGarment(raw.garment) ? { garment: raw.garment } : null
  return typeof raw.item === 'string' && (SELLABLE.includes(raw.item as ProduceId) || isItem(raw.item)) && intIn(raw.n, 1, 99) ? { item: raw.item as ProduceId, n: raw.n } : null
}

/** "a yard lamp", "an apple tree". */
const one = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name.toLowerCase()}`

/** A prize in words: "12 coins", "2 planks", "a yard lamp", "a teal shirt". */
export function prizeWords(p: Prize): string {
  if ('coins' in p) return `${p.coins} coins`
  if ('item' in p) return count(p.item, p.n)
  if ('decor' in p) return one(SHOP[p.decor].name)
  const g = garmentById(p.garment)
  return g ? one(g.name) : 'a garment'
}

/** Coins sized from the next level's own (levelReward(level + 1)): the one yardstick of every prize's coins — the daily
 *  gift, the level's boxes, the welcome-back gift, the season road's coin stops — and of a reward's tier
 *  (src/farm/worth.ts). `share` of it, rounded, at least `least`. */
export function sized(share: number, level: number, least = 1): number {
  const base = levelReward(Math.max(1, Math.floor(level)) + 1)
  return Math.max(least, Math.round(base * share))
}
