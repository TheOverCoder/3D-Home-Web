/* eslint-disable @typescript-eslint/no-explicit-any */
import { test as base, expect, type Page } from '@playwright/test'

/** Library warnings that are known and harmless (they are warnings, but we ignore them explicitly anyway). */
const IGNORED = [/THREE\.Clock: This module has been deprecated/, /using deprecated parameters for the initialization function/]

export const SPAWN = { x: -3.5, y: 1.4, z: 1.3 }

export interface Game {
  page: Page
  /** console errors / page errors seen since the page was created */
  errors: string[]
  /** Boots the app if needed, then resets the world to a known state (spawn, nothing open or carried). */
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
  await expect(btn).toBeEnabled({ timeout: 180_000 })
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
      const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4185' })
      const page = await context.newPage()
      const errors: string[] = []
      watchErrors(page, errors)

      const g: Game = {
        page,
        errors,
        state: () =>
          page.evaluate(() => JSON.parse(JSON.stringify((window as any).__home.useHome.getState(), (_k, v) => (typeof v === 'function' ? undefined : v)))),
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
            if (s.view !== 'first') s.setView('first')
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
          })
        },
      }
      await use(g)
      await context.close()
    },
    { scope: 'worker', timeout: 300_000 },
  ],
})

export { expect }
