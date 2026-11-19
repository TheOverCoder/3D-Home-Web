import { art, type ArtId } from '../ui/art'
import { MACHINES, UPGRADES, type CropId, type MachineId, type UpgradeId } from './data'
import { SHOP, type ShopKind } from './decor'
import { iconUrl, shopArtUrl } from './icons'
import type { UnlockId } from './unlocks'

// How what a level opens (./unlocks.ts) is shown: each thing's picture and where it is found once open (the "Unlocked!"
// cards, the level card's "At level N"), and a shop's rows with what is open first. Made from the id alone: a new row
// of UNLOCKS needs nothing here.

/** Each upgrade's picture (the farm shop's, and its card when a level opens it). */
export const UPGRADE_ART: Record<UpgradeId, ArtId> = {
  east: 'seedling',
  west: 'sheaf-of-rice',
  north: 'ear-of-corn',
  queue: 'people-queue',
  pace: 'person-running',
  cow: 'cow',
  sheep: 'ewe',
  hen: 'chicken',
  sprinkler: 'droplet',
  compost: 'fallen-leaf',
}

const parts = (id: UnlockId) => {
  const [kind, rest = '', more = ''] = id.split(':')
  return { kind, rest, more }
}

/** A thing's picture: a crop's good, a recipe's (what it makes), an upgrade's shop picture, a decoration's, a field's
 *  clover, the new bed's hammer. */
export function unlockPic(id: UnlockId): string {
  const { kind, rest, more } = parts(id)
  if (kind === 'bed') return art('hammer')
  if (kind === 'crop') return iconUrl(rest as CropId)
  if (kind === 'recipe') return iconUrl(MACHINES[rest as MachineId].recipes.find((r) => r.id === more)!.makes)
  if (kind === 'upgrade') return art(UPGRADE_ART[rest as UpgradeId])
  if (kind === 'decor') return shopArtUrl(rest as ShopKind)
  if (kind === 'herd') return art(UPGRADE_ART[UPGRADES.find((u) => u.herd === rest)!.id])
  return art('four-leaf-clover')
}

/** Where a thing is found once it is open: the seed packets, its machine, the farm shop, the edit mode's shop (its
 *  decoration or its fruit trees), the edit mode itself (a field), a staked plot's tag (a bed). */
export function whereOf(id: UnlockId): string {
  const { kind, rest } = parts(id)
  if (kind === 'bed') return 'Build'
  if (kind === 'crop') return 'Seeds'
  if (kind === 'recipe') return MACHINES[rest as MachineId].name
  if (kind === 'upgrade' || kind === 'herd') return 'Shop'
  if (kind === 'decor') return SHOP[rest as ShopKind].tab === 'fruit' ? 'Fruit trees' : 'Decor'
  return 'Edit'
}

/** A shop's rows as it shows them with locks: what is open first, in its own order, then what is locked, the nearest
 *  level first (rows locked at the same level keep their order). `lock`: the level a row opens at, null while open. */
export function openFirst<T>(rows: readonly T[], lock: (row: T) => number | null): T[] {
  return rows
    .map((row, i) => ({ row, i, at: lock(row) ?? 0 }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((x) => x.row)
}
