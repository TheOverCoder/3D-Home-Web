import { describe, expect, it } from 'vitest'
import { CROPS } from './data'
import { EVENT_IDS, EVENTS } from './events'
import { SEASON_DAYS, SEASON_IDS, SEASONS, cropSeasons, eventLook, freshSeason, inSeason, sanitizeSeason, seasonAt, seasonExtra, seasonOf } from './season'

// The farm's year (src/farm/season.ts): a season every SEASON_DAYS days played, spring first, never going back; each
// crop in exactly one season, and in season a harvest only ever grows; spring the farm as it always looked; the week's
// events renamed only where a season says so; the saved record made safe. Pure.

describe('the seasons turn by days played', () => {
  it('a new farm begins in spring, day 1; a season every SEASON_DAYS days, in the year’s order, round and round', () => {
    expect(SEASON_IDS).toEqual(['spring', 'summer', 'autumn', 'winter'])
    expect(seasonAt(1)).toEqual({ id: 'spring', day: 1, ordinal: 0, left: SEASON_DAYS - 1, next: 'summer' })
    expect(seasonAt(SEASON_DAYS)).toMatchObject({ id: 'spring', day: SEASON_DAYS, left: 0 })
    expect(seasonAt(SEASON_DAYS + 1)).toMatchObject({ id: 'summer', day: 1, ordinal: 1 })
    expect(seasonAt(3 * SEASON_DAYS + 1)).toMatchObject({ id: 'winter', day: 1, ordinal: 3, next: 'spring' })
    expect(seasonAt(4 * SEASON_DAYS + 1)).toMatchObject({ id: 'spring', ordinal: 4, next: 'summer' })
  })

  it('counts from the day the farm’s seasons began; before it, or with nothing to count, the first spring’s first day', () => {
    expect(seasonAt(20, 20)).toMatchObject({ id: 'spring', day: 1, ordinal: 0 })
    expect(seasonAt(20 + SEASON_DAYS, 20)).toMatchObject({ id: 'summer', day: 1 })
    expect(seasonAt(5, 20)).toMatchObject({ id: 'spring', day: 1, ordinal: 0 })
    for (const bad of [Number.NaN, Infinity, -3, 0]) expect(seasonAt(bad)).toMatchObject({ id: 'spring', day: 1, ordinal: 0 })
  })

  it('as the days played grow, the season never goes back: the ordinal never falls and the day steps on by one', () => {
    let last = seasonAt(1)
    for (let played = 2; played <= 400; played++) {
      const now = seasonAt(played)
      expect(now.ordinal).toBeGreaterThanOrEqual(last.ordinal)
      if (now.ordinal === last.ordinal) expect(now.day).toBe(last.day + 1)
      else expect([now.day, last.day, now.id]).toEqual([1, SEASON_DAYS, last.next])
      last = now
    }
  })
})

describe('crops in season', () => {
  it('each crop the farm grows is in exactly one season', () => {
    for (const c of CROPS)
      expect(
        SEASON_IDS.filter((id) => inSeason(c.id, id)),
        c.id,
      ).toHaveLength(1)
    expect(cropSeasons().every((c) => c.season !== null)).toBe(true)
    expect(SEASON_IDS.flatMap((id) => SEASONS[id].crops).sort()).toEqual(CROPS.map((c) => c.id).sort())
    expect(seasonOf('pumpkin')).toBe('autumn')
  })

  it('in season a harvest is a quarter more, at least one more: never less than today’s, whatever its size', () => {
    expect([1, 2, 4, 5, 6, 8, 12].map(seasonExtra)).toEqual([1, 1, 1, 1, 2, 2, 3])
    for (let n = 1; n <= 200; n++) {
      expect(seasonExtra(n)).toBeGreaterThanOrEqual(1)
      expect(Math.abs(seasonExtra(n) - n / 4)).toBeLessThanOrEqual(Math.max(0.5, 1 - n / 4))
    }
    expect(seasonExtra(0)).toBe(0)
    for (const c of CROPS) expect(c.yield + seasonExtra(c.yield)).toBeGreaterThan(c.yield)
  })
})

describe('what a season looks like', () => {
  it('spring is the farm as it always was: every number its identity', () => {
    expect(SEASONS.spring.light).toEqual({ sun: 1, warm: 0, sky: 1 })
    expect(SEASONS.spring.look).toMatchObject({ grass: '#ffffff', turn: 0, cover: 0 })
  })

  it('every season’s colours are colours, its amounts within 0–1, its light within reason', () => {
    for (const id of SEASON_IDS) {
      const s = SEASONS[id]
      expect(s.look.grass, id).toMatch(/^#[0-9a-f]{6}$/)
      expect(s.look.foliage, id).toMatch(/^#[0-9a-f]{6}$/)
      for (const k of [s.look.turn, s.look.cover]) expect(k >= 0 && k <= 1, id).toBe(true)
      expect(s.light.sun > 0.5 && s.light.sun <= 1.1, id).toBe(true)
      expect(s.light.sky > 0.5 && s.light.sky <= 1.1, id).toBe(true)
      expect(Math.abs(s.light.warm) <= 0.3, id).toBe(true)
      expect(s.name.length > 0 && s.pic.length > 0 && s.decor.length > 0, id).toBe(true)
    }
    expect(SEASON_IDS.filter((id) => SEASONS[id].look.cover > 0)).toEqual(['winter'])
  })
})

describe('the week’s events in a season', () => {
  it('a season renames only real events; every other keeps its own name and picture', () => {
    for (const id of SEASON_IDS) for (const e of Object.keys(SEASONS[id].events)) expect(EVENT_IDS, `${id}: ${e}`).toContain(e)
    expect(eventLook('harvest', 'autumn')).toEqual({ name: 'Harvest fair', pic: 'fallen-leaf' })
    expect(eventLook('harvest', 'summer')).toEqual({ name: EVENTS.harvest.name, pic: EVENTS.harvest.art })
    for (const s of SEASON_IDS) for (const e of EVENT_IDS) expect(eventLook(e, s).name.length).toBeGreaterThan(0)
  })
})

describe('the record as saved', () => {
  it('a new year begins today, its arrival not yet shown', () => {
    expect(freshSeason()).toEqual({ from: 1, told: -1 })
    expect(freshSeason(12)).toEqual({ from: 12, told: -1 })
  })

  it('a good record is kept as it is', () => {
    expect(sanitizeSeason({ from: 3, told: 1 }, 20)).toEqual({ from: 3, told: 1 })
    expect(sanitizeSeason({ from: 20, told: -1 }, 20)).toEqual({ from: 20, told: -1 })
  })

  it('missing or unreadable (a farm from before the seasons): its first spring begins today', () => {
    for (const raw of [undefined, null, 7, 'spring', [], {}]) expect(sanitizeSeason(raw, 9)).toMatchObject({ from: 9 })
    expect(sanitizeSeason(undefined, 9)).toEqual({ from: 9, told: -1 })
    expect(sanitizeSeason({ from: 'x', told: 'y' }, 9)).toEqual({ from: 9, told: -1 })
  })

  it('a beginning ahead of today, or before the first day, begins today; an arrival is never shown ahead of its season', () => {
    expect(sanitizeSeason({ from: 30, told: 0 }, 9)).toEqual({ from: 9, told: 0 })
    expect(sanitizeSeason({ from: 0, told: 0 }, 9)).toEqual({ from: 9, told: 0 })
    expect(sanitizeSeason({ from: 1, told: 99 }, 9)).toEqual({ from: 1, told: 1 })
    expect(sanitizeSeason({ from: 1, told: -50 }, 9)).toEqual({ from: 1, told: -1 })
    expect(sanitizeSeason({ from: 2.7, told: 0.4 }, 9.9)).toEqual({ from: 2, told: 0 })
    expect(sanitizeSeason({}, Number.NaN)).toEqual({ from: 1, told: -1 })
  })
})
