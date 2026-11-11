/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, bootApp, fillShelves, watchErrors, BASE, type Game } from './helpers'
import { bounds, WALK_INS, type Rect } from '../../src/data/buildings'
import { CONTRACTOR_STAND, DESK_STAND, HALL, LOT, MANAGER_SPOT, MANAGER_STAND, SCREEN, TILL } from '../../src/data/market'
import { LADDERS, MANAGER, SHOP, XP_FOR, produceById } from '../../src/farm/data'
import { ladderPrice, managerPct, snapPct, unitPrice } from '../../src/farm/market'
import { xpForSale } from '../../src/farm/xp'

// The supermarket across the lane, behind the buyers' line (src/data/market.ts; src/farm/market.ts, Market.tsx,
// MarketPanel.tsx): through the garden's gate onto the lane and in at its door. Before it is yours, its manager buys
// what the farm makes at his share of the fair price (rounded down); his rate is a ladder, and at its top he sells you
// the shop. Then its places on the shelves are yours to stock from the silo and the barn and to price; shoppers come
// by, take what they like (the farm's dice) and pay into the till, which pays you coins and XP. Time is moved on with
// __home.farm.tick, and every number is read in the same call that moves it (the farm ticks every frame).

const MARKET = WALK_INS.find((w) => w.id === 'market')!
const P = Math.PI
const EYE = 1.62

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
const panelIs = (game: Game, kind: string) => game.page.waitForFunction((kind) => (window as any).__home.useHome.getState().panel?.kind === kind, kind, { timeout: 30_000, polling: 200 })
const closePanel = (page: Page) => page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
const farm = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.farm.state, (k, v) => (k === 'visitors' ? undefined : v))))
const xp = (page: Page) => page.evaluate(() => (window as any).__home.farm.xpNow().points as number)
/** The yaw that looks from (x, z) towards (tx, tz) (yaw 0 looks north, along −z; π/2 west). */
const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z))

/** A new farm at noon, its silo and barn holding `inv`, `coins` to spend, the dice the farm's own. */
const reset = (game: Game, inv: Record<string, number> = {}, coins = 200) =>
  game.page.evaluate(
    ([inv, coins]) => {
      const f = (window as any).__home.farm
      f.setRandom(null)
      f.reset()
      f.setHour?.(12)
      f.tick(0.01)
      Object.assign(f.state.inv, inv)
      f.state.coins = coins
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    },
    [inv, coins] as const,
  )

/** A new farm whose supermarket is yours: the manager's rate at its top, the shop bought from him. */
async function ownShop(game: Game, inv: Record<string, number> = {}, coins = 200) {
  await reset(game, inv, MANAGER.shopPrice)
  const bought = await game.page.evaluate(
    ([top, coins]) => {
      const f = (window as any).__home.farm
      f.state.ladders.rate = top
      const ok = f.buyMarket()
      f.state.coins = coins
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
      return ok
    },
    [LADDERS.rate.levels, coins] as const,
  )
  expect(bought, 'the shop bought from the manager').toBe(true)
}

/** Holds W until the body's x or z is past `at` (beyond it, or short of it), within a minute. */
async function walkUntil(game: Game, axis: 'x' | 'z', beyond: boolean, at: number) {
  await game.page.keyboard.down('KeyW')
  try {
    await game.page.waitForFunction(
      ([axis, beyond, at]) => {
        const v = (window as any).__home.playerState.position[axis] as number
        return beyond ? v > at : v < at
      },
      [axis, beyond, at] as const,
      { timeout: 60_000, polling: 200 },
    )
  } finally {
    await game.page.keyboard.up('KeyW')
  }
}

/** Whether `id` is offered — on the button, among the actions, or as a status — at any moment in the next `ms`. */
const everOffered = (page: Page, id: string, ms: number) =>
  page.evaluate(
    ([id, ms]) =>
      new Promise<boolean>((done) => {
        const h = (window as any).__home
        const hit = (s: any) => s.nearby?.id === id || s.status?.id === id || s.actions.some((a: any) => a.id === id)
        let seen = hit(h.useHome.getState())
        const off = h.useHome.subscribe((s: any) => {
          if (hit(s)) seen = true
        })
        setTimeout(() => {
          off()
          done(seen)
        }, ms)
      }),
    [id, ms] as const,
  )

/** For each thing, whether it is within reach of where you stand, measured as the action button measures it: on the
 *  ground, from the edge of its footprint. */
const inReach = (page: Page, ids: string[]) =>
  page.evaluate((ids) => {
    const h = (window as any).__home
    const p = h.playerState.position
    return ids.map((id) => {
      const t = h.walk.target(id)
      if (!t) return false
      const d = Math.hypot(Math.max(0, Math.abs(p.x - t.position.x) - (t.box?.x ?? 0)), Math.max(0, Math.abs(p.z - t.position.z) - (t.box?.z ?? 0)))
      return d <= t.radius
    })
  }, ids)

/** Where the camera is, every frame for `ms`. */
const cameraFor = (page: Page, ms: number) =>
  page.evaluate(
    (ms) =>
      new Promise<{ x: number; y: number; z: number }[]>((done) => {
        const c = (window as any).__home.camera.position
        const out: { x: number; y: number; z: number }[] = []
        const end = performance.now() + ms
        const f = () => {
          out.push({ x: c.x, y: c.y, z: c.z })
          if (performance.now() < end) requestAnimationFrame(f)
          else done(out)
        }
        requestAnimationFrame(f)
      }),
    ms,
  )
const within = (r: Rect, p: { x: number; z: number }, margin = 0) => p.x >= r.x0 - margin && p.x <= r.x1 + margin && p.z >= r.z0 - margin && p.z <= r.z1 + margin

/** Standing in front of the manager (behind his desk in the back room), looking at him. */
const atManager = (game: Game) => game.teleport(MANAGER_STAND.x, 1.4, MANAGER_STAND.z, yawTo(MANAGER_STAND.x, MANAGER_STAND.z, MANAGER_SPOT.x, MANAGER_SPOT.z), -0.15)
/** Standing at the desk, looking at the computer's screen. */
const atComputer = (game: Game) =>
  game.teleport(DESK_STAND.x, 1.4, DESK_STAND.z, yawTo(DESK_STAND.x, DESK_STAND.z, SCREEN.x, SCREEN.z), Math.atan2(SCREEN.y - EYE, Math.hypot(SCREEN.x - DESK_STAND.x, SCREEN.z - DESK_STAND.z)))
/** Standing at the counter, looking at the till on it. */
const TILL_STAND = { x: TILL.x - 0.1, z: HALL.z0 + 1.1 }
/** Before the contractor's window: his counter board stops you a little east of CONTRACTOR_STAND (within reach). */
const AT_WINDOW = { x: CONTRACTOR_STAND.x + 0.1, z: CONTRACTOR_STAND.z }
const atTill = (game: Game) => game.teleport(TILL_STAND.x, 1.4, TILL_STAND.z, yawTo(TILL_STAND.x, TILL_STAND.z, TILL.x, TILL.z), -0.4)

test.describe('the supermarket', () => {
  test('through the gate onto the lane and back; the lot holds you in at its edges; inside, nothing puts you back', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game)
    // in the garden, a few steps north of the gate, facing it (south): the gate opens as you come, out onto the lane
    await game.teleport(5.6, 1.4, 11.8, P, 0)
    await walkUntil(game, 'z', true, 14.2)
    // and back in
    await game.teleport(5.6, 1.4, 14.4, 0, 0)
    await walkUntil(game, 'z', false, 12.2)
    // the lot's edges, where no wall of the market stands: west, east, south of the lane west of the hall, and round
    // the contractor's corner
    const [lane, corner] = LOT
    for (const [name, x, z, yaw, ok] of [
      ['west', lane.x0 + 0.7, 15, P / 2, (p: any) => p.x > lane.x0 - 0.05],
      ['east', lane.x1 - 0.7, 15, -P / 2, (p: any) => p.x < lane.x1 + 0.05],
      ['south, west of the hall', lane.x0 + 0.9, lane.z1 - 0.8, P, (p: any) => p.z < lane.z1 + 0.05],
      ["the corner's south", AT_WINDOW.x, corner.z0 + 0.5, P, (p: any) => p.z < corner.z1 + 0.05],
      ["the corner's east", AT_WINDOW.x, AT_WINDOW.z, -P / 2, (p: any) => p.x < corner.x1 + 0.05],
    ] as const) {
      await game.teleport(x, 1.4, z, yaw, 0)
      await game.hold('KeyW', 2500)
      const p = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
      expect(ok(p), `the lot's ${name} edge holds you in: at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`).toBe(true)
    }
    // anywhere inside either room, the corner and the lane, the safety net leaves you where you are
    for (const [name, x, z] of [
      ['the hall', 10.0, 18.8],
      ['the back room', 11.6, 21.4],
      ["the contractor's corner", AT_WINDOW.x, AT_WINDOW.z],
      ['the lane', 10.0, 15.0],
    ] as const) {
      await game.teleport(x, 1.4, z, 0, 0)
      await page.waitForTimeout(2500)
      const p = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
      expect(Math.hypot(p.x - x, p.z - z), `${name}: still there`).toBeLessThan(0.5)
    }
  })

  test('the manager pays his share of the fair price, rounded down; a sale of nothing is not made; no building materials', async ({ game }) => {
    await game.ready()
    await reset(game, { lettuce: 5, carrot: 1, tomato: 7, egg: 3, milk: 1, brick: 2 }, 2000)
    const r = await game.page.evaluate(() => {
      const f = (window as any).__home.farm
      const s = () => ({ coins: f.state.coins, sold: f.state.stats.sold, earned: f.state.stats.earned, xp: f.xpNow().points, inv: { ...f.state.inv } })
      const start = s()
      // one carrot at 20 % pays nothing: nothing changes hands; a brick is not his to buy
      const carrot = f.sellToManager('carrot')
      const brick = f.sellToManager('brick')
      const nothing = s()
      // five lettuces
      const lettuce = f.sellToManager('lettuce')
      const afterLettuce = s()
      // his rate up to its top, one step at a time; the shop's own ladders stay shut while the shop is his
      const steps: boolean[] = []
      while (f.ladderOpen('rate') && steps.length < 10) steps.push(f.buyLadder('rate'))
      const shut = ['places', 'group', 'pace'].map((id) => f.ladderOpen(id))
      const afterRate = s()
      // at 40 %: the tomatoes, then everything else he pays anything for (the carrot still nothing)
      const tomato = f.sellToManager('tomato')
      const all = f.sellAllToManager()
      return { start, carrot, brick, nothing, lettuce, afterLettuce, steps, top: f.state.ladders.rate, open: f.ladderOpen('rate'), again: f.buyLadder('rate'), shut, afterRate, tomato, all, end: s() }
    })
    expect(r.carrot).toBe(0)
    expect(r.brick).toBe(0)
    expect(r.nothing).toEqual(r.start)
    // 5 lettuces worth 3 each at 20 %: 3 coins (3.0); sales count as sold and earned, and give XP for their coins
    expect(r.lettuce).toBe(3)
    expect(r.afterLettuce.coins).toBe(r.start.coins + 3)
    expect(r.afterLettuce.inv.lettuce).toBe(0)
    expect(r.afterLettuce.sold).toBe(r.start.sold + 5)
    expect(r.afterLettuce.earned).toBe(r.start.earned + 3)
    expect(r.afterLettuce.xp).toBe(r.start.xp + xpForSale(3))
    // the rate ladder: each step at its price, worth a build's XP; at its top no more
    expect(r.steps).toEqual(Array.from({ length: LADDERS.rate.levels }, () => true))
    expect(r.top).toBe(LADDERS.rate.levels)
    expect(r.open).toBe(false)
    expect(r.again).toBe(false)
    expect(r.shut).toEqual([false, false, false])
    const ladder = Array.from({ length: LADDERS.rate.levels }, (_, k) => ladderPrice('rate', k)).reduce((a, b) => a + b, 0)
    expect(r.afterRate.coins).toBe(r.afterLettuce.coins - ladder)
    expect(r.afterRate.xp).toBe(r.afterLettuce.xp + LADDERS.rate.levels * XP_FOR.build)
    // 7 tomatoes worth 3 at 40 %: 8 coins (8.4); then 3 eggs (2.4 → 2) and a bottle of milk (1.6 → 1); the carrot stays
    expect(managerPct(LADDERS.rate.levels)).toBe(40)
    expect(r.tomato).toBe(8)
    expect(r.all).toBe(3)
    expect(r.end.inv).toMatchObject({ tomato: 0, egg: 0, milk: 0, carrot: 1, brick: 2 })
    expect(r.end.coins).toBe(r.afterRate.coins + 8 + 3)
  })

  test("the manager's panel: buying the shop is there from the first visit, shut below 40 %; holding bricks, Go there walks you to the contractor", async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, { lettuce: 5, brick: 2 }, MANAGER.shopPrice + 100)
    await atManager(game)
    await nearbyIs(game, 'farm-market-manager')
    await page.keyboard.press('KeyE')
    await panelIs(game, 'manager')
    const panel = page.locator('.farm-panel[aria-label="The manager"]')
    await expect(panel).toBeVisible()
    // the shop's row: its price, shut, and what it waits for (his rate at 40 %)
    const buy = panel.getByRole('button', { name: /Buy the shop/ })
    await expect(buy).toBeVisible()
    await expect(buy).toBeDisabled()
    await expect(panel).toContainText(String(MANAGER.shopPrice))
    await expect(panel).toContainText(`${managerPct(LADDERS.rate.levels)}%`)
    // a building material in the barn: the way to the contractor, who buys them
    await panel.getByRole('button', { name: /Go there/ }).click()
    await until(game, () => (window as any).__home.useHome.getState().panel === null)
    expect(await page.evaluate(() => (window as any).__home.walk.state().id)).toBe('farm-contractor')
    await page.waitForFunction(() => (window as any).__home.walk.state().ended !== null, null, { timeout: 240_000, polling: 250 })
    expect(await page.evaluate(() => (window as any).__home.walk.state().ended)).toBe('arrived')
    // he is there at noon: his window offers his panel
    await nearbyIs(game, 'farm-contractor')
  })

  test('his rate to its top, then the shop bought — its price tag on the computer, or his panel, through a card that asks; he walks out and the computer is yours', async ({ game }) => {
    await game.ready()
    const { page } = game
    const ladder = Array.from({ length: LADDERS.rate.levels }, (_, k) => ladderPrice('rate', k))
    const total = ladder.reduce((a, b) => a + b, 0) + MANAGER.shopPrice + 100
    await reset(game, {}, total)
    // below the top, the computer has no price tag
    await atComputer(game)
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().tag?.id ?? null)).not.toBe('farm-market-computer')
    // the first step from its card (the rate's row opens it): its Buy arms a moment after it opens
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'ladder', id: 'rate' }))
    await panelIs(game, 'ladder')
    await page.waitForTimeout(600)
    await page.locator('.farm-confirm .farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.ladders.rate === 1)
    let f = await farm(game.page)
    expect(f.coins).toBe(total - ladder[0])
    expect(await xp(page)).toBe(XP_FOR.build)
    await closePanel(page)
    // the rest at once, to the top
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      while (f.ladderOpen('rate')) f.buyLadder('rate')
    })
    f = await farm(game.page)
    expect(f.ladders.rate).toBe(LADDERS.rate.levels)
    expect(f.coins).toBe(total - ladder.reduce((a, b) => a + b, 0))
    // at the top: the computer carries the shop's price tag; it offers nothing itself (it is for sale)
    await until(game, () => (window as any).__home.useHome.getState().tag?.id === 'farm-market-computer')
    const tag = await page.evaluate(() => (window as any).__home.useHome.getState().tag)
    expect(tag).toMatchObject({ kind: 'price', price: MANAGER.shopPrice })
    expect(await everOffered(page, 'farm-market-computer', 1500)).toBe(false)
    // G opens the card that asks; closed, nothing spent
    await page.keyboard.press('KeyG')
    await panelIs(game, 'market-buy')
    await closePanel(page)
    expect((await farm(game.page)).market.owned).toBe(false)
    // the manager stays at his desk, and his panel's row now opens the same card: bought there
    await atManager(game)
    await nearbyIs(game, 'farm-market-manager')
    await page.keyboard.press('KeyE')
    await panelIs(game, 'manager')
    const xp0 = await xp(page)
    await page
      .locator('.farm-panel[aria-label="The manager"]')
      .getByRole('button', { name: /Buy the shop/ })
      .click()
    await panelIs(game, 'market-buy')
    await page.waitForTimeout(600)
    await page.locator('.farm-confirm .farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.market.owned === true)
    f = await farm(game.page)
    expect(f.coins).toBe(100)
    expect(await xp(page)).toBe(xp0 + XP_FOR.shop)
    // he waves, walks out through the hall and the front door onto the lane, and is gone
    const out = await page.evaluate(() => {
      const f = (window as any).__home.farm
      let walked = false
      let north = Infinity
      let s = 0
      for (; s < 720 && f.managerNow(); s++) {
        f.tick(0.25)
        const m = f.managerNow()
        if (m?.walking) walked = true
        if (m) north = Math.min(north, m.z)
      }
      return { walked, north, gone: f.managerNow() === null, seconds: s / 4 }
    })
    expect(out.walked).toBe(true)
    expect(out.north, 'he left by the front door').toBeLessThan(HALL.z0)
    expect(out.gone).toBe(true)
    // the computer is yours: it opens your shop
    await atComputer(game)
    await nearbyIs(game, 'farm-market-computer')
    await page.keyboard.press('KeyE')
    await panelIs(game, 'market')
    await expect(page.locator('.farm-panel[aria-label="Your shop"]')).toBeVisible()
    await closePanel(page)
  })

  test('stocking the shelves: from the silo and the barn, one good a place, priced in steps; emptied back past full; no XP', async ({ game }) => {
    await game.ready()
    await ownShop(game, { lettuce: 10, egg: 2, brick: 3 })
    const r = await game.page.evaluate(() => {
      const f = (window as any).__home.farm
      const m = () => f.state.market
      const xp0 = f.xpNow().points
      const lettuce = f.fillPlace(0, 'lettuce', 3)
      const shelf = { ...m().shelves[0] }
      const left = f.state.inv.lettuce
      // a place's good changes only when it is empty; the shelves hold only what sells; a place not open holds nothing
      const swap = f.fillPlace(0, 'egg', 1)
      const material = f.fillPlace(1, 'brick', 1)
      const closed = f.fillPlace(3, 'egg', 1)
      // as many as there are
      const eggs = f.fillPlace(1, 'egg', 3)
      // prices: snapped to their step, within their range
      const pcts = [155, 1000, 10].map((p) => {
        f.setPlacePrice(0, p)
        return m().shelves[0].pct as number
      })
      // the silo full, the place emptied: all of it back all the same
      f.state.inv.wheat += f.capacity('silo') - f.used('silo')
      const emptied = f.emptyPlace(0)
      const silo = { used: f.used('silo'), capacity: f.capacity('silo'), lettuce: f.state.inv.lettuce }
      const xp1 = f.xpNow().points
      // a step of the places ladder: a fourth place
      f.state.coins = 1000
      const bought = f.buyLadder('places')
      const fourth = f.fillPlace(3, 'lettuce', 3)
      return { lettuce, shelf, left, swap, material, closed, eggs, pcts, emptied, silo, xp: xp1 - xp0, bought, fourth }
    })
    expect(r.lettuce).toBe(SHOP.units)
    expect(r.shelf).toEqual({ good: 'lettuce', units: SHOP.units, pct: SHOP.pct.start })
    expect(r.left).toBe(10 - SHOP.units)
    expect([r.swap, r.material, r.closed]).toEqual([0, 0, 0])
    expect(r.eggs).toBe(2)
    expect(r.pcts).toEqual([snapPct(155), SHOP.pct.max, SHOP.pct.min])
    expect(r.emptied).toBe(SHOP.units)
    expect(r.silo.lettuce).toBe(10)
    expect(r.silo.used).toBeGreaterThan(r.silo.capacity)
    expect(r.xp, 'stocking, prices and emptying give no XP').toBe(0)
    expect(r.bought).toBe(true)
    expect(r.fourth).toBe(SHOP.units)
  })

  test('a bay: never set, it opens its card; sold out, one press restocks every sold-out bay in reach', async ({ game }) => {
    await game.ready()
    const { page } = game
    await ownShop(game, { lettuce: 9 })
    // in the hall before the shelves along its south wall, looking at the middle bays
    await game.teleport(7.8, 1.4, 19.3, P, -0.35)
    await page.waitForFunction(() => /^farm-market-bay-\d+$/.test((window as any).__home.useHome.getState().nearby?.id ?? ''), null, { timeout: 60_000, polling: 250 })
    const first = await page.evaluate(() => (window as any).__home.useHome.getState().nearby.id as string)
    await page.keyboard.press('KeyE')
    await panelIs(game, 'market-place')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().panel.place)).toBe(Number(first.split('-').pop()))
    await closePanel(page)
    // the three places facing the door set to lettuce and sold out
    await page.evaluate((pct) => {
      const f = (window as any).__home.farm
      for (const k of [0, 1, 2]) f.state.market.shelves[k] = { good: 'lettuce', units: 0, pct }
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    }, SHOP.pct.start)
    await page.waitForFunction(
      () => {
        const n = (window as any).__home.useHome.getState().nearby
        return /^farm-market-bay-\d+$/.test(n?.id ?? '') && n.icon?.item === 'lettuce'
      },
      null,
      { timeout: 60_000, polling: 250 },
    )
    const ids = [0, 1, 2].map((k) => `farm-market-bay-${k}`)
    const reach = await inReach(page, ids)
    const n = reach.filter(Boolean).length
    expect(n, 'more than one sold-out bay in reach').toBeGreaterThan(1)
    // the button shows the good and how many go up with one press
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().nearby.icon.count)).toBe(n * SHOP.units)
    const xp0 = await xp(page)
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.market.shelves.some((s: any) => s.units > 0))
    const f = await farm(page)
    for (const [k, near] of reach.entries()) expect(f.market.shelves[k].units, `bay ${k}${near ? ' (in reach)' : ''}`).toBe(near ? SHOP.units : 0)
    expect(f.inv.lettuce).toBe(9 - n * SHOP.units)
    expect(await xp(page), 'restocking gives no XP').toBe(xp0)
  })

  test('shoppers (the dice always yes) buy everything on the shelves into the till; through the wall the till is not offered; it pays coins and XP', async ({ game }) => {
    await game.ready()
    const { page } = game
    await ownShop(game, { lettuce: 3 * SHOP.units })
    const r = await page.evaluate((units) => {
      const f = (window as any).__home.farm
      for (const k of [0, 1, 2]) f.fillPlace(k, 'lettuce', units)
      const xp0 = f.xpNow().points
      f.setRandom(() => 0)
      try {
        // time runs on until a shopper has been and paid
        let most = 0
        let s = 0
        for (; s < 1200 && f.state.market.till.coins === 0; s++) {
          f.tick(0.5)
          most = Math.max(most, f.shoppersNow().length)
        }
        const shelves = f.state.market.shelves.slice(0, 3).map((x: any) => ({ ...x }))
        return { seconds: s / 2, most, till: { ...f.state.market.till }, shelves, xp: f.xpNow().points - xp0 }
      } finally {
        f.setRandom(null)
      }
    }, SHOP.units)
    const price = unitPrice(produceById('lettuce').price, SHOP.pct.start)
    expect(r.most, 'a shopper came').toBeGreaterThan(0)
    expect(r.till).toEqual({ coins: 3 * SHOP.units * price, goods: 3 * SHOP.units })
    // sold out: each place keeps its good, for the next press to restock
    expect(r.shelves.map((s: any) => [s.good, s.units])).toEqual([0, 1, 2].map(() => ['lettuce', 0]))
    expect(r.xp, 'what shoppers buy is not your doing: no XP until you take the till').toBe(0)
    // outside, against the hall's north wall right by the till: not offered through the wall, but on the compass
    await game.teleport(TILL.x, 1.4, HALL.z0 - 0.6, P, -0.3)
    await page.waitForTimeout(1500)
    expect(await everOffered(page, 'farm-market-till', 4000), 'the till through the wall').toBe(false)
    await until(game, () => (window as any).__home.useHome.getState().compass.some((m: any) => m.id === 'farm-market-till'))
    // inside at the counter: E takes the till
    await atTill(game)
    await nearbyIs(game, 'farm-market-till')
    const before = await farm(page)
    const xp0 = await xp(page)
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.market.till.coins === 0)
    const after = await farm(page)
    expect(after.coins).toBe(before.coins + r.till.coins)
    expect(after.stats.sold).toBe(before.stats.sold + r.till.goods)
    expect(after.stats.earned).toBe(before.stats.earned + r.till.coins)
    expect(after.market.till).toEqual({ coins: 0, goods: 0 })
    expect(await xp(page)).toBe(xp0 + xpForSale(r.till.coins))
  })

  test('the till on the compass: tapped in the garden, it walks you through the gate and in at the door to the till', async ({ game }) => {
    await game.ready()
    const { page } = game
    await ownShop(game)
    // the till full enough to be worth the walk; nothing else ready anywhere
    await page.evaluate((coins) => {
      const f = (window as any).__home.farm
      for (const p of Object.values(f.state.producers) as any[]) p.stock.fill(0)
      f.state.market.till = { coins, goods: 20 }
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    }, SHOP.readyAt + 50)
    // in the garden by the gate, looking towards the market
    await game.teleport(4.2, 1.4, 10.8, yawTo(4.2, 10.8, TILL.x, TILL.z), 0)
    await until(game, () => (window as any).__home.useHome.getState().compass.some((m: any) => m.id === 'farm-market-till' && m.item === 'coin'))
    const mark = page.locator('.compass .compass-mark:not(.compass-more)')
    await expect(mark).toHaveCount(1)
    await mark.click()
    expect(await page.evaluate(() => (window as any).__home.walk.state().id)).toBe('farm-market-till')
    await page.waitForFunction(() => (window as any).__home.walk.state().ended !== null, null, { timeout: 240_000, polling: 250 })
    expect(await page.evaluate(() => (window as any).__home.walk.state().ended)).toBe('arrived')
    await nearbyIs(game, 'farm-market-till')
    const before = await farm(page)
    const xp0 = await xp(page)
    await page.keyboard.press('KeyE')
    await until(game, () => (window as any).__home.farm.state.market.till.coins === 0)
    expect((await farm(page)).coins).toBe(before.coins + SHOP.readyAt + 50)
    expect(await xp(page)).toBe(xp0 + xpForSale(SHOP.readyAt + 50))
  })

  test('time away: shoppers buy on while you are gone, the welcome-back card says what they left in the till; no XP for it', async ({ game }) => {
    await game.ready()
    const { page } = game
    await ownShop(game, { lettuce: 3 * SHOP.units })
    const r = await page.evaluate((units) => {
      const h = (window as any).__home
      const f = h.farm
      for (const k of [0, 1, 2]) f.fillPlace(k, 'lettuce', units)
      const xp0 = f.xpNow().points
      f.setRandom(() => 0)
      try {
        f.cameBack(30 * 60)
      } finally {
        f.setRandom(null)
      }
      return { shop: f.awaySummary()?.shop ?? null, till: { ...f.state.market.till }, xp: f.xpNow().points - xp0 }
    }, SHOP.units)
    const coins = 3 * SHOP.units * unitPrice(produceById('lettuce').price, SHOP.pct.start)
    expect(r.shop).toEqual({ goods: 3 * SHOP.units, coins })
    expect(r.till).toEqual({ coins, goods: 3 * SHOP.units })
    expect(r.xp).toBe(0)
    await panelIs(game, 'away')
    const card = page.locator('.farm-panel[aria-label="Welcome back"]')
    await expect(card).toContainText(String(coins))
    await card.getByRole('button', { name: 'Close', exact: true }).click()
    await until(game, () => (window as any).__home.useHome.getState().panel === null)
  })

  test('the walls hide what is inside from the lane; third person, the camera stays in the room your body is in, and out of the building from outside', async ({ game }) => {
    await game.ready()
    const { page } = game
    await ownShop(game)
    await fillShelves(page)
    // on the lane before the hall's north wall, looking at it: the shelves and the goods behind it are left out
    await game.teleport(11.0, 1.4, 15.6, P, 0)
    await expect
      .poll(() => page.evaluate(() => (window as any).__home.view.stats.wallCulled + (window as any).__home.view.stats.wallModels), { timeout: 60_000, message: 'things behind the wall left out' })
      .toBeGreaterThan(0)
    const third = async (x: number, z: number, yaw: number) => {
      await game.teleport(x, 1.4, z, yaw, 0)
      await page.waitForTimeout(600)
      await page.evaluate(() => (window as any).__home.useHome.getState().setView('third'))
      // its flight there, then a few seconds of frames
      await page.waitForTimeout(2500)
      return cameraFor(page, 2500)
    }
    try {
      // in each room, by its north wall facing it: the camera behind you is held in that room, under its top
      for (const room of MARKET.rooms) {
        const x = (room.x0 + room.x1) / 2 + 0.6
        const z = room.z0 + 0.45
        const seen = await third(x, z, 0)
        expect(seen.length).toBeGreaterThan(1)
        for (const c of seen) {
          expect(within(room, c, 0.02), `${room.space}: the camera at ${c.x.toFixed(2)}, ${c.z.toFixed(2)} inside the room`).toBe(true)
          expect(c.y, `${room.space}: the camera under the room's top`).toBeLessThanOrEqual(room.top + 0.02)
        }
        await page.evaluate(() => (window as any).__home.useHome.getState().setView('first'))
      }
      // outside on the lane, your back to the hall's north wall: the camera behind you is kept out of the building
      const outside = await third(10.0, HALL.z0 - 0.15 - 0.6, 0)
      const box = bounds(MARKET)
      for (const c of outside) expect(within(box, c), `the camera at ${c.x.toFixed(2)}, ${c.z.toFixed(2)} out of the building`).toBe(false)
    } finally {
      await page.evaluate(() => (window as any).__home.useHome.getState().setView('first'))
    }
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})

test.describe('the supermarket while the farm is closed', { tag: '@boot' }, () => {
  test('closed an hour with the shelves stocked: after Play the card says what the shoppers left in the till, and that the contractor has new pieces', async ({ browser }) => {
    test.setTimeout(900_000)
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: BASE })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    try {
      await bootApp(page)
      // the shop yours, three places of lettuce; saved as if an hour ago
      const before = await page.evaluate(
        ([price, top, units]) => {
          const f = (window as any).__home.farm
          f.reset()
          f.state.coins = price
          f.state.ladders.rate = top
          if (!f.buyMarket()) throw new Error('the shop was not bought')
          f.state.inv.lettuce = 3 * units
          for (const k of [0, 1, 2]) f.fillPlace(k, 'lettuce', units)
          window.dispatchEvent(new Event('pagehide'))
          const key = Object.keys(localStorage).find((x) => /^3d-home:farm:v1(:slot\d)?$/.test(x))!
          const save = JSON.parse(localStorage.getItem(key)!)
          save.time = Date.now() - 3600_000
          return { key, saved: JSON.stringify(save), xp: f.xpNow().points as number }
        },
        [MANAGER.shopPrice, LADDERS.rate.levels, SHOP.units] as const,
      )
      // put back as the next page starts (the page going away saves the farm as it is then)
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [before.key, before.saved] as [string, string])
      await page.reload()
      const play = page.locator('.intro .primary')
      await expect(play).toBeEnabled({ timeout: 300_000 })
      await play.click()
      const card = page.locator('.farm-panel[aria-label="Welcome back"]')
      await expect(card).toBeVisible({ timeout: 120_000 })
      const r = await page.evaluate(() => {
        const f = (window as any).__home.farm
        return { away: f.awaySummary(), till: { ...f.state.market.till }, xp: f.xpNow().points as number }
      })
      // an hour of shoppers (one every two and a half minutes, each taking what it likes): every unit sold
      const coins = 3 * SHOP.units * unitPrice(produceById('lettuce').price, SHOP.pct.start)
      expect(r.away.shop).toEqual({ goods: 3 * SHOP.units, coins })
      expect(r.till).toEqual({ coins, goods: 3 * SHOP.units })
      // an hour is three of the farm's days: the contractor has new pieces
      expect(r.away.pieces).toBe(true)
      expect(r.xp, 'no XP for what happened while away').toBe(before.xp)
      await expect(card).toContainText(String(coins))
      expect(errors, errors.join('\n')).toEqual([])
    } finally {
      await context.close()
    }
  })
})
