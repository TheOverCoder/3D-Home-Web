// @vitest-environment happy-dom
import fc from 'fast-check'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PIECES, PIECE_TYPES } from '../home/catalogue'
import { ROOM_WEIGHT, canPlacePiece, defaultHome, pieceRoom, roomWeight } from '../home/layout'
import { OPENINGS, floorById, openingProblem, paintById } from '../home/shell'
import { ROOMS, type RoomId } from '../data/layout'
import { endsWithin } from '../lib/endsWithin'
import {
  BEDS,
  CROPS,
  ITEMS,
  LADDERS,
  LADDER_IDS,
  LEVELS,
  MACHINES,
  MACHINE_IDS,
  NAMES,
  PACE_LEVELS,
  PRODUCE,
  PRODUCERS,
  PRODUCER_IDS,
  QUEUE_LEVELS,
  SELLABLE,
  SHOP,
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
import { GOAL_IDS, MOST_STEPS } from './goals'
import { PARCELS, PARCEL_IDS, PLACE_IDS, bedHome, canPlace, canPlaceBed, canPlaceThing, isShopKind, mostOf } from './layout'
import { FRUIT_KINDS, SHOP as FARM_SHOP, type ShopKind } from './decor'
import { MAX_PLACES, SHOP_LADDERS, placesOpen, shopperEvery } from './market'
import { offersPerDay } from './contractor'
import { FIRST_STEP, levelOf, levelProgress } from './xp'
import { BOX_COUNT, CAME_KEPT, PER_LEVEL, boxAt, boxesReached } from './gifts'
import { EVENT_IDS, LUCKY_GOODS, SEEN_KEPT } from './events'
import { FIRST_STEPS } from './firstSteps'
import { QUEUE, machineLevel } from './machineView'
import { garmentById, garmentsAt } from './outfit'
import { sanitizeLook } from '../models/look'
import { arrivalSeconds, claimDaily, farm, gateX, giftsWaiting, inLine, placesInLine, tick } from './state'
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
const STATS = ['harvested', 'sold', 'earned', 'declined', 'baked', 'sent', 'watered']

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
    ...(Array.isArray(original) && original.length
      ? [{ weight: 2, arbitrary: fc.array(fc.constantFrom(...original), { minLength: original.length + 1, maxLength: Math.max(40, original.length + 1) }) }]
      : []),
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
 *  - the house's shell (its doorways, windows, paint and floors) → the furniture as above (a piece where a doorway was
 *    closed is put away; a save with no shell, from before it, gets the things on the walls and the standing lamp)
 *  - the layout is one part: a field not bought sends the places on it home, and one place sent home can send all home;
 *    the west meadow bought or not moves the tractor's gate, and so how long its trip is (dispatch); the fruit trees and
 *    bushes standing on it are their producers' plants (each kind's producer: its counts and clocks)
 *  - the beds (built or not) → the layout: a bed not built stands where it was staked out
 *  - the office's upgrades → the order board: as many places, and no wait longer than the office's
 *  - the time it was saved also → the orders on their way (they come in) and the tractor's trip (it goes on); the
 *    shop's visits (its shelves, its till, the countdown), the day's clock and the contractor's new day
 *  - the ladders → the market (how many places are open, the longest wait for a visit) and the contractor (how many
 *    pieces a day); the market (whether the shop is yours) → the ladders (the shop's own are 0 until it is)
 */
function alsoChanges(part: string): RegExp | null {
  if (part.startsWith('expansions')) return /^beds\.|^layout$/
  // a bed not built stands where it was staked out (only a built one moves)
  if (part.startsWith('beds.')) return /^layout$/
  if (part === 'office') return /^orders$/
  // the fruit trees and bushes standing are their producers' plants (one count and clock each)
  if (part === 'layout') return /^dispatch$|^producers\.[a-z]+-(tree|bush)$/
  const herd = /^producers\.(\w+)\.animals$/.exec(part)
  if (herd) return new RegExp(`^producers\\.${herd[1]}\\.(stock|timer)$`)
  if (part === 'queueLevel' || part === 'nextVisitorIn') return /^queue$/
  if (part === 'paceLevel') return /^nextVisitorIn$/
  if (part === 'time') return /^(beds|producers|machines)\.|^nextVisitorIn$|^queue$|^orders$|^dispatch$|^(market|contractor|day)$/
  if (part === 'home.pieces') return /^home\.(stored|next)$/
  if (part === 'home.shell' || part.startsWith('home.shell.')) return /^home\.(pieces|stored|next)$/
  // you are in the house only while it is yours (src/farm/state.ts, load)
  if (part === 'apartment' || part.startsWith('apartment.')) return /^place$/
  // the ladders decide how many places the shop has and how often shoppers come, and how many pieces the contractor brings
  if (part === 'ladders' || part.startsWith('ladders.')) return /^(market|contractor)(\.|$)/
  // the shop's own ladders count only once the shop is yours (src/farm/market.ts, clampLevels)
  if (part === 'market' || part.startsWith('market.')) return /^ladders(\.|$)/
  // the level decides which garments the wardrobe has, so what can be worn (src/farm/outfit.ts), and the boxes it
  // reached on the levels' bars, so which can be open (src/farm/gifts.ts); a level reached and not paid (a farm from
  // when its coins waited for a Claim) is paid as the farm loads (src/farm/state.ts, load)
  if (part === 'xp' || part.startsWith('xp.')) return /^(outfit|gifts|coins)(\.|$)/
  return null
}

/** The parts a value at `path` belongs to, and those it decides about. */
function free(base: Base, path: Key[], names: string[]): (name: string) => boolean {
  const at = base.old && OLD_PARTS[path[0]] ? OLD_PARTS[path[0]] : path.join('.')
  const touched = names.filter((n) => n === at || n.startsWith(`${at}.`) || at.startsWith(`${n}.`))
  const coupled = touched.map(alsoChanges).filter((r): r is RegExp => !!r)
  // a farm from before the goals starts each where its counts are: they follow the stats and what it has got
  if (base.old && /^(stats|got)(\.|$)/.test(at)) coupled.push(/^goals(\.|$)/)
  // and its XP starts from what it did (src/farm/xp.ts, seedXp), and so what the wardrobe has
  if (base.old && /^stats(\.|$)/.test(at)) coupled.push(/^(xp|outfit|gifts)(\.|$)/)
  return (n) => touched.includes(n) || coupled.some((r) => r.test(n))
}

// ───────────────────────────── the rules every farm keeps ─────────────────────────────

const isCount = (v: unknown, most = Number.MAX_SAFE_INTEGER) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= most
const isWithin = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi
const sameKeys = (o: object, keys: string[]) => Object.keys(o).sort().join() === [...keys].sort().join()
const unique = (list: unknown[]) => new Set(list).size === list.length
const json = (v: unknown) => JSON.stringify(v)
/** An object as JSON with its keys in order (two looks with the same traits read the same). */
const sorted = (v: object | null) => (v ? JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))) : 'null')

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
  // a fruit kind's producer has a count and a clock for each of its plants standing on the farm
  for (const kind of FRUIT_KINDS) bad(`producers.${kind}: one for each plant standing`, farm.producers[kind].animals === farm.layout.decor.filter((d) => d.kind === kind).length)
  // the machines: a queue of their own recipes, twelve at most; the done ones first, no more than there are; the one
  // under way no further in than it takes at the machine's level (none: no progress); three to twelve places; the
  // seconds worked from 0
  bad('the machines', sameKeys(farm.machines, MACHINE_IDS))
  for (const id of MACHINE_IDS) {
    const def = MACHINES[id]
    const m = farm.machines[id]
    bad(`machines.${id}: its fields`, sameKeys(m, ['jobs', 'done', 'progress', 'capacity', 'worked']))
    bad(`machines.${id}.jobs`, Array.isArray(m.jobs) && m.jobs.length <= QUEUE.max && m.jobs.every((j) => def.recipes.some((r) => r.id === j)))
    bad(`machines.${id}.done`, isCount(m.done, m.jobs.length))
    bad(`machines.${id}.capacity`, isCount(m.capacity, QUEUE.max) && m.capacity >= QUEUE.start)
    bad(`machines.${id}.worked`, isWithin(m.worked, 0, Number.MAX_VALUE))
    const r = def.recipes.find((x) => x.id === m.jobs[m.done])
    bad(`machines.${id}.progress`, r ? isWithin(m.progress, 0, r.seconds * (1 - machineLevel(m.worked).boost.speed)) : m.progress === 0)
  }
  for (const k of ['sprinkler', 'compost', 'started'] as const) bad(k, typeof farm[k] === 'boolean')
  bad('expansions', sameKeys(farm.expansions, ['east', 'west']) && Object.values(farm.expansions).every((v) => typeof v === 'boolean'))
  bad('queueLevel', isCount(farm.queueLevel, QUEUE_LEVELS))
  bad('paceLevel', isCount(farm.paceLevel, PACE_LEVELS))
  bad('nextVisitorIn', isWithin(farm.nextVisitorIn, 0, arrivalSeconds()))
  bad('planted: crops, once each', farm.planted.every(isCrop) && unique(farm.planted))
  bad('made: goods, once each', farm.made.every((id) => produceIds.includes(id)) && unique(farm.made))
  bad('stats: the seven', sameKeys(farm.stats, STATS))
  for (const [k, n] of Object.entries(farm.stats)) bad(`stats.${k}`, isCount(n))
  // what the farm has got by its work: a count for each good; the goals: a step for each, from 0
  bad('got: each good', sameKeys(farm.got, produceIds) && Object.values(farm.got).every((n) => isCount(n)))
  bad('goals: each goal', sameKeys(farm.goals, GOAL_IDS) && Object.values(farm.goals).every((n) => isCount(n, MOST_STEPS)))
  bad('no more in line than its places', inLine().length <= placesInLine())
  for (const v of farm.visitors) {
    const colours = [v.look.shirt, v.look.trousers, v.look.skin, v.look.hair].every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
    // a whole look, as the people engine reads one back (src/models/look.ts)
    bad(`buyer ${v.id}: a look`, sorted(sanitizeLook(v.look)) === sorted(v.look))
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
  // levels: every point gained, whole; the level paid for from 1 up to the one reached
  const xp = farm.xp
  // (every level reached paid: its coins come in by themselves)
  bad('xp', sameKeys(xp, ['points', 'paid']) && isCount(xp.points) && xp.paid === levelOf(xp.points))
  // the clothes: a garment of its slot for each, one the level has (a hat, or none); the new marks never past the level
  const o = farm.outfit
  const level = levelOf(xp.points)
  const wears = (id: unknown, slot: string) => typeof id === 'string' && garmentById(id)?.slot === slot && garmentById(id)!.level <= level
  bad('outfit', sameKeys(o, ['shirt', 'trousers', 'hat', 'seen']) && wears(o.shirt, 'shirt') && wears(o.trousers, 'trousers') && (o.hat === null || wears(o.hat, 'hat')))
  bad('outfit.seen', Number.isInteger(o.seen) && o.seen >= 1 && o.seen <= level)
  // the level's gifts: no box opened past those the XP reached, those out of turn past the ones in turn (each once, in
  // order); what the level's boxes gave only for its own boxes opened; the levels reached up to this one, each once;
  // what the card told up to this level
  const g = farm.gifts
  const reached = boxesReached(xp.points)
  const isPrize = (p: unknown) => {
    const x = p as Record<string, unknown>
    return (sameKeys(x, ['coins']) && isCount(x.coins) && (x.coins as number) >= 1) || (sameKeys(x, ['item', 'n']) && produceIds.includes(x.item as string) && isCount(x.n, 99) && (x.n as number) >= 1)
  }
  const done = (k: number) => k < g.open || g.also.includes(k)
  bad('gifts', sameKeys(g, ['open', 'also', 'gave', 'came', 'seen']) && isCount(g.open, reached))
  bad('gifts.also', g.also.every((k, i) => isCount(k) && k > g.open && k < reached && (i === 0 || k > g.also[i - 1])) && !g.also.includes(g.open))
  bad('gifts.gave', g.gave.every((e) => sameKeys(e, ['box', 'prize']) && isPrize(e.prize) && done(e.box) && Math.floor(e.box / PER_LEVEL) + 1 === level) && unique(g.gave.map((e) => e.box)))
  bad(
    'gifts.came',
    g.came.length <= CAME_KEPT &&
      g.came.every((e) => sameKeys(e, ['level', 'coins', 'prize']) && isCount(e.coins) && isPrize(e.prize) && isCount(e.level, level) && e.level >= 2) &&
      unique(g.came.map((e) => e.level)),
  )
  bad('gifts.seen', Number.isInteger(g.seen) && g.seen >= 1 && g.seen <= level)
  // the daily gift: the last day claimed (or none), a streak only once one was, the day it last opened by itself; the
  // week's days taken, never more than the streak's place in its week, each what it gave (one prize, or the big one's
  // three)
  const dl = farm.daily
  const day = (v: unknown) => Number.isInteger(v) && (v as number) >= -1
  bad('daily', sameKeys(dl, ['last', 'streak', 'offered', 'week']) && day(dl.last) && day(dl.offered) && isCount(dl.streak) && (dl.last >= 0 || dl.streak === 0))
  bad('daily.week', dl.week.length <= (dl.streak ? ((dl.streak - 1) % 7) + 1 : 0) && dl.week.every((d) => Array.isArray(d) && d.length <= 3 && d.every(isPrize)))
  // the ladders: a step count each, to its top; the shop's own none until the shop is yours; a tool's upgrades none
  // without the tool
  const l = farm.ladders
  bad('ladders: each ladder', sameKeys(l, LADDER_IDS))
  for (const id of LADDER_IDS) {
    const need = LADDERS[id].needs?.ladder
    bad(`ladders.${id}`, isCount(l[id], LADDERS[id].levels) && (farm.market.owned || !SHOP_LADDERS.includes(id) || l[id] === 0) && (!need || l[need] >= LADDERS[need].levels || l[id] === 0))
  }
  // the shop: ten places, those not open empty; an open place a good that sells (kept when sold out) or none, its units
  // up to a place's, its price in range on its step; the till and the countdown; a shop not yours holds nothing
  const m = farm.market
  bad('market', sameKeys(m, ['owned', 'shelves', 'till', 'nextIn']) && typeof m.owned === 'boolean' && m.shelves.length === MAX_PLACES)
  const open = m.owned ? placesOpen(l.places) : 0
  m.shelves.forEach((sh, k) => {
    const { min, max, step } = SHOP.pct
    bad(`market.shelves.${k}: its fields`, sameKeys(sh, ['good', 'units', 'pct']))
    bad(`market.shelves.${k}.good`, sh.good === null || (sellable.includes(sh.good) && k < open))
    bad(`market.shelves.${k}.units`, isCount(sh.units, SHOP.units) && (sh.units === 0 || sh.good !== null))
    bad(`market.shelves.${k}.pct`, isWithin(sh.pct, min, max) && Number.isInteger((sh.pct - min) / step))
  })
  bad('market.till', sameKeys(m.till, ['coins', 'goods']) && isCount(m.till.coins) && isCount(m.till.goods) && (m.owned || (m.till.coins === 0 && m.till.goods === 0)))
  bad('market.nextIn', isWithin(m.nextIn, 0, shopperEvery(l.pace)))
  // the contractor: the day his pieces are for, no more than a day has, each a building material bought or not
  const c = farm.contractor
  bad('contractor', sameKeys(c, ['day', 'offers']) && Number.isInteger(c.day) && c.offers.length <= offersPerDay(l.stock))
  c.offers.forEach((o, k) => bad(`contractor.offers.${k}`, sameKeys(o, ['item', 'sold']) && (ITEMS as string[]).includes(o.item) && typeof o.sold === 'boolean'))
  // the day: seconds of farm time, from 0
  bad('day', sameKeys(farm.day, ['t']) && isWithin(farm.day.t, 0, Number.MAX_VALUE))
  // the week's events: a lucky draw of one or two different goods buyers buy, on a date, or none; the events the news
  // has shown, each once, the last few
  const e = farm.events
  const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  bad('events', sameKeys(e, ['draw', 'seen']))
  bad(
    'events.draw',
    e.draw === null ||
      (sameKeys(e.draw, ['day', 'goods']) &&
        date(e.draw.day) &&
        e.draw.goods.length >= 1 &&
        e.draw.goods.length <= LUCKY_GOODS &&
        unique(e.draw.goods) &&
        e.draw.goods.every((g) => sellable.includes(g))),
  )
  bad('events.seen', e.seen.length <= SEEN_KEPT && unique(e.seen) && e.seen.every((k) => typeof k === 'string' && EVENT_IDS.includes(k.split('@')[0] as never) && date(k.split('@')[1])))
  // the first steps: the step it is on, from the first to past the last, and whether they are over
  bad('firstSteps', sameKeys(farm.firstSteps, ['step', 'over']) && isCount(farm.firstSteps.step, FIRST_STEPS.length) && typeof farm.firstSteps.over === 'boolean')
  return out
}

/** What breaks a rule of where things stand: the farm's places, the land, the furniture (nothing: an empty list). */
function placeProblems(): string[] {
  const out: string[] = []
  const bad = (what: string, ok: boolean) => {
    if (!ok) out.push(what)
  }
  const { places, land, beds, decor } = farm.layout
  bad('layout: every place', sameKeys(places, PLACE_IDS))
  for (const id of PLACE_IDS) bad(`layout.places.${id} fits`, [0, 1, 2, 3].includes(places[id].rot) && canPlace(farm.layout, id, places[id]).ok)
  // every bed where it fits; one not built where it was staked out
  bad('layout.beds: one for each bed', beds.length === BEDS.length)
  beds.forEach((p, i) => {
    bad(`layout.beds.${i} fits`, [0, 1, 2, 3].includes(p.rot) && canPlaceBed(farm.layout, i, p).ok)
    if (!farm.beds[i].built) bad(`layout.beds.${i}: not built, where it was staked out`, json(p) === json(bedHome(i)))
  })
  // each piece of decoration a kind of the shop's, with an id of its own, where it fits; the store a count of each kind,
  // no kind owning more than its most
  bad('layout.decor: ids once each, under the next', unique(decor.map((d) => d.id)) && decor.every((d) => Number.isSafeInteger(d.id) && d.id >= 1 && d.id < farm.layout.next))
  for (const d of decor)
    bad(
      `layout.decor.${d.id} fits`,
      isShopKind(d.kind) && sameKeys(d, ['id', 'kind', 'x', 'z', 'rot']) && [0, 1, 2, 3].includes(d.rot) && canPlaceThing(farm.layout, { kind: 'decor', id: d.id }, d).ok,
    )
  bad('layout.stored: a count of each kind', sameKeys(farm.layout.stored, Object.keys(FARM_SHOP)))
  for (const [kind, n] of Object.entries(farm.layout.stored)) bad(`layout.stored.${kind}`, isCount(n) && n + decor.filter((d) => d.kind === kind).length <= mostOf(kind as ShopKind))
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
  // blocking the way is the player's choice (a word, never a refusal): nothing about reach here
  // the shell: every opening on a wall it may be on, apart from the rest, the garden door open; known paints and floors
  const { shell } = farm.home
  bad(
    'home.shell: every opening',
    sameKeys(
      shell.openings,
      OPENINGS.map((o) => o.id),
    ),
  )
  for (const o of OPENINGS) bad(`home.shell.openings.${o.id} fits`, !!shell.openings[o.id] && openingProblem(shell, o.id, shell.openings[o.id]) === null)
  for (const room of Object.keys(ROOMS) as RoomId[]) {
    bad(`home.shell.paint.${room}: a paint or as built`, shell.paint[room] === null || !!paintById(shell.paint[room]))
    bad(`home.shell.floors.${room}: a floor`, !!floorById(shell.floors[room]))
  }
  // each screen on a wall of its own room
  for (const d of built.values())
    if (PIECES[d.type].keep)
      bad(
        `home: the ${d.id} hangs`,
        pieces.some((p) => p.id === d.id && pieceRoom(p) === pieceRoom(d)),
      )
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
  if (['layout', 'home.pieces', 'home.stored', 'home.next', 'home.shell'].some((n) => json(parts.get(n)) !== json(base.parts.get(n)))) expect(placeProblems(), 'as loaded').toEqual([])
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
  // the day's gift, whatever the save said: once today at most
  claimDaily()
  expect(claimDaily(), 'the daily gift twice in a day').toBeNull()
  expect(farmProblems(), 'the daily gift claimed').toEqual([])
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

  it(
    'a save from before the curve was marked (its XP on the first one): the same level and share, what was paid, the boxes opened and the clothes kept',
    () => {
      const base = baseNamed('played').save
      /** The first curve (LEVELS.step 15), worked out here: where level L began, and the level of some points. */
      const firstAt = (level: number) => (FIRST_STEP * level * (level - 1)) / 2
      const firstLevel = (p: number) => {
        let level = 1
        while (level < LEVELS.max && firstAt(level + 1) <= p) level++
        return level
      }
      fc.assert(
        fc.property(fc.integer({ min: 0, max: firstAt(LEVELS.max) + 10_000 }), (points) => {
          const level = firstLevel(points)
          const top = level >= LEVELS.max
          const into = points - firstAt(level)
          const need = firstAt(level + 1) - firstAt(level)
          // every box it had reached opened, its level's garment (or the last before it) worn
          const open = top ? BOX_COUNT : boxAt(level, 0) + Math.min(PER_LEVEL - 1, Math.floor((PER_LEVEL * into) / need))
          const shirt = garmentsAt(level)
            .filter((g) => g.slot === 'shirt')
            .pop()!.id
          const outfit = { ...(base.outfit as object), shirt, seen: level }
          const save = { ...base, xp: { points, paid: level }, gifts: { open, also: [], gave: [], came: [], seen: level }, outfit }
          loadedParts(toJson(save))
          expect(farmProblems(), 'as loaded').toEqual([])
          const now = levelProgress(farm.xp.points)
          expect(now.level).toBe(level)
          if (!top) expect(now.into / now.need).toBeGreaterThanOrEqual(into / need)
          expect([farm.xp.paid, farm.coins, farm.gifts.open, giftsWaiting(), farm.outfit]).toEqual([level, base.coins, open, [], outfit])
        }),
        { numRuns: Math.ceil(RUNS / 4) },
      )
    },
    TIME,
  )
})
