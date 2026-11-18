/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import {
  countingTest as test,
  expect,
  bootApp,
  changeHouse,
  emptyFarm,
  fillFarm,
  marketDoorStill,
  onMap,
  openingViews,
  openingsNow,
  restoreHouse,
  watchErrors,
  BASE,
  NULL_GL,
  type MapId,
} from './helpers'
import { FRONT_DOOR, HALL } from '../../src/data/market'
import { AGENT_SEAT, AGENT_STAND } from '../../src/data/estate'

// The budget, measured the way phones meet the game: a walk through the house and its garden (the home map), then over
// the farm and into the supermarket (the farm's map: src/scene/Maps.tsx), at its fullest (every room filled with the
// heaviest piece until full, every animal the shop sells, fifteen buyers, ripe crops, every place on the market's
// shelves full of corn), at 640×360 and at a phone's drawing buffers held upright and turned sideways. A Pixel 7 on Medium draws 390×844 CSS px
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
//
// The page is on the drawing-free WebGL context (nullgl.js, `countingTest`): three.js counts what a frame draws on the
// CPU, the same with it as with a real context (26-counting holds the two side by side), and frames come at full speed
// instead of software rendering's few a second — the three walks in about a minute, so all three run on every push.

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
// (lighter copies for the sun already draw each piece's shadow from a copy within half a texel: src/lib/sculpt/sun.ts)
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

const SHADOWS = 'the ceilings go, so the sun reaches every room: every piece of furniture is drawn into its map (from its copy for the sun)'

/** The views over the budget today (with the drawing pass, the hedge and the woods in pieces), and the most each may draw
 *  until it is paid: the most it measured, and 5 % more. Paid once it measures 5 % under the budget. */
// paid with the two maps (the house and the farm each a map of its own, src/scene/Maps.tsx): the yard over the farm
// (238k-252k with the house's rooms seen through its windows → 231k-241k), decorating the living room at 640×360 (286k
// with the farm round the house → 230k), and the sun's draws outdoors and in a window's sunlight (261-262 → 141-172:
// the farm's casters are not in the house's map, nor the house's in the farm's). Third person and decorating draw no
// farm into the sun's map: 309k-310k → 264k triangles, 425-433 → 305-312 draws.
// paid with the lighter copies (src/lib/sculpt/lod.ts): the yard over the farm decorated (314.5k-318.0k → 221.5k-237.2k:
// every crowd's far parts, the hanging fruit and the crops among them, drawn from copies under half a pixel, judged worth
// a draw across the crowd). The furniture is drawn into the sun's map from copies within half a texel (sun.ts): third
// person and decorating 266k-269k → 178k-180k triangles, the same draws.
const DEBTS: Debt[] = SIZES.flatMap((s): Debt[] => [
  { view: 'third person, the living room', size: s.name, pass: 'shadow', triangles: 189_000, draws: 328, why: SHADOWS, pays: [FURNITURE] },
  { view: 'decorating the living room', size: s.name, pass: 'shadow', triangles: 186_000, draws: 322, why: SHADOWS, pays: [FURNITURE] },
])

/** `BUDGET_MEASURE=1`: the table without the checks, to measure the debts again (after a change that pays one). */
const MEASURE_ONLY = !!process.env.BUDGET_MEASURE

const P = Math.PI
const EYE = 1.62

interface View {
  /** the map it is on: the house and its garden, or the farm */
  map: MapId
  name: string
  /** where the player stands, and (first person) the camera set by hand: yaw, pitch, at eye height */
  x: number
  z: number
  yaw: number
  pitch?: number
  /** the kitchen's door open or shut */
  door?: boolean
  /** third person, decorating, or the wardrobe open (you filmed from in front: src/home/Wardrobe.tsx): the game's own
   *  camera, after its flight */
  mode?: 'third' | 'decorate' | 'wardrobe'
  /** the market's sliding doors as the view means them: shut (from the lane) or open (you by them) */
  marketDoor?: 0 | 1
  /** the market at its fullest for this view (`marketFill`): its shoppers standing in and round the hall (the most
   *  there are about at once), and each place a different good (the most draws) rather than all corn (the most
   *  triangles). Without it, every place full of corn and the shop quiet: nobody about and no visits, so no view ever
   *  depends on when a shopper walks through its front door (which opens for them). */
  fill?: { shoppers?: boolean; mixed?: boolean; quiet?: boolean }
}

/** The walk, map by map. The house: the four rooms, each doorway with the kitchen's door shut and open, out of the garden
 *  door, its garden back at the house and over the fence, third person and decorating in the living room, and the
 *  bedroom's wardrobe open (a hat on). The farm: the gate with the line, the yard over the farm and where the house stood,
 *  the supermarket from the lane and across its shelves. */
const WALK: View[] = [
  { map: 'home', name: 'living room', x: -3.5, z: 1.3, yaw: P, pitch: -0.04, door: false },
  { map: 'home', name: 'studio', x: -3.5, z: -2, yaw: 0, door: false },
  { map: 'home', name: 'kitchen', x: 3.5, z: -3, yaw: P, door: false },
  { map: 'home', name: 'bedroom', x: 3.5, z: 1, yaw: P, door: false },
  ...[false, true].flatMap((open): View[] => {
    const door = open ? 'the door open' : 'the door shut'
    return [
      { map: 'home', name: `living ↔ studio doorway, ${door}`, x: -3.5, z: 1.2, yaw: 0, door: open },
      { map: 'home', name: `studio ↔ kitchen doorway, ${door}`, x: -1.2, z: -3, yaw: -P / 2, door: open },
      { map: 'home', name: `living ↔ bedroom doorway, ${door}`, x: -1.2, z: 3, yaw: -P / 2, door: open },
      { map: 'home', name: `kitchen ↔ bedroom doorway, ${door}`, x: 3.5, z: -1.3, yaw: P, door: open },
    ]
  }),
  { map: 'home', name: 'garden door, looking out', x: -1.2, z: 3.6, yaw: P, pitch: -0.05, door: false },
  { map: 'home', name: 'the garden, back at the house', x: 0, z: 12.5, yaw: 0, pitch: 0.02, door: false },
  { map: 'home', name: 'the garden, over the fence to the west', x: -9.5, z: 2, yaw: P / 2, pitch: 0.02, door: false },
  { map: 'home', name: 'third person, the living room', x: -3.5, z: 2.5, yaw: P, mode: 'third', door: false },
  { map: 'home', name: 'decorating the living room', x: -3.5, z: 2.5, yaw: P, mode: 'decorate', door: false },
  { map: 'home', name: 'the wardrobe open, you filmed', x: 5.8, z: 1.75, yaw: 0, mode: 'wardrobe', door: false },
  { map: 'farm', name: 'gate, the line', x: 4.2, z: 10.8, yaw: P - 0.5, pitch: -0.05 },
  { map: 'farm', name: 'yard, over the farm', x: -12, z: -10.5, yaw: (-3 * P) / 4, pitch: -0.08 },
  { map: 'farm', name: 'yard, where the house stood', x: 0, z: 12.5, yaw: 0, pitch: 0.02 },
  // the supermarket across the lane (src/data/market.ts), every place on its shelves full: from the lane, 2.4 m out from
  // its doorway and looking at its front, its sliding doors shut (they open for anyone within 2 m; the garden's gate,
  // more than 1.8 m away, stays shut too) — and with its shoppers about, who keep the doors open (one stands just inside
  // them); and inside by the door, the doors open beside you, looking across the shelves along the south wall to the
  // island (36° east of south), its shoppers about, every place full of corn (the most triangles) and each a different
  // good (the most draws)
  { map: 'farm', name: 'lane, the market', x: (FRONT_DOOR.x0 + FRONT_DOOR.x1) / 2, z: FRONT_DOOR.z0 - 2.4, yaw: P, pitch: -0.03, marketDoor: 0 },
  { map: 'farm', name: 'lane, the market, its shoppers', x: (FRONT_DOOR.x0 + FRONT_DOOR.x1) / 2, z: FRONT_DOOR.z0 - 2.4, yaw: P, pitch: -0.03, marketDoor: 1, fill: { shoppers: true } },
  { map: 'farm', name: 'market, the shelves', x: FRONT_DOOR.x1 - 0.3, z: HALL.z0 + 0.6, yaw: -P + (36 * P) / 180, pitch: -0.12, marketDoor: 1, fill: { shoppers: true } },
  { map: 'farm', name: 'market, the shelves, mixed', x: FRONT_DOOR.x1 - 0.3, z: HALL.z0 + 0.6, yaw: -P + (36 * P) / 180, pitch: -0.12, marketDoor: 1, fill: { shoppers: true, mixed: true } },
  // the parking lot west of the gate with the car in its bay, and the estate office's front beside the market's: from
  // the lane east of the gate, looking west along it (the gate and the market's doors shut: you are more than 1.8 m and
  // 2 m from them); and inside the office, before the agent's desk, looking at him (its door open behind you)
  { map: 'farm', name: 'lane, the parking lot and the estate office', x: 7.4, z: 14.4, yaw: 1.9, pitch: -0.06 },
  { map: 'farm', name: 'estate office, the agent at his desk', x: AGENT_STAND.x, z: AGENT_STAND.z, yaw: Math.atan2(-(AGENT_SEAT.x - AGENT_STAND.x), -(AGENT_SEAT.z - AGENT_STAND.z)), pitch: -0.12 },
  // the mailbox by the gate (src/farm/Mailbox.tsx), a letter waiting (its flag up: fillFarm), from the lane by the
  // parking lot, looking past it at the gate and the line
  { map: 'farm', name: 'lane, the mailbox by the gate', x: 2.6, z: 16, yaw: -0.69, pitch: -0.1 },
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
  /** a first-person view (the wardrobe's included: the camera films you, the rooms and portals in use) */
  firstPerson: boolean
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
    // (the hedge and the woods are the farm's: on its map only)
    if (asWhole && h.land && h.useHome.getState().map === 'farm') {
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
    ([x, z, yaw, door, fill]) => {
      const h = (window as any).__home
      const s = h.useHome.getState()
      if (door !== null && s.doors['door-kitchen-bedroom'] !== door) s.toggleDoor('door-kitchen-bedroom')
      // the market full again as the view means it: its shoppers standing for the market's views that ask for them, and
      // for every other view quiet (nobody about, no visits)
      h.farm.marketFill?.('corn', fill)
      const at = h.playerState.position
      if (Math.hypot(at.x - x, at.z - z) > 0.6) h.teleport(x, 1.4, z)
      if (typeof h.look === 'function') h.look({ yaw, pitch: 0 })
      else {
        h.look.yaw = yaw
        h.look.pitch = 0
      }
    },
    [v.x, v.z, v.yaw, v.door ?? null, v.fill ?? { quiet: true }] as [number, number, number, boolean | null, NonNullable<View['fill']>],
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
  // the market's sliding doors still: as the view means them, or else either way (a shopper going by opens them)
  await marketDoorStill(page, v.marketDoor)
}

/** Counts a view: first person with the camera set by hand; third person and decorating with the game's camera, after
 *  its flight there (and back to first person afterwards). */
async function measure(page: Page, v: View, farm: string, whole: boolean): Promise<Row> {
  await standAt(page, v)
  let r: any
  if (v.mode) {
    await page.waitForTimeout(600)
    await page.evaluate((mode) => {
      const h = (window as any).__home
      const s = h.useHome.getState()
      if (mode === 'third') s.setView('third')
      else if (mode === 'decorate') s.setDecorating(true)
      else {
        // a hat on, and the wardrobe opened as its button opens it
        if (!h.farm.state.outfit.hat) h.farm.wearGarment('straw-brown')
        h.interactables()
          .find((d: any) => d.id.startsWith('wardrobe-'))
          .run()
      }
    }, v.mode)
    // the camera's flight there (about a second; decorating, until its blend is done), then until it stands still over
    // two frames (a frame can take longer than a poll in software)
    await page.waitForTimeout(1500)
    await page.evaluate(() => delete (window as any).__budgetCamera)
    await page.waitForFunction(
      (mode) => {
        const w = window as any
        const h = w.__home
        if (mode === 'decorate' && h.home.decorate.camera.blend < 0.999) return false
        if (mode === 'wardrobe' && !h.dressView.settled) return false
        const c = h.camera.position
        const frames = h.view.stats.renders
        const last = w.__budgetCamera
        if (last && frames - last[3] < 2) return false
        w.__budgetCamera = [c.x, c.y, c.z, frames]
        return !!last && Math.hypot(c.x - last[0], c.y - last[1], c.z - last[2]) < 1e-3
      },
      v.mode,
      { timeout: 120_000, polling: 250 },
    )
    r = await page.evaluate(count, [null, whole] as [null, boolean])
    await page.evaluate(() => {
      const s = (window as any).__home.useHome.getState()
      if (s.panel) s.closePanel()
      s.setView('first')
      s.setDecorating(false)
    })
    await page.waitForFunction(() => (window as any).__home.view.stats.portals === true, null, { timeout: 120_000, polling: 250 })
  } else r = await page.evaluate(count, [[v.x, EYE, v.z, v.yaw, v.pitch ?? 0], whole] as [number[], boolean])
  return { farm, view: v.name, size: r.size.join('×'), on: r.on, off: r.off, whole: r.whole, firstPerson: !v.mode || v.mode === 'wardrobe', portals: r.portals, sun: r.sun, verdict: '' }
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
    const debt = DEBTS.find((d) => d.view === row.view && d.size === row.size && d.pass === pass)
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

/** The walk at each size, on a page with the farm at its fullest: the house's views, then the farm's. */
async function walk(page: Page, farm: string, sizes: typeof SIZES, check: boolean, whole = true, views: View[] = WALK) {
  try {
    for (const size of sizes) {
      await resize(page, size.width === 640 ? null : size)
      for (const map of ['home', 'farm'] as const) {
        if (!views.some((w) => w.map === map)) continue
        await onMap(page, map)
        // the farm at its fullest again on its map (the shelves, quiet), the animals and the buyers in their places
        await fillFarm(page)
        await page.waitForTimeout(6000)
        for (const v of views.filter((w) => w.map === map)) {
          const row = await measure(page, v, farm, whole)
          expect(row.size, `${v.name}: the canvas at ${size.name}`).toBe(size.name)
          // the rooms and the sun's windows are used in first person in the house (the wardrobe's camera too), and not in
          // third person or decorating, nor on the farm (a map of its own, with no house)
          expect(row.portals, `${v.name}: the rooms and portals`).toBe(map === 'home' && row.firstPerson)
          rows.push(row)
          if (check) judge(row)
          else row.verdict = 'report'
        }
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
        // (a screen is drawn by src/scene/Screens.tsx with the hologram of the room you are in: measured in the walk)
        if (p.type === 'screen') continue
        const group = h.scene.getObjectByName(`piece-${p.id}`)
        if (!group) {
          out.push(`${p.id}: not in the scene`)
          continue
        }
        let triangles = 0
        group.traverse((o: any) => {
          // (what is drawn only into the sun's map, from a lighter copy, is not the model: src/lib/sculpt/sun.ts)
          if (!o.isMesh || o.userData.shadowOnly) return
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
    // the farm decorated: every kind of the edit mode's shop standing, about a hundred pieces in all
    console.log(`decoration: ${JSON.stringify(full.decor)}`)
    expect(Object.keys(full.decor).length).toBe(29)
    expect(Object.values(full.decor).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(90)
  })

  for (const size of SIZES)
    test(`the walk at ${size.name}: under the budget, or a listed debt no higher than it was`, async ({ game }) => {
      test.setTimeout(1_800_000)
      await game.ready()
      await fillFarm(game.page)
      await walk(game.page, 'fullest', [size], !MEASURE_ONLY)
    })

  // The house changed every way decorating can change its shell (changeHouse in helpers.ts: windows and the garden door
  // moved, one round its room's corner, a doorway closed, the kitchen's door moved, every room painted and floored), the
  // rooms as full: the house's walk again, its doorways and windows and the garden door where they are now (made from its
  // openings: openingViews), to the same limits and debts.
  for (const size of SIZES)
    test(`a changed house at ${size.name}: under the budget, or a listed debt no higher than it was`, async ({ game }) => {
      test.setTimeout(1_800_000)
      await game.ready()
      await fillFarm(game.page)
      expect(await changeHouse(game.page), 'every change fits').toEqual([])
      try {
        const house = WALK.filter((w) => w.map === 'home' && !/doorway|garden door/.test(w.name))
        const made = openingViews(await openingsNow(game.page)).map((v): View => ({ map: 'home', name: `changed: ${v.name}`, x: v.x, z: v.z, yaw: v.yaw, pitch: v.pitch, door: v.door ?? false }))
        await walk(game.page, 'changed house', [size], !MEASURE_ONLY, false, [...house, ...made])
      } finally {
        await restoreHouse(game.page)
      }
    })
})

test.describe('ten times the farm', () => {
  // `?debug&stress=10&nocap`: ten times today's most of every animal and buyer (src/debug/Stress.tsx) and every room
  // filled until nothing more fits on its floor. A page of its own. Reported only: no limit until real phones have
  // been measured with it.
  test('the walk at ten times the farm, reported @boot', { tag: '@full' }, async ({ browser }) => {
    test.setTimeout(1_800_000)
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: BASE })
    const page = await context.newPage()
    await page.addInitScript({ path: NULL_GL })
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
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: BASE })
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
