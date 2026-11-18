import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ITEMS, SELLABLE, type ProduceId } from './data'
import { dayCoins } from './daily'
import { DECOR_KINDS, FRUIT_KINDS, SHOP } from './decor'
import { boxCoins, savedPrize as savedGift, type Prize as Gift } from './gifts'
import { GARMENTS } from './outfit'
import { isGiftGarment, looksOf, prizeKind, prizeWords, savedPrize, sized, type Prize } from './prize'

// The prize (update-v1/CONTRACTS.md §1.9): every kind read back safe from a save, in words, and the one size of its
// coins. A gift's record (src/farm/gifts.ts) reads its prizes through it, keeping only coins and goods; the daily gift's
// coins and the boxes' come out of `sized`.

const ODD = [0, -1, 1, 0.5, 99, 100, 1e9, 1e9 + 1, NaN, Infinity, '3', null, undefined, [], {}, 'egg', 'brick', 'gold', 'constructor', '__proto__']
const raw = fc.oneof(
  fc.record({ coins: fc.oneof(fc.constantFrom(...ODD), fc.integer()) }),
  fc.record({ item: fc.oneof(fc.constantFrom(...ODD), fc.constantFrom(...SELLABLE, ...ITEMS)), n: fc.oneof(fc.constantFrom(...ODD), fc.integer({ min: -5, max: 120 })) }),
  fc.anything(),
)
const someKind = fc.oneof(raw, fc.record({ decor: fc.constantFrom(...DECOR_KINDS, ...ODD) }), fc.record({ garment: fc.constantFrom(...GARMENTS.map((g) => g.id), ...ODD) }))

describe('a prize as saved', () => {
  it('coins from 1 to a billion; a good buyers buy, or a building material, 1 to 99', () => {
    expect(savedPrize({ coins: 1 })).toEqual({ coins: 1 })
    expect(savedPrize({ coins: 1e9 })).toEqual({ coins: 1e9 })
    for (const coins of [0, -1, 0.5, 1e9 + 1, NaN, Infinity, '3', null]) expect(savedPrize({ coins }), String(coins)).toBeNull()
    expect(savedPrize({ item: 'egg', n: 99 })).toEqual({ item: 'egg', n: 99 })
    expect(savedPrize({ item: 'brick', n: 1 })).toEqual({ item: 'brick', n: 1 })
    for (const [item, n] of [
      ['egg', 0],
      ['egg', 100],
      ['egg', 2.5],
      ['gold', 3],
      ['constructor', 3],
      ['__proto__', 3],
    ] as const)
      expect(savedPrize({ item, n }), `${item} ${n}`).toBeNull()
  })

  it('a gift’s (gifts.ts): read as any prize, and only coins or goods', () => {
    fc.assert(
      fc.property(someKind, (v) => {
        const p = savedPrize(v)
        const gift: Gift | null = savedGift(v)
        expect(gift).toEqual(p && ('coins' in p || 'item' in p) ? p : null)
      }),
      { numRuns: 2000 },
    )
    expect(savedGift({ decor: 'lamp' })).toBeNull()
  })

  it('reads its own back the same', () => {
    const prizes: Prize[] = [{ coins: 12 }, { item: 'egg', n: 3 }, { item: 'brick', n: 99 }, { decor: 'lamp' }, { decor: 'apple-tree' }]
    for (const p of prizes) expect(savedPrize(JSON.parse(JSON.stringify(p)))).toEqual(p)
    const gift: Gift = { coins: 5 }
    expect(savedPrize(gift)).toEqual(gift)
  })

  it('takes a piece of any kind of the shop, with only a look its row has', () => {
    for (const kind of [...DECOR_KINDS, ...FRUIT_KINDS]) {
      expect(savedPrize({ decor: kind })).toEqual({ decor: kind })
      // (no row has looks yet: 02's tints add them)
      expect(looksOf(kind)).toEqual([])
      expect(savedPrize({ decor: kind, look: 'red' })).toEqual({ decor: kind })
    }
    for (const decor of ['gold', 'constructor', '__proto__', 3, null]) expect(savedPrize({ decor })).toBeNull()
  })

  it('takes no garment that comes with a level (today, every one)', () => {
    for (const g of GARMENTS) {
      expect(isGiftGarment(g.id)).toBe(false)
      expect(savedPrize({ garment: g.id })).toBeNull()
    }
    for (const garment of ['nothing', 3, null]) expect(savedPrize({ garment })).toBeNull()
  })
})

describe('a prize', () => {
  it('says what kind it is', () => {
    expect([{ coins: 1 }, { item: 'egg', n: 1 }, { decor: 'lamp' }, { garment: 'x' }].map((p) => prizeKind(p as Prize))).toEqual(['coins', 'item', 'decor', 'garment'])
  })

  it('in words', () => {
    expect(prizeWords({ coins: 12 })).toBe('12 coins')
    expect(prizeWords({ item: 'plank' as ProduceId, n: 2 })).toBe('2 planks')
    expect(prizeWords({ decor: 'lamp' })).toBe(`a ${SHOP.lamp.name.toLowerCase()}`)
    expect(prizeWords({ decor: 'apple-tree' })).toMatch(/^an /)
    expect(prizeWords({ garment: GARMENTS[0].id })).toBe(`a ${GARMENTS[0].name.toLowerCase()}`)
    expect(prizeWords({ garment: 'nothing' })).toBe('a garment')
  })
})

describe('the one size of a prize’s coins', () => {
  it('gives the daily gift’s coins', () => {
    const SHARES: Record<number, number> = { 1: 0.5, 3: 0.75, 5: 1, 7: 2 }
    for (let level = 1; level <= 500; level++) for (const [day, share] of Object.entries(SHARES)) expect(sized(share, level, 5), `day ${day}, level ${level}`).toBe(dayCoins(Number(day), level))
  })

  it('gives the level boxes’ coins', () => {
    for (let level = 1; level < 500; level++) for (let q = 0; q < 4; q++) expect(sized((1 + q / 2) / 10, level, 3), `level ${level}, box ${q}`).toBe(boxCoins(level, q))
  })

  it('is at least its least', () => {
    expect(sized(0, 1)).toBe(1)
    expect(sized(0, 1, 7)).toBe(7)
  })
})
