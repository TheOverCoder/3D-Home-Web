/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { xpAt } from '../../src/farm/xp'
import { expect, press, test, type Game } from './helpers'

// 45, the neighbours (src/farm/people; update-v1/missions/03-characters-story.md): a chapter begins at its level with a
// letter in the mailbox by the gate (its flag up, the button says Read) — the very first letter opens by itself — read a
// line at a time; its request is pinned above the order board with the neighbour's face and name, no ×; sent, their
// thank-you letter brings its gift; the neighbours' sheet in the corner menu shows who is met, the story and the
// letters to read again; a neighbour in line is themselves, with their face and hearts in the buyers' panel. Upright
// and sideways on a phone, each card on the screen. On the shared page; `STILLS=<folder>` saves its stills there.

const STILLS = process.env.STILLS

/** The farm new, at noon, at `level`, the neighbours on and a new visit begun (for them and the cards). */
async function freshAt(page: Page, level: number) {
  await page.evaluate(
    ({ points, level }) => {
      const h = (window as any).__home
      const f = h.farm
      f.reset()
      f.setHour(12)
      f.freezeDay(true)
      f.state.xp = { points, paid: level }
      f.state.coins = 2000
      h.neighbours.quiet(false)
      h.neighbours.visit()
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    },
    { points: xpAt(level), level },
  )
}

const story = (page: Page) => page.evaluate(() => (window as any).__home.neighbours.story())
const waiting = (page: Page) => page.evaluate(() => (window as any).__home.neighbours.mail().waiting.map((l: any) => l.id) as string[])

/** Reads the letter card open to its end: Next until its last line, then its last press (Done, Claim or Close). */
async function readThrough(page: Page, last: RegExp) {
  const card = page.locator('.letter-card')
  await expect(card).toBeVisible({ timeout: 15_000 })
  const action = card.locator('.ps-action')
  for (let i = 0; i < 12; i++) {
    const words = (await action.textContent()) ?? ''
    if (last.test(words)) break
    await press(action)
    await page.waitForTimeout(150)
  }
  await expect(action).toHaveText(last)
  await press(action)
  await expect(card).toHaveCount(0, { timeout: 10_000 })
}

/** Stands at the mailbox, looking at it, until the action button offers it. */
async function atMailbox(game: Game) {
  // in the garden by the gate, over the fence from it, looking at its box
  await game.teleport(4.2, 1.4, 12.1, Math.atan2(-(4.675 - 4.2), -(13.48 - 12.1)), -0.3)
  await game.page.waitForFunction(() => (window as any).__home.useHome.getState().nearby?.id === 'farm-mailbox', null, { timeout: 30_000, polling: 250 })
}

/** A still at phone size, when asked for. */
async function still(page: Page, name: string) {
  if (STILLS) await page.screenshot({ path: `${STILLS}/${name}.png` })
}

/** The box of the first element `sel` matches, on the screen. */
const boxOf = (page: Page, sel: string) =>
  page.evaluate((sel) => {
    const e = Array.from(document.querySelectorAll(sel)).find((x) => x.getClientRects().length > 0)
    return e ? e.getBoundingClientRect().toJSON() : null
  }, sel)

test.describe('the neighbours', () => {
  test('a chapter: its letter opens by itself and reads a line at a time; its request on the board with their face; their thanks bring a gift', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await freshAt(page, 5)
    // the first chapter begins a frame after: the baker's letter, the flag up, his request on the board
    await expect.poll(() => story(page), { timeout: 15_000 }).toEqual({ done: [], on: 'bread', sent: false })
    expect(await waiting(page)).toEqual(['chapter:bread'])
    await page.waitForFunction(() => (window as any).__home.mailbox.flag() === (window as any).__home.mailbox.up, null, { timeout: 15_000, polling: 250 })
    // the very first letter opens by itself (the cards that open by themselves: after the welcome back and the gift)
    const card = page.locator('.letter-card')
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card.locator('.ps-head, .mp-head').first()).toContainText('Moshe')
    await expect(card.locator('.lc-line')).toContainText(/letter|bakery/i)
    // the farmer opens it; a tap on the paper is the next line too
    await press(card.locator('.lc-paper'))
    await readThrough(page, /^Done$/)
    expect(await waiting(page)).toEqual([])
    // the flag swings down
    await expect.poll(() => page.evaluate(() => (window as any).__home.mailbox.flag() === (window as any).__home.mailbox.down), { timeout: 10_000 }).toBe(true)

    // the request: pinned above the places with the baker's face and name, no ×; put in and sent
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.state.inv.flour = 10
      f.state.inv.egg = 10
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
      ;(window as any).__home.useHome.getState().openPanel({ kind: 'orders' })
    })
    const plank = page.locator('.ob-pinned')
    await expect(plank).toBeVisible({ timeout: 10_000 })
    await expect(plank.locator('.ob-sender')).toContainText('Moshe')
    await expect(plank.locator('.ob-sender .portrait')).toHaveCount(1)
    await expect(plank.locator('.ob-no')).toHaveCount(0)
    await press(plank.locator('.ob-put'))
    await press(page.locator('.ob-pinned .ob-send'))
    await expect.poll(() => story(page), { timeout: 15_000 }).toEqual({ done: ['bread'], on: null, sent: false })
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())

    // the thank-you, and the baker's first heart (the request was worth it), each with a gift: on the mailbox's button
    await expect.poll(() => waiting(page), { timeout: 10_000 }).toEqual(['thanks:bread', 'heart:baker:1'])
    await atMailbox(game)
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().nearby?.label)).toBe('Read 2 letters')
    // the oldest first: the thanks, a bench into the farm's store
    const benches = await page.evaluate(() => (window as any).__home.farm.state.layout.stored.bench)
    await page.keyboard.press('KeyE')
    await expect(card).toBeVisible({ timeout: 10_000 })
    await readThrough(page, /^Claim$/)
    expect(await page.evaluate(() => (window as any).__home.farm.state.layout.stored.bench)).toBe(benches + 1)
    // then the heart's, with its coins
    await expect.poll(() => page.evaluate(() => (window as any).__home.useHome.getState().nearby?.label), { timeout: 10_000 }).toBe('Read the letter from Moshe')
    const coins = await page.evaluate(() => (window as any).__home.farm.state.coins)
    await page.keyboard.press('KeyE')
    await readThrough(page, /^Claim$/)
    expect(await page.evaluate(() => (window as any).__home.farm.state.coins)).toBeGreaterThan(coins)
    expect(await waiting(page)).toEqual([])

    // the neighbours' sheet, from the corner menu: the baker met, the rest as silhouettes; the letters to read again
    await press(page.locator('.top-menu-btn'))
    await press(page.locator('.neighbours-open'))
    const sheet = page.locator('.neighbours-card')
    await expect(sheet).toBeVisible({ timeout: 10_000 })
    await expect(sheet.locator('.nb-person:not(.unmet)')).toHaveCount(1)
    await expect(sheet.locator('.nb-person:not(.unmet) .nb-name')).toHaveText('Moshe')
    await expect(sheet.locator('.nb-person.unmet')).toHaveCount(4)
    await expect(sheet.locator('.nb-stop.done')).toHaveCount(1)
    await expect(sheet.locator('.nb-letter')).toHaveCount(3)
    await press(sheet.locator('.nb-letter').first())
    await readThrough(page, /^Close$/)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('a neighbour at the gate: themselves, a heart on their bubble, their face and hearts in the buyers’ panel', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await freshAt(page, 5)
    await expect.poll(() => story(page), { timeout: 15_000 }).toMatchObject({ on: 'bread' })
    await page.evaluate(() => {
      const h = (window as any).__home
      h.useHome.getState().closePanel()
      h.farm.spawnVisitor({ who: 'baker', queued: true })
      h.farm.spawnVisitor({ queued: true })
      h.useHome.getState().openPanel({ kind: 'queue' })
    })
    const baker = page.locator('.farm-buyer').filter({ hasText: 'Moshe' })
    await expect(baker).toHaveCount(1, { timeout: 10_000 })
    await expect(baker.locator('.portrait')).toHaveCount(1)
    await expect(baker.locator('.people-hearts')).toHaveCount(1)
    // the stranger: their number on their shirt's colour, no hearts
    await expect(page.locator('.farm-buyer').filter({ hasNotText: 'Moshe' }).locator('.people-hearts')).toHaveCount(0)
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('upright and sideways on a phone: the letter, the pinned request and the neighbours’ sheet on the screen', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await freshAt(page, 13)
    // the first three chapters' writers met: two done, the third on, letters to read again
    await page.evaluate(() => {
      const h = (window as any).__home
      const n = h.neighbours
      for (let k = 0; k < 3; k++) {
        n.next()
        if (k < 2) {
          n.sent()
          h.farm.tick(0.05)
        }
      }
      n.befriend('baker', 'order')
      n.befriend('baker', 'chapter')
      h.farm.tick(0.05)
      for (const l of n.mail().waiting.slice()) if (!l.id.startsWith('chapter:scarves')) n.read(l.id)
      h.farm.spawnVisitor({ who: 'baker', queued: true })
      h.useHome.getState().closePanel()
    })
    try {
      for (const size of [
        { width: 390, height: 844 },
        { width: 844, height: 390 },
      ]) {
        const where = `${size.width}×${size.height}`
        await page.setViewportSize(size)
        // the mailbox with its flag up, from the lane
        await game.teleport(3.4, 1.4, 15.6, -0.54, -0.2)
        await page.waitForTimeout(1500)
        await still(page, `mailbox-${where}`)
        for (const [panel, sel] of [
          [{ kind: 'letter' }, '.letter-card'],
          [{ kind: 'orders' }, '.ob-pinned'],
          [{ kind: 'neighbours' }, '.neighbours-card'],
          [{ kind: 'queue' }, '.farm-buyer'],
        ] as const) {
          await page.evaluate((p) => (window as any).__home.useHome.getState().openPanel(p), panel)
          await expect(page.locator(sel)).toBeVisible({ timeout: 10_000 })
          await page.waitForTimeout(900)
          // (the letter's sheet whole; on the board the pinned plank, in the line the baker's row: their sheets scroll)
          const b = (await boxOf(page, panel.kind === 'letter' ? '.farm-panel' : sel))!
          expect(b.left, `${where}: ${sel}`).toBeGreaterThanOrEqual(-1)
          expect(b.right, `${where}: ${sel}`).toBeLessThanOrEqual(size.width + 1)
          expect(b.top, `${where}: ${sel}`).toBeGreaterThanOrEqual(-1)
          if (panel.kind !== 'neighbours') expect(b.bottom, `${where}: ${sel}`).toBeLessThanOrEqual(size.height + 1)
          await still(page, `${panel.kind}-${where}`)
          await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
          await expect(page.locator('.farm-panel')).toHaveCount(0, { timeout: 10_000 })
        }
      }
    } finally {
      await page.setViewportSize({ width: 640, height: 360 })
    }
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test("afterwards: today's farm again, the neighbours quiet", async ({ game }) => {
    await game.ready('farm')
    await game.page.evaluate(() => {
      const h = (window as any).__home
      h.neighbours.quiet(true)
      h.farm.reset()
    })
    await game.ready()
  })
})
