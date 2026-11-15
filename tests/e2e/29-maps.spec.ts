/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, FARM_START, SPAWN } from './helpers'
import { ARRIVE } from '../../src/data/maps'

// The two maps (src/scene/Maps.tsx, maps.ts, travel.ts): the farm and the house, only the one you are on in the scene.
// A drive (`travel`, what the car's talk calls) is refused to the house until it is yours; otherwise the curtain falls,
// the drive's film plays (when there is one), the save moves, the other map comes in with you out of the car where
// `ARRIVE` says and facing its heading, and the curtain rises — the farm going on all the while. Another farm loaded
// on the other map (a slot switched to) takes the scene with it, you at that map's start.

const state = (page: Page) =>
  page.evaluate(() => {
    const h = (window as any).__home
    const s = h.useHome.getState()
    const p = h.ecctrl().body.translation()
    return { map: s.map, ready: s.mapReady, curtain: s.curtain, place: h.farm.state.place, x: p.x, z: p.z, yaw: h.look.yaw, room: s.room, outdoors: s.outdoors }
  })
const settled = (page: Page, map: 'home' | 'farm') =>
  page.waitForFunction(
    (map) => {
      const s = (window as any).__home.useHome.getState()
      return s.map === map && s.mapReady && !s.curtain
    },
    map,
    { timeout: 180_000, polling: 100 },
  )
const ids = (page: Page) => page.evaluate(() => (window as any).__home.interactables().map((d: any) => d.id) as string[])
const facing = (yaw: number, heading: number) => Math.cos(yaw - heading)

test.describe('the two maps', () => {
  test('a drive: to the house only once it is yours; behind the curtain the map changes and you get out where you should; the farm goes on; the film plays between', async ({ game }) => {
    test.setTimeout(600_000)
    await game.ready('farm')
    const { page } = game
    // a new farm, without the house; a bed of lettuce growing
    const refused = await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.plant(0, 'lettuce')
      f.water(0)
      return (window as any).__home.maps.travel('home')
    })
    expect(refused).toBe(false)
    await page.waitForTimeout(800)
    expect(await state(page)).toMatchObject({ map: 'farm', place: 'farm', curtain: false })

    // the house bought: off we go — the curtain first, the save moved once it is down
    const growth = await page.evaluate(() => {
      const h = (window as any).__home
      h.farm.state.apartment.owned = true
      const went = h.maps.travel('home')
      return { went, curtain: h.useHome.getState().curtain, place: h.farm.state.place, growth: h.farm.state.beds[0].growth }
    })
    expect(growth).toMatchObject({ went: true, place: 'farm' })
    await page.waitForFunction(() => (window as any).__home.useHome.getState().curtain === true, null, { timeout: 10_000, polling: 50 })
    // a second drive while one is under way is no drive
    expect(await page.evaluate(() => (window as any).__home.maps.travel('farm'))).toBe(false)
    await settled(page, 'home')
    const home = await state(page)
    expect(home).toMatchObject({ map: 'home', place: 'home', outdoors: true, room: null })
    expect(Math.hypot(home.x - ARRIVE.home.x, home.z - ARRIVE.home.z), 'out of the car beside it').toBeLessThan(0.6)
    expect(facing(home.yaw, ARRIVE.home.heading), 'facing the house').toBeGreaterThan(0.95)
    // the house's own things, none of the farm's; the farm scene is gone
    const here = await ids(page)
    expect(here.some((id) => id.startsWith('lamp-'))).toBe(true)
    expect(here.filter((id) => id.startsWith('farm-'))).toEqual([])
    expect(await page.evaluate(() => !!(window as any).__home.scene.getObjectByName('farm-map'))).toBe(false)
    // the farm goes on while you are in the house: the lettuce grows
    await page.waitForFunction((g) => (window as any).__home.farm.state.beds[0].growth > g, growth.growth, { timeout: 60_000, polling: 250 })
    // and the save says where you are
    await page.evaluate(() => (window as any).__home.farm.saveFarm())
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('3d-home:farm:v1') ?? '{}').place)).toBe('home')

    // back, with a drive film (a later phase plays one): it plays while the screen is dark, the map changes after it
    await page.evaluate(() => {
      const w = window as any
      w.__trips = []
      w.__unfilm = w.__home.maps.setDriveFilm(async (trip: any) => {
        w.__trips.push({ ...trip, map: w.__home.useHome.getState().map, curtain: w.__home.useHome.getState().curtain })
        await new Promise((r) => setTimeout(r, 1500))
      })
    })
    try {
      expect(await page.evaluate(() => (window as any).__home.maps.travel('farm'))).toBe(true)
      await settled(page, 'farm')
      expect(await page.evaluate(() => (window as any).__trips)).toEqual([{ from: 'home', to: 'farm', map: 'home', curtain: true }])
    } finally {
      await page.evaluate(() => (window as any).__unfilm?.())
    }
    const farm = await state(page)
    expect(farm).toMatchObject({ map: 'farm', place: 'farm', outdoors: true, room: null })
    expect(Math.hypot(farm.x - ARRIVE.farm.x, farm.z - ARRIVE.farm.z)).toBeLessThan(0.6)
    expect(facing(farm.yaw, ARRIVE.farm.heading)).toBeGreaterThan(0.95)
    expect((await ids(page)).some((id) => id.startsWith('farm-bed-'))).toBe(true)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('another farm loaded in its house takes the scene there, you in the living room; the first farm back on the farm', async ({ game }) => {
    test.setTimeout(600_000)
    await game.ready('farm')
    const { page } = game
    // this farm as a file, its player left in the house (bought), loaded into the third slot and played; then back
    await page.evaluate(() => {
      const h = (window as any).__home
      const { slots, farm } = h
      farm.saveFarm()
      const file = JSON.parse(slots.exportSlot(1).text)
      file.save.apartment = { owned: true }
      file.save.place = 'home'
      if (!slots.importSlot(3, JSON.stringify(file)).ok) throw new Error('import')
      slots.switchSlot(3)
    })
    await settled(page, 'home')
    const there = await state(page)
    expect(there).toMatchObject({ map: 'home', place: 'home' })
    expect(Math.hypot(there.x - SPAWN.x, there.z - SPAWN.z), 'in the living room, where the house starts').toBeLessThan(0.6)
    await page.waitForFunction(() => (window as any).__home.useHome.getState().room === 'living', null, { timeout: 30_000, polling: 250 })
    await page.evaluate(() => (window as any).__home.slots.switchSlot(1))
    await settled(page, 'farm')
    const back = await state(page)
    expect(back).toMatchObject({ map: 'farm', place: 'farm' })
    expect(Math.hypot(back.x - FARM_START.x, back.z - FARM_START.z), 'where a farm starts').toBeLessThan(0.6)
    await page.evaluate(() => (window as any).__home.slots.deleteSlot(3))
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
