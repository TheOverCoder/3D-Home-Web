/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, watchErrors, type Game } from './helpers'

// Starting up: the loading screen's account of what it downloads, the service worker keeping it on the device (a
// second visit loads from there), the music player and the save list on the intro, the restart in light graphics
// after the graphics context is lost while starting, and the save slots (file export / import).

const BASE = 'http://localhost:4185'
const readyButton = (page: Game['page']) =>
  page.waitForFunction(() => {
    const b = document.querySelector('.intro .primary') as HTMLButtonElement | null
    return !!b && !b.disabled
  }, null, { timeout: 240_000, polling: 500 })

test.describe('starting up', () => {
  test('the loader lists what it downloads and keeps it on the device; a second visit loads from there', async ({ browser }) => {
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

    // the service worker controls the page and has kept every file of the manifest
    await page.waitForFunction(
      async () => {
        if (!navigator.serviceWorker.controller) return false
        const m = await (await fetch('/assets-manifest.json')).json()
        for (const f of m.files) if (!(await caches.match(new URL(f.url, location.origin + '/').href))) return false
        return true
      },
      null,
      { timeout: 60_000, polling: 1000 },
    )

    // the intro's music player and save list
    await page.locator('.intro-tabs button', { hasText: 'Music' }).click()
    await page.locator('.music-btn.play').click()
    await page.waitForFunction(() => (window as any).__home.music.getState().playing === true, null, { timeout: 30_000 })
    await page.locator('.music-btn.play').click()
    await page.waitForFunction(() => (window as any).__home.music.getState().playing === false, null, { timeout: 30_000 })
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

  test('graphics lost while starting: the house starts again in light graphics, and says so', async ({ browser }) => {
    test.setTimeout(600_000)
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: BASE })
    const page = await context.newPage()
    // the 3D scene's first WebGL context is lost a moment after it is made, as on a phone short of graphics memory
    await page.addInitScript(() => {
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
