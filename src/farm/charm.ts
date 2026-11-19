// The farm's charm (update-v1/missions/02-meta-collections.md c10): how lovely the farm has been made, in words and
// stars only — no coins, no XP, nothing to claim (doing it for its own sake). Scored on variety and care, never on a count
// alone: each row counts one thing the farm has (kinds of decoration standing, sets of the shop complete, lights, path
// tiles joined, trees, painted pieces, the house's painted rooms), up to its `cap`, at its `per` points each, so fifty
// fences score as one kind. A rank (`RANKS`) is the farm's from its points; the news shows it with a hint that names a
// row with room left. Pure: the farm's side feeds it its layout (src/farm/state/charm.ts).

import type { ArtId } from '../ui/art'
import { DECOR_FEET, type DecorPiece } from './layout'
import { SHOP, SOLD_KINDS, type SetId, type ShopKind } from './decor'

/** What the charm is measured on: what stands on the farm, and the house's rooms painted (none: no house). */
export interface CharmInput {
  decor: readonly DecorPiece[]
  /** how many of the house's rooms are painted; null while the farm has no house */
  roomsPainted: number | null
}

export type CharmRowId = 'lights' | 'trees' | 'variety' | 'paths' | 'sets' | 'paints' | 'rooms'

/** [review] The rows, in the order a hint is looked for: what each counts, its cap and its points each, and the hint. */
export const CHARM: readonly { id: CharmRowId; cap: number; per: number; hint: string }[] = [
  { id: 'lights', cap: 4, per: 5, hint: 'a lamp along the path would add to it' },
  { id: 'trees', cap: 5, per: 4, hint: 'a tree would add to it' },
  { id: 'variety', cap: 12, per: 5, hint: 'a new kind of decoration would add to it' },
  { id: 'paths', cap: 8, per: 2, hint: 'path tiles laid edge to edge would add to it' },
  { id: 'sets', cap: 5, per: 8, hint: 'a whole set from the shop would add to it' },
  { id: 'paints', cap: 4, per: 3, hint: 'a painted bench or fence would add to it' },
  { id: 'rooms', cap: 4, per: 3, hint: 'a painted room in the house would add to it' },
]

/** [review] The ranks: the points each starts at, its name and stars. */
export const RANKS: readonly { from: number; name: string; stars: number; art: ArtId }[] = [
  { from: 0, name: 'Plain', stars: 1, art: 'seedling' },
  { from: 20, name: 'Tidy', stars: 2, art: 'four-leaf-clover' },
  { from: 50, name: 'Pretty', stars: 3, art: 'cherry-blossom' },
  { from: 90, name: 'Charming', stars: 4, art: 'sparkles' },
  { from: 130, name: 'Enchanting', stars: 5, art: 'glowing-star' },
]

const LIGHTS: readonly ShopKind[] = ['lamp', 'lantern']
const TREES: readonly ShopKind[] = ['tree', 'pine', 'apple-tree', 'orange-tree', 'cherry-tree']

/** Path tiles that lie edge to edge with another (each counted once). */
function joinedTiles(decor: readonly DecorPiece[]): number {
  const tiles = decor.filter((d) => DECOR_FEET[d.kind].tile)
  return tiles.filter((a) => {
    const step = 2 * DECOR_FEET[a.kind].hx
    return tiles.some((b) => b !== a && b.kind === a.kind && Math.abs(Math.hypot(a.x - b.x, a.z - b.z) - step) < 0.05)
  }).length
}

/** The sets of the shop whose every kind stands on the farm. */
function setsComplete(decor: readonly DecorPiece[]): number {
  const standing = new Set(decor.map((d) => d.kind))
  const sets = new Map<SetId, boolean>()
  for (const k of SOLD_KINDS) sets.set(SHOP[k].set, (sets.get(SHOP[k].set) ?? true) && standing.has(k))
  return [...sets.values()].filter(Boolean).length
}

/** What each row counts on a farm (uncapped). */
export function charmCounts(f: CharmInput): Record<CharmRowId, number> {
  return {
    lights: f.decor.filter((d) => LIGHTS.includes(d.kind)).length,
    trees: f.decor.filter((d) => TREES.includes(d.kind)).length,
    variety: new Set(f.decor.map((d) => d.kind)).size,
    paths: joinedTiles(f.decor),
    sets: setsComplete(f.decor),
    paints: f.decor.filter((d) => d.look && SHOP[d.kind].paint).length,
    rooms: f.roomsPainted ?? 0,
  }
}

/** The farm's charm in points: each row's count up to its cap, at its points each. */
export function charmPoints(f: CharmInput): number {
  const n = charmCounts(f)
  return CHARM.reduce((sum, row) => sum + Math.min(row.cap, n[row.id]) * row.per, 0)
}

/** The rank of `points` (its index in RANKS). */
export const rankOf = (points: number) => RANKS.reduce((best, r, i) => (points >= r.from ? i : best), 0)

/** The charm as the news shows it: its rank (name, stars, picture), and what would add to it (none once every row is
 *  full: "Enchanting" and nothing left). */
export interface CharmView {
  rank: number
  name: string
  stars: number
  of: number
  art: ArtId
  hint: string | null
}

export function charmView(f: CharmInput): CharmView {
  const n = charmCounts(f)
  const rank = rankOf(charmPoints(f))
  // the first row with room left (the rooms only while the farm has a house)
  const row = CHARM.find((r) => n[r.id] < r.cap && (r.id !== 'rooms' || f.roomsPainted !== null))
  const r = RANKS[rank]
  return { rank, name: r.name, stars: r.stars, of: RANKS.length, art: r.art, hint: row?.hint ?? null }
}
