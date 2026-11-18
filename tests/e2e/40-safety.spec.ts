/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { expect, test, type Game } from './helpers'

// A part of the interface that throws never takes the game down (src/ui/PanelGuard.tsx, update-v1 mission 08 c6): a
// panel closes, a toast says "That didn't open properly", the farm draws on, the error is in Copy diagnostics, and the
// next panel opens; a layer of the screen (the corner menu) is left out, and drawn again once what is over the game
// changes. The faults are armed through the debug hook (`__home.guard.fail(name)`): the next time the guard of that
// name draws, a part inside it throws, as a part with a bug would. On the shared page; the errors they make on purpose
// are taken out of its list, the rest must be none.

const panel = (page: Page) => page.evaluate(() => (window as any).__home.useHome.getState().panel?.kind ?? null)
const frame = (page: Page) => page.evaluate(() => (window as any).__home.gl.info.render.frame as number)
/** The lines of the diagnostics' report (Settings → Copy diagnostics) about what failed. */
const diagnosed = (page: Page) => page.evaluate(() => (JSON.parse((window as any).__home.diagnostics()).recent as string[]).filter((l) => l.includes('[3d-home]')))

/** Every toast said from now on, watched in the page (one lasts two seconds: a page drawn in software can miss it). */
const watchToasts = (page: Page) =>
  page.evaluate(() => {
    const w = window as any
    w.__toasts = []
    window.clearInterval(w.__toastWatch)
    w.__toastWatch = window.setInterval(() => {
      const t = document.querySelector('.toast')?.textContent
      if (t && !w.__toasts.includes(t)) w.__toasts.push(t)
    }, 30)
  })
const toasts = (page: Page) => page.evaluate(() => (window as any).__toasts as string[])

/** The farm draws on: frames come. */
async function drawing(page: Page) {
  const f0 = await frame(page)
  await expect.poll(() => frame(page), { timeout: 30_000, message: 'the farm draws on' }).toBeGreaterThan(f0 + 2)
}

/** The page's errors, less the ones the faults made on purpose (taken out of its list: the next spec reads it). */
function othersThan(game: Game) {
  const rest = game.errors.filter((e) => !e.includes('a fault in'))
  game.errors.splice(0, game.errors.length, ...rest)
  return rest
}

test.describe('safety', () => {
  test.afterEach(async ({ game }) => {
    await game.page.evaluate(() => window.clearInterval((window as any).__toastWatch))
  })

  test('a panel that throws closes with a word, the farm draws on, the error is in the diagnostics, and the next panel opens', async ({ game }) => {
    const { page } = game
    await game.ready('farm')
    await watchToasts(page)
    await page.evaluate(() => {
      const h = (window as any).__home
      h.guard.fail('queue')
      h.useHome.getState().openPanel({ kind: 'queue' })
    })
    await expect.poll(() => panel(page)).toBe(null)
    await expect.poll(() => toasts(page)).toContain("That didn't open properly")
    await expect(page.locator('.farm-panel[aria-label="Buyers"]')).toHaveCount(0)
    await drawing(page)
    expect(await diagnosed(page)).toContainEqual(expect.stringContaining('"queue" failed and was closed: Error: [test] a fault in "queue"'))
    // the next panel opens, whole (the same one: drawn from fresh)
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'queue' }))
    await expect(page.locator('.farm-panel[aria-label="Buyers"]')).toBeVisible()
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    await expect.poll(() => panel(page)).toBe(null)
    expect(othersThan(game), game.errors.join('\n')).toEqual([])
  })

  test('a layer that throws (the corner menu) is left out with no word, and drawn again once what is over the game changes', async ({ game }) => {
    const { page } = game
    await game.ready('farm')
    const menu = page.locator('.top-menu-btn')
    await expect(menu).toBeVisible()
    await watchToasts(page)
    await page.evaluate(() => (window as any).__home.guard.fail('corner'))
    await expect(menu).toHaveCount(0)
    await drawing(page)
    expect(await diagnosed(page)).toContainEqual(expect.stringContaining('"corner" failed and was left out'))
    // what is over the game changes (the view): it is back, and works
    await page.evaluate(() => (window as any).__home.useHome.getState().setView('third'))
    await expect(menu).toBeVisible()
    await page.evaluate(() => (window as any).__home.useHome.getState().setView('first'))
    await menu.click()
    await expect(page.locator('.top-dial')).toBeVisible()
    await menu.click()
    await expect(page.locator('.top-dial')).toHaveCount(0)
    expect(await toasts(page)).toEqual([])
    expect(othersThan(game), game.errors.join('\n')).toEqual([])
  })
})
