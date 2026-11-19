/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, emptyFarm, walkInPoses, yawTo } from './helpers'
import { AISLE, DOORS_OPEN, EYE, MARKET, SHELVES, castersAt, compareAt, setUp, standAt, thirdAt } from './16-view'
import { WALK_INS } from '../../src/data/buildings'
import { ESTATE_MAP, HOUSE_MODEL, SALE_BOARD } from '../../src/data/estate'

// 16, the drawing pass (16-view.ts says how), at the farm's walk-in buildings: each posed from its own row (WALK_INS),
// and the supermarket's own poses, its interior's shadows proven never seen.
test.describe('the drawing pass leaves out only what cannot be seen: the walk-in buildings', () => {
  test('640×360: every walk-in building — outside facing its door, in its doorways, each room; third person outside and in', async ({ game }) => {
    await setUp(game, 'farm')
    const log: string[] = []
    for (const w of WALK_INS) {
      const poses = walkInPoses(w)
      for (const p of poses.first) await compareAt(game, p, log)
      await thirdAt(game, poses.outside, log, { walls: true })
      await thirdAt(game, poses.inside, log, { room: poses.inside.room })
    }
    console.log(log.join('\n'))
  })

  test("640×360: the supermarket — the gate open from the lane, its shelves, its south aisle; its interior's shadows are never seen", async ({ game }) => {
    await setUp(game, 'farm')
    const { page } = game
    const log: string[] = []
    for (const p of MARKET) await compareAt(game, p, log)
    // its fittings and goods cast no shadow: proven unseen, inside, through its open doors and from outside them shut
    expect(await page.evaluate(() => typeof (window as any).__home.market?.casters), '__home.market.casters').toBe('function')
    const market = walkInPoses(WALK_INS.find((w) => w.id === 'market')!)
    for (const p of [SHELVES, AISLE, DOORS_OPEN, ...market.first]) await castersAt(game, p, log)
    console.log(log.join('\n'))
  })

  test("640×360: the estate office — the farm's map on its wall, the house's model on its table", async ({ game }) => {
    await setUp(game, 'farm')
    const log: string[] = []
    // before the map, the model behind you to the left; from the board across the model to the map, and the sun's map
    const map = { x: ESTATE_MAP.x + 1.1, z: ESTATE_MAP.z - 0.9 }
    const board = { x: SALE_BOARD.x - 0.9, z: SALE_BOARD.z }
    for (const p of [
      { name: "estate: the farm's map", x: map.x, z: map.z, yaw: yawTo(map.x, map.z, ESTATE_MAP.x, ESTATE_MAP.z), pitch: -0.05 },
      { name: "estate: across the house's model to the map", x: board.x, z: board.z, yaw: yawTo(board.x, board.z, HOUSE_MODEL.x, HOUSE_MODEL.z), pitch: -0.3, shadow: true },
    ])
      await compareAt(game, p, log)
    console.log(log.join('\n'))
  })

  // The lot's shells cast into the sun's map through one mesh (castAsOne, src/scene/WalkIn.tsx's LotShells): the frame
  // and the sun's map drawn with it and with each shell casting on its own again (`__home.lotShells.asOne`, through the
  // probe's land comparison), every pixel and texel, the sun's copies off (each drawn whole both ways); one draw fewer.
  test("640×360: the lot's shells cast through one sun mesh, the frame and the sun's map as each on its own", async ({ game }) => {
    await setUp(game, 'farm')
    const { page } = game
    const log: string[] = []
    for (const w of WALK_INS) {
      const p = walkInPoses(w).outside
      await standAt(game, p)
      const r = await page.evaluate(
        (pose) => {
          const h = (window as any).__home
          const whole = h.land.whole
          const copies = h.view.sunLod
          h.view.sunLod = false
          // the probe's land comparison, its switch turned to the lot's shells: "whole" each casting on its own
          h.land.whole = (separate: boolean) => h.lotShells.asOne(!separate)
          try {
            return { ...(window as any).__viewProbe.land(pose), one: !!h.lotShells.one() }
          } finally {
            h.land.whole = whole
            h.lotShells.asOne(true)
            h.view.sunLod = copies
          }
        },
        [p.x, EYE, p.z, p.yaw, p.pitch ?? 0],
      )
      log.push(
        `${p.name}, the lot's shells on their own → through one mesh (${r.size.join('×')}): ${r.whole.calls} draws / ${r.whole.triangles} triangles → ${r.pieces.calls} / ${r.pieces.triangles}; ${r.differ} pixels and ${r.texels} map texels differ`,
      )
      expect(r.one, 'through one mesh again afterwards').toBe(true)
      // (every walk-in's shell is inside the sun's box, so each casts: one draw for them all where each had its own)
      expect(r.pieces.calls, `${p.name}: one sun draw for the ${WALK_INS.length} shells`).toBe(r.whole.calls - (WALK_INS.length - 1))
      expect(r.differ, `${p.name}: the frame the same`).toBe(0)
      expect(r.texels, `${p.name}: the sun's map the same`).toBe(0)
    }
    console.log(log.join('\n'))
  })

  test('afterwards: the house as it was, no console errors', async ({ game }) => {
    await game.ready()
    await emptyFarm(game.page)
    expect(game.errors).toEqual([])
  })
})
