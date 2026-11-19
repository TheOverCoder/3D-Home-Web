// What the season and the weather look like, as numbers (update-v1/missions/10-seasons-weather.md): the one interface
// a renderer reads, whichever draws the rain and snow. The light changes only the colour and strength of the lights
// there are (the day's mood multiplied and shifted: `moodWith`); the sky's haze (drei's Sky: turbidity, rayleigh) and
// the fog's density; how much rain, snow, wind and rainbow there is; snow on what faces the sky, the crowns' and
// hedges' colour, the lawn's. Spring in clear weather is IDENTITY: the farm as it always looked. Pure: no three.js, no
// renderer. Read each frame by the light and the materials (src/scene/Lighting.tsx, DayLight: the lights, the sky, the
// fog and src/lib/sculpt/material.ts's season) and by what falls (src/fx/quarks.ts, `weatherFx`, fed by FarmFx.tsx).

import { DAY } from '../farm/data'
import { SEASONS, type SeasonId } from '../farm/season'
import type { Weather, WeatherKind } from '../farm/weather'

export interface Look {
  /** the day's mood (src/farm/day.ts, moodAt): sun and sky multiplied, warmth added */
  sun: number
  warm: number
  sky: number
  /** the fog's density (FogExp2; the player's haze setting wins where thicker) */
  fog: number
  /** the sky's haze (drei's Sky) */
  turbidity: number
  rayleigh: number
  /** how much falls, blows and shines, 0–1 */
  rain: number
  snow: number
  wind: number
  rainbow: number
  /** snow on what faces the sky, 0–1 */
  cover: number
  /** the crowns', hedges' and bushes' colour, the colour the trees that turn furthest go to (`far`: autumn's reds),
   *  and how far they turn (each tree its own share of it) */
  foliage: { color: string; far: string; amount: number }
  /** the lawn's colour, multiplying today's */
  grass: string
}

/** The fog's density and the sky's haze as they always were (src/scene/Lighting.tsx: the haze off, the Sky's own). */
export const CLEAR_FOG = 0.0006
export const CLEAR_SKY = { turbidity: 3, rayleigh: 1.3 } as const

/** Spring in clear weather: every number as the farm always had it. */
export const IDENTITY: Look = {
  sun: 1,
  warm: 0,
  sky: 1,
  fog: CLEAR_FOG,
  turbidity: CLEAR_SKY.turbidity,
  rayleigh: CLEAR_SKY.rayleigh,
  rain: 0,
  snow: 0,
  wind: 0,
  rainbow: 0,
  cover: 0,
  foliage: { color: '#ffffff', far: '#ffffff', amount: 0 },
  grass: '#ffffff',
}

/** The colour the trees that turn furthest go to in each season (the rest between it and the season's own): autumn's
 *  woods orange to red; in the other seasons every tree turns to the season's own colour. */
export const FOLIAGE_FAR: Record<SeasonId, string | null> = { spring: null, summer: null, autumn: '#b5401f', winter: null }

/** What each kind of weather does at its full: the sun and the sky light multiplied, the warmth shifted, the sky's haze
 *  and the fog added to. In between, by its amount. */
export const WEATHER_LOOK = {
  clear: { sun: 1, sky: 1, warm: 0, turbidity: 0, rayleigh: 0, fog: 0 },
  cloudy: { sun: 0.65, sky: 0.9, warm: -0.03, turbidity: 7, rayleigh: -0.7, fog: 0.001 },
  rain: { sun: 0.5, sky: 0.85, warm: -0.05, turbidity: 8, rayleigh: -0.8, fog: 0.004 },
  snow: { sun: 0.6, sky: 0.95, warm: -0.03, turbidity: 6, rayleigh: -0.6, fog: 0.006 },
  fog: { sun: 0.75, sky: 0.95, warm: 0, turbidity: 4, rayleigh: -0.4, fog: 0.0114 },
  wind: { sun: 1, sky: 1, warm: 0, turbidity: 0, rayleigh: 0, fog: 0 },
} as const satisfies Record<WeatherKind, { sun: number; sky: number; warm: number; turbidity: number; rayleigh: number; fog: number }>

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

/** The look of a season in a weather. */
export function lookOf(season: SeasonId, weather: Weather): Look {
  const s = SEASONS[season]
  const a = clamp01(weather.amount)
  const w = WEATHER_LOOK[weather.kind]
  return {
    sun: s.light.sun * lerp(1, w.sun, a),
    warm: s.light.warm + w.warm * a,
    sky: s.light.sky * lerp(1, w.sky, a),
    fog: CLEAR_FOG + w.fog * a,
    turbidity: CLEAR_SKY.turbidity + w.turbidity * a,
    rayleigh: CLEAR_SKY.rayleigh + w.rayleigh * a,
    rain: weather.kind === 'rain' ? a : 0,
    snow: weather.kind === 'snow' ? a : 0,
    wind: clamp01(weather.wind),
    rainbow: clamp01(weather.rainbow),
    cover: s.look.cover,
    foliage: { color: s.look.foliage, far: FOLIAGE_FAR[season] ?? s.look.foliage, amount: s.look.turn },
    grass: s.look.grass,
  }
}

/** The day's mood under a look: the sun and the sky light never darker than DAY.minLight, the warmth within −1 to 1. */
export function moodWith(mood: { sun: number; warm: number; sky: number }, look: Look): { sun: number; warm: number; sky: number } {
  return {
    sun: Math.max(DAY.minLight, mood.sun * look.sun),
    warm: Math.min(1, Math.max(-1, mood.warm + look.warm)),
    sky: Math.max(DAY.minLight, mood.sky * look.sky),
  }
}
