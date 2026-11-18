import type { ArtId } from '../ui/art'
import { CROPS, ESTATE, MACHINES, MACHINE_IDS, MANAGER, produceById, type CropDef, type ProduceId, type Recipe } from './data'
import type { FarmData } from './state/core'

// The farm's laws of worth (update-v1/missions/01-loop-economy.md, Foundation 1). One law for what a bed of a crop
// should net for the time it grows, one for what a machine's job should add for the time it takes: both grow slower
// than the time, so a long timer pays more a press and less a minute (a long crop is for the night, a short one for
// while you play). What a minute of play earns at a level, fitted to the pace simulation's good player: the yardstick
// of a time away, of a night's return and of what comes next, in minutes of play — never the size of a prize (a
// prize is sized from the next level's coins: `sized`, `rewardTier`; update-v1/CONTRACTS.md B6). And the next thing
// the coins are saved for, as the level's card shows it. Pure: it reads a farm, never changes one.

/** A crop's law: the coins a bed should net (its harvest at fair price, less its seeds) for `s` seconds of growing. */
export const CROP_LAW = { k: 2.25, power: 0.4 } as const
/** A job's law: the coins a machine's job should add (what it makes, less what goes in) for `s` seconds of work. */
export const JOB_LAW = { k: 5.4, power: 0.4 } as const
/** How far a crop or a recipe may stray from its law (economy.test.ts holds every row to it). */
export const LAW_SLACK = 0.3

export const cropWorth = (seconds: number) => CROP_LAW.k * Math.max(0, seconds) ** CROP_LAW.power
export const jobWorth = (seconds: number) => JOB_LAW.k * Math.max(0, seconds) ** JOB_LAW.power

/** What a bed of a crop nets: its harvest at fair price, less its seeds. */
export const cropNet = (c: CropDef) => c.yield * c.price - c.seedCost
/** What goes into a recipe, at fair price. */
export const recipeCost = (r: Recipe) => (Object.entries(r.needs) as [ProduceId, number][]).reduce((sum, [good, n]) => sum + produceById(good).price * n, 0)
/** What a job adds: what it makes, less what goes in, at fair price. */
export const jobAdds = (r: Recipe) => produceById(r.makes).price - recipeCost(r)

/** The mill's crops (wheat, sugar cane): a converter's inputs, judged by what they make, not by the crop law. */
export const MILL_CROPS: readonly ProduceId[] = MACHINES.mill.recipes.flatMap((r) => Object.keys(r.needs) as ProduceId[])
/** The machines whose jobs the job law holds: all but the mill (it only turns one good into another). */
export const LAW_MACHINES = MACHINE_IDS.filter((id) => id !== 'mill')

/**
 * Coins a minute of play earns at a level (sales and orders): a curve fitted to the pace simulation's good player
 * (`npm run sim`, seeds 1–3: about 15 a minute over levels 1–7, 40 over 7–10, 70 over 10–15, 90 past 15). It measures
 * time in play — what a night is worth, what is nearest — and sizes no prize. `top`: what it levels off at; `mid`: the
 * level it reaches half of that at; `width`: how many levels it takes to rise.
 */
export const INCOME = { top: 95, mid: 9, width: 2.5 } as const
export const incomeAt = (level: number) => INCOME.top / (1 + Math.exp(-(level - INCOME.mid) / INCOME.width))

/** Which kind of source a good comes from, for what it nets: a crop (less its seeds), a machine (less what goes in),
 *  or a producer (the animals, the trees: at full price, they need nothing). */
function netOne(item: ProduceId): number {
  const crop = CROPS.find((c) => c.id === item)
  if (crop) return cropNet(crop) / crop.yield
  for (const id of MACHINE_IDS) {
    const r = MACHINES[id].recipes.find((x) => x.makes === item)
    if (r) return jobAdds(r)
  }
  return produceById(item).price
}

/** What goods that came to be ready are worth, net of what was spent on them before (a harvest less its seeds, a job
 *  less what went in, the rest at full price), at fair price: the value a time away brought. */
export const returnWorth = (goods: readonly { item: ProduceId; count: number }[]) => goods.reduce((sum, g) => sum + g.count * netOne(g.item), 0)

/** Something big the coins are saved for, as the level's card shows it ("Market 640 / 1500"). */
export interface Saving {
  id: string
  name: string
  art: ArtId
  /** the coins towards it (never more than its price), and its price */
  have: number
  of: number
}

/** The big things to save for, in order: the first not yet the farm's is the next (a mission's new one is a row). */
export const SAVINGS: readonly { id: string; name: string; art: ArtId; price: number; owned: (f: FarmData) => boolean }[] = [
  { id: 'market', name: 'Market', art: 'convenience-store', price: MANAGER.shopPrice, owned: (f) => f.market.owned },
  { id: 'house', name: 'House', art: 'house-with-garden', price: ESTATE.price, owned: (f) => f.apartment.owned },
]

/** The next big thing to save for, and the coins towards it; null once every one is the farm's. */
export function nextSaving(f: FarmData): Saving | null {
  const row = SAVINGS.find((s) => !s.owned(f))
  return row ? { id: row.id, name: row.name, art: row.art, have: Math.max(0, Math.min(row.price, Math.floor(f.coins))), of: row.price } : null
}
