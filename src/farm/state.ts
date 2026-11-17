import { create } from 'zustand'
import { farmSound, placeSound } from '../audio/sound'
import { coinsFx, farmFx, itemFx, xpFx } from '../fx/fx'
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
  SHED,
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
  LEVELS,
  CONTRACTOR,
  DAY,
  ESTATE,
  HOURS,
  MANAGER,
  SHOP,
  XP_FOR,
  type LadderId,
  type ToolKind,
  type XpAction,
  TOOLS,
  toolLadder,
} from './data'
import { sanitizeXp, savedOnToday, seedXp, levelOf, levelReward, xpAt, unpaidCoins, xpForSale, type Xp } from './xp'
import { CAME_KEPT, boxOf, boxesReached, giftsFor, isOpen as giftOpen, rollArrival, rollBox, sanitizeGifts, settle, waitingBoxes, type Gifts, type Opened, type Prize } from './gifts'
import { claimed, dailyFresh, dailyStatus, dailyView, dayNumber, rollDay, sanitizeDaily, type Daily, type DailyView } from './daily'
import { QUEUE, machineLevel, queuePrice, type MachineActions, type MachineView, type QueueSlot } from './machineView'
import {
  boostOf,
  freshMachine,
  hasPlace,
  insertJob,
  isWorking,
  jobSeconds,
  moveWaiting,
  recipeOf,
  runQueue,
  secondsLeft as queueSecondsLeft,
  takeDone,
  takeWaiting,
  type MachineState,
} from './machines'
import { priceBoosts, priceEvents, priceOf } from './prices'
import { EVENTS, activeAt, canDraw, dateKey, drawGoods, drawPool, freshEvents, luckyNow, markSeen, newsWaiting, priceFactor, sanitizeEvents, speedAt, type Boost, type EventsRecord } from './events'
import { DEFAULT_OUTFIT, garmentById, putOn, sanitizeOutfit, type Outfit } from './outfit'
import { SHOP_LADDERS, clampLevels, freshMarket, ladderPrice, managerPay, managerPct, placesOpen, rollShopper, sanitizeMarket, shopperEvery, shoppersAtOnce, snapPct, type Market } from './market'
import { dailyOffers, offersPerDay, piecePrice, sanitizeContractor, shortMaterials, type Contractor } from './contractor'
import { dayOf, hourOf, isOpen, phaseOf, sinceTurned, untilOpen, untilPhase } from './day'
import type { PersonLook } from '../models/person'
import { CONTRACTOR_LOOK, ESTATE_LOOK, MANAGER_LOOK, rollLook, sanitizeLook } from '../models/look'
import { AGENT_SEAT } from '../data/estate'
import { BROWSE_SPOTS, CONTRACTOR_SPOT, LOT, MANAGER_SPOT, SCREEN, TILL } from '../data/market'
import {
  agentComes,
  agentLeaves,
  contractorComes,
  contractorLeaves,
  hallStands,
  laneEnd,
  managerLeaves,
  payPlace,
  scriptSeconds,
  secondsLeft,
  shopperIn,
  shopperOut,
  shopperPay,
  stepScript,
  walker,
  type Pose,
  type Walker,
} from './script'
import { isComplete, makeOrder, orderKey, orderPay, cratesFor, type Order, type OrderLine, type OrderSlot } from './orders'
import { bringsSurprise, canUpgrade, nextLevel, randomItem, roomIn, rollItems, usedIn } from './storage'
import { GOALS, GOAL_IDS, MOST_STEPS, goalById, goalReward, goalTarget, startStep, type GoalId } from './goals'
import { tripSeconds } from './tractorRoute'
import {
  PARCELS,
  PLACES,
  bedHome,
  boundary,
  canBuyParcel,
  canPlace,
  canPlaceBed,
  canPlaceNew,
  canPlaceThing,
  decorRect,
  defaultLayout,
  freeSpot,
  isPlant,
  joinRun,
  mostOf,
  sanitizeLayout,
  snap,
  toWorld,
  type DecorPiece,
  type FarmLayout,
  type Fit,
  type ParcelId,
  type PlaceId,
  type Placement,
} from './layout'
import { FRUIT, FRUIT_KINDS, SHOP as FARM_SHOP, nextPrice, type FruitKind, type ShopItemView, type ShopKind } from './decor'
import { lockedAt, machineOpensAt, opensAt, recipeUnlock, type UnlockId } from './unlocks'
import { advance, currentStep, sanitizeSteps, skipped, stepsFresh, type StepDef, type StepsRecord } from './firstSteps'
import { fullest, mostAt, needsMet, ownsEach, perTapOf, spreadNest, toolOf, type Steps } from './tools'
import type { ToolView } from './toolView'
import { PIECES, type PieceType } from '../home/catalogue'
import { canMoveOpening, canPlacePiece, defaultHome, findFreeSpot, sanitizeHome, type HomeFit, type HomeLayout, type HomePiece } from '../home/layout'
import { floorById, paintById, type OpeningAt } from '../home/shell'
import type { RoomId } from '../data/layout'

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

/** A machine (MACHINES in src/farm/data.ts): its queue of jobs, its places and how long it has worked
 *  (src/farm/machines.ts). */
export type { MachineState }

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
  /** counts of what the player has done (`watered`: beds watered, from the first steps on; 0 on a farm from before) */
  stats: { harvested: number; sold: number; earned: number; declined: number; baked: number; sent: number; watered: number }
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
  /** levels (src/farm/xp.ts): every XP point gained, and the highest level whose coins were paid */
  xp: Xp
  /** the level's gifts (src/farm/gifts.ts): the boxes on each level's bar opened, and what the levels reached brought */
  gifts: Gifts
  /** the daily gift (src/farm/daily.ts): the last day one was claimed, the streak, what this week's days gave */
  daily: Daily
  /** what the player wears, from the wardrobe's garments (src/farm/outfit.ts) */
  outfit: Outfit
  /** every upgrade ladder's step (LADDERS in ./data): the market's and the contractor's */
  ladders: Record<LadderId, number>
  /** the supermarket (src/farm/market.ts): yours or not, its shelves, the till, the next visit */
  market: Market
  /** the contractor behind the market (src/farm/contractor.ts): the day his offers are for, and the offers */
  contractor: Contractor
  /** the farm's day (src/farm/day.ts): seconds of farm time since the farm began (it goes on while you are away) */
  day: { t: number }
  /** where the player is: the farm or the house, two maps the car drives between (the house only once it is yours) */
  place: Place
  /** the house, bought from the estate agent by the market (a farm from before the two maps has always had it) */
  apartment: { owned: boolean }
  /** the week's events (src/farm/events.ts): the lucky draw of its day, and the events the farm news has shown */
  events: EventsRecord
  /** a new farm's first steps (src/farm/firstSteps.ts): the step it is on, and whether they are over */
  firstSteps: StepsRecord
}

/** The two maps: the farm, and the house you buy and drive to. */
export type Place = 'farm' | 'home'

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
/** Each of a herd's animals gives her own (a count and a clock for each), or they share one (the hens' nest, until the
 *  coop gives each hen hers: src/farm/tools.ts). */
const ownEach = (id: ProducerId) => ownsEach(id, farm.ladders)
/** How many counts a producer keeps, with this many animals (and these ladders: a tool may give each her own). */
const stocksFor = (id: ProducerId, animals: number, ladders: Steps) => (ownsEach(id, ladders) ? animals : 1)
function freshProducer(id: ProducerId): ProducerState {
  const animals = PRODUCERS[id].herd?.start ?? 0
  // (a new farm has no tools)
  const n = stocksFor(id, animals, {})
  return { animals, stock: Array.from({ length: n }, () => PRODUCERS[id].fresh), timer: Array.from({ length: n }, () => 0) }
}
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
    stats: { harvested: 0, sold: 0, earned: 0, declined: 0, baked: 0, sent: 0, watered: 0 },
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
    gifts: giftsFor(0),
    daily: dailyFresh(),
    outfit: { ...DEFAULT_OUTFIT },
    ladders: clampLevels({}),
    market: freshMarket(),
    contractor: { day: -1, offers: [] },
    day: { t: 0 },
    place: 'farm',
    apartment: { owned: false },
    events: freshEvents(),
    firstSteps: stepsFresh(),
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
const OLD_PRODUCERS: Partial<Record<ProducerId, { stock: string; timer: string; animals?: string }>> = {
  tree: { stock: 'lemons', timer: 'lemonTimer' },
  hens: { stock: 'eggs', timer: 'eggTimer', animals: 'hens' },
  cows: { stock: 'milk', timer: 'milkTimer', animals: 'cows' },
  sheep: { stock: 'wool', timer: 'woolTimer', animals: 'sheep' },
}

/** A producer as saved (or as a save from before the tables kept it), made safe, on a farm with these ladders: with
 *  its tool, a count and a clock for each animal (the coop: a nest a hen), each up to the tool's most. */
function savedProducer(id: ProducerId, raw: Record<string, unknown>, ladders: Steps): ProducerState {
  const def = PRODUCERS[id]
  const old = OLD_PRODUCERS[id]
  const saved = field(raw.producers, id)
  // (a save from before the tables kept a list for the cows and the sheep, one count for the nest: it had no tools)
  const oldList = ownsEach(id, {})
  const p = isObject(saved)
    ? saved
    : old
      ? { animals: old.animals ? raw[old.animals] : undefined, stock: oldList ? raw[old.stock] : [raw[old.stock]], timer: oldList ? raw[old.timer] : [raw[old.timer]] }
      : {}
  const animals = def.herd ? int(p.animals, def.herd.start, def.herd.start, def.herd.max) : 0
  const n = stocksFor(id, animals, ladders)
  const most = mostAt(id, ladders)
  return {
    animals,
    stock: Array.from({ length: n }, (_, i) => int(field(p.stock, i), def.fresh, 0, most)),
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

/** A machine's job as a save from before the queue kept it — one recipe, `count` of it at work (`progress` seconds
 *  into them all) or `ready` of it done — as the same jobs in a queue: nothing lost. The done ones are done jobs, the
 *  ones at work jobs one after another, the time they had been at it spent on them in turn (the last is done when the
 *  batch would have been). Three places, and a machine that has not worked yet; one that held more jobs than three
 *  keeps them all and takes no more until there is a place. */
function batchMachine(id: MachineId, m: Record<string, unknown>): MachineState {
  const r = recipeOf(id, m.recipe)
  if (!r) return freshMachine()
  const count = int(m.count, 0, 0, QUEUE.max)
  if (count) {
    const spent = span(m.progress, count * r.seconds)
    const done = Math.min(count, Math.floor(spent / r.seconds))
    return { ...freshMachine(), jobs: Array.from({ length: count }, () => r.id), done, progress: done < count ? spent - done * r.seconds : 0 }
  }
  const ready = int(m.ready, 0, 0, QUEUE.max)
  return { ...freshMachine(), jobs: Array.from({ length: ready }, () => r.id), done: ready }
}

/** A machine as saved (or as a save from before the queue or the tables kept it), made safe: only jobs of its own
 *  recipes, no more than the most places a queue has; the done ones first (as many as were done of those kept), the
 *  one under way no further into it than it takes; its places from three to twelve; the seconds it has worked from 0. */
function savedMachine(id: MachineId, raw: Record<string, unknown>): MachineState {
  const saved = field(raw.machines, id)
  const m = isObject(saved) ? saved : oldMachine(id, raw)
  if (!('jobs' in m)) return batchMachine(id, m)
  const list: unknown[] = Array.isArray(m.jobs) ? m.jobs : []
  const savedDone = int(m.done, 0, 0, list.length)
  const jobs: string[] = []
  let done = 0
  list.forEach((job, i) => {
    const r = recipeOf(id, job)
    if (!r || jobs.length >= QUEUE.max) return
    jobs.push(r.id)
    if (i < savedDone) done++
  })
  const worked = span(m.worked, Number.MAX_SAFE_INTEGER)
  const working = done < jobs.length ? recipeOf(id, jobs[done]) : undefined
  return {
    jobs,
    done,
    progress: working ? span(m.progress, jobSeconds(working, machineLevel(worked).boost)) : 0,
    capacity: int(m.capacity, QUEUE.start, QUEUE.start, QUEUE.max),
    worked,
  }
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

/** The device's clock for the daily gift (src/farm/daily.ts): its calendar day is the gift's day. Tests set their own
 *  (setDailyClock). Here, before the farm first loads: a save's daily gift is read on today. */
let dailyClock: () => number = () => Date.now()
/** Today, on the device's own calendar (a day number of src/farm/daily.ts). */
export const calendarDay = () => dayNumber(dailyClock())

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
    // the ladders first: the animals' tools among them decide how their producers are kept (a farm from before them:
    // as on a new farm; while the shop is not yours, its own ladders read back as 0: only the manager's rate, the
    // contractor's two and the farm shop's)
    data.ladders = clampLevels(raw.ladders, field(raw.market, 'owned') === true)
    // the tree, the nest, the animals and the machines (a save from before the tables kept each in fields of its own)
    for (const id of PRODUCER_IDS) data.producers[id] = savedProducer(id, raw, data.ladders)
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
    // a farm from before the layout keeps everything where it always stood (a bed moves only once it is built; the
    // fruit trees and bushes standing on the farm are their producers' plants)
    data.layout = sanitizeLayout(
      raw.layout,
      data.beds.map((b) => b.built),
    )
    fitPlants(data)
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
    // levels: as saved; a farm from before them starts with XP for what it did (its levels are not paid again). XP
    // saved under an older curve (LEVELS.step 15, before saves marked theirs) is moved onto today's: the same level and
    // the same share of the way to the next, so what was paid, the boxes opened and the clothes worn all stay
    data.xp = sanitizeXp(savedOnToday(raw.xp), seedXp(data.stats))
    // a level's coins come in by themselves as it is reached; a farm saved with some reached and not yet claimed (from
    // when they waited for a Claim) is paid them now, once (the level paid moves up with them)
    const owed = unpaidCoins(data.xp)
    if (owed > 0) {
      data.coins = Math.min(Number.MAX_SAFE_INTEGER, data.coins + owed)
      data.xp.paid = levelOf(data.xp.points)
    }
    // the level's gifts: as saved, never past the boxes the XP reached; a farm from before them finds its own level's
    // boxes reached so far waiting (the levels before are not given again)
    data.gifts = sanitizeGifts(raw.gifts, data.xp.points)
    // the daily gift: as saved (a farm from before it has never claimed one; one that cannot be read has taken today's)
    data.daily = sanitizeDaily(raw.daily, calendarDay())
    // the first steps: as saved (a farm from before them has done them: it never sees them)
    data.firstSteps = sanitizeSteps(raw.firstSteps)
    // the clothes: as saved, each one the wardrobe has at the farm's level (a farm from before it: what it always wore)
    data.outfit = sanitizeOutfit(raw.outfit, levelOf(data.xp.points))
    // the market, the contractor and the day (a farm from before them: as on a new farm)
    data.market = sanitizeMarket(raw.market, data.ladders)
    data.contractor = sanitizeContractor(raw.contractor, offersPerDay(data.ladders.stock))
    data.day = { t: dayClock(field(raw.day, 't')) }
    // the house: yours as saved; a farm from before the two maps always had it, and goes on where it always started,
    // in the house. You are in the house only while it is yours.
    const before = !isObject(raw.apartment)
    data.apartment = { owned: before || field(raw.apartment, 'owned') === true }
    const place = before ? 'home' : field(raw, 'place')
    data.place = place === 'home' && data.apartment.owned ? 'home' : 'farm'
    // the week's events: the lucky draw as saved and the events the news has shown (a farm from before them: none)
    data.events = sanitizeEvents(raw.events)
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
// what a machine makes sells for more at its level (every sale asks src/farm/prices.ts); only once the farm is here: a
// save that loads before it asks nothing of it
priceBoosts((id) => machineLevel(farm.machines[id].worked).boost.coins)

/** Revision counter: bumped whenever something the interface shows has changed. */
export const useFarm = create<{ rev: number }>(() => ({ rev: 0 }))
const bump = () => useFarm.setState((s) => ({ rev: s.rev + 1 }))

let saveTimer: number | undefined
function saveNow() {
  window.clearTimeout(saveTimer)
  saveTimer = undefined
  try {
    const { visitors, clock: _c, orders: board, xp, ...rest } = farm
    // the line at the gate is kept too: buyers wait for you while you are away
    const queue: SavedBuyer[] = visitors.filter((v) => v.phase !== 'leaving').map(({ name, look, want, qty, offer, gift }) => ({ name, look, want, qty, offer, gift }))
    // the orders without their keys (each gets a new one as the farm loads)
    const orders = board.map((slot) => ('order' in slot ? { lines: slot.order.lines, coins: slot.order.coins, surprise: slot.order.surprise } : slot))
    // the XP with the curve it is counted on (src/farm/xp.ts, savedOnToday: a save made under another is moved onto
    // the curve of the game that loads it)
    localStorage.setItem(KEY, JSON.stringify({ ...rest, xp: { ...xp, curve: LEVELS.step }, orders, queue, time: Date.now() }))
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

// ───────────────────────────── the week's events: their clock ─────────────────────────────

/** The week's events (src/farm/events.ts) are judged on the device's clock — but not where the game is tested: under
 *  Vitest, nor on a ?debug page unless it says &events=on (the e2e specs). A test that wants them sets a clock. */
function eventsByDefault() {
  if (import.meta.env.MODE === 'test') return false
  if (typeof location === 'undefined') return true
  const q = new URLSearchParams(location.search)
  return !q.has('debug') || q.get('events') === 'on'
}
let eventClock: (() => number) | null = eventsByDefault() ? () => Date.now() : null
/** While the farm goes on for a time away: the time of the step it is on (each step judged at its own). */
let stepAt: number | null = null
/** The moment the events are judged at (ms of the device's clock), or null when they are off. */
export const eventTime = (): number | null => (eventClock ? (stepAt ?? eventClock()) : null)
/** For the tests: the events on at a time of their own (ms, standing still), on the device's clock again ('device'), or
 *  off (null). */
export function setEventClock(at: number | 'device' | null) {
  eventClock = at === null ? null : at === 'device' ? () => Date.now() : () => at
  bump()
}
/** How much the events on now multiply something (1 with none): how fast crops grow and machines work (the times
 *  left shown are real seconds: divided by it), how often buyers come, how many gifts a sale brings. */
export const eventSpeed = (b: Boost) => speedAt(b, eventTime())
// the lucky draw's goods sell for double on its day, wherever they are sold (every sale prices a good through priceOf)
priceEvents((good) => priceFactor(good, farm.events, eventTime()))
/** The gifts a buyer or an order brings with it, each a building material on the farm's dice: one, two on gift day. */
const rollGifts = () => Array.from({ length: eventSpeed('gifts') }, () => randomItem(random))

// ───────────────────────────── what each level opens: the locks ─────────────────────────────

/** Everything open whatever the level: under Vitest and on a ?debug page unless it says &unlocks=on (the tests buy what
 *  they need), until a test turns the locks on; the game's own pages lock by the level. */
function allOpenByDefault() {
  if (import.meta.env.MODE === 'test') return true
  if (typeof location === 'undefined') return false
  const q = new URLSearchParams(location.search)
  return q.has('debug') && q.get('unlocks') !== 'on'
}
let allOpen = allOpenByDefault()
/** For the tests and the simulation: everything open (true), or locked by the level as in play (false). */
export function unlockAll(on: boolean) {
  allOpen = on
  bump()
}
/** Locked now: the level it opens at; open: null. Every buy, planting and job of the table (src/farm/unlocks.ts) asks
 *  it here, and the interface draws the same answer. Only buying is locked: what the farm has stays, and works. */
export const lockOf = (id: UnlockId): number | null => (allOpen ? null : lockedAt(id, levelOf(farm.xp.points)))
export const isUnlocked = (id: UnlockId) => lockOf(id) === null
/** A machine while every recipe of it is locked: the level it opens at; else null. */
export const machineLock = (id: MachineId): number | null => (allOpen || levelOf(farm.xp.points) >= machineOpensAt(id) ? null : machineOpensAt(id))
/** What a level opens, as the interface tells it (the level-up show, the level's card): nothing while all is open. */
export const opensOn = (level: number) => (allOpen ? [] : opensAt(level))
/** A crop's seeds can be bought now. */
const cropOpen = (crop: CropId) => isUnlocked(`crop:${crop}`)
/** A view's `locked` (the level a thing opens at), only while it is locked. */
const lockField = (locked: number | null) => (locked === null ? {} : { locked })

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
  for (const m of MACHINE_IDS) for (const g of machineDone(m)) if (storeOf(g.item) === id) n += g.count
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
  BEDS.forEach((_, i) => {
    if (i !== index && bedStage(i) === stage && groundDistance(x, z, bedSpot(i), bedBox(i)) <= BED_REACH) out.push(i)
  })
  return out
}

/** Where a bed stands now (its middle, and its quarter turns): built ones can be moved in the edit mode. */
export const bedSpot = (i: number): Placement => farm.layout.beds[i] ?? { x: BEDS[i].x, z: BEDS[i].z, rot: 0 }
/** A bed's frame on the ground, half its size each way, as it stands (turned a quarter, its length runs along z). */
export const bedBox = (i: number) => (bedSpot(i).rot % 2 ? { x: BED_BOX.z, z: BED_BOX.x } : BED_BOX)

/** 0 … 1 */
/** The empty beds near (x, z) that seeds chosen by hand go into: this one, and those within reach not set to grow
 *  something else. */
export const bedsForSeeds = (index: number, crop: CropId, x: number, z: number) => bedsNear(index, 'empty', x, z).filter((i) => i === index || !farm.beds[i].fixed || farm.beds[i].fixed === crop)

export const bedProgress = (i: number) => {
  const b = farm.beds[i]
  return b.crop ? Math.min(1, b.growth / cropById(b.crop).growSeconds) : 0
}

/** Where a bed's crystals (and surprises) fly up from. */
const bedAt = (i: number) => ({ x: bedSpot(i).x, y: 0.7, z: bedSpot(i).z })

export const yieldOf = (crop: CropId) => Math.round(cropById(crop).yield * (farm.compost ? 1.5 : 1))

export function plant(i: number, crop: CropId) {
  const b = farm.beds[i]
  const def = cropById(crop)
  if (!b?.built || b.crop || !cropOpen(crop) || farm.coins < def.seedCost) return false
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
  farm.stats.watered++
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
  if (!b || b.built || BEDS[i]?.expansion || !isUnlocked('bed') || farm.coins < price) return false
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
  // (a crop not open yet cannot be chosen: the button would offer seeds it cannot buy)
  if (!b?.built || (crop && !cropOpen(crop))) return false
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

/** A producer's tool when it is yours (the hens' coop, the cows' bucket, the sheep's shears), else null. */
export const toolOwned = (id: ProducerId): ToolKind | null => toolOf(id, farm.ladders)
/** The most that waits at each of a producer's places before no more come: its tool's, with the tool (src/farm/tools.ts),
 *  else its own (PRODUCERS). Growing, the compass, a save read and time away all ask it. */
export const maxOf = (id: ProducerId) => mostAt(id, farm.ladders)
/** How many one tap of a tool takes now. */
export const perTap = (kind: ToolKind) => perTapOf(kind, farm.ladders)

/** Takes up to `most` of what a producer holds at its place `i` (an animal, a nest; the tree's 0) into its building,
 *  as much as there is room for: counted (the stats, what the farm has got), each good (or each picking of the tree) a
 *  chance of a surprise flying up from `at`, its XP; an animal emptied starts her wait for the next one again (but the
 *  hens: they lay on). What does not fit stays where it is. How many went in, and the surprises found. */
function takeFrom(id: ProducerId, i: number, most: number, at?: At): { n: number; items: ItemId[] } {
  const def = PRODUCERS[id]
  const p = farm.producers[id]
  const has = p.stock[i] ?? 0
  const n = store(def.good, Math.min(has, Math.max(0, Math.floor(most))))
  if (!n) return { n: 0, items: [] }
  p.stock[i] = has - n
  if (!def.keepsClock && !p.stock[i]) p.timer[i] = 0
  farm.stats.harvested += n
  farm.got[def.good] += n
  const items = rollItems(def.surprise === 'each' ? n : 1, def.surprise === 'each' ? ITEM_ODDS.unit : ITEM_ODDS.harvest, random)
  gainItems(items, at)
  gainXp('collect', n, at)
  return { n, items }
}

/** Takes what a producer holds into its building — picks the lemons, collects the eggs, milks a cow, shears a sheep —
 *  as much as there is room for, and starts the wait for the next one again once all of it is taken (but the hens':
 *  they lay on). What does not fit stays where it is. Each egg, bottle and fleece (each picking of the tree) may turn
 *  up a surprise, which flies up from `at`. */
export function collect(id: ProducerId, i = 0, at?: At) {
  const def = PRODUCERS[id]
  const has = stockOf(id, i)
  if (!has) return 0
  const { n, items } = takeFrom(id, i, has, at)
  if (!n) {
    toast(`The ${STORES[storeOf(def.good)].name.toLowerCase()} is full`, storeOf(def.good))
    return 0
  }
  const left = n < has ? ` · the ${STORES[storeOf(def.good)].name.toLowerCase()} is full` : ''
  toast(`+ ${count(def.good, n)}${left}${surpriseWords(items)}`, items[0] ?? def.good)
  bump()
  save()
  return n
}

/**
 * One tap of an animal's tool (its panel): takes as many as a tap takes (1, more with its ladder) from the place tapped
 * — a nest, a cow, a sheep — or, with none chosen, from the fullest (ties: the first), as much as the barn has room for:
 * the same goods, XP and surprises a good as collecting one by one. What does not fit stays on the animal. The crystals
 * fly from low in the middle, as a panel's; no toast but a surprise's. How many were taken (0: none, nothing spent).
 */
export function toolTake(kind: ToolKind, spot?: number): number {
  if (!toolOwned(kind)) return 0
  const stock = farm.producers[kind].stock
  const i = spot ?? fullest(stock)
  if (!Number.isInteger(i) || i < 0 || i >= stock.length) return 0
  const { n, items } = takeFrom(kind, i, perTap(kind))
  if (!n) return 0
  if (items.length) toast(surpriseWords(items).replace(/^ · /, ''), items[0])
  bump()
  save()
  return n
}

/** A tool has come: with the coop, the hens' one nest becomes a nest a hen, every egg kept and the next eggs coming
 *  when they would have (src/farm/tools.ts, spreadNest); the cows and the sheep give their own already. */
function toolBought(kind: ToolKind) {
  const def = PRODUCERS[kind]
  const p = farm.producers[kind]
  if (!def.herd?.shared || p.stock.length === p.animals) return
  const { stock, timer } = spreadNest(
    p.stock.reduce((a, b) => a + b, 0),
    p.timer[0] ?? 0,
    p.animals,
    def.every,
  )
  p.stock = stock
  p.timer = timer
}

/** The eggs the nest box shows: what the hens have laid, all their nests together, up to the six it has room for (with
 *  the coop each hen has her own nest; the box looks as it always did). */
export const eggsShown = () =>
  Math.min(
    PRODUCERS.hens.max,
    farm.producers.hens.stock.reduce((a, b) => a + b, 0),
  )

/** What an animal's tool panel shows (src/farm/toolView.ts): each of its places (a hen's nest, a cow, a sheep) with
 *  what waits there, its most and the way to the next one; how many a tap takes, the room in the barn, and its two
 *  upgrades as chips. */
export function toolView(kind: ToolKind): ToolView {
  const def = PRODUCERS[kind]
  const t = TOOLS[kind]
  const p = farm.producers[kind]
  const most = maxOf(kind)
  const spot = t.spot[0].toUpperCase() + t.spot.slice(1)
  return {
    kind,
    name: t.name,
    good: def.good,
    look: t.look,
    spots: p.stock.map((has, i) => ({
      name: animalName(kind, i) || `${spot} ${i + 1}`,
      has,
      most,
      // (a clock counts to `every`, however fast it runs)
      next: has >= most ? 0 : Math.min(1, (p.timer[i] ?? 0) / def.every),
    })),
    perTap: perTap(kind),
    room: roomFor(def.good),
    store: storeOf(def.good),
    ladders: (['hold', 'tap'] as const).map((part) => {
      const id = toolLadder(kind, part)
      const k = farm.ladders[id]
      return { id, now: LADDERS[id].say(k), next: ladderMaxed(id) ? null : LADDERS[id].say(k + 1), price: ladderNextPrice(id) }
    }),
  }
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

/** The clock runs on (a shared nest's as many times as fast as there are hens): one more for every `every` seconds, up
 *  to the most that waits (its tool's, with one: maxOf); a fleece that is full stops there, its clock held at 0 until
 *  it is shorn. */
function growProducer(id: ProducerId, dt: number) {
  const def = PRODUCERS[id]
  const p = farm.producers[id]
  const rate = def.herd?.shared && !ownEach(id) ? p.animals : 1
  const max = maxOf(id)
  p.stock.forEach((_, i) => {
    if (def.holdsFull && p.stock[i] >= max) return
    p.timer[i] += dt * rate
    while (p.timer[i] >= def.every && !(def.holdsFull && p.stock[i] >= max)) {
      p.timer[i] -= def.every
      if (p.stock[i] < max) p.stock[i]++
    }
    if (def.holdsFull && p.stock[i] >= max) p.timer[i] = 0
  })
}

// ───────────────────────────── the mill, the loom and the oven ─────────────────────────────

// Each machine works through a queue of jobs, one good each (src/farm/machines.ts has its rules): a job goes in with
// its ingredients, the first one waiting starts as soon as the machine is free, and a done job keeps its place until
// it is collected. The machine's level (from how long it has worked) makes its jobs quicker, the XP for them more and
// what it makes dearer wherever it is sold (src/farm/prices.ts).

export type MachineStage = 'idle' | 'working' | 'done'

/** Working while a job is under way (whatever is done before it); done while only done jobs wait; idle with an empty
 *  queue. */
export function machineStage(id: MachineId): MachineStage {
  const m = farm.machines[id]
  return isWorking(m) ? 'working' : m.done > 0 ? 'done' : 'idle'
}

/** What a machine is working on, or else the first thing it has done (null with nothing in its queue). */
export function machineRecipe(id: MachineId): Recipe | null {
  const m = farm.machines[id]
  return recipeOf(id, m.jobs[isWorking(m) ? m.done : 0]) ?? null
}

/** Seconds until every job in a machine's queue is done. */
export const machineSecondsLeft = (id: MachineId) => queueSecondsLeft(id, farm.machines[id]) / eventSpeed('machines')

/** How far the job under way is, 0 to 1 (0 with none). */
export function machineProgress(id: MachineId) {
  const m = farm.machines[id]
  const r = isWorking(m) ? recipeOf(id, m.jobs[m.done]) : undefined
  return r ? Math.min(1, m.progress / jobSeconds(r, boostOf(m))) : 0
}

/** A machine's level now, from how long it has worked (src/farm/machineView.ts). */
export const machineLevelOf = (id: MachineId) => machineLevel(farm.machines[id].worked)

/** Jobs of a machine's queue as the goods they make, each with how many, in the order they come. */
function goodsOf(id: MachineId, jobs: readonly string[]) {
  const out: { recipe: Recipe; item: ProduceId; count: number }[] = []
  for (const job of jobs) {
    const r = recipeOf(id, job)
    if (!r) continue
    const same = out.find((g) => g.recipe === r)
    if (same) same.count++
    else out.push({ recipe: r, item: r.makes, count: 1 })
  }
  return out
}
/** The goods a machine has done, waiting to be collected (the first done first). */
export const machineDone = (id: MachineId) => goodsOf(id, farm.machines[id].jobs.slice(0, farm.machines[id].done))
/** The jobs it has still to do (the one under way first), as the goods they make. */
export const machineToDo = (id: MachineId) => goodsOf(id, farm.machines[id].jobs.slice(farm.machines[id].done))

/** A point of a machine's own frame (MACHINES: its stand, aim and sparkle), where it stands now (it is a movable place
 *  of the edit mode: src/farm/layout.ts). */
export function machinePoint(id: MachineId, [x, y, z]: readonly [number, number, number]) {
  const [wx, wz] = toWorld(farm.layout.places[id], x, z)
  return { x: wx, y, z: wz }
}

/** Where a machine's crystals fly up from: where its sparkles pop. */
const machineAt = (id: MachineId) => machinePoint(id, MACHINES[id].sparkle)
/** A machine's sound, from where it stands. */
function machineSound(id: MachineId, sound: Parameters<typeof farmSound>[0]) {
  const at = machinePoint(id, [0, 0, 0])
  const { pan, near } = placeSound(at.x, at.z)
  farmSound(sound, pan, near)
}

/** A recipe's ingredients are all in store. */
const hasNeeds = (r: Recipe) => Object.entries(r.needs).every(([k, per]) => farm.inv[k as ProduceId] >= (per ?? 0))

/** A recipe is open at the farm's level (src/farm/unlocks.ts). */
const recipeOpen = (id: MachineId, recipe: string) => isUnlocked(recipeUnlock(id, recipe))

/** A job of a recipe could go into a machine's queue now: it is open, a place is free and its ingredients are in store. */
export const canAddJob = (id: MachineId, r: Recipe) => recipeOpen(id, r.id) && hasPlace(farm.machines[id]) && hasNeeds(r)

/** A job into a machine's queue, at the end or at a waiting place: its ingredients are taken now, and it starts as
 *  soon as the machine is free. No XP for it (it can be taken out again, its ingredients back): its job's comes as it
 *  is collected. */
export function addJob(id: MachineId, recipe: string, at?: number): boolean {
  const r = recipeOf(id, recipe)
  if (!r || !recipeOpen(id, r.id) || !hasNeeds(r) || !insertJob(farm.machines[id], r.id, at)) return false
  for (const [k, per] of Object.entries(r.needs)) farm.inv[k as ProduceId] -= per ?? 0
  machineSound(id, MACHINES[id].sounds.load)
  bump()
  save()
  return true
}

/** A waiting job taken out of a machine's queue: its ingredients go back into store (even past full: they were the
 *  farm's). The job under way and the done ones cannot be. */
export function removeJob(id: MachineId, index: number): boolean {
  const r = recipeOf(id, takeWaiting(farm.machines[id], index))
  if (!r) return false
  for (const [k, per] of Object.entries(r.needs)) putBack(k as ProduceId, per ?? 0)
  bump()
  save()
  return true
}

/** A waiting job moved to another waiting place in the queue. */
export function moveJob(id: MachineId, from: number, to: number): boolean {
  if (!moveWaiting(farm.machines[id], from, to)) return false
  bump()
  save()
  return true
}

/** How many of a machine's done jobs would go into store now (the rest would wait in it for room). */
export function machineCollectable(id: MachineId) {
  const m = farm.machines[id]
  const left: Partial<Record<StoreId, number>> = {}
  let n = 0
  for (const job of m.jobs.slice(0, m.done)) {
    const r = recipeOf(id, job)
    if (!r) continue
    const where = storeOf(r.makes)
    const k = left[where] ?? room(where)
    if (k > 0) n++
    left[where] = k - 1
  }
  return n
}

/** Takes every done job out of a machine into store, as many as there is room for (the rest keep their places, done):
 *  how many. Each is worth its XP, more at a higher level of the machine; sparkles, a rustle and a word say what came
 *  out. */
export function collectMachine(id: MachineId) {
  const m = farm.machines[id]
  if (!m.done) return 0
  const first = recipeOf(id, m.jobs[0])
  const taken = takeDone(m, (job) => {
    const r = recipeOf(id, job)
    return !!r && store(r.makes, 1) === 1
  })
  if (!taken.length) {
    const where = first ? storeOf(first.makes) : 'barn'
    toast(`The ${STORES[where].name.toLowerCase()} is full`, where)
    return 0
  }
  const goods = goodsOf(id, taken)
  const counts = MACHINES[id].counts
  if (counts) farm.stats[counts] += taken.length
  for (const g of goods) farm.got[g.item] += g.count
  const at = machineAt(id)
  gainXp('make', taken.length, at, boostOf(m).xp)
  machineSound(id, 'harvest')
  farmFx('harvest', at.x, at.y, at.z, { good: goods[0].item })
  const full = m.done ? recipeOf(id, m.jobs[0]) : undefined
  toast(`+ ${goods.map((g) => count(g.item, g.count)).join(', ')}${full ? ` · the ${STORES[storeOf(full.makes)].name.toLowerCase()} is full` : ''}`, goods[0].item)
  bump()
  save()
  return taken.length
}

/** What the next place in a machine's queue costs (null: it has all twelve). */
export const slotPrice = (id: MachineId) => queuePrice(farm.machines[id].capacity + 1)

/** One more place in a machine's queue, for its price (its card asked first): true when it was bought. */
export function buySlot(id: MachineId): boolean {
  const m = farm.machines[id]
  const price = slotPrice(id)
  if (price === null || m.capacity >= QUEUE.max || machineLock(id) !== null || farm.coins < price) return false
  farm.coins -= price
  m.capacity++
  gainXp('build', 1, machineAt(id))
  toast(`${MACHINES[id].name}: ${m.capacity} places in its queue`)
  bump()
  save()
  return true
}

const percent = (share: number) => `${Math.round(share * 100)}%`

/** What a level reached gives, in a few words: "Oven: level 2 · +20% XP, +20% coins". */
function levelWords(id: MachineId, level: ReturnType<typeof machineLevel>) {
  const b = level.boost
  return `${MACHINES[id].name}: level ${level.n} · +${percent(b.xp)} XP, +${percent(b.coins)} coins${b.speed > 0 ? `, ${percent(b.speed)} quicker` : ''}`
}

/** Works on through the queue, job after job; a level reached is told (once: a level is never lost). */
function growMachine(id: MachineId, dt: number) {
  const m = farm.machines[id]
  if (!isWorking(m)) return
  const before = machineLevel(m.worked).n
  runQueue(id, m, dt)
  const level = machineLevel(m.worked)
  if (level.n > before) toast(levelWords(id, level), MACHINES[id].picture ?? MACHINES[id].recipes[0].makes)
}

/** What a machine's panel shows (src/farm/machineView.ts): its level, its queue as places, what it can make and whether
 *  each can go in now (one not open yet: the level it opens at), and the next place's price. */
export function machineView(id: MachineId): MachineView {
  const def = MACHINES[id]
  const m = farm.machines[id]
  const level = machineLevel(m.worked)
  // (real seconds: a machine rush halves them)
  const fast = eventSpeed('machines')
  const slots = m.jobs.map((job, i): QueueSlot => {
    const r = recipeOf(id, job) ?? def.recipes[0]
    const seconds = jobSeconds(r, level.boost) / fast
    const state = i < m.done ? 'done' : i === m.done ? 'working' : 'waiting'
    return { recipe: r.id, makes: r.makes, state, seconds, left: state === 'done' ? 0 : state === 'working' ? Math.max(0, seconds - m.progress / fast) : seconds }
  })
  const recipes = def.recipes.map((r) => ({
    id: r.id,
    makes: r.makes,
    needs: { ...r.needs },
    have: Object.fromEntries(Object.keys(r.needs).map((k) => [k, farm.inv[k as ProduceId]])),
    seconds: jobSeconds(r, level.boost) / fast,
    can: canAddJob(id, r),
    ...lockField(lockOf(recipeUnlock(id, r.id))),
  }))
  const price = slotPrice(id)
  return { id, name: def.name, level, capacity: m.capacity, slots, recipes, upgrade: price === null ? null : { capacity: m.capacity + 1, price } }
}

/** What a machine's panel can do, the same functions every time for each machine. */
const ACTIONS = Object.fromEntries(
  MACHINE_IDS.map((id): [MachineId, MachineActions] => [
    id,
    {
      add: (recipe, at) => addJob(id, recipe, at),
      remove: (index) => removeJob(id, index),
      move: (from, to) => moveJob(id, from, to),
      collect: () => collectMachine(id),
      buySlot: () => buySlot(id),
    },
  ]),
) as Record<MachineId, MachineActions>
export const machineActions = (id: MachineId): MachineActions => ACTIONS[id]

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
  if (!u || owned(id) || !isUnlocked(`upgrade:${id}`) || farm.coins < price) return false
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
  if (!p || !canBuyParcel(farm.layout, id) || !isUnlocked(`parcel:${id}`) || farm.coins < p.price) return false
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

/** Moves (or turns) a built bed, with what grows in it, to a free spot on your land, on the half-metre grid; one not
 *  built yet stays where it was staked out. */
export function moveBed(i: number, to: Placement): Fit {
  if (!farm.beds[i]?.built) return { ok: false, reason: 'Build it first' }
  const p = { x: snap(to.x), z: snap(to.z), rot: quarter(to.rot) }
  const fit = canPlaceBed(farm.layout, i, p)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, beds: farm.layout.beds.map((b, k) => (k === i ? p : b)) }
  bump()
  save()
  return fit
}

/** Puts a bed back where it was staked out (if that spot is free). */
export function sendBedHome(i: number): Fit {
  const home = bedHome(i)
  if (!farm.beds[i]?.built) return { ok: false, reason: 'Build it first' }
  const fit = canPlaceBed(farm.layout, i, home)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, beds: farm.layout.beds.map((b, k) => (k === i ? home : b)) }
  bump()
  save()
  return fit
}

// ───────────────────────────── the farm's decoration and fruit plants ─────────────────────────────

/** How many of a kind the farm has: standing on it and waiting in its store (what its next price is counted from). */
export const decorOwned = (kind: ShopKind) => farm.layout.decor.filter((d) => d.kind === kind).length + farm.layout.stored[kind]
/** What the next one of a kind costs. */
export const decorPrice = (kind: ShopKind) => nextPrice(FARM_SHOP[kind].price, decorOwned(kind))
/** Whether one more of a kind can be bought: it is open at the farm's level, and a kind has a most (a fruit kind's
 *  plants). */
export const decorForSale = (kind: ShopKind) => decorOwned(kind) < mostOf(kind) && isUnlocked(`decor:${kind}`)

/** Every kind of the farm's shop as it shows it: how many the farm has, the next one's price, and the level it opens at
 *  while it is locked. */
export function shopView(): ShopItemView[] {
  return (Object.keys(FARM_SHOP) as ShopKind[]).map((kind) => {
    const def = FARM_SHOP[kind]
    const price = decorPrice(kind)
    const fruit = isPlant(kind) ? FRUIT[kind as FruitKind].fruit : undefined
    return {
      kind,
      tab: def.tab,
      name: def.name,
      owned: decorOwned(kind),
      price,
      can: decorForSale(kind) && farm.coins >= price,
      ...(fruit ? { fruit } : {}),
      ...lockField(lockOf(`decor:${kind}`)),
    }
  })
}

/** The plants of a fruit kind standing on the farm, in order: its producer's animals. */
function plantsOf(kind: FruitKind, layout: FarmLayout = farm.layout) {
  return layout.decor.filter((d) => d.kind === kind)
}

/** A fruit kind's producer holds as many plants (each a count and a clock) as stand on the farm: a save read, the counts
 *  and clocks of the plants there kept, any more start bare. */
function fitPlants(data: FarmData) {
  for (const kind of FRUIT_KINDS) {
    const n = plantsOf(kind, data.layout).length
    const p = data.producers[kind]
    const max = PRODUCERS[kind].max
    data.producers[kind] = {
      animals: n,
      stock: Array.from({ length: n }, (_, i) => Math.min(max, p.stock[i] ?? 0)),
      timer: Array.from({ length: n }, (_, i) => p.timer[i] ?? 0),
    }
  }
}

/** A new piece stands at a spot: a fruit plant becomes one more of its producer's (bare: its fruit to come), in the order
 *  it stands in the layout. */
function standPiece(d: DecorPiece) {
  farm.layout = { ...farm.layout, decor: [...farm.layout.decor, d], next: Math.max(farm.layout.next, d.id + 1) }
  if (isPlant(d.kind)) {
    const p = farm.producers[d.kind as FruitKind]
    p.animals += 1
    p.stock.push(0)
    p.timer.push(0)
  }
}

/** Where a piece put down by the edit mode goes: on the half-metre grid, a fence or hedge joined to one whose end is
 *  near. */
function landing(kind: ShopKind, id: number, to: Placement): DecorPiece {
  return joinRun(farm.layout, { id, kind, x: snap(to.x), z: snap(to.z), rot: quarter(to.rot) })
}

/** Buys one of a kind (its price tag's card asked first): it waits in the farm's store until put down (the edit mode
 *  puts it down at once where there is room: `placeDecor`). Whether it was bought. */
export function buyDecor(kind: ShopKind): boolean {
  if (!Object.prototype.hasOwnProperty.call(FARM_SHOP, kind) || !decorForSale(kind)) return false
  const price = decorPrice(kind)
  if (!(farm.coins >= price)) return false
  farm.coins -= price
  farm.layout = { ...farm.layout, stored: { ...farm.layout.stored, [kind]: farm.layout.stored[kind] + 1 } }
  gainXp('build')
  bump()
  save()
  return true
}

/** Takes one of a kind out of the store and stands it at a spot, if it fits there: its id, or why not. */
export function placeDecor(kind: ShopKind, to: Placement): Fit & { id?: number } {
  if (!(farm.layout.stored[kind] > 0)) return { ok: false, reason: 'None in your store' }
  const d = landing(kind, farm.layout.next, to)
  const fit = canPlaceNew(farm.layout, kind, d)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, stored: { ...farm.layout.stored, [kind]: farm.layout.stored[kind] - 1 } }
  standPiece(d)
  bump()
  save()
  return { ok: true, id: d.id }
}

/** A free spot for one of a kind near (x, z) (on your land, clear of everything), or null. */
export const freeDecorSpot = (kind: ShopKind, x: number, z: number) => freeSpot(farm.layout, kind, x, z)

/** Moves (or turns) a piece standing on the farm, if it fits there (a fence or hedge joins one whose end is near). */
export function moveDecor(id: number, to: Placement): Fit {
  const d = farm.layout.decor.find((x) => x.id === id)
  if (!d) return { ok: false, reason: 'Not on the farm' }
  const q = landing(d.kind, id, to)
  const fit = canPlaceThing(farm.layout, { kind: 'decor', id }, q)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, decor: farm.layout.decor.map((x) => (x.id === id ? q : x)) }
  bump()
  save()
  return fit
}

/** Where a piece would go if put down at `to` (on the grid, joined to a run's end near it), for the edit mode's drag. */
export const decorLanding = (id: number, to: Placement): Placement => {
  const d = farm.layout.decor.find((x) => x.id === id)
  if (!d) return to
  const q = landing(d.kind, id, to)
  return { x: q.x, z: q.z, rot: q.rot }
}

/** Puts a piece standing on the farm away into the store (put down again later for nothing). A fruit plant's fruit is
 *  picked first, into the silo; while the silo has no room for all of it, the plant stays. */
export function storeDecor(id: number): Fit {
  const k = farm.layout.decor.findIndex((x) => x.id === id)
  if (k < 0) return { ok: false, reason: 'Not on the farm' }
  const d = farm.layout.decor[k]
  if (isPlant(d.kind)) {
    const kind = d.kind as FruitKind
    const i = plantsOf(kind).findIndex((x) => x.id === id)
    if (stockOf(kind, i) > 0) {
      const r = decorRect(d)
      collect(kind, i, { x: (r.minX + r.maxX) / 2, y: PRODUCERS[kind].sparkle, z: (r.minZ + r.maxZ) / 2 })
      if (stockOf(kind, i) > 0) return { ok: false, reason: 'The silo is full: its fruit has nowhere to go' }
    }
    const p = farm.producers[kind]
    p.animals -= 1
    p.stock.splice(i, 1)
    p.timer.splice(i, 1)
  }
  farm.layout = { ...farm.layout, decor: farm.layout.decor.filter((x) => x.id !== id), stored: { ...farm.layout.stored, [d.kind]: farm.layout.stored[d.kind] + 1 } }
  bump()
  save()
  return { ok: true }
}

/** The fruit plant a piece is, with its place among its kind's plants (its producer's animal), or null. */
export function plantOf(id: number): { kind: FruitKind; index: number } | null {
  const d = farm.layout.decor.find((x) => x.id === id)
  if (!d || !isPlant(d.kind)) return null
  const kind = d.kind as FruitKind
  return { kind, index: plantsOf(kind).findIndex((x) => x.id === id) }
}

// ───────────────────────────── the house's furniture ─────────────────────────────

const quarter = (rot: number) => ((Math.round(rot) % 4) + 4) % 4

/** Moves (or turns) a piece of furniture to where it fits; if it does not, nothing moves and the reason comes back. */
export function movePiece(id: string, to: Placement): HomeFit {
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

/** Puts a piece away into storage (what is built in stays, and a screen). */
export function storePiece(id: string) {
  const p = farm.home.pieces.find((q) => q.id === id)
  if (!p || PIECES[p.type].fitted || PIECES[p.type].keep) return false
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
  farm.home = { ...farm.home, pieces: [...farm.home.pieces, q], stored, next: farm.home.next + 1 }
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

/** Slides a doorway, a window or the garden door along its wall, or closes or opens one, where it fits (the house's
 *  shell: src/home/shell.ts); if it does not, nothing changes and the reason comes back. */
export function moveOpening(id: string, at: OpeningAt): HomeFit {
  const fit = canMoveOpening(farm.home, id, at)
  if (!fit.ok) return fit
  farm.home = { ...farm.home, shell: { ...farm.home.shell, openings: { ...farm.home.shell.openings, [id]: { run: at.run, centre: at.centre, closed: at.closed } } } }
  bump()
  save()
  return fit
}

/** Paints a room's walls (its own side of each; null: as it was built), or lays another floor in it. Free. */
export function paintRoom(room: RoomId, paint: string | null) {
  if (paint !== null && !paintById(paint)) return false
  farm.home = { ...farm.home, shell: { ...farm.home.shell, paint: { ...farm.home.shell.paint, [room]: paint } } }
  bump()
  save()
  return true
}
export function floorRoom(room: RoomId, floor: string) {
  if (!floorById(floor)) return false
  farm.home = { ...farm.home, shell: { ...farm.home.shell, floors: { ...farm.home.shell.floors, [room]: floor } } }
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

/** What the farm grows and makes (and what every farm has: lemons, eggs, milk; and the fruit of the trees and bushes
 *  standing on it): what buyers and orders ask for. */
const knownGoods = () =>
  [...new Set<ProduceId>([...farm.planted, ...farm.made, 'lemon', 'egg', 'milk', ...FRUIT_KINDS.filter((k) => farm.producers[k].animals > 0).map((k) => FRUIT[k].fruit)])].filter(isSellable)

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
  return Math.max(1, Math.round(priceOf(want) * qty * factor))
}

/** What `qty` of a good are worth (src/farm/prices.ts: more for what a machine of a higher level makes). */
export const fairPrice = (want: ProduceId, qty: number) => Math.round(priceOf(want) * qty)

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
  const items = v.gift ? rollGifts() : []
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
  const items = o.surprise ? rollGifts() : []
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

// ───────────────────────────── the week's events: the lucky draw and the farm news ─────────────────────────────

/** The most a buyer offers, and an order pays (as the save keeps them). */
const MOST_OFFER = 999
const MOST_PAY = 99_999

/** The events on now (none while they are off). */
export const eventsNow = () => {
  const at = eventTime()
  return at === null ? [] : activeAt(at)
}
/** The goods a lucky draw picks from: those a buyer could ask for (what the farm grows and makes). */
export const luckyPool = () => drawPool(knownGoods())

/**
 * The lucky draw (the farm news, src/farm/news): on its day, once, two goods the farm makes, on the farm's dice. From
 * then until the day ends they sell for double wherever they are sold (priceOf), and what already waits for them pays
 * their part double at once: the buyers in line who ask for one raise their offer, an order on the board its pay by
 * their share of it. No XP: an event is not something the player did. The goods, or null (not its day, or drawn).
 */
export function drawLucky(): ProduceId[] | null {
  const at = eventTime()
  const lucky = luckyNow(at)
  if (at === null || !lucky || !canDraw(farm.events, at)) return null
  const goods = drawGoods(knownGoods(), random)
  if (!goods.length) return null
  const times = EVENTS.lucky.times
  for (const v of inLine()) if (goods.includes(v.want)) v.offer = Math.min(MOST_OFFER, Math.round(v.offer * times))
  // (each order's share in the prices before the draw)
  for (const slot of farm.orders) {
    if (!('order' in slot)) continue
    const o = slot.order
    const all = o.lines.reduce((n, l) => n + priceOf(l.good) * l.want, 0)
    const drawn = o.lines.reduce((n, l) => n + (goods.includes(l.good) ? priceOf(l.good) * l.want : 0), 0)
    if (drawn > 0 && all > 0) o.coins = Math.min(MOST_PAY, Math.round(o.coins * (1 + (drawn / all) * (times - 1))))
  }
  farm.events = { draw: { day: dateKey(lucky.start), goods }, seen: markSeen(farm.events, at) }
  bump()
  save()
  return goods
}

/** The farm news was open: the events on now are shown (its badge goes, but for a draw not made). */
export function sawNews() {
  const seen = markSeen(farm.events, eventTime())
  if (seen === farm.events.seen) return
  farm.events = { ...farm.events, seen }
  bump()
  save()
}

/** What waits in the farm news: the events on that it has not shown, and the lucky draw not made (its badge). */
export const newsBadge = () => newsWaiting(farm.events, eventTime())

// ───────────────────────────── time ─────────────────────────────

const stageKey = () =>
  [
    ...farm.beds.map((_, i) => bedStage(i)),
    ...PRODUCER_IDS.map((id) => farm.producers[id].stock.join(',')),
    // each job a machine finishes (its ding, the button that collects it) and each one that goes in or comes out
    ...MACHINE_IDS.map((id) => `${farm.machines[id].done}/${farm.machines[id].jobs.length}`),
    farm.orders.map((slot) => ('order' in slot ? 'o' : 'w')).join(''),
    farm.dispatch.trip < 0 ? `home ${farm.dispatch.waiting}` : `trip ${farm.dispatch.aboard}`,
    // the shop's shelves and till (a shopper bought), the day's phase and number (the light, the contractor's pieces)
    farm.market.shelves.map((sh) => sh.units).join(','),
    farm.market.till.coins,
    phaseOf(farm.day.t),
    dayOf(farm.day.t),
  ].join('|')

function grow(dt: number) {
  // the harvest festival's crops and the machine rush's jobs go faster (the week's events)
  const crops = eventSpeed('crops')
  const machines = eventSpeed('machines')
  for (const b of farm.beds) {
    if (!b.crop) continue
    const def = cropById(b.crop)
    if (b.growth >= def.growSeconds) continue
    // growth stops while the soil is dry; with sprinklers it never is
    const wet = farm.sprinkler ? dt : Math.min(dt, b.water)
    b.growth = Math.min(def.growSeconds, b.growth + wet * crops)
    if (!farm.sprinkler) b.water = Math.max(0, b.water - dt)
  }
  for (const id of PRODUCER_IDS) growProducer(id, dt)
  for (const id of MACHINE_IDS) growMachine(id, dt * machines)
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
  // (a market day: they come twice as often)
  farm.nextVisitorIn = Math.max(0, farm.nextVisitorIn - dt * eventSpeed('buyers'))
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
    MACHINE_IDS.every((id) => farm.machines[id].jobs.length === 0) &&
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
  stepsOn()
  if (stageKey() !== before) {
    bump()
    save()
  }
}

// ───────────────────────────── a new farm's first steps ─────────────────────────────

/** The first steps (src/farm/firstSteps.ts) are quiet — nothing shown, passed or paid — until their hint is in the game
 *  (plans/first-hour.md, C3): everywhere until then. From then: they run on the game's own pages; under Vitest and on
 *  a ?debug page unless it says &steps=on, they are quiet until a test turns them on. */
const stepsQuietByDefault = () => true
let stepsQuiet = stepsQuietByDefault()
/** For the tests and the simulation: the steps quiet (true), or running as on a new farm's own pages (false). */
export function quietSteps(on: boolean) {
  stepsQuiet = on
  bump()
}
/** The step to show now (null: over, or quiet). */
export const stepNow = () => (stepsQuiet ? null : currentStep(farm.firstSteps))
/** They are running: the daily gift waits for them. */
export const stepsBusy = () => !stepsQuiet && !farm.firstSteps.over
/** The steps passed and not shown yet (the hint's ✓ takes them). */
const passedNow: StepDef[] = []
export const takePassed = () => passedNow.splice(0)
/** The steps passed and not taken yet, left where they are (the hint shows the last of them until it takes them). */
export const passedWaiting = (): readonly StepDef[] => passedNow
/** Skipped from the hint: over, nothing more paid. */
export function skipSteps() {
  farm.firstSteps = skipped(farm.firstSteps)
  bump()
  save()
}
/** Passes the steps the farm has done, paying each one's reward (coins, or goods into their building past full; no XP:
 *  a reward is not something done). Each frame, from `tick`: whatever function changed the farm's numbers, they are
 *  read a frame later. The record is saved as it pays, so a step is never paid twice. */
function stepsOn() {
  if (stepsQuiet || farm.firstSteps.over) return
  const { rec, passed } = advance(farm.firstSteps, farm)
  if (rec === farm.firstSteps) return
  for (const step of passed) give(step.reward)
  farm.firstSteps = rec
  passedNow.push(...passed)
  bump()
  save()
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

/** XP for something the player did: `n` times the action's worth (XP_FOR), or for a sale `n` coins (xpForSale); `more`
 *  a share more (a machine's level: 0.2 is a fifth more, rounded up so that it is never lost to rounding). `at` is
 *  where the crystals fly up from. Only from a player's action: never in tick, goOn or cameBack. The XP gained. */
export function gainXp(action: XpAction | 'sale', n = 1, at?: At, more = 0): number {
  // (a hair under, so that 2 · 5 · 1.2 = 12.000000000000002 is 12)
  const boosted = (xp: number) => (more > 0 ? Math.ceil(xp * (1 + more) - 1e-9) : xp)
  const xp = action === 'sale' ? (n > 0 ? xpForSale(n) : 0) : n > 0 ? boosted(XP_FOR[action] * n) : 0
  if (!(xp > 0)) return 0
  const was = levelOf(farm.xp.points)
  farm.xp.points = Math.min(Number.MAX_SAFE_INTEGER, farm.xp.points + xp)
  xpEvents++
  const now = levelOf(farm.xp.points)
  if (now > was) arrive(was, now)
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

/**
 * A level reached by play (`was` to `now`): what it brings comes in by itself, with no Claim — its coins (LEVELS: every
 * level reached and not yet paid, once: `xp.paid` moves to it) and a small gift rolled on the farm's dice
 * (src/farm/gifts.ts: a few of a building material, into the barn even past full, as surprises go) — remembered for the
 * level-up show and the level's card, which tell it; the boxes on the new level's bar start empty. No XP: a reward is
 * not something the player did.
 */
function arrive(was: number, now: number) {
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + unpaidCoins({ points: xpAt(now), paid: farm.xp.paid }))
  farm.xp.paid = Math.max(farm.xp.paid, now)
  const came = farm.gifts.came.filter((c) => c.level <= was)
  for (let level = was + 1; level <= now; level++) {
    const prize = rollArrival(level, random)
    give(prize)
    came.push({ level, coins: levelReward(level), prize })
  }
  farm.gifts = { ...farm.gifts, gave: [], came: came.slice(-CAME_KEPT) }
}

/** A prize into the farm: coins, or goods into their building even past full (as surprises go: refused, they would
 *  be lost). */
function give(p: Prize) {
  if ('coins' in p) farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + p.coins)
  else putBack(p.item, p.n)
}

/** The boxes reached and waiting to be opened, oldest first: this level's and every level's before. */
export const giftsWaiting = () => waitingBoxes(farm.gifts, farm.xp.points)

/**
 * Opens gift boxes (`boxes`, or every one waiting): each one reached and not yet open is rolled on the farm's dice and
 * given at once (coins, or goods into their building even past full); a box already open, or not reached, gives
 * nothing — none is ever given twice. What each gave, oldest first. No XP: a reward is not something done.
 */
export function openGifts(boxes?: readonly number[]): Opened[] {
  const g = farm.gifts
  const reached = boxesReached(farm.xp.points)
  const level = levelOf(farm.xp.points)
  const list = [...new Set(boxes ?? giftsWaiting())].filter((k) => Number.isInteger(k) && k >= 0 && k < reached && !giftOpen(g, k)).sort((a, b) => a - b)
  if (!list.length) return []
  const out = list.map((box): Opened => ({ box, prize: rollBox(box, farm.made, random) }))
  for (const o of out) give(o.prize)
  const { open, also } = settle(g.open, [...g.also, ...list])
  // what this level's boxes gave stays on its bar (an older level's is gone from view)
  const gave = [...g.gave, ...out].filter((o) => boxOf(o.box).level === level).sort((a, b) => a.box - b.box)
  farm.gifts = { open, also, gave, came: g.came, seen: g.seen }
  // (its sound, and its touch, come as it bursts open in the level's card)
  bump()
  save()
  return out
}

/** The level's card has told the level reached (what it brought by itself): not again. */
export function sawLevel() {
  const level = levelOf(farm.xp.points)
  if (farm.gifts.seen >= level) return
  farm.gifts = { ...farm.gifts, seen: level }
  bump()
  save()
}

// ───────────────────────────── the daily gift ─────────────────────────────

/** For the tests: the daily gift's clock (null: the device's own again). A day changing is seen at once. */
export function setDailyClock(f: (() => number) | null) {
  dailyClock = f ?? (() => Date.now())
  bump()
}

/** Put out of the way (the tests that do not test it: src/farm/daily.ts never opens by itself, nor shows on the menu).
 *  The card open is closed. Not kept: a page loaded again has it as always. */
let dailyQuiet = false
export function quietDaily(on: boolean) {
  dailyQuiet = on
  if (on && useHome.getState().panel?.kind === 'daily') useHome.getState().closePanel()
  bump()
}

/** The daily gift's card as it stands today (./DailyCard.tsx). */
export const dailyNow = (): DailyView => dailyView(farm.daily, calendarDay(), levelOf(farm.xp.points))

/** Today's gift waits for the player: it can be claimed, on a farm that has begun (one that has planted: a new farm's
 *  first minutes are for learning to play) and is through its first steps, and it is not put out of the way. The menu
 *  in the corner shows it then. */
export const dailyWaiting = () => !dailyQuiet && farm.started && !stepsBusy() && dailyStatus(farm.daily, calendarDay()).ready

/** Today's gift opens by itself: it waits, and it has not opened by itself today (it does once a day, then only from
 *  the menu). */
export const dailyDue = () => dailyWaiting() && farm.daily.offered !== calendarDay()

/** The card opened by itself today: not again today. */
export function offerDaily() {
  const day = calendarDay()
  if (farm.daily.offered === day) return
  farm.daily = { ...farm.daily, offered: day }
  bump()
  save()
}

/**
 * Claims today's gift: rolled on the farm's dice (src/farm/daily.ts, rollDay) for the week's day it is, at the farm's
 * level, and given at once — coins, or goods into their building even past full (as surprises go); the streak goes on
 * (a missed day forgiven) or a new week starts. What it gave, or null when there is none today (taken already, or the
 * clock before the last day claimed): never twice. No XP: a gift is not something done.
 */
export function claimDaily(): Prize[] | null {
  const day = calendarDay()
  const s = dailyStatus(farm.daily, day)
  if (!s.ready) return null
  const prizes = rollDay(s.day, levelOf(farm.xp.points), farm.made, random)
  const next = claimed(farm.daily, day, prizes)
  if (!next) return null
  for (const p of prizes) give(p)
  farm.daily = next
  // (its sound and its touch come as it bursts open on its card)
  bump()
  save()
  return prizes
}

/**
 * What waits to be collected on the farm now, the kind worth the most XP — the ripe beds of one crop (each bed's XP),
 * a tree's or an animal's goods (each good's), a machine's jobs done (each job's, more at its level) — counted only
 * where its building has room for all of it; null when nothing does. For the level's card: how far collecting it
 * takes the bar (its own numbers: XP_FOR, as collecting gives).
 */
export function readyOnFarm(): { id: ProduceId; n: number; xp: number } | null {
  let best: { id: ProduceId; n: number; xp: number } | null = null
  const consider = (id: ProduceId, n: number, xp: number) => {
    if (n > 0 && xp > 0 && roomFor(id) >= n && (!best || xp > best.xp)) best = { id, n, xp }
  }
  const beds = new Map<CropId, number>()
  farm.beds.forEach((b, i) => {
    if (b.crop && bedStage(i) === 'ripe') beds.set(b.crop, (beds.get(b.crop) ?? 0) + 1)
  })
  for (const [crop, k] of beds) consider(crop, k * yieldOf(crop), k * XP_FOR.harvest)
  for (const id of PRODUCER_IDS) {
    const n = farm.producers[id].stock.reduce((a, b) => a + b, 0)
    consider(PRODUCERS[id].good, n, n * XP_FOR.collect)
  }
  for (const id of MACHINE_IDS) {
    // a job makes one good; its XP as collecting gives it (gainXp's share more, rounded up)
    const more = boostOf(farm.machines[id]).xp
    for (const g of machineDone(id)) consider(g.item, g.count, more > 0 ? Math.ceil(XP_FOR.make * g.count * (1 + more) - 1e-9) : XP_FOR.make * g.count)
  }
  return best
}

/** Claims the coins of every level reached and not yet paid, up to level `upTo` (the level the chip shows: XP still
 *  flying to it as crystals is not claimed yet); returns them (0 when none wait). */
export function claimLevel(upTo?: number): number {
  const reached = levelOf(farm.xp.points)
  const level = upTo === undefined ? reached : Math.min(reached, Math.floor(upTo))
  if (!(level > farm.xp.paid)) return 0
  const coins = unpaidCoins({ points: xpAt(level), paid: farm.xp.paid })
  if (!(coins > 0)) return 0
  farm.coins = Math.min(Number.MAX_SAFE_INTEGER, farm.coins + coins)
  farm.xp.paid = level
  toast(`Level ${level} · + ${coins} coins`, 'coin')
  farmSound('coins')
  bump()
  save()
  return coins
}

// ───────────────────────────── the wardrobe ─────────────────────────────

/** Puts on a garment from the wardrobe (one the level has; a hat worn already comes off). True when what is worn
 *  changed. Nothing is paid and nothing is gained: it is only clothes. */
export function wearGarment(id: string): boolean {
  const next = putOn(farm.outfit, id, levelOf(farm.xp.points))
  if (next === farm.outfit || (next.shirt === farm.outfit.shirt && next.trousers === farm.outfit.trousers && next.hat === farm.outfit.hat)) return false
  farm.outfit = next
  if (garmentById(id)) farmSound('dress')
  bump()
  save()
  return true
}

/** The wardrobe has shown every garment up to the level reached: none is marked new any more. */
export function sawWardrobe() {
  const level = levelOf(farm.xp.points)
  if (farm.outfit.seen >= level) return
  farm.outfit = { ...farm.outfit, seen: level }
  bump()
  save()
}

// ───────────────────────────── the supermarket ─────────────────────────────

/** Where the crystals and the coins fly from: the farm shop's shed, the manager, the computer, the till, the
 *  contractor. */
const AT_SHED: At = { x: SHED.x, y: 1.6, z: SHED.z }
const AT_MANAGER: At = { x: MANAGER_SPOT.x, y: 1.6, z: MANAGER_SPOT.z }
const AT_SCREEN: At = { x: SCREEN.x, y: SCREEN.y, z: SCREEN.z }
const AT_TILL: At = { x: TILL.x, y: TILL.y, z: TILL.z }
const AT_CONTRACTOR: At = { x: CONTRACTOR_SPOT.x, y: 1.6, z: CONTRACTOR_SPOT.z }

/** What the manager pays for the whole stack of a good now (0: he does not buy it, or it comes to nothing). */
export function managerPays(item: ProduceId): number {
  if (farm.market.owned || !isSellable(item)) return 0
  return managerPay(priceOf(item), farm.inv[item], managerPct(farm.ladders.rate))
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

/** Drives to the other map (the farm, or the house once it is yours); whether you went. The scene follows
 *  `farm.place`: it shows that map and puts you out of the car there (src/data/maps.ts, ARRIVE). */
export function driveTo(to: Place): boolean {
  if (to === farm.place || (to === 'home' && !farm.apartment.owned)) return false
  farm.place = to
  bump()
  save()
  return true
}

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

/** Whether a ladder's next step can be bought now (its place is open, not at its top): the farm shop's once what it
 *  waits for is there (a tool its herd full, a tool's upgrades the tool, the animals' remote a tool; src/farm/tools.ts),
 *  the manager's rate while the shop is not yours, the shop's own once it is, the contractor's while he is there. */
export function ladderOpen(id: LadderId): boolean {
  if (ladderMaxed(id)) return false
  if (LADDERS[id].at === 'shop') return needsMet(LADDERS[id].needs, farm)
  if (id === 'rate') return !farm.market.owned
  if (SHOP_LADDERS.includes(id)) return farm.market.owned
  return contractorHere()
}

/** Where the crystals of a ladder's step fly from: the one you bought it from (the farm shop's: its shed). */
const ladderAt = (id: LadderId) => (LADDERS[id].at === 'shop' ? AT_SHED : id === 'rate' ? AT_MANAGER : SHOP_LADDERS.includes(id) ? AT_SCREEN : AT_CONTRACTOR)

/** Buys a ladder's next step (its card asked first); whether it was bought. It works at once: a busier shop's next
 *  visit comes no later than the new wait, more pieces bring one more today, a better deal is the price from now on. */
export function buyLadder(id: LadderId): boolean {
  const price = ladderNextPrice(id)
  if (!ladderOpen(id) || farm.coins < price) return false
  // today's pieces as they were before this step (one more is added to them below)
  if (id === 'stock') contractorDay()
  farm.coins -= price
  farm.ladders[id] += 1
  if (LADDERS[id].tool?.part === 'tool') toolBought(LADDERS[id].tool.kind)
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

/** Weighs goods for drawing (triangles of one unit each): set by the scene (goodsTriangles, registered in
 *  src/farm/Market.tsx), asked only by marketFill's `mixed`, once; with none set, `mixed` takes the first ten goods
 *  that sell. */
let weigher: ((ids: readonly ProduceId[]) => Record<string, number>) | null = null
let heaviest: ProduceId[] | null = null
export function weighGoods(fn: (ids: readonly ProduceId[]) => Record<string, number>) {
  weigher = fn
  heaviest = null
}
/** The goods that sell, the heaviest to draw first (as they are when nothing weighs them). */
function heaviestGoods(): ProduceId[] {
  if (heaviest) return heaviest
  if (!weigher) return SELLABLE
  const w = weigher(SELLABLE)
  heaviest = SELLABLE.map((id, k) => ({ id, k, n: w[id] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.k - b.k)
    .map((g) => g.id)
  return heaviest
}

/** Tests: the shop yours, every place open and full of `item` (the heaviest good to draw by default). `mixed`: each
 *  place a different good instead, the heaviest ten. `shoppers`: MOST_SHOPPERS people standing still, as many inside
 *  as ever are in play (MOST_INSIDE: at the browse spots, at the counter and in its line, then on the ways in) and the
 *  rest on the lane in front, until a marketFill without it (the market at its fullest, for measuring what it draws).
 *  `quiet`: nobody about and no visit coming, until a marketFill without it (views elsewhere, measured the same every
 *  time: a shopper in the doorway would let what is inside be seen). */
export function marketFill(item: ProduceId = 'corn', opts: { shoppers?: boolean; mixed?: boolean; quiet?: boolean } = {}) {
  if (!isSellable(item)) return
  farm.market.owned = true
  farm.ladders.places = LADDERS.places.levels
  const goods = opts.mixed ? heaviestGoods() : []
  farm.market.shelves.forEach((s, k) => Object.assign(s, { good: goods[k] ?? item, units: SHOP.units }))
  if (opts.shoppers) standShoppers()
  else if (opts.quiet) {
    // nobody about and nobody coming: a view of the farm is the same however long it is measured
    shoppers = []
    standing = true
  } else if (standing) {
    shoppers = []
    standing = false
  }
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
 *  src/farm/Visitors.tsx, less the contractor's, the estate agent's and the tractor driver's; the manager walks out in
 *  one of these). As
 *  many as the top of both ladders has about at once (group 3, pace 4: up to 14), so the shop keeps the ladders' pace. */
export const MOST_SHOPPERS = 14
/** The most of them ever inside the market at once (its rooms and its doorway), at the top of both ladders: measured by
 *  playing the shop for hours (src/farm/state.market.test.ts); the rest of those about are on the lane. */
export const MOST_INSIDE = 6
/** The lane in front of the market, where those about but not inside stand when the shop is filled for measuring. */
const LANE_IN_FRONT = { x0: 0, x1: LOT[0].x1 } as const
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

/** The shoppers stand still where marketFill put them (they neither walk nor come). */
let standing = false
/** MOST_SHOPPERS people standing still, the fullest the shop ever is in play: MOST_INSIDE inside — one at each browse
 *  spot, browsing; one paying at the counter and the line behind; then on the ways in, facing the way they go — and the
 *  rest walking the lane in front of it. */
function standShoppers() {
  const at: { x: number; z: number; heading: number; pose: Pose; spot: number }[] = []
  BROWSE_SPOTS.forEach((b, spot) => at.push({ ...b, pose: 'browse', spot }))
  for (let k = 0; k < BROWSE_SPOTS.length; k++) at.push({ ...payPlace(k), pose: k ? 'stand' : 'pay', spot: k })
  for (const p of hallStands(MOST_INSIDE - at.length, at)) at.push({ ...p, pose: 'stand', spot: 0 })
  const inside = at.slice(0, MOST_INSIDE)
  const lane = MOST_SHOPPERS - inside.length
  const { x0, x1 } = LANE_IN_FRONT
  for (let k = 0; k < lane; k++) inside.push({ x: x0 + ((x1 - x0) * (k + 0.5)) / lane, z: WALK_Z, heading: k % 2 ? -Math.PI / 2 : Math.PI / 2, pose: 'stand', spot: 0 })
  shoppers = inside.map((p) => ({
    ...walker(p.x, p.z, p.heading, []),
    pose: p.pose,
    id: -(100 + ++shopperSeq),
    look: rollLook(random),
    phase: 'in' as const,
    spot: p.spot,
    side: 1 as const,
  }))
  standing = true
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
  for (const s of standing ? [] : shoppers.slice()) {
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
  standing = false
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
  // filled for measuring (marketFill): those standing stay as they are, and no one comes
  if (!m.owned || standing) return
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

/** He is at his window in his hours (HOURS in ./data: the morning, noon and the evening), once he has walked back to it
 *  from the lane in the morning (the window does not trade while it is empty); at night he is off. */
export function contractorHere(): boolean {
  const t = farm.day.t
  if (!isOpen('contractor', t)) return false
  const since = intoPhase(t)
  const turned = !isOpen('contractor', t - since - 1)
  return !(turned && since < COMES_SECONDS)
}
/** How long his walk back to the window takes (from the lane's east end). */
const COMES_SECONDS = scriptSeconds(LANE_ENDS[1], WALK_Z, contractorComes(), VISITOR.speed)
/** The seconds until he is at his window again (0 while he is): for the window's wait. */
export function contractorBackIn(): number {
  if (contractorHere()) return 0
  const t = farm.day.t
  const first = HOURS.contractor[0]
  // walking back in now, or away until his hours begin and then the walk
  return isOpen('contractor', t) ? COMES_SECONDS - intoPhase(t) : untilPhase(t, first) + COMES_SECONDS
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

// ───────────────────────────── the estate agent ─────────────────────────────

const AGENT_ID = -3
const AGENT_DRESS = steadyLook(4271, ESTATE_LOOK)
const sittingAgent: Person = { id: AGENT_ID, ...walker(AGENT_SEAT.x, AGENT_SEAT.z, AGENT_SEAT.heading, []), pose: 'sit', look: AGENT_DRESS }
/** How long his walk in takes in the morning (from the lane's west end to his chair), and out at four. */
const AGENT_COMES = scriptSeconds(LANE_ENDS[0], WALK_Z, agentComes(), VISITOR.speed)
const AGENT_GOES = scriptSeconds(AGENT_SEAT.x, AGENT_SEAT.z, agentLeaves(), VISITOR.speed)
/** Where the crystals fly up from when the house is bought: his desk. */
const AT_AGENT: At = { x: AGENT_SEAT.x, y: 1.2, z: AGENT_SEAT.z - 0.4 }

/** The estate office is open (HOURS.estate: 8:00 to 16:00): its door opens for you (he may still be on his way in). */
export const estateOpen = () => isOpen('estate', farm.day.t)
/** The seconds until it opens (0 while it is open). */
export const estateOpensIn = () => untilOpen('estate', farm.day.t)
/** The estate agent is at his desk: in the office's hours, once he has walked in from the lane. */
export function agentHere(): boolean {
  const t = farm.day.t
  return isOpen('estate', t) && sinceTurned('estate', t) >= AGENT_COMES
}
/** The seconds until he is at his desk again (0 while he is): walking in now, or away until the office opens and then
 *  the walk. */
export function agentBackIn(): number {
  if (agentHere()) return 0
  const t = farm.day.t
  return isOpen('estate', t) ? AGENT_COMES - sinceTurned('estate', t) : untilOpen('estate', t) + AGENT_COMES
}

/** The estate agent as the day's clock has him, a function of the clock alone: walking in from the lane as the
 *  office opens, sitting at his desk through its hours, walking out (a wave first) as it closes, away the rest. */
let agentWalk: { key: string; at: number; who: Person } | null = null
export function estateAgentNow(): Walking | null {
  const t = farm.day.t
  const open = isOpen('estate', t)
  const since = sinceTurned('estate', t)
  const coming = open && since < AGENT_COMES
  const going = !open && since < AGENT_GOES
  if (!coming && !going) {
    agentWalk = null
    return open ? sittingAgent : null
  }
  const key = `${dayOf(t)} ${open ? 'in' : 'out'}`
  if (agentWalk?.key !== key || since < agentWalk.at) {
    const start = coming ? { x: LANE_ENDS[0], z: WALK_Z, heading: Math.PI / 2 } : AGENT_SEAT
    agentWalk = { key, at: 0, who: { id: AGENT_ID, ...walker(start.x, start.z, start.heading, coming ? agentComes() : agentLeaves()), look: AGENT_DRESS } }
    if (!coming) agentWalk.who.pose = 'sit'
  }
  const done = stepScript(agentWalk.who, since - agentWalk.at, VISITOR.speed)
  agentWalk.at = since
  return going && done ? null : agentWalk.who
}

/** Buys the house from the estate agent, at his desk in the office's hours, for ESTATE.price; whether it was bought.
 *  The car then drives you there (src/farm/car). */
export function buyApartment(): boolean {
  if (farm.apartment.owned || !agentHere() || !(farm.coins >= ESTATE.price)) return false
  farm.coins -= ESTATE.price
  farm.apartment.owned = true
  gainXp('home', 1, AT_AGENT)
  toast('The house is yours', 'key')
  farmSound('keys')
  bump()
  save()
  return true
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
  /** what each machine has done, each good with how many */
  made: Record<MachineId, { item: ProduceId; count: number }[]>
  line: number
  orders: number
  trip: boolean
  till: { coins: number; goods: number }
  day: number
}

const snapshot = (): Snapshot => ({
  ripe: farm.beds.map((_, i) => bedStage(i) === 'ripe'),
  stock: Object.fromEntries(PRODUCER_IDS.map((id) => [id, farm.producers[id].stock.reduce((a, b) => a + b, 0)])) as Record<ProducerId, number>,
  made: Object.fromEntries(MACHINE_IDS.map((id) => [id, machineDone(id).map(({ item, count }) => ({ item, count }))])) as Snapshot['made'],
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
  // what the machines finished: every job done now that was not done before (none is collected while away)
  const doneOf = (made: Snapshot['made'][MachineId], item: ProduceId) => made.find((g) => g.item === item)?.count ?? 0
  for (const id of MACHINE_IDS) for (const g of after.made[id]) add(g.item, g.count - doneOf(before.made[id], g.item))
  // a building is full while something waits that it has no room for
  const waiting = (store: StoreId) =>
    farm.beds.some((b, i) => after.ripe[i] && b.crop && storeOf(b.crop) === store) ||
    PRODUCER_IDS.some((id) => after.stock[id] > 0 && storeOf(PRODUCERS[id].good) === store) ||
    MACHINE_IDS.some((id) => after.made[id].some((g) => storeOf(g.item) === store))
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
 *  a new day brings the contractor's new pieces. The week's events count for each step at its own time (`from`: when
 *  the time away began, by the events' clock): one that began or ended while you were away, only for its part. */
function goOn(seconds: number, from: number | null = null) {
  // the seconds the buyers' countdown ran beyond the time (twice as fast on a market day)
  let more = 0
  let into = 0
  try {
    for (let left = seconds; left > 0; left -= 5) {
      const dt = Math.min(5, left)
      if (from !== null) stepAt = from + into * 1000
      farm.clock += dt
      farm.day.t += dt
      grow(dt)
      shopAway(dt)
      more += dt * (eventSpeed('buyers') - 1)
      into += dt
    }
  } finally {
    stepAt = null
  }
  contractorDay()
  if (farm.started) {
    const ran = seconds + more
    let t = ran - farm.nextVisitorIn
    let n = 0
    if (t >= 0) {
      n = 1 + Math.floor(t / arrivalSeconds())
      t %= arrivalSeconds()
      farm.nextVisitorIn = arrivalSeconds() - t
    } else farm.nextVisitorIn -= ran
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
  // the time away began `seconds` ago, by the events' clock
  const now = eventTime()
  goOn(counted, now === null ? null : now - seconds * 1000)
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
  // (the steps passed on the farm before are not this one's to show)
  takePassed()
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
  /** its level (from its saved XP): the save list's star */
  level: number
  savedAt: number | null
}

/** What a slot holds, read without loading it (for the save list). */
export function slotSummary(n: Slot): SlotSummary {
  if (n === slot) saveNow()
  const text = readRaw(keyFor(n))
  const empty: SlotSummary = { slot: n, exists: false, played: false, coins: START_COINS, earned: 0, sold: 0, growing: 0, animals: 0, level: 1, savedAt: null }
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
    level: levelOf(l.data.xp.points),
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
  takePassed()
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
    // (the steps passed on the farm before are not this one's to show)
    takePassed()
    resumeFrom(l)
    bump()
  }
  return { ok: true }
}
