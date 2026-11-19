// The "good player" of the pace simulation (./play.ts): each time it is free, it does the first thing on a list of
// priorities that it can do now, with the game's own functions (the ones the action button and the panels call). A
// trip costs time (./play.ts walks it): what fills up slowly is fetched once there is a good share of it, as a player
// would, not one egg at a time. Nothing here is a rule of the game: change the list to play another way.

import {
  BEDS,
  CROPS,
  ESTATE,
  EXPANSION_IDS,
  GATE_SPOT,
  LADDERS,
  LADDER_IDS,
  MACHINES,
  MACHINE_IDS,
  MANAGER,
  OFFICE_STAND,
  PRODUCERS,
  PRODUCER_IDS,
  SHED,
  TOOLS,
  TOOL_KINDS,
  UPGRADES,
  cropById,
  produceById,
  storeOf,
  type CropId,
  type MachineId,
  type ProduceId,
  type ProducerId,
} from '../farm/data'
import { MANAGER_SPOT } from '../data/market'
import { AGENT_STAND } from '../data/estate'
import { jobAdds } from '../farm/economy'
import { goalsNow } from '../farm/goals'
import { PARCEL_IDS, PARCELS, canBuyParcel, toWorld } from '../farm/layout'
import { STORE_GOODS } from '../farm/storage'
import { SKINS, SKIN_STYLES, skinPrice } from '../farm/skins'
import {
  addJob,
  agentHere,
  bedSpot,
  bedStage,
  buildBed,
  buy,
  buyLadder,
  buyApartment,
  buyLand,
  buyMarket,
  buyOffice,
  buySkin,
  buySlot,
  calendarTime,
  canAddJob,
  canUpgradeStore,
  claimDaily,
  claimGoal,
  collect,
  collectMachine,
  collectable,
  dailyWaiting,
  declineOffer,
  eventSpeed,
  farm,
  fillOrder,
  fullWater,
  giftsWaiting,
  harvestBeds,
  harvestFits,
  inLine,
  isUnlocked,
  ladderNextPrice,
  ladderOpen,
  machineCollectable,
  machineLock,
  machinePoint,
  machineSecondsLeft,
  machineStage,
  makeRoom,
  makeRoomPreview,
  marketForSale,
  officeMaxed,
  officePrice,
  openGifts,
  orderAt,
  owned,
  landFirst,
  upgradeLock,
  placesInLine,
  plantBeds,
  room,
  sellAll,
  sellAllPreview,
  sellToManager,
  managerPays,
  maxOf,
  sendOrder,
  skinOwned,
  slotPrice,
  toolOwned,
  toolTake,
  upgradePrice,
  upgradeStore,
  waiting,
  waterBeds,
  yieldOf,
} from '../farm/state'

/** A place on the farm, to walk to. */
export interface Spot {
  x: number
  z: number
}

/** One thing the player does. */
export interface Move {
  /** in a few words, for the report: "harvest 4 beds" */
  what: string
  /** where it is done (null: a tap on a panel or the dashboard, wherever the player stands) */
  at: Spot | null
  /** does it, with the game's own function */
  run: () => unknown
  /** the taps it took on a panel, once it has run (an animal's tool: one a tap; ./play.ts gives each its time) */
  taps?: () => number
}

/** Coins kept back from buying, for the next seeds. */
export const RESERVE = 10

/** Whether the farm shop's tools, their upgrades, their skins and the two remotes are for sale (plans/animal-tools.md):
 *  on, as in play; off, to play the farm as it was before them and compare (`npm run sim` with SIM_TOOLS=off). */
let toolsForSale = true
export function sellTools(on: boolean) {
  toolsForSale = on
}

// ───────────────────────────── where things are ─────────────────────────────

const GATE: Spot = { x: GATE_SPOT.x, z: GATE_SPOT.z - 1.5 }
const SHOP: Spot = { x: SHED.x + 1.15, z: SHED.z }
const MARKET: Spot = { x: MANAGER_SPOT.x, z: MANAGER_SPOT.z }

/** The beds in patches a press reaches together: the first six, and each field of beds (EXPANSIONS). */
const PATCHES = (['main', ...EXPANSION_IDS] as const).map((name) => ({ name, beds: BEDS.filter((b) => (b.expansion ?? 'main') === name).map((b) => b.index) }))
const middleOf = (beds: number[]): Spot => ({ x: beds.reduce((s, i) => s + bedSpot(i).x, 0) / beds.length, z: beds.reduce((s, i) => s + bedSpot(i).z, 0) / beds.length })
const producerAt = (id: (typeof PRODUCER_IDS)[number]): Spot => farm.layout.places[PRODUCERS[id].place!]
/** Where an animal's tool is used: its place at the fence, where its pen stands now. */
function toolAt(id: ProducerId): Spot {
  const [x, , z] = TOOLS[toolOwned(id)!].stand
  const [wx, wz] = toWorld(farm.layout.places[PRODUCERS[id].place!], x, z)
  return { x: wx, z: wz }
}
const machineAt = (id: MachineId): Spot => machinePoint(id, MACHINES[id].stand)

// ───────────────────────────── what is worth doing ─────────────────────────────

const stageIn = (beds: number[], stage: ReturnType<typeof bedStage>) => beds.filter((i) => bedStage(i) === stage)
/** Of each crop, what is in the beds now. */
const growing = (crop: CropId) => farm.beds.reduce((n, b) => n + (b.crop === crop ? yieldOf(crop) : 0), 0)
/** What the line and the orders ask for that the silo and the beds will not cover: the crop most short first. */
function shortCrop(): CropId | null {
  const asked = new Map<ProduceId, number>()
  const add = (good: ProduceId, n: number) => n > 0 && asked.set(good, (asked.get(good) ?? 0) + n)
  for (const v of waiting()) add(v.want, v.qty)
  for (let k = 0; k < farm.orders.length; k++) for (const l of orderAt(k)?.lines ?? []) add(l.good, l.want - l.have)
  let best: CropId | null = null
  let most = 0
  for (const c of CROPS) {
    const short = (asked.get(c.id) ?? 0) - farm.inv[c.id] - growing(c.id)
    if (short > most) [best, most] = [c.id, short]
  }
  return best
}
/** The mill's crops are kept in stock (its flour and sugar go into cakes). */
const MILL_STOCK = 6
/**
 * Which seeds go in: what the line and the orders are short of; else wheat or sugar cane while the mill would run
 * short; else the quickest crop. Only seeds open at the farm's level that the player can pay for.
 */
function cropToPlant(): CropId | null {
  const can = (c: CropId) => isUnlocked(`crop:${c}`) && farm.coins >= cropById(c).seedCost
  const short = shortCrop()
  if (short && can(short)) return short
  for (const c of ['wheat', 'sugarcane'] as const) if (farm.inv[c] + growing(c) < MILL_STOCK && can(c)) return c
  const quick = [...CROPS].sort((a, b) => a.growSeconds - b.growSeconds).find((c) => can(c.id))
  return quick?.id ?? null
}

/** A producer is worth the trip once half of what it holds at most is waiting (every animal of a herd together; with
 *  its tool, as much as the tool lets wait). */
function worthCollecting(id: (typeof PRODUCER_IDS)[number]) {
  const p = farm.producers[id]
  const most = maxOf(id) * p.stock.length
  const has = p.stock.reduce((a, b) => a + b, 0)
  return p.stock.length > 0 && has > 0 && has >= Math.ceil(most / 2) && p.stock.some((_, i) => collectable(id, i) > 0)
}

/** A machine is worth emptying once it has stopped (all done), or has no place left for another job. */
const worthTakingOut = (id: MachineId) => {
  const m = farm.machines[id]
  return m.done > 0 && (machineStage(id) !== 'working' || m.jobs.length >= m.capacity) && machineCollectable(id) > 0
}

/** The recipe to queue next at a machine: the dearest whose ingredients are in store (and open at the farm's level:
 *  canAddJob asks). */
const nextJob = (id: MachineId) => [...MACHINES[id].recipes].sort((a, b) => produceById(b.makes).price - produceById(a.makes).price).find((r) => canAddJob(id, r))

/** An order whose every line the silo and the barn can fill now. */
function orderToSend(): number {
  return farm.orders.findIndex((_, k) => {
    const o = orderAt(k)
    return !!o && o.lines.every((l) => farm.inv[l.good] >= l.want - l.have)
  })
}

// ───────────────────────────── what to buy ─────────────────────────────

interface Purchase {
  what: string
  at: Spot | null
  price: number
  buy: () => boolean
}

/** Everything there is to buy, each with its price now: the beds to build, the farm shop's upgrades and animals (and,
 *  once their herds are full, the animals' tools, their upgrades and their skins, and the two remotes), the order
 *  office's upgrades,
 *  the machines' queues, land, the manager's better price. Only what is open at the farm's level (src/farm/unlocks.ts)
 *  and what a ladder waits for is there (ladderOpen): the player sees the rest locked, and does not try it. */
function forSale(): Purchase[] {
  const out: Purchase[] = []
  BEDS.forEach((b, i) => {
    if (b.price > 0 && !b.expansion && !farm.beds[i].built && isUnlocked('bed')) out.push({ what: `build bed ${i}`, at: bedSpot(i), price: b.price, buy: () => buildBed(i) })
  })
  for (const u of UPGRADES) if (!owned(u.id) && upgradeLock(u.id) === null && !landFirst(u.id)) out.push({ what: u.name.toLowerCase(), at: SHOP, price: upgradePrice(u.id), buy: () => buy(u.id) })
  for (const id of ['slots', 'wait'] as const) if (!officeMaxed(id)) out.push({ what: `office: ${id}`, at: OFFICE_STAND, price: officePrice(id), buy: () => buyOffice(id) })
  for (const id of MACHINE_IDS) {
    const price = slotPrice(id)
    if (price !== null && machineLock(id) === null) out.push({ what: `${id}: a place in its queue`, at: machineAt(id), price, buy: () => buySlot(id) })
  }
  // land is bought in the edit mode, from wherever the player stands
  for (const id of PARCEL_IDS)
    if (canBuyParcel(farm.layout, id) && isUnlocked(`parcel:${id}`)) out.push({ what: PARCELS[id].name.toLowerCase(), at: null, price: PARCELS[id].price, buy: () => buyLand(id) })
  if (ladderOpen('rate')) out.push({ what: 'a better price from the manager', at: MARKET, price: ladderNextPrice('rate'), buy: () => buyLadder('rate') })
  // the big things saved for (src/farm/economy.ts, SAVINGS): the shop, once the manager's rate is at its top; the house,
  // from the estate agent in his hours
  if (marketForSale()) out.push({ what: 'the market', at: MARKET, price: MANAGER.shopPrice, buy: () => buyMarket() })
  if (!farm.apartment.owned && agentHere()) out.push({ what: 'the house', at: AGENT_STAND, price: ESTATE.price, buy: () => buyApartment() })
  // the farm shop's ladders: the tools, their upgrades, the remotes
  if (toolsForSale)
    for (const id of LADDER_IDS) if (LADDERS[id].at === 'shop' && ladderOpen(id)) out.push({ what: LADDERS[id].name.toLowerCase(), at: SHOP, price: ladderNextPrice(id), buy: () => buyLadder(id) })
  // a tool's skins (src/farm/skins.ts), in its skins shop at its place: the player who buys whatever is cheapest buys
  // them too, so their prices are held to the pace as everything else's
  if (toolsForSale)
    for (const kind of TOOL_KINDS)
      if (toolOwned(kind))
        for (const style of SKIN_STYLES)
          if (!skinOwned(kind, style)) out.push({ what: `skin ${SKINS[kind][style].name.toLowerCase()}`, at: toolAt(kind), price: skinPrice(kind, style), buy: () => buySkin(kind, style) })
  return out
}

/** The cheapest thing for sale, once the coins run to it with a few left for seeds. */
function purchase(): Purchase | null {
  const cheapest = forSale().sort((a, b) => a.price - b.price)[0]
  return cheapest && farm.coins - cheapest.price >= RESERVE ? cheapest : null
}

// ───────────────────────────── the list ─────────────────────────────

/** The priorities, first first: each gives the move it would make now, or null. */
export const PRIORITIES: { name: string; move: () => Move | null }[] = [
  // taps on the dashboard and its panels: the level's gift boxes, the daily gift, the goals, a bigger silo or barn
  { name: 'gifts', move: () => (giftsWaiting().length ? { what: 'open the level gifts', at: null, run: () => openGifts() } : null) },
  { name: 'daily', move: () => (dailyWaiting() ? { what: 'claim the daily gift', at: null, run: () => claimDaily() } : null) },
  {
    name: 'goals',
    move: () => {
      const g = goalsNow(farm).find((x) => x.done)
      return g ? { what: `claim a goal (${g.def.id})`, at: null, run: () => claimGoal(g.def.id) } : null
    },
  },
  {
    name: 'storage',
    move: () => {
      const id = (['silo', 'barn'] as const).find((s) => canUpgradeStore(s))
      return id ? { what: `a bigger ${id}`, at: null, run: () => upgradeStore(id) } : null
    },
  },
  // the beds first: a ripe or dry bed stands still, an empty one grows nothing
  {
    name: 'harvest',
    move: () => {
      for (const p of PATCHES) {
        const ripe = stageIn(p.beds, 'ripe').filter(harvestFits)
        if (ripe.length) return { what: `harvest ${ripe.length} beds`, at: middleOf(p.beds), run: () => harvestBeds(ripe) }
      }
      return null
    },
  },
  {
    name: 'water',
    move: () => {
      for (const p of PATCHES) {
        const dry = stageIn(p.beds, 'thirsty')
        if (dry.length) return { what: `water ${dry.length} beds`, at: middleOf(p.beds), run: () => waterBeds(dry) }
      }
      return null
    },
  },
  {
    name: 'plant',
    move: () => {
      for (const p of PATCHES) {
        const empty = stageIn(p.beds, 'empty')
        const crop = empty.length ? plantNow() : null
        if (crop) return { what: `plant ${crop} in ${empty.length} beds`, at: middleOf(p.beds), run: () => plantBeds(empty, crop) }
      }
      return null
    },
  },
  // spending, as soon as the coins run to it: the cheapest thing for sale (and open at the farm's level)
  {
    name: 'buy',
    move: () => {
      const p = purchase()
      return p ? { what: `buy ${p.what} (${p.price})`, at: p.at, run: () => p.buy() } : null
    },
  },
  // what is ready at the animals, the tree and the machines
  {
    name: 'collect',
    move: () => {
      const id = PRODUCER_IDS.find(worthCollecting)
      if (!id) return null
      const kind = toolOwned(id)
      if (!kind) return { what: `collect ${PRODUCERS[id].good}`, at: producerAt(id), run: () => farm.producers[id].stock.forEach((_, i) => collect(id, i)) }
      // with its tool: at the fence, its panel open, a tap at a time (each from the fullest) until all is in or the
      // barn is full
      let taps = 0
      return {
        what: `${PRODUCERS[id].good} with the ${TOOLS[kind].name.toLowerCase()}`,
        at: toolAt(id),
        run: () => {
          while (toolTake(kind) > 0) taps++
        },
        taps: () => taps,
      }
    },
  },
  {
    name: 'take out',
    move: () => {
      const id = MACHINE_IDS.find(worthTakingOut)
      return id ? { what: `take out of the ${id}`, at: machineAt(id), run: () => collectMachine(id) } : null
    },
  },
  // selling: an order that can go, then the line at the gate
  {
    name: 'order',
    move: () => {
      const k = orderToSend()
      return k >= 0 ? { what: 'send an order', at: OFFICE_STAND, run: () => fillOrder(k) + Number(sendOrder(k)) } : null
    },
  },
  {
    name: 'sell',
    move: () => {
      const n = sellAllPreview().buyers
      return n ? { what: `sell to ${n} ${n === 1 ? 'buyer' : 'buyers'}`, at: GATE, run: () => sellAll() } : null
    },
  },
  // keeping the machines busy
  {
    name: 'load',
    move: () => {
      const id = MACHINE_IDS.find((m) => nextJob(m))
      if (!id) return null
      return {
        what: `queue jobs at the ${id}`,
        at: machineAt(id),
        run: () => {
          for (let r = nextJob(id); r && addJob(id, r.id); r = nextJob(id));
        },
      }
    },
  },
  // unsticking: a full line that waits for what the farm has none of and is not growing; a full store
  {
    name: 'decline',
    move: () => {
      if (inLine().length < placesInLine()) return null
      const v = waiting().find((w) => farm.inv[w.want] < w.qty && !farm.beds.some((b) => b.crop === w.want))
      return v ? { what: `decline a buyer (${v.want})`, at: GATE, run: () => declineOffer(v.id) } : null
    },
  },
  {
    name: 'make room',
    move: () => {
      for (const store of ['silo', 'barn'] as const) {
        // what waits and does not fit: the game's own Make room (the surplus nobody wants, at its fair price)
        if (makeRoomPreview(store).goods.length) return { what: `make room in the ${store}`, at: null, run: () => makeRoom(store) }
        if (room(store) > 0) continue
        const good = STORE_GOODS[store].filter((g) => managerPays(g) > 0).sort((a, b) => farm.inv[b] - farm.inv[a])[0]
        if (good) return { what: `sell ${good} to the manager`, at: MARKET, run: () => sellToManager(good) }
      }
      return null
    },
  },
]

// ───────────────────────────── before leaving ─────────────────────────────

/** When the visit ends (ms, on the calendar's clock: src/farm/state.ts, calendarTime) and the seconds until the next
 *  one: told by the session runner's observer as each visit begins (./journey.ts). Null: the player plays on and never
 *  leaves (./play.ts). */
let leave: { at: number; gap: number } | null = null
export function planLeave(plan: { at: number; gap: number } | null) {
  leave = plan
}
/** Before leaving, room is made in a building for at least this many goods waiting (fewer: they wait, and the animals
 *  would fill it again as the player goes round). */
const MAKE_ROOM_LEAST = 5
/** The last seconds of a visit, when what is left to do before leaving comes first. */
export const LEAVE_BEFORE = 180
const leaving = () => leave !== null && calendarTime() >= leave.at - LEAVE_BEFORE * 1000

/** How long a crop takes to ripen now (the week's events), and whether it ripens with no watering after its seeds'
 *  soak (sprinklers, or a crop whose soak lasts its whole growing). */
const ripensIn = (crop: CropId) => cropById(crop).growSeconds / eventSpeed('crops')
const ripensAlone = (crop: CropId) => farm.sprinkler || fullWater(crop) >= cropById(crop).growSeconds

/** The seconds until the visit ends, and then until the next one begins (Infinity: the player never leaves). */
const untilLeaving = () => (leave ? Math.max(0, (leave.at - calendarTime()) / 1000) : Infinity)
const untilBack = () => (leave ? untilLeaving() + leave.gap : Infinity)

/** The longest open crop the player can pay for that ripens by itself before the player is back (null: none). */
function longCrop(): CropId | null {
  const fits = CROPS.filter((c) => isUnlocked(`crop:${c.id}`) && farm.coins >= c.seedCost && ripensIn(c.id) <= untilBack() && ripensAlone(c.id))
  return fits.sort((a, b) => b.growSeconds - a.growSeconds)[0]?.id ?? null
}

/** The seeds that go in now: as `cropToPlant` chooses, unless they would not ripen before the visit ends; then the
 *  longest crop that ripens before the player is back (a player who leaves soon plants for the time away). */
function plantNow(): CropId | null {
  const crop = cropToPlant()
  if (!crop || ripensIn(crop) <= untilLeaving()) return crop
  return longCrop() ?? crop
}

/** The next job to queue at a machine before leaving: the dearest per press (what it adds) that is done before the
 *  player is back, with its ingredients in store. */
function jobForGap(id: MachineId) {
  const left = machineSecondsLeft(id)
  return [...MACHINES[id].recipes].sort((a, b) => jobAdds(b) - jobAdds(a)).find((r) => canAddJob(id, r) && left + r.seconds / eventSpeed('machines') <= untilBack())
}

/**
 * What a player does in a visit's last moments, before what they always do (update-v1/missions/01-loop-economy.md,
 * Foundation 5): harvest what is ripe (making room for it in the silo if it does not fit), then plant the longest open
 * crop that ripens within the time away in every empty bed, then queue each machine with the jobs that fit the time away, the dearest per press first. The farm then works
 * while they are gone, and a night pays.
 */
export const LEAVING: { name: string; move: () => Move | null }[] = [
  { name: 'harvest', move: () => PRIORITIES.find((p) => p.name === 'harvest')!.move() },
  {
    // a harvest that does not fit the silo: room made for it, so the bed can be sown for the time away; and a building
    // that cannot take what waits (a few goods at least: the animals fill on as the player goes round)
    name: 'make room',
    move: () => {
      const silo = farm.beds.some((_, i) => bedStage(i) === 'ripe' && !harvestFits(i)) && makeRoomPreview('silo').goods.length > 0
      const store = silo ? 'silo' : (['silo', 'barn'] as const).find((st) => makeRoomPreview(st).goods.reduce((n, g) => n + g.count, 0) >= MAKE_ROOM_LEAST)
      return store ? { what: `make room in the ${store} before leaving`, at: null, run: () => makeRoom(store) } : null
    },
  },
  {
    name: 'plant long',
    move: () => {
      for (const p of PATCHES) {
        const empty = stageIn(p.beds, 'empty')
        const crop = empty.length ? longCrop() : null
        if (crop) return { what: `plant ${crop} in ${empty.length} beds before leaving`, at: middleOf(p.beds), run: () => plantBeds(empty, crop) }
      }
      return null
    },
  },
  {
    name: 'queue long',
    move: () => {
      const id = MACHINE_IDS.find((m) => jobForGap(m))
      if (!id) return null
      return {
        what: `queue the ${id} before leaving`,
        at: machineAt(id),
        run: () => {
          for (let r = jobForGap(id); r && addJob(id, r.id); r = jobForGap(id));
        },
      }
    },
  },
]

/** The move to make now: the first priority that has one (null: nothing useful to do); in a visit's last moments,
 *  what is left to do before leaving first. */
export function nextMove(): (Move & { rule: string }) | null {
  for (const p of leaving() ? [...LEAVING, ...PRIORITIES] : PRIORITIES) {
    const m = p.move()
    if (m) return { ...m, rule: p.name }
  }
  return null
}

/** What is on its way while the player waits, the soonest first, in a few words: for the report's gaps. */
export function onTheWay(): string {
  const soon: { s: number; what: string }[] = []
  farm.beds.forEach((b, i) => {
    if (!b.crop || bedStage(i) === 'ripe') return
    const left = cropById(b.crop).growSeconds - b.growth
    soon.push({ s: farm.sprinkler ? left : Math.min(left, b.water), what: farm.sprinkler || left <= b.water ? `${b.crop} ripe` : `${b.crop} thirsty` })
  })
  for (const id of MACHINE_IDS) if (machineStage(id) === 'working') soon.push({ s: machineSecondsLeft(id), what: `the ${id} done` })
  if (inLine().length < placesInLine()) soon.push({ s: farm.nextVisitorIn, what: 'a buyer' })
  for (const id of PRODUCER_IDS) {
    const p = farm.producers[id]
    if (!p.stock.length) continue
    const def = PRODUCERS[id]
    const most = maxOf(id) * p.stock.length
    const need = Math.ceil(most / 2) - p.stock.reduce((a, b) => a + b, 0)
    const rate = (def.herd?.shared ? p.animals : p.stock.length) / def.every
    if (need > 0 && room(storeOf(def.good)) > 0) soon.push({ s: need / rate, what: `${def.good} to collect` })
  }
  const short = waiting().filter((v) => farm.inv[v.want] < v.qty)
  const line = short.length ? ` · line wants ${[...new Set(short.map((v) => v.want))].join(', ')}` : ''
  const first = soon.sort((a, b) => a.s - b.s)[0]
  const full = (['silo', 'barn'] as const).filter((s) => room(s) <= 0)
  return `${first ? `${first.what} in ${Math.ceil(first.s)} s` : 'nothing growing'}${line}${full.length ? ` · ${full.join(' and ')} full` : ''} · ${farm.coins} coins`
}
