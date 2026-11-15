/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// A machine's queue in the game (src/farm/machines.ts; its panel, src/farm/MachinePanel.tsx, until the designed one
// replaces it): the oven's button opens its queue; three different cakes go in from there and bake one after another,
// a waiting one moved up; the level chip says what the level gives; another place is bought (its card asks first) and
// a fourth cake fits; once all are done the button collects every one at a press. Time is fast-forwarded with
// __home.farm.tick, and what it did is read in the same call (the farm runs on in real time between two calls).

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
/** The oven's queue as its panel sees it: each place's good and state. */
const queue = (game: Game) => game.page.evaluate(() => (window as any).__home.machines.view('oven').slots.map((s: any) => `${s.makes}:${s.state}`))

test.describe("a machine's queue", () => {
  test('the oven: three different cakes in a row, one after another, all collected at a press; a fourth place bought', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.coins = 1000
      Object.assign(f.state.inv, { flour: 4, sugar: 4, egg: 8, milk: 3, lemon: 2, carrot: 3, strawberry: 4, pumpkin: 1 })
    })
    await game.teleport(8.7, 1.4, 11.75, -Math.PI / 2, -0.7)
    await nearbyIs(game, 'farm-oven')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().nearby.icon)).toMatchObject({ verb: 'make', word: 'Bake' })
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'machine')
    await expect(page.locator('.farm-panel h2')).toHaveText('Oven')

    // three different cakes, each a tap on its card: the first bakes, the others wait
    for (const name of ['Lemon cake', 'Carrot cake', 'Strawberry cake']) await page.locator('.machine-recipes .farm-card', { hasText: name }).click()
    await until(game, () => (window as any).__home.farm.state.machines.oven.jobs.length === 3)
    expect(await queue(game)).toEqual(['lemon_cake:working', 'carrot_cake:waiting', 'strawberry_cake:waiting'])
    await expect(page.locator('.machine-queue .machine-slot')).toHaveCount(3)
    await expect(page.locator('.machine-queue .machine-slot.working')).toHaveCount(1)
    // three places, all taken: nothing more goes in
    await expect(page.locator('.machine-recipes .farm-card:not(:disabled)')).toHaveCount(0)
    // the strawberry cake moved up, before the carrot cake
    await page.locator('.machine-queue .machine-slot').nth(2).getByRole('button', { name: 'Sooner' }).click()
    await until(game, () => (window as any).__home.farm.state.machines.oven.jobs[1] === 'strawberry_cake')

    // the level: tapped, what it gives and what the next one will
    await page.locator('.farm-sub .tag.level').click()
    await expect(page.locator('.machine-boost')).toContainText('level 2 after')

    // another place: its card asks first, Buy (armed after a moment) pays for it
    const coins = await page.evaluate(() => (window as any).__home.farm.state.coins)
    const price = await page.evaluate(() => (window as any).__home.machines.view('oven').upgrade.price)
    await page.getByRole('button', { name: /^Another place in the queue/ }).click()
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'machine-slot')
    await page.locator('.farm-buy:not(.arming)').click()
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'machine')
    expect(await page.evaluate(() => [(window as any).__home.farm.state.machines.oven.capacity, (window as any).__home.farm.state.coins])).toEqual([4, coins - price])
    // a fourth cake fits now: the pumpkin pie
    await page.locator('.machine-recipes .farm-card', { hasText: 'Pumpkin pie' }).click()
    await until(game, () => (window as any).__home.farm.state.machines.oven.jobs.length === 4)
    await page.keyboard.press('Escape')
    await until(game, () => (window as any).__home.useHome.getState().panel === null)

    // they bake one after another: the lemon cake done in 30 s, then the strawberry cake 35 s, the carrot cake 35 s, the pie 40 s
    const steps = await page.evaluate(() => {
      const h = (window as any).__home
      const states = () =>
        h.machines
          .view('oven')
          .slots.map((s: any) => s.state)
          .join(' ')
      const out: string[] = []
      // the lemon cake from its start, as if just put in (the farm ran on in real time while the panel was used)
      Object.assign(h.farm.state.machines.oven, { done: 0, progress: 0 })
      h.farm.tick(31)
      out.push(states())
      h.farm.tick(35)
      out.push(states())
      h.farm.tick(35 + 40)
      out.push(states())
      return out
    })
    expect(steps).toEqual(['done working waiting waiting', 'done done working waiting', 'done done done done'])

    // all done: one press collects all four
    await until(game, () => ((window as any).__home.useHome.getState().nearby?.label ?? '').startsWith('Collect '))
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().nearby)).toMatchObject({
      label: 'Collect 1 lemon cake, 1 strawberry cake, 1 carrot cake, 1 pumpkin pie',
      icon: {
        verb: 'pick',
        item: 'lemon_cake',
        count: 1,
        also: [
          { item: 'strawberry_cake', count: 1 },
          { item: 'carrot_cake', count: 1 },
          { item: 'pumpkin_pie', count: 1 },
        ],
      },
    })
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.machines.oven.jobs.length === 0)
    const inv = await page.evaluate(() => (window as any).__home.farm.state.inv)
    expect([inv.lemon_cake, inv.strawberry_cake, inv.carrot_cake, inv.pumpkin_pie]).toEqual([1, 1, 1, 1])
    expect(await page.evaluate(() => (window as any).__home.farm.state.stats.baked)).toBe(4)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test("afterwards: today's farm again", async ({ game }) => {
    await game.ready('farm')
    await game.page.evaluate(() => (window as any).__home.farm.reset())
    await game.ready()
  })
})
