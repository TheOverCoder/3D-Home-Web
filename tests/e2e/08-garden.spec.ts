/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// The kitchen garden behind the glass door: walking out, a bed from seed to harvest, buyers at the gate,
// building a bed, and the save. Time is fast-forwarded through the debug hook (__home.farm.tick).

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
const label = (game: Game) => game.page.evaluate(() => (window as any).__home.useHome.getState().nearby?.label as string | undefined)
const farm = (game: Game) => game.page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.farm.state)))
/** The effects' counts (src/fx): bursts started, bursts alive, coin flights, rewards shown in the world and their numbers;
 *  and whether their renderer is drawn. */
const fx = (game: Game) =>
  game.page.evaluate(() => {
    const h = (window as any).__home
    return { ...h.fx.stats, drawn: h.scene.getObjectByName('farm-fx')?.visible === true } as {
      loaded: boolean
      started: number
      alive: number
      coins: number
      rewards: number
      pops: number
      goods: number
      landed: number
      drawn: boolean
    }
  })
/** Waits for the effects engine, which is loaded a moment after the game starts playing. */
const fxReady = (game: Game) => until(game, () => (window as any).__home.fx?.stats.loaded === true, 60_000)

test.describe('garden', () => {
  test('the glass door opens as you come, and you can walk out into the house’s own garden', async ({ game }) => {
    await game.ready()
    const { page } = game
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
    // out in the house's garden, on its own map (the farm is a drive away): no bed, no buyer, nothing of the farm here
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().map)).toBe('home')
    const ids: string[] = await page.evaluate(() => (window as any).__home.interactables().map((d: any) => d.id))
    expect(ids.filter((id) => id.startsWith('farm-'))).toEqual([])
  })

  test('beds from seed to harvest: what is in reach is done in one press; a growing bed is a status, not an action', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.producers.tree.stock[0] = 0
      f.state.producers.hens.stock[0] = 0
    })
    const coins0 = (await farm(game)).coins
    // on the path, facing the first bed on the west side, looking down at the soil
    await game.teleport(-1.2, 1.4, 9.0, Math.PI / 2, -0.6)
    await nearbyIs(game, 'farm-bed-0')
    expect(await label(game)).toBe('Plant seeds')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'seeds')
    await page.keyboard.press('Digit1') // lettuce, in every empty bed within reach
    await until(game, () => (window as any).__home.useHome.getState().panel === null && (window as any).__home.farm.state.beds[0].crop === 'lettuce')
    const planted = ((await farm(game)).beds as { crop: string | null }[]).flatMap((b, i) => (b.crop === 'lettuce' ? [i] : []))
    expect(planted.length).toBeGreaterThan(1)
    expect((await farm(game)).coins).toBe(coins0 - 2 * planted.length)

    // growing: nothing to press here — the bed shows how long as a status, and the button offers nothing. A nest
    // with no room for another egg is a job elsewhere: it goes on the compass at the top (its picture, how many),
    // never on the button; a nest with room for more is not worth the walk yet
    const eggMark = () => (window as any).__home.useHome.getState().compass.find((m: any) => m.item === 'egg')
    await page.evaluate(() => ((window as any).__home.farm.state.producers.hens.stock[0] = 5))
    await until(game, () => /ready in/.test((window as any).__home.useHome.getState().status?.label ?? ''))
    expect(await page.evaluate(eggMark)).toBeUndefined()
    await page.evaluate(() => ((window as any).__home.farm.state.producers.hens.stock[0] = 6))
    await page.waitForFunction(eggMark, null, { timeout: 30_000, polling: 200 })
    expect(await page.evaluate(eggMark)).toMatchObject({ id: 'farm-nest', count: 6 })
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().actions)).toEqual([])
    // its mark, tapped, turns you to it and marks it in the world
    await page.getByRole('button', { name: /^6 eggs ready/ }).click()
    await page.waitForFunction(() => (window as any).__home.useHome.getState().guide?.id === 'farm-nest', null, { timeout: 30_000, polling: 200 })
    await page.evaluate(() => ((window as any).__home.farm.state.producers.hens.stock[0] = 0))
    await game.teleport(-1.2, 1.4, 9.0, Math.PI / 2, -0.6)

    // the soil dries out before the lettuce is ready: the beds ask for water, all watered in one press — with a splash
    // of water on each of them
    await page.evaluate(() => (window as any).__home.farm.tick(30))
    await until(game, () => (window as any).__home.farm.bedStage(0) === 'thirsty')
    await until(game, () => ((window as any).__home.useHome.getState().nearby?.label ?? '').startsWith('Water'))
    await fxReady(game)
    const watered = (await fx(game)).started
    await page.keyboard.press('KeyE')
    await page.waitForFunction((beds) => beds.every((i: number) => (window as any).__home.farm.bedStage(i) === 'growing'), planted, { timeout: 30_000, polling: 200 })
    await page.waitForFunction(([from, n]) => (window as any).__home.fx.stats.started >= from + n, [watered, planted.length], { timeout: 30_000, polling: 100 })

    // ripe: harvested together; then an empty bed opens the seed packets again (nothing plants itself)
    await page.evaluate(() => (window as any).__home.farm.tick(30))
    await until(game, () => ((window as any).__home.useHome.getState().nearby?.label ?? '').startsWith('Harvest'))
    expect(await label(game)).toBe(`Harvest ${planted.length} beds`)
    const harvested = (await fx(game)).started
    await page.keyboard.press('KeyE')
    await page.waitForFunction((n) => (window as any).__home.farm.state.inv.lettuce === 4 * n, planted.length, { timeout: 30_000, polling: 200 })
    // a pop of sparkles on each bed harvested; over in a moment, and then nothing of the effects is drawn
    await page.waitForFunction(([from, n]) => (window as any).__home.fx.stats.started >= from + n, [harvested, planted.length], { timeout: 30_000, polling: 100 })
    await until(game, () => (window as any).__home.fx.stats.alive === 0 && (window as any).__home.scene.getObjectByName('farm-fx')?.visible === false)
    expect((await farm(game)).beds[0].crop).toBeNull()
    await until(game, () => (window as any).__home.useHome.getState().nearby?.label === 'Plant seeds')
    // unless it is set to grow one crop: the gear on the bed you look at opens what it grows
    await page.locator('.thing-gear').click()
    await expect(page.locator('.farm-panel')).toContainText('This bed grows')
    await page.locator('.farm-panel .farm-card', { hasText: 'Lettuces' }).click()
    await expect(page.locator('.farm-panel')).toHaveCount(0)
    expect((await farm(game)).beds[0].fixed).toBe('lettuce')
    // the other beds here the same: then one press buys the seeds and plants every one of them
    await page.evaluate((beds) => beds.forEach((i: number) => (window as any).__home.farm.fixBed(i, 'lettuce')), planted)
    await until(game, () => ((window as any).__home.useHome.getState().nearby?.label ?? '').startsWith('Plant lettuces'))
    const coins1 = (await farm(game)).coins
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.beds[0].crop === 'lettuce')
    expect((await farm(game)).coins).toBe(coins1 - 2 * planted.length)
    // a number key plants another crop straight away (in the bed you look at: the others keep to lettuces)
    await page.evaluate(() => (window as any).__home.farm.state.beds.forEach((b: any) => b.crop && (b.growth = 1e6)))
    await until(game, () => ((window as any).__home.useHome.getState().nearby?.label ?? '').startsWith('Harvest'))
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.beds[0].crop === null)
    await page.keyboard.press('Digit2')
    await until(game, () => (window as any).__home.farm.state.beds[0].crop === 'carrot')
  })

  test('a harvest flies to the silo: one counted picture a bed, the silo stepping up as each lands; none with less motion or the top quiet', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await page.evaluate(() => {
      const h = (window as any).__home
      h.farm.reset()
      h.settings.getState().update({ hudMode: 'all' })
    })
    await game.teleport(-1.2, 1.4, 9.0, Math.PI / 2, -0.6)
    /** Beds 0 and 1 ripe with lettuces and harvested in the same frame: how many went into the silo. */
    const harvest = () =>
      page.evaluate(() => {
        const f = (window as any).__home.farm
        for (const i of [0, 1]) Object.assign(f.state.beds[i], { built: true, crop: 'lettuce', growth: 1e6, water: 1e6 })
        return (f.harvest(0) + f.harvest(1)) as number
      })
    /** A few frames drawn (what was asked is played by then). */
    const frames = async (n = 4) => {
      const at = await page.evaluate(() => (window as any).__home.view.stats.renders)
      await page.waitForFunction((f) => (window as any).__home.view.stats.renders > f, at + n, { timeout: 30_000, polling: 100 })
    }
    // what the test before sent (its harvest's pictures, asked within the software renderer's last slow frame) has
    // flown and landed: nothing held and nothing in the air
    await frames()
    await page.waitForFunction(() => (window as any).__home.fx.held('silo') === 0 && (window as any).__home.fx.held('barn') === 0 && !document.querySelector('.goods-pop'), null, {
      timeout: 30_000,
      polling: 100,
    })
    await page.evaluate(() => {
      // the pictures' flights at a quarter of their speed, so the software renderer's few frames a second see them fly
      // eslint-disable-next-line @typescript-eslint/unbound-method -- called with the element as `this` below
      const animate = Element.prototype.animate
      ;(window as any).__goodsFull = animate
      Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
        const a = animate.apply(this, args)
        if (this.classList.contains('goods-pop')) a.playbackRate = 0.25
        return a
      }
    })
    const s0 = await fx(game)
    expect(await harvest()).toBe(8)
    // one picture a bed, with how many in its badge, up from the beds and on to the silo's chip
    await page.waitForFunction((g) => (window as any).__home.fx.stats.goods >= g + 2, s0.goods, { timeout: 30_000, polling: 50 })
    await expect(page.locator('.goods-pop .qty').first()).toHaveText('4')
    // while they fly, the silo's tank leaves out what is still in the air (its words say all it holds), read at once
    const flying = await page.evaluate(() => {
      const h = (window as any).__home
      return { held: h.fx.held('silo') as number, landed: h.fx.stats.landed as number, label: document.querySelector('.top-gauge.silo')?.getAttribute('aria-label') ?? '' }
    })
    // (4 for each picture still in the air: one may be let go a moment before its landing is told, under the software
    // renderer's long frames)
    expect(flying.held).toBeGreaterThan(0)
    expect(flying.held).toBeLessThanOrEqual(8 - 4 * (flying.landed - s0.landed))
    expect(flying.held % 4).toBe(0)
    expect(flying.label).toMatch(/^Silo: 8 of /)
    // and as the last lands, it holds all of it
    await page.waitForFunction((l) => (window as any).__home.fx.stats.landed >= l + 2 && (window as any).__home.fx.held('silo') === 0, s0.landed, { timeout: 30_000, polling: 100 })
    expect((await fx(game)).goods).toBe(s0.goods + 2)

    // less motion: nothing flies, the count changes at once
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const s1 = await fx(game)
    expect(await harvest()).toBe(8)
    await frames()
    expect(await page.evaluate(() => (window as any).__home.fx.held('silo'))).toBe(0)
    expect((await fx(game)).goods).toBe(s1.goods)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    // only the compass at the top: no chip to fly to, so nothing flies
    await page.evaluate(() => (window as any).__home.settings.getState().update({ hudMode: 'compass' }))
    const s2 = await fx(game)
    expect(await harvest()).toBe(8)
    await frames()
    expect((await fx(game)).goods).toBe(s2.goods)
    expect(await page.evaluate(() => (window as any).__home.fx.held('silo'))).toBe(0)
    await page.evaluate(() => {
      ;(window as any).__home.settings.getState().update({ hudMode: 'all' })
      Element.prototype.animate = (window as any).__goodsFull
    })
  })

  test('buyers queue at the gate: Sell only with something they want (2/2), Enter sells to the first you can, N sends the first away and someone new comes', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.started = true
      f.state.nextVisitorIn = 600 // nobody else turns up on their own during the test
      f.state.inv.tomato = 1
      f.spawnVisitor({ want: 'tomato', qty: 3, offer: 12, from: 1 })
      f.spawnVisitor({ want: 'tomato', qty: 2, offer: 3, from: -1 })
      for (let i = 0; i < 600 && f.state.visitors.some((v: any) => v.phase !== 'queued'); i++) f.tick(0.25)
    })
    const [first, second] = (await farm(game)).visitors
    expect([first.phase, second.phase]).toEqual(['queued', 'queued'])
    const coins0 = (await farm(game)).coins
    // inside the gate, facing the lane, with one tomato: nobody can be served, so no Sell — a status shows what the
    // line wants that the basket lacks (one more tomato serves the second buyer)
    await game.teleport(5.6, 1.4, 12.3, Math.PI, -0.05)
    await until(game, () => (window as any).__home.useHome.getState().status?.id === 'farm-queue')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().actions)).toEqual([])
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().status)).toMatchObject({ icon: { verb: 'wait' }, needs: [{ item: 'tomato', count: 1 }] })
    await expect(page.locator('.prompt.status .item-pic .qty')).toHaveText(['1'])
    // with five, both: one Sell for the line, its picture with how many of it you can serve of how many wait
    await page.evaluate(() => ((window as any).__home.farm.state.inv.tomato = 5))
    await nearbyIs(game, 'farm-queue')
    expect(await label(game)).toBe('Sell to 2 of 2 buyers')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().nearby.icon)).toMatchObject({ verb: 'sell', art: 'people-queue', count: 2, of: 2 })
    await expect(page.locator('.prompt .prompt-count')).toHaveText('2/2')
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'queue')
    await expect(page.locator('.farm-buyer')).toHaveCount(2)
    const before = await fx(game)
    const flights = before.coins
    await page.keyboard.press('Enter')
    await until(game, () => (window as any).__home.farm.state.inv.tomato === 2)
    // the coins fly from the buyer to the coin chip at the top (the count has already gone up), and are gone again
    await page.waitForFunction((n) => (window as any).__home.fx.stats.coins > n, flights, { timeout: 30_000, polling: 100 })
    await expect(page.locator('.coin-fly')).toHaveCount(0, { timeout: 30_000 })
    // and over the buyer its number pops up ("+12", as big as the sale), only for the eye: one sale, one number
    await page.waitForFunction((n) => (window as any).__home.fx.stats.rewards > n, before.rewards, { timeout: 30_000, polling: 100 })
    expect(await fx(game)).toMatchObject({ rewards: before.rewards + 1, pops: before.pops + 1 })
    await expect(page.locator('.pop-num')).toHaveCount(0, { timeout: 30_000 })
    let f = await farm(game)
    expect(f.coins).toBe(coins0 + 12)
    expect(f.visitors.find((v: any) => v.id === first.id)?.phase ?? 'gone').toBe('leaving')
    // the panel stays open for the rest of the line
    await expect(page.locator('.farm-buyer')).toHaveCount(1)

    // the next one is sent away: nothing changes hands, they walk off, and a new buyer is due soon
    await page.keyboard.press('KeyN')
    await until(game, () => (window as any).__home.farm.state.visitors.every((v: any) => v.phase === 'leaving'))
    f = await farm(game)
    expect(f.coins).toBe(coins0 + 12)
    expect(f.inv.tomato).toBe(2)
    expect(f.stats.declined).toBe(1)
    expect(f.nextVisitorIn).toBeLessThanOrEqual(8)
    await page.evaluate(() => (window as any).__home.farm.tick(8.5))
    await until(game, () => (window as any).__home.farm.state.visitors.some((v: any) => v.phase === 'arriving'))
    await page.keyboard.press('Escape')
    await until(game, () => (window as any).__home.useHome.getState().panel === null)
    expect(second.id).toBeGreaterThan(first.id)

    // the whole line sold at once is one reward: one number over the gate with every coin of the line, not one a buyer
    const line = await fx(game)
    const sold = await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.inv.tomato = 30
      for (const offer of [7, 8, 9]) f.spawnVisitor({ want: 'tomato', qty: 2, offer, queued: true, gift: false })
      return f.sellAll()
    })
    expect(sold).toBeGreaterThanOrEqual(3)
    await page.waitForFunction((n) => (window as any).__home.fx.stats.rewards > n, line.rewards, { timeout: 30_000, polling: 100 })
    expect(await fx(game)).toMatchObject({ rewards: line.rewards + 1, pops: line.pops + 1 })
  })

  test('a staked-out bed carries a price tag, not an action; its card builds it, and the farm is saved', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.coins = 40
    })
    // the last bed on the east side starts as a staked-out plot: looked at, it carries a price tag with a coin and
    // 30 on it, and the button never offers it (it does what is in reach instead: the empty bed beside it)
    await game.teleport(-1.2, 1.4, 11.6, -Math.PI / 2, -0.6)
    await until(game, () => (window as any).__home.useHome.getState().tag?.id === 'farm-bed-5')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().tag)).toMatchObject({ kind: 'price', price: 30, label: 'Build a bed · 30 coins' })
    await expect(page.locator('.thing-price')).toContainText('30')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().actions.map((a: any) => a.id))).not.toContain('farm-bed-5')
    // G (or a tap on the tag) only asks: a card with the price; nothing is spent until its Build button is pressed
    await page.keyboard.press('KeyG')
    await until(game, () => (window as any).__home.useHome.getState().panel?.kind === 'build')
    await page.keyboard.press('KeyE')
    expect((await farm(game)).coins).toBe(40)
    await fxReady(game)
    const built = (await fx(game)).started
    await page.locator('.farm-buy:not(.arming)').click() // armed a moment after the card opens
    await until(game, () => (window as any).__home.farm.state.beds[5].built === true)
    // a puff of dust round the new bed
    await page.waitForFunction((n) => (window as any).__home.fx.stats.started > n, built, { timeout: 30_000, polling: 100 })
    expect((await farm(game)).coins).toBe(10)
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().panel)).toBeNull()
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
