import type { ProduceId } from '../../../src/farm/data'
import { dateKey, drawGoods, freshEvents, type EventsRecord } from '../../../src/farm/events'

// The farm news's sample data (never the game's numbers: a farm and its week made up for the lab). The moments are of
// one real week (16–22 November 2026, local time); what is on then, and the words, are the game's own pure code
// (src/farm/events.ts: EVENTS, activeAt, upcoming; src/farm/news/view.ts: newsView). The draw here rolls on the lab's
// own dice, as the game's rolls on the farm's.

export interface NewsState {
  /** the moment the news is read at (ms) */
  at: number
  /** the farm's record of its events */
  rec: EventsRecord
  /** what it had shown as it opened (what is marked new) */
  seenBefore: string[]
}

/** A sample farm's goods: what a buyer could ask it for, so what a draw picks from. */
export const POOL: ProduceId[] = ['wheat', 'carrot', 'tomato', 'strawberry', 'pumpkin', 'lemon', 'egg', 'milk', 'flour', 'lemon_cake', 'cloth']

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()

/** The lab's dice (the same draw every time). */
const dice = (seed: number) => () => {
  const x = Math.sin(seed++ * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** The draw made (as the game's drawLucky does it, on the lab's dice): the goods, kept on its day. */
export function drawn(s: NewsState): [NewsState, ProduceId[]] {
  const goods = drawGoods(POOL, dice(Math.floor(s.at / 60_000) % 997))
  return [{ ...s, rec: { ...s.rec, draw: { day: dateKey(s.at), goods } } }, goods]
}

const SATURDAY = at(21, 10, 5)
export const DRAW: NewsState = { at: SATURDAY, rec: freshEvents(), seenBefore: [] }
export const DRAWN: NewsState = { at: at(21, 15, 40), rec: { draw: { day: '2026-11-21', goods: ['tomato', 'lemon_cake'] }, seen: ['lucky@2026-11-21'] }, seenBefore: ['lucky@2026-11-21'] }
export const FESTIVAL: NewsState = { at: at(18, 13, 20), rec: freshEvents(), seenBefore: [] }
export const RUSH: NewsState = { at: at(20, 18, 45), rec: { draw: null, seen: ['rush@2026-11-20'] }, seenBefore: ['rush@2026-11-20'] }
export const QUIET: NewsState = { at: at(17, 11, 0), rec: freshEvents(), seenBefore: [] }
