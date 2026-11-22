// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { BEDS, cropById } from './data'
import { setMood } from './mood'
import { priceOf } from './prices'
import { capacity, farm, harvestFits, ledgerNow, makeRoom, makeRoomPreview, plant, resetFarm, room, spawnVisitor, waitingFor } from './state'

// Make room (src/farm/state/stores.ts; update-v1/JOURNEY.md fix 5): one press sells, at fair price, the surplus of a
// full silo or barn that no buyer in line and no order wants, just as much as lets what waits go in.

/** The first bed built from the start, its crop ripe. */
function ripeBed(crop: 'lettuce' | 'cotton') {
  const i = farm.beds.findIndex((b, k) => b.built && !BEDS[k].expansion)
  farm.coins += 100
  plant(i, crop)
  farm.beds[i].growth = cropById(crop).growSeconds
  return i
}

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  farm.visitors.length = 0
  farm.orders = farm.orders.map(() => ({ wait: 600 }))
})

describe('make room', () => {
  it('does nothing while what waits fits', () => {
    ripeBed('lettuce')
    expect(harvestFits(0) || room('silo') >= waitingFor('silo')).toBe(true)
    expect(makeRoomPreview('silo').goods).toEqual([])
    expect(makeRoom('silo')).toBe(0)
  })

  it('a full silo and a ripe bed: sells just the shortfall of the biggest surplus, at its fair price, and the harvest fits', () => {
    const i = ripeBed('cotton')
    farm.inv.wheat = capacity('silo') - 10
    farm.inv.carrot = 10
    expect(harvestFits(i)).toBe(false)
    const need = waitingFor('silo') - room('silo')
    const coins = farm.coins
    const earned = farm.stats.earned
    const xp = farm.xp.points
    const preview = makeRoomPreview('silo')
    expect(preview.goods).toEqual([{ item: 'wheat', count: need, coins: need * priceOf('wheat') }])
    expect(makeRoom('silo')).toBe(need * priceOf('wheat'))
    expect(farm.inv.wheat).toBe(capacity('silo') - 10 - need)
    expect(farm.inv.carrot).toBe(10)
    expect(farm.coins - coins).toBeGreaterThanOrEqual(need * priceOf('wheat'))
    expect(farm.stats.earned - earned).toBe(need * priceOf('wheat'))
    expect(farm.xp.points).toBeGreaterThan(xp)
    expect(harvestFits(i)).toBe(true)
    // room for all of what waits: the cotton, and the lemons on the tree
    expect(room('silo')).toBe(waitingFor('silo'))
    // a sale like any: in the sales book
    expect(JSON.stringify(ledgerNow())).toContain('wheat')
  })

  it("pays whole coins when a price carries a fraction (the day's mood), in the coins, the stats and the toast", () => {
    setMood(true)
    try {
      ripeBed('cotton')
      farm.inv.wheat = capacity('silo') - 10
      farm.inv.carrot = 10
      const coins = farm.coins
      const earned = farm.stats.earned
      const preview = makeRoomPreview('silo')
      expect(Number.isInteger(preview.coins)).toBe(true)
      for (const g of preview.goods) expect(Number.isInteger(g.coins)).toBe(true)
      const got = makeRoom('silo')
      expect(got).toBe(preview.coins)
      expect(farm.coins - coins).toBeGreaterThanOrEqual(got)
      expect(Number.isInteger(farm.coins)).toBe(true)
      expect(farm.stats.earned - earned).toBe(got)
      expect(Number.isInteger(farm.xp.points)).toBe(true)
    } finally {
      setMood(false)
    }
  })

  it('never sells what a buyer in line or an order still wants', () => {
    ripeBed('cotton')
    farm.inv.wheat = capacity('silo') - 3
    farm.inv.carrot = 3
    spawnVisitor({ want: 'wheat', qty: capacity('silo') - 4, offer: 99, queued: true })
    farm.orders[0] = { order: { id: 1, lines: [{ good: 'carrot', want: 3, have: 0 }], coins: 9, surprise: false } }
    // one spare sheaf of wheat is all that nobody wants: it goes, and nothing more
    expect(makeRoomPreview('silo').goods).toEqual([{ item: 'wheat', count: 1, coins: priceOf('wheat') }])
    makeRoom('silo')
    expect(farm.inv.wheat).toBe(capacity('silo') - 4)
    expect(farm.inv.carrot).toBe(3)
  })
})
