/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from './helpers'

test.describe('performance budget', () => {
  test('scene pass stays under 700 draw calls and 250k triangles (first person)', async ({ game }) => {
    await game.ready()
    const { page } = game
    const views = [
      { name: 'living room', x: -3.5, z: 1.3, yaw: Math.PI },
      { name: 'studio', x: -3.5, z: -2.0, yaw: 0 },
      { name: 'kitchen', x: 3.5, z: -3.0, yaw: Math.PI },
    ]
    for (const v of views) {
      await game.teleport(v.x, 1.4, v.z, v.yaw, 0)
      await page.waitForTimeout(2500)
      // render the scene once, on its own, so post-processing passes do not count
      const info = await page.evaluate(() => {
        const h = (window as any).__home
        const gl = h.gl
        const prevAuto = gl.info.autoReset
        const prevShadow = gl.shadowMap.autoUpdate
        gl.shadowMap.autoUpdate = false // shadow maps were drawn by the frame loop already: count the camera pass only
        gl.info.autoReset = false
        gl.info.reset()
        gl.render(h.scene, h.camera)
        const out = { calls: gl.info.render.calls as number, triangles: gl.info.render.triangles as number }
        gl.info.autoReset = prevAuto
        gl.shadowMap.autoUpdate = prevShadow
        return out
      })
      console.log(`${v.name}: ${info.calls} calls, ${info.triangles} triangles`)
      expect(info.calls, `${v.name}: draw calls`).toBeGreaterThan(0)
      expect(info.calls, `${v.name}: draw calls`).toBeLessThan(700)
      expect(info.triangles, `${v.name}: triangles`).toBeLessThan(250_000)
    }
  })
})

test.describe('no WebGL', () => {
  test('shows the failure message and keeps the intro disabled', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4185' })
    const page = await context.newPage()
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (/webgl/i.test(type)) return null
        return (original as any).call(this, type, ...rest)
      } as any
    })
    await page.goto('/')
    await expect(page.locator('.intro .failure')).toBeVisible({ timeout: 120_000 })
    await expect(page.locator('.intro .primary')).toBeDisabled()
    await context.close()
  })
})

test.describe('afterwards', () => {
  test('the shared session produced no console errors', async ({ game }) => {
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
