/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from './helpers'

// The goals board (src/farm/goals.ts, GoalsPanel.tsx): the trophy in the chips at the top shows how many goals wait to
// be claimed and opens the board; a goal reached is green with a Claim button that pays its coins and its material, and
// the goal moves on to its next count.

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
    await game.ready()
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
    const board = page.locator('.farm-panel[aria-label="Goals"]')
    await expect(board).toBeVisible()
    const first = board.locator('.farm-goal').first()
    await expect(first).toHaveClass(/ok/)
    await expect(first).toContainText('Collect 10 eggs')
    await expect(first.locator('.farm-goal-count')).toHaveText('10/10')
    const before = await page.evaluate(() => {
      const f = (window as any).__home.farm.state
      return { coins: f.coins, inv: { ...f.inv } }
    })
    await first.getByRole('button', { name: /Claim/ }).click()
    const after = await page.evaluate(() => {
      const f = (window as any).__home.farm.state
      return { coins: f.coins, inv: { ...f.inv }, step: f.goals.eggs }
    })
    expect(after.step).toBe(1)
    expect(after.coins).toBeGreaterThan(before.coins)
    const gained = Object.keys(after.inv).filter((k) => after.inv[k] > before.inv[k])
    expect(gained.length).toBe(1)
    expect(['brick', 'plank', 'nail', 'iron', 'bolt', 'log']).toContain(gained[0])
    // the egg goal moved on to its next count, and nothing waits to be claimed
    await expect(board.locator('.farm-goal', { hasText: 'Collect 30 eggs' })).toBeVisible()
    await expect(board.locator('.farm-goal.ok')).toHaveCount(0)
    await expect(trophy.locator('b')).toHaveCount(0)
    await board.getByRole('button', { name: /Close/ }).click()
    await expect(board).toHaveCount(0)
  })

  test('on a phone held upright the board fits: every card on screen width, its Claim button 44 px high', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.setViewportSize({ width: 390, height: 844 })
    try {
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
      const width = await page.evaluate(() => window.innerWidth)
      for (const box of await board.locator('.farm-goal').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
        expect(box.left).toBeGreaterThanOrEqual(0)
        expect(box.right).toBeLessThanOrEqual(width)
      }
      const claim = board.locator('.farm-goal.ok').getByRole('button', { name: /Claim/ })
      await expect(claim).toHaveCount(1)
      // its height as laid out (the sheet slides in scaled: a box measured on the way is a little smaller)
      expect(await claim.evaluate((el) => (el as HTMLElement).offsetHeight)).toBeGreaterThanOrEqual(44)
      await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    } finally {
      await page.setViewportSize({ width: 640, height: 360 })
    }
  })
})
