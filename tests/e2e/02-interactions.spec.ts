/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

/** Waits until the aimed-at thing is offered, in first person. */
async function expectNearby(game: Game, id: string) {
  await game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
}

const until = (game: Game, expr: () => boolean) => game.page.waitForFunction(expr, null, { timeout: 30_000, polling: 250 })

test.describe('interactions (first person, aim based)', () => {
  test('TV in the living room: offered, E opens, Esc closes', async ({ game }) => {
    await game.ready()
    // the living-room screen hangs on the south wall; stand in front of it looking south (yaw PI)
    await game.teleport(-3.5, 1.4, 4.8, Math.PI, 0)
    await expectNearby(game, 'screen-living')
    await game.page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().screen === 'screen-living')
    await game.page.keyboard.press('Escape')
    await until(game, () => (window as any).__home.useHome.getState().screen === null)
    expect((await game.state()).settingsOpen).toBe(false)
  })

  test('notebook at the desk can be picked up and dropped', async ({ game }) => {
    await game.ready()
    // the notebook lies on the studio desk; face north (yaw 0) from the south side, looking slightly down
    await game.teleport(-2.9, 1.4, -4.2, 0, -0.5)
    await expectNearby(game, 'item-book')
    await game.page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().carrying === 'item-book')
    // carrying: E with nothing in view drops it
    await game.teleport(-2.9, 1.4, -3.0, Math.PI / 2, 1.3) // looking at the ceiling: nothing in view
    await until(game, () => (window as any).__home.useHome.getState().nearby == null)
    await game.page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().carrying === null)
    expect(await game.state().then((s) => s.items['item-book'].rev)).toBeGreaterThan(0)
  })

  test('floor lamp toggles', async ({ game }) => {
    await game.ready()
    // the floor lamp stands in the west of the living room; face west (yaw PI/2)
    await game.teleport(-5.4, 1.4, 0.9, Math.PI / 2, 0)
    await expectNearby(game, 'lamp-floor')
    expect((await game.state()).lamps['lamp-floor']).toBe(true)
    await game.page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().lamps['lamp-floor'] === false)
    await game.page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().lamps['lamp-floor'] === true)
  })

  test('kitchen <-> bedroom door opens and closes', async ({ game }) => {
    await game.ready()
    // stand in the kitchen in front of the door (wall z=0), looking south (yaw PI)
    await game.teleport(3.5, 1.4, -1.0, Math.PI, 0)
    await expectNearby(game, 'door-kitchen-bedroom')
    await game.page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().doors['door-kitchen-bedroom'] === true)
    await game.page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().doors['door-kitchen-bedroom'] === false)
  })
})
