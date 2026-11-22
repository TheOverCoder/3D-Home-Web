/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, levelPay, type Game } from './helpers'
import { ITEMS } from '../../src/farm/data'
import { drawGoods } from '../../src/farm/events'

// The week's events and the farm news (src/farm/events.ts, src/farm/news, the corner menu's "Farm news"): events come on
// by the device's date and hours — here a date of the test's own, set with __home.events.set (off for every other spec:
// helpers.ts ready()). The news shows what is on now and what is coming, with their days and hours, and a badge on
// the menu until it has been seen; on the lucky draw's day one tap draws two goods on the farm's dice, which sell for
// double that day; on gift day an order's gift comes twice. Every number is read in the same call that changes it.

/** A moment of the week of 16 November 2026 (Monday 16 … Sunday 22), in the page's own time zone. */
const at = (page: Page, day: number, hour: number) => page.evaluate(([day, hour]) => new Date(2026, 10, day, hour).getTime(), [day, hour] as const)
/** The events on at that moment (and the news's badge with them). */
async function setDate(game: Game, day: number, hour: number) {
  const ms = await at(game.page, day, hour)
  await game.page.evaluate((ms) => (window as any).__home.events.set(ms), ms)
}
const panelIs = (game: Game, kind: string | null) =>
  game.page.waitForFunction((kind) => ((window as any).__home.useHome.getState().panel?.kind ?? null) === kind, kind, { timeout: 30_000, polling: 200 })
/** A new farm, everything shown at the top, the dice the farm's own. */
const fresh = (game: Game) =>
  game.page.evaluate(() => {
    const h = (window as any).__home
    h.farm.setRandom(null)
    h.farm.reset()
    h.settings.getState().update({ hudMode: 'all' })
    h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })

/** The news open now (one closed a moment before may still be on its way out, marked .ps-leaving: it takes no touch). */
const CARD = '.news-card:not(.ps-leaving)'

/** Opens the farm news as a player does: the corner menu, then its "Farm news". */
async function openNews(game: Game) {
  await game.page.locator('.top-menu-btn').click()
  await game.page.locator('.top-dial-btn.news-open').click()
  await panelIs(game, 'news')
  await expect(game.page.locator(`${CARD} .farm-panel`)).toBeVisible()
}
const closeNews = async (game: Game) => {
  await game.page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
  await panelIs(game, null)
  await expect(game.page.locator(CARD)).toHaveCount(0)
}

test.describe('the week’s events', () => {
  test.afterEach(async ({ game }) => {
    await game.page.evaluate(() => (window as any).__home.events.set(null))
  })

  test('off by default for the specs: no event on, nothing waits in the news', async ({ game }) => {
    await game.ready('farm')
    const off = await game.page.evaluate(() => {
      const e = (window as any).__home.events
      return { time: e.time(), now: e.now(), badge: e.badge(), crops: e.speed('crops') }
    })
    expect(off).toEqual({ time: null, now: [], badge: 0, crops: 1 })
    await expect(game.page.locator('.top-menu-btn .top-badge')).toHaveCount(0)
  })

  test('the news: on Wednesday the harvest festival is on and new (a badge on the menu), what comes next with its day and hours; seen, the badge goes; a quiet Tuesday names the next', async ({
    game,
  }) => {
    await game.ready('farm')
    await fresh(game)
    await setDate(game, 18, 13)
    await expect(game.page.locator('.top-menu-btn .top-badge')).toHaveText('1')
    await openNews(game)
    const card = game.page.locator(CARD)
    await expect(card.locator('.nw-date')).toHaveText(/Wednesday 18 November/i)
    const story = card.locator('.nw-now .nw-story')
    await expect(story).toHaveCount(1)
    await expect(story).toContainText('Harvest festival')
    await expect(story).toContainText('Every crop grows twice as fast.')
    await expect(story.locator('.nw-new')).toBeVisible()
    await expect(story).toContainText('Until midnight · Back next Wednesday')
    // coming soon: every other event's next time, the soonest first, each with its leaf, its day and its hours
    const rows = card.locator('.nw-soon .nw-row')
    await expect(rows).toHaveCount(4)
    await expect(rows.nth(0)).toContainText('Gift day')
    await expect(rows.nth(0)).toContainText('Tomorrow · All day')
    await expect(rows.nth(0).locator('.nw-leaf')).toHaveText(/Thu\s*19/i)
    await expect(rows.nth(1)).toContainText('Machine rush')
    await expect(rows.nth(1)).toContainText('In 2 days · 16:00 – midnight')
    await expect(rows.nth(2)).toContainText('Lucky draw')
    await expect(rows.nth(3)).toContainText('Market day')
    await expect(rows.nth(3)).toContainText('In 4 days · 8:00 – 20:00')
    // seen: nothing waits (and it is kept in the save)
    expect(await game.page.evaluate(() => (window as any).__home.events.record().seen)).toEqual(['harvest@2026-11-18'])
    await closeNews(game)
    await expect(game.page.locator('.top-menu-btn .top-badge')).toHaveCount(0)

    // a quiet Tuesday: nothing on, the next named
    await setDate(game, 17, 9)
    await game.page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'news' }))
    await panelIs(game, 'news')
    await expect(card.locator('.nw-quiet')).toContainText('A quiet day on the farm. Next: Harvest festival, tomorrow.')
    await expect(card.locator('.nw-soon .nw-row')).toHaveCount(5)
    await closeNews(game)
  })

  test('the lucky draw: one tap draws two goods on the farm’s dice, once; they sell for double that day, and what waited for them is raised', async ({ game }) => {
    await game.ready('farm')
    await fresh(game)
    await game.page.evaluate(() => {
      const f = (window as any).__home.farm
      f.setRandom(() => 0.5)
      f.state.started = true
    })
    await setDate(game, 21, 10)
    // the badge: the draw waits
    await expect(game.page.locator('.top-menu-btn .top-badge')).toHaveText('1')
    const pool: string[] = await game.page.evaluate(() => (window as any).__home.events.pool())
    const want = drawGoods(pool as any, () => 0.5)
    expect(want).toHaveLength(2)
    // a buyer in line who asks for the first good the draw will give, before it
    const offer = await game.page.evaluate((good) => (window as any).__home.farm.spawnVisitor({ want: good, qty: 2, offer: 9, queued: true }).offer, want[0])
    expect(offer).toBe(9)

    await openNews(game)
    const card = game.page.locator(CARD)
    await expect(card.locator('.nw-lucky')).toContainText('Lucky draw')
    // its "?": what it can pick and how likely (each good alike), then closed again
    await card.locator('.nw-odds .odds-btn').click()
    await expect(card.locator('.nw-odds .odds-sheet')).toContainText('Each good')
    await card.locator('.nw-odds .odds-btn').click()
    await expect(card.locator('.nw-odds .odds-sheet')).toHaveCount(0)
    await expect(card.locator('.nw-cell.ask')).toHaveCount(2)
    await card.locator('.nw-draw').click()
    await expect(card.locator('.nw-won')).toBeVisible({ timeout: 15_000 })
    await expect(card.locator('.nw-stamp')).toHaveCount(2)
    const drawn = await game.page.evaluate(() => (window as any).__home.events.record().draw)
    expect(drawn).toEqual({ day: '2026-11-21', goods: want })
    // the buyer's offer raised at once; the draw is done, nothing waits; a second draw is nothing
    const after = await game.page.evaluate((good) => {
      const h = (window as any).__home
      return { offer: h.farm.waiting().find((v: any) => v.want === good)?.offer, badge: h.events.badge(), again: h.events.draw() }
    }, want[0])
    expect(after).toEqual({ offer: 18, badge: 0, again: null })
    await closeNews(game)

    // a drawn good sells for double to the manager, the same goods with the events off for half
    const sale = await game.page.evaluate(
      ([good, other]) => {
        const h = (window as any).__home
        const f = h.farm
        const sell = (id: string) => {
          f.state.inv[id] = 10
          const paid = f.state.xp.paid
          const coins = f.state.coins
          const got = f.sellToManager(id)
          return { got, coins: f.state.coins - coins, paid }
        }
        const lucky = sell(good)
        const plain = sell(other)
        const time = h.events.time()
        h.events.set(null)
        const off = sell(good)
        h.events.set(time)
        return { lucky, plain, off, paidNow: f.state.xp.paid }
      },
      [want[0], pool.find((g) => !(want as string[]).includes(g))!] as const,
    )
    expect(sale.lucky.got).toBeGreaterThan(0)
    expect(Math.abs(sale.lucky.got - 2 * sale.off.got)).toBeLessThanOrEqual(1)
    expect(sale.lucky.coins).toBe(sale.lucky.got + levelPay(sale.lucky.paid, sale.plain.paid))

    // the next day, its price again
    await setDate(game, 22, 9)
    const next = await game.page.evaluate((good) => {
      const f = (window as any).__home.farm
      f.state.inv[good] = 10
      return f.sellToManager(good)
    }, want[0])
    expect(next).toBe(sale.off.got)
  })

  test('gift day: an order’s gift comes twice; the day before, once', async ({ game }) => {
    await game.ready('farm')
    await fresh(game)
    const send = (day: number) =>
      game.page.evaluate(
        ([day, items]) => {
          const h = (window as any).__home
          const f = h.farm
          f.setRandom(() => 0.5)
          h.events.set(new Date(2026, 10, day, 10).getTime())
          f.state.orders[0] = { order: { id: 9000 + day, lines: [{ good: 'egg', want: 2, have: 2 }], coins: 12, surprise: true } }
          // (what an order's surprise adds to what the farm has found; a level its XP reaches brings materials of its own)
          const found = () => items.reduce((n: number, id: string) => n + f.state.got[id], 0)
          const before = found()
          const sent = f.sendOrder(0)
          return { sent, gifts: found() - before }
        },
        [day, ITEMS] as const,
      )
    expect(await send(19)).toEqual({ sent: true, gifts: 2 })
    expect(await send(18)).toEqual({ sent: true, gifts: 1 })
  })
})

test.describe('the market’s mood', () => {
  test('on, every good is worth its mood of the events’ day (the drawn ones double it), a material never moved; quiet again (as for every other spec), fair', async ({ game }) => {
    await game.ready('farm')
    await fresh(game)
    // (a price asked for makes the mood's hook: src/farm/mood.ts)
    await game.page.evaluate(() => (window as any).__home.farm.spawnVisitor({ want: 'tomato', qty: 1, queued: true }))
    await game.page.waitForFunction(() => !!(window as any).__home.mood, null, { timeout: 10_000 })
    const r = await game.page.evaluate(
      ([items]) => {
        const h = (window as any).__home
        const f = h.farm
        f.setRandom(() => 0.3)
        h.events.set(new Date(2026, 10, 21, 10).getTime())
        const drawn: string[] = h.events.draw() ?? []
        const day = Math.round(Date.UTC(2026, 10, 21) / 86_400_000)
        const goods = Object.keys(f.state.inv)
        const quiet = Object.fromEntries(goods.map((g) => [g, h.mood.price(g)]))
        h.mood.on(true)
        const wrong: string[] = []
        let moved = 0
        for (const g of goods) {
          const got = h.mood.price(g)
          const want = quiet[g] * h.mood.of(g, day)
          if (Math.abs(got - want) > 1e-9) wrong.push(`${g}: ${got}, not ${want}`)
          if ((items as string[]).includes(g) && got !== quiet[g]) wrong.push(`${g} (a material) moved`)
          if (got !== quiet[g]) moved++
        }
        // the day after, the next day's mood (and no draw)
        h.events.set(new Date(2026, 10, 22, 10).getTime())
        const sunday = h.mood.price('pumpkin') / (quiet.pumpkin / (drawn.includes('pumpkin') ? 2 : 1))
        h.mood.quiet(true)
        h.events.set(null)
        const after = goods.filter((g) => h.mood.price(g) !== quiet[g] / (drawn.includes(g) ? 2 : 1))
        return { drawn, wrong, moved, sellable: goods.length - items.length, sunday, sundayMood: h.mood.of('pumpkin', day + 1), after, on: h.mood.now() }
      },
      [ITEMS] as const,
    )
    expect(r.drawn.length).toBe(2)
    expect(r.wrong).toEqual([])
    expect(r.moved).toBe(r.sellable)
    expect(r.sunday).toBeCloseTo(r.sundayMood, 9)
    expect(r.after).toEqual([])
    expect(r.on).toBe(false)
  })
})
