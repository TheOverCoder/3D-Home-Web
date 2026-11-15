import { describe, expect, it } from 'vitest'
import { FARM_SHRUBS, HOUSE_SHRUBS } from '../data/garden'
import { HOUSE } from '../data/layout'
import { PATH_X } from './data'
import { BLOCKERS, canPlace, defaultLayout } from './layout'

// The farm is a map of its own (src/scene/Maps.tsx): the house stands on its own plot on the home map, so the ground it
// and its paving took on the farm is free land, while what the farm itself has — the path among the beds, the shrubs by
// its west boundary — still keeps its ground clear.

describe('the farm without the house', () => {
  it('nothing is in the way where the house and its paving stood, nor where the shrubs along its walls grew', () => {
    const overlaps = (r: { minX: number; maxX: number; minZ: number; maxZ: number }) => r.minX < HOUSE.maxX && r.maxX > HOUSE.minX && r.minZ < HOUSE.maxZ && r.maxZ > HOUSE.minZ
    expect(BLOCKERS.filter((b) => overlaps(b.rect)).map((b) => b.name)).toEqual([])
    for (const [x, z] of HOUSE_SHRUBS) expect(BLOCKERS.some((b) => b.name === 'a shrub' && x > b.rect.minX && x < b.rect.maxX && z > b.rect.minZ && z < b.rect.maxZ)).toBe(false)
  })

  it('a place fits there: the hen run in the middle of the old house, turned or not', () => {
    const layout = defaultLayout()
    for (const rot of [0, 1, 2, 3]) expect(canPlace(layout, 'hens', { x: 2, z: 0, rot }), `turned ${rot}`).toEqual({ ok: true })
  })

  it('the path among the beds and the shrubs by the boundary still keep their ground', () => {
    const layout = defaultLayout()
    expect(canPlace(layout, 'lemon', { x: PATH_X, z: 9.6, rot: 0 }).ok).toBe(false)
    expect(canPlace(layout, 'hens', { x: PATH_X, z: 9.5, rot: 0 })).toEqual({ ok: false, reason: 'On a garden bed' })
    for (const [x, z] of FARM_SHRUBS) expect(BLOCKERS.some((b) => b.name === 'a shrub' && x > b.rect.minX && x < b.rect.maxX && z > b.rect.minZ && z < b.rect.maxZ)).toBe(true)
    // the path stays where it ran out of the garden door, and the beds with it
    expect(PATH_X).toBe(-1.2)
  })
})
