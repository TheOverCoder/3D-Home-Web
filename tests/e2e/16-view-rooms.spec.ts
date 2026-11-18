/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, type Pose, emptyFarm, onMap, openingViews, openingsNow, yawTo } from './helpers'
import { EYE, GARDEN_POSES, P, ROOMS, SHELVES, YARD, behindShell, check, compareAt, off, report, setUp, standAt } from './16-view'

// 16, the drawing pass (16-view.ts says how), in the house on its own map, room by room: every room; each window from
// its room; the garden door both ways and the house's garden; things carried; the aim marker through a wall; the sun's
// map kept while you move; third person and decorating; the wardrobe; and a phone held upright, the farm too.
test.describe('the drawing pass leaves out only what cannot be seen: the house, room by room', () => {
  test('640×360: every room, its corners and walls, the sun', async ({ game }) => {
    await setUp(game)
    const log: string[] = []
    for (const p of ROOMS) await compareAt(game, p, log)
    console.log(log.join('\n'))
  })

  test('640×360: each window from its room', async ({ game }) => {
    await setUp(game)
    const log: string[] = []
    for (const p of openingViews(await openingsNow(game.page)).filter((v) => v.kind === 'window')) await compareAt(game, p, log)
    console.log(log.join('\n'))
  })

  test('640×360: the garden door both ways, the house’s garden and the countryside past it', async ({ game }) => {
    await setUp(game)
    const log: string[] = []
    for (const p of [...openingViews(await openingsNow(game.page)).filter((v) => v.kind === 'garden'), ...GARDEN_POSES]) await compareAt(game, p, log)
    console.log(log.join('\n'))
  })

  test('640×360: things carried from room to room, and things left there', async ({ game }) => {
    await setUp(game)
    const { page } = game
    const log: string[] = []
    // the mug, picked up in the kitchen and carried into the bedroom: in your hand, looking down at it
    await page.evaluate(() => (window as any).__home.useHome.getState().pickUp('item-mug'))
    await compareAt(game, { name: 'carrying the mug in the bedroom', x: 3.5, z: 3, yaw: P, pitch: -0.9, shadow: true }, log)
    // put down in the bedroom, seen from the living room through the doorway
    await page.evaluate(() => (window as any).__home.useHome.getState().drop([2.5, 0.3, 3.4]))
    await compareAt(game, { name: 'the mug left in the bedroom, from the living room', x: -1.2, z: 3, yaw: -P / 2 }, log)
    console.log(log.join('\n'))
  })

  // The aim marker (src/scene/AimMarker.tsx) on what the button would act on is drawn over everything, walls included.
  // Left on the kitchen's door as you stand in the studio — the frame after you leave its doorway, before it fades (on a
  // slow page the frames compared can come then) — it shows through the wall between the two rooms, where the kitchen
  // is not seen: the pass must draw it all the same.
  test('640×360: the aim marker, drawn over everything, on the kitchen’s door through the studio’s wall', async ({ game }) => {
    await setUp(game)
    const { page } = game
    const log: string[] = []
    const openings = await openingsNow(page)
    const views = openingViews(openings)
    const hinged = openings.find((o: any) => o.hinged)
    const view = (tail: string) => views.find((v) => v.name === `doorway ${hinged.sides.join(' ↔ ')}${tail}`)!
    // in the kitchen's doorway, its door open: the button offers the door, and the marker is on it
    await standAt(game, view(`, the door open, from the ${hinged.sides[1]}`))
    await standAt(game, view(', standing in it'))
    await page.waitForFunction(
      () => {
        const h = (window as any).__home
        h.__aimed = h.useHome.getState().actions.find((a: any) => a.id === 'door-kitchen-bedroom') ?? null
        return h.__aimed !== null
      },
      null,
      { timeout: 30_000, polling: 250 },
    )
    const pose: Pose = { name: 'the aim marker on the kitchen’s door, through the studio’s wall', x: -1.5, z: -1, yaw: -P / 2 }
    try {
      await standAt(game, pose)
      // the marker kept on the door (nothing in reach here takes the button), shown in full
      await page.evaluate(() => {
        const h = (window as any).__home
        h.useHome.setState({ nearby: h.__aimed })
      })
      await page.waitForFunction(
        () => {
          const g = (window as any).__home.scene.getObjectByName('aim-marker')
          return g.visible && g.children.every((m: any) => m.material.opacity > 0.19)
        },
        null,
        { timeout: 30_000, polling: 250 },
      )
      // the camera looking at it, across the wall between the studio and the kitchen
      const [mx, my, mz] = await page.evaluate(() => (window as any).__home.scene.getObjectByName('aim-marker').position.toArray())
      const yaw = yawTo(pose.x, pose.z, mx, mz)
      const pitch = Math.atan2(my - EYE, Math.hypot(mx - pose.x, mz - pose.z))
      const r = await page.evaluate((p) => (window as any).__viewProbe.camera(p), [pose.x, EYE, pose.z, yaw, pitch])
      if (r.differ && r.culprits?.length) r.rays = await page.evaluate(behindShell)
      report(log, pose.name, r)
      console.log(log.join('\n'))
      expect(r.stats.portals, `${pose.name}: the rooms and portals are used`).toBe(true)
      expect(await page.evaluate(() => (window as any).__home.scene.getObjectByName('aim-marker').visible), `${pose.name}: the marker is drawn`).toBe(true)
      check(pose.name, r)
    } finally {
      // the button back to what is on offer here
      await page.evaluate(() => {
        const h = (window as any).__home
        h.useHome.setState({ nearby: h.useHome.getState().actions[0] ?? null })
      })
    }
  })

  // The sun's map is drawn again only when something in it changed (Lighting.tsx): your body walking, turning or jumping
  // indoors where no window lets sunlight in is left out of it, so the map is kept. After each thing that happens, the
  // map as the game left it must be a full redraw's, texel for texel (every caster, and the pass on), and so must the
  // frame drawn with it; and the check must see a stale map (your body moved outdoors, the map left as it was).
  test("the sun's map, kept while you move where no sunlight reaches, is always a full redraw's", { tag: '@full' }, async ({ game }) => {
    // a dozen places and things that happen, each compared three ways: longer than one room's poses
    test.setTimeout(600_000)
    await setUp(game)
    const { page } = game
    const log: string[] = []
    let last = { drawn: 0, kept: 0 }
    const check = async (name: string) => {
      const r = await page.evaluate(() => (window as any).__viewProbe.kept())
      log.push(
        `${name}: map drawn again on ${r.drawn - last.drawn} frames, kept on ${r.kept - last.kept}; ${r.differ} bytes differ from a full redraw (${r.differAll} with every caster), ${r.pixels} pixels (${r.pixelsAll})`,
      )
      expect(r.differ, `${name}: the map is a full redraw's`).toBe(0)
      expect(r.differAll, `${name}: the map is every caster's`).toBe(0)
      expect(r.pixels, `${name}: the frame drawn with it`).toBe(0)
      expect(r.pixelsAll, `${name}: the frame drawn with every caster's map`).toBe(0)
      const since = { drawn: r.drawn - last.drawn, kept: r.kept - last.kept }
      last = r
      return since
    }
    const at = async (x: number, z: number, yaw: number) => {
      await game.teleport(x, 1.4, z, yaw, 0)
      await page.waitForTimeout(2500)
    }
    const turn = async (by: number) => {
      await page.evaluate((by) => ((window as any).__home.look.yaw += by), by)
      await page.waitForTimeout(1500)
    }
    // turning in the living room: the body moves every frame, the map stays
    await at(-3.5, 1.3, P)
    await check('living room')
    let kept = 0
    for (let i = 0; i < 3; i++) {
      await turn(0.5)
      kept += (await check(`living room, turned ${i + 1}`)).kept
    }
    expect(kept, 'turning indoors keeps the map').toBeGreaterThan(0)
    // walking, then a jump, indoors
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1000)
    await check('walking in the living room')
    await page.keyboard.up('KeyW')
    await page.keyboard.down('Space')
    await page.waitForTimeout(200)
    await page.keyboard.up('Space')
    await check('jumping, in the air')
    await page.waitForTimeout(2000)
    await check('landed')
    // into the sunlight from the kitchen's east window, and turning there; the kitchen's door opened and shut
    await at(3.5, -3, P)
    await check('kitchen')
    await at(5.3, -4.0, -P / 2)
    await check("kitchen, in the east window's sunlight")
    await turn(0.6)
    await check('kitchen, in the sunlight, turned')
    for (const time of ['once', 'twice']) {
      await page.evaluate(() => (window as any).__home.useHome.getState().toggleDoor('door-kitchen-bedroom'))
      await page.waitForTimeout(4000)
      await check(`the kitchen's door moved ${time}`)
    }
    // carrying the mug, then out through the garden door (it opens as you come) into the garden, and turning there
    await page.evaluate(() => (window as any).__home.useHome.getState().pickUp('item-mug'))
    await at(-1.2, 4.6, P)
    await check('carrying the mug, at the garden door')
    await at(-1.2, 8.5, 0)
    await check('the garden')
    await turn(0.6)
    await check('the garden, turned')
    await page.evaluate(() => (window as any).__home.useHome.getState().drop([-1.0, 0.3, 9.0]))
    await page.waitForTimeout(2000)
    await check('the mug dropped in the garden')
    expect(await page.evaluate(() => (window as any).__viewProbe.bodyMoved(0.3)), 'a stale map is seen: the body moved outdoors').toBeGreaterThan(0)
    // third person and back
    await at(-3.5, 1.3, P)
    await page.evaluate(() => (window as any).__home.useHome.getState().setView('third'))
    await page.waitForTimeout(3000)
    await check('third person')
    await turn(0.5)
    await check('third person, turned')
    await page.evaluate(() => (window as any).__home.useHome.getState().setView('first'))
    await page.waitForFunction(() => (window as any).__home.view.stats.portals === true, null, { timeout: 30_000, polling: 250 })
    await page.waitForTimeout(1500)
    await check('first person again')
    expect(await page.evaluate(() => (window as any).__viewProbe.bodyMoved(0.3)), 'indoors, the moved body changes nothing in the map (with every caster)').toBe(0)
    console.log(log.join('\n'))
  })

  test('third person and decorating in the house: the rooms and the sun are not used, the walls are', async ({ game }) => {
    await setUp(game)
    const log: string[] = []
    await off(game, log, 'third person, the living room', 'third', -3.5, 2.5)
    await off(game, log, 'third person, the office', 'third', -3.5, -2)
    await off(game, log, 'third person, the kitchen', 'third', 3.5, -3)
    await off(game, log, 'third person, the bedroom', 'third', 3.5, 1)
    await off(game, log, 'third person, the garden', 'third', -6, 9)
    await off(game, log, 'decorating the living room', 'decorate', -3.5, 2.5)
    console.log(log.join('\n'))
  })

  test('640×360: the wardrobe open — you filmed from in front of you, your head and hat drawn (src/home/Wardrobe.tsx)', async ({ game }) => {
    await setUp(game)
    const { page } = game
    const log: string[] = []
    // before the bedroom's wardrobe, a hat on, the wardrobe opened as its button opens it
    await game.teleport(5.8, 1.4, 1.75, 0, -0.1)
    await page.evaluate(() => {
      const h = (window as any).__home
      h.farm.wearGarment('straw-brown')
      h.interactables()
        .find((d: any) => d.id.startsWith('wardrobe-'))
        .run()
    })
    try {
      await page.waitForFunction(() => (window as any).__home.dressView.settled === true, null, { timeout: 30_000, polling: 250 })
      await page.waitForTimeout(600)
      const name = 'the wardrobe, you filmed'
      const r = await page.evaluate(() => (window as any).__viewProbe.camera(null))
      if (r.differ && r.culprits?.length) r.rays = await page.evaluate(behindShell)
      report(log, name, r)
      if (r.differ) console.log(log[log.length - 1])
      check(name, r)
      const s = await page.evaluate(() => (window as any).__viewProbe.shadow())
      log.push(`  sun's shadow map: ${s.after.calls} draws, ${s.culled} casters left out, ${s.differ} bytes differ`)
      expect(s.differ).toBe(0)
    } finally {
      await page.evaluate(() => {
        const h = (window as any).__home
        h.useHome.getState().closePanel()
        h.farm.wearGarment('straw-brown')
      })
      await page.waitForFunction(() => (window as any).__home.dressView.blend === 0, null, { timeout: 30_000, polling: 250 })
    }
    console.log(log.join('\n'))
  })

  test('a phone held upright (390×844): rooms, the door, the garden door, the garden; the farm, the gate and the market', { tag: '@full' }, async ({ game }) => {
    await setUp(game)
    const { page } = game
    const log: string[] = []
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await page.waitForFunction(() => (window as any).__home.gl.domElement.height > (window as any).__home.gl.domElement.width, null, { timeout: 30_000 })
      await page.waitForTimeout(1500)
      const made = openingViews(await openingsNow(page))
      const door = made.filter((v) => v.door !== undefined && v.shadow)
      const garden = made.filter((v) => v.kind === 'garden')
      const house = [ROOMS[0], ROOMS[2], ROOMS[4], ROOMS[6], ...door, garden[0], garden[2], GARDEN_POSES[0]]
      for (const p of house) await compareAt(game, { ...p, name: `phone: ${p.name}`, shadow: p === ROOMS[0] }, log)
      // and on the farm
      await onMap(page, 'farm')
      for (const p of [YARD[0], YARD[1], YARD[4], SHELVES]) await compareAt(game, { ...p, name: `phone: ${p.name}`, shadow: false }, log)
    } finally {
      await page.setViewportSize({ width: 640, height: 360 })
      await page.waitForTimeout(1500)
    }
    console.log(log.join('\n'))
  })

  test('afterwards: the house as it was, no console errors', async ({ game }) => {
    await game.ready()
    await emptyFarm(game.page)
    expect(game.errors).toEqual([])
  })
})
