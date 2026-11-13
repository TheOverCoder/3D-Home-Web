// The pictures of the design lab's map (lab/map.ts): every screen that wraps the game, as the game draws it today, on a
// phone held upright (390×844) and sideways (844×390), at the phone's own pixels (scale 1), a touch screen with its
// safe areas (the notch, the home bar: lab/devices.ts) drawn over it as the lab's frames draw them. One boot per
// orientation (minutes under software WebGL), then each screen opened through the game's own debug hooks
// (window.__home) the way the tests open them, and shot as lab/map/<id>-<orientation>.jpg; a second state of the same
// screen is <id>-<orientation>-2.jpg. Run it with the dev server up (npm run dev):
//
//   node scripts/lab-map-shots.mjs [upright|sideways|both] [http://localhost:5173/]
//
// Each orientation is its own browser, so the two can run side by side (two processes). A screen that cannot be
// opened is reported and skipped; the rest go on.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
// --only=intro,saves: those screens again and no others (the names of the steps below)
const only =
  args
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',') ?? null
const [which = 'both', base = 'http://localhost:5173/'] = args.filter((a) => !a.startsWith('--'))
const out = join(dirname(fileURLToPath(import.meta.url)), '../lab/map')
mkdirSync(out, { recursive: true })

// the sizes and safe areas of lab/devices.ts
const PHONES = {
  upright: { viewport: { width: 390, height: 844 }, safe: { top: 47, right: 0, bottom: 34, left: 0 } },
  sideways: { viewport: { width: 844, height: 390 }, safe: { top: 0, right: 47, bottom: 21, left: 47 } },
}

// the game's env(safe-area-inset-*) given the phone's values (a page in a test browser has none), as lab/env.ts does;
// again before every shot, for the style sheets and inline styles that came since
function safeAreas(safe) {
  const SAFE = /env\(\s*safe-area-inset-(top|right|bottom|left)\s*(,[^)]*)?\)/g
  const toVars = (css) => css.replace(SAFE, (_, side, fallback) => `var(--lab-safe-${side}${fallback ?? ', 0px'})`)
  const fix = (rules) => {
    for (const r of rules) {
      if (r instanceof CSSStyleRule && r.style.cssText.includes('env(')) r.style.cssText = toVars(r.style.cssText)
      if (r.cssRules?.length) fix(r.cssRules)
    }
  }
  for (const s of document.styleSheets)
    try {
      fix(s.cssRules)
    } catch {
      // another origin's
    }
  for (const el of document.querySelectorAll('[style*="env("]')) el.setAttribute('style', toVars(el.getAttribute('style')))
  for (const [side, px] of Object.entries(safe)) document.documentElement.style.setProperty(`--lab-safe-${side}`, `${px}px`)
  dispatchEvent(new Event('resize'))
}

// the notch and the home bar over the page, as lab/frame.css draws them on the lab's phones
function chrome(orientation) {
  if (document.querySelector('.map-chrome')) return
  const up = orientation === 'upright'
  const box = document.createElement('div')
  box.className = 'map-chrome'
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none'
  const notch = document.createElement('i')
  notch.style.cssText = up
    ? 'position:absolute;top:11px;left:50%;width:122px;height:34px;margin-left:-61px;border-radius:20px;background:#000'
    : 'position:absolute;left:11px;top:50%;width:34px;height:122px;margin-top:-61px;border-radius:20px;background:#000'
  const home = document.createElement('i')
  home.style.cssText = `position:absolute;bottom:${up ? 8 : 6}px;left:50%;width:${up ? 134 : 200}px;height:5px;margin-left:-${up ? 67 : 100}px;border-radius:3px;background:rgba(20,20,20,0.72);box-shadow:0 0 0 1px rgba(255,255,255,0.35)`
  box.append(notch, home)
  document.body.appendChild(box)
}

const wait = (page, ms) => page.waitForTimeout(ms)

async function run(orientation) {
  const { viewport, safe } = PHONES[orientation]
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  let page = await ctx.newPage()
  const done = []
  const failed = []
  const log = (s) => console.log(`[${orientation}] ${s}`)

  const shot = async (name) => {
    await page.evaluate(safeAreas, safe)
    await page.evaluate(chrome, orientation)
    await wait(page, 250)
    const file = name.includes('#') ? name.replace('#', `-${orientation}-`) : `${name}-${orientation}`
    await page.screenshot({ path: join(out, `${file}.jpg`), type: 'jpeg', quality: 75 })
    done.push(file)
    log(`${file}.jpg`)
  }
  /** One screen: what opens it and shoots it; a failure is told and the next one goes on. */
  const step = async (name, fn) => {
    if (only && !only.includes(name)) return
    try {
      await fn()
    } catch (e) {
      failed.push(`${name}: ${String(e.message ?? e).split('\n')[0]}`)
      log(`FAILED ${name}: ${String(e.message ?? e).split('\n')[0]}`)
    }
  }
  const home = (fn, arg) => page.evaluate(fn, arg)
  const closeAll = () =>
    home(() => {
      const s = window.__home.useHome.getState()
      if (s.screen) s.closeScreen()
      if (s.panel) s.closePanel()
      if (s.settingsOpen) s.setSettingsOpen(false)
      if (s.editing) s.setEditing(false)
      if (s.confirm) s.setConfirm(null)
    })
  const at = (x, z, yaw, pitch) =>
    home(
      ([x, z, yaw, pitch]) => {
        const h = window.__home
        h.teleport(x, 1.4, z)
        h.look.yaw = yaw
        h.look.pitch = pitch
      },
      [x, z, yaw, pitch],
    )
  const bump = () => home(() => window.__home.farm.useFarm.setState((s) => ({ rev: s.rev + 1 })))
  const panel = async (p, ms = 1800) => {
    await home((p) => window.__home.useHome.getState().openPanel(p), p)
    await page.waitForSelector('.farm-panel', { timeout: 15_000 })
    await wait(page, ms)
    await still()
  }
  const until = (fn, arg, timeout = 30_000) => page.waitForFunction(fn, arg, { timeout, polling: 200 })
  /** Until what came in has finished coming in (every animation that ends has ended): the scene behind makes frames
   *  slow, so a sheet's slide can still be at its start a second later. Never for a show that is caught as it plays. */
  const still = async () => {
    await page
      .waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 15_000, polling: 200 })
      .catch(() => {})
    await wait(page, 600)
  }

  try {
    // ── the opening: the loading screen, the intro, its tabs, and the failure card ──
    await page.goto(new URL('?debug&quality=medium', base).href)
    await page.waitForSelector('.intro .load', { timeout: 120_000 })
    await wait(page, 4000)
    await step('loading', () => shot('loading'))
    await page.waitForFunction(() => document.querySelector('.intro .primary:not(:disabled)'), null, { timeout: 600_000, polling: 500 })
    await wait(page, 1500)
    await step('intro', () => shot('intro'))
    // a tab of the intro's card, opened (its part has risen into view: the scene behind the card makes frames slow) or
    // closed again
    const tab = async (name, open = true) => {
      await page.locator('.intro-tabs button', { hasText: name }).click()
      if (open) await page.waitForSelector('.intro-tabs button.on', { timeout: 10_000 })
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, {
        timeout: 15_000,
        polling: 200,
      })
      await wait(page, 1500)
    }
    await step('music', async () => {
      await tab('Music')
      await shot('intro#2')
      await tab('Music', false)
    })
    await step('saves', async () => {
      await tab('Saves')
      await shot('saves')
      await tab('Saves', false)
    })
    await step('intro-settings', async () => {
      await tab('Settings')
      await shot('settings#2')
      await tab('Settings', false)
    })
    await step('failure', async () => {
      await home(() =>
        window.__home.useHome.setState({
          failure: {
            kind: 'graphics',
            message: 'The browser could not keep the 3D graphics running — usually it ran short of graphics memory (many open tabs or apps).',
            detail: 'WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost',
          },
        }),
      )
      await wait(page, 800)
      await shot('errors')
      await home(() => window.__home.useHome.setState({ failure: null }))
      await wait(page, 500)
    })

    // ── in play (unless only the opening is asked for again) ──
    const OPENING = ['loading', 'intro', 'music', 'saves', 'intro-settings', 'failure']
    if (only && only.every((n) => OPENING.includes(n))) return
    await page.locator('.intro .primary').click()
    await page.waitForFunction(() => window.__home?.useHome.getState().room != null && !!window.__home.teleport, null, { timeout: 180_000, polling: 500 })
    // the first moment where a new farm starts: the hint at the top (seven seconds: shown again, as the tests do) and
    // the room's title (shown as you come into a room: from the next room, back)
    await step('first-steps', async () => {
      await at(-3.5, -3.0, Math.PI, -0.04)
      await wait(page, 2500)
      await at(-3.5, 1.3, Math.PI, -0.04)
      await home(() => window.__home.useHome.setState({ hintShown: false }))
      await page.waitForSelector('.first-hint', { timeout: 10_000 })
      await wait(page, 1200)
      await shot('first-steps')
    })

    // a farm with something in it: the line open, goods in the silo and the barn, noon held
    await home(() => {
      const h = window.__home
      const f = h.farm
      f.setRandom?.(null)
      f.state.started = true
      f.state.nextVisitorIn = 900
      f.setHour(11)
      f.freezeDay(true)
      Object.assign(f.state.inv, { lettuce: 9, carrot: 6, tomato: 4, egg: 6, milk: 3, wool: 2, flour: 2, lemon_cake: 1, brick: 2, plank: 3, nail: 1 })
      f.state.coins = 260
      h.settings.getState().update({ hudMode: 'all' })
    })
    await bump()

    await step('touch', async () => {
      await wait(page, 6000) // the hint and the room's title gone
      await at(-3.5, 2.2, Math.PI, -0.08)
      await wait(page, 3500)
      await shot('touch')
    })

    // the top of the screen outdoors: the chips, the compass with marks on it (the lemon tree and the nest full)
    await step('top', async () => {
      await home(() => {
        const f = window.__home.farm
        f.state.producers.tree.stock.fill(8)
        f.state.producers.hens.stock.fill(6)
      })
      await bump()
      await at(-2.5, 7.6, Math.PI + 0.45, -0.16)
      await wait(page, 5000)
      await shot('top')
      await home(() => window.__home.settings.getState().update({ hudMode: 'compass' }))
      await wait(page, 1200)
      await shot('top#2')
      await home(() => window.__home.settings.getState().update({ hudMode: 'all' }))
    })

    // the action button and its prompt: ripe beds, harvested in one press; then a growing bed's status
    await step('action', async () => {
      await home(() => {
        const f = window.__home.farm
        for (const i of [0, 1, 2, 3]) {
          f.state.beds[i].crop = null
          if (f.plant(i, 'lettuce')) f.state.beds[i].growth = 1e6
        }
      })
      await bump()
      await at(-1.2, 9.0, Math.PI / 2, -0.6)
      await until(() => (window.__home.useHome.getState().nearby?.label ?? '').startsWith('Harvest'))
      await wait(page, 2500)
      await shot('action')
      await home(() => {
        const f = window.__home.farm
        for (const i of [0, 1, 2, 3]) f.state.beds[i].growth = 5
        f.state.sprinkler = true
      })
      await bump()
      await until(() => !!window.__home.useHome.getState().status)
      await wait(page, 2000)
      await shot('action#2')
    })

    // a staked-out bed's price tag, and the card it opens
    await step('tag', async () => {
      await at(-1.2, 11.6, Math.PI / 2, -0.5)
      await page.waitForSelector('.thing-price', { timeout: 20_000 })
      await wait(page, 2500)
      await shot('tag')
      await page.locator('.thing-price').click()
      await page.waitForSelector('.farm-panel', { timeout: 10_000 })
      await wait(page, 1500)
      await shot('tag#2')
      await closeAll()
    })

    // the mill asks before it takes the wheat
    await step('confirm', async () => {
      await home(() => (window.__home.farm.state.inv.wheat = 3))
      await bump()
      await at(10.9, 10.6, -Math.PI / 2, -0.45)
      await until(() => window.__home.useHome.getState().nearby?.id === 'farm-mill-wheat')
      await wait(page, 1500)
      await page.keyboard.press('KeyE')
      await until(() => window.__home.useHome.getState().confirm !== null, null, 10_000)
      await wait(page, 1500)
      await shot('tag#3')
      await home(() => window.__home.useHome.getState().setConfirm(null))
    })

    // the buyers at the gate: their bubbles, the button's offer, then their panel
    await step('buyers', async () => {
      await home(() => {
        const f = window.__home.farm
        f.spawnVisitor({ want: 'lettuce', qty: 3, offer: 14, queued: true })
        f.spawnVisitor({ want: 'egg', qty: 4, offer: 9, queued: true, gift: true })
        f.spawnVisitor({ want: 'pumpkin', qty: 2, offer: 30, queued: true })
        f.spawnVisitor({ want: 'milk', qty: 2, offer: 8, queued: true })
      })
      // inside the gate, looking at the line (its first three)
      const look = await home(() => {
        const line = window.__home.farm.inLine().slice(0, 3)
        const x = line.reduce((n, v) => n + v.x, 0) / line.length
        const z = line.reduce((n, v) => n + v.z, 0) / line.length
        return { x, z }
      })
      // (a yaw of 0 looks along −z, and a positive one turns to the left)
      await at(5.6, 12.3, Math.atan2(-(look.x - 5.6), -(look.z - 12.3)), 0.02)
      await wait(page, 6000)
      await shot('buyers')
      await panel({ kind: 'queue' })
      await shot('buyers#2')
      await closeAll()
    })

    await step('toast', async () => {
      await at(-2.5, 7.6, Math.PI + 0.45, -0.16)
      await wait(page, 3000)
      await home(() => window.__home.useHome.getState().showToast('+ 4 lettuces', 'lettuce'))
      await wait(page, 600)
      await shot('toast')
    })

    // a level reached in play, and the garment it brings (just short of level 5, then a little XP)
    await step('level-up', async () => {
      // (the XP a level starts at, from the game's own module, as the dev server serves it)
      const points = await home(async () => (await import('/src/farm/xp.ts')).xpAt(5) - 2)
      await home((points) => {
        const f = window.__home.farm
        f.state.xp.points = points
        f.state.xp.paid = 4
        f.useFarm.setState((s) => ({ rev: s.rev + 1 }))
      }, points)
      await wait(page, 1200)
      await home(() => window.__home.farm.gainXp('build', 1))
      await page.waitForSelector('.level-up-show', { timeout: 30_000 })
      await wait(page, 700)
      await shot('level-up')
      await page.waitForSelector('.garment-show', { timeout: 30_000 })
      await wait(page, 900)
      await shot('level-up#2')
      await page.waitForSelector('.garment-show', { state: 'detached', timeout: 30_000 })
    })

    // the panels, over the yard
    await at(-2.5, 7.6, Math.PI + 0.45, -0.16)
    await wait(page, 1500)
    await step('level', () => panel({ kind: 'level' }).then(() => shot('level')))
    await closeAll()
    await step('seeds', async () => {
      // the first beds empty again (they grew lettuce for the button's pictures)
      await home(() => {
        for (const i of [0, 1, 2, 3]) Object.assign(window.__home.farm.state.beds[i], { crop: null, growth: 0 })
      })
      await bump()
      await panel({ kind: 'seeds', bed: 0 })
      await shot('seeds')
    })
    await closeAll()
    await step('goals', () => panel({ kind: 'goals' }).then(() => shot('goals')))
    await closeAll()
    await step('store', async () => {
      await panel({ kind: 'store', store: 'silo' })
      await shot('store')
      await closeAll()
      await panel({ kind: 'store', store: 'barn' })
      await shot('store#2')
    })
    await closeAll()
    await step('orders', async () => {
      // the board's orders come in as the farm runs: a few minutes on, if there are none yet
      await home(() => {
        const f = window.__home.farm
        if (!f.state.orders.some((s) => 'order' in s)) for (let i = 0; i < 40; i++) f.tick(15)
        f.state.inv.lettuce = Math.max(f.state.inv.lettuce, 9)
      })
      await bump()
      await panel({ kind: 'orders' })
      await shot('orders')
    })
    await closeAll()
    await step('shop', () => panel({ kind: 'shop' }).then(() => shot('shop')))
    await closeAll()
    await step('manager', () => panel({ kind: 'manager' }).then(() => shot('manager')))
    await closeAll()
    await step('contractor', () => panel({ kind: 'contractor' }).then(() => shot('contractor')))
    await closeAll()
    await step('market', async () => {
      await home(() => window.__home.farm.marketFill('corn', { quiet: true }))
      await bump()
      await panel({ kind: 'market' })
      await shot('market')
      await closeAll()
      await panel({ kind: 'market-place', place: 0, from: 'market' })
      await shot('market#2')
    })
    await closeAll()
    await step('away', async () => {
      await home(() => {
        const f = window.__home.farm
        f.state.producers.hens.stock.fill(0)
        f.state.producers.hens.timer.fill(0)
        f.cameBack(95 * 60)
      })
      await page.waitForSelector('.farm-panel', { timeout: 15_000 })
      await wait(page, 1800)
      await shot('away')
      // (its own Close: the card comes back until it is closed there)
      await page.locator('.farm-panel button', { hasText: 'Close' }).click()
      await wait(page, 800)
    })
    await closeAll()
    await step('settings', async () => {
      await home(() => window.__home.useHome.getState().setSettingsOpen(true))
      await page.waitForSelector('.drawer', { timeout: 10_000 })
      await still()
      await shot('settings')
    })
    await closeAll()
    await step('graphics', async () => {
      await home(() => window.__home.useHome.setState({ graphics: 'restored' }))
      await page.waitForSelector('.graphics-notice', { timeout: 10_000 })
      await still()
      await shot('errors#2')
      await home(() => window.__home.useHome.setState({ graphics: 'ok' }))
    })

    // the farm's edit mode, from the yard
    await step('edit', async () => {
      await at(-1.2, 9.0, Math.PI / 2, -0.1)
      await wait(page, 1500)
      await home(() => window.__home.useHome.getState().setEditing(true))
      await page.waitForSelector('.edit-card', { timeout: 10_000 })
      await wait(page, 5000)
      await shot('edit')
      await home(() => window.__home.useHome.getState().setEditing(false))
      await wait(page, 2500)
    })

    // the wardrobe in the bedroom
    await step('wardrobe', async () => {
      await at(5.8, 1.75, 0, -0.1)
      await until(() => window.__home.useHome.getState().nearby?.label === 'Open the wardrobe')
      await page.keyboard.press('KeyE')
      await page.waitForSelector('.farm-panel.wardrobe', { timeout: 10_000 })
      await until(() => window.__home.dressView?.settled === true, null, 30_000)
      await wait(page, 2000)
      await shot('wardrobe')
      await closeAll()
      await wait(page, 2000)
    })

    // a screen in the house (the living room's)
    await step('devices', async () => {
      await at(-3.5, 1.3, Math.PI, -0.04)
      await wait(page, 1500)
      await home(() => window.__home.useHome.getState().openScreen('screen-living'))
      await page.waitForSelector('.sm-panel', { timeout: 10_000 })
      await still()
      await shot('devices')
    })
    await closeAll()

    // decorating the living room, and its furniture shop
    await step('decorate', async () => {
      await at(-3.5, 1.3, Math.PI, -0.2)
      await wait(page, 1500)
      await home(() => window.__home.home.decorate.start())
      await page.waitForSelector('.edit-card', { timeout: 10_000 })
      await wait(page, 5000)
      await shot('edit#2')
      await panel({ kind: 'furniture' })
      await shot('edit#3')
      await closeAll()
      await home(() => window.__home.home.decorate.stop())
    })

    // the intro again, as a returning player sees it while the house loads (the farm saved in this browser)
    await step('returning', async () => {
      await home(() => window.__home.farm.saveFarm?.())
      await page.close()
      page = await ctx.newPage()
      await page.goto(new URL('?debug&quality=medium', base).href)
      await page.waitForSelector('.intro .load', { timeout: 120_000 })
      await wait(page, 5000)
      await shot('intro#3')
    })
  } finally {
    log(`done: ${done.length} pictures${failed.length ? `; failed: ${failed.join(' | ')}` : ''}`)
    await browser.close()
  }
}

if (which === 'both') {
  await run('upright')
  await run('sideways')
} else await run(which)
