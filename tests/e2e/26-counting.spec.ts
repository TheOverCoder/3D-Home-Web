/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, fillFarm, openGame, NULL_GL } from './helpers'

// The budget's counting without a GPU (tests/e2e/nullgl.js, used by 05-budget): one scene, at the same instant,
// counted by the game's own renderer on a real (software) context and by a second renderer on the drawing-free one —
// the camera's pass and the sun's, with the drawing pass on and off, at the farm's fullest, in the house, at the gate,
// over the yard, in the market and on the lane, at two sizes. Every count the same: three.js keeps them on the CPU,
// whatever the context does. (Each renderer draws each view once before it is counted: a renderer's first frame of a
// view starts with nothing kept from the one before.)

const POSES: [string, number, number, number, number][] = [
  ['living room', -3.5, 1.3, Math.PI, -0.04],
  ['kitchen', 3.5, -3, 0, 0],
  ['gate, the line', 5.6, 11.8, Math.PI, 0],
  ['yard, over the farm', -1, 8, 0, -0.1],
  ['market, the shelves', 7.4, 17.75, Math.PI + 0.6, -0.12],
  ['lane, the market', 10, 13.4, Math.PI, 0.02],
]

test('the drawing-free context counts what a real one counts, view by view @boot', { tag: '@full' }, async ({ browser }) => {
  test.setTimeout(1_200_000)
  const { game, close } = await openGame(browser)
  const { page } = game
  try {
    // the factory only: this page draws on its real context, the second renderer counts on the drawing-free one
    await page.addInitScript(() => ((window as any).__nullGlFactoryOnly = true))
    await page.addInitScript({ path: NULL_GL })
    await game.ready()
    await fillFarm(page)
    const differ: string[] = []
    for (const size of [
      { width: 640, height: 360 },
      { width: 1055, height: 487 },
    ]) {
      await page.setViewportSize(size)
      await page.waitForTimeout(2500)
      for (const [name, x, z, yaw, pitch] of POSES) {
        const r = await page.evaluate(
          ([x, z, yaw, pitch]) => {
            const w = window as any
            const h = w.__home
            const gl = h.gl
            const cam = h.camera
            cam.position.set(x, 1.62, z)
            cam.rotation.order = 'YXZ'
            cam.rotation.set(pitch, yaw, 0)
            cam.updateMatrixWorld(true)
            if (!w.__countingRenderer) {
              const c = document.createElement('canvas')
              const nr = new gl.constructor({ canvas: c, context: w.__makeNullGl(c, {}) })
              nr.shadowMap.enabled = gl.shadowMap.enabled
              nr.shadowMap.type = gl.shadowMap.type
              w.__countingRenderer = nr
            }
            const nr = w.__countingRenderer
            nr.setPixelRatio(1)
            nr.setSize(gl.domElement.width, gl.domElement.height, false)
            const count = (r: any, on: boolean) => {
              h.view.on = on
              const keep = { auto: r.info.autoReset, shadows: r.shadowMap.autoUpdate }
              r.info.autoReset = false
              r.shadowMap.autoUpdate = false
              r.shadowMap.needsUpdate = true
              r.render(h.scene, cam) // the view's first frame on this renderer, not counted
              r.shadowMap.needsUpdate = false
              r.info.reset()
              r.render(h.scene, cam)
              const camera = [r.info.render.calls, r.info.render.triangles]
              r.shadowMap.needsUpdate = true
              r.info.reset()
              r.render(h.scene, cam)
              const shadow = [r.info.render.calls - camera[0], r.info.render.triangles - camera[1]]
              r.info.autoReset = keep.auto
              r.shadowMap.autoUpdate = keep.shadows
              return { camera, shadow }
            }
            const out = { real: count(gl, true), counted: count(nr, true), realOff: count(gl, false), countedOff: count(nr, false) }
            h.view.on = true
            return out
          },
          [x, z, yaw, pitch],
        )
        const at = `${size.width}×${size.height} ${name}`
        console.log(`${at}: real ${JSON.stringify(r.real)}, counted ${JSON.stringify(r.counted)}; pass off: real ${JSON.stringify(r.realOff)}, counted ${JSON.stringify(r.countedOff)}`)
        if (JSON.stringify(r.real) !== JSON.stringify(r.counted)) differ.push(`${at}, the pass on`)
        if (JSON.stringify(r.realOff) !== JSON.stringify(r.countedOff)) differ.push(`${at}, the pass off`)
      }
    }
    expect(differ, differ.join('\n')).toEqual([])
    expect(game.errors, game.errors.join('\n')).toEqual([])
  } finally {
    await close()
  }
})
