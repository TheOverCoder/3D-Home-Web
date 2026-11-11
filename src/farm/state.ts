import { create } from 'zustand'
import { farmSound, placeSound } from '../audio/sound'
import { coinsFx, itemFx, xpFx } from '../fx/fx'
import { dampAngle } from '../lib/damp'
import { groundDistance } from '../lib/interaction'
import { useHome } from '../store'
import {
  BEDS,
  BED_BOX,
  BED_REACH,
  CROPS,
  EXPANSIONS,
  GATE_SPOT,
  ITEM_ODDS,
  LANE_ENDS,
  MACHINES,
  MACHINE_IDS,
  NAMES,
  OFFICE_SCREEN,
  OFFICE_UPGRADES,
  PACE_LEVELS,
  PRODUCE,
  PRODUCERS,
  PRODUCER_IDS,
  QUEUE_LEVELS,
  SELLABLE,
  SLOT_LEVELS,
  START_COINS,
  STORES,
  STORE_IDS,
  TRACTOR,
  UPGRADES,
  VISITOR,
  WAIT_LEVELS,
  WALK_Z,
  WATER_SHARE,
  arrivalEvery,
  count,
  cropById,
  isItem,
  mostAnimals,
  orderSlots,
  orderWait,
  produceById,
  queuePlaces,
  queueSpot,
  storeCapacity,
  storeOf,
  type CropId,
  type Expansion,
  type ItemId,
  type MachineId,
  type OfficeUpgradeId,
  type ProduceId,
  type ProducerId,
  type Recipe,
  type StoreId,
  type UpgradeId,
  LADDERS,
  CONTRACTOR,
  DAY,
  MANAGER,
  SHOP,
  XP_FOR,
  type LadderId,
  type XpAction,
} from './data'
import { sanitizeXp, seedXp, levelOf, xpAt, unpaidCoins, xpForSale, type Xp } from './xp'
import { SHOP_LADDERS, clampLevels, freshMarket, ladderPrice, managerPay, managerPct, placesOpen, rollShopper, sanitizeMarket, shopperEvery, shoppersAtOnce, snapPct, type Market } from './market'
import { dailyOffers, offersPerDay, piecePrice, sanitizeContractor, shortMaterials, type Contractor } from './contractor'
import { dayOf, hourOf, isOpen, phaseOf } from './day'
import type { PersonLook } from '../models/person'
import { CONTRACTOR_LOOK, MANAGER_LOOK, rollLook, sanitizeLook } from '../models/look'
import { BROWSE_SPOTS, CONTRACTOR_SPOT, MANAGER_SPOT, SCREEN, TILL } from '../data/market'
import { contractorComes, contractorLeaves, laneEnd, managerLeaves, scriptSeconds, secondsLeft, shopperIn, shopperOut, shopperPay, stepScript, walker, type Pose, type Walker } from './script'
import { isComplete, makeOrder, orderKey, orderPay, cratesFor, type Order, type OrderLine, type OrderSlot } from './orders'
import { bringsSurprise, canUpgrade, nextLevel, randomItem, roomIn, rollItems, usedIn } from './storage'
import { GOALS, GOAL_IDS, MOST_STEPS, goalById, goalReward, goalTarget, startStep, type GoalId } from './goals'
import { tripSeconds } from './tractorRoute'
import { PARCELS, PLACES, boundary, canBuyParcel, canPlace, defaultLayout, sanitizeLayout, snap, type FarmLayout, type Fit, type ParcelId, type PlaceId, type Placement } from './layout'
import { PIECES, type PieceType } from '../home/catalogue'
import { canPlacePiece, defaultHome, findFreeSpot, sanitizeHome, type HomeLayout, type HomePiece } from '../home/layout'

// The farm runs on a plain object that the scene reads every frame (growth, water, people walking), so nothing
// re-renders 60 times a second. Anything the interface shows changes in steps — planted, thirsty, ripe, sold —
// and each step bumps `useFarm`'s revision so the panels and the HUD redraw.

export interface BedState {
  built: boolean
  crop: CropId | null
  growth: number // seconds grown so far
  water: number // seconds of water left in the soil
  /** set from the bed's gear: this bed always grows this crop (the action button buys the seeds and plants it);
   *  null: you choose the seeds each time */
  fixed: CropId | null
}

/** How someone looks (src/models/look.ts, PersonLook), as it is saved: its colours as text. */
export type Look = PersonLook & { shirt: string; trousers: string; skin: string; hair: string }
/** A look rolled or read back: always with its colours as text (the table's, or a saved look's checked ones). */
const asLook = (look: PersonLook) => look as Look

export interface Visitor {
  id: number
  name: string
  /** how they look (src/models/look.ts): rolled on the farm's dice, saved as its traits */
  look: Look
  want: ProduceId
  qty: number
  offer: number
  phase: 'arriving' | 'queued' | 'leaving' // walking up the lane to their place, in the line, going home
  path: { x: number; z: number }[] // the way home
  leg: number
  x: number
  z: number
  heading: number
  moving: boolean
  mood: 'neutral' | 'happy' | 'sad'
  moodAt: number // farm clock when the mood changed (the scene plays a little reaction)
  departAt: number // farm clock when they set off home (a moment to react first)
  /** comes with a surprise (a building material), given as you sell to them: shown on their bubble */
  gift: boolean
}

/** A producer (PRODUCERS in src/farm/data.ts): what waits to be collected and the seconds towards the next one — one
 *  of each for the tree and the nest, one for each animal of a herd where each gives her own (each cow's milk). */
export interface ProducerState {
  /** how many animals (none for the tree) */
  animals: number
  stock: number[]
  timer: number[]
}

/** A machine (MACHINES in src/farm/data.ts): working on `count` batches of `recipe` (`progress` seconds in), or done
 *  with `ready` of what it makes waiting to be taken out; idle, no recipe. */
export interface MachineState {
  recipe: string | null
  count: number
  progress: number
  ready: number
}

export interface FarmData {
  coins: number
  /** every good the farm has, wherever it is kept: the silo takes what grows, the barn the rest (`storage`) */
  inv: Record<ProduceId, number>
  /** the silo's and the barn's levels: each holds 50 goods a level (src/farm/data.ts, STORES) */
  storage: Record<StoreId, number>
  beds: BedState[]
  /** the lemon tree, the hens' nest, the cows, the sheep */
  producers: Record<ProducerId, ProducerState>
  /** the mill, the loom, the oven */
  machines: Record<MachineId, MachineState>
  sprinkler: boolean
  compost: boolean
  expansions: Record<Expansion, boolean>
  queueLevel: number // places in the line beyond the first five
  paceLevel: number // how much sooner the next buyer comes
  started: boolean // the player has planted something: from then on buyers come by
  planted: CropId[] // kinds ever planted: buyers ask for what you grow
  made: ProduceId[] // everything the farm has ever produced: buyers ask for that too
  stats: { harvested: number; sold: number; earned: number; declined: number; baked: number; sent: number }
  /** every good the farm has got by its work: harvested, collected, made, found as a surprise (the goals count it) */
  got: Record<ProduceId, number>
  /** the goals board: the step each goal is on (src/farm/goals.ts) */
  goals: Record<GoalId, number>
  visitors: Visitor[]
  /** where the movable places stand, and the fields bought (src/farm/layout.ts) */
  layout: FarmLayout
  /** where the house's furniture stands, and what is in storage (src/home/layout.ts) */
  home: HomeLayout
  nextVisitorIn: number // counts down to the next buyer (it holds at zero while the line is full)
  /** the order board on the office's computer: each place an order, or the seconds until a new one comes */
  orders: OrderSlot[]
  /** the office's upgrades: places on the board beyond the first three, and minutes off the wait for a new order */
  office: { slots: number; wait: number }
  /** the crates of the orders sent: on the pallet, on the tractor, and its trip (seconds into it; -1 at home) */
  dispatch: { waiting: number; aboard: number; trip: number }
  clock: number // seconds of farm time since the page opened
  /** levels (src/farm/xp.ts): every XP point gained, and the highest level whose coins were claimed */
  xp: Xp
  /** every upgrade ladder's step (LADDERS in ./data): the market's and the contractor's */
  ladders: Record<LadderId, number>
  /** the supermarket (src/farm/market.ts): yours or not, its shelves, the till, the next visit */
  market: Market
  /** the contractor behind the market (src/farm/contractor.ts): the day his offers are for, and the offers */
  contractor: Contractor
  /** the farm's day (src/farm/day.ts): seconds of farm time since the farm began (it goes on while you are away) */
  day: { t: number }
}

// Three save slots ("farms"). The first keeps the original key, so saves from before slots load unchanged.
export const SLOTS = [1, 2, 3] as const
export type Slot = (typeof SLOTS)[number]
const SLOT_KEY = '3d-home:slot:v1'
const keyFor = (slot: number) => (slot === 1 ? '3d-home:farm:v1' : `3d-home:farm:v1:slot${slot}`)
function savedSlot(): Slot {
  try {
    const n = Number(localStorage.getItem(SLOT_KEY))
    return (SLOTS as readonly number[]).includes(n) ? (n as Slot) : 1
  } catch {
    return 1
  }
}
let slot: Slot = savedSlot()
let KEY = keyFor(slot)
export const currentSlot = () => slot
const produceIds = PRODUCE.map((p) => p.id)
const emptyInv = () => Object.fromEntries(produceIds.map((id) => [id, 0])) as Record<ProduceId, number>
/** Each of a herd's animals gives her own (a count and a clock for each), or they share one (the hens' nest). */
const ownEach = (id: ProducerId) => {
  const herd = PRODUCERS[id].herd
  return !!herd && !herd.shared
}
/** How many counts a producer keeps, with this many animals. */
const stocksFor = (id: ProducerId, animals: number) => (ownEach(id) ? animals : 1)
function freshProducer(id: ProducerId): ProducerState {
  const animals = PRODUCERS[id].herd?.start ?? 0
  const n = stocksFor(id, animals)
  return { animals, stock: Array.from({ length: n }, () => PRODUCERS[id].fresh), timer: Array.from({ length: n }, () => 0) }
}
const freshMachine = (): MachineState => ({ recipe: null, count: 0, progress: 0, ready: 0 })

/** A board of empty places: a new order comes in each straight away. */
const emptyBoard = (n: number): OrderSlot[] => Array.from({ length: n }, () => ({ wait: 0 }))

function fresh(): FarmData {
  return {
    coins: START_COINS,
    inv: emptyInv(),
    storage: { silo: 1, barn: 1 },
    beds: BEDS.map((b) => ({ built: b.price === 0 && !b.expansion, crop: null, growth: 0, water: 0, fixed: null })),
    producers: Object.fromEntries(PRODUCER_IDS.map((id) => [id, freshProducer(id)])) as Record<ProducerId, ProducerState>,
    machines: Object.fromEntries(MACHINE_IDS.map((id) => [id, freshMachine()])) as Record<MachineId, MachineState>,
    sprinkler: false,
    compost: false,
    expansions: { east: false, west: false },
    queueLevel: 0,
    paceLevel: 0,
    started: false,
    planted: [],
    made: [],
    stats: { harvested: 0, sold: 0, earned: 0, declined: 0, baked: 0, sent: 0 },
    got: emptyInv(),
    goals: Object.fromEntries(GOAL_IDS.map((id) => [id, 0])) as Record<GoalId, number>,
    visitors: [],
    layout: defaultLayout(),
    home: defaultHome(),
    nextVisitorIn: VISITOR.firstAfter,
    orders: emptyBoard(orderSlots(0)),
    office: { slots: 0, wait: 0 },
    dispatch: { waiting: 0, aboard: 0, trip: -1 },
    clock: 0,
    xp: { points: 0, paid: 1 },
    ladders: clampLevels({}),
    market: freshMarket(),
    contractor: { day: -1, offers: [] },
    day: { t: 0 },
  }
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const int = (v: unknown, d: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(num(v, d))))
/** A count as saved (coins, goods, stats): a whole number from 0, up to the last one that still counts (past 2^53, one
 *  more is the same number). */
const amount = (v: unknown, d: number) => int(v, d, 0, Number.MAX_SAFE_INTEGER)
/** Seconds as saved, from 0 up to `most`: what a crop has grown, the water in its soil, a machine's job done. */
const span = (v: unknown, most: number) => Math.min(most, Math.max(0, num(v, 0)))
/** A clock as saved, counting towards the next one: from 0 to under its period, as the game leaves it; anything else
 *  starts again. (Growing takes the period off until the clock is under it: from 1e20, minus 40 is 1e20, never.) */
const clock = (v: unknown, every: number) => {
  const t = num(v, 0)
  return t > 0 && t < every ? t : 0
}
const isProduce = (v: unknown): v is ProduceId => produceIds.includes(v as ProduceId)
/** A good buyers and orders ask for (not a building material). */
const isSellable = (v: unknown): v is ProduceId => SELLABLE.includes(v as ProduceId)
const isCrop = (v: unknown): v is CropId => CROPS.some((c) => c.id === v)
/** The water a crop's seeds go in with, and a watering gives: this share of its growing time. */
const fullWater = (crop: CropId) => cropById(crop).growSeconds * WATER_SHARE

/** A buyer in the line, as saved: who they are, what they want, and whether they bring a surprise. */
interface SavedBuyer {
  name: string
  look: Look
  want: ProduceId
  qty: number
  offer: number
  gift: boolean
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
/** A field of a saved object, or an item of a saved list (anything else: nothing). */
const field = (v: unknown, k: string | number) => (isObject(v) ? v[k] : undefined)

/** Where a save from before the tables in src/farm/data.ts kept what each producer held: a field of its own for the
 *  count and one for the clock (a list of each for the cows and the sheep), and one for how many animals. */
const OLD_PRODUCERS: Record<ProducerId, { stock: string; timer: string; animals?: string }> = {
  tree: { stock: 'lemons', timer: 'lemonTimer' },
  hens: { stock: 'eggs', timer: 'eggTimer', animals: 'hens' },
  cows: { stock: 'milk', timer: 'milkTimer', animals: 'cows' },
  sheep: { stock: 'wool', timer: 'woolTimer', animals: 'sheep' },
}

/** A producer as saved (or as a save from before the tables kept it), made safe. */
function savedProducer(id: ProducerId, raw: Record<string, unknown>): ProducerState {
  const def = PRODUCERS[id]
  const old = OLD_PRODUCERS[id]
  const saved = field(raw.producers, id)
  const p = isObject(saved)
    ? saved
    : { animals: old.animals ? raw[old.animals] : undefined, stock: ownEach(id) ? raw[old.stock] : [raw[old.stock]], timer: ownEach(id) ? raw[old.timer] : [raw[old.timer]] }
  const animals = def.herd ? int(p.animals, def.herd.start, def.herd.start, def.herd.max) : 0
  const n = stocksFor(id, animals)
  return {
    animals,
    stock: Array.from({ length: n }, (_, i) => int(field(p.stock, i), def.fresh, 0, def.max)),
    timer: Array.from({ length: n }, (_, i) => clock(field(p.timer, i), def.every)),
  }
}

/** A machine's job as a save from before the tables kept it: the mill by what goes in and what comes out, the oven by
 *  the cake, the loom by its counts. One at work goes on (anything it also had waiting was not kept then either). */
function oldMachine(id: MachineId, raw: Record<string, unknown>): Record<string, unknown> {
  const m = raw[id]
  if (!isObject(m)) return {}
  const recipes = MACHINES[id].recipes
  const recipe = (v: unknown) => recipes.find((r) => r.id === v)?.id
  const making = (v: unknown) => recipes.find((r) => r.makes === v)?.id
  if (id === 'mill') return recipe(m.input) ? { recipe: m.input, count: m.count, progress: m.progress } : { recipe: making(m.output), ready: m.ready }
  if (id === 'oven') return recipe(m.baking) ? { recipe: m.baking, count: 1, progress: m.progress } : { recipe: recipe(m.ready), ready: 1 }
  return { recipe: recipes[0].id, count: m.count, progress: m.progress, ready: m.ready }
}

/** A machine as saved (or as a save from before the tables kept it), made safe: at work, done, or idle. */
function savedMachine(id: MachineId, raw: Record<string, unknown>): MachineState {
  const def = MACHINES[id]
  const saved = field(raw.machines, id)
  const m = isObject(saved) ? saved : oldMachine(id, raw)
  const recipe = def.recipes.find((r) => r.id === m.recipe)
  if (!recipe) return freshMachine()
  const n = int(m.count, 0, 0, def.capacity)
  if (n) return { recipe: recipe.id, count: n, progress: span(m.progress, n * recipe.seconds), ready: 0 }
  const ready = int(m.ready, 0, 0, def.capacity)
  return ready ? { recipe: recipe.id, count: 0, progress: 0, ready } : freshMachine()
}

function savedBuyer(raw: unknown): SavedBuyer | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<SavedBuyer>
  // a look as saved, made safe (an older save's look loads as it was); one that is not a look: no buyer
  const look = sanitizeLook(b.look)
  if (!isSellable(b.want) || !look) return null
  return {
    name: typeof b.name === 'string' && b.name.length <= 24 ? b.name : NAMES[0],
    look: asLook(look),
    want: b.want,
    qty: int(b.qty, 1, 1, 12),
    offer: int(b.offer, 1, 1, 999),
    gift: b.gift === true,
  }
}

/** The most a building's level can be read as (there is no end to them in play; a number past this is no level). */
const MOST_LEVEL = 1e6
/** The most crates that wait on the pallet. */
const MOST_CRATES = 999

/** An order as saved, made safe: the goods it asks for (each once, none a building material), how many of each have
 *  been put in (never more than it wants), what it pays; an order of nothing is no order (a new one comes). */
function savedOrder(raw: unknown): Order | null {
  const lines: unknown[] = isObject(raw) && Array.isArray(raw.lines) ? raw.lines : []
  const out: OrderLine[] = []
  for (const l of lines.slice(0, 9)) {
    if (!isObject(l) || !isSellable(l.good) || out.some((o) => o.good === l.good)) continue
    const want = int(l.want, 1, 1, 99)
    out.push({ good: l.good, want, have: int(l.have, 0, 0, want) })
  }
  if (!out.length) return null
  return { id: orderKey(), lines: out, coins: int(field(raw, 'coins'), orderPay(out), 1, 99_999), surprise: field(raw, 'surprise') === true }
}

/** A place on the order board as saved: its order, or the seconds until a new one comes (never longer than the wait). */
function savedPlace(raw: unknown, wait: number): OrderSlot {
  const order = savedOrder(raw)
  if (order) return { order }
  return { wait: span(field(raw, 'wait'), wait) }
}

/** Where the tractor's track crosses the farm's west edge (the gate in the hedge): the garden's own, or the west
 *  meadow's once it is bought. */
export function gateX(layout: FarmLayout = farm.layout): number {
  const key = layout.land.join(',')
  if (gateCache?.key === key) return gateCache.x
  const edge = boundary(layout).find((e) => e.axis === 'z' && e.out === 'west' && e.from <= TRACTOR.z && e.to >= TRACTOR.z && e.at < 0)
  gateCache = { key, x: edge?.at ?? -14 }
  return gateCache.x
}
let gateCache: { key: string; x: number } | null = null

/** The saved farm, made safe (a hand-edited or old save can never break the game), plus the time it was saved. */
function load(text: string | null = readRaw(KEY)): { data: FarmData; savedAt: number | null; queue: SavedBuyer[] } {
  const data = fresh()
  try {
    const raw = JSON.parse(text ?? 'null') as Partial<FarmData> & { time?: number; queue?: unknown[] }
    if (!raw || typeof raw !== 'object') return { data, savedAt: null, queue: [] }
    data.coins = amount(raw.coins, START_COINS)
    for (const id of produceIds) data.inv[id] = amount(field(raw.inv, id), 0)
    // the silo and the barn from level 1 (a farm from before them keeps all it has, even past what they hold)
    for (const id of STORE_IDS) data.storage[id] = int(field(raw.storage, id), 1, 1, MOST_LEVEL)
    data.expansions = { east: !!raw.expansions?.east, west: !!raw.expansions?.west }
    // the beds, read only from a list: on anything else a list method threw half-way, and everything read after the
    // beds came back as on a new farm (and was saved over the farm)
    const beds: unknown[] = Array.isArray(raw.beds) ? raw.beds : []
    BEDS.forEach((def, i) => {
      const b = beds[i]
      if (!isObject(b)) return
      const present = !def.expansion || data.expansions[def.expansion]
      const built = present && (data.beds[i].built || !!b.built || !!def.expansion)
      // a bed not built grows nothing; what grows is never past ripe, nor wetter than a soak
      const crop = built && isCrop(b.crop) ? b.crop : null
      data.beds[i] = {
        built,
        crop,
        growth: crop ? span(b.growth, cropById(crop).growSeconds) : 0,
        water: crop ? span(b.water, fullWater(crop)) : 0,
        fixed: isCrop(b.fixed) ? b.fixed : null,
      }
    })
    BEDS.forEach((def, i) => {
      if (def.expansion && data.expansions[def.expansion]) data.beds[i].built = true
    })
    // the tree, the nest, the animals and the machines (a save from before the tables kept each in fields of its own)
    for (const id of PRODUCER_IDS) data.producers[id] = savedProducer(id, raw)
    for (const id of MACHINE_IDS) data.machines[id] = savedMachine(id, raw)
    data.queueLevel = int(raw.queueLevel, 0, 0, QUEUE_LEVELS)
    data.paceLevel = int(raw.paceLevel, 0, 0, PACE_LEVELS)
    data.nextVisitorIn = Math.min(arrivalEvery(data.paceLevel), Math.max(0, num(raw.nextVisitorIn, VISITOR.firstAfter)))
    data.sprinkler = !!raw.sprinkler
    data.compost = !!raw.compost
    data.started = !!raw.started
    data.planted = Array.isArray(raw.planted) ? [...new Set(raw.planted.filter(isCrop))] : []
    data.made = Array.isArray(raw.made) ? [...new Set(raw.made.filter(isProduce))] : []
    // each stat a count, and no others (spread in as saved, a count saved as text made a harvest add "7" + 3 = "73")
    for (const k of Object.keys(data.stats) as (keyof FarmData['stats'])[]) data.stats[k] = amount(field(raw.stats, k), 0)
    for (const id of produceIds) data.got[id] = amount(field(raw.got, id), 0)
    // a farm from before the layout keeps everything where it always stood
    data.layout = sanitizeLayout(raw.layout)
    // a farm from before the house could be furnished keeps today's furniture where it always stood
    data.home = sanitizeHome(raw.home)
    // the order board, as many places as the office has, each an order or a wait (a farm from before the office: a
    // new order in each place straight away); the crates sent, and the tractor's trip
    data.office = { slots: int(field(raw.office, 'slots'), 0, 0, SLOT_LEVELS), wait: int(field(raw.office, 'wait'), 0, 0, WAIT_LEVELS) }
    const board: unknown[] = Array.isArray(raw.orders) ? raw.orders : []
    data.orders = Array.from({ length: orderSlots(data.office.slots) }, (_, k) => savedPlace(board[k], orderWait(data.office.wait)))
    const aboard = int(field(raw.dispatch, 'aboard'), 0, 0, TRACTOR.load)
    data.dispatch = {
      waiting: int(field(raw.dispatch, 'waiting'), 0, 0, MOST_CRATES),
      aboard,
      trip: aboard ? span(field(raw.dispatch, 'trip'), tripSeconds(aboard, gateX(data.layout))) : -1,
    }
    // the goals: each on the step it was saved on; a farm from before them starts each where it is (what it did before
    // is not paid for again)
    for (const def of GOALS) data.goals[def.id] = isObject(raw.goals) ? int(field(raw.goals, def.id), 0, 0, MOST_STEPS) : startStep(def, data)
    // levels: as saved; a farm from before them starts with XP for what it did (its levels are not paid again)
    data.xp = sanitizeXp(raw.xp, seedXp(data.stats))
    // the ladders, the market, the contractor and the day (a farm from before them: as on a new farm)
    // (while the shop is not yours, its own ladders read back as 0: only the manager's rate and the contractor's two)
    data.ladders = clampLevels(raw.ladders, field(raw.market, 'owned') === true)
    data.market = sanitizeMarket(raw.market, data.ladders)
    data.contractor = sanitizeContractor(raw.contractor, offersPerDay(data.ladders.stock))
    data.day = { t: dayClock(field(raw.day, 't')) }
    const queue = (Array.isArray(raw.queue) ? raw.queue : []).map(savedBuyer).filter((b): b is SavedBuyer => !!b)
    return { data, savedAt: num(raw.time, 0) || null, queue: queue.slice(0, queuePlaces(data.queueLevel)) }
  } catch {
    return { data, savedAt: null, queue: [] }
  }
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const loaded = load()
export const farm: FarmData = loaded.data

/** Revision counter: bumped whenever something the interface shows has changed. */
export const useFarm = create<{ rev: number }>(() => ({ rev: 0 }))
const bump = () => useFarm.setState((s) => ({ rev: s.rev + 1 }))

let saveTimer: number | undefined
function saveNow() {
  window.clearTimeout(saveTimer)
  saveTimer = undefined
  try {
    const { visitors, clock: _c, orders: board, ...rest } = farm
    // the line at the gate is kept too: buyers wait for you while you are away
    const queue: SavedBuyer[] = visitors.filter((v) => v.phase !== 'leaving').map(({ name, look, want, qty, offer, gift }) => ({ name, look, want, qty, offer, gift }))
    // the orders without their keys (each gets a new one as the farm loads)
    const orders = board.map((slot) => ('order' in slot ? { lines: slot.order.lines, coins: slot.order.coins, surprise: slot.order.surprise } : slot))
    localStorage.setItem(KEY, JSON.stringify({ ...rest, orders, queue, time: Date.now() }))
  } catch {
    /* storage full or blocked: the farm still works for this visit */
  }
}
const save = () => {
  if (saveTimer === undefined) saveTimer = window.setTimeout(saveNow, 1200)
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow()
  })
}

const toast = (text: string, item?: string) => useHome.getState().showToast(text, item)
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const remember = (id: ProduceId) => {
  if (!farm.made.includes(id) && !isItem(id)) farm.made.push(id)
}

/** The farm's dice for its surprises (and new orders): Math.random, unless a test sets its own. */
let random: () => number = () => Math.random()
/** For the tests: the dice from a function of their own (null: Math.random again). */
export function setRandom(f: (() => number) | null) {
  random = f ?? (() => Math.random())
}

// ───────────────────────────── the silo and the barn ─────────────────────────────

/** A building's level (1: 50 goods). */
export const storeLevel = (id: StoreId) => farm.storage[id]
/** How many goods a building holds at its level. */
export const capacity = (id: StoreId) => storeCapacity(farm.storage[id])
/** How many it holds now. */
export const used = (id: StoreId) => usedIn(farm.inv, id)
/** How many more it takes (none once full). */
export const room = (id: StoreId) => roomIn(farm.inv, farm.storage, id)
/** Room for a good where it is kept. */
export const roomFor = (good: ProduceId) => room(storeOf(good))
/** A building is full. */
export const isFull = (id: StoreId) => room(id) <= 0

/** How many goods wait for room in a building: ripe in the beds and on the lemon tree (the silo); on the animals and
 *  in the machines (the barn). */
export function waitingFor(id: StoreId) {
  let n = 0
  if (id === 'silo') farm.beds.forEach((b, i) => (n += bedStage(i) === 'ripe' && b.crop ? yieldOf(b.crop) : 0))
  for (const p of PRODUCER_IDS) if (storeOf(PRODUCERS[p].good) === id) n += farm.producers[p].stock.reduce((a, b) => a + b, 0)
  if (id === 'barn') for (const m of MACHINE_IDS) n += farm.machines[m].ready
  return n
}

/**
 * Puts goods that were collected into their building, as many as it has room for: how many went in. What does not
 * fit is never thrown away: the caller leaves it where it was (on the animal, in the bed, in the machine).
 */
function store(id: ProduceId, n: number) {
  const k = Math.max(0, Math.min(n, roomFor(id)))
  farm.inv[id] += k
  if (k) remember(id)
  return k
}

/** Puts back goods that were the farm's already (an order declined) or a surprise: always taken in, even past full
 *  (refused, they would be lost). */
function putBack(id: ProduceId, n: number) {
  farm.inv[id] += n
}

/** What the toast says about surprises, after what else it says ("· Surprise: a brick"). */
const surpriseWords = (items: ItemId[]) => (items.length ? ` · Surprise: ${[...new Set(items)].map((i) => count(i, items.filter((x) => x === i).length)).join(', ')}` : '')

/** Surprises into the barn (always: they are what makes it bigger), each flying up from where it was found to the
 *  barn's chip at the top. */
function gainItems(items: ItemId[], at?: { x: number; y: number; z: number }) {
  for (const item of items) {
    putBack(item, 1)
    farm.got[item] += 1
  }
  if (!items.length) return
  if (at) items.forEach((item, k) => itemFx(at.x, at.y, at.z, item, k))
  farmSound('surprise')
}

/** The next level of a building: as many of each of its three materials as its level now, for 50 more goods. */
export const nextStoreLevel = (id: StoreId) => nextLevel(id, farm.storage[id])
export const canUpgradeStore = (id: StoreId) => canUpgrade(farm.inv, id, farm.storage[id])

/** Makes a building bigger with its materials (its card asked first): true when it was. */
export function upgradeStore(id: StoreId) {
  if (!canUpgradeStore(id)) return false
  const next = nextStoreLevel(id)
  for (const n of next.needs) farm.inv[n.item] -= n.count
  farm.storage[id] = next.level
  const place = farm.layout.places[STORES[id].place]
  gainXp('build', 1, { x: place.x, y: 3, z: place.z })
  toast(`${STORES[id].name}: level ${next.level} · room for ${next.capacity}`)
  bump()
  save()
  return true
}

// ───────────────────────────── beds ─────────────────────────────

export type BedStage = 'unbought' | 'locked' | 'empty' | 'thirsty' | 'growing' | 'ripe'

export function bedStage(i: number): BedStage {
  const b = farm.beds[i]
  const def = BEDS[i]
  if (def.expansion && !farm.expansions[def.expansion]) return 'unbought'
  if (!b.built) return 'locked'
  if (!b.crop) return 'empty'
  if (b.growth >= cropById(b.crop).growSeconds) return 'ripe'
  if (!farm.sprinkler && b.water <= 0) return 'thirsty'
  return 'growing'
}

/** The beds within reach of (x, z) at `stage`, the given one first: one press harvests, waters or plants them all.
 *  Within reach as the action button measures it: from the edge of each bed's frame (BED_REACH). */
export function bedsNear(index: number, stage: BedStage, x: number, z: number): number[] {
  const out = [index]
  BEDS.forEach((b, i) => {
    if (i !== index && bedStage(i) === stage && groundDistance(x, z, b, BED_BOX) <= BED_REACH) out.push(i)
  })
  return out
}

/** 0 … 1 */
/** The empty beds near (x, z) that seeds chosen by hand go into: this one, and those within reach not set to grow
 *  something else. */
export const bedsForSeeds = (index: number, crop: CropId, x: number, z: number) => bedsNear(index, 'empty', x, z).filter((i) => i === index || !farm.beds[i].fixed || farm.beds[i].fixed === crop)

export const bedProgress = (i: number) => {
  const b = farm.beds[i]
  return b.crop ? Math.min(1, b.growth / cropById(b.crop).growSeconds) : 0
}

/** Where a bed's crystals (and surprises) fly up from. */
const bedAt = (i: number) => ({ x: BEDS[i].x, y: 0.7, z: BEDS[i].z })

export const yieldOf = (crop: CropId) => Math.round(cropById(crop).yield * (farm.compost ? 1.5 : 1))

export function plant(i: number, crop: CropId) {
  const b = farm.beds[i]
  const def = cropById(crop)
  if (!b?.built || b.crop || farm.coins < def.seedCost) return false
  farm.coins -= def.seedCost
  b.crop = crop
  b.growth = 0
  b.water = fullWater(crop) // seeds go in with a good soak
  farm.started = true
  if (!farm.planted.includes(crop)) farm.planted.push(crop)
  gainXp('plant', 1, bedAt(i))
  bump()
  save()
  return true
}

/** Plants a crop in each of these beds that is empty, as far as the coins go (seeds are bought as they go in):
 *  how many were planted. */
export function plantBeds(beds: number[], crop: CropId) {
  let n = 0
  for (const i of beds) if (plant(i, crop)) n++
  return n
}

export function water(i: number) {
  const b = farm.beds[i]
  if (!b?.crop) return false
  // XP only for a bed that needed it: under half its water
  if (b.water < fullWater(b.crop) / 2) gainXp('water', 1, bedAt(i))
  b.water = fullWater(b.crop)
  bump()
  save()
  return true
}

export function harvest(i: number) {
  return harvestBeds([i])
}

/** The ripe beds near (x, z) one press harvests: this one first, then the others within reach, as many as the silo
 *  has room for (a harvest cannot half stay in its bed: a bed whose crop does not fit waits, ripe). */
export function bedsToHarvest(index: number, x: number, z: number): number[] {
  let left = room('silo')
  return bedsNear(index, 'ripe', x, z).filter((i) => {
    const n = yieldOf(farm.beds[i].crop!)
    if (n > left) return false
    left -= n
    return true
  })
}

/** A ripe bed's harvest fits in the silo. */
export const harvestFits = (i: number) => bedStage(i) === 'ripe' && yieldOf(farm.beds[i].crop!) <= room('silo')

/** Harvests every ripe bed of these (what is within reach, in one go) whose crop the silo has room for: one toast
 *  for all of it. A bed that does not fit stays ripe (the toast says the silo is full). Each bed harvested may turn
 *  up a surprise. */
export function harvestBeds(beds: number[]) {
  const got = new Map<CropId, number>()
  const found: ItemId[] = []
  let total = 0
  let full = false
  for (const i of beds) {
    const b = farm.beds[i]
    if (!b?.crop || bedStage(i) !== 'ripe') continue
    const n = yieldOf(b.crop)
    if (n > room('silo')) {
      full = true
      continue
    }
    store(b.crop, n)
    farm.stats.harvested += n
    farm.got[b.crop] += n
    got.set(b.crop, (got.get(b.crop) ?? 0) + n)
    total += n
    b.crop = null
    b.growth = 0
    b.water = 0
    const items = rollItems(1, ITEM_ODDS.harvest, random)
    gainItems(items, bedAt(i))
    gainXp('harvest', 1, bedAt(i))
    found.push(...items)
  }
  if (!total) {
    if (full) toast('The silo is full', 'silo')
    return 0
  }
  toast(`+ ${[...got].map(([crop, n]) => count(crop, n)).join(', ')}${full ? ' · the silo is full' : ''}${surpriseWords(found)}`, found[0] ?? [...got][0][0])
  bump()
  save()
  return total
}

/** Waters every bed of these that has something growing (what is within reach, in one go). */
export function waterBeds(beds: number[]) {
  let n = 0
  for (const i of beds) if (water(i)) n++
  return n
}

export function buildBed(i: number) {
  const b = farm.beds[i]
  const price = BEDS[i]?.price ?? 0
  if (!b || b.built || BEDS[i]?.expansion || farm.coins < price) return false
  farm.coins -= price
  b.built = true
  gainXp('build', 1, bedAt(i))
  toast('A new bed, ready for seeds')
  bump()
  save()
  return true
}

/** What a bed always grows, set from its gear: the action button then buys those seeds and plants them there
 *  (null: you choose the seeds each time). */
export function fixBed(i: number, crop: CropId | null) {
  const b = farm.beds[i]
  if (!b?.built) return false
  b.fixed = crop
  bump()
  save()
  return true
}

// ───────────────────────────── the tree, the hens, the cows and the sheep ─────────────────────────────

/** How many animals a producer has (the hens, the cows, the sheep). */
export const animals = (id: ProducerId) => farm.producers[id].animals

/** What waits to be collected at a producer (`i`: which animal, where each gives her own). */
export const stockOf = (id: ProducerId, i = 0) => farm.producers[id].stock[i] ?? 0

/** An animal's name, where each has one ("Bella"); otherwise empty. */
export function animalName(id: ProducerId, i: number) {
  const names = PRODUCERS[id].herd?.names
  return names?.length ? names[i % names.length] : ''
}

/** How many of what a producer holds would go in now (as many as its building has room for). */
export const collectable = (id: ProducerId, i = 0) => Math.min(stockOf(id, i), roomFor(PRODUCERS[id].good))

/** Takes what a producer holds into its building — picks the lemons, collects the eggs, milks a cow, shears a sheep —
 *  as much as there is room for, and starts the wait for the next one again once all of it is taken (but the hens':
 *  they lay on). What does not fit stays where it is. Each egg, bottle and fleece (each picking of the tree) may turn
 *  up a surprise, which flies up from `at`. */
export function collect(id: ProducerId, i = 0, at?: { x: number; y: number; z: number }) {
  const def = PRODUCERS[id]
  const p = farm.producers[id]
  const has = p.stock[i] ?? 0
  if (!has) return 0
  const n = store(def.good, has)
  if (!n) {
    toast(`The ${STORES[storeOf(def.good)].name.toLowerCase()} is full`, storeOf(def.good))
    return 0
  }
  p.stock[i] = has - n
  if (!def.keepsClock && !p.stock[i]) p.timer[i] = 0
  farm.stats.harvested += n
  farm.got[def.good] += n
  const items = rollItems(def.surprise === 'each' ? n : 1, def.surprise === 'each' ? ITEM_ODDS.unit : ITEM_ODDS.harvest, random)
  gainItems(items, at)
  gainXp('collect', n, at)
  const left = n < has ? ` · the ${STORES[storeOf(def.good)].name.toLowerCase()} is full` : ''
  toast(`+ ${count(def.good, n)}${left}${surpriseWords(items)}`, items[0] ?? def.good)
  bump()
  save()
  return n
}

/** One more animal (from the shop): she has nothing to give yet. */
function addAnimal(id: ProducerId) {
  const p = farm.producers[id]
  if (p.animals >= (PRODUCERS[id].herd?.max ?? 0)) return
  p.animals++
  if (!ownEach(id)) return
  p.stock.push(0)
  p.timer.push(0)
}

/** How woolly a sheep looks: 0 just shorn … 1 a full fleece twice over. */
export const woolliness = (i: number) => {
  const { every, max } = PRODUCERS.sheep
  const n = stockOf('sheep', i)
  return Math.min(1, (n + (n < max ? (farm.producers.sheep.timer[i] ?? 0) / every : 0)) / max)
}

/** The clock runs on (the hens' as many times as fast as there are of them): one more for every `every` seconds, up
 *  to the most that waits; a fleece that is full stops there, its clock held at 0 until it is shorn. */
function growProducer(id: ProducerId, dt: number) {
  const def = PRODUCERS[id]
  const p = farm.producers[id]
  const rate = def.herd?.shared ? p.animals : 1
  p.stock.forEach((_, i) => {
    if (def.holdsFull && p.stock[i] >= def.max) return
    p.timer[i] += dt * rate
    while (p.timer[i] >= def.every && !(def.holdsFull && p.stock[i] >= def.max)) {
      p.timer[i] -= def.every
      if (p.stock[i] < def.max) p.stock[i]++
    }
    if (def.holdsFull && p.stock[i] >= def.max) p.timer[i] = 0
  })
}

// ───────────────────────────── the mill, the loom and the oven ─────────────────────────────

export type MachineStage = 'idle' | 'working' | 'done'

export const machineStage = (id: MachineId): MachineStage => (farm.machines[id].count > 0 ? 'working' : farm.machines[id].ready > 0 ? 'done' : 'idle')

/** What a machine is working on, or has ready to take out (null while it is idle). */
export const machineRecipe = (id: MachineId): Recipe | null => MACHINES[id].recipes.find((r) => r.id === farm.machines[id].recipe) ?? null

export function machineSecondsLeft(id: MachineId) {
  const m = farm.machines[id]
  const r = machineRecipe(id)
  return m.count && r ? m.count * r.seconds - m.progress : 0
}

/** Where a machine's crystals fly up from: where its sparkles pop. */
const machineAt = (id: MachineId) => {
  const def = MACHINES[id]
  return { x: def.x + def.sparkle[0], y: def.sparkle[1], z: def.z + def.sparkle[2] }
}

/** How many batches of a recipe a machine would take now: as many as it has room for and the basket gives. */
export function batches(id: MachineId, r: Recipe) {
  return Object.entries(r.needs).reduce((n, [k, per]) => (per ? Math.min(n, Math.floor(farm.inv[k as ProduceId] / per)) : n), MACHINES[id].capacity)
}

/** Loads an idle machine with as many batches of a recipe as it takes (the button asked first): how many. */
export function loadMachine(id: MachineId, recipe: string) {
  const r = MACHINES[id].recipes.find((x) => x.id === recipe)
  if (!r || machineStage(id) !== 'idle') return 0
  const n = batches(id, r)
  if (!n) return 0
  for (const [k, per] of Object.entries(r.needs)) farm.inv[k as ProduceId] -= (per ?? 0) * n
  farm.machines[id] = { recipe: r.id, count: n, progress: 0, ready: 0 }
  gainXp('load', 1, machineAt(id))
  bump()
  save()
  return n
}

/** How many of what a machine made would go into the barn now. */
export const machineCollectable = (id: MachineId) => {
  const r = machineRecipe(id)
  return r ? Math.min(farm.machines[id].ready, roomFor(r.makes)) : 0
}

/** Takes out what a machine has made, into the barn, as much as it has room for (the rest waits in the machine): how
 *  many. */
export function collectMachine(id: MachineId) {
  const m = farm.machines[id]
  const r = machineRecipe(id)
  if (!r || !m.ready) return 0
  const n = store(r.makes, m.ready)
  if (!n) {
    toast('The barn is full', 'barn')
    return 0
  }
  const counts = MACHINES[id].counts
  if (counts) farm.stats[counts] += n
  farm.got[r.makes] += n
  if (n < m.ready) farm.machines[id] = { ...m, ready: m.ready - n }
  else farm.machines[id] = freshMachine()
  gainXp('make', n, machineAt(id))
  toast(`+ ${count(r.makes, n)}${farm.machines[id].ready ? ' · the barn is full' : ''}`, r.makes)
  bump()
  save()
  return n
}

/** Works on: once the batches' time is up, what they make waits to be taken out. */
function growMachine(id: MachineId, dt: number) {
  const m = farm.machines[id]
  const r = machineRecipe(id)
  if (!m.count || !r) return
  m.progress += dt
  if (m.progress >= m.count * r.seconds) farm.machines[id] = { recipe: r.id, count: 0, progress: 0, ready: m.count }
}

// ───────────────────────────── the shop ─────────────────────────────

const mmss = (seconds: number) => {
  const t = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
export { mmss as clockText }

/** Steps bought of an upgrade that comes one step at a time (0 for the others). */
export const upgradeLevel = (u: UpgradeId) => (u === 'queue' ? farm.queueLevel : u === 'pace' ? farm.paceLevel : 0)

/** What the next step of an upgrade costs. */
export function upgradePrice(u: UpgradeId) {
  const def = UPGRADES.find((x) => x.id === u)!
  return def.price + (def.priceStep ?? 0) * upgradeLevel(u)
}

/** The herd an upgrade adds an animal to (another hen, cow or sheep). */
const herdOf = (u: UpgradeId) => UPGRADES.find((x) => x.id === u)?.herd

/** Bought (all of it, for an upgrade that comes in steps). */
export function owned(u: UpgradeId) {
  const herd = herdOf(u)
  if (herd) return animals(herd) >= mostAnimals(herd)
  switch (u) {
    case 'sprinkler':
      return farm.sprinkler
    case 'compost':
      return farm.compost
    case 'queue':
      return farm.queueLevel >= QUEUE_LEVELS
    case 'pace':
      return farm.paceLevel >= PACE_LEVELS
    case 'east':
    case 'west':
      return farm.expansions[u]
    default:
      return false
  }
}

export const placesInLine = () => queuePlaces(farm.queueLevel)
export const arrivalSeconds = () => arrivalEvery(farm.paceLevel)

export function buy(id: UpgradeId) {
  const u = UPGRADES.find((x) => x.id === id)
  const price = upgradePrice(id)
  if (!u || owned(id) || farm.coins < price) return false
  farm.coins -= price
  let note = `${u.name}: done`
  if (u.herd) {
    addAnimal(u.herd)
    // a new cow or sheep comes with her name ("Bella joins the herd"); another hen is just that
    const name = animalName(u.herd, animals(u.herd) - 1)
    if (name) note = `${name} joins ${PRODUCERS[u.herd].herd?.joins}`
  } else if (id === 'sprinkler') farm.sprinkler = true
  else if (id === 'compost') farm.compost = true
  else if (id === 'queue') {
    farm.queueLevel = Math.min(QUEUE_LEVELS, farm.queueLevel + 1)
    note = `The line at the gate has room for ${placesInLine()}`
  } else if (id === 'pace') {
    farm.paceLevel = Math.min(PACE_LEVELS, farm.paceLevel + 1)
    farm.nextVisitorIn = Math.min(farm.nextVisitorIn, arrivalSeconds())
    note = `A buyer every ${mmss(arrivalSeconds())}`
  } else if (id === 'east' || id === 'west') {
    farm.expansions[id] = true
    BEDS.forEach((def, i) => {
      if (def.expansion === id) farm.beds[i].built = true
    })
    note = `${EXPANSIONS[id].name}: the beds are in`
  }
  gainXp('build')
  toast(note)
  bump()
  save()
  return true
}

// ───────────────────────────── land and layout ─────────────────────────────

/** Buys a field next to your land: the hedge moves out round it, and there is room to move things onto. */
export function buyLand(id: ParcelId) {
  const p = PARCELS[id]
  if (!p || !canBuyParcel(farm.layout, id) || farm.coins < p.price) return false
  farm.coins -= p.price
  farm.layout = { ...farm.layout, land: [...farm.layout.land, id] }
  gainXp('build')
  toast(`${p.name}: it is yours`)
  bump()
  save()
  return true
}

/** Moves a whole place (the hen run, the pasture, the fold, a tree) to a free spot on your land, on the half-metre grid. */
export function movePlace(id: PlaceId, to: Placement): Fit {
  const p = { x: snap(to.x), z: snap(to.z), rot: ((Math.round(to.rot) % 4) + 4) % 4 }
  const fit = canPlace(farm.layout, id, p)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, places: { ...farm.layout.places, [id]: p } }
  bump()
  save()
  return fit
}

/** Puts a place back where it stood on a new farm (if that spot is free). */
export const sendHome = (id: PlaceId) => movePlace(id, PLACES[id].home)

// ───────────────────────────── the house's furniture ─────────────────────────────

const quarter = (rot: number) => ((Math.round(rot) % 4) + 4) % 4

/** Moves (or turns) a piece of furniture to where it fits; if it does not, nothing moves and the reason comes back. */
export function movePiece(id: string, to: Placement): Fit {
  const p = farm.home.pieces.find((q) => q.id === id)
  if (!p) return { ok: false, reason: 'Not in the house' }
  if (PIECES[p.type].fitted) return { ok: false, reason: 'Built in' }
  const q: HomePiece = { ...p, x: to.x, z: to.z, rot: quarter(to.rot) }
  const fit = canPlacePiece(farm.home, q)
  if (!fit.ok) return fit
  farm.home = { ...farm.home, pieces: farm.home.pieces.map((o) => (o.id === id ? q : o)) }
  bump()
  save()
  return fit
}

/** Puts a piece away into storage (what is built in stays). */
export function storePiece(id: string) {
  const p = farm.home.pieces.find((q) => q.id === id)
  if (!p || PIECES[p.type].fitted) return false
  farm.home = { ...farm.home, pieces: farm.home.pieces.filter((o) => o.id !== id), stored: [...farm.home.stored, p.type] }
  bump()
  save()
  return true
}

/** Takes a piece of this kind out of storage and stands it here, if it fits: its id, or the reason it does not. */
export function placeStored(type: PieceType, to: Placement): Fit & { id?: string } {
  const k = farm.home.stored.indexOf(type)
  if (k < 0) return { ok: false, reason: 'None in storage' }
  const id = `${type}-${farm.home.next}`
  const q: HomePiece = { id, type, x: to.x, z: to.z, rot: quarter(to.rot) }
  const fit = canPlacePiece(farm.home, q)
  if (!fit.ok) return fit
  const stored = farm.home.stored.filter((_, j) => j !== k)
  farm.home = { pieces: [...farm.home.pieces, q], stored, next: farm.home.next + 1 }
  bump()
  save()
  return { ok: true, id }
}

/** Buys a piece of furniture: it waits in storage until you stand it somewhere. */
export function buyPiece(type: PieceType) {
  const def = PIECES[type]
  if (!def || !def.price || farm.coins < def.price) return false
  farm.coins -= def.price
  farm.home = { ...farm.home, stored: [...farm.home.stored, type] }
  bump()
  save()
  return true
}

/** Puts the house back as it was a moment ago (the decorate mode's undo), with the coins of a purchase it undoes. */
export function restoreHome(layout: HomeLayout, refund = 0) {
  farm.home = layout
  farm.coins += refund
  bump()
  save()
}

/** A free spot for a piece in a room, for placing one from storage without dragging it there. */
export const freeSpotFor = (type: PieceType, room: Parameters<typeof findFreeSpot>[2]) => findFreeSpot(farm.home, type, room)

// ───────────────────────────── buyers ─────────────────────────────

let visitorSeq = 0

/** What the farm grows and makes (and what every farm has: lemons, eggs, milk): what buyers and orders ask for. */
const knownGoods = () => [...new Set<ProduceId>([...farm.planted, ...farm.made, 'lemon', 'egg', 'milk'])].filter(isSellable)

/** What a buyer asks for: mostly something you have, sometimes something your farm makes but has run out of. */
function chooseRequest(): { want: ProduceId; qty: number } {
  const stocked = SELLABLE.filter((id) => farm.inv[id] > 0)
  const known = knownGoods()
  const fromStock = stocked.length > 0 && Math.random() < 0.72
  const want = fromStock ? pick(stocked) : pick(known)
  const def = produceById(want)
  const have = farm.inv[want]
  const qty = have > 0 && fromStock ? Math.max(1, Math.min(def.maxAsk, Math.round(have * rand(0.45, 1.15)))) : Math.round(rand(Math.min(2, def.maxAsk), def.maxAsk))
  return { want, qty: Math.max(1, qty) }
}

/** Mostly fair, now and then generous, sometimes cheeky: worth a look before saying yes. */
function priceFor(want: ProduceId, qty: number) {
  const r = Math.random()
  const factor = r < 0.15 ? 0.6 : r < 0.38 ? 0.85 : r < 0.66 ? 1 : r < 0.86 ? 1.25 : 1.6
  return Math.max(1, Math.round(produceById(want).price * qty * factor))
}

export const fairPrice = (want: ProduceId, qty: number) => produceById(want).price * qty

/** Everyone in line or on their way to it, the front first. */
export const inLine = () => farm.visitors.filter((v) => v.phase !== 'leaving')
/** Everyone standing in line, the front first. */
export const waiting = () => farm.visitors.filter((v) => v.phase === 'queued')

function newVisitor(want: ProduceId, qty: number, offer: number, from: -1 | 1, gift: boolean, look?: Look, name?: string): Visitor {
  const startX = LANE_ENDS[from < 0 ? 0 : 1]
  return {
    id: ++visitorSeq,
    name: name ?? pick(NAMES),
    // a whole person from the table of traits, on the farm's dice (src/models/look.ts)
    look: look ?? asLook(rollLook(random)),
    want,
    qty,
    offer,
    phase: 'arriving',
    path: [],
    leg: 0,
    x: startX,
    z: WALK_Z + rand(-0.15, 0.15),
    heading: from < 0 ? Math.PI / 2 : -Math.PI / 2,
    moving: true,
    mood: 'neutral',
    moodAt: farm.clock,
    departAt: 0,
    gift,
  }
}

/** Puts a buyer straight into their place in the line (a saved line, buyers who came while you were away). */
function standInLine(v: Visitor) {
  const spot = queueSpot(inLine().indexOf(v))
  v.phase = 'queued'
  v.x = spot.x
  v.z = spot.z
  v.heading = spot.heading
  v.moving = false
}

/** A new buyer walks up the lane (`queued`: is already standing in line). */
export function spawnVisitor(opts: Partial<Pick<Visitor, 'want' | 'qty' | 'offer' | 'gift'>> & { from?: -1 | 1; queued?: boolean } = {}) {
  const from = opts.from ?? (Math.random() < 0.5 ? -1 : 1)
  const request = opts.want ? { want: opts.want, qty: opts.qty ?? 2 } : chooseRequest()
  const v = newVisitor(request.want, request.qty, opts.offer ?? priceFor(request.want, request.qty), from, opts.gift ?? bringsSurprise(random))
  farm.visitors.push(v)
  if (opts.queued) standInLine(v)
  bump()
  return v
}

function leave(v: Visitor, mood: Visitor['mood']) {
  v.phase = 'leaving'
  v.mood = mood
  v.moodAt = farm.clock
  v.departAt = farm.clock + 1.1 // a moment to react before setting off
  // home along the far side of the lane, past the line, whichever way is nearer the end they came from
  const exit = v.x > GATE_SPOT.x + 2 || Math.random() < 0.5 ? 1 : -1
  v.path = [
    { x: v.x, z: v.z },
    { x: v.x + exit * 0.4, z: WALK_Z + 0.25 },
    { x: LANE_ENDS[exit < 0 ? 0 : 1], z: WALK_Z + rand(0, 0.3) },
  ]
  v.leg = 1
  bump()
}

export const visitorById = (id: number) => farm.visitors.find((v) => v.id === id)
export const canSell = (v: Visitor) => farm.inv[v.want] >= v.qty

/** Sells to a buyer: their coins, and their surprise if they brought one (it flies up from them to the barn). */
function sell(v: Visitor): ItemId[] {
  coinsFx(v.x, v.z, v.offer)
  farm.inv[v.want] -= v.qty
  farm.coins += v.offer
  farm.stats.sold += v.qty
  farm.stats.earned += v.offer
  const items = v.gift ? [randomItem(random)] : []
  v.gift = false
  gainItems(items, { x: v.x, y: 1.9, z: v.z })
  gainXp('sale', v.offer, { x: v.x, y: 1.9, z: v.z })
  leave(v, 'happy')
  return items
}

export function acceptOffer(id: number) {
  const v = visitorById(id)
  if (!v || v.phase !== 'queued' || !canSell(v)) return false
  const items = sell(v)
  toast(`+ ${v.offer} coins · ${v.name}${surpriseWords(items)}`, items[0] ?? 'coin')
  farmSound('coins')
  save()
  return true
}

/** Who you could sell to, front to back, with what is in the basket now — and what it comes to. */
export function sellAllPreview() {
  const left = { ...farm.inv }
  let buyers = 0
  let coins = 0
  for (const v of waiting()) {
    if (left[v.want] < v.qty) continue
    left[v.want] -= v.qty
    buyers++
    coins += v.offer
  }
  return { buyers, coins }
}

/** What the line wants that the basket cannot give yet: each good asked for, and how many more of it would serve the
 *  buyer who asks for the fewest of it — the fewest first (shown at the gate when nobody in line can be served). */
export function lineShort(): { item: ProduceId; count: number }[] {
  const short = new Map<ProduceId, number>()
  for (const v of waiting()) {
    const more = v.qty - farm.inv[v.want]
    if (more > 0) short.set(v.want, Math.min(short.get(v.want) ?? Infinity, more))
  }
  return [...short].map(([item, count]) => ({ item, count })).sort((a, b) => a.count - b.count)
}

/** Sells to everyone in line you have enough for, front to back. */
export function sellAll() {
  let buyers = 0
  let coins = 0
  const items: ItemId[] = []
  for (const v of waiting()) {
    if (!canSell(v)) continue
    items.push(...sell(v))
    buyers++
    coins += v.offer
  }
  if (!buyers) return 0
  toast(`+ ${coins} coins · ${buyers} ${buyers === 1 ? 'buyer' : 'buyers'}${surpriseWords(items)}`, items[0] ?? 'coin')
  farmSound('coins')
  save()
  return buyers
}

/** "Sorry, none today": they go, and someone else comes along soon to take their place. */
export function declineOffer(id: number) {
  const v = visitorById(id)
  if (!v || v.phase !== 'queued') return false
  farm.stats.declined += 1
  farmSound('decline')
  leave(v, 'sad')
  farm.nextVisitorIn = Math.min(farm.nextVisitorIn, 8)
  save()
  return true
}

// ───────────────────────────── orders: the office and the tractor ─────────────────────────────

/** How many orders the board holds at a time, and how long a new one takes after one is declined. */
export const orderPlaces = () => orderSlots(farm.office.slots)
export const orderWaitSeconds = () => orderWait(farm.office.wait)

/** The order in a place on the board (null while a new one is on its way). */
export const orderAt = (k: number): Order | null => {
  const slot = farm.orders[k]
  return slot && 'order' in slot ? slot.order : null
}

/** How many of each good of an order could go in now, from the silo and the barn. */
export const canFill = (k: number) => {
  const o = orderAt(k)
  return !!o && o.lines.some((l) => l.have < l.want && farm.inv[l.good] > 0)
}

/** Puts into an order what the silo and the barn have of what it asks for (all of it, or what there is: the rest can
 *  follow later); they leave the buildings and wait in the order. How many went in. */
export function fillOrder(k: number) {
  const o = orderAt(k)
  if (!o) return 0
  let n = 0
  for (const l of o.lines) {
    const put = Math.min(l.want - l.have, farm.inv[l.good])
    if (put <= 0) continue
    farm.inv[l.good] -= put
    l.have += put
    n += put
  }
  if (!n) return 0
  bump()
  save()
  return n
}

/** Sends a full order: it is paid at once (and brings its surprise, if it has one), its crates go to the pallet for
 *  the tractor, and a new order takes its place straight away. */
export function sendOrder(k: number) {
  const o = orderAt(k)
  if (!o || !isComplete(o)) return false
  farm.coins += o.coins
  farm.stats.earned += o.coins
  farm.stats.sold += o.lines.reduce((n, l) => n + l.want, 0)
  farm.stats.sent += 1
  const items = o.surprise ? [randomItem(random)] : []
  gainItems(items, OFFICE_SCREEN)
  gainXp('order', 1, OFFICE_SCREEN)
  gainXp('sale', o.coins, OFFICE_SCREEN)
  farm.dispatch.waiting = Math.min(MOST_CRATES, farm.dispatch.waiting + cratesFor(o))
  farm.orders[k] = { order: makeOrder(knownGoods(), random) }
  toast(`Order sent · + ${o.coins} coins${surpriseWords(items)}`, items[0] ?? 'coin')
  farmSound('coins')
  bump()
  save()
  return true
}

/** Declines an order (or cancels one half filled): what was put into it goes back to the silo and the barn (even past
 *  full: it was the farm's already), and a new order comes after the wait. */
export function declineOrder(k: number) {
  const o = orderAt(k)
  if (!o) return false
  for (const l of o.lines) if (l.have) putBack(l.good, l.have)
  farm.orders[k] = { wait: orderWaitSeconds() }
  const back = o.lines.reduce((n, l) => n + l.have, 0)
  toast(back ? `Order declined · ${back} back in store` : 'Order declined', back ? o.lines.find((l) => l.have)!.good : undefined)
  farmSound('decline')
  bump()
  save()
  return true
}

/** Steps bought of an office upgrade, its next price, and whether it is all bought. */
export const officeLevel = (id: OfficeUpgradeId) => farm.office[id]
export const officePrice = (id: OfficeUpgradeId) => OFFICE_UPGRADES[id].price + OFFICE_UPGRADES[id].priceStep * farm.office[id]
export const officeMaxed = (id: OfficeUpgradeId) => farm.office[id] >= OFFICE_UPGRADES[id].levels

/** Buys the next step of an office upgrade (its card asked first): one more place on the board (a new order comes in
 *  it straight away), or a minute off the wait (and off every wait already running). */
export function buyOffice(id: OfficeUpgradeId) {
  const price = officePrice(id)
  if (officeMaxed(id) || farm.coins < price) return false
  farm.coins -= price
  farm.office = { ...farm.office, [id]: farm.office[id] + 1 }
  gainXp('build', 1, OFFICE_SCREEN)
  if (id === 'slots') {
    farm.orders.push({ order: makeOrder(knownGoods(), random) })
    toast(`The board holds ${orderPlaces()} orders`)
  } else {
    const wait = orderWaitSeconds()
    farm.orders = farm.orders.map((slot) => ('wait' in slot ? { wait: Math.min(slot.wait, wait) } : slot))
    toast(`A new order every ${mmss(wait)}`)
  }
  bump()
  save()
  return true
}

/** Orders on their way come in once their wait is over. */
function growOrders(dt: number) {
  farm.orders.forEach((slot, k) => {
    if (!('wait' in slot)) return
    slot.wait = Math.max(0, slot.wait - dt)
    if (slot.wait <= 0) farm.orders[k] = { order: makeOrder(knownGoods(), random) }
  })
}

/** The tractor: once at home with crates on the pallet it takes up to four on a trip; the trip runs its course. */
function growDispatch(dt: number) {
  const d = farm.dispatch
  let left = dt
  for (let guard = 0; guard < 64 && left > 0; guard++) {
    if (d.trip < 0) {
      if (!d.waiting) return
      d.aboard = Math.min(TRACTOR.load, d.waiting)
      d.waiting -= d.aboard
      d.trip = 0
    }
    const total = tripSeconds(d.aboard, gateX())
    const step = Math.min(left, total - d.trip)
    d.trip += step
    left -= step
    if (d.trip >= total) {
      d.trip = -1
      d.aboard = 0
    }
  }
}

// ───────────────────────────── time ─────────────────────────────

const stageKey = () =>
  [
    ...farm.beds.map((_, i) => bedStage(i)),
    ...PRODUCER_IDS.map((id) => farm.producers[id].stock.join(',')),
    ...MACHINE_IDS.map(machineStage),
    farm.orders.map((slot) => ('order' in slot ? 'o' : 'w')).join(''),
    farm.dispatch.trip < 0 ? `home ${farm.dispatch.waiting}` : `trip ${farm.dispatch.aboard}`,
    // the shop's shelves and till (a shopper bought), the day's phase and number (the light, the contractor's pieces)
    farm.market.shelves.map((sh) => sh.units).join(','),
    farm.market.till.coins,
    phaseOf(farm.day.t),
    dayOf(farm.day.t),
  ].join('|')

function grow(dt: number) {
  for (const b of farm.beds) {
    if (!b.crop) continue
    const def = cropById(b.crop)
    if (b.growth >= def.growSeconds) continue
    // growth stops while the soil is dry; with sprinklers it never is
    const wet = farm.sprinkler ? dt : Math.min(dt, b.water)
    b.growth = Math.min(def.growSeconds, b.growth + wet)
    if (!farm.sprinkler) b.water = Math.max(0, b.water - dt)
  }
  for (const id of PRODUCER_IDS) growProducer(id, dt)
  for (const id of MACHINE_IDS) growMachine(id, dt)
  growOrders(dt)
  growDispatch(dt)
}

function walk(v: Visitor, dt: number) {
  const target = v.path[v.leg]
  if (!target) {
    v.moving = false
    return true
  }
  if (moveTo(v, target.x, target.z, dt)) {
    v.leg++
    if (v.leg >= v.path.length) {
      v.moving = false
      return true
    }
  }
  return false
}

/** One step towards (x, z); true once there. */
function moveTo(v: Visitor, x: number, z: number, dt: number) {
  const dx = x - v.x
  const dz = z - v.z
  const d = Math.hypot(dx, dz)
  if (d < 0.02) {
    v.moving = false
    return true
  }
  v.moving = true
  v.heading = dampAngle(v.heading, Math.atan2(dx, dz), 7, dt)
  const step = VISITOR.speed * dt
  if (d <= step) {
    v.x = x
    v.z = z
  } else {
    v.x += (dx / d) * step
    v.z += (dz / d) * step
  }
  return false
}

function people(dt: number) {
  const step = Math.min(dt, 0.25)
  const line = inLine()
  line.forEach((v, k) => {
    const spot = queueSpot(k)
    if (v.phase === 'arriving') {
      // up the far side of the lane to your place, then a step across to it
      const far = Math.abs(v.x - spot.x) > 0.35
      if (moveTo(v, spot.x, far ? WALK_Z : spot.z, step) && !far) {
        v.phase = 'queued'
        v.moodAt = farm.clock
        const n = line.filter((w) => w.phase === 'queued').length
        toast(k === 0 ? `${v.name} is at the garden gate` : `${v.name} joined the line · ${n} waiting`)
        const { pan, near } = placeSound(GATE_SPOT.x, GATE_SPOT.z)
        farmSound('bell', pan, Math.max(0.5, near))
        bump()
      }
    } else if (moveTo(v, spot.x, spot.z, step)) {
      // in line: they move up when a place ahead frees, then turn back to the gate
      v.heading = dampAngle(v.heading, spot.heading, 5, step)
    }
  })
  // a copy: those who reach the end of the lane are taken out of the line as it is walked through
  for (const v of farm.visitors.slice()) {
    if (v.phase !== 'leaving' || farm.clock < v.departAt) continue
    if (walk(v, step)) {
      farm.visitors.splice(farm.visitors.indexOf(v), 1)
      bump()
    }
  }
  // the next buyer: the countdown runs once you have planted, and waits at zero while the line is full
  if (!farm.started) return
  farm.nextVisitorIn = Math.max(0, farm.nextVisitorIn - dt)
  if (farm.nextVisitorIn <= 0 && line.length < placesInLine()) {
    farm.nextVisitorIn = arrivalSeconds()
    spawnVisitor()
  }
}

let gifted = false
function neverStuck() {
  const broke = farm.coins < Math.min(...CROPS.map((c) => c.seedCost))
  // a machine at work or with something to take out is something on its way
  // (goods put into an order are the farm's too: they come back if it is declined)
  const nothing =
    farm.beds.every((b) => !b.crop) &&
    SELLABLE.every((id) => farm.inv[id] === 0) &&
    MACHINE_IDS.every((id) => machineStage(id) === 'idle') &&
    farm.orders.every((slot) => !('order' in slot) || slot.order.lines.every((l) => !l.have)) &&
    // goods on the shelves are the farm's too (they sell, or come back), and coins in the till are coins
    shelvesEmpty() &&
    !(farm.market.till.coins > 0)
  if (broke && nothing && !gifted) {
    gifted = true
    farm.coins += 6
    toast('A neighbour left 6 coins at the gate for seeds')
    bump()
    save()
  }
  if (!broke) gifted = false
}

/** Advances the farm by `dt` seconds of real time. */
export function tick(dt: number) {
  if (!(dt > 0)) return
  const before = stageKey()
  farm.clock += dt
  grow(dt)
  people(dt)
  runShop(dt)
  runDay(dt)
  neverStuck()
  if (stageKey() !== before) {
    bump()
    save()
  }
}

// ───────────────────────────── the goals board ─────────────────────────────

/** Claims a goal reached (src/farm/goals.ts): its coins, and the building material the silo or the barn is shortest of
 *  (into the barn even past full, as surprises do); the goal moves on to its next count. What it gave, or null. */
export function claimGoal(id: GoalId) {
  const def = goalById(id)
  const step = farm.goals[id]
  if (!def || step >= MOST_STEPS || def.measure(farm) < goalTarget(def, step)) return null
  const reward = goalReward(def, step, farm)
  farm.goals[id] = step + 1
  farm.coins += reward.coins
  putBack(reward.item, reward.count)
  gainXp('goal')
  toast(`${def.say(goalTarget(def, step))} · + ${reward.coins} coins, + ${count(reward.item, reward.count)}`, reward.item)
  farmSound('coins')
  bump()
  save()
  return reward
}

// ───────────────────────────── levels ─────────────────────────────

/** Counts every gain of XP from play (never a load, a slot switch or the old-save seed): the level-up show listens to it. */
let xpEvents = 0
export const xpEventCount = () => xpEvents

type At = { x: number; y: number; z: number }

/** XP for something the player did: `n` times the action's worth (XP_FOR), or for a sale `n` coins (xpForSale). `at` is
 *  where the crystals fly up from. Only from a player's action: never in tick, goOn or cameBack. The XP gained. */
export function gainXp(action: XpAction | 'sale', n = 1, at?: At): number {
  const xp = action === 'sale' ? (n > 0 ? xpForSale(n) : 0) : n > 0 ? XP_FOR[action] * n : 0
  if (!(xp > 0)) return 0
  farm.xp.points = Math.min(Number.MAX_SAFE_INTEGER, farm.xp.points + xp)
  xpEvents++
  // the crystals fly up from where it happened; with no place to name (a panel's sale), from low in the middle
  xpFx(at?.x ?? NaN, at?.y ?? NaN, at?.z ?? NaN, xp)
  bump()
  save()
  return xp
}

/** The level now: the level, the points into it and needed for the next, all the points, the coins waiting. */
export function xpNow() {
  const level = levelOf(farm.xp.points)
  return { level, into: farm.xp.points - xpAt(level), need: xpAt(level + 1) - xpAt(level), points: farm.xp.points, unpaid: unpaidCoins(farm.xp) }
}

/** Claims the coins of every level reached and not yet paid; returns them (0 when none wait). */
export function claimLevel(): number {
  const coins = unpaidCoins(farm.xp)
  if (!(coins > 0)) return 0
  const level = levelOf(farm.xp.points)
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + coins)
  farm.xp.paid = level
  toast(`Level ${level} · + ${coins} coins`, 'coin')
  farmSound('coins')
  bump()
  save()
  return coins
}

// ───────────────────────────── the supermarket ─────────────────────────────

/** Where the crystals and the coins fly from: the manager, the computer, the till, the contractor. */
const AT_MANAGER: At = { x: MANAGER_SPOT.x, y: 1.6, z: MANAGER_SPOT.z }
const AT_SCREEN: At = { x: SCREEN.x, y: SCREEN.y, z: SCREEN.z }
const AT_TILL: At = { x: TILL.x, y: TILL.y, z: TILL.z }
const AT_CONTRACTOR: At = { x: CONTRACTOR_SPOT.x, y: 1.6, z: CONTRACTOR_SPOT.z }

/** What the manager pays for the whole stack of a good now (0: he does not buy it, or it comes to nothing). */
export function managerPays(item: ProduceId): number {
  if (farm.market.owned || !isSellable(item)) return 0
  return managerPay(produceById(item).price, farm.inv[item], managerPct(farm.ladders.rate))
}

/** Sells him a good's whole stack, without a word: the coins (0: nothing sold). */
function sellManager(item: ProduceId): number {
  const coins = managerPays(item)
  if (!(coins > 0)) return 0
  const qty = farm.inv[item]
  farm.inv[item] = 0
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + coins)
  farm.stats.sold += qty
  farm.stats.earned += coins
  gainXp('sale', coins, AT_MANAGER)
  return coins
}

/** Sells the whole stack of a good to the manager (before the shop is yours); the coins paid, 0 when it pays nothing. */
export function sellToManager(item: ProduceId): number {
  const qty = farm.inv[item] ?? 0
  const coins = sellManager(item)
  if (!coins) return 0
  coinsFx(AT_MANAGER.x, AT_MANAGER.z, coins)
  toast(`+ ${coins} coins · ${count(item, qty)}`, item)
  farmSound('coins')
  bump()
  save()
  return coins
}

/** Sells him every good he pays for; the coins. */
export function sellAllToManager(): number {
  let coins = 0
  let goods = 0
  for (const id of SELLABLE) {
    const qty = farm.inv[id]
    const c = sellManager(id)
    if (c) goods += qty
    coins += c
  }
  if (!coins) return 0
  coinsFx(AT_MANAGER.x, AT_MANAGER.z, coins)
  toast(`+ ${coins} coins · ${goods} ${goods === 1 ? 'good' : 'goods'} to the manager`, 'coin')
  farmSound('coins')
  bump()
  save()
  return coins
}

/** The shop is for sale: the manager's rate is at its top and it is not yours yet. */
export const marketForSale = () => !farm.market.owned && ladderMaxed('rate')

/** Buys the shop from the manager (his rate at its top, MANAGER.shopPrice); whether it was bought. He waves and walks
 *  out, and the computer is yours: the shelves, the till and the shop's own ladders. */
export function buyMarket(): boolean {
  if (!marketForSale() || farm.coins < MANAGER.shopPrice) return false
  farm.coins -= MANAGER.shopPrice
  farm.market.owned = true
  farm.market.nextIn = Math.min(farm.market.nextIn, shopperEvery(farm.ladders.pace))
  leaving = { ...managerStanding(), ...walker(MANAGER_SPOT.x, MANAGER_SPOT.z, MANAGER_SPOT.heading, managerLeaves()), id: MANAGER_ID }
  gainXp('shop', 1, AT_SCREEN)
  toast('The shop is yours', 'convenience-store')
  farmSound('coins')
  bump()
  save()
  return true
}

/** A ladder's step bought, its next price, whether it is at its top. */
export const ladderLevel = (id: LadderId) => farm.ladders[id]
export const ladderMaxed = (id: LadderId) => farm.ladders[id] >= LADDERS[id].levels
export const ladderNextPrice = (id: LadderId) => ladderPrice(id, farm.ladders[id])

/** Whether a ladder's next step can be bought now (its place is open, not at its top): the manager's rate while the
 *  shop is not yours, the shop's own once it is, the contractor's while he is there. */
export function ladderOpen(id: LadderId): boolean {
  if (ladderMaxed(id)) return false
  if (id === 'rate') return !farm.market.owned
  if (SHOP_LADDERS.includes(id)) return farm.market.owned
  return contractorHere()
}

/** Where the crystals of a ladder's step fly from: the one you bought it from. */
const ladderAt = (id: LadderId) => (id === 'rate' ? AT_MANAGER : SHOP_LADDERS.includes(id) ? AT_SCREEN : AT_CONTRACTOR)

/** Buys a ladder's next step (its card asked first); whether it was bought. It works at once: a busier shop's next
 *  visit comes no later than the new wait, more pieces bring one more today, a better deal is the price from now on. */
export function buyLadder(id: LadderId): boolean {
  const price = ladderNextPrice(id)
  if (!ladderOpen(id) || farm.coins < price) return false
  // today's pieces as they were before this step (one more is added to them below)
  if (id === 'stock') contractorDay()
  farm.coins -= price
  farm.ladders[id] += 1
  if (id === 'pace') farm.market.nextIn = Math.min(farm.market.nextIn, shopperEvery(farm.ladders.pace))
  if (id === 'stock') {
    // the piece most wanted that he has not brought today (or any)
    const offered = farm.contractor.offers.map((o) => o.item)
    farm.contractor.offers.push({ item: dailyOffers(farm, offersPerDay(farm.ladders.stock), random).find((m) => !offered.includes(m)) ?? randomItem(random), sold: false })
  }
  gainXp('build', 1, ladderAt(id))
  toast(`${LADDERS[id].name}: ${LADDERS[id].say(farm.ladders[id])}`)
  bump()
  save()
  return true
}

/** How many places on the shelves are open now. */
export const placesNow = () => placesOpen(farm.ladders.places)
/** A place of your shop that is open (the shop yours, the place one of those its ladder opened). */
const openPlace = (k: number) => farm.market.owned && Number.isInteger(k) && k >= 0 && k < placesNow()
/** Nothing on any shelf. */
export const shelvesEmpty = () => farm.market.shelves.every((s) => s.units <= 0)

/** Puts up to `units` of a good from the silo or the barn on a place (a place's good changes only when it is empty;
 *  a place holds SHOP.units at most); how many went up. */
export function fillPlace(k: number, item: ProduceId, units: number): number {
  if (!openPlace(k) || !isSellable(item)) return 0
  const s = farm.market.shelves[k]
  if (s.units > 0 && s.good !== item) return 0
  const n = Math.min(Math.floor(units) || 0, SHOP.units - s.units, farm.inv[item])
  if (!(n > 0)) return 0
  farm.inv[item] -= n
  s.good = item
  s.units += n
  bump()
  save()
  return n
}

/** Refills the given places that are not full (sold out, or partly) with their own good, from the silo or the barn,
 *  in turn as far as it goes; how many units went up. */
export function restockPlaces(ks: number[]): number {
  let n = 0
  for (const k of new Set(ks)) {
    const s = openPlace(k) ? farm.market.shelves[k] : null
    if (s?.good) n += fillPlace(k, s.good, SHOP.units - s.units)
  }
  return n
}

/** Takes a place's units back into the silo or the barn (even past full: they were the farm's), and leaves the place
 *  free for another good; how many. */
export function emptyPlace(k: number): number {
  if (!openPlace(k)) return 0
  const s = farm.market.shelves[k]
  const n = s.good ? s.units : 0
  if (s.good && n) putBack(s.good, n)
  if (!s.good && !s.units) return 0
  s.good = null
  s.units = 0
  bump()
  save()
  return n
}

/** Sets a place's price (percent of the fair price, snapped to its range and step). */
export function setPlacePrice(k: number, pct: number) {
  if (!openPlace(k)) return
  farm.market.shelves[k].pct = snapPct(pct)
  bump()
  save()
}

/** The till on the compass: its coins, once it holds SHOP.readyAt or the shelves are empty (nothing more comes in). */
export function tillReady(): { item: 'coin'; count: number } | null {
  const coins = farm.market.till.coins
  return farm.market.owned && coins > 0 && (coins >= SHOP.readyAt || shelvesEmpty()) ? { item: 'coin', count: coins } : null
}

/** Takes the coins in the till; how many. They count as sold and earned, as at the gate. */
export function takeTill(): number {
  const { coins, goods } = farm.market.till
  if (!farm.market.owned || !(coins > 0)) return 0
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + coins)
  farm.stats.sold += goods
  farm.stats.earned += coins
  farm.market.till = { coins: 0, goods: 0 }
  gainXp('sale', coins, AT_TILL)
  coinsFx(AT_TILL.x, AT_TILL.z, coins)
  toast(`+ ${coins} coins from the till`, 'coin')
  farmSound('till')
  bump()
  save()
  return coins
}

/** Tests: the shop yours, every place open and full of `item` (the heaviest good to draw by default). */
export function marketFill(item: ProduceId = 'corn') {
  if (!isSellable(item)) return
  farm.market.owned = true
  farm.ladders.places = LADDERS.places.levels
  for (const s of farm.market.shelves) Object.assign(s, { good: item, units: SHOP.units })
  bump()
  save()
}

// ───────────────────────────── the people of the market (src/farm/script.ts) ─────────────────────────────

/** A person the scene draws (the shoppers, the manager, the contractor), as the movement scripts (src/farm/script.ts) leave them. */
export interface Walking {
  id: number
  x: number
  z: number
  heading: number
  walking: boolean
  pose: Pose
  look: PersonLook
}
type Person = Walker & Walking

/** The most shoppers about at a time, in the shop and on the lane (the crowd's guest places: GUEST_SLOTS in
 *  src/farm/Visitors.tsx, less the contractor's and the tractor driver's; the manager walks out in one of these). As
 *  many as the top of both ladders has about at once (group 3, pace 4: up to 14), so the shop keeps the ladders' pace. */
export const MOST_SHOPPERS = 14
/** Two shoppers never browse at one spot at once: the one coming is there this long after the one before has gone. */
const SPOT_GAP = 1
/** Ids of their own (the buyers at the gate count up from 1). */
const MANAGER_ID = -1
const CONTRACTOR_ID = -2
let shopperSeq = 0

/** A shopper: on their way in and browsing, on their way to pay and paying, or on their way out. */
interface Shopper extends Person {
  phase: 'in' | 'pay' | 'out'
  spot: number
  side: 0 | 1
}
/** Not saved: on a reload the shoppers are gone (what they bought is in the till already). */
let shoppers: Shopper[] = []
/** The manager walking out of the shop you bought (gone once at the lane's end, and on a reload). */
let leaving: Person | null = null

/** The same person every time: their traits rolled on dice of their own (not the farm's). */
function steadyLook(seed: number, overrides: Partial<PersonLook>) {
  let a = seed
  const dice = () => {
    a = (a * 16807) % 2147483647
    return a / 2147483647
  }
  return rollLook(dice, overrides)
}
const MANAGER_DRESS = steadyLook(1723, MANAGER_LOOK)
const CONTRACTOR_DRESS = steadyLook(9157, CONTRACTOR_LOOK)
const managerStanding = (): Person => ({ id: MANAGER_ID, ...walker(MANAGER_SPOT.x, MANAGER_SPOT.z, MANAGER_SPOT.heading, []), look: MANAGER_DRESS })
const standingManager = managerStanding()
const standingContractor: Person = { id: CONTRACTOR_ID, ...walker(CONTRACTOR_SPOT.x, CONTRACTOR_SPOT.z, CONTRACTOR_SPOT.heading, []), look: CONTRACTOR_DRESS }

/** The shoppers in the shop and on their way, as the scene draws them. */
export function shoppersNow(): readonly Walking[] {
  return shoppers
}
/** The manager: behind his desk until the shop is yours, then walking out (null once he has gone). */
export function managerNow(): Walking | null {
  return farm.market.owned ? leaving : standingManager
}

/** Whether a shopper setting off now would find browse spot `spot` free when they get there (from the nearer lane
 *  end, the soonest they can): everyone on their way to it before them has browsed and gone by then. */
function spotFree(spot: number) {
  const there = Math.min(...([0, 1] as const).map((side) => scriptSeconds(laneEnd(side).x, laneEnd(side).z, shopperIn(spot), VISITOR.speed))) - SHOP.browse
  return shoppers.every((s) => s.phase !== 'in' || s.spot !== spot || secondsLeft(s, VISITOR.speed) + SPOT_GAP <= there)
}

/** A browse spot for each of a visit's group (null: no room for all of them yet): a spot nobody else will be browsing
 *  at when they get there, and a place among all about (the manager, while he walks out, takes one). */
function visitSpots(): number[] | null {
  const group = shoppersAtOnce(farm.ladders.group)
  if (shoppers.length + group + (leaving ? 1 : 0) > MOST_SHOPPERS) return null
  const spots = BROWSE_SPOTS.map((_, i) => i).filter(spotFree)
  return spots.length >= group ? spots.slice(0, group) : null
}

/** A visit: the group walks in from the lane ends (each rolled on the farm's dice), each to their browse spot. */
function visit(spots: number[]) {
  for (const spot of spots) {
    const side: 0 | 1 = random() < 0.5 ? 0 : 1
    const end = laneEnd(side)
    shoppers.push({ ...walker(end.x, end.z, side ? -Math.PI / 2 : Math.PI / 2, shopperIn(spot)), walking: true, id: -(100 + ++shopperSeq), look: rollLook(random), phase: 'in', spot, side })
  }
}

/** What one shopper buys, on the farm's dice: the units off the shelves, their coins (and how many) into the till, in
 *  the same step. How many units. */
function shopperBuys(): number {
  const m = farm.market
  if (!m.owned) return 0
  const r = rollShopper(m.shelves, placesNow(), random)
  r.taken.forEach((n, k) => (m.shelves[k].units -= n))
  m.till.coins = Math.min(Number.MAX_SAFE_INTEGER, m.till.coins + r.coins)
  m.till.goods = Math.min(Number.MAX_SAFE_INTEGER, m.till.goods + r.units)
  return r.units
}

/** A walker setting off on new steps. */
const setOff = { at: 0, waited: 0, walking: true, pose: 'stand' } as const

/** The shoppers walk on: one who has browsed takes what they want (and goes to pay), or nothing (and goes); one who has
 *  paid goes; one at the lane's end is gone. */
function moveShoppers(dt: number) {
  for (const s of shoppers.slice()) {
    if (!stepScript(s, dt, VISITOR.speed)) continue
    if (s.phase === 'in') {
      const bought = shopperBuys() > 0
      const ahead = shoppers.filter((o) => o.phase === 'pay').length
      Object.assign(s, { phase: bought ? 'pay' : 'out', steps: bought ? shopperPay(s.spot, ahead) : shopperOut(s.spot, false, s.side), ...setOff })
    } else if (s.phase === 'pay') Object.assign(s, { phase: 'out', steps: shopperOut(s.spot, true, s.side), ...setOff })
    else shoppers.splice(shoppers.indexOf(s), 1)
  }
  if (leaving && stepScript(leaving, dt, VISITOR.speed)) leaving = null
}

/** Another farm (loaded, switched to, started again): no one of this one's is left walking, and its first frame tells
 *  no morning. */
function forgetWalkers() {
  shoppers = []
  held = 0
  leaving = null
  contractorWalk = null
  lastPhase = null
}

/** Your shop in play: the countdown to the next visit (it holds at 0 while the shelves are empty, and while the
 *  shop has no room for the whole group), the visits, and the shoppers walking. */
function runShop(dt: number) {
  moveShoppers(dt)
  const m = farm.market
  if (!m.owned) return
  const late = Math.max(0, dt - m.nextIn)
  m.nextIn = Math.max(0, m.nextIn - dt)
  if (m.nextIn > 0 || shelvesEmpty()) {
    held = 0
    return
  }
  // due, but no room yet for the whole group: it comes as soon as there is, and the next one no later than it would
  // have (the shop keeps its pace)
  held += late
  const spots = visitSpots()
  if (!spots) return
  m.nextIn = Math.max(0, shopperEvery(farm.ladders.pace) - held)
  held = 0
  visit(spots)
}

/** Seconds a visit due has waited for room (not saved: a reload starts its count again). */
let held = 0

/** The shop while you are away: no one is seen, the visits come all the same and buy as they would have. */
function shopAway(dt: number) {
  moveShoppers(dt)
  const m = farm.market
  if (!m.owned) return
  m.nextIn -= dt
  if (m.nextIn > 0) return
  if (shelvesEmpty()) {
    m.nextIn = 0
    return
  }
  for (let k = 0; k < shoppersAtOnce(farm.ladders.group); k++) shopperBuys()
  m.nextIn = Math.max(0, Math.min(shopperEvery(farm.ladders.pace), m.nextIn + shopperEvery(farm.ladders.pace)))
}

// ───────────────────────────── the contractor ─────────────────────────────

/** He is at his window in his hours (HOURS in ./data: the morning, noon and the evening). */
export function contractorHere(): boolean {
  return isOpen('contractor', farm.day.t)
}

/** Today's offers, made the first time the day is seen (the farm's dice): the pieces the silo or the barn is shortest
 *  of first. */
function contractorDay() {
  const day = dayOf(farm.day.t)
  if (farm.contractor.day === day) return false
  farm.contractor = { day, offers: dailyOffers(farm, offersPerDay(farm.ladders.stock), random).map((item) => ({ item, sold: false })) }
  return true
}

/** Today's offers (made when a new day is first seen). */
export function contractorOffers(): Contractor['offers'] {
  contractorDay()
  return farm.contractor.offers
}
/** What one of his pieces costs now. */
export const contractorPrice = () => piecePrice(farm.ladders.discount)

/** Sells him the whole stack of a building material; the coins. */
export function sellToContractor(item: ItemId): number {
  if (!contractorHere() || !isItem(item)) return 0
  const n = farm.inv[item]
  if (!(n > 0)) return 0
  const coins = n * CONTRACTOR.buys
  farm.inv[item] = 0
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + coins)
  farm.stats.sold += n
  farm.stats.earned += coins
  gainXp('sale', coins, AT_CONTRACTOR)
  coinsFx(AT_CONTRACTOR.x, AT_CONTRACTOR.z, coins)
  toast(`+ ${coins} coins · ${count(item, n)}`, item)
  farmSound('coins')
  bump()
  save()
  return coins
}

/** Buys today's k-th piece; whether it was bought. It goes into the barn even past full (as a goal's material does),
 *  and is not a surprise found: a trade, no XP. */
export function buyFromContractor(k: number): boolean {
  if (!contractorHere()) return false
  contractorDay()
  const offer = farm.contractor.offers[k]
  const price = contractorPrice()
  if (!offer || offer.sold || farm.coins < price) return false
  farm.coins -= price
  offer.sold = true
  putBack(offer.item, 1)
  itemFx(AT_CONTRACTOR.x, AT_CONTRACTOR.y, AT_CONTRACTOR.z, offer.item)
  toast(`+ ${count(offer.item, 1)} · ${price} coins`, offer.item)
  farmSound('coins')
  bump()
  save()
  return true
}

/** The seconds since the phase now began. */
const intoPhase = (t: number) => {
  const def = DAY.phases.find((p) => p.id === phaseOf(t))!
  return ((((hourOf(t) - def.from) % 24) + 24) % 24) * (DAY.length / 24)
}
/** How long he takes to walk off at night, or back in the morning (the rest of it he is at his window, or away). */
const WALK_SECONDS = 60
/** The contractor as the day's clock has him: walking back in the first minute of the morning, at his window in his
 *  hours, walking off in the first minute of the night, away the rest of it. A function of the clock alone. */
let contractorWalk: { key: string; at: number; who: Person } | null = null
export function contractorNow(): Walking | null {
  const t = farm.day.t
  const phase = phaseOf(t)
  const since = intoPhase(t)
  // his hours begin (or end) with this phase: he was away (or there) in the one before
  const here = isOpen('contractor', t)
  const turned = here !== isOpen('contractor', t - since - 1)
  const coming = here && turned && since < WALK_SECONDS
  const going = !here && turned && since < WALK_SECONDS
  if (!coming && !going) {
    contractorWalk = null
    return here ? standingContractor : null
  }
  const key = `${dayOf(t)} ${phase}`
  if (contractorWalk?.key !== key || since < contractorWalk.at) {
    const start = coming ? { x: LANE_ENDS[1], z: WALK_Z, heading: -Math.PI / 2 } : CONTRACTOR_SPOT
    contractorWalk = { key, at: 0, who: { id: CONTRACTOR_ID, ...walker(start.x, start.z, start.heading, coming ? contractorComes() : contractorLeaves()), look: CONTRACTOR_DRESS } }
  }
  const done = stepScript(contractorWalk.who, since - contractorWalk.at, VISITOR.speed)
  contractorWalk.at = since
  return going && done ? null : contractorWalk.who
}

// ───────────────────────────── the day ─────────────────────────────

let dayFrozen = false
/** The farm's hour, phase and day now. */
export const dayNow = () => ({ hour: hourOf(farm.day.t), phase: phaseOf(farm.day.t), day: dayOf(farm.day.t) })

/** The day's clock as saved: seconds from 0. Past what any farm can have been played, adding a frame would no longer
 *  move it on: it keeps its hour and starts counting days again. */
function dayClock(v: unknown): number {
  const t = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0
  return t > 1e10 ? t % DAY.length : t
}

/** Sets the farm's clock to an hour of today (tests, ?debug): a day runs from the morning's first hour (5) through
 *  the small hours after midnight, so 4 is the end of today and 24 + h is h tomorrow. An hour before the farm's first
 *  morning began is that hour of the next day. */
export function setHour(h: number) {
  if (!Number.isFinite(h)) return
  const hour = DAY.length / 24
  const first = DAY.phases[0].from
  const today = (dayOf(farm.day.t) * 24 + first - DAY.start) * hour
  let t = today + (h >= first ? h - first : h + 24 - first) * hour
  if (t < 0) t += DAY.length
  farm.day.t = t
  bump()
  save()
}
/** Stops the farm's clock while you play (tests: the light must not change between two renders compared); time away
 *  still passes. */
export function freezeDay(on: boolean) {
  dayFrozen = on
}
export const dayIsFrozen = () => dayFrozen

/** The phase the last frame saw: the contractor's morning is told as it turns. */
let lastPhase: string | null = null

/** The day goes on in play: a new day brings the contractor's pieces, and the morning he has something the silo or
 *  the barn is short of, a word and a chime. */
function runDay(dt: number) {
  if (!dayFrozen) farm.day.t += dt
  contractorDay()
  const phase = phaseOf(farm.day.t)
  if (lastPhase && lastPhase !== phase && phase === DAY.phases[0].id) {
    const short = shortMaterials(farm)
    const piece = farm.contractor.offers.find((o) => !o.sold && short.includes(o.item))
    if (piece) {
      toast(`The contractor has ${produceById(piece.item).plural} today`, piece.item)
      farmSound('chime')
    }
  }
  lastPhase = phase
}

// ───────────────────────────── while you were away ─────────────────────────────

/** The most of a time away the farm goes on for: the page closed, or hidden (another app, the phone locked). */
export const AWAY_MOST = 3 * 3600
/** Away at least this long, the game tells you what happened (shorter, it just goes on). */
export const AWAY_TELLS = 120

/** What there is to take at a moment, to tell what came while you were away. */
interface Snapshot {
  ripe: boolean[]
  stock: Record<ProducerId, number>
  ready: Record<MachineId, number>
  line: number
  orders: number
  trip: boolean
  till: { coins: number; goods: number }
  day: number
}

const snapshot = (): Snapshot => ({
  ripe: farm.beds.map((_, i) => bedStage(i) === 'ripe'),
  stock: Object.fromEntries(PRODUCER_IDS.map((id) => [id, farm.producers[id].stock.reduce((a, b) => a + b, 0)])) as Record<ProducerId, number>,
  ready: Object.fromEntries(MACHINE_IDS.map((id) => [id, farm.machines[id].ready])) as Record<MachineId, number>,
  line: inLine().length,
  orders: farm.orders.filter((slot) => 'order' in slot).length,
  trip: farm.dispatch.trip >= 0,
  till: { ...farm.market.till },
  day: dayOf(farm.day.t),
})

/** What happened while you were away: what came to be ready to take (each good with how many: the harvest of the beds
 *  that ripened, what the animals and the tree gave, what the machines finished), who joined the line, the orders that
 *  came in and the tractor back home; and what needs you (beds gone dry, a building too full to take what waits). */
export interface AwayReport {
  /** how long you were away, and how much of it the farm went on for (at most AWAY_MOST) */
  seconds: number
  counted: number
  goods: { item: ProduceId; count: number }[]
  buyers: number
  orders: number
  tractor: boolean
  thirsty: number
  full: StoreId[]
  /** what shoppers bought in your shop while you were away, and the coins they left in the till */
  shop: { goods: number; coins: number } | null
  /** a new day began: the contractor has new pieces */
  pieces: boolean
}

function awayReport(before: Snapshot, seconds: number, counted: number): AwayReport {
  const after = snapshot()
  const goods = new Map<ProduceId, number>()
  const add = (item: ProduceId, n: number) => n > 0 && goods.set(item, (goods.get(item) ?? 0) + n)
  farm.beds.forEach((b, i) => {
    if (after.ripe[i] && !before.ripe[i] && b.crop) add(b.crop, yieldOf(b.crop))
  })
  for (const id of PRODUCER_IDS) add(PRODUCERS[id].good, after.stock[id] - before.stock[id])
  for (const id of MACHINE_IDS) {
    const r = machineRecipe(id)
    if (r) add(r.makes, after.ready[id] - before.ready[id])
  }
  // a building is full while something waits that it has no room for
  const waiting = (store: StoreId) =>
    farm.beds.some((b, i) => after.ripe[i] && b.crop && storeOf(b.crop) === store) ||
    PRODUCER_IDS.some((id) => after.stock[id] > 0 && storeOf(PRODUCERS[id].good) === store) ||
    MACHINE_IDS.some((id) => after.ready[id] > 0 && machineRecipe(id) && storeOf(machineRecipe(id)!.makes) === store)
  return {
    seconds,
    counted,
    goods: [...goods].map(([item, count]) => ({ item, count })),
    buyers: Math.max(0, after.line - before.line),
    orders: Math.max(0, after.orders - before.orders),
    tractor: before.trip && !after.trip,
    thirsty: farm.beds.filter((_, i) => bedStage(i) === 'thirsty').length,
    full: STORE_IDS.filter((id) => room(id) <= 0 && waiting(id)),
    shop: after.till.coins > before.till.coins ? { goods: Math.max(0, after.till.goods - before.till.goods), coins: after.till.coins - before.till.coins } : null,
    pieces: after.day !== before.day,
  }
}

/** Whether a report has anything to tell. */
export const awayNews = (r: AwayReport) => r.goods.length > 0 || r.buyers > 0 || r.orders > 0 || r.tractor || r.thirsty > 0 || r.full.length > 0 || r.shop !== null

/** The farm goes on for a time away, as it would have: in steps of 5 s (a bed ripens, an animal fills, a machine
 *  finishes in the step it would have), buyers joining the line as they come, as many as it has room for; shoppers
 *  visit your shop and buy as they would have; the day goes on (frozen or not: a test's frozen light is for play), and
 *  a new day brings the contractor's new pieces. */
function goOn(seconds: number) {
  for (let left = seconds; left > 0; left -= 5) {
    const dt = Math.min(5, left)
    farm.clock += dt
    farm.day.t += dt
    grow(dt)
    shopAway(dt)
  }
  contractorDay()
  if (farm.started) {
    let t = seconds - farm.nextVisitorIn
    let n = 0
    if (t >= 0) {
      n = 1 + Math.floor(t / arrivalSeconds())
      t %= arrivalSeconds()
      farm.nextVisitorIn = arrivalSeconds() - t
    } else farm.nextVisitorIn -= seconds
    for (let i = Math.min(n, placesInLine() - inLine().length); i > 0; i--) spawnVisitor({ queued: true })
  }
}

/** The last time away, until the game has shown it (Welcome back, src/farm/FarmUI.tsx). */
let lastAway: AwayReport | null = null
export const awaySummary = () => lastAway
export const clearAwaySummary = () => {
  lastAway = null
  bump()
}

/** Back after `seconds` away (the page hidden, or closed): the farm goes on for that time (at most three hours), and
 *  what happened is kept for the game to tell, when it was long enough and anything did. */
export function cameBack(seconds: number): AwayReport | null {
  if (!(seconds > 0)) return null
  const counted = Math.min(AWAY_MOST, seconds)
  const before = snapshot()
  goOn(counted)
  const report = awayReport(before, seconds, counted)
  // the morning that came while away is not told as it turns (the contractor's word is for one seen in play)
  lastPhase = phaseOf(farm.day.t)
  if (seconds >= AWAY_TELLS && awayNews(report)) lastAway = report
  bump()
  save()
  return report
}

// the line at the gate as you left it; then the time the page was closed
function resumeFrom(l: ReturnType<typeof load>) {
  for (const b of l.queue) {
    const v = newVisitor(b.want, b.qty, b.offer, 1, b.gift, b.look, b.name)
    farm.visitors.push(v)
    standInLine(v)
  }
  if (l.savedAt) cameBack(Math.max(0, (Date.now() - l.savedAt) / 1000))
}
resumeFrom(loaded)

/** Starts again from scratch (settings, tests). */
export function resetFarm() {
  const f = fresh()
  Object.assign(farm, f)
  forgetWalkers()
  lastAway = null
  saveNow()
  bump()
}

export { saveNow as saveFarm }

// ───────────────────────────── save slots, export and import ─────────────────────────────

export interface SlotSummary {
  slot: Slot
  exists: boolean
  played: boolean // anything planted or sold yet (a brand-new farm says "Enter", not "Continue")
  coins: number
  earned: number
  sold: number
  growing: number // beds with something in them
  animals: number
  savedAt: number | null
}

/** What a slot holds, read without loading it (for the save list). */
export function slotSummary(n: Slot): SlotSummary {
  if (n === slot) saveNow()
  const text = readRaw(keyFor(n))
  const empty: SlotSummary = { slot: n, exists: false, played: false, coins: START_COINS, earned: 0, sold: 0, growing: 0, animals: 0, savedAt: null }
  if (!text) return empty
  const l = load(text)
  return {
    slot: n,
    exists: true,
    played: l.data.started || l.data.stats.sold > 0 || l.data.stats.harvested > 0,
    coins: l.data.coins,
    earned: l.data.stats.earned,
    sold: l.data.stats.sold,
    growing: l.data.beds.filter((b) => b.crop).length,
    animals: PRODUCER_IDS.reduce((n, id) => n + l.data.producers[id].animals, 0),
    savedAt: l.savedAt,
  }
}

/** Plays on another slot: the current farm is saved, the other one loaded (it has grown on meanwhile). */
export function switchSlot(n: Slot) {
  if (n === slot) return
  saveNow()
  slot = n
  KEY = keyFor(n)
  try {
    localStorage.setItem(SLOT_KEY, String(n))
  } catch {
    /* storage blocked */
  }
  const l = load()
  Object.assign(farm, l.data)
  farm.visitors = []
  forgetWalkers()
  const panel = useHome.getState().panel
  if (panel) useHome.getState().closePanel()
  // what happened on the farm left behind is not this one's
  lastAway = null
  resumeFrom(l)
  bump()
}

/** Empties a slot (the current one starts again from scratch). */
export function deleteSlot(n: Slot) {
  try {
    localStorage.removeItem(keyFor(n))
  } catch {
    /* storage blocked */
  }
  if (n === slot) resetFarm()
}

const FILE_KIND = '3d-home-farm-save'

/** A slot as a file to keep on the device (or move to another one). */
export function exportSlot(n: Slot): { name: string; text: string } {
  if (n === slot) saveNow()
  const raw = readRaw(keyFor(n))
  const save = raw ? (JSON.parse(raw) as unknown) : null
  const date = new Date().toISOString().slice(0, 10)
  return {
    name: `3d-home-farm-${n}-${date}.json`,
    text: JSON.stringify({ kind: FILE_KIND, version: 1, slot: n, exportedAt: new Date().toISOString(), save }, null, 1),
  }
}

/** Loads a save file into a slot. Anything odd in it is made safe the same way a stored save is. */
export function importSlot(n: Slot, text: string): { ok: true } | { ok: false; error: string } {
  let file: { kind?: unknown; save?: unknown }
  try {
    file = JSON.parse(text) as typeof file
  } catch {
    return { ok: false, error: 'That file is not a save (it is not JSON).' }
  }
  if (!file || file.kind !== FILE_KIND || !file.save || typeof file.save !== 'object') return { ok: false, error: 'That file is not a 3D Home farm save.' }
  const save = JSON.stringify(file.save)
  const check = load(save)
  if (!check.savedAt && !('coins' in (file.save as object))) return { ok: false, error: 'That save is empty.' }
  try {
    localStorage.setItem(keyFor(n), save)
  } catch {
    return { ok: false, error: 'The browser would not store it (storage full or blocked).' }
  }
  if (n === slot) {
    const l = load()
    Object.assign(farm, l.data)
    farm.visitors = []
    forgetWalkers()
    resumeFrom(l)
    bump()
  }
  return { ok: true }
}
