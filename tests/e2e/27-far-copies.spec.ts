/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, fillFarm } from './helpers'

// The crowds' lighter copies of far parts (src/lib/sculpt/lod.ts; the budget engine): a copy is drawn only where its
// difference is under half a pixel, so the picture stays as it was. At the farm's fullest, the same frame is drawn with
// the copies and without them (`__home.view.lod`), camera and sun as the game draws them, at the market's shelves full
// of corn (the heaviest good, its cobs mostly drawn as copies), over the yard and on the lane with the shoppers, a phone
// held sideways and upright: the copies draw fewer triangles where they are used, and change the picture at most in a
// thousandth of its pixels by more than a tenth of their brightness (the corn's kernels shimmer a little differently
// inside a pixel), in a hundredth at all.

const VIEWS: [string, number, number, number, number][] = [
  ['market, the shelves', 7.05, 17.75, -Math.PI + (36 * Math.PI) / 180, -0.12],
  ['yard, over the farm', -12, -10.5, (-3 * Math.PI) / 4, -0.08],
  ['lane, the market, its shoppers', 10, 13.4, Math.PI, 0.02],
]

test.describe('far copies', () => {
  test("the crowds' lighter copies of far parts change nothing a player can see, and draw fewer triangles", async ({ game }) => {
    test.setTimeout(900_000)
    const { page } = game
    await game.ready()
    await fillFarm(page)
    let saved = 0
    for (const size of [
      { width: 1055, height: 487 },
      { width: 487, height: 1055 },
    ]) {
      await page.setViewportSize(size)
      await page.waitForTimeout(3000)
      for (const [name, x, z, yaw, pitch] of VIEWS) {
        const r = await page.evaluate(
          ([x, z, yaw, pitch]) => {
            const h = (window as any).__home
            const gl = h.gl
            const cam = h.camera
            cam.position.set(x, 1.62, z)
            cam.rotation.order = 'YXZ'
            cam.rotation.set(pitch, yaw, 0)
            cam.updateMatrixWorld(true)
            const ctx = gl.getContext()
            const w = ctx.drawingBufferWidth
            const hh = ctx.drawingBufferHeight
            const keep = { auto: gl.info.autoReset, shadows: gl.shadowMap.autoUpdate }
            gl.info.autoReset = false
            gl.shadowMap.autoUpdate = true
            const shot = (lod: boolean) => {
              h.view.lod = lod
              gl.render(h.scene, cam)
              gl.info.reset()
              gl.render(h.scene, cam)
              const triangles = gl.info.render.triangles as number
              const px = new Uint8Array(w * hh * 4)
              ctx.readPixels(0, 0, w, hh, ctx.RGBA, ctx.UNSIGNED_BYTE, px)
              return { px, triangles }
            }
            try {
              const a = shot(true)
              const b = shot(false)
              let differ = 0
              let much = 0
              for (let i = 0; i < a.px.length; i += 4) {
                const d = Math.max(Math.abs(a.px[i] - b.px[i]), Math.abs(a.px[i + 1] - b.px[i + 1]), Math.abs(a.px[i + 2] - b.px[i + 2]))
                if (d > 0) differ++
                if (d > 24) much++
              }
              return { pixels: w * hh, differ, much, with: a.triangles, without: b.triangles }
            } finally {
              h.view.lod = true
              gl.info.autoReset = keep.auto
              gl.shadowMap.autoUpdate = keep.shadows
            }
          },
          [x, z, yaw, pitch],
        )
        const at = `${size.width}×${size.height} ${name}`
        console.log(`${at}: ${r.differ} of ${r.pixels} pixels differ, ${r.much} by more than 24 of 255; ${r.without} triangles → ${r.with}`)
        expect(r.with, `${at}: no more triangles with the copies`).toBeLessThanOrEqual(r.without)
        expect(r.much, `${at}: pixels changed by more than a tenth`).toBeLessThanOrEqual(r.pixels / 1000)
        expect(r.differ, `${at}: pixels changed at all`).toBeLessThanOrEqual(r.pixels / 100)
        saved += r.without - r.with
      }
    }
    // the copies are used: the market's corn alone is most of its triangles
    expect(saved).toBeGreaterThan(50_000)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
