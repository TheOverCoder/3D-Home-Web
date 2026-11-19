/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { BEDS } from '../../src/farm/data'
import { opensAt, unlockName } from '../../src/farm/unlocks'
import { expect, test } from './helpers'

// What each level opens (src/farm/unlocks.ts), as a player's farm has it (a ?debug page has everything open: the locks
// are turned on here, `unlocks.all(false)`, and off again by `ready()`): a new farm offers what level 1 opens, and
// shows the rest locked with the level it opens at — the berry ribbon where the price was (src/ui/LockTag.tsx) — and
// buys none of it; a level reached plays its show, then "Unlocked!" (src/farm/Unlocked.tsx): a card for each thing it
// opened, which a tap takes away; and what it opened is then bought, planted and put into its machine.

/** A new farm at level 1 with its locks on, and coins for anything; once the interface has seen it at level 1 (the
 *  level's show counts from the level it last saw: XP gained in the same frame as the reset would count from before). */
async function newFarm(page: Page) {
  await page.evaluate(() => {
    const f = (window as any).__home.farm
    f.reset()
    f.unlocks.all(false)
    f.state.coins = 500
    f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })
  await expect(page.locator('.top-road .xp-star b')).toHaveText('1')
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

const panelKind = (page: Page) => page.evaluate(() => (window as any).__home.useHome.getState().panel?.kind ?? null)
const openPanel = (page: Page, panel: object) => page.evaluate((p) => (window as any).__home.useHome.getState().openPanel(p), panel)
const level = (page: Page) => page.evaluate(() => (window as any).__home.farm.xpNow().level as number)

/** XP from play up to `to` (each gain a sale's: the level's show follows, as from a sale). */
const reach = (page: Page, to: number) =>
  page.evaluate((to) => {
    const f = (window as any).__home.farm
    for (let i = 0; i < 500 && f.xpNow().level < to; i++) f.gainXp('sale', 10)
  }, to)

/** The cards of the reveal on the screen: their names, and whether each stands whole on the screen, under the
 *  dashboard and clear of the others. */
const dealt = (page: Page) =>
  page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.unlocked .unlocked-slot'))
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chips-bottom')) || 0
    const boxes = cards.map((c) => c.getBoundingClientRect())
    const problems: string[] = []
    boxes.forEach((b, k) => {
      if (b.left < 0 || b.right > innerWidth || b.bottom > innerHeight || b.top < top) problems.push(`card ${k} off the screen or under the dashboard`)
      boxes.forEach((o, j) => {
        if (j > k && b.left < o.right - 1 && o.left < b.right - 1 && b.top < o.bottom - 1 && o.top < b.bottom - 1) problems.push(`cards ${k} and ${j} overlap`)
      })
    })
    return { names: cards.map((c) => c.querySelector('.unlock-face b')?.textContent ?? ''), problems }
  })

test.describe('what each level opens', () => {
  test('a new farm: what level 1 has not opened shows its level where the price was, and nothing of it is bought', async ({ game }) => {
    const { page } = game
    await game.ready('farm')
    await newFarm(page)

    // the seed packets: lettuce and carrot to buy, and the rest folded under them into one row of small faded pictures,
    // each with the level it opens at: wheat locked till level 2 (it plants nothing, nor does `plant`)
    const bed = await page.evaluate(() => (window as any).__home.farm.state.beds.findIndex((b: any) => b.built && !b.crop))
    await openPanel(page, { kind: 'seeds', bed })
    const seeds = page.locator('.farm-panel .farm-grid')
    await expect(seeds.locator('.farm-card:not(.locked)')).toHaveCount(2)
    await expect(seeds.locator('.farm-card:not(.locked)').first()).toContainText('Lettuces')
    await expect(seeds.locator('.farm-card.locked')).toHaveCount(0)
    const fold = page.locator('.farm-panel .seed-fold')
    // every crop the level has not opened is in the row (the twelve but lettuce and carrot), with its level
    await expect(fold.locator('.seed-folded')).toHaveCount(10)
    for (const el of await fold.locator('.seed-folded').all()) await expect(el.locator('.lock-tag')).toHaveText(/^Lv \d+$/)
    const wheat = fold.locator('.seed-folded[aria-label="Sheaves of wheat: opens at level 2"]')
    await expect(wheat.locator('.lock-tag')).toHaveText('Lv 2')
    await wheat.click({ force: true })
    expect(await panelKind(page)).toBe('seeds')
    expect(await page.evaluate((bed) => (window as any).__home.farm.state.beds[bed].crop, bed)).toBe(null)
    expect(await page.evaluate((bed) => (window as any).__home.farm.plant(bed, 'wheat'), bed)).toBe(false)

    // the farm shop: another cow locked till 6 on the cows' card, no button to buy it (and their tool waits for the herd)
    await openPanel(page, { kind: 'shop' })
    const cows = page.locator('.shop-animal[data-kind="cows"]')
    await expect(cows.locator('.shop-animal-head .lock-tag')).toHaveText('Level 6')
    await expect(cows.getByRole('button', { name: /^Buy Another cow/ })).toHaveCount(0)
    await expect(cows.locator('.shop-tool.locked')).toContainText('1/3 cows')
    // a field of the farm's own rows: locked, its level across its corner where the price was
    await expect(page.locator('.farm-shop-item.locked', { hasText: 'East beds' }).locator('.lock-tag')).toHaveText('Level 5')
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())

    // the mill, every recipe locked: a status that says when it opens, its picture beside the ribbon
    const mill = await page.evaluate(() => (window as any).__home.interactables().find((d: any) => d.id === 'farm-mill').position)
    await game.teleport(mill.x, 1.4, mill.z, -Math.PI / 2, -0.7)
    await expect.poll(() => page.evaluate(() => (window as any).__home.useHome.getState().status?.label ?? null), { timeout: 30_000 }).toBe('Mill · opens at level 2')
    await expect(page.locator('.prompt.status .lock-tag')).toHaveText('Level 2')

    // an East field's plot: its tag is the level, with no price, and its card has nothing to build with
    const east = BEDS.find((b) => b.expansion === 'east')!.index
    const tag = await page.evaluate((i) => {
      const t = (window as any).__home
        .interactables()
        .find((d: any) => d.id === `farm-bed-${i}`)
        .tag()
      return { locked: t.locked, price: t.price ?? null }
    }, east)
    expect(tag).toEqual({ locked: 5, price: null })
    await openPanel(page, { kind: 'build', bed: east })
    await expect(page.locator('.farm-panel .farm-confirm .lock-tag')).toHaveText('Opens at level 5')
    await expect(page.locator('.farm-panel .farm-buy')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__home.farm.buy('east'))).toBe(false)
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBe(500)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('level 2 reached: its show, then "Unlocked!" — wheat, flour and a hen — gone at a tap; then wheat plants and the mill takes it', async ({ game }) => {
    const { page } = game
    await game.ready('farm')
    await newFarm(page)
    await reach(page, 2)
    await expect(page.locator('.level-up-show')).toBeVisible({ timeout: 30_000 })
    // after the level's show: a card for each thing it opened, dealt one by one (they stand on the screen, apart)
    await expect(page.locator('.unlocked')).toBeAttached({ timeout: 30_000 })
    await expect(page.locator('.unlocked')).toHaveAttribute('aria-label', `Unlocked at level 2: ${opensAt(2).map(unlockName).join(', ')}`)
    const shown = await dealt(page)
    expect(shown.names).toEqual(['Wheat', 'Flour', 'Another hen'])
    expect(shown.problems, shown.problems.join('\n')).toEqual([])
    // a tap gathers them (a second on the way ends it)
    await page.locator('.unlocked').click({ position: { x: 20, y: 200 } })
    await expect(page.locator('.unlocked')).toHaveCount(0, { timeout: 10_000 })

    // the level card tells what level 3 opens, a card each
    await openPanel(page, { kind: 'level' })
    await expect(page.locator('.level-card .lf-next .unlock-row .unlock-card')).toHaveCount(opensAt(3).length)
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())

    // what level 2 opened works: wheat planted, flour put into the mill, another hen bought
    const r = await page.evaluate(() => {
      const f = (window as any).__home.farm
      const bed = f.state.beds.findIndex((b: any) => b.built && !b.crop)
      f.state.inv.wheat = 1
      return { planted: f.plant(bed, 'wheat'), milled: f.addJob('mill', 'wheat'), hen: f.buy('hen') }
    })
    expect(r).toEqual({ planted: true, milled: true, hen: true })
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('with less motion: the cards are simply there, each level its own, and a tap takes them away', async ({ game }) => {
    const { page } = game
    await game.ready('farm')
    await newFarm(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    try {
      // what each reveal showed, watched in the page (a software-drawn page answers too slowly to catch each moment):
      // its cards at their fullest, and whether any of them ever moved
      await page.evaluate(() => {
        const seen: Record<string, { cards: number; opacity: number; moved: boolean }> = {}
        const w = window as any
        w.__revealed = seen
        w.__watch = window.setInterval(() => {
          const u = document.querySelector('.unlocked')
          if (!u) return
          const cards = Array.from(u.querySelectorAll('.unlock-card'))
          const o = (seen[u.getAttribute('aria-label') ?? ''] ??= { cards: cards.length, opacity: 0, moved: false })
          o.opacity = Math.max(o.opacity, Math.min(...cards.map((c) => Number(getComputedStyle(c).opacity))))
          if (cards.some((c) => getComputedStyle(c).transform !== 'none')) o.moved = true
        }, 40)
      })
      await reach(page, 3)
      expect(await level(page)).toBe(3)
      const label = (l: number) => `Unlocked at level ${l}: ${opensAt(l).map(unlockName).join(', ')}`
      // level 2's reveal, then level 3's: every card there at once, at its place (nothing flies)
      await expect.poll(() => page.evaluate(() => Object.keys((window as any).__revealed)), { timeout: 60_000 }).toEqual([label(2), label(3)])
      await expect.poll(() => page.evaluate(() => (window as any).__revealed[`Unlocked at level 2: Wheat, Flour, Another hen`].opacity), { timeout: 10_000 }).toBe(1)
      const two = await page.evaluate((k) => (window as any).__revealed[k], label(2))
      expect(two).toMatchObject({ cards: opensAt(2).length, moved: false })
      // a tap takes level 3's away
      await page.locator('.unlocked').click({ position: { x: 20, y: 200 } })
      await expect(page.locator('.unlocked')).toHaveCount(0, { timeout: 10_000 })
      expect(await page.evaluate((k) => (window as any).__revealed[k].moved, label(3))).toBe(false)
    } finally {
      await page.evaluate(() => window.clearInterval((window as any).__watch))
      await page.emulateMedia({ reducedMotion: null })
    }
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test("afterwards: today's farm, everything open", async ({ game }) => {
    await game.ready('farm')
    await game.page.evaluate(() => (window as any).__home.farm.reset())
    await game.ready()
  })
})
