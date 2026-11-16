/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from './helpers'

// The top of the screen: its corner menu holds the view's button (or H), which cycles what it shows — everything (the
// dashboard: the coins, the level, the silo and the barn, the line and the goals round the compass), only the compass,
// or nothing; the choice is remembered — beside the edit mode and the settings. Outdoors the compass is a strip with a
// scale, the letters on it and the farm's hour under its middle. The clear view has a photo button: the game's frame,
// with nothing of the interface, shared or saved.

test.describe('the top of the screen', () => {
  test('its corner menu, or H, cycles everything, only the compass and a clear view', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await page.evaluate(() => (window as any).__home.farm.reset())
    // outdoors on the path, so the coin chip and the compass show
    await game.teleport(-1.2, 1.4, 9.0, Math.PI / 2, -0.1)
    const hud = () => page.evaluate(() => document.documentElement.dataset.hud)
    // the menu in the corner opens into its four buttons, each with its name (the farm news first)
    await expect(page.locator('.hud-mode')).toHaveCount(0)
    await page.locator('.top-menu-btn').click()
    await expect(page.locator('.top-dial-btn')).toHaveCount(4)
    await expect(page.locator('.top-dial-btn').first()).toContainText('Farm news')
    for (let k = 0; k < 3 && (await hud()) !== 'all'; k++) await page.locator('.hud-mode').click()
    expect(await hud()).toBe('all')
    await expect(page.locator('.farm-chip')).toBeVisible()
    await expect(page.locator('.compass')).toBeVisible()
    await expect(page.locator('.farm-chip-item.day')).toHaveText(/^\d\d:\d0$/)
    await expect(page.locator('.compass-letter.north')).toHaveText('N')
    await expect(page.locator('.edit-open')).toBeVisible()
    await expect(page.locator('.edit-open')).toContainText('Edit the farm')
    // the photo button is the clear view's only
    await expect(page.locator('.photo-btn')).toHaveCount(0)
    // a touch elsewhere closes it
    await page.locator('.farm-chip-item.coins').click()
    await expect(page.locator('.top-dial')).toHaveCount(0)

    // H: only the compass, with the hour under it
    await page.keyboard.press('KeyH')
    await page.waitForFunction(() => document.documentElement.dataset.hud === 'compass')
    await expect(page.locator('.farm-chip')).toBeHidden()
    await expect(page.locator('.edit-open')).toHaveCount(0)
    await expect(page.locator('.compass')).toBeVisible()
    await expect(page.locator('.compass-hour')).toHaveText(/^\d\d:\d0$/)
    await expect(page.locator('.top-menu-btn')).toBeVisible()
    await expect(page.locator('.photo-btn')).toHaveCount(0)

    // the menu's view button: a clear view, only the menu left
    await page.locator('.top-menu-btn').click()
    await page.locator('.hud-mode').click()
    await page.waitForFunction(() => document.documentElement.dataset.hud === 'clean')
    await expect(page.locator('.compass')).toHaveCount(0)
    await expect(page.locator('.farm-chip')).toBeHidden()
    await expect(page.locator('.hud-mode')).toBeVisible()
    await expect(page.locator('.top-menu-btn')).toBeVisible()
    // and a photo of the farm, without the interface: the game's frame, saved as a picture (no share sheet here)
    await expect(page.locator('.photo-btn')).toBeVisible()
    const download = page.waitForEvent('download')
    await page.locator('.photo-btn').click()
    const photo = await download
    expect(photo.suggestedFilename()).toMatch(/^3d-home-[\d-]+\.jpg$/)

    // and round to everything again, which is what is saved
    await page.keyboard.press('KeyH')
    await page.waitForFunction(() => document.documentElement.dataset.hud === 'all')
    await expect(page.locator('.farm-chip')).toBeVisible()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('3d-home:settings:v1') ?? '{}').hudMode)).toBe('all')
  })

  test('the compass folds what is behind you at one edge into one "+N" mark, which turns you to the nearest of them', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    // a ripe bed of tomatoes and a lemon tree full of fruit, both behind you on the left as you look north
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      for (const [id, n] of Object.entries({ hens: 0, tree: 8, cows: 0, sheep: 0 })) f.state.producers[id].stock.fill(n)
      f.plant(2, 'tomato')
      f.state.beds[2].growth = 1e6
    })
    await game.teleport(-1.2, 1.4, 7.5, 0, 0.1)
    const more = page.locator('.compass-more').first()
    await expect(more).toBeVisible()
    await expect(more).toHaveText('+2')
    await expect(more).toHaveAttribute('data-side', 'left')
    // the two marks themselves are folded into it, not piled on the strip
    await expect(page.getByRole('button', { name: /^8 tomatoes ready/ })).toBeHidden()
    await expect(page.getByRole('button', { name: /^8 lemons ready/ })).toBeHidden()
    // tapped, it turns you to the nearer of them (the bed) and marks it
    await more.click()
    await page.waitForFunction(() => (window as any).__home.useHome.getState().guide?.id === 'farm-bed-2', null, { timeout: 30_000, polling: 200 })
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('at the house: in its garden the chips and the day’s clock, the compass with nothing of the farm on it, and no edit mode; inside, decorating', async ({ game }) => {
    // a ripe bed on the farm: on the farm it would be on the compass
    await game.ready('farm')
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      for (const [id, n] of Object.entries({ hens: 6, tree: 8, cows: 0, sheep: 0 })) f.state.producers[id].stock.fill(n)
    })
    await game.ready()
    // in the house's garden, by the driveway
    await game.teleport(-1.2, 1.4, 10.2, 0, 0)
    await page.waitForFunction(() => (window as any).__home.useHome.getState().outdoors === true, null, { timeout: 30_000, polling: 200 })
    for (let k = 0; k < 3 && (await page.evaluate(() => document.documentElement.dataset.hud)) !== 'all'; k++) await page.locator('.hud-mode').click()
    await expect(page.locator('.farm-chip')).toBeVisible()
    await expect(page.locator('.farm-chip-item.day')).toBeVisible()
    await expect(page.locator('.compass')).toBeVisible()
    await page.waitForTimeout(1000)
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().compass)).toEqual([])
    // the menu: the farm news (the farm's events reach the house too), the top's view and the settings, nothing to edit
    await page.locator('.top-menu-btn').click()
    await expect(page.locator('.top-dial-btn')).toHaveCount(3)
    await expect(page.locator('.news-open')).toBeVisible()
    await expect(page.locator('.edit-open')).toHaveCount(0)
    await page.locator('.top-menu-btn').click()
    await page.keyboard.press('KeyB')
    await page.waitForTimeout(500)
    expect(
      await page.evaluate(() => {
        const s = (window as any).__home.useHome.getState()
        return [s.editing, s.decorating]
      }),
    ).toEqual([false, false])
    // inside, the button decorates the house
    await game.teleport(-3.5, 1.4, 1.3, Math.PI, 0)
    await page.waitForFunction(() => (window as any).__home.useHome.getState().room === 'living', null, { timeout: 30_000, polling: 200 })
    await page.locator('.top-menu-btn').click()
    await expect(page.locator('.edit-open')).toHaveAttribute('aria-label', /^Decorate/)
    await page.locator('.top-menu-btn').click()
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
