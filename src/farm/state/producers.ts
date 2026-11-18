import { count, isToolKind, ITEM_ODDS, LADDERS, PRODUCERS, storeOf, STORES, toolLadder, TOOLS, type ItemId, type ProducerId, type ToolKind } from '../data'
import { rollItems } from '../storage'
import { fullest, mostAt, ownsEach, perTapOf, spreadNest, toolOf, type Steps } from '../tools'
import type { ToolView } from '../toolView'
import { isSkinStyle, skinBuyProblem, skinPrice, wearing, withSkin, type SkinStyle } from '../skins'
import { bump, farm, random, save, toast, type At } from './core'
import { gainXp } from './levels'
import { foundPrizes, rewarded } from './rewards'
import { capacity, gainItems, roomFor, store, surpriseWords, used } from './stores'
import { ladderMaxed, ladderNextPrice } from './ladders'

// What fills up and is collected (PRODUCERS: the lemon tree, the hens, the cows, the sheep, the fruit plants): their
// animals, collecting, the animals' tools and their skins, and their filling as the farm runs.

/** Each of a herd's animals gives her own (a count and a clock for each), or they share one (the hens' nest, until the
 *  coop gives each hen hers: src/farm/tools.ts). */
const ownEach = (id: ProducerId) => ownsEach(id, farm.ladders)
/** How many counts a producer keeps, with this many animals (and these ladders: a tool may give each her own). */
export const stocksFor = (id: ProducerId, animals: number, ladders: Steps) => (ownsEach(id, ladders) ? animals : 1)

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
  rewarded('collect', [{ item: def.good, n }, ...foundPrizes(items)], at)
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
export function toolBought(kind: ToolKind) {
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

/** Each herd's animal, as its tool's panel pictures her. */
const ANIMAL_ART = { hens: 'chicken', cows: 'cow', sheep: 'ewe' } as const

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
    art: t.art,
    animal: ANIMAL_ART[kind],
    spots: p.stock.map((has, i) => ({
      name: animalName(kind, i) || `${spot} ${i + 1}`,
      has,
      most,
      // (a clock counts to `every`, however fast it runs)
      next: has >= most ? 0 : Math.min(1, (p.timer[i] ?? 0) / def.every),
      seconds: has >= most ? 0 : Math.max(1, Math.ceil(def.every - (p.timer[i] ?? 0))),
    })),
    perTap: perTap(kind),
    room: roomFor(def.good),
    store: storeOf(def.good),
    stored: used(storeOf(def.good)),
    capacity: capacity(storeOf(def.good)),
    ladders: (['hold', 'tap'] as const).map((part) => {
      const id = toolLadder(kind, part)
      const k = farm.ladders[id]
      return {
        id,
        part,
        name: part === 'hold' ? 'Holds more' : 'More a tap',
        now: LADDERS[id].say(k),
        next: ladderMaxed(id) ? null : LADDERS[id].say(k + 1),
        price: ladderNextPrice(id),
        k,
        steps: LADDERS[id].levels,
      }
    }),
  }
}

/** The skin a tool wears (src/farm/skins.ts): its own, until another is bought or put on. */
export const skinWorn = (kind: ToolKind) => farm.skins[kind].worn
/** Whether a tool's farm owns one of its skins. */
export const skinOwned = (kind: ToolKind, style: SkinStyle) => farm.skins[kind].owned.includes(style)

/** Buys one of a tool's skins (its card asked first) and puts it on: only for a tool that is yours, a skin it does not
 *  have yet, with the coins for it. A `build`'s XP, as every purchase on the farm; the crystals from low in the middle,
 *  as a panel's. Whether it was bought. */
export function buySkin(kind: ToolKind, style: SkinStyle): boolean {
  if (!isToolKind(kind) || !isSkinStyle(style)) return false
  if (skinBuyProblem(farm.skins, kind, style, toolOwned(kind) !== null, farm.coins)) return false
  farm.coins -= skinPrice(kind, style)
  farm.skins = withSkin(farm.skins, kind, style)
  gainXp('build')
  bump()
  save()
  return true
}

/** Puts on a skin a tool's farm owns (free, and undone for free: no XP). Whether what it wears changed. */
export function wearSkin(kind: ToolKind, style: SkinStyle): boolean {
  if (!isToolKind(kind) || !isSkinStyle(style) || toolOwned(kind) === null) return false
  const next = wearing(farm.skins, kind, style)
  if (next === farm.skins) return false
  farm.skins = next
  bump()
  save()
  return true
}

/** One more animal (from the shop): she has nothing to give yet. */
export function addAnimal(id: ProducerId) {
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
export function growProducer(id: ProducerId, dt: number) {
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
