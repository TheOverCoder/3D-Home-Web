/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { expect, press, test } from './helpers'

// The busy card (src/farm/Busy.tsx; update-v1/missions/01-loop-economy.md change 6, JOURNEY.md fix 9): the moment the
// farm becomes busy — every bed it owns sown, every open machine at work — a card in its own top slot says until when
// ("Busy till 21:40") with the soonest and the longest thing on their way, and goes by itself; once a visit, only with
// no card up. The corner menu says what is ready next while the farm is busy. Upright and sideways it stands in the top
// column, on the screen, clear of the compass, the chips and the menu. On the shared page.

/** The farm's machines at work for minutes (a long queue, as a save from before the queue may hold one), every bed it
 *  owns sown with cotton but the last (`all`: that one too), sprinklers on; the card free to show again this visit. */
const almostBusy = (page: Page, all = false) =>
  page.evaluate((all) => {
    const h = (window as any).__home
    const f = h.farm
    const s = f.state
    h.busy.forget()
    s.coins = 5000
    s.sprinkler = true
    for (const [id, r] of [
      ['mill', 'wheat'],
      ['loom', 'wool'],
      ['oven', 'lemon_cake'],
    ])
      s.machines[id] = { ...s.machines[id], jobs: Array(60).fill(r), done: 0, progress: 0 }
    const owned = s.beds.map((_: any, i: number) => i).filter((i: number) => f.bedStage(i) !== 'unbought')
    owned.forEach((i: number) => (s.beds[i] = { ...s.beds[i], built: true, crop: null, growth: 0, water: 0 }))
    for (const i of all ? owned : owned.slice(0, -1)) f.plant(i, 'cotton')
    f.useFarm.setState((x: any) => ({ rev: x.rev + 1 }))
    return owned[owned.length - 1] as number
  }, all)

const busyNow = (page: Page) => page.evaluate(() => (window as any).__home.busy.busy() as boolean)

test.describe('the busy card', () => {
  test('the farm turned busy: the card says until when, with the soonest and the longest, and goes by itself; once a visit; the menu says what is ready next', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    const card = page.locator('.busy-card')
    const last = await almostBusy(page)
    expect(await busyNow(page)).toBe(false)
    await page.waitForTimeout(1500)
    await expect(card).toHaveCount(0)
    // the last bed sown: busy, and the card comes
    await page.evaluate((i) => (window as any).__home.farm.plant(i, 'cotton'), last)
    expect(await busyNow(page)).toBe(true)
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card).toContainText(/^Busy till .*\d\d:\d\d/)
    await expect(card.locator('.busy-card-when')).toHaveCount(2)
    // it is a word at the top, not a card over the game: the cards that open by themselves are not counted for it
    expect(await page.evaluate(() => (window as any).__home.cards.visit().opened)).not.toContain('busy')
    // it goes by itself
    await expect(card).toHaveCount(0, { timeout: 10_000 })
    // the corner menu: what is ready next, and when (a line, not a button)
    await press(page.locator('.top-menu-btn'))
    const next = page.locator('.next-ready')
    await expect(next).toContainText(/^Next ready \d+:\d\d/)
    await expect(next.locator('button')).toHaveCount(0)
    await press(page.locator('.top-menu-btn'))
    await expect(next).toHaveCount(0)
    // busy again later in the same visit (a bed harvested and sown again): no second card
    await page.evaluate((i) => {
      const f = (window as any).__home.farm
      f.state.beds[i] = { ...f.state.beds[i], crop: null, growth: 0, water: 0 }
      f.useFarm.setState((x: any) => ({ rev: x.rev + 1 }))
    }, last)
    expect(await busyNow(page)).toBe(false)
    await page.waitForTimeout(500)
    await page.evaluate((i) => (window as any).__home.farm.plant(i, 'cotton'), last)
    expect(await busyNow(page)).toBe(true)
    await page.waitForTimeout(2500)
    await expect(card).toHaveCount(0)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('upright and sideways on a phone: in its place in the top column, on the screen, clear of the compass, the chips and the menu', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    try {
      for (const size of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(size)
        await game.teleport(-1.2, 1.4, 8.5, 0, 0)
        await almostBusy(page, true)
        await page.evaluate(() => (window as any).__home.busy.show())
        const card = page.locator('.busy-card')
        await expect(card).toBeVisible({ timeout: 10_000 })
        const b = await page.evaluate(() => {
          const box = (sel: string) =>
            Array.from(document.querySelectorAll(sel))
              .filter((e) => e.getClientRects().length > 0)
              .map((e) => ({ what: sel, ...e.getBoundingClientRect().toJSON() }))
          return { card: box('.busy-card')[0], others: [...box('.compass'), ...box('.farm-chip'), ...box('.top-menu-btn'), ...box('.xp-bar')] }
        })
        const where = `${size.width}×${size.height}`
        expect(b.card.left, where).toBeGreaterThanOrEqual(0)
        expect(b.card.right, where).toBeLessThanOrEqual(size.width)
        expect(b.card.top, where).toBeGreaterThanOrEqual(0)
        expect(b.card.bottom, where).toBeLessThanOrEqual(size.height)
        for (const o of b.others) {
          const apart = b.card.right <= o.left + 1 || o.right <= b.card.left + 1 || b.card.bottom <= o.top + 1 || o.bottom <= b.card.top + 1
          expect(apart, `${where}: the busy card over ${o.what}`).toBe(true)
        }
        await expect(card).toHaveCount(0, { timeout: 10_000 })
      }
    } finally {
      await page.setViewportSize({ width: 640, height: 360 })
    }
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
