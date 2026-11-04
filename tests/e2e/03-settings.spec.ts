/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp } from './helpers'

test.describe('settings', () => {
  test('Esc opens the drawer; a toggle persists across reload', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => (window as any).__home.useHome.getState().settingsOpen === true, null, { timeout: 30_000 })
    const toggle = page.locator('#set-cinema')
    await expect(toggle).toBeVisible()
    const was = (await toggle.getAttribute('aria-checked')) === 'true'
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', String(!was))
    const stored = await page.evaluate(() => localStorage.getItem('3d-home:settings:v1'))
    expect(JSON.parse(stored!).cinema).toBe(!was)

    await bootApp(page) // loads the page afresh
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => (window as any).__home.useHome.getState().settingsOpen === true, null, { timeout: 30_000 })
    await expect(page.locator('#set-cinema')).toHaveAttribute('aria-checked', String(!was))

    // restore the default so later tests start clean
    await page.locator('#set-cinema').click()
    await expect(page.locator('#set-cinema')).toHaveAttribute('aria-checked', String(was))
  })
})
