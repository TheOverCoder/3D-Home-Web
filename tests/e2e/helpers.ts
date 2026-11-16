/* eslint-disable @typescript-eslint/no-explicit-any */
import { test as base, expect, type Browser, type Page } from '@playwright/test'
import { unpaidCoins, xpAt } from '../../src/farm/xp'

/** Library warnings that are known and harmless (they are warnings, but we ignore them explicitly anyway). */
const IGNORED = [/THREE\.Clock: This module has been deprecated/, /using deprecated parameters for the initialization function/]

export const SPAWN = { x: -3.5, y: 1.4, z: 1.3 }
/** Where a new farm starts, on the farm (src/data/maps.ts, FARM_START): on the path among the beds, looking south. */
export const FARM_START = { x: -1.2, y: 1.4, z: 6.8 }

/** The two maps (src/scene/Maps.tsx): the house on its own plot, and the farm. */
export type MapId = 'home' | 'farm'

/** The coins the levels reached between two reads of the farm's `xp.paid` brought by themselves (src/farm/state.ts,
 *  arrive): what a count of coins leaves out to show what an action itself cost or paid (the XP it gave can reach a
 *  level). Read `xp.paid` in the same call as the coins. */
export const levelPay = (from: number, to: number) => unpaidCoins({ points: xpAt(to), paid: from })

/** The address the app is served on (playwright.config.ts: 4185, or E2E_PORT for a second copy of the tree). */
export const BASE = `http://localhost:${Number(process.env.E2E_PORT) || 4185}`

export interface Game {
  page: Page
  /** console errors / page errors seen since the page was created */
  errors: string[]
  /** Boots the app if needed, then resets the world to a known state on a map (the house, by default: in its living room,
   *  where it always started; the farm: at a new farm's start), nothing open or carried, every pickup where it started.
   *  The map is changed when needed (the test farm owns the house). */
  ready: (map?: MapId) => Promise<void>
  state: () => Promise<any>
  teleport: (x: number, y: number, z: number, yaw?: number, pitch?: number) => Promise<void>
  /** Holds a key down for a while. */
  hold: (key: string, ms: number) => Promise<void>
}

/** Puts the daily gift out of the way (src/farm/daily.ts: it never opens by itself, nor waits in the corner menu; its
 *  card, if open, closes) for a test that is not about it (tests/e2e/35-daily never puts it away). Guarded: a page from
 *  before it has no such hook. */
export const quietDaily = (page: Page) => page.evaluate(() => (window as any).__home?.farm?.daily?.quiet?.(true))

/** Turns the week's events off (src/farm/events.ts: they follow the device's date; a ?debug page starts with them off
 *  unless it says &events=on, and 34-events sets dates of its own). Guarded: a page from before them has no such hook. */
export const quietEvents = (page: Page) => page.evaluate(() => (window as any).__home?.events?.set?.(null))

/** Opens the app with the debug hooks, waits for the intro button, enters, waits until you stand on the first map (a
 *  new farm: the farm, outdoors). The daily gift is put out of the way (`quietDaily`) and the week's events are off
 *  (`quietEvents`). */
export async function bootApp(page: Page, query = 'debug&quality=low') {
  await page.goto(`/?${query}`)
  const btn = page.locator('.intro .primary')
  await expect(btn).toBeEnabled({ timeout: 300_000 })
  await btn.click()
  await page.waitForFunction(
    () => {
      const s = (window as any).__home?.useHome.getState()
      // (and where you stand looked at once: in a room, or outdoors)
      return !!s && s.phase === 'playing' && s.mapReady && !s.curtain && (s.outdoors || s.room !== null)
    },
    null,
    { timeout: 120_000, polling: 500 },
  )
  await quietDaily(page)
  await quietEvents(page)
}

/** Puts the shared page on a map (the house yours first): the scene changes behind its curtain, you at that map's start.
 *  Nothing happens when you are on it already. */
export async function onMap(page: Page, map: MapId) {
  const there = await page.evaluate((map) => {
    const h = (window as any).__home
    const s = h.useHome.getState()
    if (s.map === map && s.mapReady && !s.curtain) return true
    h.maps.go(map)
    return false
  }, map)
  if (there) return
  await page.waitForFunction(
    (map) => {
      const s = (window as any).__home.useHome.getState()
      return s.map === map && s.mapReady && !s.curtain
    },
    map,
    { timeout: 180_000, polling: 250 },
  )
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

/** The drawing-free WebGL context (nullgl.js): what a frame draws is counted as by a real one (tests/e2e/26-counting
 *  checks it, side by side), at full speed instead of software rendering's few frames a second. */
export const NULL_GL = new URL('./nullgl.js', import.meta.url).pathname

/** A page with the game and the helpers round it (`ready`, `teleport`…), booted on its first `ready()`. `counting`: on
 *  the drawing-free context, for what only counts draws and triangles (the budget walk); nothing is drawn. */
export async function openGame(browser: Browser, counting = false): Promise<{ game: Game; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: BASE })
  const page = await context.newPage()
  if (counting) await page.addInitScript({ path: NULL_GL })
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
    ready: async (map = 'home') => {
      if (!(await isPlaying(page))) await bootApp(page)
      await onMap(page, map)
      await page.evaluate(async (map) => {
        // the page's clock and its animations' timeline in step (read again on a new frame: the timeline moves on with
        // frames, and a slow one is a few seconds). A test that moves either apart (the clock moved on: 20-away's page
        // hidden; the timeline slowed through DevTools) cannot put it back, and Motion, which starts each animation on
        // the clock and plays it on the timeline, would start every one that much late: a page of its own for that
        const apart = () => Math.abs(performance.now() - Number(document.timeline.currentTime))
        if (apart() > 5000) await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        if (apart() > 5000) throw new Error(`the page's clock and its animations' timeline are ${Math.round(apart() / 1000)} s apart: a test that moves either needs a page of its own`)
        const h = (window as any).__home
        const s = h.useHome.getState()
        if (s.screen) s.closeScreen()
        if (s.panel) s.closePanel()
        if (s.settingsOpen) s.setSettingsOpen(false)
        if (s.editing) s.setEditing(false)
        // (read again: closing the wardrobe goes back to the view it was opened from)
        if (h.useHome.getState().view !== 'first') s.setView('first')
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
        // the house: its living room, where it always started; the farm: where a new farm starts
        const at = map === 'home' ? [-3.5, 1.3] : [-1.2, 6.8]
        h.teleport(at[0], 1.4, at[1])
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
        // the week's events off (src/farm/events.ts: they follow the device's date, so a run on a Saturday or a
        // Thursday would change prices, gifts and speeds): a ?debug page starts with them off, and a spec that turned
        // them on (34-events) leaves them off for the next
        h.events?.set?.(null)
        // the daily gift out of the way: it would open over a test by itself once a day (35-daily tests it)
        h.farm?.daily?.quiet?.(true)
      }, map)
    },
  }
  return { game: g, close: () => context.close() }
}

/**
 * One browser page is shared by the whole run: booting the software-rendered scene takes a minute or
 * more, so each test resets the world (`game.ready()`) instead of paying for a fresh page. Tests that
 * need a pristine page (boot, reload, no WebGL) create their own.
 */
export const test = base.extend<object, { game: Game }>({
  game: [
    async ({ browser }, use) => {
      const { game, close } = await openGame(browser)
      await use(game)
      await close()
    },
    { scope: 'worker', timeout: 300_000 },
  ],
})

/** The same shared page, on the drawing-free context: for a spec that only counts (05-budget). Its own worker, so the
 *  specs that draw keep a real context. */
export const countingTest = base.extend<object, { game: Game }>({
  game: [
    async ({ browser }, use) => {
      const { game, close } = await openGame(browser, true)
      await use(game)
      await close()
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
  /** the decoration and fruit plants standing on the farm, by kind */
  decor: Record<string, number>
  /** filled by this call (the furniture still merging, the animals going to their places) */
  fresh: boolean
}

/**
 * The farm at its fullest (05-budget, 16-view): each room filled with the heaviest piece for sale until the next one
 * is refused, every animal the shop sells, fifteen buyers in line, a ripe crop in every bed, the farm decorated (a
 * hundred pieces, every fruit tree and bush hung full), and the supermarket yours
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
    // the house yours (the two maps: src/scene/Maps.tsx)
    h.farm.state.apartment.owned = true
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
    // the farm decorated (src/farm/decor.ts, the edit mode's shop), on the free land where the house stood and round
    // it, through the game's own rules (each where it fits, or the nearest free spot): a fenced garden with a path
    // across it, lamps and lanterns, benches, trees and bushes, flowers, a bird bath, a well and the three scarecrows,
    // and every kind of fruit tree and bush, hung full
    const decor: [string, number, number, number][] = [
      ...[-5, -3, -1, 1, 3, 5].map((x): [string, number, number, number] => ['fence', x, -6, 0]),
      ...[-5, -3, -1].flatMap((z): [string, number, number, number][] => [
        ['fence', -6, z, 1],
        ['fence', 6, z, 1],
      ]),
      ['fence', -5, 0, 0],
      ['fence', 5, 0, 0],
      // the path: 1.2 m tiles edge to edge (each put down near the last joins it), down the middle and across
      ...[-5.4, -4.2, -3, -1.8, -0.6, 0.6, 1.8, 3, 4.2].map((z): [string, number, number, number] => ['path', 0, z, 0]),
      ...[1.2, 2.4, 3.6, 4.8, -1.2, -2.4, -3.6, -4.8].map((x): [string, number, number, number] => ['path', x, -1.8, 0]),
      ...[-6.5, -4.5, -2.5, 2.5, 4.5, 6.5].map((x): [string, number, number, number] => ['hedge', x, 4, 0]),
      ...[
        [1, -4],
        [-1, -4],
        [1, 1],
        [-1, 1],
        [3.5, 5.5],
        [-3.5, 5.5],
      ].map(([x, z]): [string, number, number, number] => ['lamp', x, z, 0]),
      ...[-4, -2, 2, 4].flatMap((x): [string, number, number, number][] => [
        ['lantern', x, -3, 0],
        ['lantern', x, -0.5, 0],
      ]),
      ['bench', -3, -5, 0],
      ['bench', 3, -5, 0],
      ['bench', -3, 1.5, 2],
      ['tree', -7.5, -3, 0],
      ['tree', 7.5, 2, 0],
      ['tree', -4, 7, 0],
      ['pine', -7.5, 1, 0],
      ['pine', 7.5, -5, 0],
      ['pine', 6, 6.5, 0],
      ...[-4.5, -2, 2, 4.5].map((x): [string, number, number, number] => ['bush', x, -4.5, 0]),
      ['bush', -5, 2.5, 0],
      ['bush', 5, 2.5, 0],
      ...[-4.5, 4.5, -2.5, 2.5].map((x): [string, number, number, number] => ['roses', x, 1.5, 0]),
      ...[-3.5, -2, 2, 3.5, 5, -5].map((x): [string, number, number, number] => ['flowers', x, 2.8, 0]),
      ['planter', -1.5, -5.5, 0],
      ['planter', 1.5, -5.5, 0],
      ['planter', 2.5, 1.5, 0],
      ['birdbath', 3, -1, 0],
      ['well', -3, 6, 0],
      ['scarecrow-squire', -5.5, 0.5, 0],
      ['scarecrow-ploughman', 0, 7.5, 0],
      ['scarecrow-bogle', 5.5, -2.5, 0],
      ...[-5, -4, -3, -2, -1, 1].map((x): [string, number, number, number] => ['stones', x, 6, 0]),
      ['apple-tree', 7.5, -2, 0],
      ['apple-tree', -6, -8, 0],
      ['orange-tree', 3, -8, 0],
      ['orange-tree', -8, 4, 0],
      ['cherry-tree', 6, -8, 0],
      ['cherry-tree', 2, 7, 0],
      ['blueberry-bush', -5, 9, 0],
      ['blueberry-bush', 6.5, 9, 0],
      ['blueberry-bush', -7.5, -5.5, 0],
      ['raspberry-bush', 7.5, 4.5, 0],
      ['raspberry-bush', -7.5, 6.5, 0],
      ['raspberry-bush', 4.5, 9, 0],
    ]
    const placed: Record<string, number> = {}
    for (const [kind, x, z, rot] of decor) {
      if (!f.buyDecor(kind)) continue
      const spot = f.placeDecor(kind, { x, z, rot }).ok ? true : !!f.freeDecorSpot(kind, x, z) && f.placeDecor(kind, f.freeDecorSpot(kind, x, z)).ok
      if (spot) placed[kind] = (placed[kind] ?? 0) + 1
    }
    // (the most each bears: PRODUCERS in src/farm/data.ts)
    const most: Record<string, number> = { 'apple-tree': 8, 'orange-tree': 8, 'cherry-tree': 12, 'blueberry-bush': 8, 'raspberry-bush': 8 }
    for (const [k, n] of Object.entries(most)) f.state.producers[k].stock = f.state.producers[k].stock.map(() => n)
    const animals = Object.fromEntries(['cows', 'sheep', 'hens'].map((k) => [k, f.state.producers[k].animals]))
    h.__fullFarm = { heaviest, rooms, line: f.inLine().length, animals, decor: placed }
    return { ...h.__fullFarm, fresh: true }
  })
  // the furniture merged again, the animals and the buyers in their places
  if (done.fresh) await page.waitForTimeout(6000)
  await copiesMade(page)
  return done
}

/** Until every lighter copy asked for is made (src/lib/sculpt/lod.ts: made in idle time once a map can be played). They
 *  are made now (`copiesNow`): a page drawn in software has little idle time, and waiting for it took longer than the
 *  making itself (the same copies; a map still loading is waited for). */
export async function copiesMade(page: Page) {
  await page.waitForFunction(
    () => {
      const h = (window as any).__home
      h.copiesNow?.()
      return !(h.copies?.pending > 0)
    },
    null,
    { timeout: 120_000, polling: 250 },
  )
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

/** Today's farm again, after `fillFarm`, for the specs that follow (a new farm: the scene goes to the farm with it). */
export async function emptyFarm(page: Page) {
  await page.evaluate(() => {
    const h = (window as any).__home
    h.farm.reset()
    delete h.__fullFarm
  })
  await page.waitForFunction(
    () => {
      const h = (window as any).__home
      const s = h.useHome.getState()
      return s.map === h.farm.state.place && s.mapReady && !s.curtain
    },
    null,
    { timeout: 180_000, polling: 250 },
  )
}

/**
 * The house changed every way decorating can change its shell (05-budget, 16-view; src/home/shell.ts): the living room's
 * west window and the garden door on its west wall (its two pictures put away), the kitchen's north window round the
 * corner on its east wall, the doorway between the living room and the bedroom closed, the kitchen's door moved along
 * its wall (the bedroom's switch put away) and the studio's doorway to the kitchen too, the bedroom's south window
 * along its wall; every room painted and floored. Through the game's own rules (what fits): whatever was refused
 * comes back, with why (nothing, when all went). `restoreHouse` puts the house back as it was.
 */
export async function changeHouse(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const h = (window as any).__home.home
    h.__before ??= JSON.parse(JSON.stringify(h.layout))
    const out: string[] = []
    for (const id of ['picture-living-wide', 'picture-living-tall', 'switch-bedroom']) if (h.layout.pieces.some((p: any) => p.id === id) && !h.putAway(id)) out.push(`${id}: not put away`)
    const moves: [string, string, number, boolean][] = [
      ['win-living-west', 'w-living', 1.1, false],
      ['garden-door', 'w-living', 3.9, false],
      ['win-kitchen-north', 'e-kitchen', -4.4, false],
      ['livingBedroom', 'mid-s', 3, true],
      ['kitchenBedroom', 'mid-e', 2.0, false],
      ['officeKitchen', 'mid-n', -4.3, false],
      ['win-bedroom-south', 's-bedroom', 5.2, false],
    ]
    for (const [id, run, centre, closed] of moves) {
      const fit = h.moveOpening(id, { run, centre, closed })
      if (!fit.ok) out.push(`${id}: ${fit.reason}`)
    }
    const paint: Record<string, string> = { living: 'sage', office: 'slate', kitchen: 'butter', bedroom: 'blush' }
    const floors: Record<string, string> = { living: 'limestone', office: 'slate-stone', kitchen: 'terracotta', bedroom: 'walnut' }
    for (const room of Object.keys(paint)) if (!h.paint(room, paint[room]) || !h.floor(room, floors[room])) out.push(`${room}: not painted or floored`)
    return out
  })
}

/** The house back as it was before `changeHouse`. */
export async function restoreHouse(page: Page) {
  await page.evaluate(() => {
    const h = (window as any).__home.home
    if (h.__before) h.restore(h.__before)
    delete h.__before
  })
}

/** A view of the house made from one of its openings (`openingViews`). */
export interface OpeningView {
  name: string
  kind: 'doorway' | 'window' | 'garden'
  x: number
  z: number
  yaw: number
  pitch?: number
  /** the kitchen's door open or shut (the hinged doorway's views) */
  door?: boolean
  /** a view to compare the sun's map in too */
  shadow?: boolean
}

/**
 * The house's views made from its openings as the save has them (`__home.home.openings()`), so a moved, closed or
 * opened one is looked at where it is: each open doorway from 1.2 m out on both sides looking through it, and standing
 * in it (the kitchen's, with its door shut and open, from the bedroom 2.2 m out, clear of the door's swing); each open
 * window from 1.6 m into its room, looking at it; the garden door from 2.4 m in looking out, standing in it, and from
 * 2.5 m out looking in. Yaw 0 looks north (−z), π/2 west.
 */
export function openingViews(openings: any[]): OpeningView[] {
  const P = Math.PI
  const out: OpeningView[] = []
  const at = (o: any, across: number, along = 0) => (o.axis === 'x' ? { x: o.centre + along, z: o.at + across } : { x: o.at + across, z: o.centre + along })
  // looking across the wall towards its higher side (+z or +x), or its lower
  const look = (o: any, high: boolean) => (o.axis === 'x' ? (high ? P : 0) : high ? -P / 2 : P / 2)
  const name = (o: any) => (o.kind === 'garden' ? 'the garden door' : o.kind === 'window' ? `window ${o.id}` : `doorway ${o.sides.join(' ↔ ')}`)
  for (const o of openings) {
    if (o.closed) continue
    if (o.kind === 'doorway') {
      for (const door of o.hinged ? [false, true] : [undefined]) {
        const tag = door === undefined ? '' : door ? ', the door open' : ', the door shut'
        out.push({ name: `${name(o)}${tag}, from the ${o.sides[0]}`, kind: 'doorway', ...at(o, -1.2), yaw: look(o, true), door, shadow: door !== undefined })
        out.push({ name: `${name(o)}${tag}, from the ${o.sides[1]}`, kind: 'doorway', ...at(o, o.hinged ? 2.2 : 1.2), yaw: look(o, false), door })
      }
      out.push({ name: `${name(o)}, standing in it`, kind: 'doorway', ...at(o, 0.05, 0.1), yaw: look(o, false) - 0.6, door: o.hinged ? true : undefined })
    } else if (o.kind === 'window') {
      const inward = o.at > 0 ? -1 : 1
      out.push({ name: `${name(o)}, from its room`, kind: 'window', ...at(o, inward * 1.6), yaw: look(o, inward < 0), pitch: -0.05 })
    } else {
      const inward = o.at > 0 ? -1 : 1
      out.push({ name: `${name(o)}, looking out`, kind: 'garden', ...at(o, inward * 2.4), yaw: look(o, inward < 0), pitch: -0.05, shadow: true })
      out.push({ name: `${name(o)}, standing in it`, kind: 'garden', ...at(o, 0), yaw: look(o, inward < 0) - 0.3 })
      out.push({ name: `${name(o)}, looking in`, kind: 'garden', ...at(o, -inward * 2.5), yaw: look(o, inward > 0), pitch: -0.05 })
    }
  }
  return out
}

/** The house's openings as the game has them now. */
export const openingsNow = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.home.openings())))

export { expect }
