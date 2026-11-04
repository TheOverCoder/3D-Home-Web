/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from './helpers'

// Order matters: this spec comes first and boots the shared page (see helpers.ts).
test.describe('boot', () => {
  test('boots with no console errors, intro -> playing', async ({ game }) => {
    const { page } = game
    await page.goto('/?debug&quality=low')
    await expect(page.locator('.intro .primary')).toBeEnabled({ timeout: 180_000 })
    expect((await game.state()).phase).toBe('intro')
    await page.locator('.intro .primary').click()
    await page.waitForFunction(() => (window as any).__home.useHome.getState().room != null, null, { timeout: 120_000, polling: 500 })
    expect((await game.state()).phase).toBe('playing')
    // let the first frames run, then nothing should have gone wrong
    await page.waitForTimeout(3000)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('first person by default, eyes about 1.6 m above the floor', async ({ game }) => {
    await game.ready()
    const { page } = game
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
    await game.hold('KeyW', 8000)
    const p1 = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
    expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeGreaterThan(0.4)
  })
})
