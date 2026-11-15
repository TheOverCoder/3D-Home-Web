// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRIVE } from '../data/maps'
import { farm, useFarm } from '../farm/state'
import { playerState } from '../lib/playerState'
import { useHome } from '../store'
import { CURTAIN_MS, START, changeMap, changingMap, expecting, mapArrived } from './maps'
import { setDriveFilm, travel } from './travel'

// The scene follows the save (src/scene/maps.ts), behind its curtain; a drive (travel.ts) moves the save itself. The scene
// is played here by hand: a map asked for "arrives" when the test says (Maps.tsx says it once it is mounted and compiled).

const bump = () => useFarm.setState((s) => ({ rev: s.rev + 1 }))
/** Lets the curtain fall and anything waiting on it run. */
const fall = async () => {
  await vi.advanceTimersByTimeAsync(CURTAIN_MS + 10)
}

beforeEach(() => {
  vi.useFakeTimers()
  farm.place = 'farm'
  farm.apartment.owned = false
  playerState.hold = null
  playerState.moveTo = null
  useHome.setState({ map: 'farm', mapReady: true, curtain: false, panel: null })
})
afterEach(async () => {
  // whatever is still under way is let through
  for (let i = 0; i < 10 && changingMap(); i++) {
    for (const map of ['home', 'farm'] as const) mapArrived(map)
    await vi.advanceTimersByTimeAsync(CURTAIN_MS + 10)
  }
  vi.useRealTimers()
})

describe('a change of map', () => {
  it('falls the curtain, asks the scene for the map, holds you where you get out, and once it is in lets you go there', async () => {
    useHome.getState().openPanel({ kind: 'goals' })
    // (the save is in the house: the scene has no other map to follow)
    farm.apartment.owned = true
    farm.place = 'home'
    const done = changeMap('home', ARRIVE.home)
    expect(changingMap()).toBe(true)
    await Promise.resolve()
    // what you had open closes at once, the curtain falls
    expect(useHome.getState()).toMatchObject({ panel: null, curtain: true, map: 'farm' })
    await fall()
    // the scene is asked for the house; you wait where you get out, facing its heading
    expect(useHome.getState()).toMatchObject({ map: 'home', mapReady: false, curtain: true })
    expect(expecting('home')).toBe(true)
    expect(playerState.hold).toMatchObject({ x: ARRIVE.home.x, z: ARRIVE.home.z })
    mapArrived('home')
    await done
    expect(useHome.getState()).toMatchObject({ map: 'home', mapReady: true, curtain: false })
    expect(playerState.hold).toBeNull()
    expect(playerState.moveTo).toMatchObject({ x: ARRIVE.home.x, z: ARRIVE.home.z })
    expect(changingMap()).toBe(false)
  })
})

describe('the scene follows the save', () => {
  it('another farm loaded in its house: the house comes in, you at its start (the living room)', async () => {
    farm.place = 'home'
    farm.apartment.owned = true
    bump()
    await vi.advanceTimersByTimeAsync(1)
    expect(useHome.getState().curtain).toBe(true)
    await fall()
    expect(useHome.getState().map).toBe('home')
    expect(playerState.hold).toMatchObject({ x: START.home.x, z: START.home.z })
    mapArrived('home')
    await vi.advanceTimersByTimeAsync(1)
    expect(useHome.getState()).toMatchObject({ map: 'home', mapReady: true, curtain: false })
  })

  it('a farm started again and put back on its map in the same moment is no change at all', async () => {
    farm.place = 'home'
    bump()
    farm.place = 'farm'
    await vi.advanceTimersByTimeAsync(CURTAIN_MS * 3)
    expect(useHome.getState()).toMatchObject({ map: 'farm', curtain: false })
    expect(changingMap()).toBe(false)
  })
})

describe('a drive', () => {
  it('to the house only once it is yours; the save moves once the curtain is down, after the film', async () => {
    expect(travel('home')).toBe(false)
    expect(travel('farm')).toBe(false)
    expect(useHome.getState().curtain).toBe(false)
    farm.apartment.owned = true
    const trips: unknown[] = []
    const unset = setDriveFilm(async (trip) => {
      trips.push({ ...trip, place: farm.place, curtain: useHome.getState().curtain })
      await new Promise((r) => setTimeout(r, 1000))
    })
    try {
      expect(travel('home')).toBe(true)
      // one at a time
      expect(travel('home')).toBe(false)
      expect(farm.place).toBe('farm')
      await fall()
      expect(trips).toEqual([{ from: 'farm', to: 'home', place: 'farm', curtain: true }])
      // the film plays on: the save has not moved, the farm still in the scene
      expect([farm.place, useHome.getState().map]).toEqual(['farm', 'farm'])
      await vi.advanceTimersByTimeAsync(1000)
      expect([farm.place, useHome.getState().map]).toEqual(['home', 'home'])
      expect(playerState.hold).toMatchObject({ x: ARRIVE.home.x, z: ARRIVE.home.z })
      mapArrived('home')
      await vi.advanceTimersByTimeAsync(1)
      expect(useHome.getState()).toMatchObject({ map: 'home', mapReady: true, curtain: false })
    } finally {
      unset()
    }
  })
})
