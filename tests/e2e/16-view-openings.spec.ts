/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, changeHouse, emptyFarm, openingViews, openingsNow, restoreHouse } from './helpers'
import { ROOMS, compareAt, setUp } from './16-view'

// 16, the drawing pass (16-view.ts says how), through the house's doorways: each from both sides and standing in it, the
// kitchen's door shut and open (made from the openings as the save has them); and the house changed every way
// decorating can, its rooms and each opening where it is now.
test.describe('the drawing pass leaves out only what cannot be seen: the house, through its doorways', () => {
  test('640×360: each doorway from both sides and standing in it, the kitchen’s door shut and open (from the house’s openings)', async ({ game }) => {
    await setUp(game)
    const log: string[] = []
    for (const p of openingViews(await openingsNow(game.page)).filter((v) => v.kind === 'doorway')) await compareAt(game, p, log)
    console.log(log.join('\n'))
  })

  // The house changed every way decorating can (changeHouse in helpers.ts: windows and the garden door moved, one round
  // its room's corner, a doorway closed, the kitchen's door moved with its doorway, every room painted and floored): its
  // rooms, and its doorways, windows and garden door where they are now, made from its openings.
  test('640×360: a changed house — its rooms, and each doorway, window and the garden door where they are now', async ({ game }) => {
    test.setTimeout(900_000)
    await setUp(game)
    const log: string[] = []
    expect(await changeHouse(game.page), 'every change fits').toEqual([])
    try {
      // the walls built and merged again, the rooms' portals where the openings are now
      await game.page.waitForTimeout(3000)
      const views = [...ROOMS.slice(0, 8), ...openingViews(await openingsNow(game.page))]
      for (const p of views) await compareAt(game, { ...p, name: `changed: ${p.name}` }, log)
    } finally {
      await restoreHouse(game.page)
    }
    console.log(log.join('\n'))
  })

  test('afterwards: the house as it was, no console errors', async ({ game }) => {
    await game.ready()
    await emptyFarm(game.page)
    expect(game.errors).toEqual([])
  })
})
