// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useHome } from '../store'
import { ITEMS } from './data'
import { albumGarment } from './outfit'
import { albumNow, farm, quietSteps, resetFarm, resetRewardCounts, rewardCounts, sawAlbum, tick, wearGarment, xpEventCount } from './state'
import { OLD_SAVE, justSaved, savedNow, startFrom } from './testSaves'

// The farm album on the farm (src/farm/album.ts, src/farm/state/album.ts): a page finished gives its garment by itself,
// once, a frame later (a toast, the wardrobe), never XP or coins; two at once come one after the other; the album
// opened shows every tile earned; all of it kept in the save, a farm from before it given its done pages' garments.

/** Every building material got: the materials page done. */
const materialsDone = () => {
  for (const id of ITEMS) farm.got[id] = 1
}

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  quietSteps(true)
  resetRewardCounts()
})
afterEach(() => quietSteps(true))

describe('a page finished', () => {
  it('gives its garment by itself, once, a frame later: into the wardrobe, a toast, a page reward; no XP, no coins', () => {
    const coins = farm.coins
    const events = xpEventCount()
    materialsDone()
    expect(farm.outfit.owned).toEqual([])
    tick(1)
    const g = albumGarment('materials')!
    expect(farm.outfit.owned).toEqual([g.id])
    expect(farm.album.done).toEqual(['materials'])
    expect(useHome.getState().toast?.text).toMatch(/^Album: Building materials done · a timber cap for your wardrobe$/)
    expect(Object.values(rewardCounts().page).reduce((n, c) => n + c, 0)).toBe(1)
    expect([farm.coins, xpEventCount()]).toEqual([coins, events])
    // never again
    tick(1)
    tick(1)
    expect(farm.outfit.owned).toEqual([g.id])
    expect(Object.values(rewardCounts().page).reduce((n, c) => n + c, 0)).toBe(1)
    // worn like any other
    expect(wearGarment(g.id)).toBe(true)
    expect(farm.outfit.hat).toBe(g.id)
  })

  it('two at once: one after the other, a few seconds apart (each toast read before the next)', () => {
    materialsDone()
    farm.played = { days: 29, last: farm.played.last }
    farm.season = { from: 1, told: 0 }
    tick(1)
    expect(farm.album.done).toHaveLength(1)
    tick(1)
    expect(farm.album.done).toHaveLength(1)
    tick(3)
    expect(farm.album.done.sort()).toEqual(['materials', 'seasons'])
  })

  it('not while a new farm’s first steps run', () => {
    quietSteps(false)
    materialsDone()
    tick(1)
    expect(farm.album.done).toEqual([])
  })
})

describe('opened', () => {
  it('the tiles earned since the last time are new while it is open, and shown once it has been', () => {
    farm.got.brick = 2
    expect(albumNow().pages.find((p) => p.id === 'materials')!.tiles[0].state).toBe('new')
    sawAlbum()
    expect(farm.album.seen).toContain('materials:brick')
    expect(albumNow().pages.find((p) => p.id === 'materials')!.tiles[0].state).toBe('got')
  })
})

describe('kept in the save', () => {
  it('saved and loaded as it was; nothing given twice', () => {
    materialsDone()
    tick(1)
    sawAlbum()
    const album = structuredClone(farm.album)
    const owned = [...farm.outfit.owned]
    startFrom(justSaved(savedNow()))
    expect(farm.album).toEqual(album)
    expect(farm.outfit.owned).toEqual(owned)
    tick(1)
    expect(farm.outfit.owned).toEqual(owned)
  })

  it('a farm from before the album: nothing shown, and a page it had already finished gives its garment, once', () => {
    startFrom(justSaved({ ...OLD_SAVE, got: Object.fromEntries(ITEMS.map((id) => [id, 3])) }))
    expect(farm.album).toEqual({ seen: [], done: [] })
    quietSteps(true)
    tick(1)
    expect(farm.outfit.owned).toContain(albumGarment('materials')!.id)
  })

  it('a page saved as done whose garment the wardrobe lacks gives it again, once', () => {
    startFrom(justSaved({ ...savedNow(), album: { seen: [], done: ['materials'] } }))
    expect(farm.album.done).toEqual([])
    materialsDone()
    tick(1)
    expect(farm.album.done).toEqual(['materials'])
    expect(farm.outfit.owned).toEqual([albumGarment('materials')!.id])
  })
})
