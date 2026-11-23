/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { BEDS, MACHINES } from '../../src/farm/data'
import { opensAt, unlockName } from '../../src/farm/unlocks'
import { xpAt } from '../../src/farm/xp'
import { expect, test } from './helpers'

// What each level opens (src/farm/unlocks.ts), as a player's farm has it (a ?debug page has everything open: the locks
// are turned on here, `unlocks.all(false)`, and off again by `ready()`): a new farm offers what level 1 opens, and
// shows the rest locked with the level it opens at — the berry ribbon where the price was (src/ui/LockTag.tsx) — and
// buys none of it; a level reached plays its show, then "Unlocked!" (src/farm/Unlocked.tsx): a card for each thing it
// opened, which a tap takes away; and what it opened is then bought, planted and put into its machine. A machine is
// bought in the edit mode shop's Machines tab (src/farm/DecorShop.tsx) once its level opens it, and until then is not on
// the farm.

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

/** Which machines stand on the farm: drawn (their place in the scene) and on the action button (their interactable). */
const onFarm = (page: Page) =>
  page.evaluate(() => {
    const h = (window as any).__home
    const ids = h.interactables().map((d: any) => d.id)
    const standing = (m: string) => !!h.scene.getObjectByName(`place-${m}`) && ids.includes(`farm-${m}`)
    return Object.fromEntries(['mill', 'loom', 'oven', 'dairy', 'kettle'].map((m) => [m, standing(m)]))
  })

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

    // the machines: the loom, a new farm's, stands on it; the mill, the oven, the dairy and the jam kettle are not on the
    // farm (nothing drawn, nothing to press) but in the edit mode's shop, its Machines tab, each locked with its level
    expect(await onFarm(page)).toEqual({ mill: false, loom: true, oven: false, dairy: false, kettle: false })
    await openPanel(page, { kind: 'decor-shop', tab: 'decor' })
    await page.locator('.farm-panel [role="tab"]', { hasText: 'Machines' }).click()
    const machines = page.locator('.farm-panel .machine-card')
    await expect(machines).toHaveCount(4)
    await expect(machines.locator('.farm-card-name')).toHaveText(['Mill', 'Oven', 'Dairy', 'Jam kettle'])
    await expect(machines.locator('.lock-tag')).toHaveText(['Level 2', 'Level 5', 'Level 21', 'Level 25'])
    // the oven's card shakes (a card not open yet says so to the browser: the tap is forced), and nothing is bought
    await machines.filter({ hasText: 'Oven' }).click({ force: true })
    expect(await panelKind(page)).toBe('decor-shop')
    expect(await page.evaluate(() => (window as any).__home.farm.buyMachine('oven'))).toBe(false)
    expect(await onFarm(page)).toMatchObject({ oven: false })
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())

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

  test('level 2 reached: its show, then "Unlocked!" — wheat, the mill, flour and a hen — gone at a tap; then wheat plants, and the mill, bought, takes it', async ({ game }) => {
    const { page } = game
    await game.ready('farm')
    await newFarm(page)
    await reach(page, 2)
    await expect(page.locator('.level-up-show')).toBeVisible({ timeout: 30_000 })
    // after the level's show: a card for each thing it opened, dealt one by one (they stand on the screen, apart)
    await expect(page.locator('.unlocked')).toBeAttached({ timeout: 30_000 })
    await expect(page.locator('.unlocked')).toHaveAttribute('aria-label', `Unlocked at level 2: ${opensAt(2).map(unlockName).join(', ')}`)
    const shown = await dealt(page)
    expect(shown.names).toEqual(['Wheat', 'Mill', 'Flour', 'Another hen'])
    expect(shown.problems, shown.problems.join('\n')).toEqual([])
    // a tap gathers them (a second on the way ends it)
    await page.locator('.unlocked').click({ position: { x: 20, y: 200 } })
    await expect(page.locator('.unlocked')).toHaveCount(0, { timeout: 10_000 })

    // the level card tells what level 3 opens, a card each
    await openPanel(page, { kind: 'level' })
    await expect(page.locator('.level-card .lf-next .unlock-row .unlock-card')).toHaveCount(opensAt(3).length)
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())

    // what level 2 opened works: wheat planted, the mill bought and flour put into it, another hen bought
    const r = await page.evaluate(() => {
      const f = (window as any).__home.farm
      const bed = f.state.beds.findIndex((b: any) => b.built && !b.crop)
      f.state.inv.wheat = 1
      return { planted: f.plant(bed, 'wheat'), mill: f.buyMachine('mill'), milled: f.addJob('mill', 'wheat'), hen: f.buy('hen') }
    })
    expect(r).toEqual({ planted: true, mill: true, milled: true, hen: true })
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
      await expect.poll(() => page.evaluate((k) => (window as any).__revealed[k].opacity, label(2)), { timeout: 10_000 }).toBe(1)
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

  test('the oven, bought in the edit mode shop’s Machines tab at its level: it stands at its place, and the action button opens it', async ({ game }) => {
    const { page } = game
    await game.ready('farm')
    await newFarm(page)
    // level 5 at once, as a farm loaded there (no gain from play: no show), the coins for the oven and a lemon cake's
    // makings in the barn
    await page.evaluate((points) => {
      const f = (window as any).__home.farm
      f.state.xp = { points, paid: 5 }
      f.state.coins = 500
      Object.assign(f.state.inv, { flour: 1, sugar: 1, egg: 2, milk: 1, lemon: 2 })
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    }, xpAt(5))
    expect(await onFarm(page)).toMatchObject({ oven: false })
    await openPanel(page, { kind: 'decor-shop', tab: 'machines' })
    const oven = page.locator('.farm-panel .machine-card', { hasText: 'Oven' })
    await expect(oven).not.toHaveClass(/locked/)
    await expect(oven.locator('.tag')).toHaveText(String(MACHINES.oven.price))
    // its card asks first: Cancel, or Buy with its price
    await oven.click()
    const card = page.locator('.farm-panel[aria-label="Oven"]')
    await expect(card.locator('.farm-buy')).toContainText(String(MACHINES.oven.price))
    await page.waitForTimeout(600)
    await card.locator('.farm-buy').click()
    await expect.poll(() => onFarm(page), { timeout: 30_000 }).toMatchObject({ oven: true })
    const bought = await page.evaluate(() => {
      const f = (window as any).__home.farm
      return { coins: f.state.coins, owned: f.state.machines.oven.owned, at: f.state.layout.places.oven, home: f.places.oven.home }
    })
    expect(bought).toMatchObject({ coins: 500 - MACHINES.oven.price!, owned: true })
    expect(bought.at).toEqual(bought.home)
    // the Machines tab says it is on the farm, with nothing to buy
    await openPanel(page, { kind: 'decor-shop', tab: 'machines' })
    await expect(page.locator('.farm-panel .machine-card', { hasText: 'Oven' })).toContainText('On the farm')
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    // where you stand to use it: the action button opens its queue
    const stand = await page.evaluate(() => (window as any).__home.interactables().find((d: any) => d.id === 'farm-oven').position)
    await game.teleport(stand.x, 1.4, stand.z, -Math.PI / 2, -0.3)
    await expect.poll(() => page.evaluate(() => (window as any).__home.useHome.getState().nearby?.id ?? null), { timeout: 60_000 }).toBe('farm-oven')
    await page.keyboard.press('KeyE')
    await expect.poll(() => page.evaluate(() => (window as any).__home.useHome.getState().panel), { timeout: 30_000 }).toEqual({ kind: 'machine', id: 'oven' })
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test("afterwards: today's farm, everything open", async ({ game }) => {
    await game.ready('farm')
    await game.page.evaluate(() => (window as any).__home.farm.reset())
    await game.ready()
  })
})
