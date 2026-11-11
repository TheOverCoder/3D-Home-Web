/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, type Game } from './helpers'
import { CONTRACTOR_SPOT, CONTRACTOR_STAND } from '../../src/data/market'
import { CONTRACTOR, DAY, LADDERS, XP_FOR } from '../../src/farm/data'
import { offersPerDay, piecePrice, shortMaterials } from '../../src/farm/contractor'
import { levelOf, xpAt, xpForSale } from '../../src/farm/xp'

// The farm's day (src/farm/day.ts, DAY and HOURS in src/farm/data.ts): 24 farm hours in DAY.length real seconds —
// morning, noon, evening, night — on a chip at the top (the phase's picture and the hour), in the light, and in the
// contractor's hours (src/farm/contractor.ts, ContractorPanel.tsx): at his cabin's window behind the market in the
// morning, at noon and in the evening, he buys building materials and sells a few pieces a day; at night he walks off.
// Every other spec runs at noon with the clock stopped (helpers.ts); here the clock is set and moved, and put back.
// Every number is read in the same call that moves the clock (the farm ticks every frame).

const HOUR = DAY.length / 24

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
const panelIs = (game: Game, kind: string) => game.page.waitForFunction((kind) => (window as any).__home.useHome.getState().panel?.kind === kind, kind, { timeout: 30_000, polling: 200 })
const closePanel = (page: Page) => page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
/** The farm's clock at an hour of today, stopped. */
const setHour = (page: Page, h: number) =>
  page.evaluate((h) => {
    const f = (window as any).__home.farm
    f.setHour(h)
    f.freezeDay(true)
  }, h)
/** Back to noon, the clock stopped (as every other spec has it). */
const noon = (page: Page) => setHour(page, 12)

/** A new farm at noon, its silo and barn holding `inv`, `coins` to spend, the dice the farm's own. */
const reset = (game: Game, inv: Record<string, number> = {}, coins = 200) =>
  game.page.evaluate(
    ([inv, coins]) => {
      const f = (window as any).__home.farm
      f.setRandom(null)
      f.reset()
      f.setHour(12)
      f.freezeDay(true)
      f.tick(0.01)
      Object.assign(f.state.inv, inv)
      f.state.coins = coins
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    },
    [inv, coins] as const,
  )

/** At the contractor's window, outside his cabin, looking at him (his counter board stops you a little east of
 *  CONTRACTOR_STAND, within reach). */
const AT_WINDOW = { x: CONTRACTOR_STAND.x + 0.1, z: CONTRACTOR_STAND.z }
const atWindow = (game: Game) => game.teleport(AT_WINDOW.x, 1.4, AT_WINDOW.z, Math.atan2(-(CONTRACTOR_SPOT.x - AT_WINDOW.x), -(CONTRACTOR_SPOT.z - AT_WINDOW.z)), -0.1)

/** The mean brightness of the screen (0 black … 1 white), from a screenshot decoded in the page (no image library). */
async function brightness(page: Page) {
  const shot = (await page.screenshot()).toString('base64')
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let sum = 0
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    return sum / (d.length / 4) / 255
  }, shot)
}

test.describe('the day', () => {
  test('the chip at the top shows the phase — its picture — and the hour', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => (window as any).__home.settings.getState().update({ hudMode: 'all' }))
    // outdoors, where the chips at the top are
    await game.teleport(-1.2, 1.4, 8.5, 0, 0)
    const chip = page.locator('.farm-chip-item.day')
    await expect(chip).toBeVisible()
    try {
      for (const phase of DAY.phases) {
        const hour = phase.from + 1
        await setHour(page, hour)
        expect(await page.evaluate(() => (window as any).__home.farm.dayNow())).toMatchObject({ hour, phase: phase.id })
        // (the chip reads the clock once a second)
        await expect(chip).toContainText(`${String(hour).padStart(2, '0')}:00`, { timeout: 10_000 })
        await expect(chip.locator('img')).toHaveAttribute('src', new RegExp(`/${phase.art}-`), { timeout: 10_000 })
      }
    } finally {
      await noon(page)
    }
  })

  test('the contractor keeps his hours: at his window in the morning, at noon and in the evening; at night he walks off and his window says how long until morning', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game)
    try {
      // his hours: at the window, standing
      // (past the first minute of the morning, when he is still walking back)
      for (const hour of [7, 9, 12, 15, 18, 20]) {
        await setHour(page, hour)
        const r = await page.evaluate(() => {
          const f = (window as any).__home.farm
          f.tick(0.5)
          return { here: f.contractorHere(), at: f.contractorNow() }
        })
        expect(r.here, `${hour}:00: he is there`).toBe(true)
        expect(r.at, `${hour}:00: at his window`).not.toBeNull()
        expect(Math.hypot(r.at.x - CONTRACTOR_SPOT.x, r.at.z - CONTRACTOR_SPOT.z), `${hour}:00: at his window`).toBeLessThan(0.3)
        expect(r.at.walking).toBe(false)
      }
      // the evening turning to night, the clock running: he walks off, and is gone
      const off = await page.evaluate(
        ([from, x, z]) => {
          const f = (window as any).__home.farm
          f.freezeDay(false)
          f.setHour(from)
          let walked = false
          let farthest = 0
          let night = -1
          for (let s = 0; s < 240; s++) {
            f.tick(0.5)
            if (night < 0 && f.dayNow().phase === 'night') night = s
            const c = f.contractorNow()
            if (c?.walking) walked = true
            if (c) farthest = Math.max(farthest, Math.hypot(c.x - x, c.z - z))
          }
          f.freezeDay(true)
          return { walked, farthest, night, here: f.contractorHere(), gone: f.contractorNow() === null }
        },
        [DAY.phases[3].from - 0.1, CONTRACTOR_SPOT.x, CONTRACTOR_SPOT.z] as const,
      )
      expect(off.night, 'night came').toBeGreaterThanOrEqual(0)
      expect(off.walked).toBe(true)
      expect(off.farthest).toBeGreaterThan(3)
      expect(off.here).toBe(false)
      expect(off.gone, 'gone a minute into the night').toBe(true)
      // deep in the night his window is a status: how long until he is back at it (the morning, and his walk back in its
      // first minute); nothing to press
      const hour = 23.5
      await setHour(page, hour)
      await atWindow(game)
      await until(game, () => (window as any).__home.useHome.getState().status?.id === 'farm-contractor')
      const s = await page.evaluate(() => {
        const h = (window as any).__home
        return { status: h.useHome.getState().status, nearby: h.useHome.getState().nearby?.id ?? null }
      })
      expect(s.status.icon.verb).toBe('wait')
      const morning = (24 - hour + DAY.phases[0].from) * HOUR
      expect(s.status.icon.seconds).toBeGreaterThanOrEqual(morning - 2)
      expect(s.status.icon.seconds).toBeLessThanOrEqual(morning + 60)
      expect(s.nearby).not.toBe('farm-contractor')
      // the night turning to morning: he comes back to his window
      const back = await page.evaluate(
        ([from, x, z]) => {
          const f = (window as any).__home.farm
          f.freezeDay(false)
          f.setHour(from)
          let walked = false
          for (let s = 0; s < 240; s++) {
            f.tick(0.5)
            if (f.contractorNow()?.walking) walked = true
          }
          f.freezeDay(true)
          const c = f.contractorNow()
          return { walked, here: f.contractorHere(), d: c ? Math.hypot(c.x - x, c.z - z) : Infinity, walking: c?.walking ?? null }
        },
        [DAY.phases[0].from - 0.1, CONTRACTOR_SPOT.x, CONTRACTOR_SPOT.z] as const,
      )
      expect(back.walked).toBe(true)
      expect(back.here).toBe(true)
      expect(back.d, 'back at his window').toBeLessThan(0.3)
      expect(back.walking).toBe(false)
      // there now: his window opens his panel
      await nearbyIs(game, 'farm-contractor')
    } finally {
      await noon(page)
    }
  })

  test('he buys building materials at 10 coins each, the whole stack, only while he is there; a sale gives XP', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, { brick: 4 }, 100)
    try {
      await atWindow(game)
      await nearbyIs(game, 'farm-contractor')
      await page.keyboard.press('KeyE')
      await panelIs(game, 'contractor')
      const panel = page.locator('.farm-panel[aria-label="The contractor"]')
      await expect(panel).toBeVisible()
      const xp0 = await page.evaluate(() => (window as any).__home.farm.xpNow().points)
      // the bricks' row: Sell, the whole stack
      await panel
        .getByRole('button', { name: /^Sell\b/ })
        .first()
        .click()
      await until(game, () => (window as any).__home.farm.state.inv.brick === 0)
      const f = await page.evaluate(() => {
        const f = (window as any).__home.farm
        return { coins: f.state.coins, sold: f.state.stats.sold, earned: f.state.stats.earned, xp: f.xpNow().points }
      })
      expect(CONTRACTOR.buys).toBe(10)
      expect(f.coins).toBe(100 + 4 * CONTRACTOR.buys)
      expect(f.sold).toBe(4)
      expect(f.earned).toBe(4 * CONTRACTOR.buys)
      expect(f.xp).toBe(xp0 + xpForSale(4 * CONTRACTOR.buys))
      await closePanel(page)
      // he buys no goods, and nothing at night
      const r = await page.evaluate(() => {
        const f = (window as any).__home.farm
        f.state.inv.lettuce = 3
        f.state.inv.plank = 2
        const lettuce = f.sellToContractor('lettuce')
        f.setHour(23.5)
        const night = f.sellToContractor('plank')
        return { lettuce, night, inv: { lettuce: f.state.inv.lettuce, plank: f.state.inv.plank } }
      })
      expect(r).toEqual({ lettuce: 0, night: 0, inv: { lettuce: 3, plank: 2 } })
    } finally {
      await noon(page)
    }
  })

  test("the day's pieces: what the silo and the barn are shortest of first, each bought once at its price with no XP; a new set the next day", async ({ game }) => {
    await game.ready()
    const { page } = game
    // the barn's next level wants two bricks, planks and nails: the planks and the nails are here, the bricks not —
    // the farm's shortest material. The day's pieces are made when the day is first seen
    const r = await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.setRandom(null)
      f.reset()
      f.state.storage.barn = 2
      Object.assign(f.state.inv, { plank: 2, nail: 2 })
      f.state.coins = 1000
      f.setHour(12)
      f.freezeDay(true)
      // (today's pieces made again from this barn: as if the day were seen for the first time)
      f.state.contractor = { day: -1, offers: [] }
      f.tick(0.01)
      const offers = f.contractorOffers().map((o: any) => ({ ...o }))
      const at = { inv: { ...f.state.inv }, storage: { ...f.state.storage } }
      const xp0 = f.xpNow().points
      const coins0 = f.state.coins
      const had = f.state.inv[offers[0].item]
      const bought = f.buyFromContractor(0)
      const again = f.buyFromContractor(0)
      return {
        offers,
        at,
        bought,
        again,
        sold: f.contractorOffers()[0].sold,
        spent: coins0 - f.state.coins,
        got: f.state.inv[offers[0].item] - had,
        xp: f.xpNow().points - xp0,
        day: f.state.contractor.day,
      }
    })
    expect(r.offers.length).toBe(offersPerDay(0))
    for (const o of r.offers) {
      expect(o.sold).toBe(false)
      expect(['brick', 'plank', 'nail', 'iron', 'bolt', 'log']).toContain(o.item)
    }
    expect(shortMaterials(r.at)[0]).toBe('brick')
    expect(r.offers[0].item).toBe('brick')
    expect(r.bought).toBe(true)
    expect(r.again, 'each piece once').toBe(false)
    expect(r.sold).toBe(true)
    expect(r.spent).toBe(piecePrice(0))
    expect(r.got).toBe(1)
    expect(r.xp, 'buying a piece is a trade: no XP').toBe(0)
    // the next day: a new set, none sold
    const next = await page.evaluate((length) => {
      const f = (window as any).__home.farm
      f.freezeDay(false)
      f.state.day.t += length
      f.tick(0.01)
      f.setHour(12)
      f.freezeDay(true)
      return { day: f.state.contractor.day, offers: f.contractorOffers().map((o: any) => ({ ...o })) }
    }, DAY.length)
    expect(next.day).toBe(r.day + 1)
    expect(next.offers.length).toBe(offersPerDay(0))
    expect(next.offers.every((o: any) => !o.sold)).toBe(true)
  })

  test('his two ladders, open only while he is there: one more piece today, and 10 coins off each', async ({ game }) => {
    await game.ready()
    const { page } = game
    await reset(game, {}, 2000)
    try {
      // at night neither can be bought
      const night = await page.evaluate(() => {
        const f = (window as any).__home.farm
        f.setHour(23.5)
        const r = { stock: f.ladderOpen('stock'), discount: f.ladderOpen('discount'), buy: f.buyLadder('stock') }
        f.setHour(12)
        return r
      })
      expect(night).toEqual({ stock: false, discount: false, buy: false })
      // at noon: the stock ladder's first step from its card (the row opens it), its Buy armed a moment after
      expect(await page.evaluate(() => (window as any).__home.farm.contractorOffers().length)).toBe(offersPerDay(0))
      const xp0 = await page.evaluate(() => (window as any).__home.farm.xpNow().points)
      await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'ladder', id: 'stock' }))
      await panelIs(game, 'ladder')
      await page.waitForTimeout(600)
      await page.locator('.farm-confirm .farm-buy').click()
      await until(game, () => (window as any).__home.farm.state.ladders.stock === 1)
      const stock = await page.evaluate(() => {
        const f = (window as any).__home.farm
        return { coins: f.state.coins, offers: f.contractorOffers().length, xp: f.xpNow().points }
      })
      expect(stock.coins).toBe(2000 - LADDERS.stock.price[0])
      expect(stock.offers, 'one more piece today').toBe(offersPerDay(1))
      expect(stock.xp).toBe(xp0 + XP_FOR.build)
      await closePanel(page)
      // a step of the discount: his pieces cost 10 less, at once
      const deal = await page.evaluate(() => {
        const f = (window as any).__home.farm
        const ok = f.buyLadder('discount')
        const coins = f.state.coins
        const k = f.contractorOffers().findIndex((o: any) => !o.sold)
        const bought = f.buyFromContractor(k)
        return { ok, bought, paid: coins - f.state.coins }
      })
      expect(deal.ok).toBe(true)
      expect(deal.bought).toBe(true)
      expect(deal.paid).toBe(piecePrice(1))
      expect(piecePrice(1)).toBe(CONTRACTOR.sells - 10)
    } finally {
      await noon(page)
    }
  })

  test('at night the farm is darker, never black: the canvas is lit above a floor', async ({ game }) => {
    await game.ready()
    const { page } = game
    // in the yard, looking back at the house; nothing over the scene
    await game.teleport(0, 1.4, 12.5, 0, 0.02)
    await page.evaluate(() => (window as any).__home.settings.getState().update({ hudMode: 'clean' }))
    try {
      await setHour(page, 12)
      await page.waitForTimeout(3000)
      const day = await brightness(page)
      // (the clock stopped is noon's light, whatever the hour: running, the night's)
      await page.evaluate(() => {
        const f = (window as any).__home.farm
        f.setHour(23.5)
        f.freezeDay(false)
      })
      await page.waitForTimeout(3000)
      const night = await brightness(page)
      console.log(`mean brightness: noon ${day.toFixed(3)}, night ${night.toFixed(3)}`)
      expect(night, 'night is darker than noon').toBeLessThan(day * 0.97)
      expect(night, 'never black: lit at least a third as much as noon').toBeGreaterThan(day * 0.3)
      expect(night, 'never black').toBeGreaterThan(0.08)
    } finally {
      await noon(page)
      await page.evaluate(() => (window as any).__home.settings.getState().update({ hudMode: 'all' }))
    }
  })

  test('another farm switched to shows its own hour and level, with no level-up show; and back', async ({ game }) => {
    await game.ready()
    const { page } = game
    await game.teleport(-1.2, 1.4, 8.5, 0, 0)
    const points = xpAt(5) + 3
    const night = 22
    // this farm as a file, moved on to the night and to level 5, loaded into the third slot and played, then back
    const r = await page.evaluate(
      ([points, t]) => {
        const h = (window as any).__home
        const { slots, farm: f } = h
        f.reset()
        f.setHour(12)
        f.saveFarm()
        const file = JSON.parse(slots.exportSlot(1).text)
        file.save.xp = { points, paid: 1 }
        file.save.day = { t }
        const events = f.xpEventCount()
        const here = { day: f.dayNow(), level: f.xpNow().level }
        slots.importSlot(3, JSON.stringify(file))
        slots.switchSlot(3)
        const there = { day: f.dayNow(), level: f.xpNow().level, events: f.xpEventCount() }
        return { events, here, there }
      },
      [points, (night - DAY.start) * HOUR] as const,
    )
    try {
      expect(r.here.day.phase).toBe('noon')
      // (loaded, the farm goes on for the moment since it was saved: time away passes with the clock stopped too)
      expect(r.there.day.phase).toBe('night')
      expect(r.there.day.hour).toBeCloseTo(night, 2)
      expect(r.there.level).toBe(levelOf(points))
      expect(r.there.events, 'switching farms is not play: no level-up').toBe(r.events)
      await expect(page.locator('.farm-chip-item.day')).toContainText(`${night}:00`, { timeout: 10_000 })
      await expect(page.locator('.farm-chip-item.day img')).toHaveAttribute('src', /\/crescent-moon-/)
    } finally {
      const back = await page.evaluate(() => {
        const { slots, farm: f } = (window as any).__home
        slots.switchSlot(1)
        slots.deleteSlot(3)
        return { slot: slots.currentSlot(), events: f.xpEventCount(), level: f.xpNow().level }
      })
      expect(back).toMatchObject({ slot: 1, events: r.events, level: r.here.level })
      await noon(page)
    }
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
