/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, emptyFarm, walkInPoses, yawTo } from './helpers'
import { AISLE, DOORS_OPEN, MARKET, SHELVES, castersAt, compareAt, setUp, thirdAt } from './16-view'
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

  test('afterwards: the house as it was, no console errors', async ({ game }) => {
    await game.ready()
    await emptyFarm(game.page)
    expect(game.errors).toEqual([])
  })
})
