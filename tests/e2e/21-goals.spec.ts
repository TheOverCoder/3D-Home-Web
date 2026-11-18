/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from './helpers'

// The goals board (src/farm/goals.ts; its look src/farm/GoalsCard.tsx, the medal case): the trophy in the chips at the
// top shows how many goals wait to be claimed and opens the board; the goal reached is the big medal in the middle with
// a Claim that pays its coins and its material, and the goal moves on to its next count, staying in the hand with what
// of it is already there.

const fresh = (page: any) =>
  page.evaluate(() => {
    const h = (window as any).__home
    const f = h.farm.state
    for (const k of Object.keys(f.goals)) f.goals[k] = 0
    for (const k of Object.keys(f.got)) f.got[k] = 0
    f.stats.sold = f.stats.earned = f.stats.sent = 0
    h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })

test.describe('the goals board', () => {
  test('the trophy counts the goals reached; the board shows them first, and Claim pays and moves the goal on', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    // outdoors, where the chips at the top are
    await game.teleport(-1.2, 1.4, 8.5, 0, 0)
    await fresh(page)
    const trophy = page.locator('.farm-chip-item.goals')
    await expect(trophy).toBeVisible({ timeout: 30_000 })
    await expect(trophy.locator('b')).toHaveCount(0)
    // ten eggs collected: the first egg goal is reached, and the trophy says so (and the toast)
    await page.evaluate(() => {
      const h = (window as any).__home
      h.farm.state.got.egg = 10
      h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    })
    await expect(trophy.locator('b')).toHaveText('1')
    await expect(page.locator('.toast')).toContainText('Goal reached: Collect 10 eggs')
    await trophy.click()
    await page.locator('.top-pop-open').click()
    const board = page.locator('.farm-panel[aria-label="Goals"]')
    await expect(board).toBeVisible()
    // the one reached is the big medal in the middle, and its small medal in the case is marked (what to do about it:
    // the block in place, not one going out as another comes in)
    const hero = board.locator('.gc-info:not(.leaving)')
    await expect(hero).toHaveClass(/done/)
    await expect(hero.locator('h3')).toHaveText('Collect 10 eggs')
    await expect(hero.locator('.gc-say')).toHaveText('Reached!')
    await expect(board.locator('.gc-thumb.done')).toHaveCount(1)
    await expect(board.locator('.gc-thumb[aria-selected="true"]')).toHaveAttribute('aria-label', 'Collect 10 eggs, reached')
    const before = await page.evaluate(() => {
      const f = (window as any).__home.farm.state
      return { coins: f.coins, inv: { ...f.inv } }
    })
    await board.getByRole('button', { name: /Claim/ }).click()
    const after = await page.evaluate(() => {
      const f = (window as any).__home.farm.state
      return { coins: f.coins, inv: { ...f.inv }, step: f.goals.eggs }
    })
    expect(after.step).toBe(1)
    expect(after.coins).toBeGreaterThan(before.coins)
    const gained = Object.keys(after.inv).filter((k) => after.inv[k] > before.inv[k])
    expect(gained.length).toBe(1)
    expect(['brick', 'plank', 'nail', 'iron', 'bolt', 'log']).toContain(gained[0])
    // the egg goal stays in the hand on its next count, a third of it already there; nothing waits to be claimed
    await expect(hero.locator('h3')).toHaveText('Collect 30 eggs')
    await expect(hero.locator('.gc-say')).toHaveText('33% there already!')
    await expect(hero.locator('.gc-count')).toHaveText('10/30')
    await expect(hero).not.toHaveClass(/done/)
    await expect(board.locator('.gc-thumb.done')).toHaveCount(0)
    await expect(board.locator('.gc-won')).toHaveText('1')
    await expect(trophy.locator('b')).toHaveCount(0)
    // another medal of the case touched comes to the middle
    const other = board.locator('.gc-thumb[aria-selected="false"]').first()
    const words = (await other.getAttribute('aria-label'))!.split(',')[0]
    await other.click()
    await expect(hero.locator('h3')).toHaveText(words)
    await board.getByRole('button', { name: /Close/ }).click()
    await expect(board).toHaveCount(0)
  })

  test('on a phone upright and sideways the board fits: the Claim, the close and every medal of the case on screen, each 44 px or more', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    try {
      for (const size of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(size)
        await game.teleport(-1.2, 1.4, 8.5, 0, 0)
        await fresh(page)
        await page.evaluate(() => {
          const h = (window as any).__home
          h.farm.state.got.milk = 5
          h.farm.state.got.lettuce = 7
          h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
          h.useHome.getState().openPanel({ kind: 'goals' })
        })
        const board = page.locator('.farm-panel[aria-label="Goals"]')
        await expect(board).toBeVisible()
        await expect(board.locator('.gc-thumb')).toHaveCount(6)
        const claim = board.getByRole('button', { name: /Claim/ })
        await expect(claim).toHaveCount(1)
        // measured once the sheet has slid in (it comes from below upright, from the right sideways)
        await expect.poll(() => board.evaluate((el) => getComputedStyle(el).transform), { timeout: 10_000 }).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/)
        const boxes = await board
          .locator('.gc-thumb, .gc-claim, [aria-label="Close (Esc)"]')
          .evaluateAll((els) => els.map((e) => ({ name: e.getAttribute('aria-label'), ...e.getBoundingClientRect().toJSON(), w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight })))
        expect(boxes.length).toBe(8)
        for (const b of boxes) {
          const where = `${b.name} at ${size.width}×${size.height}`
          expect(b.left, where).toBeGreaterThanOrEqual(0)
          expect(b.right, where).toBeLessThanOrEqual(size.width)
          expect(b.top, where).toBeGreaterThanOrEqual(0)
          expect(b.bottom, where).toBeLessThanOrEqual(size.height)
          expect(Math.min(b.w, b.h), where).toBeGreaterThanOrEqual(44)
        }
        await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
        await expect(board).toHaveCount(0)
      }
    } finally {
      await page.setViewportSize({ width: 640, height: 360 })
    }
  })
})
