// The farm's year (update-v1/missions/10-seasons-weather.md): four seasons of the game's own, the same wherever the
// player lives, each a row of SEASONS (as the week's events are rows of EVENTS). A season lasts SEASON_DAYS days
// played — days the farm is opened, by the device's calendar — so it waits through any absence, and every farm meets
// spring first, which is the farm as it always looked. What a row changes: the crops in season (a quarter more at each
// harvest, at least one: never less than any other season gives), the land's look and the light's colour and strength
// (src/scene/weatherLook.ts turns them into numbers for the renderer), the week's events under seasonal names (their days,
// hours and numbers unchanged), and the season's decoration. The weather's odds by season are in ./weather.ts.
// Pure: the farm keeps the record (`farm.season`) and asks what season it is in src/farm/state/season.ts.

import { isObject } from '../lib/saved'
import { CROPS, type CropId } from './data'
import { EVENTS, type EventId } from './events'

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'

export interface SeasonDef {
  name: string
  /** its picture: a Fluent Emoji 3D name, an id of src/ui/art.ts once the picture is added */
  pic: string
  /** the crops in season: each of CROPS in exactly one season */
  crops: readonly CropId[]
  /** the land: the lawn's colour (multiplies today's: white leaves it as it is), the crowns', hedges' and bushes'
   *  colour and how far they turn to it (0: as today), and snow on what faces the sky (0 none, 1 all white) */
  look: { grass: string; foliage: string; turn: number; cover: number }
  /** the light: the day's sun and sky multiplied, its warmth shifted (src/farm/day.ts, moodAt) */
  light: { sun: number; warm: number; sky: number }
  /** the week's events under the season's own name and picture */
  events: Partial<Record<EventId, { name: string; pic: string }>>
  /** its decoration kind, sold in its season (a DECOR row once its model exists) */
  decor: string
}

/** The year, in its order. Spring is the farm as it always was: every number its identity. */
export const SEASONS = {
  spring: {
    name: 'Spring',
    pic: 'cherry-blossom',
    crops: ['lettuce', 'strawberry'],
    look: { grass: '#ffffff', foliage: '#ffffff', turn: 0, cover: 0 },
    light: { sun: 1, warm: 0, sky: 1 },
    events: { harvest: { name: 'Blossom festival', pic: 'cherry-blossom' } },
    decor: 'flower-arch',
  },
  summer: {
    name: 'Summer',
    pic: 'sun',
    crops: ['tomato'],
    look: { grass: '#f4efd2', foliage: '#3f6b2a', turn: 0.25, cover: 0 },
    light: { sun: 1.05, warm: 0.08, sky: 1 },
    events: { market: { name: 'Summer fair', pic: 'sun' } },
    decor: 'parasol',
  },
  autumn: {
    name: 'Autumn',
    pic: 'fallen-leaf',
    crops: ['pumpkin', 'corn'],
    look: { grass: '#e6d29a', foliage: '#d9822b', turn: 0.7, cover: 0 },
    light: { sun: 0.92, warm: 0.15, sky: 0.95 },
    events: { harvest: { name: 'Harvest fair', pic: 'fallen-leaf' } },
    decor: 'hay-bales',
  },
  winter: {
    name: 'Winter',
    pic: 'snowflake',
    crops: ['carrot', 'wheat', 'sugarcane'],
    look: { grass: '#f2f5fa', foliage: '#4f5d4c', turn: 0.35, cover: 0.85 },
    light: { sun: 0.85, warm: -0.1, sky: 1.05 },
    events: { market: { name: 'Winter market', pic: 'snowflake' } },
    decor: 'snowman',
  },
} as const satisfies Record<SeasonId, SeasonDef>
export const SEASON_IDS = Object.keys(SEASONS) as SeasonId[]

/** How many days played a season lasts (a year: four times as many). Days played wait through any absence
 *  (src/farm/calendar.ts, LONG_CLOCK), so a season waits for you. */
export const SEASON_DAYS = 7

/** The seasons start once a new farm's first steps end: until then it stays in spring's sunshine (spring, clear weather),
 *  and its first spring begins on the day played the steps end. False: the year begins on the farm's first day played,
 *  whatever the steps. */
export const SEASONS_AFTER_STEPS = true

/** A count read as a whole number of days (not a number: none). */
const whole = (n: number) => (Number.isFinite(n) ? Math.floor(n) : 0)

/** Where the year is on the `played`-th day played, for a farm whose seasons began on its `from`-th: the season, the
 *  day of it (1 to SEASON_DAYS), how many seasons have begun before it (0: the first spring), the days played left
 *  after this one, and the season that comes next. Before `from` (or with nothing counted) it is the first spring's
 *  first day; the count never falling, the season never goes back. */
export function seasonAt(played: number, from = 1): { id: SeasonId; day: number; ordinal: number; left: number; next: SeasonId } {
  const since = Math.max(0, whole(played) - whole(from))
  const ordinal = Math.floor(since / SEASON_DAYS)
  const day = (since % SEASON_DAYS) + 1
  const n = SEASON_IDS.length
  return { id: SEASON_IDS[ordinal % n], day, ordinal, left: SEASON_DAYS - day, next: SEASON_IDS[(ordinal + 1) % n] }
}

/** Is the crop in season? */
export const inSeason = (crop: CropId, id: SeasonId) => (SEASONS[id].crops as readonly CropId[]).includes(crop)

/** The season a crop is in (every crop is in one). */
export const seasonOf = (crop: CropId): SeasonId | null => SEASON_IDS.find((id) => inSeason(crop, id)) ?? null

/** What a crop in season adds to a harvest of `n`: a quarter, at least one (nothing to a harvest of nothing). */
export const seasonExtra = (n: number) => (n > 0 ? Math.max(1, Math.round(n / 4)) : 0)

/** An event as the season shows it: its own name and picture there, or the event's as always. */
export function eventLook(id: EventId, season: SeasonId): { name: string; pic: string } {
  const own = (SEASONS[season].events as SeasonDef['events'])[id]
  return own ?? { name: EVENTS[id].name, pic: EVENTS[id].art }
}

/** Every crop of the farm's, in the order of CROPS, with the season it is in. */
export const cropSeasons = () => CROPS.map((c) => ({ crop: c.id, season: seasonOf(c.id) }))

/** What the farm keeps of its year: the day played its seasons began on (its first spring), and the last season (by
 *  `ordinal`) whose arrival it has shown (-1: none yet, the year not begun; its first spring, which has no arrival to
 *  show, makes it 0 as it begins: src/farm/state/season.ts, seasonOn). */
export interface SeasonRecord {
  from: number
  told: number
}
/** A year that begins today (`played`: the days played so far, today counted). */
export const freshSeason = (played = 1): SeasonRecord => ({ from: Math.max(1, whole(played)), told: -1 })

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : null)

/** The record as saved, made safe against the days played so far (`played`): a beginning from day 1 to today (one
 *  ahead of today, a clock moved back or a save from elsewhere, begins today), and an arrival shown no later than the
 *  season it is now. Missing or unreadable (a farm from before the seasons): its first spring begins today. */
export function sanitizeSeason(raw: unknown, played: number): SeasonRecord {
  const today = Math.max(1, whole(played))
  if (!isObject(raw)) return freshSeason(today)
  const f = count(raw.from)
  const from = f === null || f < 1 || f > today ? today : f
  const now = seasonAt(today, from).ordinal
  const t = count(raw.told)
  const told = t === null ? -1 : Math.min(now, Math.max(-1, t))
  return { from, told }
}
