import type { Channel } from '../ledger'
import type { CropId, ProduceId } from '../data'
import type { MarketView } from './marketView'
import type { PlanView } from './planView'

// The computer's desktop widget, "Today" (./ComputerDesk.tsx): the vegetable index with where it is heading and its
// week, the lucky draw's goods, what pays most now and where, and the best bed to plant — a line each, from the views
// the apps draw (./marketView.ts, ./planView.ts), so the widget never disagrees with them. Pure.

/** Within this many percent a number holds (it is not heading anywhere): the Market's own. */
const STILL = 0.5

export interface TodayView {
  /** the vegetable index now, its last seven days (today last) and tomorrow, and where it is heading */
  index: { now: number; days: number[]; tomorrow: number; dir: 'up' | 'down' | 'flat'; pct: number }
  /** the goods on the lucky draw today (sell for double) */
  drawn: ProduceId[]
  /** the good that pays most a unit now, at the place that pays most for it (of what the farm has, else of what it
   *  knows); null: nothing open to sell */
  paysMost: { good: ProduceId; channel: Channel; per: number } | null
  /** the bed that brings most a minute of growing, of the crops open; null: none */
  bestBed: { crop: CropId; perMinute: number; perPress: number; seconds: number } | null
}

export function todayView(market: MarketView, plan: PlanView): TodayView {
  const ix = market.index
  const pct = ix.now > 0 ? (ix.tomorrow / ix.now - 1) * 100 : 0
  const open = market.goods.filter((g) => !g.material && g.known && g.locked === null)
  const had = open.filter((g) => g.have > 0)
  let paysMost: TodayView['paysMost'] = null
  for (const g of had.length ? had : open) {
    const c = g.channels.find((ch) => ch.id === g.best)
    if (c && (!paysMost || c.per > paysMost.per)) paysMost = { good: g.id, channel: c.id, per: c.per }
  }
  const bed = plan.beds.find((b) => b.locked === null)
  return {
    index: { now: ix.now, days: ix.days.slice(-7), tomorrow: ix.tomorrow, dir: pct > STILL ? 'up' : pct < -STILL ? 'down' : 'flat', pct },
    drawn: market.goods.filter((g) => g.why.some((w) => w.kind === 'draw')).map((g) => g.id),
    paysMost,
    bestBed: bed ? { crop: bed.makes as CropId, perMinute: bed.perMinute, perPress: bed.perPress, seconds: bed.seconds } : null,
  }
}
