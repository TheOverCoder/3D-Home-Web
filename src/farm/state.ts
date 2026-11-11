import { create } from 'zustand'
import { farmSound, placeSound } from '../audio/sound'
import { coinsFx, itemFx } from '../fx/fx'
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
  PACE_LEVELS,
  PRODUCE,
  PRODUCERS,
  PRODUCER_IDS,
  QUEUE_LEVELS,
  SELLABLE,
  START_COINS,
  STORES,
  STORE_IDS,
  UPGRADES,
  VISITOR,
  WALK_Z,
  WATER_SHARE,
  arrivalEvery,
  count,
  cropById,
  isItem,
  mostAnimals,
  produceById,
  queuePlaces,
  queueSpot,
  storeCapacity,
  storeOf,
  type CropId,
  type Expansion,
  type ItemId,
  type MachineId,
  type ProduceId,
  type ProducerId,
  type Recipe,
  type StoreId,
  type UpgradeId,
} from './data'
import { bringsSurprise, canUpgrade, nextLevel, randomItem, roomIn, rollItems, usedIn } from './storage'
import { PARCELS, PLACES, canBuyParcel, canPlace, defaultLayout, sanitizeLayout, snap, type FarmLayout, type Fit, type ParcelId, type PlaceId, type Placement } from './layout'
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

export interface Look {
  shirt: string
  trousers: string
  skin: string
  hair: string
  hairStyle: 0 | 1 | 2 // short, long, bun
  hat: boolean
  height: number
}

export interface Visitor {
  id: number
  name: string
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
  stats: { harvested: number; sold: number; earned: number; declined: number; baked: number }
  visitors: Visitor[]
  /** where the movable places stand, and the fields bought (src/farm/layout.ts) */
  layout: FarmLayout
  /** where the house's furniture stands, and what is in storage (src/home/layout.ts) */
  home: HomeLayout
  nextVisitorIn: number // counts down to the next buyer (it holds at zero while the line is full)
  clock: number // seconds of farm time since the page opened
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
    stats: { harvested: 0, sold: 0, earned: 0, declined: 0, baked: 0 },
    visitors: [],
    layout: defaultLayout(),
    home: defaultHome(),
    nextVisitorIn: VISITOR.firstAfter,
    clock: 0,
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
/** A good buyers ask for (not a building material). */
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

const isColour = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
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
  const l = (b.look ?? {}) as Partial<Look>
  if (!isSellable(b.want) || !l || !isColour(l.shirt) || !isColour(l.trousers) || !isColour(l.skin) || !isColour(l.hair)) return null
  return {
    name: typeof b.name === 'string' && b.name.length <= 24 ? b.name : NAMES[0],
    look: {
      shirt: l.shirt,
      trousers: l.trousers,
      skin: l.skin,
      hair: l.hair,
      hairStyle: l.hairStyle === 1 || l.hairStyle === 2 ? l.hairStyle : 0,
      hat: !!l.hat,
      height: Math.min(1.08, Math.max(0.9, num(l.height, 1))),
    },
    want: b.want,
    qty: int(b.qty, 1, 1, 12),
    offer: int(b.offer, 1, 1, 999),
    gift: b.gift === true,
  }
}

/** The most a building's level can be read as (there is no end to them in play; a number past this is no level). */
const MOST_LEVEL = 1e6

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
    // a farm from before the layout keeps everything where it always stood
    data.layout = sanitizeLayout(raw.layout)
    // a farm from before the house could be furnished keeps today's furniture where it always stood
    data.home = sanitizeHome(raw.home)
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
    const { visitors, clock: _c, ...rest } = farm
    // the line at the gate is kept too: buyers wait for you while you are away
    const queue: SavedBuyer[] = visitors.filter((v) => v.phase !== 'leaving').map(({ name, look, want, qty, offer, gift }) => ({ name, look, want, qty, offer, gift }))
    localStorage.setItem(KEY, JSON.stringify({ ...rest, queue, time: Date.now() }))
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

/** The farm's dice for its surprises: Math.random, unless a test sets its own. */
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

/** Puts in a surprise: always taken in, even past full (refused, it would be lost). */
function putBack(id: ProduceId, n: number) {
  farm.inv[id] += n
}

/** What the toast says about surprises, after what else it says ("· Surprise: a brick"). */
const surpriseWords = (items: ItemId[]) => (items.length ? ` · Surprise: ${[...new Set(items)].map((i) => count(i, items.filter((x) => x === i).length)).join(', ')}` : '')

/** Surprises into the barn (always: they are what makes it bigger), each flying up from where it was found to the
 *  barn's chip at the top. */
function gainItems(items: ItemId[], at?: { x: number; y: number; z: number }) {
  for (const item of items) putBack(item, 1)
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
    got.set(b.crop, (got.get(b.crop) ?? 0) + n)
    total += n
    b.crop = null
    b.growth = 0
    b.water = 0
    const items = rollItems(1, ITEM_ODDS.harvest, random)
    gainItems(items, { x: BEDS[i].x, y: 0.7, z: BEDS[i].z })
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
  const items = rollItems(def.surprise === 'each' ? n : 1, def.surprise === 'each' ? ITEM_ODDS.unit : ITEM_ODDS.harvest, random)
  gainItems(items, at)
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
  if (n < m.ready) farm.machines[id] = { ...m, ready: m.ready - n }
  else farm.machines[id] = freshMachine()
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

const SHIRTS = ['#c9573f', '#3f6fa3', '#5c8a4a', '#d9a441', '#7b5aa6', '#2f8f8a', '#e07a5f', '#4d5d73', '#b23a48', '#f2cc8f']
const TROUSERS = ['#2b3038', '#3d4a5c', '#5a4636', '#1f2a24', '#6b6255', '#283044']
const SKINS = ['#f1c7a5', '#e0ac87', '#c68863', '#9a6646', '#704a32', '#f6d5bd']
const HAIRS = ['#2b2017', '#5a3a22', '#a8743f', '#d9b98a', '#1c1c1c', '#7b4b2a', '#b9b2a8']

let visitorSeq = 0

/** What the farm grows and makes (and what every farm has: lemons, eggs, milk): what buyers ask for. */
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
    look: look ?? {
      shirt: pick(SHIRTS),
      trousers: pick(TROUSERS),
      skin: pick(SKINS),
      hair: pick(HAIRS),
      hairStyle: pick([0, 1, 2] as const),
      hat: Math.random() < 0.3,
      height: rand(0.94, 1.05),
    },
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

// ───────────────────────────── time ─────────────────────────────

const stageKey = () => [...farm.beds.map((_, i) => bedStage(i)), ...PRODUCER_IDS.map((id) => farm.producers[id].stock.join(',')), ...MACHINE_IDS.map(machineStage)].join('|')

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
  const nothing = farm.beds.every((b) => !b.crop) && SELLABLE.every((id) => farm.inv[id] === 0) && MACHINE_IDS.every((id) => machineStage(id) === 'idle')
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
  neverStuck()
  if (stageKey() !== before) {
    bump()
    save()
  }
}

// the line at the gate as you left it; then, for the time the page was closed (up to three hours), the farm
// grows on and buyers keep joining the line — as many as it has room for
function resumeFrom(l: ReturnType<typeof load>) {
  for (const b of l.queue) {
    const v = newVisitor(b.want, b.qty, b.offer, 1, b.gift, b.look, b.name)
    farm.visitors.push(v)
    standInLine(v)
  }
  if (!l.savedAt) return
  const away = Math.min(3 * 3600, Math.max(0, (Date.now() - l.savedAt) / 1000))
  for (let left = away; left > 0; left -= 5) grow(Math.min(5, left))
  if (farm.started) {
    let t = away - farm.nextVisitorIn
    let n = 0
    if (t >= 0) {
      n = 1 + Math.floor(t / arrivalSeconds())
      t %= arrivalSeconds()
      farm.nextVisitorIn = arrivalSeconds() - t
    } else farm.nextVisitorIn -= away
    for (let i = Math.min(n, placesInLine() - inLine().length); i > 0; i--) spawnVisitor({ queued: true })
  }
}
resumeFrom(loaded)

/** Starts again from scratch (settings, tests). */
export function resetFarm() {
  const f = fresh()
  Object.assign(farm, f)
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
  const panel = useHome.getState().panel
  if (panel) useHome.getState().closePanel()
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
    resumeFrom(l)
    bump()
  }
  return { ok: true }
}
