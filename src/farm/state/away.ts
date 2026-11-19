import { MACHINE_IDS, PRODUCER_IDS, PRODUCERS, STORE_IDS, storeOf, type MachineId, type ProduceId, type ProducerId, type StoreId } from '../data'
import { dayOf, phaseOf } from '../day'
import { bump, calendarTime, eventSpeed, eventTime, farm, save, setCalendarStep, setStepAt } from './core'
import { room } from './stores'
import { bedStage, bedYield } from './beds'
import { machineDone } from './machines'
import { arrivalSeconds, placesInLine } from './shop'
import { inLine, spawnVisitor } from './buyers'
import { contractorDay } from './contractor'
import { setLastPhase } from './day'
import { shopAway } from './market'
import { grow } from './tick'

// Time away (the page closed or hidden): the farm goes on for it, and what happened is kept for the welcome back.

/** The most of a time away the farm goes on for: the page closed, or hidden (another app, the phone locked). A day
 *  (decision 2): a night away pays, and nothing set before it outlasts it (state.away.test.ts holds every crop and
 *  every machine's full queue to it). */
export const AWAY_MOST = 24 * 3600
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
  /** it rained while you were away, and the rain watered the beds (src/farm/weather.ts) */
  rained: boolean
}

function awayReport(before: Snapshot, seconds: number, counted: number, rained = false): AwayReport {
  const after = snapshot()
  const goods = new Map<ProduceId, number>()
  const add = (item: ProduceId, n: number) => n > 0 && goods.set(item, (goods.get(item) ?? 0) + n)
  farm.beds.forEach((b, i) => {
    if (after.ripe[i] && !before.ripe[i] && b.crop) add(b.crop, bedYield(i))
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
    rained,
  }
}

/** Whether a report has anything to tell. */
export const awayNews = (r: AwayReport) => r.goods.length > 0 || r.buyers > 0 || r.orders > 0 || r.tractor || r.thirsty > 0 || r.full.length > 0 || r.shop !== null || r.rained

/** The farm goes on for a time away, as it would have: in steps of 5 s (a bed ripens, an animal fills, a machine
 *  finishes in the step it would have), buyers joining the line as they come, as many as it has room for; shoppers
 *  visit your shop and buy as they would have; the day goes on (frozen or not: a test's frozen light is for play), and
 *  a new day brings the contractor's new pieces. The week's events count for each step at its own time (`from`: when
 *  the time away began, by the events' clock): one that began or ended while you were away, only for its part. Each
 *  step is on its own calendar day too (`day`: when the time away began, by the calendar's clock): a sale in the shop
 *  goes into the ledger on the day it was made. */
function goOn(seconds: number, from: number | null = null, day: number | null = null): number {
  // the seconds the buyers' countdown ran beyond the time (twice as fast on a market day)
  let more = 0
  let into = 0
  // the beds the rain watered while you were away
  let rained = 0
  try {
    for (let left = seconds; left > 0; left -= 5) {
      const dt = Math.min(5, left)
      if (from !== null) setStepAt(from + into * 1000)
      if (day !== null) setCalendarStep(day + into * 1000)
      farm.clock += dt
      farm.day.t += dt
      rained += grow(dt)
      shopAway(dt)
      more += dt * (eventSpeed('buyers') - 1)
      into += dt
    }
  } finally {
    setStepAt(null)
    setCalendarStep(null)
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
  return rained
}

/** The last time away, until the game has shown it (Welcome back, src/farm/FarmUI.tsx). */
let lastAway: AwayReport | null = null
export const awaySummary = () => lastAway
export const clearAwaySummary = () => {
  lastAway = null
  bump()
}

/** Another farm (loaded, switched to, started again): the last time away is not its own. */
export function forgetAway() {
  lastAway = null
}

/** Back after `seconds` away (the page hidden, or closed): the farm goes on for that time (at most a day, AWAY_MOST),
 *  and what happened is kept for the game to tell, when it was long enough and anything did. */
export function cameBack(seconds: number): AwayReport | null {
  if (!(seconds > 0)) return null
  const counted = Math.min(AWAY_MOST, seconds)
  const before = snapshot()
  // the time away began `seconds` ago, by the events' clock and by the calendar's
  const now = eventTime()
  const rained = goOn(counted, now === null ? null : now - seconds * 1000, calendarTime() - seconds * 1000)
  const report = awayReport(before, seconds, counted, rained > 0)
  // the morning that came while away is not told as it turns (the contractor's word is for one seen in play)
  setLastPhase(phaseOf(farm.day.t))
  if (seconds >= AWAY_TELLS && awayNews(report)) lastAway = report
  bump()
  save()
  return report
}
