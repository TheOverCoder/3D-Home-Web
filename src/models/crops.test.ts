import { describe, expect, it } from 'vitest'
import type { Parts } from '../lib/sculpt'
import { CROPS, type CropId } from '../farm/data'
import { cropGeometries, cropPartMax, type CropPart } from './crops'
import { GROWERS } from './plants'

// The garden's weight (./crops.ts, ./plants.ts): a ripe bed of any crop draws no more than the heaviest bed of the
// crops the budget walk plants (tests/e2e/05's fillFarm: one of each of the first eight), so a farm sown with the long
// crops stays inside what 05 measures; and every part they use can be drawn as often as 25 beds of one of them need.

/** The plants of a crop in a bed, as src/farm/Plants.tsx lays them out (its LAYOUT). */
const PLANTS: Record<CropId, number> = { lettuce: 8, carrot: 12, strawberry: 8, tomato: 3, corn: 6, pumpkin: 2, wheat: 15, sugarcane: 6, sunflower: 3, potato: 8, melon: 2, cotton: 6 }
/** The crops the budget walk plants (fillFarm). */
const MEASURED: CropId[] = ['lettuce', 'carrot', 'strawberry', 'tomato', 'corn', 'pumpkin', 'wheat', 'sugarcane']
/** The most beds a farm can have (13 today, 25 with mission 01's meadows). */
const MOST_BEDS = 25

/** What a ripe bed of a crop puts: the triangles, and how many of each part. */
function ripeBed(crop: CropId) {
  const g = cropGeometries()
  const tris = (k: CropPart) => (g[k].index ? g[k].index!.count : g[k].attributes.position.count) / 3
  let triangles = 0
  const parts = new Map<CropPart, number>()
  const p = {
    put: (k: CropPart) => {
      triangles += tris(k)
      parts.set(k, (parts.get(k) ?? 0) + 1)
    },
  } as unknown as Parts<CropPart>
  for (let k = 0; k < PLANTS[crop]; k++) GROWERS[crop](p, 0, 0, 0, 1, (k + 1) / (PLANTS[crop] + 1))
  return { triangles, parts }
}

describe('the garden’s weight', () => {
  it('knows every crop’s plants', () => {
    expect(Object.keys(PLANTS).sort()).toEqual(CROPS.map((c) => c.id).sort())
  })

  it('a ripe bed of any crop draws no more than the heaviest bed the budget walk measures', () => {
    const heaviest = Math.max(...MEASURED.map((c) => ripeBed(c).triangles))
    for (const c of CROPS) expect(ripeBed(c.id).triangles, c.id).toBeLessThanOrEqual(heaviest)
  })

  it(`each part can be drawn as often as ${MOST_BEDS} ripe beds of one of the long crops need`, () => {
    for (const crop of ['sunflower', 'potato', 'melon', 'cotton'] as const)
      for (const [part, n] of ripeBed(crop).parts) expect(n * MOST_BEDS, `${crop}: ${part}`).toBeLessThanOrEqual(cropPartMax(part))
  })
})
