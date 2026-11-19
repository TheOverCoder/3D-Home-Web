// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHARM, charmCounts, charmPoints, charmView, RANKS, rankOf, type CharmInput } from './charm'
import type { ShopKind } from './decor'
import type { DecorPiece } from './layout'
import { farm, quietCharm, resetFarm, savedCharm, tellCharm } from './state'

// The farm's charm (src/farm/charm.ts; mission 02 c10): words and stars, scored on variety and care, never on a count
// alone; a rank first reached told once.

let id = 1
const piece = (kind: ShopKind, x = 0, z = 0, look?: string): DecorPiece => ({ id: id++, kind, x, z, rot: 0, ...(look ? { look } : {}) })
const farmOf = (decor: DecorPiece[], roomsPainted: number | null = null): CharmInput => ({ decor, roomsPainted })

describe('the charm, scored', () => {
  it('fifty fences score as one kind: 5', () => {
    const fences = Array.from({ length: 50 }, (_, k) => piece('fence', k * 2, 0))
    expect(charmPoints(farmOf(fences))).toBe(5)
  })

  it('each row counts up to its cap: a sixth lamp adds nothing a fourth did not', () => {
    const lamps = (n: number) => Array.from({ length: n }, (_, k) => piece('lamp', k * 3, 0))
    expect(charmPoints(farmOf(lamps(4))) - charmPoints(farmOf(lamps(1)))).toBe(15)
    expect(charmPoints(farmOf(lamps(6)))).toBe(charmPoints(farmOf(lamps(4))))
  })

  it('path tiles count only joined edge to edge; a painted bench counts as paint; a set complete counts', () => {
    const apart = [piece('path', 0, 0), piece('path', 5, 0)]
    const joined = [piece('path', 0, 0), piece('path', 1.2, 0)]
    expect(charmCounts(farmOf(apart)).paths).toBe(0)
    expect(charmCounts(farmOf(joined)).paths).toBe(2)
    expect(charmCounts(farmOf([piece('bench', 0, 0, 'sky'), piece('bush', 3, 0, 'sky')])).paints).toBe(1)
    expect(charmCounts(farmOf([piece('lamp'), piece('lantern', 3)])).sets).toBe(1)
  })

  it('ranks from plain to enchanting, each a star more', () => {
    expect(RANKS.map((r) => r.stars)).toEqual([1, 2, 3, 4, 5])
    expect(rankOf(0)).toBe(0)
    expect(rankOf(RANKS[2].from)).toBe(2)
    expect(rankOf(10_000)).toBe(RANKS.length - 1)
    // the most a farm can score reaches the top rank
    expect(CHARM.reduce((n, r) => n + r.cap * r.per, 0)).toBeGreaterThanOrEqual(RANKS[RANKS.length - 1].from)
  })

  it('every hint names a row with room left; the house’s rooms only once there is a house', () => {
    const farms = [
      farmOf([]),
      farmOf([piece('lamp'), piece('lantern', 3)]),
      farmOf(
        Array.from({ length: 4 }, (_, k) => piece('lamp', k * 3)),
        0,
      ),
    ]
    for (const f of farms) {
      const v = charmView(f)
      const n = charmCounts(f)
      const row = CHARM.find((r) => r.hint === v.hint)!
      expect(row, v.hint ?? 'none').toBeDefined()
      expect(n[row.id]).toBeLessThan(row.cap)
    }
    expect(charmView(farmOf(Array.from({ length: 4 }, (_, k) => piece('lamp', k * 3)))).hint).toBe(CHARM.find((r) => r.id === 'trees')!.hint)
  })
})

describe('the charm told', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFarm()
    quietCharm(false)
  })
  afterEach(() => quietCharm(true))

  it('a rank first reached is told once, kept; a farm from before it has its rank now told already', () => {
    expect(farm.charm.told).toBe(0)
    expect(tellCharm()).toBe(false)
    farm.layout = { ...farm.layout, decor: [piece('lamp', 2, 0), piece('lantern', 4, 0), piece('tree', 6, 0), piece('bench', 8, 0)] }
    expect(tellCharm()).toBe(true)
    expect(farm.charm.told).toBeGreaterThan(0)
    expect(tellCharm()).toBe(false)
    // taken away and back: nothing twice
    const told = farm.charm.told
    farm.layout = { ...farm.layout, decor: [] }
    expect(tellCharm()).toBe(false)
    expect(farm.charm.told).toBe(told)
    expect(savedCharm(undefined, { ...farm, layout: { ...farm.layout, decor: [piece('lamp', 2, 0), piece('lantern', 4, 0), piece('tree', 6, 0)] } }).told).toBeGreaterThan(0)
    expect(savedCharm({ told: 99 }, farm).told).toBe(0)
  })
})
