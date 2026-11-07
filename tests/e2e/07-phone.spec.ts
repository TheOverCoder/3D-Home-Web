/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp, watchErrors } from './helpers'

// A phone in portrait, then turned to landscape: its own page with touch emulation (coarse pointer).
test.describe('phone', () => {
  test('touch controls: stick walks, drag looks, a second finger does not jerk the view, the action button and label work', async ({ browser }) => {
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

    // on-screen controls: the stick and a jump button; the round action button only appears when there is something to do
    await expect(page.locator('#ecctrl-joystick')).toBeVisible()
    await expect(page.locator('#ecctrl-virtual-button')).toHaveCount(1)
    await expect(page.locator('.act-btn')).toHaveCount(0)
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
    // the round action button shows what it does (a screen to watch), under the right thumb, clear of everything else
    const action = page.locator('.act-btn.main')
    await expect(action).toBeVisible()
    await expect(action).toHaveAttribute('data-verb', 'watch')
    const actionP = (await action.boundingBox())!
    const jumpP = (await page.locator('#ecctrl-virtual-button').boundingBox())!
    for (const [name, box] of [['stick', ring], ['jump', jumpP], ['label', (await label.boundingBox())!]] as const) {
      expect(overlaps(actionP, box), `action button clear of the ${name} (portrait)`).toBe(false)
    }
    expect(actionP.x + actionP.width <= 390 && actionP.y + actionP.height <= 720, 'action button on screen (portrait)').toBe(true)
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

    // in the garden: a ripe bed behind you shows on the round button as a hand with a lettuce; one tap turns you
    // round to it and harvests — and the smaller buttons beside it offer the next things within reach
    await page.evaluate(() => {
      const h = (window as any).__home
      const f = h.farm
      f.reset()
      f.plant(0, 'lettuce')
      for (let i = 0; i < 12; i++) {
        f.water(0)
        f.tick(5)
      }
      h.teleport(-1.2, 1.4, 9.0)
      h.look.yaw = -Math.PI / 2 // looking east, away from the bed, up at the sky
      h.look.pitch = 0.5
    })
    await page.waitForFunction(() => (window as any).__home.useHome.getState().nearby?.id === 'farm-bed-0', null, { timeout: 60_000, polling: 250 })
    await expect(action).toHaveAttribute('data-verb', 'pick')
    await expect(action.locator('img.act-item')).toHaveCount(1)
    await expect(action.locator('.act-turn.back')).toHaveCount(1)
    const buttons = await page.locator('.act-btn').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))
    expect(buttons.length, 'more things within reach').toBeGreaterThan(1)
    const jumpL = (await page.locator('#ecctrl-virtual-button').boundingBox())!
    const labelG = (await label.boundingBox())!
    for (const [i, box] of buttons.entries()) {
      expect(box.x >= 0 && box.y >= 0 && box.x + box.width <= 800 && box.y + box.height <= 360, `action button ${i} on screen`).toBe(true)
      for (const [name, other] of [['stick', ringL], ['jump', jumpL], ['label', labelG]] as const) {
        expect(overlaps(box, other), `action button ${i} clear of the ${name} (landscape)`).toBe(false)
      }
      for (const [j, other] of buttons.entries()) if (j !== i) expect(overlaps(box, other), `action buttons ${i} and ${j} apart`).toBe(false)
    }
    await action.tap()
    await page.waitForFunction(() => (window as any).__home.farm.state.inv.lettuce === 4, null, { timeout: 30_000, polling: 250 })
    await page.waitForFunction(
      () => {
        const y = (window as any).__home.look.yaw - Math.PI / 2
        return Math.abs(Math.atan2(Math.sin(y), Math.cos(y))) < 0.25
      },
      null,
      { timeout: 30_000, polling: 250 },
    )

    expect(errors, errors.join('\n')).toEqual([])
    await context.close()
  })
})
