/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// The silo and the barn: what is in them, how full, made bigger with building materials. Time is fast-forwarded with
// __home.farm.tick.

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
const state = (game: Game) => game.page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.farm.state, (k, v) => (k === 'visitors' ? undefined : v))))
const reset = (game: Game, inv: Record<string, number> = {}, coins = 200) =>
  game.page.evaluate(
    ([inv, coins]) => {
      const f = (window as any).__home.farm
      f.reset()
      f.tick(0.01)
      Object.assign(f.state.inv, inv)
      f.state.coins = coins
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    },
    [inv, coins] as const,
  )

test.describe('the silo and the barn', () => {
  test('the chips at the top show how full the silo and the barn are; a tap opens what is inside', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, { lettuce: 12, lemon: 3, egg: 7, brick: 1 })
    await game.teleport(-1.2, 1.4, 8.0, Math.PI, -0.1)
    await expect(page.locator('.farm-chip-item.store.silo')).toContainText('15/50')
    await expect(page.locator('.farm-chip-item.store.barn')).toContainText('8/50')
    await page.locator('.farm-chip-item.store.silo').click()
    await until(game, () => (window as any).__home.useHome.getState().panel?.store === 'silo')
    await expect(page.locator('.farm-panel .farm-basket-item')).toHaveCount(2)
    await expect(page.locator('.farm-panel .farm-basket-item .qty')).toHaveText(['12', '3'])
    // its next level: iron, bolts and logs, one of each; none here, so no upgrade
    await expect(page.locator('.farm-panel .farm-need')).toHaveCount(3)
    await expect(page.locator('.farm-panel .farm-upgrade-go')).toBeDisabled()
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
  })

  test('a harvest the silo has no room for waits in its bed: a status says so, and the full silo is on the compass', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, { wheat: 48 })
    // the first bed ripe, the others growing (nothing else to do there), the lemon tree picked
    await page.evaluate(() => {
      const f = (window as any).__home.farm.state
      f.beds.forEach((b: any, i: number) => {
        if (i < 4) Object.assign(b, { built: true, crop: 'lettuce', growth: i === 0 ? 1e6 : 1, water: 20 })
      })
      f.producers.tree.stock[0] = 0
    })
    // beside the first bed, looking at it
    await game.teleport(-1.2, 1.4, 9.0, Math.PI / 2, -0.7)
    await until(game, () => (window as any).__home.useHome.getState().status?.icon?.full === 'silo')
    const s = await game.state()
    expect(s.nearby).toBe(null)
    expect(s.status.label).toMatch(/^No room in the silo · 4 lettuces waiting/)
    await expect(page.locator('.prompt.status .prompt-full')).toContainText('48/50')
    // the button does nothing: the lettuces stay in their bed
    await page.keyboard.press('KeyE')
    await page.waitForTimeout(300)
    expect((await state(game)).inv.lettuce).toBe(0)
    // the silo needs you: a red mark on the compass, with how many wait (the lettuces, and any lemon grown meanwhile)
    await until(game, () => (window as any).__home.useHome.getState().compass.some((m: any) => m.item === 'silo' && m.alert && m.count >= 4))
    await expect(page.locator('.compass-mark.alert')).toHaveCount(1)
    // room again: the harvest is on the button
    await page.evaluate(() => ((window as any).__home.farm.state.inv.wheat = 40))
    await nearbyIs(game, 'farm-bed-0')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.inv.lettuce === 4)
  })

  test('the barn is made bigger with a brick, a plank and a nail, from its panel, through a card that asks first', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, { brick: 1, plank: 1, nail: 1 })
    // at the barn's doors, in the west yard
    await game.teleport(-8.2, 1.4, -5.4, Math.PI / 2, -0.05)
    await nearbyIs(game, 'farm-barn')
    expect((await game.state()).nearby.label).toBe('Barn · 3/50')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.store === 'barn')
    await page.locator('.farm-panel .farm-upgrade-go').click()
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'store-upgrade')
    await expect(page.locator('.farm-panel .farm-need .qty')).toHaveText(['1', '1', '1'])
    // its Upgrade button arms a moment after the card opens
    await page.waitForTimeout(600)
    await page.locator('.farm-confirm .farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.storage.barn === 2)
    const f = await state(game)
    expect([f.inv.brick, f.inv.plank, f.inv.nail]).toEqual([0, 0, 0])
    expect(await page.evaluate(() => (window as any).__home.farm.capacity('barn'))).toBe(100)
    // back on the barn's panel, its next level asks for two of each
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'store')
    await expect(page.locator('.farm-panel .farm-need .qty')).toHaveText(['2', '2', '2'])
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    expect(game.errors).toEqual([])
  })
})
