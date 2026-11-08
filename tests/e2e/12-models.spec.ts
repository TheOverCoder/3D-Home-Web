/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, watchErrors } from './helpers'

// The sculpted models (src/models): the gallery page shows every one of them, and in the game the herd, the
// flock, the hens, the queue and the garden are drawn with them — each a handful of instanced draws.

test.describe('sculpted models', () => {
  test('the model gallery shows every model', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 640, height: 360 }, baseURL: 'http://localhost:4185' })
    const page = await context.newPage()
    const errors: string[] = []
    watchErrors(page, errors)
    await page.goto('/?gallery&t=1')
    await page.waitForFunction(() => (window as any).__gallery?.ready, null, { timeout: 120_000, polling: 250 })
    // every entry draws something once the first frames have posed it
    await page.waitForFunction(() => (window as any).__gallery.entries.every((e: any) => e.triangles > 1000), null, { timeout: 60_000, polling: 250 })
    const entries = await page.evaluate(() => (window as any).__gallery.entries.map((e: any) => e.id))
    expect(entries).toEqual(['cow', 'sheep', 'chickens', 'people', 'crops'])
    // and the list names each with its triangle count
    await page.waitForTimeout(1500)
    const labels = await page.locator('button').allTextContents()
    expect(labels).toHaveLength(5)
    for (const l of labels) expect(Number(l.match(/([\d,]+) triangles/)?.[1].replace(/,/g, '') ?? 0), l).toBeGreaterThan(1000)
    expect(errors).toEqual([])
    await context.close()
  })

  test('the farm is drawn with the sculpted animals, people and crops', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.evaluate(() => {
      const f = (window as any).__home.farm
      f.reset()
      f.state.coins = 5000
      f.state.started = true
      f.buy('cow')
      f.buy('sheep')
      f.buy('hen')
      f.state.beds.forEach((b: any) => (b.built = true))
      ;['lettuce', 'carrot', 'strawberry', 'tomato', 'corn', 'pumpkin'].forEach((crop, i) => {
        if (f.plant(i, crop)) f.state.beds[i].growth = 1e6 // ripe
      })
      f.state.lemons = 3
      f.state.eggs = 2
      for (let i = 0; i < 3; i++) f.spawnVisitor({ queued: true })
    })
    // look at the garden from the path, so every group has been drawn
    await game.teleport(3.0, 1.4, 7.6, Math.PI, -0.1)
    await page.waitForTimeout(2000)
    const drawn = await page.evaluate(() => {
      const h = (window as any).__home
      const out: Record<string, Record<string, number>> = {}
      for (const name of ['cows', 'sheep', 'chickens', 'people', 'crops']) {
        const g = h.scene.getObjectByName(name)
        if (!g) continue
        out[name] = {}
        for (const m of g.children) if (m.isInstancedMesh && m.count > 0) out[name][m.name.replace(`${name}-`, '')] = m.count
      }
      return out
    })
    // two cows (one in each of two coats), three sheep, three hens and the rooster
    expect(drawn.cows?.body0).toBe(1)
    expect(drawn.cows?.body1).toBe(1)
    expect((drawn.cows?.front0 ?? 0) + (drawn.cows?.front1 ?? 0)).toBe(4)
    expect(drawn.sheep?.fleece).toBe(3)
    expect(drawn.sheep?.hind).toBe(6)
    expect(drawn.chickens?.henBody).toBe(3)
    expect(drawn.chickens?.roosterBody).toBe(1)
    // three buyers, each in one of the hair styles
    expect(drawn.people?.torso).toBe(3)
    expect(drawn.people?.head).toBe(3)
    expect((drawn.people?.hairShort ?? 0) + (drawn.people?.hairLong ?? 0) + (drawn.people?.hairBun ?? 0)).toBe(3)
    // ripe crops: tomatoes on the vine, strawberries, pumpkins, carrots' fronds; lemons and eggs
    for (const part of ['lettuceLeaf', 'lettuceHeart', 'frond', 'carrotTop', 'trefoil', 'strawberry', 'tomatoLeaf', 'tomato', 'stalk', 'grassBlade', 'cob', 'pumpkinLeaf', 'pumpkin', 'lemon', 'egg']) {
      expect(drawn.crops?.[part] ?? 0, `crops: ${part}`).toBeGreaterThan(0)
    }
    expect(game.errors).toEqual([])
  })
})
