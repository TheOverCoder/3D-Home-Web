/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp, onMap, type Game } from './helpers'

// Decorating the house's shell (src/home/shell.ts, src/home/decorate.ts). In the view over a room a window is picked
// with a click and slid along its wall by a mouse drag; a doorway is picked and slid with the card's arrows, another
// closed (it becomes wall: you walk into it) and opened; the living room is painted and given a stone floor (undo goes
// back a step); the standing lamp is dragged into a doorway — it fits, with a word that it blocks the way, and its light
// goes with it. Everything is kept across a reload, the walls built again where the save has the openings.

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const shell = (game: Game) => game.page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.home.shell())))
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

/** The floor point under a point of the screen. */
const floorUnder = (game: Game, sx: number, sy: number) =>
  game.page.evaluate(
    ([sx, sy]) => {
      const cam = (window as any).__home.camera
      const v = cam.position
        .clone()
        .set((sx / innerWidth) * 2 - 1, 1 - (sy / innerHeight) * 2, 0.5)
        .unproject(cam)
        .sub(cam.position)
        .normalize()
      const t = -cam.position.y / v.y
      return [cam.position.x + v.x * t, cam.position.z + v.z * t] as [number, number]
    },
    [sx, sy],
  )

/** Presses on a point of the room and drags so that the floor under the pointer moves by (dx, dz), in small steps, then
 *  lets go (or not: `keep`). */
async function drag(game: Game, at: [number, number, number], dx: number, dz: number, keep = false) {
  const a = await onScreen(game, ...at)
  const g = await floorUnder(game, a.x, a.y)
  const b = await onScreen(game, g[0] + dx, 0, g[1] + dz)
  await game.page.mouse.move(a.x, a.y)
  await game.page.mouse.down()
  for (let k = 1; k <= 14; k++) {
    await game.page.mouse.move(a.x + ((b.x - a.x) * k) / 14, a.y + ((b.y - a.y) * k) / 14)
    await game.page.waitForTimeout(40)
  }
  if (!keep) await game.page.mouse.up()
}

/** A click on a point of the room. */
async function tap(game: Game, x: number, y: number, z: number) {
  const p = await onScreen(game, x, y, z)
  await game.page.mouse.click(p.x, p.y)
}

/** The decorate view up over a room (B), the camera there. */
async function decorate(game: Game) {
  await game.page.keyboard.press('KeyB')
  await until(game, () => (window as any).__home.useHome.getState().decorating && (window as any).__home.home.decorate.camera.blend >= 1)
  await game.page.waitForTimeout(400)
}

test.describe('decorating the house’s shell', () => {
  test('a window slid along its wall, a doorway slid and another closed, paint and a floor, a lamp in a doorway: kept across a reload', async ({ game }) => {
    test.setTimeout(600_000)
    await game.ready()
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.apartment.owned = true
      f.state.place = 'home'
    })
    await game.teleport(-3.5, 1.4, 1.3, Math.PI, -0.2)
    await until(game, () => (window as any).__home.useHome.getState().room === 'living')
    await decorate(game)

    // the living room's west window: a click picks it (its card), a drag slides it 60 cm along its wall
    await tap(game, -6.8, 2.2, 1.9)
    await until(game, () => (window as any).__home.home.decorate.useDecorate.getState().picked === 'opening:win-living-west')
    await expect(page.locator('.edit-card h3')).toHaveText('Window')
    await drag(game, [-6.8, 2.2, 1.9], 0, -0.6, true)
    await until(game, () => (window as any).__home.home.decorate.useDecorate.getState().drag?.open?.centre !== undefined)
    await expect(page.locator('.edit-card .fit-ok')).toBeVisible()
    await page.mouse.up()
    await until(game, () => (window as any).__home.home.shell().openings['win-living-west'].centre < 1.6)
    const window1 = (await shell(game)).openings['win-living-west']
    expect(window1.run).toBe('w-living')
    expect(Math.abs(window1.centre - 1.3)).toBeLessThan(0.25)
    // the walls are built again round it: its pane where it is now
    await until(game, () => {
      let at: number | null = null
      ;(window as any).__home.scene.traverse((o: any) => {
        if (o.userData?.part === 'win-living-west-glass') at = o.position.z
      })
      return at !== null && Math.abs(at - (window as any).__home.home.shell().openings['win-living-west'].centre) < 1e-6
    })

    // the doorway to the studio: picked, slid three steps with the card's arrow
    await tap(game, -3.5, 2.1, 0.2)
    await until(game, () => (window as any).__home.home.decorate.useDecorate.getState().picked === 'opening:livingOffice')
    await expect(page.locator('.edit-card h3')).toHaveText('Doorway')
    for (let k = 0; k < 3; k++) await page.getByRole('button', { name: 'Slide it one way' }).click()
    await until(game, () => Math.abs((window as any).__home.home.shell().openings.livingOffice.centre + 3.8) < 1e-6)
    // the doorway to the bedroom: closed (wall), opened, closed again
    await tap(game, -0.2, 2.1, 3.0)
    await until(game, () => (window as any).__home.home.decorate.useDecorate.getState().picked === 'opening:livingBedroom')
    await page.getByRole('button', { name: 'Close it' }).click()
    await until(game, () => (window as any).__home.home.shell().openings.livingBedroom.closed === true)
    await page.getByRole('button', { name: 'Open it' }).click()
    await until(game, () => (window as any).__home.home.shell().openings.livingBedroom.closed === false)
    await page.getByRole('button', { name: 'Close it' }).click()
    await until(game, () => (window as any).__home.home.shell().openings.livingBedroom.closed === true)

    // paint and a floor for the living room (free), and undo a step
    await page.evaluate(() => (window as any).__home.home.decorate.useDecorate.setState({ picked: null }))
    await page.getByRole('tab', { name: 'Walls' }).click()
    await page.getByRole('button', { name: 'Sage', exact: true }).click()
    await until(game, () => (window as any).__home.home.shell().paint.living === 'sage')
    await page.getByRole('tab', { name: 'Floor' }).click()
    await page.getByRole('button', { name: 'Terracotta' }).click()
    await until(game, () => (window as any).__home.home.shell().floors.living === 'terracotta')
    await page.keyboard.press('Control+KeyZ')
    await until(game, () => (window as any).__home.home.shell().floors.living === 'honey')
    await page.getByRole('button', { name: 'Limestone' }).click()
    await until(game, () => (window as any).__home.home.shell().floors.living === 'limestone')
    // the walls merged again in the room's paint, the floor laid in its tint
    await until(game, () => {
      let wall = false
      let floor = false
      ;(window as any).__home.scene.traverse((o: any) => {
        const c = o.isMesh && o.material?.color?.getHexString?.()
        if (o.name === 'static-batch' && c === 'b9cbb0') wall = true
        if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && c === 'cfc8bb') floor = true
      })
      return wall && floor
    })

    // the standing lamp dragged into the doorway to the studio: it fits, with a word that it blocks the way
    await page.getByRole('tab', { name: 'Things' }).click()
    const door = (await shell(game)).openings.livingOffice.centre as number
    await drag(game, [-6.3, 1.0, 0.9], door - -6.3, 0 - 0.9, true)
    await until(game, () => (window as any).__home.home.decorate.useDecorate.getState().drag?.fit?.warn !== undefined)
    expect((await deco(game)).drag.fit).toEqual({ ok: true, warn: 'Blocks the way to the studio' })
    await expect(page.locator('.edit-card .fit-warn')).toBeVisible()
    await page.mouse.up()
    await until(game, () => Math.abs((window as any).__home.home.layout.pieces.find((p: any) => p.id === 'floor-lamp').z) < 0.3)
    const lamp = (await page.evaluate(() => (window as any).__home.home.layout.pieces.find((p: any) => p.id === 'floor-lamp'))) as { x: number; z: number }
    expect(Math.abs(lamp.x - door)).toBeLessThan(0.3)
    await expect(page.locator('.edit-card .fit-warn')).toHaveText('Blocks the way to the studio')
    // its light went with it
    await until(game, () => {
      const lamp = (window as any).__home.home.layout.pieces.find((p: any) => p.id === 'floor-lamp')
      let lit = false
      ;(window as any).__home.scene.traverse((o: any) => {
        if (o.isPointLight && Math.hypot(o.position.x - lamp.x, o.position.z - lamp.z) < 0.01 && Math.abs(o.position.y - 1.55) < 0.01) lit = true
      })
      return lit
    })

    // Done: down to your eyes; the closed doorway is a wall you walk into
    await page.keyboard.press('KeyB')
    await until(game, () => !(window as any).__home.useHome.getState().decorating && (window as any).__home.home.decorate.camera.blend === 0)
    await game.teleport(-1.0, 1.4, 3.0, -Math.PI / 2, 0)
    await game.hold('KeyW', 2500)
    expect(await page.evaluate(() => (window as any).__home.playerState.position.x)).toBeLessThan(-0.2)

    // a reload: the house as it was left
    const before = await shell(game)
    await page.evaluate(() => (window as any).__home.farm.saveFarm())
    await bootApp(page)
    await onMap(page, 'home')
    expect(await shell(game)).toEqual(before)
    const after = (await page.evaluate(() => (window as any).__home.home.layout.pieces.find((p: any) => p.id === 'floor-lamp'))) as { x: number; z: number }
    expect(after).toMatchObject({ x: lamp.x, z: lamp.z })
    await until(game, () => {
      let at: number | null = null
      ;(window as any).__home.scene.traverse((o: any) => {
        if (o.userData?.part === 'win-living-west-glass') at = o.position.z
      })
      return at !== null && Math.abs(at - (window as any).__home.home.shell().openings['win-living-west'].centre) < 1e-6
    })

    // today's house again for whatever runs next
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.apartment.owned = true
      f.state.place = 'home'
      f.saveFarm()
    })
    expect(game.errors).toEqual([])
  })
})
