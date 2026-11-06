/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp, watchErrors } from './helpers'

// A phone in portrait, then turned to landscape: its own page with touch emulation (coarse pointer).
test.describe('phone', () => {
  test('touch controls: stick walks, drag looks, a second finger does not jerk the view, the label opens a screen', async ({ browser }) => {
    test.setTimeout(300_000)
    const context = await browser.newContext({
      viewport: { width: 390, height: 720 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      baseURL: 'http://localhost:4185',
    })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    await bootApp(page)
    await page.evaluate(() => {
      const h = (window as any).__home
      h.teleport(-3.5, 1.4, 1.3)
      h.look.yaw = Math.PI
      h.look.pitch = 0.6 // at the ceiling: nothing to interact with, so no label covers the scene
    })
    await page.waitForTimeout(1500)

    // on-screen controls: the stick and a jump button; interacting is the label, not a permanent button
    await expect(page.locator('#ecctrl-joystick')).toBeVisible()
    await expect(page.locator('#ecctrl-virtual-button')).toHaveCount(1)
    // the scene takes every drag itself (no browser panning, zooming or pull-to-refresh)
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('canvas')!.parentElement!.parentElement!).touchAction)).toBe('none')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    // the stick walks: push it up and hold until the player has clearly moved
    const stick = (await page.locator('#ecctrl-joystick').boundingBox())!
    const p0 = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2)
    await page.mouse.down()
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2 - 40, { steps: 4 })
    try {
      await page.waitForFunction(
        (a) => Math.hypot((window as any).__home.playerState.position.x - a.x, (window as any).__home.playerState.position.z - a.z) > 0.4,
        p0,
        { timeout: 60_000, polling: 250 },
      )
    } finally {
      await page.mouse.up()
    }

    // drag on the scene turns the view; a second finger landing elsewhere does not make it jump
    const cdp = await context.newCDPSession(page)
    const touch = (type: string, touchPoints: { x: number; y: number; id: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints } as any)
    // touch moves reach the page aligned to animation frames (and software rendering is slow): read the view
    // only after two frames, when every move sent so far has been handled
    const yaw = () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve((window as any).__home.look.yaw as number))),
          ),
      )
    const y0 = await yaw()
    await touch('touchStart', [{ x: 220, y: 220, id: 1 }])
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: 220 + i * 12, y: 220, id: 1 }])
    const y1 = await yaw()
    expect(Math.abs(y1 - y0), 'dragging turned the view').toBeGreaterThan(0.05)
    await touch('touchStart', [
      { x: 292, y: 220, id: 1 },
      { x: 120, y: 420, id: 2 },
    ])
    await touch('touchMove', [
      { x: 292, y: 220, id: 1 },
      { x: 150, y: 430, id: 2 },
    ])
    const y2 = await yaw()
    expect(Math.abs(y2 - y1), 'a second finger leaves the view alone').toBeLessThan(0.01)
    await touch('touchEnd', [])

    // the action label: offered in front of the living-room screen, clear of the stick, and tapping it opens the screen
    await page.evaluate(() => {
      const h = (window as any).__home
      h.teleport(-3.5, 1.4, 4.8)
      h.look.yaw = Math.PI
      h.look.pitch = 0
    })
    await page.waitForFunction(() => (window as any).__home.useHome.getState().nearby?.id === 'screen-living', null, { timeout: 60_000, polling: 250 })
    const label = page.locator('.prompt')
    await expect(label).toBeVisible()
    const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    const ring = (await page.locator('#joystick-base').boundingBox())!
    expect(overlaps((await label.boundingBox())!, ring), 'label clear of the stick (portrait)').toBe(false)
    await label.tap()
    await page.waitForFunction(() => (window as any).__home.useHome.getState().screen === 'screen-living', null, { timeout: 30_000, polling: 250 })
    await page.evaluate(() => (window as any).__home.useHome.getState().closeScreen())
    await page.waitForFunction(() => (window as any).__home.useHome.getState().screen === null, null, { timeout: 30_000, polling: 250 })

    // turned to landscape: controls re-measure, stay on screen, and the label stays clear of them
    await page.setViewportSize({ width: 800, height: 360 })
    await page.waitForFunction(() => (window as any).__home.useHome.getState().nearby?.id === 'screen-living', null, { timeout: 60_000, polling: 250 })
    await expect(label).toBeVisible()
    const view = { x: 0, y: 0, width: 800, height: 360 }
    const ringL = (await page.locator('#joystick-base').boundingBox())!
    const jump = (await page.locator('#ecctrl-virtual-button').boundingBox())!
    const labelL = (await label.boundingBox())!
    for (const [name, box] of [['stick', ringL], ['jump', jump], ['label', labelL]] as const) {
      expect(box.x >= view.x && box.y >= view.y && box.x + box.width <= view.width && box.y + box.height <= view.height, `${name} on screen`).toBe(true)
    }
    expect(overlaps(labelL, ringL), 'label clear of the stick (landscape)').toBe(false)
    expect(overlaps(labelL, jump), 'label clear of the jump button (landscape)').toBe(false)

    expect(errors, errors.join('\n')).toEqual([])
    await context.close()
  })
})
