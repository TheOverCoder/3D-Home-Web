import { afterEach, describe, expect, it } from 'vitest'
import { CONTRACTOR, CROPS, ESTATE, EXPANSIONS, LADDERS, MANAGER, OFFICE_UPGRADES, PRODUCE, UPGRADES, BEDS } from './data'
import { DECOR, FRUIT } from './decor'
import { PARCELS } from './layout'
import { SKINS } from './skins'
import { CAR_PAINTS } from './carPaints'
import { QUEUE_PRICES } from './machineView'
import { PIECES } from '../home/catalogue'
import { priceAt } from './prices'
import { allPrices, applyPrices, priceOverrides, resetPrices, setPrice } from './priceBook'

// The price book (./priceBook.ts): every price of the game's tables is a row of it, under a key of its own; setting one
// changes what the game reads (and every table that copied it), and what was changed comes back as a set to keep.

afterEach(() => resetPrices())

const keys = () => new Set(allPrices().map((r) => r.key))

describe('the price book', () => {
  it('has every price of the tables, each under one key', () => {
    const all = allPrices()
    expect(new Set(all.map((r) => r.key)).size).toBe(all.length)
    const k = keys()
    const want = [
      ...PRODUCE.map((p) => `goods:${p.id}`),
      ...CROPS.map((c) => `seeds:${c.id}`),
      ...UPGRADES.map((u) => `upgrades:${u.id}`),
      ...UPGRADES.filter((u) => u.priceStep !== undefined).map((u) => `upgrades:${u.id}:step`),
      ...Object.keys(OFFICE_UPGRADES).flatMap((id) => [`office:${id}`, `office:${id}:step`]),
      ...Object.keys(LADDERS).flatMap((id) => [`ladders:${id}`, `ladders:${id}:step`]),
      ...Object.keys(QUEUE_PRICES).map((n) => `queue:${n}`),
      ...BEDS.flatMap((b, i) => (b.price !== undefined ? [`beds:${i}`] : [])),
      ...Object.entries({ ...DECOR, ...FRUIT }).flatMap(([id, d]) => (d.given ? [] : [`decor:${id}`])),
      ...Object.keys(PARCELS).map((id) => `land:${id}`),
      ...Object.entries(SKINS).flatMap(([tool, looks]) => Object.entries(looks).flatMap(([style, s]) => (s.price > 0 ? [`skins:${tool}:${style}`] : []))),
      ...Object.keys(PIECES).map((id) => `furniture:${id}`),
      'house:estate',
      ...Object.entries(CAR_PAINTS).flatMap(([id, p]) => (p.price > 0 ? [`paints:${id}`] : [])),
      'manager:shop',
      'contractor:buys',
      'contractor:sells',
    ]
    for (const key of want) expect(k.has(key), key).toBe(true)
    expect(all.length).toBe(want.length)
    // every row names its price, and starts at what the table has
    for (const r of all) {
      expect(r.name.length, r.key).toBeGreaterThan(0)
      expect(r.get(), r.key).toBe(r.base)
      expect(Number.isFinite(r.base), r.key).toBe(true)
    }
  })

  it('sets a price where the game reads it, and in every table that copied it', () => {
    const crop = CROPS[0]
    const good = PRODUCE.find((p) => p.id === crop.id)!
    expect(setPrice(`goods:${crop.id}`, 99)).toBe(true)
    expect(good.price).toBe(99)
    expect(crop.price).toBe(99)
    expect(priceAt(crop.id)).toBe(99)
    // a field: the field's own price and its upgrade's
    const field = UPGRADES.find((u) => (EXPANSIONS as Record<string, unknown>)[u.id])
    if (field) {
      setPrice(`upgrades:${field.id}`, 1234)
      expect(field.price).toBe(1234)
      expect((EXPANSIONS as Record<string, { price: number }>)[field.id].price).toBe(1234)
    }
    const ladder = Object.keys(LADDERS)[0] as keyof typeof LADDERS
    setPrice(`ladders:${ladder}:step`, 77)
    expect(LADDERS[ladder].price[1]).toBe(77)
    setPrice('house:estate', 5000)
    expect(ESTATE.price).toBe(5000)
    setPrice('manager:shop', 1600)
    expect(MANAGER.shopPrice).toBe(1600)
    setPrice('contractor:sells', 120)
    expect(CONTRACTOR.sells).toBe(120)
    setPrice('queue:4', 500)
    expect(QUEUE_PRICES[4]).toBe(500)
  })

  it('takes whole coins, none below nothing, and passes over what is no price', () => {
    const key = allPrices()[0].key
    expect(setPrice(key, 12.6)).toBe(true)
    expect(allPrices()[0].get()).toBe(13)
    setPrice(key, -5)
    expect(allPrices()[0].get()).toBe(0)
    expect(setPrice('nothing:here', 5)).toBe(false)
    expect(setPrice(key, Number.NaN)).toBe(false)
    expect(applyPrices({ 'nothing:here': 5, [key]: 'ten', 'house:estate': 4500 })).toBe(1)
    expect(ESTATE.price).toBe(4500)
  })

  it('gives back only what was changed, and takes it back the same', () => {
    expect(priceOverrides()).toEqual({})
    setPrice('house:estate', 4100)
    setPrice(`decor:${Object.keys(DECOR)[0]}`, 1)
    const kept = priceOverrides()
    expect(Object.keys(kept)).toHaveLength(2)
    // through JSON, as a file or the dashboard keeps it
    const json = JSON.stringify(kept)
    resetPrices()
    expect(priceOverrides()).toEqual({})
    expect(ESTATE.price).toBe(allPrices().find((r) => r.key === 'house:estate')!.base)
    expect(applyPrices(JSON.parse(json))).toBe(2)
    expect(priceOverrides()).toEqual(kept)
  })
})
