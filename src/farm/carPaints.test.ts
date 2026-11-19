// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CAR_PAINTS, PAINT_IDS, freshCar, sanitizeCar } from './carPaints'
import { buyPaint, farm, paintProblem, resetFarm, unlockAll, wearPaint, xpNow } from './state'
import { savedNow, startFrom } from './testSaves'
import { unlockLevel } from './unlocks'

// Your car's paints (src/farm/carPaints.ts, src/farm/state/car.ts; mission 11 c10): red free and yours; five more at
// 300 to 1,200, opening at levels 16 to 40, bought once (with `build` XP), worn for free; kept in the save.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
})
// (everything is open under Vitest: a test that locks puts it back)
afterEach(() => unlockAll(true))

describe("the car's paints", () => {
  it('red is free and yours; five more at 300 to 1,200, each opening at a level from 16 to 40, dearer each time', () => {
    expect(freshCar()).toEqual({ owned: ['red'], worn: 'red' })
    expect(CAR_PAINTS.red.price).toBe(0)
    const rest = PAINT_IDS.filter((id) => id !== 'red')
    expect(rest.map((id) => CAR_PAINTS[id].price)).toEqual([300, 450, 650, 900, 1200])
    expect(rest.map((id) => unlockLevel(`paint:${id}`))).toEqual([16, 22, 28, 34, 40])
  })

  it('bought once at its price (with XP) and put on; worn again for free; locked or short, nothing changes', () => {
    unlockAll(true)
    farm.coins = 1000
    const xp = xpNow().points
    expect(buyPaint('sky')).toBe(true)
    expect(farm.car).toEqual({ owned: ['red', 'sky'], worn: 'sky' })
    expect(xpNow().points).toBeGreaterThan(xp)
    expect(paintProblem('sky')).toBe('owned')
    expect(buyPaint('sky')).toBe(false)
    const coins = farm.coins
    expect(wearPaint('red')).toBe(true)
    expect(wearPaint('red')).toBe(false)
    expect(wearPaint('plum')).toBe(false)
    expect(farm.coins).toBe(coins)
    farm.coins = 100
    expect(paintProblem('mint')).toBe('coins')
    unlockAll(false)
    expect(paintProblem('plum')).toBe('locked')
  })

  it('kept in the save; a save without it, or a broken one, reads back red, owned and worn', () => {
    unlockAll(true)
    farm.coins = 1000
    buyPaint('mint')
    startFrom(savedNow())
    expect(farm.car).toEqual({ owned: ['red', 'mint'], worn: 'mint' })
    for (const raw of [undefined, null, 'red', { owned: 'all' }, { owned: ['gold', 'mint'], worn: 'gold' }, { owned: [], worn: 'navy' }])
      expect(sanitizeCar(raw).owned[0], JSON.stringify(raw)).toBe('red')
    expect(sanitizeCar({ owned: ['gold', 'mint'], worn: 'gold' })).toEqual({ owned: ['red', 'mint'], worn: 'red' })
    expect(sanitizeCar({ owned: [], worn: 'navy' })).toEqual({ owned: ['red'], worn: 'red' })
  })
})
