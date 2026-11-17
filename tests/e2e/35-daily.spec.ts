/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, type Page } from '@playwright/test'
import { ITEMS } from '../../src/farm/data'
import { dayCoins, dayMaterials } from '../../src/farm/daily'
import { levelOf } from '../../src/farm/xp'
import { BASE, levelPay, watchErrors } from './helpers'

// The daily gift (src/farm/daily.ts, DailyCard.tsx, DailyPanel.tsx): once a day of the device's calendar, the first time
// the farm is in view that day, its card opens by itself — after the welcome-back card, never over it — and Claim pays
// the day's gift once (coins counted into the chip as they land); the same day again nothing opens and nothing waits;
// the next day (the day changing while the game is open) goes on with the streak; a missed day is forgiven, two start a
// new week; closed unclaimed it waits in the corner menu; the clock moved back gives nothing. A page of its own, a
// phone upright: the other specs put the gift out of the way (`quietDaily` in helpers.ts), this one never does. The
// day's clock is the game's own hook (`__home.farm.daily.clock`: a moment of the page's time), the dice `setRandom`.

/** Opens the app (or the page again) and enters, as a player does: nothing put out of the way. */
async function enter(page: Page) {
  const play = page.locator('.intro .primary')
  await expect(play).toBeEnabled({ timeout: 300_000 })
  await play.tap()
  await page.waitForFunction(
    () => {
      const s = (window as any).__home?.useHome.getState()
      return !!s && s.phase === 'playing' && s.mapReady && !s.curtain && (s.outdoors || s.room !== null) && !!(window as any).__home.farm?.daily
    },
    null,
    { timeout: 180_000, polling: 500 },
  )
}

const panel = (page: Page) => page.evaluate(() => (window as any).__home.useHome.getState().panel?.kind ?? null)
/** The farm's coins, its level paid, the day's record and its level, read in one call. */
const read = (page: Page) =>
  page.evaluate(() => {
    const f = (window as any).__home.farm
    return {
      coins: f.state.coins as number,
      paid: f.state.xp.paid as number,
      level: f.xpNow().level as number,
      inv: { ...f.state.inv },
      daily: structuredClone(f.state.daily),
      today: f.daily.day() as number,
    }
  })
/** The day's clock `days` after the page's now (null: the device's own again). */
const dayClock = (page: Page, days: number | null) => page.evaluate((d) => (window as any).__home.farm.daily.clock(d === null ? null : Date.now() + d * 86_400_000), days)
const dice = (page: Page, n: number | null) => page.evaluate((n) => (window as any).__home.farm.setRandom(n === null ? null : () => n), n)

const card = (page: Page) => page.locator('.daily-card .farm-panel[aria-label="Daily gift"]')

/** Claims from the card (the dice set first): what the farm had before, and after once the claim is in. */
async function claim(page: Page, roll: number) {
  await dice(page, roll)
  const before = await read(page)
  await card(page)
    .getByRole('button', { name: /^Claim/ })
    .tap()
  await expect.poll(async () => (await read(page)).daily.last, { timeout: 15_000 }).toBe(before.today)
  const after = await read(page)
  await dice(page, null)
  return { before, after }
}

test.describe('the daily gift', { tag: '@boot' }, () => {
  test('first open of a day (after the welcome-back card): claimed once, nothing again that day; the next day the streak goes on; a missed day waits, two start a new week; the menu keeps it; the clock back gives nothing', async ({
    browser,
  }) => {
    test.setTimeout(1_500_000)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: BASE })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    try {
      await page.goto('/?debug&quality=low')
      await enter(page)
      // a new farm (nothing planted yet): its first minutes are for learning to play — nothing opens, nothing waits
      await page.waitForTimeout(3000)
      expect(await panel(page)).toBe(null)
      expect(await page.evaluate(() => (window as any).__home.farm.daily.waiting())).toBe(false)
      await expect(page.locator('.top-menu-gift')).toHaveCount(0)

      // a farm that has begun (a bed of lettuce, sprinklers so it never dries out), saved as if an hour ago
      const [key, saved] = await page.evaluate(() => {
        const f = (window as any).__home.farm
        f.reset()
        f.state.sprinkler = true
        const i = f.state.beds.findIndex((b: any) => b.built)
        f.plant(i, 'lettuce')
        f.water(i)
        window.dispatchEvent(new Event('pagehide'))
        const k = Object.keys(localStorage).find((x) => /^3d-home:farm:v1(:slot\d)?$/.test(x))!
        const save = JSON.parse(localStorage.getItem(k)!)
        save.time = Date.now() - 3600_000
        return [k, JSON.stringify(save)]
      })
      expect(JSON.parse(saved).daily).toEqual({ last: -1, streak: 0, offered: -1, week: [] })
      // put back as the page starts again (the page going away saves the farm as it is then); once only
      await page.addInitScript(
        ([k, v]) => {
          if (sessionStorage.getItem('daily-test-put')) return
          sessionStorage.setItem('daily-test-put', '1')
          localStorage.setItem(k, v)
        },
        [key, saved] as [string, string],
      )
      await page.reload()
      await enter(page)

      // the first open of the day: the welcome-back card first, the gift after it (never over it, never with it)
      const welcome = page.locator('.farm-panel[aria-label="Welcome back"]')
      await expect(welcome).toBeVisible({ timeout: 60_000 })
      await page.waitForTimeout(2500)
      expect(await panel(page)).toBe('away')
      await welcome.getByRole('button', { name: 'Close', exact: true }).tap()
      await expect(card(page)).toBeVisible({ timeout: 20_000 })
      await expect(card(page).locator('.dg-ribbon')).toHaveText('Day 1')
      await expect(card(page).locator('.dg-line')).toContainText('Day 7 is a big one')
      // opened by itself today: kept in the save (not again today)
      expect((await read(page)).daily.offered).toBe((await read(page)).today)

      // Claim: day 1's coins, once, no XP; the coin chip counts them in as they land
      const first = await claim(page, 0)
      expect(first.after.coins - levelPay(first.before.paid, first.after.paid)).toBe(first.before.coins + dayCoins(1, first.before.level))
      expect(first.after.daily).toMatchObject({ last: first.before.today, streak: 1, week: [[{ coins: dayCoins(1, first.before.level) }]] })
      await expect(card(page).locator('.dg-prize-name')).toHaveText(`${dayCoins(1, first.before.level)} coins`)
      // once it is home: the streak counted up, and the stage turns to tomorrow with its clock to the next gift
      await expect(card(page).locator('.dg-streak')).toHaveAttribute('aria-label', 'Streak: 1 day in a row')
      await expect(card(page).getByRole('timer')).toHaveAttribute('aria-label', /^Opens in (\d+ hours?( \d+ minutes?)?|\d+ minutes?|less than a minute)$/)
      await expect(card(page).locator('.dg-clock-face')).toHaveText(/^\d\d:\d\d:\d\d$/)
      await expect
        .poll(() => page.evaluate(() => [document.querySelector('.farm-chip-item.coins b')?.textContent, (window as any).__home.farm.state.coins.toLocaleString('en-US')]), { timeout: 20_000 })
        .toEqual([first.after.coins.toLocaleString('en-US'), first.after.coins.toLocaleString('en-US')])
      // once: the claim again (the farm's own) gives nothing
      expect(await page.evaluate(() => (window as any).__home.farm.daily.claim())).toBe(null)
      expect((await read(page)).coins).toBe(first.after.coins)
      await card(page).getByRole('button', { name: 'Done' }).tap()
      await expect.poll(() => panel(page), { timeout: 10_000 }).toBe(null)

      // the page opened again the same day: nothing opens, nothing waits, nothing more paid
      await page.reload()
      await enter(page)
      await page.waitForTimeout(5000)
      expect(await panel(page)).toBe(null)
      expect(await page.evaluate(() => (window as any).__home.farm.daily.waiting())).toBe(false)
      await expect(page.locator('.top-menu-gift')).toHaveCount(0)
      const again = await read(page)
      expect(again.daily).toMatchObject({ last: again.today, streak: 1 })
      expect(again.coins).toBe(first.after.coins)

      // the next day comes while the game is open: its gift opens by itself, day 2 (a building material), the streak on
      await dayClock(page, 1)
      await expect(card(page)).toBeVisible({ timeout: 30_000 })
      await expect(card(page).locator('.dg-ribbon')).toHaveText('Day 2')
      await expect(card(page).locator('.dg-streak')).toHaveAttribute('aria-label', 'Streak: 1 day in a row')
      const second = await claim(page, 0.99)
      const log = ITEMS[5]
      expect(second.after.inv[log] - second.before.inv[log]).toBe(dayMaterials(2, second.before.level))
      expect(second.after.coins).toBe(second.before.coins + levelPay(second.before.paid, second.after.paid))
      expect(second.after.daily.streak).toBe(2)
      // closed with its ✕ while the gift is still on its stage (the road and the streak move on once it is home): it
      // flies home as the card goes, nothing lost
      await card(page).getByRole('button', { name: 'Close (Esc)' }).tap()
      await expect.poll(() => panel(page), { timeout: 10_000 }).toBe(null)

      // a missed day (day +2 not played): the streak waited, day 3
      await dayClock(page, 3)
      await expect(card(page)).toBeVisible({ timeout: 30_000 })
      await expect(card(page).locator('.dg-ribbon')).toHaveText('Day 3')
      await expect(card(page).locator('.dg-line')).toHaveText('You missed a day: your streak waited.')
      const third = await claim(page, 0)
      expect(third.after.coins - levelPay(third.before.paid, third.after.paid)).toBe(third.before.coins + dayCoins(3, third.before.level))
      expect(third.after.daily.streak).toBe(3)
      await card(page).getByRole('button', { name: 'Done' }).tap()
      await expect.poll(() => panel(page), { timeout: 10_000 }).toBe(null)

      // two missed days: a new week from day 1 (no streak shown until it is claimed); closed unclaimed, it waits in the
      // corner menu — the gift on its button, "Daily gift" first in it — and opens from there
      await dayClock(page, 6)
      await expect(card(page)).toBeVisible({ timeout: 30_000 })
      await expect(card(page).locator('.dg-ribbon')).toHaveText('Day 1')
      await expect(card(page).locator('.dg-line')).toHaveText('A new week begins.')
      await expect(card(page).locator('.dg-streak')).toHaveCount(0)
      await card(page).getByRole('button', { name: 'Close (Esc)' }).tap()
      await expect.poll(() => panel(page), { timeout: 10_000 }).toBe(null)
      expect((await read(page)).daily.streak).toBe(3)
      await page.waitForTimeout(3000)
      expect(await panel(page), 'opened by itself once a day').toBe(null)
      await expect(page.locator('.top-menu-gift')).toBeVisible()
      await page.locator('.top-menu-btn').tap()
      const entry = page.locator('.top-dial-btn.daily-open')
      await expect(entry).toBeVisible()
      await expect(page.locator('.top-dial-btn').first()).toHaveClass(/daily-open/)
      await entry.tap()
      await expect(card(page)).toBeVisible({ timeout: 10_000 })
      const fourth = await claim(page, 0)
      expect(fourth.after.daily).toMatchObject({ streak: 1, week: [[{ coins: dayCoins(1, fourth.before.level) }]] })
      await card(page).getByRole('button', { name: 'Done' }).tap()
      await expect.poll(() => panel(page), { timeout: 10_000 }).toBe(null)
      await expect(page.locator('.top-menu-gift')).toHaveCount(0)

      // the clock moved back (before the last day claimed): nothing opens, nothing waits, nothing to claim
      const coins = (await read(page)).coins
      await dayClock(page, 2)
      await page.waitForTimeout(4000)
      expect(await panel(page)).toBe(null)
      expect(await page.evaluate(() => [(window as any).__home.farm.daily.waiting(), (window as any).__home.farm.daily.claim()])).toEqual([false, null])
      await expect(page.locator('.top-menu-gift')).toHaveCount(0)
      expect((await read(page)).coins).toBe(coins)
      // (none of it was XP: the level never moved by a gift)
      expect(levelOf(await page.evaluate(() => (window as any).__home.farm.state.xp.points))).toBe(first.before.level)
      expect(errors, errors.join('\n')).toEqual([])
    } finally {
      await context.close()
    }
  })
})
