import { create } from 'zustand'
import { useHome } from '../../store'
import { SELLABLE, type CropId, type Expansion, type LadderId, type MachineId, type ProduceId, type ProducerId, type StoreId } from '../data'
import { levelOf, type Xp } from '../xp'
import type { Gifts } from '../gifts'
import { dayNumber, type Daily } from '../daily'
import type { MachineState } from '../machines'
import { speedAt, type Boost, type EventsRecord } from '../events'
import type { Outfit } from '../outfit'
import type { Market } from '../market'
import type { Contractor } from '../contractor'
import type { PersonLook } from '../../models/person'
import { rollLook } from '../../models/look'
import type { Pose, Walker } from '../script'
import type { OrderSlot } from '../orders'
import type { GoalId } from '../goals'
import type { FarmLayout } from '../layout'
import { lockedAt, machineOpensAt, opensAt, type UnlockId } from '../unlocks'
import type { StepsRecord } from '../firstSteps'
import type { Skins } from '../skins'
import type { HomeLayout } from '../../home/layout'
import { onHere } from '../../lib/quiet'

// The farm's core: the one object the whole farm runs on (src/farm/state.ts loads it, in start()), the revision that tells
// the interface it changed, saving, the toast, the farm's dice, the two clocks of the device (the calendar's for whole
// days, the events' for the hour and the weekday) and the levels' locks. Every other module of the state imports it;
// it imports none of them.

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
export const asLook = (look: PersonLook) => look as Look

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
  /** the animals' tools' skins (src/farm/skins.ts): which each tool's farm owns, and the one it wears */
  skins: Skins
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

/** Where something happened in the world: where its crystals, coins and surprises fly up from. */
export type At = { x: number; y: number; z: number }

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

/** A person the scene draws, with the steps of their script still to walk. */
export type Person = Walker & Walking

/** The farm everything runs on: filled from the save as the page opens (start(), in src/farm/state.ts), and again when
 *  another slot is played or the farm starts over; never another object. */
export const farm = {} as FarmData

/** Revision counter: bumped whenever something the interface shows has changed. */
export const useFarm = create<{ rev: number }>(() => ({ rev: 0 }))
export const bump = () => useFarm.setState((s) => ({ rev: s.rev + 1 }))

let saveTimer: number | undefined
/** What writes the farm into its slot (src/farm/state/save.ts, writeSlot: given by start()). */
let write: () => void = () => {}
/** How the farm is written into its slot: once, from start(). */
export function writeWith(f: () => void) {
  write = f
}
/** Writes the farm into its slot now (a save waiting is done with it). */
export function saveNow() {
  window.clearTimeout(saveTimer)
  saveTimer = undefined
  write()
}
export const save = () => {
  if (saveTimer === undefined) saveTimer = window.setTimeout(saveNow, 1200)
}

export const toast = (text: string, item?: string) => useHome.getState().showToast(text, item)

/** The farm's dice for its surprises (and new orders): Math.random, unless a test sets its own. */
let dice: () => number = () => Math.random()
/** A roll of the farm's dice: 0 to under 1. */
export const random = () => dice()
/** For the tests: the dice from a function of their own (null: Math.random again). */
export function setRandom(f: (() => number) | null) {
  dice = f ?? (() => Math.random())
}

/** A good buyers and orders ask for (not a building material). */
export const isSellable = (v: unknown): v is ProduceId => SELLABLE.includes(v as ProduceId)

/** Puts back goods that were the farm's already (an order declined) or a surprise: always taken in, even past full
 *  (refused, they would be lost). */
export function putBack(id: ProduceId, n: number) {
  farm.inv[id] += n
}

/** The same person every time: their traits rolled on dice of their own (not the farm's). */
export function steadyLook(seed: number, overrides: Partial<PersonLook>) {
  let a = seed
  const dice = () => {
    a = (a * 16807) % 2147483647
    return a / 2147483647
  }
  return rollLook(dice, overrides)
}

/** The device's clock for the daily gift (src/farm/daily.ts): its calendar day is the gift's day. Tests set their own
 *  (setDailyClock). Here, before the farm first loads: a save's daily gift is read on today. */
let dailyClock: () => number = () => Date.now()
/** Today, on the device's own calendar (a day number of src/farm/daily.ts). */
export const calendarDay = () => dayNumber(dailyClock())

/** The moment on the daily gift's clock (ms of the device's, unless a test set its own). */
export const calendarTime = () => dailyClock()

/** For the tests: the daily gift's clock (null: the device's own again). A day changing is seen at once. */
export function setDailyClock(f: (() => number) | null) {
  dailyClock = f ?? (() => Date.now())
  bump()
}

/** The week's events (src/farm/events.ts) are judged on the device's clock — but not where the game is tested: under
 *  Vitest, nor on a ?debug page unless it says &events=on (the e2e specs). A test that wants them sets a clock. (As
 *  the page has it: `switchesByPage`.) */
let eventClock: (() => number) | null = null
/** While the farm goes on for a time away: the time of the step it is on (each step judged at its own). */
let stepAt: number | null = null

/** The moment the events are judged at (ms of the device's clock), or null when they are off. */
export const eventTime = (): number | null => (eventClock ? (stepAt ?? eventClock()) : null)

/** The time away's step the events are judged at (ms), or null once it is over (src/farm/state/away.ts, goOn). */
export function setStepAt(at: number | null) {
  stepAt = at
}

/** For the tests: the events on at a time of their own (ms, standing still), on the device's clock again ('device'), or
 *  off (null). */
export function setEventClock(at: number | 'device' | null) {
  eventClock = at === null ? null : at === 'device' ? () => Date.now() : () => at
  bump()
}
/** How much the events on now multiply something (1 with none): how fast crops grow and machines work (the times
 *  left shown are real seconds: divided by it), how often buyers come, how many gifts a sale brings. */
export const eventSpeed = (b: Boost) => speedAt(b, eventTime())

/** Everything open whatever the level: under Vitest and on a ?debug page unless it says &unlocks=on (the tests buy what
 *  they need), until a test turns the locks on; the game's own pages lock by the level. (As the page has it:
 *  `switchesByPage`.) */
let allOpen = false

/** The week's events and the levels' locks as this page has them (src/lib/quiet.ts): on in play, off where the game is
 *  tested unless the page asks. Once, from start(). */
export function switchesByPage() {
  eventClock = onHere('events') ? () => Date.now() : null
  allOpen = !onHere('unlocks')
}

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
export const cropOpen = (crop: CropId) => isUnlocked(`crop:${crop}`)
/** A view's `locked` (the level a thing opens at), only while it is locked. */
export const lockField = (locked: number | null) => (locked === null ? {} : { locked })
