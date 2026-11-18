import { MACHINE_IDS, PRODUCE, PRODUCER_IDS, type ProduceId } from '../data'
import { dayNumber } from '../daily'
import { freshEvents } from '../events'
import { freshLedger } from '../ledger'
import { clampLevels, freshMarket } from '../market'
import { freshMachine } from '../machines'
import type { Order, OrderLine } from '../orders'
import type { Visitor } from '../state'
import type { MarketFarm, MarketNow } from './marketView'

// Farms for the computer's tests (./*.test.ts), built by hand from the game's own fresh parts: no page, no storage, no
// state module. Not part of the game.

/** A new farm's parts: nothing in store, the machines new, two hens, a cow and two sheep, level 1, nothing sold. */
export function farmOf(over: Partial<MarketFarm> = {}): MarketFarm {
  return {
    inv: Object.fromEntries(PRODUCE.map((p) => [p.id, 0])) as Record<ProduceId, number>,
    machines: Object.fromEntries(MACHINE_IDS.map((m) => [m, freshMachine()])) as MarketFarm['machines'],
    ladders: clampLevels({}),
    market: freshMarket(),
    visitors: [],
    orders: [],
    events: freshEvents(),
    xp: { points: 0, paid: 1 },
    producers: Object.fromEntries(
      PRODUCER_IDS.map((id) => [id, { animals: id === 'hens' ? 2 : id === 'cows' ? 1 : id === 'sheep' ? 2 : 0, stock: [] as number[], timer: [] as number[] }]),
    ) as MarketFarm['producers'],
    compost: false,
    paceLevel: 0,
    planted: [],
    made: [],
    ledger: freshLedger(),
    ...over,
  }
}

/** A buyer who wants `qty` of a good for `offer` coins, standing in line (or on their way, or going home). */
export const buyer = (want: ProduceId, qty: number, offer: number, phase: Visitor['phase'] = 'queued'): Visitor => ({
  id: 1,
  name: 'Noa',
  look: {} as Visitor['look'],
  want,
  qty,
  offer,
  phase,
  path: [],
  leg: 0,
  x: 0,
  z: 0,
  heading: 0,
  moving: false,
  mood: 'neutral',
  moodAt: 0,
  departAt: 0,
  gift: false,
})

/** An order of these lines (good, how many it wants, how many are in) that pays `coins`. */
export const order = (coins: number, ...lines: [ProduceId, number, number][]): { order: Order } => ({
  order: { id: 1, coins, surprise: false, lines: lines.map(([good, want, have]): OrderLine => ({ good, want, have })) },
})

/** A moment of the device's clock, local time (month 1–12), and the moment as the views take it. */
export const local = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).getTime()
export const nowAt = (ms: number | null, day = dayNumber(ms ?? local(2026, 11, 18))): MarketNow => ({ at: ms, day })

/** Days of the week in November 2026: Wednesday the 18th (the harvest festival), Thursday the 19th (gift day), Friday
 *  the 20th (the machine rush from 16:00), Saturday the 21st (the lucky draw), Monday the 23rd (market day). */
export const WEDNESDAY = local(2026, 11, 18)
export const THURSDAY = local(2026, 11, 19)
export const FRIDAY_EVENING = local(2026, 11, 20, 18)
export const SATURDAY = local(2026, 11, 21)
export const MONDAY = local(2026, 11, 23)
