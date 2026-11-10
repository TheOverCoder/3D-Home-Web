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
})
