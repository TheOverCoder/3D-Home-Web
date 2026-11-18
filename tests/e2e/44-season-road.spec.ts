/* eslint-disable @typescript-eslint/no-explicit-any */
import { roadEnd, roadOf } from '../../src/farm/seasonRoad'
import { test, expect, type Game } from './helpers'

// The season road (src/farm/seasonRoad.ts, src/farm/state/seasonRoad.ts; the farm news's "This season" tab,
// src/farm/news/NewsCard.tsx): ten stops a season fed by the XP the farm earns, each coming in by itself with a toast,
// the last the season's garment; the tab shows the season, the stops given, how far the next is, and once done when
// the next season's road opens (in days of play: it waits). Quiet in the other specs (`ready()`); fed here as in play.
// Upright and sideways, the tabs are on screen and 44 px or more.

const CARD = '.farm-panel[aria-label="Farm news"]'

/** A new farm whose year has begun (its first steps over), the road fed as in play. */
async function fresh(game: Game) {
  await game.ready('farm')
  await game.teleport(-1.2, 1.4, 8.5, 0, 0)
  await game.page.evaluate(() => {
    const h = (window as any).__home
    h.farm.reset()
    h.farm.state.season = { from: 1, told: 0 }
    h.road.quiet(false)
    h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })
}

/** XP from play, `xp` of it at least (a goal's worth at a time). */
const play = (game: Game, xp: number) =>
  game.page.evaluate((xp) => {
    const f = (window as any).__home.farm
    let left = xp
    while (left > 0) left -= f.gainXp('goal') || 1
  }, xp)

const road = (game: Game) => game.page.evaluate(() => ({ ...(window as any).__home.road.record() }))

/** Waits until the sheet's page has come in (no transform left on it, nor any of its blocks). */
const settled = (card: import('@playwright/test').Locator, sel: string) =>
  expect
    .poll(() => card.locator(sel).evaluateAll((els) => els.every((el) => ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(el).transform) && getComputedStyle(el).opacity === '1')), {
      timeout: 10_000,
    })
    .toBe(true)

async function openSeason(game: Game) {
  await game.page.locator('.top-menu-btn').click()
  await game.page.locator('.top-dial-btn.news-open').click()
  const card = game.page.locator(CARD)
  await expect(card).toBeVisible()
  await card.getByRole('tab', { name: 'This season' }).click()
  await expect(card.locator('.nw-road')).toBeVisible()
  // (the tab's page in, its road no longer see-through: it is shown)
  await settled(card, '.nw-body, .nw-road')
  return card
}

test.describe('the season road', () => {
  test('fed by XP: each stop comes in by itself with a toast; the tab shows it; the last stop the season’s garment, then the next season’s road waits', async ({ game }) => {
    await fresh(game)
    const { page } = game
    try {
      let card = await openSeason(game)
      await expect(card.locator('.nw-road-words b')).toHaveText('Spring')
      await expect(card.locator('.sr-stop')).toHaveCount(10)
      await expect(card.locator('.sr-stop.got')).toHaveCount(0)
      await expect(card.locator('.nw-road-line')).toHaveText(`${roadOf(0)[0]} XP to stop 1.`)
      await card.getByRole('button', { name: 'Close (Esc)' }).click()
      await expect(card).toHaveCount(0)

      // the first stop: by itself, with a toast
      const coins = await page.evaluate(() => (window as any).__home.farm.state.coins)
      await play(game, roadOf(0)[0])
      await expect(page.locator('.toast')).toContainText('Season road, stop 1')
      expect(await road(game)).toMatchObject({ on: 0, paid: 1 })
      expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBeGreaterThan(coins)
      card = await openSeason(game)
      await expect(card.locator('.sr-stop.got')).toHaveCount(1)
      await expect(card.locator('.sr-stop.next')).toHaveCount(1)
      await card.getByRole('button', { name: 'Close (Esc)' }).click()

      // the rest of the road: the last stop gives the season's garment; done, it waits for summer's
      await play(game, roadEnd(0))
      await expect(page.locator('.toast')).toContainText('Spring’s road done')
      expect(await road(game)).toMatchObject({ on: 0, paid: 10 })
      expect(await page.evaluate(() => (window as any).__home.farm.state.outfit.owned)).toContain('shirt-blossom')
      card = await openSeason(game)
      await expect(card.locator('.sr-stop.got')).toHaveCount(10)
      await expect(card.locator('.nw-road-line')).toHaveText(/^Road done\. Summer’s road opens in \d+ days? of play\.$/)
      await card.getByRole('button', { name: 'Close (Esc)' }).click()
      await expect(card).toHaveCount(0)
    } finally {
      await page.evaluate(() => (window as any).__home.road.quiet(true))
    }
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('upright and sideways: the tabs and the close on screen, each 44 px or more; the road fits', async ({ game }) => {
    const { page } = game
    try {
      for (const size of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(size)
        await game.ready('farm')
        await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'news' }))
        const card = page.locator(CARD)
        await expect(card).toBeVisible()
        await expect.poll(() => card.evaluate((el) => getComputedStyle(el).transform), { timeout: 10_000 }).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
        await card.getByRole('tab', { name: 'This season' }).click()
        await expect(card.locator('.nw-road')).toBeVisible()
        await settled(card, '.nw-body, .nw-road')
        const boxes = await card
          .locator('[role="tab"], [aria-label="Close (Esc)"], .sr-road')
          .evaluateAll((els) =>
            els.map((e) => ({ name: e.getAttribute('aria-label') ?? e.textContent, ...e.getBoundingClientRect().toJSON(), w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight })),
          )
        expect(boxes.length).toBe(4)
        for (const b of boxes) {
          const where = `${b.name} at ${size.width}×${size.height}`
          expect(b.left, where).toBeGreaterThanOrEqual(0)
          expect(b.right, where).toBeLessThanOrEqual(size.width)
          expect(b.top, where).toBeGreaterThanOrEqual(0)
          expect(b.bottom, where).toBeLessThanOrEqual(size.height)
          expect(Math.min(b.w, b.h), where).toBeGreaterThanOrEqual(44)
        }
        await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
        await expect(card).toHaveCount(0)
      }
    } finally {
      await page.setViewportSize({ width: 640, height: 360 })
    }
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
