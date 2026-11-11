/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, bootApp, emptyFarm, fillFarm, watchErrors } from './helpers'

// The budget, measured the way phones meet the game: a walk through the house and out over the farm, at its fullest
// (every room filled with the heaviest piece until full, every animal the shop sells, fifteen buyers, ripe crops), at
// 640×360 and at a phone's drawing buffers held upright and turned sideways. A Pixel 7 on Medium draws 390×844 CSS px
// at 1.25 px each: 487×1055. What a view draws depends only on its frustum (its size and the field of view the game
// gives it, wider when upright), never on the device or the tier (src/lib/profile.ts changes the shadow map's texels,
// textures and post-processing, not geometry), so the shared page at that size draws what the phone draws.
//
// At each view, with the drawing pass (src/lib/visibility) on: the camera's pass on its own, and the sun's shadow pass on
// its own, as one redraw of the map (the map is drawn only when a caster moved). The camera pass stays under 250k
// triangles and 700 draws, the shadow pass under 150k and 250. The same with the pass off, and with the hedge and the
// woods' crowns as one mesh each (src/farm/Land.tsx), for the report. One table per run, printed at the end.
//
// Some views are over the budget today even with the pass. They are debts (DEBTS): each may draw no more than it
// measured, and a little more for the animals that wander in and out of the view, so it can only go down. A debt paid
// (5 % under the budget) must leave the list. Not by lowering what the game holds: by how things are drawn (CLAUDE.md).

/** The sizes: the e2e window, and a phone's drawing buffers held upright and turned sideways. */
const SIZES = [
  { name: '640×360', width: 640, height: 360 },
  { name: '487×1055', width: 487, height: 1055 },
  { name: '1055×487', width: 1055, height: 487 },
]

const LIMITS = { camera: { triangles: 250_000, draws: 700 }, shadow: { triangles: 150_000, draws: 250 } }
/** A debt is paid once it measures this much under the budget (not just under it: what wanders in view moves it). */
const PAID = 0.05

/** Paid by: what each debt waits for. */
const LOD = 'levels of detail: a model far off drawn with the triangles its pixels can show (being tried)'
const FURNITURE = 'fewer furniture draws: the pieces of one kind in a room drawn together'

interface Debt {
  view: string
  size: string
  pass: 'camera' | 'shadow'
  /** the most it may draw (measured, and a little more) */
  triangles?: number
  draws?: number
  why: string
  pays: string[]
}

const YARD = 'outdoors the portals leave nothing out: every room is seen through its windows, full of furniture, and the whole farm with its animals and buyers'
const ROOMS = 'the walls fade and the ceilings go: no portals, every room in view is drawn, full of furniture'
const SHADOWS = 'the ceilings go, so the sun reaches every room: every piece of furniture is drawn into its map'

/** The views over the budget today (with the drawing pass, the hedge and the woods in pieces), and the most each may draw
 *  until it is paid: the most it measured, and 5 % more (the animals and buyers wander in and out of a view: the yard
 *  back at the house sideways measured 249k to 263k). Paid once it measures 5 % under the budget. */
const DEBTS: Debt[] = [
  { view: 'yard, over the farm', size: '640×360', pass: 'camera', triangles: 460_000, why: YARD, pays: [LOD, FURNITURE] },
  { view: 'yard, over the farm', size: '487×1055', pass: 'camera', triangles: 295_000, why: YARD, pays: [LOD, FURNITURE] },
  { view: 'yard, over the farm', size: '1055×487', pass: 'camera', triangles: 462_000, why: YARD, pays: [LOD, FURNITURE] },
  { view: 'yard, back at the house', size: '1055×487', pass: 'camera', triangles: 277_000, why: YARD, pays: [LOD, FURNITURE] },
  { view: 'third person, the living room', size: '1055×487', pass: 'camera', triangles: 290_000, why: ROOMS, pays: [LOD, FURNITURE] },
  { view: 'decorating the living room', size: '640×360', pass: 'camera', triangles: 284_000, why: ROOMS, pays: [LOD, FURNITURE] },
  ...SIZES.flatMap((s): Debt[] => [
    { view: 'third person, the living room', size: s.name, pass: 'shadow', triangles: 315_000, draws: 531, why: SHADOWS, pays: [FURNITURE, LOD] },
    { view: 'decorating the living room', size: s.name, pass: 'shadow', triangles: 313_000, draws: 684, why: SHADOWS, pays: [FURNITURE, LOD] },
  ]),
]

/** First person, the sun's shadow pass is the same from every view: one debt for all of them (draws only; its triangles
 *  stay under the budget). */
const SUN_DEBT: Debt = {
  view: 'every first-person view',
  size: 'every size',
  pass: 'shadow',
  draws: 275,
  why: 'the silo, the barn, the office and the tractor cast shadows of their own: 19 draws more (242 → 261)',
  pays: ['their static parts drawn into the map together', "the sun's map kept between frames while nothing that shows in it moves (being tried)"],
}

/** `BUDGET_MEASURE=1`: the table without the checks, to measure the debts again (after a change that pays one). */
const MEASURE_ONLY = !!process.env.BUDGET_MEASURE

const P = Math.PI
const EYE = 1.62

interface View {
  name: string
  /** where the player stands, and (first person) the camera set by hand: yaw, pitch, at eye height */
  x: number
  z: number
  yaw: number
  pitch?: number
  /** the kitchen's door open or shut */
  door?: boolean
  /** third person or decorating: the game's own camera, after its flight */
  mode?: 'third' | 'decorate'
}

/** The walk: the four rooms, each doorway with the kitchen's door shut and open, out of the garden door, the gate with
 *  the line, the yard over the farm and back at the house, third person and decorating in the living room. */
const WALK: View[] = [
  { name: 'living room', x: -3.5, z: 1.3, yaw: P, pitch: -0.04, door: false },
  { name: 'studio', x: -3.5, z: -2, yaw: 0, door: false },
  { name: 'kitchen', x: 3.5, z: -3, yaw: P, door: false },
  { name: 'bedroom', x: 3.5, z: 1, yaw: P, door: false },
  ...[false, true].flatMap((open) => {
    const door = open ? 'the door open' : 'the door shut'
    return [
      { name: `living ↔ studio doorway, ${door}`, x: -3.5, z: 1.2, yaw: 0, door: open },
      { name: `studio ↔ kitchen doorway, ${door}`, x: -1.2, z: -3, yaw: -P / 2, door: open },
      { name: `living ↔ bedroom doorway, ${door}`, x: -1.2, z: 3, yaw: -P / 2, door: open },
      { name: `kitchen ↔ bedroom doorway, ${door}`, x: 3.5, z: -1.3, yaw: P, door: open },
    ]
  }),
  { name: 'garden door, looking out', x: -1.2, z: 3.6, yaw: P, pitch: -0.05, door: false },
  { name: 'gate, the line', x: 4.2, z: 10.8, yaw: P - 0.5, pitch: -0.05 },
  { name: 'yard, over the farm', x: -12, z: -10.5, yaw: (-3 * P) / 4, pitch: -0.08 },
  { name: 'yard, back at the house', x: 0, z: 12.5, yaw: 0, pitch: 0.02 },
  { name: 'third person, the living room', x: -3.5, z: 2.5, yaw: P, mode: 'third', door: false },
  { name: 'decorating the living room', x: -3.5, z: 2.5, yaw: P, mode: 'decorate', door: false },
]

interface Count {
  draws: number
  triangles: number
}
interface Measured {
  /** the camera's pass, and the sun's shadow pass redrawn once */
  camera: Count
  shadow: Count
}
interface Row {
  farm: string
  view: string
  size: string
  /** the drawing pass on, off, and on with the hedge and the crowns as one mesh each */
  on: Measured
  off: Measured
  whole: Measured | null
  portals: boolean
  sun: boolean
  verdict: string
}

const rows: Row[] = []

/** Runs in the page: counts one view (the camera set by hand when `pose` is given), the drawing pass on and off. */
function count([pose, asWhole]: [number[] | null, boolean]) {
  const h = (window as any).__home
  const gl = h.gl
  const cam = h.camera
  if (pose) {
    cam.position.set(pose[0], pose[1], pose[2])
    cam.rotation.order = 'YXZ'
    cam.rotation.set(pose[4], pose[3], 0)
    cam.updateMatrixWorld(true)
  }
  const v = h.view
  const keep = { auto: gl.info.autoReset, shadows: gl.shadowMap.autoUpdate }
  gl.info.autoReset = false
  gl.shadowMap.autoUpdate = false
  // the camera's pass on its own (the sun's map left as it is), then once more with the map redrawn: the difference
  const run = () => {
    gl.shadowMap.needsUpdate = false
    gl.info.reset()
    gl.render(h.scene, cam)
    const camera = { draws: gl.info.render.calls as number, triangles: gl.info.render.triangles as number }
    gl.shadowMap.needsUpdate = true
    gl.info.reset()
    gl.render(h.scene, cam)
    return { camera, shadow: { draws: gl.info.render.calls - camera.draws, triangles: gl.info.render.triangles - camera.triangles } }
  }
  try {
    v.on = true
    const on = run()
    const used = { portals: v.stats.portals as boolean, sun: v.stats.sun as boolean }
    v.on = false
    const off = run()
    v.on = true
    let whole = null
    if (asWhole && h.land) {
      h.land.whole(true)
      try {
        whole = run()
      } finally {
        h.land.whole(false)
      }
    }
    return { size: [gl.domElement.width, gl.domElement.height], on, off, whole, ...used }
  } finally {
    v.on = true
    gl.info.autoReset = keep.auto
    gl.shadowMap.autoUpdate = keep.shadows
    gl.shadowMap.needsUpdate = true
  }
}

/** Stands the player at a view with the kitchen's door as it says, until the camera is there and the door still. */
async function standAt(page: Page, v: View) {
  await page.evaluate(
    ([x, z, yaw, door]) => {
      const h = (window as any).__home
      const s = h.useHome.getState()
      if (door !== null && s.doors['door-kitchen-bedroom'] !== door) s.toggleDoor('door-kitchen-bedroom')
      const at = h.playerState.position
      if (Math.hypot(at.x - x, at.z - z) > 0.6) h.teleport(x, 1.4, z)
      if (typeof h.look === 'function') h.look({ yaw, pitch: 0 })
      else {
        h.look.yaw = yaw
        h.look.pitch = 0
      }
    },
    [v.x, v.z, v.yaw, v.door ?? null] as [number, number, number, boolean | null],
  )
  await expect
    .poll(
      () =>
        page.evaluate(
          ([x, z, door]) => {
            const h = (window as any).__home
            const c = h.camera.position
            const leaf = h.scene.getObjectByName('door-leaf')
            const angle = leaf ? Math.abs(Math.atan2(-leaf.matrixWorld.elements[2], leaf.matrixWorld.elements[0])) : -1
            const settled = door === null || (door ? angle > Math.PI / 2 - 0.01 : angle >= 0 && angle < 0.002)
            return { ready: Math.hypot(c.x - x, c.z - z) < 1.2 && settled }
          },
          [v.x, v.z, v.door ?? null] as [number, number, boolean | null],
        ),
      { timeout: 60_000, intervals: [250], message: `${v.name}: the player there and the door settled` },
    )
    .toMatchObject({ ready: true })
}

/** Counts a view: first person with the camera set by hand; third person and decorating with the game's camera, after
 *  its flight there (and back to first person afterwards). */
async function measure(page: Page, v: View, farm: string, whole: boolean): Promise<Row> {
  await standAt(page, v)
  let r: any
  if (v.mode) {
    await page.waitForTimeout(600)
    await page.evaluate((mode) => {
      const s = (window as any).__home.useHome.getState()
      if (mode === 'third') s.setView('third')
      else s.setDecorating(true)
    }, v.mode)
    // the camera's flight there (about a second; decorating, until its blend is done), then until it stands still over
    // two frames (a frame can take longer than a poll in software)
    await page.waitForTimeout(1500)
    await page.evaluate(() => delete (window as any).__budgetCamera)
    await page.waitForFunction(
      (decorating) => {
        const w = window as any
        const h = w.__home
        if (decorating && h.home.decorate.camera.blend < 0.999) return false
        const c = h.camera.position
        const frames = h.view.stats.renders
        const last = w.__budgetCamera
        if (last && frames - last[3] < 2) return false
        w.__budgetCamera = [c.x, c.y, c.z, frames]
        return !!last && Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]) < 1e-3
      },
      v.mode === 'decorate',
      { timeout: 120_000, polling: 250 },
    )
    r = await page.evaluate(count, [null, whole] as [null, boolean])
    await page.evaluate(() => {
      const s = (window as any).__home.useHome.getState()
      s.setView('first')
      s.setDecorating(false)
    })
    await page.waitForFunction(() => (window as any).__home.view.stats.portals === true, null, { timeout: 120_000, polling: 250 })
  } else r = await page.evaluate(count, [[v.x, EYE, v.z, v.yaw, v.pitch ?? 0], whole] as [number[], boolean])
  return { farm, view: v.name, size: r.size.join('×'), on: r.on, off: r.off, whole: r.whole, portals: r.portals, sun: r.sun, verdict: '' }
}

/** Resizes the shared page to a size until the canvas has it; back to 640×360 with `null`. */
async function resize(page: Page, size: { width: number; height: number } | null) {
  const s = size ?? { width: 640, height: 360 }
  await page.setViewportSize(s)
  await page.waitForFunction(([w, hh]) => (window as any).__home.gl.domElement.width === w && (window as any).__home.gl.domElement.height === hh, [s.width, s.height], { timeout: 120_000 })
  await page.waitForTimeout(1500)
}

/** Every pass under its limit, or a listed debt at no more than its ceiling (and still over the limit). */
function judge(row: Row) {
  const notes: string[] = []
  for (const pass of ['camera', 'shadow'] as const) {
    const debt = DEBTS.find((d) => d.view === row.view && d.size === row.size && d.pass === pass) ?? (pass === 'shadow' && row.portals ? SUN_DEBT : undefined)
    for (const what of ['triangles', 'draws'] as const) {
      const value = row.on[pass][what]
      const limit = LIMITS[pass][what]
      const ceiling = debt?.[what]
      const label = `${row.view} (${row.size}): the ${pass} pass's ${what}`
      // (soft: the walk goes on, and the table shows every view)
      expect.soft(Number.isFinite(value), `${label}: a number`).toBe(true)
      if (ceiling === undefined) {
        expect.soft(value, `${label}, under the budget`).toBeLessThan(limit)
        if (!(value < limit)) notes.push(`OVER: ${pass} ${what}`)
        continue
      }
      expect.soft(value, `${label}, a debt: no more than its ceiling`).toBeLessThanOrEqual(ceiling)
      const paid = value < limit * (1 - PAID)
      expect.soft(paid, `${label}: ${value}, the debt is paid (5 % under the budget): take it off DEBTS and tests/README`).toBe(false)
      notes.push(value > ceiling ? `OVER its ceiling: ${pass} ${what} ${ceiling}` : paid ? `PAID: ${pass} ${what}` : `debt: ${pass} ${what} ≤ ${k(ceiling)}`)
    }
  }
  row.verdict = notes.length ? notes.join('; ') : 'ok'
}

/** The walk at each size, on a page with the farm at its fullest. */
async function walk(page: Page, farm: string, sizes: typeof SIZES, check: boolean, whole = true) {
  try {
    for (const size of sizes) {
      await resize(page, size.width === 640 ? null : size)
      for (const v of WALK) {
        const row = await measure(page, v, farm, whole)
        expect(row.size, `${v.name}: the canvas at ${size.name}`).toBe(size.name)
        // the rooms and the sun's windows are used in first person, and not in third person or decorating
        expect(row.portals, `${v.name}: the rooms and portals`).toBe(!v.mode)
        rows.push(row)
        if (check) judge(row)
        else row.verdict = 'report'
      }
    }
  } finally {
    await resize(page, null)
  }
}

const k = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const pair = (c: Count) => `${c.draws} / ${k(c.triangles)}`
/** The pieces against one mesh: draws added, triangles saved. */
const pieces = (r: Row, pass: 'camera' | 'shadow') => {
  if (!r.whole) return '-'
  const draws = r.on[pass].draws - r.whole[pass].draws
  const saved = r.whole[pass].triangles - r.on[pass].triangles
  return `${draws >= 0 ? '+' : '−'}${Math.abs(draws)} / ${saved >= 0 ? '−' : '+'}${k(Math.abs(saved))}`
}

function table(list: Row[]) {
  const head = ['farm', 'size', 'view', 'camera on', 'camera off', 'shadow on', 'shadow off', 'land pieces: camera', 'shadow', 'verdict']
  const lines = list.map((r) => [r.farm, r.size, r.view, pair(r.on.camera), pair(r.off.camera), pair(r.on.shadow), pair(r.off.shadow), pieces(r, 'camera'), pieces(r, 'shadow'), r.verdict])
  const widths = head.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)))
  const fmt = (l: string[]) => `| ${l.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`
  return ['The budget over the walk (draws / triangles; land pieces: draws added / triangles saved against one mesh each):', fmt(head), fmt(widths.map((w) => '-'.repeat(w))), ...lines.map(fmt)].join(
    '\n',
  )
}

test.afterAll(() => {
  if (rows.length) console.log(table(rows))
})

test.describe('performance budget', () => {
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

  test('the farm at its fullest: every room filled with the heaviest piece until the next is refused', async ({ game }) => {
    await game.ready()
    const full = await fillFarm(game.page)
    console.log(
      `${Object.entries(full.rooms)
        .map(([room, r]) => `${room}: ${r.added} × ${full.heaviest}, ${r.weight} of ${r.limit}`)
        .join('; ')}; ${full.line} in line; ${JSON.stringify(full.animals)}`,
    )
    expect(full.heaviest).toBe('accent-chair')
    expect(full.rooms.bedroom.added).toBeGreaterThan(1)
    for (const [room, r] of Object.entries(full.rooms)) {
      expect(r.weight, room).toBeLessThanOrEqual(r.limit)
      expect(r.reason, room).toBe('This room is full')
    }
    expect(full.line).toBe(15)
  })

  for (const size of SIZES)
    test(`the walk at ${size.name}: under the budget, or a listed debt no higher than it was`, async ({ game }) => {
      test.setTimeout(1_800_000)
      await game.ready()
      await fillFarm(game.page)
      await walk(game.page, 'fullest', [size], !MEASURE_ONLY)
    })
})

test.describe('ten times the farm', () => {
  // `?debug&stress=10&nocap`: ten times today's most of every animal and buyer (src/debug/Stress.tsx) and every room
  // filled until nothing more fits on its floor. A page of its own. Reported only: no limit until real phones have
  // been measured with it.
  test('the walk at ten times the farm, reported @boot', async ({ browser }) => {
    test.setTimeout(1_800_000)
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4185' })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    try {
      await bootApp(page, 'debug&quality=low&stress=10&nocap&people=32')
      await page.waitForFunction(() => !!(window as any).__home?.stress, null, { timeout: 120_000, polling: 500 })
      const stress = await page.evaluate(() => (window as any).__home.stress.n)
      expect(stress).toEqual({ people: 150, cows: 30, sheep: 40, hens: 60 })
      const full = await fillFarm(page)
      console.log(
        `ten times: ${JSON.stringify(stress)}; ${Object.entries(full.rooms)
          .map(([room, r]) => `${room}: ${r.added} × ${full.heaviest} (${r.weight})`)
          .join('; ')}`,
      )
      // no room limit: each room holds more than the limit allows
      for (const r of Object.values(full.rooms)) {
        expect(r.limit).toBe(Infinity)
        expect(r.weight).toBeGreaterThan(60_000)
      }
      // (the land as one mesh is not drawn here: the pieces are measured on today's fullest farm)
      // one size: it reports, it does not judge, and at ten times every size takes long in software WebGL
      await walk(page, '10×', SIZES.slice(0, 1), false, false)
      expect(errors, errors.join('\n')).toEqual([])
    } finally {
      await context.close()
    }
  })
})

test.describe('no WebGL', () => {
  test('shows the failure message and keeps the intro disabled', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4185' })
    const page = await context.newPage()
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- called with the canvas as `this` below
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
  test("today's farm again, and the shared session produced no console errors", async ({ game }) => {
    await game.ready()
    await emptyFarm(game.page)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})
