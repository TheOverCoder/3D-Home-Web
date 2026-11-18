// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BEDS, CROPS, MACHINES, MACHINE_IDS, WATER_SHARE, cropById } from './data'
import { dayNumber } from './daily'
import { QUEUE } from './machineView'
import { AWAY_MOST, bedStage, cameBack, farm, fullWater, ledgerNow, marketFill, plant, resetFarm, setDailyClock, setRandom, yieldOf } from './state'
import { playedSave, startFrom } from './testSaves'

// A time away of up to a day (src/farm/state/away.ts, AWAY_MOST: decision 2): nothing the farm can set before leaving
// outlasts it, a day of it is quick to play on, a long crop needs no watering after its seeds' soak (cotton left for
// the night is ripe in the morning), and each step of it is on its own calendar day (a sale in the shop while away goes into the ledger on the day it was made).

const HOUR = 3600

beforeEach(() => {
  localStorage.clear()
  resetFarm()
})
afterEach(() => {
  setDailyClock(null)
  setRandom(null)
})

describe('a time away of up to a day', () => {
  it('counts a day, and nothing the farm can set outlasts it: no crop, no machine’s queue full of its longest job', () => {
    expect(AWAY_MOST).toBe(24 * HOUR)
    for (const c of CROPS) expect(c.growSeconds, c.id).toBeLessThanOrEqual(AWAY_MOST)
    for (const id of MACHINE_IDS) {
      const longest = Math.max(...MACHINES[id].recipes.map((r) => r.seconds))
      expect(longest * QUEUE.max, id).toBeLessThanOrEqual(AWAY_MOST)
    }
    expect(cameBack(30 * HOUR)!.counted).toBe(AWAY_MOST)
  })

  it('plays on a day away on the fullest test farm quickly (a phone does it once, as the page opens)', () => {
    startFrom(playedSave())
    const start = performance.now()
    cameBack(AWAY_MOST)
    // about 100 ms alone in Node (the mission's bound is 150); ten times that leaves room for a machine under load, and
    // still fails a catch-up that grew a step too fine
    expect(performance.now() - start).toBeLessThan(1500)
  })

  it('cotton planted before bed, the page closed nine hours, no sprinklers: it is ripe, and the card counts it', () => {
    farm.sprinkler = false
    farm.coins = 100
    const i = farm.beds.findIndex((b, k) => b.built && !BEDS[k].expansion)
    // its seeds' soak lasts its whole growing: no watering
    expect(fullWater('cotton')).toBeGreaterThanOrEqual(cropById('cotton').growSeconds)
    expect(fullWater('lettuce')).toBeCloseTo(cropById('lettuce').growSeconds * WATER_SHARE, 6)
    expect(plant(i, 'cotton')).toBe(true)
    const r = cameBack(9 * HOUR)!
    expect(bedStage(i)).toBe('ripe')
    expect(r.goods).toContainEqual({ item: 'cotton', count: yieldOf('cotton') })
    expect(r.thirsty).toBe(0)
  })

  it('a sale in the shop while away goes into the ledger on the day it was made', () => {
    // back on the 18th at 8:00, after 20 hours away: the shop's goods sold soon after leaving, on the 17th
    const back = new Date(2026, 10, 18, 8, 0).getTime()
    setDailyClock(() => back)
    setRandom(() => 0)
    marketFill('egg')
    farm.market.nextIn = 30
    cameBack(20 * HOUR)
    const days = ledgerNow().days.map((d) => d.day)
    expect(days).toContain(dayNumber(back - 20 * HOUR * 1000))
    expect(days).not.toContain(dayNumber(back))
  })
})
