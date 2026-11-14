import { CROPS, START_COINS, type ProduceId } from '../../../src/farm/data'
import type { AwayReport, Slot, SlotSummary } from '../../../src/farm/state'
import { levelOf, xpAt } from '../../../src/farm/xp'

// The opening screen's data: the three farms as the save list reads them (SlotSummary, src/farm/state.ts), each with
// its level (levelOf its saved XP) and what waits on it (the away report the game makes as a farm is loaded:
// cameBack → AwayReport). Every number is one the game can make: a bed's harvest is its crop's yield, a nest holds at
// most 6 eggs, a cow 3 bottles, a sheep 2 fleeces, the tree 8 lemons, the line 5 buyers.

/** What waits on a farm: its away report's goods, the buyers who joined the line and the orders that came in. */
export type Waiting = Pick<AwayReport, 'seconds' | 'goods' | 'buyers' | 'orders'>

/** A save slot as the opening screen shows it. `level` and `waiting` are not in SlotSummary today (see the board). */
export interface Farm extends SlotSummary {
  level: number
  waiting: Waiting | null
}

export interface IntroState {
  /** the farm the big button plays */
  slot: Slot
  farms: Farm[]
}

export const farmOf = (s: IntroState) => s.farms.find((f) => f.slot === s.slot) ?? s.farms[0]
export const isCrop = (id: ProduceId) => CROPS.some((c) => c.id === id)
/** More than one farm with something on it: choosing one matters. */
export const several = (s: IntroState) => s.farms.filter((f) => f.exists).length > 1

/** How long ago, in a word or two: "just now", "25 min", "3 h", "2 days". */
export function ago(seconds: number) {
  if (seconds < 90) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`
  const d = Math.round(seconds / 86400)
  return `${d} day${d === 1 ? '' : 's'}`
}

/** A slot's age now, from its savedAt. */
export const savedAgo = (f: Farm) => (f.savedAt ? ago((Date.now() - f.savedAt) / 1000) : '')

const H = 3600
const NOW = Date.now()

export const emptyFarm = (slot: Slot): Farm => ({ slot, exists: false, played: false, coins: START_COINS, earned: 0, sold: 0, growing: 0, animals: 0, savedAt: null, level: 1, waiting: null })

const farm = (slot: Slot, points: number, o: Pick<SlotSummary, 'coins' | 'earned' | 'sold' | 'growing' | 'animals'>, waiting: Waiting): Farm => ({
  slot,
  exists: true,
  played: true,
  ...o,
  level: levelOf(points),
  savedAt: NOW - waiting.seconds * 1000,
  waiting,
})

/** The first farm after an evening away: two beds of tomatoes and one of strawberries ripe, the nest, the cow and the
 *  two sheep full, four buyers at the gate and an order on the board. */
const evening = farm(
  1,
  xpAt(7) + 40,
  { coins: 284, earned: 1460, sold: 132, growing: 6, animals: 5 },
  {
    seconds: 3 * H + 600,
    goods: [
      { item: 'tomato', count: 16 },
      { item: 'strawberry', count: 8 },
      { item: 'egg', count: 6 },
      { item: 'milk', count: 3 },
      { item: 'wool', count: 4 },
    ],
    buyers: 4,
    orders: 1,
  },
)

/** A bigger farm left for a short break, and an older one left for two days. */
const big = farm(
  2,
  xpAt(12) + 90,
  { coins: 1180, earned: 4850, sold: 640, growing: 8, animals: 9 },
  {
    seconds: 25 * 60,
    goods: [
      { item: 'pumpkin', count: 4 },
      { item: 'corn', count: 8 },
      { item: 'lemon', count: 8 },
      { item: 'cloth', count: 2 },
    ],
    buyers: 2,
    orders: 2,
  },
)
const small = farm(
  1,
  xpAt(4) + 20,
  { coins: 64, earned: 210, sold: 31, growing: 2, animals: 5 },
  {
    seconds: 2 * 86400,
    goods: [
      { item: 'lettuce', count: 8 },
      { item: 'egg', count: 6 },
      { item: 'milk', count: 3 },
    ],
    buyers: 5,
    orders: 0,
  },
)

export const STATES: { id: string; name: string; data: IntroState }[] = [
  { id: 'new', name: 'שחקן חדש: אין עדיין חווה', data: { slot: 1, farms: [emptyFarm(1), emptyFarm(2), emptyFarm(3)] } },
  { id: 'back', name: 'שחקן חוזר: דברים מחכים בחווה', data: { slot: 1, farms: [evening, emptyFarm(2), emptyFarm(3)] } },
  { id: 'many', name: 'כמה חוות: לבחור באיזו לשחק', data: { slot: 2, farms: [small, big, emptyFarm(3)] } },
]

/** A farm started afresh (the save list's Clear): empty, and the button plays a new one. */
export const cleared = (s: IntroState, slot: Slot): IntroState => ({ ...s, farms: s.farms.map((f) => (f.slot === slot ? emptyFarm(slot) : f)) })
