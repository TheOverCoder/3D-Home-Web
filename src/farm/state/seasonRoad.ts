import { farmSound } from '../../audio/sound'
import { debugSet } from '../../lib/debug'
import { onHere } from '../../lib/quiet'
import { longDay, markPlayed as playedOn, type Played } from '../calendar'
import { ITEMS, SELLABLE, STORE_IDS, type ProduceId } from '../data'
import { prizeWords, type Prize } from '../prize'
import { fed, freshRoad, roadView, sanitizeSeasonRoad, SEASON_ROAD, seasonName, settleRoad, stopPrizes, type SeasonRoadRecord, type SeasonRoadView } from '../seasonRoad'
import { seasonAt, type SeasonRecord } from '../season'
import { nextLevel } from '../storage'
import { levelOf } from '../xp'
import { bump, calendarDay, farm, save, toast } from './core'
import { give } from './rewards'
import { seasonDay } from './season'

// The season road on the farm (src/farm/seasonRoad.ts): fed by every XP the farm gains (`feedRoad`, one line in
// gainXp), from the day the farm's year begins (a new farm's first steps over); each stop reached comes in by itself,
// through `give`, with a toast. Quiet where the game is tested (src/lib/quiet.ts: under Vitest, and on a ?debug page
// unless it says `&road=on`): there it is not fed, so no spec's coins or goods depend on it; a test turns it on with
// `quietRoad(false)` (`__home.road.quiet`).

declare module './core' {
  interface FarmData {
    /** the season road (src/farm/seasonRoad.ts): the road being filled (a season's ordinal), the XP into it, the stops
     *  given on it. (Declared here, beside its rules.) */
    seasonRoad: SeasonRoadRecord
  }
}

let fedInPlay = onHere('road')

/** For the tests (and a ?debug page's console): the road quiet (true: not fed, as under Vitest and on ?debug), or fed
 *  as in play (false). Not kept: a page loaded again has it as its address says. */
export function quietRoad(on: boolean) {
  fedInPlay = !on
  bump()
}

/** A new farm's road: its first spring's. */
export const roadFresh = (): SeasonRoadRecord => freshRoad(0)

/** The road as saved, against the farm's year with today counted (a farm loads before its first frame of the day counts
 *  it): a farm from before it starts on the season now's road. */
export function savedSeasonRoad(raw: unknown, played: Played, season: SeasonRecord): SeasonRoadRecord {
  const today = calendarDay()
  return sanitizeSeasonRoad(raw, seasonAt(longDay(playedOn(played, today).played, today), season.from).ordinal)
}

/** The building material the next level of the silo or the barn is shortest of (the first in line when none is). */
function shortest(): ProduceId {
  let item: ProduceId = ITEMS[0]
  let short = -Infinity
  for (const store of STORE_IDS)
    for (const need of nextLevel(store, farm.storage[store]).needs) {
      const s = need.count - (farm.inv[need.item] ?? 0)
      if (s > short) {
        short = s
        item = need.item
      }
    }
  return item
}

/** The good the farm has got the most of by its work (none yet: null). */
function most(): ProduceId | null {
  let best: ProduceId | null = null
  for (const id of SELLABLE) if ((farm.got[id] ?? 0) > 0 && (best === null || farm.got[id] > farm.got[best])) best = id
  return best
}

/**
 * The XP the farm just gained, into its season road (from gainXp, after the XP is the farm's): each stop it reaches is
 * given at once — coins, a few of the material the stores are shortest of, a few of the good the farm makes most, the
 * season's garment with a big gift — one reward a stop (a `stop`; the garment its own `garment`), told in one toast. Not
 * before the farm's year begins (a new farm's first steps run), and not while the road is quiet. No XP of its own.
 */
export function feedRoad(xp: number) {
  hook()
  if (!fedInPlay || !(xp > 0) || farm.season.told < 0) return
  const { road, reached } = fed(farm.seasonRoad, xp, seasonDay().ordinal)
  farm.seasonRoad = road
  if (!reached.length) return
  const level = levelOf(farm.xp.points)
  const all: Prize[] = []
  for (const r of reached) {
    const prizes = stopPrizes(r.stop, r.on, level, shortest(), most())
    const garment = prizes.filter((p) => 'garment' in p)
    if (garment.length) give(garment, 'garment')
    give(
      prizes.filter((p) => !('garment' in p)),
      'stop',
    )
    all.push(...prizes)
  }
  const last = reached[reached.length - 1]
  const words = all.map(prizeWords).join(', ')
  const done = last.stop >= SEASON_ROAD.length
  toast(done ? `${seasonName(last.on).name}’s road done · ${words}` : `Season road, stop ${last.stop} · ${words}`, 'triangular-flag')
  farmSound(done ? 'garment' : 'chime')
  bump()
}

/** Each frame, from `tick`: a road finished in a season gone by gives way to the next season's (the save says so). */
export function seasonRoadOn() {
  hook()
  const road = settleRoad(farm.seasonRoad, seasonDay().ordinal)
  if (road === farm.seasonRoad) return
  farm.seasonRoad = road
  save()
}

/** The season road as the farm news's "This season" tab shows it: the road being filled, with the season now. */
export function roadNow(): SeasonRoadView {
  hook()
  return roadView(farm.seasonRoad, seasonDay(), levelOf(farm.xp.points))
}

/** ?debug: `window.__home.road` — the road now, the record, the tests' switch. Made the first time the road is asked. */
let hooked = false
function hook() {
  if (hooked || typeof window === 'undefined' || !('__home' in window)) return
  hooked = true
  debugSet('road', { now: roadNow, quiet: quietRoad, record: () => farm.seasonRoad, on: () => fedInPlay })
}
