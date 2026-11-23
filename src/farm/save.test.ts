// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { endsWithin } from '../lib/endsWithin'
import { BEDS, DAY, MACHINES, PRODUCERS, PRODUCER_IDS } from './data'
import { PLACES, type Placement } from './layout'
import { addJob, buyPiece, calendarDay, collect, farm, freeSpotFor, gateX, inLine, machineStage, placeStored, seasonDay, storePiece, tick } from './state'
import { LEDGER_DAYS } from './ledger'
import { levelOf, seedXp } from './xp'
import { dayNumber } from './calendar'
import { goalById, goalTarget, startStep, type GoalId } from './goals'
import { tripSeconds } from './tractorRoute'
import { machineOpensAt } from './unlocks'
import { OLD_SAVE, playedSave, savedNow, startFrom } from './testSaves'
import { defaultHome } from '../home/layout'
import { defaultShell } from '../home/shell'

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
  // played on the day it loads on (the sales book keeps the days up to the day it loads, none after)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  // (played on the device's own calendar: as of the day these tests stand on, its first day played)
  played = { ...playedSave(), played: { days: 1, last: dayNumber(NOW) } }
  vi.useRealTimers()
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
    const bought = (played as { expansions: Record<string, boolean> }).expansions
    const fresh = BEDS.map((b) => ({ built: b.price === 0 && (!b.expansion || bought[b.expansion]), crop: null, growth: 0, water: 0, fixed: null, inSeason: false }))
    // (and a bed that was moved stands where it was staked out again: only a built bed moves)
    const unmoved = (s: Record<string, unknown>) => ({ ...without(s, 'beds'), layout: { ...(s.layout as object), beds: null } })
    for (const beds of ['lettuce', 7, true, { 0: { built: true, crop: 'lettuce', growth: 1, water: 1, fixed: null } }]) {
      startFrom({ ...played, beds })
      const saved = savedNow()
      expect(saved.beds, JSON.stringify(beds)).toEqual(fresh)
      expect(unmoved(saved), JSON.stringify(beds)).toEqual(unmoved(loaded))
      expect((saved.layout as { beds: unknown[] }).beds).toEqual(BEDS.map((b) => ({ x: b.x, z: b.z, rot: 0 })))
    }
  })

  it('each stat is a whole number from 0, and there are no others (a count saved as text took a harvest as text: "7" + 2 = "72")', () => {
    startFrom({ ...played, stats: { harvested: '7', sold: [3], earned: -5, declined: 2.6, baked: null, cheat: 1, constructor: 2 } })
    expect(farm.stats).toEqual({ harvested: 0, sold: 0, earned: 0, declined: 3, baked: 0, sent: 0, watered: 0 })
    const n = collect('tree')
    expect(n).toBeGreaterThan(0)
    expect(farm.stats.harvested).toBe(n)
    for (const stats of ['abc', [1, 2], null]) {
      startFrom({ ...played, stats })
      expect(farm.stats, JSON.stringify(stats)).toEqual({ harvested: 0, sold: 0, earned: 0, declined: 0, baked: 0, sent: 0, watered: 0 })
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

  it("a machine's progress is kept within its job: from 0 to the time the job under way takes", () => {
    const machines = played.machines as Record<string, object>
    const queue = (progress: unknown) => ({ jobs: ['wheat', 'sugarcane', 'wheat'], done: 1, progress, capacity: 4, worked: 30 })
    const job = MACHINES.mill.recipes.find((r) => r.id === 'sugarcane')!.seconds
    for (const [progress, kept] of [
      [1e20, job],
      [job + 1, job],
      [-3, 0],
      ['2', 0],
      [2.5, 2.5],
    ] as const) {
      startFrom({ ...played, machines: { ...machines, mill: queue(progress) } })
      // (a mill saved with no word of being bought: as a farm from before, the farm's: its level had opened it)
      expect(farm.machines.mill, String(progress)).toEqual({ ...queue(kept), owned: true })
      expect(without(savedNow(), 'machines'), String(progress)).toEqual(without(loaded, 'machines'))
    }
    // a job at its end is done with the next frame, and the next one starts
    startFrom({ ...played, machines: { ...machines, mill: queue(1e20) } })
    tick(0.001)
    expect(farm.machines.mill).toMatchObject({ done: 2 })
    expect(farm.machines.mill.progress).toBeCloseTo(0.001, 6)
    // from before the queue: a batch's progress kept within the batch, and spent on its jobs in turn
    for (const [progress, done, kept] of [
      [1e20, 6, 0],
      [-3, 0, 0],
      [9, 2, 1],
    ] as const) {
      startFrom({ ...played, machines: { ...machines, mill: { recipe: 'wheat', count: 6, progress, ready: 0 } } })
      expect(farm.machines.mill, String(progress)).toEqual({ jobs: Array.from({ length: 6 }, () => 'wheat'), done, progress: kept, capacity: 3, worked: 0, owned: true })
    }
  })

  it("a machine's queue saved broken loads made safe: only its own recipes, twelve at most, done no more than there are, three to twelve places, worked from 0", () => {
    const machines = played.machines as Record<string, object>
    const mill = (m: object) => ({ ...played, machines: { ...machines, mill: m } })
    // (a mill saved with no word of being bought: the farm's, as on a farm from before whose level had opened it)
    const idle = { jobs: [], done: 0, progress: 0, capacity: 3, worked: 0, owned: true }
    startFrom(mill({ jobs: ['wheat', 'flour', 7, null, 'lemon_cake', 'sugarcane', '__proto__'], done: 3, progress: 1, capacity: 5, worked: 99 }))
    // of the three saved done, one was a job of its own: the wheat; the cane is the one under way
    expect(farm.machines.mill).toEqual({ jobs: ['wheat', 'sugarcane'], done: 1, progress: 1, capacity: 5, worked: 99, owned: true })
    startFrom(mill({ jobs: Array.from({ length: 40 }, () => 'wheat'), done: 1e20, progress: 1, capacity: 1e20, worked: 1e308 }))
    expect(farm.machines.mill).toEqual({ jobs: Array.from({ length: 12 }, () => 'wheat'), done: 12, progress: 0, capacity: 12, worked: Number.MAX_SAFE_INTEGER, owned: true })
    for (const broken of [{ jobs: 'wheat', done: 1, progress: 1, capacity: 2, worked: -5 }, { jobs: { 0: 'wheat' }, done: -1, progress: NaN, capacity: 'twelve', worked: Infinity }, { jobs: null }]) {
      startFrom(mill(broken))
      expect(farm.machines.mill, JSON.stringify(broken)).toEqual(idle)
      expect(without(savedNow(), 'machines'), JSON.stringify(broken)).toEqual(without(loaded, 'machines'))
    }
    // and plays on
    farm.inv.wheat = 1
    expect(addJob('mill', 'wheat')).toBe(true)
    tick(5)
    expect(machineStage('mill')).toBe('done')
  })

  it('a bed grows no further than ripe and holds no more water than a soak; an empty one neither', () => {
    const beds = played.beds as Save[]
    const lettuce = { built: true, crop: 'lettuce', growth: 1e300, water: 1e300, fixed: null }
    startFrom({ ...played, beds: [lettuce, { ...beds[1], growth: -2, water: Infinity }, { built: true, crop: null, growth: 12, water: 3, fixed: 'tomato' }, ...beds.slice(3)] })
    expect(farm.beds[0]).toEqual({ built: true, crop: 'lettuce', growth: 45, water: 45 * 0.55, fixed: null, inSeason: false })
    expect(farm.beds[1]).toMatchObject({ crop: 'carrot', growth: 0, water: 0 })
    expect(farm.beds[2]).toEqual({ built: true, crop: null, growth: 0, water: 0, fixed: 'tomato', inSeason: false })
    // a staked-out bed not yet built grows nothing
    startFrom({ ...played, beds: beds.map((b, i) => (i === 5 ? { built: false, crop: 'corn', growth: 3, water: 3, fixed: null } : b)) })
    expect(farm.beds[5]).toEqual({ built: false, crop: null, growth: 0, water: 0, fixed: null, inSeason: false })
    expect(without(savedNow(), 'beds')).toEqual(without(loaded, 'beds'))
  })

  it('a machine at work on "constructor" or "__proto__" (names every object has) loads idle, and nothing else changes', () => {
    const machines = played.machines as Record<string, object>
    // (saved with no word of being bought: the farm's as its level had opened each — the played farm's, 4: the mill, not
    // the oven)
    const idle = { jobs: [], done: 0, progress: 0, capacity: 3, worked: 0 }
    const mill = { ...idle, owned: true }
    const oven = { ...idle, owned: false }
    for (const recipe of ['constructor', '__proto__', 'valueOf', 'hasOwnProperty']) {
      startFrom({
        ...played,
        machines: { ...machines, mill: { jobs: [recipe, recipe], done: 1, progress: 1, capacity: 3, worked: 0 }, oven: { jobs: [recipe], done: 1, progress: 0, capacity: 3, worked: 0 } },
      })
      expect([farm.machines.mill, farm.machines.oven], recipe).toEqual([mill, oven])
      expect(without(savedNow(), 'machines'), recipe).toEqual(without(loaded, 'machines'))
      // as a save from before the queue had it
      startFrom({ ...played, machines: { ...machines, mill: { recipe, count: 2, progress: 1, ready: 0 }, oven: { recipe, count: 0, progress: 0, ready: 1 } } })
      expect([farm.machines.mill, farm.machines.oven], recipe).toEqual([mill, oven])
    }
    // a save from before the tables: what the mill grinds or made, what the oven bakes or baked
    startFrom({ ...OLD_SAVE, time: NOW, mill: { input: 'constructor', count: 2, progress: 0, output: '__proto__', ready: 2 }, oven: { baking: 'valueOf', progress: 3, ready: 'toString' } })
    const level = levelOf(farm.xp.points)
    expect([farm.machines.mill, farm.machines.oven]).toEqual([
      { ...idle, owned: level >= machineOpensAt('mill') },
      { ...idle, owned: level >= machineOpensAt('oven') },
    ])
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

  it("the house's shell saved broken (openings off their walls, over each other, as text; paints and floors unknown) loads made safe; the rest as it was", () => {
    const home = played.home as Record<string, unknown>
    const shell = {
      openings: {
        livingOffice: { run: 'mid-w', centre: 1e308, closed: false },
        'win-kitchen-north': { run: 'e-kitchen', centre: -2.6, closed: false },
        'garden-door': { run: 'w-living', centre: 'here', closed: true },
        livingBedroom: { run: 'mid-s', centre: 2.4, closed: true },
        constructor: { run: 'mid-w', centre: -3.5 },
      },
      paint: { living: 'sage', office: '__proto__', kitchen: 12 },
      floors: { bedroom: 'walnut', kitchen: 'lava' },
    }
    startFrom({ ...played, home: { ...home, shell } })
    const built = defaultShell()
    expect(farm.home.shell.openings).toEqual({ ...built.openings, livingBedroom: { run: 'mid-s', centre: 2.4, closed: true } })
    expect(farm.home.shell.paint).toEqual({ ...built.paint, living: 'sage' })
    expect(farm.home.shell.floors).toEqual({ ...built.floors, bedroom: 'walnut' })
    // the furniture, the coins, the farm as saved
    expect(farm.home.pieces).toEqual((loaded.home as { pieces: unknown }).pieces)
    expect(without(savedNow(), 'home')).toEqual(without(loaded, 'home'))
    // a shell that is not one: the house as it was built
    for (const bad of [null, 'walls', [], 7]) {
      startFrom({ ...played, home: { ...home, shell: bad } })
      expect(farm.home.shell).toEqual(defaultShell())
    }
    // a farm from before the shell: the house as it was built, with what hangs on its walls and its standing lamp
    startFrom({ ...played, home: { ...home, shell: undefined, pieces: defaultHome().pieces.filter((p) => !/^(floor-lamp|picture|mirror|wall-clock|radiator|switch|outlet|screen)/.test(p.id)) } })
    expect(farm.home.pieces).toEqual(defaultHome().pieces)
    expect(farm.home.shell).toEqual(defaultShell())
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
    // (the XP decides the level's gifts: no box opened past those it reached)
    expect(without(savedNow(), 'xp', 'gifts')).toEqual(without(loaded, 'xp', 'gifts'))
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

  it('the two maps: the house yours as saved, the player in it only while it is; a farm from before them has the house and starts in it', () => {
    expect([farm.apartment.owned, farm.place]).toEqual([true, 'farm'])
    // a farm from before the two maps: it always had the house, and starts in it as it always did
    startFrom(without(played, 'apartment', 'place'))
    expect([farm.apartment.owned, farm.place]).toEqual([true, 'home'])
    expect(without(savedNow(), 'apartment', 'place')).toEqual(without(loaded, 'apartment', 'place'))
    // in the house without owning it: on the farm
    startFrom({ ...played, apartment: { owned: false }, place: 'home' })
    expect([farm.apartment.owned, farm.place]).toEqual([false, 'farm'])
    // broken: not owned unless it says so; any place but the house is the farm
    for (const [apartment, place] of [
      [{ owned: 'yes' }, 'home'],
      [{ owned: 1 }, 'moon'],
      [{}, { x: 1 }],
    ] as const) {
      startFrom({ ...played, apartment, place })
      expect([farm.apartment.owned, farm.place], JSON.stringify([apartment, place])).toEqual([false, 'farm'])
      expect(without(savedNow(), 'apartment', 'place')).toEqual(without(loaded, 'apartment', 'place'))
    }
    startFrom({ ...played, place: 'home' })
    expect(farm.place).toBe('home')
  })

  it('days played: kept as saved, never past today; a farm from before them starts from its daily streak and last claim', () => {
    const today = dayNumber(NOW)
    expect(farm.played).toEqual({ days: 1, last: today })
    startFrom({ ...played, played: { days: 40, last: today + 9 } })
    expect(farm.played).toEqual({ days: 40, last: today })
    // (a farm of the season's week keeps no streak: an unreadable count starts from the one day of its last claim)
    startFrom({ ...played, played: 'lots' })
    expect(farm.played).toEqual({ days: 1, last: (played.daily as { last: number }).last })
    startFrom({ ...without(played, 'played'), daily: { last: today - 1, streak: 9, offered: -1, week: [] } })
    expect(farm.played).toEqual({ days: 9, last: today - 1 })
    startFrom({ ...OLD_SAVE, time: NOW })
    expect(farm.played).toEqual({ days: 0, last: -1 })
  })

  it('a save from before a goal (the fruit): it starts where its count is, what was picked before not paid again', () => {
    const goals = { ...(played.goals as Record<string, number>) }
    delete goals.fruit
    startFrom({ ...played, goals, got: { ...(played.got as object), apple: 40, cherry: 5 } })
    expect(farm.goals.fruit).toBe(startStep(goalById('fruit'), farm))
    expect(goalTarget(goalById('fruit'), farm.goals.fruit)).toBeGreaterThan(45)
    for (const [id, step] of Object.entries(goals)) expect(farm.goals[id as GoalId], id).toBe(step)
  })

  it('the farm’s year: kept as saved, begun no later than today; a farm from before the seasons begins its first spring today', () => {
    const today = dayNumber(NOW)
    expect(farm.season).toEqual({ from: 1, told: 0 })
    // forty days played, its seasons begun on the 15th: winter's fifth day, winter's arrival shown
    startFrom({ ...played, played: { days: 40, last: today }, season: { from: 15, told: 3 } })
    expect(farm.season).toEqual({ from: 15, told: 3 })
    expect(seasonDay()).toMatchObject({ id: 'winter', day: 5, ordinal: 3 })
    // begun ahead of today, an arrival shown ahead of its season: begun today, nothing ahead of it shown
    startFrom({ ...played, played: { days: 40, last: today }, season: { from: 41, told: 9 } })
    expect(farm.season).toEqual({ from: 40, told: 0 })
    // unreadable: begun today
    startFrom({ ...played, season: 'winter' })
    expect(farm.season).toEqual({ from: 1, told: -1 })
    // a farm from before the seasons, nine days played until yesterday: its first spring begins today, its tenth
    startFrom({ ...without(played, 'season'), played: { days: 9, last: today - 1 } })
    expect(farm.season).toEqual({ from: 10, told: -1 })
    tick(0.1)
    expect(farm.played).toEqual({ days: 10, last: today })
    expect(seasonDay()).toMatchObject({ id: 'spring', day: 1, ordinal: 0 })
    // and the oldest, from before days played too
    startFrom({ ...OLD_SAVE, time: NOW })
    expect(farm.season).toEqual({ from: 1, told: -1 })
  })

  it('the sales book loads as saved; a farm from before it gets an empty one, and one saved broken keeps only what a book can hold; everything else as it was', () => {
    // the played farm's sales, all today: a buyer's lettuces, an order's goods, the manager's pumpkins, the logs
    const today = calendarDay()
    expect(farm.ledger.days.map((d) => d.day)).toEqual([today])
    expect(new Set(Object.values(farm.ledger.days[0].sold).flatMap((places) => Object.keys(places!)))).toEqual(new Set(['gate', 'order', 'manager', 'contractor']))
    // a farm from before the book, or a book that is not one: an empty book
    for (const ledger of [undefined, null, 'x', 7, [], { days: 'x' }, { days: [null, 1, 'a', { day: today }] }]) {
      startFrom(ledger === undefined ? without(played, 'ledger') : { ...played, ledger })
      expect(farm.ledger, JSON.stringify(ledger)).toEqual({ days: [] })
      expect(without(savedNow(), 'ledger')).toEqual(without(loaded, 'ledger'))
    }
    // a day past the two weeks or after today goes; a good that is none, a material at the gate, a place that is none
    // and counts of nothing go; counts are whole; a day saved twice adds up
    const days = [
      { day: today - LEDGER_DAYS, sold: { egg: { gate: [1, 2] } } },
      { day: today - 2, sold: { egg: { gate: [2.7, 5] }, brick: { gate: [1, 10], contractor: [1, 10] }, gold: { gate: [1, 1] } } },
      { day: today - 2, sold: { egg: { gate: [1, 2], post: [1, 1] } } },
      { day: today, sold: { milk: { order: [-1, 'x'] } } },
      { day: today + 1, sold: { egg: { gate: [1, 2] } } },
    ]
    startFrom({ ...played, ledger: { days } })
    expect(farm.ledger).toEqual({ days: [{ day: today - 2, sold: { egg: { gate: [3, 7] }, brick: { contractor: [1, 10] } } }] })
    expect(without(savedNow(), 'ledger')).toEqual(without(loaded, 'ledger'))
  })

  it("the neighbours' friendships: kept as saved for those met; a farm from before them has met no one; broken, made safe and the rest as it was", () => {
    expect(farm.friends).toEqual({})
    startFrom(without(played, 'friends'))
    expect(farm.friends).toEqual({})
    expect(without(savedNow(), 'friends')).toEqual(without(loaded, 'friends'))
    // the act's five chapters done: all five met (src/farm/people/story.ts)
    const story = { done: ['bread', 'class', 'scarves', 'honey', 'picnic'], on: null, sent: false }
    const friends = { baker: { points: 9, told: 1 }, child: { points: 3, told: 0 } }
    startFrom({ ...played, story, friends })
    expect(farm.friends).toEqual(friends)
    expect(savedNow().friends).toEqual(friends)
    // points below nothing, more hearts told than reached, someone not a neighbour, a friendship that is a word
    startFrom({ ...played, story, friends: { baker: { points: -2, told: 4 }, manager: { points: 5, told: 0 }, teacher: 'yes', knitter: { points: Infinity, told: 9 } } })
    expect(farm.friends).toEqual({ baker: { points: 0, told: 0 }, knitter: { points: 0, told: 0 } })
    expect(without(savedNow(), 'friends', 'story')).toEqual(without(loaded, 'friends', 'story'))
    // only those met: with the first chapter on, the baker alone
    startFrom({ ...played, story: { done: [], on: 'bread', sent: false }, friends })
    expect(farm.friends).toEqual({ baker: friends.baker })
    // with no story (a farm from before it, or one met by a save edited by hand), no one
    startFrom({ ...played, friends })
    expect(farm.friends).toEqual({})
  })

  it('the mailbox, the story and its request load as saved; a farm from before them has none; broken, made safe and the rest as it was', () => {
    expect([farm.mail, farm.story, farm.requests]).toEqual([{ waiting: [], read: [] }, { done: [], on: null, sent: false }, []])
    const story = { done: ['bread'], on: 'class', sent: false }
    const mail = { waiting: [{ id: 'thanks:bread', from: 'baker', prize: { decor: 'bench' } }], read: [{ id: 'chapter:bread', from: 'baker' }] }
    const requests = [
      {
        lines: [
          { good: 'lemon', want: 6, have: 2 },
          { good: 'strawberry', want: 10, have: 0 },
        ],
        coins: 30,
        surprise: false,
        from: 'teacher',
        chapter: 'class',
      },
    ]
    startFrom({ ...played, story, mail, requests })
    expect([farm.story, farm.mail]).toEqual([story, mail])
    expect(farm.requests.map(({ id: _id, ...o }) => o)).toEqual(requests)
    const again = savedNow()
    expect([again.story, again.mail, again.requests]).toEqual([story, mail, requests])
    expect(without(again, 'story', 'mail', 'requests')).toEqual(without(loaded, 'story', 'mail', 'requests'))
    // broken: chapters out of order, a letter that is no letter, one twice, a gift no save holds, a request for another
    // chapter asking more than it wants
    startFrom({
      ...played,
      story: { done: ['class', 'bread'], on: 'scarves', sent: 'yes' },
      mail: { waiting: [{ id: 'heart:baker:9' }, { id: 'heart:baker:1', from: 'child', prize: { coins: -5 } }, { id: 'heart:baker:1' }], read: 'none' },
      requests: [{ lines: [{ good: 'wool', want: 99, have: 50 }], coins: 1e9, chapter: 'honey' }],
    })
    expect(farm.story).toEqual({ done: [], on: null, sent: false })
    expect(farm.mail).toEqual({ waiting: [{ id: 'heart:baker:1', from: 'baker' }], read: [] })
    expect(farm.requests).toEqual([])
    // a chapter on with its request lost: asked again, nothing in yet
    startFrom({ ...played, story: { done: ['bread'], on: 'class', sent: false } })
    expect(farm.requests.map((o) => [o.chapter, o.from, o.lines.map((l) => [l.good, l.want, l.have])])).toEqual([
      [
        'class',
        'teacher',
        [
          ['lemon', 6, 0],
          ['strawberry', 10, 0],
        ],
      ],
    ])
    // its request sent: none on the board (the thank-you letter comes next)
    startFrom({ ...played, story: { done: ['bread'], on: 'class', sent: true }, requests })
    expect(farm.requests).toEqual([])
  })

  it("a neighbour's order on the board and a neighbour in the line come back as theirs, only for those met", () => {
    const board = played.orders as Save[]
    const k = board.findIndex((o) => 'lines' in o)
    const queue = played.queue as Save[]
    const orders = board.map((o, i) => (i === k ? { ...o, from: 'baker' } : o))
    const line = [{ ...queue[0], who: 'baker', name: 'Someone', look: queue[1].look }, { ...queue[1], who: 'baker' }, { ...queue[2], who: 'teacher' }, ...queue.slice(3)]
    startFrom({ ...played, story: { done: [], on: 'bread', sent: false }, orders, queue: line })
    expect((farm.orders[k] as { order: { from?: string } }).order.from).toBe('baker')
    // the baker is themselves (their name and look), once; the teacher is not met: a stranger
    const baker = inLine().filter((v) => v.who === 'baker')
    expect(baker.map((v) => v.name)).toEqual(['Moshe'])
    expect(inLine().some((v) => v.who === 'teacher')).toBe(false)
    expect(inLine().length).toBe(queue.length - 1)
    const saved = savedNow()
    expect((saved.queue as Save[]).filter((b) => b.who).map((b) => b.who)).toEqual(['baker'])
    expect((saved.orders as Save[])[k].from).toBe('baker')
    // nobody met: the order is a stranger's, and everyone in line too
    startFrom({ ...played, orders, queue: line })
    expect((farm.orders[k] as { order: { from?: string } }).order.from).toBeUndefined()
    expect(inLine().some((v) => v.who)).toBe(false)
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
