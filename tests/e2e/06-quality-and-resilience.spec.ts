/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp, watchErrors } from './helpers'

// The shared session runs on Low. These boot their own pages to exercise the heavier render paths
// (N8AO, depth of field, MSAA, bloom) and the recovery UI, which the Low session never touches.

for (const quality of ['high', 'medium'] as const) {
  test.describe(`quality=${quality}`, () => {
    test(`boots, renders and walks with no console errors on ${quality}`, async ({ browser }) => {
      test.setTimeout(300_000)
      const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4185' })
      const page = await context.newPage()
      const errors: string[] = []
      watchErrors(page, errors)
      await bootApp(page, `debug&quality=${quality}`)
      expect(await page.evaluate(() => (window as any).__home.useHome.getState().quality)).toBe(quality)
      // let a few frames of the full post chain run, including a walk (moving shadow casters)
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(4_000)
      await page.keyboard.up('KeyW')
      await page.waitForTimeout(2_000)
      expect(errors, errors.join('\n')).toEqual([])
      await context.close()
    })
  })
}

test.describe('settings and diagnostics', () => {
  test('depth of field is only offered on High', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => (window as any).__home.useHome.getState().settingsOpen === true, null, { timeout: 30_000 })
    // the shared session is pinned to Low
    await expect(page.locator('#set-dof')).toBeDisabled()
    await page.evaluate(() => (window as any).__home.useHome.getState().setQuality('high'))
    await expect(page.locator('#set-dof')).toBeEnabled()
    await page.evaluate(() => (window as any).__home.useHome.getState().setQuality('low'))
    await expect(page.locator('#set-dof')).toBeDisabled()
    await page.keyboard.press('Escape')
  })

  test('"Copy diagnostics" produces a readable report', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => {
      ;(window as any).__copied = null
      navigator.clipboard.writeText = async (text: string) => {
        ;(window as any).__copied = text
      }
    })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => (window as any).__home.useHome.getState().settingsOpen === true, null, { timeout: 30_000 })
    await page.locator('#copy-report').click()
    await page.waitForFunction(() => (window as any).__copied != null, null, { timeout: 10_000 })
    const report = JSON.parse(await page.evaluate(() => (window as any).__copied))
    expect(report.gpu.webgl).toMatch(/WebGL/)
    expect(report.app.phase).toBe('playing')
    expect(report.where.camera).toHaveLength(3)
    expect(report.where.lookingAt).toHaveLength(3)
    await page.keyboard.press('Escape')
  })
})

test.describe('graphics reset', () => {
  test('a lost WebGL context shows the notice; restoring offers to continue', async ({ browser }) => {
    test.setTimeout(300_000)
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4185' })
    const page = await context.newPage()
    await bootApp(page)
    await page.evaluate(() => {
      const gl = (window as any).__home.gl.getContext()
      ;(window as any).__lose = gl.getExtension('WEBGL_lose_context')
      ;(window as any).__lose.loseContext()
    })
    const notice = page.locator('.graphics-notice')
    await expect(notice).toBeVisible({ timeout: 30_000 })
    await expect(notice).toContainText('reset')
    await page.evaluate(() => (window as any).__lose.restoreContext())
    await expect(notice).toContainText('back', { timeout: 30_000 })
    await notice.getByRole('button', { name: 'Continue' }).click()
    await expect(notice).toBeHidden()
    await context.close()
  })
})

test.describe('content panel', () => {
  test('rendering pauses behind an open panel, resumes when it closes, and walking works again', async ({ game }) => {
    await game.ready()
    const { page } = game
    await game.teleport(-3.5, 1.4, 4.8, Math.PI, 0)
    await page.evaluate(() => (window as any).__home.useHome.getState().openScreen('screen-living'))
    await page.waitForTimeout(3_000) // the view eases onto the screen, then the house stops rendering
    const f0 = await page.evaluate(() => (window as any).__home.gl.info.render.frame)
    await page.waitForTimeout(3_000)
    const f1 = await page.evaluate(() => (window as any).__home.gl.info.render.frame)
    expect(f1 - f0, 'frames rendered while the panel was open').toBe(0)

    await page.keyboard.press('Escape')
    await page.waitForFunction(() => (window as any).__home.useHome.getState().screen === null, null, { timeout: 30_000 })
    await page.waitForFunction((f) => (window as any).__home.gl.info.render.frame > f + 3, f1, { timeout: 60_000, polling: 250 })

    // turn away from the TV console (it is right in front of the screen) towards open floor (west)
    await page.evaluate(() => {
      const h = (window as any).__home
      if (typeof h.look === 'function') h.look({ yaw: Math.PI / 2, pitch: 0 })
      else {
        h.look.yaw = Math.PI / 2
        h.look.pitch = 0
      }
    })
    const p0 = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
    await page.keyboard.down('KeyW')
    try {
      await page.waitForFunction(
        (a) => Math.hypot((window as any).__home.playerState.position.x - a.x, (window as any).__home.playerState.position.z - a.z) > 0.4,
        p0,
        { timeout: 60_000, polling: 250 },
      )
    } finally {
      await page.keyboard.up('KeyW')
    }
  })
})
