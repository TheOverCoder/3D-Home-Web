import { farmSound, placeSound } from '../../audio/sound'
import { coinsFx } from '../../fx/fx'
import { dampAngle } from '../../lib/damp'
import { GATE_SPOT, LANE_ENDS, NAMES, produceById, queueSpot, SELLABLE, VISITOR, WALK_Z, type ItemId, type ProduceId } from '../data'
import { offerFactor, priceOf } from '../prices'
import { rollLook } from '../../models/look'
import { bringsSurprise } from '../storage'
import { FRUIT, FRUIT_KINDS } from '../decor'
import { asLook, bump, eventSpeed, farm, isSellable, random, save, toast, type Look, type Visitor } from './core'
import { gainXp } from './levels'
import { foundPrizes, rewarded } from './rewards'
import { gainItems, rollGifts, surpriseWords } from './stores'
import { sold } from './ledger'
import { arrivalSeconds, placesInLine } from './shop'
import { befriend, neighbourComes } from './neighbours'
import { personById, personLook, type NeighbourId } from '../../data/people'
import { kindFactor, neighbourAsk } from '../people/visits'

// The buyers at the garden gate: who comes and what they ask for, the line, selling and declining, and their walking.
// Now and then a neighbour met comes instead of a stranger (src/farm/people/visits.ts): themselves every time, asking
// for a good they like at a fair or a generous price.

declare module './core' {
  interface Visitor {
    /** a neighbour (src/data/people.ts): their own look and name, a heart on their bubble; none: a stranger */
    who?: NeighbourId
  }
}

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
const rand = (a: number, b: number) => a + Math.random() * (b - a)

let visitorSeq = 0

/** What the farm grows and makes (and what every farm has: lemons, eggs, milk; and the fruit of the trees and bushes
 *  standing on it): what buyers and orders ask for. */
export const knownGoods = () =>
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

/** Mostly fair, now and then generous, sometimes cheeky: worth a look before saying yes (BUYER_OFFERS in ../data, on
 *  Math.random). */
function priceFor(want: ProduceId, qty: number) {
  return Math.max(1, Math.round(priceOf(want) * qty * offerFactor(Math.random())))
}

/** What `qty` of a good are worth (src/farm/prices.ts: more for what a machine of a higher level makes). */
export const fairPrice = (want: ProduceId, qty: number) => Math.round(priceOf(want) * qty)

/** Everyone in line or on their way to it, the front first. */
export const inLine = () => farm.visitors.filter((v) => v.phase !== 'leaving')
/** Everyone standing in line, the front first. */
export const waiting = () => farm.visitors.filter((v) => v.phase === 'queued')

/** A stranger's name no one on the lane has now (none free: any). */
function freeName() {
  const taken = new Set(farm.visitors.map((v) => v.name))
  const free = NAMES.filter((n) => !taken.has(n))
  return pick(free.length ? free : NAMES)
}

export function newVisitor(want: ProduceId, qty: number, offer: number, from: -1 | 1, gift: boolean, look?: Look, name?: string, who?: NeighbourId): Visitor {
  const startX = LANE_ENDS[from < 0 ? 0 : 1]
  return {
    id: ++visitorSeq,
    // a neighbour is themselves: their name and look (src/data/people.ts)
    ...(who ? { who } : {}),
    name: who ? personById(who).name : (name ?? freeName()),
    // a whole person from the table of traits, on the farm's dice (src/models/look.ts)
    look: who ? asLook(personLook(who)!) : (look ?? asLook(rollLook(random))),
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
export function standInLine(v: Visitor) {
  const spot = queueSpot(inLine().indexOf(v))
  v.phase = 'queued'
  v.x = spot.x
  v.z = spot.z
  v.heading = spot.heading
  v.moving = false
}

/** A new buyer walks up the lane (`queued`: is already standing in line). A stranger, or now and then a neighbour met
 *  in their hours (`who`: that neighbour), who asks for a good they like at a fair or a generous price. */
export function spawnVisitor(opts: Partial<Pick<Visitor, 'want' | 'qty' | 'offer' | 'gift' | 'who'>> & { from?: -1 | 1; queued?: boolean } = {}) {
  const from = opts.from ?? (Math.random() < 0.5 ? -1 : 1)
  const who = opts.who ?? (opts.want ? null : neighbourComes())
  const request = opts.want ? { want: opts.want, qty: opts.qty ?? 2 } : who ? neighbourAsk(who, knownGoods(), farm.inv, Math.random) : chooseRequest()
  const offer = opts.offer ?? (who ? Math.max(1, Math.round(priceOf(request.want) * request.qty * kindFactor(Math.random()))) : priceFor(request.want, request.qty))
  const v = newVisitor(request.want, request.qty, offer, from, opts.gift ?? bringsSurprise(random), undefined, undefined, who ?? undefined)
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
  sold('gate', v.want, v.qty, v.offer)
  befriend(v)
  leave(v, 'happy')
  return items
}

export function acceptOffer(id: number) {
  const v = visitorById(id)
  if (!v || v.phase !== 'queued' || !canSell(v)) return false
  const items = sell(v)
  rewarded('sale', [{ coins: v.offer }, ...foundPrizes(items)], { x: v.x, y: 1.9, z: v.z })
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
  rewarded('sale', [{ coins }, ...foundPrizes(items)], { x: GATE_SPOT.x, y: 1.9, z: GATE_SPOT.z })
  toast(`+ ${coins} coins · ${buyers} ${buyers === 1 ? 'buyer' : 'buyers'}${surpriseWords(items)}`, items[0] ?? 'coin')
  farmSound('coins')
  save()
  return buyers
}

/** "Sorry, none today": they take it kindly — a wave goodbye and a "No problem!" (the mood `sad` is the turned-away
 *  one: src/farm/Visitors.tsx shows it as a wave, never a sad face) — and someone else comes along soon. */
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

/** The line at the gate in play: buyers walk up to their places and move up, those leaving walk off, and the next one
 *  comes when it is time. */
export function walkLine(dt: number) {
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
