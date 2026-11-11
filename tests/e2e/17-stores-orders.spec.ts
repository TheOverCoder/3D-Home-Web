/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// The silo and the barn (what is in them, how full, made bigger with building materials), the surprises (a building
// material from a buyer, an animal, a harvest), and the order office with its tractor. Time is fast-forwarded with
// __home.farm.tick; the dice is set with __home.farm.setRandom where a surprise must come up.

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
/** Sets how many of a good the farm has, and redraws what shows it. */
const give = (game: Game, good: string, n: number) =>
  game.page.evaluate(
    ([good, n]) => {
      const f = (window as any).__home.farm
      f.state.inv[good] = n
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    },
    [good, n] as const,
  )
const state = (game: Game) => game.page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.farm.state, (k, v) => (k === 'visitors' ? undefined : v))))
const reset = (game: Game, inv: Record<string, number> = {}, coins = 200) =>
  game.page.evaluate(
    ([inv, coins]) => {
      const f = (window as any).__home.farm
      f.setRandom(null)
      f.reset()
      f.tick(0.01)
      Object.assign(f.state.inv, inv)
      f.state.coins = coins
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    },
    [inv, coins] as const,
  )

test.describe('the silo, the barn, surprises and orders', () => {
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
  })

  test('surprises: a buyer with one gives it as you sell, each egg can turn one up; they fly to the barn', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, { egg: 2 })
    await game.teleport(5.6, 1.4, 11.6, Math.PI, -0.05)
    const before = await page.evaluate(() => (window as any).__home.fx.stats.items)
    // every chance comes up, and the material is the first of the six (a brick)
    await page.evaluate(() => (window as any).__home.farm.setRandom(() => 0.01))
    const id = await page.evaluate(() => {
      const f = (window as any).__home.farm
      const v = f.spawnVisitor({ want: 'egg', qty: 1, offer: 3, queued: true })
      return v.gift ? v.id : -1
    })
    expect(id).toBeGreaterThan(0)
    // (the toast goes after a moment: read in the same call as the sale)
    const toast = await page.evaluate((id) => {
      const h = (window as any).__home
      h.farm.acceptOffer(id)
      return h.useHome.getState().toast?.text as string
    }, id)
    expect(toast).toMatch(/Surprise: 1 brick/)
    expect((await state(game)).inv.brick).toBe(1)
    // it popped up over the buyer and flew to the barn's chip
    await until(game, () => (window as any).__home.fx.stats.items > 0)
    expect(await page.evaluate(() => (window as any).__home.fx.stats.items)).toBeGreaterThan(before)
    // three eggs collected: three chances
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.producers.hens.stock[0] = 3
      f.collect('hens')
    })
    expect((await state(game)).inv.brick).toBe(4)
    await page.evaluate(() => (window as any).__home.farm.setRandom(null))
  })

  test('orders at the office: goods go in partly, a full order is sent and paid, a declined one gives its goods back', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, {}, 100)
    await game.teleport(-8.0, 1.4, 6.3, Math.PI / 2, -0.1)
    await nearbyIs(game, 'farm-office')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'orders')
    await expect(page.locator('.farm-order:not(.waiting)')).toHaveCount(3)
    const first = await page.evaluate(() => (window as any).__home.farm.orderAt(0))
    // one of what the first order's first good asks for: it goes in, and leaves the silo or the barn
    const good = first.lines[0].good
    await give(game, good, 1)
    await page.locator('.farm-order').nth(0).getByRole('button', { name: 'Put in' }).click()
    await until(game, () => (window as any).__home.farm.orderAt(0).lines[0].have === 1)
    expect((await state(game)).inv[good]).toBe(0)
    // the rest of it: then Send, paid at once, and a new order in its place
    await page.evaluate((o) => {
      const f = (window as any).__home.farm
      for (const l of o.lines) f.state.inv[l.good] = l.want
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    }, first)
    await page.locator('.farm-order').nth(0).getByRole('button', { name: 'Put in' }).click()
    await page
      .locator('.farm-order')
      .nth(0)
      .getByRole('button', { name: /^Send this order/ })
      .click()
    await until(game, () => (window as any).__home.farm.state.coins > 100)
    const sent = await state(game)
    expect(sent.coins).toBe(100 + first.coins)
    expect(sent.orders[0].order.lines.every((l: any) => l.have === 0)).toBe(true)
    expect(sent.dispatch.waiting + sent.dispatch.aboard).toBeGreaterThan(0)
    // the second order half filled, then declined: its goods come back, and the next comes in ten minutes
    const second = await page.evaluate(() => (window as any).__home.farm.orderAt(1))
    await give(game, second.lines[0].good, 1)
    await page.locator('.farm-order').nth(1).getByRole('button', { name: 'Put in' }).click()
    await until(game, () => (window as any).__home.farm.orderAt(1).lines[0].have === 1)
    await page.locator('.farm-order').nth(1).getByRole('button', { name: 'Decline this order' }).click()
    await until(game, () => (window as any).__home.farm.orderAt(1) === null)
    expect((await state(game)).inv[second.lines[0].good]).toBe(1)
    await expect(page.locator('.farm-order.waiting')).toContainText('New order in 10:00')
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
  })

  test('the tractor loads the crates, drives them off through the gate in the hedge and backs into its yard again', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game)
    await game.teleport(-7.6, 1.4, 9.3, 1.18, 0.02)
    const tractorX = () =>
      page.evaluate(() => {
        const m = (window as any).__home.scene.getObjectByName('tractor-body')
        const a = new Float32Array(16)
        m.instanceMatrix.array.slice(0, 16).forEach((v: number, i: number) => (a[i] = v))
        return { x: a[12], z: a[14], drawn: m.count }
      })
    // (drawn at home again on the next frames after the reset)
    await page.waitForFunction(
      () => {
        const m = (window as any).__home.scene.getObjectByName('tractor-body')
        return m.count === 1 && Math.abs(m.instanceMatrix.array[12] - -11.95) < 0.05
      },
      null,
      { timeout: 30_000, polling: 200 },
    )
    const home = await tractorX()
    await page.evaluate(() => ((window as any).__home.farm.state.dispatch.waiting = 2))
    await until(game, () => (window as any).__home.farm.state.dispatch.aboard === 2)
    // a few seconds on: loaded, and on its way west along the track (still in sight: on the software renderer a few
    // seconds more can pass before the next frame is drawn)
    await page.evaluate(() => (window as any).__home.farm.tick(4.5))
    await page.waitForFunction(() => (window as any).__home.scene.getObjectByName('tractor-body').instanceMatrix.array[12] < -13, null, { timeout: 30_000, polling: 100 })
    const out = await tractorX()
    expect(out.drawn).toBe(1)
    expect(out.z).toBeCloseTo(7.9, 1)
    // the trip done, it stands in its yard again
    await page.evaluate(() => (window as any).__home.farm.tick(120))
    await until(game, () => (window as any).__home.farm.state.dispatch.trip === -1)
    // (drawn there on the next frame: on the software renderer one can take more than a second)
    await page.waitForFunction((x) => Math.abs((window as any).__home.scene.getObjectByName('tractor-body').instanceMatrix.array[12] - x) < 0.05, home.x, { timeout: 30_000, polling: 100 })
    const back = await tractorX()
    expect(back.x).toBeCloseTo(home.x, 1)
    expect(back.drawn).toBe(1)
  })

  test('the tractor is solid: walking into it in its yard, you stop at it', async ({ game }) => {
    await game.ready()
    await reset(game)
    // east of its carrier, walking west along its track towards the gate
    await game.teleport(-8.9, 1.4, 7.9, Math.PI / 2, 0)
    await game.hold('KeyW', 2500)
    const x = await game.page.evaluate(() => (window as any).__home.playerState.position.x)
    expect(x).toBeGreaterThan(-10.4)
  })

  test('the office sells a fourth place on the board, through a card that asks first', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, {}, 500)
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'orders' }))
    await page.locator('.farm-office .farm-shop-item').nth(0).getByRole('button').click()
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'office-upgrade')
    await page.waitForTimeout(600)
    await page.locator('.farm-confirm .farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.office.slots === 1)
    const f = await state(game)
    expect(f.coins).toBe(420)
    expect(f.orders.length).toBe(4)
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'orders')
    await expect(page.locator('.farm-order:not(.waiting)')).toHaveCount(4)
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
  })

  test('the seed packets show how many of each crop are in the silo', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, { lettuce: 7, tomato: 2 })
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'seeds', bed: 0 }))
    await expect(page.locator('.farm-card .farm-stock')).toHaveText(['7', '0', '0', '2', '0', '0', '0', '0'])
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    expect(game.errors).toEqual([])
  })
})
