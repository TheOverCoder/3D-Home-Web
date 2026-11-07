/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// The kitchen garden behind the glass door: walking out, a bed from seed to harvest, buyers at the gate,
// building a bed, and the save. Time is fast-forwarded through the debug hook (__home.farm.tick).

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) =>
  game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
const label = (game: Game) => game.page.evaluate(() => (window as any).__home.useHome.getState().nearby?.label as string | undefined)
const farm = (game: Game) => game.page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.farm.state)))

test.describe('garden', () => {
  test('the glass door opens as you come, and you can walk out into the garden', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => (window as any).__home.farm.reset())
    // inside the living room, a few steps from the door, facing it (south)
    await game.teleport(-1.2, 1.4, 4.2, Math.PI, 0)
    await until(game, () => (window as any).__home.gardenDoor.open > 0.9)
    await page.keyboard.down('KeyW')
    try {
      await until(game, () => (window as any).__home.useHome.getState().outdoors === true && (window as any).__home.playerState.position.z > 7.2, 60_000)
    } finally {
      await page.keyboard.up('KeyW')
    }
    // the eyes came out with the body (the camera is not held back behind the wall)
    expect(await page.evaluate(() => (window as any).__home.camera.position.z)).toBeGreaterThan(6.5)
  })

  test('a bed from seed to harvest: plant with E and a number key, water when it asks, harvest when ripe', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => (window as any).__home.farm.reset())
    const coins0 = (await farm(game)).coins
    // on the path, facing the first bed on the west side, looking down at the soil
    await game.teleport(-1.2, 1.4, 9.0, Math.PI / 2, -0.6)
    await nearbyIs(game, 'farm-bed-0')
    expect(await label(game)).toBe('Plant seeds')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'seeds')
    await page.keyboard.press('Digit1') // lettuce
    await until(game, () => (window as any).__home.useHome.getState().panel === null && (window as any).__home.farm.state.beds[0].crop === 'lettuce')
    expect((await farm(game)).coins).toBe(coins0 - 2)

    // the soil dries out before the lettuce is ready: the bed asks for water and growth stops
    await page.evaluate(() => (window as any).__home.farm.tick(30))
    await until(game, () => (window as any).__home.farm.bedStage(0) === 'thirsty')
    await until(game, () => /^Water the lettuces/.test((window as any).__home.useHome.getState().nearby?.label ?? ''))
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.bedStage(0) === 'growing')

    await page.evaluate(() => (window as any).__home.farm.tick(30))
    await until(game, () => /^Harvest 4 lettuces/.test((window as any).__home.useHome.getState().nearby?.label ?? ''))
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.inv.lettuce === 4)
    expect((await farm(game)).beds[0].crop).toBeNull()
  })

  test('a buyer comes to the gate: Enter sells at their price, N sends the next one away', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.inv.tomato = 5
      f.spawnVisitor({ want: 'tomato', qty: 3, offer: 12, from: 1 })
      for (let i = 0; i < 200 && f.state.visitors[0].phase !== 'waiting'; i++) f.tick(0.25)
    })
    const first = (await farm(game)).visitors[0]
    expect(first.phase).toBe('waiting')
    const coins0 = (await farm(game)).coins
    // inside the gate, facing the lane
    await game.teleport(5.6, 1.4, 12.3, Math.PI, -0.05)
    await nearbyIs(game, `farm-visitor-${first.id}`)
    expect(await label(game)).toContain('3 tomatoes for 12 coins')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'offer')
    await page.keyboard.press('Enter')
    await until(game, () => (window as any).__home.farm.state.inv.tomato === 2)
    let f = await farm(game)
    expect(f.coins).toBe(coins0 + 12)
    expect(f.visitors.find((v: any) => v.id === first.id)?.phase ?? 'gone').not.toBe('waiting')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().panel)).toBeNull()

    // the next one is turned down: nothing changes hands and they walk off
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.visitors.length = 0
      f.spawnVisitor({ want: 'tomato', qty: 2, offer: 3, from: -1 })
      for (let i = 0; i < 200 && f.state.visitors[0].phase !== 'waiting'; i++) f.tick(0.25)
    })
    const second = (await farm(game)).visitors[0]
    await nearbyIs(game, `farm-visitor-${second.id}`)
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'offer')
    await page.keyboard.press('KeyN')
    await until(game, () => (window as any).__home.farm.state.visitors.every((v: any) => v.phase === 'leaving'))
    f = await farm(game)
    expect(f.coins).toBe(coins0 + 12)
    expect(f.inv.tomato).toBe(2)
    expect(f.stats.declined).toBe(1)
  })

  test('a locked bed can be built once you have the coins, and the farm is saved', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.coins = 40
    })
    // the last bed on the east side starts as a staked-out plot
    await game.teleport(-1.2, 1.4, 11.6, -Math.PI / 2, -0.6)
    await nearbyIs(game, 'farm-bed-5')
    expect(await label(game)).toBe('Build a bed · 30 coins')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.beds[5].built === true)
    expect((await farm(game)).coins).toBe(10)
    // saved a moment later
    await until(game, () => {
      try {
        const saved = JSON.parse(localStorage.getItem('3d-home:farm:v1') ?? 'null')
        return saved?.coins === 10 && saved?.beds?.[5]?.built === true
      } catch {
        return false
      }
    })
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
