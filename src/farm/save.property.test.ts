// @vitest-environment happy-dom
import fc from 'fast-check'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PIECES, PIECE_TYPES } from '../home/catalogue'
import { ROOM_WEIGHT, canPlacePiece, defaultHome, roomWeight, unreachable } from '../home/layout'
import { ROOMS, type RoomId } from '../data/layout'
import { endsWithin } from '../lib/endsWithin'
import {
  BEDS,
  CROPS,
  MACHINES,
  MACHINE_IDS,
  NAMES,
  PACE_LEVELS,
  PRODUCE,
  PRODUCERS,
  PRODUCER_IDS,
  QUEUE_LEVELS,
  SELLABLE,
  SLOT_LEVELS,
  STORE_IDS,
  TRACTOR,
  WAIT_LEVELS,
  WATER_SHARE,
  cropById,
  orderSlots,
  orderWait,
  type CropId,
} from './data'
import { PARCELS, PARCEL_IDS, PLACE_IDS, canPlace } from './layout'
import { arrivalSeconds, farm, gateX, inLine, placesInLine, tick } from './state'
import { tripSeconds } from './tractorRoute'
import { OLD_SAVE, OLD_SAVE_2, playedSave, savedNow, seeded, startFrom } from './testSaves'

// The farm's save against anything (fast-check): one value of a real save, anywhere in it, turned into anything at all
// (a hand-edited save, a file from somewhere else). Loaded the way the game starts, the farm must load, play on, keep
// every rule a farm keeps, and keep every other part of the save as it was. `FC_RUNS=5000 npx vitest run save.property`
// tries more; a failure prints its seed and the smallest save that breaks.

const RUNS = Number(process.env.FC_RUNS) || 200
/** Long enough for any load (a few milliseconds), short enough that a loop that never ends fails the test instead. */
const LIMIT = 1500
const NOW = Date.UTC(2026, 10, 10, 12)

type Key = string | number
type Save = Record<string, unknown>
interface Base {
  name: string
  save: Save
  /** saved by the code before the tables: its producers and machines are in fields of their own (OLD_PARTS) */
  old: boolean
  /** what it loads to, part by part (`parts`) */
  parts: Map<string, unknown>
}

const produceIds: string[] = PRODUCE.map((p) => p.id)
/** What buyers and orders ask for (no building material). */
const sellable: string[] = SELLABLE
const cropIds: string[] = CROPS.map((c) => c.id)
const isCrop = (v: unknown): v is CropId => cropIds.includes(v as string)
/** A kind of furniture of the catalogue (not the game's own isPieceType: the rules here do not lean on the code they test). */
const isKind = (v: unknown) => (PIECE_TYPES as string[]).includes(v as string)
const STATS = ['harvested', 'sold', 'earned', 'declined', 'baked']

// ───────────────────────────── what a value can be turned into ─────────────────────────────

/** fast-check's dangerous strings (names every object has, and a few more: SlicesForStringBuilder.ts in fast-check). */
const FAST_CHECK_STRINGS = '__defineGetter__ __defineSetter__ __lookupGetter__ __lookupSetter__ __proto__ constructor hasOwnProperty isPrototypeOf propertyIsEnumerable'
  .concat(' toLocaleString toString valueOf apply arguments bind call caller length name prototype key ref')
  .split(' ')
/** Text that reads as something else. */
const ODD_TEXT = ['', ' ', '0', '-0', '1e999', 'NaN', 'Infinity', 'null', 'undefined', 'true', '[]', '{}', '\u0000', '\ud800', '#zzzzzz', '#FFFFFF', 'x'.repeat(2000)]
/** Strings that break code which looks a name up: those above, and every name the game has, each wrong in most places. */
const STRINGS = [...FAST_CHECK_STRINGS, ...ODD_TEXT, ...produceIds, ...PIECE_TYPES, ...MACHINE_IDS, ...MACHINE_IDS.flatMap((id) => MACHINES[id].recipes.map((r) => r.id))]
STRINGS.push(...PRODUCER_IDS, ...PLACE_IDS, ...PARCEL_IDS, ...NAMES)
/** Numbers that break arithmetic: -0, fractions, past 2^53 (one more is the same number), ±1e308 and beyond. */
const NUMBERS = [0, -0, 1, -1, 0.5, -0.5, 2.6, 1e-300, Number.MIN_VALUE, 2 ** 31, Number.MAX_SAFE_INTEGER, 2 ** 53, 2 ** 53 + 2, 1e15, 1e16, 1e20, -1e20]
NUMBERS.push(1e300, 1e308, -1e308, Number.MAX_VALUE, -Number.MAX_VALUE, Infinity, -Infinity, NaN)

const someString = fc.oneof(fc.constantFrom(...STRINGS), fc.string())
/** Anything at all in place of one value (`original`, the value that was there: a number's place gets more of the odd
 *  numbers, a string's more of the odd strings). */
const anything = (original: unknown) =>
  fc.oneof(
    { weight: 4, arbitrary: fc.anything({ maxDepth: 3, maxKeys: 5, key: someString, withNullPrototype: true }) },
    { weight: typeof original === 'number' ? 8 : 3, arbitrary: fc.constantFrom(...NUMBERS) },
    { weight: typeof original === 'string' ? 8 : 3, arbitrary: fc.constantFrom(...STRINGS) },
    // left out of the save
    { weight: 1, arbitrary: fc.constant(undefined) },
    // a long list of odd things (kept small: forty at most)
    { weight: 1, arbitrary: fc.array(fc.oneof(fc.constantFrom(...NUMBERS), fc.anything({ maxDepth: 1 })), { maxLength: 40 }) },
    // a list grown long with its own items (forty buyers, beds, pieces, counts…)
    ...(Array.isArray(original) && original.length ? [{ weight: 2, arbitrary: fc.array(fc.constantFrom(...original), { minLength: original.length + 1, maxLength: 40 }) }] : []),
  )

/** JSON text as a hand-edited save can hold it: -0 stays -0 and ±Infinity is written ±1e999 (JSON.parse reads it as
 *  Infinity); NaN, which JSON cannot hold, becomes null. */
function toJson(v: unknown): string {
  const special = (x: unknown) => typeof x === 'number' && (Object.is(x, -0) || x === Infinity || x === -Infinity)
  const mark = (x: number) => `\u0000${Object.is(x, -0) ? '-0' : x > 0 ? '1e999' : '-1e999'}\u0000`
  return JSON.stringify(v, (_k, x: unknown) => (special(x) ? mark(x as number) : x)).replace(/"\\u0000(-0|1e999|-1e999)\\u0000"/g, '$1')
}

/** Every place in a save: the path to each value, list and object in it (keys and indices). */
function paths(v: unknown, at: Key[] = []): Key[][] {
  const here = at.length ? [at] : []
  if (!v || typeof v !== 'object') return here
  return [...here, ...Object.entries(v).flatMap(([k, x]) => paths(x, [...at, Array.isArray(v) ? Number(k) : k]))]
}
const get = (v: unknown, path: Key[]) => path.reduce<unknown>((o, k) => (o as Record<Key, unknown>)[k], v)
/** A copy of a save with one value put in (undefined: the field left out). */
function put(save: Save, path: Key[], value: unknown): unknown {
  const copy = structuredClone(save)
  ;(get(copy, path.slice(0, -1)) as Record<Key, unknown>)[path[path.length - 1]] = value
  return copy
}

// ───────────────────────────── the parts of a save ─────────────────────────────

/** A save cut into the parts a value belongs to, each named by its path: each good, bed, stat and machine, each
 *  producer's animals, counts and clocks; the layout, the furniture, storage and the line each as one. */
function partsOf(v: unknown, at = ''): [string, unknown][] {
  const split = /^(|inv|beds|producers|producers\.\w+|machines|expansions|stats|home)$/.test(at)
  if (!split || !v || typeof v !== 'object') return [[at, v]]
  return Object.entries(v).flatMap(([k, x]) => partsOf(x, at ? `${at}.${k}` : k))
}

/** Where a save from before the tables kept its producers and machines (src/farm/state.ts, OLD_PRODUCERS). */
const OLD_PARTS: Record<string, string> = {
  lemons: 'producers.tree.stock',
  lemonTimer: 'producers.tree.timer',
  hens: 'producers.hens.animals',
  eggs: 'producers.hens.stock',
  eggTimer: 'producers.hens.timer',
  cows: 'producers.cows.animals',
  milk: 'producers.cows.stock',
  milkTimer: 'producers.cows.timer',
  sheep: 'producers.sheep.animals',
  wool: 'producers.sheep.stock',
  woolTimer: 'producers.sheep.timer',
  mill: 'machines.mill',
  loom: 'machines.loom',
  oven: 'machines.oven',
}

/**
 * What one part of a save decides about others as the game reads it: the only other parts allowed to change with it.
 *  - the land bought for beds (expansions) → the beds: a bed on land not bought is not there
 *  - a producer's animals → its counts and clocks: one of each for every cow and every sheep
 *  - the places in the line (queueLevel) → the line: as many buyers are kept
 *  - how busy the lane is (paceLevel) → the countdown to the next buyer: never longer than the time between two
 *  - that countdown → the line: a buyer due as the farm loads joins it, and the countdown starts again
 *  - the time it was saved → all that grows while away (the beds, the producers, the machines) and the buyers who came
 *  - the furniture → storage (a piece that does not fit is put away) and the number for new pieces (past every id's)
 *  - the layout is one part: a field not bought sends the places on it home, and one place sent home can send all home;
 *    the west meadow bought or not moves the tractor's gate, and so how long its trip is (dispatch)
 *  - the office's upgrades → the order board: as many places, and no wait longer than the office's
 *  - the time it was saved also → the orders on their way (they come in) and the tractor's trip (it goes on)
 */
function alsoChanges(part: string): RegExp | null {
  if (part.startsWith('expansions')) return /^beds\./
  if (part === 'office') return /^orders$/
  if (part === 'layout') return /^dispatch$/
  const herd = /^producers\.(\w+)\.animals$/.exec(part)
  if (herd) return new RegExp(`^producers\\.${herd[1]}\\.(stock|timer)$`)
  if (part === 'queueLevel' || part === 'nextVisitorIn') return /^queue$/
  if (part === 'paceLevel') return /^nextVisitorIn$/
  if (part === 'time') return /^(beds|producers|machines)\.|^nextVisitorIn$|^queue$|^orders$|^dispatch$/
  if (part === 'home.pieces') return /^home\.(stored|next)$/
  return null
}

/** The parts a value at `path` belongs to, and those it decides about. */
function free(base: Base, path: Key[], names: string[]): (name: string) => boolean {
  const at = base.old && OLD_PARTS[path[0]] ? OLD_PARTS[path[0]] : path.join('.')
  const touched = names.filter((n) => n === at || n.startsWith(`${at}.`) || at.startsWith(`${n}.`))
  const coupled = touched.map(alsoChanges).filter((r): r is RegExp => !!r)
  return (n) => touched.includes(n) || coupled.some((r) => r.test(n))
}

// ───────────────────────────── the rules every farm keeps ─────────────────────────────

const isCount = (v: unknown, most = Number.MAX_SAFE_INTEGER) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= most
const isWithin = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi
const sameKeys = (o: object, keys: string[]) => Object.keys(o).sort().join() === [...keys].sort().join()
const unique = (list: unknown[]) => new Set(list).size === list.length
const json = (v: unknown) => JSON.stringify(v)

/** What breaks a rule every farm keeps as it runs (nothing: an empty list). */
function farmProblems(): string[] {
  const out: string[] = []
  const bad = (what: string, ok: boolean) => {
    if (!ok) out.push(what)
  }
  // a number that is not finite (a save cannot hold one: it would be saved as null)
  const numbers = (v: unknown, at: string): void => {
    if (typeof v === 'number') bad(`${at} is ${v}`, Number.isFinite(v))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) numbers(x, `${at}.${k}`)
  }
  numbers(farm, 'farm')
  bad('coins', isCount(farm.coins))
  bad('inv holds the goods', sameKeys(farm.inv, produceIds))
  for (const [id, n] of Object.entries(farm.inv)) bad(`inv.${id}`, isCount(n))
  bad('as many beds as there are', farm.beds.length === BEDS.length)
  farm.beds.forEach((b, i) => {
    const def = BEDS[i]
    const most = isCrop(b.crop) ? cropById(b.crop).growSeconds : 0
    bad(`beds.${i}: its fields`, sameKeys(b, ['built', 'crop', 'growth', 'water', 'fixed']))
    bad(`beds.${i}: built on land bought`, typeof b.built === 'boolean' && (!def.expansion || b.built === farm.expansions[def.expansion]))
    bad(`beds.${i}.crop`, b.crop === null || (isCrop(b.crop) && b.built))
    bad(`beds.${i}.fixed`, b.fixed === null || isCrop(b.fixed))
    bad(`beds.${i}.growth`, isWithin(b.growth, 0, most))
    bad(`beds.${i}.water`, isWithin(b.water, 0, most * WATER_SHARE))
  })
  bad('the producers', sameKeys(farm.producers, PRODUCER_IDS))
  for (const id of PRODUCER_IDS) {
    const def = PRODUCERS[id]
    const p = farm.producers[id]
    bad(`producers.${id}.animals`, def.herd ? isCount(p.animals) && p.animals >= def.herd.start && p.animals <= def.herd.max : p.animals === 0)
    const n = def.herd && !def.herd.shared ? p.animals : 1
    bad(`producers.${id}: a count and a clock for each`, p.stock.length === n && p.timer.length === n)
    p.stock.forEach((s, i) => bad(`producers.${id}.stock.${i}`, isCount(s, def.max)))
    p.timer.forEach((t, i) => bad(`producers.${id}.timer.${i}`, typeof t === 'number' && t >= 0 && t < def.every))
  }
  bad('the machines', sameKeys(farm.machines, MACHINE_IDS))
  for (const id of MACHINE_IDS) {
    const def = MACHINES[id]
    const m = farm.machines[id]
    const r = def.recipes.find((x) => x.id === m.recipe)
    bad(`machines.${id}: its fields`, sameKeys(m, ['recipe', 'count', 'progress', 'ready']))
    bad(`machines.${id}.count`, isCount(m.count, def.capacity))
    bad(`machines.${id}.ready`, isCount(m.ready, def.capacity))
    const idle = m.recipe === null && m.count === 0 && m.ready === 0 && m.progress === 0
    const working = !!r && m.count > 0 && m.ready === 0 && isWithin(m.progress, 0, m.count * r.seconds)
    const done = !!r && m.count === 0 && m.ready > 0 && m.progress === 0
    bad(`machines.${id}: idle, at work or done`, idle || working || done)
  }
  for (const k of ['sprinkler', 'compost', 'started'] as const) bad(k, typeof farm[k] === 'boolean')
  bad('expansions', sameKeys(farm.expansions, ['east', 'west']) && Object.values(farm.expansions).every((v) => typeof v === 'boolean'))
  bad('queueLevel', isCount(farm.queueLevel, QUEUE_LEVELS))
  bad('paceLevel', isCount(farm.paceLevel, PACE_LEVELS))
  bad('nextVisitorIn', isWithin(farm.nextVisitorIn, 0, arrivalSeconds()))
  bad('planted: crops, once each', farm.planted.every(isCrop) && unique(farm.planted))
  bad('made: goods, once each', farm.made.every((id) => produceIds.includes(id)) && unique(farm.made))
  bad('stats: the five', sameKeys(farm.stats, STATS))
  for (const [k, n] of Object.entries(farm.stats)) bad(`stats.${k}`, isCount(n))
  bad('no more in line than its places', inLine().length <= placesInLine())
  for (const v of farm.visitors) {
    const colours = [v.look.shirt, v.look.trousers, v.look.skin, v.look.hair].every((c) => /^#[0-9a-f]{6}$/i.test(c))
    bad(`buyer ${v.id}`, sellable.includes(v.want) && isCount(v.qty) && v.qty >= 1 && v.qty <= 12 && isCount(v.offer) && v.offer >= 1 && v.offer <= 999 && colours)
    bad(`buyer ${v.id}: name`, typeof v.name === 'string' && v.name.length <= 24)
    bad(`buyer ${v.id}: a surprise or none`, typeof v.gift === 'boolean')
  }
  // the silo and the barn: a level each, from 1
  bad('storage: the silo and the barn', sameKeys(farm.storage, STORE_IDS) && Object.values(farm.storage).every((l) => isCount(l) && l >= 1))
  // the order board: as many places as the office has, each an order (one to nine goods buyers buy, each once, no more
  // in than it wants) or a wait no longer than the office's
  bad('office', sameKeys(farm.office, ['slots', 'wait']) && isCount(farm.office.slots, SLOT_LEVELS) && isCount(farm.office.wait, WAIT_LEVELS))
  bad('orders: a place each', farm.orders.length === orderSlots(farm.office.slots))
  farm.orders.forEach((slot, k) => {
    if ('wait' in slot) return bad(`orders.${k}: a wait`, sameKeys(slot, ['wait']) && isWithin(slot.wait, 0, orderWait(farm.office.wait)))
    const o = slot.order
    bad(`orders.${k}: an order`, sameKeys(slot, ['order']) && sameKeys(o, ['id', 'lines', 'coins', 'surprise']) && isCount(o.coins) && o.coins >= 1 && typeof o.surprise === 'boolean')
    bad(`orders.${k}: one to nine goods, each once`, o.lines.length >= 1 && o.lines.length <= 9 && unique(o.lines.map((l) => l.good)))
    for (const l of o.lines) bad(`orders.${k}.${l.good}`, sellable.includes(l.good) && isCount(l.want) && l.want >= 1 && isCount(l.have, l.want))
  })
  // the crates sent and the tractor: on a trip with some aboard, or at home with none
  const d = farm.dispatch
  bad('dispatch', sameKeys(d, ['waiting', 'aboard', 'trip']) && isCount(d.waiting) && isCount(d.aboard, TRACTOR.load))
  bad('dispatch: a trip with crates, or home', d.aboard ? isWithin(d.trip, 0, tripSeconds(d.aboard, gateX())) : d.trip === -1)
  return out
}

/** What breaks a rule of where things stand: the farm's places, the land, the furniture (nothing: an empty list). */
function placeProblems(): string[] {
  const out: string[] = []
  const bad = (what: string, ok: boolean) => {
    if (!ok) out.push(what)
  }
  const { places, land } = farm.layout
  bad('layout: every place', sameKeys(places, PLACE_IDS))
  for (const id of PLACE_IDS) bad(`layout.places.${id} fits`, [0, 1, 2, 3].includes(places[id].rot) && canPlace(farm.layout, id, places[id]).ok)
  bad(
    'layout.land: fields, once each, bought in order',
    land.every((id) => PARCEL_IDS.includes(id)) && unique(land) && land.every((id) => !PARCELS[id].after || PARCELS[id].after!.some((a) => land.includes(a))),
  )
  const { pieces, stored, next } = farm.home
  const ids = pieces.map((p) => p.id)
  bad('home.pieces: ids once each', unique(ids))
  const built = new Map(defaultHome().pieces.map((p) => [p.id, p]))
  for (const p of pieces) {
    if (!isKind(p.type)) bad(`home.pieces.${p.id}: a kind of the catalogue`, false)
    else if (PIECES[p.type].fitted) bad(`home.pieces.${p.id}: fitted, where it was built`, json(p) === json(built.get(p.id)))
    else bad(`home.pieces.${p.id} fits`, [0, 1, 2, 3].includes(p.rot) && canPlacePiece(farm.home, p).ok)
  }
  // the kitchen's fitted pieces always stand where they were built (they cannot be bought again)
  const standing = new Set(pieces.map(json))
  for (const d of built.values()) if (PIECES[d.type].fitted) bad(`home: the ${d.id} stands`, standing.has(json(d)))
  for (const room of Object.keys(ROOMS) as RoomId[]) bad(`home: ${room} within what it may draw`, roomWeight(farm.home, room) <= ROOM_WEIGHT)
  bad('home: everything within reach', unreachable(farm.home) === null)
  bad('home.stored: kinds of the catalogue', stored.every(isKind))
  bad('home.next counts', isCount(next) && next >= 1)
  // the next piece taken out of storage gets an id of its own
  const taken = PIECE_TYPES.some((t) => ids.includes(`${t}-${next}`))
  bad('home.next: a new id', !taken)
  return out
}

// ───────────────────────────── the properties ─────────────────────────────

let bases: Base[] = []
const baseNamed = (name: string) => bases.find((b) => b.name === name)!
const random = vi.spyOn(Math, 'random')

/** Loads a save's text the way the game starts: what it loads to, part by part. */
function loadedParts(text: string): Map<string, unknown> {
  random.mockImplementation(seeded(1))
  const ended = endsWithin(LIMIT, () => startFrom(text))
  expect(ended, 'it loads').toBe(true)
  return new Map(partsOf(savedNow()))
}

/** One value of a save put in, loaded, played on: every rule kept, every other part as the save had it. */
function check(name: string, path: Key[], value: unknown) {
  const base = baseNamed(name)
  const parts = loadedParts(toJson(put(base.save, path, value)))
  expect(farmProblems(), 'as loaded').toEqual([])
  // where things stand is checked again where it differs from the save as it was (which keeps the rules: the first test)
  if (['layout', 'home.pieces', 'home.stored', 'home.next'].some((n) => json(parts.get(n)) !== json(base.parts.get(n)))) expect(placeProblems(), 'as loaded').toEqual([])
  const names = [...new Set([...base.parts.keys(), ...parts.keys()])]
  const mayChange = free(base, path, names)
  const changed = names.filter((n) => !mayChange(n) && json(parts.get(n)) !== json(base.parts.get(n)))
  expect(changed, 'other parts changed').toEqual([])
  // a frame, and the longest step the game takes (an hour: src/farm/Garden.tsx)
  const played = endsWithin(LIMIT, () => {
    tick(1)
    tick(3600)
  })
  expect(played, 'it plays on').toBe(true)
  expect(farmProblems(), 'played on').toEqual([])
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  const saves: [string, Save, boolean][] = [
    ['played', playedSave(), false],
    ['old', OLD_SAVE, true],
    ['old 2', OLD_SAVE_2, true],
  ]
  // saved just now: nothing grows on while away (unless the time is what changed)
  bases = saves.map(([name, save, old]) => ({ name, save: { ...save, time: NOW }, old, parts: new Map() }))
  for (const b of bases) b.parts = loadedParts(toJson(b.save))
})
afterAll(() => {
  random.mockRestore()
  vi.useRealTimers()
})

/** Time for a property's runs (a run takes about 10 ms). */
const TIME = 10_000 + RUNS * 60

describe('a save with one value turned into anything (fast-check)', () => {
  it('as saved, each loads as it is and keeps every rule', () => {
    for (const b of bases) {
      loadedParts(toJson(b.save))
      expect([...farmProblems(), ...placeProblems()], b.name).toEqual([])
    }
    const played = bases[0]
    expect(Object.fromEntries(played.parts)).toEqual(Object.fromEntries(partsOf(played.save)))
  })

  it(
    'anything, anywhere: it loads, plays on, keeps the rules and every other part of the save',
    () => {
      const corruption = fc.constantFrom(...bases.map((b) => b.name)).chain((base) => {
        const save = baseNamed(base).save
        return fc.constantFrom(...paths(save)).chain((path) => fc.record({ base: fc.constant(base), path: fc.constant(path), value: anything(get(save, path)) }))
      })
      fc.assert(
        fc.property(corruption, ({ base, path, value }) => check(base, path, value)),
        { numRuns: RUNS },
      )
    },
    TIME,
  )

  it(
    'a dangerous string wherever the save holds a string (an id, a kind, a name, a colour)',
    () => {
      const where = bases.flatMap((b) =>
        paths(b.save)
          .filter((path) => typeof get(b.save, path) === 'string')
          .map((path) => ({ base: b.name, path })),
      )
      fc.assert(
        fc.property(fc.constantFrom(...where), someString, ({ base, path }, value) => check(base, path, value)),
        // half as many: the first property puts these strings in too
        { numRuns: Math.ceil(RUNS / 2) },
      )
    },
    TIME,
  )
})
