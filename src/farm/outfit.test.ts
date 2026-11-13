import { describe, expect, it } from 'vitest'
import { TRAITS } from '../models/look'
import { LEVELS } from './data'
import { DEFAULT_OUTFIT, GARMENTS, GARMENT_EVERY, garmentAt, garmentById, garmentsAt, nextGarment, outfitLook, putOn, sanitizeOutfit } from './outfit'

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
    expect(GARMENTS).toHaveLength(6 + LEVELS.max / GARMENT_EVERY)
    expect(garmentAt(LEVELS.max)?.name).toBe('Golden cap')
    expect(nextGarment(LEVELS.max)).toBeUndefined()
  })

  it('each is one of a kind: its id, and its look (kind and colour)', () => {
    expect(new Set(GARMENTS.map((g) => g.id)).size).toBe(GARMENTS.length)
    expect(new Set(GARMENTS.map((g) => `${g.slot}|${g.hat ?? ''}|${g.colour}`)).size).toBe(GARMENTS.length)
    for (const g of GARMENTS) {
      expect(g.colour, g.id).toMatch(/^#[0-9a-f]{6}$/)
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
    expect(sanitizeOutfit({ shirt: shirt.id, trousers: 'trousers-denim', hat: hat.id, seen: 5 }, 10)).toEqual({ shirt: shirt.id, trousers: 'trousers-denim', hat: hat.id, seen: 5 })
    // not yet reached, the wrong slot, made up, the wrong type
    expect(sanitizeOutfit({ shirt: shirt.id, hat: 'trousers-denim', trousers: 'nope', seen: 99 }, 1)).toEqual({ ...DEFAULT_OUTFIT, seen: 1 })
    expect(sanitizeOutfit({ shirt: 7, trousers: {}, hat: 'shirt-blue', seen: NaN }, 4)).toEqual(DEFAULT_OUTFIT)
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
