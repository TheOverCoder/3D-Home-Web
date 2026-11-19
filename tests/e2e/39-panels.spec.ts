/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, bootApp, onMap, watchErrors, BASE } from './helpers'
import { PANEL_KINDS, type Panel } from '../../src/store'
import { PRODUCE } from '../../src/farm/data'
import { CHECKS, counts, readable, type Check, type Finding } from './readable'

// Everything read and pressed on a phone (update-v1/missions/07-interface.md, change 1; ./readable.ts says what each
// check measures): a phone of its own (touch, two pixels to the point), upright and sideways, on a farm with plenty of
// everything. It opens every kind of panel there is (`PANEL_KINDS`, src/store.ts: a new panel is measured by being
// there), and looks at the top of the screen at rest and with a toast.
//
// Today's problems are debts (DEBTS), as 05 keeps the budget's: each place may have no more of a check's findings than
// it has today, at either size, so they only go down; a debt paid (none left) leaves the list. Mission 07's later
// changes pay them (WHY), and the last one empties the list. `PANELS_MEASURE=1` prints the table and the list as it
// measures now, without the checks; `PANELS_SHOTS=1` saves a still of each panel at each size (test-results/panels).

const SIZES = [
  { name: '390×844', width: 390, height: 844 },
  { name: '844×390', width: 844, height: 390 },
]

/** What pays each check's debts (07's changes). */
const WHY: Record<Check, string> = {
  tiny: 'change 10: nothing a player sees under 13 px',
  words: 'change 10: words at 15 px or more (chips and counts 13 to 14)',
  target: 'change 10: a 48 px hit area on a touch screen, grown with ::after',
  contrast: 'change 11: --amber-ink for words, and a thing not open yet fades only its picture (.off)',
  outside: 'changes 3 to 6: every panel on PanelSheet',
  goodpic: 'change 7: GoodPic where it is still missing',
  loops: 'change 9: the attention budget (src/ui/calls.ts), one loop at rest',
}

/** Each place's findings today, the most of either size (a panel by its kind; the top at rest, and with a toast). */
const DEBTS: Record<string, Partial<Record<Check, number>>> = {
  // (update v1's dairy and jam kettle: one more compass mark of the same 44 px when the farm has plenty)
  'the top at rest': { target: 8, loops: 2 },
  'the top with a toast': { target: 8 },
  seeds: { target: 1 },
  build: { target: 1 },
  bed: { target: 1 },
  queue: { tiny: 5, target: 9 },
  // shop, store and manager: one more row of the same 44 px buttons on screen upright, the sheet standing to 92dvh
  // (PanelSheet's --sheet-max-up) where Shell's stood to 86: no new kind of target (07b)
  shop: { words: 2, target: 7 },
  // (01a's four long crops are four more of the same rows: the debt is the same, its count grew with the goods)
  store: { words: 18, target: 6 },
  'store-upgrade': { target: 4 },
  orders: { target: 13 },
  furniture: { target: 1 },
  'buy-piece': { target: 1 },
  'decor-shop': { target: 3 },
  'decor-buy': { target: 1 },
  // (the welcome back's rows at 13 px: its *Next* line beside its three rows)
  away: { words: 4, target: 1 },
  daily: { words: 1, target: 1 },
  goals: { words: 1, target: 1, goodpic: 1 },
  level: { words: 3, target: 1, goodpic: 1 },
  wardrobe: { target: 4 },
  manager: { target: 10 },
  market: { target: 1 },
  'market-place': { target: 5, goodpic: 2 },
  'market-buy': { target: 1 },
  contractor: { target: 6, goodpic: 6 },
  car: { target: 3, contrast: 1 },
  estate: { target: 2 },
  'house-buy': { target: 1 },
  ladder: { target: 1 },
  machine: { words: 1, target: 2 },
  tool: { words: 9, target: 3, goodpic: 1 },
  skins: { target: 4 },
  'machine-slot': { words: 1, target: 2 },
  news: { words: 2, target: 1 },
}

const MEASURE_ONLY = !!process.env.PANELS_MEASURE
const SHOTS = !!process.env.PANELS_SHOTS

/** The panels that open in the house (the wardrobe films you there); the rest open on the farm. */
const IN_HOUSE: Panel['kind'][] = ['wardrobe']
const GOODS = PRODUCE.map((p) => p.id)
const TOP = ['.top-dash', '.top-stack', '.top-menu']

/** A farm with plenty of everything (as 25-button's): coins, every good, ripe beds, every animal and its tool, the shop
 *  yours and stocked, the line at the gate full (the welcome back's hour away comes as its panel opens). */
async function plenty(page: Page) {
  await page.evaluate(() => {
    const h = (window as any).__home
    const f = h.farm
    // the farm's dice from one seed, so the line at the gate (who wants what, and their moods) is the same each run
    let seed = 39
    f.setRandom(() => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    f.setHour(12)
    f.freezeDay(true)
    f.state.coins = 100_000
    for (let i = 0; i < 10; i++) for (const id of ['hen', 'cow', 'sheep']) f.buy(id)
    for (const kind of ['hens', 'cows', 'sheep']) f.buyLadder(`${kind}-tool`)
    f.state.storage.silo = 30
    f.state.storage.barn = 30
    for (const id of Object.keys(f.state.inv)) f.state.inv[id] = 25
    f.state.beds.forEach((b: any, i: number) => {
      if (b.built && !b.crop) f.plant(i, 'lettuce')
    })
    // the order board's orders made again on those dice (what they ask for, and so what can be pressed on them)
    f.state.orders.forEach((_: unknown, k: number) => f.declineOrder(k))
    f.tick(3600)
    f.marketFill('lettuce', { quiet: true })
    f.state.market.till.coins = 40
    // the line full: nobody more comes while the panels are measured
    while (f.inLine().length < f.placesInLine()) f.spawnVisitor({ queued: true })
    f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
  })
}

/** Nothing open, and no panel left on the screen: each closed by its own ✕ as a player would (the welcome back is
 *  told only then, or it opens again), then by the store. */
async function closeAll(page: Page) {
  // each by its ✕, the top one first, and its leave played to its end before the next: the store closing a sheet
  // still leaving cuts its leave short, and the panel's own close (the welcome back telling its report) never runs
  for (let i = 0; i < 6; i++) {
    // (clicked in the page, as before: a card over the sheet may cover its ✕, and Playwright's click would wait on it)
    const n = await page.evaluate(() => {
      const open = document.querySelectorAll('.farm-panel:not(.ps-leaving)')
      const x = Array.from(document.querySelectorAll<HTMLElement>('.farm-panel:not(.ps-leaving) [aria-label="Close (Esc)"]')).pop()
      x?.click()
      return x ? open.length : 0
    })
    if (!n) break
    await page.waitForFunction((n) => document.querySelectorAll('.farm-panel:not(.ps-leaving)').length < n && !document.querySelector('.ps-leaving'), n, { timeout: 15_000, polling: 100 })
  }
  await page.evaluate(() => {
    const s = (window as any).__home.useHome.getState()
    if (s.panel) s.closePanel()
    if (s.settingsOpen) s.setSettingsOpen(false)
  })
  await page.waitForFunction(() => !document.querySelector('.farm-panel'), null, { timeout: 20_000, polling: 100 })
}

/** Waits for the shows a level brings (the level-up, its garment, what it opened) to be over. */
async function showsOver(page: Page) {
  await page.waitForFunction(() => !document.querySelector('.level-up-show, .garment-show, .unlocked'), null, { timeout: 60_000, polling: 250 })
}

/** Waits until what is on the screen stands: the fonts loaded, every animation in `sel` that ends ended (a loop goes
 *  on), a card's action armed, and the boxes of `sel` the same three looks in a row. */
async function settle(page: Page, sel: string) {
  await page.evaluate(async (sel) => {
    await document.fonts.ready
    const moving = () =>
      Array.from(document.querySelectorAll(sel)).some((e) => e.getAnimations({ subtree: true }).some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity))
    const boxes = () =>
      Array.from(document.querySelectorAll(sel))
        .map((e) => JSON.stringify(e.getBoundingClientRect()))
        .join()
    let same = 0
    let was = ''
    const arming = () => !!document.querySelector(`:is(${sel}) .arming`)
    for (let i = 0; i < 150 && (same < 3 || moving() || arming()); i++) {
      await new Promise((r) => setTimeout(r, 150))
      const now = boxes()
      same = now === was && now !== '' ? same + 1 : 0
      was = now
    }
  }, sel)
}

interface Row {
  place: string
  size: string
  found: Finding[]
}

async function measurePanel(page: Page, kind: Panel['kind'], size: string): Promise<Row> {
  await onMap(page, IN_HOUSE.includes(kind) ? 'home' : 'farm')
  await closeAll(page)
  await page.evaluate((p) => {
    const h = (window as any).__home
    // the welcome back tells an hour away
    if (p.kind === 'away' && !h.farm.awaySummary()) h.farm.cameBack(3600)
    h.useHome.getState().openPanel(p)
  }, PANEL_KINDS[kind] as Panel)
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.farm-panel')).some((e) => e.getClientRects().length > 0), null, { timeout: 30_000, polling: 100 })
  await settle(page, '.farm-panel')
  const found = await readable(page, { roots: ['.farm-panel'], inside: '.farm-panel', goods: GOODS })
  if (SHOTS) await page.screenshot({ path: `test-results/panels/${size}-${kind}.png` })
  return { place: kind, size, found }
}

async function measureTop(page: Page, size: string): Promise<Row[]> {
  await onMap(page, 'farm')
  await closeAll(page)
  await showsOver(page)
  await page.waitForFunction(() => !document.querySelector('.top-stack .toast'), null, { timeout: 20_000, polling: 100 })
  await settle(page, TOP.join(', '))
  const rest = await readable(page, { roots: TOP, loops: true })
  if (SHOTS) await page.screenshot({ path: `test-results/panels/${size}-top.png` })
  let toast: Finding[] = []
  // a toast goes by itself after 2.2 s, a frame or two of software rendering: held on the screen while it is measured
  // (the store's setState lets nothing take it away), then let go
  await page.evaluate(() => {
    const store = (window as any).__home.useHome
    const set = store.setState
    store.__let = () => {
      store.setState = set
      set({ toast: null })
    }
    store.setState = (u: any, replace?: boolean) =>
      set((s: any) => {
        const next = typeof u === 'function' ? u(s) : u
        return next && next !== s && 'toast' in next && next.toast === null && s.toast ? s : next
      }, replace)
    store.getState().showToast('4 lettuces in the silo', 'lettuce')
  })
  try {
    await page.waitForFunction(() => !!document.querySelector('.top-stack .toast'), null, { timeout: 20_000, polling: 100 })
    await settle(page, '.top-stack')
    toast = await readable(page, { roots: TOP })
    if (SHOTS) await page.screenshot({ path: `test-results/panels/${size}-top-toast.png` })
  } finally {
    await page.evaluate(() => (window as any).__home.useHome.__let())
  }
  return [
    { place: 'the top at rest', size, found: rest },
    { place: 'the top with a toast', size, found: toast },
  ]
}

/** The table: each place at each size, how many of each check, and a few of what was found. */
function report(rows: Row[]) {
  const lines = [`${'place'.padEnd(26)} ${'size'.padEnd(8)} ${CHECKS.map((c) => c.padStart(8)).join('')}`]
  for (const r of rows) {
    const n = counts(r.found)
    lines.push(`${r.place.padEnd(26)} ${r.size.padEnd(8)} ${CHECKS.map((c) => String(n[c] || '·').padStart(8)).join('')}`)
    for (const c of CHECKS) for (const f of r.found.filter((x) => x.check === c).slice(0, 3)) lines.push(`      ${c}: ${f.what} — ${f.got}`)
  }
  return lines.join('\n')
}

/** The most of each check at either size, for each place: the list as it measures now. */
function measured(rows: Row[]) {
  const most: Record<string, Partial<Record<Check, number>>> = {}
  for (const r of rows) {
    const n = counts(r.found)
    for (const c of CHECKS) if (n[c]) most[r.place] = { ...most[r.place], [c]: Math.max(most[r.place]?.[c] ?? 0, n[c]) }
  }
  return most
}

test.describe('panels on a phone', { tag: '@boot' }, () => {
  test('every panel and the top: read and pressed on a phone, upright and sideways (today’s problems are listed debts)', async ({ browser }) => {
    test.setTimeout(2_400_000)
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, baseURL: BASE })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    try {
      await bootApp(page)
      await plenty(page)
      await showsOver(page)
      const rows: Row[] = []
      for (const s of SIZES) {
        await page.setViewportSize({ width: s.width, height: s.height })
        await page.waitForTimeout(1000)
        rows.push(...(await measureTop(page, s.name)))
        for (const kind of Object.keys(PANEL_KINDS) as Panel['kind'][]) rows.push(await measurePanel(page, kind, s.name))
      }
      await closeAll(page)
      const now = measured(rows)
      console.log(`${report(rows)}\n\nmeasured (the most at either size):\n${JSON.stringify(now, null, 2)}`)
      if (MEASURE_ONLY) return
      // every place at most its debt; a debt with nothing left is paid, and leaves the list
      for (const place of new Set([...rows.map((r) => r.place), ...Object.keys(DEBTS)])) {
        for (const c of CHECKS) {
          const got = now[place]?.[c] ?? 0
          const debt = DEBTS[place]?.[c]
          const seen = rows
            .filter((r) => r.place === place)
            .flatMap((r) => r.found.filter((f) => f.check === c).map((f) => `${r.size}: ${f.what} — ${f.got}`))
            .slice(0, 6)
          if (debt === undefined) expect.soft(got, `${place}: ${c} (${WHY[c]})\n${seen.join('\n')}`).toBe(0)
          else {
            expect.soft(got, `${place}: ${c}, a debt: no more than ${debt}\n${seen.join('\n')}`).toBeLessThanOrEqual(debt)
            expect.soft(got, `${place}: ${c}, the debt is paid: take it off DEBTS (and tests/README.md)`).toBeGreaterThan(0)
          }
        }
      }
      expect(errors, errors.join('\n')).toEqual([])
    } finally {
      await context.close()
    }
  })
})
