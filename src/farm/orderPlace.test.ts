import { describe, expect, it } from 'vitest'
import { CONTRACTOR_PLACE, nearestPlace, placesOf } from './orderPlace'
import type { BedState } from './state'

// "Show me" on the order board: a good to the places it is made (./orderPlace.ts), and of them the one to walk to.

const bed = (b: Partial<BedState>): BedState => ({ built: true, crop: null, growth: 0, water: 0, fixed: null, inSeason: false, ...b })
/** Six beds: lettuce growing in two, one set to always grow carrots, two empty, one not built. */
const BEDS = [bed({ crop: 'lettuce' }), bed({}), bed({ crop: 'lettuce' }), bed({ fixed: 'carrot' }), bed({}), bed({ built: false })]
/** What is registered on the farm: the beds (all six), the nest, two cows, the sheep, the lemon tree, two apple trees,
 *  the machines, and things that make nothing. */
const IDS = [
  ...BEDS.map((_, i) => `farm-bed-${i}`),
  'farm-nest',
  'farm-cow-0',
  'farm-cow-1',
  'farm-sheep-0',
  'farm-lemon-tree',
  'farm-apple-tree-0',
  'farm-apple-tree-1',
  'farm-mill',
  'farm-loom',
  'farm-oven',
  'farm-office',
  'farm-silo',
  'farm-shop',
]

describe('where a good of an order is made', () => {
  it('a crop: the beds growing it; else the empty ones set to grow it; else every empty built bed', () => {
    expect(placesOf('lettuce', BEDS, IDS)).toEqual(['farm-bed-0', 'farm-bed-2'])
    expect(placesOf('carrot', BEDS, IDS)).toEqual(['farm-bed-3'])
    // nothing grows tomatoes and no bed is set to: where they can be planted (never the plot not built)
    expect(placesOf('tomato', BEDS, IDS)).toEqual(['farm-bed-1', 'farm-bed-3', 'farm-bed-4'])
    // every bed full of something else: nowhere
    expect(placesOf('tomato', [bed({ crop: 'lettuce' })], ['farm-bed-0'])).toEqual([])
  })

  it("an animal's good: the nest, or every cow or sheep; a fruit: every one of its trees; the lemons: the lemon tree", () => {
    expect(placesOf('egg', BEDS, IDS)).toEqual(['farm-nest'])
    expect(placesOf('milk', BEDS, IDS)).toEqual(['farm-cow-0', 'farm-cow-1'])
    expect(placesOf('wool', BEDS, IDS)).toEqual(['farm-sheep-0'])
    expect(placesOf('apple', BEDS, IDS)).toEqual(['farm-apple-tree-0', 'farm-apple-tree-1'])
    expect(placesOf('lemon', BEDS, IDS)).toEqual(['farm-lemon-tree'])
    // no orange tree stands: nowhere
    expect(placesOf('orange', BEDS, IDS)).toEqual([])
  })

  it("a machine's good: the machine; a map without the farm: nowhere", () => {
    expect(placesOf('flour', BEDS, IDS)).toEqual(['farm-mill'])
    expect(placesOf('sugar', BEDS, IDS)).toEqual(['farm-mill'])
    expect(placesOf('cloth', BEDS, IDS)).toEqual(['farm-loom'])
    expect(placesOf('strawberry_cake', BEDS, IDS)).toEqual(['farm-oven'])
    // in the house nothing of the farm is registered
    for (const good of ['lettuce', 'egg', 'milk', 'flour'] as const) expect(placesOf(good, BEDS, ['door-kitchen', 'wardrobe-0'])).toEqual([])
  })

  it('a building material: the contractor, while he is in (and his window is on this map)', () => {
    const withHim = [...IDS, CONTRACTOR_PLACE]
    for (const good of ['brick', 'plank', 'log'] as const) {
      expect(placesOf(good, BEDS, withHim, true), good).toEqual([CONTRACTOR_PLACE])
      expect(placesOf(good, BEDS, withHim, false), good).toEqual([])
      expect(placesOf(good, BEDS, withHim), good).toEqual([])
      expect(placesOf(good, BEDS, IDS, true), good).toEqual([])
    }
    // the farm's own goods are where they always were, whether he is in or not
    expect(placesOf('milk', BEDS, withHim, true)).toEqual(['farm-cow-0', 'farm-cow-1'])
  })

  it("an animal's good at its tool: the tool takes the producer's own id, so it is found the same way", () => {
    expect(placesOf('milk', BEDS, ['farm-cow', 'farm-mill'])).toEqual(['farm-cow'])
    expect(placesOf('wool', BEDS, ['farm-sheep'])).toEqual(['farm-sheep'])
    expect(placesOf('egg', BEDS, ['farm-nest'])).toEqual(['farm-nest'])
  })

  it('of several, the nearest with it ready to take; with none ready, the nearest', () => {
    expect(
      nearestPlace([
        { id: 'farm-bed-0', ready: false, d: 2 },
        { id: 'farm-bed-2', ready: true, d: 9 },
        { id: 'farm-bed-4', ready: true, d: 5 },
      ]),
    ).toBe('farm-bed-4')
    expect(
      nearestPlace([
        { id: 'farm-cow-0', ready: false, d: 7 },
        { id: 'farm-cow-1', ready: false, d: 3 },
      ]),
    ).toBe('farm-cow-1')
    expect(nearestPlace([])).toBeNull()
  })
})
