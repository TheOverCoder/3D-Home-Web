import { describe, expect, it } from 'vitest'
import { DAY } from './data'
import { SEASON_IDS, type SeasonId } from './season'
import { CLEAR, SPELL, WEATHER, spellOn, unit, weatherAt, wets, type SpellKind, type Weather } from './weather'

// The farm's weather (src/farm/weather.ts): a function of the farm's clock alone — the same time, the same weather —
// with at most one spell a farm day on its season's odds, easing in and out, fog only in the morning, snow only in
// winter, a rainbow only after rain by day, and rain enough to water the beds only while it really rains. Pure.

const HOUR = DAY.length / 24
const FIRST = DAY.phases[0].from
/** Farm time at hour `h` of farm day `day` (h from the day's first hour, 5, up to 29). */
const at = (day: number, h: number) => day * DAY.length + (h - DAY.start) * HOUR
const DAYS = 10_000

/** Every farm day's spell over DAYS days in a season. */
const spells = (season: SeasonId) => Array.from({ length: DAYS }, (_, d) => spellOn(d, season))

describe('the clock decides', () => {
  it('the same farm time gives the same weather, in any order of asking', () => {
    const times = Array.from({ length: 400 }, (_, i) => i * 97.3)
    for (const season of SEASON_IDS) {
      const first = times.map((t) => weatherAt(t, season))
      const again = [...times].reverse().map((t) => weatherAt(t, season))
      expect(again.reverse()).toEqual(first)
    }
  })

  it('the hash spreads evenly over 0–1', () => {
    const bins: number[] = Array.from({ length: 10 }, () => 0)
    for (let d = 0; d < 50_000; d++) bins[Math.floor(unit(d, 0) * 10)]++
    for (const n of bins) expect(Math.abs(n - 5000)).toBeLessThan(250)
  })

  it('reads any time as a time (not a number: the farm’s first second)', () => {
    expect(weatherAt(Number.NaN, 'spring')).toEqual(weatherAt(0, 'spring'))
  })
})

describe('a season’s odds', () => {
  it('over 10,000 farm days each spell comes as often as its season says, within 2 points', () => {
    for (const season of SEASON_IDS) {
      const all = spells(season)
      const odds: Partial<Record<SpellKind, number>> = WEATHER[season]
      let some = 0
      for (const kind of Object.keys(odds) as SpellKind[]) {
        const share = all.filter((s) => s?.kind === kind).length / DAYS
        expect(Math.abs(share - (odds[kind] ?? 0)), `${season} ${kind}`).toBeLessThan(0.02)
        some += odds[kind] ?? 0
      }
      expect(some, season).toBeLessThan(1)
      expect(all.filter((s) => s === null).length / DAYS).toBeCloseTo(1 - some, 1)
    }
  })

  it('snow falls only in winter, rain never in winter', () => {
    for (const season of SEASON_IDS) {
      const kinds = new Set(spells(season).map((s) => s?.kind))
      expect(kinds.has('snow'), season).toBe(season === 'winter')
      if (season === 'winter') expect(kinds.has('rain')).toBe(false)
    }
  })
})

describe('a spell', () => {
  it('lies within its farm day: fog in the morning only, every other between its hours and of its length', () => {
    for (const season of SEASON_IDS)
      for (const s of spells(season)) {
        if (!s) continue
        expect(s.end).toBeGreaterThan(s.start)
        expect(s.end).toBeLessThan(FIRST + 24)
        expect(s.wind >= 0 && s.wind <= 1).toBe(true)
        if (s.kind === 'fog') {
          expect(s.start >= SPELL.fog.from && s.start < SPELL.fog.to).toBe(true)
          expect(s.end).toBeLessThanOrEqual(SPELL.fog.by)
        } else {
          expect(s.start >= SPELL.from && s.start < SPELL.to).toBe(true)
          expect(s.end - s.start >= SPELL.hours[0] && s.end - s.start < SPELL.hours[1]).toBe(true)
        }
        if (s.rainbow) expect(s.kind === 'rain' && s.end <= SPELL.rainbow.by).toBe(true)
      }
  })

  it('eases in and out over SPELL.ease seconds, full between; clear before and after', () => {
    const day = spells('spring').findIndex((s) => s?.kind === 'rain' && !s.rainbow)
    const s = spellOn(day, 'spring')!
    const rise = SPELL.ease / HOUR
    expect(weatherAt(at(day, s.start - 0.1), 'spring')).toEqual(CLEAR)
    const half = weatherAt(at(day, s.start + rise / 2), 'spring')
    expect(half.kind).toBe('rain')
    expect(half.amount).toBeCloseTo(0.5, 2)
    expect(weatherAt(at(day, (s.start + s.end) / 2), 'spring')).toMatchObject({ kind: 'rain', amount: 1 })
    expect(weatherAt(at(day, s.end - rise / 4), 'spring').amount).toBeCloseTo(0.25, 2)
    expect(weatherAt(at(day, s.end + 0.1), 'spring')).toEqual(CLEAR)
  })

  it('every moment of every day: the amounts within 0–1, a kind only while it is in, the wind no more than the spell’s', () => {
    for (const season of SEASON_IDS)
      for (let d = 0; d < 60; d++)
        for (let h = FIRST; h < FIRST + 24; h += 0.25) {
          const w: Weather = weatherAt(at(d, h), season)
          for (const v of [w.amount, w.wind, w.rainbow]) expect(v >= 0 && v <= 1).toBe(true)
          expect(w.kind === 'clear').toBe(w.amount === 0)
          if (w.rainbow > 0) expect(w.kind).toBe('clear')
          const s = spellOn(d, season)
          if (w.amount > 0) expect(w.wind).toBeLessThanOrEqual(s!.wind + 1e-9)
        }
  })
})

describe('a rainbow', () => {
  it('comes only after rain, by day, for SPELL.rainbow.hours, and on about half the days whose rain ends early enough', () => {
    const all = spells('spring')
    const could = all.filter((s) => s?.kind === 'rain' && s.end <= SPELL.rainbow.by)
    expect(could.filter((s) => s!.rainbow).length / could.length).toBeCloseTo(SPELL.rainbow.odds, 1)
    const day = all.findIndex((s) => s?.rainbow)
    const s = all[day]!
    expect(weatherAt(at(day, s.end + SPELL.rainbow.hours / 2), 'spring')).toEqual({ ...CLEAR, rainbow: 1 })
    expect(weatherAt(at(day, s.end + SPELL.rainbow.hours + 0.1), 'spring')).toEqual(CLEAR)
    const dry = all.findIndex((s) => s?.kind === 'rain' && !s.rainbow)
    expect(weatherAt(at(dry, all[dry]!.end + 0.5), 'spring').rainbow).toBe(0)
  })
})

describe('rain waters the beds', () => {
  it('only rain at half its strength or more', () => {
    expect(wets({ kind: 'rain', amount: 1, wind: 0, rainbow: 0 })).toBe(true)
    expect(wets({ kind: 'rain', amount: 0.5, wind: 0, rainbow: 0 })).toBe(true)
    expect(wets({ kind: 'rain', amount: 0.49, wind: 0, rainbow: 0 })).toBe(false)
    for (const kind of ['snow', 'fog', 'cloudy', 'wind', 'clear'] as const) expect(wets({ kind, amount: 1, wind: 0, rainbow: 0 })).toBe(false)
  })
})
