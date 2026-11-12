/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp, watchErrors, SPAWN, BASE } from './helpers'
import type { Page } from '@playwright/test'

// Take me there: a mark tapped on the compass walks you to the thing by yourself, on a way found round what is in the
// way (src/lib/route) — out of the house through its doorways and the garden door, round the beds, the pens and the
// buildings — with the stick's own walking (never put there), until the thing is within reach and the action button
// offers it; the view turns to it. Anything you do yourself takes over at once: a key, the stick, a panel, the mark
// again. The kitchen's door shut is a wall. Every number is read in the same call that waits for it (the farm ticks).

/** Only the nest is ready: six eggs (its most), every other producer empty. */
const onlyEggs = (page: Page) =>
  page.evaluate(() => {
    const f = (window as any).__home.farm
    f.reset()
    for (const p of Object.values(f.state.producers) as any[]) p.stock.fill(0)
    f.state.producers.hens.stock[0] = 6
  })
const walk = (page: Page) =>
  page.evaluate(() => {
    const h = (window as any).__home
    return { ...h.walk.state(), stats: { ...h.walk.stats }, guide: h.useHome.getState().guide?.id ?? null }
  })
/** Waits until the walk is over (it says how it ended). */
const ended = (page: Page, timeout = 240_000) => page.waitForFunction(() => (window as any).__home.walk.state().ended !== null, null, { timeout, polling: 250 })
/** Waits until the body is more than `d` metres from `from` (on the ground). */
const movedFrom = (page: Page, from: { x: number; z: number }, d: number) =>
  page.waitForFunction(([a, d]) => Math.hypot((window as any).__home.playerState.position.x - a.x, (window as any).__home.playerState.position.z - a.z) > d, [from, d] as const, {
    timeout: 120_000,
    polling: 200,
  })
/** Whether the way (its turns, in order) crosses the line z = at ('x': a wall along x) or x = at ('z') between lo and hi. */
function crosses(pts: { x: number; z: number }[], axis: 'x' | 'z', at: number, lo: number, hi: number) {
  for (let k = 1; k < pts.length; k++) {
    const [a, b] = [pts[k - 1], pts[k]]
    const [ua, ub, va, vb] = axis === 'x' ? [a.z, b.z, a.x, b.x] : [a.x, b.x, a.z, b.z]
    if ((ua - at) * (ub - at) > 0 || ua === ub) continue
    const v = va + ((vb - va) * (at - ua)) / (ub - ua)
    if (v >= lo && v <= hi) return true
  }
  return false
}
/** Keeps, inside the page, every room the player is in from now until the next walk has started and ended. */
const watchRooms = (page: Page) =>
  page.evaluate(() => {
    const h = (window as any).__home
    h.__rooms = new Set()
    let started = false
    const f = () => {
      h.__rooms.add(h.useHome.getState().room ?? 'out')
      if (h.walk.state().id) started = true
      if (!started || h.walk.state().id) requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  })

test.describe('take me there', () => {
  test('from the living room, the eggs on the compass walk you out through the garden door to the nest; there the button offers them', async ({ game }) => {
    await game.ready()
    const { page } = game
    await onlyEggs(page)
    // indoors, the compass shows what is ready outside
    const mark = page.getByRole('button', { name: /^6 eggs ready/ })
    await expect(mark).toBeVisible()
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().room)).toBe('living')
    await watchRooms(page)
    await mark.click()
    // on the way: the mark ringed (and pressed), its arrow over the nest
    await expect(mark).toHaveClass(/going/)
    await expect(mark).toHaveAttribute('aria-pressed', 'true')
    expect((await walk(page)).guide).toBe('farm-nest')
    await ended(page)
    const w = await walk(page)
    expect(w.ended).toBe('arrived')
    // walked every step: as far as the way is long, never more in a frame than half a second's run (a frame of a slow
    // page is long) — nothing put the body there
    expect(w.stats.walked).toBeGreaterThan(w.stats.length * 0.9)
    expect(w.stats.longestStep).toBeLessThan(2.4)
    expect(w.stats.turns).toBeGreaterThanOrEqual(1)
    // out through the garden door: from the living room to the garden, through no other room
    expect(await page.evaluate(() => ([...(window as any).__home.__rooms] as string[]).sort((a, b) => a.localeCompare(b)))).toEqual(['living', 'out'])
    // the view turned towards where it went, never faster than about 80° a second; finding the way never held a frame
    expect(w.stats.fastestTurn).toBeLessThan(1.5)
    expect(w.stats.slowestFrameMs).toBeLessThan(30)
    // there: the button offers the eggs, and the view turns to the nest
    await page.waitForFunction(() => (window as any).__home.useHome.getState().nearby?.id === 'farm-nest', null, { timeout: 30_000, polling: 200 })
    await page.waitForFunction(() => (window as any).__home.useHome.getState().nearby?.side === 'ahead', null, { timeout: 30_000, polling: 200 })
    await expect(page.locator('.prompt')).toBeVisible()
    // in reach it leaves the compass, and its arrow goes
    await page.waitForFunction(() => !(window as any).__home.useHome.getState().compass.some((m: any) => m.item === 'egg') && !(window as any).__home.useHome.getState().guide, null, {
      timeout: 30_000,
      polling: 200,
    })
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('a key, the mark again or a panel takes over at once', async ({ game }) => {
    await game.ready()
    const { page } = game
    await onlyEggs(page)
    const mark = page.getByRole('button', { name: /^6 eggs ready/ })
    await expect(mark).toBeVisible()
    // a step of your own (W): it stops, the mark is no longer ringed, and the body comes to rest
    await mark.click()
    await movedFrom(page, SPAWN, 0.4)
    await page.keyboard.press('KeyW')
    await ended(page, 30_000)
    expect((await walk(page)).ended).toBe('key')
    await expect(mark).not.toHaveClass(/going/)
    await page.waitForFunction(() => (window as any).__home.playerState.speed < 0.1, null, { timeout: 30_000, polling: 200 })
    // the mark again: it stops, and the arrow over the nest goes
    const here = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
    await mark.click()
    await movedFrom(page, here, 0.4)
    await mark.click()
    await ended(page, 30_000)
    expect(await walk(page)).toMatchObject({ ended: 'again', guide: null })
    // a panel opening (the farm shop's, as from its door)
    const there = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
    await mark.click()
    await movedFrom(page, there, 0.4)
    await page.evaluate(() => (window as any).__home.useHome.getState().openPanel({ kind: 'shop' }))
    await ended(page, 30_000)
    expect((await walk(page)).ended).toBe('busy')
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    // nothing walks by itself after: the body stays where it stopped
    await page.waitForFunction(() => (window as any).__home.playerState.speed < 0.1, null, { timeout: 30_000, polling: 200 })
    const rest = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
    await page.waitForTimeout(1500)
    const after = await page.evaluate(() => ({ ...(window as any).__home.playerState.position }))
    expect(Math.hypot(after.x - rest.x, after.z - rest.z)).toBeLessThan(0.1)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('held up by something that moves, it plans again round it once; held up again, it stops', async ({ game }) => {
    await game.ready()
    const { page } = game
    await onlyEggs(page)
    // something that moves (a kinematic body, as the animals are) across the lawn, on the way from the garden door to
    // the nest: the way is found without it, so the walk runs into it
    await page.evaluate(() => {
      const { world, rapier } = (window as any).__home.physics
      const body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(3.5, 0.9, 6.6))
      world.createCollider(rapier.ColliderDesc.cuboid(0.25, 0.9, 0.9), body)
      ;(window as any).__home.__blockers = [body]
    })
    await page.getByRole('button', { name: /^6 eggs ready/ }).click()
    // held up, it plans again round what stands there now, and walks on; then things that move close in all round it
    // (put there in the same call that sees it walking again)
    await page.evaluate(
      () =>
        new Promise<void>((done) => {
          const h = (window as any).__home
          const f = () => {
            const v = h.ecctrl()?.body?.linvel()
            if (h.walk.stats.replans === 1 && v && Math.hypot(v.x, v.z) > 1) {
              const p = h.playerState.position
              const { world, rapier } = h.physics
              for (const [dx, dz, hx, hz] of [
                [0.9, 0, 0.1, 1],
                [-0.9, 0, 0.1, 1],
                [0, 0.9, 1, 0.1],
                [0, -0.9, 1, 0.1],
              ]) {
                const body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x + dx, 0.9, p.z + dz))
                world.createCollider(rapier.ColliderDesc.cuboid(hx, 0.9, hz), body)
                h.__blockers.push(body)
              }
              done()
            } else if (h.walk.state().id) requestAnimationFrame(f)
            else done()
          }
          requestAnimationFrame(f)
        }),
    )
    await ended(page)
    const w = await walk(page)
    await page.evaluate(() => {
      const h = (window as any).__home
      for (const b of h.__blockers) h.physics.world.removeRigidBody(b)
      delete h.__blockers
    })
    expect(w.stats.replans).toBe(1)
    expect(w.ended).toBe('blocked')
    // and it stays where it stopped: the arrow over the nest stays a while, for you to go on yourself
    expect(w.guide).toBe('farm-nest')
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('the kitchen door shut is a wall: from the kitchen the way goes round through the studio; open, through the bedroom', async ({ game }) => {
    await game.ready()
    const { page } = game
    await onlyEggs(page)
    await game.teleport(3.5, 1.4, -3, Math.PI)
    const plan = (open: boolean) =>
      page.evaluate((open) => {
        const h = (window as any).__home
        h.useHome.setState({ doors: { ...h.useHome.getState().doors, 'door-kitchen-bedroom': open } })
        return h.walk.plan('farm-nest', { x: 3.5, z: -3 })
      }, open)
    const open = await plan(true)
    expect(open.found).toBe(true)
    // the door open: through its doorway (the wall z = 0, x 2.7–4.3) and on through the living room
    expect(crosses(open.pts, 'x', 0, 2.7, 4.3)).toBe(true)
    const shut = await plan(false)
    expect(shut.found).toBe(true)
    // shut: never through the wall between the kitchen and the bedroom, but into the studio (the wall x = 0, z −3.8 to
    // −2.2) and from there into the living room (the wall z = 0, x −4.3 to −2.7)
    expect(crosses(shut.pts, 'x', 0, 0, 7)).toBe(false)
    expect(crosses(shut.pts, 'z', 0, -3.8, -2.2)).toBe(true)
    expect(crosses(shut.pts, 'x', 0, -4.3, -2.7)).toBe(true)
    // and walked that way, the long way round, to the nest
    const mark = page.getByRole('button', { name: /^6 eggs ready/ })
    await expect(mark).toBeVisible()
    await watchRooms(page)
    await mark.click()
    await ended(page)
    expect((await walk(page)).ended).toBe('arrived')
    expect(await page.evaluate(() => ([...(window as any).__home.__rooms] as string[]).sort((a, b) => a.localeCompare(b)))).toEqual(['kitchen', 'living', 'office', 'out'])
    await page.waitForFunction(() => (window as any).__home.useHome.getState().nearby?.id === 'farm-nest', null, { timeout: 30_000, polling: 200 })
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })
})

// A phone in portrait: its own page with touch emulation (coarse pointer).
test.describe('take me there on a phone', { tag: ['@boot', '@full'] }, () => {
  test('a mark tapped walks you, the walk-on button shows it, the stick takes over; tapped again it gets you there', async ({ browser }) => {
    // a phone boot under software rendering (CI) takes four to five minutes on its own
    test.setTimeout(900_000)
    const context = await browser.newContext({ viewport: { width: 390, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, baseURL: BASE })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    await bootApp(page)
    await onlyEggs(page)
    await page.evaluate(() => {
      const h = (window as any).__home
      h.teleport(-3.5, 1.4, 1.3)
      h.look.yaw = Math.PI
      h.look.pitch = 0
    })
    const mark = page.getByRole('button', { name: /^6 eggs ready/ })
    await expect(mark).toBeVisible()
    // the compass at the top keeps clear of the touch controls
    const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    const compass = (await page.locator('.compass').boundingBox())!
    for (const el of ['.stick-zone', '.stick-tool', '#ecctrl-virtual-button']) {
      for (const box of await page.locator(el).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number })))
        expect(overlaps(compass, box), `the compass clear of ${el}`).toBe(false)
    }
    // tapped: it walks, and the walk-on button over the stick shows it
    const walkOn = page.locator('.stick-tool').nth(1)
    await expect(walkOn).toHaveAttribute('aria-pressed', 'false')
    await mark.tap()
    await expect(walkOn).toHaveAttribute('aria-pressed', 'true')
    await expect(mark).toHaveClass(/going/)
    await movedFrom(page, SPAWN, 0.4)
    // the thumb on the stick takes over
    const cdp = await context.newCDPSession(page)
    const zone = (await page.locator('.stick-zone').boundingBox())!
    const thumb = { x: zone.x + zone.width * 0.5, y: zone.y + zone.height * 0.62, id: 1 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumb] } as any)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] } as any)
    await ended(page, 30_000)
    expect((await walk(page)).ended).toBe('stick')
    await expect(walkOn).toHaveAttribute('aria-pressed', 'false')
    await expect(mark).not.toHaveClass(/going/)
    // tapped again: all the way, and the round button offers the eggs
    await mark.tap()
    await ended(page, 600_000)
    expect((await walk(page)).ended).toBe('arrived')
    await expect(page.locator('.act-btn.main')).toHaveAttribute('data-verb', 'pick', { timeout: 60_000 })
    await expect(walkOn).toHaveAttribute('aria-pressed', 'false')
    expect(errors, errors.join('\n')).toEqual([])
    await context.close()
  })
})
