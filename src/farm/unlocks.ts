// What each level opens (plans/first-hour.md, Part B): one row for each thing a farm buys, plants or puts into a
// machine, and the level it opens at. The farm asks it wherever that is done (src/farm/state.ts: `lockOf`, `isUnlocked`)
// and every shop, card and price tag shows a locked thing with a lock and its level; the level-up show tells what a
// level opened. A new crop, upgrade, recipe, decoration or field is a row here: the unit test fails until it has one.
// Pure: levels in, answers out (the switch that opens everything for the tests is the farm's: state.ts, unlockAll).
//
// Not here, on purpose: what a new farm stands with (the lemon tree, the hens, the cow, the sheep, the machines
// themselves: a machine is locked while all its recipes are), and what is held back by something else already — the
// silo's and the barn's levels (materials), a machine's queue places (open with the machine), the office's upgrades,
// the market's and the contractor's ladders, the shop and the house (prices, the rate ladder, the house's own price).

import { MACHINES, UPGRADES, type CakeId, type CropId, type MachineId, type UpgradeId } from './data'
import { SHOP, type ShopKind } from './decor'
import { PARCELS, type ParcelId } from './layout'

/** A recipe of a machine, as `machine:recipe` (MACHINES in ./data; the oven's recipes are its cakes). */
export type RecipeKey = 'mill:wheat' | 'mill:sugarcane' | 'loom:wool' | `oven:${CakeId}`

/** Everything a level opens: building a staked bed, a crop's seeds, an upgrade of the farm shop (the east and west
 *  fields among them), a recipe, a kind of the edit mode's shop (decoration, fruit trees and bushes), a field. */
export type UnlockId = 'bed' | `crop:${CropId}` | `upgrade:${UpgradeId}` | `recipe:${RecipeKey}` | `decor:${ShopKind}` | `parcel:${ParcelId}`

/** The level each opens at (1: from the start). By theme, something every level from 2 to 13, and held to the pace a
 *  new farm is held to: the pace simulation plays with these locks on (src/sim/pace.test.ts, `npm run sim`; a number
 *  moved is checked there). What a recipe needs opens no later than it (the test). */
export const UNLOCKS = {
  // a new farm: two crops for the seeds it can buy, the beds staked out, and the loom (the sheep come with fleeces)
  bed: 1,
  'crop:lettuce': 1,
  'crop:carrot': 1,
  'recipe:loom:wool': 1,
  // flour, and the first upgrade
  'crop:wheat': 2,
  'recipe:mill:wheat': 2,
  'upgrade:hen': 2,
  // a fruit, a longer line, the first decoration
  'crop:strawberry': 3,
  'upgrade:queue': 3,
  'decor:path': 3,
  'decor:fence': 3,
  'decor:stones': 3,
  // sugar, sprinklers
  'crop:sugarcane': 4,
  'recipe:mill:sugarcane': 4,
  'upgrade:sprinkler': 4,
  'decor:flowers': 4,
  'decor:bush': 4,
  // the oven's first cakes, more beds
  'recipe:oven:carrot_cake': 5,
  'recipe:oven:lemon_cake': 5,
  'upgrade:east': 5,
  'upgrade:compost': 5,
  // more land, a second cow, a busier lane
  'crop:tomato': 6,
  'upgrade:cow': 6,
  'upgrade:pace': 6,
  'parcel:north': 6,
  'decor:planter': 6,
  'decor:hedge': 6,
  'recipe:oven:strawberry_cake': 7,
  'upgrade:sheep': 7,
  'decor:lantern': 7,
  'decor:bench': 7,
  'decor:blueberry-bush': 7,
  'crop:corn': 8,
  'parcel:east': 8,
  'parcel:west': 8,
  'decor:roses': 8,
  'decor:scarecrow-farmer': 8,
  'upgrade:west': 9,
  'decor:birdbath': 9,
  'decor:scarecrow-haymaker': 9,
  'decor:scarecrow-pumpkin': 9,
  'decor:raspberry-bush': 9,
  'crop:pumpkin': 10,
  'recipe:oven:pumpkin_pie': 10,
  'decor:tree': 10,
  'decor:pine': 10,
  'decor:scarecrow-sunflower': 10,
  'decor:apple-tree': 11,
  'decor:scarecrow-witch': 11,
  'decor:scarecrow-ribbons': 11,
  'decor:lamp': 11,
  'decor:orange-tree': 12,
  'parcel:northEast': 12,
  'parcel:northWest': 12,
  'decor:scarecrow-crows': 12,
  'decor:scarecrow-pinwheel': 12,
  'decor:cherry-tree': 13,
  'decor:well': 13,
  'decor:scarecrow-jingle': 13,
} as const satisfies Record<UnlockId, number>

export const UNLOCK_IDS = Object.keys(UNLOCKS) as UnlockId[]

/** The level a thing opens at (one not in the table: open from the start; the test keeps the table whole). */
export const unlockLevel = (id: UnlockId): number => (UNLOCKS as Record<string, number>)[id] ?? 1

/** At this level: the level it opens at while it is locked, null once it is open. */
export const lockedAt = (id: UnlockId, level: number): number | null => (unlockLevel(id) > level ? unlockLevel(id) : null)

/** What reaching a level opens, in the table's order (none past the last row). */
export const opensAt = (level: number): UnlockId[] => UNLOCK_IDS.filter((id) => UNLOCKS[id] === level)

/** A machine's recipe in the table. */
export const recipeUnlock = (machine: MachineId, recipe: string) => `recipe:${machine}:${recipe}` as UnlockId

/** The level a machine opens at: its first recipe's (while all of them are locked, it offers nothing). */
export const machineOpensAt = (machine: MachineId) => Math.min(...MACHINES[machine].recipes.map((r) => unlockLevel(recipeUnlock(machine, r.id))))

/** A good's id as a name: "wheat" → "Wheat", "lemon_cake" → "Lemon cake" (shorter than a sale's words for it, "sheaf
 *  of wheat", "bag of flour"). */
const named = (good: string) => good[0].toUpperCase() + good.slice(1).replace(/_/g, ' ')

/** A thing's name, for the "Unlocked!" card, a lock's words and screen readers: "Wheat", "Flour" (the mill's wheat
 *  recipe: what it makes), "Another cow", "Stone path", "North meadow", "A new bed". */
export function unlockName(id: UnlockId): string {
  const [kind, rest = '', more = ''] = id.split(':')
  if (kind === 'bed') return 'A new bed'
  if (kind === 'crop') return named(rest)
  if (kind === 'upgrade') return UPGRADES.find((u) => u.id === rest)!.name
  if (kind === 'recipe') return named(MACHINES[rest as MachineId].recipes.find((r) => r.id === more)!.makes)
  if (kind === 'decor') return SHOP[rest as ShopKind].name
  return PARCELS[rest as ParcelId].name
}
