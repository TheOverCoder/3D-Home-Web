// The farm album (its card ./AlbumCard.tsx, opened from the corner menu by ./AlbumPanel.tsx): what the farm has grown,
// collected and made, its herd, the materials found, its garden and scarecrows, its orchard, its tools' skins and the
// seasons it has lived, each a tile on a page. A tile is earned by a deed and nothing else (decision 9: no random
// stickers, no duplicates): what it counts is data (src/farm/measure.ts, and the seasons lived), reached by play, never
// on a day of the calendar. A tile not earned yet is a silhouette that says how to earn it. A page whose every tile is
// earned gives, by itself and once, a garment only the album gives (./outfit.ts, `from: album`): a toast and the
// wardrobe, no badge, no tap to claim, no coins and no XP. The cover counts the long ladders — the wardrobe's garments,
// the goals' medals, the days played — rather than pages that never end. Pure: the farm keeps what was shown and which
// pages gave their garment (`farm.album`, src/farm/state/album.ts).

import type { ArtId } from '../ui/art'
import { CROPS, ITEMS, MACHINE_IDS, MACHINES, PLANT_PRODUCERS, PRODUCERS, TOOL_KINDS, produceById, type ProduceId, type ProducerId, type ToolKind } from './data'
import { DECOR_KINDS, FRUIT, FRUIT_KINDS, SHOP, type ShopKind } from './decor'
import { countOf, madeBy, type Count } from './measure'
import { albumGarment, GARMENTS, garmentsAt, type Garment } from './outfit'
import { nearest, stops, type Nearest } from './road'
import { SEASON_IDS, SEASONS, seasonAt } from './season'
import { SKIN_STYLES, SKINS, type SkinStyle } from './skins'
import type { FarmData } from './state'
import { levelOf } from './xp'

/** A tile's picture: a good of the farm's (its model), interface art, a kind of the edit shop's, a tool's skin. */
export type TilePic = { item: ProduceId } | { art: ArtId } | { decor: ShopKind } | { skin: readonly [ToolKind, SkinStyle] }

/** What a tile counts: one of the farm's counts (src/farm/measure.ts), or the seasons it has lived (the season of this
 *  ordinal reached: 0 is the first spring). */
export type TileCount = Count | { season: number }

export interface TileDef {
  /** unique across the album: "<page>:<thing>" */
  id: string
  name: string
  pic: TilePic
  count: TileCount
  /** the count it is earned at */
  need: number
  /** how to earn it, in a few words: "Bake it in the oven" */
  how: string
}

export interface PageDef {
  id: string
  name: string
  art: ArtId
  tiles: TileDef[]
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** One of the farm's goods got by its work, once. */
const good = (page: string, id: ProduceId, how: string): TileDef => ({ id: `${page}:${id}`, name: cap(produceById(id).name), pic: { item: id }, count: { got: [id] }, need: 1, how })
/** A kind of the edit shop's, owned (standing or in the store). */
const piece = (page: string, kind: ShopKind, how: string): TileDef => ({ id: `${page}:${kind}`, name: SHOP[kind].name, pic: { decor: kind }, count: { decor: kind }, need: 1, how })

/** The animals of a herd, one tile for each the herd can have. */
const HERD_ART: Partial<Record<ProducerId, ArtId>> = { hens: 'chicken', cows: 'cow', sheep: 'ewe' }
function herd(id: 'hens' | 'cows' | 'sheep'): TileDef[] {
  const h = PRODUCERS[id].herd!
  const names = (h as { names?: readonly string[] }).names
  return Array.from({ length: h.max }, (_, i) => ({
    id: `herd:${id}-${i + 1}`,
    name: names?.[i] ?? `Hen ${i + 1}`,
    pic: { art: HERD_ART[id]! },
    count: { herd: id },
    need: i + 1,
    how: i < h.start ? 'Comes with the farm' : 'Add one at the shop',
  }))
}

/** The goods the animals give and the machines make (never a crop, a fruit or a material). */
const machineGoods = MACHINE_IDS.flatMap((m) => madeBy(m).map((id) => good('barn', id, `Make it at the ${MACHINES[m].name.toLowerCase()}`)))
const animalGoods = (['hens', 'cows', 'sheep'] as const).map((id) => good('barn', PRODUCERS[id].good, `Collect it from the ${id}`))

/** The pictures of the seasons (interface art the game has: the season's own where there is one). */
const SEASON_ART: Record<(typeof SEASON_IDS)[number], ArtId> = { spring: 'seedling', summer: 'sun', autumn: 'fallen-leaf', winter: 'crescent-moon' }

/** [decision 9] The album: its pages and their tiles, every one earned by a deed. A new good, kind or animal is a row. */
export const ALBUM: readonly PageDef[] = [
  {
    id: 'grown',
    name: 'Grown',
    art: 'seedling',
    tiles: [
      ...CROPS.map((c) => good('grown', c.id, 'Grow it in a bed')),
      good('grown', PRODUCERS.tree.good, 'Pick it from the lemon tree'),
      ...PLANT_PRODUCERS.map((id) => good('grown', PRODUCERS[id].good, `Pick it from its ${FRUIT[id as keyof typeof FRUIT]?.name.toLowerCase() ?? 'tree'}`)),
    ],
  },
  // (update v1's beehive gives the barn its honey: 01b)
  { id: 'barn', name: 'From the barn', art: 'nest-with-eggs', tiles: [...animalGoods, good('barn', PRODUCERS.beehive.good, 'Collect it from a beehive'), ...machineGoods] },
  { id: 'herd', name: 'The herd', art: 'cow', tiles: [...herd('hens'), ...herd('cows'), ...herd('sheep')] },
  { id: 'materials', name: 'Building materials', art: 'building-construction', tiles: ITEMS.map((id) => good('materials', id, 'Comes as a surprise')) },
  { id: 'garden', name: 'The garden', art: 'house-with-garden', tiles: DECOR_KINDS.filter((k) => !k.startsWith('scarecrow')).map((k) => piece('garden', k, 'Buy it in the edit shop')) },
  { id: 'scarecrows', name: 'Scarecrows', art: 'sheaf-of-rice', tiles: DECOR_KINDS.filter((k) => k.startsWith('scarecrow')).map((k) => piece('scarecrows', k, 'Buy it in the edit shop')) },
  { id: 'orchard', name: 'The orchard', art: 'basket', tiles: FRUIT_KINDS.map((k) => piece('orchard', k, 'Buy it in the shop’s trees')) },
  {
    id: 'skins',
    name: 'Tools',
    art: 'bucket',
    tiles: TOOL_KINDS.flatMap((tool) =>
      SKIN_STYLES.map((style) => ({
        id: `skins:${tool}-${style}`,
        name: SKINS[tool][style].name,
        pic: { skin: [tool, style] as const },
        count: { skin: [tool, style] as const },
        need: 1,
        how: SKINS[tool][style].price ? 'Buy it at its tool' : 'Comes with its tool',
      })),
    ),
  },
  {
    id: 'seasons',
    name: 'The seasons',
    art: 'spiral-calendar',
    tiles: SEASON_IDS.map((id, k) => ({
      id: `seasons:${id}`,
      name: SEASONS[id].name,
      pic: { art: SEASON_ART[id] },
      count: { season: k },
      need: 1,
      how: k ? `Play on into ${SEASONS[id].name.toLowerCase()}` : 'Comes as your year begins',
    })),
  },
]

export const ALBUM_TILES: readonly TileDef[] = ALBUM.flatMap((p) => p.tiles)
export const TILE_IDS: readonly string[] = ALBUM_TILES.map((t) => t.id)
export const PAGE_IDS: readonly string[] = ALBUM.map((p) => p.id)
export const isTile = (id: unknown): id is string => typeof id === 'string' && TILE_IDS.includes(id)
export const isPage = (id: unknown): id is string => typeof id === 'string' && PAGE_IDS.includes(id)
export const pageById = (id: string) => ALBUM.find((p) => p.id === id)

/** The seasons the farm has lived: none before its year begins (a new farm's first steps), then each season reached. */
export function seasonsLived(f: Pick<FarmData, 'played' | 'season'>): number {
  if (f.season.told < 0) return 0
  return seasonAt(Math.max(1, f.played.days), f.season.from).ordinal + 1
}

/** How far a tile's count has come on a farm. */
export const tileCount = (f: FarmData, c: TileCount): number => ('season' in c ? (seasonsLived(f) > c.season ? 1 : 0) : countOf(f, c))
export const tileEarned = (f: FarmData, t: TileDef) => tileCount(f, t.count) >= t.need

/** The tiles a farm has earned, in the album's order. */
export const tilesEarned = (f: FarmData): string[] => ALBUM_TILES.filter((t) => tileEarned(f, t)).map((t) => t.id)
/** The pages whose every tile is earned, in the album's order. */
export const pagesDone = (f: FarmData): string[] => ALBUM.filter((p) => p.tiles.every((t) => tileEarned(f, t))).map((p) => p.id)

/** What the farm keeps of its album: the tiles shown as earned (one earned since is new), and the pages that gave their
 *  garment (once each). */
export interface AlbumRecord {
  seen: string[]
  done: string[]
}
export const freshAlbum = (): AlbumRecord => ({ seen: [], done: [] })

/** The album as saved: known tiles and pages, each once, in the album's order; a page done only with its garment owned
 *  (one that is not is given again, once). Missing (a farm from before it): nothing shown, no page given yet. */
export function sanitizeAlbum(raw: unknown, owned: readonly string[]): AlbumRecord {
  const list = (v: unknown) => (Array.isArray(v) ? v : [])
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const seen = list(r.seen)
  const done = list(r.done)
  return {
    seen: TILE_IDS.filter((id) => seen.includes(id)),
    done: PAGE_IDS.filter((id) => done.includes(id) && owned.includes(albumGarment(id)?.id ?? '')),
  }
}

/** A tile as the album shows it: earned (new: since the album was last open), or still to earn (a silhouette, how). */
export interface TileView {
  id: string
  name: string
  pic: TilePic
  state: 'got' | 'new' | 'todo'
  how: string
  have: number
  need: number
}

/** A page as the album shows it: its tiles, how many are earned, its garment (given once it is done). */
export interface PageView {
  id: string
  name: string
  art: ArtId
  tiles: TileView[]
  got: number
  of: number
  done: boolean
  garment: Garment | undefined
  /** how near the page is to done, in tiles (src/farm/road.ts: almost in its last stretch); null once done */
  near: Nearest | null
}

/** What the album shows (./AlbumCard.tsx): its pages, how many are done, and the cover's long ladders. */
export interface AlbumView {
  pages: PageView[]
  done: number
  tiles: { got: number; of: number }
  cover: {
    /** the garments in the wardrobe, of every garment there is */
    garments: { have: number; of: number }
    /** the goals' medals won */
    medals: number
    /** days played */
    days: number
  }
}

/** The album of a farm, its tiles shown as earned so far `seen` (null: none is new). */
export function albumView(f: FarmData, seen: readonly string[] | null = f.album?.seen ?? null): AlbumView {
  const pages = ALBUM.map((p): PageView => {
    const tiles = p.tiles.map((t): TileView => {
      const have = tileCount(f, t.count)
      const state = have < t.need ? 'todo' : seen && !seen.includes(t.id) ? 'new' : 'got'
      return { id: t.id, name: t.name, pic: t.pic, state, how: t.how, have: Math.min(have, t.need), need: t.need }
    })
    const got = tiles.filter((t) => t.state !== 'todo').length
    return {
      id: p.id,
      name: p.name,
      art: p.art,
      tiles,
      got,
      of: tiles.length,
      done: got === tiles.length,
      garment: albumGarment(p.id),
      near: nearest(
        stops(1, () => tiles.length),
        got,
      ),
    }
  })
  const level = levelOf(f.xp.points)
  return {
    pages,
    done: pages.filter((p) => p.done).length,
    tiles: { got: pages.reduce((n, p) => n + p.got, 0), of: ALBUM_TILES.length },
    cover: {
      garments: { have: garmentsAt(level, f.outfit.owned).length, of: GARMENTS.length },
      medals: Object.values(f.goals).reduce((n, k) => n + (k ?? 0), 0),
      days: f.played.days,
    },
  }
}
