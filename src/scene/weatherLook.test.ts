import { describe, expect, it } from 'vitest'
import { DAY } from '../farm/data'
import { moodAt } from '../farm/day'
import { SEASON_IDS, SEASONS } from '../farm/season'
import { CLEAR, type Weather, type WeatherKind } from '../farm/weather'
import { CLEAR_FOG, CLEAR_SKY, FOLIAGE_FAR, IDENTITY, WEATHER_LOOK, lookOf, moodWith } from './weatherLook'

// What the season and the weather look like (src/scene/weatherLook.ts): spring in clear weather is the farm as it always
// looked, number for number; every look stays within what the lights and the sky can take, and the day's light under
// any of them never gets darker than DAY.minLight. Pure.

const KINDS = Object.keys(WEATHER_LOOK) as WeatherKind[]
const AMOUNTS = [0, 0.25, 0.5, 1]

describe('the look', () => {
  it('spring in clear weather is IDENTITY: today’s light, haze, fog and land', () => {
    expect(lookOf('spring', CLEAR)).toEqual(IDENTITY)
    expect(IDENTITY).toMatchObject({ sun: 1, warm: 0, sky: 1, fog: CLEAR_FOG, turbidity: CLEAR_SKY.turbidity, rayleigh: CLEAR_SKY.rayleigh, cover: 0, rain: 0, snow: 0 })
    // the mood under it is the day's own, at every hour
    for (let t = 0; t < DAY.length; t += 25) expect(moodWith(moodAt(t), IDENTITY)).toEqual(moodAt(t))
  })

  it('a weather of no amount looks like clear weather in its season, whatever its kind', () => {
    for (const season of SEASON_IDS)
      for (const kind of KINDS) {
        const none: Weather = { kind, amount: 0, wind: 0, rainbow: 0 }
        expect(lookOf(season, none), `${season} ${kind}`).toEqual(lookOf(season, CLEAR))
      }
  })

  it('every season in every weather stays within bounds: lights dimmer under cloud, never brighter than the season’s', () => {
    for (const season of SEASON_IDS)
      for (const kind of KINDS)
        for (const amount of AMOUNTS) {
          const l = lookOf(season, { kind, amount, wind: amount, rainbow: 0 })
          const s = SEASONS[season].light
          const tag = `${season} ${kind} ${amount}`
          expect(l.sun > 0 && l.sun <= s.sun, tag).toBe(true)
          expect(l.sky > 0 && l.sky <= s.sky, tag).toBe(true)
          expect(Math.abs(l.warm) <= 1, tag).toBe(true)
          expect(l.fog >= CLEAR_FOG && l.fog < 0.02, tag).toBe(true)
          expect(l.turbidity >= 1 && l.turbidity <= 20, tag).toBe(true)
          expect(l.rayleigh > 0, tag).toBe(true)
          for (const v of [l.rain, l.snow, l.wind, l.rainbow, l.cover, l.foliage.amount]) expect(v >= 0 && v <= 1, tag).toBe(true)
          expect(l.rain > 0, tag).toBe(kind === 'rain' && amount > 0)
          expect(l.snow > 0, tag).toBe(kind === 'snow' && amount > 0)
        }
  })

  it('the land is its season’s whatever the weather; snow lies only in winter', () => {
    for (const season of SEASON_IDS) {
      const l = lookOf(season, { kind: 'rain', amount: 1, wind: 0.4, rainbow: 0 })
      expect(l.grass).toBe(SEASONS[season].look.grass)
      expect(l.foliage).toMatchObject({ color: SEASONS[season].look.foliage, amount: SEASONS[season].look.turn })
      // the furthest turned: autumn's reds, else the season's own colour
      expect(l.foliage.far).toBe(FOLIAGE_FAR[season] ?? SEASONS[season].look.foliage)
      expect(l.foliage.far).toMatch(/^#[0-9a-f]{6}$/)
      expect(l.cover > 0).toBe(season === 'winter')
    }
  })

  it('reads a broken amount as none, and the wind and the rainbow within 0–1', () => {
    expect(lookOf('summer', { kind: 'rain', amount: Number.NaN, wind: 3, rainbow: -1 })).toEqual({ ...lookOf('summer', CLEAR), wind: 1 })
  })
})

describe('the day’s light under a look', () => {
  it('never darker than DAY.minLight, the warmth within −1 to 1, at every hour, in every season and weather', () => {
    for (const season of SEASON_IDS)
      for (const kind of KINDS) {
        const l = lookOf(season, { kind, amount: 1, wind: 1, rainbow: 0 })
        for (let t = 0; t < DAY.length; t += 25) {
          const m = moodWith(moodAt(t), l)
          expect(m.sun).toBeGreaterThanOrEqual(DAY.minLight)
          expect(m.sky).toBeGreaterThanOrEqual(DAY.minLight)
          expect(Math.abs(m.warm)).toBeLessThanOrEqual(1)
        }
      }
  })
})
