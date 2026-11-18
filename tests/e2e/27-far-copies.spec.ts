/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, fillFarm, onMap } from './helpers'

// The lighter copies (src/lib/sculpt/lod.ts; the budget engine): what they change on the screen, at the farm's fullest
// (fillFarm: the farm decorated, every fruit tree and bush hung full, the market's shelves full of corn), a phone held
// sideways and upright.
//
// Far copies: a crowd's part is drawn with a lighter copy only where its difference is under half a pixel. The same
// frame is drawn with the copies and without them (`__home.view.lod`), camera and sun as the game draws them, at the
// market's shelves (the heaviest good, its cobs mostly drawn as copies), over the yard, where the house stood and inside
// the decorated garden, and on the lane with the shoppers: the copies draw fewer triangles where they are used, and
// change the picture at most in a thousandth of its pixels by more than a tenth of their brightness (the corn's kernels
// shimmer a little differently inside a pixel), in a hundredth at all.
//
// Shadow copies: a caster is drawn into the sun's map from a copy that moved no surface by more than half a texel of it
// (src/lib/sculpt/sun.ts). The same frame is drawn with them and without (`__home.view.sunLod`), the sun's map drawn
// again each time: in the decorated garden (the decoration and the fruit plants cast), over the yard, on the lane before
// the lot (the walk-ins and the car, in the farm's wider sun box), and in the house
// in third person and decorating, where the sun reaches every room's furniture: no acne, no gaps — the same bounds as
// the far copies — and fewer triangles in the sun's pass.

type View = [name: string, x: number, z: number, yaw: number, pitch: number]

const FAR: View[] = [
  ['market, the shelves', 7.05, 17.75, -Math.PI + (36 * Math.PI) / 180, -0.12],
  ['yard, over the farm', -12, -10.5, (-3 * Math.PI) / 4, -0.08],
  ['yard, where the house stood', 0, 12.5, 0, 0.02],
  ['the decorated garden, from its path', 0, 2.6, 0, -0.1],
  ['lane, the market, its shoppers', 10, 13.4, Math.PI, 0.02],
]
/** The farm's views for the sun: in the decorated garden, over the yard, and over the lot beyond the lane, where the
 *  farm's sun box reaches past the house's (src/data/sunBox.ts): the estate office, the market and its cabin, the car. */
const SUN: View[] = [
  ['the decorated garden, from its path', 0, 2.6, 0, -0.1],
  ['the decorated garden, looking back', 0, -4.6, Math.PI, -0.15],
  ['yard, where the house stood', 0, 12.5, 0, 0.02],
  ['the lane, the estate office and the market', 1, 14.4, -2.5, -0.05],
]

const SIZES = [
  { width: 1055, height: 487 },
  { width: 487, height: 1055 },
]

interface Shot {
  pixels: number
  differ: number
  much: number
  /** the camera's pass and the sun's, with the copies and without */
  with: { camera: number; sun: number }
  without: { camera: number; sun: number }
}

/** Runs in the page: the frame (the camera set by hand when `pose` is given, else the game's) drawn with one kind of
 *  copies on and off — the sun's map drawn again each time — and how many pixels differ, and by how much; and the
 *  triangles of the camera's pass and of the sun's, each way. */
function shot([pose, which]: [number[] | null, 'lod' | 'sunLod']): Shot {
  const h = (window as any).__home
  const gl = h.gl
  const cam = h.camera
  if (pose) {
    cam.position.set(pose[0], 1.62, pose[1])
    cam.rotation.order = 'YXZ'
    cam.rotation.set(pose[3], pose[2], 0)
    cam.updateMatrixWorld(true)
  }
  const ctx = gl.getContext()
  const w = ctx.drawingBufferWidth
  const hh = ctx.drawingBufferHeight
  const keep = { auto: gl.info.autoReset, shadows: gl.shadowMap.autoUpdate }
  gl.info.autoReset = false
  gl.shadowMap.autoUpdate = false
  const draw = (on: boolean) => {
    h.view[which] = on
    // the sun's map drawn again for this way, then the frame; the camera's pass alone, and with the map drawn again
    gl.shadowMap.needsUpdate = true
    gl.render(h.scene, cam)
    gl.info.reset()
    gl.render(h.scene, cam)
    const camera = gl.info.render.triangles as number
    gl.shadowMap.needsUpdate = true
    gl.info.reset()
    gl.render(h.scene, cam)
    const sun = (gl.info.render.triangles as number) - camera
    const px = new Uint8Array(w * hh * 4)
    ctx.readPixels(0, 0, w, hh, ctx.RGBA, ctx.UNSIGNED_BYTE, px)
    return { px, camera, sun }
  }
  try {
    const a = draw(true)
    const b = draw(false)
    let differ = 0
    let much = 0
    for (let i = 0; i < a.px.length; i += 4) {
      const d = Math.max(Math.abs(a.px[i] - b.px[i]), Math.abs(a.px[i + 1] - b.px[i + 1]), Math.abs(a.px[i + 2] - b.px[i + 2]))
      if (d > 0) differ++
      if (d > 24) much++
    }
    return { pixels: w * hh, differ, much, with: { camera: a.camera, sun: a.sun }, without: { camera: b.camera, sun: b.sun } }
  } finally {
    h.view[which] = true
    gl.info.autoReset = keep.auto
    gl.shadowMap.autoUpdate = keep.shadows
    gl.shadowMap.needsUpdate = true
  }
}

/** The bounds both kinds of copies keep. */
function bounded(at: string, r: Shot) {
  expect(r.much, `${at}: pixels changed by more than a tenth`).toBeLessThanOrEqual(r.pixels / 1000)
  expect(r.differ, `${at}: pixels changed at all`).toBeLessThanOrEqual(r.pixels / 100)
}

async function resize(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size)
  await page.waitForFunction(([w, hh]) => (window as any).__home.gl.domElement.width === w && (window as any).__home.gl.domElement.height === hh, [size.width, size.height], { timeout: 120_000 })
  await page.waitForTimeout(3000)
}

/** The game's own camera in third person or decorating, once its flight is over and it stands still. */
async function gameCamera(page: Page, mode: 'third' | 'decorate') {
  await page.evaluate((mode) => {
    const s = (window as any).__home.useHome.getState()
    if (mode === 'third') s.setView('third')
    else s.setDecorating(true)
  }, mode)
  await page.waitForTimeout(1500)
  await page.evaluate(() => delete (window as any).__copiesCamera)
  await page.waitForFunction(
    (mode) => {
      const w = window as any
      const h = w.__home
      if (mode === 'decorate' && h.home.decorate.camera.blend < 0.999) return false
      const c = h.camera.position
      const frames = h.view.stats.renders
      const last = w.__copiesCamera
      if (last && frames - last[3] < 2) return false
      w.__copiesCamera = [c.x, c.y, c.z, frames]
      return !!last && Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]) < 1e-3
    },
    mode,
    { timeout: 120_000, polling: 250 },
  )
}

test.describe('lighter copies', () => {
  test("the crowds' lighter copies of far parts change nothing a player can see, and draw fewer triangles", async ({ game }) => {
    test.setTimeout(900_000)
    const { page } = game
    await game.ready('farm')
    await fillFarm(page)
    let saved = 0
    for (const size of SIZES) {
      await resize(page, size)
      for (const [name, x, z, yaw, pitch] of FAR) {
        const r = await page.evaluate(shot, [[x, z, yaw, pitch], 'lod'] as [number[], 'lod'])
        const at = `${size.width}×${size.height} ${name}`
        console.log(`${at}: ${r.differ} of ${r.pixels} pixels differ, ${r.much} by more than 24 of 255; ${r.without.camera} triangles → ${r.with.camera}`)
        expect(r.with.camera, `${at}: no more triangles with the copies`).toBeLessThanOrEqual(r.without.camera)
        bounded(at, r)
        saved += r.without.camera - r.with.camera
      }
    }
    // the copies are used: the market's corn alone is most of its triangles
    expect(saved).toBeGreaterThan(50_000)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test("casters drawn into the sun's map from their lighter copies change nothing a player can see, and the sun draws fewer triangles", async ({ game }) => {
    test.setTimeout(1_200_000)
    const { page } = game
    const log: string[] = []
    const check = (at: string, r: Shot) => {
      log.push(`${at}: ${r.differ} of ${r.pixels} pixels differ, ${r.much} by more than 24 of 255; the sun's pass ${r.without.sun} triangles → ${r.with.sun}`)
      console.log(log[log.length - 1])
      expect(r.with.sun, `${at}: fewer triangles in the sun's pass`).toBeLessThan(r.without.sun)
      bounded(at, r)
    }
    try {
      // the farm decorated: every piece and fruit plant casts (src/farm/decorScene.tsx)
      await game.ready('farm')
      await fillFarm(page)
      for (const size of SIZES) {
        await resize(page, size)
        for (const [name, x, z, yaw, pitch] of SUN) check(`${size.width}×${size.height} ${name}`, await page.evaluate(shot, [[x, z, yaw, pitch], 'sunLod'] as [number[], 'sunLod']))
      }
      // the house, every room full of the heaviest piece: third person and decorating in the living room, where the
      // ceilings go and the sun reaches all of its furniture (src/scene/Furnishings.tsx)
      await onMap(page, 'home')
      await fillFarm(page)
      for (const size of SIZES) {
        await resize(page, size)
        for (const mode of ['third', 'decorate'] as const) {
          await game.teleport(-3.5, 1.4, 2.5, Math.PI, 0)
          await page.waitForTimeout(600)
          await gameCamera(page, mode)
          try {
            check(`${size.width}×${size.height} ${mode === 'third' ? 'third person' : 'decorating'}, the living room`, await page.evaluate(shot, [null, 'sunLod'] as [null, 'sunLod']))
          } finally {
            await page.evaluate(() => {
              const s = (window as any).__home.useHome.getState()
              s.setView('first')
              s.setDecorating(false)
            })
            await page.waitForFunction(() => (window as any).__home.view.stats.portals === true, null, { timeout: 120_000, polling: 250 })
          }
        }
      }
    } finally {
      await page.setViewportSize({ width: 640, height: 360 })
    }
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
