/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, type Game } from './helpers'
import { xpAt } from '../../src/farm/xp'

// The wardrobe (src/home/Wardrobe.tsx, WardrobePanel.tsx; its garments src/farm/outfit.ts): the bedroom's opens with the
// action button; you turn round and the camera films you from in front while its sheet is open, and goes back to your
// eyes after (from third person too, back to third person). Level 1 has two of each; a tap puts one on, kept in the
// save. A level that brings a garment shows it after the level's show, and the wardrobe has it, marked new once.

/** In front of the bedroom's wardrobe (5.8, 0.45 in src/home/layout.ts; its doors face +z), looking at it. */
const FRONT = { x: 5.8, z: 1.75 }

const fresh = (game: Game) =>
  game.page.evaluate(() => {
    const h = (window as any).__home
    h.farm.setRandom(null)
    h.farm.reset()
    h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })

/** The camera, your eyes and body, and where the camera looks. */
const view = (page: Page) =>
  page.evaluate(() => {
    const h = (window as any).__home
    const c = h.camera
    const d = new c.position.constructor()
    c.getWorldDirection(d)
    const p = h.playerState?.position ?? h.physics?.player?.position
    return { cam: { x: c.position.x, y: c.position.y, z: c.position.z }, dir: { x: d.x, y: d.y, z: d.z }, body: p ? { x: p.x, y: p.y, z: p.z } : null, view: h.useHome.getState().view }
  })

async function openIt(game: Game) {
  await game.teleport(FRONT.x, 1.4, FRONT.z, 0, -0.1)
  await expect.poll(() => game.page.evaluate(() => (window as any).__home.useHome.getState().nearby?.label), { message: 'the wardrobe offered' }).toBe('Open the wardrobe')
  expect(await game.page.evaluate(() => (window as any).__home.useHome.getState().nearby?.icon?.verb)).toBe('dress')
  await game.page.keyboard.press('e')
  await expect(game.page.locator('.farm-panel.wardrobe')).toBeVisible()
}

/** The camera has left your eyes and stands in front of you, you turned round, looking at you. */
async function filmed(page: Page) {
  await page.waitForFunction(() => (window as any).__home.dressView?.settled === true, null, { timeout: 30_000, polling: 100 })
  const v = await view(page)
  // a metre and more from you, on the side away from the wardrobe (you turned round), looking back at you
  expect(v.cam.z).toBeGreaterThan(FRONT.z + 0.9)
  const to = { x: FRONT.x - v.cam.x, z: FRONT.z - v.cam.z }
  const n = Math.hypot(to.x, to.z)
  expect((to.x * v.dir.x + to.z * v.dir.z) / n).toBeGreaterThan(0.9)
}

test.describe('the wardrobe', () => {
  test('opens with the action button; the camera films you from in front, and goes back to your eyes as it closes', async ({ game }) => {
    await game.ready()
    const { page } = game
    await fresh(game)
    await openIt(game)
    await filmed(page)
    // closed: back to your eyes
    await page.locator('.farm-panel.wardrobe .close').click()
    await expect(page.locator('.farm-panel.wardrobe')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => (window as any).__home.dressView.blend), { timeout: 20_000 }).toBe(0)
    const v = await view(page)
    expect(Math.hypot(v.cam.x - FRONT.x, v.cam.z - FRONT.z)).toBeLessThan(0.4)
    // from third person (pressed as the button presses it: what is offered there is what is in reach): first person while
    // it is open, third again as it closes
    await game.teleport(FRONT.x, 1.4, FRONT.z, 0, -0.1)
    await page.evaluate(() => (window as any).__home.useHome.getState().setView('third'))
    await page.waitForTimeout(300)
    await page.evaluate(() =>
      (window as any).__home
        .interactables()
        .find((d: any) => d.id.startsWith('wardrobe-'))
        .run(),
    )
    await expect(page.locator('.farm-panel.wardrobe')).toBeVisible()
    expect((await view(page)).view).toBe('first')
    await filmed(page)
    await page.keyboard.press('Escape')
    await expect(page.locator('.farm-panel.wardrobe')).toHaveCount(0)
    expect((await view(page)).view).toBe('third')
    await page.evaluate(() => (window as any).__home.useHome.getState().setView('first'))
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('level 1: two shirts, two trousers, two hats; a tap puts one on, and it is saved', async ({ game }) => {
    await game.ready()
    const { page } = game
    await fresh(game)
    await openIt(game)
    const sheet = page.locator('.farm-panel.wardrobe')
    const tab = (word: string) => sheet.getByRole('tab', { name: word })
    const items = sheet.locator('.wardrobe-item:not(.none)')
    await expect(items).toHaveCount(2)
    await tab('Trousers').click()
    await expect(items).toHaveCount(2)
    await tab('Hats').click()
    await expect(items).toHaveCount(2)
    // no hat yet: the "No hat" tile is the one worn
    await expect(sheet.getByRole('button', { name: 'No hat' })).toHaveAttribute('aria-pressed', 'true')
    await sheet.getByRole('button', { name: 'Navy cap' }).click()
    await expect(sheet.getByRole('button', { name: 'Navy cap' })).toHaveAttribute('aria-pressed', 'true')
    await tab('Shirts').click()
    await sheet.getByRole('button', { name: 'Rust shirt' }).click()
    await expect(sheet.locator('.farm-sub')).toContainText('Rust shirt')
    const saved = await page.evaluate(() => {
      const h = (window as any).__home
      h.farm.saveFarm()
      const raw = JSON.parse(localStorage.getItem('3d-home:farm:v1') ?? '{}')
      return { now: h.farm.state.outfit, saved: raw.outfit }
    })
    expect(saved.now).toMatchObject({ shirt: 'shirt-rust', trousers: 'trousers-charcoal', hat: 'cap-navy' })
    expect(saved.saved).toMatchObject({ shirt: 'shirt-rust', hat: 'cap-navy' })
    // the hat off again
    await tab('Hats').click()
    await sheet.getByRole('button', { name: 'No hat' }).click()
    expect(await page.evaluate(() => (window as any).__home.farm.state.outfit.hat)).toBeNull()
    await page.keyboard.press('Escape')
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('a level that brings a garment: shown after the level, then in the wardrobe marked new — once', async ({ game }) => {
    await game.ready()
    const { page } = game
    await fresh(game)
    // just short of level 5 (its garment: the cobalt shirt), outdoors where the level chip is
    await game.teleport(-1.2, 1.4, 8.5, 0, 0)
    await page.evaluate(
      (points) => {
        const h = (window as any).__home
        h.farm.state.xp.points = points
        h.farm.state.xp.paid = 4
        h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
      },
      xpAt(5) - 2,
    )
    await page.waitForTimeout(500)
    // what was shown, watched in the page as it happens (the shows are seconds long)
    await page.evaluate(() => {
      const seen: string[] = []
      const w = window as any
      w.__shows = seen
      const look = () => {
        const l = document.querySelector('.level-up-show') ? 'level' : document.querySelector('.garment-show') ? `garment:${document.querySelector('.garment-show b')?.textContent}` : ''
        if (l && seen[seen.length - 1] !== l) seen.push(l)
        if (seen.length < 2 || !seen[seen.length - 1].startsWith('garment')) requestAnimationFrame(look)
      }
      look()
      w.__home.farm.gainXp('build', 1)
    })
    await expect.poll(() => page.evaluate(() => (window as any).__shows), { timeout: 30_000 }).toEqual(['level', 'garment:Cobalt shirt'])
    // in the wardrobe now, marked new (and its tab)
    await openIt(game)
    const sheet = page.locator('.farm-panel.wardrobe')
    await expect(sheet.getByRole('button', { name: 'Cobalt shirt' }).locator('.wardrobe-new')).toBeVisible()
    await expect(sheet.getByRole('tab', { name: 'Shirts' }).locator('.wardrobe-new-dot')).toBeVisible()
    await expect(sheet.locator('.wardrobe-next')).toContainText('level 10')
    await page.keyboard.press('Escape')
    // seen: not new the next time
    await openIt(game)
    await expect(sheet.getByRole('button', { name: 'Cobalt shirt' })).toBeVisible()
    await expect(sheet.locator('.wardrobe-new')).toHaveCount(0)
    await page.keyboard.press('Escape')
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
