/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Pose, emptyFarm } from './helpers'
import { EYE, YARD, compareAt, off, setUp } from './16-view'

// 16, the drawing pass (16-view.ts says how), on the farm's map: the yard over it, where the house stood, the pasture
// and the gate with a full line; third person and the edit mode over it; the hedge and the woods in pieces.
test.describe('the drawing pass leaves out only what cannot be seen: the farm', () => {
  test('640×360: the farm — the yard over it, where the house stood, the pasture, the gate with a full line', async ({ game }) => {
    await setUp(game, 'farm')
    const log: string[] = []
    for (const p of YARD) await compareAt(game, p, log)
    console.log(log.join('\n'))
  })

  test('third person and the edit mode on the farm: the rooms and the sun are not used', async ({ game }) => {
    await setUp(game, 'farm')
    const log: string[] = []
    await off(game, log, 'third person, the yard', 'third', -6, 9)
    await off(game, log, 'third person, where the house stood', 'third', 0, 1)
    await off(game, log, 'the edit mode over the farm', 'edit', 2, 9)
    console.log(log.join('\n'))
  })

  test('the hedge and the woods in pieces: the same frame and sun as one mesh each, built again when land is bought', async ({ game }) => {
    await setUp(game, 'farm')
    const { page } = game
    const log: string[] = []
    /** At a pose (the player there, the camera set by hand): the land drawn both ways, every pixel and texel the same. */
    const landAt = async (p: Pose) => {
      await page.evaluate(
        ([x, z, yaw]) => {
          const h = (window as any).__home
          h.teleport(x, 1.4, z)
          if (typeof h.look === 'function') h.look({ yaw, pitch: 0 })
          else {
            h.look.yaw = yaw
            h.look.pitch = 0
          }
        },
        [p.x, p.z, p.yaw],
      )
      await page.waitForFunction(([x, z]) => Math.hypot((window as any).__home.camera.position.x - x, (window as any).__home.camera.position.z - z) < 1.2, [p.x, p.z], {
        timeout: 60_000,
        polling: 250,
      })
      const r = await page.evaluate((pose) => (window as any).__viewProbe.land(pose), [p.x, p.y ?? EYE, p.z, p.yaw, p.pitch ?? 0])
      log.push(
        `${p.name} (${r.size.join('×')}): one mesh each ${r.whole.calls} draws / ${r.whole.triangles} triangles, in pieces ${r.pieces.calls} / ${r.pieces.triangles} (camera and sun); ${r.differ} pixels and ${r.texels} sun texels differ${r.differ ? ` ${JSON.stringify(r.pixels)}` : ''}`,
      )
      expect(r.differ, `${p.name}: pixels ${JSON.stringify(r.pixels)}`).toBe(0)
      expect(r.texels, `${p.name}: the sun's map`).toBe(0)
      return r
    }
    // from the yard over the farm, where the house stood and at the gate
    const poses = [YARD[0], YARD[1], YARD[4]]
    for (const p of poses) await landAt(p)

    // buying the north meadow moves the hedge and the woods out round it: the pieces are built again and the old ones let
    // go of (each geometry disposed)
    const old = await page.evaluate(() => {
      const w = window as any
      const h = w.__home
      w.__landDisposed = 0
      const pieces = h.land.pieces()
      for (const m of pieces) m.geometry.addEventListener('dispose', () => w.__landDisposed++)
      h.farm.state.coins += 1000
      return { pieces: pieces.length, bought: h.farm.buyLand('north') }
    })
    expect(old.bought).toBe(true)
    await page.waitForFunction((n) => (window as any).__landDisposed === n, old.pieces, { timeout: 30_000, polling: 250 })
    const now = await page.evaluate(() =>
      (window as any).__home.land.pieces().map((m: any) => {
        m.geometry.computeBoundingBox()
        const b = m.geometry.boundingBox
        return { name: m.name, box: [b.min.x, b.min.z, b.max.x, b.max.z] }
      }),
    )
    log.push(`the north meadow bought: ${old.pieces} pieces let go, ${now.length} built`)
    const hedges = now.filter((p: any) => p.name === 'hedge')
    // the hedge along the meadow's north edge (z = −25), none left along the garden's (z = −13)
    expect(hedges.some((p: any) => p.box[3] < -24 && p.box[1] > -25.6)).toBe(true)
    expect(hedges.some((p: any) => p.box[3] - p.box[1] < 1.5 && Math.abs((p.box[1] + p.box[3]) / 2 + 13) < 0.6)).toBe(false)
    // no tree stands on the meadow
    for (const c of now.filter((p: any) => p.name === 'crown')) {
      const [x, z] = [(c.box[0] + c.box[2]) / 2, (c.box[1] + c.box[3]) / 2]
      expect(x > -14 && x < 14 && z > -25 && z < -13, `a tree at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(false)
    }
    // and the new pieces draw the same as one mesh too
    for (const p of [YARD[0], { name: 'the north meadow, looking north', x: 0, z: -16, yaw: 0, pitch: -0.05 }]) await landAt(p)
    console.log(log.join('\n'))
  })

  test('afterwards: the house as it was, no console errors', async ({ game }) => {
    await game.ready()
    await emptyFarm(game.page)
    expect(game.errors).toEqual([])
  })
})
