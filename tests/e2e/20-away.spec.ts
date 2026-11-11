/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp, watchErrors, BASE } from './helpers'

// Welcome back (src/farm/AwayPanel.tsx): after a time away the farm has gone on for it, and a card says what happened —
// the page hidden for over two minutes (no frames while it is: the next comes that much later), or closed an hour and
// opened again. "Go there" goes to the nearest thing ready to take, as tapping it on the compass does.

const away = (page: any) => page.evaluate(() => (window as any).__home.farm.awaySummary())
const panel = (page: any) => page.evaluate(() => (window as any).__home.useHome.getState().panel?.kind ?? null)

test.describe('welcome back', () => {
  test('the page hidden for two minutes: the hens laid, the card says how many, and takes you there', async ({ game }) => {
    test.setTimeout(600_000)
    await game.ready()
    const { page } = game
    // empty nests, their clocks at 0, and an empty barn: what the hens lay while away is what the card counts
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      const s = f.state
      s.producers.hens.stock = s.producers.hens.stock.map(() => 0)
      s.producers.hens.timer = s.producers.hens.timer.map(() => 0)
      for (const k of Object.keys(s.inv)) s.inv[k] = 0
    })
    // the page hidden for two minutes: no frames while it is, so the next one comes 125 s after the last (the clock the
    // farm's frames read, moved on)
    await page.evaluate(() => {
      const now = performance.now.bind(performance)
      performance.now = () => now() + 125_000
    })
    await expect.poll(() => panel(page), { timeout: 60_000, intervals: [500] }).toBe('away')
    const r = await away(page)
    expect(r.seconds).toBeGreaterThanOrEqual(125)
    expect(r.seconds).toBeLessThan(200)
    const eggs = r.goods.find((g: any) => g.item === 'egg')?.count ?? 0
    expect(eggs).toBe(await page.evaluate(() => (window as any).__home.farm.state.producers.hens.stock.reduce((a: number, b: number) => a + b, 0)))
    expect(eggs).toBeGreaterThan(0)
    // the card: its title, the eggs with how many, how long you were away
    const card = page.locator('.farm-panel[aria-label="Welcome back"]')
    await expect(card).toBeVisible()
    await expect(card.locator('.farm-basket-item', { hasText: 'Eggs' }).locator('.qty')).toHaveText(String(eggs))
    await expect(card.locator('.farm-sub .tag')).toContainText('min away')
    // go there: the card closes, and the nest is marked, as the compass marks it
    await card.getByRole('button', { name: /Go there/ }).click()
    await expect.poll(() => panel(page), { timeout: 10_000 }).toBe(null)
    expect(await away(page)).toBe(null)
    const guide = await page.evaluate(() => (window as any).__home.useHome.getState().guide?.id ?? null)
    expect(guide).not.toBeNull()
    // a second time away, closed: nothing marked, nothing told again
    await page.evaluate(() => {
      const h = (window as any).__home
      h.useHome.getState().setGuide(null)
      // the nests emptied again (they may be full by now: a full nest lays no more, and there would be nothing to tell)
      const s = h.farm.state
      s.producers.hens.stock = s.producers.hens.stock.map(() => 0)
      s.producers.hens.timer = s.producers.hens.timer.map(() => 0)
      h.farm.cameBack(30 * 60)
    })
    await expect.poll(() => panel(page), { timeout: 10_000, intervals: [250] }).toBe('away')
    await card.getByRole('button', { name: 'Close', exact: true }).click()
    await expect.poll(() => panel(page), { timeout: 10_000 }).toBe(null)
    expect(await away(page)).toBe(null)
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().guide)).toBe(null)
  })

  test('the page closed an hour: the lettuce grew on, and the card says how many to harvest after Play @boot', async ({ browser }) => {
    test.setTimeout(900_000)
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: BASE })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    try {
      await bootApp(page)
      // a bed of lettuce, sprinklers so it never dries out; saved as if an hour ago
      const [key, saved] = await page.evaluate(() => {
        const f = (window as any).__home.farm
        f.reset()
        f.state.sprinkler = true
        const i = f.state.beds.findIndex((b: any) => b.built)
        f.plant(i, 'lettuce')
        f.water(i)
        window.dispatchEvent(new Event('pagehide'))
        const k = Object.keys(localStorage).find((x) => /^3d-home:farm:v1(:slot\d)?$/.test(x))!
        const save = JSON.parse(localStorage.getItem(k)!)
        save.time = Date.now() - 3600_000
        return [k, JSON.stringify(save)]
      })
      expect(key).toMatch(/^3d-home:farm:v1/)
      // put back as the next page starts (the page going away saves the farm as it is then)
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, saved] as [string, string])
      await page.reload()
      const play = page.locator('.intro .primary')
      await expect(play).toBeEnabled({ timeout: 300_000 })
      // nothing over the intro
      await expect(page.locator('.farm-panel[aria-label="Welcome back"]')).toHaveCount(0)
      await play.click()
      const card = page.locator('.farm-panel[aria-label="Welcome back"]')
      await expect(card).toBeVisible({ timeout: 120_000 })
      const r = await away(page)
      expect(Math.round(r.seconds / 60)).toBeGreaterThanOrEqual(59)
      expect(r.goods.some((g: any) => g.item === 'lettuce')).toBe(true)
      await expect(card.locator('.farm-sub .tag')).toContainText('1 h')
      await expect(card.locator('.farm-basket-item', { hasText: 'Lettuces' })).toBeVisible()
      expect(errors, errors.join('\n')).toEqual([])
    } finally {
      await context.close()
    }
  })
})
