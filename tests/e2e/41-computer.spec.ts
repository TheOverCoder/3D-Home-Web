/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, yawTo, type Game } from './helpers'
import { PRODUCE } from '../../src/farm/data'
import { readable } from './readable'

// The house's computer (src/home/Computer.tsx, src/farm/computer; update-v1 mission 09): sold in the furniture shop
// (Tables) and by a price tag on the studio's desk while the house has none, each after a card; E at it opens its
// desktop, every app and tab opens, and Esc closes the page, then the window, then the computer. What the Market says
// a good is worth is what a sale takes (read in the same call), on the lucky draw's day the drawn goods show ×2, and
// the market's mood moves them both alike. Upright and sideways on a phone's size, with nothing a player cannot read
// or press (./readable.ts) and no error. `PC_SHOTS=1` saves a still of each screen (test-results/computer).

const SIZES = [
  { name: '390x844', width: 390, height: 844 },
  { name: '844x390', width: 844, height: 390 },
]
const SHOTS = !!process.env.PC_SHOTS
const GOODS = PRODUCE.map((p) => p.id)
const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })

/** A new farm whose house is yours, you in it, with coins (a new farm starts on the farm: src/scene/Maps.tsx). */
const fresh = (game: Game, coins = 2000) =>
  game.page.evaluate((coins) => {
    const h = (window as any).__home
    h.farm.setRandom(null)
    h.farm.reset()
    h.farm.state.apartment.owned = true
    h.farm.state.place = 'home'
    h.farm.state.coins = coins
    h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  }, coins)

const computers = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.home.layout.pieces.filter((p: any) => p.type === 'computer'))))

/** Stands in front of a piece (its front is +z at no turn), `away` metres out, looking at a point of it `y` high. */
async function before(game: Game, p: { x: number; z: number; rot: number }, away: number, y: number, along = 0) {
  const a = (p.rot * Math.PI) / 2
  const at = { x: p.x + Math.sin(a) * away, z: p.z + Math.cos(a) * away }
  const look = { x: p.x + Math.sin(a) * along, z: p.z + Math.cos(a) * along }
  const pitch = Math.atan2(y - 1.62, Math.hypot(look.x - at.x, look.z - at.z))
  await game.teleport(at.x, 1.4, at.z, yawTo(at.x, at.z, look.x, look.z), pitch)
}

/** Opens the computer with E, standing at its screen. */
async function openIt(game: Game) {
  const [pc] = await computers(game.page)
  await before(game, pc, 1.2, 1.04, -0.15)
  await expect.poll(() => game.page.evaluate(() => (window as any).__home.useHome.getState().nearby?.label), { message: 'the computer offered' }).toBe('Use the computer')
  await game.page.keyboard.press('e')
  await expect(game.page.locator('.pc-panel .pc-desk')).toBeVisible()
}

/** What can be read and pressed on the panel now: nothing wrong. */
async function readableNow(game: Game, where: string) {
  // (the sheet, the window and the page come in by springs, which Motion runs itself: wait until every box of the
  // panel has stood still three looks in a row, the sheet wholly on the screen, as 39-panels does)
  await game.page.evaluate(async () => {
    await document.fonts.ready
    const boxes = () =>
      Array.from(document.querySelectorAll('.pc-panel, .pc-panel *'))
        .map((e) => JSON.stringify(e.getBoundingClientRect()))
        .join()
    const inside = () => {
      const r = document.querySelector('.pc-panel .mp-sheet')?.getBoundingClientRect()
      return !!r && r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1
    }
    let same = 0
    let was = ''
    for (let i = 0; i < 150 && (same < 3 || !inside()); i++) {
      await new Promise((r) => setTimeout(r, 150))
      const now = boxes()
      same = now === was ? same + 1 : 0
      was = now
    }
  })
  const found = await readable(game.page, { roots: ['.farm-panel'], inside: '.farm-panel', goods: GOODS })
  expect(found, `${where}:\n${found.map((f) => `${f.check}: ${f.what} — ${f.got}`).join('\n')}`).toEqual([])
}

const shot = async (game: Game, size: string, name: string) => {
  if (SHOTS) await game.page.screenshot({ path: `test-results/computer/${size}-${name}.png` })
}

test.describe("the house's computer", () => {
  test.afterAll(async ({ game }) => {
    await game.page.setViewportSize({ width: 640, height: 360 })
  })

  test('bought from the furniture shop (Tables) after its card; once more from the desk’s price tag, it stands by the desk', async ({ game }) => {
    await game.ready('home')
    const { page } = game
    await fresh(game)
    expect(await computers(page)).toEqual([])

    // the shop: decorating the studio, Tables, the computer's card, Buy
    await game.teleport(-3.5, 1.4, -2.6, 0, -0.2)
    await until(game, () => (window as any).__home.useHome.getState().room === 'office')
    await page.keyboard.press('KeyB')
    await until(game, () => (window as any).__home.useHome.getState().decorating)
    await page.locator('.deco-shop').click()
    await page.locator('.farm-panel .farm-card', { hasText: 'Computer' }).click()
    await expect(page.locator('.farm-panel h2')).toHaveText('Computer')
    await page.waitForTimeout(600) // the Buy button arms a moment after the card opens
    await page.locator('.farm-panel .farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.coins === 1500)
    expect(await computers(page)).toHaveLength(1)
    await page.keyboard.press('KeyB')
    await until(game, () => !(window as any).__home.useHome.getState().decorating && (window as any).__home.home.decorate.camera.blend === 0)

    // while the house has one, the desk carries no price tag; a new farm's desk does
    await fresh(game)
    const desk = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.home.layout.pieces.find((p: any) => p.id === 'desk'))))
    // beside the desk's chair, looking at the middle of its top
    const at = { x: desk.x + 1, z: desk.z + 1.25 }
    await game.teleport(at.x, 1.4, at.z, yawTo(at.x, at.z, desk.x, desk.z), Math.atan2(0.86 - 1.62, Math.hypot(desk.x - at.x, desk.z - at.z)))
    await until(game, () => (window as any).__home.useHome.getState().tag?.id === 'computer-desk-tag')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().tag)).toMatchObject({ kind: 'price', price: 500 })
    // its card asks first: Cancel spends nothing
    await page.keyboard.press('KeyG')
    await expect(page.locator('.pc-buy .mp-sheet')).toBeVisible()
    await page.locator('.pc-buy .ps-foot .btn.soft').click()
    await until(game, () => (window as any).__home.useHome.getState().panel === null)
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBe(2000)
    // Buy: 500 coins, and it stands beside the desk, in the studio
    await until(game, () => (window as any).__home.useHome.getState().tag?.id === 'computer-desk-tag')
    await page.keyboard.press('KeyG')
    await expect(page.locator('.pc-buy .ps-action')).toBeEnabled()
    await page.waitForTimeout(600)
    await page.locator('.pc-buy .ps-action').click()
    await until(game, () => (window as any).__home.farm.state.coins === 1500)
    const [pc] = await computers(page)
    expect(Math.hypot(pc.x - desk.x, pc.z - desk.z)).toBeLessThan(2.5)
    await until(game, () => (window as any).__home.useHome.getState().tag?.id !== 'computer-desk-tag')
    expect(game.errors).toEqual([])
  })

  for (const size of SIZES)
    test(`E opens its desktop at ${size.name}: every app and tab opens, and Esc closes the page, the window, then the computer`, async ({ game }) => {
      await game.ready('home')
      const { page } = game
      await page.setViewportSize({ width: size.width, height: size.height })
      await fresh(game)
      // a computer by the desk, a few sales in the book, something asked for at the gate
      await page.evaluate(() => {
        const h = (window as any).__home
        h.home.buy('computer')
        h.home.placeStored('computer', { x: -5, z: -5.25, rot: 0 })
        const f = h.farm
        f.state.inv.lettuce = 12
        f.state.inv.egg = 6
        f.sellToManager('lettuce')
        f.sellToManager('egg')
        f.spawnVisitor({ want: 'carrot', qty: 3, queued: true })
        // the market's mood on, as in play: prices that move, the index with its week (quiet again after)
        h.mood.on(true)
        f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
      })
      await openIt(game)
      await expect(page.locator('.pc-today')).toBeVisible()
      await readableNow(game, `${size.name}, the desktop`)
      await shot(game, size.name, 'desktop')

      const want: Record<string, string[]> = { Market: ['Prices', 'Index'], Planner: ['Asked', 'Beds', 'Machines'], 'Sales book': ['Days', 'Goods'] }
      for (const [app, tabs] of Object.entries(want)) {
        await page.locator('.pc-app', { hasText: app }).click()
        await expect(page.locator('.pc-window .pc-bar-name')).toHaveText(app)
        for (const tab of tabs) {
          await page.locator('.pc-tab', { hasText: tab }).click()
          await expect(page.locator('.pc-tab[data-state="active"]')).toHaveText(tab)
          await expect(page.locator('.pc-content')).toBeVisible()
          const name = `${app}-${tab}`.toLowerCase().replace(/\s+/g, '-')
          await readableNow(game, `${size.name}, ${app} › ${tab}`)
          if (['market-prices', 'market-index', 'planner-beds', 'sales-book-days'].includes(name)) await shot(game, size.name, name)
        }
      }

      // the Market's prices: a good's page; Esc goes back to the list, then closes the window, then the computer
      await page.locator('.pc-app', { hasText: 'Market' }).click()
      await page.locator('.pc-tab', { hasText: 'Prices' }).click()
      await page.locator('.pc-row[data-good="lettuce"] .pc-row-open').click()
      await expect(page.locator('.pc-page h4')).toHaveText('Lettuces')
      await expect(page.locator('.pc-channel')).not.toHaveCount(0)
      await readableNow(game, `${size.name}, a good's page`)
      await shot(game, size.name, 'market-good')
      await page.keyboard.press('Escape')
      await expect(page.locator('.pc-page')).toHaveCount(0)
      await expect(page.locator('.pc-row[data-good="lettuce"]')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('.pc-window')).toHaveCount(0)
      await expect(page.locator('.pc-today')).toBeVisible()
      await page.keyboard.press('Escape')
      await until(game, () => (window as any).__home.useHome.getState().panel === null)
      await expect(page.locator('.pc-panel')).toHaveCount(0)
      await page.evaluate(() => (window as any).__home.mood.quiet(true))
      expect(game.errors).toEqual([])
    })

  test('a good is worth on its screen what a sale takes; on the lucky draw’s day a drawn good shows ×2, and the market’s mood moves both alike', async ({ game }) => {
    await game.ready('home')
    const { page } = game
    await fresh(game)
    await page.evaluate(() => {
      const h = (window as any).__home
      h.home.buy('computer')
      h.home.placeStored('computer', { x: -5, z: -5.25, rot: 0 })
      h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    })
    await openIt(game)
    await page.locator('.pc-app', { hasText: 'Market' }).click()
    const same = () =>
      page.evaluate(() => {
        const h = (window as any).__home
        const row = (g: string) => Number(document.querySelector<HTMLElement>(`.pc-row[data-good="${g}"] .pc-price`)?.dataset.price)
        return { lettuce: [row('lettuce'), h.computer.price('lettuce')], egg: [row('egg'), h.computer.price('egg')] }
      })
    let s = await same()
    expect(s.lettuce[0]).toBe(s.lettuce[1])
    expect(s.egg[0]).toBe(s.egg[1])

    // a Saturday, the draw made: a drawn good's page says ×2, and its price is still the sale's
    const drawn: string[] = await page.evaluate(() => {
      const h = (window as any).__home
      h.farm.setRandom(() => 0.3)
      h.events.set(new Date(2026, 10, 21, 10).getTime())
      const goods = h.events.draw() ?? []
      h.farm.useFarm.setState((st: any) => ({ rev: st.rev + 1 }))
      return goods
    })
    expect(drawn).toHaveLength(2)
    await page.locator(`.pc-row[data-good="${drawn[0]}"] .pc-row-open`).click()
    await expect(page.locator('.pc-page .pc-chips', { hasText: 'Lucky draw ×2' })).toBeVisible()
    const onPage = await page.evaluate((g) => [Number(document.querySelector<HTMLElement>('.pc-page .pc-price')?.dataset.price), (window as any).__home.computer.price(g)], drawn[0])
    expect(onPage[0]).toBe(onPage[1])
    await page.keyboard.press('Escape')

    // the market's mood on: every price moves by the day's mood, the screen with the sale
    await page.evaluate(() => {
      const h = (window as any).__home
      h.mood.on(true)
      h.farm.useFarm.setState((st: any) => ({ rev: st.rev + 1 }))
    })
    await expect.poll(async () => (await same()).lettuce[0]).not.toBe(s.lettuce[0])
    s = await same()
    expect(s.lettuce[0]).toBe(s.lettuce[1])
    expect(s.egg[0]).toBe(s.egg[1])
    // the index tab draws the mood: not every crop at fair
    await page.locator('.pc-tab', { hasText: 'Index' }).click()
    await expect(page.locator('.pc-content .mp-note')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await until(game, () => (window as any).__home.useHome.getState().panel === null)
    await page.evaluate(() => {
      const h = (window as any).__home
      h.mood.quiet(true)
      h.events.set(null)
    })
    expect(game.errors).toEqual([])
  })

  test("afterwards: today's farm again", async ({ game }) => {
    await game.page.setViewportSize({ width: 640, height: 360 })
    await game.ready('farm')
    await game.page.evaluate(() => (window as any).__home.farm.reset())
  })
})
