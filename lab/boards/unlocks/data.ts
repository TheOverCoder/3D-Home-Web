import { CROPS, MACHINES, UPGRADES, type CropId, type MachineId, type UpgradeId } from '../../../src/farm/data'
import { DECOR_KINDS, SHOP, type ShopKind } from '../../../src/farm/decor'
import { iconUrl, shopArtUrl } from '../../../src/farm/icons'
import { lockedAt, opensAt, unlockLevel, type UnlockId } from '../../../src/farm/unlocks'
import { xpAt } from '../../../src/farm/xp'
import { art, type ArtId } from '../../../src/ui/art'
import { atHour, type TopState } from '../top/parts'

// What the "unlocks" board shows: the game's own table of what each level opens (src/farm/unlocks.ts, UNLOCKS) and
// its pure helpers (opensAt, lockedAt, unlockName), with the farm's own rows (CROPS, UPGRADES, SHOP, PARCELS). What the
// game does not have yet is marked SAMPLE: the pictures of a thing opened (plans/first-hour.md: src/farm/unlockArt.ts)
// and where it is found once open (variant C's cards).

/** How the locked face looks, by variant: none (today: nothing is locked), a chip where the price is (A), a badge on
 *  the picture's corner (B), the level card's berry banner (C). */
export type Face = 'none' | 'chip' | 'badge' | 'banner'

/** What the board shows: the level's show and what it opened, a shop or a tag with its locked things, the level card. */
export type Scene = 'reveal' | 'seeds' | 'shop' | 'decor' | 'world' | 'edit' | 'card'

export interface UnlocksState {
  scene: Scene
  /** the farm's level: the one just reached (reveal), or the one it is at */
  level: number
  /** what the level reached opens (reveal: opensAt), or the next level's (card) */
  opens: UnlockId[]
  /** the farm's coins (the dashboard's chip, the sheets' purse) */
  coins: number
}

/** SAMPLE (src/farm/unlockArt.ts in the plan): each upgrade's picture, as the farm shop has it (FarmUI.tsx UPGRADE_ART). */
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

/** SAMPLE (unlockPic in the plan): a thing's picture — a crop's and a recipe's good (a recipe: what it makes), an
 *  upgrade's shop art, a decoration's picture, a field's clover, a bed's hammer. */
export function unlockPic(id: UnlockId): string {
  const { kind, rest, more } = parts(id)
  if (kind === 'bed') return art('hammer')
  if (kind === 'crop') return iconUrl(rest as CropId)
  if (kind === 'recipe') return iconUrl(MACHINES[rest as MachineId].recipes.find((r) => r.id === more)!.makes)
  if (kind === 'upgrade') return art(UPGRADE_ART[rest as UpgradeId])
  if (kind === 'decor') return shopArtUrl(rest as ShopKind)
  return art('four-leaf-clover')
}

/** SAMPLE (variant C): where a thing is found once it is open — the seed packets, its machine, the shop, the edit
 *  mode's shop or the edit mode itself. Made from the id alone: no new data. */
export function whereOf(id: UnlockId): string {
  const { kind, rest } = parts(id)
  if (kind === 'bed') return 'Build'
  if (kind === 'crop') return 'Seeds'
  if (kind === 'recipe') return MACHINES[rest as MachineId].name
  if (kind === 'upgrade') return 'Shop'
  if (kind === 'decor') return SHOP[rest as ShopKind].tab === 'fruit' ? 'Fruit trees' : 'Decor'
  return 'Edit'
}

/** The level a thing opens at, while the farm at `level` has it locked (null: open, or today's game with no locks). */
export const lockFor = (face: Face, id: UnlockId, level: number) => (face === 'none' ? null : lockedAt(id, level))

/** A list ordered as a shop with locks shows it: what is open first (in the table's order), then what is locked, the
 *  nearest level first — today's game (no locks) keeps the table's order. */
export function openFirst<T>(face: Face, rows: T[], idOf: (row: T) => UnlockId, level: number): T[] {
  if (face === 'none') return rows
  const at = (row: T) => lockedAt(idOf(row), level) ?? 0
  return rows
    .map((row, i) => ({ row, i, l: at(row) }))
    .sort((a, b) => a.l - b.l || a.i - b.i)
    .map((x) => x.row)
}

export const CROP_ROWS = CROPS
export const UPGRADE_ROWS = UPGRADES
export const DECOR_ROWS = DECOR_KINDS.map((k) => SHOP[k])

/** The dashboard behind (lab/boards/top, D: the game's top today) for a farm at `level`, its bar a part of the way. */
export function topAt(level: number, coins: number, part = 0.12): TopState {
  return {
    coins,
    xp: xpAt(level) + Math.round((xpAt(level + 1) - xpAt(level)) * part),
    paid: level,
    line: level > 1 ? { n: 1, level: 0 } : null,
    silo: { n: level > 1 ? 14 : 0, level: 1 },
    barn: { n: level > 1 ? 6 : 0, level: 1 },
    goals: 0,
    t: atHour(11),
    heading: 154,
    marks: [],
    hud: 'all',
  }
}

/** A level's state of the board: what it opens, by the table. */
export const reached = (level: number, coins: number): UnlocksState => ({ scene: 'reveal', level, opens: opensAt(level), coins })

/** Every level from 2 up opens something (the table's test holds it); the count, for the board's names. */
export const opensCount = (level: number) => opensAt(level).length

export { unlockLevel }
