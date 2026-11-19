// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { ALBUM, ALBUM_TILES, PAGE_IDS, TILE_IDS, albumView, freshAlbum, isPage, isTile, pagesDone, sanitizeAlbum, seasonsLived, tileCount, tilesEarned } from './album'
import { CROPS, ITEMS, PRODUCE } from './data'
import { DECOR_KINDS, FRUIT_KINDS } from './decor'
import { GARMENTS, albumGarment } from './outfit'
import { ALMOST } from './road'
import { SEASON_DAYS } from './season'
import { farm, resetFarm } from './state'

// The farm album as rules (src/farm/album.ts): every tile earned by a deed reached in play (none by the calendar, none
// at random, none twice), a page done when every tile is earned, each page's own garment, what is new since it was
// opened, the cover's long ladders, and the record as saved.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
})

describe('the pages and their tiles', () => {
  it('every tile once, on one page; every page has a garment of its own that only the album gives', () => {
    expect(new Set(TILE_IDS).size).toBe(TILE_IDS.length)
    expect(new Set(PAGE_IDS).size).toBe(PAGE_IDS.length)
    for (const p of ALBUM) {
      expect(p.tiles.length, p.id).toBeGreaterThan(0)
      for (const t of p.tiles) expect(t.id.startsWith(`${p.id}:`), t.id).toBe(true)
      const g = albumGarment(p.id)
      expect(g?.from, p.id).toEqual({ kind: 'album', page: p.id })
      expect(g?.level).toBe(Infinity)
    }
    expect(new Set(ALBUM.map((p) => albumGarment(p.id)!.id)).size).toBe(ALBUM.length)
  })

  it('the farm’s things are all on it: every crop and fruit, every good of the barn, every material, every kind of the shop', () => {
    const got = (page: string) => ALBUM.find((p) => p.id === page)!.tiles.map((t) => t.id.split(':')[1])
    expect(got('grown')).toEqual(expect.arrayContaining(CROPS.map((c) => c.id)))
    expect(got('materials')).toEqual(ITEMS)
    const barn = PRODUCE.filter((p) => !p.material && !got('grown').includes(p.id)).map((p) => p.id)
    expect(got('barn').sort()).toEqual(barn.sort())
    expect([...got('garden'), ...got('scarecrows')].sort()).toEqual([...DECOR_KINDS].sort())
    expect(got('orchard')).toEqual(FRUIT_KINDS)
  })

  it('no tile is time-limited or random: each counts a deed of play (a good got, a herd, a piece, a skin, the seasons lived), each reachable', () => {
    for (const t of ALBUM_TILES) {
      const c = t.count
      expect(
        ['got', 'herd', 'decor', 'skin', 'season'].some((k) => k in c),
        t.id,
      ).toBe(true)
      expect(t.need, t.id).toBeGreaterThanOrEqual(1)
      expect(t.how.length, t.id).toBeGreaterThan(3)
      // no word of a date, a month, a time limit or chance
      expect(t.how, t.id).not.toMatch(/until|before|month|today|only|chance|random|lucky|daily/i)
    }
  })

  it('a farm earns tiles by doing things, and a page is done when every tile is earned', () => {
    expect(tilesEarned(farm)).toEqual(expect.arrayContaining(['herd:hens-1', 'herd:hens-2', 'herd:cows-1']))
    expect(pagesDone(farm)).toEqual([])
    for (const id of ITEMS) farm.got[id] = 1
    expect(pagesDone(farm)).toEqual(['materials'])
    farm.got.brick = 0
    expect(pagesDone(farm)).toEqual([])
  })

  it('the seasons lived: none before the year begins, then each season the farm has reached', () => {
    farm.played = { days: 3, last: 0 }
    farm.season = { from: 1, told: -1 }
    expect(seasonsLived(farm)).toBe(0)
    farm.season = { from: 1, told: 0 }
    expect(seasonsLived(farm)).toBe(1)
    farm.played = { days: 1 + SEASON_DAYS, last: 0 }
    expect(seasonsLived(farm)).toBe(2)
    expect(tileCount(farm, { season: 1 })).toBe(1)
    expect(tileCount(farm, { season: 2 })).toBe(0)
    farm.played = { days: 1 + 4 * SEASON_DAYS, last: 0 }
    expect(pagesDone(farm)).toContain('seasons')
  })
})

describe('what the album shows', () => {
  it('each tile earned, new since it was last open, or still to earn (how); each page how full, and its garment', () => {
    farm.got.brick = 1
    const v = albumView(farm, [])
    const materials = v.pages.find((p) => p.id === 'materials')!
    expect(materials).toMatchObject({ got: 1, of: ITEMS.length, done: false })
    expect(materials.tiles.find((t) => t.id === 'materials:brick')?.state).toBe('new')
    expect(materials.tiles.find((t) => t.id === 'materials:log')).toMatchObject({ state: 'todo', how: 'Comes as a surprise', have: 0, need: 1 })
    expect(albumView(farm, ['materials:brick']).pages.find((p) => p.id === 'materials')!.tiles[0].state).toBe('got')
    // none is new when the view is made with nothing shown yet known
    expect(
      albumView(farm, null)
        .pages.flatMap((p) => p.tiles)
        .some((t) => t.state === 'new'),
    ).toBe(false)
    expect(materials.garment).toBe(albumGarment('materials'))
    // almost done in its last stretch (src/farm/road.ts, ALMOST): the grown page, one tile short of it and at it
    const grown = ALBUM.find((p) => p.id === 'grown')!.tiles
    const from = Math.ceil(ALMOST * grown.length - 1e-9)
    for (const t of grown.slice(0, from - 1)) farm.got[t.id.split(':')[1] as keyof typeof farm.got] = 1
    expect(albumView(farm, []).pages.find((p) => p.id === 'grown')!.near?.almost).toBe(false)
    farm.got[grown[from - 1].id.split(':')[1] as keyof typeof farm.got] = 1
    expect(albumView(farm, []).pages.find((p) => p.id === 'grown')!.near?.almost).toBe(true)
  })

  it('the cover counts the long ladders: the wardrobe’s garments, the medals, the days played', () => {
    farm.goals.eggs = 2
    farm.goals.milk = 1
    farm.played = { days: 23, last: 0 }
    const v = albumView(farm)
    expect(v.cover).toEqual({ garments: { have: 6, of: GARMENTS.length }, medals: 3, days: 23 })
    expect(v.tiles.of).toBe(ALBUM_TILES.length)
  })
})

describe('the record as saved', () => {
  it('a farm from before it: nothing shown, no page given', () => {
    expect(sanitizeAlbum(undefined, [])).toEqual(freshAlbum())
    expect(sanitizeAlbum('x', [])).toEqual(freshAlbum())
  })

  it('known tiles and pages, each once, in the album’s order; a page done only with its garment owned', () => {
    const owned = [albumGarment('materials')!.id]
    const raw = { seen: ['materials:log', 'nope', 'materials:brick', 'materials:log', 7], done: ['materials', 'garden', 'x', 'materials'] }
    const a = sanitizeAlbum(raw, owned)
    expect(a).toEqual({ seen: ['materials:brick', 'materials:log'], done: ['materials'] })
    expect(sanitizeAlbum(JSON.parse(JSON.stringify(a)), owned)).toEqual(a)
    expect(a.seen.every(isTile) && a.done.every(isPage)).toBe(true)
  })
})
