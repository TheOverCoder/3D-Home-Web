/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// The farm's layout and the edit mode: B flies the camera up over the farm; a meadow beyond the hedge is bought
// and the hedge moves out round it; the hen run is dragged onto it with the mouse (its hens and its nest come
// along), a drag onto the house goes back; the pasture is moved with its herd; Done flies back down.

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })

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

async function drag(game: Game, from: [number, number], to: [number, number]) {
  const { page } = game
  const a = await onScreen(game, ...from)
  const b = await onScreen(game, ...to)
  await page.mouse.move(a[0], a[1])
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(a[0] + ((b[0] - a[0]) * i) / 8, a[1] + ((b[1] - a[1]) * i) / 8)
  await page.waitForTimeout(150)
  const shown = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.farm.edit.useEdit.getState().drag)))
  await page.mouse.up()
  return shown as { id: string; at: { x: number; z: number; rot: number }; fit: { ok: boolean; reason?: string } } | null
}

test.describe('farm layout and the edit mode', () => {
  test('B: buy a meadow, drag the hen run onto it, move the pasture with its herd, and back down', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.coins = 1000
      f.state.eggs = 2
    })
    // up: the edit mode, the camera over the farm looking down
    await page.keyboard.press('KeyB')
    await until(game, () => (window as any).__home.useHome.getState().editing && (window as any).__home.farm.edit.camera.blend >= 1)
    expect(await page.evaluate(() => (window as any).__home.camera.position.y)).toBeGreaterThan(15)
    await expect(page.locator('.edit-card')).toContainText('Edit the farm')

    // the east meadow: its label, then Buy; the boundary moves out round it
    await page.locator('.edit-sale', { hasText: /^East meadow/ }).click()
    await expect(page.locator('.edit-card')).toContainText('East meadow')
    await page.locator('.edit-card .edit-buy').click()
    await until(game, () => (window as any).__home.farm.state.layout.land.includes('east'))
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBe(850)
    const edges = await page.evaluate(() => (window as any).__home.farm.boundary())
    expect(edges.some((e: any) => e.axis === 'z' && e.at === 26)).toBe(true)
    expect(edges.some((e: any) => e.axis === 'z' && e.at === 14)).toBe(false)

    // the hen run over the house: red, and it goes back where it was
    const bad = await drag(game, [11.6, 6.7], [3, 0])
    expect(bad?.fit.ok).toBe(false)
    expect(await page.evaluate(() => (window as any).__home.farm.state.layout.places.hens)).toEqual({ x: 11.6, z: 6.7, rot: 0 })
    await expect(page.locator('.edit-card')).toContainText('On the house')

    // onto the new meadow: it stays there
    const good = await drag(game, [11.6, 6.7], [20.5, 6.5])
    expect(good?.fit.ok).toBe(true)
    const hens = await page.evaluate(() => (window as any).__home.farm.state.layout.places.hens)
    expect(Math.abs(hens.x - 20.5)).toBeLessThanOrEqual(1)
    expect(Math.abs(hens.z - 6.5)).toBeLessThanOrEqual(1)
    expect(await page.evaluate((h) => (window as any).__home.farm.canPlace('hens', h).ok, hens)).toBe(true)

    // the pasture, turned, onto a second meadow (the north one): the herd comes along
    expect(
      await page.evaluate(() => {
        const f = (window as any).__home.farm
        f.buy('cow')
        return f.buyLand('north')
      }),
    ).toBe(true)
    expect(await page.evaluate(() => (window as any).__home.farm.movePlace('cows', { x: 0, z: -19, rot: 1 }).ok)).toBe(true)
    await page.waitForTimeout(1500)
    const herd = await page.evaluate(() => (window as any).__home.herd.map((c: any) => [c.x, c.z]))
    expect(herd.length).toBe(2)
    for (const [x, z] of herd) {
      expect(Math.abs(x)).toBeLessThan(6.6)
      expect(Math.abs(z + 19)).toBeLessThan(2.3)
    }
    // a turn for the lemon tree (R), and the panel says when something cannot turn where it stands
    await page.evaluate(() => (window as any).__home.farm.edit.useEdit.getState().pick({ kind: 'place', id: 'lemon' }))
    await page.keyboard.press('KeyR')
    expect(await page.evaluate(() => (window as any).__home.farm.state.layout.places.lemon.rot)).toBe(1)

    // Done: back down to where you stood
    await page.locator('.edit-done').click()
    await until(game, () => !(window as any).__home.useHome.getState().editing && (window as any).__home.farm.edit.camera.blend === 0)
    expect(await page.evaluate(() => (window as any).__home.camera.position.y)).toBeLessThan(3)

    // the nest came with the run: collect the eggs from beside it, out on the new meadow
    // the nest box is 1.92 m west of the run's middle and 1 m north; you collect from outside the fence
    const stand = [hens.x - 2.37, hens.z - 1.0]
    await game.teleport(stand[0], 1.4, stand[1], -Math.PI / 2, -0.3)
    await page.waitForFunction(() => (window as any).__home.useHome.getState().actions.some((a: any) => a.id === 'farm-nest'), null, { timeout: 30_000, polling: 250 })

    // the layout is kept with the farm
    await page.evaluate(() => (window as any).__home.farm.saveFarm())
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('3d-home:farm:v1') ?? '{}').layout)
    expect(saved.land).toEqual(['east', 'north'])
    expect(saved.places.cows).toEqual({ x: 0, z: -19, rot: 1 })

    await page.evaluate(() => (window as any).__home.farm.reset())
    expect(game.errors).toEqual([])
  })
})
