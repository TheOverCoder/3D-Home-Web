/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from './helpers'

// The top of the screen: its corner button (or H) cycles what it shows — everything (coins and basket, the compass,
// the edit and settings buttons), only the compass, or nothing; the choice is remembered. Outdoors the compass is a
// thin strip with a scale and the heading under its middle.

test.describe('the top of the screen', () => {
  test('its corner button, or H, cycles everything, only the compass and a clear view', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => (window as any).__home.farm.reset())
    // outdoors on the path, so the coin chip and the compass show
    await game.teleport(-1.2, 1.4, 9.0, Math.PI / 2, -0.1)
    const hud = () => page.evaluate(() => document.documentElement.dataset.hud)
    for (let k = 0; k < 3 && (await hud()) !== 'all'; k++) await page.locator('.hud-mode').click()
    expect(await hud()).toBe('all')
    await expect(page.locator('.farm-chip')).toBeVisible()
    await expect(page.locator('.compass')).toBeVisible()
    await expect(page.locator('.compass-heading')).toHaveText(/^\d+°$/)
    await expect(page.locator('.compass-letter.north')).toHaveText('N')
    await expect(page.locator('.gear.edit-open')).toBeVisible()

    // H: only the compass
    await page.keyboard.press('KeyH')
    await page.waitForFunction(() => document.documentElement.dataset.hud === 'compass')
    await expect(page.locator('.farm-chip')).toBeHidden()
    await expect(page.locator('.gear.edit-open')).toBeHidden()
    await expect(page.locator('.compass')).toBeVisible()

    // the corner button: a clear view, only the button itself left
    await page.locator('.hud-mode').click()
    await page.waitForFunction(() => document.documentElement.dataset.hud === 'clean')
    await expect(page.locator('.compass')).toHaveCount(0)
    await expect(page.locator('.farm-chip')).toBeHidden()
    await expect(page.locator('.hud-mode')).toBeVisible()

    // and round to everything again, which is what is saved
    await page.keyboard.press('KeyH')
    await page.waitForFunction(() => document.documentElement.dataset.hud === 'all')
    await expect(page.locator('.farm-chip')).toBeVisible()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('3d-home:settings:v1') ?? '{}').hudMode)).toBe('all')
  })

  test('the compass folds what is behind you at one edge into one "+N" mark, which turns you to the nearest of them', async ({ game }) => {
    await game.ready()
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
})
