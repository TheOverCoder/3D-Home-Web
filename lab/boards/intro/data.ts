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

/** A page of the opening screen's card: its menu, or one of the pages its tiles open. */
export type Page = 'menu' | 'new' | 'load' | 'settings' | 'music' | 'help' | 'credits'

export interface IntroState {
  /** the page the card shows as it opens (the menu when not given) */
  page?: Page
  /** the farm the big button plays */
  slot: Slot
  farms: Farm[]
  /** how much of the game has loaded (0–1, LoadStatus's own share): under 1 the big button is the loading bar, and in the
   *  lab it goes on to 1 by itself */
  load?: number
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
export const evening = farm(
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
export const big = farm(
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
export const small = farm(
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
  { id: 'new', name: 'שחקן חדש – פותח את המשחק בפעם הראשונה, עוד אין לו חווה', data: { slot: 1, farms: [emptyFarm(1), emptyFarm(2), emptyFarm(3)] } },
  { id: 'back', name: 'שחקן חוזר – חזר אחרי 3 שעות, ובחווה מחכים לו דברים', data: { slot: 1, farms: [evening, emptyFarm(2), emptyFarm(3)] } },
  { id: 'many', name: 'שחקן עם שתי חוות שמורות – בוחר באיזו לשחק', data: { slot: 2, farms: [small, big, emptyFarm(3)] } },
  { id: 'loading', name: 'המשחק עוד נטען (62%) – שחקן חוזר; נטען עד הסוף מעצמו', data: { slot: 1, farms: [evening, emptyFarm(2), emptyFarm(3)], load: 0.62 } },
  { id: 'new-farm', name: 'הדף New farm פתוח (שתי חוות שמורות, מקום אחד ריק)', data: { slot: 2, farms: [small, big, emptyFarm(3)], page: 'new' } },
  { id: 'load-farm', name: 'הדף Load farm פתוח (שתי חוות שמורות)', data: { slot: 2, farms: [small, big, emptyFarm(3)], page: 'load' } },
  { id: 'settings', name: 'הדף Settings פתוח', data: { slot: 1, farms: [evening, emptyFarm(2), emptyFarm(3)], page: 'settings' } },
  { id: 'music', name: 'הדף Music פתוח', data: { slot: 1, farms: [evening, emptyFarm(2), emptyFarm(3)], page: 'music' } },
]

// SAMPLE DATA for a feature the game does not have (the opening screen's E and the saved farms' D): each farm's own
// name, and a few names a new farm can be given with a roll of the dice.
export const FARM_NAMES: Record<number, string> = { 1: 'Sunny Acres', 2: 'Maple Hollow', 3: 'Clover Patch' }
export const NEW_NAMES = ['Honey Meadow', 'Willow Bend', 'Pumpkin Hill', 'Bluebell Farm', 'Sunny Acres', 'Maple Hollow', 'Clover Patch']

/** A farm started afresh (the save list's Clear): empty, and the button plays a new one. */
export const cleared = (s: IntroState, slot: Slot): IntroState => ({ ...s, farms: s.farms.map((f) => (f.slot === slot ? emptyFarm(slot) : f)) })
