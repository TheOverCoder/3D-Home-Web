// The farm's counts as data (update-v1/missions/02-meta-collections.md F2): what a goal's ladder, an album's tile or any
// other row counts — goods got by the farm's work, one of its stats, what a machine made, a herd, pieces of decoration
// or furniture, a skin, a garment, the level — written as a row's field and read by one function, `countOf`. A new
// ladder or tile is a row, never a closure. Pure: it reads the farm, never changes it.

import type { PieceType } from '../home/catalogue'
import { CROPS, MACHINES, PLANT_PRODUCERS, PRODUCE, PRODUCERS, type MachineId, type ProduceId, type ProducerId, type ToolKind } from './data'
import type { ShopKind } from './decor'
import { garmentById } from './outfit'
import type { SkinStyle } from './skins'
import type { FarmData } from './state'
import { levelOf } from './xp'

/** Goods counted together by name: what the beds grow, the fruit of the trees and bushes, the building materials. */
export type GoodsGroup = 'crops' | 'fruit' | 'materials'

/** Something the farm can count. */
export type Count =
  /** goods the farm has got by its work (harvested, collected, made, found as a surprise), these together */
  | { got: readonly ProduceId[] | GoodsGroup }
  /** one of the farm's counts of what the player has done (sold, earned, orders sent…) */
  | { stat: keyof FarmData['stats'] }
  /** everything a machine has made */
  | { made: MachineId }
  /** the animals of a herd (a fruit kind: its plants standing) */
  | { herd: ProducerId }
  /** pieces of a kind of the farm's decoration, standing and in its store; with a look, those standing in it */
  | { decor: ShopKind; look?: string }
  /** pieces of a kind of the house's furniture, standing and put away */
  | { piece: PieceType }
  /** a skin of an animal's tool: 1 once the farm owns it */
  | { skin: readonly [ToolKind, SkinStyle] }
  /** a garment: 1 once it is in the wardrobe */
  | { garment: string }
  /** the farm's level */
  | { level: true }

/** The goods of each group. */
export const GOODS: Record<GoodsGroup, readonly ProduceId[]> = {
  crops: CROPS.map((c) => c.id),
  fruit: PLANT_PRODUCERS.map((id) => PRODUCERS[id].good),
  materials: PRODUCE.filter((p) => p.material).map((p) => p.id),
}

/** What a machine makes: each good once, whatever recipe makes it. */
export const madeBy = (id: MachineId): ProduceId[] => [...new Set(MACHINES[id].recipes.map((r) => r.makes))]

const sum = (f: FarmData, ids: readonly ProduceId[]) => ids.reduce((n, id) => n + (f.got[id] ?? 0), 0)

/** How many of something the farm has now. */
export function countOf(f: FarmData, c: Count): number {
  if ('got' in c) return sum(f, typeof c.got === 'string' ? GOODS[c.got] : c.got)
  if ('stat' in c) return f.stats[c.stat]
  if ('made' in c) return sum(f, madeBy(c.made))
  if ('herd' in c) return f.producers[c.herd].animals
  if ('decor' in c) {
    const standing = f.layout.decor.filter((d) => d.kind === c.decor && (c.look === undefined || ('look' in d && d.look === c.look))).length
    return c.look === undefined ? standing + f.layout.stored[c.decor] : standing
  }
  if ('piece' in c) return f.home.pieces.filter((p) => p.type === c.piece).length + f.home.stored.filter((t) => t === c.piece).length
  if ('skin' in c) return f.skins[c.skin[0]].owned.includes(c.skin[1]) ? 1 : 0
  if ('garment' in c) return (garmentById(c.garment)?.level ?? Infinity) <= levelOf(f.xp.points) ? 1 : 0
  return levelOf(f.xp.points)
}
