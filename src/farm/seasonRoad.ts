// The season road (update-v1/JOURNEY.md fix 4, decision 10; CONTRACTS.md §1.10): ten stops a season, fed by the XP the
// farm earns, each coming in by itself as it is reached (as a level's coins do), its last one the season's garment and
// a big gift. It runs on the long clock, days played (src/farm/calendar.ts), so it waits through any absence, and it is
// never reset by the calendar: a road not finished carries on into the next season (`on` is the road being filled, never
// past the season now), the XP past its end flowing into the next one until the farm has caught up; a road finished
// in its own season waits, done, for the next season's to open. The farm news's "This season" tab draws it
// (src/farm/news/NewsCard.tsx). Pure: the rules and the record; src/farm/state/seasonRoad.ts feeds it in gainXp and pays
// its stops through `give`.

import type { ArtId } from '../ui/art'
import { intIn, isObject } from '../lib/saved'
import type { ProduceId } from './data'
import type { Prize } from './prize'
import { seasonGarment, type Garment } from './outfit'
import { sized } from './prize'
import { nearest, reached, stops, type Nearest, type Road } from './road'
import { SEASON_IDS, SEASONS } from './season'

/** What a stop gives: coins (a share of the next level's: src/farm/prize.ts, sized), a few of the building material the
 *  silo or the barn is shortest of, a few of the good the farm makes most, the season's banner (mission 02 c8: a pennant
 *  in its two colours, into the farm's store), or the season's garment with a big gift. */
export type StopKind = 'coins' | 'material' | 'goods' | 'banner' | 'garment'

/** [review] The season road's stops, one table for every season: 10 a season, the last the season's garment. */
export const SEASON_ROAD: readonly { kind: StopKind; share?: number }[] = [
  { kind: 'coins', share: 0.25 },
  { kind: 'material' },
  { kind: 'coins', share: 0.35 },
  { kind: 'goods' },
  { kind: 'coins', share: 0.5 },
  { kind: 'banner' },
  { kind: 'coins', share: 0.6 },
  { kind: 'goods' },
  { kind: 'coins', share: 0.75 },
  { kind: 'garment', share: 1 },
]

/** The XP from a road's start to its last stop: sized so that a player of ten minutes a day (src/sim/targets.ts,
 *  SESSIONS.light) reaches the last stop by the season's day 6 (PACE.road, held on the session runner by
 *  ./seasonRoad.pace.test.ts). That player's XP a day played stays about the same over the first month, so every
 *  season's road is the same length. */
export const ROAD_XP = 1600
/** The stops are a little closer at the start: stop k at ROAD_XP · (k / 10) ^ ROAD_CURVE. */
const ROAD_CURVE = 1.15

/** A season's road: the XP into it each stop is reached at. */
export const roadOf = (_ordinal: number): Road => stops(SEASON_ROAD.length, (k) => ROAD_XP * (k / SEASON_ROAD.length) ** ROAD_CURVE)
/** The XP at a road's last stop. */
export const roadEnd = (ordinal: number) => roadOf(ordinal)[SEASON_ROAD.length - 1]

/** The season road as saved: the road being filled (a season's ordinal: 0 the first spring), the XP into it, the stops
 *  given on it. */
export interface SeasonRoadRecord {
  on: number
  xp: number
  paid: number
}
/** A road at its start: the season of this ordinal's. */
export const freshRoad = (ordinal: number): SeasonRoadRecord => ({ on: Math.max(0, Math.floor(ordinal)), xp: 0, paid: 0 })

/** The road a record stands on with the season now `now` (an ordinal): one finished in an earlier season gives way to the
 *  next season's (from nothing), until the season now. */
export function settleRoad(r: SeasonRoadRecord, now: number): SeasonRoadRecord {
  let rec = r
  while (rec.on < now && rec.paid >= SEASON_ROAD.length) rec = freshRoad(rec.on + 1)
  return rec
}

/** A stop reached: on the road of `on`, stop `stop` (from 1). */
export interface StopReached {
  on: number
  stop: number
}

/**
 * The road fed `xp` with the season now `now`: the XP goes into the road being filled, each stop it passes reached (to
 * be given, once), and past a road's end into the next season's while the farm is behind (a road of an earlier season);
 * the season now's road, once finished, takes no more (nothing is banked for the next). The record after, and the stops
 * reached, in order.
 */
export function fed(r: SeasonRoadRecord, xp: number, now: number): { road: SeasonRoadRecord; reached: StopReached[] } {
  let rec = settleRoad(r, now)
  const got: StopReached[] = []
  let left = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0
  while (left > 0) {
    const road = roadOf(rec.on)
    const end = road[road.length - 1]
    const add = Math.min(left, Math.max(0, end - rec.xp))
    left -= add
    rec = { ...rec, xp: rec.xp + add }
    const k = reached(road, rec.xp)
    for (let s = rec.paid + 1; s <= k; s++) got.push({ on: rec.on, stop: s })
    rec = { ...rec, paid: Math.max(rec.paid, k) }
    if (rec.paid < SEASON_ROAD.length || rec.on >= now) break
    rec = freshRoad(rec.on + 1)
  }
  return { road: rec, reached: got }
}

/** What stop `stop` of the road of `on` gives at the farm's level: its coins; or a few of `material` (the one the silo or
 *  the barn is shortest of); or a few of `good` (the good the farm makes most; a material while it makes none); or the
 *  season's garment (none past the first two years) and the big gift's coins. */
export function stopPrizes(stop: number, on: number, level: number, material: ProduceId, good: ProduceId | null): Prize[] {
  const row = SEASON_ROAD[Math.min(SEASON_ROAD.length, Math.max(1, stop)) - 1]
  const l = Math.max(1, Math.floor(level))
  const materials: Prize = { item: material, n: Math.min(6, 2 + Math.floor(l / 15)) }
  if (row.kind === 'coins') return [{ coins: sized(row.share ?? 0.25, level, 5) }]
  if (row.kind === 'material') return [materials]
  if (row.kind === 'goods') return [good ? { item: good, n: Math.min(10, 3 + Math.floor(l / 10)) } : materials]
  if (row.kind === 'banner') return [{ decor: 'banner', look: SEASON_IDS[Math.max(0, Math.floor(on)) % SEASON_IDS.length] }]
  const g = seasonGarment(on)
  return [...(g ? [{ garment: g.id }] : []), { coins: sized(row.share ?? 1, level, 5) }]
}

/** A season's name and picture by its ordinal: "Spring", "Summer"…; from the second year, "Spring, year 2". */
const ART: Record<(typeof SEASON_IDS)[number], ArtId> = { spring: 'seedling', summer: 'sun', autumn: 'fallen-leaf', winter: 'crescent-moon' }
export function seasonName(ordinal: number): { name: string; art: ArtId } {
  const id = SEASON_IDS[Math.max(0, Math.floor(ordinal)) % SEASON_IDS.length]
  const year = Math.floor(Math.max(0, ordinal) / SEASON_IDS.length) + 1
  return { name: year > 1 ? `${SEASONS[id].name}, year ${year}` : SEASONS[id].name, art: ART[id] }
}

/** A stop as the road shows it: given, the next, or still to come; what it gives (coins with how many, a material, goods,
 *  the season's garment). */
export interface RoadStopView {
  stop: number
  at: number
  kind: StopKind
  state: 'got' | 'next' | 'later'
  coins?: number
  garment?: Garment
}

/** What the farm news's "This season" tab shows (src/farm/news/NewsCard.tsx). */
export interface SeasonRoadView {
  /** the road being filled: its season's ordinal, name and picture */
  on: number
  name: string
  art: ArtId
  /** it is the season now's (else a road carried on from an earlier season) */
  current: boolean
  xp: number
  road: Road
  stops: RoadStopView[]
  /** the next stop: how far, almost there; null once the road is done */
  next: Nearest | null
  done: boolean
  /** done: the next season's name, and the days played before its road opens (the days left in this season, and one) */
  opens: { name: string; days: number } | null
}

/** The road a record stands on, shown with the season now (its ordinal and the days played left in it) at the farm's
 *  level. */
export function roadView(r: SeasonRoadRecord, now: { ordinal: number; left: number }, level: number): SeasonRoadView {
  const rec = settleRoad(r, now.ordinal)
  const road = roadOf(rec.on)
  const next = nearest(road, rec.xp)
  const stopsView = SEASON_ROAD.map((row, i): RoadStopView => {
    const stop = i + 1
    const state = stop <= rec.paid ? 'got' : next && stop === next.stop ? 'next' : 'later'
    return {
      stop,
      at: road[i],
      kind: row.kind,
      state,
      coins: row.kind === 'coins' || row.kind === 'garment' ? sized(row.share ?? 1, level, 5) : undefined,
      garment: row.kind === 'garment' ? seasonGarment(rec.on) : undefined,
    }
  })
  const done = rec.paid >= SEASON_ROAD.length
  const { name, art } = seasonName(rec.on)
  return {
    on: rec.on,
    name,
    art,
    current: rec.on >= now.ordinal,
    xp: rec.xp,
    road,
    stops: stopsView,
    next: done ? null : next,
    done,
    opens: done ? { name: seasonName(rec.on + 1).name, days: Math.max(1, now.left + 1) } : null,
  }
}

/** The season road as saved, against the season now (an ordinal): a road no later than now; its XP no more than its end;
 *  its stops given no more than its XP reaches (a stop reached and not given is given with the next XP). Missing or
 *  unreadable (a farm from before it): the season now's road, from its start. Never reset by the calendar. */
export function sanitizeSeasonRoad(raw: unknown, now: number): SeasonRoadRecord {
  const today = Math.max(0, Math.floor(Number.isFinite(now) ? now : 0))
  if (!isObject(raw) || !intIn(raw.on, 0, today)) return freshRoad(today)
  const on = raw.on
  const xp = intIn(raw.xp, 0, Number.MAX_SAFE_INTEGER) ? Math.min(raw.xp, roadEnd(on)) : 0
  const paid = intIn(raw.paid, 0, SEASON_ROAD.length) ? Math.min(raw.paid, reached(roadOf(on), xp)) : reached(roadOf(on), xp)
  return { on, xp, paid }
}
