import { farmSound } from '../../audio/sound'
import { num } from '../../lib/saved'
import { DAY, produceById, type ProduceId } from '../data'
import { priceOf } from '../prices'
import { activeAt, canDraw, dateKey, drawGoods, drawPool, EVENTS, luckyNow, markSeen, newsWaiting, priceFactor } from '../events'
import { dayNumber } from '../calendar'
import { moodOf, moodOn } from '../mood'
import { shortMaterials } from '../contractor'
import { dayOf, hourOf, phaseOf } from '../day'
import { bump, calendarTime, eventTime, farm, random, save, toast } from './core'
import { inLine, knownGoods } from './buyers'
import { contractorDay } from './contractor'

// The farm's day (its clock, its hour and phase, the morning's word), and the week's events: the lucky draw and the
// farm news.

let dayFrozen = false
/** The farm's hour, phase and day now. */
export const dayNow = () => ({ hour: hourOf(farm.day.t), phase: phaseOf(farm.day.t), day: dayOf(farm.day.t) })

/** The day's clock as saved: seconds from 0. Past what any farm can have been played, adding a frame would no longer
 *  move it on: it keeps its hour and starts counting days again. */
export function dayClock(v: unknown): number {
  const t = Math.max(0, num(v, 0))
  return t > 1e10 ? t % DAY.length : t
}

/** Sets the farm's clock to an hour of today (tests, ?debug): a day runs from the morning's first hour (5) through
 *  the small hours after midnight, so 4 is the end of today and 24 + h is h tomorrow. An hour before the farm's first
 *  morning began is that hour of the next day. */
export function setHour(h: number) {
  if (!Number.isFinite(h)) return
  const hour = DAY.length / 24
  const first = DAY.phases[0].from
  const today = (dayOf(farm.day.t) * 24 + first - DAY.start) * hour
  let t = today + (h >= first ? h - first : h + 24 - first) * hour
  if (t < 0) t += DAY.length
  farm.day.t = t
  bump()
  save()
}
/** Stops the farm's clock while you play (tests: the light must not change between two renders compared); time away
 *  still passes. */
export function freezeDay(on: boolean) {
  dayFrozen = on
}
export const dayIsFrozen = () => dayFrozen

/** The phase the last frame saw: the contractor's morning is told as it turns. */
let lastPhase: string | null = null
/** It set as another farm or a time away leaves it (null: no morning is told on the next frame). */
export function setLastPhase(phase: string | null) {
  lastPhase = phase
}

/** The day goes on in play: a new day brings the contractor's pieces, and the morning he has something the silo or
 *  the barn is short of, a word and a chime. */
export function runDay(dt: number) {
  if (!dayFrozen) farm.day.t += dt
  contractorDay()
  const phase = phaseOf(farm.day.t)
  if (lastPhase && lastPhase !== phase && phase === DAY.phases[0].id) {
    const short = shortMaterials(farm)
    const piece = farm.contractor.offers.find((o) => !o.sold && short.includes(o.item))
    if (piece) {
      toast(`The contractor has ${produceById(piece.item).plural} today`, piece.item)
      farmSound('chime')
    }
  }
  lastPhase = phase
}

/** The most a buyer offers, and an order pays (as the save keeps them). */
const MOST_OFFER = 999
const MOST_PAY = 99_999

/** The events on now (none while they are off). */
export const eventsNow = () => {
  const at = eventTime()
  return at === null ? [] : activeAt(at)
}
/** What the day multiplies a good's price by wherever it is sold (src/farm/prices.ts, priceEvents: every sale prices
 *  through priceOf): the lucky draw's goods double on its day, and the town's market mood (src/farm/mood.ts) of the
 *  events' day — a time away's step on its own — or, with the events off, the calendar's. */
export const dayFactor = (good: ProduceId) => priceFactor(good, farm.events, eventTime()) * (moodOn() ? moodOf(good, dayNumber(eventTime() ?? calendarTime())) : 1)

/** The goods a lucky draw picks from: those a buyer could ask for (what the farm grows and makes). */
export const luckyPool = () => drawPool(knownGoods())

/**
 * The lucky draw (the farm news, src/farm/news): on its day, once, two goods the farm makes, on the farm's dice. From
 * then until the day ends they sell for double wherever they are sold (priceOf), and what already waits for them pays
 * their part double at once: the buyers in line who ask for one raise their offer, an order on the board its pay by
 * their share of it. No XP: an event is not something the player did. The goods, or null (not its day, or drawn).
 */
export function drawLucky(): ProduceId[] | null {
  const at = eventTime()
  const lucky = luckyNow(at)
  if (at === null || !lucky || !canDraw(farm.events, at)) return null
  const goods = drawGoods(knownGoods(), random)
  if (!goods.length) return null
  const times = EVENTS.lucky.times
  for (const v of inLine()) if (goods.includes(v.want)) v.offer = Math.min(MOST_OFFER, Math.round(v.offer * times))
  // (each order's share in the prices before the draw)
  for (const slot of farm.orders) {
    if (!('order' in slot)) continue
    const o = slot.order
    const all = o.lines.reduce((n, l) => n + priceOf(l.good) * l.want, 0)
    const drawn = o.lines.reduce((n, l) => n + (goods.includes(l.good) ? priceOf(l.good) * l.want : 0), 0)
    if (drawn > 0 && all > 0) o.coins = Math.min(MOST_PAY, Math.round(o.coins * (1 + (drawn / all) * (times - 1))))
  }
  farm.events = { draw: { day: dateKey(lucky.start), goods }, seen: markSeen(farm.events, at) }
  bump()
  save()
  return goods
}

/** The farm news was open: the events on now are shown (its badge goes, but for a draw not made). */
export function sawNews() {
  const seen = markSeen(farm.events, eventTime())
  if (seen === farm.events.seen) return
  farm.events = { ...farm.events, seen }
  bump()
  save()
}

/** What waits in the farm news: the events on that it has not shown, and the lucky draw not made (its badge). */
export const newsBadge = () => newsWaiting(farm.events, eventTime())
