import { amount, cycle, field, int, isObject, list, MOST, num, seconds } from '../../lib/saved'
import { useHome } from '../../store'
import {
  arrivalEvery,
  BEDS,
  cropById,
  CROPS,
  LEVELS,
  MACHINE_IDS,
  MACHINES,
  NAMES,
  orderSlots,
  orderWait,
  PACE_LEVELS,
  PRODUCE,
  PRODUCER_IDS,
  PRODUCERS,
  QUEUE_LEVELS,
  queuePlaces,
  SLOT_LEVELS,
  START_COINS,
  STORE_IDS,
  TRACTOR,
  VISITOR,
  WAIT_LEVELS,
  type CropId,
  type MachineId,
  type ProduceId,
  type ProducerId,
} from '../data'
import { levelOf, sanitizeXp, savedOnToday, seedXp, unpaidCoins } from '../xp'
import { giftsFor, sanitizeGifts } from '../gifts'
import { dailyFresh, sanitizeDaily } from '../daily'
import { freshPlayed, sanitizePlayed } from '../calendar'
import { machineLevel, QUEUE } from '../machineView'
import { freshMachine, jobSeconds, recipeOf, type MachineState } from '../machines'
import { freshEvents, sanitizeEvents } from '../events'
import { DEFAULT_OUTFIT, sanitizeOutfit } from '../outfit'
import { clampLevels, freshMarket, sanitizeMarket } from '../market'
import { offersPerDay, sanitizeContractor } from '../contractor'
import { sanitizeLook } from '../../models/look'
import { orderKey, orderPay, type Order, type OrderLine, type OrderSlot } from '../orders'
import { GOAL_IDS, GOALS, MOST_STEPS, startStep, type GoalId } from '../goals'
import { tripSeconds } from '../tractorRoute'
import { defaultLayout, sanitizeLayout } from '../layout'
import { sanitizeSteps, stepsFresh } from '../firstSteps'
import { mostAt, ownsEach, type Steps } from '../tools'
import { freshSkins, sanitizeSkins } from '../skins'
import { defaultHome, sanitizeHome } from '../../home/layout'
import { asLook, bump, calendarDay, farm, isSellable, saveNow, type FarmData, type Look, type ProducerState } from './core'
import { fullWater } from './beds'
import { stocksFor } from './producers'
import { fitPlants } from './decor'
import { newVisitor, standInLine } from './buyers'
import { firstBoard, gateX, MOST_CRATES, starterOrderIn } from './orders'
import { dayClock } from './day'
import { forgetWalkers } from './market'
import { takePassed } from './steps'
import { cameBack, forgetAway } from './away'

// The save: a new farm, reading a saved one safely (a hand-edited or old save can never break the game), writing it,
// the three slots, and a slot as a file to keep or load.

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

let slot: Slot = 1
let KEY = keyFor(slot)
/** The slot this device played last (start(), before the farm loads). */
export function startSlot() {
  slot = savedSlot()
  KEY = keyFor(slot)
}

export const currentSlot = () => slot
const produceIds = PRODUCE.map((p) => p.id)
const emptyInv = () => Object.fromEntries(produceIds.map((id) => [id, 0])) as Record<ProduceId, number>

function freshProducer(id: ProducerId): ProducerState {
  const animals = PRODUCERS[id].herd?.start ?? 0
  // (a new farm has no tools)
  const n = stocksFor(id, animals, {})
  return { animals, stock: Array.from({ length: n }, () => PRODUCERS[id].fresh), timer: Array.from({ length: n }, () => 0) }
}

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
    orders: firstBoard(orderSlots(0)),
    office: { slots: 0, wait: 0 },
    dispatch: { waiting: 0, aboard: 0, trip: -1 },
    clock: 0,
    xp: { points: 0, paid: 1 },
    gifts: giftsFor(0),
    daily: dailyFresh(),
    outfit: { ...DEFAULT_OUTFIT },
    ladders: clampLevels({}),
    skins: freshSkins(),
    market: freshMarket(),
    contractor: { day: -1, offers: [] },
    day: { t: 0 },
    place: 'farm',
    apartment: { owned: false },
    events: freshEvents(),
    firstSteps: stepsFresh(),
    played: freshPlayed(),
  }
}

const isProduce = (v: unknown): v is ProduceId => produceIds.includes(v as ProduceId)

const isCrop = (v: unknown): v is CropId => CROPS.some((c) => c.id === v)

/** A buyer in the line, as saved: who they are, what they want, and whether they bring a surprise. */
interface SavedBuyer {
  name: string
  look: Look
  want: ProduceId
  qty: number
  offer: number
  gift: boolean
}

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
    timer: Array.from({ length: n }, (_, i) => cycle(field(p.timer, i), def.every)),
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
    const spent = seconds(m.progress, count * r.seconds)
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
  const savedJobs = list(m.jobs)
  const savedDone = int(m.done, 0, 0, savedJobs.length)
  const jobs: string[] = []
  let done = 0
  savedJobs.forEach((job, i) => {
    const r = recipeOf(id, job)
    if (!r || jobs.length >= QUEUE.max) return
    jobs.push(r.id)
    if (i < savedDone) done++
  })
  const worked = seconds(m.worked, Number.MAX_SAFE_INTEGER)
  const working = done < jobs.length ? recipeOf(id, jobs[done]) : undefined
  return {
    jobs,
    done,
    progress: working ? seconds(m.progress, jobSeconds(working, machineLevel(worked).boost)) : 0,
    capacity: int(m.capacity, QUEUE.start, QUEUE.start, QUEUE.max),
    worked,
  }
}

function savedBuyer(raw: unknown): SavedBuyer | null {
  if (!isObject(raw)) return null
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

/** An order as saved, made safe: the goods it asks for (each once, none a building material), how many of each have
 *  been put in (never more than it wants), what it pays; an order of nothing is no order (a new one comes). */
function savedOrder(raw: unknown): Order | null {
  const lines = list(field(raw, 'lines'))
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
  return { wait: seconds(field(raw, 'wait'), wait) }
}

/** The saved farm, made safe (a hand-edited or old save can never break the game), plus the time it was saved. */
export function load(text: string | null = readRaw(KEY)): { data: FarmData; savedAt: number | null; queue: SavedBuyer[] } {
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
    const beds = list(raw.beds)
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
        growth: crop ? seconds(b.growth, cropById(crop).growSeconds) : 0,
        water: crop ? seconds(b.water, fullWater(crop)) : 0,
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
    // the tools' skins: as saved, for the tools the farm has (a farm from before them owns each tool's own and wears it)
    data.skins = sanitizeSkins(raw.skins, data.ladders)
    // the tree, the nest, the animals and the machines (a save from before the tables kept each in fields of its own)
    for (const id of PRODUCER_IDS) data.producers[id] = savedProducer(id, raw, data.ladders)
    for (const id of MACHINE_IDS) data.machines[id] = savedMachine(id, raw)
    data.queueLevel = int(raw.queueLevel, 0, 0, QUEUE_LEVELS)
    data.paceLevel = int(raw.paceLevel, 0, 0, PACE_LEVELS)
    data.nextVisitorIn = Math.min(arrivalEvery(data.paceLevel), Math.max(0, num(raw.nextVisitorIn, VISITOR.firstAfter)))
    data.sprinkler = !!raw.sprinkler
    data.compost = !!raw.compost
    data.started = !!raw.started
    data.planted = [...new Set(list(raw.planted).filter(isCrop))]
    data.made = [...new Set(list(raw.made).filter(isProduce))]
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
    const board = list(raw.orders)
    data.orders = Array.from({ length: orderSlots(data.office.slots) }, (_, k) => savedPlace(board[k], orderWait(data.office.wait)))
    const aboard = int(field(raw.dispatch, 'aboard'), 0, 0, TRACTOR.load)
    data.dispatch = {
      waiting: int(field(raw.dispatch, 'waiting'), 0, 0, MOST_CRATES),
      aboard,
      trip: aboard ? seconds(field(raw.dispatch, 'trip'), tripSeconds(aboard, gateX(data.layout))) : -1,
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
    // a farm on its first steps that has sent no order gets the starter order once (ORDERS.first)
    starterOrderIn(data)
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
    // days played: as saved; a farm from before them starts from its daily gift's streak and the day it last claimed one
    data.played = sanitizePlayed(raw.played, calendarDay(), { days: amount(field(raw.daily, 'streak'), 0), last: int(field(raw.daily, 'last'), -1, -1, MOST) })
    const queue = list(raw.queue)
      .map(savedBuyer)
      .filter((b): b is SavedBuyer => !!b)
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

/** Writes the farm into its slot (core's saveNow, through writeWith). */
export function writeSlot() {
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

// the line at the gate as you left it; then the time the page was closed
export function resumeFrom(l: ReturnType<typeof load>) {
  for (const b of l.queue) {
    const v = newVisitor(b.want, b.qty, b.offer, 1, b.gift, b.look, b.name)
    farm.visitors.push(v)
    standInLine(v)
  }
  if (l.savedAt) cameBack(Math.max(0, (Date.now() - l.savedAt) / 1000))
}

/** Starts again from scratch (settings, tests). */
export function resetFarm() {
  const f = fresh()
  Object.assign(farm, f)
  forgetWalkers()
  // (the steps passed on the farm before are not this one's to show)
  takePassed()
  forgetAway()
  saveNow()
  bump()
}

export { saveNow as saveFarm } from './core'

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
  forgetAway()
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
