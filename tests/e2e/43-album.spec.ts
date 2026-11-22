/* eslint-disable @typescript-eslint/no-explicit-any */
import { ITEMS } from '../../src/farm/data'
import { test, expect, type Game } from './helpers'
import { ALBUM } from '../../src/farm/album'

// The farm album (src/farm/album.ts; its look src/farm/AlbumCard.tsx, opened by AlbumPanel.tsx from the corner menu): it
// opens on its contents — the long ladders and every page as a row, the garment each gives a silhouette until it is
// done — and a page shows its tiles, each still to earn a silhouette that says how. A page finished by play gives its
// garment by itself, once, with a toast (no tap to claim, no badge); opened again, its tiles earned since are new once.
// Upright and sideways, everything to touch is on screen and 44 px or more.

const CARD = '.farm-panel[aria-label="Album"]'

/** A new farm on the farm, outdoors where the menu is. */
async function fresh(game: Game) {
  await game.ready('farm')
  await game.teleport(-1.2, 1.4, 8.5, 0, 0)
  await game.page.evaluate(() => {
    const h = (window as any).__home
    h.farm.reset()
    h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })
}

/** Opens the album from the corner menu (its line after the farm news). */
async function openAlbum(game: Game) {
  await game.page.locator('.top-menu-btn').click()
  const dial = game.page.locator('.top-dial-btn')
  const names = await dial.evaluateAll((els) => els.map((el) => [...el.classList].find((c) => c !== 'top-dial-btn')))
  expect(names.indexOf('album-open')).toBe(names.indexOf('news-open') + 1)
  await game.page.locator('.top-dial-btn.album-open').click()
  await expect(game.page.locator(CARD)).toBeVisible()
}

/** Waits until the sheet's page has come in: it is there, with no transform left on it, nor any of its blocks. */
const settled = (card: import('@playwright/test').Locator, sel: string) =>
  expect
    .poll(
      () =>
        card
          .locator(sel)
          .evaluateAll((els) => els.length > 0 && els.every((el) => ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(el).transform) && getComputedStyle(el).opacity === '1')),
      {
        timeout: 10_000,
      },
    )
    .toBe(true)

const closeAlbum = async (game: Game) => {
  await game.page.locator(CARD).getByRole('button', { name: 'Close (Esc)' }).click()
  await expect(game.page.locator(CARD)).toHaveCount(0)
}

test.describe('the farm album', () => {
  test('its contents and a page of silhouettes; a page finished by play gives its garment by itself, once, with a toast; its tiles new once', async ({ game }) => {
    await fresh(game)
    const { page } = game
    await openAlbum(game)
    const card = page.locator(CARD)
    await expect(card.locator('.al-ladder')).toHaveCount(3)
    // a row a page, as many as the album has (src/farm/album.ts: a new page is a row there)
    await expect(card.locator('.al-row')).toHaveCount(ALBUM.length)
    await expect(card.locator('.al-row.done')).toHaveCount(0)
    // a page: its tiles, each a silhouette to earn; one touched says how
    await card.getByRole('button', { name: /^Building materials: 0 of 6$/ }).click()
    await expect(card.locator('.al-tile')).toHaveCount(ITEMS.length)
    await expect(card.locator('.al-tile.todo')).toHaveCount(ITEMS.length)
    await expect(card.locator('.al-line')).toHaveText('6 to go: then a timber cap for your wardrobe.')
    await card.locator('.al-tile').first().click()
    await expect(card.locator('.al-line')).toHaveText('Brick: Comes as a surprise.')
    await card.getByRole('button', { name: 'Back' }).click()
    // a row a page, as many as the album has (src/farm/album.ts: a new page is a row there)
    await expect(card.locator('.al-row')).toHaveCount(ALBUM.length)
    await closeAlbum(game)

    // every material found (as surprises bring them): the page is done, its garment comes by itself, once, with a toast
    await page.evaluate((items) => {
      const h = (window as any).__home
      for (const id of items) h.farm.state.got[id] = 1
      h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    }, ITEMS)
    await expect(page.locator('.toast')).toContainText('Album: Building materials done · a timber cap for your wardrobe', { timeout: 20_000 })
    const after = () => page.evaluate(() => ({ owned: [...(window as any).__home.farm.state.outfit.owned], done: [...(window as any).__home.farm.state.album.done] }))
    expect(await after()).toEqual({ owned: ['cap-timber'], done: ['materials'] })
    await page.waitForTimeout(4000)
    expect(await after(), 'once').toEqual({ owned: ['cap-timber'], done: ['materials'] })

    // opened again: the page done, its tiles new (once), its garment no longer a silhouette
    await openAlbum(game)
    await expect(card.locator('.al-row.done')).toHaveCount(1)
    await card.getByRole('button', { name: /^Building materials: 6 of 6, done$/ }).click()
    await expect(card.locator('.al-tile.new')).toHaveCount(ITEMS.length)
    await expect(card.locator('.al-badge')).toHaveCount(ITEMS.length)
    await expect(card.locator('.al-garment.shade')).toHaveCount(0)
    await expect(card.locator('.al-line')).toHaveText('Done: the timber cap is in your wardrobe.')
    await closeAlbum(game)
    await openAlbum(game)
    await card.getByRole('button', { name: /^Building materials: 6 of 6, done$/ }).click()
    await expect(card.locator('.al-tile.new')).toHaveCount(0)
    await closeAlbum(game)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('upright and sideways: its rows, its tiles and its close on screen, each 44 px or more', async ({ game }) => {
    const { page } = game
    try {
      for (const size of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(size)
        await fresh(game)
        await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'album' }))
        const card = page.locator(CARD)
        await expect(card).toBeVisible()
        // measured once the sheet has slid in (it comes from below upright, from the right sideways)
        await expect.poll(() => card.evaluate((el) => getComputedStyle(el).transform), { timeout: 10_000 }).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
        const fits = async (sel: string, scroll: boolean) => {
          const els = card.locator(sel)
          const n = await els.count()
          expect(n, sel).toBeGreaterThan(0)
          for (let k = 0; k < n; k++) {
            const el = els.nth(k)
            if (scroll) await el.scrollIntoViewIfNeeded()
            const b = await el.evaluate((e) => ({ ...e.getBoundingClientRect().toJSON(), w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight, name: e.getAttribute('aria-label') }))
            const where = `${b.name} at ${size.width}×${size.height}`
            expect(b.left, where).toBeGreaterThanOrEqual(0)
            // (a part of a pixel past the edge is where a list scrolled to its end stops)
            expect(b.right, where).toBeLessThanOrEqual(size.width + 1)
            expect(b.top, where).toBeGreaterThanOrEqual(-1)
            expect(b.bottom, where).toBeLessThanOrEqual(size.height + 1)
            expect(Math.min(b.w, b.h), where).toBeGreaterThanOrEqual(44)
          }
        }
        await settled(card, '.al-contents, .al-pages > li')
        await fits('[aria-label="Close (Esc)"]', false)
        await fits('.al-row', true)
        await card.locator('.al-row').first().click()
        await settled(card, '.al-page, .al-tiles > li')
        await fits('.al-tile', true)
        await fits('[aria-label="Back"]', false)
        await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
        await expect(card).toHaveCount(0)
      }
    } finally {
      await page.setViewportSize({ width: 640, height: 360 })
    }
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
