// The first ten minutes (plans/first-hour.md, Part C): a short row of steps a new farm is walked through, one at a
// time — its words in the hint under the compass, a tap there walks you to its target, a small reward as it is done.
// Each step is read from the farm's own numbers (the goals board's measures where one counts it, src/farm/goals.ts),
// so a step the farm has done already is passed the moment it comes. A future step is a row of FIRST_STEPS. While a
// step is on, its line follows the farm (its turns: a crop still wet, ripe already, a loom at work, an order short of
// eggs), so the farmer always says something a player can do now, and a tap walks there: no step is a dead end, on
// any day. Pure: the farm keeps the record and pays (src/farm/state.ts), the hint draws it.

import { isObject, num } from '../lib/saved'
import type { ArtId } from '../ui/art'
import { BEDS, CROPS, MACHINES, MACHINE_IDS, ORDERS, cropById, produceById, type ProduceId } from './data'
import type { Prize } from './gifts'
import { goalById, type GoalId } from './goals'
import { isWorking, recipeOf } from './machines'
import type { Order } from './orders'
import type { BedStage, FarmData } from './state'
import type { UnlockId } from './unlocks'
import type { Target } from './walkTargets'
import { levelOf } from './xp'

export type StepId = 'plant' | 'eggs' | 'water' | 'harvest' | 'sell' | 'shear' | 'weave' | 'order'

/** How the farmer feels as he says a line: his face (`farmer-<mood>` in src/ui/art.ts, made by
 *  scripts/render-farmer-faces.mjs) and how he moves as it comes (src/farm/FarmerFace.tsx). */
export type FarmerMood = 'cheerful' | 'proud' | 'excited' | 'curious' | 'encouraging' | 'surprised' | 'laughing' | 'winking' | 'sighing'
export const FARMER_MOODS: readonly FarmerMood[] = ['cheerful', 'proud', 'excited', 'curious', 'encouraging', 'surprised', 'laughing', 'winking', 'sighing']

/** The hint's moments besides a step's own line: a step just done (its tick), the walk a tap started, the skip
 *  question, the last card ("All set!"), and a tap with nowhere to walk to yet. */
export type Moment = 'passed' | 'walk' | 'ask' | 'final' | 'nowhere'
export const MOMENT_MOODS: Readonly<Record<Moment, FarmerMood>> = {
  // well done: he beams and hops
  passed: 'proud',
  // off you go: a nod, that way
  walk: 'encouraging',
  // "Skip the tips?": a kind nod, either way is fine (never a plea to stay)
  ask: 'encouraging',
  // every step done: stars in his eyes
  final: 'excited',
  // nothing to walk to yet (no bed at that stage, no egg laid): a sigh, and the bubble shakes
  nowhere: 'sighing',
}

/** A picture: one of the farm's goods (its model), or a piece of interface art. */
export type Pic = { item: ProduceId } | { art: ArtId }

/** One of a step's turns: while `when` holds (the first that holds is said), the farmer says this instead of the step's
 *  own line, with its own face, picture and walk (each read from the farm where it is a function): the line follows
 *  the farm. The step's own fields where a turn leaves one out. */
export interface Turn {
  when: (f: FarmData) => boolean
  say: string | ((f: FarmData) => string)
  mood?: FarmerMood
  pic?: Pic | ((f: FarmData) => Pic)
  target: Target | ((f: FarmData) => Target)
}

export interface StepDef {
  id: StepId
  /** the hint's words: a few, telling what to do, in the farmer's voice */
  say: string
  /** how he says them (his face and his move match the words) */
  mood: FarmerMood
  /** its picture: one of the farm's goods (its model), or a piece of interface art */
  pic: Pic
  /** done: the farm's numbers show it (never a count that can go down again) */
  done: (f: FarmData) => boolean
  /** where a tap walks you (src/farm/walkTargets.ts) */
  target: Target
  /** what he says instead while the farm is not yet where the step's own line fits (the first that holds) */
  turns?: readonly Turn[]
  /** what doing it gives: coins, or goods into their building past full (as surprises go); never XP */
  reward: Prize
  /** what it needs open at level 1 (src/farm/unlocks.ts; the test holds the table to it) */
  needs?: readonly UnlockId[]
}

/** What the farmer says now for a step: its words, face, picture and walk, and which turn (-1: the step's own). */
export interface Line {
  say: string
  mood: FarmerMood
  pic: Pic
  target: Target
  turn: number
}

/** The farm reached a goal's count (the goals board's own measure). */
const reached =
  (goal: GoalId, n = 1) =>
  (f: FarmData) =>
    goalById(goal).measure(f) >= n

/** A bed's stage on a farm given: what state/beds.ts's bedStage says of the farm itself (the test holds the two
 *  together), here for the turns, which read the farm they are given. */
export function stageOf(f: FarmData, i: number): BedStage {
  const b = f.beds[i]
  const def = BEDS[i]
  if (def.expansion && !f.expansions[def.expansion]) return 'unbought'
  if (!b.built) return 'locked'
  if (!b.crop) return 'empty'
  if (b.growth >= cropById(b.crop).growSeconds) return 'ripe'
  if (!f.sprinkler && b.water <= 0) return 'thirsty'
  return 'growing'
}
/** Some bed is at this stage. */
const anyBed = (f: FarmData, stage: BedStage) => f.beds.some((_, i) => stageOf(f, i) === stage)
/** Something grows in some bed (ripe, thirsty or growing). */
const anyCrop = (f: FarmData) => anyBed(f, 'ripe') || anyBed(f, 'thirsty') || anyBed(f, 'growing')

const isCrop = (good: ProduceId) => CROPS.some((c) => c.id === good)
/** The machine that makes a good, and its recipe for it (none: grown, or given by an animal or a tree). */
function makerOf(good: ProduceId) {
  for (const id of MACHINE_IDS) {
    const recipe = MACHINES[id].recipes.find((r) => r.makes === good)
    if (recipe) return { id, recipe }
  }
  return null
}

/**
 * The good to go and fetch when the farm wants one: the good itself, or, for what a machine makes when the machine has
 * none of it done or on its way and its ingredients are short, the first ingredient short (and so on down: flour
 * short of wheat is the wheat). A tap then walks to where it is made, ready or growing.
 */
export function sourceOf(f: FarmData, good: ProduceId, depth = 0): ProduceId {
  const maker = makerOf(good)
  if (!maker || depth > 4) return good
  const m = f.machines[maker.id]
  if (m.jobs.some((job) => recipeOf(maker.id, job)?.makes === good)) return good
  const short = (Object.entries(maker.recipe.needs) as [ProduceId, number][]).find(([g, n]) => f.inv[g] < n)
  return short ? sourceOf(f, short[0], depth + 1) : good
}

/** Where a tap walks to fetch a good: where it is made (a bed growing it, or one to plant it in; its animal, its tree,
 *  its machine); a crop with no bed growing it and none empty: a bed to empty first. */
export function fetchTarget(f: FarmData, good: ProduceId): Target {
  const g = sourceOf(f, good)
  if (isCrop(g) && !f.beds.some((b, i) => b.built && (b.crop === g || stageOf(f, i) === 'empty'))) return { bed: ['ripe', 'thirsty', 'growing'] }
  return { good: g }
}

/** A good's name as the farmer says it: "eggs", "rolls of cloth". */
const plural = (good: ProduceId) => produceById(good).plural

/** What an order still lacks after what is in store: each good short, and how many. */
const missing = (f: FarmData, o: Order) => o.lines.flatMap((l) => (l.want - l.have > f.inv[l.good] ? [{ good: l.good, n: l.want - l.have - f.inv[l.good] }] : []))

/** The starter order, by what it asks for (ORDERS.first: in the board's first place on a new farm). */
export const isFirstOrder = (o: Order) => o.lines.length === ORDERS.first.length && ORDERS.first.every((l, k) => o.lines[k].good === l.good && o.lines[k].want === l.want)

/** The order the last step follows: one the silo and the barn can fill now (the first on the board); else the starter
 *  order, made of what the steps taught; else the nearest to done (the fewest goods still to find after what is in
 *  store), the first on the board on a tie. -1 with none on the board. */
export function orderToFollow(f: FarmData): number {
  const on = f.orders.flatMap((slot, k) => ('order' in slot ? [{ k, o: slot.order, n: missing(f, slot.order).reduce((sum, l) => sum + l.n, 0) }] : []))
  const pick = on.find((x) => x.n === 0) ?? on.find((x) => isFirstOrder(x.o)) ?? [...on].sort((a, b) => a.n - b.n)[0]
  return pick?.k ?? -1
}
const followed = (f: FarmData): Order | null => {
  const slot = f.orders[orderToFollow(f)]
  return slot && 'order' in slot ? slot.order : null
}
/** The first good the followed order lacks (null: none on the board, or it has all it needs, in it or in store). */
const orderShort = (f: FarmData): ProduceId | null => {
  const o = followed(f)
  return o ? (missing(f, o)[0]?.good ?? null) : null
}

/** The buyers standing in line, and whether the silo and the barn can serve one of them. */
const queued = (f: FarmData) => f.visitors.filter((v) => v.phase === 'queued')
const canServe = (f: FarmData) => queued(f).some((v) => f.inv[v.want] >= v.qty)
/** What the line asks for that is short: the good of the buyer who needs the fewest more of it. */
const lineShort = (f: FarmData): ProduceId => [...queued(f)].sort((a, b) => a.qty - f.inv[a.want] - (b.qty - f.inv[b.want]))[0].want

/** The loom has cloth done (`done`), or at work. */
const loomHas = (f: FarmData, done: boolean) => (done ? f.machines.loom.done > 0 : isWorking(f.machines.loom))

/** Nothing growing: the first thing is a bed to plant. */
const PLANT_FIRST: Turn = { when: (f) => !anyCrop(f), say: 'Plant some seeds first', mood: 'cheerful', pic: { art: 'seedling' }, target: { bed: ['empty'] } }

/** The steps, in order: a crop from seed to sale with an egg collected while it grows, a fleece woven at the loom
 *  (both there on a new farm), and the first order sent — every lesson of the farm's loop, on what a new farm has.
 *  Each line is the farmer's, said as he feels it: hello and off we go (cheerful), the hens have laid (surprised),
 *  go on, water them (encouraging), the first crop is ripe (excited, stars in his eyes), a word in your ear about the
 *  buyers (winking), a sheep's haircut (laughing), what the loom makes (curious), the last one (proud). Their turns
 *  keep each one doable whatever the farm does meanwhile: a crop that ripens before it dries (rain, sprinklers), a bed
 *  still wet, a line that wants what the barn lacks, a loom at work, an order short of a good. */
export const FIRST_STEPS: readonly StepDef[] = [
  {
    id: 'plant',
    say: "Let's plant some seeds!",
    mood: 'cheerful',
    pic: { art: 'seedling' },
    done: (f) => f.planted.length > 0,
    target: { bed: ['empty'] },
    reward: { coins: 10 },
    needs: ['crop:lettuce'],
  },
  { id: 'eggs', say: 'Ooh, eggs! Collect them', mood: 'surprised', pic: { item: 'egg' }, done: reached('eggs'), target: { good: 'egg' }, reward: { coins: 5 } },
  // (beds watered by the player: `stats.watered`; sprinklers water by themselves; a crop harvested was watered)
  {
    id: 'water',
    say: 'Now water your seedlings',
    mood: 'encouraging',
    pic: { art: 'droplet' },
    done: (f) => f.stats.watered > 0 || f.sprinkler || reached('harvest')(f),
    target: { bed: ['thirsty', 'growing'] },
    turns: [
      PLANT_FIRST,
      // ripe before it went dry: harvesting it passes this step and the next
      { when: (f) => !anyBed(f, 'thirsty') && anyBed(f, 'ripe'), say: 'Ripe already! Harvest it', mood: 'excited', pic: { art: 'basket' }, target: { bed: ['ripe'] } },
      // still wet from the seeds' soak: a bed takes water once it is dry
      { when: (f) => !anyBed(f, 'thirsty'), say: "Water it once it's dry", target: { bed: ['growing'] } },
    ],
    reward: { coins: 5 },
  },
  {
    id: 'harvest',
    say: 'Ripe! Harvest your crop',
    mood: 'excited',
    pic: { art: 'basket' },
    done: reached('harvest'),
    target: { bed: ['ripe', 'thirsty', 'growing'] },
    turns: [
      PLANT_FIRST,
      { when: (f) => !anyBed(f, 'ripe') && anyBed(f, 'thirsty'), say: 'Thirsty again! Water it', mood: 'encouraging', pic: { art: 'droplet' }, target: { bed: ['thirsty'] } },
      { when: (f) => !anyBed(f, 'ripe'), say: 'Growing… wait till ripe', mood: 'curious', pic: { art: 'seedling' }, target: { bed: ['growing'] } },
    ],
    reward: { coins: 10 },
  },
  {
    id: 'sell',
    say: 'Psst… sell at the gate',
    mood: 'winking',
    pic: { art: 'people-queue' },
    done: reached('sell'),
    target: { id: 'farm-queue' },
    turns: [
      // nobody in line yet: they come (more often on a market day)
      { when: (f) => queued(f).length === 0, say: 'Buyers come to the gate', mood: 'encouraging', target: { id: 'farm-queue' } },
      // nobody in line the silo and the barn can serve: fetch what they want (or what it is made from)
      {
        when: (f) => !canServe(f),
        say: (f) => `They want ${plural(sourceOf(f, lineShort(f)))}`,
        mood: 'curious',
        pic: (f) => ({ item: sourceOf(f, lineShort(f)) }),
        target: (f) => fetchTarget(f, lineShort(f)),
      },
    ],
    reward: { coins: 10 },
  },
  { id: 'shear', say: 'Haircut! Shear a sheep', mood: 'laughing', pic: { item: 'wool' }, done: reached('wool'), target: { good: 'wool' }, reward: { coins: 5 } },
  {
    id: 'weave',
    say: 'Weave cloth at the loom?',
    mood: 'curious',
    pic: { item: 'cloth' },
    done: reached('cloth'),
    target: { good: 'cloth' },
    turns: [
      { when: (f) => loomHas(f, true), say: 'Done! Take your cloth', mood: 'excited', target: { good: 'cloth' } },
      { when: (f) => loomHas(f, false), say: 'Weaving… then take it', mood: 'encouraging', target: { good: 'cloth' } },
      // no fleece in the barn to weave: shear one first
      { when: (f) => sourceOf(f, 'cloth') !== 'cloth', say: 'Shear a sheep for wool', mood: 'laughing', pic: { item: 'wool' }, target: (f) => fetchTarget(f, 'cloth') },
    ],
    reward: { coins: 10 },
    needs: ['recipe:loom:wool'],
  },
  {
    id: 'order',
    say: 'Last one: send an order!',
    mood: 'proud',
    pic: { art: 'tractor' },
    done: reached('orders'),
    target: { id: 'farm-office' },
    turns: [
      { when: (f) => !!followed(f)?.lines.every((l) => l.have >= l.want), say: 'All in! Now send it', mood: 'excited', target: { id: 'farm-office' } },
      { when: (f) => !!followed(f) && orderShort(f) === null, say: 'Put the goods in', mood: 'encouraging', pic: { art: 'clipboard' }, target: { id: 'farm-office' } },
      {
        when: (f) => orderShort(f) !== null,
        say: (f) => `Now fetch ${plural(sourceOf(f, orderShort(f)!))}`,
        mood: 'curious',
        pic: (f) => ({ item: sourceOf(f, orderShort(f)!) }),
        target: (f) => fetchTarget(f, orderShort(f)!),
      },
    ],
    reward: { coins: 25 },
  },
]

/** A turn's field as it is now: itself, or read from the farm. */
const now = <T>(v: T | ((f: FarmData) => T), f: FarmData): T => (typeof v === 'function' ? (v as (f: FarmData) => T)(f) : v)

/** What the farmer says now for a step: the first of its turns that holds on this farm, else its own line. */
export function lineFor(step: StepDef, f: FarmData): Line {
  const k = step.turns?.findIndex((t) => t.when(f)) ?? -1
  const t = k >= 0 ? step.turns![k] : null
  if (!t) return { say: step.say, mood: step.mood, pic: step.pic, target: step.target, turn: -1 }
  return { say: now(t.say, f), mood: t.mood ?? step.mood, pic: t.pic ? now(t.pic, f) : step.pic, target: now(t.target, f), turn: k }
}

/** How the farmer feels now: the line he says (a step's own mood, or its turn's), or one of the hint's moments. */
export const moodFor = (line: { mood: FarmerMood } | null, moment: Moment | null): FarmerMood => (moment ? MOMENT_MOODS[moment] : (line?.mood ?? 'cheerful'))

/** The steps end by themselves on a farm this far on: they are for a new farm (and the daily gift, which waits for
 *  them, never waits on one that has grown past them). */
export const STEPS_UNTIL_LEVEL = 5

/** The farm's record (`farm.firstSteps`): the step it is on (FIRST_STEPS' index), and whether they are over (all
 *  done, skipped, or grown past). */
export interface StepsRecord {
  step: number
  over: boolean
}

/** A new farm's record: the first step. */
export const stepsFresh = (): StepsRecord => ({ step: 0, over: false })

/** The record as saved, made safe. A farm from before the steps (nothing saved) has done them: it never sees them. */
export function sanitizeSteps(raw: unknown): StepsRecord {
  if (!isObject(raw)) return { step: FIRST_STEPS.length, over: true }
  const r = raw as Partial<Record<keyof StepsRecord, unknown>>
  const step = Math.min(FIRST_STEPS.length, Math.max(0, Math.floor(num(r.step, 0))))
  return { step, over: r.over === true || step >= FIRST_STEPS.length }
}

/** The step to show now, or null once they are over. */
export const currentStep = (rec: StepsRecord): StepDef | null => (rec.over ? null : (FIRST_STEPS[rec.step] ?? null))

/**
 * Where the record goes from here: each step the farm has done is passed in turn (one done already as it comes is
 * passed with it), up to the first not done; past the last, or with the farm grown past them (STEPS_UNTIL_LEVEL),
 * they are over. The steps passed (the farm pays each one's reward), and the record after them. Never back: a record
 * over stays over.
 */
export function advance(rec: StepsRecord, f: FarmData): { rec: StepsRecord; passed: StepDef[] } {
  if (rec.over) return { rec, passed: [] }
  const passed: StepDef[] = []
  let step = rec.step
  while (step < FIRST_STEPS.length && FIRST_STEPS[step].done(f)) passed.push(FIRST_STEPS[step++])
  const over = step >= FIRST_STEPS.length || levelOf(f.xp.points) >= STEPS_UNTIL_LEVEL
  return { rec: passed.length || over ? { step, over } : rec, passed }
}

/** Skipped from the hint: over, nothing more paid. */
export const skipped = (rec: StepsRecord): StepsRecord => ({ step: rec.step, over: true })
