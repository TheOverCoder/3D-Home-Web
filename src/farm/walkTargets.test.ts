// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerInteractable } from '../lib/interaction'
import { playerState } from '../lib/playerState'
import { BEDS } from './data'
import { FIRST_STEPS } from './firstSteps'
import { bedSpot, farm, resetFarm } from './state'
import { walkTarget } from './walkTargets'

// Where a step's tap walks you (src/farm/walkTargets.ts): its interactable while it is there; where its good comes from
// (the nest for the eggs); the nearest bed at the first of its stages the farm has, falling back along them; nothing
// when there is nowhere to go (the hint shakes then).

const off: (() => void)[] = []
/** Puts a thing on the map as the scene would (only its id and where it stands matter here). */
const put = (id: string, x: number, z: number, ready?: () => { item: string; count: number } | null) =>
  off.push(registerInteractable({ id, label: id, position: { x, y: 0, z }, radius: 1, ready, run: () => {} }))
/** Every bed of a new farm on the map, where it stands. */
const putBeds = () => BEDS.forEach((_, i) => put(`farm-bed-${i}`, bedSpot(i).x, bedSpot(i).z))

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  playerState.position.x = 0
  playerState.position.z = 0
})
afterEach(() => off.splice(0).forEach((f) => f()))

const step = (id: string) => FIRST_STEPS.find((s) => s.id === id)!.target

describe("a step's tap walks to", () => {
  it('the nearest empty bed to plant, the nearest of them from where you stand', () => {
    putBeds()
    const built = farm.beds.flatMap((b, i) => (b.built && !b.crop ? [i] : []))
    expect(built.length).toBeGreaterThan(1)
    // standing on one empty bed: that one
    for (const i of built.slice(0, 2)) {
      playerState.position.x = bedSpot(i).x
      playerState.position.z = bedSpot(i).z
      expect(walkTarget(step('plant'))).toBe(`farm-bed-${i}`)
    }
  })

  it('a thirsty bed to water, else one growing; nothing when no bed is either', () => {
    putBeds()
    expect(walkTarget(step('water'))).toBe(null)
    const [a, b] = farm.beds.flatMap((bed, i) => (bed.built ? [i] : []))
    Object.assign(farm.beds[a], { crop: 'lettuce', growth: 1, water: 20 })
    expect(walkTarget(step('water'))).toBe(`farm-bed-${a}`)
    Object.assign(farm.beds[b], { crop: 'lettuce', growth: 1, water: 0 })
    expect(walkTarget(step('water'))).toBe(`farm-bed-${b}`)
  })

  it('a bed not on the map is never a target (another map, or not drawn yet)', () => {
    expect(walkTarget(step('plant'))).toBe(null)
  })

  it('a place by its id while it is on the map; where a good comes from', () => {
    expect(walkTarget(step('sell'))).toBe(null)
    put('farm-queue', 1, 1)
    expect(walkTarget(step('sell'))).toBe('farm-queue')
    expect(walkTarget(step('eggs'))).toBe(null)
    put('farm-nest', 4, 4)
    expect(walkTarget(step('eggs'))).toBe('farm-nest')
  })
})
