/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// Decorating the house. Indoors, B (or the ✥ button) opens the view over the room you are in: the ceiling goes and
// the near walls fade. A mouse drag moves a piece — red, with why, where it does not fit (and it goes back), green
// where it does (and it stays there); R turns the picked piece, Delete puts it away into storage, a tap on it in
// storage stands it in the room again, Ctrl+Z undoes each step. The shop sells furniture after a card that asks
// first (coins down, the piece placed in the room and picked; undo gives the coins back). B leaves, and where
// everything stands is part of the farm's save.

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const layout = (game: Game) => game.page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.home.layout)))
const deco = (game: Game) => game.page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.home.decorate.useDecorate.getState())))

/** Where a point of the room is on the screen (the camera as it is now). */
const onScreen = (game: Game, x: number, y: number, z: number) =>
  game.page.evaluate(
    ([x, y, z]) => {
      const h = (window as any).__home
      const v = h.camera.position.clone().set(x, y, z).project(h.camera)
      return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }
    },
    [x, y, z],
  )

/** Presses on a point of the room and drags to another, in small steps; the mouse stays down. */
async function dragFrom(game: Game, from: [number, number], to: [number, number], y = 0.1) {
  const a = await onScreen(game, from[0], y, from[1])
  const b = await onScreen(game, to[0], y, to[1])
  await game.page.mouse.move(a.x, a.y)
  await game.page.mouse.down()
  for (let k = 1; k <= 12; k++) {
    await game.page.mouse.move(a.x + ((b.x - a.x) * k) / 12, a.y + ((b.y - a.y) * k) / 12)
    await game.page.waitForTimeout(40)
  }
}

test.describe('decorating the house', () => {
  test('B indoors: drag (red and back, green and stays), turn, put away, place again, undo, buy, and back down', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.coins = 500
    })
    // today's house fits every rule where it stands
    expect(await page.evaluate(() => (window as any).__home.home.layout.pieces.filter((p: any) => !(window as any).__home.home.canPlace(p).ok).map((p: any) => p.id))).toEqual([])

    // in the living room: B opens the view over it
    await game.teleport(-3.5, 1.4, 1.3, Math.PI, -0.2)
    await until(game, () => (window as any).__home.useHome.getState().room === 'living')
    await page.keyboard.press('KeyB')
    await until(game, () => (window as any).__home.useHome.getState().decorating && (window as any).__home.home.decorate.camera.blend >= 1)
    await expect(page.locator('.edit-card')).toContainText('Decorate')
    expect(await page.evaluate(() => (window as any).__home.camera.position.y)).toBeGreaterThan(4)
    // the ceiling goes
    await until(game, () => {
      let shown = false
      ;(window as any).__home.scene.traverse((o: any) => {
        if (o.name === 'ceiling-group-living' && o.visible) shown = true
      })
      return !shown
    })

    // the pouf onto the sofa: red, and why; let go and it goes back
    const pouf = (await layout(game)).pieces.find((p: any) => p.id === 'pouf')
    await dragFrom(game, [pouf.x, pouf.z], [-3.5, 2.5])
    await until(game, () => (window as any).__home.home.decorate.useDecorate.getState().drag?.fit.ok === false)
    expect((await deco(game)).drag.fit.reason).toBe('On the sofa')
    await expect(page.locator('.edit-card .fit-bad')).toHaveText('On the sofa')
    await page.mouse.up()
    await until(game, () => (window as any).__home.home.decorate.useDecorate.getState().drag === null)
    expect((await layout(game)).pieces.find((p: any) => p.id === 'pouf')).toMatchObject({ x: pouf.x, z: pouf.z })
    await expect(page.locator('.edit-card .fit-bad')).toHaveText('On the sofa — it went back')

    // to a free spot: green, and it stays there
    const spot = await page.evaluate(() => {
      const h = (window as any).__home.home
      const p = h.layout.pieces.find((q: any) => q.id === 'pouf')
      for (const [x, z] of [
        [-1.5, 1.5],
        [-1.25, 4.75],
        [-5.0, 1.25],
        [-2.0, 1.25],
      ])
        if (h.canPlace({ ...p, x, z }).ok) return [x, z]
      return null
    })
    expect(spot).not.toBeNull()
    await dragFrom(game, [pouf.x, pouf.z], spot as [number, number])
    await until(game, () => (window as any).__home.home.decorate.useDecorate.getState().drag?.fit.ok === true)
    await expect(page.locator('.edit-card .fit-ok')).toBeVisible()
    await page.mouse.up()
    await until(game, () => {
      const p = (window as any).__home.home.layout.pieces.find((q: any) => q.id === 'pouf')
      return p.x !== -4.95 || p.z !== 3.35
    })
    const moved = (await layout(game)).pieces.find((p: any) => p.id === 'pouf')
    expect(Math.hypot(moved.x - spot![0], moved.z - spot![1])).toBeLessThan(0.3)
    expect((await deco(game)).picked).toBe('pouf')

    // R turns it (or says why not); Delete puts it away
    await page.keyboard.press('KeyR')
    await page.keyboard.press('Delete')
    await until(game, () => (window as any).__home.home.layout.stored.includes('pouf'))
    expect((await layout(game)).pieces.some((p: any) => p.id === 'pouf')).toBe(false)
    // from storage, a tap stands it in the room again, picked
    await page.locator('.deco-stored-piece').first().click()
    await until(game, () => (window as any).__home.home.layout.stored.length === 0)
    const placed = (await deco(game)).picked as string
    expect(placed).toMatch(/^pouf-/)
    // Ctrl+Z: back into storage; again: back where it stood before it was put away
    await page.keyboard.press('Control+KeyZ')
    await until(game, () => (window as any).__home.home.layout.stored.includes('pouf'))
    await page.keyboard.press('Control+KeyZ')
    await until(game, () => (window as any).__home.home.layout.pieces.some((p: any) => p.id === 'pouf'))

    // the shop: a stool, after its card; then undo gives the coins back
    await page.locator('.deco-shop').click()
    await expect(page.locator('.farm-panel')).toContainText('Furniture')
    await page.locator('.farm-panel .farm-card', { hasText: 'Stool' }).click()
    await expect(page.locator('.farm-panel h2')).toHaveText('Stool')
    await page.waitForTimeout(600) // the Buy button arms a moment after the card opens
    await page.locator('.farm-panel .farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.coins === 470)
    await until(game, () => ((window as any).__home.home.decorate.useDecorate.getState().picked ?? '').startsWith('stool-'))
    expect((await layout(game)).pieces.filter((p: any) => p.type === 'stool')).toHaveLength(3)
    await page.keyboard.press('Control+KeyZ')
    await page.keyboard.press('Control+KeyZ')
    await until(game, () => (window as any).__home.farm.state.coins === 500)
    expect((await layout(game)).pieces.filter((p: any) => p.type === 'stool')).toHaveLength(2)

    // B: back down to your eyes; where the pouf stands is saved
    await page.keyboard.press('KeyB')
    await until(game, () => !(window as any).__home.useHome.getState().decorating && (window as any).__home.home.decorate.camera.blend === 0)
    await page.evaluate(() => (window as any).__home.farm.saveFarm())
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('3d-home:farm:v1') ?? '{}').home)
    expect(saved.pieces.find((p: any) => p.id === 'pouf')).toMatchObject({ x: moved.x, z: moved.z })
    expect(game.errors).toEqual([])
  })
})
