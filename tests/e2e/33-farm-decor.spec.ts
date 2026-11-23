/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp, onMap, type Game } from './helpers'

// The farm's decoration (src/farm/decor.ts, the edit mode's shop: src/farm/DecorShop.tsx): from above, the bag on the
// edit mode's card opens the shop; a yard lamp is bought on its card (Cancel or Buy, its price), stands in view picked,
// and the next one costs more; it is dragged with the mouse, put away into the farm's store and put down again for
// nothing. An apple tree from the fruit tab bears apples, picked with the action button into the silo. The oven and a
// bed moved in the edit mode work where they stand now. A reload keeps all of it.

const until = (game: Game, fn: () => boolean, timeout = 60_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
const layout = (game: Game) => game.page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.farm.state.layout)))

/** Where a point on the ground is on the screen, through the camera as it is now. */
const onScreen = (game: Game, x: number, z: number) =>
  game.page.evaluate(
    ([x, z]) => {
      const h = (window as any).__home
      const v = new h.camera.position.constructor(x, 0, z).project(h.camera)
      const r = h.gl.domElement.getBoundingClientRect()
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height] as [number, number]
    },
    [x, z] as [number, number],
  )

/** A mouse drag over the ground, from one point to another. */
async function drag(game: Game, from: [number, number], to: [number, number]) {
  const { page } = game
  const a = await onScreen(game, ...from)
  const b = await onScreen(game, ...to)
  await page.mouse.move(a[0], a[1])
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(a[0] + ((b[0] - a[0]) * i) / 8, a[1] + ((b[1] - a[1]) * i) / 8)
  await page.waitForTimeout(150)
  await page.mouse.up()
}

async function editMode(game: Game, on: boolean) {
  await game.page.evaluate((on) => (window as any).__home.useHome.getState().setEditing(on), on)
  await until(game, on ? () => (window as any).__home.farm.edit.camera.blend >= 1 : () => (window as any).__home.farm.edit.camera.blend === 0)
}

test.describe("the farm's decoration", () => {
  test('a lamp bought, dearer the next time, dragged, put away and down again; an apple tree picked; the oven and a bed moved; kept across a reload', async ({ game }) => {
    test.setTimeout(900_000)
    await game.ready('farm')
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.coins = 5000
    })
    await game.teleport(0, 1.4, 4, Math.PI, -0.1)
    await until(game, () => (window as any).__home.useHome.getState().outdoors)
    await page.keyboard.press('KeyB')
    await until(game, () => (window as any).__home.useHome.getState().editing && (window as any).__home.farm.edit.camera.blend >= 1)

    // the shop: three tabs, every kind with its price; the yard lamp's card asks first
    await page.locator('.edit-card .deco-shop').click()
    const shop = page.locator('.farm-panel[aria-label="Decoration"]')
    await expect(shop).toBeVisible()
    await expect(shop.locator('[role="tab"]')).toHaveText(['Decoration', 'Fruit trees', 'Machines'])
    // every kind of decoration sold (the beehive and the seasons' four among them; the season banner is given, not
    // sold), in their sets
    await expect(shop.locator('.decor-card')).toHaveCount(29)
    await expect(shop.locator('.decor-set')).toHaveCount(8)
    await shop.locator('.decor-card', { hasText: 'Yard lamp' }).click()
    const card = page.locator('.farm-panel[aria-label="Yard lamp"]')
    await expect(card.locator('.farm-buy')).toContainText('200')
    await card.locator('.btn.soft', { hasText: 'Cancel' }).click()
    await expect(shop).toBeVisible()
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBe(5000)
    await shop.locator('.decor-card', { hasText: 'Yard lamp' }).click()
    await page.waitForTimeout(600)
    await card.locator('.farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.layout.decor.length === 1)
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBe(4800)
    // it stands in view, picked, and the next costs 240
    await expect(page.locator('.edit-card h3')).toHaveText('Yard lamp')
    const lamp = (await layout(game)).decor[0]
    expect(lamp.kind).toBe('lamp')
    expect(await page.evaluate(() => (window as any).__home.farm.decorPrice('lamp'))).toBe(240)
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'decor-shop', tab: 'decor' }))
    await expect(page.locator('.decor-card', { hasText: 'Yard lamp' })).toContainText('240')
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())

    // dragged with the mouse onto free land: it stands there; onto the path among the beds: it goes back
    await drag(game, [lamp.x, lamp.z], [3, -2])
    await until(game, () => {
      const d = (window as any).__home.farm.state.layout.decor[0]
      return Math.abs(d.x - 3) <= 0.5 && Math.abs(d.z + 2) <= 0.5
    })
    const moved = (await layout(game)).decor[0]
    await drag(game, [moved.x, moved.z], [-1.2, 9.6])
    expect((await layout(game)).decor[0]).toMatchObject({ x: moved.x, z: moved.z })

    // put away into the store, and down again from it for nothing
    await page.evaluate((id) => (window as any).__home.farm.edit.useEdit.getState().pick({ kind: 'decor', id }), moved.id)
    await page.locator('.edit-card .btn', { hasText: 'Put away' }).click()
    await until(game, () => (window as any).__home.farm.state.layout.decor.length === 0)
    expect((await layout(game)).stored.lamp).toBe(1)
    await page.locator('.deco-stored-piece').click()
    await until(game, () => (window as any).__home.farm.state.layout.decor.length === 1)
    expect(await page.evaluate(() => [(window as any).__home.farm.state.coins, (window as any).__home.farm.state.layout.stored.lamp])).toEqual([4800, 0])

    // an apple tree from the fruit tab
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'decor-shop', tab: 'decor' }))
    await page.locator('[role="tab"]', { hasText: 'Fruit trees' }).click()
    await expect(page.locator('.decor-card')).toHaveCount(5)
    await page.locator('.decor-card', { hasText: 'Apple tree' }).click()
    await page.waitForTimeout(600)
    await page.locator('.farm-panel[aria-label="Apple tree"] .farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.layout.decor.some((d: any) => d.kind === 'apple-tree'))
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBe(4200)
    // (moved to a spot of the test's own: it was put down where there was room in view)
    expect(
      await page.evaluate(() => {
        const f = (window as any).__home.farm
        return f.moveDecor(f.state.layout.decor.find((d: any) => d.kind === 'apple-tree').id, { x: 5, z: 2, rot: 0 }).ok
      }),
    ).toBe(true)

    // the oven and the first bed moved (through the game's own rules), then down from above
    const spots = await page.evaluate(() => {
      const f = (window as any).__home.farm
      const oven = { x: -4, z: -2, rot: 1 }
      // (clear of the dairy and its way in, on the pasture's west)
      const bed = { x: 3.5, z: -5, rot: 1 }
      return { oven: f.movePlace('oven', oven).ok && oven, bed: f.moveBed(0, bed).ok && bed }
    })
    expect(spots.oven && spots.bed).toBeTruthy()
    await page.locator('.edit-done').click()
    await editMode(game, false)

    // apples on the tree: picked from beside it
    const tree = (await layout(game)).decor.find((d: any) => d.kind === 'apple-tree')
    await page.evaluate(() => {
      ;(window as any).__home.farm.state.producers['apple-tree'].stock[0] = 3
    })
    await game.teleport(tree.x, 1.4, tree.z + 1.9, 0, -0.2)
    await nearbyIs(game, 'farm-apple-tree-0')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.inv.apple === 3)
    expect(await page.evaluate(() => (window as any).__home.farm.state.got.apple)).toBe(3)

    // the oven where it stands now, with a lemon cake's makings in the barn: its button there (a quarter turned, its
    // mouth faces south), and it opens its queue
    await page.evaluate(() => Object.assign((window as any).__home.farm.state.inv, { flour: 1, sugar: 1, egg: 2, milk: 1, lemon: 2 }))
    await game.teleport(-4, 1.4, -2 + 1.3, 0, -0.3)
    await nearbyIs(game, 'farm-oven')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'machine')
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    // the bed where it stands now: plant it from beside it
    await page.evaluate(() => {
      ;(window as any).__home.farm.state.coins = 100
    })
    await game.teleport(3.5 + 1.0, 1.4, -5, Math.PI / 2, -0.5)
    await nearbyIs(game, 'farm-bed-0')
    await page.keyboard.press('Digit1')
    await until(game, () => (window as any).__home.farm.state.beds[0].crop === 'lettuce')

    // a reload: all of it as it was left
    const before = await layout(game)
    await page.evaluate(() => (window as any).__home.farm.saveFarm())
    await bootApp(page)
    await onMap(page, 'farm')
    const after = await layout(game)
    expect(after.decor).toEqual(before.decor)
    expect(after.places.oven).toEqual({ x: -4, z: -2, rot: 1 })
    expect(after.beds[0]).toEqual({ x: 3.5, z: -5, rot: 1 })
    expect(await page.evaluate(() => (window as any).__home.farm.state.beds[0].crop)).toBe('lettuce')
    expect(await page.evaluate(() => (window as any).__home.farm.state.producers['apple-tree'].animals)).toBe(1)

    await page.evaluate(() => (window as any).__home.farm.reset())
    expect(game.errors).toEqual([])
  })
})
