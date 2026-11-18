/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { FIRST_STEPS } from '../../src/farm/firstSteps'
import { expect, test } from './helpers'

// A new farm's first steps (src/farm/firstSteps.ts; the hint, src/farm/FirstSteps.tsx), as a player's farm has them (a
// ?debug page keeps them quiet: they run here, `steps.quiet(false)`, and `ready()` quiets them again): the farmer's
// bubble under the compass says the step, a tap on it walks you there, each step done moves it on and pays its reward,
// and after the last ("All set!") the slot is free and the daily gift comes; skipped (✕, then Skip) it is gone for good;
// it stands aside under a panel and in the house, and in its place in the top column, above a toast and the level-up.

/** A new farm, its steps running, the locks on as a player's (once the interface has seen it at level 1). */
async function newFarm(page: Page) {
  await page.evaluate(() => {
    const f = (window as any).__home.farm
    f.reset()
    f.unlocks.all(false)
    f.steps.quiet(false)
    f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })
  await expect(page.locator('.top-road .xp-star b')).toHaveText('1')
}

const hint = (page: Page) => page.locator('.step-hint')
const bubble = (page: Page) => page.locator('.step-bubble:not(.ask)')
/** The step the farm is on and its coins, read together. */
const record = (page: Page) =>
  page.evaluate(() => {
    const f = (window as any).__home.farm
    return { step: f.steps.record().step as number, over: f.steps.record().over as boolean, coins: f.state.coins as number }
  })

/** Does a step after the first (which is played: a bed planted) as src/farm/firstSteps.test.ts does: what doing it
 *  leaves in the farm's numbers, quick. */
const doStep = (page: Page, id: string) =>
  page.evaluate((id) => {
    const f = (window as any).__home.farm.state
    if (id === 'eggs') f.got.egg = 1
    else if (id === 'water') f.stats.watered = 1
    else if (id === 'harvest') f.got.lettuce = 4
    else if (id === 'sell') f.stats.sold = 4
    else if (id === 'shear') f.got.wool = 1
    else if (id === 'weave') f.got.cloth = 1
    else if (id === 'order') f.stats.sent = 1
    else throw new Error(`a step with no way to do it here: ${id}`)
  }, id)

/** A step just done with a harvest's toast coming in (in the page, as the tick is stamped): at 0.3, 0.6 and 0.9 s the
 *  bubble has not moved (the toast's slot is under the step's, src/ui/TopStack.tsx), the toast is clear of it, and the
 *  done line is whole (Typed: a tick on a half-typed line cannot be read). What is wrong, or nothing. */
const toastOnTheTick = (page: Page) =>
  page.evaluate(async () => {
    const h = (window as any).__home
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    for (let i = 0; i < 500 && !document.querySelector('.step-bubble.done'); i++) await wait(20)
    const bubbleBox = () => document.querySelector('.step-bubble')?.getBoundingClientRect()
    const before = bubbleBox()
    if (!before) return ['no bubble with its tick']
    h.useHome.getState().showToast('+ 4 lettuces', 'lettuce')
    const out: string[] = []
    const t0 = performance.now()
    for (const at of [300, 600, 900]) {
      await wait(Math.max(0, t0 + at - performance.now()))
      const b = bubbleBox()
      const t = document.querySelector('.toast')?.getBoundingClientRect()
      if (!b) {
        out.push(`${at} ms: no bubble`)
        continue
      }
      if (Math.abs(b.top - before.top) > 1) out.push(`${at} ms: the bubble moved ${Math.round(b.top - before.top)} px`)
      if (t && t.width && t.left + 1 < b.right && b.left + 1 < t.right && t.top + 1 < b.bottom && b.top + 1 < t.bottom) out.push(`${at} ms: the toast over the bubble`)
      const done = document.querySelector('.step-bubble.done')
      if (done && done.querySelector('.step-ghost')?.textContent) out.push(`${at} ms: the done line half typed`)
    }
    return out
  })

test.describe("a new farm's first steps", () => {
  test('the hint walks you to each step, each done moves it on and pays its reward; after the last the daily gift comes', async ({ game }) => {
    test.setTimeout(400_000)
    const { page } = game
    await game.ready('farm')
    await newFarm(page)

    // the first: its words, and a tap walks to an empty bed (the walk ends there)
    await expect(bubble(page)).toHaveAttribute('aria-label', `${FIRST_STEPS[0].say} — walk there`, { timeout: 30_000 })
    await bubble(page).click()
    await expect.poll(() => page.evaluate(() => (window as any).__home.walk.state().id), { timeout: 10_000 }).toMatch(/^farm-bed-\d+$/)
    await expect.poll(() => page.evaluate(() => (window as any).__home.walk.state().ended), { timeout: 90_000 }).toBe('arrived')
    // the daily gift waits while they run
    await page.evaluate(() => (window as any).__home.farm.daily.quiet(false))
    const before = await record(page)
    const seeds = await page.evaluate(() => {
      const f = (window as any).__home.farm
      const bed = f.state.beds.findIndex((b: any) => b.built && !b.crop)
      const coins = f.state.coins
      f.plant(bed, 'lettuce')
      return coins - f.state.coins
    })
    await expect.poll(async () => (await record(page)).step, { timeout: 15_000 }).toBe(1)
    expect((await record(page)).coins).toBe(before.coins - seeds + (FIRST_STEPS[0].reward as { coins: number }).coins)
    expect(await page.evaluate(() => (window as any).__home.farm.daily.waiting())).toBe(false)

    // each next step: the bubble says it, the farm does it, the step moves on and pays its reward
    for (let k = 1; k < FIRST_STEPS.length; k++) {
      const s = FIRST_STEPS[k]
      await expect(bubble(page)).toHaveAttribute('aria-label', `${s.say} — walk there`, { timeout: 15_000 })
      await expect(bubble(page)).toContainText(`+${(s.reward as { coins: number }).coins}`)
      const was = await record(page)
      await doStep(page, s.id)
      if (s.id === 'harvest') expect(await toastOnTheTick(page)).toEqual([])
      await expect.poll(async () => (await record(page)).step, { timeout: 15_000 }).toBe(k + 1)
      expect((await record(page)).coins - was.coins, s.id).toBe((s.reward as { coins: number }).coins)
    }
    // the last: "All set!", then the slot is free and the daily gift waits for the player
    expect((await record(page)).over).toBe(true)
    await expect(page.locator('.step-final .reveal')).toHaveAttribute('aria-label', /^All set/, { timeout: 15_000 })
    await expect(hint(page)).toHaveCount(0, { timeout: 20_000 })
    expect(await page.evaluate(() => (window as any).__home.farm.daily.waiting())).toBe(true)
    await page.evaluate(() => (window as any).__home.farm.daily.quiet(true))
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('skipped from the hint (✕, then Skip): gone, and stays gone; Keep keeps it', async ({ game }) => {
    const { page } = game
    await game.ready('farm')
    await newFarm(page)
    await expect(bubble(page)).toBeVisible({ timeout: 30_000 })
    // ✕ asks; Keep: the step again
    await page.locator('.step-x').click()
    await expect(page.locator('.step-bubble.ask')).toContainText('Skip the tips?')
    await page.getByRole('button', { name: 'Keep', exact: true }).click()
    await expect(bubble(page)).toHaveAttribute('aria-label', `${FIRST_STEPS[0].say} — walk there`)
    await expect(page.locator('.step-bubble.ask')).toHaveCount(0)
    // ✕ again, Skip: over, nothing more shown or paid
    await page.locator('.step-x').click()
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(hint(page)).toHaveCount(0)
    expect(await record(page)).toMatchObject({ step: 0, over: true })
    const coins = (await record(page)).coins
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.plant(
        f.state.beds.findIndex((b: any) => b.built && !b.crop),
        'lettuce',
      )
    })
    await page.waitForTimeout(1500)
    await expect(hint(page)).toHaveCount(0)
    expect((await record(page)).coins).toBeLessThan(coins)
  })

  test('aside under a panel and in the house; in its place in the top column, above a toast and the level-up, upright and sideways at phone size', async ({ game }) => {
    test.setTimeout(400_000)
    const { page } = game
    await game.ready('farm')
    await newFarm(page)
    await expect(bubble(page)).toBeVisible({ timeout: 30_000 })
    // a panel over the game: aside; closed: back
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'shop' }))
    await expect(hint(page)).toHaveCount(0)
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    await expect(bubble(page)).toBeVisible()
    // the clear view: aside
    await page.evaluate(() => document.documentElement.setAttribute('data-hud', 'clean'))
    await expect(hint(page)).toBeHidden()
    await page.evaluate(() => document.documentElement.setAttribute('data-hud', 'all'))

    // the column full: the step, a toast, the level's show — one under another, none over another, on the screen
    // (measured in the page the first moment all three stand: a toast lasts two seconds)
    for (const size of [
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size)
      await page.waitForTimeout(500)
      await page.evaluate(() => {
        const f = (window as any).__home.farm
        f.reset()
        f.steps.quiet(false)
        f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
      })
      await expect(page.locator('.top-road .xp-star b')).toHaveText('1')
      await expect(bubble(page)).toBeVisible({ timeout: 30_000 })
      await page.evaluate(() => {
        const w = window as any
        const h = w.__home
        w.__column = null
        w.__watch = window.setInterval(() => {
          const box = (sel: string) => {
            const r = document.querySelector(sel)?.getBoundingClientRect()
            return r && r.width ? r : null
          }
          const [toast, level, step] = ['.toast', '.level-up-show', '.step-talk'].map(box)
          if (!toast || !level || !step || w.__column) return
          const out: string[] = []
          // the step right under the compass, then the toast, then the level-up (src/ui/TopStack.tsx)
          if (step.bottom > toast.top + 1) out.push('the step over the toast')
          if (toast.bottom > level.top + 1) out.push('the toast over the level-up')
          if (step.left < 0 || step.right > innerWidth || step.bottom > innerHeight)
            out.push(`the step off the screen (${Math.round(step.left)}–${Math.round(step.right)}, ${Math.round(step.top)}–${Math.round(step.bottom)})`)
          w.__column = out
        }, 30)
        for (let i = 0; i < 200 && h.farm.xpNow().level < 2; i++) h.farm.gainXp('sale', 10)
      })
      // the toast once the level's show stands (its XP lands first, slower on a page drawn in software): both together
      await expect(page.locator('.level-up-show')).toBeVisible({ timeout: 20_000 })
      await page.evaluate(() => (window as any).__home.useHome.getState().showToast('+ 8 lettuces', 'lettuce'))
      await expect.poll(() => page.evaluate(() => (window as any).__column), { timeout: 20_000, message: `${size.width}×${size.height}: the top column` }).toEqual([])
      await page.evaluate(() => window.clearInterval((window as any).__watch))
    }
    await page.setViewportSize({ width: 640, height: 360 })

    // in the house: aside (the farm's steps are the farm's)
    await game.ready('home')
    await page.evaluate(() => (window as any).__home.farm.steps.quiet(false))
    await page.waitForTimeout(1000)
    await expect(hint(page)).toHaveCount(0)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test("afterwards: today's farm, the steps quiet", async ({ game }) => {
    await game.ready('farm')
    await game.page.evaluate(() => (window as any).__home.farm.reset())
    await game.ready()
  })
})
