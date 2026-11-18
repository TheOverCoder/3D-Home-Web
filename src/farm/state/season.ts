import { debugFlag, debugSet } from '../../lib/debug'
import { onHere } from '../../lib/quiet'
import { freshPlayed, longDay, markPlayed as playedOn, type Played } from '../calendar'
import { freshSeason, sanitizeSeason, SEASON_IDS, seasonAt, SEASONS_AFTER_STEPS, type SeasonId, type SeasonRecord } from '../season'
import { CLEAR, standing, weatherAt, type Weather, type WeatherKind } from '../weather'
import { bump, calendarDay, farm, save } from './core'
import { stepsBusy } from './steps'

// The farm's year and its weather (src/farm/season.ts, src/farm/weather.ts): the season, counted in days played from the
// day the farm's seasons began (`farm.season`, saved), and the weather of the farm's own clock (never saved: the same
// clock gives the same weather). Whatever a season or the weather changes — the looks, the harvest in season, rain on
// the beds — asks `seasonNow()` and `weatherNow()`: spring and clear while a new farm's first steps run, and where the
// game is tested (src/lib/quiet.ts: under Vitest, and on a ?debug page unless it says `&season=on` or names a season,
// `&weather=on` or names a weather). The clock itself, `seasonDay()`, is never quiet: the daily week counts on it in the
// tests too. The season moves only on a new day played, so a time away runs in the season it was left in.

declare module './core' {
  interface FarmData {
    /** the farm's year (src/farm/season.ts): the day played its first spring began on, and the last season (by its
     *  ordinal) whose arrival was shown (-1: the year not begun yet; not `charm`'s or `friends`' `told`). (Declared
     *  here, beside its rules.) */
    season: SeasonRecord
  }
}

/** What the season's effects follow: the clock (days played, as in play), a season of a test's or a page's own, or
 *  nothing (quiet: spring). */
export type SeasonSource = SeasonId | 'clock' | null
/** What the weather follows: the farm's clock (as in play), a weather of a test's or a page's own, or nothing (quiet:
 *  clear). */
export type WeatherSource = Weather | 'clock' | null

/** The weathers a ?debug page can name (`&weather=rain`), each standing at its fullest. */
const NAMED = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'wind', 'rainbow'] as const satisfies readonly (WeatherKind | 'rainbow')[]

/** The season as this page has it: by the clock in play; quiet where the game is tested, unless the page says
 *  `&season=on` (by the clock) or names one (`?debug&season=winter`: a screenshot of each). */
function seasonByPage(): SeasonSource {
  const named = SEASON_IDS.find((id) => id === debugFlag('season'))
  if (named) return named
  return onHere('season') ? 'clock' : null
}

/** The weather as this page has it: by the farm's clock in play; quiet where the game is tested, unless the page says
 *  `&weather=on` or names one (`?debug&weather=rain`). */
function weatherByPage(): WeatherSource {
  const named = NAMED.find((k) => k === debugFlag('weather'))
  if (named) return standing(named)
  return onHere('weather') ? 'clock' : null
}

let seasonFrom: SeasonSource = seasonByPage()
let weatherFrom: WeatherSource = weatherByPage()

/** The long clock's day with today counted (src/farm/calendar.ts): days played, today among them even before the farm's
 *  first frame of the day counts it (src/farm/state/daily.ts, markPlayed). */
function longToday(played: Played): number {
  const today = calendarDay()
  return longDay(playedOn(played, today).played, today)
}

/** A new farm's year: its first spring begins on its first day played. */
export const seasonFresh = (): SeasonRecord => freshSeason(longToday(freshPlayed()))

/** The year as saved, made safe against the farm's days played with today counted (a farm loads before its first frame
 *  of the day counts it): a farm from before the seasons, or one whose record cannot be read, begins its first spring
 *  today. */
export const savedSeason = (raw: unknown, played: Played): SeasonRecord => sanitizeSeason(raw, longToday(played))

/** The season's clock: where the farm's year stands today — the season, its day (1 to SEASON_DAYS), how many seasons
 *  began before it, the days left in it and the season after — counted in days played from the day the farm's seasons
 *  began. Never quiet. */
export const seasonDay = () => seasonAt(longDay(farm.played, calendarDay()), farm.season.from)

/** A new farm's year waits for its first steps to end (SEASONS_AFTER_STEPS): it has not begun (`told` -1) and they run.
 *  Once begun it never waits again (the tips shown again from Settings never turn the year back). */
const waiting = () => SEASONS_AFTER_STEPS && farm.season.told < 0 && stepsBusy()

/** The season the farm shows and plays in now: its clock's, but spring while a new farm's first steps run, or a test's
 *  or a page's own (quiet where the game is tested: spring). */
export function seasonNow(): SeasonId {
  if (seasonFrom !== 'clock') return seasonFrom ?? 'spring'
  return waiting() ? 'spring' : seasonDay().id
}

/** The weather on the farm now: its clock's in the season now (src/farm/weather.ts), but clear while a new farm's first
 *  steps run, or a test's or a page's own (quiet where the game is tested: clear). */
export function weatherNow(): Weather {
  if (weatherFrom !== 'clock') return weatherFrom ?? CLEAR
  return waiting() ? CLEAR : weatherAt(farm.day.t, seasonNow())
}

/** For the tests (and a ?debug page's console): the season's effects quiet (null: spring), by the clock as in play
 *  ('clock'), or a season of their own. Not kept: a page loaded again has it as its address says. */
export function setSeason(to: SeasonSource) {
  seasonFrom = to
  bump()
}

/** For the tests: the weather quiet (null: clear), by the farm's clock as in play ('clock'), or a weather of their own,
 *  standing. */
export function setWeather(to: WeatherSource) {
  weatherFrom = to && to !== 'clock' ? { ...to } : to
  bump()
}

/** For the tests: the season and the weather both quiet, as a ?debug page starts (true: spring, clear), or both by their
 *  clocks, as in play (false). */
export function quietSeasons(on: boolean) {
  setSeason(on ? null : 'clock')
  setWeather(on ? null : 'clock')
}

/** Each frame, from `tick`: the farm's year begins. While a new farm's first steps run its first spring waits
 *  (SEASONS_AFTER_STEPS), beginning on each new day played, so that it begins on the day played they end; then it has
 *  begun (`told` 0: its first spring has no arrival to show), once. Never back: days played never fall. */
export function seasonOn() {
  hook()
  if (farm.season.told >= 0) return
  if (waiting()) {
    const today = Math.max(1, longDay(farm.played, calendarDay()))
    if (today <= farm.season.from) return
    farm.season = { from: today, told: -1 }
  } else farm.season = { from: farm.season.from, told: 0 }
  save()
}

/** ?debug: `window.__home.season` — the season and the weather now, the clock, the record, and the tests' switches.
 *  Made on the farm's first frame: the page's hooks are made after this module loads. */
let hooked = false
function hook() {
  if (hooked || typeof window === 'undefined' || !('__home' in window)) return
  hooked = true
  debugSet('season', {
    now: seasonNow,
    day: seasonDay,
    set: setSeason,
    quiet: quietSeasons,
    record: () => farm.season,
    weather: { now: weatherNow, set: setWeather },
  })
}
