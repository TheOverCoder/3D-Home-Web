/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// What is within reach (and turning towards it), the sheep and the loom, and the line of buyers at the gate: its
// places, how often buyers come, the upgrades for both, selling to everyone, and the line kept in the save.
// Time is fast-forwarded with __home.farm.tick.

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) =>
  game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
const nearby = (game: Game) => game.page.evaluate(() => (window as any).__home.useHome.getState().nearby)

test.describe('smart actions, sheep and the line at the gate', () => {
  test('a ripe bed behind you is offered by reach, with a hand and a lettuce; E turns you round to it and harvests', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.plant(0, 'lettuce')
      for (let i = 0; i < 12; i++) {
        f.water(0)
        f.tick(5)
      }
    })
    // on the path beside the bed (it is to the west), looking east and up at the sky: nothing in view
    await game.teleport(-1.2, 1.4, 9.0, -Math.PI / 2, 0.5)
    await nearbyIs(game, 'farm-bed-0')
    const offer = await nearby(game)
    expect(offer).toMatchObject({ label: 'Harvest 4 lettuces', icon: { verb: 'pick', item: 'lettuce' }, reach: true, side: 'back' })
    // the prompt says which way round it is
    await expect(game.page.locator('.prompt.turn-back')).toBeVisible()
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.inv.lettuce === 4)
    // the view swings round to the bed (west)
    await until(game, () => {
      const y = (window as any).__home.look.yaw - Math.PI / 2
      return Math.abs(Math.atan2(Math.sin(y), Math.cos(y))) < 0.2
    })
  })

  test('sheep: shear one for her fleece; the loom weaves fleeces into cloth', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => {
      const h = (window as any).__home
      h.farm.reset()
      // hold the first sheep still in the fold, the other one out of the way
      Object.assign(h.flock[0], { x: 0.0, z: -10.0, tx: 0.0, tz: -10.0, heading: -Math.PI / 2, mode: 'idle', timer: 600 })
      Object.assign(h.flock[1], { x: -4.4, z: -9.6, tx: -4.4, tz: -9.6, mode: 'idle', timer: 600 })
    })
    // inside the fold, facing her
    await game.teleport(-1.5, 1.4, -10.0, -Math.PI / 2, -0.35)
    await nearbyIs(game, 'farm-sheep-0')
    expect(await nearby(game)).toMatchObject({ label: 'Shear Dolly · 1 fleece', icon: { verb: 'shear', item: 'wool' } })
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.inv.wool === 1)
    expect(await page.evaluate(() => (window as any).__home.farm.state.wool[0])).toBe(0)
    // the fleece grows back
    await page.evaluate(() => (window as any).__home.farm.tick(61))
    expect(await page.evaluate(() => (window as any).__home.farm.state.wool[0])).toBe(1)

    // the loom stands beside the fold: E puts the fleece on, and once woven E takes the cloth off
    await game.teleport(4.9, 1.4, -8.6, 0, -0.3)
    await nearbyIs(game, 'farm-loom')
    expect((await nearby(game)).label).toBe('Weave 1 fleece into cloth')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.loomStage() === 'working')
    expect(await page.evaluate(() => (window as any).__home.farm.state.inv.wool)).toBe(0)
    await page.evaluate(() => (window as any).__home.farm.tick(7))
    await until(game, () => (window as any).__home.useHome.getState().nearby?.label === 'Take 1 roll of cloth off the loom')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.inv.cloth === 1)
  })

  test('the line: five places and a buyer every two minutes, upgrades to fifteen and every thirty seconds, sell to all', async ({ game }) => {
    await game.ready()
    const { page } = game
    // buyers walk up the lane: tick in small steps so they get to their places
    const run = (seconds: number) =>
      page.evaluate((s) => {
        const f = (window as any).__home.farm
        for (let t = 0; t < s; t += 0.25) f.tick(0.25)
      }, seconds)
    const line = () =>
      page.evaluate(() => {
        const f = (window as any).__home.farm
        return { inLine: f.inLine().length, waiting: f.waiting().length, places: f.placesInLine(), every: f.arrivalSeconds(), next: f.state.nextVisitorIn }
      })
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.started = true
      f.state.nextVisitorIn = 0.1
      f.state.coins = 5000
      for (const id of Object.keys(f.state.inv)) f.state.inv[id] = 100
    })
    await run(1)
    expect(await line()).toMatchObject({ inLine: 1, places: 5, every: 120 })
    expect((await line()).next).toBeGreaterThan(118)
    // one every two minutes, until the five places are taken; then nobody else joins, however long it waits
    await run(4 * 120)
    expect((await line()).inLine).toBe(5)
    await run(300)
    expect(await line()).toMatchObject({ inLine: 5, waiting: 5, next: 0 })

    // ten steps of "a longer queue" make fifteen places, six of "a busier lane" one buyer every thirty seconds
    const bought = await page.evaluate(() => {
      const f = (window as any).__home.farm
      const n = { queue: 0, pace: 0 }
      for (let i = 0; i < 12; i++) if (f.buy('queue')) n.queue++
      for (let i = 0; i < 8; i++) if (f.buy('pace')) n.pace++
      return n
    })
    expect(bought).toEqual({ queue: 10, pace: 6 })
    expect(await line()).toMatchObject({ places: 15, every: 30 })
    // the next buyer was already due, then one every thirty seconds: ten more in a little over four and a half minutes
    await run(9 * 30 + 60)
    expect(await line()).toMatchObject({ inLine: 15, waiting: 15 })

    // the line is saved with the farm: buyers wait for you while you are away
    expect(
      await page.evaluate(() => {
        ;(window as any).__home.farm.saveFarm()
        return JSON.parse(localStorage.getItem('3d-home:farm:v1') ?? '{}').queue?.length
      }),
    ).toBe(15)

    // sell to everyone at once, from the panel at the gate
    const coins0 = await page.evaluate(() => (window as any).__home.farm.state.coins)
    const offers = await page.evaluate(() => (window as any).__home.farm.waiting().reduce((s: number, v: any) => s + v.offer, 0))
    await game.teleport(5.6, 1.4, 12.3, Math.PI, -0.05)
    await nearbyIs(game, 'farm-queue')
    expect((await nearby(game)).icon.verb).toBe('sell')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'queue')
    await expect(page.locator('.farm-buyer')).toHaveCount(15)
    await page.locator('.farm-sell-all').click()
    await until(game, () => (window as any).__home.farm.waiting().length === 0)
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBe(coins0 + offers)
    await page.keyboard.press('Escape')
    await until(game, () => (window as any).__home.useHome.getState().panel === null)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
