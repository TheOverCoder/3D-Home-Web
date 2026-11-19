import { describe, expect, it } from 'vitest'
import { TRAITS } from '../models/look'
import { LEVELS } from './data'
import {
  DEFAULT_OUTFIT,
  GARMENTS,
  GARMENT_EVERY,
  GIFT_GARMENTS,
  albumGarment,
  garmentAt,
  garmentById,
  garmentsAt,
  isGift,
  nextGarment,
  outfitLook,
  own,
  putOn,
  sanitizeOutfit,
  seasonGarment,
} from './outfit'

// The wardrobe's garments (src/farm/outfit.ts): two of each kind from the start, one more every fifth level to the
// top, the buyers' own clothes first; an outfit read back from a save, and put on.

describe('the garments', () => {
  it('level 1 has two shirts, two trousers and two hats', () => {
    const start = garmentsAt(1)
    expect(start.filter((g) => g.slot === 'shirt')).toHaveLength(2)
    expect(start.filter((g) => g.slot === 'trousers')).toHaveLength(2)
    expect(start.filter((g) => g.slot === 'hat')).toHaveLength(2)
    expect(start).toHaveLength(6)
  })

  it('one more every fifth level, to the top level, and none on any other level', () => {
    for (let L = 2; L <= LEVELS.max; L++) {
      const g = garmentAt(L)
      if (L % GARMENT_EVERY === 0) expect(g?.level, `level ${L}`).toBe(L)
      else expect(g, `level ${L}`).toBeUndefined()
    }
    expect(GARMENTS.filter((g) => !g.from)).toHaveLength(6 + LEVELS.max / GARMENT_EVERY)
    expect(garmentAt(LEVELS.max)?.name).toBe('Golden cap')
    expect(nextGarment(LEVELS.max)).toBeUndefined()
  })

  it('each is one of a kind: its id, and its look (kind and colour)', () => {
    expect(new Set(GARMENTS.map((g) => g.id)).size).toBe(GARMENTS.length)
    expect(new Set(GARMENTS.map((g) => `${g.slot}|${g.hat ?? ''}|${g.colour}`)).size).toBe(GARMENTS.length)
    for (const g of GARMENTS) {
      expect(g.colour, g.id).toMatch(/^#[0-9a-f]{6}$/)
      // a level, or where it comes from instead
      expect(Number.isFinite(g.level) !== !!g.from, g.id).toBe(true)
      expect(g.slot === 'hat', g.id).toBe(!!g.hat)
      expect(g.name.length, g.id).toBeGreaterThan(3)
    }
  })

  it('the clothes the buyers wear come first: every shirt and trousers colour of the people engine within the first 150 levels', () => {
    const early = garmentsAt(150)
    for (const c of TRAITS.shirts)
      expect(
        early.some((g) => g.slot === 'shirt' && g.colour === c),
        c,
      ).toBe(true)
    for (const c of TRAITS.trousers)
      expect(
        early.some((g) => g.slot === 'trousers' && g.colour === c),
        c,
      ).toBe(true)
    for (const kind of ['straw', 'cap', 'beanie'] as const)
      expect(
        early.some((g) => g.hat === kind),
        kind,
      ).toBe(true)
  })

  it('the next garment: the first still to come', () => {
    expect(nextGarment(1)?.level).toBe(5)
    expect(nextGarment(4)?.level).toBe(5)
    expect(nextGarment(5)?.level).toBe(10)
    expect(nextGarment(499)?.level).toBe(500)
  })
})

describe('an outfit', () => {
  it('a farm from before the wardrobe wears what the player always wore', () => {
    expect(sanitizeOutfit(undefined, 1)).toEqual(DEFAULT_OUTFIT)
    expect(sanitizeOutfit(null, 30)).toEqual(DEFAULT_OUTFIT)
    expect(outfitLook(DEFAULT_OUTFIT)).toEqual({ shirt: '#4c6a82', trousers: '#2b3038', hat: null })
  })

  it('reads back only garments of their slot that the level has; the new marks never past the level', () => {
    const level10 = garmentsAt(10)
    const shirt = level10.find((g) => g.slot === 'shirt' && g.level > 1)!
    const hat = level10.find((g) => g.slot === 'hat' && g.level > 1)!
    expect(sanitizeOutfit({ shirt: shirt.id, trousers: 'trousers-denim', hat: hat.id, seen: 5 }, 10)).toEqual({ shirt: shirt.id, trousers: 'trousers-denim', hat: hat.id, seen: 5, owned: [] })
    // not yet reached, the wrong slot, made up, the wrong type
    expect(sanitizeOutfit({ shirt: shirt.id, hat: 'trousers-denim', trousers: 'nope', seen: 99 }, 1)).toEqual({ ...DEFAULT_OUTFIT, seen: 1 })
    expect(sanitizeOutfit({ shirt: 7, trousers: {}, hat: 'shirt-blue', seen: NaN }, 4)).toEqual(DEFAULT_OUTFIT)
    // a garment from the album, not owned: not worn
    expect(sanitizeOutfit({ ...DEFAULT_OUTFIT, shirt: albumGarment('barn')!.id }, 500).shirt).toBe(DEFAULT_OUTFIT.shirt)
  })

  it('putting on: a garment of the level takes its slot; a hat chosen again comes off; one not reached changes nothing', () => {
    const hat = garmentById('cap-navy')!
    let o = putOn(DEFAULT_OUTFIT, 'shirt-rust', 1)
    expect(o.shirt).toBe('shirt-rust')
    o = putOn(o, hat.id, 1)
    expect(o.hat).toBe(hat.id)
    expect(outfitLook(o).hat).toEqual({ kind: 'cap', colour: hat.colour })
    expect(putOn(o, hat.id, 1).hat).toBeNull()
    const later = garmentAt(5)!
    expect(putOn(o, later.id, 4)).toBe(o)
    expect(putOn(o, 'nope', 500)).toBe(o)
  })
})

describe('the garments not of a level: the album’s pages and the season roads (outfit.owned)', () => {
  it('one for each album page and each season road of the first two years, none with a level, each in the wardrobe only when owned', () => {
    expect(GIFT_GARMENTS.map((g) => g.from)).toEqual(GARMENTS.filter((g) => g.from).map((g) => g.from))
    for (const page of ['grown', 'barn', 'herd', 'materials', 'garden', 'scarecrows', 'orchard', 'skins', 'seasons']) expect(albumGarment(page)?.from, page).toEqual({ kind: 'album', page })
    for (let k = 0; k < 8; k++) expect(seasonGarment(k)?.from, `season ${k}`).toEqual({ kind: 'season', ordinal: k })
    expect(seasonGarment(8)).toBeUndefined()
    for (const g of GIFT_GARMENTS) {
      expect(g.level).toBe(Infinity)
      expect(isGift(g.id)).toBe(true)
      expect(garmentsAt(500)).not.toContain(g)
      expect(garmentsAt(1, [g.id])).toContain(g)
    }
    // never the next garment of a level, never a level's own
    expect(nextGarment(LEVELS.max)).toBeUndefined()
    for (let L = 1; L <= LEVELS.max; L++) expect(garmentAt(L)?.from).toBeUndefined()
  })

  it('owned once, in the order they came; worn once owned; a garment of a level is never owned', () => {
    const a = albumGarment('garden')!
    const b = seasonGarment(0)!
    let o = own(own(own(DEFAULT_OUTFIT, a.id), b.id), a.id)
    expect(o.owned).toEqual([a.id, b.id])
    expect(own(o, 'shirt-blue')).toBe(o)
    expect(own(o, 'nothing')).toBe(o)
    expect(putOn(DEFAULT_OUTFIT, a.id, 500)).toBe(DEFAULT_OUTFIT)
    o = putOn(o, a.id, 1)
    expect(o.shirt).toBe(a.id)
    expect(garmentsAt(1, o.owned).map((g) => g.id)).toEqual([...garmentsAt(1).map((g) => g.id), a.id, b.id])
  })

  it('as saved: known ones not of a level, each once, in order; worn only when owned; a farm from before them owns none', () => {
    const a = albumGarment('garden')!
    const b = seasonGarment(1)!
    expect(sanitizeOutfit({ ...DEFAULT_OUTFIT, owned: undefined }, 3).owned).toEqual([])
    const read = sanitizeOutfit({ ...DEFAULT_OUTFIT, shirt: a.id, hat: b.id, owned: [a.id, 'shirt-blue', b.id, a.id, 'x', 7] }, 3)
    expect(read).toEqual({ ...DEFAULT_OUTFIT, shirt: a.id, hat: b.id, owned: [a.id, b.id] })
    expect(sanitizeOutfit(JSON.parse(JSON.stringify(read)), 3)).toEqual(read)
    expect(sanitizeOutfit({ ...DEFAULT_OUTFIT, owned: 'all' }, 3).owned).toEqual([])
  })
})
