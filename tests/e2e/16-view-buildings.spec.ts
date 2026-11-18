/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, emptyFarm, walkInPoses } from './helpers'
import { AISLE, DOORS_OPEN, MARKET, SHELVES, castersAt, compareAt, setUp, thirdAt } from './16-view'
import { WALK_INS } from '../../src/data/buildings'

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

  test('afterwards: the house as it was, no console errors', async ({ game }) => {
    await game.ready()
    await emptyFarm(game.page)
    expect(game.errors).toEqual([])
  })
})
