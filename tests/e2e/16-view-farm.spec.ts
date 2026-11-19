/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Game, type Pose, emptyFarm } from './helpers'
import { EYE, P, YARD, compareAt, off, setUp, standAt } from './16-view'

/** The season and the weather of the poses that follow (src/farm/state/season.ts: a test's own, standing), once the
 *  weather's renderer is there (it comes a moment after play, as the bursts' does). */
async function seasonAndWeather(game: Game, season: string, weather: { kind: string; amount: number; wind: number; rainbow: number } | null) {
  await game.page.evaluate(
    ([season, weather]) => {
      const h = (window as any).__home
      h.season.set(season)
      h.season.weather.set(weather)
    },
    [season, weather] as const,
  )
  await game.page.waitForFunction(() => (window as any).__home.weatherFx?.stats != null, null, { timeout: 60_000, polling: 250 })
}

/** What falls round where you stand now (its look and box set at once: a page drawn in software has few frames), its
 *  clock run on, and unless told otherwise its time stopped: how many drops and flakes there are. */
async function fallen(game: Game, stop = true) {
  return game.page.evaluate((stop) => {
    const h = (window as any).__home
    h.weatherFx.settle(4)
    if (stop) h.fx.time.speed = 0
    return h.weatherFx.stats
  }, stop)
}

/** Spring and clear again, what falls running on. */
async function quietAgain(game: Game) {
  await game.page.evaluate(() => {
    const h = (window as any).__home
    h.fx.time.speed = 1
    h.season.quiet(true)
  })
}

// 16, the drawing pass (16-view.ts says how), on the farm's map: the yard over it, where the house stood, the pasture
// and the gate with a full line; third person and the edit mode over it; the hedge and the woods in pieces; things
// reacting (src/fx/react.ts: a stretch of their own scale), held mid-way.

/** Where the reactions held mid-way are seen: the beds and the lemon tree from the path, and the cows' pasture. */
const HELD: Pose[] = [
  { name: 'held mid-way: the beds and the lemon tree, from the path', x: -1.2, z: 12.3, yaw: 0.35, pitch: -0.28 },
  { name: 'held mid-way: the cows, from the pasture’s fence', x: 9.5, z: -1, yaw: -Math.PI / 2, pitch: -0.05 },
]
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

  // The farm's year and its weather (update-v1/missions/10-seasons-weather.md): winter's look (snow on what faces the sky,
  // the leaves turned) on the materials there are, and what falls (src/fx/quarks.ts, `weatherFx`: the outside, for the
  // pass), each frame drawn both ways the same. What falls is set round you by hand and its time stopped (`settle`,
  // `__home.fx.time`), so the frames compared show it.
  test('winter: the yard over the farm, where the house stood, and the hedge and the woods in pieces as one mesh each', async ({ game }) => {
    await setUp(game, 'farm')
    const { page } = game
    const log: string[] = []
    try {
      await seasonAndWeather(game, 'winter', null)
      for (const p of [YARD[0], YARD[1]]) await compareAt(game, { ...p, name: `winter: ${p.name}` }, log)
      // the land drawn both ways in winter: every crown turned by its own tree's place, the same in one mesh
      await standAt(game, YARD[0])
      const r = await page.evaluate((pose) => (window as any).__viewProbe.land(pose), [YARD[0].x, YARD[0].y ?? EYE, YARD[0].z, YARD[0].yaw, YARD[0].pitch ?? 0])
      log.push(
        `winter, the land (${r.size.join('×')}): one mesh each ${r.whole.calls} / ${r.whole.triangles}, in pieces ${r.pieces.calls} / ${r.pieces.triangles}; ${r.differ} pixels and ${r.texels} sun texels differ`,
      )
      expect(r.differ, `pixels ${JSON.stringify(r.pixels)}`).toBe(0)
      expect(r.texels).toBe(0)
    } finally {
      await quietAgain(game)
    }
    console.log(log.join('\n'))
  })

  test('snow over the yard and at the gate, its time stopped', async ({ game }) => {
    await setUp(game, 'farm')
    const log: string[] = []
    try {
      await seasonAndWeather(game, 'winter', { kind: 'snow', amount: 1, wind: 0.3, rainbow: 0 })
      for (const p of [YARD[0], YARD[4]]) {
        await standAt(game, p)
        expect((await fallen(game)).snow, `${p.name}: snow falls round you`).toBeGreaterThan(100)
        await compareAt(game, { ...p, name: `snow: ${p.name}` }, log)
      }
    } finally {
      await quietAgain(game)
    }
    console.log(log.join('\n'))
  })

  test('third person in the rain on the farm', async ({ game }) => {
    await setUp(game, 'farm')
    const log: string[] = []
    try {
      await seasonAndWeather(game, 'spring', { kind: 'rain', amount: 1, wind: 0.5, rainbow: 0 })
      await standAt(game, { name: 'the yard', x: -6, z: 9, yaw: P })
      expect((await fallen(game, false)).rain, 'rain falls round you').toBeGreaterThan(100)
      // (the rain runs on during the camera's flight: the two frames compared are drawn with no frame between them)
      await off(game, log, 'third person in the rain, the yard', 'third', -6, 9)
    } finally {
      await quietAgain(game)
    }
    console.log(log.join('\n'))
  })

  test('reactions held mid-way (a harvest plucked, a bed watered, one sown, lemons picked, a cow milked): the same frame', async ({ game }) => {
    await setUp(game, 'farm')
    const { page } = game
    const log: string[] = []
    // (fillFarm planted every bed and ripened it, and filled the tree and the animals)
    const started = await page.evaluate(() => {
      const h = (window as any).__home
      const f = h.farm
      f.state.coins += 1000
      const harvested = f.harvest(0)
      const watered = f.water(1)
      Object.assign(f.state.beds[2], { crop: null, growth: 0, water: 0 })
      const sown = f.plant(2, 'lettuce')
      const picked = f.collect('tree', 0)
      f.state.producers.cows.stock[0] = Math.max(1, f.state.producers.cows.stock[0])
      const milked = f.collect('cows', 0)
      // every reaction held 120 ms into itself, frame after frame
      h.react.freeze(120)
      return { harvested, watered, sown, picked, milked, plants: h.react.reacting('plant'), fruit: h.react.reacting('fruit'), animal: h.react.reacting('animal') }
    })
    expect(started).toMatchObject({ watered: true, sown: true, plants: true, fruit: true, animal: true })
    expect(started.harvested).toBeGreaterThan(0)
    expect(started.picked).toBeGreaterThan(0)
    expect(started.milked).toBeGreaterThan(0)
    try {
      for (const p of HELD) await compareAt(game, p, log)
    } finally {
      await page.evaluate(() => {
        const r = (window as any).__home.react
        r.freeze(null)
        r.stopReactions()
      })
    }
    console.log(log.join('\n'))
  })

  test('afterwards: the house as it was, no console errors', async ({ game }) => {
    await game.ready()
    await emptyFarm(game.page)
    expect(game.errors).toEqual([])
  })
})
