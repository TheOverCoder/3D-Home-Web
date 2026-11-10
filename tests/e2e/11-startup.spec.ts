/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, watchErrors, type Game } from './helpers'

// Starting up: the loading screen's account of what it downloads, the service worker keeping it on the device (a
// second visit loads from there), the music player and the save list on the intro, the restart in light graphics
// after the graphics context is lost while starting, and the save slots (file export / import).

const BASE = 'http://localhost:4185'
const readyButton = (page: Game['page']) =>
  page.waitForFunction(
    () => {
      const b = document.querySelector('.intro .primary') as HTMLButtonElement | null
      return !!b && !b.disabled
    },
    null,
    { timeout: 240_000, polling: 500 },
  )

test.describe('starting up', () => {
  test('the loader lists what it downloads and keeps it on the device; a second visit loads from there', { tag: '@boot' }, async ({ browser }) => {
    test.setTimeout(600_000)
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: BASE })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    const t0 = Date.now()
    await page.goto('/?debug&quality=low')
    // the intro shows at once: it does not wait for the 3D engine
    await expect(page.locator('.intro .load')).toBeVisible({ timeout: 30_000 })
    expect(Date.now() - t0, 'the intro appears before the 3D engine has downloaded').toBeLessThan(30_000)
    await readyButton(page)
    const first = await page.evaluate(() => {
      const s = (window as any).__home.loader.getState()
      return { phase: s.phase, total: s.total, files: s.files.map((f: any) => f.status), kinds: s.files.map((f: any) => f.kind) }
    })
    expect(first.phase).toBe('ready')
    expect(first.total).toBeGreaterThan(3_000_000)
    expect(first.files.length).toBeGreaterThan(8)
    expect(first.files.every((s: string) => s === 'done' || s === 'cached')).toBe(true)
    expect(first.kinds).toContain('code')
    expect(first.kinds).toContain('model')
    await expect(page.locator('.load-head')).toContainText('Ready')

    // what every player downloads: the physics engine's WebAssembly as a file of its own, and none of the developer
    // tools or pages (they load only with their flag: ?tune, ?console, ?gallery, ?furniture, ?items)
    const listed: string[] = await page.evaluate(async () => (await (await fetch('/assets-manifest.json')).json()).files.map((f: any) => f.url))
    expect(listed.filter((u) => /rapier_wasm3d_bg-[\w-]{8}\.wasm$/.test(u))).toHaveLength(1)
    expect(listed.filter((u) => /(^|\/)(dev-[a-z]+|Gallery)-/.test(u))).toEqual([])
    // the page shell (the intro, the saves, the settings) comes before any of it: index.html loads neither three.js
    // nor the models, which the loader brings once you choose to play
    const shell = await page.evaluate(async () => await (await fetch('/index.html')).text())
    expect(shell).not.toMatch(/vendor-three|vendor-r3f|vendor-physics|\/models-|Experience-/)
    expect(listed.some((u) => /vendor-three-/.test(u))).toBe(true)

    // the service worker controls the page and has kept every file of the manifest
    await page.waitForFunction(
      async () => {
        if (!navigator.serviceWorker.controller) return false
        const m = await (await fetch('/assets-manifest.json')).json()
        for (const f of m.files) if (!(await caches.match(new URL(f.url, location.origin + '/').href, { ignoreVary: true }))) return false
        return true
      },
      null,
      { timeout: 60_000, polling: 1000 },
    )

    // the intro's music player and save list: the music starts with the first click (it is on by default),
    // the player pauses and plays it
    await page.locator('.intro-tabs button', { hasText: 'Music' }).click()
    await page.waitForFunction(() => (window as any).__home.music.getState().playing === true, null, { timeout: 30_000 })
    await expect(page.locator('.music-title strong')).not.toBeEmpty()
    await page.locator('.music-btn.play').click()
    await page.waitForFunction(() => (window as any).__home.music.getState().playing === false, null, { timeout: 30_000 })
    await page.locator('.music-btn[aria-label="Next track"]').click()
    await page.locator('.music-btn.play').click()
    await page.waitForFunction(() => (window as any).__home.music.getState().playing === true && (window as any).__home.music.getState().track === 1, null, { timeout: 30_000 })
    await page.locator('.intro-tabs button', { hasText: 'Saves' }).click()
    await expect(page.locator('.slot')).toHaveCount(3)
    await expect(page.locator('.slot.current')).toContainText('Farm 1')

    // a second visit: everything from the device
    await page.reload()
    await readyButton(page)
    const second = await page.evaluate(() => {
      const s = (window as any).__home.loader.getState()
      return { total: s.total, fromDevice: s.fromDevice, statuses: s.files.map((f: any) => f.status) }
    })
    expect(second.statuses.every((s: string) => s === 'cached')).toBe(true)
    expect(second.fromDevice).toBe(second.total)
    await expect(page.locator('.load-line')).toContainText('from this device')
    expect(errors, errors.join('\n')).toEqual([])
    await context.close()
  })

  test('graphics lost while starting: the house starts again in light graphics, and says so', { tag: '@boot' }, async ({ browser }) => {
    test.setTimeout(600_000)
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: BASE })
    const page = await context.newPage()
    // the 3D scene's first WebGL context is lost a moment after it is made, as on a phone short of graphics memory
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- called with the canvas as `this` below
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        const gl = (original as any).call(this, type, ...rest)
        if (gl && /webgl/.test(type) && this.parentElement && !(window as any).__lostOnce) {
          ;(window as any).__lostOnce = true
          setTimeout(() => gl.getExtension('WEBGL_lose_context')?.loseContext(), 1500)
        }
        return gl
      } as any
    })
    await page.goto('/?debug&quality=low')
    await readyButton(page)
    const s = await page.evaluate(() => {
      const st = (window as any).__home.useHome.getState()
      return { lost: (window as any).__lostOnce, attempt: st.attempt, failure: st.failure, quality: st.quality, light: localStorage.getItem('3d-home:light:v1') }
    })
    expect(s.lost).toBe(true)
    expect(s.attempt).toBeGreaterThanOrEqual(1)
    expect(s.failure).toBeNull()
    expect(s.quality).toBe('low')
    expect(s.light).toBe('auto')
    await expect(page.locator('.load-note')).toContainText('Light graphics are on')
    await expect(page.locator('.intro-device')).toContainText('light graphics')
    await context.close()
  })

  test('farms: three slots — save one as a file, load it into another, play it, clear it', async ({ game }) => {
    await game.ready()
    const { page } = game
    const r = await page.evaluate(() => {
      const h = (window as any).__home
      const { slots, farm } = h
      farm.reset()
      farm.state.coins = 123
      farm.saveFarm()
      const file = slots.exportSlot(1)
      const imported = slots.importSlot(3, file.text)
      const summary = slots.slotSummary(3)
      slots.switchSlot(3)
      const coinsIn3 = farm.state.coins
      const current = slots.currentSlot()
      slots.switchSlot(1)
      slots.deleteSlot(3)
      const bad = slots.importSlot(2, '{"kind":"something else"}')
      return { name: file.name, imported, summary, coinsIn3, current, back: slots.currentSlot(), cleared: slots.slotSummary(3).exists, bad, coins1: farm.state.coins }
    })
    expect(r.name).toMatch(/^3d-home-farm-1-\d{4}-\d{2}-\d{2}\.json$/)
    expect(r.imported).toEqual({ ok: true })
    expect(r.summary).toMatchObject({ exists: true, coins: 123 })
    expect(r.coinsIn3).toBe(123)
    expect(r.current).toBe(3)
    expect(r.back).toBe(1)
    expect(r.cleared).toBe(false)
    expect(r.bad.ok).toBe(false)
    expect(r.coins1).toBe(123)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
