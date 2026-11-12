/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, bootApp, watchErrors, BASE, type Game } from './helpers'
import { XP_FOR } from '../../src/farm/data'
import { levelOf, levelReward, seedXp, xpAt } from '../../src/farm/xp'

// Levels (src/farm/xp.ts, src/farm/XpChip.tsx, src/fx/xp.ts): what you do on the farm is worth XP (XP_FOR in
// src/farm/data.ts). Crystals fly up from where it happened into the level chip at the top; its bar fills with what has
// landed and the chip pulses as it grows. A level reached is shown once — a flash, a ring, the number — and its coins
// wait on the chip until it is tapped. Only play shows a level-up: never a save loaded or another farm switched to.
// Every number is read in the same call that changes it (the farm ticks every frame).

const until = (game: Game, fn: () => boolean, timeout = 30_000) => game.page.waitForFunction(fn, null, { timeout, polling: 200 })
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })
const xpNow = (page: Page) => page.evaluate(() => (window as any).__home.farm.xpNow() as { level: number; into: number; need: number; points: number; unpaid: number })
const coins = (page: Page) => page.evaluate(() => (window as any).__home.farm.state.coins as number)

/** A new farm with no XP, everything shown at the top. */
const fresh = (game: Game) =>
  game.page.evaluate(() => {
    const h = (window as any).__home
    h.farm.setRandom(null)
    h.farm.reset()
    h.settings.getState().update({ hudMode: 'all' })
    h.farm.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })

/** What the top of the screen shows: everything, only the compass, or nothing. */
async function setHud(page: Page, mode: 'all' | 'compass' | 'clean') {
  await page.evaluate((mode) => (window as any).__home.settings.getState().update({ hudMode: mode }), mode)
  await page.waitForFunction((mode) => document.documentElement.dataset.hud === mode, mode)
}

/** XP for something done 3 m ahead of the camera (in view): `n` times the action's worth, as play gains it. */
const gain = (page: Page, action: string, n = 1) =>
  page.evaluate(
    ([action, n]) => {
      const h = (window as any).__home
      const c = h.camera
      const d = c.getWorldDirection(c.position.clone())
      h.farm.gainXp(action, n, { x: c.position.x + d.x * 3, y: c.position.y + d.y * 3, z: c.position.z + d.z * 3 })
      return { xp: h.farm.xpNow(), events: h.farm.xpEventCount() as number, flights: h.fx.stats.xp as number }
    },
    [action, n] as [string, number],
  )

/** The level chip's bar: how far it is filled (its fill's width over its own), or null when it is not shown. */
const barFill = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('.xp-bar')
    const fill = document.querySelector('.xp-bar-fill')
    if (!bar || !fill || bar.getClientRects().length === 0) return null
    const b = bar.getBoundingClientRect()
    return b.width > 0 ? fill.getBoundingClientRect().width / b.width : null
  })

interface Box {
  x: number
  y: number
  width: number
  height: number
}
interface Seen {
  /** crystals that took off, and the most in the air at once */
  flew: number
  most: number
  /** the most the level chip (or anything in it) was scaled and brightened */
  scale: number
  bright: number
  /** the least the bar was filled while crystals were in the air */
  lowFill: number
  /** the level-up show (`.level-up-show`, inside `.level-up`): seen, its words, where it stood */
  show: boolean
  showText: string
  showBox: Box | null
}

/**
 * Watches the top of the screen from now, in the page, at every change to it and every frame: the crystals in the air,
 * the level chip's pulse, the bar while crystals fly, and the level-up show (shown: on the screen, not see-through, with
 * a number). `seen` reads what it saw so far; `stopWatching` also stops it.
 */
const watch = (page: Page) =>
  page.evaluate(() => {
    const w = window as any
    w.__xpWatch?.stop()
    const got = { flew: 0, most: 0, scale: 1, bright: 1, lowFill: Infinity, show: false, showText: '', showBox: null as any }
    const flown = new Set<Element>()
    const look = () => {
      const flying = document.querySelectorAll('.xp-fly')
      flying.forEach((e) => flown.add(e))
      got.flew = flown.size
      got.most = Math.max(got.most, flying.length)
      const bar = document.querySelector('.xp-bar')
      const fill = document.querySelector('.xp-bar-fill')
      if (flying.length && bar && fill && bar.getBoundingClientRect().width > 0) got.lowFill = Math.min(got.lowFill, fill.getBoundingClientRect().width / bar.getBoundingClientRect().width)
      const chip = document.querySelector('.farm-chip-item.level')
      if (chip)
        for (const el of [chip, ...Array.from(chip.querySelectorAll('*'))]) {
          const cs = getComputedStyle(el)
          const m = /^matrix(?:3d)?\(([^,]+),\s*([^,]+)/.exec(cs.transform)
          if (m) got.scale = Math.max(got.scale, Math.hypot(+m[1], +m[2]))
          const s = parseFloat(cs.scale)
          if (s > 0) got.scale = Math.max(got.scale, s)
          const b = /brightness\(([\d.]+)\)/.exec(cs.filter)
          if (b) got.bright = Math.max(got.bright, +b[1])
        }
      for (const el of Array.from(document.querySelectorAll('.level-up .level-up-show'))) {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        const text = (el.textContent ?? '').trim()
        if (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && /\d/.test(text)) {
          got.show = true
          got.showText = text
          got.showBox = { x: r.x, y: r.y, width: r.width, height: r.height }
        }
      }
    }
    const mo = new MutationObserver(look)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
    let alive = true
    const frame = () => {
      look()
      if (alive) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    w.__xpWatch = {
      seen: got,
      stop: () => {
        alive = false
        mo.disconnect()
        return got
      },
    }
  })
const seen = (page: Page) => page.evaluate(() => ({ ...(window as any).__xpWatch.seen }) as Seen)
const stopWatching = (page: Page) => page.evaluate(() => ({ ...(window as any).__xpWatch.stop() }) as Seen)

/** Runs the page's animations (CSS, and the Web Animations API's) at `rate` times their speed, so the software
 *  renderer's few frames a second see a pulse of a quarter of a second. Returns what puts them back to full speed. */
async function slowAnimations(page: Page, rate: number) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Animation.enable')
  await cdp.send('Animation.setPlaybackRate', { playbackRate: rate })
  return async () => {
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 }).catch(() => {})
    await cdp.detach().catch(() => {})
  }
}

test.describe('levels', () => {
  test('a harvest: crystals fly up from the beds into the level chip, its bar fills with what landed, and it pulses', async ({ game }) => {
    await game.ready()
    const { page } = game
    await fresh(game)
    // four beds of ripe lettuce by the path (one press harvests every one in reach), the lemon tree picked
    await page.evaluate(() => {
      const f = (window as any).__home.farm.state
      f.beds.forEach((b: any, i: number) => {
        if (i < 4) Object.assign(b, { built: true, crop: 'lettuce', growth: 1e6, water: 20 })
      })
      f.producers.tree.stock[0] = 0
    })
    // on the path, looking down at the first bed
    await game.teleport(-1.2, 1.4, 9.0, Math.PI / 2, -0.7)
    await nearbyIs(game, 'farm-bed-0')
    await expect(page.locator('.farm-chip-item.level')).toBeVisible()
    const flights = await page.evaluate(() => (window as any).__home.fx.stats.xp as number)
    const restore = await slowAnimations(page, 0.1)
    try {
      await watch(page)
      await page.keyboard.press('KeyE')
      await until(game, () => (window as any).__home.farm.state.inv.lettuce > 0)
      const got = await page.evaluate(() => {
        const f = (window as any).__home.farm
        return { xp: f.xpNow(), harvested: f.state.beds.slice(0, 4).filter((b: any) => !b.crop).length as number }
      })
      // XP for every bed harvested, once
      expect(got.harvested).toBeGreaterThan(1)
      expect(got.xp.points).toBe(XP_FOR.harvest * got.harvested)
      expect(got.xp.level).toBe(1)
      // the crystals took off from the beds (in view), and every one landed
      await page.waitForFunction(() => (window as any).__xpWatch.seen.flew > 0 && document.querySelectorAll('.xp-fly').length === 0, null, { timeout: 120_000, polling: 250 })
      // the bar: what has landed, of what the next level needs
      await expect.poll(() => barFill(page), { timeout: 60_000 }).toBeCloseTo(got.xp.into / got.xp.need, 1)
      const s = await stopWatching(page)
      expect(await page.evaluate(() => (window as any).__home.fx.stats.xp)).toBeGreaterThan(flights)
      expect(s.most, 'at most 12 crystals in the air').toBeLessThanOrEqual(12)
      // while they flew, the bar showed the points less what was still in the air
      expect(s.lowFill).toBeLessThan(got.xp.into / got.xp.need - 0.05)
      // the chip pulsed as it grew: bigger and brighter for a moment
      expect(s.scale, 'the level chip pulses: scaled up').toBeGreaterThan(1.05)
      expect(s.bright, 'the level chip pulses: brighter').toBeGreaterThan(1.1)
      expect(s.show, 'no level reached, no level-up show').toBe(false)
    } finally {
      await restore()
    }
  })

  test('a level reached: shown once, its coins wait on the chip, a tap claims them — two levels at once in one tap', async ({ game }) => {
    await game.ready()
    const { page } = game
    await fresh(game)
    // outdoors, where the chips at the top are
    await game.teleport(-1.2, 1.4, 8.5, 0, 0)
    await page.evaluate(
      (points) => {
        const f = (window as any).__home.farm
        f.state.xp.points = points
        f.state.xp.paid = 1
        f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
      },
      xpAt(2) - 3,
    )
    const chip = page.locator('.farm-chip-item.level')
    await expect(chip).toBeVisible()
    const before = await page.evaluate(() => ({ coins: (window as any).__home.farm.state.coins as number, events: (window as any).__home.farm.xpEventCount() as number }))
    const restore = await slowAnimations(page, 0.25)
    try {
      await watch(page)
      // a step that builds something: level 2
      const g = await gain(page, 'build')
      expect(g.xp.level).toBe(2)
      expect(g.xp.unpaid).toBe(levelReward(2))
      expect(g.events).toBe(before.events + 1)
      await expect.poll(async () => (await seen(page)).show, { timeout: 60_000, message: 'the level-up show' }).toBe(true)
      expect((await stopWatching(page)).showText).toContain('2')
    } finally {
      await restore()
    }
    // the coins waiting, on the chip; a tap pays them, once
    await expect(chip).toContainText(String(levelReward(2)))
    await chip.click()
    await expect.poll(() => coins(page)).toBe(before.coins + levelReward(2))
    expect((await xpNow(page)).unpaid).toBe(0)
    expect(await page.evaluate(() => (window as any).__home.farm.state.xp.paid)).toBe(2)
    await expect(chip).not.toContainText(String(levelReward(2)))
    await chip.click()
    await page.waitForTimeout(800)
    expect(await coins(page)).toBe(before.coins + levelReward(2))
    // a goal's worth fifteen times over: two levels at once, one show, and one tap pays both
    const target = xpAt(4) - (await xpNow(page)).points
    const g = await gain(page, 'goal', Math.ceil(target / XP_FOR.goal))
    expect(g.xp.level).toBe(4)
    expect(g.xp.unpaid).toBe(levelReward(3) + levelReward(4))
    expect(g.events).toBe(before.events + 2)
    await expect(chip).toContainText(String(levelReward(3) + levelReward(4)))
    await chip.click()
    await expect.poll(() => coins(page)).toBe(before.coins + levelReward(2) + levelReward(3) + levelReward(4))
    expect(await page.evaluate(() => (window as any).__home.farm.state.xp.paid)).toBe(4)
  })

  test('the top of the screen: hidden, no crystals fly; cleared, no level-up shows; with less motion none fly and the bar fills at once', async ({ game }) => {
    await game.ready()
    const { page } = game
    await fresh(game)
    await game.teleport(-1.2, 1.4, 8.5, 0, 0)
    await expect(page.locator('.farm-chip-item.level')).toBeVisible()
    // (a level-up shown by the test before has gone)
    await expect(page.locator('.level-up-show')).toHaveCount(0, { timeout: 10_000 })
    try {
      // only the compass: the chip is hidden, so nothing flies to it (the points still count)
      await setHud(page, 'compass')
      await watch(page)
      const a = await gain(page, 'harvest', 2)
      await page.waitForTimeout(3000)
      expect(a.xp.points).toBe(2 * XP_FOR.harvest)
      expect((await stopWatching(page)).flew).toBe(0)
      expect(await page.evaluate(() => (window as any).__home.fx.stats.xp)).toBe(a.flights)
      // the clear view: a level reached is not shown (it happened: the count of gains went up)
      await setHud(page, 'clean')
      await watch(page)
      const b = await gain(page, 'goal', Math.ceil((xpAt(2) - a.xp.points) / XP_FOR.goal))
      expect(b.xp.level).toBe(2)
      expect(b.events).toBe(a.events + 1)
      await page.waitForTimeout(3000)
      const s = await stopWatching(page)
      expect(s.show, 'no level-up in the clear view').toBe(false)
      expect(s.flew).toBe(0)
      // everything shown again, but the player asked for less motion: no crystals, and the bar shows it all at once
      await setHud(page, 'all')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await watch(page)
      const c = await gain(page, 'harvest', 3)
      await expect.poll(() => barFill(page), { timeout: 30_000 }).toBeCloseTo(c.xp.into / c.xp.need, 1)
      await page.waitForTimeout(2000)
      expect((await stopWatching(page)).flew).toBe(0)
      expect(await page.evaluate(() => (window as any).__home.fx.stats.xp)).toBe(c.flights)
    } finally {
      await page.emulateMedia({ reducedMotion: null })
      await setHud(page, 'all')
    }
  })

  test('XP only for what changed: a bed already watered gives none, a dry one gives one; each bed planted gives one', async ({ game }) => {
    await game.ready()
    const r = await game.page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.coins = 100
      const xp = () => f.xpNow().points as number
      const start = xp()
      const planted = [0, 1, 2].filter((i) => f.plant(i, 'lettuce')).length
      const afterPlant = xp()
      // just planted: soaked, so watering again changes nothing
      f.water(0)
      const afterFull = xp()
      // one of the three dry: watering all three counts that one
      f.state.beds[1].water = 0
      for (const i of [0, 1, 2]) f.water(i)
      return { planted, plant: afterPlant - start, full: afterFull - afterPlant, dry: xp() - afterFull }
    })
    expect(r.planted).toBe(3)
    expect(r.plant).toBe(3 * XP_FOR.plant)
    expect(r.full, 'a bed watered while it had water enough: no XP').toBe(0)
    expect(r.dry).toBe(XP_FOR.water)
  })

  test('a farm saved before levels starts with the XP of what it did, its levels already paid, and no show', async ({ game }) => {
    await game.ready()
    const { page } = game
    await fresh(game)
    await game.teleport(-1.2, 1.4, 8.5, 0, 0)
    const stats = { harvested: 30, baked: 2, earned: 100, sent: 1 }
    // (a level-up shown by a test before has gone)
    await expect(page.locator('.level-up-show')).toHaveCount(0, { timeout: 10_000 })
    await watch(page)
    // this farm as a file, its XP taken out (a save from before levels) and what it did written in; loaded into the
    // third slot and played, then back to the first
    const r = await page.evaluate((stats) => {
      const h = (window as any).__home
      const { slots, farm: f } = h
      f.saveFarm()
      const file = JSON.parse(slots.exportSlot(1).text)
      delete file.save.xp
      Object.assign(file.save.stats, stats)
      const events = f.xpEventCount()
      const imported = slots.importSlot(3, JSON.stringify(file))
      slots.switchSlot(3)
      const there = { xp: f.xpNow(), paid: f.state.xp.paid, events: f.xpEventCount() }
      slots.switchSlot(1)
      slots.deleteSlot(3)
      return { imported, events, there, back: { xp: f.xpNow(), events: f.xpEventCount(), slot: slots.currentSlot() } }
    }, stats)
    expect(r.imported).toEqual({ ok: true })
    const seed = seedXp(stats)
    expect(r.there.xp.points).toBe(seed)
    expect(r.there.xp.level).toBe(levelOf(seed))
    expect(r.there.xp.level).toBeGreaterThan(1)
    // its levels were reached before: nothing to claim, and nothing shown — loading and switching farms are not play
    expect(r.there.paid).toBe(levelOf(seed))
    expect(r.there.xp.unpaid).toBe(0)
    expect(r.there.events).toBe(r.events)
    expect(r.back).toMatchObject({ events: r.events, slot: 1 })
    expect(r.back.xp.points).toBe(0)
    await page.waitForTimeout(3000)
    expect((await stopWatching(page)).show, 'no level-up show on loading a save or switching farms').toBe(false)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})

/** Two boxes overlap (by more than a pixel each way). */
const overlap = (a: Box, b: Box) => a.x + 1 < b.x + b.width && b.x + 1 < a.x + a.width && a.y + 1 < b.y + b.height && b.y + 1 < a.y + a.height

/** In the page: the boxes of what is shown at the top of the screen and of the touch controls. With `crowded`, a toast
 *  and the first hint are shown first (each time: a toast lasts two seconds), and measured once both stand. */
const boxes = (page: Page, crowded = false) =>
  page.evaluate(async (crowded) => {
    if (crowded) {
      const h = (window as any).__home
      h.useHome.getState().showToast('+ 4 lettuces', 'lettuce')
      h.useHome.setState({ hintShown: false })
      for (let i = 0; i < 100 && !(document.querySelector('.toast') && document.querySelector('.first-hint.touch')); i++) await new Promise((r) => setTimeout(r, 20))
    }
    const shown = (sel: string) =>
      Array.from(document.querySelectorAll(sel))
        .filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden')
        .map((e) => {
          const r = e.getBoundingClientRect()
          return { what: `${sel} ${typeof e.className === 'string' ? e.className : ''}`.trim(), x: r.x, y: r.y, width: r.width, height: r.height }
        })
    return {
      width: innerWidth,
      height: innerHeight,
      chips: shown('.farm-chip .farm-chip-item'),
      bar: shown('.xp-bar'),
      compass: shown('.compass'),
      // the rest of the top column (src/ui/TopStack.tsx)
      column: [...shown('.toast'), ...shown('.first-hint.touch'), ...shown('.level-up-show')],
      corner: shown('.hud-mode'),
      touch: [...shown('.stick-zone'), ...shown('.stick-tool'), ...shown('#ecctrl-virtual-button'), ...shown('.act-btn')],
    }
  }, crowded)

/** What is wrong at the top of the screen now: everything there on the screen and clear of each other, the touch
 *  controls clear of all of it; the level-up show (where it stood) on the screen and clear of the touch controls.
 *  `crowded`: with a toast and the first hint as well, each in its place in the top column and clear of the rest. */
async function layoutProblems(page: Page, show: Box | null, crowded = false) {
  const b = await boxes(page, crowded)
  const out: string[] = []
  if (crowded) {
    if (!b.column.some((x) => /toast/.test(x.what))) out.push('no toast')
    if (!b.column.some((x) => /first-hint/.test(x.what))) out.push('no first hint')
    const top = [...b.chips, ...b.bar, ...b.compass, ...b.corner]
    for (const c of b.column) {
      if (!(c.x >= -1 && c.y >= -1 && c.x + c.width <= b.width + 1 && c.y + c.height <= b.height + 1)) out.push(`${c.what} off the screen`)
      for (const x of top) if (overlap(c, x)) out.push(`${c.what} over ${x.what}`)
      for (const t of b.touch) if (overlap(c, t)) out.push(`${c.what} over ${t.what}`)
    }
    for (let i = 0; i < b.column.length; i++) for (let j = i + 1; j < b.column.length; j++) if (overlap(b.column[i], b.column[j])) out.push(`${b.column[i].what} over ${b.column[j].what}`)
  }
  const on = (x: Box) => x.x >= -1 && x.y >= -1 && x.x + x.width <= b.width + 1 && x.y + x.height <= b.height + 1
  if (b.chips.filter((c) => /\blevel\b/.test(c.what)).length !== 1) out.push('no level chip')
  if (b.chips.filter((c) => /\bday\b/.test(c.what)).length !== 1) out.push('no day chip')
  if (b.bar.length !== 1) out.push("no level's bar")
  for (const x of [...b.chips, ...b.bar, ...b.compass, ...b.corner]) if (!on(x)) out.push(`${x.what} off the screen`)
  for (let i = 0; i < b.chips.length; i++) for (let j = i + 1; j < b.chips.length; j++) if (overlap(b.chips[i], b.chips[j])) out.push(`${b.chips[i].what} over ${b.chips[j].what}`)
  for (const c of b.compass) for (const x of [...b.chips, ...b.bar]) if (overlap(c, x)) out.push(`the compass over ${x.what}`)
  for (const t of b.touch) for (const x of [...b.chips, ...b.bar, ...b.compass, ...b.corner]) if (overlap(t, x)) out.push(`${t.what} over ${x.what}`)
  if (show) {
    if (!on(show)) out.push('the level-up show off the screen')
    for (const t of b.touch) if (overlap(show, t)) out.push(`the level-up show over ${t.what}`)
  }
  return out
}

/** The top of the screen, once its layout has settled (a chip that grows wraps the row, and the compass under it
 *  follows on the next frame), has nothing wrong. */
const checkLayout = (page: Page, show: Box | null, size: string, crowded = false) =>
  expect.poll(() => layoutProblems(page, show, crowded), { timeout: 15_000, message: `${size}: the top of the screen${crowded ? ', with a toast and the hint' : ''}` }).toEqual([])

// A phone held upright and turned sideways: a page of its own with touch (coarse pointer), and opened again.
test.describe('levels on a phone', { tag: '@boot' }, () => {
  test('the level and the day chips clear of each other, the compass and the stick, both ways; a level claimed stays claimed when the farm is opened again, with no show', async ({ browser }) => {
    // two phone boots under software rendering (CI): four to five minutes each
    test.setTimeout(1_500_000)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, baseURL: BASE })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    try {
      await bootApp(page)
      // a new farm two XP short of level 3 (level 2 paid), outdoors where the chips are
      await page.evaluate(
        (points) => {
          const h = (window as any).__home
          h.farm.reset()
          h.farm.state.xp.points = points
          h.farm.state.xp.paid = 2
          h.settings.getState().update({ hudMode: 'all' })
          h.teleport(-1.2, 1.4, 8.5)
          h.look.yaw = 0
          h.look.pitch = 0
        },
        xpAt(3) - 2,
      )
      await expect(page.locator('.farm-chip-item.level')).toBeVisible({ timeout: 60_000 })
      await expect(page.locator('.farm-chip-item.day')).toBeVisible()
      const restore = await slowAnimations(page, 0.25)
      let show: Box | null = null
      try {
        await watch(page)
        expect((await gain(page, 'build')).xp.level).toBe(3)
        await expect.poll(async () => (await seen(page)).show, { timeout: 60_000, message: 'the level-up show' }).toBe(true)
        show = (await stopWatching(page)).showBox
      } finally {
        await restore()
      }
      await checkLayout(page, show, '390×844')
      await checkLayout(page, null, '390×844', true)
      // turned sideways
      await page.setViewportSize({ width: 844, height: 390 })
      await page.waitForFunction(() => innerWidth > innerHeight)
      await page.waitForTimeout(1500)
      await checkLayout(page, null, '844×390')
      await checkLayout(page, null, '844×390', true)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForTimeout(1500)
      // the coins of level 3, claimed with a tap on the chip
      const claim = await page.evaluate(() => ({ coins: (window as any).__home.farm.state.coins as number, unpaid: (window as any).__home.farm.xpNow().unpaid as number }))
      expect(claim.unpaid).toBe(levelReward(3))
      await page.locator('.farm-chip-item.level').tap()
      await expect.poll(() => coins(page)).toBe(claim.coins + levelReward(3))
      // opened again: the same XP, level 3 paid, nothing to claim, and no show (a load is not play)
      await bootApp(page)
      await watch(page)
      await page.evaluate(() => {
        const h = (window as any).__home
        h.teleport(-1.2, 1.4, 8.5)
        h.look.yaw = 0
      })
      await expect(page.locator('.farm-chip-item.level')).toBeVisible({ timeout: 60_000 })
      await page.waitForTimeout(3000)
      const again = await page.evaluate(() => {
        const f = (window as any).__home.farm
        return { xp: f.xpNow(), paid: f.state.xp.paid, coins: f.state.coins, events: f.xpEventCount() }
      })
      expect(again.xp.points).toBe(xpAt(3) - 2 + XP_FOR.build)
      expect(again.xp.level).toBe(3)
      expect(again.paid).toBe(3)
      expect(again.xp.unpaid).toBe(0)
      expect(again.coins).toBe(claim.coins + levelReward(3))
      expect(again.events).toBe(0)
      expect((await stopWatching(page)).show, 'no level-up show when the farm is opened again').toBe(false)
      await expect(page.locator('.farm-chip-item.level')).not.toContainText(String(levelReward(3)))
      expect(errors, errors.join('\n')).toEqual([])
    } finally {
      await context.close()
    }
  })
})
