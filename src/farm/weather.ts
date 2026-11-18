// The farm's weather (update-v1/missions/10-seasons-weather.md): a function of the farm's own clock, with no state and
// nothing saved. Each farm day (DAY.length real seconds, src/farm/day.ts) has at most one spell — rain, snow, fog, wind
// or a grey sky — on the odds of its season (WEATHER, a row a season), at hours drawn from a hash of the day's number:
// the same clock always gives the same weather, so a time away judges each of its steps at its own time and the sim and
// the tests see what a player would. A spell eases in and out over SPELL.ease real seconds; fog comes only in the
// morning; after rain by day, a rainbow one time in two. It only ever helps play (rain waters the beds: `wets`); what
// it looks like is src/scene/weatherLook.ts's, whichever renderer draws it. Pure: the farm asks for the weather now in
// src/farm/state/season.ts (`weatherNow`).

import { DAY } from './data'
import { dayOf, hourOf } from './day'
import type { SeasonId } from './season'

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'wind'
/** A spell's kind (every kind but clear). */
export type SpellKind = Exclude<WeatherKind, 'clear'>

/** The weather at a moment: its kind and how far in it is (0–1: easing in, full, easing out), the wind (0–1), and the
 *  rainbow after a shower (0–1). Clear has amount 0. */
export interface Weather {
  kind: WeatherKind
  amount: number
  wind: number
  rainbow: number
}
export const CLEAR: Weather = { kind: 'clear', amount: 0, wind: 0, rainbow: 0 }

/** A season's odds of each spell on a farm day (the rest of the days are clear). */
export const WEATHER = {
  spring: { rain: 0.3, cloudy: 0.1, fog: 0.1 },
  summer: { rain: 0.15, cloudy: 0.1 },
  autumn: { rain: 0.25, fog: 0.2, wind: 0.2 },
  winter: { snow: 0.35, cloudy: 0.15, fog: 0.1 },
} as const satisfies Record<SeasonId, Partial<Record<SpellKind, number>>>

/** When and how long a spell is, in farm hours (a day runs from the morning's first hour, 5, to 5 the next day): it
 *  begins between `from` and `to` and lasts `hours`; fog begins between `fog.from` and `fog.to` and has lifted by
 *  `fog.by`; each eases in and out over `ease` real seconds; after rain ending by `rainbow.by` by day, a rainbow one time
 *  in `1 / rainbow.odds` for `rainbow.hours`. How strong the wind is in each kind of spell: `wind`. */
export const SPELL = {
  from: 6,
  to: 20,
  hours: [3, 8],
  fog: { from: 5, to: 8, by: 11 },
  ease: 20,
  rainbow: { odds: 0.5, hours: 1, by: 19 },
  wind: { cloudy: [0, 0.2], rain: [0.2, 0.5], snow: [0.1, 0.3], fog: [0, 0], wind: [0.6, 1] },
} as const satisfies {
  from: number
  to: number
  hours: readonly [number, number]
  fog: { from: number; to: number; by: number }
  ease: number
  rainbow: { odds: number; hours: number; by: number }
  wind: Record<SpellKind, readonly [number, number]>
}

/** One farm day's spell: its kind, the farm hours it begins and ends (from the day's 5:00, so up to 29), how strong
 *  its wind is, and whether a rainbow follows it. */
export interface Spell {
  kind: SpellKind
  start: number
  end: number
  wind: number
  rainbow: boolean
}

const HOUR = DAY.length / 24
const FIRST = DAY.phases[0].from

/** A 32-bit integer mixed so that every bit of it moves every bit of the result (Wellons' lowbias32), unsigned. */
function mix(x: number): number {
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

/** A number from 0 to 1 for a day and a draw of it, always the same: the day mixed, then the draw into it, mixed again
 *  (so the draws of one day are as unlike each other as different days are). */
export const unit = (day: number, draw: number): number => mix((mix(day | 0) + Math.imul(draw + 1, 0x9e3779b9)) | 0) / 4294967296

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** The spell of farm day `day` in `season`, or null on a clear day. */
export function spellOn(day: number, season: SeasonId): Spell | null {
  const odds: Partial<Record<SpellKind, number>> = WEATHER[season]
  let roll = unit(day, 0)
  let kind: SpellKind | null = null
  for (const k of Object.keys(odds) as SpellKind[]) {
    const p = odds[k] ?? 0
    if (roll < p) {
      kind = k
      break
    }
    roll -= p
  }
  if (!kind) return null
  let start: number
  let end: number
  if (kind === 'fog') {
    start = lerp(SPELL.fog.from, SPELL.fog.to, unit(day, 1))
    end = Math.min(SPELL.fog.by, start + lerp(SPELL.hours[0], SPELL.hours[1], unit(day, 2)))
  } else {
    start = lerp(SPELL.from, SPELL.to, unit(day, 1))
    end = start + lerp(SPELL.hours[0], SPELL.hours[1], unit(day, 2))
  }
  const [lo, hi] = SPELL.wind[kind]
  const rainbow = kind === 'rain' && end <= SPELL.rainbow.by && unit(day, 4) < SPELL.rainbow.odds
  return { kind, start, end, wind: lerp(lo, hi, unit(day, 3)), rainbow }
}

// a spell is the same for a whole day (asked every frame, and for each step of a time away)
let memo: { day: number; season: SeasonId; spell: Spell | null } | null = null
function spellOf(day: number, season: SeasonId): Spell | null {
  if (memo?.day === day && memo.season === season) return memo.spell
  memo = { day, season, spell: spellOn(day, season) }
  return memo.spell
}

/** How far into a span of farm hours `at` is, eased over SPELL.ease real seconds at each end: 0 outside it, 1 inside. */
function eased(at: number, start: number, end: number): number {
  if (at < start || at >= end) return 0
  const s = Math.min(at - start, end - at) * HOUR
  return Math.min(1, s / SPELL.ease)
}

/** The weather at farm time `t` (seconds since the farm began, src/farm/day.ts) in `season`. */
export function weatherAt(t: number, season: SeasonId): Weather {
  const day = dayOf(t)
  const at = FIRST + ((((hourOf(t) - FIRST) % 24) + 24) % 24)
  const spell = spellOf(day, season)
  if (!spell) return CLEAR
  const amount = eased(at, spell.start, spell.end)
  if (amount > 0) return { kind: spell.kind, amount, wind: spell.wind * amount, rainbow: 0 }
  if (spell.rainbow) {
    const rainbow = eased(at, spell.end, spell.end + SPELL.rainbow.hours)
    if (rainbow > 0) return { ...CLEAR, rainbow }
  }
  return CLEAR
}

/** A weather at its fullest, standing (a test's, or a ?debug page's `&weather=rain`): its kind fully in, with the
 *  strongest wind its spells have; `rainbow`: clear weather with the whole rainbow. */
export function standing(kind: WeatherKind | 'rainbow'): Weather {
  if (kind === 'clear') return CLEAR
  if (kind === 'rainbow') return { ...CLEAR, rainbow: 1 }
  return { kind, amount: 1, wind: SPELL.wind[kind][1], rainbow: 0 }
}

/** Does it rain enough to water the beds? */
export const wets = (w: Weather) => w.kind === 'rain' && w.amount >= 0.5
