import { create } from 'zustand'
import { farmSound, placeSound } from '../audio/sound'
import { coinsFx } from '../fx/fx'
import { groundDistance } from '../lib/interaction'
import { useHome } from '../store'
import {
  BEDS,
  BED_BOX,
  BED_REACH,
  COW,
  CROPS,
  EGG,
  EXPANSIONS,
  GATE_SPOT,
  LANE_ENDS,
  LEMON_TREE,
  LOOM,
  MILL,
  MILLABLE,
  NAMES,
  PACE_LEVELS,
  PRODUCE,
  QUEUE_LEVELS,
  RECIPES,
  SHEEP,
  START_COINS,
  UPGRADES,
  VISITOR,
  WALK_Z,
  WATER_SHARE,
  arrivalEvery,
  count,
  cropById,
  produceById,
  queuePlaces,
  queueSpot,
  recipeById,
  type CakeId,
  type CropId,
  type Expansion,
  type MillInput,
  type MillOutput,
  type ProduceId,
  type UpgradeId,
} from './data'
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
}

export interface MillState {
  input: MillInput | null // what is being milled right now
  count: number
  progress: number // seconds
  output: MillOutput | null // what is waiting to be collected
  ready: number
}

export interface OvenState {
  baking: CakeId | null
  progress: number // seconds
  ready: CakeId | null
}

export interface LoomState {
  count: number // fleeces on the loom
  progress: number // seconds
  ready: number // rolls of cloth waiting to be taken off
}

export interface FarmData {
  coins: number
  inv: Record<ProduceId, number>
  beds: BedState[]
  lemons: number
  lemonTimer: number
  eggs: number
  eggTimer: number
  hens: number
  cows: number
  milk: number[] // bottles waiting at each cow
  milkTimer: number[]
  sheep: number
  wool: number[] // fleeces grown on each sheep
  woolTimer: number[]
  mill: MillState
  oven: OvenState
  loom: LoomState
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
const freshMill = (): MillState => ({ input: null, count: 0, progress: 0, output: null, ready: 0 })
const freshOven = (): OvenState => ({ baking: null, progress: 0, ready: null })
const freshLoom = (): LoomState => ({ count: 0, progress: 0, ready: 0 })

function fresh(): FarmData {
  return {
    coins: START_COINS,
    inv: emptyInv(),
    beds: BEDS.map((b) => ({ built: b.price === 0 && !b.expansion, crop: null, growth: 0, water: 0, fixed: null })),
    lemons: 3,
    lemonTimer: 0,
    eggs: 1,
    eggTimer: 0,
    hens: EGG.startHens,
    cows: COW.startCows,
    milk: Array.from({ length: COW.startCows }, () => 1),
    milkTimer: Array.from({ length: COW.startCows }, () => 0),
    sheep: SHEEP.startSheep,
    wool: Array.from({ length: SHEEP.startSheep }, () => 1),
    woolTimer: Array.from({ length: SHEEP.startSheep }, () => 0),
    mill: freshMill(),
    oven: freshOven(),
    loom: freshLoom(),
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
const isProduce = (v: unknown): v is ProduceId => produceIds.includes(v as ProduceId)

/** A buyer in the line, as saved: who they are and what they want. */
interface SavedBuyer {
  name: string
  look: Look
  want: ProduceId
  qty: number
  offer: number
}

const isColour = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

function savedBuyer(raw: unknown): SavedBuyer | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<SavedBuyer>
  const l = (b.look ?? {}) as Partial<Look>
  if (!isProduce(b.want) || !l || !isColour(l.shirt) || !isColour(l.trousers) || !isColour(l.skin) || !isColour(l.hair)) return null
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
  }
}

/** The saved farm, made safe (a hand-edited or old save can never break the game), plus the time it was saved. */
function load(text: string | null = readRaw(KEY)): { data: FarmData; savedAt: number | null; queue: SavedBuyer[] } {
  const data = fresh()
  try {
    const raw = JSON.parse(text ?? 'null') as Partial<FarmData> & { time?: number; queue?: unknown[] }
    if (!raw || typeof raw !== 'object') return { data, savedAt: null, queue: [] }
    data.coins = Math.max(0, Math.round(num(raw.coins, START_COINS)))
    for (const id of produceIds) data.inv[id] = Math.max(0, Math.round(num(raw.inv?.[id], 0)))
    data.expansions = { east: !!raw.expansions?.east, west: !!raw.expansions?.west }
    raw.beds?.forEach((b, i) => {
      const def = BEDS[i]
      if (!data.beds[i] || !b || !def) return
      const present = !def.expansion || data.expansions[def.expansion]
      data.beds[i] = {
        built: present && (data.beds[i].built || !!b.built || !!def.expansion),
        crop: present && CROPS.some((c) => c.id === b.crop) ? (b.crop as CropId) : null,
        growth: Math.max(0, num(b.growth, 0)),
        water: Math.max(0, num(b.water, 0)),
        fixed: CROPS.some((c) => c.id === b.fixed) ? (b.fixed as CropId) : null,
      }
    })
    BEDS.forEach((def, i) => {
      if (def.expansion && data.expansions[def.expansion]) data.beds[i].built = true
    })
    data.lemons = int(raw.lemons, 3, 0, LEMON_TREE.max)
    data.lemonTimer = Math.max(0, num(raw.lemonTimer, 0))
    data.eggs = int(raw.eggs, 1, 0, EGG.max)
    data.eggTimer = Math.max(0, num(raw.eggTimer, 0))
    data.hens = int(raw.hens, EGG.startHens, EGG.startHens, EGG.maxHens)
    data.cows = int(raw.cows, COW.startCows, COW.startCows, COW.maxCows)
    data.milk = Array.from({ length: data.cows }, (_, i) => int(raw.milk?.[i], 1, 0, COW.max))
    data.milkTimer = Array.from({ length: data.cows }, (_, i) => Math.max(0, num(raw.milkTimer?.[i], 0)))
    data.sheep = int(raw.sheep, SHEEP.startSheep, SHEEP.startSheep, SHEEP.maxSheep)
    data.wool = Array.from({ length: data.sheep }, (_, i) => int(raw.wool?.[i], 1, 0, SHEEP.max))
    data.woolTimer = Array.from({ length: data.sheep }, (_, i) => Math.max(0, num(raw.woolTimer?.[i], 0)))
    const loom = raw.loom
    if (loom && typeof loom === 'object') {
      const n = int(loom.count, 0, 0, LOOM.capacity)
      data.loom = { count: n, progress: n ? Math.max(0, num(loom.progress, 0)) : 0, ready: n ? 0 : int(loom.ready, 0, 0, LOOM.capacity) }
    }
    data.queueLevel = int(raw.queueLevel, 0, 0, QUEUE_LEVELS)
    data.paceLevel = int(raw.paceLevel, 0, 0, PACE_LEVELS)
    data.nextVisitorIn = Math.min(arrivalEvery(data.paceLevel), Math.max(0, num(raw.nextVisitorIn, VISITOR.firstAfter)))
    const mill = raw.mill
    if (mill && typeof mill === 'object') {
      const input = mill.input && mill.input in MILLABLE ? mill.input : null
      const output = mill.output === 'sugar' || mill.output === 'flour' ? mill.output : null
      data.mill = {
        input,
        count: input ? int(mill.count, 0, 0, MILL.capacity) : 0,
        progress: input ? Math.max(0, num(mill.progress, 0)) : 0,
        output,
        ready: output ? int(mill.ready, 0, 0, MILL.capacity) : 0,
      }
    }
    const oven = raw.oven
    if (oven && typeof oven === 'object') {
      const valid = (v: unknown) => (RECIPES.some((r) => r.id === v) ? (v as CakeId) : null)
      data.oven = { baking: valid(oven.baking), progress: valid(oven.baking) ? Math.max(0, num(oven.progress, 0)) : 0, ready: valid(oven.ready) }
    }
    data.sprinkler = !!raw.sprinkler
    data.compost = !!raw.compost
    data.started = !!raw.started
    data.planted = Array.isArray(raw.planted) ? raw.planted.filter((c): c is CropId => CROPS.some((d) => d.id === c)) : []
    data.made = Array.isArray(raw.made) ? raw.made.filter(isProduce) : []
    data.stats = { ...data.stats, ...raw.stats }
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
    const queue: SavedBuyer[] = visitors.filter((v) => v.phase !== 'leaving').map(({ name, look, want, qty, offer }) => ({ name, look, want, qty, offer }))
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
  if (!farm.made.includes(id)) farm.made.push(id)
}
const gain = (id: ProduceId, n: number) => {
  farm.inv[id] += n
  remember(id)
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

const fullWater = (crop: CropId) => cropById(crop).growSeconds * WATER_SHARE

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

/** Harvests every ripe bed of these (what is within reach, in one go): one toast for all of it. */
export function harvestBeds(beds: number[]) {
  const got = new Map<CropId, number>()
  let total = 0
  for (const i of beds) {
    const b = farm.beds[i]
    if (!b?.crop || bedStage(i) !== 'ripe') continue
    const n = yieldOf(b.crop)
    gain(b.crop, n)
    farm.stats.harvested += n
    got.set(b.crop, (got.get(b.crop) ?? 0) + n)
    total += n
    b.crop = null
    b.growth = 0
    b.water = 0
  }
  if (!total) return 0
  toast(`+ ${[...got].map(([crop, n]) => count(crop, n)).join(', ')}`, [...got][0][0])
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

// ───────────────────────────── tree, hens, cows ─────────────────────────────

export function pickLemons() {
  const n = farm.lemons
  if (!n) return 0
  farm.lemons = 0
  farm.lemonTimer = 0
  gain('lemon', n)
  farm.stats.harvested += n
  toast(`+ ${count('lemon', n)}`, 'lemon')
  bump()
  save()
  return n
}

export function collectEggs() {
  const n = farm.eggs
  if (!n) return 0
  farm.eggs = 0
  gain('egg', n)
  farm.stats.harvested += n
  toast(`+ ${count('egg', n)}`, 'egg')
  bump()
  save()
  return n
}

export const cowName = (i: number) => COW.names[i % COW.names.length]

export function milkCow(i: number) {
  const n = farm.milk[i] ?? 0
  if (!n) return 0
  farm.milk[i] = 0
  farm.milkTimer[i] = 0
  gain('milk', n)
  farm.stats.harvested += n
  toast(`+ ${count('milk', n)}`, 'milk')
  bump()
  save()
  return n
}

export const sheepName = (i: number) => SHEEP.names[i % SHEEP.names.length]

/** How woolly a sheep looks: 0 just shorn … 1 a full fleece twice over. */
export const woolliness = (i: number) => {
  const n = farm.wool[i] ?? 0
  return Math.min(1, (n + (n < SHEEP.max ? (farm.woolTimer[i] ?? 0) / SHEEP.every : 0)) / SHEEP.max)
}

export function shear(i: number) {
  const n = farm.wool[i] ?? 0
  if (!n) return 0
  farm.wool[i] = 0
  farm.woolTimer[i] = 0
  gain('wool', n)
  farm.stats.harvested += n
  toast(`+ ${count('wool', n)}`, 'wool')
  bump()
  save()
  return n
}

// ───────────────────────────── mill, oven and loom ─────────────────────────────

export type MillStage = 'idle' | 'working' | 'done'
export const millStage = (): MillStage => (farm.mill.input ? 'working' : farm.mill.ready > 0 ? 'done' : 'idle')
export const millSecondsLeft = () => (farm.mill.input ? farm.mill.count * MILL.perItem - farm.mill.progress : 0)

/** Loads the mill with as much of `input` as it takes. */
export function millLoad(input: MillInput) {
  if (millStage() !== 'idle') return 0
  const n = Math.min(MILL.capacity, farm.inv[input])
  if (!n) return 0
  farm.inv[input] -= n
  farm.mill = { input, count: n, progress: 0, output: null, ready: 0 }
  bump()
  save()
  return n
}

export function millCollect() {
  const { output, ready } = farm.mill
  if (!output || !ready) return 0
  gain(output, ready)
  farm.mill = freshMill()
  toast(`+ ${count(output, ready)}`, output)
  bump()
  save()
  return ready
}

export type OvenStage = 'idle' | 'baking' | 'done'
export const ovenStage = (): OvenStage => (farm.oven.baking ? 'baking' : farm.oven.ready ? 'done' : 'idle')
export const ovenSecondsLeft = () => (farm.oven.baking ? recipeById(farm.oven.baking).seconds - farm.oven.progress : 0)
export const canBake = (id: CakeId) => Object.entries(recipeById(id).needs).every(([k, n]) => farm.inv[k as ProduceId] >= (n ?? 0))

export function bake(id: CakeId) {
  if (ovenStage() !== 'idle' || !canBake(id)) return false
  for (const [k, n] of Object.entries(recipeById(id).needs)) farm.inv[k as ProduceId] -= n ?? 0
  farm.oven = { baking: id, progress: 0, ready: null }
  bump()
  save()
  return true
}

export function takeOut() {
  const id = farm.oven.ready
  if (!id) return null
  gain(id, 1)
  farm.stats.baked += 1
  farm.oven = freshOven()
  toast(`+ 1 ${produceById(id).name}`, id)
  bump()
  save()
  return id
}

export type LoomStage = 'idle' | 'working' | 'done'
export const loomStage = (): LoomStage => (farm.loom.count > 0 ? 'working' : farm.loom.ready > 0 ? 'done' : 'idle')
export const loomSecondsLeft = () => (farm.loom.count ? farm.loom.count * LOOM.perItem - farm.loom.progress : 0)

/** Puts as many fleeces on the loom as it takes. */
export function loomLoad() {
  if (loomStage() !== 'idle') return 0
  const n = Math.min(LOOM.capacity, farm.inv.wool)
  if (!n) return 0
  farm.inv.wool -= n
  farm.loom = { count: n, progress: 0, ready: 0 }
  bump()
  save()
  return n
}

export function loomCollect() {
  const n = farm.loom.ready
  if (!n) return 0
  gain('cloth', n)
  farm.loom = freshLoom()
  toast(`+ ${count('cloth', n)}`, 'cloth')
  bump()
  save()
  return n
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

/** Bought (all of it, for an upgrade that comes in steps). */
export function owned(u: UpgradeId) {
  switch (u) {
    case 'sprinkler':
      return farm.sprinkler
    case 'compost':
      return farm.compost
    case 'hen':
      return farm.hens >= EGG.maxHens
    case 'cow':
      return farm.cows >= COW.maxCows
    case 'sheep':
      return farm.sheep >= SHEEP.maxSheep
    case 'queue':
      return farm.queueLevel >= QUEUE_LEVELS
    case 'pace':
      return farm.paceLevel >= PACE_LEVELS
    default:
      return farm.expansions[u]
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
  if (id === 'sprinkler') farm.sprinkler = true
  else if (id === 'compost') farm.compost = true
  else if (id === 'hen') farm.hens = Math.min(EGG.maxHens, farm.hens + 1)
  else if (id === 'cow') {
    farm.cows = Math.min(COW.maxCows, farm.cows + 1)
    farm.milk.push(0)
    farm.milkTimer.push(0)
    note = `${cowName(farm.cows - 1)} joins the herd`
  } else if (id === 'sheep') {
    farm.sheep = Math.min(SHEEP.maxSheep, farm.sheep + 1)
    farm.wool.push(0)
    farm.woolTimer.push(0)
    note = `${sheepName(farm.sheep - 1)} joins the flock`
  } else if (id === 'queue') {
    farm.queueLevel = Math.min(QUEUE_LEVELS, farm.queueLevel + 1)
    note = `The line at the gate has room for ${placesInLine()}`
  } else if (id === 'pace') {
    farm.paceLevel = Math.min(PACE_LEVELS, farm.paceLevel + 1)
    farm.nextVisitorIn = Math.min(farm.nextVisitorIn, arrivalSeconds())
    note = `A buyer every ${mmss(arrivalSeconds())}`
  } else {
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

/** What a buyer asks for: mostly something you have, sometimes something your farm makes but has run out of. */
function chooseRequest(): { want: ProduceId; qty: number } {
  const stocked = produceIds.filter((id) => farm.inv[id] > 0)
  const known = [...new Set<ProduceId>([...farm.planted, ...farm.made, 'lemon', 'egg', 'milk'])]
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

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** Everyone in line or on their way to it, the front first. */
export const inLine = () => farm.visitors.filter((v) => v.phase !== 'leaving')
/** Everyone standing in line, the front first. */
export const waiting = () => farm.visitors.filter((v) => v.phase === 'queued')

function newVisitor(want: ProduceId, qty: number, offer: number, from: -1 | 1, look?: Look, name?: string): Visitor {
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
export function spawnVisitor(opts: Partial<Pick<Visitor, 'want' | 'qty' | 'offer'>> & { from?: -1 | 1; queued?: boolean } = {}) {
  const from = opts.from ?? (Math.random() < 0.5 ? -1 : 1)
  const request = opts.want ? { want: opts.want, qty: opts.qty ?? 2 } : chooseRequest()
  const v = newVisitor(request.want, request.qty, opts.offer ?? priceFor(request.want, request.qty), from)
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

function sell(v: Visitor) {
  coinsFx(v.x, v.z, v.offer)
  farm.inv[v.want] -= v.qty
  farm.coins += v.offer
  farm.stats.sold += v.qty
  farm.stats.earned += v.offer
  leave(v, 'happy')
}

export function acceptOffer(id: number) {
  const v = visitorById(id)
  if (!v || v.phase !== 'queued' || !canSell(v)) return false
  sell(v)
  toast(`+ ${v.offer} coins · ${v.name}`, 'coin')
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
  for (const v of waiting()) {
    if (!canSell(v)) continue
    sell(v)
    buyers++
    coins += v.offer
  }
  if (!buyers) return 0
  toast(`+ ${coins} coins · ${buyers} ${buyers === 1 ? 'buyer' : 'buyers'}`, 'coin')
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

const stageKey = () => farm.beds.map((_, i) => bedStage(i)).join() + `|${farm.lemons}|${farm.eggs}|${farm.milk.join(',')}|${farm.wool.join(',')}|${millStage()}|${ovenStage()}|${loomStage()}`

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
  farm.lemonTimer += dt
  while (farm.lemonTimer >= LEMON_TREE.every) {
    farm.lemonTimer -= LEMON_TREE.every
    if (farm.lemons < LEMON_TREE.max) farm.lemons++
  }
  farm.eggTimer += dt * farm.hens
  while (farm.eggTimer >= EGG.every) {
    farm.eggTimer -= EGG.every
    if (farm.eggs < EGG.max) farm.eggs++
  }
  for (let i = 0; i < farm.cows; i++) {
    farm.milkTimer[i] = (farm.milkTimer[i] ?? 0) + dt
    while (farm.milkTimer[i] >= COW.every) {
      farm.milkTimer[i] -= COW.every
      if ((farm.milk[i] ?? 0) < COW.max) farm.milk[i] = (farm.milk[i] ?? 0) + 1
    }
  }
  const m = farm.mill
  if (m.input) {
    m.progress += dt
    if (m.progress >= m.count * MILL.perItem) farm.mill = { input: null, count: 0, progress: 0, output: MILLABLE[m.input], ready: m.count }
  }
  const o = farm.oven
  if (o.baking) {
    o.progress += dt
    if (o.progress >= recipeById(o.baking).seconds) farm.oven = { baking: null, progress: 0, ready: o.baking }
  }
  for (let i = 0; i < farm.sheep; i++) {
    if ((farm.wool[i] ?? 0) >= SHEEP.max) continue // a full fleece stops growing until it is shorn
    farm.woolTimer[i] = (farm.woolTimer[i] ?? 0) + dt
    while (farm.woolTimer[i] >= SHEEP.every && (farm.wool[i] ?? 0) < SHEEP.max) {
      farm.woolTimer[i] -= SHEEP.every
      farm.wool[i] = (farm.wool[i] ?? 0) + 1
    }
    if ((farm.wool[i] ?? 0) >= SHEEP.max) farm.woolTimer[i] = 0
  }
  const l = farm.loom
  if (l.count) {
    l.progress += dt
    if (l.progress >= l.count * LOOM.perItem) farm.loom = { count: 0, progress: 0, ready: l.count }
  }
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
  v.heading += wrapAngle(Math.atan2(dx, dz) - v.heading) * Math.min(1, dt * 7)
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
      v.heading += wrapAngle(spot.heading - v.heading) * Math.min(1, step * 5)
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
  const nothing = farm.beds.every((b) => !b.crop) && produceIds.every((id) => farm.inv[id] === 0) && millStage() === 'idle' && ovenStage() === 'idle'
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
    const v = newVisitor(b.want, b.qty, b.offer, 1, b.look, b.name)
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
    animals: l.data.cows + l.data.hens + l.data.sheep,
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
