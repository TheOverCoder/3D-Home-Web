/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// A machine's queue in the game (src/farm/machines.ts; its panel, src/farm/MachinePanel.tsx and src/farm/machine): the
// oven's button opens its queue; three different cakes go in from there (a tap on each card) and bake one after
// another, a waiting one dragged before another; the level chip opens what the level gives; another place is bought
// (its card asks first) and a fourth cake fits; once all are done the button collects every one at a press. Time is fast-forwarded with
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
    for (const name of ['Lemon cake', 'Carrot cake', 'Strawberry cake']) await page.locator('.mp-recipe', { hasText: name }).click()
    await until(game, () => (window as any).__home.farm.state.machines.oven.jobs.length === 3)
    expect(await queue(game)).toEqual(['lemon_cake:working', 'carrot_cake:waiting', 'strawberry_cake:waiting'])
    await expect(page.locator('.mp-places .mp-place.job')).toHaveCount(3)
    await expect(page.locator('.mp-places .mp-place.working')).toHaveCount(1)
    // three places, all taken: nothing more goes in
    await expect(page.locator('.mp-recipe[aria-disabled="false"]')).toHaveCount(0)
    // the strawberry cake dragged before the carrot cake (a mouse: it lifts as it moves, and drops where it is let go)
    const from = (await page.locator('.mp-places .mp-place.job').nth(2).boundingBox())!
    const to = (await page.locator('.mp-places .mp-place.job').nth(1).boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
    await page.mouse.up()
    await until(game, () => (window as any).__home.farm.state.machines.oven.jobs[1] === 'strawberry_cake')

    // the level: its chip opens what it gives and what the next one will; back to the queue
    await page.getByRole('button', { name: /^Oven, level 1/ }).click()
    await expect(page.locator('.mp-lv')).toContainText('to level 2')
    await expect(page.locator('.mp-lv-boosts')).toContainText('+20 %')
    await page.getByRole('button', { name: 'Back to the oven' }).click()

    // another place: its card asks first, Buy (armed after a moment) pays for it
    const coins = await page.evaluate(() => (window as any).__home.farm.state.coins)
    const price = await page.evaluate(() => (window as any).__home.machines.view('oven').upgrade.price)
    await page.getByRole('button', { name: /^One more place/ }).click()
    await page.locator('.mp-buy-go:not(.arming)').click()
    await until(game, () => (window as any).__home.farm.state.machines.oven.capacity === 4)
    expect(await page.evaluate(() => [(window as any).__home.farm.state.machines.oven.capacity, (window as any).__home.farm.state.coins])).toEqual([4, coins - price])
    // a fourth cake fits now: the pumpkin pie
    await page.locator('.mp-recipe', { hasText: 'Pumpkin pie' }).click()
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
    // (the button's offer is worked out a few times a second: wait for the one with all four, not a moment before it)
    await until(game, () => (window as any).__home.useHome.getState().nearby?.label === 'Collect 1 lemon cake, 1 strawberry cake, 1 carrot cake, 1 pumpkin pie')
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
