/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from './helpers'

test.describe('physics & geometry guards', () => {
  test('jumping repeatedly from the kitchen island never puts the camera above 3.0 m', async ({ game }) => {
    await game.ready()
    const { page } = game
    // the island is a 2.0 x 0.9 m block at (3.4, -2.4); land on top of it, then keep jumping
    await game.teleport(3.4, 1.6, -2.4, Math.PI, 0)
    await page.waitForTimeout(2000)
    await page.evaluate(() => {
      const w = window as any
      w.__maxCamY = -Infinity
      w.__maxBodyY = -Infinity
      w.__camTimer = setInterval(() => {
        w.__maxCamY = Math.max(w.__maxCamY, w.__home.camera.position.y)
        w.__maxBodyY = Math.max(w.__maxBodyY, w.__home.playerState.position.y)
      }, 30)
    })
    await page.keyboard.down('Space')
    // look straight up part of the time, which is where the head used to poke through the ceiling
    for (const pitch of [0, 1.4, 0.7, 1.4]) {
      await page.evaluate((p) => {
        const h = (window as any).__home
        if (typeof h.look === 'function') h.look({ yaw: Math.PI, pitch: p })
        else h.look.pitch = p
      }, pitch)
      await page.waitForTimeout(5000)
    }
    await page.keyboard.up('Space')
    const { cam, body } = await page.evaluate(() => {
      const w = window as any
      clearInterval(w.__camTimer)
      return { cam: w.__maxCamY as number, body: w.__maxBodyY as number }
    })
    expect(cam).toBeLessThan(3.0)
    expect(body).toBeLessThan(3.1) // never above the house's wall height
  })

  test('no reachable standing spot puts the eyes inside a solid mesh', async ({ game }) => {
    test.setTimeout(300_000)
    await game.ready()
    const { page } = game
    // the page needs a three.js to cast rays with; serve the one from node_modules under a private path
    await page.route('**/__three/*', (route) => {
      const file = path.join(process.cwd(), 'node_modules/three/build', path.basename(new URL(route.request().url()).pathname))
      return route.fulfill({ body: fs.readFileSync(file), contentType: 'text/javascript' })
    })
    const result = await page.evaluate(async () => {
      const THREE: any = await import(/* @vite-ignore */ '/__three/three.module.js')
      const h = (window as any).__home
      const { world, rapier } = h.physics
      const scene = h.scene
      const EYE = 1.62 // eyes above the feet (EYE_HEIGHT in Player.tsx)
      const FEET = 0.9 // capsule centre above the feet

      // solid meshes: visible, opaque and not shader driven (sky dome, light shafts, screens' glow...)
      const meshes: any[] = []
      scene.updateMatrixWorld(true)
      scene.traverse((o: any) => {
        if (!o.isMesh) return
        let p = o
        while (p) {
          if (p.visible === false) return
          p = p.parent
        }
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        if (mats.some((m: any) => !m || m.isShaderMaterial || m.transparent || m.opacity < 1 || m.colorWrite === false || m.depthWrite === false)) return
        meshes.push(o)
      })

      // back faces must be hit too: temporarily render-side = DoubleSide (restored before returning, no frame runs in between)
      const sides = new Map<any, number>()
      for (const m of meshes) for (const mt of Array.isArray(m.material) ? m.material : [m.material]) sides.set(mt, mt.side)
      for (const mt of sides.keys()) mt.side = THREE.DoubleSide

      const ray = new THREE.Raycaster()
      const dirs = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ].map((d) => new THREE.Vector3(...d))
      const origin = new THREE.Vector3()
      const insideAt = (x: number, y: number, z: number) => {
        origin.set(x, y, z)
        let back = 0
        for (const d of dirs) {
          ray.set(origin, d)
          const hits = ray.intersectObjects(meshes, false)
          const first = hits.find((i: any) => i.face && i.distance > 1e-4)
          if (!first) continue
          const n = first.face.normal.clone().transformDirection(first.object.matrixWorld)
          if (n.dot(d) > 0) back++
        }
        return back >= 5
      }

      const capsule = new rapier.Capsule(0.5, 0.28)
      const rot = { x: 0, y: 0, z: 0, w: 1 }
      const nonDynamic = rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS
      const bad: string[] = []
      let checked = 0
      // the detector itself: the middle of the kitchen island must count as inside, an open spot in the room must not
      const control = { solid: insideAt(3.4, 0.45, -2.4), open: insideAt(-3.5, 1.6, 1.3) }
      const STEP = 0.3
      // the player's own body (visible in first person) stands somewhere on the grid: skip the spots it occupies
      const me = h.playerState.position
      try {
        for (let x = -6.8; x <= 6.8; x += STEP) {
          for (let z = -5.8; z <= 5.8; z += STEP) {
            if (Math.hypot(x - me.x, z - me.z) < 0.6) continue
            // ground: highest walkable surface below 1.0 m (the island top is 0.92 m)
            const hit = world.castRay(new rapier.Ray({ x, y: 1.0, z }, { x: 0, y: -1, z: 0 }), 1.5, false, nonDynamic)
            if (!hit || hit.timeOfImpact < 0.01) continue
            const ground = 1.0 - hit.timeOfImpact
            if (world.intersectionWithShape({ x, y: ground + FEET, z }, rot, capsule, nonDynamic)) continue // the body does not fit
            checked++
            if (insideAt(x, ground + EYE, z)) bad.push(`(${x.toFixed(1)}, ${(ground + EYE).toFixed(2)}, ${z.toFixed(1)})`)
          }
        }
      } finally {
        for (const [mt, side] of sides) mt.side = side
      }
      return { meshes: meshes.length, checked, bad, control }
    })
    expect(result.meshes).toBeGreaterThan(10)
    expect(result.control, 'detector self-check').toEqual({ solid: true, open: false })
    expect(result.checked).toBeGreaterThan(200)
    expect(result.bad, `eyes inside a solid mesh at: ${result.bad.join(' ')}`).toEqual([])
  })

  test('a body thrown out of the world comes back to the start', async ({ game }) => {
    await game.ready()
    const { page } = game
    const body = () => page.evaluate(() => ({ ...(window as any).__home.ecctrl().body.translation() }))
    // below the ground (as if it had fallen through the floor), and far off over the hedge — each time from the
    // kitchen, so being back at the start (the living room) can only come from the safety net
    for (const [x, y, z] of [
      [0, -12, 0],
      [-60, 8, -10],
    ]) {
      await game.teleport(3.5, 1.4, -3.0)
      await page.waitForFunction(() => (window as any).__home.useHome.getState().room === 'kitchen', null, { timeout: 30_000, polling: 250 })
      await page.evaluate(([x, y, z]) => (window as any).__home.teleport(x, y, z), [x, y, z])
      await page.waitForFunction(
        () => {
          const p = (window as any).__home.ecctrl().body.translation()
          return Math.hypot(p.x + 3.5, p.z - 1.3) < 0.5 && p.y > 0 && p.y < 3
        },
        null,
        { timeout: 30_000, polling: 250 },
      )
      expect((await body()).y).toBeGreaterThan(0)
    }
  })
})
