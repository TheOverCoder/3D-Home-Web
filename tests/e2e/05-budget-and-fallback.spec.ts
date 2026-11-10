/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game } from './helpers'

// A view from each room, at eye height. Walls hide nothing from the renderer: the kitchen's, looking south, also draws
// the bedroom, much of the living room and the farm beyond them.
const VIEWS = [
  { name: 'living room', x: -3.5, z: 1.3, yaw: Math.PI },
  { name: 'studio', x: -3.5, z: -2.0, yaw: 0 },
  { name: 'kitchen', x: 3.5, z: -3.0, yaw: Math.PI },
  { name: 'bedroom', x: 3.5, z: 1.0, yaw: Math.PI },
]

/** Every room view stays under 700 draw calls and 250k triangles. */
async function underBudget(game: Game, what: string) {
  const { page } = game
  for (const v of VIEWS) {
    await game.teleport(v.x, 1.4, v.z, v.yaw, 0)
    // a busy frame (the furniture merged again after a change) can take seconds in software: count the view only once
    // the camera stands there, and a few frames later
    await page.waitForFunction(
      ([x, z]) => {
        const c = (window as any).__home.camera.position
        return Math.hypot(c.x - x, c.z - z) < 0.5
      },
      [v.x, v.z],
      { timeout: 60_000, polling: 250 },
    )
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
    console.log(`${what}, ${v.name}: ${info.calls} calls, ${info.triangles} triangles`)
    expect(info.calls, `${what}, ${v.name}: draw calls`).toBeGreaterThan(0)
    expect(info.calls, `${what}, ${v.name}: draw calls`).toBeLessThan(700)
    expect(info.triangles, `${what}, ${v.name}: triangles`).toBeLessThan(250_000)
  }
}

test.describe('performance budget', () => {
  test('scene pass stays under 700 draw calls and 250k triangles (first person)', async ({ game }) => {
    await game.ready()
    await underBudget(game, "today's house")
  })

  test('every piece of furniture draws no more triangles than its weight in the catalogue', async ({ game }) => {
    await game.ready()
    // today's house has a piece of every kind; what each draws is the meshes under its group (merged or not)
    const over = await game.page.evaluate(() => {
      const h = (window as any).__home
      const out: string[] = []
      for (const p of h.home.layout.pieces) {
        const group = h.scene.getObjectByName(`piece-${p.id}`)
        if (!group) {
          out.push(`${p.id}: not in the scene`)
          continue
        }
        let triangles = 0
        group.traverse((o: any) => {
          if (!o.isMesh) return
          const n = o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count
          triangles += (n / 3) * (o.isInstancedMesh ? o.count : 1)
        })
        const weight = h.home.pieces[p.type].weight
        if (triangles > weight) out.push(`${p.id} (${p.type}): ${triangles} triangles, weight ${weight}`)
      }
      return out
    })
    expect(over, 'a model drawing more than its weight: slim it, or raise its weight in src/home/catalogue.ts').toEqual([])
  })

  test('rooms filled with the heaviest piece until they are full stay under budget in every view', async ({ game }) => {
    await game.ready()
    const { page } = game
    /** Buys the heaviest piece for sale and stands it in a room until the room is full; what it says then. */
    const fill = (room: string) =>
      page.evaluate((room) => {
        const h = (window as any).__home
        h.farm.state.coins = 1_000_000
        const pieces = h.home.pieces
        const heaviest = Object.keys(pieces)
          .filter((t) => pieces[t].price > 0)
          .sort((a, b) => pieces[b].weight - pieces[a].weight)[0]
        let added = 0
        for (let spot = h.home.freeSpot(heaviest, room); spot; spot = h.home.freeSpot(heaviest, room)) {
          if (!h.home.buy(heaviest) || !h.home.placeStored(heaviest, spot).ok) break
          added++
        }
        const centre = { living: [-3.5, 3], office: [-3.5, -3], kitchen: [3.5, -3], bedroom: [3.5, 3] }[room as 'living']
        const next = h.home.canPlace({ id: 'one-more', type: heaviest, x: centre[0], z: centre[1], rot: 0 })
        return { heaviest, added, weight: h.home.roomWeight(room), limit: h.home.roomLimit, reason: next.reason }
      }, room)
    try {
      await page.evaluate(() => (window as any).__home.farm.reset())
      // the bedroom first: the lightest room the busiest view (the kitchen's) looks into, so filled it adds the most there
      const bedroom = await fill('bedroom')
      console.log(`bedroom: ${bedroom.added} × ${bedroom.heaviest}, ${bedroom.weight} of ${bedroom.limit}`)
      expect(bedroom.heaviest).toBe('accent-chair')
      expect(bedroom.added).toBeGreaterThan(1)
      expect(bedroom.weight).toBeLessThanOrEqual(bedroom.limit)
      expect(bedroom.reason).toBe('This room is full')
      await page.waitForTimeout(2000)
      await underBudget(game, 'bedroom full')
      // then every room
      for (const room of ['living', 'office', 'kitchen']) {
        const r = await fill(room)
        console.log(`${room}: ${r.added} × ${r.heaviest}, ${r.weight} of ${r.limit}`)
        expect(r.reason, room).toBe('This room is full')
      }
      await page.waitForTimeout(2000)
      await underBudget(game, 'every room full')
    } finally {
      // today's house again for the specs after this one
      await page.evaluate(() => (window as any).__home.farm.reset())
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
