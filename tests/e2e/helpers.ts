/* eslint-disable @typescript-eslint/no-explicit-any */
import { test as base, expect, type Page } from '@playwright/test'

/** Library warnings that are known and harmless (they are warnings, but we ignore them explicitly anyway). */
const IGNORED = [/THREE\.Clock: This module has been deprecated/, /using deprecated parameters for the initialization function/]

export const SPAWN = { x: -3.5, y: 1.4, z: 1.3 }

/** The address the app is served on (playwright.config.ts: 4185, or E2E_PORT for a second copy of the tree). */
export const BASE = `http://localhost:${Number(process.env.E2E_PORT) || 4185}`

export interface Game {
  page: Page
  /** console errors / page errors seen since the page was created */
  errors: string[]
  /** Boots the app if needed, then resets the world to a known state (spawn, nothing open or carried, every pickup where it started). */
  ready: () => Promise<void>
  state: () => Promise<any>
  teleport: (x: number, y: number, z: number, yaw?: number, pitch?: number) => Promise<void>
  /** Holds a key down for a while. */
  hold: (key: string, ms: number) => Promise<void>
}

/** Opens the app with the debug hooks, waits for the intro button, enters, waits for the first room. */
export async function bootApp(page: Page, query = 'debug&quality=low') {
  await page.goto(`/?${query}`)
  const btn = page.locator('.intro .primary')
  await expect(btn).toBeEnabled({ timeout: 300_000 })
  await btn.click()
  await page.waitForFunction(() => (window as any).__home?.useHome.getState().room != null, null, { timeout: 120_000, polling: 500 })
}

export function watchErrors(page: Page, errors: string[]) {
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (IGNORED.some((r) => r.test(t))) return
    errors.push(`console.error: ${t}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
}

async function isPlaying(page: Page) {
  return page
    .evaluate(() => {
      const h = (window as any).__home
      return !!h && h.useHome.getState().phase === 'playing' && !!h.teleport && !!h.physics
    })
    .catch(() => false)
}

/**
 * One browser page is shared by the whole run: booting the software-rendered scene takes a minute or
 * more, so each test resets the world (`game.ready()`) instead of paying for a fresh page. Tests that
 * need a pristine page (boot, reload, no WebGL) create their own.
 */
export const test = base.extend<object, { game: Game }>({
  game: [
    async ({ browser }, use) => {
      const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: BASE })
      const page = await context.newPage()
      const errors: string[] = []
      watchErrors(page, errors)

      const g: Game = {
        page,
        errors,
        state: () => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.useHome.getState(), (_k, v) => (typeof v === 'function' ? undefined : v)))),
        teleport: async (x, y, z, yaw, pitch = 0) => {
          await page.evaluate(
            ([x, y, z, yaw, pitch]) => {
              const h = (window as any).__home
              h.teleport(x, y, z)
              if (yaw !== undefined) {
                if (typeof h.look === 'function') h.look({ yaw, pitch })
                else {
                  h.look.yaw = yaw
                  h.look.pitch = pitch
                }
              }
            },
            [x, y, z, yaw, pitch] as [number, number, number, number | undefined, number],
          )
        },
        hold: async (key, ms) => {
          await page.keyboard.down(key)
          await page.waitForTimeout(ms)
          await page.keyboard.up(key)
        },
        ready: async () => {
          if (!(await isPlaying(page))) await bootApp(page)
          await page.evaluate(() => {
            const h = (window as any).__home
            const s = h.useHome.getState()
            if (s.screen) s.closeScreen()
            if (s.panel) s.closePanel()
            if (s.settingsOpen) s.setSettingsOpen(false)
            if (s.editing) s.setEditing(false)
            if (s.view !== 'first') s.setView('first')
            // every pickup back where it started (the first reset after the page booted saw them all there): one left
            // somewhere by a test (the mug dropped in the yard) would stand in the next one's way
            h.itemsHome ??= Object.fromEntries(Object.entries(s.items).map(([id, it]: [string, any]) => [id, it.pos]))
            for (const [id, pos] of Object.entries(h.itemsHome as Record<string, number[]>)) {
              const now = s.items[id]?.pos
              if (now && now.some((v: number, k: number) => v !== pos[k])) s.placeItem(id, pos)
            }
            h.useHome.setState({
              carrying: null,
              lamps: Object.fromEntries(Object.keys(s.lamps).map((k) => [k, true])),
              doors: Object.fromEntries(Object.keys(s.doors).map((k) => [k, false])),
            })
            h.teleport(-3.5, 1.4, 1.3)
            if (typeof h.look === 'function') h.look({ yaw: Math.PI, pitch: -0.04 })
            else {
              h.look.yaw = Math.PI
              h.look.pitch = -0.04
            }
            // the farm's clock at noon, and stopped: the light never changes between two frames a test compares (16), nor
            // during a walk that is measured (05); only 24-day moves it, and puts it back (guarded: a page from before
            // the day's clock has no such hooks)
            h.farm?.setHour?.(12)
            h.farm?.freezeDay?.(true)
          })
        },
      }
      await use(g)
      await context.close()
    },
    { scope: 'worker', timeout: 300_000 },
  ],
})

/** What `fillFarm` did: the heaviest piece for sale, and for each room how many went in, what the room then weighs, its
 *  limit and why one more is refused; the buyers in line; the herds. */
export interface FullFarm {
  heaviest: string
  rooms: Record<string, { added: number; weight: number; limit: number; reason: string }>
  line: number
  animals: Record<string, number>
  /** filled by this call (the furniture still merging, the animals going to their places) */
  fresh: boolean
}

/**
 * The farm at its fullest (05-budget, 16-view): each room filled with the heaviest piece for sale until the next one
 * is refused, every animal the shop sells, fifteen buyers in line, a ripe crop in every bed, and the supermarket yours
 * with every place on its shelves open and full of the heaviest good (`fillShelves`). Once per page, until `emptyFarm`
 * (the shelves again on every call); waits for the furniture to merge again and the animals and buyers to take their
 * places.
 */
export async function fillFarm(page: Page): Promise<FullFarm> {
  await fillShelves(page)
  const done: FullFarm = await page.evaluate(() => {
    const h = (window as any).__home
    if (h.__fullFarm) return { ...h.__fullFarm, fresh: false }
    h.farm.state.coins = 1_000_000
    const pieces = h.home.pieces
    const heaviest = Object.keys(pieces)
      .filter((t) => pieces[t].price > 0)
      .sort((a, b) => pieces[b].weight - pieces[a].weight)[0]
    const centre: Record<string, number[]> = { living: [-3.5, 3], office: [-3.5, -3], kitchen: [3.5, -3], bedroom: [3.5, 3] }
    const rooms: FullFarm['rooms'] = {}
    // the bedroom first: the lightest room the busiest view (the kitchen's) looks into
    for (const room of ['bedroom', 'living', 'office', 'kitchen']) {
      let added = 0
      // (without the room limit, `?debug&nocap`, a room takes what fits on its floor)
      for (let spot = h.home.freeSpot(heaviest, room); spot && added < 200; spot = h.home.freeSpot(heaviest, room)) {
        if (!h.home.buy(heaviest) || !h.home.placeStored(heaviest, spot).ok) break
        added++
      }
      const next = h.home.canPlace({ id: 'one-more', type: heaviest, x: centre[room][0], z: centre[room][1], rot: 0 })
      rooms[room] = { added, weight: h.home.roomWeight(room), limit: h.home.roomLimit, reason: next.reason ?? '' }
    }
    const f = h.farm
    for (let i = 0; i < 10; i++) for (const id of ['hen', 'cow', 'sheep']) f.buy(id)
    for (let i = 0; i < 12; i++) f.buy('queue')
    for (let i = f.inLine().length; i < f.placesInLine(); i++) f.spawnVisitor({ queued: true })
    f.state.beds.forEach((b: any) => (b.built = true))
    const crops = ['lettuce', 'carrot', 'strawberry', 'tomato', 'corn', 'pumpkin', 'wheat', 'sugarcane']
    f.state.beds.forEach((_: any, i: number) => {
      if (f.plant(i, crops[i % crops.length])) f.state.beds[i].growth = 1e6
    })
    f.state.producers.tree.stock[0] = 3
    f.state.producers.hens.stock[0] = 2
    const animals = Object.fromEntries(['cows', 'sheep', 'hens'].map((k) => [k, f.state.producers[k].animals]))
    h.__fullFarm = { heaviest, rooms, line: f.inLine().length, animals }
    return { ...h.__fullFarm, fresh: true }
  })
  // the furniture merged again, the animals and the buyers in their places
  if (done.fresh) await page.waitForTimeout(6000)
  return done
}

/**
 * The supermarket at its fullest (`fillFarm`; 05 and 16 fill it again before each view): the shop yours, every place on
 * its shelves open and full of corn, the heaviest good to draw (its kernels are geometry), as the rooms are filled with
 * the heaviest piece — and quiet: nobody about and no visits, so no shopper walking by opens its front door at random
 * (its shoppers are measured in the market's own views, standing still). And the farm's clock at noon and stopped, as
 * `ready()` leaves it. (Guarded: a page from before the supermarket and the day has no such hooks.)
 */
export async function fillShelves(page: Page) {
  await page.evaluate(() => {
    const f = (window as any).__home.farm
    f.setHour?.(12)
    f.freezeDay?.(true)
    f.marketFill?.('corn', { quiet: true })
  })
}

/**
 * Waits for the market's sliding doors to stand still (`__home.market.door()`: how far open, 0 shut to 1 open; they
 * open for you, a shopper or the manager within 2 m of the doorway, and take a moment), so that nothing compared or
 * measured near them is caught half way: at `want` (0 shut, 1 open), or at either. A page without them waits for nothing.
 */
export async function marketDoorStill(page: Page, want?: 0 | 1) {
  await page.waitForFunction(
    (want) => {
      const d = (window as any).__home.market?.door?.()
      return d === undefined || (want === null ? d === 0 || d === 1 : d === want)
    },
    want ?? null,
    { timeout: 90_000, polling: 250 },
  )
}

/** Today's farm again, after `fillFarm`, for the specs that follow. */
export async function emptyFarm(page: Page) {
  await page.evaluate(() => {
    const h = (window as any).__home
    h.farm.reset()
    delete h.__fullFarm
  })
}

export { expect }
