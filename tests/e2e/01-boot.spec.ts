/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, FARM_START } from './helpers'

// Order matters: this spec comes first and boots the shared page (see helpers.ts).
test.describe('boot', () => {
  test('boots with no console errors, intro -> playing', async ({ game }) => {
    const { page } = game
    await page.goto('/?debug&quality=low')
    await expect(page.locator('.intro .primary')).toBeEnabled({ timeout: 180_000 })
    expect((await game.state()).phase).toBe('intro')
    // the opening menu (src/ui/Intro.tsx): its corner says the music is on (it starts with the first tap), and a page
    // steps back with the browser's (or the phone's) Back to the menu, never out of the game
    await expect(page.locator('.intro-sound')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('.intro-tile', { hasText: 'How to play' }).click()
    await expect(page.locator('.intro-page-help')).toBeVisible()
    await page.goBack()
    await expect(page.locator('.intro-page-help')).toHaveCount(0)
    await expect(page.locator('.intro-tile', { hasText: 'Settings' })).toBeVisible()
    expect((await game.state()).phase).toBe('intro')
    await page.locator('.intro .primary').click()
    await page.waitForFunction(
      () => {
        const s = (window as any).__home.useHome.getState()
        return s.mapReady && (s.outdoors || s.room !== null)
      },
      null,
      { timeout: 120_000, polling: 500 },
    )
    expect((await game.state()).phase).toBe('playing')
    // a new farm starts on the farm (the house is a map of its own, bought later), on the path among the beds, looking
    // south to the gate (src/data/maps.ts, FARM_START)
    const start = await page.evaluate(() => {
      const h = (window as any).__home
      const s = h.useHome.getState()
      const p = h.ecctrl().body.translation()
      return { map: s.map, place: h.farm.state.place, owned: h.farm.state.apartment.owned, outdoors: s.outdoors, room: s.room, x: p.x, z: p.z, yaw: h.look.yaw }
    })
    expect(start).toMatchObject({ map: 'farm', place: 'farm', owned: false, outdoors: true, room: null })
    expect(Math.hypot(start.x - FARM_START.x, start.z - FARM_START.z)).toBeLessThan(0.5)
    expect(Math.cos(start.yaw - Math.PI)).toBeGreaterThan(0.95)
    // the farm's own things, and none of the house's: its beds on offer, no room, no lamp, no screen
    const ids: string[] = await page.evaluate(() => (window as any).__home.interactables().map((d: any) => d.id))
    expect(ids.some((id) => id.startsWith('farm-bed-'))).toBe(true)
    expect(ids.filter((id) => /^(lamp-|screen-|item-|door-|wardrobe-)/.test(id))).toEqual([])
    expect(await page.evaluate(() => !!(window as any).__home.scene.getObjectByName('home-map'))).toBe(false)
    // let the first frames run, then nothing should have gone wrong
    await page.waitForTimeout(3000)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('first person by default, eyes about 1.6 m above the floor', async ({ game }) => {
    await game.ready()
    const { page } = game
    // the house now (the test farm owns it): its own things, and none of the farm's
    const ids: string[] = await page.evaluate(() => (window as any).__home.interactables().map((d: any) => d.id))
    expect(ids.some((id) => id.startsWith('lamp-'))).toBe(true)
    expect(ids.filter((id) => id.startsWith('farm-'))).toEqual([])
    expect(await page.evaluate(() => !!(window as any).__home.scene.getObjectByName('farm-map'))).toBe(false)
    expect((await game.state()).view).toBe('first')
    // software rendering makes the physics bounce a little: use the median of many samples
    const ys: number[] = []
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(400)
      ys.push(await page.evaluate(() => (window as any).__home.camera.position.y))
    }
    ys.sort((a, b) => a - b)
    const y = ys[Math.floor(ys.length / 2)]
    expect(y).toBeGreaterThan(1.5)
    expect(y).toBeLessThan(1.8)
  })

  test('walking forward moves the player', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.waitForTimeout(1500)
    const p0 = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
    // hold W until the player has clearly moved (frame rate varies with machine load)
    await page.keyboard.down('KeyW')
    try {
      await page.waitForFunction((a) => Math.hypot((window as any).__home.playerState.position.x - a.x, (window as any).__home.playerState.position.z - a.z) > 0.4, p0, {
        timeout: 60_000,
        polling: 250,
      })
    } finally {
      await page.keyboard.up('KeyW')
    }
  })
})
