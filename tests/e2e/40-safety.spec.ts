/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { expect, test, type Game } from './helpers'

// A part of the interface that throws never takes the game down (src/ui/PanelGuard.tsx, update-v1 mission 08 c6): a
// panel closes, a toast says "That didn't open properly", the farm draws on, the error is in Copy diagnostics, and the
// next panel opens; a layer of the screen (the corner menu) is left out, and drawn again once what is over the game
// changes. The faults are armed through the debug hook (`__home.guard.fail(name)`): the next time the guard of that
// name draws, a part inside it throws, as a part with a bug would. And the cards that open by themselves come through
// one queue (src/ui/cardQueue.ts): one at a time, in its order, two a visit at most, the rest waiting where they live;
// one that throws closes like any panel and is not opened again in the visit. On the shared page; the errors the
// faults make on purpose are taken out of its list, the rest must be none.

const panel = (page: Page) => page.evaluate(() => (window as any).__home.useHome.getState().panel?.kind ?? null)
/** This visit of the card queue (`__home.cards`, ?debug): the cards opened by themselves in it, and those it let pass. */
const visit = (page: Page) => page.evaluate(() => (window as any).__home.cards.visit() as { opened: string[]; passed: string[]; stepsEnded: boolean })
const opened = async (page: Page) => (await visit(page)).opened

/** The hens' nests and the barn emptied, then the farm away half an hour: what they lay is a welcome back to tell (a
 *  return of AWAY_TELLS or more with news: a new visit). `daily`: the day's gift let out of the way in the same call,
 *  so both are due as the visit begins. */
const away = (page: Page, { daily = false } = {}) =>
  page.evaluate((daily) => {
    const f = (window as any).__home.farm
    const s = f.state
    s.producers.hens.stock = s.producers.hens.stock.map(() => 0)
    s.producers.hens.timer = s.producers.hens.timer.map(() => 0)
    for (const k of Object.keys(s.inv)) s.inv[k] = 0
    if (daily) f.daily.quiet(false)
    f.cameBack(30 * 60)
  }, daily)

/** XP from play up to `to` (each gain a sale's: the level's show follows, as from a sale). */
const reach = (page: Page, to: number) =>
  page.evaluate((to) => {
    const f = (window as any).__home.farm
    for (let i = 0; i < 500 && f.xpNow().level < to; i++) f.gainXp('sale', 10)
  }, to)
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

  test('the cards that open by themselves: one at a time, the welcome back first and the day’s gift after it, two a visit; past them a level’s reveal is let go, and the next visit’s comes', async ({
    game,
  }) => {
    test.setTimeout(400_000)
    const { page } = game
    await game.ready('farm')
    // a new farm with its locks on, begun (a bed of lettuce: the day's gift waits for a farm that has begun)
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.unlocks.all(false)
      f.state.coins = 500
      f.plant(
        f.state.beds.findIndex((b: any) => b.built && !b.crop),
        'lettuce',
      )
    })
    await expect(page.locator('.top-road .xp-star b')).toHaveText('1')
    // back after half an hour, the day's gift due too: the welcome back first, alone
    await away(page, { daily: true })
    await expect.poll(() => panel(page), { timeout: 30_000 }).toBe('away')
    expect(await opened(page)).toEqual(['away'])
    const welcome = page.locator('.farm-panel[aria-label="Welcome back"]')
    await welcome.getByRole('button', { name: 'Close', exact: true }).click()
    // the day's gift after it, by itself; two cards this visit
    await expect.poll(() => panel(page), { timeout: 30_000 }).toBe('daily')
    expect(await opened(page)).toEqual(['away', 'daily'])
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    await expect.poll(() => panel(page)).toBe(null)

    // level 2 reached in the same visit: its show, but its reveal is let go (the budget is spent); it never comes later
    await reach(page, 2)
    await expect(page.locator('.level-up-show')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.level-up-show')).toHaveCount(0, { timeout: 30_000 })
    await expect.poll(() => visit(page), { timeout: 30_000 }).toMatchObject({ opened: ['away', 'daily'], passed: ['unlocked'] })
    await expect(page.locator('.unlocked')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__home.cards.free())).toBe(true)

    // the next visit: the welcome back again (the day's gift opened by itself today already), then level 3's reveal
    await away(page)
    await expect.poll(() => panel(page), { timeout: 30_000 }).toBe('away')
    await welcome.getByRole('button', { name: 'Close', exact: true }).click()
    await expect.poll(() => panel(page)).toBe(null)
    await reach(page, 3)
    await expect(page.locator('.unlocked')).toBeAttached({ timeout: 60_000 })
    await expect(page.locator('.unlocked')).toHaveAttribute('aria-label', /^Unlocked at level 3: /)
    expect(await opened(page)).toEqual(['away', 'unlocked'])
    expect(await page.evaluate(() => (window as any).__home.cards.showing())).toBe('unlocked')
    await page.locator('.unlocked').click({ position: { x: 20, y: 200 } })
    await expect(page.locator('.unlocked')).toHaveCount(0, { timeout: 10_000 })
    await expect.poll(() => page.evaluate(() => (window as any).__home.cards.showing())).toBe(null)
    await page.evaluate(() => (window as any).__home.farm.daily.quiet(true))
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('a card that opens by itself and throws closes with a word, is not opened again in the visit, and holds nothing back', async ({ game }) => {
    const { page } = game
    await game.ready('farm')
    await watchToasts(page)
    await page.evaluate(() => (window as any).__home.guard.fail('away'))
    await away(page)
    await expect.poll(() => toasts(page), { timeout: 30_000 }).toContain("That didn't open properly")
    await expect.poll(() => panel(page)).toBe(null)
    // still due (its report waits), looked at again and let pass: not opened again this visit
    await expect.poll(() => visit(page), { timeout: 30_000 }).toMatchObject({ opened: ['away'], passed: ['away'] })
    expect(await panel(page)).toBe(null)
    // the welcome back holds nothing back now: the game is free
    expect(await page.evaluate(() => (window as any).__home.cards.free())).toBe(true)
    await drawing(page)
    // opened by hand it is whole, and Close tells it
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'away' }))
    const welcome = page.locator('.farm-panel[aria-label="Welcome back"]')
    await welcome.getByRole('button', { name: 'Close', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__home.farm.awaySummary())).toBe(null)
    expect(othersThan(game), game.errors.join('\n')).toEqual([])
  })

  test("afterwards: today's farm, everything open", async ({ game }) => {
    await game.ready('farm')
    await game.page.evaluate(() => (window as any).__home.farm.reset())
    await game.ready()
  })
})
