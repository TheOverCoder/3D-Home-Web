/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// The rest of the farm: milking a cow, the mill (wheat → flour), the oven (a lemon cake), buying more land,
// sugar cane from the seed panel and a buyer for a cake. Time is fast-forwarded with __home.farm.tick. (A machine's
// queue as a whole — jobs of different kinds, one after another, another place bought — is 32-machine-queue's.)

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
const label = (game: Game) => game.page.evaluate(() => (window as any).__home.useHome.getState().nearby?.label as string | undefined)
const panelIs = (game: Game, id: string) =>
  game.page.waitForFunction((want) => (window as any).__home.useHome.getState().panel?.kind === 'machine' && (window as any).__home.useHome.getState().panel.id === want, id, {
    timeout: 30_000,
    polling: 200,
  })
const inv = (game: Game) => game.page.evaluate(() => ({ ...(window as any).__home.farm.state.inv }))
const reset = (game: Game, extra: Record<string, number> = {}, coins?: number) =>
  game.page.evaluate(
    ([extra, coins]) => {
      const f = (window as any).__home.farm
      f.reset()
      Object.assign(f.state.inv, extra)
      if (typeof coins === 'number') f.state.coins = coins
    },
    [extra, coins] as const,
  )

test.describe('farm kitchen and animals', () => {
  test('milk a cow in the pasture', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await reset(game)
    // hold the first cow still beside the pasture's west fence, facing east, and stand next to her
    await page.evaluate(() => {
      const c = (window as any).__home.herd[0]
      Object.assign(c, { x: 11.0, z: -2.9, tx: 11.0, tz: -2.9, heading: Math.PI / 2, mode: 'idle', timer: 600 })
    })
    await game.teleport(9.6, 1.4, -2.9, -Math.PI / 2, -0.45)
    await nearbyIs(game, 'farm-cow-0')
    expect(await label(game)).toMatch(/^Milk Bella · 1 bottle of milk/)
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.inv.milk === 1)
    expect(await page.evaluate(() => (window as any).__home.farm.state.producers.cows.stock[0])).toBe(0)
  })

  test('the mill grinds wheat into flour: the button opens its queue (nothing goes in on the button), a sheaf a job', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await reset(game, { wheat: 3 })
    await game.teleport(10.9, 1.4, 10.6, -Math.PI / 2, -0.45)
    await nearbyIs(game, 'farm-mill')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().nearby)).toMatchObject({ label: 'Mill · add to the queue', icon: { verb: 'make', item: 'flour', word: 'Mill' } })
    // one press opens the mill's queue: nothing goes in yet
    await page.keyboard.press('KeyE')
    await panelIs(game, 'mill')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().panel)).toEqual({ kind: 'machine', id: 'mill' })
    expect((await inv(game)).wheat).toBe(3)
    expect(await page.evaluate(() => (window as any).__home.farm.millStage())).toBe('idle')
    // wheat is its second recipe: key 2 puts a sheaf in, three times (three places)
    for (let k = 1; k <= 3; k++) {
      await page.keyboard.press('Digit2')
      await page.waitForFunction((n) => (window as any).__home.farm.state.machines.mill.jobs.length === n, k, { timeout: 10_000, polling: 100 })
    }
    await expect(page.locator('.machine-queue .machine-slot')).toHaveCount(3)
    expect((await inv(game)).wheat).toBe(0)
    expect(await page.evaluate(() => (window as any).__home.farm.millStage())).toBe('working')
    await page.keyboard.press('Escape')
    await until(game, () => (window as any).__home.useHome.getState().panel === null)
    await page.evaluate(() => (window as any).__home.farm.tick(15))
    await until(game, () => ((window as any).__home.useHome.getState().nearby?.label ?? '').startsWith('Collect 3 bags of flour'))
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.inv.flour === 3)
  })

  test('the oven offers a cake only with everything for it, says what is missing, and bakes it from its queue', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    // short of a pumpkin for the pie (the cake nearest to ready): nothing to press, a status that shows what is missing
    await reset(game, { flour: 1, sugar: 1, egg: 2, milk: 1 })
    await game.teleport(8.7, 1.4, 11.75, -Math.PI / 2, -0.7)
    await until(game, () => (window as any).__home.useHome.getState().status?.id === 'farm-oven')
    const state = await page.evaluate(() => {
      const s = (window as any).__home.useHome.getState()
      return { actions: s.actions, status: s.status }
    })
    expect(state.actions).toEqual([])
    expect(state.status).toMatchObject({ label: 'Oven · a pumpkin pie needs', needs: [{ item: 'pumpkin', count: 1 }] })
    // with two lemons, the lemon cake can go in: the button opens the oven's queue, where the cake shows its five
    // ingredients, and a tap on it puts it in
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.inv.lemon = 2
    })
    await nearbyIs(game, 'farm-oven')
    expect(await label(game)).toBe('Bake · add to the queue')
    await page.keyboard.press('KeyE')
    await panelIs(game, 'oven')
    const cake = page.locator('.machine-recipes .farm-card', { hasText: 'Lemon cake' })
    await expect(cake.locator('.farm-card-tags .tag.ok')).toHaveCount(5)
    await expect(page.locator('.machine-recipes .farm-card:not(:disabled)')).toHaveCount(1)
    await cake.click()
    await until(game, () => (window as any).__home.farm.ovenStage() === 'baking')
    const used = await inv(game)
    expect([used.flour, used.sugar, used.egg, used.milk, used.lemon]).toEqual([0, 0, 0, 0, 0])
    await page.keyboard.press('Escape')
    await until(game, () => (window as any).__home.useHome.getState().panel === null)
    await page.evaluate(() => (window as any).__home.farm.tick(31))
    await until(game, () => ((window as any).__home.useHome.getState().nearby?.label ?? '').startsWith('Take out the lemon cake'))
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.inv.lemon_cake === 1)
  })

  test('buying the west field from the price tag on its plot, and planting sugar cane there with key 8', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await reset(game, {}, 150)
    // between the west field's two columns, facing the western plot: a price tag on it, nothing on the button
    await game.teleport(-10.95, 1.4, 2.8, Math.PI / 2, -0.6)
    await until(game, () => (window as any).__home.useHome.getState().tag?.id === 'farm-bed-9')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().tag)).toMatchObject({ kind: 'price', price: 120, label: 'Expand the farm: West field · 120 coins' })
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().actions)).toEqual([])
    // a tap on the tag opens the card that asks
    await page.locator('.thing-price').click()
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'build')
    await page.locator('.farm-buy:not(.arming)').click() // armed a moment after the card opens
    await until(game, () => [9, 10, 11, 12].every((i) => (window as any).__home.farm.state.beds[i].built))
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBe(30)
    await until(game, () => (window as any).__home.useHome.getState().nearby?.label === 'Plant seeds')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'seeds')
    await page.keyboard.press('Digit8')
    await until(game, () => (window as any).__home.farm.state.beds[9].crop === 'sugarcane')
  })

  test('a buyer for a cake: one lemon cake sells for their offer', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await reset(game, { lemon_cake: 1 })
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.spawnVisitor({ want: 'lemon_cake', qty: 1, offer: 45, from: -1 })
      for (let i = 0; i < 400 && f.state.visitors[0].phase !== 'queued'; i++) f.tick(0.25)
    })
    const coins0 = await page.evaluate(() => (window as any).__home.farm.state.coins)
    await game.teleport(5.6, 1.4, 12.3, Math.PI, -0.05)
    await nearbyIs(game, 'farm-queue')
    expect(await label(game)).toBe('Sell to 1 of 1 buyer')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'queue')
    await page.keyboard.press('Enter')
    await until(game, () => (window as any).__home.farm.state.inv.lemon_cake === 0)
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBe(coins0 + 45)
    await page.keyboard.press('Escape')
    await until(game, () => (window as any).__home.useHome.getState().panel === null)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
