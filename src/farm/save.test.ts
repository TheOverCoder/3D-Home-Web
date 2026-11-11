// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { endsWithin } from '../lib/endsWithin'
import { BEDS, DAY, MACHINES, PRODUCERS, PRODUCER_IDS } from './data'
import { PLACES, type Placement } from './layout'
import { buyPiece, collect, farm, freeSpotFor, gateX, inLine, placeStored, storePiece, tick } from './state'
import { levelOf, seedXp } from './xp'
import { tripSeconds } from './tractorRoute'
import { OLD_SAVE, playedSave, savedNow, startFrom } from './testSaves'

// Saves broken or edited by hand (a file imported in src/ui/SavesPanel.tsx, the browser's storage changed by hand):
// what is broken loads made safe, and the rest of the farm as it was. None of this happens in play; two of these
// froze the page before the intro on every start, until the site's data was cleared.

const NOW = Date.UTC(2026, 10, 10, 12)
type Save = Record<string, unknown>
/** A farm played for a while (src/farm/testSaves.ts), saved just now; and what it loads to, saved again. */
let played: Save
let loaded: Save

const without = (save: Save, ...keys: string[]) => Object.fromEntries(Object.entries(save).filter(([k]) => !keys.includes(k)))

beforeAll(() => {
  played = playedSave()
})
beforeEach(() => {
  // the clock stands still: a save made "now" loads with no time away, the same every time
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  played = { ...played, time: NOW }
  startFrom(played)
  loaded = savedNow()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('a save broken or edited by hand', () => {
  it('a played farm loads as it was saved', () => {
    expect(loaded).toEqual(played)
  })

  it('a list that is not one (the beds as a word, a number, an object) costs only the beds: everything saved after them is kept', () => {
    // the bought land's beds are built, nothing grows
    const fresh = BEDS.map((b) => ({ built: b.price === 0, crop: null, growth: 0, water: 0, fixed: null }))
    for (const beds of ['lettuce', 7, true, { 0: { built: true, crop: 'lettuce', growth: 1, water: 1, fixed: null } }]) {
      startFrom({ ...played, beds })
      const saved = savedNow()
      expect(saved.beds, JSON.stringify(beds)).toEqual(fresh)
      expect(without(saved, 'beds'), JSON.stringify(beds)).toEqual(without(loaded, 'beds'))
    }
  })

  it('each stat is a whole number from 0, and there are no others (a count saved as text took a harvest as text: "7" + 2 = "72")', () => {
    startFrom({ ...played, stats: { harvested: '7', sold: [3], earned: -5, declined: 2.6, baked: null, cheat: 1, constructor: 2 } })
    expect(farm.stats).toEqual({ harvested: 0, sold: 0, earned: 0, declined: 3, baked: 0, sent: 0 })
    const n = collect('tree')
    expect(n).toBeGreaterThan(0)
    expect(farm.stats.harvested).toBe(n)
    for (const stats of ['abc', [1, 2], null]) {
      startFrom({ ...played, stats })
      expect(farm.stats, JSON.stringify(stats)).toEqual({ harvested: 0, sold: 0, earned: 0, declined: 0, baked: 0, sent: 0 })
    }
    // a count past 2^53 no longer counts (one more is the same number): it stops at the last one that does
    startFrom({ ...played, stats: { ...(played.stats as object), earned: 1e300 } })
    expect(farm.stats.earned).toBe(Number.MAX_SAFE_INTEGER)
    expect(without(savedNow(), 'stats')).toEqual(without(loaded, 'stats'))
  })

  it('a clock saved at 1e20 s starts again: the catch-up as the page starts and the next frame both end (1e20 − 40 is 1e20)', () => {
    // the clock is taken down by `every` until it is under it: from 1e20 that never ended, and the page never started
    const producers = played.producers as Record<string, object>
    const away = { ...played, time: NOW - 60_000, producers: { ...producers, hens: { animals: 4, stock: [1], timer: [1e20] } } }
    const started = endsWithin(2000, () => startFrom(away))
    expect(started, 'the page starts').toBe(true)
    expect(farm.producers.hens.timer[0]).toBeGreaterThanOrEqual(0)
    expect(farm.producers.hens.timer[0]).toBeLessThan(PRODUCERS.hens.every)
    // a save from before the tables, played on
    startFrom({ ...OLD_SAVE, time: NOW, lemonTimer: 1e20, milkTimer: [3, 1e300, -4], eggTimer: Number.MAX_VALUE, woolTimer: [61, 0, 59] })
    const ticked = endsWithin(2000, () => tick(1))
    expect(ticked, 'the next frame').toBe(true)
    for (const id of PRODUCER_IDS) for (const t of farm.producers[id].timer) expect(t >= 0 && t < PRODUCERS[id].every, `${id}: ${t}`).toBe(true)
    expect(farm.producers.cows.timer[0]).toBe(4) // a good clock is kept
  })

  it("a machine's progress is kept within its job: from 0 to the time its batches take", () => {
    const machines = played.machines as Record<string, object>
    const job = (progress: unknown) => ({ ...played, machines: { ...machines, mill: { recipe: 'wheat', count: 6, progress, ready: 0 } } })
    const whole = 6 * MACHINES.mill.recipes.find((r) => r.id === 'wheat')!.seconds
    for (const [progress, kept] of [
      [1e20, whole],
      [whole + 1, whole],
      [-3, 0],
      ['5', 0],
      [5, 5],
    ] as const) {
      startFrom(job(progress))
      expect(farm.machines.mill, String(progress)).toEqual({ recipe: 'wheat', count: 6, progress: kept, ready: 0 })
    }
  })

  it('a bed grows no further than ripe and holds no more water than a soak; an empty one neither', () => {
    const beds = played.beds as Save[]
    const lettuce = { built: true, crop: 'lettuce', growth: 1e300, water: 1e300, fixed: null }
    startFrom({ ...played, beds: [lettuce, { ...beds[1], growth: -2, water: Infinity }, { built: true, crop: null, growth: 12, water: 3, fixed: 'tomato' }, ...beds.slice(3)] })
    expect(farm.beds[0]).toEqual({ built: true, crop: 'lettuce', growth: 45, water: 45 * 0.55, fixed: null })
    expect(farm.beds[1]).toMatchObject({ crop: 'carrot', growth: 0, water: 0 })
    expect(farm.beds[2]).toEqual({ built: true, crop: null, growth: 0, water: 0, fixed: 'tomato' })
    // a staked-out bed not yet built grows nothing
    startFrom({ ...played, beds: beds.map((b, i) => (i === 5 ? { built: false, crop: 'corn', growth: 3, water: 3, fixed: null } : b)) })
    expect(farm.beds[5]).toEqual({ built: false, crop: null, growth: 0, water: 0, fixed: null })
    expect(without(savedNow(), 'beds')).toEqual(without(loaded, 'beds'))
  })

  it('a machine at work on "constructor" or "__proto__" (names every object has) loads idle, and nothing else changes', () => {
    const machines = played.machines as Record<string, object>
    const idle = { recipe: null, count: 0, progress: 0, ready: 0 }
    for (const recipe of ['constructor', '__proto__', 'valueOf', 'hasOwnProperty']) {
      startFrom({ ...played, machines: { ...machines, mill: { recipe, count: 2, progress: 1, ready: 0 }, oven: { recipe, count: 0, progress: 0, ready: 1 } } })
      expect([farm.machines.mill, farm.machines.oven], recipe).toEqual([idle, idle])
      expect(without(savedNow(), 'machines'), recipe).toEqual(without(loaded, 'machines'))
    }
    // a save from before the tables: what the mill grinds or made, what the oven bakes or baked
    startFrom({ ...OLD_SAVE, time: NOW, mill: { input: 'constructor', count: 2, progress: 0, output: '__proto__', ready: 2 }, oven: { baking: 'valueOf', progress: 3, ready: 'toString' } })
    expect([farm.machines.mill, farm.machines.oven]).toEqual([idle, idle])
  })

  it('with the number for new pieces lost, a stool taken out of storage gets an id of its own, and putting it away loses none', () => {
    // the played farm's bought stool stands as stool-1
    startFrom({ ...played, home: { ...(played.home as object), next: null } })
    expect(buyPiece('stool')).toBe(true)
    const placed = placeStored('stool', freeSpotFor('stool', 'bedroom')!)
    expect(placed.id).toBe('stool-2')
    const stools = () => farm.home.pieces.filter((p) => p.type === 'stool').length + farm.home.stored.filter((t) => t === 'stool').length
    const before = stools()
    expect(storePiece(placed.id!)).toBe(true)
    expect(stools()).toBe(before)
    expect(farm.home.pieces.some((p) => p.id === 'stool-1')).toBe(true)
  })

  it('a place saved far off (±1.79e308, 1e16) goes back where it starts; the others stay where they were moved', () => {
    const layout = played.layout as { places: Record<string, Placement>; land: string[] }
    for (const x of [1.79e308, -1.79e308, 1e16]) {
      startFrom({ ...played, layout: { ...layout, places: { ...layout.places, hens: { x, z: 6.7, rot: 0 } } } })
      expect(farm.layout.places.hens, String(x)).toEqual(PLACES.hens.home)
      expect(farm.layout.places.lemon).toEqual(layout.places.lemon)
      expect(farm.layout.land).toEqual(layout.land)
    }
  })

  it('the silo, the barn, the order board and the tractor saved broken load made safe; everything else as it was', () => {
    const board = played.orders as unknown[]
    expect(board.length).toBe(4)
    // levels below 1 or not numbers: level 1
    startFrom({ ...played, storage: { silo: -3, barn: 'x' } })
    expect(farm.storage).toEqual({ silo: 1, barn: 1 })
    expect(without(savedNow(), 'storage')).toEqual(without(loaded, 'storage'))
    // a board that is not a list: a new order on its way in every place
    startFrom({ ...played, orders: 'many' })
    expect(farm.orders).toEqual([{ wait: 0 }, { wait: 0 }, { wait: 0 }, { wait: 0 }])
    expect(without(savedNow(), 'orders')).toEqual(without(loaded, 'orders'))
    // an order of a building material, of a good twice, of nothing: no order; a wait longer than the office's: its wait
    startFrom({
      ...played,
      orders: [
        { lines: [{ good: 'brick', want: 3, have: 9 }] },
        { wait: 1e9 },
        {
          lines: [
            { good: 'egg', want: 2, have: 9 },
            { good: 'egg', want: 5, have: 0 },
          ],
          coins: -4,
          surprise: 'yes',
        },
        null,
      ],
    })
    expect(farm.orders[0]).toEqual({ wait: 0 })
    expect(farm.orders[1]).toEqual({ wait: 600 })
    expect(farm.orders[2]).toMatchObject({ order: { lines: [{ good: 'egg', want: 2, have: 2 }], coins: 1, surprise: false } })
    expect(farm.orders[3]).toEqual({ wait: 0 })
    // the tractor: no crates under none, no more aboard than its carrier takes, its trip within its length
    startFrom({ ...played, dispatch: { waiting: -1, aboard: 99, trip: 1e20 } })
    expect(farm.dispatch.waiting).toBe(0)
    expect(farm.dispatch.aboard).toBe(4)
    expect(farm.dispatch.trip).toBeLessThanOrEqual(tripSeconds(4, gateX()))
    expect(endsWithin(1500, () => tick(1))).toBe(true)
    startFrom({ ...played, dispatch: { waiting: 3, aboard: 0, trip: 50 } })
    expect(farm.dispatch).toEqual({ waiting: 3, aboard: 0, trip: -1 })
    // the office past its upgrades: the most there are, and as many places on the board
    startFrom({ ...played, office: { slots: 99, wait: -2 } })
    expect(farm.office).toEqual({ slots: 6, wait: 0 })
    expect(farm.orders.length).toBe(9)
  })

  it('levels, the ladders, the shop, the contractor and the day saved broken load made safe; everything else as it was', () => {
    // XP: whole points from 0, paid from 1 up to the level reached; missing, seeded from what the farm did (paid already)
    startFrom({ ...played, xp: { points: -5, paid: 99 } })
    expect(farm.xp).toEqual({ points: 0, paid: 1 })
    expect(without(savedNow(), 'xp')).toEqual(without(loaded, 'xp'))
    startFrom(without(played, 'xp'))
    const seed = seedXp(farm.stats)
    expect(farm.xp).toEqual({ points: seed, paid: levelOf(seed) })
    // a shop not yours: its shelves and till empty, its own ladders none (the manager's and the contractor's kept)
    const market = played.market as Save
    startFrom({ ...played, market: { ...market, owned: 'yes' } })
    expect(farm.market.owned).toBe(false)
    expect(farm.market.shelves.every((sh) => sh.good === null && sh.units === 0)).toBe(true)
    expect(farm.market.till).toEqual({ coins: 0, goods: 0 })
    expect([farm.ladders.places, farm.ladders.pace, farm.ladders.rate, farm.ladders.discount]).toEqual([0, 0, 4, 1])
    // a shelf of a building material, too many units, a price off its step
    const shelves = market.shelves as Save[]
    startFrom({ ...played, market: { ...market, shelves: [{ good: 'brick', units: 3, pct: 100 }, { good: 'egg', units: 99, pct: 147 }, ...shelves.slice(2)] } })
    expect(farm.market.shelves.slice(0, 2)).toEqual([
      { good: null, units: 0, pct: 100 },
      { good: 'egg', units: 3, pct: 150 },
    ])
    expect(without(savedNow(), 'market')).toEqual(without(loaded, 'market'))
    // the contractor: only materials, no more pieces than a day has
    startFrom({ ...played, contractor: { day: 0, offers: [{ item: 'egg', sold: false }, ...Array.from({ length: 9 }, () => ({ item: 'brick', sold: 'no' }))] } })
    expect(farm.contractor.offers).toEqual(Array.from({ length: 3 }, () => ({ item: 'brick', sold: false })))
    // the day's clock: from 0; one past what can have been played keeps its hour
    for (const [t, kept] of [
      ['x', 0],
      [-5, 0],
      [1e300, 1e300 % DAY.length],
    ] as const) {
      startFrom({ ...played, day: { t } })
      expect(farm.day.t, String(t)).toBe(kept)
    }
    expect(without(savedNow(), 'day')).toEqual(without(loaded, 'day'))
  })

  it('a buyer in line saved before the people engine (a hat yes or no, three hair styles) loads as they were', () => {
    const queue = played.queue as Save[]
    const look = { shirt: '#5c8a4a', trousers: '#5a4636', skin: '#f1c7a5', hair: '#b9b2a8', hairStyle: 2, hat: true, height: 1.02 }
    startFrom({ ...played, queue: [{ ...queue[0], look }, { ...queue[1], look: { ...look, shirt: 'red' } }, ...queue.slice(2)] })
    expect(inLine()[0].look).toMatchObject({ shirt: '#5c8a4a', hairStyle: 2, height: 1.02 })
    expect(inLine()[0].look.hat).toBeTruthy()
    // a look that is not one: no buyer
    expect(inLine().length).toBe(queue.length - 1)
  })
})
