/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, FARM_START, SPAWN } from './helpers'
import { ARRIVE } from '../../src/data/maps'

// The two maps (src/scene/Maps.tsx, maps.ts, travel.ts): the farm and the house, only the one you are on in the scene.
// A drive (`travel`, what the car's talk calls) is refused to the house until it is yours; otherwise the curtain falls,
// the drive's film plays (src/film: in the game's own canvas, the farm's hour on the car's dashboard), the save moves,
// the other map comes in with you out of the car where `ARRIVE` says and facing its heading, and the curtain rises —
// the farm going on all the while. A tap skips the film. Another farm loaded on the other map (a slot switched to) takes
// the scene with it, you at that map's start.

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
/** The drive's film playing now (src/film/DriveFilm.tsx), or null. */
const filmNow = (page: Page) => page.evaluate(() => (window as any).__home.film.state())
/** Watches the drive under way, in the page: the film's moments as it plays (the furthest it got, the scene and the
 *  curtain meanwhile), and what the film was doing when the save moved to the other map. */
const watchDrive = (page: Page) =>
  page.evaluate(() => {
    const w = window as any
    const h = w.__home
    const seen = { longest: 0, length: 0, during: [] as any[], moved: null as any, at: h.farm.state.place }
    w.__drive = seen
    const look = () => {
      const f = h.film.state()
      if (f) {
        seen.longest = Math.max(seen.longest, f.t)
        seen.length = f.length
        const s = h.useHome.getState()
        if (f.frames > 1 && seen.during.length < 400) seen.during.push({ map: s.map, curtain: s.curtain, place: h.farm.state.place, film: document.documentElement.dataset.film ?? null })
      }
      if (seen.moved === null && h.farm.state.place !== seen.at) seen.moved = { film: f }
      if (seen.moved === null || f) requestAnimationFrame(look)
    }
    look()
  })
const facing = (yaw: number, heading: number) => Math.cos(yaw - heading)

test.describe('the two maps', () => {
  test("a drive: to the house only once it is yours; the drive's film plays behind the curtain with the farm's hour, the map changes after it and you get out where you should; the farm goes on; a tap skips the film", async ({
    game,
  }) => {
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

    // the house bought, at ten past nine at night: off we go — the curtain first, the save moved once it is down
    const growth = await page.evaluate(() => {
      const h = (window as any).__home
      h.farm.state.apartment.owned = true
      h.farm.setHour(21.2)
      const went = h.maps.travel('home')
      return { went, curtain: h.useHome.getState().curtain, place: h.farm.state.place, growth: h.farm.state.beds[0].growth }
    })
    expect(growth).toMatchObject({ went: true, place: 'farm' })
    await page.waitForFunction(() => (window as any).__home.useHome.getState().curtain === true, null, { timeout: 10_000, polling: 50 })
    await watchDrive(page)
    // a second drive while one is under way is no drive
    expect(await page.evaluate(() => (window as any).__home.maps.travel('farm'))).toBe(false)
    // the drive's film: on the dashboard the hour the day chip says, at night; the letterbox and Skip over it, the rest
    // of the interface hidden
    await page.waitForFunction(() => ((window as any).__home.film.state()?.frames ?? 0) > 2, null, { timeout: 60_000, polling: 100 })
    const playing = await filmNow(page)
    expect(playing).toMatchObject({ trip: { from: 'farm', to: 'home' }, still: false, clock: '21:10', night: true })
    expect(playing.length).toBeGreaterThanOrEqual(6)
    expect(playing.length).toBeLessThanOrEqual(10)
    expect(await page.locator('.farm-chip-item.day b').textContent()).toBe('21:10')
    await expect(page.locator('.drive-film')).toBeVisible()
    await expect(page.locator('.drive-film-skip')).toBeVisible()
    await expect(page.locator('.farm-chip-item.day')).toBeHidden()
    await settled(page, 'home')
    // it played to its end while the farm was still in the scene and the save still on the farm, the curtain down
    // under it; the save moved only once it was over
    const drive = await page.evaluate(() => (window as any).__drive)
    expect(drive.longest).toBeGreaterThan(drive.length - 0.6)
    expect(drive.during.length).toBeGreaterThan(0)
    for (const d of drive.during) expect(d).toEqual({ map: 'farm', curtain: true, place: 'farm', film: 'drive' })
    expect(drive.moved).toEqual({ film: null })
    // and it is gone: the interface back
    expect(await filmNow(page)).toBe(null)
    await expect(page.locator('.drive-film')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.dataset.film ?? null)).toBe(null)
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

    // back in the morning, with less motion: the film is one still from the driver's seat with the clock; a tap anywhere
    // skips it, and the farm comes in at once (its clock held a moment in, so it is the tap that ends it however slowly
    // software rendering draws it)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    try {
      await page.evaluate(() => {
        const h = (window as any).__home
        h.farm.setHour(8)
        h.film.hold(0.3)
      })
      expect(await page.evaluate(() => (window as any).__home.maps.travel('farm'))).toBe(true)
      await page.waitForFunction(() => ((window as any).__home.film.state()?.frames ?? 0) > 0, null, { timeout: 60_000, polling: 100 })
      const still = await filmNow(page)
      expect(still).toMatchObject({ trip: { from: 'home', to: 'farm' }, still: true, shot: 'the clock', clock: '08:00', night: false })
      expect(still.length).toBeLessThanOrEqual(3)
      await watchDrive(page)
      await page.mouse.click(320, 200)
      await page.waitForFunction(() => (window as any).__home.film.state() === null, null, { timeout: 10_000, polling: 50 })
      await settled(page, 'farm')
      const skipped = await page.evaluate(() => (window as any).__drive)
      expect(skipped.longest, 'skipped before its end').toBeLessThan(skipped.length - 0.3)
      expect(skipped.moved).toEqual({ film: null })
    } finally {
      await page.emulateMedia({ reducedMotion: null })
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
