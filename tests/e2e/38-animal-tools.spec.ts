/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp, onMap, watchErrors, BASE, type Game } from './helpers'
import { XP_FOR } from '../../src/farm/data'

// The animals' tools (plans/animal-tools.md): the shop's card for each animal sells its tool once the herd is full
// (src/farm/shop), bought through its card with its build film once (src/film/films.ts, buyWithFilm); E at the tool's
// place by the fence opens its panel (src/farm/useTool.ts, src/farm/ToolPanel.tsx), where a tap takes one good into the
// barn and a step of its "a tap" upgrade, bought from its chip, takes two; the herd's own offers make way for it. A
// good's picture in a panel says where it is made (src/ui/GoodPic.tsx); the two premium remotes open the machine or the
// tool from there and come back. And on a phone, upright and sideways, the coop's panel fits. The farm runs on in real
// time between two calls: what is set and what is read about it are in one call where it matters.

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const panelIs = (game: Game, kind: string) => game.page.waitForFunction((k) => (window as any).__home.useHome.getState().panel?.kind === k, kind, { timeout: 30_000, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })

/** A new farm with coins, its hens at `hens` (the coop wants six), the levels open (a ?debug page's). */
async function newFarm(game: Game, hens: number, coins = 5000) {
  await game.page.evaluate(
    ({ hens, coins }) => {
      const f = (window as any).__home.farm
      ;(window as any).__home.useHome.getState().closePanel()
      f.reset()
      f.state.coins = 100_000
      while (f.state.producers.hens.animals < hens && f.buy('hen'));
      f.state.coins = coins
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    },
    { hens, coins },
  )
}

/** A herd full and its tool bought (the farm's own buy: no film). */
const ownTool = (game: Game, kind: string, one: string) =>
  game.page.evaluate(
    ({ kind, one }) => {
      const f = (window as any).__home.farm
      const coins = f.state.coins
      f.state.coins = 100_000
      while (f.buy(one));
      f.buyLadder(`${kind}-tool`)
      f.state.coins = coins
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    },
    { kind, one },
  )

test.describe('the animals’ tools', () => {
  test('the shop: the coop locked until six hens, bought through its card, its build film once; its card then opens it', async ({ game }) => {
    test.setTimeout(400_000)
    await game.ready('farm')
    const { page } = game
    await newFarm(game, 5)
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'shop' }))
    const hens = page.locator('.shop-animal[data-kind="hens"]')
    // five hens of six: the coop waits for the herd, with nothing to buy it with
    await expect(hens.locator('.shop-tool.locked')).toContainText('5/6 hens')
    await expect(hens.getByRole('button', { name: /^Coop, for/ })).toHaveCount(0)
    // the sixth hen from her card, at once: the herd full, the coop for sale (the card glows)
    await hens.getByRole('button', { name: /^Buy Another hen/ }).click()
    await expect(hens.locator('.shop-tool.sale')).toContainText('3 a nest · 1 a tap')
    await expect(hens).toHaveClass(/ready/)
    // the coop through its card, which asks first
    await hens.getByRole('button', { name: /^Coop, for 100 coins/ }).click()
    await panelIs(game, 'ladder')
    const xp0 = await page.evaluate(() => (window as any).__home.farm.state.xp.points)
    await page.waitForTimeout(600)
    await page.locator('.farm-confirm .farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.ladders['hens-tool'] === 1)
    // bought before its film: the coop yours, its XP; the shop's card back under it
    expect(await page.evaluate(() => (window as any).__home.farm.state.xp.points)).toBe(xp0 + XP_FOR.build)
    // its film plays once, a tap skips it to its end card
    await page.waitForFunction(() => (window as any).__home.story.state()?.step === 'film', null, { timeout: 120_000, polling: 100 })
    expect(await page.evaluate(() => (window as any).__home.story.state())).toMatchObject({ id: 'coop', step: 'film', xp: [xp0, xp0 + XP_FOR.build] })
    await page.mouse.click(320, 180)
    await page.waitForFunction(() => (window as any).__home.story.state()?.step === 'card', null, { timeout: 30_000, polling: 100 })
    const end = page.getByRole('dialog', { name: 'The coop is yours' })
    await expect(end).toContainText(`+${XP_FOR.build} XP`)
    await end.getByRole('button', { name: 'Continue' }).click()
    await page.waitForFunction(() => (window as any).__home.story.state() === null, null, { timeout: 10_000, polling: 100 })
    // the shop again: the coop is yours, and its button opens its panel (its ✕ back to the shop)
    await panelIs(game, 'shop')
    await expect(hens.locator('.shop-tool.owned')).toContainText('Yours')
    await hens.getByRole('button', { name: 'Open the coop' }).click()
    await panelIs(game, 'tool')
    await expect(page.locator('.tool-panel .tp-nest')).toHaveCount(6)
    await page.locator('.tool-panel .mp-head .mp-round').click()
    await panelIs(game, 'shop')
    // the film was asked once: nothing asks for it again
    expect(await page.evaluate(() => (window as any).__home.story.state())).toBe(null)
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('E at the nest opens the coop: a tap takes an egg into the barn, a step from its chip makes it two, no room takes none; the cows’ bucket takes their offers’ place', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await newFarm(game, 6)
    await ownTool(game, 'hens', 'hen')
    // the nests: two eggs in the first, none elsewhere, every hen's clock at its start (no egg comes during the test)
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.producers.hens.stock = [2, 0, 0, 0, 0, 0]
      f.state.producers.hens.timer = [0, 0, 0, 0, 0, 0]
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    })
    // the coop's place by the fence, looking at it: E opens its panel (nothing is taken on the button)
    const at = await page.evaluate(() => {
      const d = (window as any).__home.interactables().find((x: any) => x.id === 'farm-nest')
      return { x: d.position.x, z: d.position.z, ax: d.aim.x, az: d.aim.z }
    })
    await game.teleport(at.x, 1.4, at.z, Math.atan2(-(at.ax - at.x), -(at.az - at.z)), -0.5)
    await nearbyIs(game, 'farm-nest')
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().nearby.icon)).toMatchObject({ verb: 'pick', item: 'egg', count: 2, word: 'Collect' })
    await page.keyboard.press('KeyE')
    await panelIs(game, 'tool')
    await expect(page.locator('.tool-panel .tp-nest')).toHaveCount(6)
    expect(await page.evaluate(() => (window as any).__home.farm.state.producers.hens.stock)).toEqual([2, 0, 0, 0, 0, 0])

    // a tap on the first nest: one egg into the barn, its XP
    const before = await page.evaluate(() => ({ barn: (window as any).__home.farm.used('barn'), xp: (window as any).__home.farm.state.xp.points }))
    await page.locator('.tool-panel .tp-nest').first().click()
    await until(game, () => (window as any).__home.farm.state.producers.hens.stock[0] === 1)
    const after = await page.evaluate(() => ({ barn: (window as any).__home.farm.used('barn'), xp: (window as any).__home.farm.state.xp.points }))
    expect(after).toEqual({ barn: before.barn + 1, xp: before.xp + XP_FOR.collect })
    await expect(page.locator('.tool-panel .tp-said')).toContainText('+1 egg to the barn')

    // "a tap" a step up from its chip: its card over the panel, which stays; then a tap takes two
    await page.locator('.tool-panel .tp-up[data-ladder="hens-tap"]').click()
    await expect(page.locator('.ladder-card .farm-panel')).toBeVisible()
    await page.waitForTimeout(600)
    await page.locator('.ladder-card .farm-buy').click()
    await until(game, () => (window as any).__home.farm.state.ladders['hens-tap'] === 1)
    await expect(page.locator('.ladder-card')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().panel?.kind)).toBe('tool')
    await expect(page.locator('.tool-panel .tp-up[data-ladder="hens-tap"] .tp-up-now')).toHaveText('2 a tap')
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.producers.hens.stock = [0, 3, 0, 0, 0, 0]
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    })
    await page.locator('.tool-panel .tp-nest').nth(1).click()
    await until(game, () => (window as any).__home.farm.state.producers.hens.stock[1] === 1)

    // the barn full: the ribbon over the coop, and a tap takes nothing (nothing is lost)
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.inv.plank += f.room('barn')
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    })
    await expect(page.locator('.tool-panel .tp-full')).toHaveText('Barn full')
    await page.locator('.tool-panel .tp-nest').nth(1).click()
    await expect(page.locator('.tool-panel .tp-said')).toContainText('The barn is full')
    expect(await page.evaluate(() => (window as any).__home.farm.state.producers.hens.stock[1])).toBe(1)
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())

    // the cows' bucket: each cow's own offer goes, and the bucket's place takes the cows' id and opens its panel
    expect(await page.evaluate(() => (window as any).__home.interactables().some((d: any) => d.id === 'farm-cow-0'))).toBe(true)
    await ownTool(game, 'cows', 'cow')
    await until(game, () => {
      const ids = (window as any).__home.interactables().map((d: any) => d.id)
      return !ids.some((id: string) => /^farm-cow-\d$/.test(id)) && ids.includes('farm-cow')
    })
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.inv.plank = 0
      f.state.producers.cows.stock = [1, 0, 0]
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
      ;(window as any).__home
        .interactables()
        .find((d: any) => d.id === 'farm-cow')
        .run()
    })
    await until(game, () => (window as any).__home.useHome.getState().panel?.tool === 'cows')
    await expect(page.locator('.tool-panel .tp-vessel')).toBeVisible()
    await expect(page.locator('.tool-panel .tp-animal')).toHaveCount(3)
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('where is it made: wheat grows in a bed and flour is made at the mill (Show me); the remotes open the mill and the coop from the barn and come back; milk walks until the bucket is yours', async ({
    game,
  }) => {
    await game.ready('farm')
    const { page } = game
    await newFarm(game, 2, 30_000)
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      Object.assign(f.state.inv, { wheat: 5, flour: 3, egg: 4, milk: 2 })
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    })
    const open = (p: any) => page.evaluate((p) => (window as any).__home.useHome.getState().openPanel(p), p)
    const bubble = page.locator('.good-pop')
    const touch = async (good: string) => {
      await page.locator(`.farm-panel [data-good="${good}"]`).first().click()
      await expect(bubble).toBeVisible()
    }
    // the silo's wheat: grows in a bed, Show me; Esc closes the bubble only
    await open({ kind: 'store', store: 'silo' })
    await touch('wheat')
    await expect(bubble).toContainText('Grows in a bed')
    await expect(bubble.getByRole('button', { name: 'Show me' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(bubble).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().panel?.kind)).toBe('store')
    // the barn's flour: made at the mill
    await open({ kind: 'store', store: 'barn' })
    await touch('flour')
    await expect(bubble).toContainText('Made at the mill')
    await expect(bubble.getByRole('button', { name: 'Show me' })).toBeVisible()
    await page.keyboard.press('Escape')

    // the machines' remote: flour's button opens the mill from afar (night velvet); the remote's tag, and its ✕ back
    await page.evaluate(() => (window as any).__home.farm.buyLadder('machine-remote'))
    await open({ kind: 'store', store: 'barn' })
    await touch('flour')
    const mill = bubble.getByRole('button', { name: 'Open the mill (remote)' })
    await expect(mill).toHaveClass(/velvet/)
    await mill.click()
    await until(game, () => {
      const p = (window as any).__home.useHome.getState().panel
      return p?.kind === 'machine' && p.id === 'mill' && p.from?.kind === 'store' && p.from.store === 'barn'
    })
    await expect(page.locator('.remote-tag')).toContainText('Barn')
    await expect(page.locator('.remote-tag')).toContainText('Remote')
    await page.locator('.mp-sheet .mp-head').getByRole('button', { name: 'Close (Esc)' }).click()
    await until(game, () => (window as any).__home.useHome.getState().panel?.store === 'barn')

    // milk: no bucket, so Show me still; the animals' remote waits for a tool
    await touch('milk')
    await expect(bubble.getByRole('button', { name: 'Show me' })).toBeVisible()
    await expect(bubble.getByRole('button', { name: /^Open/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => (window as any).__home.farm.buyLadder('animal-remote'))).toBe(false)
    // the coop, then the animals' remote: the eggs open the coop from afar, and its tag's way back goes to the barn
    await ownTool(game, 'hens', 'hen')
    expect(await page.evaluate(() => (window as any).__home.farm.buyLadder('animal-remote'))).toBe(true)
    await open({ kind: 'store', store: 'barn' })
    await touch('egg')
    await bubble.getByRole('button', { name: 'Open the coop (remote)' }).click()
    await until(game, () => {
      const p = (window as any).__home.useHome.getState().panel
      return p?.kind === 'tool' && p.tool === 'hens' && p.from?.store === 'barn'
    })
    await expect(page.locator('.tool-panel .tp-nest')).toHaveCount(6)
    await page.locator('.remote-tag').getByRole('button', { name: 'Back to the barn' }).click()
    await until(game, () => (window as any).__home.useHome.getState().panel?.store === 'barn')
    // milk: still Show me (no bucket: the remote opens only a tool you own)
    await touch('milk')
    await expect(bubble.getByRole('button', { name: 'Show me' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('a phone: the coop’s panel on the screen upright and sideways, each nest and upgrade a finger’s size, the touch controls away under it', { tag: '@boot' }, async ({ browser }) => {
    test.setTimeout(720_000)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, baseURL: BASE })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    await bootApp(page)
    await onMap(page, 'farm')
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.coins = 100_000
      while (f.buy('hen'));
      f.buyLadder('hens-tool')
      f.state.producers.hens.stock = [3, 2, 1, 0, 3, 2]
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
      ;(window as any).__home.useHome.getState().openPanel({ kind: 'tool', tool: 'hens' })
    })
    for (const size of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size)
      await expect(page.locator('.tool-panel .tp-nest')).toHaveCount(6)
      // (measured once the sheet has come in: a page drawn in software is slow to move it)
      const measure = () =>
        page.evaluate(() => {
          const box = (el: Element) => el.getBoundingClientRect()
          const on = (b: DOMRect) => b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1
          const targets = [...document.querySelectorAll('.tool-panel .tp-nest, .tool-panel .tp-up, .tool-panel .mp-round, .tool-panel .tp-skins')].map(box)
          const shown = (sel: string) => [...document.querySelectorAll(sel)].filter((el) => (el as HTMLElement).offsetParent !== null && getComputedStyle(el).visibility !== 'hidden').length
          return {
            sheet: on(box(document.querySelector('.tool-panel .mp-sheet')!)),
            targets: targets.length,
            off: targets.filter((b) => !on(b)).length,
            small: targets.filter((b) => b.width < 44 || b.height < 44).length,
            touch: shown('.stick-zone') + shown('.act-btn') + shown('#ecctrl-virtual-button'),
          }
        })
      await expect.poll(measure, { message: `${size.width}×${size.height}`, timeout: 30_000 }).toEqual({ sheet: true, targets: 10, off: 0, small: 0, touch: 0 })
    }
    expect(errors, errors.join('\n')).toEqual([])
    await context.close()
  })
})
